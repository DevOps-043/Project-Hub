import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabaseAdmin } from '@/lib/supabase/test-utils';
import { generateTokenPair } from '@/lib/auth/jwt';
import type { AccountUser } from '@/lib/supabase/server';

const state = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => state.from(...args) },
}));

import { PATCH, DELETE } from './route';

const TEAM_UUID = '11111111-1111-1111-1111-111111111111';
const ISSUE_ID = 'issue-1';

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
  return { params: Promise.resolve({ teamId: TEAM_UUID, issueId: ISSUE_ID }) };
}

beforeEach(() => {
  state.from.mockReset();
});

describe('PATCH /api/admin/teams/[teamId]/issues/[issueId]', () => {
  it('rejects with 401 when unauthenticated', async () => {
    const req = new NextRequest('https://app.example.com/x', { method: 'PATCH' });
    expect((await PATCH(req, ctx())).status).toBe(401);
  });

  it('returns 404 when the issue does not exist for this team', async () => {
    const fake = createFakeSupabaseAdmin({ task_issues: [{ data: null }] });
    state.from.mockImplementation(fake.from);
    const req = await adminRequest('https://app.example.com/x', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'New title' }),
    });
    expect((await PATCH(req, ctx())).status).toBe(404);
  });

  it('records no history when the submitted fields match the current values', async () => {
    const currentIssue = { issue_id: ISSUE_ID, title: 'Same title', status_id: 's1' };
    const fake = createFakeSupabaseAdmin({
      task_issues: [{ data: currentIssue }, { data: { ...currentIssue } }],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest('https://app.example.com/x', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Same title' }),
    });
    expect((await PATCH(req, ctx())).status).toBe(200);
    expect(fake.calls.some((c) => c.table === 'task_issue_history')).toBe(false);
  });

  it('records a human-readable status-change history entry and sets completed_at when moving to a done status', async () => {
    const currentIssue = { issue_id: ISSUE_ID, title: 'Fix bug', status_id: 'status-old', started_at: null };
    const fake = createFakeSupabaseAdmin({
      task_issues: [{ data: currentIssue }, { data: { ...currentIssue, status_id: 'status-new' } }],
      task_statuses: [
        { data: { name: 'In Progress' } }, // old status name lookup
        { data: { name: 'Done' } }, // new status name lookup
        { data: { status_type: 'done' } }, // timestamp-handling lookup
      ],
      task_issue_history: [{ data: null }],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest('https://app.example.com/x', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status_id: 'status-new' }),
    });
    expect((await PATCH(req, ctx())).status).toBe(200);

    const historyInsert = fake.calls.find((c) => c.table === 'task_issue_history' && c.method === 'insert');
    const records = historyInsert?.args[0] as { field_name: string; old_value: string; new_value: string }[];
    expect(records[0]).toMatchObject({ field_name: 'status_id', old_value: 'In Progress', new_value: 'Done' });

    const updateCall = fake.calls.find((c) => c.table === 'task_issues' && c.method === 'update');
    const updated = updateCall?.args[0] as { completed_at?: string };
    expect(updated.completed_at).toBeTruthy();
  });

  it('replaces labels: deletes existing rows then inserts the new set', async () => {
    const currentIssue = { issue_id: ISSUE_ID, title: 'Fix bug' };
    const fake = createFakeSupabaseAdmin({
      task_issues: [{ data: currentIssue }, { data: currentIssue }],
      task_issue_labels: [{ data: null }, { data: null }],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest('https://app.example.com/x', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ labels: ['label-1', 'label-2'] }),
    });
    expect((await PATCH(req, ctx())).status).toBe(200);

    const labelCalls = fake.calls.filter((c) => c.table === 'task_issue_labels');
    expect(labelCalls.some((c) => c.method === 'delete')).toBe(true);
    const insertCall = labelCalls.find((c) => c.method === 'insert');
    expect((insertCall?.args[0] as unknown[])).toHaveLength(2);
  });

  it('returns 500 when the update itself fails', async () => {
    const currentIssue = { issue_id: ISSUE_ID, title: 'Fix bug' };
    const fake = createFakeSupabaseAdmin({
      task_issues: [{ data: currentIssue }, { data: null, error: { message: 'db down' } }],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest('https://app.example.com/x', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'New title' }),
    });
    expect((await PATCH(req, ctx())).status).toBe(500);
  });
});

describe('DELETE /api/admin/teams/[teamId]/issues/[issueId]', () => {
  it('rejects with 401 when unauthenticated', async () => {
    const req = new NextRequest('https://app.example.com/x', { method: 'DELETE' });
    expect((await DELETE(req, ctx())).status).toBe(401);
  });

  it('soft-archives the issue by setting archived_at', async () => {
    const fake = createFakeSupabaseAdmin({ task_issues: [{ data: null }] });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest('https://app.example.com/x', { method: 'DELETE' });
    const res = await DELETE(req, ctx());
    expect(res.status).toBe(200);

    const updateCall = fake.calls.find((c) => c.table === 'task_issues' && c.method === 'update');
    expect((updateCall?.args[0] as { archived_at?: string }).archived_at).toBeTruthy();
  });

  it('returns 500 when the archive update fails', async () => {
    const fake = createFakeSupabaseAdmin({ task_issues: [{ data: null, error: { message: 'db down' } }] });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest('https://app.example.com/x', { method: 'DELETE' });
    expect((await DELETE(req, ctx())).status).toBe(500);
  });
});
