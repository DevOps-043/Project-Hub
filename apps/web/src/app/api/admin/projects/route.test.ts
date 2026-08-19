import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabaseAdmin } from '@/lib/supabase/test-utils';
import { generateTokenPair } from '@/lib/auth/jwt';
import type { AccountUser } from '@/lib/supabase/server';

const state = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => state.from(...args) },
}));

vi.mock('@/lib/notifications/notifier', () => ({
  sendNotification: vi.fn(),
  sendTeamNotification: vi.fn(),
}));

import { GET, POST } from './route';

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

beforeEach(() => {
  state.from.mockReset();
});

describe('GET /api/admin/projects', () => {
  it('rejects with 401 when unauthenticated', async () => {
    const res = await GET(new NextRequest('https://app.example.com/api/admin/projects'));
    expect(res.status).toBe(401);
  });

  it('rejects with 403 for a non-admin user', async () => {
    const { accessToken } = await generateTokenPair(makeAdminUser({ permission_level: 'user' }));
    const req = new NextRequest('https://app.example.com/api/admin/projects', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect((await GET(req)).status).toBe(403);
  });

  it('returns projects from the summary view with real progress history when available', async () => {
    const project = { project_id: 'p1', project_name: 'Alpha', completion_percentage: 40 };
    const fake = createFakeSupabaseAdmin({
      v_projects_summary: [{ data: [project] }],
      pm_project_progress_history: [
        { data: [{ project_id: 'p1', completion_percentage: 40, recorded_at: '2026-01-01' }] },
      ],
      pm_projects: [{ data: null, error: null }], // count query, .single() not called so data is irrelevant
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest('https://app.example.com/api/admin/projects');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.projects).toHaveLength(1);
    expect(json.projects[0].progress_history).toEqual([{ value: 40 }]);
  });

  it('generates a synthetic sparkline when a project has no progress history', async () => {
    const project = { project_id: 'p1', project_name: 'Alpha', completion_percentage: 75 };
    const fake = createFakeSupabaseAdmin({
      v_projects_summary: [{ data: [project] }],
      pm_project_progress_history: [{ data: [] }],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest('https://app.example.com/api/admin/projects');
    const res = await GET(req);
    const json = await res.json();

    expect(json.projects[0].progress_history).toHaveLength(12);
    expect(json.projects[0].progress_history.at(-1).value).toBe(75);
  });

  it('falls back to a direct pm_projects query with joins when the summary view errors', async () => {
    const directRow = {
      project_id: 'p1',
      project_key: 'ALPH-001',
      project_name: 'Alpha',
      project_description: null,
      icon_name: 'folder',
      icon_color: '#3B82F6',
      project_status: 'active',
      health_status: 'on_track',
      priority_level: 'medium',
      completion_percentage: 10,
      start_date: null,
      target_date: null,
      team_id: 'team-1',
      lead_user_id: null,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
      tags: [],
      lead: null,
      team: { name: 'Core Team', color: '#00D4B3' },
    };
    const fake = createFakeSupabaseAdmin({
      v_projects_summary: [{ data: null, error: { message: 'relation does not exist' } }],
      pm_projects: [{ data: [directRow] }],
      pm_project_progress_history: [{ data: [] }],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest('https://app.example.com/api/admin/projects');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.projects[0].team_name).toBe('Core Team');
    expect(json.projects[0].team_color).toBe('#00D4B3');
  });

  it('returns 500 when both the view and the direct fallback query fail', async () => {
    const fake = createFakeSupabaseAdmin({
      v_projects_summary: [{ data: null, error: { message: 'view down' } }],
      pm_projects: [{ data: null, error: { message: 'table down too' } }],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest('https://app.example.com/api/admin/projects');
    expect((await GET(req)).status).toBe(500);
  });
});

describe('POST /api/admin/projects', () => {
  it('rejects with 400 when project_name or created_by_user_id is missing', async () => {
    const req = await adminRequest('https://app.example.com/api/admin/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project_name: 'Alpha' }),
    });
    expect((await POST(req)).status).toBe(400);
  });

  it('creates the project, adds the creator as owner, and seeds initial progress on success', async () => {
    const newProject = {
      project_id: 'new-p1',
      project_key: 'ALPH-001',
      project_name: 'Alpha',
      team_id: null,
      target_date: null,
    };
    const fake = createFakeSupabaseAdmin({
      pm_projects: [{ data: null }, { data: newProject }], // count query, then insert
      pm_project_members: [{ data: null }],
      pm_project_progress_history: [{ data: null }],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest('https://app.example.com/api/admin/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project_name: 'Alpha', created_by_user_id: 'admin-1' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.project.project_id).toBe('new-p1');

    const memberInsert = fake.calls.find((c) => c.table === 'pm_project_members' && c.method === 'insert');
    const memberFields = memberInsert?.args[0] as { project_role: string; can_delete: boolean };
    expect(memberFields.project_role).toBe('owner');
    expect(memberFields.can_delete).toBe(true);

    expect(fake.calls.some((c) => c.table === 'pm_project_progress_history' && c.method === 'insert')).toBe(true);
  });

  it('derives workspace_id from the team when not explicitly provided', async () => {
    const newProject = { project_id: 'new-p2', project_key: 'ALPH-002', project_name: 'Beta', team_id: 'team-1' };
    const fake = createFakeSupabaseAdmin({
      teams: [{ data: { workspace_id: 'ws-derived' } }],
      pm_projects: [{ data: null }, { data: newProject }],
      pm_project_members: [{ data: null }],
      pm_project_progress_history: [{ data: null }],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest('https://app.example.com/api/admin/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project_name: 'Beta', created_by_user_id: 'admin-1', team_id: 'team-1' }),
    });
    expect((await POST(req)).status).toBe(201);

    const insertCall = fake.calls.find((c) => c.table === 'pm_projects' && c.method === 'insert');
    const inserted = insertCall?.args[0] as { workspace_id: string | null };
    expect(inserted.workspace_id).toBe('ws-derived');
  });

  it('returns 500 without failing silently when the insert itself errors', async () => {
    const fake = createFakeSupabaseAdmin({
      pm_projects: [{ data: null }, { data: null, error: { message: 'unique violation' } }],
    });
    state.from.mockImplementation(fake.from);

    const req = await adminRequest('https://app.example.com/api/admin/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ project_name: 'Alpha', created_by_user_id: 'admin-1' }),
    });
    expect((await POST(req)).status).toBe(500);
  });
});
