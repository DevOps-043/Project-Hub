-- Migration 022: teams + team_members (tablas fundacionales que faltaban en
-- el historial de migraciones trackeado).
--
-- Hallazgo: `003_project_management.sql` ya referencia `public.teams(team_id)`
-- (columna `team_id` de `pm_projects`, su FK, y `CREATE INDEX idx_pm_projects_team_id`),
-- y `005_task_management.sql` en adelante depende de `teams`/`team_members` en
-- decenas de FKs — pero ninguna migración numerada las crea. Ambas existen en
-- producción (confirmado contra `apps/database/schema-snapshots/DataBase.sql`,
-- líneas 486-519 para las columnas/constraints y 571-573 para sus 3 índices),
-- simplemente nunca quedaron registradas como migración.
--
-- IMPORTANTE — orden de ejecución en un bootstrap desde cero:
-- Esta migración depende de `account_users` (creada en 001) para las FKs de
-- `owner_id`/`user_id`/`invited_by`, y `003_project_management.sql` depende
-- de que `teams` ya exista. Numerarla "022" es solo para no reordenar el
-- historial existente (renumerar 001..021 para insertarla "en su lugar" es
-- un cambio mucho más invasivo que el problema que resuelve); si estás
-- levantando una base NUEVA desde cero, corre este archivo justo después de
-- 001 y antes de 003, no al final. Si tu base ya tiene estas tablas (como
-- producción), es segura de correr en cualquier momento: todo usa
-- IF NOT EXISTS y no toca filas existentes.

CREATE TABLE IF NOT EXISTS public.teams (
  team_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL,
  slug character varying NOT NULL UNIQUE,
  description text,
  avatar_url text,
  color character varying DEFAULT '#00D4B3'::character varying,
  status character varying NOT NULL DEFAULT 'active'::character varying
    CHECK (status::text = ANY (ARRAY['active', 'archived', 'suspended']::text[])),
  visibility character varying NOT NULL DEFAULT 'private'::character varying
    CHECK (visibility::text = ANY (ARRAY['public', 'private', 'internal']::text[])),
  owner_id uuid NOT NULL,
  max_members integer DEFAULT 50,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT teams_pkey PRIMARY KEY (team_id),
  CONSTRAINT teams_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.account_users(user_id)
);

CREATE TABLE IF NOT EXISTS public.team_members (
  member_id uuid NOT NULL DEFAULT uuid_generate_v4(),
  team_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role character varying NOT NULL DEFAULT 'member'::character varying
    CHECK (role::text = ANY (ARRAY['owner', 'admin', 'moderator', 'member', 'viewer']::text[])),
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  invited_by uuid,
  invitation_accepted_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  last_activity_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT team_members_pkey PRIMARY KEY (member_id),
  CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(team_id),
  CONSTRAINT team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.account_users(user_id),
  CONSTRAINT team_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.account_users(user_id)
);

-- Índices confirmados contra el snapshot de producción.
CREATE INDEX IF NOT EXISTS idx_teams_owner_status ON public.teams(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_team_members_composite ON public.team_members(team_id, user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON public.team_members(user_id);

-- Mismo trigger de auto-actualización que 001_auth_system.sql. Se redefine
-- aquí con CREATE OR REPLACE (idempotente) en vez de asumir que 001 ya
-- corrió: si esta migración se ejecuta en su posición correcta (justo
-- después de 001) no cambia nada; si por alguna razón corre antes,
-- update_updated_at_column() queda disponible igual.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_teams_updated_at ON public.teams;
CREATE TRIGGER trigger_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_team_members_updated_at ON public.team_members;
CREATE TRIGGER trigger_team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
