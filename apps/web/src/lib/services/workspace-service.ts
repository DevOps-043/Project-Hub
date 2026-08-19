/**
 * Workspace Service
 *
 * Sincroniza organizaciones de SOFIA con workspaces de Project Hub
 * y provee queries para gestión de workspaces.
 */

import { getSupabaseAdmin } from '../supabase/server';
import { getSofiaAdmin } from '../supabase/sofia-client';
import {
  mapPlatformRoleToPermission,
  normalizeAccountUsername as normalizeUsername,
  SOFIA_MANAGED_PASSWORD_PLACEHOLDER,
} from '../auth/sofia-auth';

// ── Tipos ──

export interface Workspace {
  workspace_id: string;
  sofia_org_id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  brand_color: string;
  is_active: boolean;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  member_id: string;
  workspace_id: string;
  user_id: string;
  sofia_role: string;
  iris_role: 'owner' | 'admin' | 'manager' | 'leader' | 'member';
  is_active: boolean;
  joined_at: string;
  updated_at: string;
}

export interface WorkspaceWithRole extends Workspace {
  iris_role: string;
  sofia_role: string;
}

interface SofiaOrgData {
  organization_id: string;
  role: string;
  status?: string;
  organizations: {
    id: string;
    name: string;
    slug: string;
    logo_url?: string;
    brand_logo_url?: string;
    brand_primary_color?: string;
    description?: string;
  };
}

/** Fila de `workspace_members` con el perfil de `account_users` embebido (join). */
export interface WorkspaceMemberWithAccount {
  member_id: string;
  workspace_id: string;
  user_id: string;
  sofia_role: string;
  iris_role: WorkspaceMember['iris_role'];
  is_active: boolean;
  joined_at: string;
  updated_at: string;
  account_users: {
    user_id: string;
    first_name: string | null;
    last_name_paternal: string | null;
    display_name: string | null;
    email: string;
    avatar_url: string | null;
    permission_level: string;
    company_role: string | null;
    department: string | null;
    phone_number: string | null;
    account_status: string;
    last_activity_at: string | null;
  } | null;
}

/** Fila de `public.users` en SOFIA usada para sincronizar miembros. */
interface SofiaUserRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  username: string;
  email: string;
  platform_role: string | null;
  profile_picture_url: string | null;
  email_verified: boolean | null;
  is_banned: boolean | null;
  bio: string | null;
  location: string | null;
  phone: string | null;
}

interface SofiaOrgMemberRow {
  user_id: string;
  role: string;
  status: string | null;
}

interface ExistingMemberRow {
  user_id: string;
  is_active: boolean;
}

interface LegacyAccountRow {
  user_id: string;
  email: string | null;
  username: string | null;
}

// ── Funciones ──

export interface WorkspaceMemberListOptions {
  limit?: number;
  offset?: number;
}

export interface WorkspaceMembersPage {
  members: WorkspaceMemberWithAccount[];
  total: number;
}

const WORKSPACE_SELECT = `
  workspace_id,
  sofia_org_id,
  name,
  slug,
  description,
  logo_url,
  brand_color,
  is_active,
  settings,
  created_at,
  updated_at
`;

const WORKSPACE_MEMBER_SELECT = `
  member_id,
  workspace_id,
  user_id,
  sofia_role,
  iris_role,
  is_active,
  joined_at,
  updated_at,
  account_users (
    user_id,
    first_name,
    last_name_paternal,
    display_name,
    email,
    avatar_url,
    permission_level,
    company_role,
    department,
    phone_number,
    account_status,
    last_activity_at
  )
`;

const SYNC_BATCH_SIZE = 500;

/**
 * Mapea un rol de SOFIA al rol equivalente en Project Hub
 */
