import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabaseAdmin } from '@/lib/supabase/test-utils';
import { generateTokenPair } from '@/lib/auth/jwt';
import type { AccountUser } from '@/lib/supabase/server';

const state = vi.hoisted(() => ({ from: vi.fn(), getTaskExportRows: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: () => ({ from: (...args: unknown[]) => state.from(...args) }),
}));

vi.mock('@/lib/services/task-export-service', () => ({
  getTaskExportRows: (...args: unknown[]) => state.getTaskExportRows(...args),
}));

import { GET } from './route';

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

beforeEach(() => {
  state.from.mockReset();
  state.getTaskExportRows.mockReset();
});

describe('GET /api/admin/tasks/export', () => {
  it('rejects with 401 when unauthenticated', async () => {
    const req = new NextRequest('https://app.example.com/api/admin/tasks/export');
    expect((await GET(req)).status).toBe(401);
  });

  it('rejects with 403 for a non-admin user', async () => {
    const { accessToken } = await generateTokenPair(makeAdminUser({ permission_level: 'user' }));
    const req = new NextRequest('https://app.example.com/api/admin/tasks/export', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect((await GET(req)).status).toBe(403);
  });

  // Regression: a refresh token must not authenticate this export endpoint,
  // even though it's a structurally valid JWT for the same user.
  it('rejects with 401 when a refresh token is presented instead of an access token', async () => {
    const { refreshToken } = await generateTokenPair(makeAdminUser());
    const req = new NextRequest('https://app.example.com/api/admin/tasks/export', {
      headers: { authorization: `Bearer ${refreshToken}` },
    });
    expect((await GET(req)).status).toBe(401);
  });

  it('exports rows scoped to all team ids and honors the ?limit= param', async () => {
    const { accessToken } = await generateTokenPair(makeAdminUser());
    const fake = createFakeSupabaseAdmin({ teams: [{ data: [{ team_id: 't1' }, { team_id: 't2' }] }] });
    state.from.mockImplementation(fake.from);
    state.getTaskExportRows.mockResolvedValue({ rows: [{ issue_id: 'i1' }], error: null });

    const req = new NextRequest('https://app.example.com/api/admin/tasks/export?limit=100', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const json = await (await GET(req)).json();
    expect(json.total).toBe(1);
    expect(state.getTaskExportRows).toHaveBeenCalledWith(expect.anything(), ['t1', 't2'], 100);
  });

  it('falls back to a limit of 5000 for a non-numeric ?limit=', async () => {
    const { accessToken } = await generateTokenPair(makeAdminUser());
    const fake = createFakeSupabaseAdmin({ teams: [{ data: [] }] });
    state.from.mockImplementation(fake.from);
    state.getTaskExportRows.mockResolvedValue({ rows: [], error: null });

    const req = new NextRequest('https://app.example.com/api/admin/tasks/export?limit=not-a-number', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    await GET(req);
    expect(state.getTaskExportRows).toHaveBeenCalledWith(expect.anything(), [], 5000);
  });

  it('returns 500 when the export service reports an error', async () => {
    const { accessToken } = await generateTokenPair(makeAdminUser());
    const fake = createFakeSupabaseAdmin({ teams: [{ data: [] }] });
    state.from.mockImplementation(fake.from);
    state.getTaskExportRows.mockResolvedValue({ rows: [], error: 'export failed' });

    const req = new NextRequest('https://app.example.com/api/admin/tasks/export', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect((await GET(req)).status).toBe(500);
  });
});
