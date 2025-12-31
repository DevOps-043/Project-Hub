import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Get date ranges
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());

    // 1. PROJECTS DATA
    const { data: projects, count: projectsTotal } = await supabaseAdmin
      .from('pm_projects')
      .select('project_id, project_name, project_status, created_at, start_date, target_end_date', { count: 'exact' });

    const activeProjects = projects?.filter(p => p.project_status === 'in_progress') || [];
    const completedProjects = projects?.filter(p => p.project_status === 'completed') || [];
    const planningProjects = projects?.filter(p => p.project_status === 'planning') || [];
    const onHoldProjects = projects?.filter(p => p.project_status === 'on_hold') || [];

    // Projects at risk (past target date and not completed)
    const projectsAtRisk = projects?.filter(p => {
      if (p.project_status === 'completed') return false;
      if (!p.target_end_date) return false;
      return new Date(p.target_end_date) < now;
    }) || [];

    // 2. TASKS/ISSUES DATA
    const { data: issues, count: issuesTotal } = await supabaseAdmin
      .from('task_issues')
      .select(`
        issue_id,
        title,
        status_id,
        priority_id,
        assignee_id,
        created_at,
        completed_at,
        due_date,
        status:task_statuses(name, status_type),
        priority:task_priorities(name, level)
      `, { count: 'exact' });

    const completedIssues = issues?.filter(i => i.completed_at !== null) || [];
    const openIssues = issues?.filter(i => i.completed_at === null) || [];
    
    // Issues by priority
    const highPriorityIssues = issues?.filter(i => (i.priority as any)?.level >= 3) || [];
    const urgentIssues = issues?.filter(i => (i.priority as any)?.level === 4) || [];

    // Overdue issues
    const overdueIssues = issues?.filter(i => {
      if (i.completed_at) return false;
      if (!i.due_date) return false;
      return new Date(i.due_date) < now;
    }) || [];

    // Issues created this week
    const issuesThisWeek = issues?.filter(i => new Date(i.created_at) >= startOfWeek) || [];
    const completedThisWeek = issues?.filter(i => i.completed_at && new Date(i.completed_at) >= startOfWeek) || [];

    // Issues created this month
    const issuesThisMonth = issues?.filter(i => new Date(i.created_at) >= startOfMonth) || [];
    const completedThisMonth = issues?.filter(i => i.completed_at && new Date(i.completed_at) >= startOfMonth) || [];

    // 3. TEAMS DATA
    const { count: teamsTotal } = await supabaseAdmin
      .from('teams')
      .select('team_id', { count: 'exact', head: true });

    const { count: membersTotal } = await supabaseAdmin
      .from('team_members')
      .select('user_id', { count: 'exact', head: true });

    // 4. USERS DATA
    const { count: usersTotal } = await supabaseAdmin
      .from('account_users')
      .select('user_id', { count: 'exact', head: true })
      .eq('account_status', 'active');

    // 5. CYCLES DATA
    const { data: cycles } = await supabaseAdmin
      .from('task_cycles')
      .select('*')
      .eq('status', 'active');

    // 6. TOP CONTRIBUTORS (users with most completed tasks this month)
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
      const { data: users } = await supabaseAdmin
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

    // 7. RECENT ACTIVITY SUMMARY
    const { data: recentComments } = await supabaseAdmin
      .from('task_issue_comments')
      .select('comment_id, created_at')
      .gte('created_at', startOfWeek.toISOString())
      .limit(100);

    // 8. CALCULATE METRICS
    const completionRate = issuesTotal ? Math.round((completedIssues.length / (issuesTotal || 1)) * 100) : 0;
    const weeklyVelocity = completedThisWeek.length;
    const monthlyVelocity = completedThisMonth.length;
    
    // Average time to complete (in days) - for issues completed this month
    let avgCompletionTime = 0;
    if (completedThisMonth.length > 0) {
      const totalDays = completedThisMonth.reduce((sum, issue) => {
        const created = new Date(issue.created_at);
        const completed = new Date(issue.completed_at);
        return sum + Math.ceil((completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      }, 0);
      avgCompletionTime = Math.round(totalDays / completedThisMonth.length);
    }

    // Build response
    const reportData = {
      generatedAt: now.toISOString(),
      
      projects: {
        total: projectsTotal || 0,
        active: activeProjects.length,
        completed: completedProjects.length,
        planning: planningProjects.length,
        onHold: onHoldProjects.length,
        atRisk: projectsAtRisk.length,
        atRiskList: projectsAtRisk.map(p => ({
          name: p.project_name,
          targetDate: p.target_end_date
        }))
      },
      
      tasks: {
        total: issuesTotal || 0,
        completed: completedIssues.length,
        open: openIssues.length,
        completionRate,
        overdue: overdueIssues.length,
        overdueList: overdueIssues.slice(0, 10).map(i => ({
          title: i.title,
          dueDate: i.due_date
        })),
        highPriority: highPriorityIssues.length,
        urgent: urgentIssues.length,
        createdThisWeek: issuesThisWeek.length,
        completedThisWeek: completedThisWeek.length,
        createdThisMonth: issuesThisMonth.length,
        completedThisMonth: completedThisMonth.length,
        weeklyVelocity,
        monthlyVelocity,
        avgCompletionDays: avgCompletionTime
      },
      
      teams: {
        total: teamsTotal || 0,
        totalMembers: membersTotal || 0
      },
      
      users: {
        active: usersTotal || 0
      },
      
      cycles: {
        active: cycles?.length || 0,
        list: cycles?.map(c => ({
          name: c.name,
          startDate: c.start_date,
          endDate: c.end_date,
          progress: c.progress_percent
        })) || []
      },
      
      topContributors,
      
      activity: {
        commentsThisWeek: recentComments?.length || 0
      },
      
      // Risk analysis based on data
      riskAnalysis: {
        level: projectsAtRisk.length > 2 || overdueIssues.length > 10 ? 'Alto' 
             : projectsAtRisk.length > 0 || overdueIssues.length > 5 ? 'Medio' 
             : 'Bajo',
        factors: [
          ...(projectsAtRisk.length > 0 ? [`${projectsAtRisk.length} proyecto(s) pasados de fecha límite`] : []),
          ...(overdueIssues.length > 0 ? [`${overdueIssues.length} tarea(s) vencidas sin completar`] : []),
          ...(urgentIssues.length > 5 ? [`${urgentIssues.length} tareas de prioridad urgente pendientes`] : []),
          ...(completionRate < 40 ? [`Tasa de finalización baja (${completionRate}%)`] : [])
        ],
        recommendations: [
          ...(projectsAtRisk.length > 0 ? ['Revisar proyectos en riesgo y reasignar recursos'] : []),
          ...(overdueIssues.length > 5 ? ['Priorizar tareas vencidas para recuperar el flujo'] : []),
          ...(weeklyVelocity < 5 ? ['Considerar aumentar el ritmo de cierre de tareas'] : []),
          ...(topContributors.length < 3 ? ['Distribuir la carga de trabajo entre más miembros'] : [])
        ]
      }
    };

    return NextResponse.json(reportData);

  } catch (err) {
    console.error('Error generating report data:', err);
    return NextResponse.json({ error: 'Failed to generate report data' }, { status: 500 });
  }
}
