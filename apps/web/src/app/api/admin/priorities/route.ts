/**
 * API Route: /api/admin/priorities
 * GET: List all priorities
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth/jwt';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { data: priorities, error } = await supabaseAdmin
      .from('task_priorities')
      .select('*')
      .order('level', { ascending: true });

    console.log('[Priorities API] Query result:', { count: priorities?.length, error, data: priorities });

    if (error) {
      console.error('[Priorities API] Error fetching:', error);
      return NextResponse.json({ error: 'Error al obtener prioridades' }, { status: 500 });
    }

    // If no priorities exist, seed the defaults
    if (!priorities || priorities.length === 0) {
      console.log('[Priorities API] No priorities found, seeding defaults...');
      const defaultPriorities = [
        { name: 'Sin prioridad', level: 0, color: '#6B7280', icon: 'minus' },
        { name: 'Urgente', level: 1, color: '#EF4444', icon: 'alert-circle' },
        { name: 'Alta', level: 2, color: '#F97316', icon: 'chevron-up' },
        { name: 'Media', level: 3, color: '#EAB308', icon: 'equal' },
        { name: 'Baja', level: 4, color: '#22C55E', icon: 'chevron-down' },
      ];

      const { data: seeded, error: seedError } = await supabaseAdmin
        .from('task_priorities')
        .insert(defaultPriorities)
        .select();

      console.log('[Priorities API] Seed result:', { seeded, seedError });

      if (seedError) {
        console.error('[Priorities API] Error seeding:', seedError);
        // Return the defaults even if insert fails
        return NextResponse.json({ priorities: defaultPriorities.map((p, i) => ({ ...p, priority_id: `default-${i}` })) });
      }

      return NextResponse.json({ priorities: seeded });
    }

    console.log('[Priorities API] Returning', priorities.length, 'priorities');
    return NextResponse.json({ priorities });

  } catch (error) {
    console.error('Error in GET priorities:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
