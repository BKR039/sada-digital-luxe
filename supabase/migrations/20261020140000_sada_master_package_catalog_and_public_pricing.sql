-- ============================================================
-- SADA OS — MASTER PACKAGE CATALOG & PUBLIC PRICING PLAN MIGRATION
-- Single Source of Truth for Internal Catalog, Add-ons & Public Proposals
-- Migration: 20261020140000_sada_master_package_catalog_and_public_pricing.sql
-- ============================================================

-- 1. EXTEND package_catalog SCHEMA IDEMPOTENTLY
ALTER TABLE public.package_catalog
    ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved'
        CHECK (approval_status IN ('approved', 'proposed', 'draft', 'needs_review')),
    ADD COLUMN IF NOT EXISTS proposed_price NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS billing_unit TEXT NOT NULL DEFAULT 'month',
    ADD COLUMN IF NOT EXISTS is_internal_only BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS source_page_ref TEXT,
    ADD COLUMN IF NOT EXISTS operational_notes TEXT,
    ADD COLUMN IF NOT EXISTS ad_budget_separate BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS cost_verification_status TEXT NOT NULL DEFAULT 'unverified'
        CHECK (cost_verification_status IN ('verified', 'unverified', 'needs_review')),
    ADD COLUMN IF NOT EXISTS recommendation_enabled BOOLEAN NOT NULL DEFAULT true;

-- 2. EXTEND package_addons SCHEMA IDEMPOTENTLY
ALTER TABLE public.package_addons
    ADD COLUMN IF NOT EXISTS source_page_ref TEXT,
    ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved'
        CHECK (approval_status IN ('approved', 'proposed', 'draft', 'needs_review'));

-- 3. HARDEN RLS ON package_catalog FOR PUBLIC & ANONYMOUS USERS
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public packages viewable" ON public.package_catalog;
    CREATE POLICY "Public packages viewable"
        ON public.package_catalog FOR SELECT
        USING (
            (is_active = true AND is_published = true AND is_internal_only = false AND approval_status = 'approved')
            OR (auth.role() = 'authenticated')
        );

    DROP POLICY IF EXISTS "Package catalog manageable by admins" ON public.package_catalog;
    CREATE POLICY "Package catalog manageable by admins"
        ON public.package_catalog FOR ALL TO authenticated
        USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
        WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));
END $$;

-- 4. UPSERT CANONICAL PACKAGE CATEGORIES
INSERT INTO public.package_categories (code, name, name_ar, slug, description, description_ar, display_order, priority, is_active)
VALUES
-- Internal Categories (Codes from Document Sections 01-08)
('SMM', 'Social Media Management', 'إدارة منصات التواصل الاجتماعي', 'social-media-management', 'Content planning, editing, copywriting, publishing and community management without shooting.', 'تخطيط المحتوى، المونتاج، كتابة الإعلانات، النشر وإدارة التفاعل بدون تصوير.', 1, 10, true),
('PRODUCTION', 'Content Production & Shooting', 'إنتاج وتصوير المحتوى', 'content-production-shooting', 'High-end visual production, shooting, editing, color grading and delivery.', 'جلسات تصوير احترافية، إخراج، مونتاج، تلوين وتسليم منظم للمواد الإعلانية.', 2, 9, true),
('STORY', 'Story Production', 'إنتاج الستوريز والتغطيات', 'story-production', 'Dedicated story shoots, visits and daily coverage for high-touch engagement.', 'زيارات وتغطيات دورية أو يومية لتوثيق الأنشطة والعروض والمنتجات.', 3, 8, true),
('ADS', 'Paid Ads Management', 'إدارة الإعلانات الممولة', 'paid-ads-management', 'Data-driven Meta and multi-platform paid acquisition architecture.', 'تخطيط، إطلاق، مراقبة وتحسين الحملات الإعلانية الممولة لتحقيق أعلى عائد.', 4, 7, true),
('WEB', 'Websites & Digital Systems', 'المواقع والمنظومات الرقمية', 'websites-digital-systems', 'High-performance digital flagship websites and custom digital engines.', 'مواقع هبوط، مواقع شركات، وتطبيقات ويب متكاملة مع لوحات تحكم.', 5, 6, true),
('STRATEGY', 'Strategy', 'الاستشارات والاستراتيجية', 'strategy', 'Deep brand, audience, and market positioning frameworks.', 'دراسة السوق والمنافسين، تحديد الجمهور المستهدف ورسم خارطة الطريق التسويقية.', 6, 5, true),
('COMBINED', 'Monthly Combined Packages', 'الباقات الشهرية المتكاملة', 'monthly-combined-packages', 'Full turnkey agency partnership: Production + Management + Ads.', 'شراكة إبداعية كاملة تجمع بين الإنتاج الميداني، إدارة المحتوى، والإعلانات.', 7, 10, true),
('CUSTOM', 'Custom Package', 'باقة مخصصة', 'custom-package', 'Tailored hybrid packages built to your exact operational specifications.', 'صمم باقتك بحرية تامة حسب متطلبات عملك ونطاق خدماتك المستهدفة.', 8, 4, true),
('ADDONS', 'Add-ons & Extras', 'الخدمات الإضافية والتوسعات', 'addons', 'Individual units, extra deliverables and express turnarounds.', 'وحدات إنتاج إضافية، تسليم سريع وتعديلات فورية حسب الطلب.', 9, 3, true),

-- Proposed Public Categories (Section 11)
('PUB-MONTHLY', 'Monthly Subscription', 'اشتراكات شهرية', 'public-monthly-subscription', 'Monthly managed content and marketing retainers with explicit scopes and quotas.', 'اشتراكات شهرية متكاملة لإدارة المحتوى والنمو مع مخرجات محددة بدقة.', 10, 10, true),
('PUB-ONDEMAND', 'Service On Demand', 'خدمات إنتاج عند الطلب', 'public-service-on-demand', 'One-time creative production and content shooting sessions without long-term contracts.', 'جلسات إنتاج وتصوير سينمائي مستقلة تسلم لك كاملة دون الحاجة لالتزام شهري.', 11, 9, true),
('PUB-INDIVIDUAL', 'Individual Services', 'خدمات فردية متخصصة', 'public-individual-services', 'Single specialized services purchased per asset, per month, or per project.', 'خدمات نوعية مستقلة تباع بالقطعة أو بالشهر لتلبية احتياجات تسويقية محددة.', 12, 8, true)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    name_ar = EXCLUDED.name_ar,
    slug = EXCLUDED.slug,
    description = EXCLUDED.description,
    description_ar = EXCLUDED.description_ar,
    display_order = EXCLUDED.display_order,
    priority = EXCLUDED.priority,
    is_active = EXCLUDED.is_active;

