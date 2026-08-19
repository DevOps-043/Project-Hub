import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/require-role';

// GET single team with members
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { teamId } = await params;
    const supabase = getSupabaseAdmin();

    const { data: team, error } = await supabase
      .from('teams')
      .select(`
        *,
        owner:account_users!teams_owner_id_fkey(user_id, first_name, last_name_paternal, display_name, email, avatar_url),
        team_members(
          member_id,
          role,
          joined_at,
          is_active,
          user:account_users!team_members_user_id_fkey(user_id, first_name, last_name_paternal, display_name, email, avatar_url, permission_level)
        )
      `)
      .eq('team_id', teamId)
      .single();

    if (error) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: team.team_id,
      name: team.name,
      slug: team.slug,
      description: team.description,
      avatarUrl: team.avatar_url,
      color: team.color,
      status: team.status,
      visibility: team.visibility,
      maxMembers: team.max_members,
      settings: team.settings,
      owner: team.owner ? {
        id: team.owner.user_id,
        name: team.owner.display_name || `${team.owner.first_name} ${team.owner.last_name_paternal}`,
        email: team.owner.email,
        avatarUrl: team.owner.avatar_url,
      } : null,
      members: team.team_members?.map((m: Record<string, unknown>) => ({
        id: (m as { member_id: string }).member_id,
        role: m.role,
        joinedAt: m.joined_at,
        isActive: m.is_active,
        user: m.user ? {
          id: (m.user as Record<string, unknown>).user_id,
          name: (m.user as Record<string, unknown>).display_name || `${(m.user as Record<string, unknown>).first_name} ${(m.user as Record<string, unknown>).last_name_paternal}`,
          email: (m.user as Record<string, unknown>).email,
          avatarUrl: (m.user as Record<string, unknown>).avatar_url,
          permissionLevel: (m.user as Record<string, unknown>).permission_level,
        } : null,
      })) || [],
      memberCount: team.team_members?.length || 0,
      createdAt: team.created_at,
      updatedAt: team.updated_at,
    });
  } catch (error) {
    console.error('Get team error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT update team
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { teamId } = await params;
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const { name, description, color, visibility, status } = body;

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

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
      .eq('team_id', teamId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update team error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE team
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { teamId } = await params;
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('team_id', teamId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete team error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
