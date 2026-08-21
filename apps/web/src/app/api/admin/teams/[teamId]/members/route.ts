
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrWorkspaceMemberForTeam, requireAuth } from '@/lib/auth/require-role';
import { sanitizeFilterIdentifier } from '@/lib/http/sanitize';
import { isUuid } from '@/lib/http/validation';

interface TeamMemberUserProfile {
  user_id: string;
  first_name: string;
  last_name_paternal: string;
  display_name: string | null;
  email: string;
  avatar_url: string | null;
  last_activity_at: string | null;
  account_status: string;
}

interface TeamMemberRow {
  role: string;
  user_id: string;
  joined_at: string;
}

interface TaskStatRow {
  assignee_id: string | null;
  status_id: string;
  task_statuses: { status_type: string } | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const supabase = getSupabaseAdmin();
  let { teamId } = await params;

  try {
    // Chequeo barato de "hay un JWT válido" antes de tocar la DB para resolver
    // el slug; el chequeo de permisos completo (que necesita el team_id real
    // para ubicar su workspace) va después de la resolución.
    const authCheck = await requireAuth(request);
    if (!authCheck.ok) return authCheck.response;

    // RESOLUCIÓN DE TEAM ID (UUID o Slug)
    const isUUID = isUuid(teamId);
    if (!isUUID) {
       const { data: teamData } = await supabase
         .from('teams')
         .select('team_id')
         .or(`slug.eq.${sanitizeFilterIdentifier(teamId)},name.eq.${sanitizeFilterIdentifier(teamId)}`)
         .single();
       if (teamData) teamId = teamData.team_id;
    }

    const auth = await requireAdminOrWorkspaceMemberForTeam(request, teamId);
    if (!auth.ok) return auth.response;

    // 1. Get Team Details
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('team_id, name, color')
      .eq('team_id', teamId)
      .single();

    if (teamError) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // 2. Resolve memberships and profiles in separate queries. This avoids
    // silently dropping members when an embedded relationship is unavailable.
    const { data: membersData, error: membersError } = await supabase
      .from('team_members')
      .select('user_id, role, joined_at')
      .eq('team_id', teamId)
      .eq('is_active', true)
      .order('joined_at', { ascending: true });

    if (membersError) {
      console.error('Error fetching members:', membersError);
      return NextResponse.json({ error: membersError.message }, { status: 500 });
    }

    const memberships = (membersData || []) as TeamMemberRow[];
    const userIds = memberships.map((member) => member.user_id);
    let profiles: TeamMemberUserProfile[] = [];

    if (userIds.length > 0) {
      const { data: profileData, error: profilesError } = await supabase
        .from('account_users')
        .select('user_id, first_name, last_name_paternal, display_name, email, avatar_url, last_activity_at, account_status')
        .in('user_id', userIds);

      if (profilesError) {
        console.error('Error fetching member profiles:', profilesError);
        return NextResponse.json({ error: profilesError.message }, { status: 500 });
      }
      profiles = (profileData || []) as TeamMemberUserProfile[];
    }

    const profilesById = new Map(profiles.map((profile) => [profile.user_id, profile]));
    let taskStats: TaskStatRow[] = [];

    if (userIds.length > 0) {
      const { data, error } = await supabase
        .from('task_issues')
        .select('assignee_id, status_id, task_statuses!inner(status_type)')
        .eq('team_id', teamId)
        .in('assignee_id', userIds);

      if (!error) taskStats = (data || []) as unknown as TaskStatRow[];
    }

    const tasksByUser: Record<string, { total: number; completed: number }> = {};
    userIds.forEach((id) => { tasksByUser[id] = { total: 0, completed: 0 }; });

    taskStats.forEach((task) => {
      const userId = task.assignee_id;
      if (!userId || !tasksByUser[userId]) return;
      tasksByUser[userId].total += 1;
      if (task.task_statuses?.status_type === 'done' || task.task_statuses?.status_type === 'completed') {
        tasksByUser[userId].completed += 1;
      }
    });

    const formattedMembers = memberships.map((item) => {
      const user = profilesById.get(item.user_id);
      const stats = tasksByUser[item.user_id] || { total: 0, completed: 0 };
      const lastActive = user?.last_activity_at ? new Date(user.last_activity_at) : null;
      const isOnline = Boolean(lastActive && Date.now() - lastActive.getTime() < 1000 * 60 * 15);

      return {
        user_id: item.user_id,
        first_name: user?.first_name || '',
        last_name_paternal: user?.last_name_paternal || '',
        display_name: user?.display_name || user?.email || 'Miembro',
        email: user?.email || '',
        avatar_url: user?.avatar_url || null,
        role: item.role,
        status: isOnline ? 'active' : 'offline',
        joined_at: item.joined_at,
        tasks_count: stats.total,
        completed_tasks_count: stats.completed,
      };
    });

    return NextResponse.json({
      team: {
        id: team.team_id,
        name: team.name,
        color: team.color
      },
      members: formattedMembers
    });

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const supabase = getSupabaseAdmin();
  const { teamId } = await params;

  try {
    const auth = await requireAdminOrWorkspaceMemberForTeam(request, teamId);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { user_id, role } = body;

    if (!user_id || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Insert user into team_members
    const { data, error } = await supabase
      .from('team_members')
      .insert({
        team_id: teamId,
        user_id: user_id,
        role: role,
        joined_at: new Date().toISOString(),
        is_active: true
      })
      .select()
      .single();

    if (error) {
      // Check for uniqueness violation (already member)
      if (error.code === '23505') {
         return NextResponse.json({ error: 'This user is already a member of the team.' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, member: data });

  } catch (error) {
    console.error('Error adding team member:', error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
