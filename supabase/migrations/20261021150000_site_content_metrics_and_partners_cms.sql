-- ============================================================
-- SADA OS — MIGRATION: 20261021150000_site_content_metrics_and_partners_cms.sql
-- 1. Create public.site_kpis for Hero proof highlights & performance metrics
-- 2. Create public.trusted_partners for partner logos, names, and click-hover links
-- 3. Create public.site_content_sections for editable homepage section headings
-- 4. Enable public read RLS, authenticated admin write RLS
-- 5. Seed initial live data
-- ============================================================

-- ------------------------------------------------------------
-- 1. public.site_kpis
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.site_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section TEXT NOT NULL, -- 'hero_proof' | 'company_stats'
  metric_key TEXT NOT NULL UNIQUE,
  value NUMERIC NOT NULL DEFAULT 0,
  prefix TEXT DEFAULT '',
  suffix TEXT DEFAULT '',
  label_en TEXT NOT NULL,
  label_ar TEXT NOT NULL,
  icon TEXT DEFAULT 'Sparkles',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.site_kpis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_kpis_public_select" ON public.site_kpis;
CREATE POLICY "site_kpis_public_select"
  ON public.site_kpis
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "site_kpis_admin_all" ON public.site_kpis;
CREATE POLICY "site_kpis_admin_all"
  ON public.site_kpis
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- ------------------------------------------------------------
-- 2. public.trusted_partners
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trusted_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  website_url TEXT,
  hover_description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trusted_partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trusted_partners_public_select" ON public.trusted_partners;
CREATE POLICY "trusted_partners_public_select"
  ON public.trusted_partners
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "trusted_partners_admin_all" ON public.trusted_partners;
CREATE POLICY "trusted_partners_admin_all"
  ON public.trusted_partners
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- ------------------------------------------------------------
-- 3. public.site_content_sections
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.site_content_sections (
  id TEXT PRIMARY KEY,
  title_en TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  subtitle_en TEXT,
  subtitle_ar TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.site_content_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_content_sections_public_select" ON public.site_content_sections;
CREATE POLICY "site_content_sections_public_select"
  ON public.site_content_sections
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "site_content_sections_admin_all" ON public.site_content_sections;
CREATE POLICY "site_content_sections_admin_all"
  ON public.site_content_sections
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- Grants
GRANT SELECT ON public.site_kpis, public.trusted_partners, public.site_content_sections TO anon, authenticated;
GRANT ALL ON public.site_kpis, public.trusted_partners, public.site_content_sections TO authenticated, service_role;

-- ------------------------------------------------------------
-- 4. INITIAL SEED DATA
-- ------------------------------------------------------------
-- A) Hero Proof Highlights
INSERT INTO public.site_kpis (section, metric_key, value, prefix, suffix, label_en, label_ar, icon, sort_order, is_active)
VALUES
  ('hero_proof', 'hero_happy_clients', 50, '', '+', 'Happy Clients', 'عميل يثق بنا', 'Users', 1, true),
  ('hero_proof', 'hero_projects_delivered', 120, '', '+', 'Projects Delivered', 'مشروعاً تم تسليمه', 'Briefcase', 2, true),
  ('hero_proof', 'hero_client_growth', 3, '', 'x', 'Average Client Growth', 'متوسط نمو أعمال العميل', 'TrendingUp', 3, true)
ON CONFLICT (metric_key) DO UPDATE
SET value = EXCLUDED.value,
    suffix = EXCLUDED.suffix,
    label_en = EXCLUDED.label_en,
    label_ar = EXCLUDED.label_ar,
    icon = EXCLUDED.icon,
    sort_order = EXCLUDED.sort_order;

-- B) Company Performance Stats Bar
INSERT INTO public.site_kpis (section, metric_key, value, prefix, suffix, label_en, label_ar, icon, sort_order, is_active)
VALUES
  ('company_stats', 'stats_projects_shipped', 120, '', '+', 'Projects shipped', 'مشروعاً منجزاً', 'Rocket', 1, true),
  ('company_stats', 'stats_views_generated', 38, '', 'M', 'Views generated', 'مشاهدة محققة', 'Eye', 2, true),
  ('company_stats', 'stats_client_retention', 96, '', '%', 'Client retention', 'نسبة استبقاء العملاء', 'HeartHandshake', 3, true),
  ('company_stats', 'stats_avg_response_time', 24, '', 'h', 'Avg. response time', 'متوسط سرعة الاستجابة', 'Clock', 4, true)
ON CONFLICT (metric_key) DO UPDATE
SET value = EXCLUDED.value,
    suffix = EXCLUDED.suffix,
    label_en = EXCLUDED.label_en,
    label_ar = EXCLUDED.label_ar,
    icon = EXCLUDED.icon,
    sort_order = EXCLUDED.sort_order;

-- C) Trusted Partners
INSERT INTO public.trusted_partners (name, website_url, sort_order, is_active)
VALUES
  ('Noor Coffee', 'https://noorcoffee.com', 1, true),
  ('Maven Studio', 'https://mavenstudio.com', 2, true),
  ('Atlas Realty', 'https://atlasrealty.com', 3, true),
  ('Olive House', 'https://olivehouse.com', 4, true),
  ('Lumen', 'https://lumen.com', 5, true),
  ('Verde & Co.', 'https://verdeandco.com', 6, true),
  ('Northbeam', 'https://northbeam.io', 7, true),
  ('Field Notes', 'https://fieldnotesbrand.com', 8, true);

-- D) Section Headings
INSERT INTO public.site_content_sections (id, title_en, title_ar, subtitle_en, subtitle_ar)
VALUES
  ('trusted_by', 'TRUSTED BY FORWARD-THINKING COMPANIES', 'شركات رائدة تضع ثقتها في صدى', 'Selected enterprise and boutique partners we have grown with', 'نخبة من العلامات والشركات الرائدة التي بنينا معها قصص نجاح مستدامة')
ON CONFLICT (id) DO UPDATE
SET title_en = EXCLUDED.title_en,
    title_ar = EXCLUDED.title_ar,
    subtitle_en = EXCLUDED.subtitle_en,
    subtitle_ar = EXCLUDED.subtitle_ar;
