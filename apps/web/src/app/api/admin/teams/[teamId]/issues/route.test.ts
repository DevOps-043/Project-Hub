import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabaseAdmin } from '@/lib/supabase/test-utils';
import { generateTokenPair } from '@/lib/auth/jwt';
import type { AccountUser } from '@/lib/supabase/server';

/**
 * `task-status-service` ya tiene su propio archivo de test
 * (`lib/services/task-status-service.test.ts`) — aquí se mockea para aislar
 * la lógica propia de la ruta (resolución de filtros, agrupación,
 * construcción del identifier) de la lógica interna del servicio.
 */
const state = vi.hoisted(() => ({
  from: vi.fn(),
  resolveTeamId: vi.fn(),
  resolveTaskStatusId: vi.fn(),
  ensureDefaultTaskStatuses: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => state.from(...args) },
}));

vi.mock('@/lib/services/task-status-service', () => ({
  resolveTeamId: (...args: unknown[]) => state.resolveTeamId(...args),
  resolveTaskStatusId: (...args: unknown[]) => state.resolveTaskStatusId(...args),
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

function ctx(teamId: string) {
  return { params: Promise.resolve({ teamId }) };
}

beforeEach(() => {
  state.from.mockReset();
  state.resolveTeamId.mockReset();
  state.resolveTaskStatusId.mockReset();
  state.ensureDefaultTaskStatuses.mockReset();
  state.resolveTeamId.mockResolvedValue(TEAM_UUID);
  state.ensureDefaultTaskStatuses.mockResolvedValue([]);
});

describe('GET /api/admin/teams/[teamId]/issues', () => {
  it('rejects with 401 when unauthenticated', async () => {
    const req = new NextRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}/issues`);
    expect((await GET(req, ctx(TEAM_UUID))).status).toBe(401);
  });

  it('rejects with 403 for a non-admin user', async () => {
    const { accessToken } = await generateTokenPair(makeAdminUser({ permission_level: 'user' }));
    const req = new NextRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}/issues`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect((await GET(req, ctx(TEAM_UUID))).status).toBe(403);
  });

  it('returns 404 when the team cannot be resolved', async () => {
    state.resolveTeamId.mockResolvedValue(null);
    const fake = createFakeSupabaseAdmin({});
    state.from.mockImplementation(fake.from);

    const req = await adminRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}/issues`);
    expect((await GET(req, ctx(TEAM_UUID))).status).toBe(404);
  });

  it('lists issues, builds the TEAM-123 identifier, and groups by status', async () => {
    const fake = createFakeSupabaseAdmin({
      task_issues: [{ data: [{ issue_id: 'i1', issue_number: 7, status_id: 's1', labels: [] }] }],
      teams: [{ data: { slug: 'core', name: 'Core Team' } }],
      task_statuses: [{ data: [{ status_id: 's1', name: 'Todo', position: 1 }] }],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}/issues`);
    const res = await GET(req, ctx(TEAM_UUID));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.issues[0].identifier).toBe('CORE-7');
    expect(json.groupedIssues.s1.issues).toHaveLength(1);
    expect(json.statusCounts.s1).toBe(1);
  });

  it('returns 500 when the issues query fails', async () => {
    const fake = createFakeSupabaseAdmin({
      task_issues: [{ data: null, error: { message: 'db down' } }],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}/issues`);
    expect((await GET(req, ctx(TEAM_UUID))).status).toBe(500);
  });
});

describe('POST /api/admin/teams/[teamId]/issues', () => {
  function baseSetup(overrides: { creatorFound?: boolean; assigneeFound?: boolean } = {}) {
    const { creatorFound = true, assigneeFound = true } = overrides;
    state.resolveTaskStatusId.mockResolvedValue('status-1');
    const fake = createFakeSupabaseAdmin({
      account_users: [
        { data: creatorFound ? { user_id: 'admin-1' } : null },
        ...(assigneeFound !== undefined ? [{ data: assigneeFound ? { user_id: 'assignee-1' } : null }] : []),
      ],
      task_issues: [
        { data: { issue_number: 4 } }, // last issue number
        { data: { issue_id: 'new-i1', issue_number: 5 } }, // insert result
      ],
      teams: [{ data: { slug: 'core' } }],
    });
    state.from.mockImplementation(fake.from);
    return fake;
  }

  it('rejects with 401 when unauthenticated', async () => {
    const req = new NextRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}/issues`, { method: 'POST' });
    expect((await POST(req, ctx(TEAM_UUID))).status).toBe(401);
  });

  it('rejects with 400 when the title is missing or blank', async () => {
    baseSetup();
    const req = await adminRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}/issues`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '   ' }),
    });
    expect((await POST(req, ctx(TEAM_UUID))).status).toBe(400);
  });

  it('rejects with 400 when the team has no configured statuses', async () => {
    state.resolveTaskStatusId.mockResolvedValue(null);
    const fake = createFakeSupabaseAdmin({});
    state.from.mockImplementation(fake.from);

    const req = await adminRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}/issues`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Fix bug' }),
    });
    expect((await POST(req, ctx(TEAM_UUID))).status).toBe(400);
  });

  it('rejects with 409 when the JWT subject is not synced into account_users', async () => {
    baseSetup({ creatorFound: false });
    const req = await adminRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}/issues`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Fix bug' }),
    });
    expect((await POST(req, ctx(TEAM_UUID))).status).toBe(409);
  });

  it('creates the issue with incremented issue_number and the TEAM-N identifier', async () => {
    baseSetup({ assigneeFound: undefined as unknown as boolean });
    const req = await adminRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}/issues`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Fix bug' }),
    });
    const res = await POST(req, ctx(TEAM_UUID));
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.issue.identifier).toBe('CORE-5');
  });

  // Security/correctness invariant: assigning to a user that doesn't exist
  // in account_users yet must not crash the insert with an FK violation —
  // the route silently drops the invalid assignee instead.
  it('creates the issue unassigned when the given assignee_id does not exist in account_users', async () => {
    const fake = baseSetup({ assigneeFound: false });
    const req = await adminRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}/issues`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Fix bug', assignee_id: '22222222-2222-2222-2222-222222222222' }),
    });
    expect((await POST(req, ctx(TEAM_UUID))).status).toBe(201);

    const insertCall = fake.calls.find((c) => c.table === 'task_issues' && c.method === 'insert');
    const inserted = insertCall?.args[0] as { assignee_id: string | null };
    expect(inserted.assignee_id).toBeNull();
  });

  it('returns 500 with the DB error surfaced in `detail` when the insert fails', async () => {
    state.resolveTaskStatusId.mockResolvedValue('status-1');
    const fake = createFakeSupabaseAdmin({
      account_users: [{ data: { user_id: 'admin-1' } }],
      task_issues: [
        { data: { issue_number: 4 } },
        { data: null, error: { message: 'constraint violation', code: '23503', hint: null } },
      ],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}/issues`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Fix bug' }),
    });
    const res = await POST(req, ctx(TEAM_UUID));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.detail).toBe('constraint violation');
  });
});
