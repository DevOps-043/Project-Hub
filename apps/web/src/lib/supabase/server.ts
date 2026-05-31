/**
 * Cliente Supabase para Server Components y API Routes
 * Usa service_role key para acceso completo a la BD
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

declare global {
  // Mantiene una sola instancia por proceso incluso con HMR en desarrollo.
  // eslint-disable-next-line no-var
  var __projectHubSupabaseAdmin: SupabaseClient | undefined;
}

let _supabaseAdmin: SupabaseClient | null = globalThis.__projectHubSupabaseAdmin || null;

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} no esta configurada`);
  }

  return value;
}

function validateSupabaseUrl(url: string): void {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('invalid protocol');
    }
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL debe ser una URL valida');
  }
}

/**
 * Obtiene el cliente de Supabase Admin.
 * Lanza error si las variables de entorno no están configuradas.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (_supabaseAdmin) {
    return _supabaseAdmin;
  }

  // Leer variables de entorno EN TIEMPO DE EJECUCIÓN (no al importar el módulo)
  const supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseServiceKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  validateSupabaseUrl(supabaseUrl);

  // Cliente con service role (acceso completo, sin RLS)
  _supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        'X-Client-Info': 'project-hub-web',
      },
    },
  });
  globalThis.__projectHubSupabaseAdmin = _supabaseAdmin;

  return _supabaseAdmin;
}

// Exportar getter directo para compatibilidad
export const supabaseAdmin = {
  from: (...args: Parameters<SupabaseClient['from']>) => getSupabaseAdmin().from(...args),
  rpc: (...args: Parameters<SupabaseClient['rpc']>) => getSupabaseAdmin().rpc(...args),
  storage: {
    from: (bucket: string) => getSupabaseAdmin().storage.from(bucket),
  },
  auth: {
    getUser: () => getSupabaseAdmin().auth.getUser(),
    signOut: () => getSupabaseAdmin().auth.signOut(),
  },
};

// Tipos para la tabla account_users
export interface AccountUser {
  user_id: string;
  first_name: string;
  last_name_paternal: string;
  last_name_maternal: string | null;
  display_name: string | null;
  username: string;
  email: string;
  password_hash: string;
  permission_level: 'super_admin' | 'admin' | 'manager' | 'user' | 'viewer' | 'guest';
  company_role: string | null;
  department: string | null;
  account_status: 'active' | 'inactive' | 'suspended' | 'pending_verification' | 'deleted';
  is_email_verified: boolean;
  email_verified_at: string | null;
  avatar_url: string | null;
  phone_number: string | null;
  timezone: string;
  locale: string;
  last_login_at: string | null;
  last_activity_at: string | null;
  failed_login_attempts: number;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
}

// Tipo para sesiones
export interface AuthSession {
  session_id: string;
  user_id: string;
  token_hash: string;
  refresh_token_hash: string | null;
  device_fingerprint: string | null;
  device_type: string | null;
  browser_name: string | null;
  browser_version: string | null;
  operating_system: string | null;
  ip_address: string | null;
  user_agent: string | null;
  geo_country: string | null;
  geo_city: string | null;
  is_active: boolean;
  is_revoked: boolean;
  revoked_at: string | null;
  revoked_reason: string | null;
  issued_at: string;
  expires_at: string;
  last_used_at: string | null;
  created_at: string;
}
