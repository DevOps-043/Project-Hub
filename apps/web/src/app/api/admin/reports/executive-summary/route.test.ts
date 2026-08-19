import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  return new NextRequest('https://app.example.com/api/admin/reports/executive-summary', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
}

beforeEach(() => {
  state.from.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-15T12:00:00Z')); // a Monday, mid-month
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GET /api/admin/reports/executive-summary', () => {
  it('rejects with 401 when unauthenticated', async () => {
    const req = new NextRequest('https://app.example.com/api/admin/reports/executive-summary');
    expect((await GET(req)).status).toBe(401);
  });

  it('flags a project as at-risk when its target date has passed and it is not completed', async () => {
    const fake = createFakeSupabaseAdmin({
      pm_projects: [{
        data: [
          { project_id: 'p1', project_name: 'Overdue Project', project_status: 'in_progress', created_at: '2026-01-01', target_end_date: '2026-05-01' },
          { project_id: 'p2', project_name: 'On Time Project', project_status: 'in_progress', created_at: '2026-01-01', target_end_date: '2026-12-01' },
        ],
        count: 2,
      }],
    });
    state.from.mockImplementation(fake.from);

    const json = await (await GET(await adminRequest())).json();
    expect(json.projects.atRisk).toBe(1);
    expect(json.projects.atRiskList[0].name).toBe('Overdue Project');
  });

  it('computes completion rate and overdue tasks from the issues list', async () => {
    const fake = createFakeSupabaseAdmin({
      pm_projects: [{ data: [], count: 0 }],
      task_issues: [{
        data: [
          { issue_id: 'i1', title: 'Done task', status_id: 's1', priority_id: null, assignee_id: 'u1', created_at: '2026-06-01', completed_at: '2026-06-10', due_date: '2026-06-05', priority: null },
          { issue_id: 'i2', title: 'Overdue task', status_id: 's2', priority_id: null, assignee_id: 'u1', created_at: '2026-06-01', completed_at: null, due_date: '2026-06-10', priority: null },
        ],
        count: 2,
      }],
    });
    state.from.mockImplementation(fake.from);

    const json = await (await GET(await adminRequest())).json();
    expect(json.tasks.total).toBe(2);
    expect(json.tasks.completed).toBe(1);
    expect(json.tasks.completionRate).toBe(50);
    expect(json.tasks.overdue).toBe(1);
    expect(json.tasks.overdueList[0].title).toBe('Overdue task');
  });

  it('ranks top contributors by completed-this-month count', async () => {
    const fake = createFakeSupabaseAdmin({
      pm_projects: [{ data: [], count: 0 }],
      task_issues: [{
        data: [
          { issue_id: 'i1', title: 'A', status_id: 's1', priority_id: null, assignee_id: 'u1', created_at: '2026-06-01', completed_at: '2026-06-05', due_date: null, priority: null },
          { issue_id: 'i2', title: 'B', status_id: 's1', priority_id: null, assignee_id: 'u1', created_at: '2026-06-01', completed_at: '2026-06-06', due_date: null, priority: null },
          { issue_id: 'i3', title: 'C', status_id: 's1', priority_id: null, assignee_id: 'u2', created_at: '2026-06-01', completed_at: '2026-06-07', due_date: null, priority: null },
        ],
        count: 3,
      }],
      account_users: [{
        data: [
          { user_id: 'u1', first_name: 'Fer', last_name_paternal: 'S', display_name: null },
          { user_id: 'u2', first_name: 'Ana', last_name_paternal: 'G', display_name: null },
        ],
      }],
    });
    state.from.mockImplementation(fake.from);

    const json = await (await GET(await adminRequest())).json();
    expect(json.topContributors[0]).toMatchObject({ user_id: 'u1', completed: 2 });
  });

  it('marks risk level as Alto when there are many at-risk projects or overdue tasks', async () => {
    const overdueTasks = Array.from({ length: 11 }, (_, i) => ({
      issue_id: `i${i}`, title: `Task ${i}`, status_id: 's1', priority_id: null, assignee_id: null,
      created_at: '2026-06-01', completed_at: null, due_date: '2026-06-01', priority: null,
    }));
    const fake = createFakeSupabaseAdmin({
      pm_projects: [{ data: [], count: 0 }],
      task_issues: [{ data: overdueTasks, count: overdueTasks.length }],
    });
    state.from.mockImplementation(fake.from);

    const json = await (await GET(await adminRequest())).json();
    expect(json.riskAnalysis.level).toBe('Alto');
  });
});
