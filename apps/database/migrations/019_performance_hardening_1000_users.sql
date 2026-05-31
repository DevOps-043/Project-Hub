-- =====================================================
-- Migration 019: Performance hardening for 1000+ concurrent users
-- Non-destructive indexes and concurrency-safe helper functions.
-- =====================================================

-- Hot workspace/project list paths.
CREATE INDEX IF NOT EXISTS idx_pm_projects_workspace_active_created
  ON public.pm_projects(workspace_id, created_at DESC)
  WHERE project_status <> 'archived';

CREATE INDEX IF NOT EXISTS idx_pm_projects_workspace_lead_active
  ON public.pm_projects(workspace_id, lead_user_id)
  WHERE project_status <> 'archived';

CREATE INDEX IF NOT EXISTS idx_pm_projects_workspace_creator_active
  ON public.pm_projects(workspace_id, created_by_user_id)
  WHERE project_status <> 'archived';

CREATE INDEX IF NOT EXISTS idx_teams_workspace_created
  ON public.teams(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_team_members_user_active_team
  ON public.team_members(user_id, is_active, team_id);

CREATE INDEX IF NOT EXISTS idx_team_members_team_active_user
  ON public.team_members(team_id, is_active, user_id);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_user_active
  ON public.workspace_members(workspace_id, user_id, is_active);

-- Hot task paths used by boards, project details and analytics.
CREATE INDEX IF NOT EXISTS idx_task_issues_team_archived_sort
  ON public.task_issues(team_id, archived_at, sort_order);

CREATE INDEX IF NOT EXISTS idx_task_issues_project_archived_created
  ON public.task_issues(project_id, archived_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_issues_assignee_status_team_active
  ON public.task_issues(assignee_id, status_id, team_id)
  WHERE archived_at IS NULL;

-- Auth refresh/session lookup.
CREATE INDEX IF NOT EXISTS idx_auth_sessions_refresh_token_hash
  ON public.auth_sessions(refresh_token_hash)
  WHERE refresh_token_hash IS NOT NULL;

-- Optional table: only create the index when ARIA usage tracking exists.
DO $$
BEGIN
  IF to_regclass('public.aria_usage_logs') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_aria_usage_logs_user_created
      ON public.aria_usage_logs(user_id, created_at DESC)';
  END IF;
END $$;

-- Atomic API-key usage accounting. Avoids lost updates under concurrent bridge calls.
CREATE OR REPLACE FUNCTION public.increment_mcp_api_key_usage(p_key_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.mcp_api_keys
  SET
    last_used_at = now(),
    total_requests = COALESCE(total_requests, 0) + 1
  WHERE key_id = p_key_id;
END;
$$;

-- Serialize issue-number assignment per team to avoid duplicate numbers on bursts.
CREATE OR REPLACE FUNCTION public.generate_issue_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.issue_number IS NOT NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(NEW.team_id::text));

  SELECT COALESCE(MAX(issue_number), 0) + 1
  INTO NEW.issue_number
  FROM public.task_issues
  WHERE team_id = NEW.team_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_issue_number ON public.task_issues;
CREATE TRIGGER trg_issue_number
  BEFORE INSERT ON public.task_issues
  FOR EACH ROW
  WHEN (NEW.issue_number IS NULL)
  EXECUTE FUNCTION public.generate_issue_number();
