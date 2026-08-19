import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabaseAdmin } from '@/lib/supabase/test-utils';
import { generateTokenPair } from '@/lib/auth/jwt';
import { hashPassword } from '@/lib/auth/password';
import type { AccountUser } from '@/lib/supabase/server';

/**
 * `isSofiaConfigured` queda en `false`: cubre el flujo local (verifica el
 * hash en `account_users.password_hash`). El flujo SOFIA (`changeSofiaPassword`,
 * vía Supabase Auth) queda fuera de este archivo.
 */
const state = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => state.from(...args) },
}));

vi.mock('@/lib/supabase/sofia-client', () => ({
  isSofiaConfigured: () => false,
}));

vi.mock('@/lib/auth/sofia-auth', () => ({
  changeSofiaPassword: vi.fn(),
  SOFIA_MANAGED_PASSWORD_PLACEHOLDER: 'supabase-auth:sofia',
}));

import { POST } from './route';

async function makeUser(overrides: Partial<AccountUser> = {}): Promise<AccountUser> {
  return {
    user_id: 'user-123',
    first_name: 'Fernando',
    last_name_paternal: 'Suarez',
    last_name_maternal: null,
    display_name: 'Fernando Suarez',
    username: 'fernando_suarez',
    email: 'fernando@example.com',
    password_hash: await hashPassword('CurrentPass1'),
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

async function requestWithBody(body: unknown) {
  const { accessToken } = await generateTokenPair(await makeUser());
  return {
    accessToken,
    request: new NextRequest('https://app.example.com/api/auth/change-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    }),
  };
}

beforeEach(() => {
  state.from.mockReset();
});

describe('POST /api/auth/change-password (local flow)', () => {
  it('rejects with 401 when no Authorization header is present', async () => {
    const res = await POST(
      new NextRequest('https://app.example.com/api/auth/change-password', { method: 'POST' })
    );
    expect(res.status).toBe(401);
  });

  it('rejects with 400 when a field is missing', async () => {
    const { request } = await requestWithBody({ currentPassword: 'x', newPassword: 'y' });
    expect((await POST(request)).status).toBe(400);
  });

  it('rejects with 400 when newPassword and confirmPassword do not match', async () => {
    const { request } = await requestWithBody({
      currentPassword: 'CurrentPass1',
      newPassword: 'NewPassword1',
      confirmPassword: 'Different1',
    });
    expect((await POST(request)).status).toBe(400);
  });

  it('rejects with 400 for a password shorter than 8 characters', async () => {
    const { request } = await requestWithBody({
      currentPassword: 'CurrentPass1',
      newPassword: 'Ab1',
      confirmPassword: 'Ab1',
    });
    expect((await POST(request)).status).toBe(400);
  });

  it('rejects with 400 for a password missing an uppercase/lowercase/digit', async () => {
    const { request } = await requestWithBody({
      currentPassword: 'CurrentPass1',
      newPassword: 'alllowercase',
      confirmPassword: 'alllowercase',
    });
    expect((await POST(request)).status).toBe(400);
  });

  it('rejects with 400 when the new password is identical to the current one', async () => {
    const { request } = await requestWithBody({
      currentPassword: 'CurrentPass1',
      newPassword: 'CurrentPass1',
      confirmPassword: 'CurrentPass1',
    });
    expect((await POST(request)).status).toBe(400);
  });

  it('rejects with 404 when the user no longer exists', async () => {
    const fake = createFakeSupabaseAdmin({ account_users: [{ data: null, error: { message: 'not found' } }] });
    state.from.mockImplementation(fake.from);

    const { request } = await requestWithBody({
      currentPassword: 'CurrentPass1',
      newPassword: 'NewPassword1',
      confirmPassword: 'NewPassword1',
    });
    expect((await POST(request)).status).toBe(404);
  });

  it('rejects with 400 when the current password does not match the stored hash', async () => {
    const user = await makeUser();
    const fake = createFakeSupabaseAdmin({ account_users: [{ data: user }] });
    state.from.mockImplementation(fake.from);

    const { request } = await requestWithBody({
      currentPassword: 'WrongCurrent1',
      newPassword: 'NewPassword1',
      confirmPassword: 'NewPassword1',
    });
    const res = await POST(request);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/incorrecta/i);
  });

  it('changes the password on success: updates account_users with a new hash', async () => {
    const user = await makeUser();
    const fake = createFakeSupabaseAdmin({
      account_users: [{ data: user }, { data: null }],
    });
    state.from.mockImplementation(fake.from);

    const { request } = await requestWithBody({
      currentPassword: 'CurrentPass1',
      newPassword: 'NewPassword1',
      confirmPassword: 'NewPassword1',
    });
    const res = await POST(request);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.source).toBe('local');

    const updateCall = fake.calls.find((c) => c.table === 'account_users' && c.method === 'update');
    expect(updateCall).toBeTruthy();
    const updatedFields = updateCall?.args[0] as { password_hash?: string };
    expect(updatedFields.password_hash).toBeTruthy();
    expect(updatedFields.password_hash).not.toBe(user.password_hash);
  });
});
