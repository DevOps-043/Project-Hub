/**
 * API Route: /api/admin/teams/[teamId]/statuses
 * GET: List statuses for a team
 * POST: Create new status
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth/jwt';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    let { teamId } = await params;
    
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // RESOLUCIÓN DE TEAM ID (UUID o Slug)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId);
    if (!isUUID) {
       const { data: teamData } = await supabaseAdmin
         .from('teams')
         .select('team_id')
         .or(`slug.eq.${teamId},name.eq.${teamId}`)
         .single();
       if (teamData) teamId = teamData.team_id;
    }

    const { data: statuses, error } = await supabaseAdmin
      .from('task_statuses')
      .select('*')
      .eq('team_id', teamId)
      .order('position', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Error al obtener estados' }, { status: 500 });
    }

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
    
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // RESOLUCIÓN DE TEAM ID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId);
    if (!isUUID) {
       const { data: teamData } = await supabaseAdmin
         .from('teams')
         .select('team_id')
         .or(`slug.eq.${teamId},name.eq.${teamId}`)
         .single();
       if (teamData) teamId = teamData.team_id;
    }

    const body = await request.json();
    const { name, status_type, color, icon, is_closed } = body;

    if (!name?.trim() || !status_type) {
      return NextResponse.json({ error: 'Nombre y tipo son requeridos' }, { status: 400 });
    }

    // Get max position
    const { data: maxPos } = await supabaseAdmin
      .from('task_statuses')
      .select('position')
      .eq('team_id', teamId)
      .order('position', { ascending: false })
      .limit(1)
      .single();

    const { data: status, error } = await supabaseAdmin
      .from('task_statuses')
      .insert({
        team_id: teamId,
        name: name.trim(),
        status_type,
        color: color || '#6B7280',
        icon,
        is_closed: is_closed || false,
        position: (maxPos?.position || 0) + 1
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
