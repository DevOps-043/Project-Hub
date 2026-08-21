/**
 * API Route: /api/admin/teams/[teamId]/statuses
 * GET: List statuses for a team
 * POST: Create new status
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireAdminOrWorkspaceMemberForTeam } from '@/lib/auth/require-role';
import { ensureDefaultTaskStatuses, resolveTeamId } from '@/lib/services/task-status-service';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    let { teamId } = await params;

    const resolvedTeamId = await resolveTeamId(supabaseAdmin, teamId);
    if (!resolvedTeamId) {
      return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
    }
    teamId = resolvedTeamId;

    const auth = await requireAdminOrWorkspaceMemberForTeam(request, teamId);
    if (!auth.ok) return auth.response;

    const statuses = await ensureDefaultTaskStatuses(supabaseAdmin, teamId);
    return NextResponse.json({ statuses });
  } catch (error) {
    console.error('Error in GET statuses:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    let { teamId } = await params;

    const resolvedTeamId = await resolveTeamId(supabaseAdmin, teamId);
    if (!resolvedTeamId) {
      return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
    }
    teamId = resolvedTeamId;

    const auth = await requireAdminOrWorkspaceMemberForTeam(request, teamId);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { name, status_type, color, icon, is_closed } = body;

    if (!name?.trim() || !status_type) {
      return NextResponse.json({ error: 'Nombre y tipo son requeridos' }, { status: 400 });
    }

    const { data: maxPos } = await supabaseAdmin
      .from('task_statuses')
      .select('position')
      .eq('team_id', teamId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: status, error } = await supabaseAdmin
      .from('task_statuses')
      .insert({
        team_id: teamId,
        name: name.trim(),
        status_type,
        color: color || '#6B7280',
        icon,
        is_closed: is_closed || false,
        position: (maxPos?.position ?? -1) + 1
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Error al crear estado' }, { status: 500 });
    }

    return NextResponse.json({ status }, { status: 201 });
  } catch (error) {
    console.error('Error in POST status:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
