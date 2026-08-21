import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { requireWorkspaceMember } from '@/lib/auth/require-role';

type RouteParams = { params: Promise<{ slug: string; teamId: string; docId: string }> };

/**
 * DELETE /api/workspaces/:slug/teams/:teamId/documents/:docId
 * Desvincula un documento de un equipo.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug, teamId, docId } = await params;
    const auth = await requireWorkspaceMember(request, slug);
    if (!auth.ok) return auth.response;
    const { payload, workspace, member } = auth;

    const supabase = getSupabaseAdmin();

    const { data: team } = await supabase
      .from('teams')
      .select('team_id, workspace_id')
      .eq('team_id', teamId)
      .single();

    if (!team || team.workspace_id !== workspace.workspace_id) {
      return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
    }

    const { data: doc } = await supabase
      .from('team_documents')
      .select('id, team_id, created_by')
      .eq('id', docId)
      .single();

    if (!doc || doc.team_id !== teamId) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }

    const isAdminOrOwner = ['owner', 'admin'].includes(member.iris_role);
    if (doc.created_by !== payload.sub && !isAdminOrOwner) {
      return NextResponse.json({ error: 'Sin permiso para desvincular este documento' }, { status: 403 });
    }

    const { error } = await supabase
      .from('team_documents')
      .delete()
      .eq('id', docId);

    if (error) {
      console.error('Error desvinculando documento de equipo:', error);
      return NextResponse.json({ error: 'Error al desvincular' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Documento desvinculado' });
  } catch (error) {
    console.error('Error en DELETE team document:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
