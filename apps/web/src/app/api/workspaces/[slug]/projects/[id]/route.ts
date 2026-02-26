import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getWorkspaceBySlug, getUserWorkspaceRole } from '@/lib/services/workspace-service';
import { verifyToken } from '@/lib/auth/jwt';

type RouteParams = { params: Promise<{ slug: string; id: string }> };

/**
 * GET /api/workspaces/:slug/projects/:id
 * Obtiene el detalle de un proyecto con validación de workspace y permisos.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug, id: projectId } = await params;
    const token = request.cookies.get('accessToken')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    const workspace = await getWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: 'Workspace no encontrado' }, { status: 404 });

    const member = await getUserWorkspaceRole(workspace.workspace_id, payload.sub);
    if (!member) return NextResponse.json({ error: 'Sin acceso al workspace' }, { status: 403 });

    const supabase = getSupabaseAdmin();

    // Obtener proyecto con relaciones
    // Verificar si es UUID o Key de proyecto
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
    
    let query = supabase
      .from('pm_projects')
      .select(`
        *,
        lead:account_users!pm_projects_lead_user_id_fkey (
          user_id, first_name, last_name_paternal, display_name, avatar_url, email
        ),
        team:teams!pm_projects_team_id_fkey (
          team_id, name, color
        ),
        milestones:pm_milestones (
          milestone_id, milestone_name, milestone_status,
          due_date:target_date, progress_percentage:sort_order
        )
      `);

    if (isUUID) {
      query = query.eq('project_id', projectId);
    } else {
      query = query.eq('project_key', projectId);
    }

    const { data: project, error } = await query.single();

    if (error || !project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    // Verificar que el proyecto pertenece al workspace
    if (project.workspace_id !== workspace.workspace_id) {
      return NextResponse.json({ error: 'Proyecto no pertenece a este workspace' }, { status: 403 });
    }

    // Para no-admin: verificar acceso via equipo o membresía directa
    const isAdmin = ['owner', 'admin'].includes(member.iris_role);
    if (!isAdmin) {
      const { data: userTeams } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', payload.sub)
        .eq('is_active', true);
      const userTeamIds = (userTeams || []).map((t: any) => t.team_id);

      const { data: userProjectMembership } = await supabase
        .from('pm_project_members')
        .select('project_id')
        .eq('user_id', payload.sub)
        .eq('project_id', projectId);

      const hasTeamAccess = project.team_id && userTeamIds.includes(project.team_id);
      const hasDirectAccess = (userProjectMembership || []).length > 0;

      if (!hasTeamAccess && !hasDirectAccess) {
        return NextResponse.json({ error: 'Sin acceso a este proyecto' }, { status: 403 });
      }
    }

    // Calcular progreso basado en Milestones
    const milestones = project.milestones || [];
    const totalMilestones = milestones.length;
    const completedMilestones = milestones.filter((m: any) => m.milestone_status === 'completed').length;
    const inProgressMilestones = milestones.filter((m: any) => m.milestone_status === 'in_progress').length;

    const percentage = totalMilestones > 0
      ? Math.round((completedMilestones / totalMilestones) * 100)
      : (project.completion_percentage || 0);

    const { data: historyData } = await supabase
      .from('pm_project_progress_history')
      .select('recorded_at, completion_percentage')
      .eq('project_id', projectId)
      .order('recorded_at', { ascending: true })
      .limit(10);

    const progress = {
      scope: totalMilestones,
      started: inProgressMilestones,
      completed: completedMilestones,
      percentage,
      history: historyData?.map(h => ({
        date: h.recorded_at,
        completed: h.completion_percentage,
      })) || [],
    };

    return NextResponse.json({ project, progress });
  } catch (error) {
    console.error('Error en GET workspace project detail:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
