
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/require-role';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { id: projectId } = await params;

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status');

    const query = supabaseAdmin
      .from('task_issues')
      .select(`
        *,
        assignee:account_users!task_issues_assignee_id_fkey(user_id, display_name, avatar_url, first_name),
        status:task_statuses!task_issues_status_id_fkey(status_id, name, color, status_type),
        priority:task_priorities!task_issues_priority_id_fkey(priority_id, name, color, icon),
        team:teams!task_issues_team_id_fkey(team_id, slug, name)
      `)
      .eq('project_id', projectId)
      .limit(limit)
      .order('created_at', { ascending: false });

    if (status) {
         // Join with status table to filter by type if needed, or if status param is name/type
         // For simplicity assuming status filters are handled on client or by ID if specific
    }

    const { data: issues, error } = await query;

    if (error) {
      console.error('Error fetching issues:', error);
      return NextResponse.json({ error: 'Error getting issues' }, { status: 500 });
    }

    return NextResponse.json({ issues });

  } catch (err) {
    console.error('Error in GET issues:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