-- 5. UPSERT THE 12 CANONICAL ADD-ONS (Section 09)
INSERT INTO public.package_addons (code, name, name_ar, price, unit, percentage_modifier, category, description, description_ar, is_active, display_order, source_page_ref, approval_status)
VALUES
('ADD-01', 'Extra Reel — Editing', 'مونتاج ريل إضافي', 80.00, 'reel', NULL, 'video', 'Editing of one client-supplied Reel using supplied footage, color correction, sound, and captions.', 'مونتاج فيديو ريل إضافي من مواد يوفرها الحريف مع تلوين وهندسة صوت ونصوص.', true, 1, 'Section 09, Page 14', 'approved'),
('ADD-02', 'Extra Reel — Full Production', 'إنتاج وتصوير ريل كامل', 150.00, 'reel', NULL, 'production', 'Full creative production of one Reel including on-location filming, editing, color grading, sound design, and captions.', 'إنتاج وتصوير كامل لريل إضافي يشمل التصوير الميداني والمونتاج والتلوين والصوت.', true, 2, 'Section 09, Page 14', 'approved'),
('ADD-03', 'Extra Post', 'تصميم بوست إضافي', 35.00, 'post', NULL, 'design', 'Design of one static post with branding, layout, and copywriting.', 'تصميم منشور ثابت إضافي مع مراعاة الهوية البصرية والنصوص الإعلانية.', true, 3, 'Section 09, Page 14', 'approved'),
('ADD-04', 'Extra Carousel', 'تصميم كاروسيل إضافي', 50.00, 'carousel', NULL, 'design', 'Design of a multi-slide carousel post (up to 6 slides) with narrative flow and copywriting.', 'تصميم منشور دائري متعدد الشرائح (حتى 6 شرائح) بتسلسل بصري وإعلاني مميز.', true, 4, 'Section 09, Page 14', 'approved'),
('ADD-05', 'Extra Story Batch', 'دفعة ستوريز إضافية', 100.00, 'batch', NULL, 'story', 'Batch creation and formatting of 10–15 engaging story clips.', 'تصميم وتجهيز دفعة ستوريز إضافية (10 إلى 15 ستوري) جاهزة للنشر والتفاعل.', true, 5, 'Section 09, Page 14', 'approved'),
('ADD-06', 'Extra Shooting Hour', 'ساعة تصوير إضافية', 100.00, 'hour', NULL, 'production', 'One additional hour of on-location shooting by SADA camera crew.', 'ساعة تصوير ميدانية إضافية مع فريق تصوير ومعدات صدى.', true, 6, 'Section 09, Page 14', 'approved'),
('ADD-07', 'Extra Production Hour', 'ساعة إنتاج إضافية', 120.00, 'hour', NULL, 'production', 'One additional hour of comprehensive production including creative direction and lighting setup.', 'ساعة إنتاج إضافية تشمل الإخراج الفني وضبط الإضاءة والمعدات السينمائية.', true, 7, 'Section 09, Page 14', 'approved'),
('ADD-08', 'Extra Story Visit', 'زيارة ستوري إضافية', 80.00, 'visit', NULL, 'story', 'One additional on-site story visit (up to 1 hour) for daily content capture.', 'زيارة تصوير وتغطية ستوري إضافية في مقر الحريف (حتى ساعة واحدة).', true, 8, 'Section 09, Page 14', 'approved'),
('ADD-09', 'Extra Photography Session', 'جلسة تصوير فوتوغرافي إضافية', 250.00, 'session', NULL, 'photography', 'Dedicated professional photography session with high-resolution photo delivery.', 'جلسة تصوير فوتوغرافي متخصصة للمنتجات أو الأماكن مع تسليم صور معالجة عالية الدقة.', true, 9, 'Section 09, Page 14', 'approved'),
('ADD-10', 'Express 48h', 'تسليم سريع خلال 48 ساعة', 0.00, 'modifier', 20.00, 'turnaround', 'Accelerated turnaround delivery within 48 business hours (+20% surcharge).', 'تسريع تسليم مخرجات الإنتاج أو المونتاج خلال 48 ساعة عمل (+20% رسوم إضافية).', true, 10, 'Section 09, Page 14', 'approved'),
('ADD-11', 'Express 24h', 'تسليم عاجل خلال 24 ساعة', 0.00, 'modifier', 40.00, 'turnaround', 'Priority urgent turnaround delivery within 24 business hours (+40% surcharge).', 'تسليم فائق السرعة ذو أولوية قصوى خلال 24 ساعة عمل (+40% رسوم إضافية).', true, 11, 'Section 09, Page 14', 'approved'),
('ADD-12', 'Extra Website Hour', 'ساعة تطوير ودعم موقع إضافية', 80.00, 'hour', NULL, 'web', 'One hour of specialized website design, web engineering, or CMS maintenance.', 'ساعة عمل هندسية أو برمجية إضافية لصيانة أو تطوير الموقع الرقمي.', true, 12, 'Section 09, Page 14', 'approved')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    name_ar = EXCLUDED.name_ar,
    price = EXCLUDED.price,
    unit = EXCLUDED.unit,
    percentage_modifier = EXCLUDED.percentage_modifier,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    description_ar = EXCLUDED.description_ar,
    is_active = EXCLUDED.is_active,
    display_order = EXCLUDED.display_order,
    source_page_ref = EXCLUDED.source_page_ref,
    approval_status = EXCLUDED.approval_status;

-- 6. UPSERT THE 26 INTERNAL MASTER CATALOG PACKAGES (Sections 01-08)
-- Helper: resolve category IDs safely via subqueries

-- 01 — SOCIAL MEDIA MANAGEMENT
INSERT INTO public.package_catalog (
    code, name, name_ar, slug, description, description_ar, category_id, category_name,
    package_type, billing_type, billing_unit, price, currency, is_active, is_published, is_internal_only,
    approval_status, cost_verification_status, source_page_ref, display_order, priority,
    monthly_reels, monthly_posts, monthly_stories, production_hours, production_sessions,
    platforms, has_ads_management, has_website, has_strategy, has_community_management,
    included_items, excluded_items, operational_notes
) VALUES
(
    'MG-01', 'Starter', 'البداية', 'sada-smm-starter',
    'Essential monthly social media management: 4 Reels, 4 Posts/Carousels, 8 Stories, content calendar, and publishing without SADA shooting.',
    'إدارة شهرية أساسية لمنصات التواصل: 4 ريلز، 4 منشورات، 8 ستوريز، وتخطيط ونشر دون تصوير من صدى.',
    (SELECT id FROM public.package_categories WHERE code = 'SMM'), 'Social Media Management',
    'standard', 'monthly', 'month', 699.00, 'TND', true, false, true,
    'approved', 'unverified', 'Section 01, Page 2', 1, 10,
    4, 4, '8 Stories / month', 0, 0,
    ARRAY['instagram', 'facebook'], false, false, false, true,
    '[{"text":"4 Reels / month"},{"text":"4 Posts or Carousels / month"},{"text":"8 Stories / month"},{"text":"Instagram + Facebook"},{"text":"Content Planning"},{"text":"Scheduling / Publishing"},{"text":"Basic Community Management"},{"text":"Content Calendar"}]'::jsonb,
    '[{"text":"Photography / Videography"},{"text":"Production sessions"},{"text":"Ads Management"},{"text":"Sponsoring / Ad Budget"},{"text":"Daily Story Production"},{"text":"Website Development"}]'::jsonb,
    'Client supplies raw content/assets; SADA handles editing, publishing, and community work. No SADA shooting.'
),
(
    'MG-02', 'Growth', 'النمو', 'sada-smm-growth',
    'Complete monthly organic growth retainer: 8 Reels, 8 Posts, weekly Stories, copywriting, performance reporting, and community management.',
    'باقة نمو شهرية متكاملة: 8 ريلز، 8 منشورات، ستوريز أسبوعية، كتابة نصوص، تقارير شهرية وإدارة التفاعل.',
    (SELECT id FROM public.package_categories WHERE code = 'SMM'), 'Social Media Management',
    'standard', 'monthly', 'month', 1090.00, 'TND', true, false, true,
    'approved', 'unverified', 'Section 01, Page 2', 2, 9,
    8, 8, 'Weekly Stories', 0, 0,
    ARRAY['instagram', 'facebook'], false, false, false, true,
    '[{"text":"8 Reels / month"},{"text":"8 Posts / Carousels / month"},{"text":"Weekly Stories"},{"text":"Content Repurposing"},{"text":"Instagram + Facebook"},{"text":"Content Planning"},{"text":"Copywriting"},{"text":"Publishing"},{"text":"Community Management"},{"text":"Monthly Performance Report"},{"text":"Marketing Ideas"}]'::jsonb,
    '[{"text":"Photography / Videography"},{"text":"Production sessions"},{"text":"Ads Management"},{"text":"Sponsoring / Ad Budget"},{"text":"Daily Story Production"}]'::jsonb,
    'Client supplies raw content/assets. Monthly reporting and marketing ideas included.'
),
(
    'MG-03', 'Growth+', 'النمو بلس', 'sada-smm-growth-plus',
    'Advanced monthly organic + paid management: 8 Reels, 8 Posts, weekly Stories, strategy, community management, and Meta Ads Management.',
    'باقة نمو متقدمة تجمع بين إدارة المحتوى وإعلانات ميتا: 8 ريلز، 8 منشورات، استراتيجية تسويقية وإدارة حملات ممولة.',
    (SELECT id FROM public.package_categories WHERE code = 'SMM'), 'Social Media Management',
    'standard', 'monthly', 'month', 1290.00, 'TND', true, false, true,
    'approved', 'unverified', 'Section 01, Page 3', 3, 8,
    8, 8, 'Weekly Stories', 0, 0,
    ARRAY['instagram', 'facebook'], true, false, true, true,
    '[{"text":"8 Reels"},{"text":"8 Posts / Carousels"},{"text":"Weekly Stories"},{"text":"Instagram + Facebook"},{"text":"Content Planning"},{"text":"Copywriting"},{"text":"Publishing"},{"text":"Community Management"},{"text":"Monthly Report"},{"text":"Marketing Strategy / Ideas"},{"text":"Meta Ads Management"}]'::jsonb,
    '[{"text":"Photography / Videography"},{"text":"Production sessions"},{"text":"Sponsoring / Ad Budget"}]'::jsonb,
    'Includes Meta Ads Management. Ad budget is 100% separate and paid directly by client.'
),
(
    'MG-04', 'Scale', 'التوسع', 'sada-smm-scale',
    'High-volume multi-platform management across Instagram, Facebook, and TikTok: 12 Reels, 8 Posts, analytics, strategy, and Meta Ads.',
    'إدارة واسعة النطاق عبر 3 منصات (إنستغرام، فيسبوك، تيك توك): 12 ريلز، 8 منشورات، تحليلات شهرية وإعلانات ممولة.',
    (SELECT id FROM public.package_categories WHERE code = 'SMM'), 'Social Media Management',
    'standard', 'monthly', 'month', 1590.00, 'TND', true, false, true,
    'approved', 'unverified', 'Section 01, Page 3', 4, 7,
    12, 8, 'Weekly Stories', 0, 0,
    ARRAY['instagram', 'facebook', 'tiktok'], true, false, true, true,
    '[{"text":"12 Reels"},{"text":"8 Posts / Carousels"},{"text":"Weekly Stories"},{"text":"Content Repurposing"},{"text":"Instagram + Facebook + TikTok"},{"text":"Content Planning"},{"text":"Copywriting"},{"text":"Publishing"},{"text":"Community Management"},{"text":"Monthly Analytics"},{"text":"Strategy"},{"text":"Meta Ads Management"}]'::jsonb,
    '[{"text":"Photography / Videography"},{"text":"Production sessions"},{"text":"Sponsoring / Ad Budget"}]'::jsonb,
    'Multi-platform coverage. Sponsoring budget separate.'
),

