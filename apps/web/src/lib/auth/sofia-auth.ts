/**
 * Servicio de Autenticación con SOFIA (Supabase Auth)
 *
 * SOFIA ya NO guarda hashes de contraseña en `public.users`. La tabla
 * `public.users` es solo el PERFIL y su `id` es FK a `auth.users(id)`:
 *
 *   CREATE TABLE public.users (
 *     id uuid PRIMARY KEY REFERENCES auth.users(id),
 *     username, email, first_name, last_name, display_name,
 *     platform_role, profile_picture_url, phone, bio, location,
 *     email_verified, is_banned, ...
 *   );
 *
 * Por lo tanto la verificación de credenciales se delega a Supabase Auth
 * (`auth.signInWithPassword`) contra el proyecto SOFIA:
 *
 * ┌─────────────┐      ┌────────────────────┐      ┌───────────────┐
 * │  Usuario     │      │  SOFIA Supabase    │      │  PHub Supa    │
 * │  (Login UI)  │      │  auth + public.users│     │  (Data DB)    │
 * └──────┬───────┘      └─────────┬──────────┘      └───────┬───────┘
 *        │ 1. email/usuario + pass │                        │
 *        ├────────────────────────►│                        │
 *        │ 2. signInWithPassword   │                        │
 *        │◄────────────────────────┤ (session + auth.uid)   │
 *        │ 3. perfil public.users  │                        │
 *        │◄────────────────────────┤                        │
 *        │ 4. Espejo en account_users ────────────────────► │
 *        │ 5. JWT propio de Project Hub                     │
 *        └──────────────────────────────────────────────────┘
 *
 * NOTA: Este archivo se usa en API Routes (server-side)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SOFIA_SUPABASE, isValidUrl } from '../supabase/config';
import type { SofiaUser } from '../supabase/sofia-client';

const SOFIA_AUTH_DEBUG = process.env.SOFIA_AUTH_DEBUG === 'true';

function debugSofiaAuth(...args: unknown[]): void {
  if (SOFIA_AUTH_DEBUG) {
    console.log(...args);
  }
}

/**
 * Columnas reales de `public.users` en SofLIA Learning.
 * Se listan explícitamente para que un cambio de esquema falle de forma
 * evidente en vez de romper el login con `undefined`.
 */
const SOFIA_USER_COLUMNS = `
  id,
  username,
  email,
  first_name,
  last_name,
  display_name,
  platform_role,
  phone,
  bio,
  location,
  profile_picture_url,
  email_verified,
  email_verified_at,
  is_banned,
  banned_at,
  ban_reason,
  country_code,
  last_login_at,
  last_activity_at,
  created_at,
  updated_at
`;

/**
 * PostgREST usa comas y paréntesis como separadores en `.or()`.
 * Los identificadores válidos (email/username) nunca los contienen.
 * OJO: el punto SÍ es válido (va dentro del valor, no separa), y quitarlo
 * rompería cualquier email.
 *
 * También se escapan `%`/`_`: son comodines de `ilike` a nivel de Postgres
 * (no solo de PostgREST), así que sin esto un email con `%` en la parte
 * local (válido por RFC, p. ej. "a%b@x.com") convertiría la búsqueda de
 * cuenta en un match difuso en vez de exacto — riesgo real porque este
 * identificador llega sin autenticar, antes de verificar la contraseña.
 */
