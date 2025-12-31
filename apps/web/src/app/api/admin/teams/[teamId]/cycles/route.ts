import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// GET - Get all cycles for a team
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;

    if (!teamId) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }

    // Fetch cycles with issue counts
    const { data: cycles, error } = await supabaseAdmin
      .from('task_cycles')
      .select('*')
      .eq('team_id', teamId)
      .order('cycle_number', { ascending: false });

    if (error) {
      console.error('Error fetching cycles:', error);
      return NextResponse.json({ error: 'Failed to fetch cycles' }, { status: 500 });
    }

    // Get issue counts for each cycle
    const cyclesWithStats = await Promise.all(
      (cycles || []).map(async (cycle) => {
        // Get total issues in cycle
        const { count: totalCount } = await supabaseAdmin
          .from('task_issues')
          .select('*', { count: 'exact', head: true })
          .eq('cycle_id', cycle.cycle_id);

        // Get completed issues (issues with status_type = 'done')
        const { data: completedIssues } = await supabaseAdmin
          .from('task_issues')
          .select('issue_id, status:task_statuses!inner(status_type)')
          .eq('cycle_id', cycle.cycle_id)
          .not('completed_at', 'is', null);

        const completedCount = completedIssues?.length || 0;
        const scopeCount = totalCount || 0;
        const progressPercent = scopeCount > 0 ? Math.round((completedCount / scopeCount) * 100) : 0;

        return {
          ...cycle,
          scope_count: scopeCount,
          completed_count: completedCount,
          progress_percent: progressPercent
        };
      })
    );

    return NextResponse.json({ cycles: cyclesWithStats });

  } catch (err) {
    console.error('Error in GET cycles:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST - Create a new cycle
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const body = await request.json();

    if (!teamId) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }

    const { name, description, start_date, end_date, cooldown_days } = body;

    if (!name || !start_date || !end_date) {
      return NextResponse.json({ 
        error: 'Name, start_date, and end_date are required' 
      }, { status: 400 });
    }

    // Get the next cycle number for this team
    const { data: lastCycle } = await supabaseAdmin
      .from('task_cycles')
      .select('cycle_number')
      .eq('team_id', teamId)
      .order('cycle_number', { ascending: false })
      .limit(1)
      .single();

    const nextCycleNumber = (lastCycle?.cycle_number || 0) + 1;

    // Determine status based on dates
    const today = new Date();
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    let status = 'upcoming';
    if (today >= startDate && today <= endDate) {
      status = 'active';
    } else if (today > endDate) {
      status = 'completed';
    }

    // Create the cycle
    const { data: cycle, error } = await supabaseAdmin
      .from('task_cycles')
      .insert({
        team_id: teamId,
        cycle_number: nextCycleNumber,
        name: name || `Cycle ${nextCycleNumber}`,
        description: description || null,
        start_date,
        end_date,
        cooldown_days: cooldown_days || 7,
        status
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating cycle:', error);
      return NextResponse.json({ error: 'Failed to create cycle' }, { status: 500 });
    }

    return NextResponse.json({ cycle }, { status: 201 });

  } catch (err) {
    console.error('Error in POST cycle:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
