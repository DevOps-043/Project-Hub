-- Migration: Add task_cycles table for sprint/cycle management
-- Run this migration in your Supabase SQL Editor

-- Create the task_cycles table
CREATE TABLE IF NOT EXISTS public.task_cycles (
  cycle_id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  cycle_number integer NOT NULL,
  name character varying NOT NULL,
  description text,
  status character varying NOT NULL DEFAULT 'upcoming'::character varying CHECK (status::text = ANY (ARRAY['upcoming'::character varying, 'active'::character varying, 'completed'::character varying, 'cancelled'::character varying]::text[])),
  start_date date NOT NULL,
  end_date date NOT NULL,
  cooldown_days integer DEFAULT 7,
  scope_count integer DEFAULT 0,
  completed_count integer DEFAULT 0,
  progress_percent numeric(5,2) DEFAULT 0,
  created_by uuid,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  completed_at timestamp with time zone,
  CONSTRAINT task_cycles_pkey PRIMARY KEY (cycle_id),
  CONSTRAINT task_cycles_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(team_id),
  CONSTRAINT task_cycles_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.account_users(user_id),
  CONSTRAINT task_cycles_team_number_unique UNIQUE (team_id, cycle_number),
  CONSTRAINT task_cycles_dates_check CHECK (end_date >= start_date)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_cycles_team_status ON public.task_cycles(team_id, status);
CREATE INDEX IF NOT EXISTS idx_cycles_dates ON public.task_cycles(start_date, end_date);

-- Add cycle_id column to task_issues if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'task_issues' AND column_name = 'cycle_id'
    ) THEN
        ALTER TABLE public.task_issues ADD COLUMN cycle_id uuid;
        ALTER TABLE public.task_issues 
            ADD CONSTRAINT task_issues_cycle_id_fkey 
            FOREIGN KEY (cycle_id) REFERENCES public.task_cycles(cycle_id);
        CREATE INDEX IF NOT EXISTS idx_issues_cycle_lookup ON public.task_issues(cycle_id);
    END IF;
END $$;

-- Grant permissions (adjust as needed for your setup)
GRANT ALL ON public.task_cycles TO authenticated;
GRANT ALL ON public.task_cycles TO service_role;
