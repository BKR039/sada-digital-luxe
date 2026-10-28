-- ============================================================
-- SADA OS — PHASE 10 SCHEMA MIGRATION
-- Canonical Package Catalog, Categories, Add-ons & Pricing System
-- ============================================================

-- 1. PACKAGE CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.package_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    name_ar TEXT,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    description_ar TEXT,
    priority INTEGER NOT NULL DEFAULT 0,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. PACKAGE CATALOG TABLE (Canonical Single Source of Truth)
CREATE TABLE IF NOT EXISTS public.package_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    name_ar TEXT,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    description_ar TEXT,
    category_id UUID REFERENCES public.package_categories(id) ON DELETE SET NULL,
    category_name TEXT,
    package_type TEXT NOT NULL DEFAULT 'standard',
    billing_type TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_type IN ('monthly', 'one_time', 'starting_from', 'custom')),
    price NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'TND',
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_published BOOLEAN NOT NULL DEFAULT true,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    badge TEXT CHECK (badge IN ('most_popular', 'recommended', 'best_value', 'featured') OR badge IS NULL),
    badge_ar TEXT,
    priority INTEGER NOT NULL DEFAULT 0,
    display_order INTEGER NOT NULL DEFAULT 0,
    short_description TEXT,
    short_description_ar TEXT,
    included_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    excluded_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    monthly_reels INTEGER NOT NULL DEFAULT 0,
    monthly_posts INTEGER NOT NULL DEFAULT 0,
    monthly_stories TEXT NOT NULL DEFAULT '',
    production_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
    production_sessions INTEGER NOT NULL DEFAULT 0,
    platforms TEXT[] NOT NULL DEFAULT '{"instagram", "facebook"}',
    has_ads_management BOOLEAN NOT NULL DEFAULT false,
    has_website BOOLEAN NOT NULL DEFAULT false,
    has_strategy BOOLEAN NOT NULL DEFAULT false,
    has_community_management BOOLEAN NOT NULL DEFAULT false,
    website_scope TEXT,
    custom_pricing BOOLEAN NOT NULL DEFAULT false,
    
    -- Canonical Financial OS Cost Formulas
    employee_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    freelancer_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    transport_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    subscription_allocation NUMERIC(12,2) NOT NULL DEFAULT 0,
    commission NUMERIC(12,2) NOT NULL DEFAULT 0,
    direct_costs NUMERIC(12,2) GENERATED ALWAYS AS (
        employee_cost + freelancer_cost + transport_cost + subscription_allocation + commission
    ) STORED,
    gross_profit NUMERIC(12,2) GENERATED ALWAYS AS (
        price - (employee_cost + freelancer_cost + transport_cost + subscription_allocation + commission)
    ) STORED,
    gross_margin NUMERIC(8,2) GENERATED ALWAYS AS (
        CASE 
            WHEN price > 0 THEN 
                ((price - (employee_cost + freelancer_cost + transport_cost + subscription_allocation + commission)) / price) * 100.0
            ELSE 0.0 
        END
    ) STORED,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 3. PACKAGE ADD-ONS TABLE
CREATE TABLE IF NOT EXISTS public.package_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    name_ar TEXT,
    price NUMERIC(12,2) NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'item',
    percentage_modifier NUMERIC(5,2),
    category TEXT DEFAULT 'general',
    description TEXT,
    description_ar TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.package_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_addons ENABLE ROW LEVEL SECURITY;

-- 5. RLS POLICIES FOR CATEGORIES
DO $$
BEGIN
    DROP POLICY IF EXISTS "Package categories viewable by everyone" ON public.package_categories;
    CREATE POLICY "Package categories viewable by everyone"
        ON public.package_categories FOR SELECT
        USING (is_active = true OR auth.role() = 'authenticated');

    DROP POLICY IF EXISTS "Package categories manageable by admins" ON public.package_categories;
    CREATE POLICY "Package categories manageable by admins"
        ON public.package_categories FOR ALL TO authenticated
        USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
        WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));
END $$;

-- 6. RLS POLICIES FOR PACKAGE CATALOG
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public packages viewable" ON public.package_catalog;
    CREATE POLICY "Public packages viewable"
        ON public.package_catalog FOR SELECT
        USING (
            (is_active = true AND is_published = true)
            OR auth.role() = 'authenticated'
        );

    DROP POLICY IF EXISTS "Package catalog manageable by admins" ON public.package_catalog;
    CREATE POLICY "Package catalog manageable by admins"
        ON public.package_catalog FOR ALL TO authenticated
        USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
        WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));
END $$;

-- 7. RLS POLICIES FOR ADD-ONS
DO $$
BEGIN
    DROP POLICY IF EXISTS "Addons viewable by everyone" ON public.package_addons;
    CREATE POLICY "Addons viewable by everyone"
        ON public.package_addons FOR SELECT
        USING (is_active = true OR auth.role() = 'authenticated');

    DROP POLICY IF EXISTS "Addons manageable by admins" ON public.package_addons;
    CREATE POLICY "Addons manageable by admins"
        ON public.package_addons FOR ALL TO authenticated
        USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
        WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));
END $$;

-- 8. DELETION PROTECTION TRIGGER (IMMUTABILITY / ARCHIVE SEMANTICS)
CREATE OR REPLACE FUNCTION public.prevent_referenced_package_deletion()
RETURNS TRIGGER AS $$
DECLARE
    ref_count INTEGER := 0;
BEGIN
    -- Check references in clients
    SELECT COUNT(*) INTO ref_count FROM public.clients WHERE package_id = OLD.id;
    IF ref_count > 0 THEN
        RAISE EXCEPTION 'Cannot delete package %: referenced by % client(s). Use archive (is_active = false) instead.', OLD.code, ref_count;
    END IF;

    -- Check references in deals
    SELECT COUNT(*) INTO ref_count FROM public.deals WHERE package_id = OLD.id;
    IF ref_count > 0 THEN
        RAISE EXCEPTION 'Cannot delete package %: referenced by % deal(s). Use archive instead.', OLD.code, ref_count;
    END IF;

    -- Check references in client_deliverables
    SELECT COUNT(*) INTO ref_count FROM public.client_deliverables WHERE package_id = OLD.id;
    IF ref_count > 0 THEN
        RAISE EXCEPTION 'Cannot delete package %: referenced by % deliverable(s). Use archive instead.', OLD.code, ref_count;
    END IF;

    -- Check references in production_bookings
    SELECT COUNT(*) INTO ref_count FROM public.production_bookings WHERE package_id = OLD.id;
    IF ref_count > 0 THEN
        RAISE EXCEPTION 'Cannot delete package %: referenced by % booking(s). Use archive instead.', OLD.code, ref_count;
    END IF;

    -- Check references in project_tasks
    SELECT COUNT(*) INTO ref_count FROM public.project_tasks WHERE package_id = OLD.id;
    IF ref_count > 0 THEN
        RAISE EXCEPTION 'Cannot delete package %: referenced by % task(s). Use archive instead.', OLD.code, ref_count;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_package_deletion ON public.package_catalog;
CREATE TRIGGER trg_prevent_package_deletion
    BEFORE DELETE ON public.package_catalog
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_referenced_package_deletion();

-- 9. BIDIRECTIONAL SYNC / COMPATIBILITY WITH LEGACY packages TABLE
CREATE OR REPLACE FUNCTION public.sync_package_catalog_to_packages()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        DELETE FROM public.packages WHERE id = OLD.id;
        RETURN OLD;
    ELSIF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        INSERT INTO public.packages (
            id,
            name,
            description,
            selling_price,
            production_hours,
            employee_cost,
            freelancer_cost,
            transport_cost,
            subscription_allocation,
            commission,
            is_active,
            created_at,
            updated_at
        ) VALUES (
            NEW.id,
            NEW.name,
            NEW.description,
            NEW.price,
            NEW.production_hours,
            NEW.employee_cost,
            NEW.freelancer_cost,
            NEW.transport_cost,
            NEW.subscription_allocation,
            NEW.commission,
            NEW.is_active,
            NEW.created_at,
            NEW.updated_at
        )
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            selling_price = EXCLUDED.selling_price,
            production_hours = EXCLUDED.production_hours,
            employee_cost = EXCLUDED.employee_cost,
            freelancer_cost = EXCLUDED.freelancer_cost,
            transport_cost = EXCLUDED.transport_cost,
            subscription_allocation = EXCLUDED.subscription_allocation,
            commission = EXCLUDED.commission,
            is_active = EXCLUDED.is_active,
            updated_at = EXCLUDED.updated_at;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_package_catalog_to_packages ON public.package_catalog;
CREATE TRIGGER trg_sync_package_catalog_to_packages
    AFTER INSERT OR UPDATE OR DELETE ON public.package_catalog
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_package_catalog_to_packages();

