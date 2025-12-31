import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// GET - Get single cycle details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; cycleId: string }> }
) {
  try {
    const { teamId, cycleId } = await params;

    if (!teamId || !cycleId) {
      return NextResponse.json({ error: 'Team ID and Cycle ID are required' }, { status: 400 });
    }

    // Fetch the cycle
    const { data: cycle, error } = await supabaseAdmin
      .from('task_cycles')
      .select('*')
      .eq('cycle_id', cycleId)
      .eq('team_id', teamId)
      .single();

    if (error || !cycle) {
      return NextResponse.json({ error: 'Cycle not found' }, { status: 404 });
    }

    // Get issues in this cycle
    const { data: issues } = await supabaseAdmin
      .from('task_issues')
      .select(`
        issue_id,
        issue_number,
        title,
        status:task_statuses(status_id, name, color, status_type),
        priority:task_priorities(priority_id, name, level, color),
        assignee_id,
        created_at,
        completed_at
      `)
      .eq('cycle_id', cycleId)
      .order('created_at', { ascending: false });

    // Calculate stats
    const totalIssues = issues?.length || 0;
    const completedIssues = issues?.filter(i => i.completed_at !== null).length || 0;
    const progressPercent = totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0;

    return NextResponse.json({
      cycle: {
        ...cycle,
        scope_count: totalIssues,
        completed_count: completedIssues,
        progress_percent: progressPercent
      },
      issues: issues || []
    });

  } catch (err) {
    console.error('Error in GET cycle:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PATCH - Update a cycle
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; cycleId: string }> }
) {
  try {
    const { teamId, cycleId } = await params;
    const body = await request.json();

    if (!teamId || !cycleId) {
      return NextResponse.json({ error: 'Team ID and Cycle ID are required' }, { status: 400 });
    }

    const allowedFields = ['name', 'description', 'start_date', 'end_date', 'cooldown_days', 'status'];
    const updateData: any = { updated_at: new Date().toISOString() };

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // If status is being set to completed, set completed_at
    if (body.status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { data: cycle, error } = await supabaseAdmin
      .from('task_cycles')
      .update(updateData)
      .eq('cycle_id', cycleId)
      .eq('team_id', teamId)
      .select()
      .single();

    if (error) {
      console.error('Error updating cycle:', error);
      return NextResponse.json({ error: 'Failed to update cycle' }, { status: 500 });
    }

    return NextResponse.json({ cycle });

  } catch (err) {
    console.error('Error in PATCH cycle:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE - Delete a cycle
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; cycleId: string }> }
) {
  try {
    const { teamId, cycleId } = await params;

    if (!teamId || !cycleId) {
      return NextResponse.json({ error: 'Team ID and Cycle ID are required' }, { status: 400 });
    }

    // First, remove cycle_id from all issues in this cycle
    await supabaseAdmin
      .from('task_issues')
      .update({ cycle_id: null })
      .eq('cycle_id', cycleId);

    // Delete the cycle
    const { error } = await supabaseAdmin
      .from('task_cycles')
      .delete()
      .eq('cycle_id', cycleId)
      .eq('team_id', teamId);

    if (error) {
      console.error('Error deleting cycle:', error);
      return NextResponse.json({ error: 'Failed to delete cycle' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error('Error in DELETE cycle:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
