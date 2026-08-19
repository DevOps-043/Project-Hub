import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/require-role';
import { sanitizeSearchTerm } from '@/lib/http/sanitize';

// GET all teams with member count
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = sanitizeSearchTerm(searchParams.get('search') || '');
    const status = searchParams.get('status') || '';
    
    const offset = (page - 1) * limit;

    let query = supabase
      .from('teams')
      .select(`
        *,
        owner:account_users!teams_owner_id_fkey(user_id, first_name, last_name_paternal, display_name, email, avatar_url),
        team_members(count)
      `, { count: 'exact' });

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: teams, error, count } = await query;

    if (error) {
      console.error('Error fetching teams:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform data to include member count
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
      updatedAt: team.updated_at,
    }));

    return NextResponse.json({
      teams: transformedTeams,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Teams API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST create new team
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const { name, description, color, visibility, ownerId } = body;

    if (!name || !ownerId) {
      return NextResponse.json({ error: 'Name and owner are required' }, { status: 400 });
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const { data: team, error } = await supabase
      .from('teams')
      .insert({
        name,
        slug,
        description: description || null,
        color: color || '#00D4B3',
        visibility: visibility || 'private',
        owner_id: ownerId,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating team:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Add owner as team member with 'owner' role
    await supabase
      .from('team_members')
      .insert({
        team_id: team.team_id,
        user_id: ownerId,
        role: 'owner',
      });

    return NextResponse.json({ 
      success: true, 
      team: {
        id: team.team_id,
        name: team.name,
        slug: team.slug,
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Create team error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
