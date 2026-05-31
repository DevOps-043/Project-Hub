import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getWorkspaceBySlug, getUserWorkspaceRole } from '@/lib/services/workspace-service';
import { verifyToken } from '@/lib/auth/jwt';
import { getMemoryCache, setMemoryCache } from '@/lib/cache/memory-cache';

export const dynamic = 'force-dynamic';
const configuredAnalyticsCacheTtl = Number.parseInt(process.env.ANALYTICS_CACHE_TTL_SECONDS || '30', 10);
const configuredAnalyticsLookbackDays = Number.parseInt(process.env.ANALYTICS_LOOKBACK_DAYS || '90', 10);
const ANALYTICS_CACHE_TTL_SECONDS = Number.isFinite(configuredAnalyticsCacheTtl)
  ? configuredAnalyticsCacheTtl
  : 30;
const ANALYTICS_LOOKBACK_DAYS = Number.isFinite(configuredAnalyticsLookbackDays)
  ? configuredAnalyticsLookbackDays
  : 90;

function isDoneStatus(statusType?: string): boolean {
  return statusType === 'done' || statusType === 'completed';
}

function emptyAnalyticsPayload() {
  const projectHealth = { on_track: 0, at_risk: 0, off_track: 0, none: 0 };

  return {
    isEmpty: true,
    summary: {
      totalTasks: 0,
      avgCycleTime: 0,
      projectHealth,
      completionRate: 0,
      compilationRate: 0,
    },
    tasks: {
      total: 0,
      distribution: [{ name: 'Sin datos', value: 1, color: '#6B7280' }],
    },
    projects: { total: 0, completed: 0, active: 0 },
    velocity: [],
    workload: [],
    heatmap: [],
    leaderboard: [],
    ariaUsage: [],
  };
}

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

    const cacheKey = `workspace-analytics:${workspace.workspace_id}`;
    const cachedPayload = getMemoryCache<Record<string, any>>(cacheKey);
    if (cachedPayload) {
      return NextResponse.json(cachedPayload, {
        headers: {
          'Cache-Control': 'private, max-age=15',
          'X-Project-Hub-Cache': 'HIT',
        },
      });
    }

    const supabase = getSupabaseAdmin();

    // Get workspace team IDs
    const { data: wsTeams } = await supabase
      .from('teams')
      .select('team_id')
      .eq('workspace_id', workspace.workspace_id);
    const teamIds = (wsTeams || []).map(t => t.team_id);

    // Get workspace project IDs
    const { data: wsProjects } = await supabase
      .from('pm_projects')
      .select('project_id, project_status, health_status')
      .eq('workspace_id', workspace.workspace_id);
    const projectIds = (wsProjects || []).map(p => p.project_id);

    // Tasks scoped to workspace teams OR projects
    let tasks: any[] = [];
    const orFilters: string[] = [];
    if (teamIds.length > 0) orFilters.push(`team_id.in.(${teamIds.join(',')})`);
    if (projectIds.length > 0) orFilters.push(`project_id.in.(${projectIds.join(',')})`);

    if (orFilters.length > 0) {
      const { data } = await supabase
        .from('task_issues')
        .select('status_id, completed_at, started_at, assignee_id, issue_id, created_at, cycle_id, estimate_points')
        .or(orFilters.join(','));
      tasks = data || [];
    }

    // Status mapping
    const { data: statuses } = await supabase.from('task_statuses').select('status_id, status_type, name, color');
    const statusMap = (statuses || []).reduce((acc: any, s) => { acc[s.status_id] = s; return acc; }, {});

    // Members of the workspace (to filter AI usage)
    const allMembersQuery = supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspace.workspace_id);
    
    const { data: members } = await allMembersQuery;
    const memberIds = Array.from(new Set((members || []).map(m => m.user_id)));

    // AI Usage scoped to members
    let ariaUsage: any[] = [];
    if (memberIds.length > 0) {
      const usageSince = new Date(
        Date.now() - ANALYTICS_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
      ).toISOString();
      const { data: usageLogs } = await supabase
        .from('aria_usage_logs')
        .select('tokens_total, created_at')
        .in('user_id', memberIds)
        .gte('created_at', usageSince)
        .order('created_at', { ascending: true });
      
      if (usageLogs && usageLogs.length > 0) {
        const usageByDay: Record<string, number> = {};
        usageLogs.forEach(log => {
          const day = new Date(log.created_at).toISOString().split('T')[0];
          usageByDay[day] = (usageByDay[day] || 0) + (log.tokens_total || 0);
        });
        ariaUsage = Object.entries(usageByDay).map(([date, tokens]) => ({ date, tokens }));
      }
    }

    // Projects scoped to workspace
    const projects = wsProjects || [];

    const hasRealData = tasks.length > 0 || projects.length > 0 || ariaUsage.length > 0;

    if (!hasRealData) {
      const payload = emptyAnalyticsPayload();
      setMemoryCache(cacheKey, payload, ANALYTICS_CACHE_TTL_SECONDS);
      return NextResponse.json(payload, {
        headers: {
          'Cache-Control': 'private, max-age=15',
          'X-Project-Hub-Cache': 'MISS',
        },
      });
    }

    // --- PROCESAMIENTO REAL ---
    
    // 1. Salud de Proyectos
    const projectHealth = projects.reduce((acc: any, p) => {
      const health = p.health_status || 'none';
      acc[health] = (acc[health] || 0) + 1;
      return acc;
    }, { on_track: 0, at_risk: 0, off_track: 0, none: 0 });

    // 2. Velocidad (Puntos por Ciclo - Últimos 5 ciclos)
    let cycles: any[] = [];
    if (teamIds.length > 0) {
      const { data } = await supabase
        .from('task_cycles')
        .select('cycle_id, name, start_date, number')
        .eq('team_id', teamIds[0]) // Simplificado al primer equipo para el demo/contexto
        .order('start_date', { ascending: false })
        .limit(5);
      cycles = data || [];
    }

    const velocityData = cycles.reverse().map(cycle => {
      const cycleTasks = tasks.filter(t => t.cycle_id === cycle.cycle_id && isDoneStatus(statusMap[t.status_id]?.status_type));
      const points = cycleTasks.reduce((sum, t) => sum + (t.estimate_points || 0), 0);
      return { name: cycle.name, points };
    });

    // 3. Cycle Time Promedio (Días)
    const completedTasks = tasks.filter(t => t.completed_at && t.started_at);
    const totalCycleTime = completedTasks.reduce((sum, t) => {
      const start = new Date(t.started_at).getTime();
      const end = new Date(t.completed_at!).getTime();
      return sum + (end - start);
    }, 0);
    const avgCycleTimeDays = completedTasks.length > 0 
      ? Math.round((totalCycleTime / completedTasks.length) / (1000 * 60 * 60 * 24) * 10) / 10 
      : 0;

    // 4. Workload distribution (Tareas activas por usuario)
    const workloadMap: Record<string, { tasks: number, points: number }> = {};
    tasks.forEach(t => {
      if (t.assignee_id && !isDoneStatus(statusMap[t.status_id]?.status_type) && statusMap[t.status_id]?.status_type !== 'cancelled') {
        if (!workloadMap[t.assignee_id]) workloadMap[t.assignee_id] = { tasks: 0, points: 0 };
        workloadMap[t.assignee_id].tasks += 1;
        workloadMap[t.assignee_id].points += (t.estimate_points || 0);
      }
    });

    // Resolve user info for workload
    const workloadUserIds = Object.keys(workloadMap);
    let workloadData: any[] = [];
    if (workloadUserIds.length > 0) {
      const { data: users } = await supabase.from('account_users').select('user_id, first_name, display_name').in('user_id', workloadUserIds);
      workloadData = (users || []).map(u => ({
        name: u.display_name || u.first_name,
        tasks: workloadMap[u.user_id].tasks,
        points: workloadMap[u.user_id].points
      }));
    }

    // Process heatmap (already implemented, just keeping it)
    const heatmapData: Record<string, number> = {};
    tasks.forEach(t => {
      const type = statusMap[t.status_id]?.status_type;
      if ((isDoneStatus(type) || t.completed_at) && t.created_at) {
        const date = new Date(t.completed_at || t.created_at).toISOString().split('T')[0];
        heatmapData[date] = (heatmapData[date] || 0) + 1;
      }
    });

    // Task Distribution
    const typeLabelMap: Record<string, string> = { done: 'Completadas', completed: 'Completadas', in_progress: 'En Progreso', todo: 'Por Hacer', backlog: 'Backlog', cancelled: 'Canceladas', in_review: 'En Revision' };
    const taskStatusCounts = tasks.reduce((acc: any, t) => { const type = statusMap[t.status_id]?.status_type || 'backlog'; acc[type] = (acc[type] || 0) + 1; return acc; }, {});
    const distribution = tasks.length > 0 ? Object.entries(taskStatusCounts).map(([type, count]) => ({
      name: typeLabelMap[type] || type, value: count,
      color: isDoneStatus(type) ? '#10B981' : type === 'in_progress' ? '#3B82F6' : type === 'todo' ? '#F59E0B' : type === 'cancelled' ? '#EF4444' : '#6B7280',
    })) : [{ name: 'Sin datos', value: 1, color: '#6B7280' }];

    const completedByUser: Record<string, number> = {};
    tasks.forEach(t => {
      if (t.assignee_id && (isDoneStatus(statusMap[t.status_id]?.status_type) || t.completed_at)) {
        completedByUser[t.assignee_id] = (completedByUser[t.assignee_id] || 0) + 1;
      }
    });
    const leaderboardUserIds = Object.entries(completedByUser)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([userId]) => userId);
    let leaderboard: any[] = [];
    if (leaderboardUserIds.length > 0) {
      const { data: users } = await supabase
        .from('account_users')
        .select('user_id, display_name, first_name, last_name_paternal, email, avatar_url')
        .in('user_id', leaderboardUserIds);

      leaderboard = leaderboardUserIds.map(userId => {
        const user = users?.find(u => u.user_id === userId);
        const fullName = user?.display_name || [user?.first_name, user?.last_name_paternal].filter(Boolean).join(' ') || user?.email || 'Usuario';
        return {
          count: completedByUser[userId],
          user: {
            user_id: userId,
            full_name: fullName,
            email: user?.email || '',
            avatar_url: user?.avatar_url || null,
          },
        };
      });
    }

    const completedCount = Object.entries(taskStatusCounts).reduce((sum, [type, count]) => (
      isDoneStatus(type) ? sum + Number(count) : sum
    ), 0);

    const responsePayload = {
      summary: {
        totalTasks: tasks.length,
        avgCycleTime: avgCycleTimeDays,
        projectHealth,
        completionRate: tasks.length > 0 ? Math.round(completedCount / tasks.length * 100) : 0,
        compilationRate: tasks.length > 0 ? Math.round(completedCount / tasks.length * 100) : 0,
      },
      tasks: { total: tasks.length, distribution },
      projects: {
        total: projects.length,
        completed: projects.filter(p => p.project_status === 'completed' || p.project_status === 'closed').length,
        active: projects.filter(p => ['active', 'in_progress', 'planning', 'on_hold'].includes(p.project_status)).length,
      },
      velocity: velocityData,
      workload: workloadData,
      heatmap: Object.entries(heatmapData).map(([date, count]) => ({ date, count })),
      leaderboard,
      ariaUsage,
    };
    setMemoryCache(cacheKey, responsePayload, ANALYTICS_CACHE_TTL_SECONDS);

    return NextResponse.json(responsePayload, {
      headers: {
        'Cache-Control': 'private, max-age=15',
        'X-Project-Hub-Cache': 'MISS',
      },
    });
  } catch (error: any) {
    console.error('Workspace analytics error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
