import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { verifyApiKey } from '@/lib/services/api-key-service';
import {
  ensureDefaultTaskStatuses,
  isUuid,
  resolveTaskStatusId,
  resolveTeamId,
} from '@/lib/services/task-status-service';

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

type BridgeErrorResponse = {
  error: string;
  status: number;
};

type TaskStatusRow = {
  status_id: string;
  status_type: string;
  name?: string | null;
};

type TaskIssueForUpdate = {
  issue_id: string;
  team_id: string;
  status_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
};

type TaskUpdatesBuildResult = {
  updateData: Record<string, any>;
  rawUpdates: Record<string, any>;
} | BridgeErrorResponse;

type TaskStatusResolveResult = {
  status: TaskStatusRow | null;
} | BridgeErrorResponse;

type TaskUpdatePayloadResult = {
  issue: TaskIssueForUpdate;
  updateData: Record<string, any>;
} | BridgeErrorResponse;

type NormalizedTaskUpdateValue = {
  ok: true;
  value: any;
} | {
  ok: false;
  error: string;
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

async function readActionJson(request: NextRequest): Promise<ActionBody | BridgeErrorResponse> {
  const rawBody = await request.text();

  if (!rawBody.trim()) {
    return { error: 'Request body must be valid JSON', status: 400 };
  }

  try {
    const body = JSON.parse(rawBody);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { error: 'Request body must be a JSON object', status: 400 };
    }
    return body;
  } catch {
    return { error: 'Request body must be valid JSON', status: 400 };
  }
}

function isBridgeError(value: unknown): value is BridgeErrorResponse {
  return !!value && typeof value === 'object' && 'error' in value && 'status' in value;
}

function isPlainRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function nullableUuid(value: unknown) {
  return isUuid(value) ? value : null;
}

function nullableText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

const TASK_UPDATE_FIELD_ALIASES: Record<string, string> = {
  title: 'title',
  description: 'description',
  priority_id: 'priority_id',
  priorityId: 'priority_id',
  assignee_id: 'assignee_id',
  assigneeId: 'assignee_id',
  project_id: 'project_id',
  projectId: 'project_id',
  cycle_id: 'cycle_id',
  cycleId: 'cycle_id',
  parent_issue_id: 'parent_issue_id',
  parentIssueId: 'parent_issue_id',
  due_date: 'due_date',
  dueDate: 'due_date',
  estimate_points: 'estimate_points',
  estimatePoints: 'estimate_points',
  sort_order: 'sort_order',
  sortOrder: 'sort_order',
};

const TASK_UPDATE_UUID_FIELDS = new Set([
  'priority_id',
  'assignee_id',
  'project_id',
  'cycle_id',
  'parent_issue_id',
]);

const TASK_UPDATE_NUMBER_FIELDS = new Set(['estimate_points', 'sort_order']);

const STATUS_TYPE_ALIASES: Record<string, string> = {
  completed: 'done',
  complete: 'done',
  closed: 'done',
  finished: 'done',
  hecho: 'done',
  finalizado: 'done',
  inprogress: 'in_progress',
  in_progress: 'in_progress',
  progress: 'in_progress',
  doing: 'in_progress',
  en_curso: 'in_progress',
  en_progreso: 'in_progress',
  review: 'in_review',
  in_review: 'in_review',
  revision: 'in_review',
  en_revision: 'in_review',
  todo: 'todo',
  to_do: 'todo',
  pending: 'todo',
  pendiente: 'todo',
  por_hacer: 'todo',
  backlog: 'backlog',
  cancelled: 'cancelled',
  canceled: 'cancelled',
  cancelado: 'cancelled',
};

function normalizeStatusToken(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, '_').replace(/-/g, '_');
}

function normalizeTaskUpdateValue(field: string, value: unknown): NormalizedTaskUpdateValue {
  if (TASK_UPDATE_UUID_FIELDS.has(field)) {
    if (value === null || value === '') return { ok: true, value: null };
    if (isUuid(value)) return { ok: true, value };
    return { ok: false, error: `${field} must be a valid UUID or null` };
  }

  if (field === 'title') {
    if (typeof value !== 'string' || !value.trim()) {
      return { ok: false, error: 'title must be a non-empty string' };
    }
    return { ok: true, value: value.trim() };
  }

  if (field === 'description') {
    if (value === null || value === '') return { ok: true, value: null };
    if (typeof value === 'string') return { ok: true, value: value.trim() };
    return { ok: false, error: 'description must be a string or null' };
  }

  if (field === 'due_date') {
    if (value === null || value === '') return { ok: true, value: null };
    if (typeof value === 'string') return { ok: true, value };
    return { ok: false, error: 'due_date must be a string or null' };
  }

  if (TASK_UPDATE_NUMBER_FIELDS.has(field)) {
    if (value === null || value === '') return { ok: true, value: null };
    const numberValue = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(numberValue)) return { ok: true, value: numberValue };
    return { ok: false, error: `${field} must be a number or null` };
  }

  return { ok: true, value };
}

