
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/require-role';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; memberId: string }> }
) {
  const supabase = getSupabaseAdmin();
  const resolvedParams = await params;
  const { teamId, memberId } = resolvedParams;

  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    // 1. Get Member Details & Role
    const { data: memberData, error: memberError } = await supabase
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
          job_title:company_role,
          department,
          phone_number
        )
      `)
      .eq('team_id', teamId)
      .eq('user_id', memberId)
      .single();

    if (memberError || !memberData) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // 2. Get Assigned Tasks (in this team)
    const { data: tasksData, error: tasksError } = await supabase
      .from('task_issues')
      .select(`
        issue_id,
        issue_number,
        title,
        status_id,
        priority_id,
        due_date,
        created_at,
        status:task_statuses(name, color, status_type),
        priority:task_priorities(name, color, icon)
      `)
      .eq('team_id', teamId)
      .eq('assignee_id', memberId)
      .order('created_at', { ascending: false });

    // 3. Get Project Participations
    const { data: projectsData, error: projectsError } = await supabase
      .from('pm_project_members')
      .select(`
        project_role,
        joined_at,
        project:pm_projects (
          project_id,
          project_name,
          project_key,
          project_status,
          icon_color
        )
      `)
      .eq('user_id', memberId)
      // We assume we only want projects associated with this team, or generally visible projects. 
      // If projects belong to a team, we should filter by team_id inside project relation if possible, 
      // or filter in application logic. Assuming pm_projects has team_id:
      .eq('project.team_id', teamId); 
      // Note: deeply nested filtering might require !inner join logic, 
      // simplified here assuming fetch all user projects or filtering post-fetch if necessary.
      // Let's improve query to be safe:
      
    // Refined Project Query to ensure team context
    const { data: teamProjects } = await supabase
        .from('pm_projects')
        .select('project_id')
        .eq('team_id', teamId);
        
    const teamProjectIds = teamProjects?.map(p => p.project_id) || [];
    
    // Filter participations
    // Actually, simpler: fetch projects of this team where user is a member
    // But Supabase join filtering is tricky. Let's stick to simple:
    // Get projects of this team, check membership.
    // OR: Get projects where team_id = X AND member = Y.
    // Let's try fetching memberships and then filter by returned project's team_id if it was selected.
    
    // Better approach for Supabase:
    // Select from projects where team_id = teamId and exists (select 1 from members where user_id = memberId)
    // But projects definition might not have direct member link without join.
    // Let's use the explicit link table `pm_project_members` joined with `pm_projects`.
    
    const { data: rawProjects, error: rawProjectsError } = await supabase
       .from('pm_project_members')
       .select(`
         project_role,
         joined_at,
         project:pm_projects!inner (
           project_id,
           project_name,
           project_key,
           project_status,
           icon_color,
           team_id
         )
       `)
       .eq('user_id', memberId)
       .eq('project.team_id', teamId);

    // 4. Activity Logs (Login history is global, maybe just task history?)
    // Skipping for now to keep it lightweight.

    return NextResponse.json({
      user: {
        ...memberData.users,
        role: memberData.role,
        joined_at: memberData.joined_at
      },
      tasks: tasksData || [],
      projects: (rawProjects as unknown as Array<{ project: Record<string, unknown> | null; project_role: string; joined_at: string }> | null)?.map((p) => ({
        ...p.project,
        role: p.project_role,
        joined_at: p.joined_at
      })) || []
    });

  } catch (error) {
    console.error('Error fetching member details:', error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
