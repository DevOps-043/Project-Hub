import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const limit = vi.fn(() => ({ maybeSingle }));
  const order = vi.fn(() => ({ limit }));
  const activeQuery = { order, eq: vi.fn(() => ({ maybeSingle })) };
  const eqStatus = vi.fn(() => activeQuery);
  const eqWorkspace = vi.fn(() => ({ eq: eqStatus }));
  const select = vi.fn(() => ({ eq: eqWorkspace }));
  const from = vi.fn(() => ({ select }));
  return { activeQuery, eqStatus, eqWorkspace, from, maybeSingle };
});

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseAdmin: () => ({ from: mocks.from }),
}));

import { resolveProjectTeam } from './auth';

describe('resolveProjectTeam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.maybeSingle.mockResolvedValue({ data: { team_id: 'team-1' }, error: null });
  });

  it('busca equipos por teams.status=active', async () => {
    await expect(resolveProjectTeam('workspace-1')).resolves.toBe('team-1');

    expect(mocks.eqWorkspace).toHaveBeenCalledWith('workspace_id', 'workspace-1');
    expect(mocks.eqStatus).toHaveBeenCalledWith('status', 'active');
    expect(mocks.eqStatus).not.toHaveBeenCalledWith('is_active', true);
  });
});
