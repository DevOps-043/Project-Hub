import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyApiKey } from '@/lib/services/api-key-service';
import { isUuid, resolveTaskStatusId, resolveTeamId } from '@/lib/services/task-status-service';

export const dynamic = 'force-dynamic';

type BridgeAuth = {
  authenticated: boolean;
  workspaceId?: string;
  scopes?: string[];
  keyName?: string;
  createdBy?: string;
  error?: string;
};

type ActionBody = {
  tool?: string;
  action?: string;
  name?: string;
  params?: Record<string, any>;
  arguments?: Record<string, any>;
  [key: string]: any;
};

/**
 * Authenticates bridge requests.
 * Supports database API keys (phub_...) and legacy IRIS_AGENT_KEY.
 */
async function authenticateBridgeRequest(request: NextRequest): Promise<BridgeAuth> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authenticated: false, error: 'Missing Authorization header' };
  }

  const token = authHeader.replace('Bearer ', '');

  if (token.startsWith('phub_')) {
    const result = await verifyApiKey(token);
    if (!result || !result.valid) {
      return { authenticated: false, error: 'Invalid or revoked API key' };
    }
    return {
      authenticated: true,
      workspaceId: result.workspaceId,
      scopes: result.keyRecord.scopes,
      keyName: result.keyRecord.name,
      createdBy: result.keyRecord.created_by,
    };
  }

  const legacyKey = process.env.IRIS_AGENT_KEY;
  if (legacyKey && token === legacyKey) {
    return { authenticated: true, scopes: ['read', 'write'] };
  }

  return { authenticated: false, error: 'Invalid API key' };
}

function parseActionBody(body: ActionBody) {
  const tool = body.tool || body.action || body.name;
  const reservedKeys = new Set(['tool', 'action', 'name', 'params', 'arguments']);
  const inlineParams = Object.fromEntries(
    Object.entries(body).filter(([key]) => !reservedKeys.has(key))
  );
  const params = body.params || body.arguments || inlineParams;

  return { tool, params };
}

function nullableUuid(value: unknown) {
  return isUuid(value) ? value : null;
}

function nullableText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function resolveProject(projectIdentifier: unknown, workspaceId?: string) {
  if (!projectIdentifier || typeof projectIdentifier !== 'string') return null;

  const selectProject = (query: any) => (
    workspaceId ? query.eq('workspace_id', workspaceId) : query
  ).maybeSingle();

  if (isUuid(projectIdentifier)) {
    const { data } = await selectProject(
      supabaseAdmin
        .from('pm_projects')
        .select('project_id, team_id, workspace_id')
        .eq('project_id', projectIdentifier)
    );
    return data || null;
  }

  const { data: byKey } = await selectProject(
    supabaseAdmin
      .from('pm_projects')
      .select('project_id, team_id, workspace_id')
      .eq('project_key', projectIdentifier)
  );
  if (byKey) return byKey;

  const { data: byName } = await selectProject(
    supabaseAdmin
      .from('pm_projects')
      .select('project_id, team_id, workspace_id')
      .eq('project_name', projectIdentifier)
  );
  return byName || null;
}

async function getFallbackWorkspaceTeamId(workspaceId?: string) {
  if (!workspaceId) return null;

  const { data } = await supabaseAdmin
    .from('teams')
    .select('team_id')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return data?.team_id || null;
}

async function getNextIssueNumber(teamId: string) {
  const { data: lastIssue } = await supabaseAdmin
    .from('task_issues')
    .select('issue_number')
    .eq('team_id', teamId)
    .order('issue_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (lastIssue?.issue_number || 0) + 1;
}

async function buildCreateTaskPayload(params: Record<string, any>, auth: BridgeAuth) {
  const title = nullableText(params.title || params.name || params.summary);
  if (!title) {
    return { error: 'title is required', status: 400 };
  }

  const projectIdentifier = params.project_id || params.projectId || params.project;
  const project = await resolveProject(projectIdentifier, auth.workspaceId);
  if (projectIdentifier && !project) {
    return { error: 'Project not found for this workspace', status: 400 };
  }

  const teamIdentifier = params.team_id || params.teamId || params.team || project?.team_id;
  let teamId = teamIdentifier
    ? await resolveTeamId(supabaseAdmin, teamIdentifier, auth.workspaceId)
    : null;

  if (!teamId) {
    teamId = await getFallbackWorkspaceTeamId(auth.workspaceId);
  }

  if (!teamId) {
    return { error: 'team_id or project_id is required to create a task', status: 400 };
  }

  const creatorId = nullableUuid(params.creator_id || params.created_by_user_id || auth.createdBy);
  if (!creatorId) {
    return { error: 'creator_id is required for legacy bridge keys', status: 400 };
  }

  const statusId = await resolveTaskStatusId(
    supabaseAdmin,
    teamId,
    params.status_id || params.statusId,
    params.status_type || params.status
  );

  if (!statusId) {
    return { error: 'Could not resolve or create a task status for this team', status: 500 };
  }

  const issueNumber = await getNextIssueNumber(teamId);

  return {
    payload: {
      team_id: teamId,
      issue_number: issueNumber,
      title,
      description: nullableText(params.description),
      status_id: statusId,
      priority_id: nullableUuid(params.priority_id || params.priorityId),
      assignee_id: nullableUuid(params.assignee_id || params.assigneeId),
      project_id: project?.project_id || null,
      cycle_id: nullableUuid(params.cycle_id || params.cycleId),
      parent_issue_id: nullableUuid(params.parent_issue_id || params.parentIssueId),
      due_date: params.due_date || params.dueDate || null,
      estimate_points: params.estimate_points || params.estimatePoints || null,
      creator_id: creatorId,
      sort_order: params.sort_order ?? 0,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateBridgeRequest(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: `Unauthorized: ${auth.error}` }, { status: 401 });
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
        tasksQuery = tasksQuery.in('team_id', teamIds.map(t => t.team_id));
      }

      const { data: memberIds } = await supabaseAdmin
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', auth.workspaceId)
        .eq('is_active', true);

      if (memberIds && memberIds.length > 0) {
        usersQuery = usersQuery.in('user_id', memberIds.map(m => m.user_id));
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
  } catch (error: any) {
    console.error('Bridge Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
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

    const body = await request.json();
    const { tool, params } = parseActionBody(body);

    if (!tool) {
      return NextResponse.json({ error: 'tool or action is required' }, { status: 400 });
    }

    let result;

    switch (tool) {
      case 'update_project': {
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
        const issueId = params.id || params.issue_id;
        const { data, error } = await supabaseAdmin
          .from('task_issues')
          .update(params.updates)
          .eq('issue_id', issueId)
          .select();
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
        const issueId = params.id || params.issue_id;
        const { error } = await supabaseAdmin
          .from('task_issues')
          .delete()
          .eq('issue_id', issueId);
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
  } catch (error: any) {
    console.error('Bridge Write Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
