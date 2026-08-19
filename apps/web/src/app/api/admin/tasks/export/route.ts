import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getTaskExportRows } from '@/lib/services/task-export-service';
import { requireAdmin } from '@/lib/auth/require-role';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseLimit(request: NextRequest): number {
  const value = Number(new URL(request.url).searchParams.get('limit') || 5000);
  return Number.isFinite(value) ? value : 5000;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const supabase = getSupabaseAdmin();
    const { data: teams, error } = await supabase
      .from('teams')
      .select('team_id');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const teamIds = (teams || []).map((team: { team_id: string }) => team.team_id);
    const result = await getTaskExportRows(supabase, teamIds, parseLimit(request));
    if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });

    return NextResponse.json({ tasks: result.rows, total: result.rows.length });
  } catch (error) {
    console.error('Error in admin task export:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
