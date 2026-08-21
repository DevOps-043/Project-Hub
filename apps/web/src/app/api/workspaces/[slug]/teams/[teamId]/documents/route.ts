import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { requireWorkspaceMember } from '@/lib/auth/require-role';

type RouteParams = { params: Promise<{ slug: string; teamId: string }> };

/**
 * Verifica auth + workspace + membership + que el equipo pertenece al workspace.
 * Retorna los datos necesarios o una respuesta de error.
 */
async function validateAccess(request: NextRequest, params: Promise<{ slug: string; teamId: string }>) {
  const { slug, teamId } = await params;
  const auth = await requireWorkspaceMember(request, slug);
  if (!auth.ok) return { error: auth.response };
  const { payload, workspace, member } = auth;

  const supabase = getSupabaseAdmin();
  const { data: team } = await supabase
    .from('teams')
    .select('team_id, workspace_id')
    .eq('team_id', teamId)
    .maybeSingle();

  if (!team) return { error: NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 }) };
  if (team.workspace_id !== workspace.workspace_id) {
    return { error: NextResponse.json({ error: 'Equipo no pertenece a este workspace' }, { status: 403 }) };
  }

  return { payload, workspace, member, team, supabase };
}

/**
 * GET /api/workspaces/:slug/teams/:teamId/documents
 * Lista todos los documentos vinculados a un equipo.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const access = await validateAccess(request, params);
    if ('error' in access) return access.error;

    const { team, supabase } = access;

    const { data: documents, error } = await supabase
      .from('team_documents')
      .select(`
        *,
        creator:account_users!team_documents_created_by_fkey(
          user_id, first_name, last_name_paternal, display_name, avatar_url
        )
      `)
      .eq('team_id', team.team_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error listando documentos de equipo:', error);
      return NextResponse.json({ error: 'Error al listar documentos' }, { status: 500 });
    }

    return NextResponse.json({ documents: documents || [] });
  } catch (error) {
    console.error('Error en GET team documents:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

/**
 * POST /api/workspaces/:slug/teams/:teamId/documents
 * Vincula un documento externo al equipo.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const access = await validateAccess(request, params);
    if ('error' in access) return access.error;

    const { payload, team, supabase } = access;

    const body = await request.json();
    const { name, provider, external_id, external_url, doc_type, mime_type, thumbnail_url, metadata } = body;

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
      .from('team_documents')
      .insert({
        team_id: team.team_id,
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
        creator:account_users!team_documents_created_by_fkey(
          user_id, first_name, last_name_paternal, display_name, avatar_url
        )
      `)
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Este documento ya está vinculado al equipo' }, { status: 409 });
      }
      console.error('Error vinculando documento de equipo:', error);
      return NextResponse.json({ error: 'Error al vincular documento' }, { status: 500 });
    }

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    console.error('Error en POST team documents:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
