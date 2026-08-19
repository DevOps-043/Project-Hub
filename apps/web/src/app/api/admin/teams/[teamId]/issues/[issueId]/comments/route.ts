/**
 * API Route: /api/admin/teams/[teamId]/issues/[issueId]/comments
 * GET: Get comments
 * POST: Add comment
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/require-role';

export const runtime = 'nodejs';

// GET - Get comments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; issueId: string }> }
) {
  try {
    const { issueId } = await params;

    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { data: comments, error } = await supabaseAdmin
      .from('task_issue_comments')
      .select(`
        comment_id,
        body,
        body_html,
        reactions,
        edited_at,
        created_at,
        author:account_users!task_issue_comments_author_id_fkey(
          user_id, display_name, first_name, last_name_paternal, avatar_url
        )
      `)
      .eq('issue_id', issueId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching comments:', error);
      return NextResponse.json({ error: 'Error al obtener comentarios' }, { status: 500 });
    }

    return NextResponse.json({ comments });

  } catch (error) {
    console.error('Error in GET comments:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST - Add comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; issueId: string }> }
) {
  try {
    const { issueId } = await params;

    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;
    const { payload } = auth;

    const body = await request.json();
    const { content, parent_comment_id } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: 'El comentario no puede estar vacío' }, { status: 400 });
    }

    const { data: comment, error } = await supabaseAdmin
      .from('task_issue_comments')
      .insert({
        issue_id: issueId,
        body: content.trim(),
        author_id: payload.sub,
        parent_comment_id: parent_comment_id || null
      })
      .select(`
        comment_id,
        body,
        body_html,
        reactions,
        created_at,
        author:account_users!task_issue_comments_author_id_fkey(
          user_id, display_name, first_name, last_name_paternal, avatar_url
        )
      `)
      .single();

    if (error) {
      console.error('Error creating comment:', error);
      return NextResponse.json({ error: 'Error al crear comentario' }, { status: 500 });
    }

    // Add to history
    await supabaseAdmin.from('task_issue_history').insert({
      issue_id: issueId,
      actor_id: payload.sub,
      field_name: 'comment',
      new_value: 'Agregó un comentario'
    });

    return NextResponse.json({ comment }, { status: 201 });

  } catch (error) {
    console.error('Error in POST comment:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