-- 02 — CONTENT PRODUCTION & SHOOTING
(
    'PR-01', 'Content Session', 'جلسة محتوى', 'sada-prod-session',
    'On-location production session up to 4 hours: 3 Reels, 10–15 Photos, story clips, editing, color, sound, and captions.',
    'جلسة تصوير ميدانية حتى 4 ساعات: 3 ريلز، 10 إلى 15 صورة، مقاطع ستوري، مونتاج وتلوين وصوت.',
    (SELECT id FROM public.package_categories WHERE code = 'PRODUCTION'), 'Content Production & Shooting',
    'production', 'one_time', 'session', 550.00, 'TND', true, false, true,
    'approved', 'unverified', 'Section 02, Page 4', 5, 10,
    3, 15, 'Story Clips', 4, 1,
    ARRAY['instagram', 'facebook'], false, false, false, false,
    '[{"text":"1 production session — up to 4 hours"},{"text":"Video + Photography"},{"text":"3 Reels"},{"text":"10–15 Photos"},{"text":"Story Clips"},{"text":"Reel Editing"},{"text":"Color Correction"},{"text":"Sound"},{"text":"Basic Captions"}]'::jsonb,
    '[{"text":"Social Media Management"},{"text":"Publishing"},{"text":"Ads Management"},{"text":"Sponsoring / Ad Budget"},{"text":"Daily Stories"}]'::jsonb,
    'Unit: 1 session up to 4 hours. Deliverables handed over for client publishing.'
),
(
    'PR-02', 'Content Session Pro', 'جلسة محتوى احترافية', 'sada-prod-session-pro',
    'Extended creative production session up to 4 hours: 5 Reels, 20 Photos, story content, creative direction, shot planning, and color grading.',
    'جلسة إنتاج إبداعية حتى 4 ساعات مع توجيه فني وتخطيط لقطات: 5 ريلز، 20 صورة، تلوين سينمائي وتصميم صوت.',
    (SELECT id FROM public.package_categories WHERE code = 'PRODUCTION'), 'Content Production & Shooting',
    'production', 'one_time', 'session', 750.00, 'TND', true, false, true,
    'approved', 'unverified', 'Section 02, Page 4', 6, 9,
    5, 20, 'Story Content', 4, 1,
    ARRAY['instagram', 'facebook'], false, false, true, false,
    '[{"text":"1 production session — up to 4 hours"},{"text":"5 Reels"},{"text":"20 Photos"},{"text":"Story Content"},{"text":"Creative Direction"},{"text":"Shot Planning"},{"text":"Videography + Photography"},{"text":"Editing"},{"text":"Color Grading"},{"text":"Sound Design"},{"text":"Captions"}]'::jsonb,
    '[{"text":"Social Media Management"},{"text":"Publishing"},{"text":"Ads Management"},{"text":"Sponsoring / Ad Budget"}]'::jsonb,
    'Includes creative direction and shot planning.'
),
(
    'PR-03', 'Long Production Day', 'يوم إنتاج ممتد', 'sada-prod-long-day',
    'Single-day extended production up to 6 hours: 6 Reels, 25 Photos, story assets, creative direction, editing, and organized raw footage.',
    'يوم تصوير ممتد حتى 6 ساعات: 6 ريلز، 25 صورة، توجيه إبداعي، مونتاج كامل وتنظيم للمواد الخام.',
    (SELECT id FROM public.package_categories WHERE code = 'PRODUCTION'), 'Content Production & Shooting',
    'production', 'one_time', 'session', 900.00, 'TND', true, false, true,
    'approved', 'unverified', 'Section 02, Page 5', 7, 8,
    6, 25, 'Story Assets', 6, 1,
    ARRAY['instagram', 'facebook'], false, false, true, false,
    '[{"text":"1 Long Session — up to 6 hours"},{"text":"6 Reels"},{"text":"25 Photos"},{"text":"Story Assets"},{"text":"Creative Direction"},{"text":"Videography"},{"text":"Photography"},{"text":"Editing"},{"text":"Color Correction"},{"text":"Sound"},{"text":"Captions"},{"text":"Raw Footage Organization"}]'::jsonb,
    '[{"text":"Social Media Management"},{"text":"Publishing"},{"text":"Ads Management"},{"text":"Sponsoring / Ad Budget"}]'::jsonb,
    'Unit: 1 Long Session up to 6 hours. Travel/logistics outside primary zone quoted separately.'
),
(
    'PR-04', 'Full Production Day', 'يوم إنتاج كامل', 'sada-prod-full-day',
    'Full production day up to 8 hours (or 2×4h sessions): 8 Reels, 30–40 Photos, story content, BTS, product/food setups, sound design, and covers.',
    'يوم إنتاج سينمائي متكامل حتى 8 ساعات: 8 ريلز، 30 إلى 40 صورة، كواليس، تصوير منتجات وديكورات متعددة.',
    (SELECT id FROM public.package_categories WHERE code = 'PRODUCTION'), 'Content Production & Shooting',
    'production', 'one_time', 'day', 1200.00, 'TND', true, false, true,
    'approved', 'unverified', 'Section 02, Page 5', 8, 7,
    8, 35, 'Story Content & BTS', 8, 1,
    ARRAY['instagram', 'facebook'], false, false, true, false,
    '[{"text":"1 Full Day — up to 8 hours (or 2×4h Sessions)"},{"text":"8 Reels"},{"text":"30–40 Photos"},{"text":"Story Content"},{"text":"Behind the Scenes"},{"text":"Creative Direction"},{"text":"Professional Shooting"},{"text":"Product / Food Shots"},{"text":"Multiple Setups"},{"text":"Full Editing"},{"text":"Color Grading"},{"text":"Sound Design"},{"text":"Captions"},{"text":"Covers"}]'::jsonb,
    '[{"text":"Social Media Management"},{"text":"Publishing"},{"text":"Ads Management"},{"text":"Sponsoring / Ad Budget"}]'::jsonb,
    'Can be delivered as 1×8h Full Day or 2×4h Sessions. Multiple shooting days may incur logistics fees.'
),

