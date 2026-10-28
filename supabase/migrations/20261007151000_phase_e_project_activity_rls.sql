-- ============================================================
-- SADA WORK OS — MIGRATION: 20261007151000
-- PHASE E: Project Activity Audit RLS Alignment
-- Enables authenticated workers to log task and subtask activities
-- ============================================================

DROP POLICY IF EXISTS "Admins read project_activity" ON public.project_activity;
DROP POLICY IF EXISTS "Admins manage project_activity" ON public.project_activity;
DROP POLICY IF EXISTS "Sada users read project_activity" ON public.project_activity;
DROP POLICY IF EXISTS "Sada users insert project_activity" ON public.project_activity;

-- 1. Read: All authenticated SADA users can view project activity
CREATE POLICY "Sada users read project_activity"
  ON public.project_activity FOR SELECT
  USING (public.has_sada_access(auth.uid()));

-- 2. Insert: Authenticated users can insert activity for their own actor_id or assigned tasks
CREATE POLICY "Sada users insert project_activity"
  ON public.project_activity FOR INSERT
  WITH CHECK (
    public.has_sada_access(auth.uid()) AND
    (
      public.is_admin(auth.uid()) OR
      auth.uid() = actor_id OR
      actor_id IS NULL OR
      actor_id IN (SELECT id FROM public.team_members WHERE profile_id = auth.uid())
    )
  );

-- 3. Manage (Update/Delete): Admins and Super Admins only
CREATE POLICY "Admins manage project_activity"
  ON public.project_activity FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
