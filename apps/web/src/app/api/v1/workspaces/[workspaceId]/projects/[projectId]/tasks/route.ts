import { NextRequest } from 'next/server';
import { requireProject, requireWorkspace } from '@/lib/api-v1/auth';
import { createTaskSchema } from '@/lib/api-v1/schemas';
import { ApiError, decodeCursor, encodeCursor, fail, jsonBody, ok } from '@/lib/api-v1/http';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { recordActivity } from '@/lib/api-v1/data';

type Params = { params: Promise<{ workspaceId: string; projectId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId, projectId } = await params;
    const ctx = await requireWorkspace(request, workspaceId);
    await requireProject(ctx, projectId);
    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit') || 50), 1), 100);
    const cursor = decodeCursor(request.nextUrl.searchParams.get('cursor'));
    let query = getSupabaseAdmin().from('task_issues').select(`
      *, task_statuses(status_id,name,status_type,color,is_closed),
      task_priorities(priority_id,name,priority_level,color),
      assignee:account_users!task_issues_assignee_id_fkey(user_id,display_name,email,avatar_url)
    `).eq('project_id', projectId).is('archived_at', null)
      .order('created_at', { ascending: false }).order('issue_id', { ascending: false }).limit(limit + 1);
    if (cursor) query = query.or(`created_at.lt.${cursor.updated_at},and(created_at.eq.${cursor.updated_at},issue_id.lt.${cursor.id})`);
    const { data, error } = await query;
    if (error) throw new ApiError(500, 'TASK_LIST_FAILED', 'No se pudieron listar las tareas');
    const rows = data || [];
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return ok(request, page, undefined, { has_more: hasMore,
      next_cursor: hasMore && last ? encodeCursor({ updated_at: last.created_at, id: last.issue_id }) : null });
  } catch (error) { return fail(request, error); }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId, projectId } = await params;
    const ctx = await requireWorkspace(request, workspaceId);
    const { project } = await requireProject(ctx, projectId, 'write');
    const input = await jsonBody(request, createTaskSchema);
    if (!project.team_id) throw new ApiError(422, 'PROJECT_TEAM_REQUIRED', 'El proyecto requiere un equipo');
    const supabase = getSupabaseAdmin();
    const [{ data: last }, { data: defaultStatus }] = await Promise.all([
      supabase.from('task_issues').select('issue_number').eq('team_id', project.team_id).order('issue_number', { ascending: false }).limit(1).maybeSingle(),
      input.status_id
        ? supabase.from('task_statuses').select('status_id').eq('team_id', project.team_id).eq('status_id', input.status_id).maybeSingle()
        : supabase.from('task_statuses').select('status_id').eq('team_id', project.team_id).eq('is_closed', false).order('is_default', { ascending: false }).order('position').limit(1).maybeSingle(),
    ]);
    if (!defaultStatus) throw new ApiError(422, 'STATUS_REQUIRED', 'El equipo necesita un estado abierto');
    const { data: issue, error } = await supabase.from('task_issues').insert({
      team_id: project.team_id, issue_number: (last?.issue_number || 0) + 1,
      project_id: projectId, creator_id: ctx.payload.sub, title: input.title,
      description: input.description, status_id: defaultStatus.status_id,
      priority_id: input.priority_id, assignee_id: input.assignee_id, due_date: input.due_date,
    }).select().single();
    if (error || !issue) throw new ApiError(500, 'TASK_CREATE_FAILED', 'No se pudo crear la tarea', error?.message);
    if (input.evidence_id) {
      await supabase.from('task_issue_evidence').insert({
        issue_id: issue.issue_id, evidence_id: input.evidence_id, evidence_item_id: input.evidence_item_id,
        relation_type: 'supports', created_by_user_id: ctx.payload.sub,
      });
    }
    await recordActivity({ workspaceId, projectId, actorId: ctx.payload.sub, action: 'task.created', entityType: 'task', entityId: issue.issue_id });
    return ok(request, issue, { status: 201 });
  } catch (error) { return fail(request, error); }
}
