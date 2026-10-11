import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ native: vi.fn(), organizations: vi.fn(), login: vi.fn(), existing: vi.fn(), verify: vi.fn(), session: vi.fn() }));
vi.mock('@/lib/auth/sofia-auth', () => ({ authenticateSofiaSsoSession: mocks.native, getSofiaUserOrgs: mocks.organizations }));
vi.mock('@/lib/auth/sofia-login-pipeline', () => ({ completeSofiaLogin: mocks.login }));
vi.mock('@/lib/auth/require-role', () => ({ requireAuth: mocks.existing }));
vi.mock('@/lib/api-v1/http', () => ({ enforceRateLimit: vi.fn() }));
vi.mock('@/lib/auth/jwt', () => ({ verifyToken: mocks.verify, hashToken: async () => 'hash' }));
vi.mock('@/lib/supabase/server', () => ({ getSupabaseAdmin: () => ({ from: () => { const chain = { select: () => chain, eq: () => chain, gt: () => chain, maybeSingle: mocks.session }; return chain; } }) }));
import { GET, POST } from './route';
function post(replace = false, origin?: string, cookie?: string) {
  return new NextRequest('https://hub.test/api/auth/hub-session', { method: 'POST', headers: { 'X-PulseHub-Session': '1', Authorization: `Bearer ${'t'.repeat(48)}`, ...(origin ? { Origin: origin } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify({ replace }) });
}
beforeEach(() => {
  vi.resetAllMocks(); mocks.native.mockResolvedValue({ success: true, user: { user_id: 'hub-user', email: 'u@test.test' } });
  mocks.organizations.mockResolvedValue([{ status: 'active', organizations: { id: 'acme', is_active: true } }]);
  mocks.login.mockResolvedValue({ accessToken: 'local-access', refreshToken: 'local-refresh', workspaces: [{ slug: 'acme' }] });
  mocks.verify.mockResolvedValue({ sub: 'hub-user', type: 'access' }); mocks.session.mockResolvedValue({ data: { session_id: 'sesion' }, error: null });
});
describe('Conexión de Project Hub desde PulseHub', () => {
  it('admite el origen HTTPS público con una URL interna HTTP y rechaza dominios parecidos', async () => {
    const req = new NextRequest('http://127.0.0.1:3000/api/auth/hub-session', { method: 'POST', headers: { Host: 'hub.test', Origin: 'https://hub.test', 'X-PulseHub-Session': '1' }, body: '{"replace":false}' });
    expect((await POST(req)).status).toBe(401); expect(mocks.native).not.toHaveBeenCalled();
    req.headers.set('origin', 'https://hub.test.evil.test');
    expect((await POST(req)).status).toBe(403);
  });
  it('el consumo del puente también admite el origen público y conserva el rechazo cross-site', async () => {
    const req = new NextRequest('http://127.0.0.1:3000/api/auth/hub-session', { headers: { Host: 'hub.test', Origin: 'https://hub.test' } });
    expect((await GET(req)).status).toBe(204);
    req.headers.set('sec-fetch-site', 'cross-site'); expect((await GET(req)).status).toBe(403);
  });
  it('crea cookies web sin exponer tokens en el canje', async () => {
    const response = await POST(post()); expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, userId: 'hub-user' });
    expect(response.cookies.get('accessToken')?.value).toBe('local-access');
    expect(response.cookies.get('pulsehub_bootstrap')?.httpOnly).toBe(true);
  });
  it('no emite cookies para orígenes cruzados, bearer inválido o falta de membresía', async () => {
    expect((await POST(post(false, 'https://evil.test'))).status).toBe(403); expect(mocks.native).not.toHaveBeenCalled();
    mocks.native.mockResolvedValueOnce({ success: false }); expect((await POST(post())).status).toBe(401);
    mocks.login.mockResolvedValueOnce({ workspaces: [] }); const response = await POST(post()); expect(response.status).toBe(403); expect(response.cookies.getAll()).toHaveLength(0);
  });
  it('conserva otra sesión y solo la reemplaza por petición explícita', async () => {
    mocks.existing.mockResolvedValue({ ok: true, payload: { sub: 'otra-cuenta' } });
    expect(await (await POST(post(false, undefined, 'accessToken=otra'))).json()).toMatchObject({ preserved: true });
    expect(mocks.login).not.toHaveBeenCalled();
    await POST(post(true, undefined, 'accessToken=otra')); expect(mocks.login).toHaveBeenCalledOnce();
  });
  it('consume el puente solo con sesión local vigente y elimina la cookie breve', async () => {
    const raw = encodeURIComponent(JSON.stringify({ accessToken: 'local-access', refreshToken: 'local-refresh' }));
    const request = new NextRequest('https://hub.test/api/auth/hub-session', { headers: { Cookie: `accessToken=local-access; pulsehub_bootstrap=${raw}` } });
    const response = await GET(request); expect(response.status).toBe(200); expect(response.cookies.get('pulsehub_bootstrap')?.maxAge).toBe(0);
    mocks.session.mockResolvedValueOnce({ data: null, error: null }); expect((await GET(request)).status).toBe(401);
    mocks.verify.mockResolvedValueOnce({ sub: 'hub-user', type: 'refresh' }); expect((await GET(request)).status).toBe(401);
  });
  it('no sincroniza ni emite sesiones para organizaciones inactivas o membresías suspendidas', async () => {
    mocks.organizations.mockResolvedValue([{ status: 'suspended', organizations: { is_active: true } }, { status: 'active', organizations: { is_active: false } }]);
    expect((await POST(post())).status).toBe(403); expect(mocks.login).not.toHaveBeenCalled();
  });
  it('no entrega el puente a un origen cruzado', async () => {
    expect((await GET(new NextRequest('https://hub.test/api/auth/hub-session', { headers: { Origin: 'https://evil.test' } }))).status).toBe(403);
    expect((await GET(new NextRequest('https://hub.test/api/auth/hub-session', { headers: { 'Sec-Fetch-Site': 'cross-site' } }))).status).toBe(403);
  });
  it('sin puente no restaura una sesión cerrada', async () => {
    expect((await GET(new NextRequest('https://hub.test/api/auth/hub-session'))).status).toBe(204); expect(mocks.verify).not.toHaveBeenCalled();
  });
});
