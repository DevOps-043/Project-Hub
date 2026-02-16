import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth/jwt';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications/preferences
 * Obtiene las preferencias de notificacion del usuario autenticado.
 * Tambien soporta ?userId=xxx para consultas de SOFLIA extension (con API key).
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('accessToken')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const supabase = getSupabaseAdmin();
    let userId: string;

    // Si es API key de SOFLIA (phub_...), buscar userId del query param
    if (token.startsWith('phub_')) {
      const { verifyApiKey } = await import('@/lib/services/api-key-service');
      const result = await verifyApiKey(token);
      if (!result || !result.valid) {
        return NextResponse.json({ error: 'API key invalida' }, { status: 401 });
      }
      const queryUserId = request.nextUrl.searchParams.get('userId');
      if (!queryUserId) {
        return NextResponse.json({ error: 'userId es requerido con API key' }, { status: 400 });
      }
      userId = queryUserId;
    } else {
      const payload = await verifyToken(token);
      if (!payload) return NextResponse.json({ error: 'Token invalido' }, { status: 401 });
      userId = payload.sub;
    }

    const { data, error } = await supabase
      .from('user_notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      // No existe, devolver defaults
      return NextResponse.json({
        preferences: {
          email_daily_summary: true,
          soflia_enabled: false,
          soflia_issues: true,
          soflia_projects: true,
          soflia_team_updates: true,
          soflia_mentions: true,
          soflia_reminders: true,
        }
      });
    }

    if (error) throw error;

    return NextResponse.json({ preferences: data });
  } catch (error: any) {
    console.error('Get notification preferences error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/notifications/preferences
 * Actualiza las preferencias de notificacion del usuario autenticado.
 * Usa UPSERT para crear el registro si no existe.
 */
export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('accessToken')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalido' }, { status: 401 });

    const body = await request.json();
    const allowedFields = [
      'email_daily_summary',
      'soflia_enabled',
      'soflia_issues',
      'soflia_projects',
      'soflia_team_updates',
      'soflia_mentions',
      'soflia_reminders',
    ];

    const updates: Record<string, boolean> = {};
    for (const field of allowedFields) {
      if (typeof body[field] === 'boolean') {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No hay campos validos para actualizar' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('user_notification_preferences')
      .upsert(
        { user_id: payload.sub, ...updates },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ preferences: data });
  } catch (error: any) {
    console.error('Update notification preferences error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
