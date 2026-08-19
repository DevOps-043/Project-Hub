import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { requireWorkspaceMember } from '@/lib/auth/require-role';
import { isUuid } from '@/lib/http/validation';

type RouteParams = { params: Promise<{ slug: string; id: string }> };

interface IssueWithStatusRow {
  issue_id: string;
  status_id: string;
  task_statuses: { status_type: string; is_closed: boolean } | { status_type: string; is_closed: boolean }[] | null;
}

interface MilestoneRow {
  milestone_id: string;
  milestone_name: string;
  milestone_status: string;
  due_date: string | null;
  progress_percentage: number | null;
}

function issueStatusType(issue: IssueWithStatusRow): string | undefined {
  return Array.isArray(issue.task_statuses) ? issue.task_statuses[0]?.status_type : issue.task_statuses?.status_type;
}

/**
 * GET /api/workspaces/:slug/projects/:id
 * Obtiene el detalle de un proyecto con validación de workspace y permisos.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug, id: projectId } = await params;
    const auth = await requireWorkspaceMember(request, slug);
    if (!auth.ok) return auth.response;
    const { payload, workspace, member } = auth;

    const supabase = getSupabaseAdmin();

    // Obtener proyecto con relaciones
    // Verificar si es UUID o Key de proyecto
    const isUUID = isUuid(projectId);
    
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
      // Si el proyecto no tiene workspace_id pero su equipo pertenece a este workspace,
      // auto-corregir asignando el workspace_id correcto
      if (!project.workspace_id && project.team_id) {
        const { data: teamData } = await supabase
          .from('teams')
          .select('workspace_id')
          .eq('team_id', project.team_id)
          .single();

        if (teamData?.workspace_id === workspace.workspace_id) {
          // Auto-fix: asignar workspace_id al proyecto
          await supabase
            .from('pm_projects')
            .update({ workspace_id: workspace.workspace_id })
            .eq('project_id', project.project_id);
          project.workspace_id = workspace.workspace_id;
        } else {
          return NextResponse.json({ error: 'Proyecto no pertenece a este workspace' }, { status: 403 });
        }
      } else if (!project.workspace_id && project.created_by_user_id === payload.sub) {
        // Proyecto sin workspace_id creado por el usuario actual, auto-fix
        await supabase
          .from('pm_projects')
          .update({ workspace_id: workspace.workspace_id })
          .eq('project_id', project.project_id);
        project.workspace_id = workspace.workspace_id;
      } else {
        return NextResponse.json({ error: 'Proyecto no pertenece a este workspace' }, { status: 403 });
      }
    }

    // Para no-admin: verificar acceso via equipo, membresía directa, liderazgo o creación
    const isAdmin = ['owner', 'admin'].includes(member.iris_role);
    if (!isAdmin) {
      // Verificar si es el líder o creador del proyecto
      const isLead = project.lead_user_id === payload.sub;
      const isCreator = project.created_by_user_id === payload.sub;

      if (!isLead && !isCreator) {
        const { data: userTeams } = await supabase
          .from('team_members')
          .select('team_id')
          .eq('user_id', payload.sub)
          .eq('is_active', true);
        const userTeamIds = (userTeams || []).map((t) => t.team_id);

        // IMPORTANTE: usar project.project_id (UUID resuelto), no projectId del URL
        // ya que projectId podría ser un project_key (ej: "SOFL-001") y no un UUID
        const { data: userProjectMembership } = await supabase
          .from('pm_project_members')
          .select('project_id')
          .eq('user_id', payload.sub)
          .eq('project_id', project.project_id);

        const hasTeamAccess = project.team_id && userTeamIds.includes(project.team_id);
        const hasDirectAccess = (userProjectMembership || []).length > 0;

        if (!hasTeamAccess && !hasDirectAccess) {
          return NextResponse.json({ error: 'Sin acceso a este proyecto' }, { status: 403 });
        }
      }
    }

    // Calcular progreso basado en Issues del proyecto
    const { data: issuesWithStatus } = await supabase
      .from('task_issues')
      .select('issue_id, status_id, task_statuses!inner(status_type, is_closed)')
      .eq('project_id', project.project_id);

    const allIssues = (issuesWithStatus || []) as unknown as IssueWithStatusRow[];
    const totalIssues = allIssues.length;
    const doneIssues = allIssues.filter((i) => issueStatusType(i) === 'done').length;
    const inProgressIssues = allIssues.filter((i) => issueStatusType(i) === 'in_progress').length;
    const cancelledIssues = allIssues.filter((i) => issueStatusType(i) === 'cancelled').length;

    // Porcentaje: issues completadas / total (excluyendo canceladas del denominador)
    const effectiveTotal = totalIssues - cancelledIssues;
    const issuePercentage = effectiveTotal > 0
      ? Math.round((doneIssues / effectiveTotal) * 100)
      : 0;

    // Fallback a milestones si no hay issues
    const milestones = (project.milestones || []) as MilestoneRow[];
    const totalMilestones = milestones.length;
    const completedMilestones = milestones.filter((m) => m.milestone_status === 'completed').length;
    const inProgressMilestones = milestones.filter((m) => m.milestone_status === 'in_progress').length;

    const useIssues = totalIssues > 0;
    const percentage = useIssues
      ? issuePercentage
      : (totalMilestones > 0
        ? Math.round((completedMilestones / totalMilestones) * 100)
        : (project.completion_percentage || 0));

    // Actualizar completion_percentage en la BD para que la lista de proyectos lo refleje
    if (useIssues && project.completion_percentage !== issuePercentage) {
      await supabase
        .from('pm_projects')
        .update({ completion_percentage: issuePercentage })
        .eq('project_id', project.project_id);
    }

    const { data: historyData } = await supabase
      .from('pm_project_progress_history')
      .select('recorded_at, completion_percentage')
      .eq('project_id', project.project_id)
      .order('recorded_at', { ascending: true })
      .limit(10);

    const progress = {
      scope: useIssues ? totalIssues : totalMilestones,
      started: useIssues ? inProgressIssues : inProgressMilestones,
      completed: useIssues ? doneIssues : completedMilestones,
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

/**
 * PATCH /api/workspaces/:slug/projects/:id
 * Actualiza un proyecto con validación de workspace y permisos.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug, id: projectId } = await params;
    const auth = await requireWorkspaceMember(request, slug);
    if (!auth.ok) return auth.response;
    const { workspace, member } = auth;

    if (!['owner', 'admin', 'manager', 'leader'].includes(member.iris_role)) {
      return NextResponse.json({ error: 'Sin permisos para editar proyectos' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    // Verificar que el proyecto pertenece al workspace
    const { data: existingProject, error: fetchError } = await supabase
      .from('pm_projects')
      .select('project_id, workspace_id')
      .eq('project_id', projectId)
      .single();

    if (fetchError || !existingProject) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    if (existingProject.workspace_id && existingProject.workspace_id !== workspace.workspace_id) {
      return NextResponse.json({ error: 'Proyecto no pertenece a este workspace' }, { status: 403 });
    }

    const body = await request.json();

    const allowedFields = [
      'project_name', 'project_description', 'project_status', 'priority_level',
      'health_status', 'completion_percentage', 'start_date', 'target_date',
      'lead_user_id', 'team_id', 'icon_name', 'icon_color', 'tags'
    ];

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Date validation: if target_date moves before start_date, adjust
    if (body.target_date) {
      const { data: currentProject } = await supabase
        .from('pm_projects')
        .select('start_date, target_date')
        .eq('project_id', projectId)
        .single();

      if (currentProject) {
        const newTargetDate = new Date(body.target_date);
        const currentStartDate = currentProject.start_date ? new Date(currentProject.start_date) : null;

        if (currentStartDate && newTargetDate < currentStartDate) {
          updateData.start_date = body.target_date;
        }
        if (!currentStartDate) {
          updateData.start_date = body.target_date;
        }
      }
    }

    const { data: project, error } = await supabase
      .from('pm_projects')
      .update(updateData)
      .eq('project_id', projectId)
      .select(`
        *,
        lead:account_users!pm_projects_lead_user_id_fkey (
          user_id, first_name, last_name_paternal, display_name, avatar_url
        ),
        team:teams!pm_projects_team_id_fkey (
          team_id, name, color
        )
      `)
      .single();

    if (error) {
      console.error('Error updating project:', error);

      if (error.code === '23514' && error.message?.includes('chk_project_dates')) {
        return NextResponse.json({
          error: 'La fecha objetivo debe ser posterior a la fecha de inicio'
        }, { status: 400 });
      }

      return NextResponse.json({ error: 'Error al actualizar proyecto' }, { status: 500 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error('Error en PATCH workspace project:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
