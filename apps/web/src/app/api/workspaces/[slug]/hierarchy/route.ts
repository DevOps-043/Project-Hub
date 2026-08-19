import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getSofiaAdmin, getSofiaServiceRoleClient } from '@/lib/supabase/sofia-client';
import { requireWorkspaceMember } from '@/lib/auth/require-role';

const MANAGER_ROLES = ['owner', 'admin'] as const;
const NODE_TYPES = ['organization', 'area', 'region', 'zone', 'team', 'custom'] as const;
type NodeType = typeof NODE_TYPES[number];

// Tipos evidenciados por los .select() de este archivo contra la instancia
// SOFIA (organization_nodes/organization_node_users no tienen types generados
// aquí) — cubren solo los campos que este archivo realmente lee.
interface OrgNode {
  id: string;
  depth: number;
  position: number;
  manager_id: string | null;
  properties: Record<string, unknown> | null;
  type: string;
  parent_id: string | null;
}

interface OrgNodeAssignment {
  id: string;
  node_id: string;
  user_id: string;
  role: string;
  is_primary: boolean;
}

interface AccountUserProfile {
  display_name: string | null;
  first_name: string | null;
  last_name_paternal: string | null;
  email: string;
  avatar_url: string | null;
  company_role: string | null;
  department: string | null;
}

interface WorkspaceMemberHierarchyRow {
  user_id: string;
  iris_role: string;
  account_users: AccountUserProfile | AccountUserProfile[] | null;
}

interface LocalTeamRow {
  team_id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  status: string;
  visibility: string;
  owner_id: string;
  team_members: { count: number }[];
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim().slice(0, maxLength);
  return clean || null;
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'equipo';
}

async function authorize(request: NextRequest, slug: string, requireAdmin = false) {
  const auth = await requireWorkspaceMember(request, slug);
  if (!auth.ok) return { error: auth.response };
  const { payload, workspace, member } = auth;

  if (requireAdmin && !MANAGER_ROLES.includes(member.iris_role as typeof MANAGER_ROLES[number])) {
    return { error: NextResponse.json({ error: 'Solo propietarios y administradores pueden modificar la estructura' }, { status: 403 }) };
  }

  if (!workspace.sofia_org_id) {
    return { error: NextResponse.json({ error: 'Este workspace no está vinculado a una organización de SofLIA' }, { status: 409 }) };
  }

  return { payload, workspace, member };
}

async function createLocalTeam(input: {
  workspaceId: string;
  name: string;
  description: string | null;
  color: string;
  ownerId: string;
}) {
  const supabase = getSupabaseAdmin();
  const baseSlug = slugify(input.name);
  let slug = baseSlug;

  const { data: existing } = await supabase
    .from('teams')
    .select('slug')
    .like('slug', `${baseSlug}%`);
  const used = new Set((existing || []).map((team: { slug: string }) => team.slug));
  let suffix = 2;
  while (used.has(slug)) slug = `${baseSlug}-${suffix++}`;

  const { data: team, error } = await supabase
    .from('teams')
    .insert({
      workspace_id: input.workspaceId,
      name: input.name,
      slug,
      description: input.description,
      color: input.color,
      visibility: 'internal',
      status: 'active',
      owner_id: input.ownerId,
      settings: { hierarchyManaged: true },
    })
    .select('team_id, name, slug')
    .single();

  if (error) throw new Error(error.message);
  await ensureLocalTeamMember(team.team_id, input.ownerId, 'owner');
  return team;
}

