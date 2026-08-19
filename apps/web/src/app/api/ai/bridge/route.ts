import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import {
  authenticateBridgeRequest,
  isBridgeError,
  isPlainRecord,
  parseActionBody,
  readActionJson,
} from '@/lib/services/bridge/bridge-request';
import {
  buildCreateTaskPayload,
  buildUpdateTaskPayload,
  resolveBridgeIssue,
} from '@/lib/services/bridge/bridge-task-actions';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateBridgeRequest(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: `Unauthorized: ${auth.error}` }, { status: 401 });
    }

    if (!auth.scopes?.includes('read')) {
      return NextResponse.json({ error: 'API key does not have read permission' }, { status: 403 });
    }

    let projectsQuery = supabaseAdmin.from('pm_projects').select('project_id, project_name, project_status, priority_level, target_date, team_id');
    let tasksQuery = supabaseAdmin.from('task_issues').select('issue_id, title, status_id, priority_id, assignee_id, team_id').limit(50);
    let usersQuery = supabaseAdmin.from('account_users').select('user_id, display_name, email, permission_level');

    if (auth.workspaceId) {
      projectsQuery = projectsQuery.eq('workspace_id', auth.workspaceId);

      const { data: teamIds } = await supabaseAdmin
        .from('teams')
        .select('team_id')
        .eq('workspace_id', auth.workspaceId);

      if (teamIds && teamIds.length > 0) {
        tasksQuery = tasksQuery.in('team_id', teamIds.map((t: { team_id: string }) => t.team_id));
      }

      const { data: memberIds } = await supabaseAdmin
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', auth.workspaceId)
        .eq('is_active', true);

      if (memberIds && memberIds.length > 0) {
        usersQuery = usersQuery.in('user_id', memberIds.map((m: { user_id: string }) => m.user_id));
      }
    }

    const [projectsResponse, tasksResponse, usersResponse] = await Promise.all([
      projectsQuery,
      tasksQuery,
      usersQuery,
    ]);

    const schema = { tables: ['pm_projects', 'task_issues', 'account_users', 'pm_milestones', 'task_cycles'] };

    const systemContext = {
      timestamp: new Date().toISOString(),
      system_status: projectsResponse.error ? 'DB_ERROR' : 'HEALTHY',
      environment: process.env.NODE_ENV,
      workspace_scoped: !!auth.workspaceId,
      key_name: auth.keyName || 'legacy',
      database: {
        stats: {
          projects_count: projectsResponse.data?.length || 0,
          tasks_count: tasksResponse.data?.length || 0,
          users_count: usersResponse.data?.length || 0,
        },
        debug_errors: {
          projects: projectsResponse.error ? projectsResponse.error.message : null,
          tasks: tasksResponse.error ? tasksResponse.error.message : null,
          users: usersResponse.error ? usersResponse.error.message : null,
        },
        schema_summary: schema,
      },
      active_context: {
        active_projects: projectsResponse.data || [],
        pending_tasks: tasksResponse.data || [],
        team_members: usersResponse.data || [],
      },
      capabilities: [
        'create_task',
        'update_task',
        'delete_task',
        'update_project',
        'create_milestone',
        'create_cycle',
      ],
    };

    return NextResponse.json(systemContext);
  } catch (error) {
    console.error('Bridge Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateBridgeRequest(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: `Unauthorized: ${auth.error}` }, { status: 401 });
    }

    if (!auth.scopes?.includes('write')) {
      return NextResponse.json({ error: 'API key does not have write permission' }, { status: 403 });
    }

    const body = await readActionJson(request);
    if (isBridgeError(body)) {
      return NextResponse.json({ error: body.error }, { status: body.status });
    }

    const { tool, params } = parseActionBody(body);

    if (!tool) {
      return NextResponse.json({ error: 'tool or action is required' }, { status: 400 });
    }

    if (!isPlainRecord(params)) {
      return NextResponse.json({ error: 'params must be a JSON object' }, { status: 400 });
    }

    let result;

    switch (tool) {
      case 'update_project': {
        if (!isPlainRecord(params.updates) || Object.keys(params.updates).length === 0) {
          return NextResponse.json({ error: 'updates is required for update_project' }, { status: 400 });
        }

        const query = supabaseAdmin
          .from('pm_projects')
          .update(params.updates)
          .eq('project_id', params.id || params.project_id);
        if (auth.workspaceId) query.eq('workspace_id', auth.workspaceId);
        const { data, error } = await query.select();
        if (error) throw error;
        result = data;
        break;
      }

      case 'update_task': {
        const built = await buildUpdateTaskPayload(params, auth);
        if ('error' in built) {
          return NextResponse.json({ error: built.error }, { status: built.status });
        }

        const { data, error } = await supabaseAdmin
          .from('task_issues')
          .update(built.updateData)
          .eq('issue_id', built.issue.issue_id)
          .eq('team_id', built.issue.team_id)
          .select(`
            *,
            status:task_statuses(*),
            priority:task_priorities(*),
            assignee:account_users!task_issues_assignee_id_fkey(user_id, display_name, avatar_url),
            creator:account_users!task_issues_creator_id_fkey(user_id, display_name, avatar_url)
          `)
          .single();
        if (error) throw error;
        result = data;
        break;
      }

      case 'create_task': {
        const built = await buildCreateTaskPayload(params, auth);
        if ('error' in built) {
          return NextResponse.json({ error: built.error }, { status: built.status });
        }

        const { data, error } = await supabaseAdmin
          .from('task_issues')
          .insert([built.payload])
          .select(`
            *,
            status:task_statuses(*),
            priority:task_priorities(*),
            assignee:account_users!task_issues_assignee_id_fkey(user_id, display_name, avatar_url),
            creator:account_users!task_issues_creator_id_fkey(user_id, display_name, avatar_url)
          `)
          .single();
        if (error) throw error;
        result = data;
        break;
      }

      case 'delete_task': {
        const issueResult = await resolveBridgeIssue(params.issue_id || params.issueId || params.id, auth);
        if (isBridgeError(issueResult)) {
          return NextResponse.json({ error: issueResult.error }, { status: issueResult.status });
        }

        const { error } = await supabaseAdmin
          .from('task_issues')
          .delete()
          .eq('issue_id', issueResult.issue.issue_id)
          .eq('team_id', issueResult.issue.team_id);
        if (error) throw error;
        result = { success: true };
        break;
      }

      case 'create_milestone': {
        const { data, error } = await supabaseAdmin
          .from('pm_milestones')
          .insert([params])
          .select();
        if (error) throw error;
        result = data;
        break;
      }

      case 'create_cycle': {
        const { data, error } = await supabaseAdmin
          .from('task_cycles')
          .insert([params])
          .select();
        if (error) throw error;
        result = data;
        break;
      }

      default:
        return NextResponse.json({ error: `Tool '${tool}' not supported` }, { status: 400 });
    }

    return NextResponse.json({ status: 'success', action: tool, result });
  } catch (error) {
    console.error('Bridge Write Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
