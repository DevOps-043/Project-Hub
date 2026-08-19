/**
 * API Route: /api/admin/priorities
 * GET: List all priorities
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/require-role';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { data: priorities, error } = await supabaseAdmin
      .from('task_priorities')
      .select('*')
      .order('level', { ascending: true });

    if (error) {
      console.error('[Priorities API] Error fetching:', error);
      return NextResponse.json({ error: 'Error al obtener prioridades' }, { status: 500 });
    }

    // If no priorities exist, seed the defaults
    if (!priorities || priorities.length === 0) {
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

      if (seedError) {
        console.error('[Priorities API] Error seeding:', seedError);
        // Return the defaults even if insert fails
        return NextResponse.json({ priorities: defaultPriorities.map((p, i) => ({ ...p, priority_id: `default-${i}` })) });
      }

      return NextResponse.json({ priorities: seeded });
    }

    return NextResponse.json({ priorities });

  } catch (error) {
    console.error('Error in GET priorities:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
