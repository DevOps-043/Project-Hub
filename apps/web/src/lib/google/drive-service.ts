/**
 * Servicio Google Drive - Server-side
 * Funciones utilitarias para interactuar con Google Drive/Sheets API.
 * Usa API REST directamente sin SDK pesado.
 */

import { getSupabaseAdmin } from '@/lib/supabase/server';
import { decryptToken, encryptToken } from '@/lib/auth/token-encryption';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  iconLink?: string;
  thumbnailLink?: string;
  createdTime?: string;
}

/**
 * Refresca el access token de Google usando el refresh token
 */
async function refreshAccessToken(refreshTokenEncrypted: string): Promise<{
  accessToken: string;
  expiresIn: number;
} | null> {
  const refreshToken = await decryptToken(refreshTokenEncrypted);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

/**
 * Obtiene un access token válido de Google para un usuario.
 * Si el token está expirado, lo refresca automáticamente y actualiza en DB.
 */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data: provider } = await supabase
    .from('auth_oauth_providers')
    .select('access_token_encrypted, refresh_token_encrypted, token_expires_at')
    .eq('user_id', userId)
    .eq('provider_name', 'google')
    .single();

  if (!provider) return null;

  const now = new Date();
  const expiresAt = new Date(provider.token_expires_at);

  // Token aún válido (con 5 min de margen)
  if (expiresAt > new Date(now.getTime() + 5 * 60 * 1000)) {
    return decryptToken(provider.access_token_encrypted);
  }

  // Necesita refresh
  if (!provider.refresh_token_encrypted) return null;

  const refreshed = await refreshAccessToken(provider.refresh_token_encrypted);
  if (!refreshed) return null;

  // Guardar nuevo token
  const newEncrypted = await encryptToken(refreshed.accessToken);
  const newExpiresAt = new Date(Date.now() + refreshed.expiresIn * 1000).toISOString();

  await supabase
    .from('auth_oauth_providers')
    .update({
      access_token_encrypted: newEncrypted,
      token_expires_at: newExpiresAt,
      last_used_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('provider_name', 'google');

  return refreshed.accessToken;
}

/**
 * Obtiene metadata de un archivo de Google Drive
 */
export async function getFileMetadata(accessToken: string, fileId: string): Promise<DriveFile | null> {
  const fields = 'id,name,mimeType,webViewLink,iconLink,thumbnailLink,createdTime';
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=${fields}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) return null;
  return res.json();
}

/**
 * Crea un Google Spreadsheet (o clona uno desde un template)
 * @param accessToken - Token de acceso válido
 * @param title - Nombre del archivo
 * @param templateId - Si se proporciona, clona el template en vez de crear uno vacío
 */
export async function createSpreadsheet(
  accessToken: string,
  title: string,
  templateId?: string
): Promise<DriveFile | null> {
  if (templateId) {
    // Clonar desde template
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${templateId}/copy`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: title }),
      }
    );

    if (!res.ok) {
      console.error('Error clonando template:', await res.text());
      return null;
    }

    const file = await res.json();
    // Obtener metadata completa con webViewLink
    return getFileMetadata(accessToken, file.id);
  }

  // Crear spreadsheet vacío usando Sheets API
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title },
    }),
  });

  if (!res.ok) {
    console.error('Error creando spreadsheet:', await res.text());
    return null;
  }

  const sheet = await res.json();
  return getFileMetadata(accessToken, sheet.spreadsheetId);
}
