-- ============================================================
-- SADA OS — Migration: 20261018230000_client_proof_cms_draft_default_and_hardening.sql
-- Description:
--   1. Harden public.testimonials schema to enforce draft-first lifecycle:
--      ALTER COLUMN published SET DEFAULT false (remediating DEF-PROOF-05).
--   2. Ensure all performance indexes exist on foreign keys, published status,
--      featured flag, and sort order.
--   3. Ensure BEFORE UPDATE trigger executes public.set_updated_at().
--   4. Re-verify strictly scoped RLS policies:
--      - Public reads published testimonials only (TO anon, authenticated)
--      - Admins read all testimonials (TO authenticated)
--      - Admins insert testimonials (TO authenticated)
--      - Admins update testimonials (TO authenticated)
--      - Super admins delete testimonials (TO authenticated)
-- ============================================================

-- 1. Ensure draft-first default on published column
ALTER TABLE public.testimonials
  ALTER COLUMN published SET DEFAULT false;

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS testimonials_client_idx ON public.testimonials (client_id);
CREATE INDEX IF NOT EXISTS testimonials_project_idx ON public.testimonials (project_id);
CREATE INDEX IF NOT EXISTS testimonials_featured_idx ON public.testimonials (featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS testimonials_published_idx ON public.testimonials (published, sort_order);

-- 3. Automatic updated_at trigger
DROP TRIGGER IF EXISTS testimonials_updated ON public.testimonials;
CREATE TRIGGER testimonials_updated
  BEFORE UPDATE ON public.testimonials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Scoped Row Level Security Policies
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

-- Public can read ONLY published testimonials
DROP POLICY IF EXISTS "Public reads published testimonials" ON public.testimonials;
CREATE POLICY "Public reads published testimonials"
  ON public.testimonials FOR SELECT
  TO anon, authenticated
  USING (published = true);

-- Admins read all testimonials (drafts + published)
DROP POLICY IF EXISTS "Admins read all testimonials" ON public.testimonials;
CREATE POLICY "Admins read all testimonials"
  ON public.testimonials FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Admins insert testimonials
DROP POLICY IF EXISTS "Admins insert testimonials" ON public.testimonials;
CREATE POLICY "Admins insert testimonials"
  ON public.testimonials FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- Admins update testimonials
DROP POLICY IF EXISTS "Admins update testimonials" ON public.testimonials;
CREATE POLICY "Admins update testimonials"
  ON public.testimonials FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Super admins permanently delete testimonials
DROP POLICY IF EXISTS "Super admins delete testimonials" ON public.testimonials;
CREATE POLICY "Super admins delete testimonials"
  ON public.testimonials FOR DELETE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));
