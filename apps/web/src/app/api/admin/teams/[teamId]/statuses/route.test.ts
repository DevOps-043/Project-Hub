import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabaseAdmin } from '@/lib/supabase/test-utils';
import { generateTokenPair } from '@/lib/auth/jwt';
import type { AccountUser } from '@/lib/supabase/server';

const state = vi.hoisted(() => ({
  from: vi.fn(),
  resolveTeamId: vi.fn(),
  ensureDefaultTaskStatuses: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => state.from(...args) },
}));

vi.mock('@/lib/services/task-status-service', () => ({
  resolveTeamId: (...args: unknown[]) => state.resolveTeamId(...args),
  ensureDefaultTaskStatuses: (...args: unknown[]) => state.ensureDefaultTaskStatuses(...args),
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
  state.resolveTeamId.mockReset();
  state.ensureDefaultTaskStatuses.mockReset();
  state.resolveTeamId.mockResolvedValue(TEAM_UUID);
});

describe('GET /api/admin/teams/[teamId]/statuses', () => {
  it('rejects with 401 when unauthenticated', async () => {
    const req = new NextRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}/statuses`);
    expect((await GET(req, ctx())).status).toBe(401);
  });

  it('returns 404 when the team cannot be resolved', async () => {
    state.resolveTeamId.mockResolvedValue(null);
    const req = await adminRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}/statuses`);
    expect((await GET(req, ctx())).status).toBe(404);
  });

  it('returns the statuses ensured for the team', async () => {
    state.ensureDefaultTaskStatuses.mockResolvedValue([{ status_id: 's1', name: 'Todo' }]);
    const req = await adminRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}/statuses`);
    const json = await (await GET(req, ctx())).json();
    expect(json.statuses).toHaveLength(1);
  });
});

describe('POST /api/admin/teams/[teamId]/statuses', () => {
  it('rejects with 400 when name or status_type is missing', async () => {
    const req = await adminRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}/statuses`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Blocked' }),
    });
    expect((await POST(req, ctx())).status).toBe(400);
  });

  it('places the new status at the next position after the current max', async () => {
    const fake = createFakeSupabaseAdmin({
      task_statuses: [
        { data: { position: 3 } },
        { data: { status_id: 'new-s', name: 'Blocked', position: 4 } },
      ],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}/statuses`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Blocked', status_type: 'blocked' }),
    });
    expect((await POST(req, ctx())).status).toBe(201);

    const insertCall = fake.calls.find((c) => c.table === 'task_statuses' && c.method === 'insert');
    expect((insertCall?.args[0] as { position: number }).position).toBe(4);
  });

  it('starts at position 0 for the first status of a team', async () => {
    const fake = createFakeSupabaseAdmin({
      task_statuses: [{ data: null }, { data: { status_id: 'new-s', position: 0 } }],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}/statuses`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Todo', status_type: 'todo' }),
    });
    expect((await POST(req, ctx())).status).toBe(201);

    const insertCall = fake.calls.find((c) => c.table === 'task_statuses' && c.method === 'insert');
    expect((insertCall?.args[0] as { position: number }).position).toBe(0);
  });
});
