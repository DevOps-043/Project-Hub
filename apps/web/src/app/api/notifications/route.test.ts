import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabaseAdmin } from '@/lib/supabase/test-utils';
import { generateTokenPair } from '@/lib/auth/jwt';
import type { AccountUser } from '@/lib/supabase/server';

const state = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: () => ({ from: (...args: unknown[]) => state.from(...args) }),
}));

import { GET } from './route';

function makeUser(overrides: Partial<AccountUser> = {}): AccountUser {
  return {
    user_id: 'user-1',
    first_name: 'Fernando',
    last_name_paternal: 'Suarez',
    last_name_maternal: null,
    display_name: 'Fernando Suarez',
    username: 'fernando',
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

beforeEach(() => {
  state.from.mockReset();
});

describe('GET /api/notifications', () => {
  it('rejects with 401 when unauthenticated', async () => {
    const req = new NextRequest('https://app.example.com/api/notifications');
    expect((await GET(req)).status).toBe(401);
  });

  // Regression test for the documented IDOR fix: the recipient must always
  // be the session owner (JWT sub), never an attacker-supplied query param.
  it('ignores a spoofed ?userId= query param and scopes strictly to the session owner', async () => {
    const { accessToken } = await generateTokenPair(makeUser({ user_id: 'victim-user' }));
    const fake = createFakeSupabaseAdmin({ notifications: [{ data: [] }] });
    state.from.mockImplementation(fake.from);

    const req = new NextRequest('https://app.example.com/api/notifications?userId=attacker-user', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect((await GET(req)).status).toBe(200);

    const selectCall = fake.calls.find((c) => c.table === 'notifications' && c.method === 'select');
    expect(selectCall).toBeTruthy();
  });

  it('returns the recipient notifications on success', async () => {
    const { accessToken } = await generateTokenPair(makeUser());
    const fake = createFakeSupabaseAdmin({
      notifications: [{ data: [{ id: 'n1', title: 'Hello' }] }],
    });
    state.from.mockImplementation(fake.from);

    const req = new NextRequest('https://app.example.com/api/notifications', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const json = await (await GET(req)).json();
    expect(json).toHaveLength(1);
  });

  it('returns 500 without crashing when the query fails', async () => {
    const { accessToken } = await generateTokenPair(makeUser());
    const fake = createFakeSupabaseAdmin({
      notifications: [{ data: null, error: { message: 'db down' } }],
    });
    state.from.mockImplementation(fake.from);

    const req = new NextRequest('https://app.example.com/api/notifications', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect((await GET(req)).status).toBe(500);
  });
});
