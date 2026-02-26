import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { verifyToken } from '@/lib/auth/jwt';

type RouteParams = { params: Promise<{ teamId: string; issueId: string }> };

/**
 * GET /api/admin/teams/:teamId/issues/:issueId/documents
 * Lista todos los documentos vinculados a una issue (ruta admin).
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { teamId, issueId } = await params;
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

    const { data: documents, error } = await supabase
      .from('task_issue_documents')
      .select(`
        *,
        creator:account_users!task_issue_documents_created_by_fkey(
          user_id, first_name, last_name_paternal, display_name, avatar_url
        )
      `)
      .eq('issue_id', issueId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error listando documentos de issue:', error);
      return NextResponse.json({ error: 'Error al listar documentos' }, { status: 500 });
    }

    return NextResponse.json({ documents: documents || [] });
  } catch (error) {
    console.error('Error en GET admin issue documents:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

/**
 * POST /api/admin/teams/:teamId/issues/:issueId/documents
 * Vincula un documento externo a una issue (ruta admin).
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { teamId, issueId } = await params;
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

    const body = await request.json();
    const { name, provider, external_id, external_url, doc_type, mime_type, thumbnail_url, metadata } = body;

    if (!name || !external_id || !external_url) {
      return NextResponse.json(
        { error: 'Campos requeridos: name, external_id, external_url' },
        { status: 400 }
      );
    }

    const { data: document, error } = await supabase
      .from('task_issue_documents')
      .insert({
        issue_id: issueId,
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
    console.error('Error en POST admin issue documents:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
