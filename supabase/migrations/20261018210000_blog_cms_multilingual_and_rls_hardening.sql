-- ============================================================
-- SADA OS — Blog CMS Multilingual & RLS Hardening
-- Migration: 20261018210000_blog_cms_multilingual_and_rls_hardening.sql
--
-- 1. Adds category_ar to public.blog_posts if not exists (DEF-BLOG-01).
-- 2. Grants table permissions to anon & authenticated roles so RLS governs access.
-- 3. Scopes admin/super_admin RLS policies on public.blog_posts TO authenticated (DEF-BLOG-02).
-- 4. Scopes admin RLS policy on public.site_settings TO authenticated.
-- 5. Ensures public read policy on blog_posts respects publication schedule.
--
-- All statements are additive and idempotent.
-- ============================================================

-- 1. ADD category_ar TO blog_posts
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS category_ar TEXT;

COMMENT ON COLUMN public.blog_posts.category_ar IS 'Arabic category label for multilingual blog filtering; falls back to category if NULL';

-- 2. GRANT TABLE PRIVILEGES TO DATABASE ROLES
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.blog_posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;

GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT ALL ON public.site_settings TO authenticated;

-- 3. HARDEN RLS POLICIES ON public.blog_posts
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Public read: published AND (no schedule OR schedule time has passed)
DROP POLICY IF EXISTS "Public reads published posts" ON public.blog_posts;
CREATE POLICY "Public reads published posts"
  ON public.blog_posts FOR SELECT
  USING (
    published = true
    AND (published_at IS NULL OR published_at <= now())
  );

-- Admin read: authenticated users with admin privileges
DROP POLICY IF EXISTS "Admins read all posts" ON public.blog_posts;
CREATE POLICY "Admins read all posts"
  ON public.blog_posts FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Admin insert: authenticated users with admin privileges
DROP POLICY IF EXISTS "Admins insert posts" ON public.blog_posts;
CREATE POLICY "Admins insert posts"
  ON public.blog_posts FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- Admin update: authenticated users with admin privileges
DROP POLICY IF EXISTS "Admins update posts" ON public.blog_posts;
CREATE POLICY "Admins update posts"
  ON public.blog_posts FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Super Admin delete: permanent deletion is strictly Super Admin exclusive
DROP POLICY IF EXISTS "Super admins delete posts" ON public.blog_posts;
CREATE POLICY "Super admins delete posts"
  ON public.blog_posts FOR DELETE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 4. HARDEN RLS POLICIES ON public.site_settings
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reads site settings" ON public.site_settings;
CREATE POLICY "Public reads site settings"
  ON public.site_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins manage site settings" ON public.site_settings;
CREATE POLICY "Admins manage site settings"
  ON public.site_settings FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
