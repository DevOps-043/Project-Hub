import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabaseAdmin } from '@/lib/supabase/test-utils';
import { generateTokenPair } from '@/lib/auth/jwt';
import type { AccountUser } from '@/lib/supabase/server';

const state = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => state.from(...args) },
}));

import { GET, PATCH, DELETE } from './route';

const TEAM_UUID = '11111111-1111-1111-1111-111111111111';
const CYCLE_ID = 'cycle-1';

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
  return { params: Promise.resolve({ teamId: TEAM_UUID, cycleId: CYCLE_ID }) };
}

beforeEach(() => {
  state.from.mockReset();
});

describe('GET /api/admin/teams/[teamId]/cycles/[cycleId]', () => {
  it('rejects with 401 when unauthenticated', async () => {
    const req = new NextRequest('https://app.example.com/x');
    expect((await GET(req, ctx())).status).toBe(401);
  });

  it('returns 404 when the cycle is not found', async () => {
    const fake = createFakeSupabaseAdmin({ task_cycles: [{ data: null }] });
    state.from.mockImplementation(fake.from);
    const req = await adminRequest('https://app.example.com/x');
    expect((await GET(req, ctx())).status).toBe(404);
  });

  it('computes progress stats from the issues in the cycle', async () => {
    const fake = createFakeSupabaseAdmin({
      task_cycles: [{ data: { cycle_id: CYCLE_ID, name: 'Sprint 1' } }],
      task_issues: [{
        data: [
          { issue_id: 'i1', completed_at: '2026-01-01' },
          { issue_id: 'i2', completed_at: null },
          { issue_id: 'i3', completed_at: '2026-01-02' },
        ],
      }],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest('https://app.example.com/x');
    const json = await (await GET(req, ctx())).json();
    expect(json.cycle.scope_count).toBe(3);
    expect(json.cycle.completed_count).toBe(2);
    expect(json.cycle.progress_percent).toBe(67);
  });
});

describe('PATCH /api/admin/teams/[teamId]/cycles/[cycleId]', () => {
  it('sets completed_at automatically when status changes to completed', async () => {
    const fake = createFakeSupabaseAdmin({
      task_cycles: [{ data: { cycle_id: CYCLE_ID, status: 'completed' } }],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest('https://app.example.com/x', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    expect((await PATCH(req, ctx())).status).toBe(200);

    const updateCall = fake.calls.find((c) => c.table === 'task_cycles' && c.method === 'update');
    const updated = updateCall?.args[0] as { completed_at?: string };
    expect(updated.completed_at).toBeTruthy();
  });

  it('returns 500 when the update fails', async () => {
    const fake = createFakeSupabaseAdmin({
      task_cycles: [{ data: null, error: { message: 'db down' } }],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest('https://app.example.com/x', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Renamed' }),
    });
    expect((await PATCH(req, ctx())).status).toBe(500);
  });
});

describe('DELETE /api/admin/teams/[teamId]/cycles/[cycleId]', () => {
  it('unlinks issues from the cycle before deleting it', async () => {
    const fake = createFakeSupabaseAdmin({
      task_issues: [{ data: null }],
      task_cycles: [{ data: null, error: null }],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest('https://app.example.com/x', { method: 'DELETE' });
    const res = await DELETE(req, ctx());
    expect(res.status).toBe(200);

    const issuesUpdate = fake.calls.find((c) => c.table === 'task_issues' && c.method === 'update');
    expect((issuesUpdate?.args[0] as { cycle_id: null }).cycle_id).toBeNull();
    expect(fake.calls.some((c) => c.table === 'task_cycles' && c.method === 'delete')).toBe(true);
  });

  it('returns 500 when the delete fails', async () => {
    const fake = createFakeSupabaseAdmin({
      task_issues: [{ data: null }],
      task_cycles: [{ data: null, error: { message: 'fk violation' } }],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest('https://app.example.com/x', { method: 'DELETE' });
    expect((await DELETE(req, ctx())).status).toBe(500);
  });
});