-- 10. SEED CANONICAL CATEGORIES
INSERT INTO public.package_categories (code, name, name_ar, slug, description, description_ar, display_order, priority, is_active)
VALUES
('SMM', 'Social Media Management', 'إدارة منصات التواصل الاجتماعي', 'social-media-management', 'Content planning, editing, copywriting, publishing and community management without shooting.', 'تخطيط المحتوى، المونتاج، كتابة الإعلانات، النشر وإدارة التفاعل بدون تصوير.', 1, 10, true),
('PRODUCTION', 'Content Production & Shooting', 'إنتاج وتصوير المحتوى', 'content-production-shooting', 'High-end visual production, shooting, editing, color grading and delivery.', 'جلسات تصوير احترافية، إخراج، مونتاج، تلوين وتسليم منظم للمواد الإعلانية.', 2, 9, true),
('STORY', 'Story Production', 'إنتاج الستوريز والتغطيات', 'story-production', 'Dedicated story shoots, visits and daily coverage for high-touch engagement.', 'زيارات وتغطيات دورية أو يومية لتوثيق الأنشطة والعروض والمنتجات.', 3, 8, true),
('ADS', 'Paid Ads Management', 'إدارة الإعلانات الممولة', 'paid-ads-management', 'Data-driven Meta and multi-platform paid acquisition architecture.', 'تخطيط، إطلاق، مراقبة وتحسين الحملات الإعلانية الممولة لتحقيق أعلى عائد.', 4, 7, true),
('WEB', 'Websites & Digital Systems', 'المواقع والمنظومات الرقمية', 'websites-digital-systems', 'High-performance digital flagship websites and custom digital engines.', 'مواقع هبوط، مواقع شركات، وتطبيقات ويب متكاملة مع لوحات تحكم.', 5, 6, true),
('STRATEGY', 'Strategy', 'الاستشارات والاستراتيجية', 'strategy', 'Deep brand, audience, and market positioning frameworks.', 'دراسة السوق والمنافسين، تحديد الجمهور المستهدف ورسم خارطة الطريق التسويقية.', 6, 5, true),
('COMBINED', 'Monthly Combined Packages', 'الباقات الشهرية المتكاملة', 'monthly-combined-packages', 'Full turnkey agency partnership: Production + Management + Ads.', 'شراكة إبداعية كاملة تجمع بين الإنتاج الميداني، إدارة المحتوى، والإعلانات.', 7, 10, true),
('CUSTOM', 'Custom Package', 'باقة مخصصة', 'custom-package', 'Tailored hybrid packages built to your exact operational specifications.', 'صمم باقتك بحرية تامة حسب متطلبات عملك ونطاق خدماتك المستهدفة.', 8, 4, true),
('ADDONS', 'Add-ons & Extras', 'الخدمات الإضافية والتوسعات', 'addons', 'Individual units, extra deliverables and express turnarounds.', 'وحدات إنتاج إضافية، تسليم سريع وتعديلات فورية حسب الطلب.', 9, 3, true)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    name_ar = EXCLUDED.name_ar,
    slug = EXCLUDED.slug,
    description = EXCLUDED.description,
    description_ar = EXCLUDED.description_ar,
    display_order = EXCLUDED.display_order,
    priority = EXCLUDED.priority,
    is_active = EXCLUDED.is_active;

-- 11. MIGRATE EXISTING 3 PACKAGES INTO package_catalog TO PRESERVE ALL CLIENT REFERENCES
INSERT INTO public.package_catalog (
    id, code, name, name_ar, slug, description, category_id, category_name,
    package_type, billing_type, price, currency, is_active, is_published, is_featured,
    priority, display_order, short_description, monthly_reels, monthly_posts, monthly_stories,
    production_hours, employee_cost, freelancer_cost, transport_cost, subscription_allocation, commission
) VALUES
(
    '18c31b3e-bb70-41ba-853d-2895179d89ca',
    'LEG-GROWTH',
    'SADA Growth Luxe',
    'صدى جروث لوكس',
    'sada-growth-luxe',
    'Core social media retainer: 8 Reels, 8 Posts, 20 Stories, 4 Ads Campaigns with dedicated shoot and creative direction.',
    (SELECT id FROM public.package_categories WHERE code = 'COMBINED'),
    'Monthly Combined Packages',
    'hybrid',
    'monthly',
    2800.00,
    'TND',
    true,
    false, -- Hidden legacy package for existing clients
    false,
    0,
    99,
    'Core social retainer with dedicated shoot and creative direction.',
    8, 8, '20 Stories', 18.0, 600.00, 300.00, 120.00, 100.00, 280.00
),
(
    '767d1930-f77a-40e7-b07d-976e9074aed9',
    'LEG-SCALE',
    'SADA Elite Scale',
    'صدى إيليت سكيل',
    'sada-elite-scale',
    'High-volume omnichannel content engine: 16 Reels, 12 Posts, 40 Stories, 8 Ads Campaigns with dual monthly production shoots.',
    (SELECT id FROM public.package_categories WHERE code = 'COMBINED'),
    'Monthly Combined Packages',
    'hybrid',
    'monthly',
    5200.00,
    'TND',
    true,
    false,
    false,
    0,
    99,
    'Omnichannel content engine with dual production shoots.',
    16, 12, '40 Stories', 32.0, 1100.00, 550.00, 250.00, 180.00, 520.00
),
(
    '6fdbefbe-3b25-4f2c-a950-c8706397d650',
    'LEG-AUTH',
    'SADA Brand Authority',
    'صدى براند أوثوريتي',
    'sada-brand-authority',
    'Comprehensive brand identity & flagship media production: 4 Reels, 4 Posts, 10 Stories, 2 Ads Campaigns.',
    (SELECT id FROM public.package_categories WHERE code = 'COMBINED'),
    'Monthly Combined Packages',
    'hybrid',
    'monthly',
    1800.00,
    'TND',
    true,
    false,
    false,
    0,
    99,
    'Flagship brand media production.',
    4, 4, '10 Stories', 10.0, 400.00, 200.00, 80.00, 60.00, 180.00
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    code = EXCLUDED.code;

-- 12. SEED OFFICIAL CANONICAL MASTER CATALOG (24 PACKAGES)

-- CATEGORY 01: SOCIAL MEDIA MANAGEMENT (Without SADA shooting)
INSERT INTO public.package_catalog (
    code, name, name_ar, slug, description, description_ar, short_description, short_description_ar,
    category_id, category_name, package_type, billing_type, price, currency,
    is_active, is_published, is_featured, badge, badge_ar, priority, display_order,
    monthly_reels, monthly_posts, monthly_stories, platforms,
    has_ads_management, has_website, has_strategy, has_community_management,
    included_items, excluded_items,
    employee_cost, freelancer_cost, transport_cost, subscription_allocation, commission
) VALUES
(
    'MG-01', 'Starter', 'باقة البداية', 'starter',
    'Stay active and consistent on social media with planned posts, reels and community moderation.',
    'حضور نشط ومستمر ومتفاعل على منصات التواصل الاجتماعي مع إدارة وتخطيط المحتوى.',
    'Stay active and consistent on social media.', 'حضور نشط ومستمر على منصات التواصل.',
    (SELECT id FROM public.package_categories WHERE code = 'SMM'), 'Social Media Management',
    'standard', 'monthly', 699.00, 'TND',
    true, true, false, NULL, NULL, 1, 1,
    4, 4, '8 Stories / month', '{"instagram", "facebook"}',
    false, false, false, true,
    '[
        {"text": "4 Reels / month", "text_ar": "4 ريلز شهرياً", "order": 1},
        {"text": "4 Posts or Carousels / month", "text_ar": "4 منشورات أو كاروسيل شهرياً", "order": 2},
        {"text": "8 Stories / month", "text_ar": "8 ستوريز شهرياً", "order": 3},
        {"text": "Instagram + Facebook", "text_ar": "انستغرام + فيسبوك", "order": 4},
        {"text": "Content Planning", "text_ar": "تخطيط وجدولة المحتوى", "order": 5},
        {"text": "Scheduling / Publishing", "text_ar": "النشر والمتابعة", "order": 6},
        {"text": "Basic Community Management", "text_ar": "إدارة التفاعل الأساسية والردود", "order": 7},
        {"text": "Content Calendar", "text_ar": "تقويم المحتوى الشهري", "order": 8}
    ]'::jsonb,
    '[
        {"text": "Photography / Videography", "text_ar": "التصوير الفوتوغرافي والفيديو", "order": 1},
        {"text": "Production sessions", "text_ar": "جلسات الإنتاج والتصوير", "order": 2},
        {"text": "Ads Management", "text_ar": "إدارة الإعلانات الممولة", "order": 3},
        {"text": "Sponsoring / Ad Budget", "text_ar": "ميزانية الإعلانات الممولة", "order": 4},
        {"text": "Daily Story Production", "text_ar": "إنتاج الستوريز اليومية", "order": 5},
        {"text": "Website Development", "text_ar": "تطوير المواقع الإلكترونية", "order": 6}
    ]'::jsonb,
    180.00, 80.00, 0.00, 30.00, 69.90
),
(
    'MG-02', 'Growth', 'باقة النمو', 'growth',
    'Full social growth engine with copywriting, content repurposing and detailed reporting.',
    'منظومة نمو متكاملة تشمل كتابة النصوص، إعادة تدوير المحتوى وتقارير الأداء الدورية.',
    'Full social growth engine with reporting.', 'منظومة نمو متكاملة وتقارير دورية.',
    (SELECT id FROM public.package_categories WHERE code = 'SMM'), 'Social Media Management',
    'standard', 'monthly', 1090.00, 'TND',
    true, true, false, NULL, NULL, 2, 2,
    8, 8, 'Weekly Stories', '{"instagram", "facebook"}',
    false, false, true, true,
    '[
        {"text": "8 Reels / month", "text_ar": "8 ريلز شهرياً", "order": 1},
        {"text": "8 Posts / Carousels / month", "text_ar": "8 منشورات أو كاروسيل شهرياً", "order": 2},
        {"text": "Weekly Stories", "text_ar": "ستوريز أسبوعية منتظمة", "order": 3},
        {"text": "Content Repurposing", "text_ar": "إعادة صياغة وتدوير المحتوى", "order": 4},
        {"text": "Instagram + Facebook", "text_ar": "انستغرام + فيسبوك", "order": 5},
        {"text": "Content Planning", "text_ar": "تخطيط وجدولة المحتوى", "order": 6},
        {"text": "Copywriting", "text_ar": "كتابة النصوص التسويقية", "order": 7},
        {"text": "Publishing", "text_ar": "النشر الاحترافي", "order": 8},
        {"text": "Community Management", "text_ar": "إدارة المجتمع والتفاعل", "order": 9},
        {"text": "Monthly Performance Report", "text_ar": "تقرير أداء شهري تفصيلي", "order": 10},
        {"text": "Marketing Ideas", "text_ar": "أفكار واستشارات تسويقية", "order": 11}
    ]'::jsonb,
    '[
        {"text": "Photography / Videography", "text_ar": "التصوير الفوتوغرافي والفيديو", "order": 1},
        {"text": "Production sessions", "text_ar": "جلسات الإنتاج والتصوير", "order": 2},
        {"text": "Ads Management", "text_ar": "إدارة الإعلانات الممولة", "order": 3},
        {"text": "Sponsoring / Ad Budget", "text_ar": "ميزانية الإعلانات الممولة", "order": 4},
        {"text": "Daily Story Production", "text_ar": "إنتاج الستوريز اليومية", "order": 5}
    ]'::jsonb,
    280.00, 120.00, 0.00, 50.00, 109.00
),
(
    'MG-03', 'Growth+', 'باقة النمو بلس', 'growth-plus',
    'Comprehensive social presence paired with active Meta Ads management and marketing strategy.',
    'حضور رقمي متكامل مع إدارة إعلانات ميتا الممولة واستراتيجية تسويقية مستمرة.',
    'Complete social growth with Meta Ads.', 'نمو رقمي شامل مع إدارة إعلانات ميتا.',
    (SELECT id FROM public.package_categories WHERE code = 'SMM'), 'Social Media Management',
    'standard', 'monthly', 1290.00, 'TND',
    true, true, true, 'most_popular', 'الأكثر طلباً', 3, 3,
    8, 8, 'Weekly Stories', '{"instagram", "facebook"}',
    true, false, true, true,
    '[
        {"text": "8 Reels", "text_ar": "8 ريلز احترافية", "order": 1},
        {"text": "8 Posts / Carousels", "text_ar": "8 منشورات أو كاروسيل", "order": 2},
        {"text": "Weekly Stories", "text_ar": "ستوريز أسبوعية منتظمة", "order": 3},
        {"text": "Instagram + Facebook", "text_ar": "انستغرام + فيسبوك", "order": 4},
        {"text": "Content Planning", "text_ar": "تخطيط وجدولة المحتوى", "order": 5},
        {"text": "Copywriting", "text_ar": "كتابة النصوص التسويقية", "order": 6},
        {"text": "Publishing", "text_ar": "النشر الاحترافي", "order": 7},
        {"text": "Community Management", "text_ar": "إدارة المجتمع والتفاعل", "order": 8},
        {"text": "Monthly Report", "text_ar": "تقرير أداء شهري تفصيلي", "order": 9},
        {"text": "Marketing Strategy / Ideas", "text_ar": "استراتيجية وأفكار تسويقية مستمرة", "order": 10},
        {"text": "Meta Ads Management", "text_ar": "إدارة حملات إعلانات ميتا الممولة", "order": 11}
    ]'::jsonb,
    '[
        {"text": "Photography / Videography", "text_ar": "التصوير الفوتوغرافي والفيديو", "order": 1},
        {"text": "Production sessions", "text_ar": "جلسات الإنتاج والتصوير", "order": 2},
        {"text": "Sponsoring / Ad Budget", "text_ar": "ميزانية الإعلانات الممولة", "order": 3}
    ]'::jsonb,
    350.00, 150.00, 0.00, 60.00, 129.00
),
(
    'MG-04', 'Scale', 'باقة التوسع', 'scale',
    'Aggressive multi-platform organic and paid expansion across Instagram, Facebook and TikTok.',
    'توسع رقمي مكثف متعدد المنصات يشمل انستغرام، فيسبوك وتيك توك مع التحليلات.',
    'Multi-platform expansion with TikTok.', 'توسع متعدد المنصات يشمل تيك توك.',
    (SELECT id FROM public.package_categories WHERE code = 'SMM'), 'Social Media Management',
    'standard', 'monthly', 1590.00, 'TND',
    true, true, false, NULL, NULL, 4, 4,
    12, 8, 'Weekly Stories', '{"instagram", "facebook", "tiktok"}',
    true, false, true, true,
    '[
        {"text": "12 Reels", "text_ar": "12 ريلز احترافية", "order": 1},
        {"text": "8 Posts / Carousels", "text_ar": "8 منشورات أو كاروسيل", "order": 2},
        {"text": "Weekly Stories", "text_ar": "ستوريز أسبوعية منتظمة", "order": 3},
        {"text": "Content Repurposing", "text_ar": "إعادة صياغة وتدوير المحتوى", "order": 4},
        {"text": "Instagram + Facebook + TikTok", "text_ar": "انستغرام + فيسبوك + تيك توك", "order": 5},
        {"text": "Content Planning", "text_ar": "تخطيط وجدولة المحتوى", "order": 6},
        {"text": "Copywriting", "text_ar": "كتابة النصوص التسويقية", "order": 7},
        {"text": "Publishing", "text_ar": "النشر الاحترافي", "order": 8},
        {"text": "Community Management", "text_ar": "إدارة المجتمع والتفاعل", "order": 9},
        {"text": "Monthly Analytics", "text_ar": "تحليلات الأداء الشاملة", "order": 10},
        {"text": "Strategy", "text_ar": "استراتيجية المحتوى والتوسع", "order": 11},
        {"text": "Meta Ads Management", "text_ar": "إدارة حملات إعلانات ميتا الممولة", "order": 12}
    ]'::jsonb,
    '[
        {"text": "Photography / Videography", "text_ar": "التصوير الفوتوغرافي والفيديو", "order": 1},
        {"text": "Production sessions", "text_ar": "جلسات الإنتاج والتصوير", "order": 2},
        {"text": "Sponsoring / Ad Budget", "text_ar": "ميزانية الإعلانات الممولة", "order": 3}
    ]'::jsonb,
    420.00, 200.00, 0.00, 80.00, 159.00
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    name_ar = EXCLUDED.name_ar,
    price = EXCLUDED.price,
    included_items = EXCLUDED.included_items,
    excluded_items = EXCLUDED.excluded_items,
    badge = EXCLUDED.badge,
    badge_ar = EXCLUDED.badge_ar,
    display_order = EXCLUDED.display_order,
    is_published = EXCLUDED.is_published,
    is_active = EXCLUDED.is_active;

