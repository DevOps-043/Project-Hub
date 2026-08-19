import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabaseAdmin } from '@/lib/supabase/test-utils';
import { generateTokenPair } from '@/lib/auth/jwt';
import type { AccountUser } from '@/lib/supabase/server';

const state = vi.hoisted(() => ({
  from: vi.fn(),
  getWorkspaceBySlug: vi.fn(),
  getUserWorkspaceRole: vi.fn(),
  updateMemberRole: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: () => ({ from: (...args: unknown[]) => state.from(...args) }),
}));

vi.mock('@/lib/services/workspace-service', () => ({
  getWorkspaceBySlug: (...args: unknown[]) => state.getWorkspaceBySlug(...args),
  getUserWorkspaceRole: (...args: unknown[]) => state.getUserWorkspaceRole(...args),
  getWorkspaceMembersPage: vi.fn(),
  syncAllOrgMembers: vi.fn(),
  updateMemberRole: (...args: unknown[]) => state.updateMemberRole(...args),
}));

import { PATCH } from './route';

const WORKSPACE = { workspace_id: 'ws-1', slug: 'acme', name: 'Acme' };

function makeUser(overrides: Partial<AccountUser> = {}): AccountUser {
  return {
    user_id: 'caller-1',
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

async function patchRequest(body: unknown) {
  const { accessToken } = await generateTokenPair(makeUser());
  return new NextRequest('https://app.example.com/api/workspaces/acme/members', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });
}

function ctx() {
  return { params: Promise.resolve({ slug: 'acme' }) };
}

beforeEach(() => {
  state.from.mockReset();
  state.getWorkspaceBySlug.mockReset();
  state.getUserWorkspaceRole.mockReset();
  state.updateMemberRole.mockReset();
  state.getWorkspaceBySlug.mockResolvedValue(WORKSPACE);
  state.updateMemberRole.mockResolvedValue(true);
});

describe('PATCH /api/workspaces/[slug]/members', () => {
  it('rejects with 403 when the caller is not owner/admin (e.g. a leader)', async () => {
    state.getUserWorkspaceRole.mockResolvedValue({ iris_role: 'leader' });
    const res = await PATCH(await patchRequest({ userId: 'u2', irisRole: 'member' }), ctx());
    expect(res.status).toBe(403);
    expect(state.updateMemberRole).not.toHaveBeenCalled();
  });

  it('rejects with 400 for an invalid irisRole value', async () => {
    state.getUserWorkspaceRole.mockResolvedValue({ iris_role: 'admin' });
    const res = await PATCH(await patchRequest({ userId: 'u2', irisRole: 'superuser' }), ctx());
    expect(res.status).toBe(400);
  });

  it('rejects with 404 when the target member is not in the workspace', async () => {
    state.getUserWorkspaceRole.mockImplementation((_ws: string, userId: string) =>
      userId === 'caller-1' ? Promise.resolve({ iris_role: 'admin' }) : Promise.resolve(null)
    );
    const res = await PATCH(await patchRequest({ userId: 'ghost', irisRole: 'member' }), ctx());
    expect(res.status).toBe(404);
  });

  // Privilege-escalation guard: an 'admin' must not be able to edit an
  // 'owner' — only another owner can. Without this, an admin could demote
  // the workspace owner.
  it('rejects with 403 when an admin (not owner) tries to edit an owner', async () => {
    state.getUserWorkspaceRole.mockImplementation((_ws: string, userId: string) =>
      userId === 'caller-1'
        ? Promise.resolve({ iris_role: 'admin' })
        : Promise.resolve({ iris_role: 'owner' })
    );
    const res = await PATCH(await patchRequest({ userId: 'target-owner', irisRole: 'member' }), ctx());
    expect(res.status).toBe(403);
    expect(state.updateMemberRole).not.toHaveBeenCalled();
  });

  it('allows an owner to edit another owner', async () => {
    const { accessToken } = await generateTokenPair(makeUser({ user_id: 'owner-caller' }));
    state.getUserWorkspaceRole.mockImplementation((_ws: string, userId: string) =>
      userId === 'owner-caller'
        ? Promise.resolve({ iris_role: 'owner' })
        : Promise.resolve({ iris_role: 'owner' })
    );
    const req = new NextRequest('https://app.example.com/api/workspaces/acme/members', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ userId: 'target-owner', irisRole: 'admin' }),
    });
    const res = await PATCH(req, ctx());
    expect(res.status).toBe(200);
    expect(state.updateMemberRole).toHaveBeenCalledWith('ws-1', 'target-owner', 'admin');
  });

  it('updates the role for an ordinary member when the caller is admin', async () => {
    state.getUserWorkspaceRole.mockImplementation((_ws: string, userId: string) =>
      userId === 'caller-1'
        ? Promise.resolve({ iris_role: 'admin' })
        : Promise.resolve({ iris_role: 'member' })
    );
    const res = await PATCH(await patchRequest({ userId: 'u2', irisRole: 'leader' }), ctx());
    expect(res.status).toBe(200);
    expect(state.updateMemberRole).toHaveBeenCalledWith('ws-1', 'u2', 'leader');
  });

  it('also updates profile fields (e.g. accountStatus) in the same request', async () => {
    state.getUserWorkspaceRole.mockImplementation((_ws: string, userId: string) =>
      userId === 'caller-1'
        ? Promise.resolve({ iris_role: 'admin' })
        : Promise.resolve({ iris_role: 'member' })
    );
    const fake = createFakeSupabaseAdmin({ account_users: [{ data: null }] });
    state.from.mockImplementation(fake.from);

    const res = await PATCH(
      await patchRequest({ userId: 'u2', accountStatus: 'suspended', companyRole: 'Engineer' }),
      ctx()
    );
    expect(res.status).toBe(200);

    const updateCall = fake.calls.find((c) => c.table === 'account_users' && c.method === 'update');
    const updated = updateCall?.args[0] as { account_status?: string; company_role?: string };
    expect(updated.account_status).toBe('suspended');
    expect(updated.company_role).toBe('Engineer');
  });
});
