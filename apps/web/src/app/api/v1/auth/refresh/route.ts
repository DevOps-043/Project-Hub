import { NextRequest } from 'next/server';
import { z } from 'zod';
import { generateTokenPair, hashToken, verifyToken } from '@/lib/auth/jwt';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { ApiError, fail, jsonBody, ok } from '@/lib/api-v1/http';

const schema = z.object({ refresh_token: z.string().min(40) });

export async function POST(request: NextRequest) {
  try {
    const { refresh_token: refreshToken } = await jsonBody(request, schema);
    const payload = await verifyToken(refreshToken);
    if (!payload || payload.type !== 'refresh') throw new ApiError(401, 'REFRESH_INVALID', 'Refresh token inválido');
    const supabase = getSupabaseAdmin();
    const { data: user } = await supabase.from('account_users').select('*').eq('user_id', payload.sub)
      .eq('account_status', 'active').maybeSingle();
    if (!user) throw new ApiError(401, 'ACCOUNT_INACTIVE', 'La cuenta no está activa');
    const tokens = await generateTokenPair(user);
    await supabase.from('auth_sessions').update({ is_active: false, is_revoked: true, revoked_at: new Date().toISOString(), revoked_reason: 'Token refreshed' })
      .eq('refresh_token_hash', await hashToken(refreshToken));
    await supabase.from('auth_sessions').insert({
      user_id: user.user_id, token_hash: await hashToken(tokens.accessToken),
      refresh_token_hash: await hashToken(tokens.refreshToken),
      expires_at: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
      is_active: true,
    });
    return ok(request, { access_token: tokens.accessToken, refresh_token: tokens.refreshToken, expires_in: tokens.expiresIn });
  } catch (error) { return fail(request, error); }
}

