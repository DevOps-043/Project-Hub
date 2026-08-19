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

const TEAM_UUID = '11111111-1111-1111-1111-111111111111';

function makeAdminUser(overrides: Partial<AccountUser> = {}): AccountUser {
  return {
    user_id: 'admin-1',
    first_name: 'Admin',
    last_name_paternal: 'User',
    last_name_maternal: null,
    display_name: 'Admin User',
    username: 'admin',
    email: 'admin@example.com',
    password_hash: 'irrelevant',
    permission_level: 'admin',
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

async function adminRequest(url: string, init: SimpleRequestInit = {}) {
  const { accessToken } = await generateTokenPair(makeAdminUser());
  return new NextRequest(url, {
    ...init,
    headers: { ...(init.headers || {}), authorization: `Bearer ${accessToken}` },
  });
}

function ctx() {
  return { params: Promise.resolve({ teamId: TEAM_UUID }) };
}

beforeEach(() => {
  state.from.mockReset();
});

describe('GET /api/admin/teams/[teamId]/labels', () => {
  it('rejects with 401 when unauthenticated', async () => {
    const req = new NextRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}/labels`);
    expect((await GET(req, ctx())).status).toBe(401);
  });

  it('lists labels for the team', async () => {
    const fake = createFakeSupabaseAdmin({ task_labels: [{ data: [{ label_id: 'l1', name: 'Bug' }] }] });
    state.from.mockImplementation(fake.from);
    const req = await adminRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}/labels`);
    const json = await (await GET(req, ctx())).json();
    expect(json.labels).toHaveLength(1);
  });

  it('returns 500 when the query fails', async () => {
    const fake = createFakeSupabaseAdmin({ task_labels: [{ data: null, error: { message: 'db down' } }] });
    state.from.mockImplementation(fake.from);
    const req = await adminRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}/labels`);
    expect((await GET(req, ctx())).status).toBe(500);
  });
});

describe('POST /api/admin/teams/[teamId]/labels', () => {
  it('rejects with 400 for a blank name', async () => {
    const req = await adminRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}/labels`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '   ' }),
    });
    expect((await POST(req, ctx())).status).toBe(400);
  });

  it('creates the label with a default color when none is provided', async () => {
    const fake = createFakeSupabaseAdmin({
      task_labels: [{ data: { label_id: 'new-l1', name: 'Bug', color: '#6366F1' } }],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}/labels`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Bug' }),
    });
    const res = await POST(req, ctx());
    expect(res.status).toBe(201);

    const insertCall = fake.calls.find((c) => c.table === 'task_labels' && c.method === 'insert');
    const inserted = insertCall?.args[0] as { color: string; created_by: string };
    expect(inserted.color).toBe('#6366F1');
    expect(inserted.created_by).toBe('admin-1');
  });
});
