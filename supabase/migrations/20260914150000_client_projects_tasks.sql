-- ============================================================
-- Client Projects + Tasks + Activity system
-- Migration: 20260914150000
-- ============================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'done', 'postponed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- client_projects — internal project workspace
-- ============================================================
CREATE TABLE IF NOT EXISTS public.client_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  client_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'on_hold', 'cancelled')),
  description TEXT,
  business_type TEXT,
  goals TEXT,
  problems TEXT,
  requested_services TEXT[] DEFAULT '{}',
  timeline TEXT,
  budget TEXT,
  original_message TEXT,
  questionnaire_answers JSONB,
  contact_submission_id UUID REFERENCES public.contact_submissions(id) ON DELETE SET NULL,
  deadline DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER client_projects_updated
  BEFORE UPDATE ON public.client_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- project_tasks — tasks within a client project
-- ============================================================
CREATE TABLE IF NOT EXISTS public.project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.client_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status public.task_status NOT NULL DEFAULT 'todo',
  priority public.task_priority NOT NULL DEFAULT 'medium',
  assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  category TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  deadline DATE,
  estimated_minutes INT,
  actual_minutes INT,
  notes TEXT,
  postpone_reason TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER project_tasks_updated
  BEFORE UPDATE ON public.project_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- project_activity — audit trail
-- ============================================================
CREATE TABLE IF NOT EXISTS public.project_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.client_projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Link inquiry → project
-- ============================================================
ALTER TABLE public.contact_submissions
  ADD COLUMN IF NOT EXISTS converted_project_id UUID REFERENCES public.client_projects(id) ON DELETE SET NULL;

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON public.project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_assignee_id ON public.project_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_deadline ON public.project_tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_project_tasks_status ON public.project_tasks(status);
CREATE INDEX IF NOT EXISTS idx_project_activity_project_id ON public.project_activity(project_id);
CREATE INDEX IF NOT EXISTS idx_project_activity_task_id ON public.project_activity(task_id);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_converted ON public.contact_submissions(converted_project_id);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.client_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_activity ENABLE ROW LEVEL SECURITY;

-- client_projects: admin only
CREATE POLICY "Admins read client_projects"
  ON public.client_projects FOR SELECT
  USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage client_projects"
  ON public.client_projects FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- project_tasks: admin only
CREATE POLICY "Admins read project_tasks"
  ON public.project_tasks FOR SELECT
  USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage project_tasks"
  ON public.project_tasks FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- project_activity: admin only
CREATE POLICY "Admins read project_activity"
  ON public.project_activity FOR SELECT
  USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage project_activity"
  ON public.project_activity FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
