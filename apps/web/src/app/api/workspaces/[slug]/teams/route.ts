import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getWorkspaceBySlug, getUserWorkspaceRole } from '@/lib/services/workspace-service';
import { verifyToken } from '@/lib/auth/jwt';

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const token = request.cookies.get('accessToken')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const workspace = await getWorkspaceBySlug(slug);
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace no encontrado' }, { status: 404 });
    }

    const member = await getUserWorkspaceRole(workspace.workspace_id, payload.sub);
    if (!member) {
      return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    const isAdmin = ['owner', 'admin'].includes(member.iris_role);

    // For non-admin roles, filter teams by user membership
    if (!isAdmin) {
      const { data: userTeams } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', payload.sub)
        .eq('is_active', true);

      const userTeamIds = (userTeams || []).map((t: any) => t.team_id);

      if (userTeamIds.length === 0) {
        return NextResponse.json({
          teams: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        });
      }

      let query = supabase
        .from('teams')
        .select(`
          *,
          owner:account_users!teams_owner_id_fkey(user_id, first_name, last_name_paternal, display_name, email, avatar_url),
          team_members(count)
        `, { count: 'exact' })
        .eq('workspace_id', workspace.workspace_id)
        .in('team_id', userTeamIds);

      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
      }

      query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

      const { data: teams, error, count } = await query;

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const transformedTeams = teams?.map(team => ({
        id: team.team_id,
        name: team.name,
        slug: team.slug,
        description: team.description,
        avatarUrl: team.avatar_url,
        color: team.color,
        status: team.status,
        visibility: team.visibility,
        maxMembers: team.max_members,
        owner: team.owner ? {
          id: team.owner.user_id,
          name: team.owner.display_name || `${team.owner.first_name} ${team.owner.last_name_paternal}`,
          email: team.owner.email,
          avatarUrl: team.owner.avatar_url,
        } : null,
        memberCount: team.team_members?.[0]?.count || 0,
        createdAt: team.created_at,
      }));

      return NextResponse.json({
        teams: transformedTeams,
        pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
      });
    }

    // Admin/owner: see all teams in workspace
    let query = supabase
      .from('teams')
      .select(`
        *,
        owner:account_users!teams_owner_id_fkey(user_id, first_name, last_name_paternal, display_name, email, avatar_url),
        team_members(count)
      `, { count: 'exact' })
      .eq('workspace_id', workspace.workspace_id);

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data: teams, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const transformedTeams = teams?.map(team => ({
      id: team.team_id,
      name: team.name,
      slug: team.slug,
      description: team.description,
      avatarUrl: team.avatar_url,
      color: team.color,
      status: team.status,
      visibility: team.visibility,
      maxMembers: team.max_members,
      owner: team.owner ? {
        id: team.owner.user_id,
        name: team.owner.display_name || `${team.owner.first_name} ${team.owner.last_name_paternal}`,
        email: team.owner.email,
        avatarUrl: team.owner.avatar_url,
      } : null,
      memberCount: team.team_members?.[0]?.count || 0,
      createdAt: team.created_at,
    }));

    return NextResponse.json({
      teams: transformedTeams,
      pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) },
    });
  } catch (error) {
    console.error('Workspace teams API error:', error);
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
    if (!member || !['owner', 'admin', 'manager'].includes(member.iris_role)) {
      return NextResponse.json({ error: 'Sin permisos para crear equipos' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { name, description, color, visibility, ownerId } = body;

    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const teamSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const { data: team, error } = await supabase
      .from('teams')
      .insert({
        name,
        slug: teamSlug,
        description: description || null,
        color: color || '#00D4B3',
        visibility: visibility || 'private',
        owner_id: ownerId || payload.sub,
        workspace_id: workspace.workspace_id,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('team_members').insert({
      team_id: team.team_id,
      user_id: ownerId || payload.sub,
      role: 'owner',
    });

    return NextResponse.json({ success: true, team: { id: team.team_id, name: team.name, slug: team.slug } }, { status: 201 });
  } catch (error) {
    console.error('Create workspace team error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
