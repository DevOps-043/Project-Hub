import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireAdminOrWorkspaceMemberForTeam } from '@/lib/auth/require-role';
import { sanitizeFilterIdentifier } from '@/lib/http/sanitize';
import { computeCycleStats } from '@/lib/services/cycle-service';
import { isUuid } from '@/lib/http/validation';

export const runtime = 'nodejs';

// GET - Get all cycles for a team
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    let { teamId } = await params;

    if (!teamId) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }

    const auth = await requireAdminOrWorkspaceMemberForTeam(request, teamId);
    if (!auth.ok) return auth.response;

    // RESOLUCIÓN DE TEAM ID (UUID o Slug)
    const isUUID = isUuid(teamId);
    if (!isUUID) {
       const { data: teamData } = await supabaseAdmin
         .from('teams')
         .select('team_id')
         .or(`slug.eq.${sanitizeFilterIdentifier(teamId)},name.eq.${sanitizeFilterIdentifier(teamId)}`)
         .single();
       if (teamData) teamId = teamData.team_id;
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

    // Una sola query batched para todos los ciclos (antes: 2 queries por
    // ciclo, 2N+1 en total). La agregación vive en lib/services/cycle-service
    // para poder probarla sin mockear Supabase.
    const cycleIds = (cycles || []).map((cycle) => cycle.cycle_id);
    let issues: { cycle_id: string; completed_at: string | null }[] = [];

    if (cycleIds.length > 0) {
      const { data } = await supabaseAdmin
        .from('task_issues')
        .select('cycle_id, completed_at')
        .in('cycle_id', cycleIds);
      issues = data || [];
    }

    const cyclesWithStats = computeCycleStats(cycles || [], issues);

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

    if (!teamId) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 });
    }

    const auth = await requireAdminOrWorkspaceMemberForTeam(request, teamId);
    if (!auth.ok) return auth.response;

    const body = await request.json();
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
