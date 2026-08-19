import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabaseAdmin } from '@/lib/supabase/test-utils';
import { generateTokenPair } from '@/lib/auth/jwt';
import type { AccountUser } from '@/lib/supabase/server';

const state = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => state.from(...args) },
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

async function extRequest(url: string, init: SimpleRequestInit = {}) {
  const { accessToken } = await generateTokenPair(makeUser());
  return new NextRequest(url, {
    ...init,
    headers: { ...(init.headers || {}), authorization: `Bearer ${accessToken}` },
  });
}

beforeEach(() => {
  state.from.mockReset();
});

describe('GET /api/ext/projects', () => {
  it('rejects with 401 when no Authorization header is present', async () => {
    const req = new NextRequest('https://app.example.com/api/ext/projects');
    expect((await GET(req)).status).toBe(401);
  });

  it('rejects with 401 for a malformed token', async () => {
    const req = new NextRequest('https://app.example.com/api/ext/projects', {
      headers: { authorization: 'Bearer garbage' },
    });
    expect((await GET(req)).status).toBe(401);
  });

  it('rejects with 401 when a refresh token is used instead of an access token', async () => {
    const { refreshToken } = await generateTokenPair(makeUser());
    const req = new NextRequest('https://app.example.com/api/ext/projects', {
      headers: { authorization: `Bearer ${refreshToken}` },
    });
    expect((await GET(req)).status).toBe(401);
  });

  it('excludes archived projects and filters by team_id when given', async () => {
    const fake = createFakeSupabaseAdmin({
      pm_projects: [{ data: [{ project_id: 'p1', name: 'Alpha' }] }],
    });
    state.from.mockImplementation(fake.from);

    const req = await extRequest('https://app.example.com/api/ext/projects?team_id=t1');
    const json = await (await GET(req)).json();
    expect(json.projects).toHaveLength(1);

    const selectCall = fake.calls.find((c) => c.table === 'pm_projects' && c.method === 'select');
    expect(selectCall).toBeTruthy();
  });
});

describe('POST /api/ext/projects', () => {
  it('rejects with 401 when unauthenticated', async () => {
    const req = new NextRequest('https://app.example.com/api/ext/projects', { method: 'POST' });
    expect((await POST(req)).status).toBe(401);
  });

  it('rejects with 400 when name is missing', async () => {
    const req = await extRequest('https://app.example.com/api/ext/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ description: 'x' }),
    });
    expect((await POST(req)).status).toBe(400);
  });

  it('derives an identifier from the name and sets creator/lead from the token, not the body', async () => {
    const fake = createFakeSupabaseAdmin({
      pm_projects: [{ data: { project_id: 'new-p1', name: 'Alpha Project' } }],
    });
    state.from.mockImplementation(fake.from);

    const req = await extRequest('https://app.example.com/api/ext/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Alpha Project', creator_id: 'someone-else' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);

    const insertCall = fake.calls.find((c) => c.table === 'pm_projects' && c.method === 'insert');
    const inserted = insertCall?.args[0] as { identifier: string; creator_id: string; lead_id: string };
    expect(inserted.identifier).toBe('ALPHA');
    expect(inserted.creator_id).toBe('user-1');
    expect(inserted.lead_id).toBe('user-1');
  });
});
