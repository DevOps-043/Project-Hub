import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { encryptToken } from '@/lib/auth/token-encryption';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/callback/google';

/**
 * Verifica la firma HMAC del state OAuth
 */
async function verifyState(state: string): Promise<{ userId: string; returnUrl: string } | null> {
  try {
    const [stateB64, sigB64] = state.split('.');
    if (!stateB64 || !sigB64) return null;

    const secret = process.env.JWT_SECRET || 'iris-super-secret-key-change-in-production';
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureBytes = Buffer.from(sigB64, 'base64url');
    const valid = await crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(stateB64));

    if (!valid) return null;

    const stateData = JSON.parse(Buffer.from(stateB64, 'base64url').toString('utf-8'));

    // Verificar que no sea un state muy viejo (10 minutos max)
    if (Date.now() - stateData.timestamp > 10 * 60 * 1000) return null;

    return { userId: stateData.userId, returnUrl: stateData.returnUrl };
  } catch {
    return null;
  }
}

/**
 * GET /api/auth/callback/google
 * Callback de OAuth2 de Google. Intercambia el code por tokens y los almacena.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      console.error('Error en OAuth Google:', error);
      return NextResponse.redirect(new URL('/?google_error=' + error, request.url));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL('/?google_error=missing_params', request.url));
    }

    // Verificar state anti-CSRF
    const stateData = await verifyState(state);
    if (!stateData) {
      return NextResponse.redirect(new URL('/?google_error=invalid_state', request.url));
    }

    // Intercambiar code por tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const tokenError = await tokenRes.text();
      console.error('Error intercambiando code:', tokenError);
      return NextResponse.redirect(new URL('/?google_error=token_exchange', request.url));
    }

    const tokens = await tokenRes.json();
    const { access_token, refresh_token, expires_in } = tokens;

    // Obtener perfil de Google
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!profileRes.ok) {
      return NextResponse.redirect(new URL('/?google_error=profile_fetch', request.url));
    }

    const profile = await profileRes.json();

    // Encriptar tokens
    const accessTokenEncrypted = await encryptToken(access_token);
    const refreshTokenEncrypted = refresh_token ? await encryptToken(refresh_token) : null;

    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Guardar en auth_oauth_providers (delete + insert para evitar problemas de constraint)
    const supabase = getSupabaseAdmin();

    // Eliminar conexión Google existente del usuario (si la hay)
    await supabase
      .from('auth_oauth_providers')
      .delete()
      .eq('user_id', stateData.userId)
      .eq('provider_name', 'google');

    // Insertar nueva conexión
    const { error: dbError } = await supabase
      .from('auth_oauth_providers')
      .insert({
        user_id: stateData.userId,
        provider_name: 'google',
        provider_user_id: profile.id,
        access_token_encrypted: accessTokenEncrypted,
        refresh_token_encrypted: refreshTokenEncrypted,
        token_expires_at: tokenExpiresAt,
        provider_email: profile.email,
        provider_display_name: profile.name,
        provider_avatar_url: profile.picture,
        granted_scopes: [
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/userinfo.profile',
        ],
        last_used_at: new Date().toISOString(),
      });

    if (dbError) {
      console.error('Error guardando OAuth tokens:', dbError);
      return NextResponse.redirect(new URL('/?google_error=db_save', request.url));
    }

    // Redirigir al frontend
    const returnUrl = stateData.returnUrl || '/';
    const separator = returnUrl.includes('?') ? '&' : '?';
    return NextResponse.redirect(new URL(`${returnUrl}${separator}google_connected=true`, request.url));
  } catch (error) {
    console.error('Error en Google callback:', error);
    return NextResponse.redirect(new URL('/?google_error=internal', request.url));
  }
}
