import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { requireWorkspaceMember } from '@/lib/auth/require-role';

type RouteParams = { params: Promise<{ slug: string; teamId: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug, teamId } = await params;
    const auth = await requireWorkspaceMember(request, slug);
    if (!auth.ok) return auth.response;
    const { workspace } = auth;

    const supabase = getSupabaseAdmin();
    const { data: team, error } = await supabase
      .from('teams')
      .select(`
        *,
        owner:account_users!teams_owner_id_fkey(user_id, first_name, last_name_paternal, display_name, email, avatar_url),
        team_members(count)
      `)
      .eq('team_id', teamId)
      .eq('workspace_id', workspace.workspace_id)
      .single();

    if (error || !team) {
      return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      team: {
        id: team.team_id,
        name: team.name,
        slug: team.slug,
        description: team.description,
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
        updatedAt: team.updated_at,
      },
    });
  } catch (error) {
    console.error('Get workspace team error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug, teamId } = await params;
    const auth = await requireWorkspaceMember(request, slug);
    if (!auth.ok) return auth.response;
    const { workspace, member } = auth;

    if (!['owner', 'admin', 'manager'].includes(member.iris_role)) {
      return NextResponse.json({ error: 'Sin permisos para editar equipos' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { name, description, color, visibility, status } = body;

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (name !== undefined) {
      updateData.name = name;
      updateData.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
    if (description !== undefined) updateData.description = description;
    if (color !== undefined) updateData.color = color;
    if (visibility !== undefined) updateData.visibility = visibility;
    if (status !== undefined) updateData.status = status;

    const { error } = await supabase
      .from('teams')
      .update(updateData)
      .eq('team_id', teamId)
      .eq('workspace_id', workspace.workspace_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update workspace team error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug, teamId } = await params;
    const auth = await requireWorkspaceMember(request, slug);
    if (!auth.ok) return auth.response;
    const { workspace, member } = auth;

    if (!['owner', 'admin'].includes(member.iris_role)) {
      return NextResponse.json({ error: 'Sin permisos para eliminar equipos' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('team_id', teamId)
      .eq('workspace_id', workspace.workspace_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete workspace team error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
