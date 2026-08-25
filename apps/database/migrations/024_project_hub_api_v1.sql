-- =============================================================================
-- IRIS / Project Hub API v1
-- Migración aditiva: identidad federada, evidencia, auditoría, idempotencia,
-- outbox y almacenamiento privado. No ejecutar sin respaldo y revisión.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.account_users
  ADD COLUMN IF NOT EXISTS sofia_user_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_users_sofia_user_id
  ON public.account_users(sofia_user_id)
  WHERE sofia_user_id IS NOT NULL;

ALTER TABLE public.pm_project_members
  ADD COLUMN IF NOT EXISTS membership_status varchar(20) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS removed_by_user_id uuid REFERENCES public.account_users(user_id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pm_project_members_status_check'
  ) THEN
    ALTER TABLE public.pm_project_members
      ADD CONSTRAINT pm_project_members_status_check
      CHECK (membership_status IN ('active', 'removed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pm_project_members_active
  ON public.pm_project_members(project_id, user_id)
  WHERE membership_status = 'active';

CREATE TABLE IF NOT EXISTS public.pm_project_evidence (
  evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(workspace_id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.pm_projects(project_id) ON DELETE CASCADE,
  evidence_type varchar(30) NOT NULL CHECK (
    evidence_type IN ('meeting', 'browser_collection', 'upload', 'drive_file', 'link')
  ),
  source_system varchar(50) NOT NULL,
  external_reference varchar(500),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  title varchar(500) NOT NULL,
  summary text,
  content_hash varchar(64),
  storage_path text,
  mime_type varchar(150),
  file_size_bytes bigint CHECK (file_size_bytes IS NULL OR (file_size_bytes >= 0 AND file_size_bytes <= 20971520)),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid NOT NULL REFERENCES public.account_users(user_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  archived_by_user_id uuid REFERENCES public.account_users(user_id) ON DELETE SET NULL,
  CONSTRAINT pm_project_evidence_hash_check CHECK (
    content_hash IS NULL OR content_hash ~ '^[a-fA-F0-9]{64}$'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_project_evidence_external_version
  ON public.pm_project_evidence(project_id, source_system, external_reference, version)
  WHERE external_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pm_project_evidence_workspace_project
  ON public.pm_project_evidence(workspace_id, project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pm_project_evidence_type_date
  ON public.pm_project_evidence(project_id, evidence_type, created_at DESC)
  WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS public.pm_project_evidence_items (
  item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id uuid NOT NULL REFERENCES public.pm_project_evidence(evidence_id) ON DELETE CASCADE,
  item_type varchar(30) NOT NULL CHECK (
    item_type IN ('tab', 'decision', 'agreement', 'risk', 'question', 'excerpt')
  ),
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
  title varchar(500),
  content text,
  source_url text,
  source_hash varchar(64),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pm_project_evidence_items_hash_check CHECK (
    source_hash IS NULL OR source_hash ~ '^[a-fA-F0-9]{64}$'
  ),
  UNIQUE(evidence_id, item_type, position)
);

CREATE INDEX IF NOT EXISTS idx_pm_project_evidence_items_evidence
  ON public.pm_project_evidence_items(evidence_id, item_type, position);

CREATE TABLE IF NOT EXISTS public.task_issue_evidence (
  relation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.task_issues(issue_id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL REFERENCES public.pm_project_evidence(evidence_id) ON DELETE CASCADE,
  evidence_item_id uuid REFERENCES public.pm_project_evidence_items(item_id) ON DELETE SET NULL,
  relation_type varchar(20) NOT NULL DEFAULT 'supports'
    CHECK (relation_type IN ('originated', 'supports', 'supersedes')),
  created_by_user_id uuid NOT NULL REFERENCES public.account_users(user_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_issue_evidence_evidence
  ON public.task_issue_evidence(evidence_id, issue_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_issue_evidence_unique_relation
  ON public.task_issue_evidence(issue_id, evidence_id, COALESCE(evidence_item_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE TABLE IF NOT EXISTS public.pm_project_activity (
  activity_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(workspace_id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.pm_projects(project_id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES public.account_users(user_id) ON DELETE SET NULL,
  action varchar(80) NOT NULL,
  entity_type varchar(40) NOT NULL,
  entity_id uuid,
  correlation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pm_project_activity_project
  ON public.pm_project_activity(workspace_id, project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.api_idempotency_keys (
  idempotency_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(workspace_id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES public.account_users(user_id) ON DELETE CASCADE,
  operation varchar(100) NOT NULL,
  idempotency_key varchar(200) NOT NULL,
  request_hash varchar(64) NOT NULL,
  state varchar(20) NOT NULL DEFAULT 'processing'
    CHECK (state IN ('processing', 'completed', 'failed')),
  response_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  UNIQUE(workspace_id, actor_user_id, operation, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_api_idempotency_expiry
  ON public.api_idempotency_keys(expires_at);

CREATE TABLE IF NOT EXISTS public.integration_outbox (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(workspace_id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.pm_projects(project_id) ON DELETE CASCADE,
  aggregate_type varchar(50) NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type varchar(100) NOT NULL,
  destination varchar(50) NOT NULL,
  payload jsonb NOT NULL,
  idempotency_key varchar(200) NOT NULL,
  state varchar(20) NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'processing', 'delivered', 'failed')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(destination, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_integration_outbox_delivery
  ON public.integration_outbox(state, next_attempt_at, created_at)
  WHERE state IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS idx_integration_outbox_project
  ON public.integration_outbox(workspace_id, project_id, created_at DESC);

-- Transferencia atómica: un proyecto conserva exactamente un owner activo.
CREATE OR REPLACE FUNCTION public.project_hub_transfer_ownership(
  p_project_id uuid,
  p_target_member_id uuid,
  p_actor_user_id uuid
) RETURNS public.pm_project_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target public.pm_project_members;
BEGIN
  PERFORM 1 FROM public.pm_projects WHERE project_id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND'; END IF;

  SELECT * INTO v_target FROM public.pm_project_members
   WHERE member_id = p_target_member_id AND project_id = p_project_id
     AND membership_status = 'active'
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'MEMBER_NOT_FOUND'; END IF;

  UPDATE public.pm_project_members
     SET project_role = 'admin', can_delete = false, can_manage_members = true,
         can_manage_settings = true, updated_at = now()
   WHERE project_id = p_project_id AND project_role = 'owner'
     AND membership_status = 'active' AND member_id <> p_target_member_id;

  UPDATE public.pm_project_members
     SET project_role = 'owner', can_edit = true, can_delete = true,
         can_manage_members = true, can_manage_settings = true, updated_at = now()
   WHERE member_id = p_target_member_id
   RETURNING * INTO v_target;

  INSERT INTO public.pm_project_activity(
    workspace_id, project_id, actor_user_id, action, entity_type, entity_id, metadata
  ) SELECT workspace_id, p_project_id, p_actor_user_id, 'project.ownership_transferred',
           'member', p_target_member_id, '{}'::jsonb
      FROM public.pm_projects WHERE project_id = p_project_id;
  RETURN v_target;
END;
$$;

REVOKE ALL ON FUNCTION public.project_hub_transfer_ownership(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.project_hub_transfer_ownership(uuid, uuid, uuid) TO service_role;

-- El bucket permanece privado. La API server-side emite URLs firmadas cortas.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-files',
  'project-files',
  false,
  20971520,
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'text/plain', 'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Denegación por defecto. Project Hub usa service role exclusivamente en main/server
-- y aplica autorización de workspace/proyecto antes de cada acceso.
ALTER TABLE public.pm_project_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_project_evidence_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_issue_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_project_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_outbox ENABLE ROW LEVEL SECURITY;

-- Importación atómica de una reunión ya aprobada. p_tasks contiene objetos:
-- { mode: 'create'|'link'|'ignore', issue_id?, title?, description?,
--   assignee_id?, due_date?, evidence_item_position? }
CREATE OR REPLACE FUNCTION public.project_hub_import_meeting(
  p_workspace_id uuid,
  p_actor_user_id uuid,
  p_project_id uuid,
  p_idempotency_key varchar,
  p_request_hash varchar,
  p_evidence jsonb,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_tasks jsonb DEFAULT '[]'::jsonb,
  p_correlation_id uuid DEFAULT gen_random_uuid()
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.api_idempotency_keys%ROWTYPE;
  v_evidence_id uuid;
  v_team_id uuid;
  v_status_id uuid;
  v_issue_id uuid;
  v_issue_number integer;
  v_task jsonb;
  v_item jsonb;
  v_item_id uuid;
  v_created_issue_ids jsonb := '[]'::jsonb;
  v_response jsonb;
BEGIN
  SELECT * INTO v_existing
    FROM public.api_idempotency_keys
   WHERE workspace_id = p_workspace_id
     AND actor_user_id = p_actor_user_id
     AND operation = 'meeting.import'
     AND idempotency_key = p_idempotency_key
   FOR UPDATE;

  IF FOUND THEN
    IF v_existing.request_hash <> p_request_hash THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED';
    END IF;
    IF v_existing.state = 'completed' THEN
      RETURN v_existing.response_body;
    END IF;
  ELSE
    INSERT INTO public.api_idempotency_keys(
      workspace_id, actor_user_id, operation, idempotency_key, request_hash
    ) VALUES (
      p_workspace_id, p_actor_user_id, 'meeting.import', p_idempotency_key, p_request_hash
    );
  END IF;

  SELECT team_id INTO v_team_id
    FROM public.pm_projects
   WHERE project_id = p_project_id AND workspace_id = p_workspace_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROJECT_NOT_FOUND'; END IF;
  IF v_team_id IS NULL THEN RAISE EXCEPTION 'PROJECT_TEAM_REQUIRED'; END IF;

  INSERT INTO public.pm_project_evidence(
    workspace_id, project_id, evidence_type, source_system, external_reference,
    version, title, summary, content_hash, metadata, created_by_user_id
  ) VALUES (
    p_workspace_id, p_project_id, 'meeting', 'lia',
    p_evidence->>'external_reference', COALESCE((p_evidence->>'version')::integer, 1),
    COALESCE(p_evidence->>'title', 'Reunión'), p_evidence->>'summary',
    p_evidence->>'content_hash', COALESCE(p_evidence->'metadata', '{}'::jsonb), p_actor_user_id
  )
  ON CONFLICT (project_id, source_system, external_reference, version)
    WHERE external_reference IS NOT NULL
  DO UPDATE SET summary = EXCLUDED.summary
  RETURNING evidence_id INTO v_evidence_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) LOOP
    INSERT INTO public.pm_project_evidence_items(
      evidence_id, item_type, position, title, content, source_url, source_hash, metadata
    ) VALUES (
      v_evidence_id, v_item->>'type', COALESCE((v_item->>'position')::integer, 0),
      v_item->>'title', v_item->>'content', v_item->>'source_url', v_item->>'source_hash',
      COALESCE(v_item->'metadata', '{}'::jsonb)
    )
    ON CONFLICT (evidence_id, item_type, position)
    DO UPDATE SET content = EXCLUDED.content
    RETURNING item_id INTO v_item_id;
  END LOOP;

  SELECT status_id INTO v_status_id
    FROM public.task_statuses
   WHERE team_id = v_team_id AND is_closed = false
   ORDER BY is_default DESC, position ASC NULLS LAST LIMIT 1;
  IF v_status_id IS NULL THEN RAISE EXCEPTION 'OPEN_STATUS_REQUIRED'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_team_id::text));
  FOR v_task IN SELECT value FROM jsonb_array_elements(COALESCE(p_tasks, '[]'::jsonb)) LOOP
    IF COALESCE(v_task->>'mode', 'ignore') = 'ignore' THEN CONTINUE; END IF;
    IF v_task->>'mode' = 'link' THEN
      v_issue_id := (v_task->>'issue_id')::uuid;
      PERFORM 1 FROM public.task_issues
       WHERE issue_id = v_issue_id AND project_id = p_project_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'ISSUE_NOT_FOUND'; END IF;
    ELSE
      SELECT COALESCE(MAX(issue_number), 0) + 1 INTO v_issue_number
        FROM public.task_issues WHERE team_id = v_team_id;
      INSERT INTO public.task_issues(
        team_id, issue_number, title, description, status_id, project_id,
        assignee_id, creator_id, due_date
      ) VALUES (
        v_team_id, v_issue_number, v_task->>'title', v_task->>'description', v_status_id,
        p_project_id, NULLIF(v_task->>'assignee_id', '')::uuid, p_actor_user_id,
        NULLIF(v_task->>'due_date', '')::date
      ) RETURNING issue_id INTO v_issue_id;
      v_created_issue_ids := v_created_issue_ids || to_jsonb(v_issue_id::text);
    END IF;

    SELECT item_id INTO v_item_id
      FROM public.pm_project_evidence_items
     WHERE evidence_id = v_evidence_id
       AND position = COALESCE((v_task->>'evidence_item_position')::integer, 0)
     ORDER BY (item_type = 'excerpt') DESC, created_at LIMIT 1;

    INSERT INTO public.task_issue_evidence(
      issue_id, evidence_id, evidence_item_id, relation_type, created_by_user_id
    ) VALUES (
      v_issue_id, v_evidence_id, v_item_id, 'originated', p_actor_user_id
    ) ON CONFLICT DO NOTHING;
  END LOOP;

  INSERT INTO public.pm_project_activity(
    workspace_id, project_id, actor_user_id, action, entity_type, entity_id,
    correlation_id, metadata
  ) VALUES (
    p_workspace_id, p_project_id, p_actor_user_id, 'meeting.imported', 'evidence',
    v_evidence_id, p_correlation_id, jsonb_build_object('created_issue_ids', v_created_issue_ids)
  );

  v_response := jsonb_build_object(
    'project_id', p_project_id,
    'evidence_id', v_evidence_id,
    'created_issue_ids', v_created_issue_ids,
    'correlation_id', p_correlation_id
  );

  UPDATE public.api_idempotency_keys
     SET state = 'completed', response_status = 200, response_body = v_response,
         completed_at = now()
   WHERE workspace_id = p_workspace_id AND actor_user_id = p_actor_user_id
     AND operation = 'meeting.import' AND idempotency_key = p_idempotency_key;

  RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION public.project_hub_import_meeting(
  uuid, uuid, uuid, varchar, varchar, jsonb, jsonb, jsonb, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.project_hub_import_meeting(
  uuid, uuid, uuid, varchar, varchar, jsonb, jsonb, jsonb, uuid
) TO service_role;

COMMENT ON FUNCTION public.project_hub_import_meeting IS
  'Importa una reunión aprobada en una transacción idempotente. Solo service_role.';

-- Rollback operativo: desactivar flags de API/UI. El rollback físico requiere
-- eliminar primero datos dependientes; por seguridad no se automatiza aquí.
