-- ============================================================
-- SADA OS — PHASE 3 & PHASE 4 SCHEMA MIGRATION
-- Sales Pipeline, Packages, Deliverables & Production Engine
-- ============================================================

-- 1. PACKAGES TABLE (Canonical Profitability & Deliverable Formulas)
CREATE TABLE IF NOT EXISTS public.packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    selling_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    services TEXT[] NOT NULL DEFAULT '{}',
    deliverables JSONB NOT NULL DEFAULT '[]'::jsonb,
    target_quantities JSONB NOT NULL DEFAULT '{"reels": 0, "posts": 0, "stories": 0, "ads_campaigns": 0}'::jsonb,
    production_hours NUMERIC(8,2) NOT NULL DEFAULT 0,
    employee_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    freelancer_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    transport_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
    subscription_allocation NUMERIC(12,2) NOT NULL DEFAULT 0,
    commission NUMERIC(12,2) NOT NULL DEFAULT 0,
    direct_costs NUMERIC(12,2) GENERATED ALWAYS AS (
        employee_cost + freelancer_cost + transport_cost + subscription_allocation + commission
    ) STORED,
    gross_profit NUMERIC(12,2) GENERATED ALWAYS AS (
        selling_price - (employee_cost + freelancer_cost + transport_cost + subscription_allocation + commission)
    ) STORED,
    gross_margin NUMERIC(8,2) GENERATED ALWAYS AS (
        CASE 
            WHEN selling_price > 0 THEN 
                ((selling_price - (employee_cost + freelancer_cost + transport_cost + subscription_allocation + commission)) / selling_price) * 100.0
            ELSE 0.0 
        END
    ) STORED,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. ENHANCE CLIENTS TABLE WITH PACKAGE LINK
ALTER TABLE public.clients 
    ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES public.packages(id) ON DELETE SET NULL;

-- 3. DEALS TABLE (Sales Pipeline: Lead -> Contacted -> Qualified -> Meeting -> Proposal -> Negotiation -> Won / Lost)
CREATE TABLE IF NOT EXISTS public.deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    company_name TEXT NOT NULL,
    stage TEXT NOT NULL CHECK (stage IN ('lead', 'contacted', 'qualified', 'meeting', 'proposal', 'negotiation', 'won', 'lost')),
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    package_id UUID REFERENCES public.packages(id) ON DELETE SET NULL,
    sales_owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    commission_recipient_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
    deal_value NUMERIC(12,2) NOT NULL DEFAULT 0,
    service_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
    sponsoring_budget NUMERIC(12,2) NOT NULL DEFAULT 0,
    commission_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
    expected_close_date DATE,
    won_date TIMESTAMPTZ,
    lost_reason TEXT,
    contract_agreement JSONB DEFAULT '{}'::jsonb,
    revenue_config JSONB DEFAULT '{}'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. CLIENT DELIVERABLES TABLE (Deliverables tracking: Target, Done, Remaining, Assigned team, Deadline, Status)
