import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabaseAdmin } from '@/lib/supabase/test-utils';
import { generateTokenPair } from '@/lib/auth/jwt';
import type { AccountUser } from '@/lib/supabase/server';

const state = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => state.from(...args) },
}));

import { GET, POST, PATCH } from './route';

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

async function extRequest(url: string, init: SimpleRequestInit = {}) {
  const { accessToken } = await generateTokenPair(makeUser());
  return new NextRequest(url, {
    ...init,
    headers: { ...(init.headers || {}), authorization: `Bearer ${accessToken}` },
  });
}

beforeEach(() => {
  state.from.mockReset();
});

describe('GET /api/ext/issues', () => {
  it('rejects with 401 when unauthenticated', async () => {
    const req = new NextRequest('https://app.example.com/api/ext/issues?project_id=p1');
    expect((await GET(req)).status).toBe(401);
  });

  it('rejects with 400 when project_id is missing', async () => {
    const req = await extRequest('https://app.example.com/api/ext/issues');
    expect((await GET(req)).status).toBe(400);
  });

  it('lists non-archived issues for the project', async () => {
    const fake = createFakeSupabaseAdmin({ task_issues: [{ data: [{ issue_id: 'i1' }] }] });
    state.from.mockImplementation(fake.from);
    const req = await extRequest('https://app.example.com/api/ext/issues?project_id=p1');
    const json = await (await GET(req)).json();
    expect(json.issues).toHaveLength(1);
  });
});

describe('POST /api/ext/issues', () => {
  it('rejects with 400 when project_id or title is missing', async () => {
    const req = await extRequest('https://app.example.com/api/ext/issues', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project_id: 'p1' }),
    });
    expect((await POST(req)).status).toBe(400);
  });

  it('assigns the next sequence_number and sets creator_id from the token', async () => {
    const fake = createFakeSupabaseAdmin({
      task_issues: [{ data: { sequence_number: 4 } }, { data: { issue_id: 'new-i1', sequence_number: 5 } }],
    });
    state.from.mockImplementation(fake.from);

    const req = await extRequest('https://app.example.com/api/ext/issues', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project_id: 'p1', title: 'Fix bug' }),
    });
    expect((await POST(req)).status).toBe(201);

    const insertCall = fake.calls.find((c) => c.table === 'task_issues' && c.method === 'insert');
    const inserted = insertCall?.args[0] as { sequence_number: number; creator_id: string };
    expect(inserted.sequence_number).toBe(5);
    expect(inserted.creator_id).toBe('user-1');
  });
});

describe('PATCH /api/ext/issues', () => {
  it('rejects with 400 when issue_id is missing', async () => {
    const req = await extRequest('https://app.example.com/api/ext/issues', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'New title' }),
    });
    expect((await PATCH(req)).status).toBe(400);
  });

  it('rejects with 400 when no allowed field is present', async () => {
    const req = await extRequest('https://app.example.com/api/ext/issues', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ issue_id: 'i1', some_unlisted_field: 'x' }),
    });
    expect((await PATCH(req)).status).toBe(400);
  });

  // Mass-assignment guard: fields outside the explicit allowlist (e.g. an
  // attacker trying to overwrite creator_id or project_id via PATCH) must
  // never reach the update payload.
  it('strips any field not in the allowlist before updating', async () => {
    const fake = createFakeSupabaseAdmin({ task_issues: [{ data: { issue_id: 'i1', title: 'New title' } }] });
    state.from.mockImplementation(fake.from);

    const req = await extRequest('https://app.example.com/api/ext/issues', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ issue_id: 'i1', title: 'New title', creator_id: 'attacker', project_id: 'other-project' }),
    });
    expect((await PATCH(req)).status).toBe(200);

    const updateCall = fake.calls.find((c) => c.table === 'task_issues' && c.method === 'update');
    const updated = updateCall?.args[0] as Record<string, unknown>;
    expect(updated.title).toBe('New title');
    expect(updated).not.toHaveProperty('creator_id');
    expect(updated).not.toHaveProperty('project_id');
  });
});
