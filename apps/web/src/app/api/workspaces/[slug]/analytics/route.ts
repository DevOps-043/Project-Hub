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
    if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    const workspace = await getWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: 'Workspace no encontrado' }, { status: 404 });

    const member = await getUserWorkspaceRole(workspace.workspace_id, payload.sub);
    if (!member) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

    const supabase = getSupabaseAdmin();

    // Get workspace team IDs
    const { data: wsTeams } = await supabase
      .from('teams')
      .select('team_id')
      .eq('workspace_id', workspace.workspace_id);
    const teamIds = (wsTeams || []).map(t => t.team_id);

    // Tasks scoped to workspace teams
    let tasks: any[] = [];
    if (teamIds.length > 0) {
      const { data } = await supabase
        .from('task_issues')
        .select('status_id, completed_at, assignee_id, issue_id, created_at')
        .in('team_id', teamIds);
      tasks = data || [];
    }

    // Status mapping
    const { data: statuses } = await supabase.from('task_statuses').select('status_id, status_type, name, color');
    const statusMap = (statuses || []).reduce((acc: any, s) => { acc[s.status_id] = s; return acc; }, {});

    // Projects scoped to workspace
    const { data: projects } = await supabase
      .from('pm_projects')
      .select('project_status, project_id')
      .eq('workspace_id', workspace.workspace_id);

    const hasRealData = tasks.length > 0 || (projects && projects.length > 0);

    if (!hasRealData) {
      const today = new Date();
      const mockHeatmap = [];
      for (let i = 0; i < 365; i++) {
        const d = new Date(); d.setDate(today.getDate() - i);
        if (Math.random() > 0.6) mockHeatmap.push({ date: d.toISOString().split('T')[0], count: Math.floor(Math.random() * 8) });
      }
      const mockAria = [];
      for (let i = 30; i >= 0; i--) {
        const d = new Date(); d.setDate(today.getDate() - i);
        mockAria.push({ date: d.toISOString().split('T')[0], tokens: Math.floor(Math.random() * 5000) + 1000 });
      }
      return NextResponse.json({
        isMock: true,
        tasks: { total: 0, distribution: [{ name: 'Sin datos', value: 1, color: '#6B7280' }] },
        projects: { total: 0, completed: 0, active: 0 },
        heatmap: mockHeatmap,
        leaderboard: [],
        ariaUsage: mockAria,
      });
    }

    // Process real data
    const typeLabelMap: Record<string, string> = { done: 'Completadas', in_progress: 'En Progreso', todo: 'Por Hacer', backlog: 'Backlog', cancelled: 'Canceladas', in_review: 'En Revision' };
    const taskStatusCounts = tasks.reduce((acc: any, t) => { const type = statusMap[t.status_id]?.status_type || 'backlog'; acc[type] = (acc[type] || 0) + 1; return acc; }, {});
    const distribution = Object.entries(taskStatusCounts).map(([type, count]) => ({
      name: typeLabelMap[type] || type, value: count,
      color: type === 'done' ? '#10B981' : type === 'in_progress' ? '#3B82F6' : type === 'todo' ? '#F59E0B' : type === 'cancelled' ? '#EF4444' : '#6B7280',
    }));

    const heatmapData: Record<string, number> = {};
    tasks.forEach(t => {
      const type = statusMap[t.status_id]?.status_type;
      if ((type === 'done' || t.completed_at) && t.created_at) {
        const date = new Date(t.completed_at || t.created_at).toISOString().split('T')[0];
        heatmapData[date] = (heatmapData[date] || 0) + 1;
      }
    });

    const userTaskCounts: Record<string, number> = {};
    tasks.forEach(t => {
      const type = statusMap[t.status_id]?.status_type;
      if ((type === 'done') && t.assignee_id) userTaskCounts[t.assignee_id] = (userTaskCounts[t.assignee_id] || 0) + 1;
    });

    const userIds = Object.keys(userTaskCounts);
    let usersMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: accUsers } = await supabase.from('account_users').select('user_id, first_name, last_name_paternal, email, avatar_url').in('user_id', userIds);
      if (accUsers) accUsers.forEach(u => usersMap[u.user_id] = { full_name: `${u.first_name} ${u.last_name_paternal}`, email: u.email, avatar_url: u.avatar_url });
    }

    const leaderboard = Object.entries(userTaskCounts)
      .map(([id, count]) => ({ user: usersMap[id] || { full_name: 'Usuario', email: 'N/A' }, count }))
      .sort((a, b) => (b.count as number) - (a.count as number)).slice(0, 5);

    return NextResponse.json({
      tasks: { total: tasks.length, distribution },
      projects: {
        total: projects ? projects.length : 0,
        completed: projects ? projects.filter(p => p.project_status === 'completed').length : 0,
        active: projects ? projects.filter(p => ['active', 'in_progress'].includes(p.project_status)).length : 0,
      },
      heatmap: Object.entries(heatmapData).map(([date, count]) => ({ date, count })),
      leaderboard,
      ariaUsage: [],
    });
  } catch (error: any) {
    console.error('Workspace analytics error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
