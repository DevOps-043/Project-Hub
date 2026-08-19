import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-role';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { decryptToken } from '@/lib/auth/token-encryption';

/**
 * DELETE /api/auth/google/disconnect
 * Desconecta la cuenta de Google: revoca el token y elimina el registro de OAuth.
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { payload } = auth;

    const supabase = getSupabaseAdmin();

    // Obtener el registro OAuth para revocar el token en Google
    const { data: oauthProvider } = await supabase
      .from('auth_oauth_providers')
      .select('access_token_encrypted')
      .eq('user_id', payload.sub)
      .eq('provider_name', 'google')
      .single();

    if (oauthProvider?.access_token_encrypted) {
      try {
        const accessToken = await decryptToken(oauthProvider.access_token_encrypted);
        // Revocar token en Google (best effort, no falla si no funciona)
        await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
      } catch {
        // Ignorar errores de revocación
      }
    }

    // Eliminar registro de OAuth
    const { error } = await supabase
      .from('auth_oauth_providers')
      .delete()
      .eq('user_id', payload.sub)
      .eq('provider_name', 'google');

    if (error) {
      console.error('Error eliminando OAuth provider:', error);
      return NextResponse.json({ error: 'Error al desconectar' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Google desconectado exitosamente' });
  } catch (error) {
    console.error('Error en Google disconnect:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
