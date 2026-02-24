import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getWorkspaceBySlug, getUserWorkspaceRole } from '@/lib/services/workspace-service';
import { verifyToken } from '@/lib/auth/jwt';

type RouteParams = { params: Promise<{ slug: string; id: string; docId: string }> };

/**
 * DELETE /api/workspaces/:slug/projects/:id/documents/:docId
 * Desvincula un documento de un proyecto.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug, id: projectId, docId } = await params;
    const token = request.cookies.get('accessToken')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

    const workspace = await getWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: 'Workspace no encontrado' }, { status: 404 });

    const member = await getUserWorkspaceRole(workspace.workspace_id, payload.sub);
    if (!member) return NextResponse.json({ error: 'Sin acceso al workspace' }, { status: 403 });

    const supabase = getSupabaseAdmin();

    // Verificar que el proyecto pertenece al workspace
    const { data: project } = await supabase
      .from('pm_projects')
      .select('project_id, workspace_id')
      .eq('project_id', projectId)
      .single();

    if (!project || project.workspace_id !== workspace.workspace_id) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    // Verificar que el documento pertenece al proyecto
    const { data: doc } = await supabase
      .from('pm_project_documents')
      .select('id, project_id, created_by')
      .eq('id', docId)
      .single();

    if (!doc || doc.project_id !== projectId) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }

    // Solo el creador, admin u owner pueden desvincular
    const isAdminOrOwner = ['owner', 'admin'].includes(member.iris_role);
    if (doc.created_by !== payload.sub && !isAdminOrOwner) {
      return NextResponse.json({ error: 'Sin permiso para desvincular este documento' }, { status: 403 });
    }

    const { error } = await supabase
      .from('pm_project_documents')
      .delete()
      .eq('id', docId);

    if (error) {
      console.error('Error desvinculando documento:', error);
      return NextResponse.json({ error: 'Error al desvincular' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Documento desvinculado' });
  } catch (error) {
    console.error('Error en DELETE document:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
