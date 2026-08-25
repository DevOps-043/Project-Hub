import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { isWorkspaceAdmin, requireWorkspace, resolveProjectTeam } from '@/lib/api-v1/auth';
import { createProjectSchema } from '@/lib/api-v1/schemas';
import { ApiError, decodeCursor, encodeCursor, fail, jsonBody, ok } from '@/lib/api-v1/http';
import { enqueueIntegration, projectKey, recordActivity } from '@/lib/api-v1/data';

type Params = { params: Promise<{ workspaceId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await params;
    const ctx = await requireWorkspace(request, workspaceId);
    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit') || 25), 1), 100);
    const cursor = decodeCursor(request.nextUrl.searchParams.get('cursor'));
    const search = request.nextUrl.searchParams.get('search')?.trim();
    const supabase = getSupabaseAdmin();
    let query = supabase.from('pm_projects')
      .select(isWorkspaceAdmin(ctx) ? '*' : '*, pm_project_members!inner(user_id,project_role,membership_status)')
      .eq('workspace_id', workspaceId).is('archived_at', null)
      .order('updated_at', { ascending: false }).order('project_id', { ascending: false }).limit(limit + 1);
    if (!isWorkspaceAdmin(ctx)) {
      query = query.eq('pm_project_members.user_id', ctx.payload.sub)
        .eq('pm_project_members.membership_status', 'active');
    }
    if (search) query = query.or(`project_name.ilike.%${search}%,project_key.ilike.%${search}%`);
    if (cursor) query = query.or(`updated_at.lt.${cursor.updated_at},and(updated_at.eq.${cursor.updated_at},project_id.lt.${cursor.id})`);
    const { data, error } = await query;
    if (error) throw new ApiError(500, 'PROJECT_LIST_FAILED', 'No se pudieron listar los proyectos');
    const rows = data || [];
    const hasMore = rows.length > limit;
    const projects = rows.slice(0, limit).map((row) => {
      const record = row as unknown as Record<string, unknown>;
      const members = Array.isArray(record.pm_project_members) ? record.pm_project_members : undefined;
      const { pm_project_members: _ignored, ...project } = record;
      void _ignored;
      return { ...project, ...(members ? { membership: members[0] } : {}) };
    });
    const last = projects.at(-1) as Record<string, unknown> | undefined;
    return ok(request, projects, undefined, {
      has_more: hasMore,
      next_cursor: hasMore && last ? encodeCursor({ updated_at: String(last.updated_at), id: String(last.project_id) }) : null,
    });
  } catch (error) { return fail(request, error); }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await params;
    const ctx = await requireWorkspace(request, workspaceId);
    const input = await jsonBody(request, createProjectSchema);
    const teamId = await resolveProjectTeam(workspaceId, input.team_id);
    const supabase = getSupabaseAdmin();
    const { data: project, error } = await supabase.from('pm_projects').insert({
      workspace_id: workspaceId, team_id: teamId, project_key: projectKey(input.name),
      project_name: input.name, project_description: input.description,
      priority_level: input.priority, lead_user_id: input.lead_user_id || ctx.payload.sub,
      created_by_user_id: ctx.payload.sub, start_date: input.start_date, target_date: input.target_date,
      tags: input.tags, project_status: 'planning', metadata: { source: 'soflia-hub' },
    }).select().single();
    if (error || !project) throw new ApiError(500, 'PROJECT_CREATE_FAILED', 'No se pudo crear el proyecto', error?.message);
    await supabase.from('pm_project_members').insert({
      project_id: project.project_id, user_id: ctx.payload.sub, project_role: 'owner',
      can_edit: true, can_delete: true, can_manage_members: true, can_manage_settings: true,
      membership_status: 'active',
    });
    await enqueueIntegration({
      workspaceId, projectId: project.project_id, aggregateType: 'project', aggregateId: project.project_id,
      eventType: 'project.chat_binding.requested', idempotencyKey: `project:${project.project_id}:chat-binding:v1`,
      payload: {
        project_id: project.project_id, project_name: project.project_name,
        owner_user_id: ctx.payload.sub, sofia_org_id: ctx.workspace.sofia_org_id,
      },
    });
    await recordActivity({ workspaceId, projectId: project.project_id, actorId: ctx.payload.sub, action: 'project.created', entityType: 'project', entityId: project.project_id });
    return ok(request, project, { status: 201 });
  } catch (error) { return fail(request, error); }
}
