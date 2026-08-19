/**
 * API Route: /api/admin/teams/[teamId]/issues/[issueId]
 * GET: Get issue details with activity
 * PATCH: Update issue
 * DELETE: Delete issue
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/require-role';

export const runtime = 'nodejs';

// GET - Get issue details with activity
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; issueId: string }> }
) {
  try {
    const { teamId, issueId } = await params;

    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    // Get issue with relations
    const { data: issue, error: issueError } = await supabaseAdmin
      .from('task_issues')
      .select(`
        *,
        status:task_statuses(*),
        priority:task_priorities(*),
        assignee:account_users!task_issues_assignee_id_fkey(user_id, display_name, first_name, last_name_paternal, avatar_url, email),
        creator:account_users!task_issues_creator_id_fkey(user_id, display_name, first_name, last_name_paternal, avatar_url, email),
        labels:task_issue_labels(
          label:task_labels(*)
        )
      `)
      .eq('issue_id', issueId)
      .eq('team_id', teamId)
      .single();

    if (issueError || !issue) {
      console.error('Error fetching issue:', issueError);
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    // Get parent issue if exists
    let parentIssue = null;
    if (issue.parent_issue_id) {
      const { data: parent } = await supabaseAdmin
        .from('task_issues')
        .select('issue_id, title, issue_number')
        .eq('issue_id', issue.parent_issue_id)
        .single();
      parentIssue = parent;
    }

    // Get team info for identifier
    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('slug, name')
      .eq('team_id', teamId)
      .single();

    // Get activity (history + comments combined)
    const [historyResult, commentsResult] = await Promise.all([
      supabaseAdmin
        .from('task_issue_history')
        .select(`
          history_id,
          field_name,
          old_value,
          new_value,
          old_value_id,
          new_value_id,
          created_at,
          actor:account_users!task_issue_history_actor_id_fkey(user_id, display_name, first_name, last_name_paternal, avatar_url)
        `)
        .eq('issue_id', issueId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabaseAdmin
        .from('task_issue_comments')
        .select(`
          comment_id,
          body,
          body_html,
          reactions,
          edited_at,
          created_at,
          author:account_users!task_issue_comments_author_id_fkey(user_id, display_name, first_name, last_name_paternal, avatar_url)
        `)
        .eq('issue_id', issueId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })
    ]);

    // Combine and sort activity
    const historyItems = (historyResult.data || []).map(h => ({
      id: h.history_id,
      type: 'history' as const,
      field_name: h.field_name,
      old_value: h.old_value,
      new_value: h.new_value,
      created_at: h.created_at,
      actor: h.actor
    }));

    const commentItems = (commentsResult.data || []).map(c => ({
      id: c.comment_id,
      type: 'comment' as const,
      body: c.body,
      body_html: c.body_html,
      reactions: c.reactions,
      edited_at: c.edited_at,
      created_at: c.created_at,
      actor: c.author
    }));

    // Create a "created" event
    const createdEvent = {
      id: 'created',
      type: 'created' as const,
      created_at: issue.created_at,
      actor: issue.creator
    };

    const activity = [...historyItems, ...commentItems, createdEvent]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Get sub-issues
    const { data: subIssues } = await supabaseAdmin
      .from('task_issues')
      .select(`
        issue_id,
        issue_number,
        title,
        status:task_statuses(status_id, name, color, status_type),
        priority:task_priorities(priority_id, name, color, level),
        assignee:account_users!task_issues_assignee_id_fkey(user_id, display_name, avatar_url)
      `)
      .eq('parent_issue_id', issueId)
      .eq('team_id', teamId)
      .is('archived_at', null);

    // Get project info if exists
    let project = null;
    if (issue.project_id) {
      const { data: projectData } = await supabaseAdmin
        .from('pm_projects')
        .select('project_id, project_name, project_key, icon_name, icon_color')
        .eq('project_id', issue.project_id)
        .single();
      project = projectData;
    }

    // Get team projects for dropdown
    const { data: teamProjects } = await supabaseAdmin
      .from('pm_projects')
      .select('project_id, project_name, project_key, icon_name, icon_color')
      .eq('team_id', teamId)
      .is('archived_at', null)
      .order('project_name');

    const teamPrefix = team?.slug ? team.slug.toUpperCase() : 'TASK';
    const projectPrefix = project?.project_key ? project.project_key.toUpperCase() : null;
    const identifier = projectPrefix 
      ? `${teamPrefix}-${projectPrefix}-${issue.issue_number}`
      : `${teamPrefix}-${issue.issue_number}`;
    
    return NextResponse.json({
      issue: {
        ...issue,
        identifier,
        labels: issue.labels?.map((l: { label: unknown }) => l.label) || [],
        parent: parentIssue,
        project
      },
      activity,
      subIssues: (subIssues || []).map(si => ({
        ...si,
        identifier: projectPrefix
          ? `${teamPrefix}-${projectPrefix}-${si.issue_number}`
          : `${teamPrefix}-${si.issue_number}`
      })),
      team,
      teamProjects: teamProjects || []
    });

  } catch (error) {
    console.error('Error in GET issue:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// PATCH - Update issue
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; issueId: string }> }
) {
  try {
    const { teamId, issueId } = await params;

    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;
    const { payload } = auth;

    const body = await request.json();
    const allowedFields = [
      'title', 'description', 'status_id', 'priority_id', 
      'assignee_id', 'project_id', 'cycle_id', 'due_date',
      'estimate_points', 'parent_issue_id'
    ];
    
    // Get current issue for history
    const { data: currentIssue } = await supabaseAdmin
      .from('task_issues')
      .select('*')
      .eq('issue_id', issueId)
      .eq('team_id', teamId)
      .single();

    if (!currentIssue) {
      return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    // Build update object and history records
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const historyRecords: Record<string, unknown>[] = [];

    // Helper to get name from ID
    const getStatusName = async (statusId: string | null) => {
      if (!statusId) return null;
      const { data } = await supabaseAdmin.from('task_statuses').select('name').eq('status_id', statusId).single();
      return data?.name || null;
    };
    const getPriorityName = async (priorityId: string | null) => {
      if (!priorityId) return null;
      const { data } = await supabaseAdmin.from('task_priorities').select('name').eq('priority_id', priorityId).single();
      return data?.name || null;
    };
    const getUserName = async (userId: string | null) => {
      if (!userId) return null;
      const { data } = await supabaseAdmin.from('account_users').select('display_name, first_name, last_name_paternal').eq('user_id', userId).single();
      return data?.display_name || `${data?.first_name || ''} ${data?.last_name_paternal || ''}`.trim() || null;
    };

    for (const field of allowedFields) {
      if (body[field] !== undefined && body[field] !== currentIssue[field]) {
        updateData[field] = body[field];
        
        // Get human-readable names for history
        let oldValue = currentIssue[field]?.toString() || null;
        let newValue = body[field]?.toString() || null;
        
        if (field === 'status_id') {
          oldValue = await getStatusName(currentIssue[field]);
          newValue = await getStatusName(body[field]);
        } else if (field === 'priority_id') {
          oldValue = await getPriorityName(currentIssue[field]);
          newValue = await getPriorityName(body[field]);
        } else if (field === 'assignee_id') {
          oldValue = await getUserName(currentIssue[field]);
          newValue = await getUserName(body[field]);
        }

        // Record history
        historyRecords.push({
          issue_id: issueId,
          actor_id: payload.sub,
          field_name: field,
          old_value: oldValue,
          new_value: newValue,
          old_value_id: field.endsWith('_id') ? currentIssue[field] : null,
          new_value_id: field.endsWith('_id') ? body[field] : null
        });
      }
    }

    // Handle status change timestamps
    if (body.status_id && body.status_id !== currentIssue.status_id) {
      const { data: newStatus } = await supabaseAdmin
        .from('task_statuses')
        .select('status_type')
        .eq('status_id', body.status_id)
        .single();

      if (newStatus?.status_type === 'in_progress' && !currentIssue.started_at) {
        updateData.started_at = new Date().toISOString();
      } else if (newStatus?.status_type === 'done') {
        updateData.completed_at = new Date().toISOString();
      } else if (newStatus?.status_type === 'cancelled') {
        updateData.cancelled_at = new Date().toISOString();
      }
    }

    // Update issue
    const { data: updatedIssue, error } = await supabaseAdmin
      .from('task_issues')
      .update(updateData)
      .eq('issue_id', issueId)
      .eq('team_id', teamId)
      .select(`
        *,
        status:task_statuses(*),
        priority:task_priorities(*),
        assignee:account_users!task_issues_assignee_id_fkey(user_id, display_name, avatar_url),
        creator:account_users!task_issues_creator_id_fkey(user_id, display_name, avatar_url)
      `)
      .single();

    if (error) {
      console.error('Error updating issue:', error);
      return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
    }

    // Insert history records
    if (historyRecords.length > 0) {
      await supabaseAdmin.from('task_issue_history').insert(historyRecords);
    }

    // Handle labels update
    if (body.labels !== undefined) {
      // Remove existing labels
      await supabaseAdmin
        .from('task_issue_labels')
        .delete()
        .eq('issue_id', issueId);

      // Add new labels
      if (body.labels.length > 0) {
        const labelInserts = body.labels.map((labelId: string) => ({
          issue_id: issueId,
          label_id: labelId
        }));
        await supabaseAdmin.from('task_issue_labels').insert(labelInserts);
      }
    }

    return NextResponse.json({ issue: updatedIssue });

  } catch (error) {
    console.error('Error in PATCH issue:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// DELETE - Archive issue
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; issueId: string }> }
) {
  try {
    const { teamId, issueId } = await params;

    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    // Soft delete (archive)
    const { error } = await supabaseAdmin
      .from('task_issues')
      .update({ archived_at: new Date().toISOString() })
      .eq('issue_id', issueId)
      .eq('team_id', teamId);

    if (error) {
      console.error('Error archiving issue:', error);
      return NextResponse.json({ error: 'Error al archivar' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error in DELETE issue:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