CREATE TABLE IF NOT EXISTS public.client_deliverables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    package_id UUID REFERENCES public.packages(id) ON DELETE SET NULL,
    project_id UUID REFERENCES public.client_projects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    deliverable_type TEXT NOT NULL CHECK (deliverable_type IN ('reel', 'post', 'story', 'ads_campaign', 'video', 'branding', 'other')),
    period_month TEXT NOT NULL,
    target_quantity INTEGER NOT NULL DEFAULT 1,
    done_quantity INTEGER NOT NULL DEFAULT 0,
    remaining_quantity INTEGER GENERATED ALWAYS AS (
        GREATEST(0, target_quantity - done_quantity)
    ) STORED,
    assigned_team_ids UUID[] DEFAULT '{}',
    deadline DATE,
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'review', 'completed', 'behind_schedule')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. ENHANCE PROJECT TASKS WITH EXTENDED SCHEMA & WORKFLOW
ALTER TABLE public.project_tasks
    ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES public.packages(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS deliverable_id UUID REFERENCES public.client_deliverables(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(6,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS actual_hours NUMERIC(6,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS revision_count INTEGER DEFAULT 0;

-- 6. PRODUCTION BOOKINGS TABLE (Booking + Brief + Production Workflow)
-- Workflow: BRIEF -> SCHEDULING -> SHOOTING -> RAW UPLOAD -> EDITING -> REVIEW -> CLIENT APPROVAL -> DELIVERY/PUBLISHING
CREATE TABLE IF NOT EXISTS public.production_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
    project_id UUID REFERENCES public.client_projects(id) ON DELETE SET NULL,
    package_id UUID REFERENCES public.packages(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    date DATE NOT NULL,
    time TEXT NOT NULL,
    location TEXT NOT NULL,
    team_member_ids UUID[] DEFAULT '{}',
    production_type TEXT NOT NULL,
    duration_hours NUMERIC(5,2) NOT NULL DEFAULT 2.0,
    brief JSONB NOT NULL DEFAULT '{
        "shot_list": [],
        "required_reels": 0,
        "photos": 0,
        "story_assets": 0,
        "references": [],
        "equipment": []
    }'::jsonb,
    stage TEXT NOT NULL DEFAULT 'brief' CHECK (
        stage IN ('brief', 'scheduling', 'shooting', 'raw_upload', 'editing', 'review', 'client_approval', 'delivery_publishing')
    ),
    raw_upload_url TEXT,
    edit_preview_url TEXT,
    client_notes TEXT,
    internal_notes TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_bookings ENABLE ROW LEVEL SECURITY;

-- 8. RLS POLICIES FOR PACKAGES
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Packages are viewable by all authenticated users" ON public.packages;
    CREATE POLICY "Packages are viewable by all authenticated users"
        ON public.packages FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Packages can be managed by admins" ON public.packages;
    CREATE POLICY "Packages can be managed by admins"
        ON public.packages FOR ALL TO authenticated USING (true) WITH CHECK (true);
END $$;

-- 9. RLS POLICIES FOR DEALS
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Deals viewable by authenticated users" ON public.deals;
    CREATE POLICY "Deals viewable by authenticated users"
        ON public.deals FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Deals manageable by authenticated users" ON public.deals;
    CREATE POLICY "Deals manageable by authenticated users"
        ON public.deals FOR ALL TO authenticated USING (true) WITH CHECK (true);
END $$;

-- 10. RLS POLICIES FOR CLIENT DELIVERABLES
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Client deliverables viewable by authenticated users" ON public.client_deliverables;
    CREATE POLICY "Client deliverables viewable by authenticated users"
        ON public.client_deliverables FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Client deliverables manageable by authenticated users" ON public.client_deliverables;
    CREATE POLICY "Client deliverables manageable by authenticated users"
        ON public.client_deliverables FOR ALL TO authenticated USING (true) WITH CHECK (true);
END $$;

-- 11. RLS POLICIES FOR PRODUCTION BOOKINGS
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Production bookings viewable by authenticated users" ON public.production_bookings;
    CREATE POLICY "Production bookings viewable by authenticated users"
        ON public.production_bookings FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Production bookings manageable by authenticated users" ON public.production_bookings;
    CREATE POLICY "Production bookings manageable by authenticated users"
        ON public.production_bookings FOR ALL TO authenticated USING (true) WITH CHECK (true);
END $$;

-- 12. SEED CANONICAL SADA PACKAGES (WITH EXACT DELIVERABLES, QUANTITIES & FORMULA COSTS)
INSERT INTO public.packages (
    name,
    description,
    selling_price,
    services,
    deliverables,
    target_quantities,
    production_hours,
    employee_cost,
    freelancer_cost,
    transport_cost,
    subscription_allocation,
    commission
) VALUES 
(
    'SADA Growth Luxe',
    'Core social media retainer: 8 Reels, 8 Posts, 20 Stories, 4 Ads Campaigns with dedicated shoot and creative direction.',
    2800.00,
    ARRAY['Social Media Management', 'Video Production', 'Content Creation', 'Paid Advertising'],
    '[
        {"title": "8 Reels", "type": "reel", "target": 8},
        {"title": "8 Posts", "type": "post", "target": 8},
        {"title": "20 Stories", "type": "story", "target": 20},
        {"title": "4 Ads Campaigns", "type": "ads_campaign", "target": 4}
    ]'::jsonb,
    '{"reels": 8, "posts": 8, "stories": 20, "ads_campaigns": 4}'::jsonb,
    18.0,
    600.00,
    300.00,
    120.00,
    100.00,
    280.00
),
(
    'SADA Elite Scale',
    'High-volume omnichannel content engine: 16 Reels, 12 Posts, 40 Stories, 8 Ads Campaigns with dual monthly production shoots.',
    5200.00,
    ARRAY['Omnichannel SMM', 'High-End Video Production', 'Paid Ads Architecture', 'Influencer Management'],
    '[
        {"title": "16 Reels", "type": "reel", "target": 16},
        {"title": "12 Posts", "type": "post", "target": 12},
        {"title": "40 Stories", "type": "story", "target": 40},
        {"title": "8 Ads Campaigns", "type": "ads_campaign", "target": 8}
    ]'::jsonb,
    '{"reels": 16, "posts": 12, "stories": 40, "ads_campaigns": 8}'::jsonb,
    32.0,
    1100.00,
    550.00,
    250.00,
    180.00,
    520.00
),
(
    'SADA Brand Authority',
    'Comprehensive brand identity & flagship media production: 4 Reels, 4 Posts, 10 Stories, 2 Ads Campaigns.',
    1800.00,
    ARRAY['Brand Positioning', 'Commercial Photography', 'Content Strategy'],
    '[
        {"title": "4 Reels", "type": "reel", "target": 4},
        {"title": "4 Posts", "type": "post", "target": 4},
        {"title": "10 Stories", "type": "story", "target": 10},
        {"title": "2 Ads Campaigns", "type": "ads_campaign", "target": 2}
    ]'::jsonb,
    '{"reels": 4, "posts": 4, "stories": 10, "ads_campaigns": 2}'::jsonb,
    10.0,
    400.00,
    200.00,
    80.00,
    60.00,
    180.00
)
ON CONFLICT DO NOTHING;