export function sanitizeIdentifier(value: string): string {
  return value.replace(/[(),"'\\]/g, '').trim().replace(/[%_]/g, '\\$&');
}

/**
 * Cliente SOFIA para el servidor (API routes).
 * - Sin `accessToken`: usa service role si existe, si no la anon key.
 * - Con `accessToken`: actúa como el usuario autenticado, de modo que las
 *   políticas RLS basadas en `auth.uid()` se cumplen.
 */
function getSofiaServerClient(accessToken?: string): SupabaseClient | null {
  const sofiaUrl = isValidUrl(SOFIA_SUPABASE.URL) ? SOFIA_SUPABASE.URL : '';
  const sofiaKey = accessToken
    ? SOFIA_SUPABASE.ANON_KEY
    : SOFIA_SUPABASE.SERVICE_ROLE_KEY || SOFIA_SUPABASE.ANON_KEY || '';

  if (!sofiaUrl || !sofiaKey) return null;

  return createClient(sofiaUrl, sofiaKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    ...(accessToken
      ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
      : {}),
  });
}

/**
 * Verifica si SOFIA está configurado como auth provider
 */
export function isSofiaAuthEnabled(): boolean {
  return (
    SOFIA_SUPABASE.URL !== '' &&
    SOFIA_SUPABASE.ANON_KEY !== '' &&
    isValidUrl(SOFIA_SUPABASE.URL)
  );
}

/**
 * Placeholder para `account_users.password_hash` en Project Hub.
 *
 * Esa columna es NOT NULL con CHECK length > 0, pero SOFIA ya no expone
 * hashes: las credenciales viven en `auth.users` de Supabase Auth. Guardamos
 * un centinela que nunca puede coincidir con un hash real (PBKDF2/bcrypt),
 * de modo que el login local siempre falle para cuentas gestionadas por SOFIA.
 */
export const SOFIA_MANAGED_PASSWORD_PLACEHOLDER = 'supabase-auth:sofia';

/**
 * `account_users.username` exige `^[A-Za-z0-9_-]{3,50}$`, más estricto que
 * SofLIA (que permite 1-2 caracteres). Normaliza para no romper el INSERT.
 */
export function normalizeAccountUsername(username: string | null | undefined, email: string): string {
  const base = (username || email.split('@')[0] || 'user').replace(/[^A-Za-z0-9_-]/g, '');
  if (base.length >= 3) return base.slice(0, 50);
  return `${base}_user`.slice(0, 50);
}

/**
 * Mapea `platform_role` de SofLIA al `permission_level` de Project Hub.
 * Valores de SofLIA: Usuario | Instructor | Administrador | Business | Business User
 */
export function mapPlatformRoleToPermission(
  platformRole?: string | null
): SofiaUser['permission_level'] {
  switch ((platformRole || '').trim().toLowerCase()) {
    case 'administrador':
    case 'admin':
      return 'admin';
    case 'instructor':
    case 'business':
      return 'manager';
    case 'business user':
    case 'usuario':
    case 'user':
      return 'user';
    default:
      return 'user';
  }
}

/**
 * SofLIA guarda un solo campo `last_name`. Project Hub espera apellido paterno
 * y materno por separado: el primer token es el paterno, el resto el materno.
 */
function splitLastName(lastName?: string | null): { paternal: string; maternal: string | null } {
  const parts = (lastName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { paternal: '', maternal: null };
  return {
    paternal: parts[0],
    maternal: parts.length > 1 ? parts.slice(1).join(' ') : null,
  };
}

/**
 * Mapea una fila de `public.users` de SofLIA al formato SofiaUser que
 * consume Project Hub.
 */
function mapSofiaUserRow(row: Record<string, any>): SofiaUser {
  const { paternal, maternal } = splitLastName(row.last_name);

  return {
    user_id: row.id,
    first_name: row.first_name || row.username || '',
    last_name_paternal: paternal,
    last_name_maternal: maternal,
    display_name: row.display_name || row.username || null,
    username: row.username,
    email: row.email,
    platform_role: row.platform_role || null,
    permission_level: mapPlatformRoleToPermission(row.platform_role),
    company_role: row.bio || null,
    department: row.location || null,
    account_status: row.is_banned === true ? 'suspended' : 'active',
    is_banned: row.is_banned === true,
    is_email_verified: row.email_verified ?? false,
    email_verified_at: row.email_verified_at || null,
    avatar_url: row.profile_picture_url || null,
    phone_number: row.phone || null,
    timezone: 'America/Mexico_City',
    locale: 'es-MX',
    last_login_at: row.last_login_at || null,
    last_activity_at: row.last_activity_at || null,
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
  };
}

/**
 * Busca un usuario en SOFIA por email o username.
 * Si se pasa `accessToken` la consulta se hace como el usuario autenticado
 * (necesario cuando la RLS de `users` solo permite leer la propia fila).
 */
export async function findSofiaUser(
  emailOrUsername: string,
  accessToken?: string
): Promise<SofiaUser | null> {
  const sofia = getSofiaServerClient(accessToken);
  if (!sofia) return null;

  const identifier = sanitizeIdentifier(emailOrUsername);
  if (!identifier) return null;

  try {
    const { data, error } = await sofia
      .from('users')
      .select(SOFIA_USER_COLUMNS)
      .or(`email.ilike.${identifier},username.ilike.${identifier}`)
      .limit(1);

    if (error) {
      console.error('[SOFIA AUTH] Error en query users:', error.message);
      return null;
    }

    const row = data?.[0] as Record<string, any> | undefined;
    if (!row) {
      debugSofiaAuth('[SOFIA AUTH] Usuario no encontrado en public.users:', identifier);
      return null;
    }

    debugSofiaAuth('[SOFIA AUTH] Usuario encontrado en SOFIA:', row.email, '| username:', row.username);
    return mapSofiaUserRow(row);
  } catch (err) {
    console.error('[SOFIA AUTH] Error buscando usuario en SOFIA:', err);
    return null;
  }
}

/**
 * Busca un usuario en SOFIA por su id (= auth.users.id)
 */
export async function findSofiaUserById(
  userId: string,
  accessToken?: string
): Promise<SofiaUser | null> {
  const sofia = getSofiaServerClient(accessToken);
  if (!sofia) return null;

  try {
    const { data, error } = await sofia
      .from('users')
      .select(SOFIA_USER_COLUMNS)
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) return null;
    return mapSofiaUserRow(data as Record<string, any>);
  } catch {
    console.error('[SOFIA AUTH] Error buscando usuario por ID en SOFIA');
    return null;
  }
}

/**
 * Resuelve un username a su email para poder usar Supabase Auth,
 * que solo acepta email + password.
 */
async function resolveSofiaEmail(emailOrUsername: string): Promise<string | null> {
  if (emailOrUsername.includes('@')) return emailOrUsername;

  const sofia = getSofiaServerClient();
  if (!sofia) return null;

  const identifier = sanitizeIdentifier(emailOrUsername);
  if (!identifier) return null;

  const { data, error } = await sofia
    .from('users')
    .select('email')
    .ilike('username', identifier)
    .limit(1);

  if (error) {
    console.error('[SOFIA AUTH] No se pudo resolver username -> email:', error.message);
    return null;
  }

  return (data?.[0] as { email?: string } | undefined)?.email || null;
}

/**
 * Estructura del resultado de autenticación con SOFIA
 */
export interface SofiaAuthResult {
  success: boolean;
  user?: SofiaUser;
  /** Sesión de Supabase Auth de SOFIA (no es el JWT de Project Hub) */
  session?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number | null;
  };
  error?: string;
  errorCode?:
    | 'USER_NOT_FOUND'
    | 'ACCOUNT_LOCKED'
    | 'ACCOUNT_INACTIVE'
    | 'EMAIL_NOT_CONFIRMED'
    | 'INVALID_PASSWORD'
    | 'SOFIA_NOT_CONFIGURED'
    | 'INTERNAL_ERROR';
}

