-- ============================================================
-- SADA OS — Migration: 20261018200000_cms_multilingual_and_testimonials_rls_repair.sql
-- Description:
--   1. Add missing multilingual Arabic columns to public.projects
--      (client_ar, industry_ar, category_ar, objective_ar, strategy_ar, process_ar, results_ar)
--      remediating DEFECT-CMS-01.
--   2. Fix public.testimonials RLS policies to add TO authenticated,
--      preventing anonymous callers from evaluating is_admin() and failing with 401
--      remediating DEFECT-CMS-02.
-- ============================================================

-- 1. Add missing multilingual columns to public.projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS client_ar text,
  ADD COLUMN IF NOT EXISTS industry_ar text,
  ADD COLUMN IF NOT EXISTS category_ar text,
  ADD COLUMN IF NOT EXISTS objective_ar text,
  ADD COLUMN IF NOT EXISTS strategy_ar text,
  ADD COLUMN IF NOT EXISTS process_ar text,
  ADD COLUMN IF NOT EXISTS results_ar text;

COMMENT ON COLUMN public.projects.client_ar IS 'Arabic client name; falls back to client if NULL';
COMMENT ON COLUMN public.projects.industry_ar IS 'Arabic industry label; falls back to industry if NULL';
COMMENT ON COLUMN public.projects.category_ar IS 'Arabic category label; falls back to category if NULL';
COMMENT ON COLUMN public.projects.objective_ar IS 'Arabic project objective; falls back to objective if NULL';
COMMENT ON COLUMN public.projects.strategy_ar IS 'Arabic project strategy; falls back to strategy if NULL';
COMMENT ON COLUMN public.projects.process_ar IS 'Arabic project execution process; falls back to process if NULL';
COMMENT ON COLUMN public.projects.results_ar IS 'Arabic project results narrative; falls back to results if NULL';

-- 2. Hardened Testimonials RLS Policies (Fix DEFECT-CMS-02)
-- Ensure public reads only published testimonials
DROP POLICY IF EXISTS "Public reads published testimonials" ON public.testimonials;
CREATE POLICY "Public reads published testimonials"
  ON public.testimonials FOR SELECT
  TO anon, authenticated
  USING (published = true);

-- Scope Admin read policy strictly TO authenticated to prevent anon 401 evaluation
DROP POLICY IF EXISTS "Admins read all testimonials" ON public.testimonials;
CREATE POLICY "Admins read all testimonials"
  ON public.testimonials FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins insert testimonials" ON public.testimonials;
CREATE POLICY "Admins insert testimonials"
  ON public.testimonials FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins update testimonials" ON public.testimonials;
CREATE POLICY "Admins update testimonials"
  ON public.testimonials FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins delete testimonials" ON public.testimonials;
CREATE POLICY "Super admins delete testimonials"
  ON public.testimonials FOR DELETE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));
