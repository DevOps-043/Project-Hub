import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabaseAdmin } from '@/lib/supabase/test-utils';
import type { AccountUser } from '@/lib/supabase/server';

const state = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => state.from(...args) },
}));

import { POST } from './route';
import { generateTokenPair } from '@/lib/auth/jwt';

function makeUser(overrides: Partial<AccountUser> = {}): AccountUser {
  return {
    user_id: 'user-123',
    first_name: 'Fernando',
    last_name_paternal: 'Suarez',
    last_name_maternal: null,
    display_name: 'Fernando Suarez',
    username: 'fernando_suarez',
    email: 'fernando@example.com',
    password_hash: 'irrelevant',
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

function requestWithBody(body: unknown) {
  return new NextRequest('https://app.example.com/api/auth/refresh', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  state.from.mockReset();
});

describe('POST /api/auth/refresh', () => {
  it('rejects with 400 when refreshToken is missing from the body', async () => {
    const res = await POST(requestWithBody({}));
    expect(res.status).toBe(400);
  });

  it('rejects with 401 a malformed/garbage refresh token', async () => {
    const res = await POST(requestWithBody({ refreshToken: 'not-a-real-token' }));
    expect(res.status).toBe(401);
  });

  it('rejects with 401 when an access token is used where a refresh token is required', async () => {
    const { accessToken } = await generateTokenPair(makeUser());
    const res = await POST(requestWithBody({ refreshToken: accessToken }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/tipo de token/i);
  });

  it('rejects with 404 when the user no longer exists', async () => {
    const { refreshToken } = await generateTokenPair(makeUser());
    const fake = createFakeSupabaseAdmin({ account_users: [{ data: null, error: { message: 'not found' } }] });
    state.from.mockImplementation(fake.from);

    const res = await POST(requestWithBody({ refreshToken }));
    expect(res.status).toBe(404);
  });

  it('rejects with 403 when the account is not active (e.g. suspended)', async () => {
    const user = makeUser({ account_status: 'suspended' });
    const { refreshToken } = await generateTokenPair(user);
    const fake = createFakeSupabaseAdmin({ account_users: [{ data: user }] });
    state.from.mockImplementation(fake.from);

    const res = await POST(requestWithBody({ refreshToken }));
    expect(res.status).toBe(403);
  });

  it('issues a new token pair and revokes the previous session for an active user', async () => {
    const user = makeUser();
    const { refreshToken } = await generateTokenPair(user);
    const fake = createFakeSupabaseAdmin({
      account_users: [{ data: user }],
      auth_sessions: [{ data: null }, { data: null }], // revoke old + insert new
    });
    state.from.mockImplementation(fake.from);

    const res = await POST(requestWithBody({ refreshToken }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.accessToken).toBeTruthy();
    expect(json.refreshToken).toBeTruthy();
    expect(json.expiresIn).toBeGreaterThan(0);

    // The old session gets revoked and a new one inserted — both against auth_sessions.
    const sessionCalls = fake.calls.filter((c) => c.table === 'auth_sessions');
    expect(sessionCalls.some((c) => c.method === 'update')).toBe(true);
    expect(sessionCalls.some((c) => c.method === 'insert')).toBe(true);
  });
});
