import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { generateTokenPair } from '@/lib/auth/jwt';
import type { AccountUser } from '@/lib/supabase/server';

const state = vi.hoisted(() => ({ listV1: vi.fn(), createV1: vi.fn(), updateV1: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: () => ({ from: (table: string) => chain(() => ({ data: table === 'pm_projects' ? { workspace_id: '10000000-0000-4000-8000-000000000001' } : table === 'task_issues' ? { project_id: '20000000-0000-4000-8000-000000000002' } : { member_id: 'm1' } })) }),
}));
vi.mock('../../v1/workspaces/[workspaceId]/projects/[projectId]/tasks/route', () => ({ GET: (...args: unknown[]) => state.listV1(...args), POST: (...args: unknown[]) => state.createV1(...args) }));
vi.mock('../../v1/workspaces/[workspaceId]/projects/[projectId]/tasks/[taskId]/route', () => ({ PATCH: (...args: unknown[]) => state.updateV1(...args) }));

import { GET, PATCH, POST } from './route';

beforeEach(() => {
  state.listV1.mockReset().mockResolvedValue(NextResponse.json({ data: [{ issue_id: 'i1' }], meta: {} }));
  state.createV1.mockReset().mockResolvedValue(NextResponse.json({ data: { issue_id: 'i2' }, meta: {} }, { status: 201 }));
  state.updateV1.mockReset().mockResolvedValue(NextResponse.json({ data: { issue_id: 'i1' }, meta: {} }));
});

describe('adaptador /api/ext/issues', () => {
  it('exige project_id', async () => expect((await GET(await request('https://x/api/ext/issues'))).status).toBe(400));
  it('delega un listado con autorización de proyecto', async () => {
    const response = await GET(await request('https://x/api/ext/issues?project_id=20000000-0000-4000-8000-000000000002'));
    expect(response.status).toBe(200); expect((await response.json()).issues).toHaveLength(1); expect(state.listV1).toHaveBeenCalled();
  });
  it('crea por v1 y elimina campos fuera del contrato', async () => {
    await POST(await request('https://x/api/ext/issues', { method: 'POST', body: JSON.stringify({ project_id: '20000000-0000-4000-8000-000000000002', title: 'Tarea', creator_id: 'attacker' }) }));
    const body = await (state.createV1.mock.calls[0][0] as NextRequest).json();
    expect(body.title).toBe('Tarea'); expect(body).not.toHaveProperty('creator_id');
  });
  it('PATCH conserva solo la allowlist', async () => {
    await PATCH(await request('https://x/api/ext/issues', { method: 'PATCH', body: JSON.stringify({ issue_id: '30000000-0000-4000-8000-000000000003', title: 'Nueva', project_id: 'otro', creator_id: 'attacker' }) }));
    const body = await (state.updateV1.mock.calls[0][0] as NextRequest).json();
    expect(body).toEqual({ title: 'Nueva' });
  });
});

function chain(result: () => unknown) { const value: Record<string, any> = {}; for (const name of ['select', 'eq', 'maybeSingle']) value[name] = () => name === 'maybeSingle' ? Promise.resolve(result()) : value; return value; }
async function request(url: string, init: RequestInit = {}) { const { accessToken } = await generateTokenPair(user()); return new NextRequest(url, { ...init, headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' } }); }
function user(): AccountUser { return { user_id: 'user-1', first_name: 'Ana', last_name_paternal: 'Test', last_name_maternal: null, display_name: 'Ana', username: 'ana_test', email: 'ana@example.com', password_hash: 'x', permission_level: 'user', company_role: null, department: null, account_status: 'active', is_email_verified: true, email_verified_at: null, avatar_url: null, phone_number: null, timezone: 'America/Mexico_City', locale: 'es-MX', last_login_at: null, last_activity_at: null, failed_login_attempts: 0, locked_until: null, created_at: '', updated_at: '' }; }

