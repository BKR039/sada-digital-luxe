-- ============================================================
-- Fix convert_lead_to_sale to use numeric_value from business_rules
-- ============================================================

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

    -- Read active commission rate from business_rules (fallback 15) using canonical column numeric_value
    SELECT COALESCE(numeric_value, 15)
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
        to_char(COALESCE(p_sale_date, CURRENT_DATE), 'YYYY-MM'),
        'pending',
        COALESCE(p_notes, 'Converted from lead'),
        v_snapshot
    )
    ON CONFLICT (deal_id) DO UPDATE SET
        commission_rate = EXCLUDED.commission_rate,
        commission_amount = EXCLUDED.commission_amount,
        service_revenue = EXCLUDED.service_revenue,
        total_sale_amount = EXCLUDED.total_sale_amount,
        sponsoring_amount = EXCLUDED.sponsoring_amount,
        commission_rule_snapshot = EXCLUDED.commission_rule_snapshot,
        notes = EXCLUDED.notes
    RETURNING id INTO v_comm_id;

    RETURN jsonb_build_object(
        'success', true,
        'deal_id', p_deal_id,
        'commission_id', v_comm_id,
        'commissionable_basis', v_comm_basis,
        'commission_rate', v_comm_rate,
        'commission_amount', v_comm_amount,
        'snapshot', v_snapshot
    );
END;
$$;
