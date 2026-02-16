/**
 * API Route: POST /api/auth/login
 * 
 * Maneja el inicio de sesión con autenticación DUAL:
 * 
 * 1. Si SOFIA está configurado (isSofiaAuthEnabled):
 *    a) Busca el usuario en SOFIA (account_users)
 *    b) Verifica password contra el hash de SOFIA
 *    c) Sincroniza el usuario con Project Hub (crea o actualiza en la BD local)
 *    d) Genera JWT local y crea sesión en Project Hub
 * 
 * 2. Si SOFIA NO está configurado (fallback):
 *    a) Busca el usuario en Project Hub local (account_users)
 *    b) Verifica password contra el hash local
 *    c) Genera JWT y crea sesión
 * 
 * Esto permite que los usuarios con cuenta SOFIA puedan iniciar sesión
 * en Project Hub sin necesidad de crear una cuenta separada.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, AccountUser } from '@/lib/supabase/server';
import { verifyPassword } from '@/lib/auth/password';
import { generateTokenPair, hashToken } from '@/lib/auth/jwt';
import {
  isSofiaAuthEnabled,
  findSofiaUser,
  recordSofiaLogin,
  getSofiaUserOrgs,
} from '@/lib/auth/sofia-auth';
import { syncWorkspacesFromSofia } from '@/lib/services/workspace-service';

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

export async function POST(request: NextRequest) {
  try {
    const body: LoginRequest = await request.json();
    const { email, password } = body;

    // Validaciones básicas
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y contraseña son requeridos' },
        { status: 400 }
      );
    }

    // ═══════════════════════════════════════════════════════════
    // FLUJO 1: Intentar autenticación con SOFIA primero
    // ═══════════════════════════════════════════════════════════
    if (isSofiaAuthEnabled()) {
      console.log('🔐 [LOGIN] Intentando autenticación con SOFIA...');
      
      const sofiaUser = await findSofiaUser(email);
      
      if (sofiaUser) {
        console.log('✅ [LOGIN] Usuario encontrado en SOFIA:', sofiaUser.email);
        
        // Verificar estado de cuenta en SOFIA
        if (sofiaUser.locked_until) {
          const lockTime = new Date(sofiaUser.locked_until);
          if (lockTime > new Date()) {
            await logLoginAttempt(email, request, 'account_locked', null);
            return NextResponse.json(
              { error: 'Cuenta bloqueada temporalmente. Intenta más tarde.' },
              { status: 423 }
            );
          }
        }

        if (sofiaUser.account_status !== 'active') {
          await logLoginAttempt(email, request, 'account_suspended', null);
          return NextResponse.json(
            { error: `Cuenta ${sofiaUser.account_status}. Contacta al administrador.` },
            { status: 403 }
          );
        }

        // Verificar contraseña contra SOFIA
        const isPasswordValid = await verifyPassword(password, sofiaUser.password_hash);
        
        if (!isPasswordValid) {
          await logLoginAttempt(email, request, 'failed_password', sofiaUser.user_id);
          return NextResponse.json(
            { error: 'Credenciales inválidas' },
            { status: 401 }
          );
        }

        // ✅ Autenticación SOFIA exitosa - Sincronizar con IRIS
        console.log('✅ [LOGIN] Password verificado con SOFIA, sincronizando con IRIS...');
        
        const irisUser = await syncSofiaUserToIris(sofiaUser);
        
        // Obtener organizaciones del usuario desde SOFIA
        const sofiaOrgs = await getSofiaUserOrgs(sofiaUser.user_id);

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
        await recordSofiaLogin(sofiaUser.user_id);

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
        console.log('ℹ️ [LOGIN] Usuario no encontrado en SOFIA, probando auth local...');
      }
    }

    // ═══════════════════════════════════════════════════════════
    // FLUJO 2: Fallback a autenticación local (IRIS)
    // ═══════════════════════════════════════════════════════════
    console.log('🔐 [LOGIN] Usando autenticación local (Project Hub)...');

    // Buscar usuario por email o username en la BD local (case-insensitive)
    const { data: user, error: userError } = await supabaseAdmin
      .from('account_users')
      .select('*')
      .or(`email.ilike.${email},username.ilike.${email}`)
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
      console.log('❌ [LOGIN] Usuario NO encontrado en BD local. Email/Username:', email);
      console.log('❌ [LOGIN] Error de Supabase:', userError?.message || 'Sin error, simplemente no existe');
      await supabaseAdmin.from('auth_login_history').insert(loginLog);
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    const accountUser = user as AccountUser;
    console.log('✅ [LOGIN] Usuario encontrado en BD local:', accountUser.email, '| Status:', accountUser.account_status);
    console.log('🔑 [LOGIN] Hash format:', accountUser.password_hash?.substring(0, 10) + '...');
    loginLog.user_id = accountUser.user_id;

    // Verificar si la cuenta está bloqueada
    if (accountUser.locked_until) {
      const lockTime = new Date(accountUser.locked_until);
      if (lockTime > new Date()) {
        loginLog.login_status = 'account_locked';
        await supabaseAdmin.from('auth_login_history').insert(loginLog);
        return NextResponse.json(
          { error: 'Cuenta bloqueada temporalmente. Intenta más tarde.' },
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
    console.log('🔑 [LOGIN] Verificando contraseña contra hash...');
    const isPasswordValid = await verifyPassword(password, accountUser.password_hash);
    console.log('🔑 [LOGIN] Resultado verificación:', isPasswordValid ? '✅ VÁLIDA' : '❌ INVÁLIDA');

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
async function syncSofiaUserToIris(sofiaUser: any): Promise<AccountUser> {
  // Buscar si el usuario ya existe en IRIS (por email)
  const { data: existingUser } = await supabaseAdmin
    .from('account_users')
    .select('*')
    .eq('email', sofiaUser.email)
    .single();

  if (existingUser) {
    // Actualizar datos del usuario existente con los de SOFIA
    const { data: updatedUser } = await supabaseAdmin
      .from('account_users')
      .update({
        first_name: sofiaUser.first_name,
        last_name_paternal: sofiaUser.last_name_paternal,
        last_name_maternal: sofiaUser.last_name_maternal,
        display_name: sofiaUser.display_name || `${sofiaUser.first_name} ${sofiaUser.last_name_paternal}`,
        avatar_url: sofiaUser.avatar_url,
        last_login_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', existingUser.user_id)
      .select()
      .single();

    return (updatedUser || existingUser) as AccountUser;
  }

  // Crear usuario nuevo en IRIS basado en los datos de SOFIA
  const { data: newUser, error } = await supabaseAdmin
    .from('account_users')
    .insert({
      first_name: sofiaUser.first_name,
      last_name_paternal: sofiaUser.last_name_paternal,
      last_name_maternal: sofiaUser.last_name_maternal || null,
      display_name: sofiaUser.display_name || `${sofiaUser.first_name} ${sofiaUser.last_name_paternal}`,
      username: sofiaUser.username,
      email: sofiaUser.email,
      password_hash: sofiaUser.password_hash, // Copiar el hash, NO la password
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
    throw new Error('Error al sincronizar usuario con Project Hub');
  }

  console.log('✅ [SYNC] Usuario sincronizado de SOFIA a Project Hub:', newUser.email);
  return newUser as AccountUser;
}

/**
 * Crea una sesión de autenticación en la BD
 */
async function createSession(userId: string, tokens: any, request: NextRequest) {
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

/**
 * Mapea permission_level a rol simple del frontend
 */
function mapPermissionToRole(level: string): 'admin' | 'user' | 'guest' {
  switch (level) {
    case 'super_admin':
    case 'admin':
      return 'admin';
    case 'manager':
    case 'user':
      return 'user';
    case 'viewer':
    case 'guest':
    default:
      return 'guest';
  }
}

/**
 * Detecta el tipo de dispositivo desde User-Agent
 */
function detectDeviceType(userAgent: string): string {
  if (/mobile/i.test(userAgent)) return 'mobile';
  if (/tablet/i.test(userAgent)) return 'tablet';
  return 'desktop';
}

/**
 * Detecta el navegador desde User-Agent
 */
function detectBrowser(userAgent: string): string {
  if (/chrome/i.test(userAgent) && !/edge/i.test(userAgent)) return 'Chrome';
  if (/firefox/i.test(userAgent)) return 'Firefox';
  if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) return 'Safari';
  if (/edge/i.test(userAgent)) return 'Edge';
  if (/opera|opr/i.test(userAgent)) return 'Opera';
  return 'Unknown';
}
