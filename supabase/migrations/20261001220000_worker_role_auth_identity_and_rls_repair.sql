-- ============================================================
-- SADA WORK OS — MIGRATION: 20261001220000
-- WORKER ROLE AUTHORIZATION, IDENTITY, SALARY & RLS REPAIR
-- ============================================================

-- 1. ADD user_id TO team_members & ALIGN WITH auth.users
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill user_id from profile_id where available
UPDATE public.team_members
SET user_id = profile_id
WHERE user_id IS NULL AND profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_profile_id ON public.team_members(profile_id);

-- Ensure QA Worker Lead has both profile_id and user_id pointing to authoritative worker UUID
UPDATE public.team_members
SET
  profile_id = '77f7a3d3-82c1-4744-8f01-0a1fd5f44bba',
  user_id = '77f7a3d3-82c1-4744-8f01-0a1fd5f44bba',
  role = 'worker',
  is_active = true
WHERE id = '9c0937f7-4617-4803-b718-a3d9a5175dd9' OR email = 'qa.worker@sada.agency';

-- 2. ENSURE SALARY RECORD FOR WORKER ACCOUNT
INSERT INTO public.salary_records (
  team_member_id,
  base_amount,
  currency,
  salary_type,
  payment_frequency,
  standard_monthly_hours,
  hourly_rate,
  status,
  effective_date,
  payment_method
)
SELECT
  '9c0937f7-4617-4803-b718-a3d9a5175dd9',
  1400.000,
  'TND',
  'monthly',
  'monthly',
  160,
  8.750,
  'active',
  '2026-09-01',
  'Bank Transfer'
WHERE NOT EXISTS (
  SELECT 1 FROM public.salary_records WHERE team_member_id = '9c0937f7-4617-4803-b718-a3d9a5175dd9'
);

-- Ensure previous salary payment for Worker demo history
INSERT INTO public.salary_payments (
  team_member_id,
  amount,
  currency,
  payment_date,
  payment_method,
  payment_type,
  status,
  notes
)
SELECT
  '9c0937f7-4617-4803-b718-a3d9a5175dd9',
  1400.000,
  'TND',
  '2026-09-28',
  'Bank Transfer',
  'regular',
  'paid',
  'Monthly Salary Disbursed — September 2026'
WHERE NOT EXISTS (
  SELECT 1 FROM public.salary_payments WHERE team_member_id = '9c0937f7-4617-4803-b718-a3d9a5175dd9'
);

-- 3. RLS POLICIES: team_members
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone manage team_members" ON public.team_members;
DROP POLICY IF EXISTS "Public view published team_members" ON public.team_members;
DROP POLICY IF EXISTS "Admins read all team_members" ON public.team_members;
DROP POLICY IF EXISTS "Workers view own team_members" ON public.team_members;
DROP POLICY IF EXISTS "Admins manage team_members" ON public.team_members;
DROP POLICY IF EXISTS "Admins create team_members" ON public.team_members;
DROP POLICY IF EXISTS "Admins update team_members" ON public.team_members;
DROP POLICY IF EXISTS "Super Admins delete team_members" ON public.team_members;

-- SELECT: Admins/Super Admins see all; Worker sees own profile; Public/Anon sees published
CREATE POLICY "Admins read all team_members"
  ON public.team_members FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Workers view own team_members"
  ON public.team_members FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      profile_id = auth.uid() OR
      user_id = auth.uid()
    )
  );

CREATE POLICY "Public view published team_members"
  ON public.team_members FOR SELECT
  USING (
    published = true AND is_active = true
  );

-- INSERT: Admins/Super Admins only
CREATE POLICY "Admins create team_members"
  ON public.team_members FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- UPDATE: Admins/Super Admins can update any; Worker can only update their own non-sensitive profile
CREATE POLICY "Admins update team_members"
  ON public.team_members FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Workers update own non-sensitive profile"
  ON public.team_members FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND (profile_id = auth.uid() OR user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() IS NOT NULL AND (profile_id = auth.uid() OR user_id = auth.uid())
  );

-- DELETE: Super Admin only
CREATE POLICY "Super Admins delete team_members"
  ON public.team_members FOR DELETE
  USING (public.is_super_admin(auth.uid()));

-- 4. RLS POLICIES: salary_records
ALTER TABLE public.salary_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Workers view own salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Admins create salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Admins update salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Super Admins delete salary_records" ON public.salary_records;

CREATE POLICY "Admins manage salary_records"
  ON public.salary_records FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Workers view own salary_records"
  ON public.salary_records FOR SELECT
  USING (
    team_member_id IN (
      SELECT id FROM public.team_members
      WHERE profile_id = auth.uid() OR user_id = auth.uid()
    )
  );

-- 5. RLS POLICIES: salary_payments
ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage salary_payments" ON public.salary_payments;
DROP POLICY IF EXISTS "Workers view own salary_payments" ON public.salary_payments;