-- CATEGORY 02: CONTENT PRODUCTION & SHOOTING
INSERT INTO public.package_catalog (
    code, name, name_ar, slug, description, description_ar, short_description, short_description_ar,
    category_id, category_name, package_type, billing_type, price, currency,
    is_active, is_published, is_featured, badge, badge_ar, priority, display_order,
    production_hours, production_sessions, monthly_reels,
    included_items, excluded_items,
    employee_cost, freelancer_cost, transport_cost, subscription_allocation, commission
) VALUES
(
    'PR-01', 'Content Session', 'جلسة إنتاج محتوى', 'content-session',
    'Standard 4-hour production session covering photo and video with reel editing and sound.',
    'جلسة تصوير لمدة 4 ساعات تشمل الفيديو والفوتوغراف مع مونتاج وتلوين الريلز.',
    '1 production session — up to 4 hours.', 'جلسة تصوير حتى 4 ساعات.',
    (SELECT id FROM public.package_categories WHERE code = 'PRODUCTION'), 'Content Production & Shooting',
    'production', 'one_time', 550.00, 'TND',
    true, true, false, NULL, NULL, 1, 1,
    4.0, 1, 3,
    '[
        {"text": "1 production session — up to 4 hours", "text_ar": "جلسة تصوير واحدة — حتى 4 ساعات", "order": 1},
        {"text": "Video + Photography", "text_ar": "فيديو + تصوير فوتوغرافي", "order": 2},
        {"text": "3 Reels", "text_ar": "3 ريلز مصورة وممنتجة", "order": 3},
        {"text": "10–15 Photos", "text_ar": "10 إلى 15 صورة معدلة", "order": 4},
        {"text": "Story Clips", "text_ar": "مقاطع مخصصة للستوري", "order": 5},
        {"text": "Reel Editing", "text_ar": "مونتاج ريلز احترافي", "order": 6},
        {"text": "Color Correction", "text_ar": "تعديل وتصحيح الألوان", "order": 7},
        {"text": "Sound & Basic Captions", "text_ar": "هندسة صوتية وترجمة أساسية", "order": 8}
    ]'::jsonb,
    '[
        {"text": "Social Media Management", "text_ar": "إدارة منصات التواصل", "order": 1},
        {"text": "Publishing", "text_ar": "النشر والجدولة", "order": 2},
        {"text": "Ads Management", "text_ar": "إدارة الإعلانات", "order": 3},
        {"text": "Sponsoring / Ad Budget", "text_ar": "ميزانية الإعلانات الممولة", "order": 4},
        {"text": "Daily Stories", "text_ar": "الستوريز اليومية المستمرة", "order": 5}
    ]'::jsonb,
    150.00, 100.00, 40.00, 20.00, 55.00
),
(
    'PR-02', 'Content Session Pro', 'جلسة إنتاج احترافية برو', 'content-session-pro',
    'Advanced 4-hour session with creative direction, shot planning, 5 reels and 20 photos.',
    'جلسة تصوير احترافية مع تخطيط مسبق، توجيه إبداعي، 5 ريلز و20 صورة متميزة.',
    '4 hours with creative direction & 5 Reels.', '4 ساعات تصوير مع توجيه إبداعي و5 ريلز.',
    (SELECT id FROM public.package_categories WHERE code = 'PRODUCTION'), 'Content Production & Shooting',
    'production', 'one_time', 750.00, 'TND',
    true, true, false, NULL, NULL, 2, 2,
    4.0, 1, 5,
    '[
        {"text": "1 production session — up to 4 hours", "text_ar": "جلسة تصوير واحدة — حتى 4 ساعات", "order": 1},
        {"text": "5 Reels", "text_ar": "5 ريلز سينمائية", "order": 2},
        {"text": "20 Photos", "text_ar": "20 صورة فوتوغرافية احترافية", "order": 3},
        {"text": "Story Content", "text_ar": "محتوى مخصص للستوري", "order": 4},
        {"text": "Creative Direction", "text_ar": "توجيه إبداعي وإخراج فني", "order": 5},
        {"text": "Shot Planning", "text_ar": "تخطيط المشاهد واللقطات", "order": 6},
        {"text": "Videography + Photography", "text_ar": "تصوير فيديو وفوتوغرافي متقدم", "order": 7},
        {"text": "Editing & Color Grading", "text_ar": "مونتاج سينمائي وتلوين متقدم", "order": 8},
        {"text": "Sound Design & Captions", "text_ar": "مؤثرات صوتية وترجمة", "order": 9}
    ]'::jsonb,
    '[
        {"text": "Social Media Management", "text_ar": "إدارة منصات التواصل", "order": 1},
        {"text": "Publishing", "text_ar": "النشر والجدولة", "order": 2},
        {"text": "Ads Management", "text_ar": "إدارة الإعلانات", "order": 3},
        {"text": "Sponsoring / Ad Budget", "text_ar": "ميزانية الإعلانات الممولة", "order": 4}
    ]'::jsonb,
    200.00, 150.00, 50.00, 30.00, 75.00
),
(
    'PR-03', 'Long Production Day', 'يوم إنتاج ممتد', 'long-production-day',
    'Extended 6-hour production session with creative direction, 6 reels and raw footage archive.',
    'جلسة تصوير ممتدة حتى 6 ساعات تشمل 6 ريلز، 25 صورة وأرشفة المشاهد الخام.',
    '1 Long Session — up to 6 hours.', 'جلسة تصوير ممتدة حتى 6 ساعات.',
    (SELECT id FROM public.package_categories WHERE code = 'PRODUCTION'), 'Content Production & Shooting',
    'production', 'one_time', 900.00, 'TND',
    true, true, false, NULL, NULL, 3, 3,
    6.0, 1, 6,
    '[
        {"text": "1 Long Session — up to 6 hours", "text_ar": "جلسة تصوير ممتدة — حتى 6 ساعات", "order": 1},
        {"text": "6 Reels", "text_ar": "6 ريلز سينمائية كاملة", "order": 2},
        {"text": "25 Photos", "text_ar": "25 صورة عالية الدقة", "order": 3},
        {"text": "Story Assets", "text_ar": "حزمة لقطات مخصصة للستوري", "order": 4},
        {"text": "Creative Direction", "text_ar": "توجيه إبداعي وإخراج متكامل", "order": 5},
        {"text": "Videography & Photography", "text_ar": "تصوير فيديو وفوتوغراف احترافي", "order": 6},
        {"text": "Editing & Color Correction", "text_ar": "مونتاج كامل وتصحيح ألوان", "order": 7},
        {"text": "Sound & Captions", "text_ar": "تصميم صوتي وترجمة نصوص", "order": 8},
        {"text": "Raw Footage Organization", "text_ar": "تنظيم وتسليم المواد الخام", "order": 9}
    ]'::jsonb,
    '[
        {"text": "Social Media Management", "text_ar": "إدارة منصات التواصل", "order": 1},
        {"text": "Publishing", "text_ar": "النشر والجدولة", "order": 2},
        {"text": "Ads Management", "text_ar": "إدارة الإعلانات", "order": 3},
        {"text": "Sponsoring / Ad Budget", "text_ar": "ميزانية الإعلانات الممولة", "order": 4}
    ]'::jsonb,
    250.00, 180.00, 60.00, 40.00, 90.00
),
(
    'PR-04', 'Full Production Day', 'يوم إنتاج كامل', 'full-production-day',
    'Comprehensive 8-hour production day with multiple setups, 8 reels, 30-40 photos and BTS.',
    'يوم تصوير كامل لمدة 8 ساعات مع سيناريوهات متعددة، 8 ريلز و30-40 صورة احترافية.',
    '1 Full Day (8h) or 2 Sessions (4h+4h).', 'يوم كامل 8 ساعات أو جلستان 4+4 س.',
    (SELECT id FROM public.package_categories WHERE code = 'PRODUCTION'), 'Content Production & Shooting',
    'production', 'one_time', 1200.00, 'TND',
    true, true, true, 'recommended', 'موصى به', 4, 4,
    8.0, 1, 8,
    '[
        {"text": "1 Full Day — up to 8 hours (or 2×4h)", "text_ar": "يوم إنتاج كامل — حتى 8 ساعات (أو جلستان 4+4 س)", "order": 1},
        {"text": "8 Reels", "text_ar": "8 ريلز سينمائية كاملة المونتاج", "order": 2},
        {"text": "30–40 Photos", "text_ar": "30 إلى 40 صورة فوتوغرافية احترافية", "order": 3},
        {"text": "Story Content & BTS", "text_ar": "محتوى ستوري وكواليس العمل (BTS)", "order": 4},
        {"text": "Creative Direction", "text_ar": "إخراج فني وتوجيه سيناريو", "order": 5},
        {"text": "Professional Shooting", "text_ar": "معدات تصوير سينمائية وإضاءة", "order": 6},
        {"text": "Product / Food Shots", "text_ar": "تصوير منتجات / أطعمة متخصص", "order": 7},
        {"text": "Multiple Setups", "text_ar": "مواقع وديكورات تصوير متعددة", "order": 8},
        {"text": "Full Editing & Color Grading", "text_ar": "مونتاج متكامل وتلوين سينمائي", "order": 9},
        {"text": "Sound Design, Captions & Covers", "text_ar": "هندسة صوتية وترجمة وأغلفة مخصصة", "order": 10}
    ]'::jsonb,
    '[
        {"text": "Social Media Management", "text_ar": "إدارة منصات التواصل", "order": 1},
        {"text": "Publishing", "text_ar": "النشر والجدولة", "order": 2},
        {"text": "Ads Management", "text_ar": "إدارة الإعلانات", "order": 3},
        {"text": "Sponsoring / Ad Budget", "text_ar": "ميزانية الإعلانات الممولة", "order": 4}
    ]'::jsonb,
    350.00, 240.00, 80.00, 50.00, 120.00
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    name_ar = EXCLUDED.name_ar,
    price = EXCLUDED.price,
    included_items = EXCLUDED.included_items,
    excluded_items = EXCLUDED.excluded_items,
    badge = EXCLUDED.badge,
    badge_ar = EXCLUDED.badge_ar,
    display_order = EXCLUDED.display_order,
    is_published = EXCLUDED.is_published,
    is_active = EXCLUDED.is_active;

