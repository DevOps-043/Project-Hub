import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { generateTokenPair } from '@/lib/auth/jwt';
import type { AccountUser } from '@/lib/supabase/server';

const state = vi.hoisted(() => ({ memberships: [{ workspace_id: '10000000-0000-4000-8000-000000000001' }], listV1: vi.fn(), createV1: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: () => ({ from: () => chain(() => ({ data: state.memberships })) }),
}));
vi.mock('../../v1/workspaces/[workspaceId]/projects/route', () => ({
  GET: (...args: unknown[]) => state.listV1(...args),
  POST: (...args: unknown[]) => state.createV1(...args),
}));

import { GET, POST } from './route';

beforeEach(() => {
  state.memberships = [{ workspace_id: '10000000-0000-4000-8000-000000000001' }];
  state.listV1.mockReset().mockResolvedValue(NextResponse.json({ data: [{ project_id: 'p1' }], meta: {} }));
  state.createV1.mockReset().mockResolvedValue(NextResponse.json({ data: { project_id: 'p2' }, meta: {} }, { status: 201 }));
});

describe('adaptador /api/ext/projects', () => {
  it('rechaza tokens ausentes', async () => expect((await GET(new NextRequest('https://x/api/ext/projects'))).status).toBe(401));

  it('delega al contrato v1 con un único workspace y anuncia deprecación', async () => {
    const response = await GET(await request('https://x/api/ext/projects'));
    expect(response.status).toBe(200);
    expect(response.headers.get('deprecation')).toBe('true');
    expect(state.listV1).toHaveBeenCalled();
    expect((await response.json()).projects).toHaveLength(1);
  });

  it('exige workspace explícito si el usuario tiene más de uno', async () => {
    state.memberships = [{ workspace_id: 'w1' }, { workspace_id: 'w2' }];
    expect((await GET(await request('https://x/api/ext/projects'))).status).toBe(400);
  });

  it('adapta el payload legado de creación', async () => {
    const response = await POST(await request('https://x/api/ext/projects', { method: 'POST', body: JSON.stringify({ name: 'Alpha', creator_id: 'attacker' }) }));
    expect(response.status).toBe(201);
    const delegatedRequest = state.createV1.mock.calls[0][0] as NextRequest;
    const body = await delegatedRequest.json();
    expect(body).toMatchObject({ name: 'Alpha', priority: 'medium' });
    expect(body).not.toHaveProperty('creator_id');
  });
});

function chain(result: () => unknown) {
  const value: Record<string, any> = {};
  for (const name of ['select', 'eq', 'limit']) value[name] = () => value;
  value.then = (resolve: (input: unknown) => unknown) => Promise.resolve(result()).then(resolve);
  return value;
}

async function request(url: string, init: RequestInit = {}) {
  const { accessToken } = await generateTokenPair(user());
  return new NextRequest(url, { ...init, headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' } });
}

function user(): AccountUser { return { user_id: 'user-1', first_name: 'Ana', last_name_paternal: 'Test', last_name_maternal: null, display_name: 'Ana', username: 'ana_test', email: 'ana@example.com', password_hash: 'x', permission_level: 'user', company_role: null, department: null, account_status: 'active', is_email_verified: true, email_verified_at: null, avatar_url: null, phone_number: null, timezone: 'America/Mexico_City', locale: 'es-MX', last_login_at: null, last_activity_at: null, failed_login_attempts: 0, locked_until: null, created_at: '', updated_at: '' }; }