-- 03 — STORY PRODUCTION
(
    'ST-01', 'Story Batch', 'دفعة ستوريز', 'sada-story-batch',
    'One dedicated story session up to 2 hours: 15–25 Story Clips, basic editing, and organized file delivery.',
    'جلسة تصوير ستوري مركزة حتى ساعتين: 15 إلى 25 مقطع ستوري مع مونتاج وتسليم منظم.',
    (SELECT id FROM public.package_categories WHERE code = 'STORY'), 'Story Production',
    'standard', 'one_time', 'batch', 350.00, 'TND', true, false, true,
    'approved', 'unverified', 'Section 03, Page 6', 9, 10,
    0, 0, '15–25 Story Clips', 2, 1,
    ARRAY['instagram', 'facebook'], false, false, false, false,
    '[{"text":"1 session up to 2 hours"},{"text":"15–25 Story Clips"},{"text":"Basic Editing"},{"text":"Organized File Delivery"}]'::jsonb,
    '[{"text":"Publishing"},{"text":"Social Media Management"}]'::jsonb,
    'Story assets delivered for client publishing. Not unlimited.'
),
(
    'ST-02', 'Story Visits', 'زيارات ستوري', 'sada-story-visits',
    '8 story visits per month (approx 2/week, up to 1h/visit): coverage of daily activity, products, offers, BTS, and customer experience.',
    '8 زيارات تغطية ستوري شهرياً (زيارتان أسبوعياً، ساعة لكل زيارة): تغطية الأنشطة والمنتجات والعروض وتجارب الحرفاء.',
    (SELECT id FROM public.package_categories WHERE code = 'STORY'), 'Story Production',
    'standard', 'monthly', 'month', 600.00, 'TND', true, false, true,
    'approved', 'unverified', 'Section 03, Page 6', 10, 9,
    0, 0, '8 Visits (up to 1h/visit)', 8, 8,
    ARRAY['instagram', 'facebook'], false, false, false, false,
    '[{"text":"8 Visits / month"},{"text":"Approximately 2 Visits / week"},{"text":"Up to 1 hour / visit"},{"text":"Daily Activity Coverage"},{"text":"Products"},{"text":"Behind the Scenes"},{"text":"Offers"},{"text":"Customer Experience"},{"text":"Organized Raw Story Clips"}]'::jsonb,
    '[{"text":"Publishing"}]'::jsonb,
    'Visit limit strictly 8 visits/month, max 1h each. Client handles publishing.'
),
(
    'ST-03', 'Story Plus', 'ستوري بلس', 'sada-story-plus',
    '12 story visits per month (approx 3/week, up to 1h/visit): on-site shooting, basic story editing, content curation, and delivery.',
    '12 زيارة تغطية ستوري شهرياً (3 زيارات أسبوعياً): تصوير ميداني، مونتاج أساسي، وتجهيز المحتوى.',
    (SELECT id FROM public.package_categories WHERE code = 'STORY'), 'Story Production',
    'standard', 'monthly', 'month', 800.00, 'TND', true, false, true,
    'approved', 'unverified', 'Section 03, Page 6', 11, 8,
    0, 0, '12 Visits (up to 1h/visit)', 12, 12,
    ARRAY['instagram', 'facebook'], false, false, false, false,
    '[{"text":"12 Visits / month"},{"text":"Approximately 3 Visits / week"},{"text":"Up to 1 hour / visit"},{"text":"Story Shooting"},{"text":"Basic Story Editing"},{"text":"Content Selection"},{"text":"Organized Delivery"}]'::jsonb,
    '[{"text":"Publishing"}]'::jsonb,
    'Visit limit strictly 12 visits/month, max 1h each.'
),
(
    'ST-04', 'Daily Story', 'ستوري يومي', 'sada-daily-story',
    'Up to 20 story visits per month (approx 5/week, up to 1h/visit): daily moments, clips, basic editing, and organized file handoff.',
    'حتى 20 زيارة ستوري شهرياً (5 زيارات أسبوعياً، ساعة لكل زيارة): توثيق يومي ومونتاج خفيف وتسليم منظم.',
    (SELECT id FROM public.package_categories WHERE code = 'STORY'), 'Story Production',
    'standard', 'monthly', 'month', 1000.00, 'TND', true, false, true,
    'approved', 'unverified', 'Section 03, Page 7', 12, 7,
    0, 0, 'Up to 20 Visits (up to 1h/visit)', 20, 20,
    ARRAY['instagram', 'facebook'], false, false, false, false,
    '[{"text":"Up to 20 Visits / month"},{"text":"Approximately 5 Visits / week"},{"text":"Up to 1 hour / visit"},{"text":"Story Shooting"},{"text":"Moment Selection"},{"text":"Story Clips"},{"text":"Basic Editing"},{"text":"Content Organization"}]'::jsonb,
    '[{"text":"Copywriting"},{"text":"Full Social Media Management"},{"text":"Sponsoring / Ad Budget"}]'::jsonb,
    'Daily Stories are not unlimited: capped at 20 visits/month, up to 1h/visit.'
),
(
    'ST-05', 'Daily Story Pro', 'ستوري يومي احترافي', 'sada-daily-story-pro',
    'Up to 20 story visits per month (up to 1.5h/visit) including editing, publishing, copy/text, CTA, and daily story planning.',
    'حتى 20 زيارة ستوري شهرياً (1.5 ساعة لكل زيارة) تشمل التصوير والمونتاج والنشر المباشر وكتابة النصوص والـ CTA.',
    (SELECT id FROM public.package_categories WHERE code = 'STORY'), 'Story Production',
    'standard', 'monthly', 'month', 1300.00, 'TND', true, false, true,
    'approved', 'unverified', 'Section 03, Page 7', 13, 6,
    0, 0, 'Up to 20 Visits (up to 1.5h/visit) with Publishing', 30, 20,
    ARRAY['instagram', 'facebook'], false, false, false, true,
    '[{"text":"Up to 20 Visits / month"},{"text":"Up to 1.5 hours / visit"},{"text":"Story Shooting"},{"text":"Story Editing"},{"text":"Publishing"},{"text":"Copy / Text"},{"text":"CTA"},{"text":"Daily Story Planning"}]'::jsonb,
    '[{"text":"Sponsoring / Ad Budget"}]'::jsonb,
    'Includes direct publishing by SADA. Ad budget separate.'
),

-- 04 — PAID ADS MANAGEMENT
(
    'AD-01', 'Ads Basic', 'إعلانات أساسية', 'sada-ads-basic',
    'Entry Meta Ads management: account setup, campaign execution, basic monitoring, optimization, and monthly summary.',
    'إدارة إعلانات ميتا الأساسية: إعداد الحساب، إدارة الحملات، متابعة دورية، وتحسين النتائج مع ملخص شهري.',
    (SELECT id FROM public.package_categories WHERE code = 'ADS'), 'Paid Ads Management',
    'standard', 'monthly', 'month', 250.00, 'TND', true, false, true,
    'approved', 'unverified', 'Section 04, Page 8', 14, 10,
    0, 0, '', 0, 0,
    ARRAY['instagram', 'facebook'], true, false, false, false,
    '[{"text":"Meta Ads Setup"},{"text":"Campaign Management"},{"text":"Basic Monitoring"},{"text":"Basic Optimization"},{"text":"Monthly Summary"}]'::jsonb,
    '[{"text":"Advertising Budget / Sponsoring"}]'::jsonb,
    'Management fee only. Client pays ad spend directly to Meta.'
),
(
    'AD-02', 'Ads Pro', 'إعلانات متقدمة', 'sada-ads-pro',
    'Advanced multi-campaign acquisition: strategy, audience testing, creative testing, retargeting funnels, optimization, and detailed reporting.',
    'إدارة إعلانات احترافية متقدمة: استراتيجية حملات، اختبار جماهير وتصاميم، قمع إعادة استهداف، وتحليلات أداء شهرية.',
    (SELECT id FROM public.package_categories WHERE code = 'ADS'), 'Paid Ads Management',
    'standard', 'monthly', 'month', 400.00, 'TND', true, false, true,
    'approved', 'unverified', 'Section 04, Page 8', 15, 9,
    0, 0, '', 0, 0,
    ARRAY['instagram', 'facebook'], true, false, true, false,
    '[{"text":"Campaign Strategy"},{"text":"Multiple Campaigns"},{"text":"Audience Testing"},{"text":"Creative Testing"},{"text":"Optimization"},{"text":"Retargeting"},{"text":"Monthly Report"}]'::jsonb,
    '[{"text":"Advertising Budget / Sponsoring"}]'::jsonb,
    'Management fee only. Ad spend strictly prepaid before launch.'
),

