
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-role';
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
  joined_at: string;
  users: TeamMemberUserProfile;
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
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

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

    // 1. Get Team Details
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('team_id, name, color')
      .eq('team_id', teamId)
      .single();

    if (teamError) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // 2. Get Team Members with User Details
    const { data: membersData, error: membersError } = await supabase
      .from('team_members')
      .select(`
        role,
        joined_at,
        users:account_users!team_members_user_id_fkey (
          user_id,
          first_name,
          last_name_paternal,
          display_name,
          email,
          avatar_url,
          last_activity_at,
          account_status
        )
      `)
      .eq('team_id', teamId);

    if (membersError) {
      console.error('Error fetching members:', membersError);
      return NextResponse.json({ error: membersError.message }, { status: 500 });
    }

    // 3. Transform data and fetch task counts efficiently
    // To avoid N+1 queries, we'll fetch task stats in a separate aggregated query or parallel promises if needed.
    // For now, let's try to get task counts for these users within this team context.
    
    // Get all tasks for this team to count locally (efficient for small/medium teams)
    // Or simpler: Just count total tasks assigned to these users in this team
    const userIds = (membersData as unknown as TeamMemberRow[]).map((m) => m.users.user_id);
    
    const { data: taskStats, error: taskStatsError } = await supabase
      .from('task_issues')
      .select('assignee_id, status_id, task_statuses!inner(status_type)')
      .eq('team_id', teamId)
      .in('assignee_id', userIds);

    const tasksByUser: Record<string, { total: number; completed: number }> = {};
    
    // Initialize counters
    userIds.forEach(id => {
      tasksByUser[id] = { total: 0, completed: 0 };
    });

    if (!taskStatsError && taskStats) {
      (taskStats as unknown as TaskStatRow[]).forEach((task) => {
        const userId = task.assignee_id;
        if (userId && tasksByUser[userId]) {
          tasksByUser[userId].total += 1;
          if (task.task_statuses?.status_type === 'done' || task.task_statuses?.status_type === 'completed') {
            tasksByUser[userId].completed += 1;
          }
        }
      });
    }

    const formattedMembers = (membersData as unknown as TeamMemberRow[]).map((item) => {
      const user = item.users;
      const stats = tasksByUser[user.user_id] || { total: 0, completed: 0 };
      
      // Determine online/active status based on last_activity_at (e.g., within last 5 minutes)
      // This is a rough approximation
      const lastActive = user.last_activity_at ? new Date(user.last_activity_at) : null;
      const isOnline = lastActive && (new Date().getTime() - lastActive.getTime() < 1000 * 60 * 15); // 15 mins
      
      let computedStatus = 'offline';
      if (isOnline) computedStatus = 'active';
      // 'busy' logic would typically require more complex presence system or calendar check

      return {
        user_id: user.user_id,
        first_name: user.first_name,
        last_name_paternal: user.last_name_paternal,
        display_name: user.display_name,
        email: user.email,
        avatar_url: user.avatar_url,
        role: item.role,
        status: computedStatus, 
        joined_at: item.joined_at,
        tasks_count: stats.total,
        completed_tasks_count: stats.completed
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
    const auth = await requireAdmin(request);
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
