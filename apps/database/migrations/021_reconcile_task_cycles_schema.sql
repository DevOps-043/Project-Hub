-- Migration 021: Reconcile task_cycles schema drift between 005 and the
-- (renamed) 020_add_cycles_table.sql.
--
-- Contexto: 005_task_management.sql y 020_add_cycles_table.sql definen
-- `task_cycles` con columnas distintas (number vs cycle_number, sin
-- cooldown_days/scope_count/completed_count/progress_percent/completed_at
-- vs con ellas, status 'current' vs 'active'+'cancelled'). Confirmé contra
-- la sección final de apps/database/schema-snapshots/DataBase.sql (que trae
-- el task_cycles corregido pegado después del esquema base, evidencia de
-- que refleja el estado posterior a esa migración) y contra el código de la
-- app (app/api/admin/teams/[teamId]/cycles/*.ts y
-- app/api/workspaces/[slug]/analytics/route.ts, que leen y escriben
-- cooldown_days/scope_count/completed_count/progress_percent/completed_at y
-- usan status='active') que el esquema de 020 es el vigente en producción.
-- project-hub.sql es un dump más viejo, de antes de esa migración.
-- (BD.sql NO es Project Hub — es otro snapshot de la instancia SOFIA, se
-- descartó como evidencia tras confirmarlo.)
--
-- Problema real que esto corrige: en una base de datos NUEVA, 005 crea
-- task_cycles con el esquema viejo, y 020 (CREATE TABLE IF NOT EXISTS)
-- queda como no-op silencioso — el bootstrap completo (001..020) termina
-- con el esquema INCORRECTO, aunque producción ya tenga el correcto.
--
-- Esta migración es idempotente: sirve tanto para reconciliar una base ya
-- corregida a mano (no hace nada) como para llevar una base nueva desde el
-- esquema de 005 al esquema real.

DO $$
BEGIN
  -- task_cycles no existe todavía (nunca corrió ni 005 ni 020): crearla completa.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'task_cycles'
  ) THEN
    CREATE TABLE public.task_cycles (
      cycle_id uuid NOT NULL DEFAULT gen_random_uuid(),
      team_id uuid NOT NULL REFERENCES public.teams(team_id) ON DELETE CASCADE,
      cycle_number integer NOT NULL,
      name character varying NOT NULL,
      description text,
      status character varying NOT NULL DEFAULT 'upcoming'
        CHECK (status::text = ANY (ARRAY['upcoming', 'active', 'completed', 'cancelled']::text[])),
      start_date date NOT NULL,
      end_date date NOT NULL,
      cooldown_days integer DEFAULT 7,
      scope_count integer DEFAULT 0,
      completed_count integer DEFAULT 0,
      progress_percent numeric(5,2) DEFAULT 0,
      created_by uuid REFERENCES public.account_users(user_id),
      created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
      completed_at timestamp with time zone,
      CONSTRAINT task_cycles_pkey PRIMARY KEY (cycle_id),
      CONSTRAINT task_cycles_team_number_unique UNIQUE (team_id, cycle_number),
      CONSTRAINT task_cycles_dates_check CHECK (end_date >= start_date)
    );
    RETURN;
  END IF;

  -- task_cycles ya existe (por 005 o por una versión previa de 020/BD.sql):
  -- reconciliar columna por columna sin tocar datos existentes.

  -- 1. number -> cycle_number (renombrar preservando datos si aplica).
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'task_cycles' AND column_name = 'number'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'task_cycles' AND column_name = 'cycle_number'
  ) THEN
    ALTER TABLE public.task_cycles RENAME COLUMN number TO cycle_number;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'task_cycles' AND column_name = 'cycle_number'
  ) THEN
    -- Ni `number` ni `cycle_number` existían: columna nueva desde cero.
    -- No puede ser NOT NULL de entrada sobre filas existentes sin valor;
    -- se numera por orden de creación dentro de cada equipo y luego se
    -- endurece la restricción.
    ALTER TABLE public.task_cycles ADD COLUMN cycle_number integer;
    UPDATE public.task_cycles t
    SET cycle_number = sub.rn
    FROM (
      SELECT cycle_id, row_number() OVER (PARTITION BY team_id ORDER BY created_at) AS rn
      FROM public.task_cycles
    ) sub
    WHERE t.cycle_id = sub.cycle_id AND t.cycle_number IS NULL;
    ALTER TABLE public.task_cycles ALTER COLUMN cycle_number SET NOT NULL;
  END IF;

  -- 2. scope_total/scope_completed -> scope_count/completed_count (con progress_percent nuevo).
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'task_cycles' AND column_name = 'scope_count'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'task_cycles' AND column_name = 'scope_total'
    ) THEN
      ALTER TABLE public.task_cycles RENAME COLUMN scope_total TO scope_count;
    ELSE
      ALTER TABLE public.task_cycles ADD COLUMN scope_count integer DEFAULT 0;
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'task_cycles' AND column_name = 'completed_count'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'task_cycles' AND column_name = 'scope_completed'
    ) THEN
      ALTER TABLE public.task_cycles RENAME COLUMN scope_completed TO completed_count;
    ELSE
      ALTER TABLE public.task_cycles ADD COLUMN completed_count integer DEFAULT 0;
    END IF;
  END IF;

  -- 3. Columnas nuevas que 005 nunca tuvo.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'task_cycles' AND column_name = 'cooldown_days'
  ) THEN
    ALTER TABLE public.task_cycles ADD COLUMN cooldown_days integer DEFAULT 7;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'task_cycles' AND column_name = 'progress_percent'
  ) THEN
    ALTER TABLE public.task_cycles ADD COLUMN progress_percent numeric(5,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'task_cycles' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE public.task_cycles ADD COLUMN completed_at timestamp with time zone;
  END IF;

  -- 4. status: mapear 'current' (valor viejo de 005) -> 'active' ANTES de
  --    endurecer el CHECK, para no romper filas existentes.
  UPDATE public.task_cycles SET status = 'active' WHERE status = 'current';

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'task_cycles'
      AND constraint_name = 'task_cycles_status_check'
  ) THEN
    ALTER TABLE public.task_cycles DROP CONSTRAINT task_cycles_status_check;
  END IF;

  ALTER TABLE public.task_cycles
    ADD CONSTRAINT task_cycles_status_check
    CHECK (status::text = ANY (ARRAY['upcoming', 'active', 'completed', 'cancelled']::text[]));

  -- 5. Unicidad (team_id, cycle_number) — puede no existir si la tabla venía de 005.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'task_cycles'
      AND constraint_name = 'task_cycles_team_number_unique'
  ) THEN
    ALTER TABLE public.task_cycles
      ADD CONSTRAINT task_cycles_team_number_unique UNIQUE (team_id, cycle_number);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_task_cycles_team_status ON public.task_cycles(team_id, status);