function buildAllowedTaskUpdates(params: Record<string, any>): TaskUpdatesBuildResult {
  const rawUpdates = isPlainRecord(params.updates) ? params.updates : {};
  const mergedUpdates = { ...rawUpdates, ...params };
  const updateData: Record<string, any> = {};

  for (const [inputField, dbField] of Object.entries(TASK_UPDATE_FIELD_ALIASES)) {
    if (!(inputField in mergedUpdates)) continue;
    const normalized = normalizeTaskUpdateValue(dbField, mergedUpdates[inputField]);

    if (!normalized.ok) {
      return { error: normalized.error, status: 400 };
    }

    updateData[dbField] = normalized.value;
  }

  return { updateData, rawUpdates };
}

function getFirstDefined(...values: unknown[]) {
  return values.find(value => value !== undefined);
}

async function resolveBridgeIssue(
  issueIdentifier: unknown,
  auth: BridgeAuth
): Promise<{ issue: TaskIssueForUpdate } | BridgeErrorResponse> {
  if (!isUuid(issueIdentifier)) {
    return { error: 'issue_id must be a valid UUID', status: 400 };
  }

  const { data: issue, error } = await supabaseAdmin
    .from('task_issues')
    .select('issue_id, team_id, status_id, started_at, completed_at, cancelled_at')
    .eq('issue_id', issueIdentifier)
    .maybeSingle();

  if (error) throw error;
  if (!issue) {
    return { error: 'Task not found', status: 404 };
  }

  if (auth.workspaceId) {
    const { data: team, error: teamError } = await supabaseAdmin
      .from('teams')
      .select('workspace_id')
      .eq('team_id', issue.team_id)
      .maybeSingle();

    if (teamError) throw teamError;
    if (!team || team.workspace_id !== auth.workspaceId) {
      return { error: 'Task not found for this workspace', status: 404 };
    }
  }

  return { issue: issue as TaskIssueForUpdate };
}

async function resolveExplicitTaskStatus(
  teamId: string,
  statusIdValue: unknown,
  statusValue: unknown
): Promise<TaskStatusResolveResult> {
  const statuses = await ensureDefaultTaskStatuses(supabaseAdmin, teamId);

  if (statusIdValue !== undefined) {
    if (statusIdValue === null || statusIdValue === '') {
      return { error: 'status_id must be a valid UUID', status: 400 };
    }

    if (!isUuid(statusIdValue)) {
      return { error: 'status_id must be a valid UUID', status: 400 };
    }

    const matchingStatus = statuses.find((status: TaskStatusRow) => status.status_id === statusIdValue);
    if (!matchingStatus) {
      return { error: 'status_id does not belong to this task team', status: 400 };
    }

    return { status: matchingStatus as TaskStatusRow };
  }

  if (statusValue !== undefined) {
    if (typeof statusValue !== 'string' || !statusValue.trim()) {
      return { error: 'status must be a non-empty string', status: 400 };
    }

    const normalizedStatus = normalizeStatusToken(statusValue);
    const targetStatusType = STATUS_TYPE_ALIASES[normalizedStatus] || normalizedStatus;
    const matchingStatus = statuses.find((status: TaskStatusRow) => {
      const statusType = normalizeStatusToken(status.status_type);
      const statusName = normalizeStatusToken(status.name || '');
      return statusType === targetStatusType || statusName === normalizedStatus || statusName === targetStatusType;
    });

    if (!matchingStatus) {
      return { error: `Unknown task status '${statusValue}' for this team`, status: 400 };
    }

    return { status: matchingStatus as TaskStatusRow };
  }

  return { status: null };
}

function applyStatusTransitionTimestamps(
  updateData: Record<string, any>,
  issue: TaskIssueForUpdate,
  status: TaskStatusRow
) {
  const now = new Date().toISOString();

  if (status.status_type === 'in_progress' && !issue.started_at) {
    updateData.started_at = now;
  }

  if (status.status_type === 'done') {
    updateData.completed_at = issue.completed_at || now;
  } else if (issue.completed_at) {
    updateData.completed_at = null;
  }

  if (status.status_type === 'cancelled') {
    updateData.cancelled_at = issue.cancelled_at || now;
  } else if (issue.cancelled_at) {
    updateData.cancelled_at = null;
  }
}

async function buildUpdateTaskPayload(
  params: Record<string, any>,
  auth: BridgeAuth
): Promise<TaskUpdatePayloadResult> {
  const issueResult = await resolveBridgeIssue(params.issue_id || params.issueId || params.id, auth);
  if (isBridgeError(issueResult)) return issueResult;

  const updatesResult = buildAllowedTaskUpdates(params);
  if (isBridgeError(updatesResult)) return updatesResult;

  const { issue } = issueResult;
  const { updateData, rawUpdates } = updatesResult;
  const statusIdValue = getFirstDefined(
    params.status_id,
    params.statusId,
    rawUpdates.status_id,
    rawUpdates.statusId
  );
  const statusValue = getFirstDefined(
    params.status_type,
    params.statusType,
    params.status,
    rawUpdates.status_type,
    rawUpdates.statusType,
    rawUpdates.status
  );

  const statusResult = await resolveExplicitTaskStatus(issue.team_id, statusIdValue, statusValue);
  if (isBridgeError(statusResult)) return statusResult;

  if (statusResult.status) {
    updateData.status_id = statusResult.status.status_id;
    applyStatusTransitionTimestamps(updateData, issue, statusResult.status);
  }

  if (Object.keys(updateData).length === 0) {
    return { error: 'No valid task update fields supplied', status: 400 };
  }

  return { issue, updateData };
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
  } catch (error: any) {
    console.error('Bridge Write Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
