import { NextRequest } from 'next/server';
import { requireProject, requireWorkspace } from '@/lib/api-v1/auth';
import { addMemberSchema } from '@/lib/api-v1/schemas';
import { ApiError, fail, jsonBody, ok } from '@/lib/api-v1/http';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { enqueueIntegration, recordActivity } from '@/lib/api-v1/data';

type Params = { params: Promise<{ workspaceId: string; projectId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId, projectId } = await params;
    const ctx = await requireWorkspace(request, workspaceId);
    await requireProject(ctx, projectId);
    const { data, error } = await getSupabaseAdmin().from('pm_project_members').select(`
      member_id,project_role,membership_status,joined_at,updated_at,removed_at,
      user:account_users!pm_project_members_user_id_fkey(user_id,display_name,email,avatar_url)
    `).eq('project_id', projectId).eq('membership_status', 'active').order('joined_at');
    if (error) throw new ApiError(500, 'MEMBER_LIST_FAILED', 'No se pudieron listar los miembros');
    return ok(request, data || []);
  } catch (error) { return fail(request, error); }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId, projectId } = await params;
    const ctx = await requireWorkspace(request, workspaceId);
    await requireProject(ctx, projectId, 'admin');
    const input = await jsonBody(request, addMemberSchema);
    const supabase = getSupabaseAdmin();
    const { data: workspaceMember } = await supabase.from('workspace_members').select('user_id')
      .eq('workspace_id', workspaceId).eq('user_id', input.user_id).eq('is_active', true).maybeSingle();
    if (!workspaceMember) throw new ApiError(422, 'WORKSPACE_MEMBER_REQUIRED', 'El usuario no pertenece al workspace');
    const elevated = ['owner', 'admin'].includes(input.role);
    const { data, error } = await supabase.from('pm_project_members').upsert({
      project_id: projectId, user_id: input.user_id, project_role: input.role,
      membership_status: 'active', removed_at: null, removed_by_user_id: null,
      invited_by_user_id: ctx.payload.sub, updated_at: new Date().toISOString(),
      can_edit: !['viewer', 'guest'].includes(input.role), can_delete: input.role === 'owner',
      can_manage_members: elevated, can_manage_settings: elevated,
    }, { onConflict: 'project_id,user_id' }).select().single();
    if (error || !data) throw new ApiError(500, 'MEMBER_ADD_FAILED', 'No se pudo agregar al miembro');
    await enqueueIntegration({ workspaceId, projectId, aggregateType: 'project_member', aggregateId: data.member_id,
      eventType: 'project.member.upserted', idempotencyKey: `member:${data.member_id}:${data.updated_at}`,
      payload: {
        project_id: projectId, user_id: input.user_id, role: input.role,
        access: ['viewer', 'guest'].includes(input.role) ? 'read' : 'edit',
        sofia_org_id: ctx.workspace.sofia_org_id,
      },
    });
    await recordActivity({ workspaceId, projectId, actorId: ctx.payload.sub, action: 'member.added', entityType: 'member', entityId: data.member_id });
    return ok(request, data, { status: 201 });
  } catch (error) { return fail(request, error); }
}
