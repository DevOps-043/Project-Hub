import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth/jwt';

type RouteParams = { params: Promise<{ teamId: string; issueId: string; docId: string }> };

/**
 * DELETE /api/admin/teams/:teamId/issues/:issueId/documents/:docId
 * Desvincula un documento de una issue (ruta admin).
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { teamId, issueId, docId } = await params;
    const token = request.cookies.get('accessToken')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    if (!['admin', 'super_admin'].includes(payload.permissionLevel)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

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
      .select('id, issue_id')
      .eq('id', docId)
      .single();

    if (!doc || doc.issue_id !== issueId) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
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
    console.error('Error en DELETE admin issue document:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
