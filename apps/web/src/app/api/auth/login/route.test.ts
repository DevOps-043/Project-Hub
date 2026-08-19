import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabaseAdmin } from '@/lib/supabase/test-utils';
import type { AccountUser } from '@/lib/supabase/server';

/**
 * SOFIA queda deshabilitado (`isSofiaAuthEnabled` → false) en todos estos
 * tests: cubren el FLUJO 2 (auth local) de la ruta, que es el que se ejerce
 * sin credenciales de SOFIA configuradas. El flujo SOFIA (Supabase Auth +
 * sincronización de workspaces) queda fuera de este archivo — depende de
 * varios módulos más (`sofia-auth`, `workspace-service`) y merece su propio
 * archivo de test si se decide cubrirlo.
 */
const state = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => state.from(...args),
    rpc: (...args: unknown[]) => state.rpc(...args),
  },
}));

vi.mock('@/lib/auth/sofia-auth', () => ({
  isSofiaAuthEnabled: () => false,
  authenticateSofiaUser: vi.fn(),
  recordSofiaLogin: vi.fn(),
  getSofiaUserOrgs: vi.fn(),
  normalizeAccountUsername: (u: string) => u,
  SOFIA_MANAGED_PASSWORD_PLACEHOLDER: 'supabase-auth:sofia',
}));

vi.mock('@/lib/services/workspace-service', () => ({
  syncWorkspacesFromSofia: vi.fn(),
}));

import { POST } from './route';
import { hashPassword } from '@/lib/auth/password';

async function makeUser(overrides: Partial<AccountUser> = {}): Promise<AccountUser> {
  return {
    user_id: 'user-123',
    first_name: 'Fernando',
    last_name_paternal: 'Suarez',
    last_name_maternal: null,
    display_name: 'Fernando Suarez',
    username: 'fernando_suarez',
    email: 'fernando@example.com',
    password_hash: await hashPassword('CorrectPass123'),
    permission_level: 'user',
    company_role: null,
    department: null,
    account_status: 'active',
    is_email_verified: true,
    email_verified_at: null,
    avatar_url: null,
    phone_number: null,
    timezone: 'America/Mexico_City',
    locale: 'es-MX',
    last_login_at: null,
    last_activity_at: null,
    failed_login_attempts: 0,
    locked_until: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function loginRequest(body: unknown) {
  return new NextRequest('https://app.example.com/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  state.from.mockReset();
  state.rpc.mockReset();
  state.rpc.mockResolvedValue({ data: null, error: null });
});

describe('POST /api/auth/login (local auth fallback)', () => {
  it('rejects with 400 when email or password is missing', async () => {
    const res = await POST(loginRequest({ email: 'fernando@example.com' }));
    expect(res.status).toBe(400);
  });

  it('rejects with 400 for a malformed email', async () => {
    const res = await POST(loginRequest({ email: 'not-an-email@', password: 'x' }));
    expect(res.status).toBe(400);
  });

  it('rejects with 400 for a malformed username (no @, fails the username regex)', async () => {
    const res = await POST(loginRequest({ email: 'a!', password: 'x' }));
    expect(res.status).toBe(400);
  });

  it('rejects with 401 when no user matches the email/username', async () => {
    const fake = createFakeSupabaseAdmin({ account_users: [{ data: null }], auth_login_history: [{}] });
    state.from.mockImplementation(fake.from);

    const res = await POST(loginRequest({ email: 'ghost@example.com', password: 'whatever' }));
    expect(res.status).toBe(401);

    const historyInsert = fake.calls.find((c) => c.table === 'auth_login_history' && c.method === 'insert');
    expect(historyInsert).toBeTruthy();
  });

  it('rejects with 423 and a lockoutSeconds hint for a temporarily locked account', async () => {
    const lockedUntil = new Date(Date.now() + 60_000).toISOString();
    const user = await makeUser({ locked_until: lockedUntil });
    const fake = createFakeSupabaseAdmin({ account_users: [{ data: user }], auth_login_history: [{}] });
    state.from.mockImplementation(fake.from);

    const res = await POST(loginRequest({ email: user.email, password: 'CorrectPass123' }));
    expect(res.status).toBe(423);
    const json = await res.json();
    expect(json.lockoutSeconds).toBeGreaterThan(0);
  });

  it('does not block on a lock that has already expired', async () => {
    const expiredLock = new Date(Date.now() - 60_000).toISOString();
    const user = await makeUser({ locked_until: expiredLock });
    const fake = createFakeSupabaseAdmin({
      account_users: [{ data: user }],
      auth_login_history: [{}],
      auth_sessions: [{}],
    });
    state.from.mockImplementation(fake.from);

    const res = await POST(loginRequest({ email: user.email, password: 'CorrectPass123' }));
    expect(res.status).toBe(200);
  });

  it('rejects with 403 for a suspended account', async () => {
    const user = await makeUser({ account_status: 'suspended' });
    const fake = createFakeSupabaseAdmin({ account_users: [{ data: user }], auth_login_history: [{}] });
    state.from.mockImplementation(fake.from);

    const res = await POST(loginRequest({ email: user.email, password: 'CorrectPass123' }));
    expect(res.status).toBe(403);
  });

  it('rejects with 401 and records a failed-login RPC call for a wrong password', async () => {
    const user = await makeUser();
    const fake = createFakeSupabaseAdmin({ account_users: [{ data: user }], auth_login_history: [{}] });
    state.from.mockImplementation(fake.from);

    const res = await POST(loginRequest({ email: user.email, password: 'WrongPassword1' }));
    expect(res.status).toBe(401);
    expect(state.rpc).toHaveBeenCalledWith('handle_failed_login', { p_user_id: user.user_id });
  });

  it('logs in successfully with the correct password: issues tokens, sets the cookie, creates a session, resets failed attempts', async () => {
    const user = await makeUser();
    const fake = createFakeSupabaseAdmin({
      account_users: [{ data: user }],
      auth_login_history: [{}],
      auth_sessions: [{}],
    });
    state.from.mockImplementation(fake.from);

    const res = await POST(loginRequest({ email: user.email, password: 'CorrectPass123' }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.accessToken).toBeTruthy();
    expect(json.refreshToken).toBeTruthy();
    expect(json.authSource).toBe('local');
    expect(json.user.email).toBe(user.email);

    const setCookie = res.headers.get('set-cookie') || '';
    expect(setCookie).toMatch(/accessToken=/);

    expect(fake.calls.some((c) => c.table === 'auth_sessions' && c.method === 'insert')).toBe(true);
    const historyInsert = fake.calls.find((c) => c.table === 'auth_login_history' && c.method === 'insert');
    expect(historyInsert).toBeTruthy();
    expect(state.rpc).toHaveBeenCalledWith('reset_failed_login_attempts', { p_user_id: user.user_id });
  });

  // Security regression: an email containing '%' (valid per the route's own
  // regex, e.g. a local-part like "a%b@x.com") must not turn the ilike lookup
  // into a wildcard scan that matches an unrelated account.
  it('treats a "%" in the email as a literal character, not an ilike wildcard', async () => {
    const fake = createFakeSupabaseAdmin({ account_users: [{ data: null }], auth_login_history: [{}] });
    state.from.mockImplementation(fake.from);

    const res = await POST(loginRequest({ email: 'a%b@example.com', password: 'whatever' }));
    // No matching user (correctly not found via wildcard-abuse) -> still a clean 401, not a crash.
    expect(res.status).toBe(401);
  });
});