function mapSofiaRoleToIris(sofiaRole: string): WorkspaceMember['iris_role'] {
  switch (sofiaRole) {
    case 'owner': return 'owner';
    case 'admin': return 'admin';
    case 'member': return 'member';
    default: return 'member';
  }
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

/**
 * Sincroniza las organizaciones de SOFIA con workspaces en Project Hub.
 * Crea workspaces nuevos si no existen, actualiza info si cambió.
 * Crea/actualiza membresías del usuario.
 */
export async function syncWorkspacesFromSofia(
  irisUserId: string,
  sofiaOrgs: SofiaOrgData[]
): Promise<WorkspaceWithRole[]> {
  if (!sofiaOrgs || sofiaOrgs.length === 0) return [];

  const supabase = getSupabaseAdmin();
  const results: WorkspaceWithRole[] = [];

  for (const orgUser of sofiaOrgs) {
    if (!orgUser.organizations || orgUser.status === 'removed') continue;

    const org = orgUser.organizations;
    const sofiaOrgId = org.id || orgUser.organization_id;

    try {
      // 1. Upsert workspace
      const { data: workspace, error: wsError } = await supabase
        .from('workspaces')
        .upsert(
          {
            sofia_org_id: sofiaOrgId,
            name: org.name,
            slug: org.slug,
            logo_url: org.logo_url || org.brand_logo_url || null,
            brand_color: org.brand_primary_color || '#3B82F6',
            description: org.description || null,
            is_active: true,
          },
          { onConflict: 'sofia_org_id' }
        )
        .select(WORKSPACE_SELECT)
        .single();

      if (wsError) {
        console.error(`[WORKSPACE SERVICE] Error upserting workspace ${org.slug}:`, wsError.message);
        continue;
      }

      // 2. Check if membership already exists (to preserve manually-edited iris_role)
      const { data: existingMember } = await supabase
        .from('workspace_members')
        .select('iris_role')
        .eq('workspace_id', workspace.workspace_id)
        .eq('user_id', irisUserId)
        .maybeSingle();

      let actualIrisRole: string;

      if (existingMember) {
        // Member exists: only update sofia_role, NEVER overwrite iris_role
        const { error: updateError } = await supabase
          .from('workspace_members')
          .update({
            sofia_role: orgUser.role || 'member',
            is_active: true,
          })
          .eq('workspace_id', workspace.workspace_id)
          .eq('user_id', irisUserId);

        if (updateError) {
          console.error(`[WORKSPACE SERVICE] Error updating member:`, updateError.message);
        }

        actualIrisRole = existingMember.iris_role;
      } else {
        // New member: insert with mapped iris_role
        const irisRole = mapSofiaRoleToIris(orgUser.role || 'member');

        const { error: insertError } = await supabase
          .from('workspace_members')
          .insert({
            workspace_id: workspace.workspace_id,
            user_id: irisUserId,
            sofia_role: orgUser.role || 'member',
            iris_role: irisRole,
            is_active: true,
          });

        if (insertError) {
          console.error(`[WORKSPACE SERVICE] Error inserting member:`, insertError.message);
        }

        actualIrisRole = irisRole;
      }

      results.push({
        ...workspace,
        iris_role: actualIrisRole,
        sofia_role: orgUser.role || 'member',
      });
    } catch (err) {
      console.error(`[WORKSPACE SERVICE] Error syncing org ${org.slug}:`, err);
    }
  }

  return results;
}

/**
 * Obtiene todos los workspaces de un usuario con sus roles
 */
export async function getWorkspacesForUser(userId: string): Promise<WorkspaceWithRole[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('workspace_members')
    .select(`
      sofia_role,
      iris_role,
      is_active,
      workspaces (${WORKSPACE_SELECT})
    `)
    .eq('user_id', userId)
    .eq('is_active', true) as {
      data: Array<{ sofia_role: string; iris_role: string; is_active: boolean; workspaces: Workspace | null }> | null;
      error: { message: string } | null;
    };

  if (error) {
    console.error('[WORKSPACE SERVICE] Error fetching workspaces:', error.message);
    return [];
  }

  if (!data) return [];

  return data
    .filter((m) => m.workspaces && m.workspaces.is_active)
    .map((m) => ({
      ...(m.workspaces as Workspace),
      iris_role: m.iris_role,
      sofia_role: m.sofia_role,
    }));
}

/**
 * Obtiene un workspace por slug
 */
export async function getWorkspaceBySlug(slug: string): Promise<Workspace | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('workspaces')
    .select(WORKSPACE_SELECT)
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('[WORKSPACE SERVICE] Error fetching workspace by slug:', error.message);
    return null;
  }

  return data;
}

/**
 * Obtiene el rol de un usuario en un workspace específico
 */
