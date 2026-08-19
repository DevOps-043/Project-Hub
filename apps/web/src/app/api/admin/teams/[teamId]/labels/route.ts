/**
 * API Route: /api/admin/teams/[teamId]/labels
 * GET: List labels for a team
 * POST: Create new label
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/require-role';
import { sanitizeFilterIdentifier } from '@/lib/http/sanitize';
import { isUuid } from '@/lib/http/validation';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    let { teamId } = await params;

    const auth = await requireAdmin(request);
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

    const { data: labels, error } = await supabaseAdmin
      .from('task_labels')
      .select('*')
      .eq('team_id', teamId)
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Error al obtener etiquetas' }, { status: 500 });
    }

    return NextResponse.json({ labels });

  } catch (error) {
    console.error('Error in GET labels:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    let { teamId } = await params;

    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;
    const { payload } = auth;

    // RESOLUCIÓN DE TEAM ID
    const isUUID = isUuid(teamId);
    if (!isUUID) {
       const { data: teamData } = await supabaseAdmin
         .from('teams')
         .select('team_id')
         .or(`slug.eq.${sanitizeFilterIdentifier(teamId)},name.eq.${sanitizeFilterIdentifier(teamId)}`)
         .single();
       if (teamData) teamId = teamData.team_id;
    }

    const body = await request.json();
    const { name, color, description } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
    }

    const { data: label, error } = await supabaseAdmin
      .from('task_labels')
      .insert({
        team_id: teamId,
        name: name.trim(),
        color: color || '#6366F1',
        description,
        created_by: payload.sub
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Error al crear etiqueta' }, { status: 500 });
    }

    return NextResponse.json({ label }, { status: 201 });

  } catch (error) {
    console.error('Error in POST label:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
