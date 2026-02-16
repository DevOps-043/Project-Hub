/**
 * Servicio de Autenticación con SOFIA
 * 
 * Este servicio implementa el flujo de login descrito en MULTI_SUPABASE_ARCHITECTURE.md:
 * 
 * ┌─────────────┐      ┌───────────────┐      ┌───────────────┐
 * │  Usuario     │      │  SOFIA Supa   │      │  PHub Supa    │
 * │  (Login UI)  │      │  (Auth DB)    │      │  (Data DB)    │
 * └──────┬───────┘      └───────┬───────┘      └───────┬───────┘
 *        │  1. email + password │                      │
 *        ├─────────────────────►│                      │
 *        │  2. Verificar hash   │                      │
 *        │◄─────────────────────┤                      │
 *        │  3. Sincronizar ─────────────────────────►│
 *        │     crear/actualizar usuario en PHub       │
 *        │◄───────────────────────────────────────────┤
 *        │  4. Generar JWT + crear sesión             │
 *        └──────────────────────┴──────────────────────┘
 * 
 * NOTA: Este archivo se usa en API Routes (server-side)
 */

import { createClient } from '@supabase/supabase-js';
import { SOFIA_SUPABASE, isValidUrl } from '../supabase/config';
import type { SofiaUser } from '../supabase/sofia-client';

/**
 * Obtiene un cliente SOFIA para el servidor (API routes)
 * No usa storage, no persiste sesión
 */
function getSofiaServerClient() {
  const sofiaUrl = isValidUrl(SOFIA_SUPABASE.URL) ? SOFIA_SUPABASE.URL : '';
  const sofiaKey = SOFIA_SUPABASE.ANON_KEY || '';

  if (!sofiaUrl || !sofiaKey) return null;

  return createClient(sofiaUrl, sofiaKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
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
 * Busca un usuario en SOFIA por email o username
 */
export async function findSofiaUser(emailOrUsername: string): Promise<SofiaUser | null> {
  const sofia = getSofiaServerClient();
  if (!sofia) return null;

  try {
    const { data, error } = await sofia
      .from('users')
      .select('*')
      .or(`email.ilike.${emailOrUsername},username.ilike.${emailOrUsername}`)
      .maybeSingle();

    if (error) {
      console.error('[SOFIA AUTH] Error en query:', error.message);
      return null;
    }
    if (!data) {
      console.log('[SOFIA AUTH] Usuario no encontrado en tabla users');
      return null;
    }

    console.log('[SOFIA AUTH] Usuario encontrado en SOFIA:', data.email, '| username:', data.username);

    // Mapear columnas de SOFIA (users) al formato SofiaUser
    const mapped: SofiaUser = {
      user_id: data.id || data.user_id,
      first_name: data.first_name || data.username || '',
      last_name_paternal: data.last_name_paternal || data.last_name || '',
      last_name_maternal: data.last_name_maternal || null,
      display_name: data.display_name || data.username,
      username: data.username,
      email: data.email,
      password_hash: data.password_hash,
      permission_level: data.permission_level || data.role || 'user',
      company_role: data.company_role || null,
      department: data.department || null,
      account_status: data.account_status || data.status || 'active',
      is_email_verified: data.is_email_verified ?? true,
      email_verified_at: data.email_verified_at || null,
      avatar_url: data.avatar_url || data.avatar || null,
      phone_number: data.phone_number || null,
      timezone: data.timezone || 'America/Mexico_City',
      locale: data.locale || 'es-MX',
      last_login_at: data.last_login_at || null,
      last_activity_at: data.last_activity_at || null,
      failed_login_attempts: data.failed_login_attempts || 0,
      locked_until: data.locked_until || null,
      created_at: data.created_at || new Date().toISOString(),
      updated_at: data.updated_at || new Date().toISOString(),
    };

    return mapped;
  } catch (err) {
    console.error('[SOFIA AUTH] Error buscando usuario en SOFIA:', err);
    return null;
  }
}

/**
 * Busca un usuario en SOFIA por user_id
 */
export async function findSofiaUserById(userId: string): Promise<SofiaUser | null> {
  const sofia = getSofiaServerClient();
  if (!sofia) return null;

  try {
    const { data, error } = await sofia
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) return null;

    // Mapear id -> user_id
    return { ...data, user_id: data.id || data.user_id } as SofiaUser;
  } catch {
    console.error('[SOFIA AUTH] Error buscando usuario por ID en SOFIA');
    return null;
  }
}

/**
 * Obtiene las organizaciones y equipos del usuario en SOFIA
 */
export async function getSofiaUserOrgs(userId: string) {
  const sofia = getSofiaServerClient();
  if (!sofia) return [];

  try {
    const { data, error } = await sofia
      .from('organization_users')
      .select('*, organizations(*)')
      .eq('user_id', userId);

    if (error || !data) return [];
    return data;
  } catch {
    console.error('[SOFIA AUTH] Error obteniendo organizaciones del usuario');
    return [];
  }
}

/**
 * Registra un login exitoso en SOFIA (actualiza last_login_at)
 */
export async function recordSofiaLogin(userId: string): Promise<void> {
  const sofia = getSofiaServerClient();
  if (!sofia) return;

  try {
    await sofia
      .from('users')
      .update({
        last_login_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', userId);
  } catch {
    console.error('[SOFIA AUTH] Error registrando login en SOFIA');
  }
}

/**
 * Estructura del resultado de autenticación con SOFIA
 */
export interface SofiaAuthResult {
  success: boolean;
  user?: SofiaUser;
  organizations?: any[];
  error?: string;
  errorCode?: 'USER_NOT_FOUND' | 'ACCOUNT_LOCKED' | 'ACCOUNT_INACTIVE' | 'INVALID_PASSWORD' | 'SOFIA_NOT_CONFIGURED' | 'INTERNAL_ERROR';
}
