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

function ctx(teamId: string) {
  return { params: Promise.resolve({ teamId }) };
}

beforeEach(() => {
  state.from.mockReset();
});

describe('GET /api/admin/teams/[teamId]/cycles', () => {
  it('rejects with 401 when unauthenticated', async () => {
    const req = new NextRequest('https://app.example.com/api/admin/teams/t1/cycles');
    const res = await GET(req, ctx('t1'));
    expect(res.status).toBe(401);
  });

  it('rejects with 403 for a non-admin user', async () => {
    const { accessToken } = await generateTokenPair(makeAdminUser({ permission_level: 'user' }));
    const req = new NextRequest('https://app.example.com/api/admin/teams/t1/cycles', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const res = await GET(req, ctx('t1'));
    expect(res.status).toBe(403);
  });

  it('fetches cycles directly by UUID (no slug resolution) and returns them with computed stats', async () => {
    const teamUuid = '11111111-1111-1111-1111-111111111111';
    const fake = createFakeSupabaseAdmin({
      task_cycles: [{ data: [{ cycle_id: 'c1', team_id: teamUuid, name: 'Sprint 1' }] }],
      task_issues: [{ data: [{ cycle_id: 'c1', completed_at: '2026-01-01' }, { cycle_id: 'c1', completed_at: null }] }],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest(`https://app.example.com/api/admin/teams/${teamUuid}/cycles`);
    const res = await GET(req, ctx(teamUuid));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.cycles).toHaveLength(1);
    expect(json.cycles[0]).toMatchObject({ scope_count: 2, completed_count: 1, progress_percent: 50 });

    // Never touched `teams` — a UUID skips slug resolution entirely.
    expect(fake.calls.some((c) => c.table === 'teams')).toBe(false);
  });

  it('resolves a non-UUID teamId via the teams table before fetching cycles', async () => {
    const fake = createFakeSupabaseAdmin({
      teams: [{ data: { team_id: 'resolved-uuid' } }],
      task_cycles: [{ data: [] }],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest('https://app.example.com/api/admin/teams/my-team-slug/cycles');
    const res = await GET(req, ctx('my-team-slug'));
    expect(res.status).toBe(200);

    expect(fake.calls.some((c) => c.table === 'teams' && c.method === 'select')).toBe(true);
    const cyclesCall = fake.calls.find((c) => c.table === 'task_cycles');
    expect(cyclesCall).toBeTruthy();
  });

  it('returns 500 when the cycles query fails', async () => {
    const teamUuid = '11111111-1111-1111-1111-111111111111';
    const fake = createFakeSupabaseAdmin({
      task_cycles: [{ data: null, error: { message: 'db down' } }],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest(`https://app.example.com/api/admin/teams/${teamUuid}/cycles`);
    const res = await GET(req, ctx(teamUuid));
    expect(res.status).toBe(500);
  });
});

describe('POST /api/admin/teams/[teamId]/cycles', () => {
  it('rejects with 400 when required fields are missing', async () => {
    const req = await adminRequest('https://app.example.com/api/admin/teams/t1/cycles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Sprint 1' }),
    });
    const res = await POST(req, ctx('t1'));
    expect(res.status).toBe(400);
  });

  it('creates the first cycle for a team with cycle_number 1', async () => {
    const fake = createFakeSupabaseAdmin({
      task_cycles: [
        { data: null }, // no previous cycle
        { data: { cycle_id: 'new-c1', cycle_number: 1, name: 'Sprint 1', status: 'upcoming' } },
      ],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest('https://app.example.com/api/admin/teams/t1/cycles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Sprint 1',
        start_date: '2030-01-01',
        end_date: '2030-01-14',
      }),
    });
    const res = await POST(req, ctx('t1'));
    expect(res.status).toBe(201);

    const insertCall = fake.calls.find((c) => c.table === 'task_cycles' && c.method === 'insert');
    const inserted = insertCall?.args[0] as { cycle_number: number; status: string };
    expect(inserted.cycle_number).toBe(1);
    // Dates are in the future -> upcoming, not active/completed.
    expect(inserted.status).toBe('upcoming');
  });

  it('increments cycle_number from the last cycle and marks status active for a date range spanning today', async () => {
    const fake = createFakeSupabaseAdmin({
      task_cycles: [
        { data: { cycle_number: 4 } },
        { data: { cycle_id: 'new-c5', cycle_number: 5 } },
      ],
    });
    state.from.mockImplementation(fake.from);

    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

    const req = await adminRequest('https://app.example.com/api/admin/teams/t1/cycles', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Sprint 5', start_date: yesterday, end_date: tomorrow }),
    });
    const res = await POST(req, ctx('t1'));
    expect(res.status).toBe(201);

    const insertCall = fake.calls.find((c) => c.table === 'task_cycles' && c.method === 'insert');
    const inserted = insertCall?.args[0] as { cycle_number: number; status: string };
    expect(inserted.cycle_number).toBe(5);
    expect(inserted.status).toBe('active');
  });
});
