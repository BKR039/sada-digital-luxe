-- ============================================================
-- SADA WORK OS — Migration: 20261001200000_worker_sales_commissions_and_workspace_hardening.sql
-- 1. Grant Workers INSERT on sales_commissions strictly for own won deals
-- 2. Add RPC / Helper function for converting lead to sale with snapshot
-- 3. Seed comprehensive realistic workspace & demo data for QA Worker Lead
-- ============================================================

-- 1. RLS policies on sales_commissions
DROP POLICY IF EXISTS "Workers insert own deal commissions" ON public.sales_commissions;
CREATE POLICY "Workers insert own deal commissions"
  ON public.sales_commissions FOR INSERT
  WITH CHECK (
    public.is_admin(auth.uid()) OR
    (
      team_member_id = public.get_team_member_id(auth.uid()) AND
      deal_id IN (SELECT id FROM public.deals WHERE sales_owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins update sales_commissions" ON public.sales_commissions;
CREATE POLICY "Admins update sales_commissions"
  ON public.sales_commissions FOR UPDATE
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Super Admins delete sales_commissions" ON public.sales_commissions;
CREATE POLICY "Super Admins delete sales_commissions"
  ON public.sales_commissions FOR DELETE
  USING (public.is_super_admin(auth.uid()));

-- 2. Helper RPC function to convert lead to sale with authoritative commission snapshot
CREATE OR REPLACE FUNCTION public.convert_lead_to_sale(
    p_deal_id UUID,
    p_client_id UUID,
    p_package_id UUID,
    p_sale_amount NUMERIC,
    p_sponsoring_amount NUMERIC,
    p_payment_status TEXT DEFAULT 'unpaid',
    p_sale_date DATE DEFAULT CURRENT_DATE,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_team_member_id UUID;
    v_pkg_name TEXT := 'Custom Package';
    v_comm_rate NUMERIC := 15;
    v_comm_basis NUMERIC;
    v_comm_amount NUMERIC;
    v_deal RECORD;
    v_comm_id UUID;
    v_snapshot JSONB;
BEGIN
    -- Verify authentication
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Resolve worker team member ID
    SELECT id INTO v_team_member_id
    FROM public.team_members
    WHERE profile_id = v_user_id
    LIMIT 1;

    -- Fetch existing deal or verify access
    SELECT * INTO v_deal
    FROM public.deals
    WHERE id = p_deal_id;

    IF v_deal.id IS NULL THEN
        RAISE EXCEPTION 'Deal not found';
    END IF;

    -- Authorization check: worker can only convert their own deal unless admin
    IF NOT public.is_admin(v_user_id) AND v_deal.sales_owner_id != v_user_id THEN
        RAISE EXCEPTION 'Unauthorized to convert another worker deal';
    END IF;

    -- Read package name if package_id provided
    IF p_package_id IS NOT NULL THEN
        SELECT name INTO v_pkg_name
        FROM public.package_catalog
        WHERE id = p_package_id;
    END IF;

    -- Read active commission rate from business_rules (fallback 15)
    SELECT COALESCE((rule_value->>'rate')::numeric, (rule_value->>'value')::numeric, 15)
    INTO v_comm_rate
    FROM public.business_rules
    WHERE rule_key = 'initial_commission_rate' AND is_active = true
    LIMIT 1;

    IF v_comm_rate IS NULL THEN
        v_comm_rate := 15;
    END IF;

    -- Commissionable amount calculation: Sale amount - Sponsoring
    v_comm_basis := GREATEST(0, p_sale_amount - COALESCE(p_sponsoring_amount, 0));
    v_comm_amount := ROUND((v_comm_basis * v_comm_rate) / 100.0, 2);

    -- Build immutable rule snapshot
    v_snapshot := jsonb_build_object(
        'rule_key', 'initial_commission_rate',
        'rule_name', 'Initial Sales Commission Rate',
        'rate_percent', v_comm_rate,
        'deal_type', 'initial',
        'total_amount', p_sale_amount,
        'sponsoring_deducted', COALESCE(p_sponsoring_amount, 0),
        'commissionable_amount', v_comm_basis,
        'calculated_commission', v_comm_amount,
        'snapshot_date', now()
    );

    -- Update deal to won
    UPDATE public.deals
    SET stage = 'won',
        client_id = p_client_id,
        package_id = p_package_id,
        deal_value = p_sale_amount,
        service_revenue = v_comm_basis,
        sponsoring_budget = COALESCE(p_sponsoring_amount, 0),
        commission_rate = v_comm_rate,
        payment_status = p_payment_status,
        sale_date = p_sale_date,
        won_date = now(),
        notes = COALESCE(p_notes, notes),
        commission_rule_snapshot = v_snapshot
    WHERE id = p_deal_id;

    -- Insert or update matching commission record
    INSERT INTO public.sales_commissions (
        deal_id,
        team_member_id,
        client_id,
        package_id,
        package_name,
        service_revenue,
        commission_rate,
        commission_amount,
        total_sale_amount,
        sponsoring_amount,
        period_month,
        status,
        notes,
        commission_rule_snapshot
    ) VALUES (
        p_deal_id,
        v_team_member_id,
        p_client_id,
        p_package_id,
        v_pkg_name,
        v_comm_basis,
        v_comm_rate,
        v_comm_amount,
        p_sale_amount,
        COALESCE(p_sponsoring_amount, 0),
        to_char(p_sale_date, 'YYYY-MM'),
        CASE WHEN p_payment_status = 'paid' THEN 'approved' ELSE 'pending' END,
        format('Commission for deal %s (15%% on %s TND net service; %s TND sponsoring excluded)', v_deal.title, v_comm_basis, COALESCE(p_sponsoring_amount, 0)),
        v_snapshot
    )
    RETURNING id INTO v_comm_id;

    RETURN jsonb_build_object(
        'success', true,
        'deal_id', p_deal_id,
        'commission_id', v_comm_id,
        'commissionable_amount', v_comm_basis,
        'commission_rate', v_comm_rate,
        'commission_amount', v_comm_amount,
        'snapshot', v_snapshot
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.convert_lead_to_sale(UUID, UUID, UUID, NUMERIC, NUMERIC, TEXT, DATE, TEXT) TO authenticated, service_role;

-- 3. SEED REALISTIC WORKSPACE & MULTI-PROJECT MEMBERSHIP FOR WORKER
DO $$
DECLARE
    v_worker_uid UUID := '77f7a3d3-82c1-4744-8f01-0a1fd5f44bba';
    v_worker_tm_id UUID := '9c0937f7-4617-4803-b718-a3d9a5175dd9';
    v_proj_jannat UUID;
    v_proj_cafe UUID;
    v_client_jannat UUID;
    v_client_cafe UUID;
    v_lead_id UUID;
    v_won_deal_id UUID;
    v_pkg_id UUID;
BEGIN
    -- Jannat Sahara Project
    SELECT id, client_id INTO v_proj_jannat, v_client_jannat
    FROM public.client_projects
    WHERE lower(client_name) LIKE '%jannat sahara%'
    LIMIT 1;

    -- Café 707 Project
    SELECT id, client_id INTO v_proj_cafe, v_client_cafe
    FROM public.client_projects
    WHERE lower(client_name) LIKE '%caff%' OR lower(client_name) LIKE '%café%'
    LIMIT 1;

    -- Ensure project membership in Jannat Sahara
    IF v_proj_jannat IS NOT NULL THEN
        INSERT INTO public.project_members (project_id, profile_id, team_member_id, role)
        VALUES (v_proj_jannat, v_worker_uid, v_worker_tm_id, 'lead')
        ON CONFLICT (project_id, profile_id) DO UPDATE SET role = 'lead';

        UPDATE public.client_projects
        SET followup_status = 'waiting_for_client',
            followup_summary = 'Waiting for high-res drone footage approval from resort GM',
            followup_next_action = 'Follow up with Mansour on WhatsApp for video sign-off',
            followup_owner_id = v_worker_uid,
            next_followup_date = CURRENT_DATE
        WHERE id = v_proj_jannat;
    END IF;

    -- Ensure project membership in Café 707
    IF v_proj_cafe IS NOT NULL THEN
        INSERT INTO public.project_members (project_id, profile_id, team_member_id, role)
        VALUES (v_proj_cafe, v_worker_uid, v_worker_tm_id, 'specialist')
        ON CONFLICT (project_id, profile_id) DO UPDATE SET role = 'specialist';

        -- Assign a scheduled TODO task to worker in Café 707
        INSERT INTO public.project_tasks (
            project_id, client_id, title, category, service, status, priority,
            deadline, assignee_id, delivery_period, sort_order
        ) VALUES (
            v_proj_cafe, v_client_cafe, 'Menu Design Revamp & Story Highlights', 'Design', 'Branding & Visuals',
            'todo', 'medium', CURRENT_DATE + INTERVAL '5 days', v_worker_uid, '2026-10', 5
        );
    END IF;

    -- Ensure package
    SELECT id INTO v_pkg_id FROM public.package_catalog WHERE is_active = true LIMIT 1;

    -- Check if won deal exists for worker; if not create one matching example
    SELECT id INTO v_won_deal_id
    FROM public.deals
    WHERE sales_owner_id = v_worker_uid AND stage = 'won'
    LIMIT 1;

    IF v_won_deal_id IS NULL THEN
        INSERT INTO public.deals (
            title, company_name, contact_name, contact_email, contact_phone,
            stage, client_id, package_id, sales_owner_id, commission_recipient_id,
            deal_value, service_revenue, sponsoring_budget, commission_rate,
            expected_close_date, won_date, payment_status, notes,
            commission_rule_snapshot
        ) VALUES (
            'Maison Didon Luxury Suites — Growth Retainer', 'Maison Didon Carthage', 'Kamel Didon',
            'direction@maisondidon.tn', '+21671777888',
            'won', v_client_jannat, v_pkg_id, v_worker_uid, v_worker_tm_id,
            2300, 1500, 800, 15,
            CURRENT_DATE - INTERVAL '14 days', now() - INTERVAL '5 days', 'paid',
            'Converted from qualified lead. Client finalized monthly contract. Sponsoring budget excluded from commission.',
            jsonb_build_object(
                'rule_key', 'initial_commission_rate',
                'rule_name', 'Initial Sales Commission Rate',
                'rate_percent', 15,
                'deal_type', 'initial',
                'total_amount', 2300,
                'sponsoring_deducted', 800,
                'commissionable_amount', 1500,
                'calculated_commission', 225,
                'snapshot_date', now()
            )
        ) RETURNING id INTO v_won_deal_id;

        INSERT INTO public.sales_commissions (
            deal_id, team_member_id, client_id, service_revenue, commission_rate,
            commission_amount, total_sale_amount, sponsoring_amount, period_month,
            status, notes, commission_rule_snapshot
        ) VALUES (
            v_won_deal_id, v_worker_tm_id, v_client_jannat, 1500, 15,
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
    END IF;
END $$;
