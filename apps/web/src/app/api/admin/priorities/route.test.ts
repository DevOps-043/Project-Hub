import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabaseAdmin } from '@/lib/supabase/test-utils';
import { generateTokenPair } from '@/lib/auth/jwt';
import type { AccountUser } from '@/lib/supabase/server';

const state = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => state.from(...args) },
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

async function adminRequest() {
  const { accessToken } = await generateTokenPair(makeAdminUser());
  return new NextRequest('https://app.example.com/api/admin/priorities', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
}

beforeEach(() => {
  state.from.mockReset();
});

describe('GET /api/admin/priorities', () => {
  it('rejects with 401 when unauthenticated', async () => {
    const req = new NextRequest('https://app.example.com/api/admin/priorities');
    expect((await GET(req)).status).toBe(401);
  });

  it('returns existing priorities without seeding when the table is not empty', async () => {
    const fake = createFakeSupabaseAdmin({
      task_priorities: [{ data: [{ priority_id: 'p1', name: 'Urgente', level: 1 }] }],
    });
    state.from.mockImplementation(fake.from);

    const json = await (await GET(await adminRequest())).json();
    expect(json.priorities).toHaveLength(1);
    expect(fake.calls.some((c) => c.method === 'insert')).toBe(false);
  });

  it('auto-seeds the 5 default priorities when the table is empty', async () => {
    const fake = createFakeSupabaseAdmin({
      task_priorities: [
        { data: [] },
        { data: [{ priority_id: 'seeded-1', name: 'Sin prioridad', level: 0 }] },
      ],
    });
    state.from.mockImplementation(fake.from);

    const json = await (await GET(await adminRequest())).json();
    expect(json.priorities).toHaveLength(1);

    const insertCall = fake.calls.find((c) => c.table === 'task_priorities' && c.method === 'insert');
    const seeded = insertCall?.args[0] as { name: string; level: number }[];
    expect(seeded).toHaveLength(5);
    expect(seeded[0]).toMatchObject({ name: 'Sin prioridad', level: 0 });
  });

  // Graceful degradation: if the auto-seed insert itself fails (e.g. a race
  // with another request seeding concurrently), the endpoint must still
  // return a usable default list instead of a 500.
  it('falls back to in-memory defaults (still 200) when the seed insert fails', async () => {
    const fake = createFakeSupabaseAdmin({
      task_priorities: [{ data: [] }, { data: null, error: { message: 'unique violation' } }],
    });
    state.from.mockImplementation(fake.from);

    const res = await GET(await adminRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.priorities).toHaveLength(5);
  });

  it('returns 500 when the initial fetch fails', async () => {
    const fake = createFakeSupabaseAdmin({
      task_priorities: [{ data: null, error: { message: 'db down' } }],
    });
    state.from.mockImplementation(fake.from);
    expect((await GET(await adminRequest())).status).toBe(500);
  });
});
