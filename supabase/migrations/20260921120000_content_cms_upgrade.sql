-- ============================================================
-- SADA OS — Content Systems Upgrade
-- Migration: 20260921120000_content_cms_upgrade.sql
--
-- Blog × Digital Products × Client Proof (Testimonials)
--
-- 1. Adds the editorial / commerce / proof fields the three CMS
--    workspaces need (SEO overrides, featured, scheduling, product
--    offer content, testimonial context).
-- 2. Establishes the canonical CLIENT -> CASE STUDY -> TESTIMONIAL
--    relationship by reference (FKs) instead of copied text.
-- 3. Hardens RLS: the legacy "FOR ALL" admin policies on these three
--    tables also granted DELETE to plain Admins, which contradicts the
--    SADA RBAC rule that permanent deletion is Super Admin only
--    (same class of bug fixed for team_members in 20260916160000).
-- 4. Gates scheduled blog posts at the database level so a future-dated
--    post is not publicly readable before its publish time.
--
-- All statements are idempotent and additive. No column is renamed or
-- dropped, and no existing row data is destroyed.
-- ============================================================

-- ============================================================
-- 1. BLOG POSTS — editorial metadata
-- ============================================================

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seo_title TEXT,
  ADD COLUMN IF NOT EXISTS og_image_url TEXT,
  ADD COLUMN IF NOT EXISTS cover_alt TEXT;

COMMENT ON COLUMN public.blog_posts.featured IS 'Leads the public /blog editorial grid.';
COMMENT ON COLUMN public.blog_posts.seo_title IS 'Optional <title> override; falls back to title.';
COMMENT ON COLUMN public.blog_posts.og_image_url IS 'Optional social share image; falls back to cover_url.';
COMMENT ON COLUMN public.blog_posts.cover_alt IS 'Alt text for the cover image (accessibility).';
COMMENT ON COLUMN public.blog_posts.published_at IS 'Publish timestamp. A future value with published = true means SCHEDULED and stays private until the time passes (enforced by RLS).';

