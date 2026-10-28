-- ============================================================
-- SADA WORK OS — Migration: 20261001180000_worker_os_sales_commissions_and_workspace.sql
-- Phase 1 & 2: Project Workspace Members & Worker Task Scoping
-- Phase 3 & 4: Worker Sales, Lead Conversion & Commission Snapshots
-- Phase 5 & 8: Super Admin Rules & Strict RBAC RLS Isolation
-- ============================================================

-- 1. Create project_members table for workspace team assignments
CREATE TABLE IF NOT EXISTS public.project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.client_projects(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    team_member_id UUID REFERENCES public.team_members(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'specialist' CHECK (role IN ('lead', 'specialist', 'reviewer', 'observer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_profile_id ON public.project_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_project_members_team_member_id ON public.project_members(team_member_id);

-- Enable RLS on project_members
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project members viewable by staff" ON public.project_members;
CREATE POLICY "Project members viewable by staff"
    ON public.project_members FOR SELECT
    USING (public.has_sada_access(auth.uid()));

DROP POLICY IF EXISTS "Admins manage project_members" ON public.project_members;
CREATE POLICY "Admins manage project_members"
    ON public.project_members FOR ALL
    USING (public.is_admin(auth.uid()))
    WITH CHECK (public.is_admin(auth.uid()));

-- 2. Extend deals table with snapshotting & payment status
ALTER TABLE public.deals
    ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'
        CHECK (payment_status IN ('unpaid', 'partially_paid', 'paid')),
    ADD COLUMN IF NOT EXISTS commission_rule_snapshot JSONB DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS sale_date DATE DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS idx_deals_sales_owner_id ON public.deals(sales_owner_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON public.deals(stage);

-- 3. Extend sales_commissions with deal tracking & historical rule snapshot
ALTER TABLE public.sales_commissions
    ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES public.package_catalog(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS package_name TEXT,
    ADD COLUMN IF NOT EXISTS total_sale_amount NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS sponsoring_amount NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS commission_rule_snapshot JSONB DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_commissions_deal_id ON public.sales_commissions(deal_id);
CREATE INDEX IF NOT EXISTS idx_sales_commissions_team_member_id ON public.sales_commissions(team_member_id);

-- 4. Harden RLS on deals table: Workers can ONLY view and manage their own deals/leads
DROP POLICY IF EXISTS "Deals viewable by authenticated users" ON public.deals;
DROP POLICY IF EXISTS "Deals manageable by authenticated users" ON public.deals;
DROP POLICY IF EXISTS "Staff read authorized deals" ON public.deals;
DROP POLICY IF EXISTS "Staff insert authorized deals" ON public.deals;
DROP POLICY IF EXISTS "Staff update authorized deals" ON public.deals;
DROP POLICY IF EXISTS "Super Admins delete deals" ON public.deals;

-- SELECT: Admins/Super Admins see all; Workers see ONLY their own deals
CREATE POLICY "Staff read authorized deals"
    ON public.deals FOR SELECT
    USING (
        public.is_admin(auth.uid()) OR
        sales_owner_id = auth.uid() OR
        commission_recipient_id = auth.uid() OR
        commission_recipient_id IN (
            SELECT id FROM public.team_members WHERE profile_id = auth.uid()
        )
    );

-- INSERT: Workers can create deals ONLY attributed to themselves
CREATE POLICY "Staff insert authorized deals"
    ON public.deals FOR INSERT
    WITH CHECK (
        public.is_admin(auth.uid()) OR
        sales_owner_id = auth.uid()
    );

-- UPDATE: Workers can update ONLY their own deals; Admins can update any
CREATE POLICY "Staff update authorized deals"
    ON public.deals FOR UPDATE
    USING (
        public.is_admin(auth.uid()) OR
        sales_owner_id = auth.uid()
    )
    WITH CHECK (
        public.is_admin(auth.uid()) OR
        sales_owner_id = auth.uid()
    );

-- DELETE: Super Admins only
CREATE POLICY "Super Admins delete deals"
    ON public.deals FOR DELETE
    USING (public.is_super_admin(auth.uid()));

-- 5. Harden project_tasks UPDATE policy to support both profile_id and team_member_id
DROP POLICY IF EXISTS "Workers update assigned project_tasks" ON public.project_tasks;
CREATE POLICY "Workers update assigned project_tasks"
    ON public.project_tasks FOR UPDATE
    USING (
        auth.uid() = assignee_id OR
        assignee_id IN (SELECT id FROM public.team_members WHERE profile_id = auth.uid())
    )
    WITH CHECK (
        auth.uid() = assignee_id OR
        assignee_id IN (SELECT id FROM public.team_members WHERE profile_id = auth.uid())
    );

-- 6. Helper Security Definer Function: Get current authenticated worker team member ID
CREATE OR REPLACE FUNCTION public.get_auth_team_member_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT id FROM public.team_members WHERE profile_id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_team_member_id() TO authenticated, service_role;

-- 7. SEED REALISTIC DEMO DATA FOR WORKER (QA Worker Lead)
DO $$
DECLARE
    v_worker_uid UUID := '77f7a3d3-82c1-4744-8f01-0a1fd5f44bba';
    v_worker_tm_id UUID := '9c0937f7-4617-4803-b718-a3d9a5175dd9';
    v_proj_id UUID;
    v_client_id UUID;
    v_pkg_id UUID;
    v_deal_id UUID;
    v_invoice_id UUID;
BEGIN
    -- Ensure QA Worker has correct profile and team_member mapping
    INSERT INTO public.profiles (id, display_name, status)
    VALUES (v_worker_uid, 'QA Worker Lead', 'active')
    ON CONFLICT (id) DO UPDATE SET display_name = 'QA Worker Lead', status = 'active';

    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_worker_uid, 'worker'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    UPDATE public.team_members
    SET profile_id = v_worker_uid, role = 'worker', name = 'QA Worker Lead', email = 'qa.worker@sada.agency', is_active = true
    WHERE id = v_worker_tm_id OR profile_id = v_worker_uid;

    -- A. Assign Worker to Flagship Project: "Jannat Sahara — Monthly Retainer Operations"
    SELECT id, client_id INTO v_proj_id, v_client_id
    FROM public.client_projects
    WHERE lower(client_name) LIKE '%jannat sahara%'
    LIMIT 1;

    IF v_proj_id IS NOT NULL THEN
        -- Add to project_members
        INSERT INTO public.project_members (project_id, profile_id, team_member_id, role)
        VALUES (v_proj_id, v_worker_uid, v_worker_tm_id, 'specialist')
        ON CONFLICT (project_id, profile_id) DO NOTHING;

        -- Set followup for client action required visibility
        UPDATE public.client_projects
        SET followup_status = 'waiting_for_client',
            followup_summary = 'Waiting for high-res drone footage approval from resort GM',
            followup_next_action = 'Follow up with Mansour on WhatsApp for video sign-off',
            followup_owner_id = v_worker_uid,
            next_followup_date = CURRENT_DATE
        WHERE id = v_proj_id;

        -- Assign active deliverables to the worker in Jannat Sahara
        -- Task 1: In Progress
        INSERT INTO public.project_tasks (
            project_id, client_id, title, category, service, status, priority,
            deadline, assignee_id, delivery_period, result_title, result_links, sort_order
        ) VALUES (
            v_proj_id, v_client_id, 'Reel #4: Sunset Camel Trek Luxury Experience', 'Production', 'Reels / Video Content',
            'in_progress', 'high', CURRENT_DATE + INTERVAL '2 days', v_worker_uid, '2026-10',
            'Rough Cut v1', ARRAY['https://assets.sada.agency/reels/jannat-reel4-rough.mp4'], 1
        );

        -- Task 2: Due Today
        INSERT INTO public.project_tasks (
            project_id, client_id, title, category, service, status, priority,
            deadline, assignee_id, delivery_period, sort_order
        ) VALUES (
            v_proj_id, v_client_id, 'Post #3: Desert Dining Under the Stars Carousel', 'Marketing', 'Posts & Visuals',
            'todo', 'urgent', CURRENT_DATE, v_worker_uid, '2026-10', 2
        );

        -- Task 3: Blocked (Waiting on Client)
        INSERT INTO public.project_tasks (
            project_id, client_id, title, category, service, status, priority,
            deadline, assignee_id, delivery_period, waiting_on, blocked_reason, sort_order
        ) VALUES (
            v_proj_id, v_client_id, 'Meta Ads Creative Suite: VIP Winter Getaway', 'Advertising', 'Meta Ads',
            'blocked', 'high', CURRENT_DATE + INTERVAL '3 days', v_worker_uid, '2026-10',
            'client', 'Awaiting ad account access delegation and coupon code from marketing director', 3
        );

        -- Task 4: Completed
        INSERT INTO public.project_tasks (
            project_id, client_id, title, category, service, status, priority,
            deadline, completed_at, assignee_id, delivery_period, result_title, result_links, sort_order
        ) VALUES (
            v_proj_id, v_client_id, 'Reel #3: Luxury Suite Room Tour & Amenities', 'Production', 'Reels / Video Content',
            'done', 'medium', CURRENT_DATE - INTERVAL '1 day', now(), v_worker_uid, '2026-10',
            'Final Export 4K', ARRAY['https://instagram.com/p/reel3-final'], 4
        );
    END IF;

    -- B. SEED WORKER LEADS & OPPORTUNITIES
    -- Find canonical package (e.g. SADA Growth or Premium)
    SELECT id INTO v_pkg_id FROM public.package_catalog WHERE is_active = true LIMIT 1;

    -- Lead 1: Qualified Opportunity
    INSERT INTO public.deals (
        title, company_name, contact_name, contact_email, contact_phone,
        stage, sales_owner_id, commission_recipient_id, deal_value, service_revenue, sponsoring_budget,
        commission_rate, expected_close_date, notes
    ) VALUES (
        'Dar Ben Gacem — Heritage Boutique Retainer', 'Dar Ben Gacem', 'Leila Ben Gacem',
        'leila@darbengacem.com', '+21671200300', 'qualified', v_worker_uid, v_worker_tm_id,
        2800, 2100, 700, 15, CURRENT_DATE + INTERVAL '10 days',
        'Inquired during Tourism & Heritage Expo. Interested in monthly storytelling reels and local sponsored ads.'
    );

    -- Lead 2: Proposal Negotiation
    INSERT INTO public.deals (
        title, company_name, contact_name, contact_email, contact_phone,
        stage, sales_owner_id, commission_recipient_id, deal_value, service_revenue, sponsoring_budget,
        commission_rate, expected_close_date, notes
    ) VALUES (
        'El Ali Cultural Café & Restaurant — Digital Relaunch', 'El Ali Medina', 'Sofiene Ali',
        'sofiene@elali.tn', '+21671321456', 'proposal', v_worker_uid, v_worker_tm_id,
        2300, 1500, 800, 15, CURRENT_DATE + INTERVAL '5 days',
        'Proposal submitted for 2,300 TND total (1,500 TND service fee + 800 TND Meta ads sponsorship).'
    );

    -- C. SEED WORKER WON SALE & SNAPSHOTTED COMMISSION
    -- Exactly matches business example:
    -- Sale: 2,300 TND | Sponsorship: 800 TND | Commissionable: 1,500 TND | Rate: 15% | Commission: 225 TND
    INSERT INTO public.deals (
        title, company_name, contact_name, contact_email, contact_phone,
        stage, client_id, package_id, sales_owner_id, commission_recipient_id,
        deal_value, service_revenue, sponsoring_budget, commission_rate,
        expected_close_date, won_date, payment_status, notes,
        commission_rule_snapshot
    ) VALUES (
        'Maison Didon Luxury Suites — Growth Retainer', 'Maison Didon Carthage', 'Kamel Didon',
        'direction@maisondidon.tn', '+21671777888',
        'won', v_client_id, v_pkg_id, v_worker_uid, v_worker_tm_id,
        2300, 1500, 800, 15,
        CURRENT_DATE - INTERVAL '14 days', now() - INTERVAL '5 days', 'paid',
        'Converted from qualified lead. Client finalized monthly contract. Sponsoring budget excluded from commission.',
        jsonb_build_object(
            'rule_key', 'initial_commission_rate',
            'rule_name', 'Initial Sales Commission Rate',
            'commission_rate', 15,
            'duration_months', 6,
            'commissionable_basis', 'service_revenue_only',
            'sponsoring_excluded', true,
            'snapshot_date', now()
        )
    ) RETURNING id INTO v_deal_id;

    -- Create matching commission record in sales_commissions
    INSERT INTO public.sales_commissions (
        deal_id, team_member_id, client_id, service_revenue, commission_rate,
        commission_amount, total_sale_amount, sponsoring_amount, period_month,
        status, notes, commission_rule_snapshot
    ) VALUES (
        v_deal_id, v_worker_tm_id, v_client_id, 1500, 15,
        225, 2300, 800, to_char(CURRENT_DATE, 'YYYY-MM'),
        'paid',
        'Initial sales commission (15% on 1,500 TND service revenue; 800 TND sponsoring excluded). Approved & Paid.',
        jsonb_build_object(
            'rule_key', 'initial_commission_rate',
            'rule_name', 'Initial Sales Commission Rate',
            'rate_percent', 15,
            'deal_type', 'initial',
            'commissionable_amount', 1500,
            'sponsoring_deducted', 800,
            'calculated_commission', 225
        )
    );
END $$;
