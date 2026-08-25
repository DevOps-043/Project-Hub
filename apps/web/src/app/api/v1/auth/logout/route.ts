import { NextRequest } from 'next/server';
import { hashToken, verifyToken } from '@/lib/auth/jwt';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { ApiError, fail, ok } from '@/lib/api-v1/http';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const payload = token ? await verifyToken(token) : null;
    if (!token || !payload || payload.type !== 'access') throw new ApiError(401, 'UNAUTHORIZED', 'No autorizado');
    await getSupabaseAdmin().from('auth_sessions').update({
      is_active: false, is_revoked: true, revoked_at: new Date().toISOString(), revoked_reason: 'User logout',
    }).eq('token_hash', await hashToken(token));
    return ok(request, { logged_out: true });
  } catch (error) { return fail(request, error); }
}

