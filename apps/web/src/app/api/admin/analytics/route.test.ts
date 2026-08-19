import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabaseAdmin } from '@/lib/supabase/test-utils';
import { generateTokenPair } from '@/lib/auth/jwt';
import type { AccountUser } from '@/lib/supabase/server';

const state = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => state.from(...args) },
}));

import { GET } from './route';

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

async function adminRequest() {
  const { accessToken } = await generateTokenPair(makeAdminUser());
  return new NextRequest('https://app.example.com/api/admin/analytics', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
}

beforeEach(() => {
  state.from.mockReset();
});

describe('GET /api/admin/analytics', () => {
  it('rejects with 401 when unauthenticated', async () => {
    expect((await GET(new NextRequest('https://app.example.com/api/admin/analytics'))).status).toBe(401);
  });

  it('returns mock data when there are no tasks or projects yet', async () => {
    const fake = createFakeSupabaseAdmin({
      task_issues: [{ data: [] }],
      task_statuses: [{ data: [] }],
      pm_projects: [{ data: [] }],
      aria_usage_logs: [{ data: [] }],
    });
    state.from.mockImplementation(fake.from);

    const json = await (await GET(await adminRequest())).json();
    expect(json.isMock).toBe(true);
  });

  it('computes real task distribution and heatmap when data exists', async () => {
    const fake = createFakeSupabaseAdmin({
      task_issues: [{
        data: [
          { status_id: 's1', completed_at: '2026-01-01', assignee_id: 'u1', issue_id: 'i1', created_at: '2026-01-01' },
          { status_id: 's2', completed_at: null, assignee_id: 'u1', issue_id: 'i2', created_at: '2026-01-01' },
        ],
      }],
      task_statuses: [{
        data: [
          { status_id: 's1', status_type: 'done', name: 'Done', color: '#10B981' },
          { status_id: 's2', status_type: 'todo', name: 'Todo', color: '#F59E0B' },
        ],
      }],
      pm_projects: [{ data: [{ project_status: 'active', project_id: 'p1' }] }],
      aria_usage_logs: [{ data: [] }],
      account_users: [{ data: [{ user_id: 'u1', first_name: 'Fer', last_name_paternal: 'S', email: 'fer@x.com', avatar_url: null }] }],
    });
    state.from.mockImplementation(fake.from);

    const json = await (await GET(await adminRequest())).json();
    expect(json.isMock).toBeUndefined();
    expect(json.tasks.total).toBe(2);
    expect(json.tasks.distribution.find((d: { name: string }) => d.name === 'Completadas')?.value).toBe(1);
    expect(json.leaderboard[0].user.full_name).toBe('Fer S');
  });

  it('does not crash when the aria_usage_logs table is missing (caught internally)', async () => {
    const fake = createFakeSupabaseAdmin({
      task_issues: [{ data: [{ status_id: 's1', completed_at: null, assignee_id: null, issue_id: 'i1', created_at: '2026-01-01' }] }],
      task_statuses: [{ data: [{ status_id: 's1', status_type: 'todo', name: 'Todo', color: '#F59E0B' }] }],
      pm_projects: [{ data: [] }],
      aria_usage_logs: [{ data: null, error: { message: 'relation does not exist' } }],
    });
    state.from.mockImplementation(fake.from);

    const res = await GET(await adminRequest());
    expect(res.status).toBe(200);
  });
});
