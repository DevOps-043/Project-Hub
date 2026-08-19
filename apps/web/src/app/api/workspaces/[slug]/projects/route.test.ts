import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabaseAdmin } from '@/lib/supabase/test-utils';
import { generateTokenPair } from '@/lib/auth/jwt';
import type { AccountUser } from '@/lib/supabase/server';

const state = vi.hoisted(() => ({
  from: vi.fn(),
  getWorkspaceBySlug: vi.fn(),
  getUserWorkspaceRole: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: () => ({ from: (...args: unknown[]) => state.from(...args) }),
}));

vi.mock('@/lib/services/workspace-service', () => ({
  getWorkspaceBySlug: (...args: unknown[]) => state.getWorkspaceBySlug(...args),
  getUserWorkspaceRole: (...args: unknown[]) => state.getUserWorkspaceRole(...args),
}));

import { GET, POST } from './route';

const WORKSPACE = { workspace_id: 'ws-1', slug: 'acme', name: 'Acme' };

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

async function memberRequest(url: string, init: SimpleRequestInit = {}) {
  const { accessToken } = await generateTokenPair(makeUser());
  return new NextRequest(url, {
    ...init,
    headers: { ...(init.headers || {}), authorization: `Bearer ${accessToken}` },
  });
}

function ctx() {
  return { params: Promise.resolve({ slug: 'acme' }) };
}

beforeEach(() => {
  state.from.mockReset();
  state.getWorkspaceBySlug.mockReset();
  state.getUserWorkspaceRole.mockReset();
  state.getWorkspaceBySlug.mockResolvedValue(WORKSPACE);
});

describe('GET /api/workspaces/[slug]/projects', () => {
  it('rejects with 401 when there is no token', async () => {
    const req = new NextRequest('https://app.example.com/api/workspaces/acme/projects');
    expect((await GET(req, ctx())).status).toBe(401);
  });

  it('returns 404 when the workspace does not exist', async () => {
    state.getWorkspaceBySlug.mockResolvedValue(null);
    const req = await memberRequest('https://app.example.com/api/workspaces/acme/projects');
    expect((await GET(req, ctx())).status).toBe(404);
  });

  it('rejects with 403 when the user is not a member of the workspace', async () => {
    state.getUserWorkspaceRole.mockResolvedValue(null);
    const req = await memberRequest('https://app.example.com/api/workspaces/acme/projects');
    expect((await GET(req, ctx())).status).toBe(403);
  });

  // Authorization boundary: a plain 'member' must only see projects scoped
  // to their teams/direct membership/lead/creator — never a full workspace scan.
  it('scopes the query for a non-admin member (checks team_members and pm_project_members)', async () => {
    state.getUserWorkspaceRole.mockResolvedValue({ iris_role: 'member' });
    const fake = createFakeSupabaseAdmin({
      team_members: [{ data: [{ team_id: 't1' }] }],
      pm_project_members: [{ data: [{ project_id: 'p1' }] }],
      pm_projects: [{ data: [] }],
      task_issues: [{ data: [] }],
    });
    state.from.mockImplementation(fake.from);

    const req = await memberRequest('https://app.example.com/api/workspaces/acme/projects');
    const res = await GET(req, ctx());
    expect(res.status).toBe(200);

    expect(fake.calls.some((c) => c.table === 'team_members' && c.method === 'select')).toBe(true);
    expect(fake.calls.some((c) => c.table === 'pm_project_members' && c.method === 'select')).toBe(true);
  });

  // Authorization boundary: owner/admin see the full workspace without the
  // team/membership pre-filter queries.
  it('does not run the membership-scoping queries for an owner/admin', async () => {
    state.getUserWorkspaceRole.mockResolvedValue({ iris_role: 'admin' });
    const fake = createFakeSupabaseAdmin({
      pm_projects: [{ data: [] }],
      task_issues: [{ data: [] }],
    });
    state.from.mockImplementation(fake.from);

    const req = await memberRequest('https://app.example.com/api/workspaces/acme/projects');
    const res = await GET(req, ctx());
    expect(res.status).toBe(200);

    expect(fake.calls.some((c) => c.table === 'team_members')).toBe(false);
    expect(fake.calls.some((c) => c.table === 'pm_project_members')).toBe(false);
  });

  it('computes completion_percentage from non-cancelled issue counts', async () => {
    state.getUserWorkspaceRole.mockResolvedValue({ iris_role: 'admin' });
    const fake = createFakeSupabaseAdmin({
      pm_projects: [{ data: [{ project_id: 'p1', completion_percentage: 0 }] }],
      task_issues: [{
        data: [
          { project_id: 'p1', status_id: 's1', task_statuses: { status_type: 'done' } },
          { project_id: 'p1', status_id: 's2', task_statuses: { status_type: 'todo' } },
          { project_id: 'p1', status_id: 's3', task_statuses: { status_type: 'cancelled' } },
        ],
      }],
    });
    state.from.mockImplementation(fake.from);

    const req = await memberRequest('https://app.example.com/api/workspaces/acme/projects');
    const json = await (await GET(req, ctx())).json();
    // 1 done out of 2 effective (3 total - 1 cancelled) = 50%.
    expect(json.projects[0].completion_percentage).toBe(50);
  });
});

describe('POST /api/workspaces/[slug]/projects', () => {
  it('rejects with 403 for a plain member (not owner/admin/manager/leader)', async () => {
    state.getUserWorkspaceRole.mockResolvedValue({ iris_role: 'member' });
    const req = await memberRequest('https://app.example.com/api/workspaces/acme/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project_name: 'Alpha' }),
    });
    expect((await POST(req, ctx())).status).toBe(403);
  });

  it('rejects with 400 when project_name is missing', async () => {
    state.getUserWorkspaceRole.mockResolvedValue({ iris_role: 'admin' });
    const req = await memberRequest('https://app.example.com/api/workspaces/acme/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect((await POST(req, ctx())).status).toBe(400);
  });

  it('creates the project scoped to the resolved workspace_id and adds the creator as owner', async () => {
    state.getUserWorkspaceRole.mockResolvedValue({ iris_role: 'leader' });
    const fake = createFakeSupabaseAdmin({
      pm_projects: [{ data: null }, { data: { project_id: 'new-p1', project_name: 'Alpha' } }],
      pm_project_members: [{ data: null }],
    });
    state.from.mockImplementation(fake.from);

    const req = await memberRequest('https://app.example.com/api/workspaces/acme/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project_name: 'Alpha' }),
    });
    expect((await POST(req, ctx())).status).toBe(201);

    const insertCall = fake.calls.find((c) => c.table === 'pm_projects' && c.method === 'insert');
    const inserted = insertCall?.args[0] as { workspace_id: string };
    expect(inserted.workspace_id).toBe('ws-1');
  });
});
