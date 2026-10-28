-- ============================================================
-- SADA OS — PHASE 5 & PHASE 6: TEAM, TIME & COST ENGINE
-- Operational Cost, Work Sessions, and Financial OS Integration
-- ============================================================

-- 1. Extend team_members with employment type
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'full_time'
  CHECK (employment_type IN ('full_time', 'part_time', 'freelance', 'intern'));

-- 2. Extend salary_records with standard hours and hourly rate
ALTER TABLE public.salary_records
  ADD COLUMN IF NOT EXISTS standard_monthly_hours INTEGER DEFAULT 160,
  ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC;

-- Backfill hourly_rate for existing salary records where not set
UPDATE public.salary_records
SET hourly_rate = CASE
  WHEN salary_type = 'hourly' THEN base_amount
  WHEN salary_type = 'monthly' AND (standard_monthly_hours IS NULL OR standard_monthly_hours <= 0) THEN ROUND(base_amount / 160.0, 2)
  WHEN salary_type = 'monthly' THEN ROUND(base_amount / standard_monthly_hours::NUMERIC, 2)
  ELSE ROUND(base_amount / 160.0, 2)
END
WHERE hourly_rate IS NULL;

-- 3. Extend project_tasks with labor_cost
ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS labor_cost NUMERIC DEFAULT 0;

-- 4. Create work_sessions table for Clock In / Clock Out and time tracking
CREATE TABLE IF NOT EXISTS public.work_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.client_projects(id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.project_tasks(id) ON DELETE SET NULL,
  session_type TEXT NOT NULL DEFAULT 'production' CHECK (session_type IN ('production', 'administrative')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER DEFAULT 0,
  description TEXT,
  hourly_cost_rate NUMERIC DEFAULT 0,
  labor_cost NUMERIC DEFAULT 0,
  is_billable BOOLEAN DEFAULT true,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_work_sessions_member ON public.work_sessions(team_member_id);
CREATE INDEX IF NOT EXISTS idx_work_sessions_client ON public.work_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_work_sessions_project ON public.work_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_work_sessions_task ON public.work_sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_work_sessions_started_at ON public.work_sessions(started_at);

-- 5. Enable RLS on work_sessions
ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;

-- Admins and Super Admins can manage all work sessions
DROP POLICY IF EXISTS "Admins manage all work sessions" ON public.work_sessions;
CREATE POLICY "Admins manage all work sessions"
  ON public.work_sessions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Workers can view their own work sessions
DROP POLICY IF EXISTS "Workers view own work sessions" ON public.work_sessions;
CREATE POLICY "Workers view own work sessions"
  ON public.work_sessions
  FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid() OR
    team_member_id IN (
      SELECT id FROM public.team_members WHERE profile_id = auth.uid()
    )
  );

-- Workers can insert their own work sessions
DROP POLICY IF EXISTS "Workers insert own work sessions" ON public.work_sessions;
CREATE POLICY "Workers insert own work sessions"
  ON public.work_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id = auth.uid() OR
    team_member_id IN (
      SELECT id FROM public.team_members WHERE profile_id = auth.uid()
    )
  );

-- Workers can update their own active work sessions (e.g. clock out)
DROP POLICY IF EXISTS "Workers update own work sessions" ON public.work_sessions;
CREATE POLICY "Workers update own work sessions"
  ON public.work_sessions
  FOR UPDATE
  TO authenticated
  USING (
    profile_id = auth.uid() OR
    team_member_id IN (
      SELECT id FROM public.team_members WHERE profile_id = auth.uid()
    )
  )
  WITH CHECK (
    profile_id = auth.uid() OR
    team_member_id IN (
      SELECT id FROM public.team_members WHERE profile_id = auth.uid()
    )
  );
