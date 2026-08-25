import { NextRequest } from 'next/server';
import { requireProject, requireWorkspace } from '@/lib/api-v1/auth';
import { ApiError, fail, ok } from '@/lib/api-v1/http';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { recordActivity } from '@/lib/api-v1/data';

type Params = { params: Promise<{ workspaceId: string; projectId: string; evidenceId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId, projectId, evidenceId } = await params;
    const ctx = await requireWorkspace(request, workspaceId);
    await requireProject(ctx, projectId);
    const { data } = await getSupabaseAdmin().from('pm_project_evidence').select('*, pm_project_evidence_items(*)')
      .eq('evidence_id', evidenceId).eq('workspace_id', workspaceId).eq('project_id', projectId).maybeSingle();
    if (!data) throw new ApiError(404, 'EVIDENCE_NOT_FOUND', 'Evidencia no encontrada');
    return ok(request, data);
  } catch (error) { return fail(request, error); }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId, projectId, evidenceId } = await params;
    const ctx = await requireWorkspace(request, workspaceId);
    await requireProject(ctx, projectId, 'admin');
    const archivedAt = new Date().toISOString();
    const { data } = await getSupabaseAdmin().from('pm_project_evidence').update({ archived_at: archivedAt, archived_by_user_id: ctx.payload.sub })
      .eq('evidence_id', evidenceId).eq('workspace_id', workspaceId).eq('project_id', projectId).select().maybeSingle();
    if (!data) throw new ApiError(404, 'EVIDENCE_NOT_FOUND', 'Evidencia no encontrada');
    await recordActivity({ workspaceId, projectId, actorId: ctx.payload.sub, action: 'evidence.archived', entityType: 'evidence', entityId: evidenceId });
    return ok(request, { archived: true });
  } catch (error) { return fail(request, error); }
}

