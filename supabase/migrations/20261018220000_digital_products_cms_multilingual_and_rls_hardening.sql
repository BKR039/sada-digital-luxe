-- ============================================================
-- SADA OS — Digital Products CMS Multilingual & RLS Hardening
-- Migration: 20261018220000_digital_products_cms_multilingual_and_rls_hardening.sql
--
-- 1. Creates public.products if not exists (with base columns).
-- 2. Adds full content, offer, and multilingual columns (DEF-PROD-01).
-- 3. Grants table privileges to anon & authenticated roles so RLS governs access.
-- 4. Scopes admin/super_admin RLS policies on public.products TO authenticated (DEF-PROD-02).
-- 5. Ensures public read policy permits only published products.
--
-- All statements are additive and idempotent.
-- ============================================================

-- 1. BASE TABLE DEFINITION (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2),
  currency TEXT DEFAULT 'USD',
  thumbnail_url TEXT,
  gumroad_url TEXT,
  category TEXT,
  published BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. ADD COMMERCE, PRESENTATION & MULTILINGUAL COLUMNS
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
  ADD COLUMN IF NOT EXISTS og_image_url TEXT,
  -- Multilingual Arabic Columns (DEF-PROD-01)
  ADD COLUMN IF NOT EXISTS title_ar TEXT,
  ADD COLUMN IF NOT EXISTS name_ar TEXT,
  ADD COLUMN IF NOT EXISTS description_ar TEXT,
  ADD COLUMN IF NOT EXISTS full_description_ar TEXT,
  ADD COLUMN IF NOT EXISTS details_ar TEXT,
  ADD COLUMN IF NOT EXISTS category_ar TEXT,
  ADD COLUMN IF NOT EXISTS audience_ar TEXT,
  ADD COLUMN IF NOT EXISTS target_audience_ar TEXT,
  ADD COLUMN IF NOT EXISTS cta_label_ar TEXT,
  ADD COLUMN IF NOT EXISTS seo_title_ar TEXT,
  ADD COLUMN IF NOT EXISTS seo_description_ar TEXT;

-- Comments documenting column contracts
COMMENT ON COLUMN public.products.slug IS 'URL-safe identifier. /store/$id resolves by slug first, then by uuid.';
COMMENT ON COLUMN public.products.gumroad_url IS 'External Gumroad checkout link. SADA hands off payment to Gumroad.';
COMMENT ON COLUMN public.products.category_ar IS 'Arabic category label for multilingual store filtering; falls back to category if NULL';
COMMENT ON COLUMN public.products.audience_ar IS 'Arabic audience summary; falls back to audience if NULL';
COMMENT ON COLUMN public.products.cta_label_ar IS 'Arabic purchase button CTA text; falls back to default if NULL';

-- 3. UNIQUE CONSTRAINT & PERFORMANCE INDEXES
CREATE UNIQUE INDEX IF NOT EXISTS products_slug_key ON public.products (slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS products_featured_idx ON public.products (featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS products_published_idx ON public.products (published, sort_order);
CREATE INDEX IF NOT EXISTS products_category_idx ON public.products (category);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_updated ON public.products;
CREATE TRIGGER products_updated
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. GRANT TABLE PRIVILEGES TO DATABASE ROLES
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;

-- 5. HARDEN RLS POLICIES ON public.products (DEF-PROD-02)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Public read: published products only
DROP POLICY IF EXISTS "Public reads published products" ON public.products;
CREATE POLICY "Public reads published products"
  ON public.products FOR SELECT
  USING (published = true);

-- Admin read: authenticated users with admin privileges
DROP POLICY IF EXISTS "Admins read all products" ON public.products;
CREATE POLICY "Admins read all products"
  ON public.products FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Admin insert: authenticated users with admin privileges
DROP POLICY IF EXISTS "Admins insert products" ON public.products;
CREATE POLICY "Admins insert products"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- Admin update: authenticated users with admin privileges
DROP POLICY IF EXISTS "Admins update products" ON public.products;
CREATE POLICY "Admins update products"
  ON public.products FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Super Admin delete: permanent deletion is strictly Super Admin exclusive
DROP POLICY IF EXISTS "Super admins delete products" ON public.products;
CREATE POLICY "Super admins delete products"
  ON public.products FOR DELETE
  TO authenticated
  USING (public.is_super_admin(auth.uid()));
