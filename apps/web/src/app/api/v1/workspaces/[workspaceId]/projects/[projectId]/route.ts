import { NextRequest } from 'next/server';
import { requireProject, requireWorkspace } from '@/lib/api-v1/auth';
import { updateProjectSchema } from '@/lib/api-v1/schemas';
import { fail, jsonBody, ok, ApiError } from '@/lib/api-v1/http';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { recordActivity } from '@/lib/api-v1/data';

type Params = { params: Promise<{ workspaceId: string; projectId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId, projectId } = await params;
    const ctx = await requireWorkspace(request, workspaceId);
    const access = await requireProject(ctx, projectId);
    return ok(request, { ...access.project, role: access.role });
  } catch (error) { return fail(request, error); }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId, projectId } = await params;
    const ctx = await requireWorkspace(request, workspaceId);
    await requireProject(ctx, projectId, 'admin');
    const input = await jsonBody(request, updateProjectSchema);
    const fieldMap: Record<string, string> = { name: 'project_name', description: 'project_description', status: 'project_status', priority: 'priority_level', health: 'health_status' };
    const updates = Object.fromEntries(Object.entries(input).map(([key, value]) => [fieldMap[key] || key, value]));
    updates.updated_at = new Date().toISOString();
    if (input.status === 'archived') updates.archived_at = new Date().toISOString();
    const { data, error } = await getSupabaseAdmin().from('pm_projects').update(updates)
      .eq('project_id', projectId).eq('workspace_id', workspaceId).select().single();
    if (error || !data) throw new ApiError(500, 'PROJECT_UPDATE_FAILED', 'No se pudo actualizar el proyecto');
    await recordActivity({ workspaceId, projectId, actorId: ctx.payload.sub, action: input.status === 'archived' ? 'project.archived' : 'project.updated', entityType: 'project', entityId: projectId });
    return ok(request, data);
  } catch (error) { return fail(request, error); }
}

export async function DELETE(request: NextRequest, context: Params) {
  const { workspaceId, projectId } = await context.params;
  const forwarded = new NextRequest(request.url, { method: 'PATCH', headers: request.headers, body: JSON.stringify({ status: 'archived' }) });
  return PATCH(forwarded, { params: Promise.resolve({ workspaceId, projectId }) });
}

