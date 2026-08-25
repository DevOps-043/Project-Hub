import { NextRequest } from 'next/server';
import { isWorkspaceAdmin, requireProject, requireWorkspace } from '@/lib/api-v1/auth';
import { updateMemberSchema } from '@/lib/api-v1/schemas';
import { ApiError, fail, jsonBody, ok } from '@/lib/api-v1/http';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { enqueueIntegration, recordActivity } from '@/lib/api-v1/data';

type Params = { params: Promise<{ workspaceId: string; projectId: string; memberId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId, projectId, memberId } = await params;
    const ctx = await requireWorkspace(request, workspaceId);
    const projectAccess = await requireProject(ctx, projectId, 'admin');
    const { role } = await jsonBody(request, updateMemberSchema);
    const elevated = ['owner', 'admin'].includes(role);
    const updatedAt = new Date().toISOString();
    const supabase = getSupabaseAdmin();
    const { data: current } = await supabase.from('pm_project_members').select('project_role')
      .eq('member_id', memberId).eq('project_id', projectId).eq('membership_status', 'active').maybeSingle();
    if (!current) throw new ApiError(404, 'MEMBER_NOT_FOUND', 'Miembro no encontrado');
    if (current.project_role === 'owner' && role !== 'owner') {
      throw new ApiError(409, 'OWNERSHIP_TRANSFER_REQUIRED', 'Transfiere ownership a otro miembro');
    }
    if (role === 'owner' && projectAccess.role !== 'owner' && !isWorkspaceAdmin(ctx)) {
      throw new ApiError(403, 'OWNER_REQUIRED', 'Solo el owner o un administrador del workspace puede transferir ownership');
    }
    const mutation = role === 'owner'
      ? await supabase.rpc('project_hub_transfer_ownership', {
        p_project_id: projectId, p_target_member_id: memberId, p_actor_user_id: ctx.payload.sub,
      })
      : await supabase.from('pm_project_members').update({
        project_role: role, can_edit: !['viewer', 'guest'].includes(role), can_delete: false,
        can_manage_members: elevated, can_manage_settings: elevated, updated_at: updatedAt,
      }).eq('member_id', memberId).eq('project_id', projectId).eq('membership_status', 'active').select().maybeSingle();
    const data = Array.isArray(mutation.data) ? mutation.data[0] : mutation.data;
    const error = mutation.error;
    if (error) throw new ApiError(500, 'MEMBER_UPDATE_FAILED', 'No se pudo actualizar el miembro');
    if (!data) throw new ApiError(404, 'MEMBER_NOT_FOUND', 'Miembro no encontrado');
    await enqueueIntegration({ workspaceId, projectId, aggregateType: 'project_member', aggregateId: memberId,
      eventType: 'project.member.upserted', idempotencyKey: `member:${memberId}:${updatedAt}`,
      payload: {
        project_id: projectId, user_id: data.user_id, role,
        access: ['viewer', 'guest'].includes(role) ? 'read' : 'edit',
        sofia_org_id: ctx.workspace.sofia_org_id,
      },
    });
    await recordActivity({ workspaceId, projectId, actorId: ctx.payload.sub, action: 'member.role_changed', entityType: 'member', entityId: memberId });
    return ok(request, data);
  } catch (error) { return fail(request, error); }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId, projectId, memberId } = await params;
    const ctx = await requireWorkspace(request, workspaceId);
    await requireProject(ctx, projectId, 'admin');
    const removedAt = new Date().toISOString();
    const { data, error } = await getSupabaseAdmin().from('pm_project_members').update({
      membership_status: 'removed', removed_at: removedAt, removed_by_user_id: ctx.payload.sub, updated_at: removedAt,
    }).eq('member_id', memberId).eq('project_id', projectId).neq('project_role', 'owner').select().maybeSingle();
    if (error) throw new ApiError(500, 'MEMBER_REMOVE_FAILED', 'No se pudo remover el miembro');
    if (!data) throw new ApiError(409, 'OWNER_CANNOT_BE_REMOVED', 'Transfiere ownership antes de remover al owner');
    await enqueueIntegration({ workspaceId, projectId, aggregateType: 'project_member', aggregateId: memberId,
      eventType: 'project.member.removed', idempotencyKey: `member:${memberId}:removed:${removedAt}`,
      payload: { project_id: projectId, user_id: data.user_id, revoke: true, sofia_org_id: ctx.workspace.sofia_org_id },
    });
    await recordActivity({ workspaceId, projectId, actorId: ctx.payload.sub, action: 'member.removed', entityType: 'member', entityId: memberId });
    return ok(request, { removed: true });
  } catch (error) { return fail(request, error); }
}