-- CATEGORY 03: STORY PRODUCTION
INSERT INTO public.package_catalog (
    code, name, name_ar, slug, description, description_ar, short_description, short_description_ar,
    category_id, category_name, package_type, billing_type, price, currency,
    is_active, is_published, is_featured, priority, display_order,
    production_hours,
    included_items, excluded_items,
    employee_cost, freelancer_cost, transport_cost, subscription_allocation, commission
) VALUES
(
    'ST-01', 'Story Batch', 'حزمة ستوريز مركزة', 'story-batch',
    'Single 2-hour session capturing 15-25 story clips with basic editing and organized delivery.',
    'جلسة تصوير لمدة ساعتين لإنتاج 15-25 مقطع ستوري مع مونتاج وتسليم منظم.',
    '1 session up to 2 hours, 15–25 clips.', 'جلسة ساعتين، 15-25 مقطع ستوري.',
    (SELECT id FROM public.package_categories WHERE code = 'STORY'), 'Story Production',
    'standard', 'one_time', 350.00, 'TND',
    true, true, false, 1, 1,
    2.0,
    '[
        {"text": "1 session up to 2 hours", "text_ar": "جلسة تصوير واحدة حتى ساعتين", "order": 1},
        {"text": "15–25 Story Clips", "text_ar": "15 إلى 25 مقطع ستوري", "order": 2},
        {"text": "Basic Editing", "text_ar": "مونتاج سريع وجذاب", "order": 3},
        {"text": "Organized File Delivery", "text_ar": "تسليم منظم للملفات", "order": 4}
    ]'::jsonb,
    '[
        {"text": "Publishing", "text_ar": "النشر والجدولة", "order": 1},
        {"text": "Social Media Management", "text_ar": "إدارة منصات التواصل", "order": 2}
    ]'::jsonb,
    100.00, 50.00, 30.00, 10.00, 35.00
),
(
    'ST-02', 'Story Visits', 'زيارات ستوري الشهرية', 'story-visits',
    '8 monthly on-site visits (approx. 2/week, 1h each) covering daily activities, products and offers.',
    '8 زيارات ميدانية شهرياً (زيارتان أسبوعياً) لتوثيق الأنشطة اليومية والعروض والمنتجات.',
    '8 Visits / month (approx. 2/week).', '8 زيارات شهرياً (زيارتان أسبوعياً).',
    (SELECT id FROM public.package_categories WHERE code = 'STORY'), 'Story Production',
    'standard', 'monthly', 600.00, 'TND',
    true, true, false, 2, 2,
    8.0,
    '[
        {"text": "8 Visits / month", "text_ar": "8 زيارات شهرياً", "order": 1},
        {"text": "Approximately 2 Visits / week", "text_ar": "زيارتان أسبوعياً تقريباً", "order": 2},
        {"text": "Up to 1 hour / visit", "text_ar": "حتى ساعة واحدة لكل زيارة", "order": 3},
        {"text": "Daily Activity Coverage", "text_ar": "تغطية الأنشطة اليومية الحية", "order": 4},
        {"text": "Products & Behind the Scenes", "text_ar": "المنتجات وكواليس العمل", "order": 5},
        {"text": "Offers & Customer Experience", "text_ar": "العروض وتجارب العملاء", "order": 6},
        {"text": "Organized Raw Story Clips", "text_ar": "مقاطع ستوري منظمة وجاهزة", "order": 7}
    ]'::jsonb,
    '[
        {"text": "Publishing", "text_ar": "النشر التلقائي", "order": 1}
    ]'::jsonb,
    180.00, 80.00, 60.00, 20.00, 60.00
),
(
    'ST-03', 'Story Plus', 'ستوري بلس', 'story-plus',
    '12 visits per month (approx. 3/week) with basic story editing, selection and organized delivery.',
    '12 زيارة شهرياً (3 زيارات أسبوعياً) تشمل التصوير، المونتاج السريع والتسليم المنظم.',
    '12 Visits / month (approx. 3/week).', '12 زيارة شهرياً (3 زيارات أسبوعياً).',
    (SELECT id FROM public.package_categories WHERE code = 'STORY'), 'Story Production',
    'standard', 'monthly', 800.00, 'TND',
    true, true, false, 3, 3,
    12.0,
    '[
        {"text": "12 Visits / month", "text_ar": "12 زيارة شهرياً", "order": 1},
        {"text": "Approximately 3 Visits / week", "text_ar": "3 زيارات أسبوعياً تقريباً", "order": 2},
        {"text": "Up to 1 hour / visit", "text_ar": "حتى ساعة لكل زيارة", "order": 3},
        {"text": "Story Shooting", "text_ar": "تصوير ستوري مباشر", "order": 4},
        {"text": "Basic Story Editing", "text_ar": "مونتاج أساسي للستوري", "order": 5},
        {"text": "Content Selection", "text_ar": "انتقاء أفضل اللقطات", "order": 6},
        {"text": "Organized Delivery", "text_ar": "تسليم الملفات بشكل منظم", "order": 7}
    ]'::jsonb,
    '[
        {"text": "Publishing", "text_ar": "النشر التلقائي", "order": 1}
    ]'::jsonb,
    240.00, 100.00, 80.00, 25.00, 80.00
),
(
    'ST-04', 'Daily Story', 'ستوري يومي', 'daily-story',
    'Up to 20 visits per month (approx. 5/week) for constant brand presence and moment capture.',
    'حتى 20 زيارة شهرياً (5 زيارات أسبوعياً) لضمان حضور وتفاعل يومي مع جمهورك.',
    'Up to 20 Visits / month (5/week).', 'حتى 20 زيارة شهرياً (5 أيام بالأسبوع).',
    (SELECT id FROM public.package_categories WHERE code = 'STORY'), 'Story Production',
    'standard', 'monthly', 1000.00, 'TND',
    true, true, false, 4, 4,
    20.0,
    '[
        {"text": "Up to 20 Visits / month", "text_ar": "حتى 20 زيارة شهرياً", "order": 1},
        {"text": "Approximately 5 Visits / week", "text_ar": "5 زيارات أسبوعياً تقريباً", "order": 2},
        {"text": "Up to 1 hour / visit", "text_ar": "حتى ساعة لكل زيارة", "order": 3},
        {"text": "Story Shooting", "text_ar": "تصوير ستوري يومي", "order": 4},
        {"text": "Moment Selection", "text_ar": "انتقاء اللحظات والقصص المؤثرة", "order": 5},
        {"text": "Story Clips & Basic Editing", "text_ar": "مقاطع ستوري ومونتاج أساسي", "order": 6},
        {"text": "Content Organization", "text_ar": "تنظيم المحتوى وجدولته", "order": 7}
    ]'::jsonb,
    '[
        {"text": "Copywriting", "text_ar": "كتابة النصوص التسويقية", "order": 1},
        {"text": "Full Social Media Management", "text_ar": "إدارة كاملة لمنصات التواصل", "order": 2},
        {"text": "Sponsoring / Ad Budget", "text_ar": "ميزانية الإعلانات الممولة", "order": 3}
    ]'::jsonb,
    300.00, 120.00, 100.00, 30.00, 100.00
),
(
    'ST-05', 'Daily Story Pro', 'ستوري يومي برو', 'daily-story-pro',
    'Full daily story coverage up to 20 visits (1.5h each), including editing, publishing, text and CTA.',
    'تغطية ستوري يومية احترافية شاملة التصوير، المونتاج، النشر المباشر وكتابة النصوص والـ CTA.',
    'Up to 20 Visits with editing & publishing.', 'حتى 20 زيارة مع المونتاج والنشر المباشر.',
    (SELECT id FROM public.package_categories WHERE code = 'STORY'), 'Story Production',
    'standard', 'monthly', 1300.00, 'TND',
    true, true, false, 5, 5,
    30.0,
    '[
        {"text": "Up to 20 Visits / month", "text_ar": "حتى 20 زيارة شهرياً", "order": 1},
        {"text": "Up to 1.5 hours / visit", "text_ar": "حتى ساعة ونصف لكل زيارة", "order": 2},
        {"text": "Story Shooting", "text_ar": "تصوير ستوري يومي متقدم", "order": 3},
        {"text": "Story Editing", "text_ar": "مونتاج وتصميم الستوري", "order": 4},
        {"text": "Publishing", "text_ar": "النشر المباشر بالموعد المحدد", "order": 5},
        {"text": "Copy / Text & CTA", "text_ar": "كتابة النصوص والدعوة للتفاعل (CTA)", "order": 6},
        {"text": "Daily Story Planning", "text_ar": "تخطيط وتقويم الستوريز اليومية", "order": 7}
    ]'::jsonb,
    '[
        {"text": "Sponsoring / Ad Budget", "text_ar": "ميزانية الإعلانات الممولة", "order": 1}
    ]'::jsonb,
    380.00, 150.00, 120.00, 40.00, 130.00
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    name_ar = EXCLUDED.name_ar,
    price = EXCLUDED.price,
    included_items = EXCLUDED.included_items,
    excluded_items = EXCLUDED.excluded_items,
    display_order = EXCLUDED.display_order,
    is_published = EXCLUDED.is_published,
    is_active = EXCLUDED.is_active;

