
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/require-role';
import { isUuid } from '@/lib/http/validation';

export const runtime = 'nodejs';

interface IssueWithStatusRow {
  issue_id: string;
  status_id: string;
  task_statuses: { status_type: string } | { status_type: string }[] | null;
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // Params es una promesa
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { id: projectId } = await params; // Await params

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    // 1. Obtener detalles del proyecto con relaciones
    // Verificar si es UUID o Key de proyecto
    const isUUID = isUuid(projectId);
    
    let query = supabaseAdmin
      .from('pm_projects')
      .select(`
        *,
        lead:account_users!pm_projects_lead_user_id_fkey (
          user_id,
          first_name,
          last_name_paternal,
          display_name,
          avatar_url,
          email
        ),
        team:teams!pm_projects_team_id_fkey (
          team_id,
          name,
          color
        ),
        milestones:pm_milestones (
          milestone_id,
          milestone_name,
          milestone_status,
          due_date:target_date,
          progress_percentage:sort_order
        ),
        workspace:workspaces!pm_projects_workspace_id_fkey (
          workspace_id,
          slug,
          name,
          settings
        )
      `);

    if (isUUID) {
      query = query.eq('project_id', projectId);
    } else {
      query = query.eq('project_key', projectId);
    }

    const { data: project, error } = await query.single();

    if (error) {
      console.error('Error fetching project:', error);
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 2. Calcular progreso basado en Issues del proyecto
    const { data: issuesWithStatus } = await supabaseAdmin
      .from('task_issues')
      .select('issue_id, status_id, task_statuses!inner(status_type)')
      .eq('project_id', project.project_id);

    const allIssues = (issuesWithStatus || []) as unknown as IssueWithStatusRow[];
    const totalIssues = allIssues.length;
    const doneIssues = allIssues.filter((i) => issueStatusType(i) === 'done').length;
    const inProgressIssues = allIssues.filter((i) => issueStatusType(i) === 'in_progress').length;
    const cancelledIssues = allIssues.filter((i) => issueStatusType(i) === 'cancelled').length;
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

    // Actualizar completion_percentage en la BD
    if (useIssues && project.completion_percentage !== issuePercentage) {
      await supabaseAdmin
        .from('pm_projects')
        .update({ completion_percentage: issuePercentage })
        .eq('project_id', project.project_id);
    }

    // Obtener historial de progreso real si existe
    const { data: historyData } = await supabaseAdmin
      .from('pm_project_progress_history')
      .select('recorded_at, completion_percentage')
      .eq('project_id', projectId)
      .order('recorded_at', { ascending: true })
      .limit(10);

    const progress = {
      scope: useIssues ? totalIssues : totalMilestones,
      started: useIssues ? inProgressIssues : inProgressMilestones,
      completed: useIssues ? doneIssues : completedMilestones,
      percentage,
      history: historyData?.map(h => ({
        date: h.recorded_at,
        completed: h.completion_percentage
      })) || []
    };

    return NextResponse.json({
      project,
      progress
    });

  } catch (err) {
    console.error('Error in GET /api/admin/projects/[id]:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// PATCH - Update project
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { id: projectId } = await params;

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const body = await request.json();
    
    // Allowed fields to update
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

    // If updating target_date, also update start_date if target would be before it
    if (body.target_date) {
      // Get current project to check dates
      const { data: currentProject } = await supabaseAdmin
        .from('pm_projects')
        .select('start_date, target_date')
        .eq('project_id', projectId)
        .single();
      
      if (currentProject) {
        const newTargetDate = new Date(body.target_date);
        const currentStartDate = currentProject.start_date ? new Date(currentProject.start_date) : null;
        
        // If start_date is after new target_date, set start_date to same as target_date
        if (currentStartDate && newTargetDate < currentStartDate) {
          updateData.start_date = body.target_date;
        }
        // If no start_date, set it to target_date
        if (!currentStartDate) {
          updateData.start_date = body.target_date;
        }
      }
    }

    const { data: project, error } = await supabaseAdmin
      .from('pm_projects')
      .update(updateData)
      .eq('project_id', projectId)
      .select(`
        *,
        lead:account_users!pm_projects_lead_user_id_fkey (
          user_id,
          first_name,
          last_name_paternal,
          display_name,
          avatar_url
        ),
        team:teams!pm_projects_team_id_fkey (
          team_id,
          name,
          color
        )
      `)
      .single();

    if (error) {
      console.error('Error updating project:', error);
      
      // Handle specific constraint errors
      if (error.code === '23514' && error.message?.includes('chk_project_dates')) {
        return NextResponse.json({ 
          error: 'La fecha objetivo debe ser posterior a la fecha de inicio' 
        }, { status: 400 });
      }
      
      return NextResponse.json({ error: 'Error al actualizar proyecto' }, { status: 500 });
    }

    return NextResponse.json({ project });

  } catch (err) {
    console.error('Error in PATCH /api/admin/projects/[id]:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// DELETE - Archive project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { id: projectId } = await params;

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('pm_projects')
      .update({
        project_status: 'archived',
        updated_at: new Date().toISOString()
      })
      .eq('project_id', projectId);

    if (error) {
      console.error('Error archiving project:', error);
      return NextResponse.json({ error: 'Error al archivar proyecto' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error('Error in DELETE /api/admin/projects/[id]:', err);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
