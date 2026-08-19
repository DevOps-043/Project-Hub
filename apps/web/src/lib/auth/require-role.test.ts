import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { generateTokenPair } from './jwt';
import type { AccountUser } from '../supabase/server';

const state = vi.hoisted(() => ({
  getWorkspaceBySlug: vi.fn(),
  getUserWorkspaceRole: vi.fn(),
}));

vi.mock('@/lib/services/workspace-service', () => ({
  getWorkspaceBySlug: (...args: unknown[]) => state.getWorkspaceBySlug(...args),
  getUserWorkspaceRole: (...args: unknown[]) => state.getUserWorkspaceRole(...args),
}));

import { requireAdmin, requireAuth, requireWorkspaceMember } from './require-role';

function makeUser(overrides: Partial<AccountUser> = {}): AccountUser {
  return {
    user_id: 'user-123',
    first_name: 'Fernando',
    last_name_paternal: 'Suarez',
    last_name_maternal: null,
    display_name: 'Fernando Suarez',
    username: 'fernando_suarez',
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

function requestWithBearer(token: string) {
  return new NextRequest('https://app.example.com/api/admin/users', {
    headers: { authorization: `Bearer ${token}` },
  });
}

function requestWithCookie(token: string) {
  return new NextRequest('https://app.example.com/api/admin/users', {
    headers: { cookie: `accessToken=${token}` },
  });
}

describe('requireAuth', () => {
  it('rechaza con 401 cuando no hay token en cookie ni header', async () => {
    const result = await requireAuth(new NextRequest('https://app.example.com/api/admin/users'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it('rechaza con 401 un token inválido', async () => {
    const result = await requireAuth(requestWithBearer('token.invalido.aqui'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it('acepta un token válido vía header Authorization', async () => {
    const { accessToken } = await generateTokenPair(makeUser());
    const result = await requireAuth(requestWithBearer(accessToken));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload.sub).toBe('user-123');
  });

  it('acepta un token válido vía cookie accessToken', async () => {
    const { accessToken } = await generateTokenPair(makeUser());
    const result = await requireAuth(requestWithCookie(accessToken));
    expect(result.ok).toBe(true);
  });

  // Regression test: a refresh token is a structurally valid JWT with the
  // same payload shape as an access token — it must never authenticate a
  // regular API call, only /api/auth/refresh. At least one route
  // (admin/tasks/export) used to check this manually; centralized here so
  // no route can forget it.
  it('rechaza con 401 un refresh token usado como access token', async () => {
    const { refreshToken } = await generateTokenPair(makeUser());
    const result = await requireAuth(requestWithBearer(refreshToken));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });
});

describe('requireAdmin', () => {
  it('rechaza con 403 a un usuario autenticado sin rol admin (el caso del IDOR original)', async () => {
    const { accessToken } = await generateTokenPair(makeUser({ permission_level: 'user' }));
    const result = await requireAdmin(requestWithBearer(accessToken));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it('rechaza con 403 a un guest', async () => {
    const { accessToken } = await generateTokenPair(makeUser({ permission_level: 'guest' }));
    const result = await requireAdmin(requestWithBearer(accessToken));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it('acepta a un usuario admin', async () => {
    const { accessToken } = await generateTokenPair(makeUser({ permission_level: 'admin' }));
    const result = await requireAdmin(requestWithBearer(accessToken));
    expect(result.ok).toBe(true);
  });

  it('acepta a un super_admin', async () => {
    const { accessToken } = await generateTokenPair(makeUser({ permission_level: 'super_admin' }));
    const result = await requireAdmin(requestWithBearer(accessToken));
    expect(result.ok).toBe(true);
  });

  it('rechaza con 401 (no 403) cuando ni siquiera hay token — no debe filtrar si el problema es auth o autorización', async () => {
    const result = await requireAdmin(new NextRequest('https://app.example.com/api/admin/users'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });
});

describe('requireWorkspaceMember', () => {
  beforeEach(() => {
    state.getWorkspaceBySlug.mockReset();
    state.getUserWorkspaceRole.mockReset();
  });

  it('rechaza con 401 cuando ni siquiera hay token', async () => {
    const result = await requireWorkspaceMember(new NextRequest('https://app.example.com/x'), 'acme');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
    expect(state.getWorkspaceBySlug).not.toHaveBeenCalled();
  });

  it('rechaza con 404 cuando el workspace no existe', async () => {
    const { accessToken } = await generateTokenPair(makeUser());
    state.getWorkspaceBySlug.mockResolvedValue(null);

    const result = await requireWorkspaceMember(requestWithBearer(accessToken), 'ghost-workspace');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(404);
    expect(state.getUserWorkspaceRole).not.toHaveBeenCalled();
  });

  it('rechaza con 403 cuando el usuario no es miembro del workspace', async () => {
    const { accessToken } = await generateTokenPair(makeUser());
    state.getWorkspaceBySlug.mockResolvedValue({ workspace_id: 'ws-1', slug: 'acme' });
    state.getUserWorkspaceRole.mockResolvedValue(null);

    const result = await requireWorkspaceMember(requestWithBearer(accessToken), 'acme');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it('acepta a un miembro y expone payload + workspace + member', async () => {
    const { accessToken } = await generateTokenPair(makeUser());
    state.getWorkspaceBySlug.mockResolvedValue({ workspace_id: 'ws-1', slug: 'acme' });
    state.getUserWorkspaceRole.mockResolvedValue({ iris_role: 'member', user_id: 'user-123' });

    const result = await requireWorkspaceMember(requestWithBearer(accessToken), 'acme');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.workspace.workspace_id).toBe('ws-1');
      expect(result.member.iris_role).toBe('member');
      expect(result.payload.sub).toBe('user-123');
    }
  });

  it('no llama a getUserWorkspaceRole si el workspace no existe (evita una query innecesaria)', async () => {
    const { accessToken } = await generateTokenPair(makeUser());
    state.getWorkspaceBySlug.mockResolvedValue(null);

    await requireWorkspaceMember(requestWithBearer(accessToken), 'ghost');
    expect(state.getUserWorkspaceRole).not.toHaveBeenCalled();
  });
});