-- CATEGORY 04: PAID ADS MANAGEMENT
INSERT INTO public.package_catalog (
    code, name, name_ar, slug, description, description_ar, short_description, short_description_ar,
    category_id, category_name, package_type, billing_type, price, currency,
    is_active, is_published, is_featured, priority, display_order,
    has_ads_management,
    included_items, excluded_items,
    employee_cost, freelancer_cost, transport_cost, subscription_allocation, commission
) VALUES
(
    'AD-01', 'Ads Basic', 'إعلانات أساسية', 'ads-basic',
    'Professional Meta Ads setup, campaign management, basic monitoring, optimization and monthly summary.',
    'تهيئة وإدارة حملات إعلانات ميتا، مراقبة مستمرة، تحسين دوري وتقرير شهري مختصر.',
    'Meta Ads Setup & Basic Optimization.', 'تهيئة وإدارة إعلانات ميتا مع تحسين أساسي.',
    (SELECT id FROM public.package_categories WHERE code = 'ADS'), 'Paid Ads Management',
    'standard', 'monthly', 250.00, 'TND',
    true, true, false, 1, 1,
    true,
    '[
        {"text": "Meta Ads Setup", "text_ar": "تهيئة حساب وبيكسل إعلانات ميتا", "order": 1},
        {"text": "Campaign Management", "text_ar": "إدارة الحملات الإعلانية", "order": 2},
        {"text": "Basic Monitoring", "text_ar": "مراقبة مستمرة للميزانية والأداء", "order": 3},
        {"text": "Basic Optimization", "text_ar": "تحسين مستمر لتقليل تكلفة الاكتساب", "order": 4},
        {"text": "Monthly Summary", "text_ar": "ملخص أداء شهري للأرقام", "order": 5}
    ]'::jsonb,
    '[
        {"text": "Advertising Budget / Sponsoring", "text_ar": "ميزانية الإعلانات الممولة (تدفع للمنصة)", "order": 1}
    ]'::jsonb,
    70.00, 30.00, 0.00, 15.00, 25.00
),
(
    'AD-02', 'Ads Pro', 'إعلانات احترافية برو', 'ads-pro',
    'Full acquisition architecture: strategy, multiple campaigns, audience & creative A/B testing, retargeting and reports.',
    'منظومة إعلانية متكاملة: استراتيجية، حملات متعددة، اختبارات A/B، إعادة استهداف وتقارير معمقة.',
    'Full acquisition architecture & retargeting.', 'منظومة إعلانية كاملة وإعادة استهداف.',
    (SELECT id FROM public.package_categories WHERE code = 'ADS'), 'Paid Ads Management',
    'standard', 'monthly', 400.00, 'TND',
    true, true, false, 2, 2,
    true,
    '[
        {"text": "Campaign Strategy", "text_ar": "استراتيجية حملات مبنية على أهدافك", "order": 1},
        {"text": "Multiple Campaigns", "text_ar": "إدارة حملات متعددة ومتزامنة", "order": 2},
        {"text": "Audience Testing", "text_ar": "اختبار وتحديد أدق الجماهير المستهدفة", "order": 3},
        {"text": "Creative Testing", "text_ar": "اختبار المحتوى الإعلاني والتصاميم (A/B)", "order": 4},
        {"text": "Continuous Optimization", "text_ar": "تحسين يومي لزيادة معدل التحويل", "order": 5},
        {"text": "Retargeting Architecture", "text_ar": "حملات إعادة استهداف متقدمة", "order": 6},
        {"text": "Detailed Monthly Report", "text_ar": "تقرير شهري تفصيلي لعائد الإنفاق (ROAS)", "order": 7}
    ]'::jsonb,
    '[
        {"text": "Advertising Budget / Sponsoring", "text_ar": "ميزانية الإعلانات الممولة (تدفع للمنصة)", "order": 1}
    ]'::jsonb,
    110.00, 50.00, 0.00, 25.00, 40.00
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    name_ar = EXCLUDED.name_ar,
    price = EXCLUDED.price,
    included_items = EXCLUDED.included_items,
    excluded_items = EXCLUDED.excluded_items,
    display_order = EXCLUDED.display_order,
    is_published = EXCLUDED.is_published,
    is_active = EXCLUDED.is_active;

