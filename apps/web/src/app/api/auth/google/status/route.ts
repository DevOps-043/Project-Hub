import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { getSupabaseAdmin } from '@/lib/supabase/server';

/**
 * GET /api/auth/google/status
 * Verifica si el usuario tiene Google conectado y el estado de su conexión.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('accessToken')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: oauthProvider, error } = await supabase
      .from('auth_oauth_providers')
      .select('provider_email, provider_display_name, granted_scopes, token_expires_at, provider_avatar_url')
      .eq('user_id', payload.sub)
      .eq('provider_name', 'google')
      .single();

    if (error || !oauthProvider) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      email: oauthProvider.provider_email,
      displayName: oauthProvider.provider_display_name,
      avatarUrl: oauthProvider.provider_avatar_url,
      scopes: oauthProvider.granted_scopes,
      tokenExpiresAt: oauthProvider.token_expires_at,
    });
  } catch (error) {
    console.error('Error en Google status:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
