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

function requestWithBearer(token?: string) {
  return new NextRequest('https://app.example.com/api/auth/logout', {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

beforeEach(() => {
  state.from.mockReset();
});

describe('POST /api/auth/logout', () => {
  it('rejects with 401 when no Authorization header is present', async () => {
    const res = await POST(requestWithBearer());
    expect(res.status).toBe(401);
  });

  it('rejects with 401 for a malformed token', async () => {
    const res = await POST(requestWithBearer('garbage'));
    expect(res.status).toBe(401);
  });

  it('revokes the session and clears the accessToken cookie for a valid token', async () => {
    const { accessToken } = await generateTokenPair(makeUser());
    const fake = createFakeSupabaseAdmin({ auth_sessions: [{ data: null }] });
    state.from.mockImplementation(fake.from);

    const res = await POST(requestWithBearer(accessToken));
    expect(res.status).toBe(200);

    const sessionCalls = fake.calls.filter((c) => c.table === 'auth_sessions');
    expect(sessionCalls.some((c) => c.method === 'update')).toBe(true);

    // httpOnly cookie must be cleared (maxAge 0) so the browser drops it.
    const setCookie = res.headers.get('set-cookie') || '';
    expect(setCookie).toMatch(/accessToken=;/);
    expect(setCookie.toLowerCase()).toMatch(/max-age=0/);
  });
});
