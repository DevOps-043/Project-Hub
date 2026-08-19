import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-role';
import { getSupabaseAdmin } from '@/lib/supabase/server';

/**
 * GET /api/auth/google/status
 * Verifica si el usuario tiene Google conectado y el estado de su conexión.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { payload } = auth;

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
