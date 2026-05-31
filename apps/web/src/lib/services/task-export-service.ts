import { SupabaseClient } from '@supabase/supabase-js';

export interface TaskExportRow {
  id: string;
  title: string;
  status: string;
  statusType: string;
  priority: string;
  priorityLevel: number | null;
  assignee: string;
  assigneeEmail: string;
  team: string;
  project: string;
  dueDate: string;
  created: string;
  completed: string;
}

type IdRecord = Record<string, any>;

function uniqueIds(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function byId(rows: IdRecord[] | null | undefined, key: string): Map<string, IdRecord> {
  return new Map((rows || []).map(row => [row[key], row]));
}

function displayName(user: IdRecord | undefined): string {
  if (!user) return 'Sin asignar';
  return user.display_name || [user.first_name, user.last_name_paternal].filter(Boolean).join(' ') || user.email || 'Sin asignar';
}

function identifier(team: IdRecord | undefined, issue: IdRecord): string {
  const prefix = typeof team?.slug === 'string' && team.slug.trim()
    ? team.slug.trim().toUpperCase()
    : 'TASK';
  return `${prefix}-${issue.issue_number || String(issue.issue_id).slice(0, 8)}`;
}

export async function getTaskExportRows(
  supabase: SupabaseClient,
  teamIds: string[],
  limit: number
): Promise<{ rows: TaskExportRow[]; error?: string }> {
  if (teamIds.length === 0) {
    return { rows: [] };
  }

  const safeLimit = Math.min(Math.max(limit || 2000, 1), 5000);
  const { data: issues, error: issuesError } = await supabase
    .from('task_issues')
    .select(`
      issue_id,
      issue_number,
      title,
      status_id,
      priority_id,
      assignee_id,
      team_id,
      project_id,
      due_date,
      created_at,
      completed_at
    `)
    .in('team_id', teamIds)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(safeLimit);

  if (issuesError) {
    return { rows: [], error: issuesError.message };
  }

  const issueRows = issues || [];
  const statusIds = uniqueIds(issueRows.map((issue: IdRecord) => issue.status_id));
  const priorityIds = uniqueIds(issueRows.map((issue: IdRecord) => issue.priority_id));
  const assigneeIds = uniqueIds(issueRows.map((issue: IdRecord) => issue.assignee_id));
  const projectIds = uniqueIds(issueRows.map((issue: IdRecord) => issue.project_id));

  const [teamsResult, statusesResult, prioritiesResult, usersResult, projectsResult] = await Promise.all([
    supabase.from('teams').select('team_id, name, slug').in('team_id', teamIds),
    statusIds.length
      ? supabase.from('task_statuses').select('status_id, name, status_type').in('status_id', statusIds)
      : Promise.resolve({ data: [], error: null }),
    priorityIds.length
      ? supabase.from('task_priorities').select('priority_id, name, level').in('priority_id', priorityIds)
      : Promise.resolve({ data: [], error: null }),
    assigneeIds.length
      ? supabase.from('account_users').select('user_id, display_name, first_name, last_name_paternal, email').in('user_id', assigneeIds)
      : Promise.resolve({ data: [], error: null }),
    projectIds.length
      ? supabase.from('pm_projects').select('project_id, project_name, project_key').in('project_id', projectIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const lookupError = teamsResult.error || statusesResult.error || prioritiesResult.error || usersResult.error || projectsResult.error;
  if (lookupError) {
    return { rows: [], error: lookupError.message };
  }

  const teams = byId(teamsResult.data, 'team_id');
  const statuses = byId(statusesResult.data, 'status_id');
  const priorities = byId(prioritiesResult.data, 'priority_id');
  const users = byId(usersResult.data, 'user_id');
  const projects = byId(projectsResult.data, 'project_id');

  return {
    rows: issueRows.map((issue: IdRecord) => {
      const team = teams.get(issue.team_id);
      const status = statuses.get(issue.status_id);
      const priority = priorities.get(issue.priority_id);
      const assignee = users.get(issue.assignee_id);
      const project = projects.get(issue.project_id);

      return {
        id: identifier(team, issue),
        title: issue.title || '',
        status: status?.name || 'N/A',
        statusType: status?.status_type || '',
        priority: priority?.name || 'N/A',
        priorityLevel: typeof priority?.level === 'number' ? priority.level : null,
        assignee: displayName(assignee),
        assigneeEmail: assignee?.email || '',
        team: team?.name || '',
        project: project?.project_name || project?.project_key || '',
        dueDate: issue.due_date || '',
        created: issue.created_at || '',
        completed: issue.completed_at || '',
      };
    }),
  };
}
