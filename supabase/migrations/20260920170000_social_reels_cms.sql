-- ============================================================
-- SADA OS — Migration: 20260920170000_social_reels_cms.sql
-- Description: Social Reels CMS for Instagram Reels Showcase on Homepage
-- ============================================================

-- 1. Create table public.social_reels
CREATE TABLE IF NOT EXISTS public.social_reels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  instagram_url TEXT NOT NULL,
  instagram_shortcode TEXT NOT NULL,
  title TEXT NOT NULL,
  caption TEXT,
  thumbnail_url TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT false,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_social_reels_homepage
  ON public.social_reels (is_published, is_featured DESC, display_order ASC);

CREATE INDEX IF NOT EXISTS idx_social_reels_slug
  ON public.social_reels (slug);

-- 3. Enforce single featured reel constraint at database engine level
-- Partial unique index ensures at most ONE row can have is_featured = true
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_reels_single_featured
  ON public.social_reels (is_featured)
  WHERE is_featured = true;

-- 4. Trigger to automatically reset previous featured reel when another reel is marked featured
CREATE OR REPLACE FUNCTION public.handle_single_featured_reel()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_featured = true THEN
    UPDATE public.social_reels
    SET is_featured = false
    WHERE id <> NEW.id AND is_featured = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_single_featured_reel ON public.social_reels;
CREATE TRIGGER trigger_single_featured_reel
BEFORE INSERT OR UPDATE OF is_featured ON public.social_reels
FOR EACH ROW
WHEN (NEW.is_featured = true)
EXECUTE FUNCTION public.handle_single_featured_reel();

-- 5. Row Level Security (RLS)
ALTER TABLE public.social_reels ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to guarantee clean state
DROP POLICY IF EXISTS "Public reads published reels" ON public.social_reels;
DROP POLICY IF EXISTS "Admins read all reels" ON public.social_reels;
DROP POLICY IF EXISTS "Admins create reels" ON public.social_reels;
DROP POLICY IF EXISTS "Admins update reels" ON public.social_reels;
DROP POLICY IF EXISTS "Super Admins delete reels" ON public.social_reels;

-- A. Public reads ONLY published reels
CREATE POLICY "Public reads published reels"
  ON public.social_reels FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

-- B. Admins and Super Admins read all reels (drafts + published)
CREATE POLICY "Admins read all reels"
  ON public.social_reels FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- C. Admins and Super Admins can insert new reels
CREATE POLICY "Admins create reels"
  ON public.social_reels FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- D. Admins and Super Admins can update reels (content, order, publishing, featured)
CREATE POLICY "Admins update reels"
  ON public.social_reels FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- E. Deletion is STRICTLY Super Admin only
CREATE POLICY "Super Admins delete reels"
  ON public.social_reels FOR DELETE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));
