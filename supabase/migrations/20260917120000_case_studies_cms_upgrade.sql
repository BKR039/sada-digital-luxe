-- SADA OS — Migration: 20260917120000_case_studies_cms_upgrade.sql
-- Description: Upgrade public.projects with team_member_ids, SEO fields, and granular RBAC policies

-- 1. Add missing capability columns to public.projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS team_member_ids UUID[] DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS seo_title TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS seo_description TEXT DEFAULT NULL;

-- 2. Drop legacy blanket manage policy to separate Admin mutation from Super Admin deletion
DROP POLICY IF EXISTS "Admins manage projects" ON public.projects;
DROP POLICY IF EXISTS "Admins create projects" ON public.projects;
DROP POLICY IF EXISTS "Admins update projects" ON public.projects;
DROP POLICY IF EXISTS "Super Admins delete projects" ON public.projects;

-- 3. Admins and Super Admins can insert new case studies
CREATE POLICY "Admins create projects"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- 4. Admins and Super Admins can update case studies
CREATE POLICY "Admins update projects"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 5. Permanent deletion is strictly SUPER ADMIN ONLY
CREATE POLICY "Super Admins delete projects"
  ON public.projects FOR DELETE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 6. Ensure public read policy is intact for published projects
DROP POLICY IF EXISTS "Public reads published projects" ON public.projects;
CREATE POLICY "Public reads published projects"
  ON public.projects FOR SELECT
  TO anon, authenticated
  USING (published = true);

-- 7. Ensure admin read policy is intact for all projects (drafts + published)
DROP POLICY IF EXISTS "Admins read all projects" ON public.projects;
CREATE POLICY "Admins read all projects"
  ON public.projects FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));
