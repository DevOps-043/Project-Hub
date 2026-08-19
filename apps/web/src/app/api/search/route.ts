import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/require-role';
import { sanitizeSearchTerm } from '@/lib/http/sanitize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface TeamResult { team_id: string; name: string }
interface ProjectResult { project_id: string; project_name: string; project_key: string }
interface TaskResult { issue_id: string; title: string; issue_number: number; project_id: string }
interface UserResult {
    user_id: string;
    first_name: string | null;
    last_name_paternal: string | null;
    display_name: string | null;
    email: string;
    avatar_url: string | null;
}

export async function GET(request: NextRequest) {
    try {
        // Antes era pública (ver PUBLIC_PATHS en proxy.ts): cualquiera sin
        // sesión podía buscar y recibir emails/nombres de usuarios y títulos
        // de tareas/proyectos. La ruta sigue siendo pública a nivel de proxy
        // (por eso el chequeo va aquí adentro), pero ahora exige sesión.
        const auth = await requireAuth(request);
        if (!auth.ok) return auth.response;

        const { searchParams } = new URL(request.url);
        const rawQuery = searchParams.get('q');
        const limit = 5;

        if (!rawQuery || rawQuery.length < 2) {
            return NextResponse.json([]);
        }

        const query = sanitizeSearchTerm(rawQuery);
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
                .or(`name.ilike.${searchTerm},description.ilike.${searchTerm}`)
                .limit(limit)
        ]);

        const results = [];

        // Helper para extraer datos seguros
        function getResult<T>(index: number): T[] {
            const res = resultsSettled[index];
            return res.status === 'fulfilled' && res.value.data ? (res.value.data as T[]) : [];
        }

        const projects = getResult<ProjectResult>(0);
        const tasks = getResult<TaskResult>(1);
        const users = getResult<UserResult>(2);
        const teams = getResult<TeamResult>(3);

        // Debug logging for failures
        resultsSettled.forEach((res, i) => {
            if (res.status === 'rejected') console.error(`Search Query ${i} Failed:`, res.reason);
            if (res.status === 'fulfilled' && res.value.error) console.error(`Search Query ${i} Supabase Error:`, res.value.error);
        });

        // --- Procesar Resultados ---

        // Equipos
        if (teams.length) {
            results.push(...teams.map((t) => ({
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
            results.push(...projects.map((p) => ({
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
            results.push(...tasks.map((t) => ({
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
            results.push(...users.map((u) => ({
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

    } catch (error) {
        console.error('Search API Error:', error);
        const message = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
