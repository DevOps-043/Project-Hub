import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabaseAdmin } from '@/lib/supabase/test-utils';
import { generateTokenPair } from '@/lib/auth/jwt';
import type { AccountUser } from '@/lib/supabase/server';

const state = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => state.from(...args) },
}));

import { GET, PUT, DELETE } from './route';

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

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

const TARGET_ID = 'target-user-1';

beforeEach(() => {
  state.from.mockReset();
});

describe('GET /api/admin/users/[id]', () => {
  it('rejects with 401 when unauthenticated', async () => {
    const req = new NextRequest(`https://app.example.com/api/admin/users/${TARGET_ID}`);
    expect((await GET(req, ctx(TARGET_ID))).status).toBe(401);
  });

  it('returns 404 when the user does not exist', async () => {
    const fake = createFakeSupabaseAdmin({ account_users: [{ data: null }] });
    state.from.mockImplementation(fake.from);
    const req = await adminRequest(`https://app.example.com/api/admin/users/${TARGET_ID}`);
    expect((await GET(req, ctx(TARGET_ID))).status).toBe(404);
  });

  it('maps the user row to the camelCase API shape', async () => {
    const fake = createFakeSupabaseAdmin({
      account_users: [{ data: { user_id: TARGET_ID, first_name: 'Fer', permission_level: 'user', account_status: 'active' } }],
    });
    state.from.mockImplementation(fake.from);
    const req = await adminRequest(`https://app.example.com/api/admin/users/${TARGET_ID}`);
    const json = await (await GET(req, ctx(TARGET_ID))).json();
    expect(json.firstName).toBe('Fer');
    expect(json.permissionLevel).toBe('user');
  });
});

describe('PUT /api/admin/users/[id]', () => {
  it('returns 404 when the target user does not exist', async () => {
    const fake = createFakeSupabaseAdmin({ account_users: [{ data: null }] });
    state.from.mockImplementation(fake.from);
    const req = await adminRequest(`https://app.example.com/api/admin/users/${TARGET_ID}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ firstName: 'New' }),
    });
    expect((await PUT(req, ctx(TARGET_ID))).status).toBe(404);
  });

  it('rejects with 409 when the new email is already used by a different user', async () => {
    const fake = createFakeSupabaseAdmin({
      account_users: [{ data: { user_id: TARGET_ID } }, { data: { user_id: 'someone-else' } }],
    });
    state.from.mockImplementation(fake.from);
    const req = await adminRequest(`https://app.example.com/api/admin/users/${TARGET_ID}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'taken@example.com' }),
    });
    expect((await PUT(req, ctx(TARGET_ID))).status).toBe(409);
  });

  it('rejects with 409 when the new username is already used by a different user', async () => {
    const fake = createFakeSupabaseAdmin({
      account_users: [{ data: { user_id: TARGET_ID } }, { data: { user_id: 'someone-else' } }],
    });
    state.from.mockImplementation(fake.from);
    const req = await adminRequest(`https://app.example.com/api/admin/users/${TARGET_ID}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'taken_username' }),
    });
    expect((await PUT(req, ctx(TARGET_ID))).status).toBe(409);
  });

  it('hashes a new password before persisting it and recomputes display_name', async () => {
    const fake = createFakeSupabaseAdmin({
      account_users: [
        { data: { user_id: TARGET_ID } }, // existence check
        { data: { first_name: 'Old', last_name_paternal: 'Name' } }, // currentUser lookup for display_name
        { data: { user_id: TARGET_ID, email: 'fer@example.com', display_name: 'Fernando Suarez', account_status: 'active' } }, // update result
      ],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest(`https://app.example.com/api/admin/users/${TARGET_ID}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ firstName: 'Fernando', lastNamePaternal: 'Suarez', password: 'NewPass1' }),
    });
    const res = await PUT(req, ctx(TARGET_ID));
    expect(res.status).toBe(200);

    const updateCall = fake.calls.find((c) => c.table === 'account_users' && c.method === 'update');
    const updated = updateCall?.args[0] as { password_hash?: string; display_name?: string };
    expect(updated.password_hash).toBeTruthy();
    expect(updated.password_hash).not.toBe('NewPass1');
    expect(updated.display_name).toBe('Fernando Suarez');
  });
});

describe('DELETE /api/admin/users/[id]', () => {
  it('returns 404 when the target user does not exist', async () => {
    const fake = createFakeSupabaseAdmin({ account_users: [{ data: null }] });
    state.from.mockImplementation(fake.from);
    const req = await adminRequest(`https://app.example.com/api/admin/users/${TARGET_ID}`, { method: 'DELETE' });
    expect((await DELETE(req, ctx(TARGET_ID))).status).toBe(404);
  });

  // Security invariant: no admin (even another super_admin) can delete a
  // super_admin account through this endpoint — must be done another way.
  it('rejects with 403 and never touches the row when the target is a super_admin', async () => {
    const fake = createFakeSupabaseAdmin({
      account_users: [{ data: { user_id: TARGET_ID, permission_level: 'super_admin' } }],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest(`https://app.example.com/api/admin/users/${TARGET_ID}`, { method: 'DELETE' });
    const res = await DELETE(req, ctx(TARGET_ID));
    expect(res.status).toBe(403);
    expect(fake.calls.some((c) => c.method === 'update')).toBe(false);
  });

  it('soft-deletes the account and revokes active sessions on success', async () => {
    const fake = createFakeSupabaseAdmin({
      account_users: [{ data: { user_id: TARGET_ID, permission_level: 'user' } }, { data: null }],
      auth_sessions: [{ data: null }],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest(`https://app.example.com/api/admin/users/${TARGET_ID}`, { method: 'DELETE' });
    const res = await DELETE(req, ctx(TARGET_ID));
    expect(res.status).toBe(200);

    const userUpdate = fake.calls.find((c) => c.table === 'account_users' && c.method === 'update');
    expect((userUpdate?.args[0] as { account_status: string }).account_status).toBe('deleted');

    const sessionUpdate = fake.calls.find((c) => c.table === 'auth_sessions' && c.method === 'update');
    expect((sessionUpdate?.args[0] as { is_revoked: boolean }).is_revoked).toBe(true);
  });
});
