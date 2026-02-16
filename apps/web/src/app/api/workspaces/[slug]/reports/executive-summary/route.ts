import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getWorkspaceBySlug, getUserWorkspaceRole } from '@/lib/services/workspace-service';
import { verifyToken } from '@/lib/auth/jwt';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const token = request.cookies.get('accessToken')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalido' }, { status: 401 });

    const workspace = await getWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: 'Workspace no encontrado' }, { status: 404 });

    const member = await getUserWorkspaceRole(workspace.workspace_id, payload.sub);
    if (!member) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

    const supabase = getSupabaseAdmin();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());

    // Projects scoped to workspace
    const { data: projects } = await supabase
      .from('pm_projects')
      .select('project_id, project_name, project_status, created_at, start_date, target_date')
      .eq('workspace_id', workspace.workspace_id);

    const activeProjects = projects?.filter(p => ['active', 'in_progress'].includes(p.project_status)) || [];
    const completedProjects = projects?.filter(p => p.project_status === 'completed') || [];
    const planningProjects = projects?.filter(p => p.project_status === 'planning') || [];
    const onHoldProjects = projects?.filter(p => p.project_status === 'on_hold') || [];

    const projectsAtRisk = projects?.filter(p => {
      if (p.project_status === 'completed') return false;
      if (!p.target_date) return false;
      return new Date(p.target_date) < now;
    }) || [];

    // Teams scoped to workspace
    const { data: wsTeams } = await supabase
      .from('teams')
      .select('team_id')
      .eq('workspace_id', workspace.workspace_id);
    const teamIds = (wsTeams || []).map(t => t.team_id);

    // Tasks scoped to workspace teams
    let issues: any[] = [];
    if (teamIds.length > 0) {
      const { data } = await supabase
        .from('task_issues')
        .select(`
          issue_id, title, status_id, priority_id, assignee_id,
          created_at, completed_at, due_date,
          status:task_statuses(name, status_type),
          priority:task_priorities(name, level)
        `)
        .in('team_id', teamIds);
      issues = data || [];
    }

    const completedIssues = issues.filter(i => i.completed_at !== null);
    const openIssues = issues.filter(i => i.completed_at === null);
    const highPriorityIssues = issues.filter(i => (i.priority as any)?.level >= 3);
    const urgentIssues = issues.filter(i => (i.priority as any)?.level === 4);

    const overdueIssues = issues.filter(i => {
      if (i.completed_at) return false;
      if (!i.due_date) return false;
      return new Date(i.due_date) < now;
    });

    const completedThisWeek = issues.filter(i => i.completed_at && new Date(i.completed_at) >= startOfWeek);
    const completedThisMonth = issues.filter(i => i.completed_at && new Date(i.completed_at) >= startOfMonth);

    // Teams count
    const { count: membersTotal } = await supabase
      .from('team_members')
      .select('user_id', { count: 'exact', head: true })
      .in('team_id', teamIds.length > 0 ? teamIds : ['00000000-0000-0000-0000-000000000000']);

    // Top contributors
    const assigneeCounts: Record<string, number> = {};
    completedThisMonth.forEach(issue => {
      if (issue.assignee_id) {
        assigneeCounts[issue.assignee_id] = (assigneeCounts[issue.assignee_id] || 0) + 1;
      }
    });

    const topContributorIds = Object.entries(assigneeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);

    let topContributors: any[] = [];
    if (topContributorIds.length > 0) {
      const { data: users } = await supabase
        .from('account_users')
        .select('user_id, first_name, last_name_paternal, display_name')
        .in('user_id', topContributorIds);

      topContributors = topContributorIds.map(id => {
        const user = users?.find(u => u.user_id === id);
        return {
          user_id: id,
          name: user?.display_name || `${user?.first_name} ${user?.last_name_paternal}`,
          completed: assigneeCounts[id]
        };
      });
    }

    const completionRate = issues.length ? Math.round((completedIssues.length / issues.length) * 100) : 0;

    let avgCompletionTime = 0;
    if (completedThisMonth.length > 0) {
      const totalDays = completedThisMonth.reduce((sum, issue) => {
        const created = new Date(issue.created_at);
        const completed = new Date(issue.completed_at);
        return sum + Math.ceil((completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      }, 0);
      avgCompletionTime = Math.round(totalDays / completedThisMonth.length);
    }

    const reportData = {
      generatedAt: now.toISOString(),
      projects: {
        total: projects?.length || 0,
        active: activeProjects.length,
        completed: completedProjects.length,
        planning: planningProjects.length,
        onHold: onHoldProjects.length,
        atRisk: projectsAtRisk.length,
        atRiskList: projectsAtRisk.map(p => ({ name: p.project_name, targetDate: p.target_date }))
      },
      tasks: {
        total: issues.length,
        completed: completedIssues.length,
        open: openIssues.length,
        completionRate,
        overdue: overdueIssues.length,
        overdueList: overdueIssues.slice(0, 10).map(i => ({ title: i.title, dueDate: i.due_date })),
        highPriority: highPriorityIssues.length,
        urgent: urgentIssues.length,
        completedThisWeek: completedThisWeek.length,
        completedThisMonth: completedThisMonth.length,
        avgCompletionDays: avgCompletionTime
      },
      teams: {
        total: teamIds.length,
        totalMembers: membersTotal || 0
      },
      users: { active: membersTotal || 0 },
      cycles: { active: 0, list: [] },
      topContributors,
      riskAnalysis: {
        level: projectsAtRisk.length > 2 || overdueIssues.length > 10 ? 'Alto'
             : projectsAtRisk.length > 0 || overdueIssues.length > 5 ? 'Medio'
             : 'Bajo',
        factors: [
          ...(projectsAtRisk.length > 0 ? [`${projectsAtRisk.length} proyecto(s) pasados de fecha limite`] : []),
          ...(overdueIssues.length > 0 ? [`${overdueIssues.length} tarea(s) vencidas sin completar`] : []),
          ...(urgentIssues.length > 5 ? [`${urgentIssues.length} tareas de prioridad urgente pendientes`] : []),
          ...(completionRate < 40 ? [`Tasa de finalizacion baja (${completionRate}%)`] : [])
        ],
        recommendations: [
          ...(projectsAtRisk.length > 0 ? ['Revisar proyectos en riesgo y reasignar recursos'] : []),
          ...(overdueIssues.length > 5 ? ['Priorizar tareas vencidas para recuperar el flujo'] : []),
          ...(completedThisWeek.length < 5 ? ['Considerar aumentar el ritmo de cierre de tareas'] : []),
          ...(topContributors.length < 3 ? ['Distribuir la carga de trabajo entre mas miembros'] : [])
        ]
      }
    };

    return NextResponse.json(reportData);
  } catch (err) {
    console.error('Workspace report error:', err);
    return NextResponse.json({ error: 'Error generating report' }, { status: 500 });
  }
}
