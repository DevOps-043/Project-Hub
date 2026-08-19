import { supabaseAdmin } from '@/lib/supabase/server';
import {
  ensureDefaultTaskStatuses,
  isUuid,
  resolveTaskStatusId,
  resolveTeamId,
} from '@/lib/services/task-status-service';
import type { BridgeAuth, BridgeErrorResponse } from './bridge-request';
import { isBridgeError, isPlainRecord } from './bridge-request';

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

export type TaskUpdatePayloadResult = {
  issue: TaskIssueForUpdate;
  updateData: Record<string, any>;
} | BridgeErrorResponse;

type NormalizedTaskUpdateValue = {
  ok: true;
  value: unknown;
} | {
  ok: false;
  error: string;
};

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

export async function resolveBridgeIssue(
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

export async function buildUpdateTaskPayload(
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

type ProjectRefQuery = {
  eq: (column: string, value: string) => ProjectRefQuery;
  maybeSingle: () => PromiseLike<{ data: { project_id: string; team_id: string | null; workspace_id: string | null } | null }>;
};

async function resolveProject(projectIdentifier: unknown, workspaceId?: string) {
  if (!projectIdentifier || typeof projectIdentifier !== 'string') return null;

  const selectProject = (query: ProjectRefQuery) => (
    workspaceId ? query.eq('workspace_id', workspaceId) : query
  ).maybeSingle();

  if (isUuid(projectIdentifier)) {
    const { data } = await selectProject(
      supabaseAdmin
        .from('pm_projects')
        .select('project_id, team_id, workspace_id')
        .eq('project_id', projectIdentifier) as unknown as ProjectRefQuery
    );
    return data || null;
  }

  const { data: byKey } = await selectProject(
    supabaseAdmin
      .from('pm_projects')
      .select('project_id, team_id, workspace_id')
      .eq('project_key', projectIdentifier) as unknown as ProjectRefQuery
  );
  if (byKey) return byKey;

  const { data: byName } = await selectProject(
    supabaseAdmin
      .from('pm_projects')
      .select('project_id, team_id, workspace_id')
      .eq('project_name', projectIdentifier) as unknown as ProjectRefQuery
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

export async function buildCreateTaskPayload(params: Record<string, any>, auth: BridgeAuth) {
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

  return {
    payload: {
      team_id: teamId,
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
