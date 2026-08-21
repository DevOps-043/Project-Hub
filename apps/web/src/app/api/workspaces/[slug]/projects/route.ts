import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { requireWorkspaceMember } from '@/lib/auth/require-role';
import { parsePagination } from '@/lib/http/query';
import { sanitizeSearchTerm } from '@/lib/http/sanitize';
import { isUuid } from '@/lib/http/validation';

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

interface RawProject {
  project_id: string;
  project_key: string;
  project_name: string;
  project_description: string | null;
  icon_name: string;
  icon_color: string;
  project_status: string;
  health_status: string | null;
  priority_level: string;
  completion_percentage: number | null;
  start_date: string | null;
  target_date: string | null;
  created_at: string;
  lead_user_id: string | null;
  lead: { first_name: string; last_name_paternal: string; display_name: string | null; avatar_url: string | null } | null;
  team: { name: string; color: string } | null;
}

interface IssueProgressRow {
  project_id: string;
  status_id: string;
  task_statuses: { status_type: string } | null;
}

async function enrichProjectsWithIssueProgress(supabase: SupabaseAdminClient, rawProjects: RawProject[]) {
  if (rawProjects.length === 0) return [];

  const projectIds = rawProjects.map((p) => p.project_id);

  // Batch query: get all issues for these projects with their status info
  const { data: allIssues } = await supabase
    .from('task_issues')
    .select('project_id, status_id, task_statuses!inner(status_type)')
    .in('project_id', projectIds);

  // Group by project_id and calculate completion
  const issuesByProject: Record<string, IssueProgressRow[]> = {};
  for (const issue of ((allIssues || []) as unknown as IssueProgressRow[])) {
    const pid = issue.project_id;
    if (!issuesByProject[pid]) issuesByProject[pid] = [];
    issuesByProject[pid].push(issue);
  }

  const projects = rawProjects.map((p) => {
    const issues = issuesByProject[p.project_id] || [];
    const total = issues.length;
    const done = issues.filter((i) => i.task_statuses?.status_type === 'done').length;
    const cancelled = issues.filter((i) => i.task_statuses?.status_type === 'cancelled').length;
    const effectiveTotal = total - cancelled;
    const pct = effectiveTotal > 0 ? Math.round((done / effectiveTotal) * 100) : (p.completion_percentage || 0);

    return {
      project_id: p.project_id,
      project_key: p.project_key,
      project_name: p.project_name,
      project_description: p.project_description,
      icon_name: p.icon_name,
      icon_color: p.icon_color,
      project_status: p.project_status,
      health_status: p.health_status,
      priority_level: p.priority_level,
      completion_percentage: total > 0 ? pct : (p.completion_percentage || 0),
      start_date: p.start_date,
      target_date: p.target_date,
      created_at: p.created_at,
      lead_user_id: p.lead_user_id,
      lead_first_name: p.lead?.first_name || null,
      lead_last_name: p.lead?.last_name_paternal || null,
      lead_display_name: p.lead?.display_name || null,
      lead_avatar_url: p.lead?.avatar_url || null,
      team_name: p.team?.name || null,
      team_color: p.team?.color || null,
      progress_history: [],
    };
  });

  return projects;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const auth = await requireWorkspaceMember(request, slug);
    if (!auth.ok) return auth.response;
    const { payload, workspace, member } = auth;

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const search = sanitizeSearchTerm(searchParams.get('search') || '');
    const teamId = searchParams.get('team_id');
    if (teamId && !isUuid(teamId)) {
      return NextResponse.json({ error: 'Equipo inválido' }, { status: 400 });
    }

    const { limit, offset } = parsePagination(searchParams, {
      defaultLimit: 50,
      maxLimit: 100,
    });

    const isAdmin = ['owner', 'admin'].includes(member.iris_role);

    // For non-admin roles, filter by user's team membership + direct project membership + lead/creator
    if (!isAdmin) {
      // Get user's team IDs
      const { data: userTeams } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', payload.sub)
        .eq('is_active', true);
      const userTeamIds = (userTeams || []).map((t) => t.team_id);

      // Get user's direct project memberships
      const { data: userProjects } = await supabase
        .from('pm_project_members')
        .select('project_id')
        .eq('user_id', payload.sub);
      const userProjectIds = (userProjects || []).map((p) => p.project_id);

      // Build OR filter: projects in my teams OR direct member OR lead OR creator
      const orFilters: string[] = [];
      if (userTeamIds.length > 0) orFilters.push(`team_id.in.(${userTeamIds.join(',')})`);
      if (userProjectIds.length > 0) orFilters.push(`project_id.in.(${userProjectIds.join(',')})`);
      // Siempre incluir proyectos donde el usuario es líder o creador
      orFilters.push(`lead_user_id.eq.${payload.sub}`);
      orFilters.push(`created_by_user_id.eq.${payload.sub}`);

      let filteredQuery = supabase
        .from('pm_projects')
        .select(`
          *,
          lead:account_users!pm_projects_lead_user_id_fkey(user_id, first_name, last_name_paternal, display_name, avatar_url),
          team:teams!pm_projects_team_id_fkey(team_id, name, color)
        `)
        .eq('workspace_id', workspace.workspace_id)
        .neq('project_status', 'archived')
        .or(orFilters.join(','))
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (search) {
        filteredQuery = filteredQuery.or(`project_name.ilike.%${search}%,project_description.ilike.%${search}%,project_key.ilike.%${search}%`);
      }
      if (teamId) filteredQuery = filteredQuery.eq('team_id', teamId);


      const { data, error } = await filteredQuery;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const projects = await enrichProjectsWithIssueProgress(supabase, data || []);
      return NextResponse.json({ projects, total: projects.length, limit, offset });
    }

    // Admin/owner: see all projects in workspace
    let query = supabase
      .from('pm_projects')
      .select(`
        *,
        lead:account_users!pm_projects_lead_user_id_fkey(user_id, first_name, last_name_paternal, display_name, avatar_url),
        team:teams!pm_projects_team_id_fkey(team_id, name, color)
      `)
      .eq('workspace_id', workspace.workspace_id)
      .neq('project_status', 'archived')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`project_name.ilike.%${search}%,project_description.ilike.%${search}%,project_key.ilike.%${search}%`);
    }
    if (teamId) query = query.eq('team_id', teamId);


    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const projects = await enrichProjectsWithIssueProgress(supabase, data || []);
    return NextResponse.json({ projects, total: projects.length, limit, offset });
  } catch (error) {
    console.error('Workspace projects API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const auth = await requireWorkspaceMember(request, slug);
    if (!auth.ok) return auth.response;
    const { payload, workspace, member } = auth;

    if (!['owner', 'admin', 'manager', 'leader'].includes(member.iris_role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const { project_name, project_description, icon_name = 'folder', icon_color = '#3B82F6', priority_level = 'medium', start_date, target_date, team_id, lead_user_id, tags = [] } = body;

    if (!project_name) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });

    const prefix = project_name.substring(0, 4).toUpperCase().replace(/[^A-Z]/g, 'X');
    const { count } = await supabase.from('pm_projects').select('*', { count: 'exact', head: true });
    const projectKey = `${prefix}-${String((count || 0) + 1).padStart(3, '0')}`;

    const { data: newProject, error } = await supabase
      .from('pm_projects')
      .insert({
        project_key: projectKey, project_name, project_description, icon_name, icon_color, priority_level,
        start_date, target_date, team_id, lead_user_id, created_by_user_id: payload.sub, tags,
        workspace_id: workspace.workspace_id,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('pm_project_members').insert({
      project_id: newProject.project_id, user_id: payload.sub,
      project_role: 'owner', can_edit: true, can_delete: true, can_manage_members: true, can_manage_settings: true,
    });

    return NextResponse.json({ project: newProject, message: 'Proyecto creado exitosamente' }, { status: 201 });
  } catch (error) {
    console.error('Create workspace project error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