-- CATEGORY 05: WEBSITES & DIGITAL SYSTEMS
INSERT INTO public.package_catalog (
    code, name, name_ar, slug, description, description_ar, short_description, short_description_ar,
    category_id, category_name, package_type, billing_type, price, currency,
    is_active, is_published, is_featured, priority, display_order,
    has_website, website_scope,
    included_items, excluded_items,
    employee_cost, freelancer_cost, transport_cost, subscription_allocation, commission
) VALUES
(
    'WEB-01', 'Landing Page', 'صفحة هبوط تسويقية', 'landing-page',
    'High-converting single-page website with responsive design, contact form, SEO and deployment.',
    'صفحة هبوط تسويقية سريعة ومصممة لتحويل الزوار إلى عملاء مع تهيئة محركات البحث.',
    'One-page Website with SEO & deployment.', 'صفحة هبوط مع تهيئة السيو والنشر.',
    (SELECT id FROM public.package_categories WHERE code = 'WEB'), 'Websites & Digital Systems',
    'digital', 'one_time', 700.00, 'TND',
    true, true, false, 1, 1,
    true, 'Single Landing Page',
    '[
        {"text": "One-page Website", "text_ar": "موقع من صفحة واحدة متكاملة", "order": 1},
        {"text": "Responsive Design", "text_ar": "تصميم متجاوب وسريع مع الهواتف", "order": 2},
        {"text": "Contact / CTA System", "text_ar": "نماذج تواصل ودعوة لاتخاذ قرار", "order": 3},
        {"text": "Basic SEO", "text_ar": "تهيئة أساسية لمحركات البحث (SEO)", "order": 4},
        {"text": "Deployment & SSL", "text_ar": "النشر والاستضافة مع شهادة أمان SSL", "order": 5}
    ]'::jsonb,
    '[]'::jsonb,
    200.00, 100.00, 0.00, 30.00, 70.00
),
(
    'WEB-02', 'Business Website', 'موقع شركة متكامل', 'business-website',
    'Professional 4-6 page business website with contact forms, CMS depending on scope, analytics and SEO.',
    'موقع شركة احترافي من 4 إلى 6 صفحات مع نماذج تفاعلية، لوحة تحكم، تحليلات وسيو.',
    '4–6 Pages with CMS, analytics & SEO.', '4 إلى 6 صفحات مع إدارة المحتوى وتحليلات.',
    (SELECT id FROM public.package_categories WHERE code = 'WEB'), 'Websites & Digital Systems',
    'digital', 'one_time', 1500.00, 'TND',
    true, true, false, 2, 2,
    true, '4-6 Pages Business Website',
    '[
        {"text": "4–6 Pages", "text_ar": "4 إلى 6 صفحات متكاملة", "order": 1},
        {"text": "Responsive Design", "text_ar": "تصميم متجاوب وسلس وفائق السرعة", "order": 2},
        {"text": "Contact Forms", "text_ar": "نماذج تواصل وطلبات عروض أسعار", "order": 3},
        {"text": "Basic CMS depending on scope", "text_ar": "لوحة تحكم حسب نطاق العمل", "order": 4},
        {"text": "Analytics Integration", "text_ar": "ربط أدوات التحليل (Google Analytics)", "order": 5},
        {"text": "Basic SEO", "text_ar": "تهيئة متقدمة لمحركات البحث (SEO)", "order": 6},
        {"text": "Deployment", "text_ar": "النشر والإطلاق الرقمي الرسمي", "order": 7}
    ]'::jsonb,
    '[]'::jsonb,
    450.00, 220.00, 0.00, 60.00, 150.00
),
(
    'WEB-03', 'Business System', 'منظومة أعمال رقمية', 'business-system',
    'Custom web platform with CMS, booking, orders, customer dashboard, database and third-party integrations.',
    'منصة رقمية مخصصة تشمل نظام حجوزات، إدارة طلبات، لوحة تحكم، وقاعدة بيانات متكاملة.',
    'Custom Platform: Booking, Dashboard & Integrations.', 'منظومة مخصصة: حجوزات، طلبات ولوحة تحكم.',
    (SELECT id FROM public.package_categories WHERE code = 'WEB'), 'Websites & Digital Systems',
    'digital', 'starting_from', 2500.00, 'TND',
    true, true, false, 3, 3,
    true, 'Custom Web Application / System',
    '[
        {"text": "Full Website & Custom Architecture", "text_ar": "موقع إلكتروني وبنية برمجية مخصصة", "order": 1},
        {"text": "Custom CMS", "text_ar": "لوحة تحكم مخصصة لإدارة المحتوى", "order": 2},
        {"text": "Online Booking System", "text_ar": "نظام حجز إلكتروني متكامل", "order": 3},
        {"text": "Orders Management", "text_ar": "نظام إدارة ومتابعة الطلبات", "order": 4},
        {"text": "Client / Admin Dashboard", "text_ar": "لوحة تحكم للمستخدمين والإدارة", "order": 5},
        {"text": "Database Architecture", "text_ar": "قاعدة بيانات سحابية آمنة", "order": 6},
        {"text": "API & Payment Integrations", "text_ar": "ربط بوابات الدفع والـ APIs الخارجية", "order": 7}
    ]'::jsonb,
    '[]'::jsonb,
    750.00, 400.00, 0.00, 100.00, 250.00
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    name_ar = EXCLUDED.name_ar,
    price = EXCLUDED.price,
    billing_type = EXCLUDED.billing_type,
    included_items = EXCLUDED.included_items,
    display_order = EXCLUDED.display_order,
    is_published = EXCLUDED.is_published,
    is_active = EXCLUDED.is_active;

-- CATEGORY 06: STRATEGY
INSERT INTO public.package_catalog (
    code, name, name_ar, slug, description, description_ar, short_description, short_description_ar,
    category_id, category_name, package_type, billing_type, price, currency,
    is_active, is_published, is_featured, priority, display_order,
    has_strategy,
    included_items, excluded_items,
    employee_cost, freelancer_cost, transport_cost, subscription_allocation, commission
) VALUES
(
    'STG-01', 'Content Strategy', 'استراتيجية المحتوى', 'content-strategy',
    'Brand content audit, audience definition, content pillars, creative ideas, monthly direction and competitor overview.',
    'تدقيق شامل لمحتوى العلامة، تحديد الفئات المستهدفة، ركائز المحتوى، وأفكار إبداعية شهرية.',
    'Brand Content Audit, Pillars & Competitor Overview.', 'تدقيق المحتوى، ركائز النشر والمنافسين.',
    (SELECT id FROM public.package_categories WHERE code = 'STRATEGY'), 'Strategy',
    'standard', 'one_time', 300.00, 'TND',
    true, true, false, 1, 1,
    true,
    '[
        {"text": "Brand Content Audit", "text_ar": "تدقيق شامل لمحتوى وحسابات العلامة", "order": 1},
        {"text": "Audience Definition", "text_ar": "تحديد وبناء شخصية الجمهور المستهدف", "order": 2},
        {"text": "Content Pillars", "text_ar": "تحديد ركائز ومسارات المحتوى الرئيسية", "order": 3},
        {"text": "Creative Content Ideas", "text_ar": "بنك أفكار تسويقية مبتكرة", "order": 4},
        {"text": "Monthly Direction", "text_ar": "التوجه الاستراتيجي الشهري", "order": 5},
        {"text": "Competitor Overview", "text_ar": "نظرة تحليلية على المنافسين", "order": 6}
    ]'::jsonb,
    '[]'::jsonb,
    100.00, 40.00, 0.00, 20.00, 30.00
),
(
    'STG-02', 'Marketing Strategy', 'استراتيجية تسويقية شاملة', 'marketing-strategy',
    'Market analysis, target audience, brand positioning, campaign concepts, marketing roadmap and actionable KPIs.',
    'تحليل السوق، التموضع التجاري، مفاهيم الحملات الكبرى، خارطة الطريق التسويقية وتحديد مؤشرات الأداء.',
    'Market Analysis, Positioning & Marketing Roadmap.', 'تحليل السوق، التموضع وخارطة الطريق.',
    (SELECT id FROM public.package_categories WHERE code = 'STRATEGY'), 'Strategy',
    'standard', 'one_time', 500.00, 'TND',
    true, true, false, 2, 2,
    true,
    '[
        {"text": "Market Analysis", "text_ar": "تحليل عميق لحجم وتحديات السوق", "order": 1},
        {"text": "Target Audience Profiling", "text_ar": "توصيف دقيق لشرائح العملاء الأكثر ربحية", "order": 2},
        {"text": "Brand Positioning", "text_ar": "استراتيجية التموضع وصوت العلامة", "order": 3},
        {"text": "Content Strategy", "text_ar": "استراتيجية المحتوى والتوزيع", "order": 4},
        {"text": "Campaign Ideas", "text_ar": "أفكار حملات إعلانية إبداعية", "order": 5},
        {"text": "Marketing Roadmap", "text_ar": "خارطة طريق تسويقية تنفيذية لعدة أشهر", "order": 6},
        {"text": "Actionable KPIs", "text_ar": "مؤشرات أداء واضحة وقابلة للقياس (KPIs)", "order": 7}
    ]'::jsonb,
    '[]'::jsonb,
    160.00, 70.00, 0.00, 30.00, 50.00
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    name_ar = EXCLUDED.name_ar,
    price = EXCLUDED.price,
    included_items = EXCLUDED.included_items,
    display_order = EXCLUDED.display_order,
    is_published = EXCLUDED.is_published,
    is_active = EXCLUDED.is_active;