-- 05 — WEBSITES & DIGITAL SYSTEMS
(
    'WEB-01', 'Landing Page', 'صفحة هبوط', 'sada-web-landing',
    'High-converting single-page digital flagship: responsive design, contact/lead capture, basic SEO, and cloud deployment.',
    'صفحة هبوط تحويلية واحدة فائقة السرعة: تصميم متجاوب، التقاط بيانات العملاء، سيو أساسي ونشر سحابي.',
    (SELECT id FROM public.package_categories WHERE code = 'WEB'), 'Websites & Digital Systems',
    'digital', 'one_time', 'project', 700.00, 'TND', true, false, true,
    'approved', 'unverified', 'Section 05, Page 9', 16, 10,
    0, 0, '', 0, 0,
    ARRAY[]::text[], false, true, false, false,
    '[{"text":"One-page Website"},{"text":"Responsive Design"},{"text":"Contact / CTA"},{"text":"Basic SEO"},{"text":"Deployment"}]'::jsonb,
    '[{"text":"Multi-page architecture"},{"text":"Custom CMS"},{"text":"E-commerce / Booking"}]'::jsonb,
    'Defined scope: 1 page. Domain and third-party hosting fees paid by client.'
),
(
    'WEB-02', 'Business Website', 'موقع تعريفي للشركات', 'sada-web-business',
    'Complete corporate website (4–6 pages): responsive layout, contact forms, basic CMS depending on scope, analytics, basic SEO, and deployment.',
    'موقع شركة احترافي متكامل من 4 إلى 6 صفحات: تصميم متجاوب، نماذج اتصال، لوحة تحكم بسيطة، تحليلات وسيو.',
    (SELECT id FROM public.package_categories WHERE code = 'WEB'), 'Websites & Digital Systems',
    'digital', 'one_time', 'project', 1500.00, 'TND', true, false, true,
    'approved', 'unverified', 'Section 05, Page 9', 17, 9,
    0, 0, '', 0, 0,
    ARRAY[]::text[], false, true, false, false,
    '[{"text":"4–6 Pages"},{"text":"Responsive Design"},{"text":"Contact Forms"},{"text":"Basic CMS depending on scope"},{"text":"Analytics"},{"text":"Basic SEO"},{"text":"Deployment"}]'::jsonb,
    '[{"text":"Complex E-commerce"},{"text":"Custom web applications"},{"text":"Complex integrations"}]'::jsonb,
    'Defined scope: 4–6 core pages. Additional pages quoted separately.'
),
(
    'WEB-03', 'Business System', 'منظومة أعمال رقمية', 'sada-web-system',
    'Tailored full-stack business system starting from 2,500 TND: website, custom CMS, booking/orders, dashboard, database, and integrations.',
    'منظومة أعمال وبرمجية ويب مخصصة تبدأ من 2500 د.ت: موقع، لوحة تحكم، حجز وطلبات، قاعدة بيانات وربط برمجي.',
    (SELECT id FROM public.package_categories WHERE code = 'WEB'), 'Websites & Digital Systems',
    'digital', 'starting_from', 'project', 2500.00, 'TND', true, false, true,
    'approved', 'unverified', 'Section 05, Page 9', 18, 8,
    0, 0, '', 0, 0,
    ARRAY[]::text[], false, true, false, false,
    '[{"text":"Website"},{"text":"CMS"},{"text":"Booking"},{"text":"Orders"},{"text":"Dashboard"},{"text":"Database"},{"text":"Integrations"}]'::jsonb,
    '[{"text":"Scope outside agreed specification"}]'::jsonb,
    'Starting from 2,500 TND. Final price depends on scope and technical requirements.'
),

-- 06 — STRATEGY
(
    'STG-01', 'Content Strategy', 'استراتيجية المحتوى', 'sada-stg-content',
    'Strategic brand content blueprint: audit, audience definition, content pillars, content ideas, monthly direction, and competitor overview.',
    'خطة استراتيجية للمحتوى: تدقيق العلامة، تحديد الجمهور، ركائز المحتوى، أفكار إعلانية، وتوجه شهري مع دراسة المنافسين.',
    (SELECT id FROM public.package_categories WHERE code = 'STRATEGY'), 'Strategy',
    'standard', 'one_time', 'service', 300.00, 'TND', true, false, true,
    'approved', 'unverified', 'Section 06, Page 10', 19, 10,
    0, 0, '', 0, 0,
    ARRAY[]::text[], false, false, true, false,
    '[{"text":"Brand Content Audit"},{"text":"Audience Definition"},{"text":"Content Pillars"},{"text":"Content Ideas"},{"text":"Monthly Direction"},{"text":"Competitor Overview"}]'::jsonb,
    '[{"text":"Monthly execution"},{"text":"Shooting"},{"text":"Publishing"}]'::jsonb,
    'Strategic document deliverable. Execution purchased separately.'
),
(
    'STG-02', 'Marketing Strategy', 'استراتيجية التسويق الشاملة', 'sada-stg-marketing',
    'Comprehensive market and growth roadmap: market analysis, target audience, positioning, content strategy, campaign ideas, and KPIs.',
    'استراتيجية تسويق شاملة: تحليل السوق والمنافسين، التموضع التجاري، استراتيجية المحتوى، أفكار الحملات ومؤشرات الأداء.',
    (SELECT id FROM public.package_categories WHERE code = 'STRATEGY'), 'Strategy',
    'standard', 'one_time', 'service', 500.00, 'TND', true, false, true,
    'approved', 'unverified', 'Section 06, Page 10', 20, 9,
    0, 0, '', 0, 0,
    ARRAY[]::text[], false, false, true, false,
    '[{"text":"Market Analysis"},{"text":"Target Audience"},{"text":"Positioning"},{"text":"Content Strategy"},{"text":"Campaign Ideas"},{"text":"Marketing Roadmap"},{"text":"KPIs"}]'::jsonb,
    '[{"text":"Monthly execution"},{"text":"Ad Spend"}]'::jsonb,
    'Full strategic marketing roadmap deliverable.'
),

