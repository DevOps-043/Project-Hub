import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabaseAdmin } from '@/lib/supabase/test-utils';
import { generateTokenPair } from '@/lib/auth/jwt';
import type { AccountUser } from '@/lib/supabase/server';

const state = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: () => ({ from: (...args: unknown[]) => state.from(...args) }),
}));

import { GET, PUT, DELETE } from './route';

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

function ctx() {
  return { params: Promise.resolve({ teamId: TEAM_UUID }) };
}

beforeEach(() => {
  state.from.mockReset();
});

describe('GET /api/admin/teams/[teamId]', () => {
  it('rejects with 401 when unauthenticated', async () => {
    const req = new NextRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}`);
    expect((await GET(req, ctx())).status).toBe(401);
  });

  it('returns 404 when the team does not exist', async () => {
    const fake = createFakeSupabaseAdmin({ teams: [{ data: null, error: { message: 'not found' } }] });
    state.from.mockImplementation(fake.from);
    const req = await adminRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}`);
    expect((await GET(req, ctx())).status).toBe(404);
  });

  it('maps team + owner + members to the camelCase API shape', async () => {
    const fake = createFakeSupabaseAdmin({
      teams: [{
        data: {
          team_id: TEAM_UUID,
          name: 'Core',
          slug: 'core',
          owner: { user_id: 'o1', display_name: 'Owner', first_name: 'O', last_name_paternal: 'N', email: 'o@x.com', avatar_url: null },
          team_members: [
            { member_id: 'm1', role: 'member', joined_at: '2026-01-01', is_active: true, user: { user_id: 'u1', display_name: 'Member', first_name: 'M', last_name_paternal: 'N', email: 'm@x.com', avatar_url: null, permission_level: 'user' } },
          ],
        },
      }],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}`);
    const json = await (await GET(req, ctx())).json();
    expect(json.owner.name).toBe('Owner');
    expect(json.memberCount).toBe(1);
    expect(json.members[0].user.name).toBe('Member');
  });
});

describe('PUT /api/admin/teams/[teamId]', () => {
  it('regenerates the slug when the name changes', async () => {
    const fake = createFakeSupabaseAdmin({ teams: [{ data: null }] });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'New Team Name!' }),
    });
    expect((await PUT(req, ctx())).status).toBe(200);

    const updateCall = fake.calls.find((c) => c.table === 'teams' && c.method === 'update');
    const updated = updateCall?.args[0] as { name: string; slug: string };
    expect(updated.name).toBe('New Team Name!');
    expect(updated.slug).toBe('new-team-name');
  });

  it('returns 500 when the update fails', async () => {
    const fake = createFakeSupabaseAdmin({ teams: [{ data: null, error: { message: 'db down' } }] });
    state.from.mockImplementation(fake.from);
    const req = await adminRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ description: 'x' }),
    });
    expect((await PUT(req, ctx())).status).toBe(500);
  });
});

describe('DELETE /api/admin/teams/[teamId]', () => {
  it('deletes the team on success', async () => {
    const fake = createFakeSupabaseAdmin({ teams: [{ data: null }] });
    state.from.mockImplementation(fake.from);
    const req = await adminRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}`, { method: 'DELETE' });
    expect((await DELETE(req, ctx())).status).toBe(200);
    expect(fake.calls.some((c) => c.table === 'teams' && c.method === 'delete')).toBe(true);
  });

  it('returns 500 when the delete fails', async () => {
    const fake = createFakeSupabaseAdmin({ teams: [{ data: null, error: { message: 'fk violation' } }] });
    state.from.mockImplementation(fake.from);
    const req = await adminRequest(`https://app.example.com/api/admin/teams/${TEAM_UUID}`, { method: 'DELETE' });
    expect((await DELETE(req, ctx())).status).toBe(500);
  });
});