-- CATEGORY 07: MONTHLY COMBINED PACKAGES (Production + Management + Ads)
INSERT INTO public.package_catalog (
    code, name, name_ar, slug, description, description_ar, short_description, short_description_ar,
    category_id, category_name, package_type, billing_type, price, currency,
    is_active, is_published, is_featured, badge, badge_ar, priority, display_order,
    monthly_reels, monthly_posts, monthly_stories, production_hours, production_sessions,
    has_ads_management, has_website, has_strategy, has_community_management, website_scope,
    included_items, excluded_items,
    employee_cost, freelancer_cost, transport_cost, subscription_allocation, commission
) VALUES
(
    'HY-01', 'Growth Produce', 'جروث بروديوس', 'growth-produce',
    'Essential combined package: 1 production session (4h), 4 reels, 4 posts, stories, publishing and community management.',
    'باقة مشتركة تجمع بين جلسة تصوير شهرياً (4 س)، 4 ريلز، 4 منشورات، إدارة النشر والمجتمع.',
    '1 Session (4h) + 4 Reels + SMM.', 'جلسة تصوير (4 س) + 4 ريلز + إدارة.',
    (SELECT id FROM public.package_categories WHERE code = 'COMBINED'), 'Monthly Combined Packages',
    'hybrid', 'monthly', 1490.00, 'TND',
    true, true, false, NULL, NULL, 1, 1,
    4, 4, 'Stories', 4.0, 1,
    false, false, false, true, NULL,
    '[
        {"text": "1 Content Session — up to 4 hours", "text_ar": "جلسة تصوير واحدة — حتى 4 ساعات", "order": 1},
        {"text": "4 Reels", "text_ar": "4 ريلز مصورة وممنتجة", "order": 2},
        {"text": "Photos & Story Assets", "text_ar": "صور ومقاطع مخصصة للستوري", "order": 3},
        {"text": "4 Posts / Graphics", "text_ar": "4 منشورات وتصاميم", "order": 4},
        {"text": "Stories", "text_ar": "نشر ومتابعة الستوري", "order": 5},
        {"text": "Content Planning", "text_ar": "تخطيط وجدولة المحتوى", "order": 6},
        {"text": "Copywriting", "text_ar": "كتابة النصوص التسويقية", "order": 7},
        {"text": "Publishing", "text_ar": "النشر الاحترافي", "order": 8},
        {"text": "Community Management", "text_ar": "إدارة التفاعل والردود", "order": 9}
    ]'::jsonb,
    '[
        {"text": "Ads Management", "text_ar": "إدارة الإعلانات الممولة", "order": 1},
        {"text": "Sponsoring / Ad Budget", "text_ar": "ميزانية الإعلانات الممولة", "order": 2}
    ]'::jsonb,
    400.00, 200.00, 60.00, 50.00, 149.00
),
(
    'HY-02', 'Growth+ Produce', 'جروث بلس بروديوس', 'growth-plus-produce',
    'High-impact growth engine: 1 long session (6h), 6 reels, 25 photos, 8 posts, Meta Ads management and monthly reports.',
    'محرك نمو قوي يجمع بين جلسة تصوير ممتدة (6 س)، 6 ريلز، 25 صورة، 8 منشورات وإدارة إعلانات ميتا.',
    '6h Shoot + 6 Reels + 8 Posts + Meta Ads.', 'تصوير 6 س + 6 ريلز + 8 منشورات + إعلانات.',
    (SELECT id FROM public.package_categories WHERE code = 'COMBINED'), 'Monthly Combined Packages',
    'hybrid', 'monthly', 1790.00, 'TND',
    true, true, true, 'most_popular', 'الأكثر طلباً', 2, 2,
    6, 8, 'Weekly Stories', 6.0, 1,
    true, false, false, true, NULL,
    '[
        {"text": "1 Long Production Session — up to 6 hours", "text_ar": "جلسة تصوير ممتدة — حتى 6 ساعات", "order": 1},
        {"text": "6 Reels", "text_ar": "6 ريلز سينمائية مصورة وممنتجة", "order": 2},
        {"text": "25 Photos", "text_ar": "25 صورة احترافية معدلة", "order": 3},
        {"text": "Story Content", "text_ar": "محتوى ستوري حصري", "order": 4},
        {"text": "8 Posts", "text_ar": "8 منشورات وتصاميم متميزة", "order": 5},
        {"text": "Weekly Stories", "text_ar": "ستوريز أسبوعية منتظمة", "order": 6},
        {"text": "Copywriting", "text_ar": "كتابة النصوص التسويقية", "order": 7},
        {"text": "Publishing", "text_ar": "النشر الاحترافي", "order": 8},
        {"text": "Community Management", "text_ar": "إدارة المجتمع والتفاعل", "order": 9},
        {"text": "Monthly Report", "text_ar": "تقرير أداء شهري تفصيلي", "order": 10},
        {"text": "Meta Ads Management", "text_ar": "إدارة حملات إعلانات ميتا الممولة", "order": 11}
    ]'::jsonb,
    '[
        {"text": "Sponsoring / Ad Budget", "text_ar": "ميزانية الإعلانات الممولة", "order": 1}
    ]'::jsonb,
    500.00, 250.00, 80.00, 60.00, 179.00
),
(
    'HY-03', 'Scale Produce', 'سكيل بروديوس', 'scale-produce',
    'Flagship production & social engine: 1 full day (8h), 8 reels, 30 photos, 8 posts, analytics and Meta Ads.',
    'يوم تصوير كامل شهرياً (8 س)، 8 ريلز، 30 صورة، 8 منشورات، إدارة إعلانات ميتا وتحليلات أداء.',
    'Full Day (8h) + 8 Reels + 8 Posts + Ads.', 'يوم كامل 8 س + 8 ريلز + 8 منشورات + إعلانات.',
    (SELECT id FROM public.package_categories WHERE code = 'COMBINED'), 'Monthly Combined Packages',
    'hybrid', 'monthly', 2190.00, 'TND',
    true, true, false, NULL, NULL, 3, 3,
    8, 8, 'Stories', 8.0, 1,
    true, false, false, true, NULL,
    '[
        {"text": "1 Full Production Day — up to 8h (or 2×4h)", "text_ar": "يوم تصوير كامل — حتى 8 س (أو جلستان 4+4 س)", "order": 1},
        {"text": "8 Reels", "text_ar": "8 ريلز احترافية مصورة وممنتجة", "order": 2},
        {"text": "30 Photos", "text_ar": "30 صورة فوتوغرافية متميزة", "order": 3},
        {"text": "Story Assets", "text_ar": "حزمة مقاطع للستوري", "order": 4},
        {"text": "8 Posts", "text_ar": "8 منشورات وتصاميم", "order": 5},
        {"text": "Stories", "text_ar": "نشر ومتابعة الستوري", "order": 6},
        {"text": "Content Planning", "text_ar": "تخطيط وجدولة المحتوى", "order": 7},
        {"text": "Copywriting", "text_ar": "كتابة النصوص التسويقية", "order": 8},
        {"text": "Publishing", "text_ar": "النشر الاحترافي", "order": 9},
        {"text": "Community Management", "text_ar": "إدارة المجتمع والردود", "order": 10},
        {"text": "Analytics", "text_ar": "تحليلات الأداء الشاملة", "order": 11},
        {"text": "Meta Ads Management", "text_ar": "إدارة إعلانات ميتا الممولة", "order": 12}
    ]'::jsonb,
    '[
        {"text": "Sponsoring / Ad Budget", "text_ar": "ميزانية الإعلانات الممولة", "order": 1}
    ]'::jsonb,
    600.00, 300.00, 100.00, 80.00, 219.00
),
(
    'HY-04', 'Premium', 'باقة التميز', 'premium',
    'Complete full-service agency partnership: Full day shoot, 8 reels, full SMM, strategy, ads and website updates.',
    'شراكة وكالة شاملة: يوم تصوير كامل، 8 ريلز، إدارة تواصل كاملة، استراتيجية، إعلانات وإدارة الموقع.',
    'Turnkey Partnership: Shoot + SMM + Ads + Web.', 'شراكة كاملة: تصوير + سوشيال + إعلانات + موقع.',
    (SELECT id FROM public.package_categories WHERE code = 'COMBINED'), 'Monthly Combined Packages',
    'hybrid', 'monthly', 2490.00, 'TND',
    true, true, true, 'best_value', 'أفضل قيمة', 4, 4,
    8, 8, 'Stories', 8.0, 1,
    true, true, true, true, 'Website Management & Updates',
    '[
        {"text": "1 Full Production Day — up to 8 hours", "text_ar": "يوم تصوير كامل — حتى 8 ساعات", "order": 1},
        {"text": "8 Reels", "text_ar": "8 ريلز سينمائية كاملة المونتاج", "order": 2},
        {"text": "30+ Photos", "text_ar": "أكثر من 30 صورة احترافية معدلة", "order": 3},
        {"text": "Story Content", "text_ar": "محتوى ستوري حصري ومستمر", "order": 4},
        {"text": "8 Posts", "text_ar": "8 منشورات وتصاميم متقدمة", "order": 5},
        {"text": "Stories", "text_ar": "نشر وتفاعل مستمر بالستوري", "order": 6},
        {"text": "Full Social Media Management", "text_ar": "إدارة متكاملة لجميع المنصات", "order": 7},
        {"text": "Copywriting", "text_ar": "كتابة نصوص تسويقية استثنائية", "order": 8},
        {"text": "Content Strategy", "text_ar": "استراتيجية محتوى متجددة شهرياً", "order": 9},
        {"text": "Community Management", "text_ar": "إدارة التفاعل ورعاية العملاء", "order": 10},
        {"text": "Monthly Report", "text_ar": "تقرير أداء وعائد شهري تفصيلي", "order": 11},
        {"text": "Meta Ads Management", "text_ar": "إدارة حملات إعلانات ميتا الممولة", "order": 12},
        {"text": "Website Management & Updates", "text_ar": "إدارة الموقع وتحديثات دورية", "order": 13},
        {"text": "Basic SEO Monitoring", "text_ar": "مراقبة مستمرة للأرشفة والسيو", "order": 14}
    ]'::jsonb,
    '[
        {"text": "Sponsoring / Ad Budget", "text_ar": "ميزانية الإعلانات الممولة", "order": 1},
        {"text": "New website development", "text_ar": "برمجة موقع جديد كلياً", "order": 2},
        {"text": "Major custom web applications", "text_ar": "تطوير تطبيقات ومنظومات كبرى مخصصة", "order": 3}
    ]'::jsonb,
    700.00, 350.00, 100.00, 100.00, 249.00
),
(
    'HY-05', 'Premium Plus', 'باقة التميز بلس', 'premium-plus',
    'Premium pack PLUS a complete new Business Website included (Core Pages, Responsive, SEO, Deployment).',
    'باقة التميز الكاملة بالإضافة إلى برمجة وتدشين موقع شركة رسمي جديد متكامل.',
    'Premium + Complete Business Website.', 'باقة التميز + موقع شركة متكامل.',
    (SELECT id FROM public.package_categories WHERE code = 'COMBINED'), 'Monthly Combined Packages',
    'hybrid', 'monthly', 2890.00, 'TND',
    true, true, true, 'recommended', 'شامل وموصى به', 5, 5,
    8, 8, 'Stories', 8.0, 1,
    true, true, true, true, 'Defined-scope Business Website',
    '[
        {"text": "Everything in PREMIUM Pack", "text_ar": "جميع مزايا باقة التميز كاملة", "order": 1},
        {"text": "Full Production Day — up to 8 hours", "text_ar": "يوم تصوير كامل — حتى 8 ساعات", "order": 2},
        {"text": "8 Reels & 30+ Photos", "text_ar": "8 ريلز وأكثر من 30 صورة", "order": 3},
        {"text": "8 Posts & Stories", "text_ar": "8 منشورات وتغطية ستوريز", "order": 4},
        {"text": "Full Social Media Management", "text_ar": "إدارة متكاملة لجميع المنصات", "order": 5},
        {"text": "Meta Ads Management", "text_ar": "إدارة إعلانات ميتا الممولة", "order": 6},
        {"text": "Complete Business Website Included", "text_ar": "تصميم وبرمجة موقع شركة رسمي متكامل", "order": 7},
        {"text": "Responsive Core Pages & CTA", "text_ar": "صفحات متجاوبة ونماذج تواصل وسيو", "order": 8},
        {"text": "Deployment & Ongoing Web Updates", "text_ar": "استضافة ونشر وإدارة مستمرة للموقع", "order": 9}
    ]'::jsonb,
    '[
        {"text": "Sponsoring / Ad Budget", "text_ar": "ميزانية الإعلانات الممولة", "order": 1},
        {"text": "E-commerce & complex booking systems", "text_ar": "المتاجر المعقدة ومنظومات الحجز الضخمة (تُسعر كباقة مستقلة)", "order": 2}
    ]'::jsonb,
    850.00, 420.00, 120.00, 120.00, 289.00
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    name_ar = EXCLUDED.name_ar,
    price = EXCLUDED.price,
    included_items = EXCLUDED.included_items,
    excluded_items = EXCLUDED.excluded_items,
    badge = EXCLUDED.badge,
    badge_ar = EXCLUDED.badge_ar,
    display_order = EXCLUDED.display_order,
    is_published = EXCLUDED.is_published,
    is_active = EXCLUDED.is_active;

