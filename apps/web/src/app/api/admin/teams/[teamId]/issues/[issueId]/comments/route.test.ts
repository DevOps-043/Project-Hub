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

function ctx() {
  return { params: Promise.resolve({ teamId: 't1', issueId: 'i1' }) };
}

beforeEach(() => {
  state.from.mockReset();
});

describe('GET /api/admin/teams/[teamId]/issues/[issueId]/comments', () => {
  it('rejects with 401 when unauthenticated', async () => {
    const req = new NextRequest('https://app.example.com/x');
    expect((await GET(req, ctx())).status).toBe(401);
  });

  it('returns non-deleted comments in chronological order', async () => {
    const fake = createFakeSupabaseAdmin({ task_issue_comments: [{ data: [{ comment_id: 'c1', body: 'Hi' }] }] });
    state.from.mockImplementation(fake.from);
    const json = await (await GET(await adminRequest('https://app.example.com/x'), ctx())).json();
    expect(json.comments).toHaveLength(1);
  });
});

describe('POST /api/admin/teams/[teamId]/issues/[issueId]/comments', () => {
  it('rejects with 400 for empty/whitespace-only content', async () => {
    const req = await adminRequest('https://app.example.com/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: '   ' }),
    });
    expect((await POST(req, ctx())).status).toBe(400);
  });

  it('creates the comment with author_id from the token and logs it to history', async () => {
    const fake = createFakeSupabaseAdmin({
      task_issue_comments: [{ data: { comment_id: 'new-c1', body: 'Hello' } }],
      task_issue_history: [{ data: null }],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest('https://app.example.com/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'Hello' }),
    });
    const res = await POST(req, ctx());
    expect(res.status).toBe(201);

    const insertCall = fake.calls.find((c) => c.table === 'task_issue_comments' && c.method === 'insert');
    expect((insertCall?.args[0] as { author_id: string }).author_id).toBe('admin-1');

    const historyInsert = fake.calls.find((c) => c.table === 'task_issue_history' && c.method === 'insert');
    expect(historyInsert).toBeTruthy();
  });

  it('returns 500 when the insert fails', async () => {
    const fake = createFakeSupabaseAdmin({
      task_issue_comments: [{ data: null, error: { message: 'db down' } }],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest('https://app.example.com/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'Hello' }),
    });
    expect((await POST(req, ctx())).status).toBe(500);
  });
});
