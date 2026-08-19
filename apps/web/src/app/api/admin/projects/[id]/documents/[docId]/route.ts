import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/require-role';

type RouteParams = { params: Promise<{ id: string; docId: string }> };

/**
 * DELETE /api/admin/projects/:id/documents/:docId
 * Desvincula un documento de un proyecto (ruta admin).
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: projectId, docId } = await params;
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { payload } = auth;

    if (!['admin', 'super_admin'].includes(payload.permissionLevel)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    // Verificar que el documento pertenece al proyecto
    const { data: doc } = await supabase
      .from('pm_project_documents')
      .select('id, project_id')
      .eq('id', docId)
      .single();

    if (!doc || doc.project_id !== projectId) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
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
    console.error('Error en DELETE admin document:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