CREATE POLICY "Admins manage salary_payments"
  ON public.salary_payments FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Workers view own salary_payments"
  ON public.salary_payments FOR SELECT
  USING (
    team_member_id IN (
      SELECT id FROM public.team_members
      WHERE profile_id = auth.uid() OR user_id = auth.uid()
    )
  );

-- 6. RLS POLICIES: salary_requests
ALTER TABLE public.salary_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage salary_requests" ON public.salary_requests;
DROP POLICY IF EXISTS "Workers view own salary_requests" ON public.salary_requests;
DROP POLICY IF EXISTS "Workers insert own salary_requests" ON public.salary_requests;

CREATE POLICY "Admins manage salary_requests"
  ON public.salary_requests FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Workers view own salary_requests"
  ON public.salary_requests FOR SELECT
  USING (
    team_member_id IN (
      SELECT id FROM public.team_members
      WHERE profile_id = auth.uid() OR user_id = auth.uid()
    )
  );

CREATE POLICY "Workers insert own salary_requests"
  ON public.salary_requests FOR INSERT
  WITH CHECK (
    status = 'pending' AND
    team_member_id IN (
      SELECT id FROM public.team_members
      WHERE profile_id = auth.uid() OR user_id = auth.uid()
    )
  );

-- 7. RLS POLICIES: work_sessions
ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage work_sessions" ON public.work_sessions;
DROP POLICY IF EXISTS "Workers view own work_sessions" ON public.work_sessions;
DROP POLICY IF EXISTS "Workers insert own work_sessions" ON public.work_sessions;
DROP POLICY IF EXISTS "Workers update own work_sessions" ON public.work_sessions;
DROP POLICY IF EXISTS "Super Admins delete work_sessions" ON public.work_sessions;

CREATE POLICY "Admins manage work_sessions"
  ON public.work_sessions FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Workers view own work_sessions"
  ON public.work_sessions FOR SELECT
  USING (
    profile_id = auth.uid() OR
    team_member_id IN (
      SELECT id FROM public.team_members
      WHERE profile_id = auth.uid() OR user_id = auth.uid()
    )
  );

CREATE POLICY "Workers insert own work_sessions"
  ON public.work_sessions FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    (profile_id IS NULL OR profile_id = auth.uid()) AND
    team_member_id IN (
      SELECT id FROM public.team_members
      WHERE profile_id = auth.uid() OR user_id = auth.uid()
    )
  );

CREATE POLICY "Workers update own work_sessions"
  ON public.work_sessions FOR UPDATE
  USING (
    profile_id = auth.uid() OR
    team_member_id IN (
      SELECT id FROM public.team_members
      WHERE profile_id = auth.uid() OR user_id = auth.uid()
    )
  )
  WITH CHECK (
    profile_id = auth.uid() OR
    team_member_id IN (
      SELECT id FROM public.team_members
      WHERE profile_id = auth.uid() OR user_id = auth.uid()
    )
  );

CREATE POLICY "Super Admins delete work_sessions"
  ON public.work_sessions FOR DELETE
  USING (public.is_super_admin(auth.uid()));

-- 8. RLS POLICIES: client_projects (Tighten so Worker cannot insert)
ALTER TABLE public.client_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sada access read client_projects" ON public.client_projects;
DROP POLICY IF EXISTS "Admins create client_projects" ON public.client_projects;
DROP POLICY IF EXISTS "Admins update client_projects" ON public.client_projects;
DROP POLICY IF EXISTS "Super Admins delete client_projects" ON public.client_projects;

-- SELECT: Admins/Super Admins see all; Workers see projects assigned to them or where they have tasks
CREATE POLICY "Admins read client_projects"
  ON public.client_projects FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Workers read assigned client_projects"
  ON public.client_projects FOR SELECT
  USING (
    lead_id = auth.uid() OR
    lead_id IN (SELECT id FROM public.team_members WHERE profile_id = auth.uid() OR user_id = auth.uid()) OR
    id IN (
      SELECT project_id FROM public.project_tasks
      WHERE assignee_id = auth.uid() OR
            assignee_id IN (SELECT id FROM public.team_members WHERE profile_id = auth.uid() OR user_id = auth.uid())
    ) OR
    public.is_admin(auth.uid())
  );

-- INSERT: Admins and Super Admins only (Workers CANNOT create Client Projects)
CREATE POLICY "Admins create client_projects"
  ON public.client_projects FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- UPDATE: Admins can update any; Workers can only update projects assigned to them
CREATE POLICY "Admins update client_projects"
  ON public.client_projects FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Workers update assigned client_projects"
  ON public.client_projects FOR UPDATE
  USING (
    lead_id = auth.uid() OR
    lead_id IN (SELECT id FROM public.team_members WHERE profile_id = auth.uid() OR user_id = auth.uid())
  )
  WITH CHECK (
    lead_id = auth.uid() OR
    lead_id IN (SELECT id FROM public.team_members WHERE profile_id = auth.uid() OR user_id = auth.uid())
  );

-- DELETE: Super Admin only
CREATE POLICY "Super Admins delete client_projects"
  ON public.client_projects FOR DELETE
  USING (public.is_super_admin(auth.uid()));
