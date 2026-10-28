-- ============================================================
-- SADA WORK OS — Migration: 20260916140000_sada_works_rbac.sql
-- Role-Based Access Control (RBAC): Super Admin, Admin, Worker
-- ============================================================

-- 1. Extend team_members table with role column
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'worker'
  CHECK (role IN ('super_admin', 'admin', 'worker'));

CREATE INDEX IF NOT EXISTS idx_team_members_role ON public.team_members(role);

-- 2. Security Definer Helper Functions
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text IN ('admin', 'super_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.has_sada_access(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text IN ('worker', 'admin', 'super_admin')
  );
$$;

-- Revoke execute from public/anon, grant to authenticated and service_role
REVOKE EXECUTE ON FUNCTION public.is_super_admin(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_admin(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.has_sada_access(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_sada_access(UUID) TO authenticated, service_role;

-- 3. RLS POLICIES ENFORCEMENT

-- A. project_tasks
DROP POLICY IF EXISTS "Admins read project_tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Admins manage project_tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Sada access read project_tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Admins create project_tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Admins update project_tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Workers update assigned project_tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Super Admins delete project_tasks" ON public.project_tasks;

-- SELECT: Workers, Admins, Super Admins can view
CREATE POLICY "Sada access read project_tasks"
  ON public.project_tasks FOR SELECT
  USING (public.has_sada_access(auth.uid()));

-- INSERT: Admins and Super Admins only
CREATE POLICY "Admins create project_tasks"
  ON public.project_tasks FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- UPDATE: Admins/Super Admins can update any; Workers can update assigned tasks
CREATE POLICY "Admins update project_tasks"
  ON public.project_tasks FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Workers update assigned project_tasks"
  ON public.project_tasks FOR UPDATE
  USING (auth.uid() = assignee_id)
  WITH CHECK (auth.uid() = assignee_id);

-- DELETE: SUPER ADMIN ONLY! (Admins and Workers CANNOT delete)
CREATE POLICY "Super Admins delete project_tasks"
  ON public.project_tasks FOR DELETE
  USING (public.is_super_admin(auth.uid()));

-- B. client_projects
DROP POLICY IF EXISTS "Admins read client_projects" ON public.client_projects;
DROP POLICY IF EXISTS "Admins manage client_projects" ON public.client_projects;
DROP POLICY IF EXISTS "Sada access read client_projects" ON public.client_projects;
DROP POLICY IF EXISTS "Admins create client_projects" ON public.client_projects;
DROP POLICY IF EXISTS "Admins update client_projects" ON public.client_projects;
DROP POLICY IF EXISTS "Super Admins delete client_projects" ON public.client_projects;

CREATE POLICY "Sada access read client_projects"
  ON public.client_projects FOR SELECT
  USING (public.has_sada_access(auth.uid()));

CREATE POLICY "Admins create client_projects"
  ON public.client_projects FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins update client_projects"
  ON public.client_projects FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- DELETE: SUPER ADMIN ONLY!
CREATE POLICY "Super Admins delete client_projects"
  ON public.client_projects FOR DELETE
  USING (public.is_super_admin(auth.uid()));

-- C. team_members
DROP POLICY IF EXISTS "Admins manage team_members" ON public.team_members;
DROP POLICY IF EXISTS "Admins create team_members" ON public.team_members;
DROP POLICY IF EXISTS "Admins update team_members" ON public.team_members;
DROP POLICY IF EXISTS "Super Admins delete team_members" ON public.team_members;

CREATE POLICY "Admins create team_members"
  ON public.team_members FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins update team_members"
  ON public.team_members FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- DELETE: SUPER ADMIN ONLY!
CREATE POLICY "Super Admins delete team_members"
  ON public.team_members FOR DELETE
  USING (public.is_super_admin(auth.uid()));

-- D. contact_submissions delete policy
DROP POLICY IF EXISTS "Super Admins delete contact_submissions" ON public.contact_submissions;
CREATE POLICY "Super Admins delete contact_submissions"
  ON public.contact_submissions FOR DELETE
  USING (public.is_super_admin(auth.uid()));

-- E. user_roles
DROP POLICY IF EXISTS "Super Admins manage user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Super Admins manage user_roles"
  ON public.user_roles FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 4. Set Initial Roles for Existing Key Members
-- Boubakar Hamed -> ADMIN
UPDATE public.team_members
SET role = 'admin'
WHERE name ILIKE '%Boubakar%' OR email ILIKE '%boubakar%';

-- Sarah Chen -> WORKER
UPDATE public.team_members
SET role = 'worker'
WHERE name ILIKE '%Sarah%' OR email ILIKE '%sarah%';

-- Ensure Sarah has 'worker' role in user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT tm.profile_id, 'worker'::app_role
FROM public.team_members tm
WHERE tm.profile_id IS NOT NULL AND (tm.name ILIKE '%Sarah%' OR tm.email ILIKE '%sarah%')
ON CONFLICT (user_id, role) DO NOTHING;

-- Karim Mansour -> WORKER
UPDATE public.team_members
SET role = 'worker'
WHERE name ILIKE '%Karim%' OR email ILIKE '%karim%';

INSERT INTO public.user_roles (user_id, role)
SELECT tm.profile_id, 'worker'::app_role
FROM public.team_members tm
WHERE tm.profile_id IS NOT NULL AND (tm.name ILIKE '%Karim%' OR tm.email ILIKE '%karim%')
ON CONFLICT (user_id, role) DO NOTHING;
