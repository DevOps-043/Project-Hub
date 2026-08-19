import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabaseAdmin } from '@/lib/supabase/test-utils';

const state = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => state.from(...args) },
}));

import { POST } from './route';

const validBody = {
  firstName: 'Fernando',
  lastNamePaternal: 'Suarez',
  email: 'fernando@example.com',
  password: 'ValidPass1',
  username: 'fernando_suarez',
};

function registerRequest(body: unknown) {
  return new NextRequest('https://app.example.com/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  state.from.mockReset();
});

describe('POST /api/auth/register', () => {
  it('rejects with 400 when a required field is missing', async () => {
    const { username, ...withoutUsername } = validBody;
    void username;
    const res = await POST(registerRequest(withoutUsername));
    expect(res.status).toBe(400);
  });

  it('rejects with 400 for a malformed email', async () => {
    const res = await POST(registerRequest({ ...validBody, email: 'not-an-email' }));
    expect(res.status).toBe(400);
  });

  it('rejects with 400 for a username with invalid characters', async () => {
    const res = await POST(registerRequest({ ...validBody, username: 'a b!' }));
    expect(res.status).toBe(400);
  });

  it('rejects with 400 for a password shorter than 8 characters', async () => {
    const res = await POST(registerRequest({ ...validBody, password: 'Ab1' }));
    expect(res.status).toBe(400);
  });

  it('rejects with 409 when the email is already registered', async () => {
    const fake = createFakeSupabaseAdmin({
      account_users: [{ data: { email: validBody.email } }],
    });
    state.from.mockImplementation(fake.from);

    const res = await POST(registerRequest(validBody));
    expect(res.status).toBe(409);
  });

  it('rejects with 409 when the username is already taken', async () => {
    const fake = createFakeSupabaseAdmin({
      account_users: [{ data: null }, { data: { username: validBody.username } }],
    });
    state.from.mockImplementation(fake.from);

    const res = await POST(registerRequest(validBody));
    expect(res.status).toBe(409);
  });

  it('creates the account as pending_verification (not pre-verified) and issues tokens on success', async () => {
    const newUser = {
      user_id: 'new-user-1',
      email: validBody.email,
      username: validBody.username,
      first_name: validBody.firstName,
      last_name_paternal: validBody.lastNamePaternal,
      last_name_maternal: null,
      display_name: `${validBody.firstName} ${validBody.lastNamePaternal}`,
      permission_level: 'user',
      company_role: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const fake = createFakeSupabaseAdmin({
      account_users: [{ data: null }, { data: null }, { data: newUser }],
      auth_sessions: [{}],
    });
    state.from.mockImplementation(fake.from);

    const res = await POST(registerRequest(validBody));
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.accessToken).toBeTruthy();
    expect(json.refreshToken).toBeTruthy();
    expect(json.user.email).toBe(validBody.email);

    const insertCall = fake.calls.find((c) => c.table === 'account_users' && c.method === 'insert');
    expect(insertCall).toBeTruthy();
    const insertedFields = insertCall?.args[0] as { account_status?: string; is_email_verified?: boolean };
    // Security invariant: registration must never self-verify the account —
    // that would skip email ownership verification entirely.
    expect(insertedFields.account_status).toBe('pending_verification');
    expect(insertedFields.is_email_verified).toBe(false);

    expect(fake.calls.some((c) => c.table === 'auth_sessions' && c.method === 'insert')).toBe(true);
  });

  it('returns 500 without leaking the raw DB error when account creation fails', async () => {
    const fake = createFakeSupabaseAdmin({
      account_users: [{ data: null }, { data: null }, { data: null, error: { message: 'constraint violation xyz' } }],
    });
    state.from.mockImplementation(fake.from);

    const res = await POST(registerRequest(validBody));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).not.toMatch(/constraint violation/);
  });
});