CREATE INDEX IF NOT EXISTS blog_posts_featured_idx ON public.blog_posts (featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS blog_posts_schedule_idx ON public.blog_posts (published, published_at DESC);

-- ============================================================
-- 2. PRODUCTS — identity, offer content and SEO
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS full_description TEXT,
  ADD COLUMN IF NOT EXISTS gallery JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS includes TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS features TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS audience TEXT,
  ADD COLUMN IF NOT EXISTS details TEXT,
  ADD COLUMN IF NOT EXISTS preview_url TEXT,
  ADD COLUMN IF NOT EXISTS cta_label TEXT,
  ADD COLUMN IF NOT EXISTS seo_title TEXT,
  ADD COLUMN IF NOT EXISTS seo_description TEXT,
  ADD COLUMN IF NOT EXISTS og_image_url TEXT;

COMMENT ON COLUMN public.products.slug IS 'URL-safe identifier. /store/$id resolves by slug first, then by uuid, so old links keep working.';
COMMENT ON COLUMN public.products.includes IS 'What is included in the purchase — one row per line item.';
COMMENT ON COLUMN public.products.features IS 'Product feature bullets. Never pre-filled with generic claims.';
COMMENT ON COLUMN public.products.audience IS 'Who this product is for.';
COMMENT ON COLUMN public.products.cta_label IS 'Purchase button label; falls back to a neutral default.';

-- Backfill slugs for existing rows, de-duplicating with a short id suffix.
DO $$
DECLARE
  rec RECORD;
  base_slug TEXT;
  final_slug TEXT;
BEGIN
  FOR rec IN SELECT id, title FROM public.products WHERE slug IS NULL OR slug = '' LOOP
    base_slug := trim(both '-' FROM regexp_replace(lower(coalesce(rec.title, 'product')), '[^a-z0-9]+', '-', 'g'));
    IF base_slug = '' THEN
      base_slug := 'product';
    END IF;
    final_slug := base_slug;
    IF EXISTS (SELECT 1 FROM public.products WHERE slug = final_slug AND id <> rec.id) THEN
      final_slug := base_slug || '-' || substr(rec.id::text, 1, 6);
    END IF;
    UPDATE public.products SET slug = final_slug WHERE id = rec.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS products_slug_key ON public.products (slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS products_featured_idx ON public.products (featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS products_published_idx ON public.products (published, sort_order);

-- ============================================================
-- 3. TESTIMONIALS — client proof context and canonical relationships
-- ============================================================

ALTER TABLE public.testimonials
  ADD COLUMN IF NOT EXISTS role TEXT,
  ADD COLUMN IF NOT EXISTS short_quote TEXT,
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS service TEXT,
  ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS client_id UUID,
  ADD COLUMN IF NOT EXISTS project_id UUID,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

COMMENT ON COLUMN public.testimonials.role IS 'The person''s role at the company (e.g. Founder, Marketing Lead).';
COMMENT ON COLUMN public.testimonials.short_quote IS 'Optional pull-quote used where space is tight; falls back to review.';
COMMENT ON COLUMN public.testimonials.client_id IS 'Canonical CRM client this proof belongs to. Never duplicate client fields that live on public.clients.';
COMMENT ON COLUMN public.testimonials.project_id IS 'Canonical case study this proof belongs to. The case study page reads the quote from here rather than storing its own copy.';
COMMENT ON COLUMN public.testimonials.service IS 'Which SADA service this proof is about (Marketing / Development / Production or a specific service).';

-- CLIENT -> TESTIMONIAL (reference, never a copy of client data)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'testimonials_client_id_fkey' AND table_name = 'testimonials'
  ) THEN
    ALTER TABLE public.testimonials
      ADD CONSTRAINT testimonials_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
END $$;

-- CASE STUDY -> TESTIMONIAL (reference, never a copy of the quote)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'testimonials_project_id_fkey' AND table_name = 'testimonials'
  ) THEN
    ALTER TABLE public.testimonials
      ADD CONSTRAINT testimonials_project_id_fkey
      FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS testimonials_client_idx ON public.testimonials (client_id);
CREATE INDEX IF NOT EXISTS testimonials_project_idx ON public.testimonials (project_id);
CREATE INDEX IF NOT EXISTS testimonials_featured_idx ON public.testimonials (featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS testimonials_published_idx ON public.testimonials (published, sort_order);

-- testimonials had no updated_at maintenance; blog_posts/products already do.
DROP TRIGGER IF EXISTS testimonials_updated ON public.testimonials;
CREATE TRIGGER testimonials_updated
  BEFORE UPDATE ON public.testimonials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 4. RLS — public read gates
--    Draft (and scheduled) content must be invisible to anonymous
--    users at the database level, not merely filtered in the client.
-- ============================================================

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

-- Blog: published AND (no schedule OR the scheduled time has passed)
DROP POLICY IF EXISTS "Public reads published posts" ON public.blog_posts;
CREATE POLICY "Public reads published posts"
  ON public.blog_posts FOR SELECT
  USING (
    published = true
    AND (published_at IS NULL OR published_at <= now())
  );

DROP POLICY IF EXISTS "Public reads published products" ON public.products;
CREATE POLICY "Public reads published products"
  ON public.products FOR SELECT
  USING (published = true);

DROP POLICY IF EXISTS "Public reads published testimonials" ON public.testimonials;
CREATE POLICY "Public reads published testimonials"
  ON public.testimonials FOR SELECT
  USING (published = true);

-- ============================================================
-- 5. RLS — role-based writes
--    The legacy "FOR ALL" policies below granted DELETE to every Admin.
--    PostgreSQL combines permissive policies with OR, so they must be
--    dropped rather than merely supplemented.
-- ============================================================

-- --- BLOG POSTS ---
DROP POLICY IF EXISTS "Admins manage posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Admins read all posts" ON public.blog_posts;

CREATE POLICY "Admins read all posts"
  ON public.blog_posts FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins insert posts"
  ON public.blog_posts FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins update posts"
  ON public.blog_posts FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Super admins delete posts"
  ON public.blog_posts FOR DELETE
  USING (public.is_super_admin(auth.uid()));

-- --- PRODUCTS ---
DROP POLICY IF EXISTS "Admins manage products" ON public.products;
DROP POLICY IF EXISTS "Admins read all products" ON public.products;

CREATE POLICY "Admins read all products"
  ON public.products FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins insert products"
  ON public.products FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins update products"
  ON public.products FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Super admins delete products"
  ON public.products FOR DELETE
  USING (public.is_super_admin(auth.uid()));

-- --- TESTIMONIALS ---
DROP POLICY IF EXISTS "Admins manage testimonials" ON public.testimonials;
DROP POLICY IF EXISTS "Admins read all testimonials" ON public.testimonials;

CREATE POLICY "Admins read all testimonials"
  ON public.testimonials FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins insert testimonials"
  ON public.testimonials FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins update testimonials"
  ON public.testimonials FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Super admins delete testimonials"
  ON public.testimonials FOR DELETE
  USING (public.is_super_admin(auth.uid()));
