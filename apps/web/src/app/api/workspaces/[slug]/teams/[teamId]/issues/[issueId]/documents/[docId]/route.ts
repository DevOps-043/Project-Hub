import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { requireWorkspaceMember } from '@/lib/auth/require-role';

type RouteParams = { params: Promise<{ slug: string; teamId: string; issueId: string; docId: string }> };

/**
 * DELETE /api/workspaces/:slug/teams/:teamId/issues/:issueId/documents/:docId
 * Desvincula un documento de una issue.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug, teamId, issueId, docId } = await params;
    const auth = await requireWorkspaceMember(request, slug);
    if (!auth.ok) return auth.response;
    const { payload, workspace, member } = auth;

    const supabase = getSupabaseAdmin();

    // Verificar que el team pertenece al workspace
    const { data: team } = await supabase
      .from('teams')
      .select('team_id, workspace_id')
      .eq('team_id', teamId)
      .single();

    if (!team || team.workspace_id !== workspace.workspace_id) {
      return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
    }

    // Verificar que la issue pertenece al team
    const { data: issue } = await supabase
      .from('task_issues')
      .select('issue_id, team_id')
      .eq('issue_id', issueId)
      .single();

    if (!issue || issue.team_id !== teamId) {
      return NextResponse.json({ error: 'Issue no encontrada' }, { status: 404 });
    }

    // Verificar que el documento pertenece a la issue
    const { data: doc } = await supabase
      .from('task_issue_documents')
      .select('id, issue_id, created_by')
      .eq('id', docId)
      .single();

    if (!doc || doc.issue_id !== issueId) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }

    // Solo el creador, admin u owner pueden desvincular
    const isAdminOrOwner = ['owner', 'admin'].includes(member.iris_role);
    if (doc.created_by !== payload.sub && !isAdminOrOwner) {
      return NextResponse.json({ error: 'Sin permiso para desvincular este documento' }, { status: 403 });
    }

    const { error } = await supabase
      .from('task_issue_documents')
      .delete()
      .eq('id', docId);

    if (error) {
      console.error('Error desvinculando documento:', error);
      return NextResponse.json({ error: 'Error al desvincular' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Documento desvinculado' });
  } catch (error) {
    console.error('Error en DELETE workspace issue document:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
