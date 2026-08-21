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

describe('GET /api/admin/teams/[teamId]/members', () => {
  it('rejects with 401 when unauthenticated', async () => {
    const req = new NextRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}/members`);
    expect((await GET(req, ctx())).status).toBe(401);
  });

  it('returns 404 when the team does not exist', async () => {
    const fake = createFakeSupabaseAdmin({ teams: [{ data: null, error: { message: 'not found' } }] });
    state.from.mockImplementation(fake.from);
    const req = await adminRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}/members`);
    expect((await GET(req, ctx())).status).toBe(404);
  });

  it('aggregates task counts per member and marks recently-active users as online', async () => {
    const recentlyActive = new Date(Date.now() - 60_000).toISOString(); // 1 min ago
    const longInactive = new Date(Date.now() - 2 * 60 * 60_000).toISOString(); // 2h ago
    const fake = createFakeSupabaseAdmin({
      teams: [{ data: { team_id: TEAM_UUID, name: 'Core', color: '#00D4B3' } }],
      team_members: [{
        data: [
          { user_id: 'u1', role: 'owner', joined_at: '2026-01-01' },
          { user_id: 'u2', role: 'member', joined_at: '2026-01-01' },
        ],
      }],
      account_users: [{
        data: [
          { user_id: 'u1', first_name: 'A', last_name_paternal: 'B', display_name: null, email: 'a@x.com', avatar_url: null, last_activity_at: recentlyActive, account_status: 'active' },
          { user_id: 'u2', first_name: 'C', last_name_paternal: 'D', display_name: null, email: 'c@x.com', avatar_url: null, last_activity_at: longInactive, account_status: 'active' },
        ],
      }],
      task_issues: [{
        data: [
          { assignee_id: 'u1', status_id: 's1', task_statuses: { status_type: 'done' } },
          { assignee_id: 'u1', status_id: 's2', task_statuses: { status_type: 'todo' } },
        ],
      }],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}/members`);
    const res = await GET(req, ctx());
    expect(res.status).toBe(200);

    const json = await res.json();
    const u1 = json.members.find((m: { user_id: string }) => m.user_id === 'u1');
    const u2 = json.members.find((m: { user_id: string }) => m.user_id === 'u2');

    expect(u1.tasks_count).toBe(2);
    expect(u1.completed_tasks_count).toBe(1);
    expect(u1.status).toBe('active');

    expect(u2.tasks_count).toBe(0);
    expect(u2.status).toBe('offline');
  });

  it('returns 500 when the members query fails', async () => {
    const fake = createFakeSupabaseAdmin({
      teams: [{ data: { team_id: TEAM_UUID, name: 'Core', color: '#00D4B3' } }],
      team_members: [{ data: null, error: { message: 'db down' } }],
    });
    state.from.mockImplementation(fake.from);
    const req = await adminRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}/members`);
    expect((await GET(req, ctx())).status).toBe(500);
  });
});

describe('POST /api/admin/teams/[teamId]/members', () => {
  it('rejects with 400 when user_id or role is missing', async () => {
    const req = await adminRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}/members`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user_id: 'u1' }),
    });
    expect((await POST(req, ctx())).status).toBe(400);
  });

  it('rejects with 409 when the user is already a member (unique violation)', async () => {
    const fake = createFakeSupabaseAdmin({
      team_members: [{ data: null, error: { code: '23505', message: 'duplicate key' } }],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}/members`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user_id: 'u1', role: 'member' }),
    });
    expect((await POST(req, ctx())).status).toBe(409);
  });

  it('adds the member on success', async () => {
    const fake = createFakeSupabaseAdmin({
      team_members: [{ data: { team_id: TEAM_UUID, user_id: 'u1', role: 'member' } }],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}/members`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user_id: 'u1', role: 'member' }),
    });
    const res = await POST(req, ctx());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
