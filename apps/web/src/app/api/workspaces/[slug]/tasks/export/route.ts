import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getWorkspaceBySlug, getUserWorkspaceRole } from '@/lib/services/workspace-service';
import { getTaskExportRows } from '@/lib/services/task-export-service';
import { verifyToken } from '@/lib/auth/jwt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getBearerToken(request: NextRequest): string | null {
  const cookieToken = request.cookies.get('accessToken')?.value;
  if (cookieToken) return cookieToken;

  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.substring(7);

  return null;
}

function parseLimit(request: NextRequest): number {
  const value = Number(new URL(request.url).searchParams.get('limit') || 2000);
  return Number.isFinite(value) ? value : 2000;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload || payload.type !== 'access') {
      return NextResponse.json({ error: 'Token invalido' }, { status: 401 });
    }

    const { slug } = await params;
    const workspace = await getWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: 'Workspace no encontrado' }, { status: 404 });

    const member = await getUserWorkspaceRole(workspace.workspace_id, payload.sub);
    if (!member || !member.is_active) {
      return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const canExportWorkspace = ['owner', 'admin', 'manager'].includes(member.iris_role);
    let teamIds: string[] = [];

    if (canExportWorkspace) {
      const { data: teams, error } = await supabase
        .from('teams')
        .select('team_id')
        .eq('workspace_id', workspace.workspace_id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      teamIds = (teams || []).map((team: { team_id: string }) => team.team_id);
    } else {
      const { data: teamMemberships, error } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', payload.sub)
        .eq('is_active', true);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const memberTeamIds = (teamMemberships || []).map((row: { team_id: string }) => row.team_id);

      if (memberTeamIds.length > 0) {
        const { data: workspaceTeams, error: teamsError } = await supabase
          .from('teams')
          .select('team_id')
          .eq('workspace_id', workspace.workspace_id)
          .in('team_id', memberTeamIds);

        if (teamsError) return NextResponse.json({ error: teamsError.message }, { status: 500 });
        teamIds = (workspaceTeams || []).map((team: { team_id: string }) => team.team_id);
      }
    }

    const result = await getTaskExportRows(supabase, teamIds, parseLimit(request));
    if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });

    return NextResponse.json({ tasks: result.rows, total: result.rows.length });
  } catch (error) {
    console.error('Error in workspace task export:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
