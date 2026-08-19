
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

    const { data: updates, error } = await supabaseAdmin
      .from('pm_project_updates')
      .select(`
        *,
        author:account_users!pm_project_updates_author_user_id_fkey (
          user_id,
          first_name,
          last_name_paternal,
          display_name,
          avatar_url
        )
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching updates:', error);
      return NextResponse.json({ error: 'Error getting updates' }, { status: 500 });
    }

    return NextResponse.json({ updates });

  } catch (err) {
    console.error('Error in GET updates:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { id: projectId } = await params;
    const body = await request.json();

    const { 
      content, 
      title, 
      type = 'general', 
      health_status, 
      user_id 
    } = body;

    if (!projectId || !content || !user_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: memberCheck } = await supabaseAdmin
        .from('pm_project_members')
        .select('project_role')
        .eq('project_id', projectId)
        .eq('user_id', user_id)
        .single();
    
    // Allow if is admin/manager or member of project. For now we assume if user_id is passed, auth guard handled checking they are logged in.
    // Ideally we verify if user has permission to post updates.

    const { data: update, error } = await supabaseAdmin
      .from('pm_project_updates')
      .insert({
        project_id: projectId,
        author_user_id: user_id,
        update_content: content,
        update_title: title,
        update_type: type,
        health_status_snapshot: health_status,
        created_at: new Date().toISOString()
      })
      .select('*, author:account_users!pm_project_updates_author_user_id_fkey(*)')
      .single();

    if (error) {
      console.error('Error creating update:', error);
      return NextResponse.json({ error: 'Error creating update' }, { status: 500 });
    }

    return NextResponse.json({ update }, { status: 201 });

  } catch (err) {
    console.error('Error in POST update:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
