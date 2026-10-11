import { NextRequest, NextResponse } from 'next/server';
import { authenticateSofiaSsoSession, getSofiaUserOrgs } from '@/lib/auth/sofia-auth';
import { completeSofiaLogin } from '@/lib/auth/sofia-login-pipeline';
import { requireAuth } from '@/lib/auth/require-role';
import { enforceRateLimit } from '@/lib/api-v1/http';
import { hashToken, verifyToken } from '@/lib/auth/jwt';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
const bootstrapCookie = 'pulsehub_bootstrap';
const fail = (status: number) => NextResponse.json({ success: false }, { status, headers });

function hasSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  // Netlify puede reconstruir la URL interna con HTTP. Host conserva el
  // destino público; solo admitimos su origen HTTPS, sin confiar en Forwarded.
  return !origin || origin === request.nextUrl.origin ||
    origin === `https://${request.headers.get('host') || request.nextUrl.host}`;
}

async function connectionInput(request: NextRequest): Promise<{ replace: boolean } | null> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let size = 0;
    let raw = '';
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 128) { void reader.cancel(); return null; }
      raw += decoder.decode(chunk.value, { stream: true });
    }
    const input = JSON.parse(raw + decoder.decode()) as { replace?: unknown } | null;
    return typeof input?.replace === 'boolean' ? { replace: input.replace } : null;
  } catch { return null; }
  finally { reader.releaseLock(); }
}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request) || request.headers.get('x-pulsehub-session') !== '1') return fail(403);
  const match = /^Bearer ([^\s]{40,8192})$/.exec(request.headers.get('authorization') || '');
  if (!match) return fail(401);
  try {
    const input = await connectionInput(request);
    if (!input) return fail(400);
    const verified = await authenticateSofiaSsoSession(match[1]);
    if (!verified.success || !verified.user) return fail(401);
    enforceRateLimit(request, verified.user.user_id, 20);
    const existing = request.cookies.has('accessToken') ? await requireAuth(request) : null;
    if (existing?.ok && !input.replace) return NextResponse.json({ success: true, userId: existing.payload.sub, preserved: true }, { headers });
    const organizations = (await getSofiaUserOrgs(verified.user.user_id, match[1]))
      .filter(row => row.status === 'active' && row.organizations?.is_active === true);
    if (!organizations.length) return fail(403);
    const login = await completeSofiaLogin(verified.user, match[1], request, verified.user.email, organizations);
    if (!login.workspaces.length) return fail(403);
    const response = NextResponse.json({ success: true, userId: verified.user.user_id }, { headers });
    const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/' };
    response.cookies.set('accessToken', login.accessToken, { ...options, sameSite: 'lax', maxAge: 3600 });
    // Puente breve para el store cliente existente; no contiene tokens SOFIA.
    response.cookies.set(bootstrapCookie, JSON.stringify({ accessToken: login.accessToken, refreshToken: login.refreshToken }), { ...options, maxAge: 60 });
    return response;
  } catch (error) { return fail(error && typeof error === 'object' && 'status' in error && error.status === 429 ? 429 : 503); }
}

/** El cliente consume el puente de la misma web y conserva su flujo normal de refresh. */
export async function GET(request: NextRequest) {
  if (!hasSameOrigin(request) || request.headers.get('sec-fetch-site') === 'cross-site') return fail(403);
  const raw = request.cookies.get(bootstrapCookie)?.value;
  if (!raw) return new NextResponse(null, { status: 204, headers });
  try {
    const tokens = JSON.parse(raw) as { accessToken?: unknown; refreshToken?: unknown };
    if (typeof tokens.accessToken !== 'string' || typeof tokens.refreshToken !== 'string') return fail(401);
    const payload = await verifyToken(tokens.accessToken);
    if (!payload || payload.type !== 'access' || request.cookies.get('accessToken')?.value !== tokens.accessToken) return fail(401);
    const { data, error } = await getSupabaseAdmin().from('auth_sessions').select('session_id')
      .eq('user_id', payload.sub).eq('token_hash', await hashToken(tokens.accessToken)).eq('is_active', true).eq('is_revoked', false)
      .gt('expires_at', new Date().toISOString()).maybeSingle();
    if (error || !data) return fail(401);
    const response = NextResponse.json(tokens, { headers });
    response.cookies.set(bootstrapCookie, '', { httpOnly: true, path: '/', maxAge: 0 });
    return response;
  } catch { return fail(401); }
}
