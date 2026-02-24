import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getWorkspaceBySlug, getUserWorkspaceRole } from '@/lib/services/workspace-service';
import { verifyToken } from '@/lib/auth/jwt';

type RouteParams = { params: Promise<{ slug: string; id: string }> };

/**
 * Verifica auth + workspace + membership + que el proyecto pertenece al workspace.
 * Retorna los datos necesarios o una respuesta de error.
 */
async function validateAccess(request: NextRequest, params: Promise<{ slug: string; id: string }>) {
  const { slug, id: projectId } = await params;
  const token = request.cookies.get('accessToken')?.value ||
                request.headers.get('authorization')?.replace('Bearer ', '');

  if (!token) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };

  const payload = await verifyToken(token);
  if (!payload) return { error: NextResponse.json({ error: 'Token inválido' }, { status: 401 }) };

  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) return { error: NextResponse.json({ error: 'Workspace no encontrado' }, { status: 404 }) };

  const member = await getUserWorkspaceRole(workspace.workspace_id, payload.sub);
  if (!member) return { error: NextResponse.json({ error: 'Sin acceso al workspace' }, { status: 403 }) };

  // Verificar que el proyecto pertenece al workspace
  const supabase = getSupabaseAdmin();
  const { data: project } = await supabase
    .from('pm_projects')
    .select('project_id, project_key, workspace_id')
    .eq('project_id', projectId)
    .single();

  if (!project) return { error: NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 }) };
  if (project.workspace_id !== workspace.workspace_id) {
    return { error: NextResponse.json({ error: 'Proyecto no pertenece a este workspace' }, { status: 403 }) };
  }

  return { payload, workspace, member, project, supabase };
}

/**
 * GET /api/workspaces/:slug/projects/:id/documents
 * Lista todos los documentos vinculados a un proyecto.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const access = await validateAccess(request, params);
    if ('error' in access) return access.error;

    const { project, supabase } = access;

    const { data: documents, error } = await supabase
      .from('pm_project_documents')
      .select(`
        *,
        creator:account_users!pm_project_documents_created_by_fkey(
          user_id, first_name, last_name_paternal, display_name, avatar_url
        )
      `)
      .eq('project_id', project.project_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error listando documentos:', error);
      return NextResponse.json({ error: 'Error al listar documentos' }, { status: 500 });
    }

    return NextResponse.json({ documents: documents || [] });
  } catch (error) {
    console.error('Error en GET documents:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

/**
 * POST /api/workspaces/:slug/projects/:id/documents
 * Vincula un documento externo al proyecto.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const access = await validateAccess(request, params);
    if ('error' in access) return access.error;

    const { payload, project, supabase } = access;

    const body = await request.json();
    const { name, provider, external_id, external_url, doc_type, mime_type, thumbnail_url, metadata } = body;

    // Validación básica
    if (!name || !external_id || !external_url) {
      return NextResponse.json(
        { error: 'Campos requeridos: name, external_id, external_url' },
        { status: 400 }
      );
    }

    const validProviders = ['google_drive', 'google_sheets', 'google_docs', 'internal'];
    if (provider && !validProviders.includes(provider)) {
      return NextResponse.json({ error: 'Provider inválido' }, { status: 400 });
    }

    const validDocTypes = ['spreadsheet', 'document', 'presentation', 'folder', 'other'];
    if (doc_type && !validDocTypes.includes(doc_type)) {
      return NextResponse.json({ error: 'doc_type inválido' }, { status: 400 });
    }

    const { data: document, error } = await supabase
      .from('pm_project_documents')
      .insert({
        project_id: project.project_id,
        name,
        provider: provider || 'google_drive',
        external_id,
        external_url,
        doc_type: doc_type || 'document',
        mime_type: mime_type || null,
        thumbnail_url: thumbnail_url || null,
        created_by: payload.sub,
        metadata: metadata || {},
      })
      .select(`
        *,
        creator:account_users!pm_project_documents_created_by_fkey(
          user_id, first_name, last_name_paternal, display_name, avatar_url
        )
      `)
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Este documento ya está vinculado al proyecto' }, { status: 409 });
      }
      console.error('Error vinculando documento:', error);
      return NextResponse.json({ error: 'Error al vincular documento' }, { status: 500 });
    }

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    console.error('Error en POST documents:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