/**
 * Autentica un usuario contra Supabase Auth de SOFIA.
 *
 * Acepta email o username: si se recibe un username se resuelve primero a
 * email consultando `public.users` (Supabase Auth solo acepta email).
 */
export async function authenticateSofiaUser(
  emailOrUsername: string,
  password: string
): Promise<SofiaAuthResult> {
  if (!isSofiaAuthEnabled()) {
    return {
      success: false,
      errorCode: 'SOFIA_NOT_CONFIGURED',
      error: 'SOFIA Supabase no esta configurado',
    };
  }

  const sofia = getSofiaServerClient();
  if (!sofia) {
    return {
      success: false,
      errorCode: 'SOFIA_NOT_CONFIGURED',
      error: 'SOFIA Supabase no esta configurado',
    };
  }

  try {
    const email = await resolveSofiaEmail(emailOrUsername);

    if (!email) {
      debugSofiaAuth('[SOFIA AUTH] No existe usuario con ese identificador:', emailOrUsername);
      return {
        success: false,
        errorCode: 'USER_NOT_FOUND',
        error: 'Credenciales invalidas',
      };
    }

    const { data, error } = await sofia.auth.signInWithPassword({ email, password });

    if (error || !data?.user || !data?.session) {
      const message = error?.message || 'Credenciales invalidas';
      debugSofiaAuth('[SOFIA AUTH] signInWithPassword fallo:', message);

      const normalized = message.toLowerCase();
      if (normalized.includes('email not confirmed')) {
        return {
          success: false,
          errorCode: 'EMAIL_NOT_CONFIRMED',
          error: 'Debes confirmar tu correo antes de iniciar sesion',
        };
      }
      if (normalized.includes('too many') || normalized.includes('rate limit')) {
        return {
          success: false,
          errorCode: 'ACCOUNT_LOCKED',
          error: 'Demasiados intentos. Intenta mas tarde.',
        };
      }

      // Supabase Auth devuelve el mismo "Invalid login credentials" tanto si el
      // password es incorrecto como si el usuario no existe. Para que una cuenta
      // que solo vive en Project Hub pueda seguir usando el login local,
      // distinguimos consultando el perfil en SOFIA.
      const existsInSofia = await findSofiaUser(email);
      if (!existsInSofia) {
        return {
          success: false,
          errorCode: 'USER_NOT_FOUND',
          error: 'Credenciales invalidas',
        };
      }

      return {
        success: false,
        errorCode: 'INVALID_PASSWORD',
        error: 'Credenciales invalidas',
      };
    }

    const accessToken = data.session.access_token;

    // El perfil se lee con el token del usuario para pasar la RLS de public.users
    let profile = await findSofiaUserById(data.user.id, accessToken);

    // Fallback: si aun no existe la fila de perfil, construimos lo mínimo
    // a partir de auth.users para no bloquear el login.
    if (!profile) {
      debugSofiaAuth('[SOFIA AUTH] Sin fila en public.users, usando metadata de auth.users');
      const metadata = (data.user.user_metadata || {}) as Record<string, any>;
      profile = mapSofiaUserRow({
        id: data.user.id,
        email: data.user.email,
        username: metadata.username || (data.user.email || '').split('@')[0],
        first_name: metadata.first_name || metadata.full_name || null,
        last_name: metadata.last_name || null,
        display_name: metadata.display_name || metadata.full_name || null,
        platform_role: metadata.platform_role || null,
        profile_picture_url: metadata.avatar_url || metadata.picture || null,
        email_verified: Boolean(data.user.email_confirmed_at),
        email_verified_at: data.user.email_confirmed_at || null,
        is_banned: false,
        created_at: data.user.created_at,
        updated_at: data.user.updated_at,
      });
    }

    if (profile.is_banned) {
      return {
        success: false,
        errorCode: 'ACCOUNT_INACTIVE',
        error: 'Cuenta suspendida. Contacta al administrador.',
      };
    }

    return {
      success: true,
      user: profile,
      session: {
        accessToken,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at ?? null,
      },
    };
  } catch (err) {
    console.error('[SOFIA AUTH] Error autenticando contra SOFIA:', err);
    return {
      success: false,
      errorCode: 'INTERNAL_ERROR',
      error: 'Error interno autenticando con SOFIA',
    };
  }
}

