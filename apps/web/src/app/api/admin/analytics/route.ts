import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Usar Service Role para analíticas globales de admin
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    // 1. Tareas Stats (Usando nombre correcto: task_issues)
    let tasksQuery = supabaseAdmin.from('task_issues').select('status_id, completed_at, assignee_id, issue_id, created_at');
    if (teamId) tasksQuery = tasksQuery.eq('team_id', teamId);
    
    // 2. Statuses Mapping
    const { data: statuses } = await supabaseAdmin.from('task_statuses').select('status_id, status_type, name, color');
    const statusMap = (statuses || []).reduce((acc: any, s) => {
        acc[s.status_id] = s;
        return acc;
    }, {});

    const { data: tasks, error: taskError } = await tasksQuery;
    
    // Si falla task_issues, es posible que no existan las tablas aun
    if (taskError) {
        console.error('Task fetch error (tables might be missing)', taskError);
        // Si no hay tabla de tareas, asumimos que no hay datos y pasaremos al mock si projects también está vacío
    }

    // 3. Proyectos Stats (Usando nombre correcto: pm_projects)
    let projectsQuery = supabaseAdmin.from('pm_projects').select('project_status, project_id');
    if (teamId) projectsQuery = projectsQuery.eq('team_id', teamId);
    const { data: projects } = await projectsQuery;

    // 4. AI Usage (Recuperar o inicializar vacío)
    let ariaData: any[] = [];
    try {
        const { data } = await supabaseAdmin.from('aria_usage_logs')
            .select('tokens_total, user_id, created_at')
            .order('created_at', { ascending: true })
            .limit(1000);
        if (data) ariaData = data;
    } catch(e) { console.log('No aria logs table yet'); }

    // --- MOCK DATA FALLBACK (Si no hay datos reales, mostrar demo) ---
    // Consideramos "Real Data" si tenemos tareas O proyectos.
    const hasRealData = (tasks && tasks.length > 0) || (projects && projects.length > 0);

    if (!hasRealData) {
        // Generar datos simulados para visualización
        const mockHeatmap = [];
        const today = new Date();
        for (let i = 0; i < 365; i++) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            if (Math.random() > 0.6) {
                mockHeatmap.push({ 
                    date: d.toISOString().split('T')[0], 
                    count: Math.floor(Math.random() * 8) 
                });
            }
        }

        const mockAria = [];
        for (let i = 30; i >= 0; i--) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            mockAria.push({ 
                date: d.toISOString().split('T')[0], 
                tokens: Math.floor(Math.random() * 5000) + 1000 
            });
        }

        return NextResponse.json({
            isMock: true,
            tasks: {
                total: 124,
                distribution: [
                    { name: 'Completadas', value: 65, color: '#10B981' },
                    { name: 'En Progreso', value: 24, color: '#3B82F6' },
                    { name: 'Por Hacer', value: 15, color: '#F59E0B' },
                    { name: 'Canceladas', value: 5, color: '#EF4444' },
                    { name: 'Backlog', value: 15, color: '#6B7280' }
                ]
            },
            projects: {
                total: 12,
                completed: 8,
                active: 4
            },
            heatmap: mockHeatmap,
            leaderboard: [
                { user: { full_name: 'Fernando Suarez', email: 'fernando@iris.com' }, count: 45 },
                { user: { full_name: 'Sofia AI', email: 'sofia@ai.system' }, count: 32 },
                { user: { full_name: 'Dev Team', email: 'dev@iris.com' }, count: 28 },
                { user: { full_name: 'Product Owner', email: 'po@iris.com' }, count: 12 },
            ],
            ariaUsage: mockAria
        });
    }

    // --- PROCESAMIENTO REAL ---
    
    // A) Distribución de Tareas
    const taskStatusCounts = (tasks || []).reduce((acc: any, t) => {
        const type = statusMap[t.status_id]?.status_type || 'backlog';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {});
    
    // Mapeo de nombres legibles para la gráfica
    const typeLabelMap: Record<string, string> = {
        'done': 'Completadas',
        'in_progress': 'En Progreso',
        'todo': 'Por Hacer',
        'backlog': 'Backlog',
        'cancelled': 'Canceladas',
        'in_review': 'En Revisión'
    };

    const distribution = Object.entries(taskStatusCounts).map(([type, count]) => ({
        name: typeLabelMap[type] || type,
        value: count,
        // Colores fijos por tipo o usar el del status
        color: type === 'done' ? '#10B981' : 
               type === 'in_progress' ? '#3B82F6' :
               type === 'todo' ? '#F59E0B' :
               type === 'cancelled' ? '#EF4444' : '#6B7280'
    }));

    // B) Heatmap (Tareas completadas por fecha)
    const heatmapData: Record<string, number> = {};
    (tasks || []).forEach(t => {
        const type = statusMap[t.status_id]?.status_type;
        // Consideramos completada si el status es 'done' o tiene completed_at
        if ((type === 'done' || t.completed_at) && t.created_at) { // fallback created_at if completed_at missing
            const date = new Date(t.completed_at || t.created_at).toISOString().split('T')[0];
            heatmapData[date] = (heatmapData[date] || 0) + 1;
        }
    });

    // C) Leaderboard (Top Assignees)
    const userTaskCounts: Record<string, number> = {};
    (tasks || []).forEach(t => {
        const type = statusMap[t.status_id]?.status_type;
        if ((type === 'done' || type === 'completed') && t.assignee_id) {
            userTaskCounts[t.assignee_id] = (userTaskCounts[t.assignee_id] || 0) + 1;
        }
    });

    // Necesitamos nombres de usuarios para el leaderboard
    // Hacemos fetch de users únicos
    const userIds = Object.keys(userTaskCounts);
    let usersMap: Record<string, any> = {};
    if (userIds.length > 0) {
        const { data: users } = await supabaseAdmin.from('users').select('id, full_name, email, avatar_url').in('id', userIds);
        if (users) {
            users.forEach(u => usersMap[u.id] = u);
        }
    }
    // Fallback names via auth fetch if 'users' table is custom public view of auth.users or similar
    // Si 'users' falla, intentamos 'account_users' que es nuestra tabla
    if (userIds.length > 0 && Object.keys(usersMap).length === 0) {
         const { data: accUsers } = await supabaseAdmin.from('account_users').select('user_id, first_name, last_name_paternal, email, avatar_url').in('user_id', userIds);
         if (accUsers) {
             accUsers.forEach(u => usersMap[u.user_id] = { ...u, full_name: `${u.first_name} ${u.last_name_paternal}`, id: u.user_id });
         }
    }

    const leaderboard = Object.entries(userTaskCounts)
        .map(([id, count]) => ({
            user: usersMap[id] || { full_name: 'Usuario', email: 'N/A' },
            count
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);


    // D) AI Token Usage por día (últimos 30 días)
    const tokenUsageByDay: Record<string, number> = {};
    ariaData.forEach(log => {
        const date = new Date(log.created_at).toISOString().split('T')[0];
        tokenUsageByDay[date] = (tokenUsageByDay[date] || 0) + (log.tokens_total || 0);
    });

    const tokenChartData = Object.entries(tokenUsageByDay).map(([date, tokens]) => ({
        date,
        tokens
    })).sort((a, b) => a.date.localeCompare(b.date));


    return NextResponse.json({
        tasks: {
            total: tasks ? tasks.length : 0,
            distribution
        },
        projects: {
            total: projects ? projects.length : 0,
            completed: projects ? projects.filter(p => p.project_status === 'completed').length : 0,
            active: projects ? projects.filter(p => p.project_status === 'active' || p.project_status === 'in_progress').length : 0
        },
        heatmap: Object.entries(heatmapData).map(([date, count]) => ({ date, count })),
        leaderboard,
        ariaUsage: tokenChartData
    });

  } catch (error: any) {
    console.error('Analytics Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
