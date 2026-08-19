import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabaseAdmin } from '@/lib/supabase/test-utils';
import { generateTokenPair } from '@/lib/auth/jwt';
import type { AccountUser } from '@/lib/supabase/server';

const state = vi.hoisted(() => ({ from: vi.fn(), verifyApiKey: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: () => ({ from: (...args: unknown[]) => state.from(...args) }),
}));

// Mocked even though the route imports it dynamically (`await import(...)`):
// Vitest intercepts module resolution regardless of static/dynamic syntax.
vi.mock('@/lib/services/api-key-service', () => ({
  verifyApiKey: (...args: unknown[]) => state.verifyApiKey(...args),
}));

import { GET, PUT } from './route';

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

async function userRequest(url: string, init: SimpleRequestInit = {}) {
  const { accessToken } = await generateTokenPair(makeUser());
  return new NextRequest(url, {
    ...init,
    headers: { ...(init.headers || {}), authorization: `Bearer ${accessToken}` },
  });
}

beforeEach(() => {
  state.from.mockReset();
  state.verifyApiKey.mockReset();
});

describe('GET /api/notifications/preferences', () => {
  it('rejects with 401 when there is no token', async () => {
    const req = new NextRequest('https://app.example.com/api/notifications/preferences');
    expect((await GET(req)).status).toBe(401);
  });

  it('returns default preferences when the user has none saved yet (PGRST116)', async () => {
    const fake = createFakeSupabaseAdmin({
      user_notification_preferences: [{ data: null, error: { code: 'PGRST116' } }],
    });
    state.from.mockImplementation(fake.from);

    const req = await userRequest('https://app.example.com/api/notifications/preferences');
    const json = await (await GET(req)).json();
    expect(json.preferences.soflia_enabled).toBe(false);
    expect(json.preferences.email_daily_summary).toBe(true);
  });

  it('returns the stored preferences when they exist', async () => {
    const fake = createFakeSupabaseAdmin({
      user_notification_preferences: [{ data: { user_id: 'user-1', soflia_enabled: true } }],
    });
    state.from.mockImplementation(fake.from);

    const req = await userRequest('https://app.example.com/api/notifications/preferences');
    const json = await (await GET(req)).json();
    expect(json.preferences.soflia_enabled).toBe(true);
  });

  it('rejects with 401 for an invalid API key', async () => {
    state.verifyApiKey.mockResolvedValue({ valid: false });
    const req = new NextRequest('https://app.example.com/api/notifications/preferences?userId=u2', {
      headers: { authorization: 'Bearer phub_invalidkey' },
    });
    expect((await GET(req)).status).toBe(401);
  });

  it('rejects with 400 when an API key request omits ?userId=', async () => {
    state.verifyApiKey.mockResolvedValue({ valid: true });
    const req = new NextRequest('https://app.example.com/api/notifications/preferences', {
      headers: { authorization: 'Bearer phub_validkey' },
    });
    expect((await GET(req)).status).toBe(400);
  });

  it('resolves preferences for the ?userId= given a valid API key', async () => {
    state.verifyApiKey.mockResolvedValue({ valid: true });
    const fake = createFakeSupabaseAdmin({
      user_notification_preferences: [{ data: { user_id: 'target-user', soflia_enabled: true } }],
    });
    state.from.mockImplementation(fake.from);

    const req = new NextRequest('https://app.example.com/api/notifications/preferences?userId=target-user', {
      headers: { authorization: 'Bearer phub_validkey' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
  });
});

describe('PUT /api/notifications/preferences', () => {
  it('rejects with 401 when there is no token', async () => {
    const req = new NextRequest('https://app.example.com/api/notifications/preferences', { method: 'PUT' });
    expect((await PUT(req)).status).toBe(401);
  });

  it('rejects with 400 when no allowed boolean field is present', async () => {
    const req = await userRequest('https://app.example.com/api/notifications/preferences', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ some_unknown_field: true, soflia_enabled: 'not-a-boolean' }),
    });
    expect((await PUT(req)).status).toBe(400);
  });

  it('upserts only the allowed boolean fields, ignoring unknown ones', async () => {
    const fake = createFakeSupabaseAdmin({
      user_notification_preferences: [{ data: { user_id: 'user-1', soflia_enabled: true } }],
    });
    state.from.mockImplementation(fake.from);

    const req = await userRequest('https://app.example.com/api/notifications/preferences', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ soflia_enabled: true, not_a_real_field: 'x' }),
    });
    expect((await PUT(req)).status).toBe(200);

    const upsertCall = fake.calls.find((c) => c.table === 'user_notification_preferences' && c.method === 'upsert');
    const upserted = upsertCall?.args[0] as Record<string, unknown>;
    expect(upserted.soflia_enabled).toBe(true);
    expect(upserted).not.toHaveProperty('not_a_real_field');
    expect(upserted.user_id).toBe('user-1');
  });
});
