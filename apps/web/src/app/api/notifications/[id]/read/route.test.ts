import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabaseAdmin } from '@/lib/supabase/test-utils';
import { generateTokenPair } from '@/lib/auth/jwt';
import type { AccountUser } from '@/lib/supabase/server';

const state = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: () => ({ from: (...args: unknown[]) => state.from(...args) }),
}));

import { PATCH } from './route';

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

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  state.from.mockReset();
});

describe('PATCH /api/notifications/[id]/read', () => {
  it('rejects with 401 when unauthenticated', async () => {
    const req = new NextRequest('https://app.example.com/api/notifications/n1/read', { method: 'PATCH' });
    expect((await PATCH(req, ctx('n1'))).status).toBe(401);
  });

  // Regression test for the documented IDOR fix: the update must always be
  // scoped to the session owner's recipient_id, never an unowned notification.
  it('scopes the update to notification_id AND the session owner as recipient_id', async () => {
    const { accessToken } = await generateTokenPair(makeUser({ user_id: 'owner-1' }));
    const fake = createFakeSupabaseAdmin({ notifications: [{ data: null }] });
    state.from.mockImplementation(fake.from);

    const req = new NextRequest('https://app.example.com/api/notifications/n1/read', {
      method: 'PATCH',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const res = await PATCH(req, ctx('n1'));
    expect(res.status).toBe(200);

    const updateCall = fake.calls.find((c) => c.table === 'notifications' && c.method === 'update');
    expect(updateCall).toBeTruthy();
    const updated = updateCall?.args[0] as { is_read: boolean; read_at: string };
    expect(updated.is_read).toBe(true);
    expect(updated.read_at).toBeTruthy();
  });

  it('returns 500 when the update fails', async () => {
    const { accessToken } = await generateTokenPair(makeUser());
    const fake = createFakeSupabaseAdmin({ notifications: [{ data: null, error: { message: 'db down' } }] });
    state.from.mockImplementation(fake.from);

    const req = new NextRequest('https://app.example.com/api/notifications/n1/read', {
      method: 'PATCH',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect((await PATCH(req, ctx('n1'))).status).toBe(500);
  });
});
