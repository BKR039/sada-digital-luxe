-- ============================================================
-- SADA WORK OS — Operations Upgrade Migration
-- Migration: 20260914170000_work_os_upgrade.sql
-- ============================================================

-- 1. Extend task_status enum with 'review' and 'blocked'
DO $$ BEGIN
  ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'review';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'blocked';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Upgrade client_projects table
ALTER TABLE public.client_projects
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS provided_services TEXT[] DEFAULT '{}';

-- 3. Upgrade project_tasks table
ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS service TEXT,
  ADD COLUMN IF NOT EXISTS result_title TEXT,
  ADD COLUMN IF NOT EXISTS result_links TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS result_notes TEXT,
  ADD COLUMN IF NOT EXISTS previous_assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS handoff_reason TEXT,
  ADD COLUMN IF NOT EXISTS waiting_on TEXT,
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_projects_start_date ON public.client_projects(start_date);
CREATE INDEX IF NOT EXISTS idx_project_tasks_service ON public.project_tasks(service);
CREATE INDEX IF NOT EXISTS idx_project_tasks_completed_at ON public.project_tasks(completed_at);
CREATE INDEX IF NOT EXISTS idx_project_tasks_previous_assignee ON public.project_tasks(previous_assignee_id);
