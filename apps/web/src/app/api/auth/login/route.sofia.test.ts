import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabaseAdmin } from '@/lib/supabase/test-utils';
import type { SofiaUser } from '@/lib/supabase/sofia-client';
import type { SofiaAuthResult } from '@/lib/auth/sofia-auth';

/**
 * Cubre el FLUJO 1 (SOFIA) de la ruta: `isSofiaAuthEnabled` → true. Separado
 * de route.test.ts porque cada archivo de test tiene su propio módulo mock
 * de sofia-auth (Vitest aísla los mocks por archivo) — mezclar ambos flujos
 * en un mismo archivo obligaría a reconfigurar el mock en cada test.
 */
const state = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  authenticateSofiaUser: vi.fn(),
  syncWorkspacesFromSofia: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => state.from(...args),
    rpc: (...args: unknown[]) => state.rpc(...args),
  },
}));

vi.mock('@/lib/auth/sofia-auth', () => ({
  isSofiaAuthEnabled: () => true,
  authenticateSofiaUser: (...args: unknown[]) => state.authenticateSofiaUser(...args),
  recordSofiaLogin: vi.fn(),
  getSofiaUserOrgs: vi.fn().mockResolvedValue([]),
  normalizeAccountUsername: (u: string) => u,
  SOFIA_MANAGED_PASSWORD_PLACEHOLDER: 'supabase-auth:sofia',
}));

vi.mock('@/lib/services/workspace-service', () => ({
  syncWorkspacesFromSofia: (...args: unknown[]) => state.syncWorkspacesFromSofia(...args),
}));

import { POST } from './route';

function sofiaUser(overrides: Partial<SofiaUser> = {}): SofiaUser {
  return {
    user_id: 'sofia-user-1',
    first_name: 'Fernando',
    last_name_paternal: 'Suarez',
    last_name_maternal: null,
    display_name: 'Fernando Suarez',
    username: 'fernando_suarez',
    email: 'fernando@example.com',
    platform_role: 'Usuario',
    permission_level: 'user',
    company_role: null,
    department: null,
    account_status: 'active',
    is_banned: false,
    is_email_verified: true,
    email_verified_at: null,
    avatar_url: null,
    phone_number: null,
    timezone: 'America/Mexico_City',
    locale: 'es-MX',
    last_login_at: null,
    last_activity_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function loginRequest(body: unknown) {
  return new NextRequest('https://app.example.com/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  state.from.mockReset();
  state.rpc.mockReset();
  state.rpc.mockResolvedValue({ data: null, error: null });
  state.authenticateSofiaUser.mockReset();
  state.syncWorkspacesFromSofia.mockReset();
  state.syncWorkspacesFromSofia.mockResolvedValue([]);
});

describe('POST /api/auth/login (SOFIA flow)', () => {
  it('maps ACCOUNT_LOCKED to 423 and does not fall back to local auth', async () => {
    state.authenticateSofiaUser.mockResolvedValue({
      success: false,
      errorCode: 'ACCOUNT_LOCKED',
      error: 'Cuenta bloqueada',
    } satisfies SofiaAuthResult);
    const fake = createFakeSupabaseAdmin({ auth_login_history: [{}] });
    state.from.mockImplementation(fake.from);

    const res = await POST(loginRequest({ email: 'fernando@example.com', password: 'whatever' }));
    expect(res.status).toBe(423);
    // Never touches account_users — the failure was decided entirely within SOFIA.
    expect(fake.calls.some((c) => c.table === 'account_users')).toBe(false);
  });

  it('maps INVALID_PASSWORD to 401', async () => {
    state.authenticateSofiaUser.mockResolvedValue({
      success: false,
      errorCode: 'INVALID_PASSWORD',
      error: 'Credenciales inválidas',
    } satisfies SofiaAuthResult);
    const fake = createFakeSupabaseAdmin({ auth_login_history: [{}] });
    state.from.mockImplementation(fake.from);

    const res = await POST(loginRequest({ email: 'fernando@example.com', password: 'wrong' }));
    expect(res.status).toBe(401);
  });

  it('maps EMAIL_NOT_CONFIRMED to 403', async () => {
    state.authenticateSofiaUser.mockResolvedValue({
      success: false,
      errorCode: 'EMAIL_NOT_CONFIRMED',
      error: 'Email no confirmado',
    } satisfies SofiaAuthResult);
    const fake = createFakeSupabaseAdmin({ auth_login_history: [{}] });
    state.from.mockImplementation(fake.from);

    const res = await POST(loginRequest({ email: 'fernando@example.com', password: 'whatever' }));
    expect(res.status).toBe(403);
  });

  it('creates a new local mirror row and logs in when SOFIA succeeds for a brand-new user', async () => {
    const user = sofiaUser();
    state.authenticateSofiaUser.mockResolvedValue({
      success: true,
      user,
      session: { accessToken: 'sofia-access-token', refreshToken: 'sofia-refresh', expiresAt: null },
    } satisfies SofiaAuthResult);
    state.syncWorkspacesFromSofia.mockResolvedValue([
      { workspace_id: 'ws-1', name: 'Acme', slug: 'acme', logo_url: null, iris_role: 'member', sofia_role: 'member' },
    ]);

    const mirrorRow = {
      user_id: user.user_id,
      first_name: user.first_name,
      last_name_paternal: user.last_name_paternal,
      last_name_maternal: user.last_name_maternal,
      display_name: user.display_name,
      email: user.email,
      username: user.username,
      permission_level: user.permission_level,
      avatar_url: null,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };

    const fake = createFakeSupabaseAdmin({
      // syncSofiaUserToIris: no candidates found by id/email/username -> insert path.
      account_users: [{ data: [] }, { data: mirrorRow }],
      auth_sessions: [{}],
      auth_login_history: [{}],
    });
    state.from.mockImplementation(fake.from);

    const res = await POST(loginRequest({ email: user.email, password: 'CorrectPass123' }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.authSource).toBe('sofia');
    expect(json.workspaces).toEqual([
      { id: 'ws-1', name: 'Acme', slug: 'acme', logoUrl: undefined, role: 'member' },
    ]);
    expect(json.user.sofiaUserId).toBe(user.user_id);

    const insertCall = fake.calls.find((c) => c.table === 'account_users' && c.method === 'insert');
    expect(insertCall).toBeTruthy();
  });

  it('falls back to local auth when SOFIA reports USER_NOT_FOUND (does not surface a SOFIA error to the client)', async () => {
    state.authenticateSofiaUser.mockResolvedValue({
      success: false,
      errorCode: 'USER_NOT_FOUND',
    } satisfies SofiaAuthResult);

    // Local flow takes over from here: no local user either -> clean 401,
    // not a 500 or a leaked SOFIA-specific error message.
    const fake = createFakeSupabaseAdmin({
      account_users: [{ data: null }],
      auth_login_history: [{}],
    });
    state.from.mockImplementation(fake.from);

    const res = await POST(loginRequest({ email: 'ghost@example.com', password: 'whatever' }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Credenciales inválidas');
  });
});