-- 07 — MONTHLY COMBINED PACKAGES
(
    'HY-01', 'Growth Produce', 'النمو والإنتاج', 'sada-hy-growth-produce',
    'Monthly content production + social management: 1 session (up to 4h), 4 Reels, photos, story assets, 4 Posts, publishing, and community management.',
    'باقة شهرية تجمع بين الإنتاج الميداني وإدارة النشر: جلسة تصوير حتى 4 ساعات، 4 ريلز، صور، 4 منشورات وإدارة التفاعل.',
    (SELECT id FROM public.package_categories WHERE code = 'COMBINED'), 'Monthly Combined Packages',
    'hybrid', 'monthly', 'month', 1490.00, 'TND', true, false, true,
    'approved', 'unverified', 'Section 07, Page 11', 21, 10,
    4, 4, 'Story Assets', 4, 1,
    ARRAY['instagram', 'facebook'], false, false, false, true,
    '[{"text":"1 Content Session — up to 4 hours"},{"text":"4 Reels"},{"text":"Photos"},{"text":"Story Assets"},{"text":"4 Posts"},{"text":"Stories"},{"text":"Content Planning"},{"text":"Copywriting"},{"text":"Publishing"},{"text":"Community Management"}]'::jsonb,
    '[{"text":"Ads Management"},{"text":"Sponsoring / Ad Budget"}]'::jsonb,
    'Entry combined retainer. Ads management not included.'
),
(
    'HY-02', 'Growth+ Produce', 'النمو المتقدم والإنتاج', 'sada-hy-growth-plus-produce',
    'Monthly long production session + full management + Meta Ads: 1 session (up to 6h), 6 Reels, 25 Photos, 8 Posts, weekly stories, report, and ads.',
    'باقة شهرية متقدمة تشمل يوماً ممتداً من الإنتاج والإدارة والإعلانات: جلسة 6 ساعات، 6 ريلز، 25 صورة، 8 منشورات وإعلانات ميتا.',
    (SELECT id FROM public.package_categories WHERE code = 'COMBINED'), 'Monthly Combined Packages',
    'hybrid', 'monthly', 'month', 1790.00, 'TND', true, false, true,
    'approved', 'unverified', 'Section 07, Page 11', 22, 9,
    6, 8, 'Weekly Stories & Story Content', 6, 1,
    ARRAY['instagram', 'facebook'], true, false, false, true,
    '[{"text":"1 Long Production Session — up to 6 hours"},{"text":"6 Reels"},{"text":"25 Photos"},{"text":"Story Content"},{"text":"8 Posts"},{"text":"Weekly Stories"},{"text":"Copywriting"},{"text":"Publishing"},{"text":"Community Management"},{"text":"Monthly Report"},{"text":"Meta Ads Management"}]'::jsonb,
    '[{"text":"Sponsoring / Ad Budget"}]'::jsonb,
    'Includes Meta Ads management. Ad spend strictly separate.'
),
(
    'HY-03', 'Scale Produce', 'التوسع والإنتاج', 'sada-hy-scale-produce',
    'Full-day production partnership: 1 day up to 8h (or 2×4h), 8 Reels, 30 Photos, 8 Posts, stories, strategy, copywriting, publishing, analytics, and Meta Ads.',
    'شراكة إبداعية كاملة مع يوم إنتاج سينمائي: يوم 8 ساعات، 8 ريلز، 30 صورة، 8 منشورات، استراتيجية، تحليلات وإعلانات ميتا.',
    (SELECT id FROM public.package_categories WHERE code = 'COMBINED'), 'Monthly Combined Packages',
    'hybrid', 'monthly', 'month', 2190.00, 'TND', true, false, true,
    'approved', 'unverified', 'Section 07, Page 12', 23, 8,
    8, 8, 'Story Assets', 8, 1,
    ARRAY['instagram', 'facebook'], true, false, true, true,
    '[{"text":"1 Full Production Day — up to 8 hours (or 2×4h Sessions)"},{"text":"8 Reels"},{"text":"30 Photos"},{"text":"Story Assets"},{"text":"8 Posts"},{"text":"Stories"},{"text":"Content Planning"},{"text":"Copywriting"},{"text":"Publishing"},{"text":"Community Management"},{"text":"Analytics"},{"text":"Meta Ads Management"}]'::jsonb,
    '[{"text":"Sponsoring / Ad Budget"}]'::jsonb,
    '1 Full Day (8h) or 2 Sessions (4h+4h). Sponsoring budget separate.'
),
(
    'HY-04', 'Premium', 'بريميوم', 'sada-hy-premium',
    'Flagship multi-discipline retainer: Full production day (8h), 8 Reels, 30+ Photos, 8 Posts, content strategy, Meta Ads, and website management/updates.',
    'الباقة الشاملة الكبرى: يوم إنتاج كامل 8 ساعات، 8 ريلز، 30+ صورة، 8 منشورات، استراتيجية، إعلانات ميتا، وإدارة وتحديثات للموقع الحالي.',
    (SELECT id FROM public.package_categories WHERE code = 'COMBINED'), 'Monthly Combined Packages',
    'hybrid', 'monthly', 'month', 2490.00, 'TND', true, false, true,
    'approved', 'unverified', 'Section 07, Page 12', 24, 7,
    8, 8, 'Story Content', 8, 1,
    ARRAY['instagram', 'facebook'], true, true, true, true,
    '[{"text":"1 Full Production Day — up to 8 hours"},{"text":"8 Reels"},{"text":"30+ Photos"},{"text":"Story Content"},{"text":"8 Posts"},{"text":"Stories"},{"text":"Full Social Media Management"},{"text":"Copywriting"},{"text":"Content Strategy"},{"text":"Community Management"},{"text":"Monthly Report"},{"text":"Meta Ads Management"},{"text":"Website Management"},{"text":"Basic SEO Monitoring"},{"text":"Website Updates"}]'::jsonb,
    '[{"text":"Sponsoring / Ad Budget"},{"text":"New website development"},{"text":"Major website features"},{"text":"E-commerce / Booking / Dashboard development"}]'::jsonb,
    'Covers maintenance/updates for existing client website. Major new development quoted separately.'
),
(
    'HY-05', 'Premium Plus', 'بريميوم بلس', 'sada-hy-premium-plus',
    'Premium Retainer + Defined-Scope Business Website: 8h production day, 8 Reels, 30+ Photos, 8 Posts, full social management, Meta Ads + complete business website.',
    'باقة بريميوم بلس (بريميوم + موقع كامل): كل مزايا باقة بريميوم مع تطوير موقع شركة متجاوب متكامل مع سيو ونشر.',
    (SELECT id FROM public.package_categories WHERE code = 'COMBINED'), 'Monthly Combined Packages',
    'hybrid', 'monthly', 'month', 2890.00, 'TND', true, false, true,
    'approved', 'unverified', 'Section 07, Page 12', 25, 6,
    8, 8, 'Story Content', 8, 1,
    ARRAY['instagram', 'facebook'], true, true, true, true,
    '[{"text":"Full Production Day — up to 8 hours"},{"text":"8 Reels"},{"text":"30+ Photos"},{"text":"Story Content"},{"text":"8 Posts"},{"text":"Stories"},{"text":"Full Social Media Management"},{"text":"Copywriting"},{"text":"Content Strategy"},{"text":"Community Management"},{"text":"Monthly Report"},{"text":"Meta Ads Management"},{"text":"Website Management"},{"text":"Basic SEO Monitoring"},{"text":"Website Updates"},{"text":"Plus — Defined-Scope Business Website"},{"text":"Responsive Design & Core Pages"},{"text":"Contact / CTA & Basic SEO Deployment"}]'::jsonb,
    '[{"text":"Sponsoring / Ad Budget"},{"text":"Major custom development outside agreed website scope"},{"text":"E-commerce / Booking / Custom Web Apps"}]'::jsonb,
    'Includes a defined-scope Business Website. Complex web applications (booking, e-commerce) quoted separately.'
),

