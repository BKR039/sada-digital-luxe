-- SADA Multilingual CMS Content Architecture
-- Migration: 20260924103000_multilingual_cms_content.sql
-- Enables Arabic content localization for all public CMS entities while preserving 100% of existing data and backwards compatibility.

-- 1. Projects (Case Studies)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS title_ar text,
  ADD COLUMN IF NOT EXISTS description_ar text,
  ADD COLUMN IF NOT EXISTS challenge_ar text,
  ADD COLUMN IF NOT EXISTS solution_ar text,
  ADD COLUMN IF NOT EXISTS outcome_ar text;

-- 2. Products (Store)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS title_ar text,
  ADD COLUMN IF NOT EXISTS description_ar text,
  ADD COLUMN IF NOT EXISTS full_description_ar text,
  ADD COLUMN IF NOT EXISTS details_ar text;

-- 3. Blog Posts
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS title_ar text,
  ADD COLUMN IF NOT EXISTS excerpt_ar text,
  ADD COLUMN IF NOT EXISTS content_ar text;

-- 4. Team Members
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS position_ar text,
  ADD COLUMN IF NOT EXISTS bio_ar text;

-- 5. Social Reels
ALTER TABLE public.social_reels
  ADD COLUMN IF NOT EXISTS title_ar text,
  ADD COLUMN IF NOT EXISTS description_ar text;

-- Comments documenting the multilingual architecture
COMMENT ON COLUMN public.projects.title_ar IS 'Arabic title for project case study; falls back to title if NULL';
COMMENT ON COLUMN public.products.title_ar IS 'Arabic title for store product; falls back to title if NULL';
COMMENT ON COLUMN public.blog_posts.title_ar IS 'Arabic title for blog post; falls back to title if NULL';
COMMENT ON COLUMN public.team_members.position_ar IS 'Arabic position/role for team member; falls back to position if NULL';
COMMENT ON COLUMN public.social_reels.title_ar IS 'Arabic title for Instagram reel showcase; falls back to title if NULL';
