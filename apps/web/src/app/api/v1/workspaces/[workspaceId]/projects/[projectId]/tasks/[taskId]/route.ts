import { NextRequest } from 'next/server';
import { requireProject, requireWorkspace } from '@/lib/api-v1/auth';
import { updateTaskSchema } from '@/lib/api-v1/schemas';
import { ApiError, fail, jsonBody, ok } from '@/lib/api-v1/http';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { recordActivity } from '@/lib/api-v1/data';

type Params = { params: Promise<{ workspaceId: string; projectId: string; taskId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId, projectId, taskId } = await params;
    const ctx = await requireWorkspace(request, workspaceId);
    await requireProject(ctx, projectId, 'write');
    const input = await jsonBody(request, updateTaskSchema);
    const { data, error } = await getSupabaseAdmin().from('task_issues').update({ ...input, updated_at: new Date().toISOString() })
      .eq('issue_id', taskId).eq('project_id', projectId).select().maybeSingle();
    if (error) throw new ApiError(500, 'TASK_UPDATE_FAILED', 'No se pudo actualizar la tarea');
    if (!data) throw new ApiError(404, 'TASK_NOT_FOUND', 'Tarea no encontrada');
    await recordActivity({ workspaceId, projectId, actorId: ctx.payload.sub, action: 'task.updated', entityType: 'task', entityId: taskId });
    return ok(request, data);
  } catch (error) { return fail(request, error); }
}