-- CATEGORY 08: CUSTOM PACKAGE
INSERT INTO public.package_catalog (
    code, name, name_ar, slug, description, description_ar, short_description, short_description_ar,
    category_id, category_name, package_type, billing_type, price, currency,
    is_active, is_published, is_featured, priority, display_order,
    custom_pricing,
    included_items, excluded_items,
    employee_cost, freelancer_cost, transport_cost, subscription_allocation, commission
) VALUES
(
    'CUS-01', 'Build Your Package', 'صمم باقتك الخاصة', 'build-your-package',
    'Choose any tailored blend of Social Media, Content Production, Stories, Paid Ads, Website and Strategy.',
    'اختر توليفة مخصصة تماماً تجمع بين إدارة المحتوى، التصوير الميداني، الستوريز، الإعلانات والمواقع.',
    'Tailored blend built around your specific goals.', 'مزيج مخصص مبني بالكامل حول أهداف عملك.',
    (SELECT id FROM public.package_categories WHERE code = 'CUSTOM'), 'Custom Package',
    'custom', 'custom', 0.00, 'TND',
    true, true, false, 1, 1,
    true,
    '[
        {"text": "Social Media Management", "text_ar": "إدارة منصات التواصل", "order": 1},
        {"text": "Content Editing", "text_ar": "مونتاج المحتوى الرقمي", "order": 2},
        {"text": "Production & Shooting", "text_ar": "التصوير الميداني وجلسات الإنتاج", "order": 3},
        {"text": "Story Production", "text_ar": "إنتاج وتغطيات الستوري", "order": 4},
        {"text": "Paid Ads Management", "text_ar": "إدارة الحملات الإعلانية الممولة", "order": 5},
        {"text": "Website Development", "text_ar": "برمجة وتطوير المواقع", "order": 6},
        {"text": "Marketing Strategy", "text_ar": "الاستشارات والتخطيط الاستراتيجي", "order": 7},
        {"text": "Community Management", "text_ar": "إدارة المجتمع ورعاية العملاء", "order": 8}
    ]'::jsonb,
    '[]'::jsonb,
    0.00, 0.00, 0.00, 0.00, 0.00
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    name_ar = EXCLUDED.name_ar,
    billing_type = EXCLUDED.billing_type,
    custom_pricing = EXCLUDED.custom_pricing,
    included_items = EXCLUDED.included_items,
    display_order = EXCLUDED.display_order,
    is_published = EXCLUDED.is_published,
    is_active = EXCLUDED.is_active;

-- 13. SEED CANONICAL ADD-ONS
INSERT INTO public.package_addons (code, name, name_ar, price, unit, percentage_modifier, category, description, description_ar, display_order, is_active)
VALUES
('ADD-01', 'Extra Reel — Editing', 'ريل إضافي — مونتاج فقط', 80.00, 'item', NULL, 'content', 'Client provides raw footage; SADA delivers full cinematic edit and sound.', 'العميل يوفر المادة الخام، وصدى تقوم بالمونتاج الكامل وهندسة الصوت.', 1, true),
('ADD-02', 'Extra Reel — Full Production', 'ريل إضافي — إنتاج كامل', 150.00, 'item', NULL, 'production', 'Full on-site shooting, directed scenes, editing, color grading and delivery.', 'تصوير ميداني، إخراج المشهد، مونتاج، تلوين وتسليم نهائي.', 2, true),
('ADD-03', 'Extra Post', 'منشور إضافي', 35.00, 'item', NULL, 'content', 'Single post graphic design with custom copywriting.', 'تصميم جرافيك لمنشور فردي مع كتابة النص التسويقي.', 3, true),
('ADD-04', 'Extra Carousel', 'كاروسيل إضافي', 50.00, 'item', NULL, 'content', 'Multi-slide educational or promotional carousel design.', 'تصميم كاروسيل تفاعلي متعدد الشرائح لزيادة الحفظ والمشاركة.', 4, true),
('ADD-05', 'Extra Story Batch', 'حزمة ستوريز إضافية', 100.00, 'item', NULL, 'story', 'Batch of 5–10 designed or edited story assets.', 'حزمة من 5 إلى 10 ستوريز مصممة ومجهزة للنشر الفوري.', 5, true),
('ADD-06', 'Extra Shooting Hour', 'ساعة تصوير إضافية', 100.00, 'hour', NULL, 'production', 'Additional shooting hour on-site during a scheduled production day.', 'ساعة تصوير ميدانية إضافية ضمن جلسة عمل مجدولة.', 6, true),
('ADD-07', 'Extra Production Hour', 'ساعة إنتاج ومونتاج إضافية', 120.00, 'hour', NULL, 'production', 'Extra studio post-production, advanced VFX, 3D or grading.', 'ساعة مونتاج متقدم، مؤثرات بصرية خاصة أو معالجة دقيقة.', 7, true),
('ADD-08', 'Extra Story Visit', 'زيارة ستوري إضافية', 80.00, 'visit', NULL, 'story', 'Additional on-site visit for spontaneous event or promo coverage.', 'زيارة ميدانية إضافية لتغطية حدث طارئ أو عرض خاص.', 8, true),
('ADD-09', 'Extra Photography Session', 'جلسة تصوير فوتوغرافي إضافية', 250.00, 'session', NULL, 'production', 'Dedicated commercial photoshoot delivering 15 edited photos.', 'جلسة تصوير تجاري مخصصة مع تسليم 15 صورة معدلة.', 9, true),
('ADD-10', 'Express 48h Delivery', 'تسليم سريع خلال 48 ساعة', 0.00, 'percentage', 20.00, 'delivery', 'Expedited turnaround delivering final assets within 48 hours (+20%).', 'تسليم مستعجل لكافة المواد خلال 48 ساعة من التصوير (+20%).', 10, true),
('ADD-11', 'Express 24h Delivery', 'تسليم فوري فائق السرعة خلال 24 ساعة', 0.00, 'percentage', 40.00, 'delivery', 'Priority rapid turnaround delivering final assets within 24 hours (+40%).', 'تسليم بأولوية قصوى خلال 24 ساعة فقط (+40%).', 11, true),
('ADD-12', 'Extra Website Hour', 'ساعة تطوير ويب إضافية', 80.00, 'hour', NULL, 'web', 'Custom website maintenance, page additions or technical integration.', 'ساعة عمل برمجية لإجراء تعديلات، إضافات أو ربط تقني للموقع.', 12, true)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    name_ar = EXCLUDED.name_ar,
    price = EXCLUDED.price,
    unit = EXCLUDED.unit,
    percentage_modifier = EXCLUDED.percentage_modifier,
    description = EXCLUDED.description,
    description_ar = EXCLUDED.description_ar,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active;

