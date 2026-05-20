const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const DEFAULT_TASK_STATUSES = [
  { name: 'Backlog', status_type: 'backlog', color: '#6B7280', icon: 'circle-dashed', position: 0, is_default: true, is_closed: false },
  { name: 'Todo', status_type: 'todo', color: '#8B5CF6', icon: 'circle', position: 1, is_default: false, is_closed: false },
  { name: 'In Progress', status_type: 'in_progress', color: '#F59E0B', icon: 'progress', position: 2, is_default: false, is_closed: false },
  { name: 'In Review', status_type: 'in_review', color: '#8B5CF6', icon: 'eye', position: 3, is_default: false, is_closed: false },
  { name: 'Done', status_type: 'done', color: '#22C55E', icon: 'check-circle', position: 4, is_default: false, is_closed: true },
  { name: 'Cancelled', status_type: 'cancelled', color: '#EF4444', icon: 'x-circle', position: 5, is_default: false, is_closed: true },
] as const;

type SupabaseLike = {
  from: (table: string) => any;
};

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

export async function resolveTeamId(
  supabase: SupabaseLike,
  teamIdentifier: string,
  workspaceId?: string | null
): Promise<string | null> {
  if (!teamIdentifier) return null;

  const selectTeam = (query: any) => (
    workspaceId ? query.eq('workspace_id', workspaceId) : query
  ).maybeSingle();

  if (isUuid(teamIdentifier)) {
    const { data } = await selectTeam(
      supabase
        .from('teams')
        .select('team_id')
        .eq('team_id', teamIdentifier)
    );
    return data?.team_id || null;
  }

  const { data: bySlug } = await selectTeam(
    supabase
      .from('teams')
      .select('team_id')
      .eq('slug', teamIdentifier)
  );
  if (bySlug?.team_id) return bySlug.team_id;

  const { data: byName } = await selectTeam(
    supabase
      .from('teams')
      .select('team_id')
      .eq('name', teamIdentifier)
  );
  return byName?.team_id || null;
}

export async function ensureDefaultTaskStatuses(supabase: SupabaseLike, teamId: string) {
  const { data: existingStatuses, error: existingError } = await supabase
    .from('task_statuses')
    .select('*')
    .eq('team_id', teamId)
    .order('position', { ascending: true });

  if (existingError) {
    throw existingError;
  }

  if (existingStatuses?.length) {
    return existingStatuses;
  }

  const { data: createdStatuses, error: createError } = await supabase
    .from('task_statuses')
    .insert(DEFAULT_TASK_STATUSES.map(status => ({ ...status, team_id: teamId })))
    .select('*')
    .order('position', { ascending: true });

  if (createError) {
    const { data: statusesAfterError } = await supabase
      .from('task_statuses')
      .select('*')
      .eq('team_id', teamId)
      .order('position', { ascending: true });

    if (statusesAfterError?.length) {
      return statusesAfterError;
    }

    throw createError;
  }

  return createdStatuses || [];
}

export async function resolveTaskStatusId(
  supabase: SupabaseLike,
  teamId: string,
  statusId?: string | null,
  statusType?: string | null
): Promise<string | null> {
  const statuses = await ensureDefaultTaskStatuses(supabase, teamId);

  if (statusId && isUuid(statusId)) {
    const matchingStatus = statuses.find((status: any) => status.status_id === statusId);
    if (matchingStatus) return matchingStatus.status_id;
  }

  if (statusType) {
    const normalizedStatusType = statusType.toLowerCase().trim();
    const matchingStatus = statuses.find((status: any) => status.status_type === normalizedStatusType);
    if (matchingStatus) return matchingStatus.status_id;
  }

  const defaultStatus = statuses.find((status: any) => status.is_default)
    || statuses.find((status: any) => status.status_type === 'backlog')
    || statuses[0];

  return defaultStatus?.status_id || null;
}
