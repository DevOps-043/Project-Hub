/**
 * Pipeline compartido: convierte una identidad SOFIA ya verificada (por
 * password o por SSO de Learning) en una sesion local de Project Hub.
 *
 * Extraido de `app/api/auth/login/route.ts` para que el callback de SSO
 * (`app/api/auth/callback/learning/route.ts`) no tenga que duplicar la
 * sincronizacion con IRIS, la emision de JWT ni el registro de sesion/login.
 */

import { NextRequest } from 'next/server';
import { supabaseAdmin, AccountUser } from '@/lib/supabase/server';
import { generateTokenPair, hashToken } from '@/lib/auth/jwt';
import { getSofiaUserOrgs, recordSofiaLogin, normalizeAccountUsername as normalizeUsername, SOFIA_MANAGED_PASSWORD_PLACEHOLDER } from '@/lib/auth/sofia-auth';
import { syncWorkspacesFromSofia } from '@/lib/services/workspace-service';
import { mapPermissionToRole } from '@/lib/auth/roles';
import { detectDeviceType, detectBrowser } from '@/lib/http/user-agent';
import type { SofiaUser } from '@/lib/supabase/sofia-client';

export interface WorkspaceInfo {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  role: string;
}

export interface LoginResponse {
  user: {
    id: string;
    email: string;
    name: string;
    firstName?: string;
    lastName?: string;
    role: 'admin' | 'user' | 'guest';
    permissionLevel?: string;
    avatar?: string;
    createdAt: Date;
    updatedAt: Date;
    sofiaUserId?: string;
  };
  workspaces: WorkspaceInfo[];
  accessToken: string;
  refreshToken: string;
  authSource: 'sofia' | 'local';
}

const AUTH_DEBUG = process.env.AUTH_DEBUG === 'true';

function debugLogin(...args: unknown[]): void {
  if (AUTH_DEBUG) {
    console.log(...args);
  }
}

/**
 * Sincroniza un usuario de SOFIA con la BD local de IRIS.
 * Si el usuario ya existe (por user_id, email o username), lo actualiza.
 * Si no existe, lo crea.
 */
