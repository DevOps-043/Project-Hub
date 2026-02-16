/**
 * Cliente Supabase para SOFIA (Autenticación principal)
 * 
 * SOFIA es el "auth master": las credenciales de los usuarios se verifican
 * contra la tabla `account_users` en SOFIA Supabase.
 * 
 * Flujo:
 * 1. Usuario ingresa email + password
 * 2. Se verifica contra SOFIA (account_users)
 * 3. Si éxito, se sincroniza sesión con Project Hub
 * 4. El usuario queda autenticado en ambos sistemas
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SOFIA_SUPABASE, isValidUrl } from './config';

// ── Tipos para tablas de SOFIA ──

export interface SofiaUser {
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

export interface SofiaOrganization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  created_at: string;
}

export interface SofiaOrganizationUser {
  id: string;
  user_id: string;
  organization_id: string;
  role: string;
  created_at: string;
}

// ── Cliente SOFIA (Browser/Client-side) ──

let _sofiaClient: SupabaseClient | null = null;

/**
 * Obtiene el cliente SOFIA para el lado del cliente (browser)
 * Usa la anon key y localStorage para persistir la sesión
 */
export function getSofiaClient(): SupabaseClient | null {
  if (_sofiaClient) return _sofiaClient;

  const sofiaUrl = isValidUrl(SOFIA_SUPABASE.URL) ? SOFIA_SUPABASE.URL : '';
  const sofiaKey = SOFIA_SUPABASE.ANON_KEY || '';

  if (!sofiaUrl || !sofiaKey) return null;

  _sofiaClient = createClient(sofiaUrl, sofiaKey, {
    auth: {
      storageKey: 'sofia-auth-token', // ⚠️ ÚNICO - no debe chocar con otros clientes
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true, // true para web apps (redirect flows)
    },
  });

  return _sofiaClient;
}

// ── Cliente SOFIA (Server-side) ──

let _sofiaAdmin: SupabaseClient | null = null;

/**
 * Obtiene el cliente SOFIA para el lado del servidor (API routes)
 * Usa anon key ya que no tenemos service_role de SOFIA
 */
export function getSofiaAdmin(): SupabaseClient | null {
  if (_sofiaAdmin) return _sofiaAdmin;

  const sofiaUrl = isValidUrl(SOFIA_SUPABASE.URL) ? SOFIA_SUPABASE.URL : '';
  const sofiaKey = SOFIA_SUPABASE.ANON_KEY || '';

  if (!sofiaUrl || !sofiaKey) return null;

  _sofiaAdmin = createClient(sofiaUrl, sofiaKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _sofiaAdmin;
}

/**
 * Verifica si SOFIA está configurado
 */
export function isSofiaConfigured(): boolean {
  return (
    SOFIA_SUPABASE.URL !== '' &&
    SOFIA_SUPABASE.ANON_KEY !== '' &&
    isValidUrl(SOFIA_SUPABASE.URL)
  );
}

// Exportar el cliente singleton para uso directo
export const sofiaSupa = getSofiaClient();
