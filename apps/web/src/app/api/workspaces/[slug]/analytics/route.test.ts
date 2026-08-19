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

// La caché en memoria es un singleton por proceso: si no se mockea, el
// segundo test reutilizaría el resultado cacheado del primero (misma
// workspace_id) y nunca tocaría los mocks de Supabase de ese test.
vi.mock('@/lib/cache/memory-cache', () => ({
  getMemoryCache: () => null,
  setMemoryCache: () => {},
  deleteMemoryCache: () => {},
}));

import { GET } from './route';

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

async function memberRequest() {
  const { accessToken } = await generateTokenPair(makeUser());
  return new NextRequest('https://app.example.com/api/workspaces/acme/analytics', {
    headers: { authorization: `Bearer ${accessToken}` },
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

describe('GET /api/workspaces/[slug]/analytics', () => {
  it('rejects with 401 when there is no token', async () => {
    const req = new NextRequest('https://app.example.com/api/workspaces/acme/analytics');
    expect((await GET(req, ctx())).status).toBe(401);
  });

  it('returns 403 when the user is not a member of the workspace', async () => {
    state.getUserWorkspaceRole.mockResolvedValue(null);
    expect((await GET(await memberRequest(), ctx())).status).toBe(403);
  });

  it('returns the empty-state payload when the workspace has no tasks, projects, or AI usage', async () => {
    state.getUserWorkspaceRole.mockResolvedValue({ iris_role: 'member' });
    const fake = createFakeSupabaseAdmin({
      teams: [{ data: [] }],
      pm_projects: [{ data: [] }],
      task_statuses: [{ data: [] }],
      workspace_members: [{ data: [] }],
    });
    state.from.mockImplementation(fake.from);

    const json = await (await GET(await memberRequest(), ctx())).json();
    expect(json.isEmpty).toBe(true);
    expect(json.summary.totalTasks).toBe(0);
  });

  it('computes summary/distribution/leaderboard from real project-scoped task data', async () => {
    state.getUserWorkspaceRole.mockResolvedValue({ iris_role: 'member' });
    const fake = createFakeSupabaseAdmin({
      teams: [{ data: [] }],
      pm_projects: [{ data: [{ project_id: 'p1', project_status: 'active', health_status: 'on_track' }] }],
      task_issues: [{
        data: [{
          status_id: 's1', completed_at: '2026-01-02T00:00:00Z', started_at: '2026-01-01T00:00:00Z',
          assignee_id: 'u1', issue_id: 'i1', created_at: '2026-01-01T00:00:00Z', cycle_id: null, estimate_points: 3,
        }],
      }],
      task_statuses: [{ data: [{ status_id: 's1', status_type: 'done', name: 'Done', color: '#10B981' }] }],
      workspace_members: [{ data: [{ user_id: 'u1' }] }],
      aria_usage_logs: [{ data: [] }],
      account_users: [{
        data: [{ user_id: 'u1', display_name: 'Fer S', first_name: 'Fer', last_name_paternal: 'S', email: 'fer@x.com', avatar_url: null }],
      }],
    });
    state.from.mockImplementation(fake.from);

    const json = await (await GET(await memberRequest(), ctx())).json();
    expect(json.summary.totalTasks).toBe(1);
    expect(json.summary.completionRate).toBe(100);
    expect(json.tasks.distribution.find((d: { name: string }) => d.name === 'Completadas')?.value).toBe(1);
    expect(json.leaderboard[0].user.full_name).toBe('Fer S');
    expect(json.leaderboard[0].count).toBe(1);
  });
});
