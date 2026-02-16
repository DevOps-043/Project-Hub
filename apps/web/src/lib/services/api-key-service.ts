/**
 * Servicio de API Keys para el Bridge MCP
 * Genera, verifica, lista y revoca API keys por workspace
 */

import { getSupabaseAdmin } from '@/lib/supabase/server';
import { hashToken } from '@/lib/auth/jwt';

// --- Tipos ---

export interface McpApiKey {
  key_id: string;
  workspace_id: string;
  created_by: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  is_active: boolean;
  last_used_at: string | null;
  total_requests: number;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
  expires_at: string | null;
}

export interface McpApiKeyDisplay extends McpApiKey {
  created_by_name: string;
}

export interface VerifyResult {
  valid: boolean;
  keyRecord: McpApiKey;
  workspaceId: string;
}

// --- Funciones ---

/**
 * Genera una nueva API key para un workspace
 * Retorna la key en texto plano UNA SOLA VEZ
 */
export async function generateApiKey(
  workspaceId: string,
  createdBy: string,
  name: string,
  scopes: string[] = ['read', 'write'],
  expiresAt?: string | null
): Promise<{ plainKey: string; keyRecord: McpApiKey }> {
  const supabase = getSupabaseAdmin();

  // Generar 32 bytes aleatorios → 64 chars hex
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const hex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');

  const plainKey = `phub_${hex}`;
  const keyPrefix = plainKey.substring(0, 12); // "phub_a1b2c3d"
  const keyHash = await hashToken(plainKey);

  const { data, error } = await supabase
    .from('mcp_api_keys')
    .insert({
      workspace_id: workspaceId,
      created_by: createdBy,
      name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      scopes,
      expires_at: expiresAt || null,
    })
    .select()
    .single();

  if (error) {
    console.error('[API-KEY-SERVICE] Error generating key:', error);
    throw new Error('Error generando API key');
  }

  return {
    plainKey,
    keyRecord: {
      key_id: data.key_id,
      workspace_id: data.workspace_id,
      created_by: data.created_by,
      name: data.name,
      key_prefix: data.key_prefix,
      scopes: data.scopes,
      is_active: data.is_active,
      last_used_at: data.last_used_at,
      total_requests: data.total_requests,
      created_at: data.created_at,
      updated_at: data.updated_at,
      revoked_at: data.revoked_at,
      expires_at: data.expires_at,
    },
  };
}

/**
 * Verifica una API key contra la base de datos
 * Actualiza last_used_at y total_requests atomicamente
 */
export async function verifyApiKey(plainKey: string): Promise<VerifyResult | null> {
  if (!plainKey.startsWith('phub_') || plainKey.length !== 69) {
    return null;
  }

  const supabase = getSupabaseAdmin();
  const keyHash = await hashToken(plainKey);

  const { data, error } = await supabase
    .from('mcp_api_keys')
    .select('*')
    .eq('key_hash', keyHash)
    .single();

  if (error || !data) return null;
  if (!data.is_active) return null;
  if (data.revoked_at) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;

  // Actualizar uso atomicamente
  await supabase
    .from('mcp_api_keys')
    .update({
      last_used_at: new Date().toISOString(),
      total_requests: (data.total_requests || 0) + 1,
    })
    .eq('key_id', data.key_id);

  return {
    valid: true,
    keyRecord: {
      key_id: data.key_id,
      workspace_id: data.workspace_id,
      created_by: data.created_by,
      name: data.name,
      key_prefix: data.key_prefix,
      scopes: data.scopes,
      is_active: data.is_active,
      last_used_at: data.last_used_at,
      total_requests: data.total_requests,
      created_at: data.created_at,
      updated_at: data.updated_at,
      revoked_at: data.revoked_at,
      expires_at: data.expires_at,
    },
    workspaceId: data.workspace_id,
  };
}

/**
 * Lista todas las API keys de un workspace (sin hashes)
 */
export async function listApiKeys(workspaceId: string): Promise<McpApiKeyDisplay[]> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('mcp_api_keys')
    .select(`
      key_id, workspace_id, created_by, name, key_prefix, scopes,
      is_active, last_used_at, total_requests,
      created_at, updated_at, revoked_at, expires_at,
      creator:account_users!mcp_api_keys_created_by_fkey(display_name, first_name, last_name_paternal)
    `)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[API-KEY-SERVICE] Error listing keys:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    key_id: row.key_id,
    workspace_id: row.workspace_id,
    created_by: row.created_by,
    name: row.name,
    key_prefix: row.key_prefix,
    scopes: row.scopes,
    is_active: row.is_active,
    last_used_at: row.last_used_at,
    total_requests: row.total_requests,
    created_at: row.created_at,
    updated_at: row.updated_at,
    revoked_at: row.revoked_at,
    expires_at: row.expires_at,
    created_by_name: row.creator?.display_name || `${row.creator?.first_name || ''} ${row.creator?.last_name_paternal || ''}`.trim() || 'Unknown',
  }));
}

/**
 * Revoca una API key (soft delete)
 */
export async function revokeApiKey(keyId: string, workspaceId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('mcp_api_keys')
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
    })
    .eq('key_id', keyId)
    .eq('workspace_id', workspaceId);

  if (error) {
    console.error('[API-KEY-SERVICE] Error revoking key:', error);
    return false;
  }

  return true;
}
