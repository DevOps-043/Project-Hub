import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q');
        const limit = 5;

        if (!query || query.length < 2) {
            return NextResponse.json([]);
        }

        const supabase = getSupabaseAdmin();
        const searchTerm = `%${query}%`;

        // Ejecutar búsquedas en paralelo con RESILIENCIA (usando allSettled)
        const resultsSettled = await Promise.allSettled([
            // 1. Proyectos
            supabase
                .from('pm_projects')
                .select('project_id, project_name, project_key')
                .or(`project_name.ilike.${searchTerm},project_key.ilike.${searchTerm}`)
                .limit(limit),
            
            // 2. Tareas
            supabase
                .from('task_issues')
                .select('issue_id, title, issue_number, project_id')
                .ilike('title', searchTerm)
                .limit(limit),

            // 3. Usuarios
            supabase
                .from('account_users')
                .select('user_id, first_name, last_name_paternal, display_name, email, avatar_url')
                .or(`first_name.ilike.${searchTerm},last_name_paternal.ilike.${searchTerm},display_name.ilike.${searchTerm},email.ilike.${searchTerm}`)
                .limit(limit),

            // 4. Equipos
            supabase
                .from('teams')
                .select('team_id, name')
                .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
                .limit(limit)
        ]);

        const results = [];

        // Helper para extraer datos seguros
        const getResult = (index: number) => {
            const res = resultsSettled[index];
            return res.status === 'fulfilled' && res.value.data ? res.value.data : [];
        };

        const projects = getResult(0);
        const tasks = getResult(1);
        const users = getResult(2);
        const teams = getResult(3);

        // Debug logging for failures
        resultsSettled.forEach((res, i) => {
            if (res.status === 'rejected') console.error(`Search Query ${i} Failed:`, res.reason);
            if (res.status === 'fulfilled' && res.value.error) console.error(`Search Query ${i} Supabase Error:`, res.value.error);
        });

        // --- Procesar Resultados ---

        // Equipos
        if (teams.length) {
            results.push(...teams.map((t: any) => ({
                id: t.team_id,
                type: 'team',
                title: t.name,
                subtitle: 'Equipo',
                url: `/admin/teams/${t.team_id}/tasks`,
                icon: 'users'
            })));
        }

        // Proyectos
        if (projects.length) {
            results.push(...projects.map((p: any) => ({
                id: p.project_id,
                type: 'project',
                title: p.project_name,
                subtitle: p.project_key,
                url: `/admin/projects/${p.project_id}`,
                icon: 'folder'
            })));
        }

        // Tareas
        if (tasks.length) {
            results.push(...tasks.map((t: any) => ({
                id: t.issue_id,
                type: 'task',
                title: t.title,
                subtitle: `#${t.issue_number}`,
                url: `/admin/projects/${t.project_id}?view=tasks&taskId=${t.issue_id}`,
                icon: 'task'
            })));
        }

        // Usuarios
        if (users.length) {
            results.push(...users.map((u: any) => ({
                id: u.user_id,
                type: 'user',
                title: u.display_name || `${u.first_name || ''} ${u.last_name_paternal || ''}`.trim(),
                subtitle: u.email,
                url: `/admin/users/${u.user_id}`,
                icon: 'user',
                avatar: u.avatar_url
            })));
        }

        return NextResponse.json(results);

    } catch (error: any) {
        console.error('Search API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
