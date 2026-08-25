import { NextRequest } from 'next/server';
import { requireAuth, type WorkspaceAuthResult } from '@/lib/auth/require-role';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { ApiError, enforceRateLimit } from './http';

export type WorkspaceContext = Extract<WorkspaceAuthResult, { ok: true }>;
export type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer' | 'guest';

export async function requireWorkspace(request: NextRequest, workspaceId: string): Promise<WorkspaceContext> {
  if (process.env.PROJECT_HUB_API_V1 === 'false') throw new ApiError(503, 'FEATURE_DISABLED', 'Project Hub API v1 no está habilitada');
  const auth = await requireAuth(request);
  if (!auth.ok) throw new ApiError(auth.response.status, 'UNAUTHORIZED', 'No autorizado');
  enforceRateLimit(request, auth.payload.sub);

  const supabase = getSupabaseAdmin();
  const [{ data: workspace }, { data: member }] = await Promise.all([
    supabase.from('workspaces').select('*').eq('workspace_id', workspaceId).eq('is_active', true).maybeSingle(),
    supabase.from('workspace_members').select('*').eq('workspace_id', workspaceId)
      .eq('user_id', auth.payload.sub).eq('is_active', true).maybeSingle(),
  ]);
  if (!workspace || !member) throw new ApiError(403, 'WORKSPACE_FORBIDDEN', 'Sin acceso al workspace');
  return { ok: true, payload: auth.payload, workspace, member } as WorkspaceContext;
}

export function isWorkspaceAdmin(ctx: WorkspaceContext): boolean {
  return ['owner', 'admin'].includes(ctx.member.iris_role);
}

export async function requireProject(
  ctx: WorkspaceContext,
  projectId: string,
  required: 'read' | 'write' | 'admin' = 'read',
) {
  const supabase = getSupabaseAdmin();
  const { data: project } = await supabase.from('pm_projects').select('*')
    .eq('project_id', projectId).eq('workspace_id', ctx.workspace.workspace_id).maybeSingle();
  if (!project) throw new ApiError(404, 'PROJECT_NOT_FOUND', 'Proyecto no encontrado');
  if (isWorkspaceAdmin(ctx)) return { project, role: 'admin' as ProjectRole };

  const { data: membership } = await supabase.from('pm_project_members')
    .select('project_role,membership_status').eq('project_id', projectId)
    .eq('user_id', ctx.payload.sub).eq('membership_status', 'active').maybeSingle();
  if (!membership) throw new ApiError(403, 'PROJECT_FORBIDDEN', 'Sin acceso al proyecto');
  const role = membership.project_role as ProjectRole;
  if (required === 'write' && ['viewer', 'guest'].includes(role)) {
    throw new ApiError(403, 'PROJECT_READ_ONLY', 'El rol solo permite lectura');
  }
  if (required === 'admin' && !['owner', 'admin'].includes(role)) {
    throw new ApiError(403, 'PROJECT_ADMIN_REQUIRED', 'Se requiere administrar el proyecto');
  }
  return { project, role };
}

export async function resolveProjectTeam(workspaceId: string, requested?: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  // `teams` usa el estado textual active/archived/suspended. `is_active`
  // pertenece a `team_members`; filtrarlo aquí hacía que PostgREST devolviera
  // error de columna y todos los workspaces parecieran no tener equipos.
  const query = supabase.from('teams').select('team_id').eq('workspace_id', workspaceId).eq('status', 'active');
  const { data } = requested ? await query.eq('team_id', requested).maybeSingle() : await query.order('created_at').limit(1).maybeSingle();
  if (!data) throw new ApiError(422, 'TEAM_REQUIRED', 'El workspace necesita un equipo activo');
  return data.team_id;
}
