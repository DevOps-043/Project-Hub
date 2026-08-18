/**
 * Cliente Supabase para SOFIA (Autenticación principal)
 *
 * SOFIA es el "auth master", pero desde la migración a Supabase Auth las
 * credenciales viven en `auth.users` del proyecto SOFIA, NO en una tabla
 * propia con `password_hash`. `public.users` es solo el perfil y su `id`
 * es FK a `auth.users(id)`.
 *
 * Flujo:
 * 1. Usuario ingresa email (o username) + password
 * 2. Se verifica con `auth.signInWithPassword` contra SOFIA
 * 3. Se lee el perfil de `public.users` con el token del usuario
 * 4. Se sincroniza el espejo en Project Hub (`account_users`) y se emite el JWT propio
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SOFIA_SUPABASE, isValidUrl } from './config';

// ── Tipos para tablas de SOFIA ──

/**
 * Perfil de SOFIA normalizado al vocabulario de Project Hub.
 * Ver `lib/auth/sofia-auth.ts` para el mapeo desde las columnas reales
 * de `public.users` (last_name, platform_role, profile_picture_url, ...).
 */
export interface SofiaUser {
  user_id: string;
  first_name: string;
  last_name_paternal: string;
  last_name_maternal: string | null;
  display_name: string | null;
  username: string;
  email: string;
  /** Valor crudo de `public.users.platform_role` en SofLIA */
  platform_role: string | null;
  permission_level: 'super_admin' | 'admin' | 'manager' | 'user' | 'viewer' | 'guest';
  company_role: string | null;
  department: string | null;
  account_status: 'active' | 'inactive' | 'suspended' | 'pending_verification' | 'deleted';
  is_banned: boolean;
  is_email_verified: boolean;
  email_verified_at: string | null;
  avatar_url: string | null;
  phone_number: string | null;
  timezone: string;
  locale: string;
  last_login_at: string | null;
  last_activity_at: string | null;
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
let _sofiaServiceRole: SupabaseClient | null = null;

/**
 * Obtiene el cliente SOFIA para el lado del servidor (API routes).
 * Puede usar anon key para lecturas compatibles con RLS; no debe usarse para
 * escrituras privilegiadas.
 */
export function getSofiaAdmin(): SupabaseClient | null {
  if (_sofiaAdmin) return _sofiaAdmin;

  const sofiaUrl = isValidUrl(SOFIA_SUPABASE.URL) ? SOFIA_SUPABASE.URL : '';
  const sofiaKey = SOFIA_SUPABASE.SERVICE_ROLE_KEY || SOFIA_SUPABASE.ANON_KEY || '';

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
 * Cliente server-side con service role. Usar solo en rutas API que escriben en
 * SOFIA despues de validar autenticacion/autorizacion en Project Hub.
 */
export function getSofiaServiceRoleClient(): SupabaseClient | null {
  if (_sofiaServiceRole) return _sofiaServiceRole;

  const sofiaUrl = isValidUrl(SOFIA_SUPABASE.URL) ? SOFIA_SUPABASE.URL : '';
  const serviceRoleKey = SOFIA_SUPABASE.SERVICE_ROLE_KEY || '';

  if (!sofiaUrl || !serviceRoleKey) return null;

  _sofiaServiceRole = createClient(sofiaUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _sofiaServiceRole;
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

/**
 * Verifica si el runtime puede escribir en SOFIA con service role.
 */
export function isSofiaServiceRoleConfigured(): boolean {
  return (
    SOFIA_SUPABASE.URL !== '' &&
    SOFIA_SUPABASE.SERVICE_ROLE_KEY !== '' &&
    isValidUrl(SOFIA_SUPABASE.URL)
  );
}

// Exportar el cliente singleton para uso directo
export const sofiaSupa = getSofiaClient();
