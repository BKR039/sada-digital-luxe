-- ============================================================
-- SADA WORK OS — Migration: 20260914180000_add_task_assigned_by_and_followup.sql
-- Task assigned_by_id, client follow-up fields & communication log table
-- ============================================================

-- 1. Add assigned_by_id to project_tasks
ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS assigned_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_tasks_assigned_by ON public.project_tasks(assigned_by_id);

-- 2. Add Client Follow-up fields to client_projects
ALTER TABLE public.client_projects
  ADD COLUMN IF NOT EXISTS last_contact_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_contact_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS next_followup_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS followup_owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS followup_status TEXT DEFAULT 'no_followup'
    CHECK (followup_status IN ('no_followup', 'followup_due', 'waiting_for_client', 'waiting_for_sada', 'followup_completed')),
  ADD COLUMN IF NOT EXISTS followup_summary TEXT,
  ADD COLUMN IF NOT EXISTS followup_next_action TEXT;

CREATE INDEX IF NOT EXISTS idx_client_projects_next_followup ON public.client_projects(next_followup_date);
CREATE INDEX IF NOT EXISTS idx_client_projects_followup_status ON public.client_projects(followup_status);

-- 3. Create client_communication_logs table for internal team interaction records
CREATE TABLE IF NOT EXISTS public.client_communication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.client_projects(id) ON DELETE CASCADE,
  contact_method TEXT NOT NULL CHECK (contact_method IN ('WhatsApp', 'Phone', 'Email', 'Meeting', 'Other')),
  team_member_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  summary TEXT NOT NULL,
  next_action TEXT,
  next_followup_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_comm_logs_project ON public.client_communication_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_client_comm_logs_created ON public.client_communication_logs(created_at);

-- 4. Enable RLS and add admin policies
ALTER TABLE public.client_communication_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read client_communication_logs"
  ON public.client_communication_logs FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins manage client_communication_logs"
  ON public.client_communication_logs FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