-- 08 — CUSTOM PACKAGE
(
    'CUS-01', 'Build Your Package', 'صمم باقتك الخاصة', 'sada-custom-build',
    'Custom tailored hybrid package: choose any combination of social media, production, story visits, ads management, website, and strategic consulting.',
    'باقة مرنة ومخصصة بالكامل: اختر توليفتك المثالية من التصوير، المونتاج، التغطيات، الإعلانات الممولة، المواقع والاستشارات.',
    (SELECT id FROM public.package_categories WHERE code = 'CUSTOM'), 'Custom Package',
    'custom', 'custom', 'custom', 0.00, 'TND', true, false, true,
    'approved', 'unverified', 'Section 08, Page 13', 26, 5,
    0, 0, '', 0, 0,
    ARRAY['instagram', 'facebook'], false, false, false, false,
    '[{"text":"Custom scope selection"},{"text":"Social Media Management"},{"text":"Content Editing"},{"text":"Production Sessions"},{"text":"Story Production"},{"text":"Ads Management"},{"text":"Website & Systems"},{"text":"Strategy Consulting"}]'::jsonb,
    '[{"text":"Unscoped services without prior quote"}]'::jsonb,
    'Pricing calculated using internal pricing formula (Selling Price - Direct Costs = Gross Profit). Tailored quote provided.'
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    name_ar = EXCLUDED.name_ar,
    slug = EXCLUDED.slug,
    description = EXCLUDED.description,
    description_ar = EXCLUDED.description_ar,
    category_id = EXCLUDED.category_id,
    category_name = EXCLUDED.category_name,
    package_type = EXCLUDED.package_type,
    billing_type = EXCLUDED.billing_type,
    billing_unit = EXCLUDED.billing_unit,
    price = EXCLUDED.price,
    currency = EXCLUDED.currency,
    is_active = EXCLUDED.is_active,
    is_internal_only = EXCLUDED.is_internal_only,
    approval_status = EXCLUDED.approval_status,
    cost_verification_status = EXCLUDED.cost_verification_status,
    source_page_ref = EXCLUDED.source_page_ref,
    display_order = EXCLUDED.display_order,
    priority = EXCLUDED.priority,
    monthly_reels = EXCLUDED.monthly_reels,
    monthly_posts = EXCLUDED.monthly_posts,
    monthly_stories = EXCLUDED.monthly_stories,
    production_hours = EXCLUDED.production_hours,
    production_sessions = EXCLUDED.production_sessions,
    platforms = EXCLUDED.platforms,
    has_ads_management = EXCLUDED.has_ads_management,
    has_website = EXCLUDED.has_website,
    has_strategy = EXCLUDED.has_strategy,
    has_community_management = EXCLUDED.has_community_management,
    included_items = EXCLUDED.included_items,
    excluded_items = EXCLUDED.excluded_items,
    operational_notes = EXCLUDED.operational_notes;

-- 7. UPSERT THE NINE PROPOSED PUBLIC PACKAGES (Section 11)
-- All created as:
-- is_published = false (Unpublished Draft)
-- approval_status = 'proposed' (Needs Super Admin Approval)
-- is_internal_only = false (Intended for public offering once approved and published)
-- cost_verification_status = 'unverified'

-- Category A — Monthly Subscription
INSERT INTO public.package_catalog (
    code, name, name_ar, slug, description, description_ar, category_id, category_name,
    package_type, billing_type, billing_unit, price, proposed_price, currency,
    is_active, is_published, is_internal_only, approval_status, cost_verification_status,
    source_page_ref, display_order, priority,
    monthly_reels, monthly_posts, monthly_stories, production_hours, production_sessions,
    platforms, has_ads_management, has_website, has_strategy, has_community_management,
    included_items, excluded_items, operational_notes, recommendation_enabled
) VALUES
(
    'PUB-MS-01', 'Social Presence', 'الحضور الاجتماعي', 'pub-social-presence',
    'Practical monthly content & social media management for businesses needing consistent presence: 1 session (up to 3h), 4 Reels, 4 Posts, content calendar, and publishing.',
    'باقة حضور شهري عملي للأنشطة التجارية: جلسة تصوير حتى 3 ساعات، 4 ريلز، 4 منشورات، تقويم محتوى ونشر وتفاعل دوري.',
    (SELECT id FROM public.package_categories WHERE code = 'PUB-MONTHLY'), 'Monthly Subscription',
    'hybrid', 'monthly', 'month', 1490.00, 1490.00, 'TND',
    true, false, false, 'proposed', 'unverified',
    'Section 11 — Commercial Recommendation (Informed by HY-01)', 1, 10,
    4, 4, 'Story assets from production session (exact quota TBD)', 3, 1,
    ARRAY['instagram', 'facebook'], false, false, false, true,
    '[{"text":"1 content/production session up to 3 hours"},{"text":"4 Reels / month"},{"text":"4 Posts / month"},{"text":"Story assets from production session"},{"text":"Content planning and copywriting"},{"text":"Publishing and basic community management"},{"text":"Monthly content calendar"}]'::jsonb,
    '[{"text":"Ad budget / sponsoring"},{"text":"Paid ads management unless explicitly added"},{"text":"Website development"},{"text":"Unlimited story visits or unlimited revisions"}]'::jsonb,
    'Draft / Proposed — Needs owner review. Story frequency and exact photo count to be finalized prior to publication.',
    true
),
(
    'PUB-MS-02', 'Growth Engine', 'محرك النمو', 'pub-growth-engine',
    'High-growth monthly retainer combining regular production, content delivery, publishing, performance review, and Meta Ads Management.',
    'محرك نمو شهري متقدم يجمع بين يوم تصوير (حتى 6 ساعات)، 6 ريلز، 25 صورة، 8 منشورات، ستوريز أسبوعية، وإدارة إعلانات ميتا.',
    (SELECT id FROM public.package_categories WHERE code = 'PUB-MONTHLY'), 'Monthly Subscription',
    'hybrid', 'monthly', 'month', 1990.00, 1990.00, 'TND',
    true, false, false, 'proposed', 'unverified',
    'Section 11 — Commercial Recommendation (Positioned between HY-02 & HY-03)', 2, 9,
    6, 8, 'Weekly Stories using agreed story assets', 6, 1,
    ARRAY['instagram', 'facebook'], true, false, false, true,
    '[{"text":"1 production day up to 6 hours"},{"text":"6 Reels / month"},{"text":"25 edited photos"},{"text":"8 Posts / month"},{"text":"Weekly Stories using agreed story assets"},{"text":"Copywriting and content planning"},{"text":"Publishing and community management"},{"text":"Monthly performance report"},{"text":"Meta Ads Management"}]'::jsonb,
    '[{"text":"Ad budget / sponsoring"},{"text":"Website development"},{"text":"Unlimited visits or unlimited deliverables"}]'::jsonb,
    'Draft / Proposed — Needs cost validation and owner approval. Ad spend is separate.',
    true
),
(
    'PUB-MS-03', 'Full Brand Growth', 'النمو الشامل للعلامة', 'pub-full-brand-growth',
    'Comprehensive monthly flagship for brands needing ongoing production, content strategy, publishing, Meta Ads, and basic website management.',
    'باقة شاملة متكاملة للعلامات التجارية: يوم إنتاج، 8 ريلز، 30+ صورة، 8 منشورات، استراتيجية محتوى، إعلانات ميتا، وإدارة وصيانة الموقع.',
    (SELECT id FROM public.package_categories WHERE code = 'PUB-MONTHLY'), 'Monthly Subscription',
    'hybrid', 'monthly', 'month', 2490.00, 2490.00, 'TND',
    true, false, false, 'proposed', 'unverified',
    'Section 11 — Commercial Recommendation (Aligned with HY-04)', 3, 8,
    8, 8, 'Story content assets with defined monthly quota', 8, 1,
    ARRAY['instagram', 'facebook'], true, true, true, true,
    '[{"text":"1 production day per month (duration explicitly agreed)"},{"text":"8 Reels / month"},{"text":"30+ edited photos / month"},{"text":"8 Posts / month"},{"text":"Story content assets with defined quota"},{"text":"Content strategy and copywriting"},{"text":"Publishing and community management"},{"text":"Monthly reporting and analytics"},{"text":"Meta Ads Management"},{"text":"Basic website management, monitoring & agreed updates"}]'::jsonb,
    '[{"text":"Ad budget / sponsoring"},{"text":"New website development"},{"text":"Unlimited website updates"},{"text":"Unlimited story visits"},{"text":"Custom software development"}]'::jsonb,
    'Draft / Proposed — Needs cost validation and owner approval. Production duration and website boundaries to be confirmed.',
    true
),

-- Category B — Service On Demand
(
    'PUB-OD-01', 'Content Session', 'جلسة محتوى عند الطلب', 'pub-content-session',
    'One-time production session up to 3 hours: 3 edited Reels, 10–15 edited photos, story clips, reel editing, color, sound, and basic captions.',
    'جلسة تصوير وإنتاج سينمائي عند الطلب حتى 3 ساعات: 3 ريلز، 10 إلى 15 صورة، مقاطع ستوري، ومونتاج كامل.',
    (SELECT id FROM public.package_categories WHERE code = 'PUB-ONDEMAND'), 'Service On Demand',
    'production', 'one_time', 'session', 550.00, 550.00, 'TND',
    true, false, false, 'proposed', 'unverified',
    'Section 11 — Commercial Recommendation (Source PR-01)', 4, 10,
    3, 15, 'Story Clips', 3, 1,
    ARRAY['instagram', 'facebook'], false, false, false, false,
    '[{"text":"One session up to 3 hours"},{"text":"3 edited Reels"},{"text":"10–15 edited photos"},{"text":"Story clips"},{"text":"Reel editing"},{"text":"Color correction"},{"text":"Sound"},{"text":"Basic captions"}]'::jsonb,
    '[{"text":"Publishing"},{"text":"Ongoing social media management"},{"text":"Ads management"},{"text":"Ad budget"},{"text":"Daily story visits"}]'::jsonb,
    'Draft / Proposed — Confirm deliverable definitions and revision policy prior to publication.',
    true
),
(
    'PUB-OD-02', 'Production Day', 'يوم إنتاج عند الطلب', 'pub-production-day',
    'One-time production day up to 6 hours: 6 edited Reels, 25 edited photos, story assets, creative direction, editing, color, sound, captions, and raw footage.',
    'يوم تصوير وإنتاج سينمائي عند الطلب حتى 6 ساعات: 6 ريلز، 25 صورة، توجيه إبداعي، ومواد خام منظمة.',
    (SELECT id FROM public.package_categories WHERE code = 'PUB-ONDEMAND'), 'Service On Demand',
    'production', 'one_time', 'session', 900.00, 900.00, 'TND',
    true, false, false, 'proposed', 'unverified',
    'Section 11 — Commercial Recommendation (Source PR-03)', 5, 9,
    6, 25, 'Story Assets', 6, 1,
    ARRAY['instagram', 'facebook'], false, false, true, false,
    '[{"text":"Production day up to 6 hours"},{"text":"6 edited Reels"},{"text":"25 edited photos"},{"text":"Story assets"},{"text":"Creative direction"},{"text":"Videography and photography"},{"text":"Editing, color, sound, captions"},{"text":"Organized raw footage"}]'::jsonb,
    '[{"text":"Publishing"},{"text":"Ongoing social media management"},{"text":"Ads management"},{"text":"Ad budget"}]'::jsonb,
    'Draft / Proposed — Confirm travel radius, delivery timeline, and revision limits.',
    true
),
(
    'PUB-OD-03', 'Pro Production Day', 'يوم إنتاج احترافي عند الطلب', 'pub-pro-production-day',
    'High-end full production day up to 8 hours: 8 edited Reels, 30–40 photos, story content, BTS, multiple setups, food/product shots, sound design, and covers.',
    'يوم إنتاج سينمائي احترافي كامل حتى 8 ساعات: 8 ريلز، 30 إلى 40 صورة، كواليس، تصوير منتجات وديكورات متعددة.',
    (SELECT id FROM public.package_categories WHERE code = 'PUB-ONDEMAND'), 'Service On Demand',
    'production', 'one_time', 'session', 1200.00, 1200.00, 'TND',
    true, false, false, 'proposed', 'unverified',
    'Section 11 — Commercial Recommendation (Source PR-04)', 6, 8,
    8, 35, 'Story Content & BTS', 8, 1,
    ARRAY['instagram', 'facebook'], false, false, true, false,
    '[{"text":"Production up to 8 hours"},{"text":"8 edited Reels"},{"text":"30–40 edited photos"},{"text":"Story content & BTS"},{"text":"Creative direction & professional shooting"},{"text":"Product / food shots with multiple setups"},{"text":"Full editing, color grading, sound design, captions, covers"}]'::jsonb,
    '[{"text":"Publishing"},{"text":"Ongoing social media management"},{"text":"Ads management"},{"text":"Ad budget"}]'::jsonb,
    'Draft / Proposed — Confirm deliverable definitions, location/travel policy, and revision policy.',
    true
),

-- Category C — Individual Services
(
    'PUB-IS-01', 'Reel Editing', 'مونتاج ريل فردي', 'pub-reel-editing',
    'Editing of one client-supplied Reel using supplied footage, color correction, sound design, and captions in one agreed format.',
    'مونتاج احترافي لريل واحد من مواد الحريف المصورة مع تلوين وهندسة صوت ونصوص في نسق متفق عليه.',
    (SELECT id FROM public.package_categories WHERE code = 'PUB-INDIVIDUAL'), 'Individual Services',
    'standard', 'one_time', 'reel', 80.00, 80.00, 'TND',
    true, false, false, 'proposed', 'unverified',
    'Section 11 — Commercial Recommendation (Source Add-on Extra Reel — Editing)', 7, 10,
    1, 0, '', 0, 0,
    ARRAY['instagram', 'facebook', 'tiktok'], false, false, false, false,
    '[{"text":"Editing of one client-supplied Reel"},{"text":"Using client-supplied footage"},{"text":"Final export in one agreed format"},{"text":"Color correction & sound balance"},{"text":"Captions"}]'::jsonb,
    '[{"text":"Filming / full production"},{"text":"Publishing"},{"text":"Ad spend"},{"text":"Unlimited revisions"}]'::jsonb,
    'Draft / Proposed — Define duration, raw footage format, and revision count prior to publication.',
    true
),
(
    'PUB-IS-02', 'Meta Ads Management', 'إدارة إعلانات ميتا الشهرية', 'pub-meta-ads-mgmt',
    'Dedicated monthly Meta Ads campaign architecture: setup, targeting, campaign management, ongoing monitoring, optimization, and monthly summary.',
    'إدارة شهرية مستقلة لحملات ميتا الإعلانية: إعداد الحساب، الاستهداف، المتابعة، التحسين وتقرير شهري.',
    (SELECT id FROM public.package_categories WHERE code = 'PUB-INDIVIDUAL'), 'Individual Services',
    'standard', 'monthly', 'month', 250.00, 250.00, 'TND',
    true, false, false, 'proposed', 'unverified',
    'Section 11 — Commercial Recommendation (Source AD-01)', 8, 9,
    0, 0, '', 0, 0,
    ARRAY['instagram', 'facebook'], true, false, false, false,
    '[{"text":"Meta Ads setup"},{"text":"Campaign management"},{"text":"Basic monitoring"},{"text":"Basic optimization"},{"text":"Monthly summary"}]'::jsonb,
    '[{"text":"Ad budget / sponsoring"},{"text":"Production of creative assets unless purchased separately"}]'::jsonb,
    'Draft / Proposed — Define account access, campaign limits, and service boundaries.',
    true
),
(
    'PUB-IS-03', 'Content Strategy Session', 'جلسة استراتيجية المحتوى', 'pub-content-strategy-session',
    'Strategic brand content consulting: brand content audit, audience review, content pillars, content ideas, monthly direction, and competitor overview.',
    'جلسة استشارية استراتيجية للمحتوى: تدقيق المحتوى، دراسة الجمهور، ركائز النشر، أفكار إعلانية ودراسة للمنافسين.',
    (SELECT id FROM public.package_categories WHERE code = 'PUB-INDIVIDUAL'), 'Individual Services',
    'standard', 'one_time', 'service', 300.00, 300.00, 'TND',
    true, false, false, 'proposed', 'unverified',
    'Section 11 — Commercial Recommendation (Source STG-01)', 9, 8,
    0, 0, '', 0, 0,
    ARRAY[]::text[], false, false, true, false,
    '[{"text":"Brand content audit"},{"text":"Audience review"},{"text":"Content pillars"},{"text":"Content ideas"},{"text":"Monthly direction"},{"text":"Competitor overview"}]'::jsonb,
    '[{"text":"Monthly content execution"},{"text":"Filming"},{"text":"Publishing"},{"text":"Ad budget"}]'::jsonb,
    'Draft / Proposed — Define final deliverable format and delivery date.',
    true
)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    name_ar = EXCLUDED.name_ar,
    slug = EXCLUDED.slug,
    description = EXCLUDED.description,
    description_ar = EXCLUDED.description_ar,
    category_id = EXCLUDED.category_id,
    category_name = EXCLUDED.category_name,
    package_type = EXCLUDED.package_type,
    billing_type = EXCLUDED.billing_type,
    billing_unit = EXCLUDED.billing_unit,
    price = EXCLUDED.price,
    proposed_price = EXCLUDED.proposed_price,
    currency = EXCLUDED.currency,
    is_active = EXCLUDED.is_active,
    is_internal_only = EXCLUDED.is_internal_only,
    approval_status = EXCLUDED.approval_status,
    cost_verification_status = EXCLUDED.cost_verification_status,
    source_page_ref = EXCLUDED.source_page_ref,
    display_order = EXCLUDED.display_order,
    priority = EXCLUDED.priority,
    monthly_reels = EXCLUDED.monthly_reels,
    monthly_posts = EXCLUDED.monthly_posts,
    monthly_stories = EXCLUDED.monthly_stories,
    production_hours = EXCLUDED.production_hours,
    production_sessions = EXCLUDED.production_sessions,
    platforms = EXCLUDED.platforms,
    has_ads_management = EXCLUDED.has_ads_management,
    has_website = EXCLUDED.has_website,
    has_strategy = EXCLUDED.has_strategy,
    has_community_management = EXCLUDED.has_community_management,
    included_items = EXCLUDED.included_items,
    excluded_items = EXCLUDED.excluded_items,
    operational_notes = EXCLUDED.operational_notes,
    recommendation_enabled = EXCLUDED.recommendation_enabled;
