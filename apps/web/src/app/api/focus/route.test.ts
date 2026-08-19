import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabaseAdmin } from '@/lib/supabase/test-utils';
import { generateTokenPair } from '@/lib/auth/jwt';
import type { AccountUser } from '@/lib/supabase/server';

const state = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: () => ({ from: (...args: unknown[]) => state.from(...args) }),
}));

import { GET, POST } from './route';

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

interface SimpleRequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

async function userRequest(url: string, init: SimpleRequestInit = {}, userId = 'user-1') {
  const { accessToken } = await generateTokenPair(makeUser({ user_id: userId }));
  return new NextRequest(url, {
    ...init,
    headers: { ...(init.headers || {}), authorization: `Bearer ${accessToken}` },
  });
}

beforeEach(() => {
  state.from.mockReset();
});

describe('GET /api/focus', () => {
  it('rejects with 401 when unauthenticated (regression: this was public before)', async () => {
    const req = new NextRequest('https://app.example.com/api/focus');
    expect((await GET(req)).status).toBe(401);
  });

  it('returns a global active session regardless of which user asks', async () => {
    const fake = createFakeSupabaseAdmin({
      focus_sessions: [{ data: [{ session_id: 's1', status: 'active', target_type: 'global', target_ids: [] }] }],
    });
    state.from.mockImplementation(fake.from);

    const req = await userRequest('https://app.example.com/api/focus');
    const json = await (await GET(req)).json();
    expect(json.activeSession.session_id).toBe('s1');
  });

  it('returns a targeted session for a user whose id is in target_ids', async () => {
    const targetedSession = { session_id: 's1', status: 'active', target_type: 'users', target_ids: ['victim-user'] };
    const fake = createFakeSupabaseAdmin({ focus_sessions: [{ data: [targetedSession] }] });
    state.from.mockImplementation(fake.from);

    const reqVictim = await userRequest('https://app.example.com/api/focus', {}, 'victim-user');
    expect((await (await GET(reqVictim)).json()).activeSession.session_id).toBe('s1');
  });

  it('excludes a targeted session for a user whose id is NOT in target_ids', async () => {
    const targetedSession = { session_id: 's1', status: 'active', target_type: 'users', target_ids: ['victim-user'] };
    const fake = createFakeSupabaseAdmin({ focus_sessions: [{ data: [targetedSession] }] });
    state.from.mockImplementation(fake.from);

    const reqOther = await userRequest('https://app.example.com/api/focus', {}, 'other-user');
    expect((await (await GET(reqOther)).json()).activeSession).toBeNull();
  });
});

describe('POST /api/focus', () => {
  it('rejects with 401 when unauthenticated (regression: this was public before)', async () => {
    const req = new NextRequest('https://app.example.com/api/focus', { method: 'POST' });
    expect((await POST(req)).status).toBe(401);
  });

  it('rejects with 400 when durationMinutes is missing', async () => {
    const req = await userRequest('https://app.example.com/api/focus', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ taskName: 'Deep work' }),
    });
    expect((await POST(req)).status).toBe(400);
  });

  // Security regression: createdBy must always come from the verified JWT,
  // never from the request body — otherwise any authenticated user could
  // attribute a focus session (and its screen-lock effect) to someone else.
  it('sets created_by from the JWT subject, ignoring any createdBy in the body', async () => {
    const fake = createFakeSupabaseAdmin({
      focus_sessions: [{ data: { session_id: 'new-s', created_by: 'user-1' } }],
    });
    state.from.mockImplementation(fake.from);

    const req = await userRequest('https://app.example.com/api/focus', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ durationMinutes: 25, createdBy: 'someone-else' }),
    });
    expect((await POST(req)).status).toBe(200);

    const insertCall = fake.calls.find((c) => c.table === 'focus_sessions' && c.method === 'insert');
    expect((insertCall?.args[0] as { created_by: string }).created_by).toBe('user-1');
  });

  it('notifies each targeted user when targetType is "users"', async () => {
    const fake = createFakeSupabaseAdmin({
      focus_sessions: [{ data: { session_id: 'new-s' } }],
      notifications: [{ data: null }],
    });
    state.from.mockImplementation(fake.from);

    const req = await userRequest('https://app.example.com/api/focus', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ durationMinutes: 25, targetType: 'users', targetIds: ['u2', 'u3'] }),
    });
    expect((await POST(req)).status).toBe(200);

    const notifyCall = fake.calls.find((c) => c.table === 'notifications' && c.method === 'insert');
    const notified = notifyCall?.args[0] as { recipient_id: string }[];
    expect(notified.map((n) => n.recipient_id)).toEqual(['u2', 'u3']);
  });
});
