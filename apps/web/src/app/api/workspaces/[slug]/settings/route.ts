import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getWorkspaceBySlug, getUserWorkspaceRole } from '@/lib/services/workspace-service';
import { verifyToken } from '@/lib/auth/jwt';

type RouteParams = { params: Promise<{ slug: string }> };

/**
 * PATCH /api/workspaces/:slug/settings
 * Actualiza los settings (JSONB) del workspace. Solo owner/admin.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const token = request.cookies.get('accessToken')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    const workspace = await getWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: 'Workspace no encontrado' }, { status: 404 });

    const member = await getUserWorkspaceRole(workspace.workspace_id, payload.sub);
    if (!member) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

    // Solo owner/admin pueden modificar settings
    if (!['owner', 'admin'].includes(member.iris_role)) {
      return NextResponse.json({ error: 'Sin permisos para modificar settings' }, { status: 403 });
    }

    const body = await request.json();
    const { settings } = body;

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ error: 'Settings debe ser un objeto JSON' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('workspaces')
      .update({ settings })
      .eq('workspace_id', workspace.workspace_id)
      .select('settings')
      .single();

    if (error) {
      console.error('Error actualizando settings:', error);
      return NextResponse.json({ error: 'Error al guardar settings' }, { status: 500 });
    }

    return NextResponse.json({ settings: data.settings });
  } catch (error) {
    console.error('Error en PATCH workspace settings:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
