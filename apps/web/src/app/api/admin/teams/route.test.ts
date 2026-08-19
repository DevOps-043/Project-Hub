import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabaseAdmin } from '@/lib/supabase/test-utils';
import { generateTokenPair } from '@/lib/auth/jwt';
import type { AccountUser } from '@/lib/supabase/server';

const state = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: () => ({ from: (...args: unknown[]) => state.from(...args) }),
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

beforeEach(() => {
  state.from.mockReset();
});

describe('GET /api/admin/teams', () => {
  it('rejects with 401 when unauthenticated', async () => {
    expect((await GET(new NextRequest('https://app.example.com/api/admin/teams'))).status).toBe(401);
  });

  it('rejects with 403 for a non-admin user', async () => {
    const { accessToken } = await generateTokenPair(makeAdminUser({ permission_level: 'user' }));
    const req = new NextRequest('https://app.example.com/api/admin/teams', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect((await GET(req)).status).toBe(403);
  });

  it('maps owner and member count correctly for the happy path', async () => {
    const team = {
      team_id: 't1',
      name: 'Core',
      slug: 'core',
      status: 'active',
      visibility: 'private',
      owner: { user_id: 'u1', display_name: 'Owner Name', first_name: 'O', last_name_paternal: 'N', email: 'o@x.com', avatar_url: null },
      team_members: [{ count: 3 }],
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    };
    const fake = createFakeSupabaseAdmin({ teams: [{ data: [team] }] });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest('https://app.example.com/api/admin/teams');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.teams[0].memberCount).toBe(3);
    expect(json.teams[0].owner.name).toBe('Owner Name');
  });

  it('returns 500 when the query fails', async () => {
    const fake = createFakeSupabaseAdmin({ teams: [{ data: null, error: { message: 'db down' } }] });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest('https://app.example.com/api/admin/teams');
    expect((await GET(req)).status).toBe(500);
  });
});

describe('POST /api/admin/teams', () => {
  it('rejects with 400 when name or ownerId is missing', async () => {
    const req = await adminRequest('https://app.example.com/api/admin/teams', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Core Team' }),
    });
    expect((await POST(req)).status).toBe(400);
  });

  it('generates a URL-safe slug from the team name and adds the owner as a team_members row', async () => {
    const fake = createFakeSupabaseAdmin({
      teams: [{ data: { team_id: 'new-t1', name: 'Core Team!', slug: 'core-team' } }],
      team_members: [{ data: null }],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest('https://app.example.com/api/admin/teams', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Core Team!', ownerId: 'owner-1' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);

    const insertCall = fake.calls.find((c) => c.table === 'teams' && c.method === 'insert');
    const inserted = insertCall?.args[0] as { slug: string };
    expect(inserted.slug).toBe('core-team');

    const memberInsert = fake.calls.find((c) => c.table === 'team_members' && c.method === 'insert');
    const memberFields = memberInsert?.args[0] as { role: string; user_id: string };
    expect(memberFields.role).toBe('owner');
    expect(memberFields.user_id).toBe('owner-1');
  });

  it('returns 500 without creating a dangling team_members row when the team insert fails', async () => {
    const fake = createFakeSupabaseAdmin({
      teams: [{ data: null, error: { message: 'unique violation' } }],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest('https://app.example.com/api/admin/teams', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Core Team', ownerId: 'owner-1' }),
    });
    expect((await POST(req)).status).toBe(500);
    expect(fake.calls.some((c) => c.table === 'team_members')).toBe(false);
  });
});
