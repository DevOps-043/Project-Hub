import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getWorkspaceBySlug, getUserWorkspaceRole } from '@/lib/services/workspace-service';
import { verifyToken } from '@/lib/auth/jwt';

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
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const isAdmin = ['owner', 'admin'].includes(member.iris_role);

    // For non-admin roles, filter by user's team membership + direct project membership
    if (!isAdmin) {
      // Get user's team IDs
      const { data: userTeams } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', payload.sub)
        .eq('is_active', true);
      const userTeamIds = (userTeams || []).map((t: any) => t.team_id);

      // Get user's direct project memberships
      const { data: userProjects } = await supabase
        .from('pm_project_members')
        .select('project_id')
        .eq('user_id', payload.sub);
      const userProjectIds = (userProjects || []).map((p: any) => p.project_id);

      if (userTeamIds.length === 0 && userProjectIds.length === 0) {
        return NextResponse.json({ projects: [], total: 0, limit, offset });
      }

      // Build OR filter: projects in my teams OR projects I'm a direct member of
      const orFilters: string[] = [];
      if (userTeamIds.length > 0) orFilters.push(`team_id.in.(${userTeamIds.join(',')})`);
      if (userProjectIds.length > 0) orFilters.push(`project_id.in.(${userProjectIds.join(',')})`);

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

      const { data, error } = await filteredQuery;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const projects = (data || []).map((p: any) => ({
        project_id: p.project_id,
        project_key: p.project_key,
        project_name: p.project_name,
        project_description: p.project_description,
        icon_name: p.icon_name,
        icon_color: p.icon_color,
        project_status: p.project_status,
        health_status: p.health_status,
        priority_level: p.priority_level,
        completion_percentage: p.completion_percentage,
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
      }));

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

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const projects = (data || []).map((p: any) => ({
      project_id: p.project_id,
      project_key: p.project_key,
      project_name: p.project_name,
      project_description: p.project_description,
      icon_name: p.icon_name,
      icon_color: p.icon_color,
      project_status: p.project_status,
      health_status: p.health_status,
      priority_level: p.priority_level,
      completion_percentage: p.completion_percentage,
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
    }));

    return NextResponse.json({ projects, total: projects.length, limit, offset });
  } catch (error) {
    console.error('Workspace projects API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
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
    if (!member || !['owner', 'admin', 'manager', 'leader'].includes(member.iris_role)) {
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
