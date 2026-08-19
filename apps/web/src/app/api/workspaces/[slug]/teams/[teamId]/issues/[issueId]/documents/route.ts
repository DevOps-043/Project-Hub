import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { requireWorkspaceMember } from '@/lib/auth/require-role';

type RouteParams = { params: Promise<{ slug: string; teamId: string; issueId: string }> };

/**
 * Verifica auth + workspace + membership + team pertenece al workspace + issue pertenece al team.
 */
async function validateAccess(request: NextRequest, params: Promise<{ slug: string; teamId: string; issueId: string }>) {
  const { slug, teamId, issueId } = await params;
  const auth = await requireWorkspaceMember(request, slug);
  if (!auth.ok) return { error: auth.response };
  const { payload, workspace, member } = auth;

  const supabase = getSupabaseAdmin();

  // Verificar que el team pertenece al workspace
  const { data: team } = await supabase
    .from('teams')
    .select('team_id, workspace_id')
    .eq('team_id', teamId)
    .single();

  if (!team || team.workspace_id !== workspace.workspace_id) {
    return { error: NextResponse.json({ error: 'Equipo no encontrado en este workspace' }, { status: 404 }) };
  }

  // Verificar que la issue pertenece al team
  const { data: issue } = await supabase
    .from('task_issues')
    .select('issue_id, team_id')
    .eq('issue_id', issueId)
    .single();

  if (!issue || issue.team_id !== teamId) {
    return { error: NextResponse.json({ error: 'Issue no encontrada' }, { status: 404 }) };
  }

  return { payload, workspace, member, issue, supabase };
}

/**
 * GET /api/workspaces/:slug/teams/:teamId/issues/:issueId/documents
 * Lista todos los documentos vinculados a una issue.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const access = await validateAccess(request, params);
    if ('error' in access) return access.error;

    const { issue, supabase } = access;

    const { data: documents, error } = await supabase
      .from('task_issue_documents')
      .select(`
        *,
        creator:account_users!task_issue_documents_created_by_fkey(
          user_id, first_name, last_name_paternal, display_name, avatar_url
        )
      `)
      .eq('issue_id', issue.issue_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error listando documentos de issue:', error);
      return NextResponse.json({ error: 'Error al listar documentos' }, { status: 500 });
    }

    return NextResponse.json({ documents: documents || [] });
  } catch (error) {
    console.error('Error en GET workspace issue documents:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

/**
 * POST /api/workspaces/:slug/teams/:teamId/issues/:issueId/documents
 * Vincula un documento externo a una issue.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const access = await validateAccess(request, params);
    if ('error' in access) return access.error;

    const { payload, issue, supabase } = access;

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
      .from('task_issue_documents')
      .insert({
        issue_id: issue.issue_id,
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
        creator:account_users!task_issue_documents_created_by_fkey(
          user_id, first_name, last_name_paternal, display_name, avatar_url
        )
      `)
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Este documento ya está vinculado a la issue' }, { status: 409 });
      }
      console.error('Error vinculando documento a issue:', error);
      return NextResponse.json({ error: 'Error al vincular documento' }, { status: 500 });
    }

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    console.error('Error en POST workspace issue documents:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
