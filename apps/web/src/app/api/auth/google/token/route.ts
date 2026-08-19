import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-role';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { decryptToken, encryptToken } from '@/lib/auth/token-encryption';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

/**
 * Refresca el access token de Google usando el refresh token
 */
async function refreshGoogleToken(refreshTokenEncrypted: string): Promise<{
  accessToken: string;
  expiresIn: number;
} | null> {
  try {
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
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  } catch {
    return null;
  }
}

/**
 * GET /api/auth/google/token
 * Devuelve un access token válido de Google para usar en el Picker u otras APIs client-side.
 * Si el token está expirado, lo refresca automáticamente.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { payload } = auth;

    const supabase = getSupabaseAdmin();
    const { data: oauthProvider, error } = await supabase
      .from('auth_oauth_providers')
      .select('access_token_encrypted, refresh_token_encrypted, token_expires_at')
      .eq('user_id', payload.sub)
      .eq('provider_name', 'google')
      .single();

    if (error || !oauthProvider) {
      return NextResponse.json({ error: 'Google no conectado' }, { status: 404 });
    }

    const now = new Date();
    const expiresAt = new Date(oauthProvider.token_expires_at);

    // Si el token aún es válido (con 5 min de margen), desencriptar y devolver
    if (expiresAt > new Date(now.getTime() + 5 * 60 * 1000)) {
      const accessToken = await decryptToken(oauthProvider.access_token_encrypted);
      return NextResponse.json({ accessToken });
    }

    // Token expirado → refrescar
    if (!oauthProvider.refresh_token_encrypted) {
      return NextResponse.json({ error: 'Refresh token no disponible. Reconecta Google.' }, { status: 401 });
    }

    const refreshed = await refreshGoogleToken(oauthProvider.refresh_token_encrypted);
    if (!refreshed) {
      return NextResponse.json({ error: 'No se pudo refrescar el token. Reconecta Google.' }, { status: 401 });
    }

    // Guardar nuevo access token encriptado
    const newAccessTokenEncrypted = await encryptToken(refreshed.accessToken);
    const newExpiresAt = new Date(Date.now() + refreshed.expiresIn * 1000).toISOString();

    await supabase
      .from('auth_oauth_providers')
      .update({
        access_token_encrypted: newAccessTokenEncrypted,
        token_expires_at: newExpiresAt,
        last_used_at: new Date().toISOString(),
      })
      .eq('user_id', payload.sub)
      .eq('provider_name', 'google');

    return NextResponse.json({ accessToken: refreshed.accessToken });
  } catch (error) {
    console.error('Error obteniendo Google token:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
