import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const ids = {
  workspace: '11111111-1111-4111-8111-111111111111',
  project: '22222222-2222-4222-8222-222222222222',
  actor: '33333333-3333-4333-8333-333333333333',
};

const state = vi.hoisted(() => ({
  requireWorkspace: vi.fn(),
  requireProject: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/api-v1/auth', () => ({
  requireWorkspace: (...args: unknown[]) => state.requireWorkspace(...args),
  requireProject: (...args: unknown[]) => state.requireProject(...args),
}));
vi.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: () => ({ rpc: (...args: unknown[]) => state.rpc(...args) }),
}));

import { POST } from './route';

const params = { params: Promise.resolve({ workspaceId: ids.workspace, projectId: ids.project }) };
const validBody = {
  approved: true,
  evidence: {
    external_reference: 'meeting-run-1', version: 1, title: 'Reunión aprobada', summary: 'Resumen',
    content_hash: 'a'.repeat(64), metadata: {},
  },
  items: [], tasks: [],
};

function request(body = validBody, idempotencyKey?: string) {
  return new NextRequest(`https://project.example/api/v1/workspaces/${ids.workspace}/projects/${ids.project}/meeting-imports`, {
    method: 'POST', body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}) },
  });
}

describe('importación de reuniones v1', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.requireWorkspace.mockResolvedValue({ payload: { sub: ids.actor }, workspace: { workspace_id: ids.workspace }, member: {} });
    state.requireProject.mockResolvedValue({ project: { project_id: ids.project }, role: 'owner' });
    state.rpc.mockResolvedValue({ data: { evidence_id: crypto.randomUUID(), created_issue_ids: [] }, error: null });
  });

  it('exige aprobación humana y una clave de idempotencia', async () => {
    const missingKey = await POST(request(), params);
    expect(missingKey.status).toBe(400);
    expect((await missingKey.json()).error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    expect(state.rpc).not.toHaveBeenCalled();

    const notApproved = await POST(request({ ...validBody, approved: false }, 'meeting:key:v1'), params);
    expect(notApproved.status).toBe(400);
    expect((await notApproved.json()).error.code).toBe('VALIDATION_ERROR');
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('autoriza escritura y delega la transacción idempotente al RPC', async () => {
    const response = await POST(request(validBody, 'meeting:key:v1'), params);
    expect(response.status).toBe(200);
    expect(state.requireProject).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { sub: ids.actor } }), ids.project, 'write',
    );
    expect(state.rpc).toHaveBeenCalledWith('project_hub_import_meeting', expect.objectContaining({
      p_workspace_id: ids.workspace, p_project_id: ids.project,
      p_actor_user_id: ids.actor, p_idempotency_key: 'meeting:key:v1',
    }));
  });

  it('expone conflicto seguro cuando la misma clave lleva otro contenido', async () => {
    state.rpc.mockResolvedValue({ data: null, error: { message: 'IDEMPOTENCY_KEY_REUSED' } });
    const response = await POST(request(validBody, 'meeting:key:v1'), params);
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe('IDEMPOTENCY_CONFLICT');
  });
});