async function ensureLocalTeamMember(teamId: string, userId: string, role: 'owner' | 'member') {
  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from('team_members')
    .select('member_id')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    await supabase.from('team_members').update({ role, is_active: true }).eq('member_id', existing.member_id);
    return;
  }

  await supabase.from('team_members').insert({ team_id: teamId, user_id: userId, role, is_active: true });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const auth = await authorize(request, slug);
    if ('error' in auth) return auth.error;

    const { workspace, member } = auth;
    const sofia = getSofiaAdmin();
    if (!sofia) return NextResponse.json({ error: 'La conexión con SofLIA no está configurada' }, { status: 503 });

    const [organizationResult, structuresResult, membersResult, localTeamsResult] = await Promise.all([
      sofia.from('organizations').select('id, name, hierarchy_enabled, hierarchy_config').eq('id', workspace.sofia_org_id).maybeSingle(),
      sofia.from('organization_structures').select('*').eq('organization_id', workspace.sofia_org_id).order('created_at'),
      getSupabaseAdmin()
        .from('workspace_members')
        .select('user_id, iris_role, account_users(user_id, display_name, first_name, last_name_paternal, email, avatar_url, company_role, department)')
        .eq('workspace_id', workspace.workspace_id)
        .eq('is_active', true),
      getSupabaseAdmin()
        .from('teams')
        .select('team_id, name, slug, description, color, status, visibility, owner_id, team_members(count)')
        .eq('workspace_id', workspace.workspace_id)
        .order('created_at'),
    ]);

    if (structuresResult.error) {
      console.error('SofLIA structures read error:', structuresResult.error.message);
      return NextResponse.json({ error: 'No se pudo leer la arquitectura de SofLIA' }, { status: 502 });
    }

    const structures = structuresResult.data || [];
    const requestedStructureId = request.nextUrl.searchParams.get('structureId');
    const activeStructure = structures.find((structure) => structure.id === requestedStructureId)
      || structures.find((structure) => structure.is_default)
      || structures[0]
      || null;

    let nodes: OrgNode[] = [];
    let assignments: OrgNodeAssignment[] = [];
    if (activeStructure) {
      const nodesResult = await sofia
        .from('organization_nodes')
        .select('*')
        .eq('organization_id', workspace.sofia_org_id)
        .eq('structure_id', activeStructure.id)
        .order('depth')
        .order('position');
      if (nodesResult.error) return NextResponse.json({ error: 'No se pudieron leer los niveles organizacionales' }, { status: 502 });
      nodes = (nodesResult.data || []) as OrgNode[];

      if (nodes.length) {
        const assignmentsResult = await sofia
          .from('organization_node_users')
          .select('id, node_id, user_id, role, is_primary')
          .in('node_id', nodes.map((node) => node.id));
        assignments = (assignmentsResult.data || []) as OrgNodeAssignment[];
      }
    }

    const memberById = new Map((membersResult.data || []).map((row: WorkspaceMemberHierarchyRow) => {
      const profile = Array.isArray(row.account_users) ? row.account_users[0] : row.account_users;
      return [row.user_id, {
        id: row.user_id,
        name: profile?.display_name || `${profile?.first_name || ''} ${profile?.last_name_paternal || ''}`.trim() || profile?.email || 'Miembro',
        email: profile?.email || '',
        avatarUrl: profile?.avatar_url || null,
        jobTitle: profile?.company_role || '',
        department: profile?.department || '',
        workspaceRole: row.iris_role,
      }];
    }));

    const teamById = new Map((localTeamsResult.data || []).map((team: LocalTeamRow) => [team.team_id, team]));
    const enrichedNodes = nodes.map((node) => {
      const nodeAssignments = assignments.filter((assignment) => assignment.node_id === node.id);
      const properties = node.properties && typeof node.properties === 'object' ? node.properties : {};
      const localTeamId = typeof properties.project_hub_team_id === 'string' ? properties.project_hub_team_id : null;
      const localTeam = localTeamId ? teamById.get(localTeamId) : null;
      return {
        ...node,
        properties,
        memberCount: nodeAssignments.length,
        manager: node.manager_id ? memberById.get(node.manager_id) || null : null,
        members: nodeAssignments.map((assignment) => ({
          ...assignment,
          profile: memberById.get(assignment.user_id) || null,
        })),
        localTeam: localTeam ? {
          id: localTeam.team_id,
          name: localTeam.name,
          slug: localTeam.slug,
          color: localTeam.color,
          status: localTeam.status,
          memberCount: localTeam.team_members?.[0]?.count || 0,
        } : null,
      };
    });

    const localTeams = (localTeamsResult.data || []).map((team: LocalTeamRow) => ({
      id: team.team_id,
      name: team.name,
      slug: team.slug,
      description: team.description,
      color: team.color,
      status: team.status,
      visibility: team.visibility,
      ownerId: team.owner_id,
      memberCount: team.team_members?.[0]?.count || 0,
      hierarchyNodeId: enrichedNodes.find((node) => node.localTeam?.id === team.team_id)?.id || null,
    }));

    return NextResponse.json({
      organization: organizationResult.data || {
        id: workspace.sofia_org_id,
        name: workspace.name,
        hierarchy_enabled: false,
        hierarchy_config: {},
      },
      structures,
      activeStructure,
      nodes: enrichedNodes,
      members: Array.from(memberById.values()),
      teams: localTeams,
      permissions: { canManage: MANAGER_ROLES.includes(member.iris_role as typeof MANAGER_ROLES[number]) },
      summary: {
        structures: structures.length,
        levels: new Set(nodes.map((node) => node.depth)).size,
        nodes: nodes.length,
        members: new Set(assignments.map((assignment) => assignment.user_id)).size,
        managers: new Set(nodes.map((node) => node.manager_id).filter(Boolean)).size,
        teams: localTeams.length,
      },
    });
  } catch (error) {
    console.error('Workspace hierarchy GET error:', error);
    return NextResponse.json({ error: 'No se pudo cargar la arquitectura organizacional' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const auth = await authorize(request, slug, true);
    if ('error' in auth) return auth.error;
    const { payload, workspace } = auth;

    const sofia = getSofiaServiceRoleClient();
    if (!sofia) {
      return NextResponse.json({ error: 'Se requiere SOFIA_SUPABASE_SERVICE_ROLE_KEY para modificar la arquitectura' }, { status: 503 });
    }

    const body = await request.json();
    const action = cleanText(body.action, 40);

    if (action === 'create_structure') {
      const name = cleanText(body.name, 120);
      if (!name) return NextResponse.json({ error: 'El nombre de la estructura es requerido' }, { status: 400 });

      const { data: structure, error } = await sofia
        .from('organization_structures')
        .insert({
          organization_id: workspace.sofia_org_id,
          name,
          description: cleanText(body.description, 300),
          template: 'custom',
          is_default: Boolean(body.isDefault),
          created_by: payload.sub,
          metadata: { source: 'project_hub' },
        })
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      if (body.isDefault) {
        await sofia.from('organization_structures').update({ is_default: false }).eq('organization_id', workspace.sofia_org_id).neq('id', structure.id);
      }

      const { data: root, error: rootError } = await sofia
        .from('organization_nodes')
        .insert({
          structure_id: structure.id,
          organization_id: workspace.sofia_org_id,
          parent_id: null,
          name: workspace.name,
          type: 'organization',
          manager_id: payload.sub,
          depth: 0,
          position: 0,
          properties: { source: 'project_hub' },
        })
        .select()
        .single();
      if (rootError) {
        await sofia.from('organization_structures').delete().eq('id', structure.id);
        return NextResponse.json({ error: rootError.message }, { status: 500 });
      }
      return NextResponse.json({ structure, root }, { status: 201 });
    }

    if (action === 'create_node') {
      const structureId = cleanText(body.structureId, 60);
      const parentId = cleanText(body.parentId, 60);
      const name = cleanText(body.name, 120);
      const type = cleanText(body.type, 30) as NodeType | null;
      if (!structureId || !name || !type || !NODE_TYPES.includes(type) || type === 'organization') {
        return NextResponse.json({ error: 'Estructura, nombre y tipo de nivel válidos son requeridos' }, { status: 400 });
      }

      const { data: structure } = await sofia
        .from('organization_structures')
        .select('id')
        .eq('id', structureId)
        .eq('organization_id', workspace.sofia_org_id)
        .maybeSingle();
      if (!structure) return NextResponse.json({ error: 'La estructura no pertenece a esta organización' }, { status: 404 });

      let depth = 0;
      if (parentId) {
        const { data: parent } = await sofia
          .from('organization_nodes')
          .select('id, depth')
          .eq('id', parentId)
          .eq('structure_id', structureId)
          .eq('organization_id', workspace.sofia_org_id)
          .maybeSingle();
        if (!parent) return NextResponse.json({ error: 'El nivel padre no pertenece a esta estructura' }, { status: 404 });
        depth = (parent.depth || 0) + 1;
      }

      let positionQuery = sofia
        .from('organization_nodes')
        .select('id', { count: 'exact', head: true })
        .eq('structure_id', structureId);
      positionQuery = parentId ? positionQuery.eq('parent_id', parentId) : positionQuery.is('parent_id', null);
      const { count } = await positionQuery;

      const color = cleanText(body.color, 20) || '#00D4B3';
      const description = cleanText(body.description, 500);
      let localTeam: { team_id: string; name: string; slug: string } | null = null;
      if (type === 'team') {
        localTeam = await createLocalTeam({
          workspaceId: workspace.workspace_id,
          name,
          description,
          color,
          ownerId: cleanText(body.managerId, 60) || payload.sub,
        });
      }

      const properties = {
        source: 'project_hub',
        description,
        color,
        address: cleanText(body.address, 240),
        city: cleanText(body.city, 100),
        state: cleanText(body.state, 100),
        country: cleanText(body.country, 100),
        project_hub_team_id: localTeam?.team_id || null,
      };
      const { data: node, error } = await sofia
        .from('organization_nodes')
        .insert({
          structure_id: structureId,
          organization_id: workspace.sofia_org_id,
          parent_id: parentId,
          name,
          type,
          manager_id: cleanText(body.managerId, 60),
          properties,
          depth,
          position: count || 0,
        })
        .select()
        .single();

      if (error) {
        if (localTeam) await getSupabaseAdmin().from('teams').delete().eq('team_id', localTeam.team_id).eq('workspace_id', workspace.workspace_id);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (body.managerId) {
        await sofia.from('organization_node_users').insert({
          node_id: node.id,
          user_id: body.managerId,
          role: 'manager',
          is_primary: true,
        });
      }
      return NextResponse.json({ node, localTeam }, { status: 201 });
    }

    if (action === 'assign_member') {
      const nodeId = cleanText(body.nodeId, 60);
      const userId = cleanText(body.userId, 60);
      if (!nodeId || !userId) return NextResponse.json({ error: 'Nodo y miembro son requeridos' }, { status: 400 });

      const { data: node } = await sofia
        .from('organization_nodes')
        .select('id, type, properties')
        .eq('id', nodeId)
        .eq('organization_id', workspace.sofia_org_id)
        .maybeSingle();
      if (!node) return NextResponse.json({ error: 'Nivel no encontrado' }, { status: 404 });

      const { data: existing } = await sofia
        .from('organization_node_users')
        .select('id')
        .eq('node_id', nodeId)
        .eq('user_id', userId)
        .maybeSingle();
      if (!existing) {
        const { error } = await sofia.from('organization_node_users').insert({
          node_id: nodeId,
          user_id: userId,
          role: cleanText(body.role, 30) || 'member',
          is_primary: Boolean(body.isPrimary),
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const localTeamId = node.properties?.project_hub_team_id;
      if (node.type === 'team' && localTeamId) {
        await ensureLocalTeamMember(localTeamId, userId, 'member');
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'update_settings') {
      const hierarchyConfig = body.hierarchyConfig && typeof body.hierarchyConfig === 'object' ? body.hierarchyConfig : {};
      if (body.enabled) {
        const [{ data: organizationUsers }, { data: structureRows }] = await Promise.all([
          sofia
            .from('organization_users')
            .select('user_id')
            .eq('organization_id', workspace.sofia_org_id)
            .eq('status', 'active'),
          sofia
            .from('organization_structures')
            .select('id')
            .eq('organization_id', workspace.sofia_org_id),
        ]);
        const structureIds = (structureRows || []).map((structure) => structure.id);
        let assignedUserIds = new Set<string>();
        if (structureIds.length) {
          const { data: organizationNodes } = await sofia
            .from('organization_nodes')
            .select('id')
            .in('structure_id', structureIds);
          const nodeIds = (organizationNodes || []).map((node) => node.id);
          if (nodeIds.length) {
            const { data: nodeUsers } = await sofia
              .from('organization_node_users')
              .select('user_id')
              .in('node_id', nodeIds);
            assignedUserIds = new Set((nodeUsers || []).map((assignment) => assignment.user_id));
          }
        }
        const unassignedCount = (organizationUsers || []).filter((user) => !assignedUserIds.has(user.user_id)).length;
        if (unassignedCount > 0) {
          return NextResponse.json({
            error: `Asigna una unidad a ${unassignedCount} ${unassignedCount === 1 ? 'persona' : 'personas'} antes de activar la jerarquía`,
            unassignedCount,
          }, { status: 409 });
        }
      }
      const { error } = await sofia
        .from('organizations')
        .update({
          hierarchy_enabled: Boolean(body.enabled),
          hierarchy_config: hierarchyConfig,
        })
        .eq('id', workspace.sofia_org_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 });
  } catch (error) {
    console.error('Workspace hierarchy POST error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo actualizar la arquitectura' }, { status: 500 });
  }
}
