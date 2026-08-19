import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { generateTokenPair } from '@/lib/auth/jwt';
import type { AccountUser } from '@/lib/supabase/server';

const state = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: () => ({ from: (...args: unknown[]) => state.from(...args) }),
}));

import { GET } from './route';

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

async function authedSearchRequest(query: string) {
  const { accessToken } = await generateTokenPair(makeUser());
  return new NextRequest(`https://app.example.com/api/search?q=${encodeURIComponent(query)}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
}

/** Chainable stub matching this route's exact call shape (.select/.or/.ilike/.limit, awaited directly). */
function chain(result: { data?: unknown[] | null; error?: unknown } | (() => Promise<never>)) {
  const builder: Record<string, unknown> = {};
  const methods = ['select', 'or', 'ilike', 'limit'];
  for (const m of methods) {
    builder[m] = () => builder;
  }
  builder.then = (onfulfilled: (v: unknown) => unknown, onrejected: (e: unknown) => unknown) => {
    if (typeof result === 'function') return result().then(onfulfilled, onrejected);
    return Promise.resolve({ data: result.data ?? [], error: result.error ?? null }).then(onfulfilled, onrejected);
  };
  return builder;
}

beforeEach(() => {
  state.from.mockReset();
});

// Regression test for the documented security fix: this route was public
// (no session required) and leaked user emails/names to anonymous callers.
describe('GET /api/search — requires auth (regression for the former public-search leak)', () => {
  it('rejects with 401 when unauthenticated', async () => {
    const req = new NextRequest('https://app.example.com/api/search?q=fer');
    expect((await GET(req)).status).toBe(401);
  });
});

describe('GET /api/search', () => {
  it('returns an empty array without touching the DB for a query shorter than 2 characters', async () => {
    const req = await authedSearchRequest('a');
    const json = await (await GET(req)).json();
    expect(json).toEqual([]);
    expect(state.from).not.toHaveBeenCalled();
  });

  it('combines teams, projects, tasks, and users into one result list', async () => {
    state.from.mockImplementation((table: string) => {
      if (table === 'teams') return chain({ data: [{ team_id: 't1', name: 'Core Team' }] });
      if (table === 'pm_projects') return chain({ data: [{ project_id: 'p1', project_name: 'Alpha', project_key: 'ALPH' }] });
      if (table === 'task_issues') return chain({ data: [{ issue_id: 'i1', title: 'Fix bug', issue_number: 7, project_id: 'p1' }] });
      if (table === 'account_users') return chain({ data: [{ user_id: 'u1', first_name: 'Fer', last_name_paternal: 'S', display_name: null, email: 'fer@x.com', avatar_url: null }] });
      return chain({ data: [] });
    });

    const req = await authedSearchRequest('fer');
    const json = await (await GET(req)).json();

    const types = json.map((r: { type: string }) => r.type);
    expect(types).toEqual(['team', 'project', 'task', 'user']);
  });

  // Resilience: Promise.allSettled means one table erroring must not blank out
  // results from the other three.
  it('still returns results from the other tables when one query rejects', async () => {
    state.from.mockImplementation((table: string) => {
      if (table === 'teams') return chain(() => Promise.reject(new Error('teams table down')));
      if (table === 'pm_projects') return chain({ data: [{ project_id: 'p1', project_name: 'Alpha', project_key: 'ALPH' }] });
      return chain({ data: [] });
    });

    const req = await authedSearchRequest('fer');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.some((r: { type: string }) => r.type === 'project')).toBe(true);
    expect(json.some((r: { type: string }) => r.type === 'team')).toBe(false);
  });

  it('still returns results from the other tables when one query returns a Supabase error object', async () => {
    state.from.mockImplementation((table: string) => {
      if (table === 'account_users') return chain({ data: null, error: { message: 'permission denied' } });
      if (table === 'teams') return chain({ data: [{ team_id: 't1', name: 'Core Team' }] });
      return chain({ data: [] });
    });

    const req = await authedSearchRequest('fer');
    const json = await (await GET(req)).json();
    expect(json.some((r: { type: string }) => r.type === 'team')).toBe(true);
    expect(json.some((r: { type: string }) => r.type === 'user')).toBe(false);
  });
});