/**
 * Cambia la contraseña de un usuario en SOFIA vía Supabase Auth.
 *
 * Verifica la contraseña actual con `signInWithPassword` y aplica la nueva con
 * `auth.updateUser` sobre EL MISMO cliente, que conserva la sesión en memoria
 * (no requiere service role key).
 */
export async function changeSofiaPassword(
  emailOrUsername: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string; errorCode?: SofiaAuthResult['errorCode'] }> {
  const sofiaUrl = isValidUrl(SOFIA_SUPABASE.URL) ? SOFIA_SUPABASE.URL : '';
  const anonKey = SOFIA_SUPABASE.ANON_KEY || '';

  if (!sofiaUrl || !anonKey) {
    return {
      success: false,
      errorCode: 'SOFIA_NOT_CONFIGURED',
      error: 'SOFIA Supabase no esta configurado',
    };
  }

  const email = await resolveSofiaEmail(emailOrUsername);
  if (!email) {
    return {
      success: false,
      errorCode: 'USER_NOT_FOUND',
      error: 'No se encontro el usuario en SOFIA',
    };
  }

  // Cliente dedicado: mantiene la sesión en memoria para que updateUser la use.
  const sofia = createClient(sofiaUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { error: signInError } = await sofia.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (signInError) {
      debugSofiaAuth('[SOFIA AUTH] Password actual invalido:', signInError.message);
      return {
        success: false,
        errorCode: 'INVALID_PASSWORD',
        error: 'La contrasena actual es incorrecta',
      };
    }

    const { error: updateError } = await sofia.auth.updateUser({ password: newPassword });

    if (updateError) {
      console.error('[SOFIA AUTH] Error actualizando contrasena:', updateError.message);
      return {
        success: false,
        errorCode: 'INTERNAL_ERROR',
        error: updateError.message,
      };
    }

    return { success: true };
  } catch (err) {
    console.error('[SOFIA AUTH] Error cambiando contrasena en SOFIA:', err);
    return {
      success: false,
      errorCode: 'INTERNAL_ERROR',
      error: 'Error interno cambiando la contrasena en SOFIA',
    };
  } finally {
    await sofia.auth.signOut({ scope: 'local' }).catch(() => undefined);
  }
}

/**
 * Obtiene las organizaciones y equipos del usuario en SOFIA
 */
export async function getSofiaUserOrgs(userId: string, accessToken?: string): Promise<any[]> {
  const sofia = getSofiaServerClient(accessToken);
  if (!sofia) return [];

  try {
    const { data, error } = await sofia
      .from('organization_users')
      .select('*, organizations (*)')
      .eq('user_id', userId);

    if (error) {
      console.error('[SOFIA AUTH] Error obteniendo organizaciones:', error.message);
      return [];
    }
    if (!data) return [];

    return data.map((row: Record<string, unknown>) => ({
      ...row,
      organizations: Array.isArray(row.organizations)
        ? row.organizations[0]
        : row.organizations,
    }));
  } catch {
    console.error('[SOFIA AUTH] Error obteniendo organizaciones del usuario');
    return [];
  }
}

/**
 * Registra un login exitoso en SOFIA (actualiza last_login_at)
 */
export async function recordSofiaLogin(userId: string, accessToken?: string): Promise<void> {
  const sofia = getSofiaServerClient(accessToken);
  if (!sofia) return;

  try {
    const { error } = await sofia
      .from('users')
      .update({
        last_login_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      debugSofiaAuth('[SOFIA AUTH] No se pudo registrar last_login_at:', error.message);
    }
  } catch {
    console.error('[SOFIA AUTH] Error registrando login en SOFIA');
  }
}
