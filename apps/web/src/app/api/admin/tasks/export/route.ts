import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
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
  const value = Number(new URL(request.url).searchParams.get('limit') || 5000);
  return Number.isFinite(value) ? value : 5000;
}

export async function GET(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload || payload.type !== 'access') {
      return NextResponse.json({ error: 'Token invalido' }, { status: 401 });
    }

    if (!['admin', 'super_admin'].includes(payload.permissionLevel)) {
      return NextResponse.json({ error: 'Sin permisos de administrador' }, { status: 403 });
    }

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