export async function getUserWorkspaceRole(
  workspaceId: string,
  userId: string
): Promise<WorkspaceMember | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('workspace_members')
    .select('member_id, workspace_id, user_id, sofia_role, iris_role, is_active, joined_at, updated_at')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('[WORKSPACE SERVICE] Error fetching user role:', error.message);
    return null;
  }

  return data;
}

/**
 * Obtiene miembros de un workspace con paginacion opcional.
 */
export async function getWorkspaceMembersPage(
  workspaceId: string,
  options: WorkspaceMemberListOptions = {}
): Promise<WorkspaceMembersPage> {
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from('workspace_members')
    .select(WORKSPACE_MEMBER_SELECT, { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)
    .order('joined_at', { ascending: true });

  if (options.limit !== undefined) {
    const offset = options.offset || 0;
    query = query.range(offset, offset + options.limit - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[WORKSPACE SERVICE] Error fetching members:', error.message);
    return { members: [], total: 0 };
  }

  return {
    // Supabase infiere `account_users` embebido como arreglo porque no hay
    // Database generado que le confirme que es una relación 1:1; en runtime
    // siempre es un objeto único (o null), como ya asumen los consumidores.
    members: (data || []) as unknown as WorkspaceMemberWithAccount[],
    total: count ?? data?.length ?? 0,
  };
}

/**
 * Obtiene todos los miembros de un workspace.
 */
export async function getWorkspaceMembers(
  workspaceId: string,
  options: WorkspaceMemberListOptions = {}
) {
  const { members } = await getWorkspaceMembersPage(workspaceId, options);
  return members;
}

export async function getWorkspaceMemberCount(workspaceId: string): Promise<number> {
  const supabase = getSupabaseAdmin();

  const { count, error } = await supabase
    .from('workspace_members')
    .select('member_id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('is_active', true);

  if (error) {
    console.error('[WORKSPACE SERVICE] Error counting members:', error.message);
    return 0;
  }

  return count || 0;
}

/**
 * Actualiza el rol Project Hub de un miembro
 */
export async function updateMemberRole(
  workspaceId: string,
  userId: string,
  newRole: WorkspaceMember['iris_role']
): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('workspace_members')
    .update({ iris_role: newRole })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);

  if (error) {
    console.error('[WORKSPACE SERVICE] Error updating role:', error.message);
    return false;
  }

  return true;
}

/**
 * Sincroniza TODOS los miembros de una organización SOFIA con el workspace.
 *
 * - INSERTA los miembros nuevos, sin sobreescribir el `iris_role` de los que ya
 *   existen (ese rol se edita de forma independiente en Project Hub).
 * - RECONCILIA las bajas: marca `is_active = false` a los miembros que ya no
 *   pertenecen a la organización en SOFIA, y reactiva a los que regresaron.
 *   La desactivación es reversible y no rompe las FKs de tareas/proyectos.
 */
export async function syncAllOrgMembers(
  workspaceId: string,
  sofiaOrgId: string
): Promise<void> {
  return syncAllOrgMembersBatched(workspaceId, sofiaOrgId);
}

async function syncAllOrgMembersBatched(
  workspaceId: string,
  sofiaOrgId: string
): Promise<void> {
  const sofia = getSofiaAdmin();
  if (!sofia) return;

  const supabase = getSupabaseAdmin();

  try {
    // 1. Miembros que ya existen en workspace_members (para no sobreescribir iris_role)
    const { data: existingMembers, error: existingMembersError } = await supabase
      .from('workspace_members')
      .select('user_id, is_active')
      .eq('workspace_id', workspaceId);

    if (existingMembersError) {
      console.error('[WORKSPACE SERVICE] Error fetching existing members:', existingMembersError.message);
      return;
    }

    const existingByUserId = new Map<string, ExistingMemberRow>(
      (existingMembers || []).map((member: ExistingMemberRow) => [member.user_id, member])
    );

    // 2. Miembros de la org en SOFIA (fuente de verdad)
    const { data: orgMembers, error: orgError } = await sofia
      .from('organization_users')
      .select('user_id, role, status')
      .eq('organization_id', sofiaOrgId);

    if (orgError) {
      console.error('[WORKSPACE SERVICE] Error fetching SOFIA org members:', orgError.message);
      return;
    }

    const activeOrgMembers = (orgMembers || []).filter((member: SofiaOrgMemberRow) => member.status !== 'removed');
    const orgMemberByUserId = new Map<string, SofiaOrgMemberRow>(
      activeOrgMembers.map((member: SofiaOrgMemberRow) => [member.user_id, member])
    );
    const orgUserIds: string[] = activeOrgMembers.map((member: SofiaOrgMemberRow) => member.user_id);

    // 3. Perfiles SOFIA de TODOS los miembros de la org.
    //    Se necesitan completos (no solo los nuevos) para poder mapear cuentas
    //    espejo heredadas antes de decidir a quien dar de baja.
    //    Columnas reales de public.users en SofLIA: `password_hash`,
    //    `permission_level` y `account_status` ya no existen; las credenciales
    //    viven en auth.users (Supabase Auth) y el rol es `platform_role`.
    const sofiaUsers: SofiaUserRow[] = [];
    for (const batch of chunkArray(orgUserIds, SYNC_BATCH_SIZE)) {
      const { data, error: usersError } = await sofia
        .from('users')
        .select(`
          id,
          first_name,
          last_name,
          display_name,
          username,
          email,
          platform_role,
          profile_picture_url,
          email_verified,
          is_banned,
          bio,
          location,
          phone
        `)
        .in('id', batch);

      if (usersError) {
        console.error('[WORKSPACE SERVICE] Error fetching SOFIA users:', usersError.message);
        return;
      }
      if (data) sofiaUsers.push(...(data as SofiaUserRow[]));
    }

    const usableSofiaUsers = sofiaUsers.filter((sofiaUser) => Boolean(sofiaUser.email));

    // 4. Cuentas espejo creadas antes de la migracion pueden tener un user_id
    //    local distinto del id de SOFIA. Insertarlas de nuevo violaria
    //    UNIQUE(email) o UNIQUE(username), asi que se reutiliza la fila existente.
    const legacyRows: LegacyAccountRow[] = [];
    for (const batch of chunkArray(usableSofiaUsers, SYNC_BATCH_SIZE)) {
      const { data } = await supabase
        .from('account_users')
        .select('user_id, email, username')
        .or(
          [
            `email.in.(${batch.map((u) => `"${u.email}"`).join(',')})`,
            `username.in.(${batch
              .map((u) => `"${normalizeUsername(u.username, u.email)}"`)
              .join(',')})`,
          ].join(',')
        );
      if (data) legacyRows.push(...(data as LegacyAccountRow[]));
    }

    const legacyIdBySofiaId = new Map<string, string>();
    for (const sofiaUser of usableSofiaUsers) {
      const desiredUsername = normalizeUsername(sofiaUser.username, sofiaUser.email);
      const legacy = legacyRows.find(
        (row) =>
          row.user_id !== sofiaUser.id &&
          (row.email?.toLowerCase() === sofiaUser.email.toLowerCase() ||
            row.username?.toLowerCase() === desiredUsername.toLowerCase())
      );
      if (legacy) legacyIdBySofiaId.set(sofiaUser.id, legacy.user_id);
    }

    /** user_id local que le corresponde a un miembro de la org SOFIA. */
    const localIdFor = (sofiaUserId: string): string =>
      legacyIdBySofiaId.get(sofiaUserId) || sofiaUserId;

    // 5. RECONCILIACION: dar de baja a quien ya no pertenece a la org en SOFIA.
    //    Sin esto, los miembros eliminados en SOFIA se quedaban para siempre en
    //    el panel (incluidos usuarios ya borrados de la tabla users).
    const allowedLocalIds = new Set(orgUserIds.map(localIdFor));

    const staleMemberIds = ((existingMembers || []) as ExistingMemberRow[])
      .filter((member) => member.is_active && !allowedLocalIds.has(member.user_id))
      .map((member) => member.user_id);

    for (const batch of chunkArray(staleMemberIds, SYNC_BATCH_SIZE)) {
      const { error: deactivateError } = await supabase
        .from('workspace_members')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('workspace_id', workspaceId)
        .in('user_id', batch);

      if (deactivateError) {
        console.error('[WORKSPACE SERVICE] Error deactivating stale members:', deactivateError.message);
      }
    }

    // 6. Reactivar a quien volvio a la org y seguia marcado como inactivo.
    const returningMemberIds = orgUserIds
      .map(localIdFor)
      .filter((localId: string) => existingByUserId.get(localId)?.is_active === false);

    for (const batch of chunkArray(returningMemberIds, SYNC_BATCH_SIZE)) {
      const { error: reactivateError } = await supabase
        .from('workspace_members')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('workspace_id', workspaceId)
        .in('user_id', batch);

      if (reactivateError) {
        console.error('[WORKSPACE SERVICE] Error reactivating members:', reactivateError.message);
      }
    }

    // 7. Insertar solo los miembros que aun no tienen fila en workspace_members.
    //    Nunca se re-escriben los existentes: iris_role se edita en Project Hub.
    const newSofiaUsers = usableSofiaUsers.filter(
      (sofiaUser) => !existingByUserId.has(localIdFor(sofiaUser.id))
    );

    const accountRows = newSofiaUsers
      .filter((sofiaUser) => !legacyIdBySofiaId.has(sofiaUser.id))
      .map((sofiaUser) => {
        const lastNameParts = (sofiaUser.last_name || '').trim().split(/\s+/).filter(Boolean);

        return {
          user_id: sofiaUser.id,
          first_name: sofiaUser.first_name || sofiaUser.username || '',
          last_name_paternal: lastNameParts[0] || '',
          last_name_maternal: lastNameParts.slice(1).join(' ') || null,
          display_name: sofiaUser.display_name || sofiaUser.username || '',
          username: normalizeUsername(sofiaUser.username, sofiaUser.email),
          email: sofiaUser.email,
          // account_users.password_hash es NOT NULL, pero SOFIA ya no expone hashes.
          password_hash: SOFIA_MANAGED_PASSWORD_PLACEHOLDER,
          permission_level: mapPlatformRoleToPermission(sofiaUser.platform_role),
          company_role: sofiaUser.bio || null,
          department: sofiaUser.location || null,
          phone_number: sofiaUser.phone || null,
          account_status: sofiaUser.is_banned === true ? 'suspended' : 'active',
          is_email_verified: sofiaUser.email_verified ?? false,
          avatar_url: sofiaUser.profile_picture_url || null,
          timezone: 'America/Mexico_City',
          locale: 'es-MX',
        };
      });

    for (const batch of chunkArray(accountRows, SYNC_BATCH_SIZE)) {
      const { error: accountError } = await supabase
        .from('account_users')
        .upsert(batch, { onConflict: 'user_id' });

      if (accountError) {
        console.error('[WORKSPACE SERVICE] Error upserting synced users:', accountError.message);
        return;
      }
    }

    const memberRows = newSofiaUsers
      .map((sofiaUser) => {
        const orgMember = orgMemberByUserId.get(sofiaUser.id);
        if (!orgMember) return null;

        return {
          workspace_id: workspaceId,
          // Si la cuenta ya existia con otro user_id, el miembro apunta a ese.
          user_id: localIdFor(sofiaUser.id),
          sofia_role: orgMember.role || 'member',
          iris_role: mapSofiaRoleToIris(orgMember.role || 'member'),
          is_active: true,
        };
      })
      .filter(Boolean) as Array<Record<string, unknown>>;

    for (const batch of chunkArray(memberRows, SYNC_BATCH_SIZE)) {
      const { error: memberError } = await supabase
        .from('workspace_members')
        .upsert(batch, { onConflict: 'workspace_id,user_id', ignoreDuplicates: true });

      if (memberError) {
        console.error('[WORKSPACE SERVICE] Error upserting workspace members:', memberError.message);
        return;
      }
    }

    if (process.env.DEBUG_WORKSPACE_SYNC === 'true') {
      console.log(
        `[WORKSPACE SERVICE] SOFIA org sync: +${memberRows.length} nuevos, ` +
        `-${staleMemberIds.length} dados de baja, ${returningMemberIds.length} reactivados`
      );
    }

  } catch (err) {
    console.error('[WORKSPACE SERVICE] Error in syncAllOrgMembers:', err);
  }
}
