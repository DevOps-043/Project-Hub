/**
 * API Route: /api/ext/projects
 * 
 * Endpoint para que la extensión SOFLIA pueda:
 * - GET: Listar proyectos del usuario autenticado
 * - POST: Crear nuevos proyectos
 * 
 * Autenticación: 
 * - Acepta JWT del Project Hub (Bearer token)
 * - Verifica que el usuario exista en Project Hub
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth/jwt';

export const runtime = 'nodejs';

// Middleware de autenticación para la extensión
async function authenticateExtension(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Token no proporcionado', status: 401 };
  }

  const token = authHeader.substring(7);
  const payload = await verifyToken(token);

  if (!payload || payload.type !== 'access') {
    return { error: 'Token inválido o expirado', status: 401 };
  }

  return { userId: payload.sub, payload };
}

/**
 * GET /api/ext/projects - Lista los proyectos
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateExtension(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('team_id');

    let query = supabaseAdmin
      .from('pm_projects')
      .select('*')
      .is('archived_at', null)
      .order('updated_at', { ascending: false });

    if (teamId) query = query.eq('team_id', teamId);

    const { data, error } = await query;

    if (error) {
      console.error('[EXT] Error obteniendo proyectos:', error);
      return NextResponse.json({ error: 'Error al obtener proyectos' }, { status: 500 });
    }

    return NextResponse.json({ projects: data || [] });
  } catch (error) {
    console.error('[EXT] Error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

/**
 * POST /api/ext/projects - Crea un nuevo proyecto
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateExtension(request);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { name, description, identifier, team_id, emoji } = body;

    if (!name) {
      return NextResponse.json({ error: 'El nombre del proyecto es requerido' }, { status: 400 });
    }

    const projectData = {
      name,
      description: description || null,
      identifier: identifier || name.substring(0, 5).toUpperCase().replace(/\s/g, ''),
      team_id: team_id || null,
      creator_id: auth.userId,
      lead_id: auth.userId,
      status: 'active',
      network: 'private',
      emoji: emoji || '📁',
    };

    const { data, error } = await supabaseAdmin
      .from('pm_projects')
      .insert(projectData)
      .select()
      .single();

    if (error) {
      console.error('[EXT] Error creando proyecto:', error);
      return NextResponse.json({ error: 'Error al crear proyecto' }, { status: 500 });
    }

    return NextResponse.json({ project: data }, { status: 201 });
  } catch (error) {
    console.error('[EXT] Error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