async function syncSofiaUserToIris(sofiaUser: SofiaUser): Promise<AccountUser> {
  if (!sofiaUser.email) {
    throw new Error('El usuario de SOFIA no tiene email; no se puede sincronizar con Project Hub');
  }

  const desiredUsername = normalizeUsername(sofiaUser.username, sofiaUser.email);

  // Buscar la fila espejo existente. NO basta con el email: una cuenta puede
  // haberse creado antes con otro correo (p.ej. @pulsehub.mx) y el mismo
  // username, y entonces el INSERT chocaba contra UNIQUE(username).
  // Se consultan las tres claves candidatas (user_id, email, username) de una vez.
  const { data: candidates } = await supabaseAdmin
    .from('account_users')
    .select('*')
    .or(
      [
        `user_id.eq.${sofiaUser.user_id}`,
        `email.ilike.${sofiaUser.email}`,
        `username.ilike.${desiredUsername}`,
      ].join(',')
    );

  const rows = (candidates || []) as AccountUser[];
  const matchById = rows.find((row) => row.user_id === sofiaUser.user_id);
  const matchByEmail = rows.find(
    (row) => row.email?.toLowerCase() === sofiaUser.email.toLowerCase()
  );
  const matchByUsername = rows.find(
    (row) => row.username?.toLowerCase() === desiredUsername.toLowerCase()
  );

  // Prioridad: el id de SOFIA es la identidad mas fuerte, luego el email.
  const existingUser = matchById || matchByEmail || matchByUsername;

  if (existingUser) {
    const updateData: Record<string, unknown> = {
      sofia_user_id: sofiaUser.user_id,
      first_name: sofiaUser.first_name,
      last_name_paternal: sofiaUser.last_name_paternal,
      last_name_maternal: sofiaUser.last_name_maternal,
      display_name: sofiaUser.display_name || `${sofiaUser.first_name} ${sofiaUser.last_name_paternal}`,
      last_login_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // email y username son UNIQUE: solo se sincronizan si nadie mas los tiene.
    if (!matchByEmail || matchByEmail.user_id === existingUser.user_id) {
      updateData.email = sofiaUser.email;
    } else {
      console.warn(
        `[SYNC] El email ${sofiaUser.email} ya pertenece a otro usuario de Project Hub; se conserva ${existingUser.email}`
      );
    }

    if (!matchByUsername || matchByUsername.user_id === existingUser.user_id) {
      updateData.username = desiredUsername;
    } else {
      console.warn(
        `[SYNC] El username ${desiredUsername} ya pertenece a otro usuario de Project Hub; se conserva ${existingUser.username}`
      );
    }

    if (sofiaUser.company_role) updateData.company_role = sofiaUser.company_role;
    if (sofiaUser.department) updateData.department = sofiaUser.department;
    if (sofiaUser.phone_number) updateData.phone_number = sofiaUser.phone_number;

    // Solo actualizar avatar si SOFIA tiene uno (no sobrescribir con null)
    if (sofiaUser.avatar_url) {
      updateData.avatar_url = sofiaUser.avatar_url;
    }

    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('account_users')
      .update(updateData)
      .eq('user_id', existingUser.user_id)
      .select()
      .single();

    if (updateError) {
      // No bloquea el login: seguimos con los datos que ya teniamos localmente.
      console.error('[SYNC] Error actualizando usuario espejo en Project Hub:', updateError);
    }

    return (updatedUser || existingUser) as AccountUser;
  }

  // Crear usuario nuevo en IRIS basado en los datos de SOFIA.
  // user_id = id de SOFIA (auth.users) para que coincida con el que usa
  // syncAllOrgMembers al poblar workspace_members.
  const { data: newUser, error } = await supabaseAdmin
    .from('account_users')
    .insert({
      user_id: sofiaUser.user_id,
      sofia_user_id: sofiaUser.user_id,
      first_name: sofiaUser.first_name,
      last_name_paternal: sofiaUser.last_name_paternal,
      last_name_maternal: sofiaUser.last_name_maternal || null,
      display_name: sofiaUser.display_name || `${sofiaUser.first_name} ${sofiaUser.last_name_paternal}`,
      username: desiredUsername,
      email: sofiaUser.email,
      // SOFIA ya no expone hashes: las credenciales viven en su Supabase Auth.
      password_hash: SOFIA_MANAGED_PASSWORD_PLACEHOLDER,
      permission_level: sofiaUser.permission_level || 'user',
      company_role: sofiaUser.company_role || null,
      department: sofiaUser.department || null,
      account_status: 'active', // Si SOFIA dice que esta activo, confiar
      is_email_verified: sofiaUser.is_email_verified,
      avatar_url: sofiaUser.avatar_url || null,
      phone_number: sofiaUser.phone_number || null,
      timezone: sofiaUser.timezone || 'America/Mexico_City',
      locale: sofiaUser.locale || 'es-MX',
      last_login_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error || !newUser) {
    console.error('[SYNC] Error creando usuario en Project Hub:', error);
    throw new Error(
      `Error al sincronizar usuario con Project Hub${error?.details ? `: ${error.details}` : ''}`
    );
  }

  debugLogin('[SYNC] Usuario sincronizado de SOFIA a Project Hub:', newUser.email);
  return newUser as AccountUser;
}

async function createSession(
  userId: string,
  tokens: { accessToken: string; refreshToken: string; expiresIn: number },
  request: NextRequest
) {
  const sessionData = {
    user_id: userId,
    token_hash: await hashToken(tokens.accessToken),
    refresh_token_hash: await hashToken(tokens.refreshToken),
    ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
    user_agent: request.headers.get('user-agent') || null,
    device_type: detectDeviceType(request.headers.get('user-agent') || ''),
    browser_name: detectBrowser(request.headers.get('user-agent') || ''),
    expires_at: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
    is_active: true,
  };

  await supabaseAdmin.from('auth_sessions').insert(sessionData);
}

async function logLoginAttempt(
  identifier: string,
  request: NextRequest,
  status: string,
  userId: string | null
) {
  try {
    await supabaseAdmin.from('auth_login_history').insert({
      login_identifier: identifier,
      ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      user_agent: request.headers.get('user-agent') || null,
      login_status: status,
      user_id: userId,
    });
  } catch {
    // No es critico si falla el logging
  }
}

/**
 * Convierte una identidad SOFIA ya verificada (password o SSO) en una sesion
 * local de Project Hub: sincroniza el espejo en `account_users`, trae
 * organizaciones/workspaces de SOFIA, emite el JWT propio y registra la
 * sesion y el intento de login.
 */
export async function completeSofiaLogin(
  sofiaUser: SofiaUser,
  sofiaAccessToken: string | undefined,
  request: NextRequest,
  loginIdentifierForLog: string
): Promise<LoginResponse> {
  const irisUser = await syncSofiaUserToIris(sofiaUser);

  const sofiaOrgs = await getSofiaUserOrgs(sofiaUser.user_id, sofiaAccessToken);
  const syncedWorkspaces = await syncWorkspacesFromSofia(irisUser.user_id, sofiaOrgs);

  const workspaces: WorkspaceInfo[] = syncedWorkspaces.map((ws) => ({
    id: ws.workspace_id,
    name: ws.name,
    slug: ws.slug,
    logoUrl: ws.logo_url || undefined,
    role: ws.iris_role,
  }));

  const tokens = await generateTokenPair(irisUser);
  await createSession(irisUser.user_id, tokens, request);

  await logLoginAttempt(loginIdentifierForLog, request, 'success', irisUser.user_id);
  await recordSofiaLogin(sofiaUser.user_id, sofiaAccessToken);

  try {
    await supabaseAdmin.rpc('reset_failed_login_attempts', { p_user_id: irisUser.user_id });
  } catch {
    // No es critico si falla
  }

  return {
    user: {
      id: irisUser.user_id,
      email: irisUser.email,
      name: irisUser.display_name || `${irisUser.first_name} ${irisUser.last_name_paternal}`,
      firstName: irisUser.first_name,
      lastName: `${irisUser.last_name_paternal} ${irisUser.last_name_maternal || ''}`.trim(),
      role: mapPermissionToRole(irisUser.permission_level),
      permissionLevel: irisUser.permission_level,
      avatar: irisUser.avatar_url || undefined,
      createdAt: new Date(irisUser.created_at),
      updatedAt: new Date(irisUser.updated_at),
      sofiaUserId: sofiaUser.user_id,
    },
    workspaces,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    authSource: 'sofia',
  };
}
