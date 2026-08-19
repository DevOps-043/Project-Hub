/**
 * API Route: POST /api/auth/login
 *
 * Maneja el inicio de sesión con autenticación DUAL:
 *
 * 1. Si SOFIA está configurado (isSofiaAuthEnabled):
 *    a) Verifica credenciales con Supabase Auth de SOFIA (signInWithPassword).
 *       Acepta email o username: el username se resuelve a email contra
 *       `public.users` antes de llamar a Supabase Auth.
 *    b) Lee el PERFIL desde `public.users` de SOFIA con el token del usuario
 *    c) Sincroniza el usuario con Project Hub (crea o actualiza `account_users`)
 *    d) Genera JWT local y crea sesión en Project Hub
 *
 * 2. Fallback a autenticación local (solo si el usuario NO existe en SOFIA):
 *    a) Busca el usuario en Project Hub local (account_users)
 *    b) Verifica password contra el hash local
 *    c) Genera JWT y crea sesión
 *
 * NOTA: SOFIA migró a Supabase Auth. `public.users` ya no tiene `password_hash`
 * y su `id` es FK a `auth.users(id)`. Ver `lib/auth/sofia-auth.ts`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, AccountUser } from '@/lib/supabase/server';
import { verifyPassword } from '@/lib/auth/password';
import { generateTokenPair, hashToken } from '@/lib/auth/jwt';
import {
  isSofiaAuthEnabled,
  authenticateSofiaUser,
  recordSofiaLogin,
  getSofiaUserOrgs,
  normalizeAccountUsername as normalizeUsername,
  SOFIA_MANAGED_PASSWORD_PLACEHOLDER,
} from '@/lib/auth/sofia-auth';
import type { SofiaUser } from '@/lib/supabase/sofia-client';
import { syncWorkspacesFromSofia } from '@/lib/services/workspace-service';
import { sanitizeSearchTerm } from '@/lib/http/sanitize';
import { mapPermissionToRole } from '@/lib/auth/roles';
import { detectDeviceType, detectBrowser } from '@/lib/http/user-agent';

// Forzar runtime de Node.js para compatibilidad con bcrypt
export const runtime = 'nodejs';

interface LoginRequest {
  email: string;
  password: string;
}

interface WorkspaceInfo {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  role: string;
}

interface LoginResponse {
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

export async function POST(request: NextRequest) {
  try {
    const body: LoginRequest = await request.json();
    const email = body.email?.trim();
    const { password } = body;

    // Validaciones básicas
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y contraseña son requeridos' },
        { status: 400 }
      );
    }

    // Si contiene '@', tratar como email
    if (email.includes('@')) {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { error: 'Formato de correo inválido' },
          { status: 400 }
        );
      }
    } else {
      const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
      if (!usernameRegex.test(email)) {
        return NextResponse.json(
          { error: 'Formato de usuario inválido' },
          { status: 400 }
        );
      }
    }

    // ═══════════════════════════════════════════════════════════
    // FLUJO 1: Intentar autenticación con SOFIA primero
    // ═══════════════════════════════════════════════════════════
    if (isSofiaAuthEnabled()) {
      debugLogin('🔐 [LOGIN] Intentando autenticación con SOFIA (Supabase Auth)...');

      const sofiaAuth = await authenticateSofiaUser(email, password);

      // Solo caemos al flujo local si el usuario no existe en SOFIA.
      // Un password incorrecto NO debe reintentarse contra la BD local.
      if (!sofiaAuth.success && sofiaAuth.errorCode !== 'USER_NOT_FOUND') {
        const statusByCode: Record<string, number> = {
          ACCOUNT_LOCKED: 423,
          ACCOUNT_INACTIVE: 403,
          EMAIL_NOT_CONFIRMED: 403,
          INVALID_PASSWORD: 401,
          SOFIA_NOT_CONFIGURED: 503,
          INTERNAL_ERROR: 500,
        };
        const logStatusByCode: Record<string, string> = {
          ACCOUNT_LOCKED: 'account_locked',
          ACCOUNT_INACTIVE: 'account_suspended',
          EMAIL_NOT_CONFIRMED: 'email_not_confirmed',
          INVALID_PASSWORD: 'failed_password',
        };

        await logLoginAttempt(
          email,
          request,
          logStatusByCode[sofiaAuth.errorCode || ''] || 'failed_sofia',
          null
        );

        return NextResponse.json(
          { error: sofiaAuth.error || 'Credenciales inválidas' },
          { status: statusByCode[sofiaAuth.errorCode || ''] || 401 }
        );
      }

      if (sofiaAuth.success && sofiaAuth.user) {
        const sofiaUser = sofiaAuth.user;
        const sofiaAccessToken = sofiaAuth.session?.accessToken;

        // ✅ Autenticación SOFIA exitosa - Sincronizar con IRIS
        debugLogin('✅ [LOGIN] Credenciales verificadas con SOFIA, sincronizando con IRIS...');

        const irisUser = await syncSofiaUserToIris(sofiaUser);

        // Obtener organizaciones del usuario desde SOFIA (con el token del usuario para pasar RLS)
        const sofiaOrgs = await getSofiaUserOrgs(sofiaUser.user_id, sofiaAccessToken);

        // Sincronizar organizaciones de SOFIA con workspaces en IRIS BD
        const syncedWorkspaces = await syncWorkspacesFromSofia(irisUser.user_id, sofiaOrgs);

        // Mapear a formato de respuesta
        const workspaces: WorkspaceInfo[] = syncedWorkspaces.map(ws => ({
          id: ws.workspace_id,
          name: ws.name,
          slug: ws.slug,
          logoUrl: ws.logo_url || undefined,
          role: ws.iris_role,
        }));

        // Generar tokens JWT locales
        const tokens = await generateTokenPair(irisUser);

        // Crear sesión en Project Hub
        await createSession(irisUser.user_id, tokens, request);

        // Registrar login exitoso en ambos sistemas
        await logLoginAttempt(email, request, 'success', irisUser.user_id);
        await recordSofiaLogin(sofiaUser.user_id, sofiaAccessToken);

        // Resetear intentos fallidos
        try {
          await supabaseAdmin.rpc('reset_failed_login_attempts', { p_user_id: irisUser.user_id });
        } catch {
          // No es crítico si falla
        }

        const responseData: LoginResponse = {
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

        // Setear token como cookie httpOnly para el middleware
        const res = NextResponse.json(responseData);
        res.cookies.set('accessToken', tokens.accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 3600, // 1 hora
        });
        return res;
      } else {
        debugLogin('ℹ️ [LOGIN] Usuario no encontrado en SOFIA, probando auth local...');
      }
    }

    // ═══════════════════════════════════════════════════════════
    // FLUJO 2: Fallback a autenticación local (IRIS)
    // ═══════════════════════════════════════════════════════════
    debugLogin('🔐 [LOGIN] Usando autenticación local (Project Hub)...');

    // Buscar usuario por email o username en la BD local (case-insensitive).
    // sanitizeSearchTerm evita que un email con '%' en la parte local (válido
    // por regex, p. ej. "a%b@x.com") se interprete como comodín de ilike y
    // convierta el login en una búsqueda difusa en vez de una coincidencia exacta.
    const safeIdentifier = sanitizeSearchTerm(email);
    const { data: user, error: userError } = await supabaseAdmin
      .from('account_users')
      .select('*')
      .or(`email.ilike.${safeIdentifier},username.ilike.${safeIdentifier}`)
      .maybeSingle();

    // Registrar intento de login
    const loginLog = {
      login_identifier: email,
      ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      user_agent: request.headers.get('user-agent') || null,
      login_status: 'failed_user_not_found' as string,
      user_id: null as string | null,
    };

    if (userError || !user) {
      debugLogin('❌ [LOGIN] Usuario NO encontrado en BD local. Email/Username:', email);
      debugLogin('❌ [LOGIN] Error de Supabase:', userError?.message || 'Sin error, simplemente no existe');
      await supabaseAdmin.from('auth_login_history').insert(loginLog);
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    const accountUser = user as AccountUser;
    debugLogin('✅ [LOGIN] Usuario encontrado en BD local:', accountUser.email, '| Status:', accountUser.account_status);
    debugLogin('🔑 [LOGIN] Hash format:', accountUser.password_hash?.substring(0, 10) + '...');
    loginLog.user_id = accountUser.user_id;

    // Verificar si la cuenta está bloqueada
    if (accountUser.locked_until) {
      const lockTime = new Date(accountUser.locked_until);
      const now = new Date();
      if (lockTime > now) {
        const secondsLeft = Math.ceil((lockTime.getTime() - now.getTime()) / 1000);
        loginLog.login_status = 'account_locked';
        await supabaseAdmin.from('auth_login_history').insert(loginLog);
        return NextResponse.json(
          { 
            error: 'Cuenta bloqueada temporalmente. Intenta más tarde.',
            lockoutSeconds: secondsLeft
          },
          { status: 423 }
        );
      }
    }

    // Verificar estado de la cuenta
    if (accountUser.account_status !== 'active') {
      loginLog.login_status = 'account_suspended';
      await supabaseAdmin.from('auth_login_history').insert(loginLog);
      return NextResponse.json(
        { error: `Cuenta ${accountUser.account_status}. Contacta al administrador.` },
        { status: 403 }
      );
    }

    // Verificar contraseña
    debugLogin('🔑 [LOGIN] Verificando contraseña contra hash...');
    const isPasswordValid = await verifyPassword(password, accountUser.password_hash);
    debugLogin('🔑 [LOGIN] Resultado verificación:', isPasswordValid ? '✅ VÁLIDA' : '❌ INVÁLIDA');

    if (!isPasswordValid) {
      loginLog.login_status = 'failed_password';
      await supabaseAdmin.from('auth_login_history').insert(loginLog);
      await supabaseAdmin.rpc('handle_failed_login', { p_user_id: accountUser.user_id });
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    // Login exitoso - Generar tokens
    const tokens = await generateTokenPair(accountUser);

    // Crear sesión
    await createSession(accountUser.user_id, tokens, request);

    // Registrar login exitoso
    loginLog.login_status = 'success';
    await supabaseAdmin.from('auth_login_history').insert(loginLog);
    await supabaseAdmin.rpc('reset_failed_login_attempts', { p_user_id: accountUser.user_id });

    const responseUser = {
      id: accountUser.user_id,
      email: accountUser.email,
      name: accountUser.display_name || `${accountUser.first_name} ${accountUser.last_name_paternal}`,
      firstName: accountUser.first_name,
      lastName: `${accountUser.last_name_paternal} ${accountUser.last_name_maternal || ''}`.trim(),
      role: mapPermissionToRole(accountUser.permission_level),
      permissionLevel: accountUser.permission_level,
      avatar: accountUser.avatar_url || undefined,
      createdAt: new Date(accountUser.created_at),
      updatedAt: new Date(accountUser.updated_at),
    };

    const responseData: LoginResponse = {
      user: responseUser,
      workspaces: [], // Auth local no tiene orgs de SOFIA
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      authSource: 'local',
    };

    // Setear token como cookie httpOnly para el middleware
    const res = NextResponse.json(responseData);
    res.cookies.set('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 3600,
    });
    return res;

  } catch (error) {
    console.error('❌ [LOGIN] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

/**
 * Sincroniza un usuario de SOFIA con la BD local de IRIS
 * Si el usuario ya existe (por email), lo actualiza
 * Si no existe, lo crea
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

  // Prioridad: el id de SOFIA es la identidad más fuerte, luego el email.
  const existingUser = matchById || matchByEmail || matchByUsername;

  if (existingUser) {
    // Actualizar datos del usuario existente con los de SOFIA
    const updateData: Record<string, unknown> = {
      first_name: sofiaUser.first_name,
      last_name_paternal: sofiaUser.last_name_paternal,
      last_name_maternal: sofiaUser.last_name_maternal,
      display_name: sofiaUser.display_name || `${sofiaUser.first_name} ${sofiaUser.last_name_paternal}`,
      last_login_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // email y username son UNIQUE: solo se sincronizan si nadie más los tiene.
    if (!matchByEmail || matchByEmail.user_id === existingUser.user_id) {
      updateData.email = sofiaUser.email;
    } else {
      console.warn(
        `⚠️ [SYNC] El email ${sofiaUser.email} ya pertenece a otro usuario de Project Hub; se conserva ${existingUser.email}`
      );
    }

    if (!matchByUsername || matchByUsername.user_id === existingUser.user_id) {
      updateData.username = desiredUsername;
    } else {
      console.warn(
        `⚠️ [SYNC] El username ${desiredUsername} ya pertenece a otro usuario de Project Hub; se conserva ${existingUser.username}`
      );
    }

    // Sincronizar campos opcionales solo si SOFIA los tiene
    if (sofiaUser.company_role) updateData.company_role = sofiaUser.company_role;
    if (sofiaUser.department) updateData.department = sofiaUser.department;
    if (sofiaUser.phone_number) updateData.phone_number = sofiaUser.phone_number;

    // Solo actualizar avatar si SOFIA tiene uno (no sobrescribir con null)
    if (sofiaUser.avatar_url) {
      updateData.avatar_url = sofiaUser.avatar_url;
      debugLogin('🖼️ [SYNC] Sincronizando avatar desde SOFIA:', sofiaUser.avatar_url.substring(0, 60) + '...');
    } else {
      debugLogin('🖼️ [SYNC] SOFIA no tiene avatar, manteniendo el existente:', existingUser.avatar_url ? 'tiene' : 'vacío');
    }

    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('account_users')
      .update(updateData)
      .eq('user_id', existingUser.user_id)
      .select()
      .single();

    if (updateError) {
      // No bloquea el login: seguimos con los datos que ya teníamos localmente.
      console.error('⚠️ [SYNC] Error actualizando usuario espejo en Project Hub:', updateError);
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
      account_status: 'active', // Si SOFIA dice que está activo, confiar
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
    console.error('❌ [SYNC] Error creando usuario en Project Hub:', error);
    throw new Error(
      `Error al sincronizar usuario con Project Hub${error?.details ? `: ${error.details}` : ''}`
    );
  }

  debugLogin('✅ [SYNC] Usuario sincronizado de SOFIA a Project Hub:', newUser.email);
  return newUser as AccountUser;
}

/**
 * Crea una sesión de autenticación en la BD
 */
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

/**
 * Registra un intento de login en el historial
 */
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
    // No es crítico si falla el logging
  }
}

