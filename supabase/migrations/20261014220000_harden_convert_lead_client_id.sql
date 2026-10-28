-- =====================================================================
-- SADA OS MIGRATION: HARDEN LEAD CONVERSION & CANONICAL CLIENT RESOLUTION
-- Version: 20261014220000
-- Description:
-- 1. Enforces mandatory canonical client_id for convert_lead_to_sale RPC.
-- 2. Prevents NOT NULL constraint violation on public.sales_commissions.client_id.
-- 3. Verifies foreign key existence against public.clients before mutation.
-- 4. Atomically resolves and persists deals.commission_recipient_id inside
--    the transaction boundary, eliminating partial out-of-band updates.
-- 5. Preserves sponsoring deduction business rule and idempotency guards.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.convert_lead_to_sale(
    p_deal_id UUID,
    p_client_id UUID DEFAULT NULL,
    p_package_id UUID DEFAULT NULL,
    p_sale_amount NUMERIC DEFAULT 0,
    p_sponsoring_amount NUMERIC DEFAULT 0,
    p_payment_status TEXT DEFAULT 'paid',
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
    v_comm_recipient_id UUID;
    v_resolved_client_id UUID;
    v_pkg_name TEXT := 'Custom Package';
    v_comm_rate NUMERIC := 15;
    v_comm_basis NUMERIC;
    v_comm_amount NUMERIC;
    v_deal RECORD;
    v_comm_id UUID;
    v_snapshot JSONB;
    v_rate_check JSONB;
BEGIN
    -- 1. Verify authentication
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated'
            USING ERRCODE = '28000';
    END IF;

    -- 2. Abuse protection: rate limit conversions to max 30 per minute per user
    v_rate_check := public.check_rate_limit('convert_lead:' || v_user_id::text, 'entity_creation', 30, 60);
    IF (v_rate_check->>'allowed')::boolean = false THEN
        RAISE EXCEPTION 'Rate limit exceeded: Too many conversion requests. Please wait % seconds before retrying.', (v_rate_check->>'retry_after')
            USING ERRCODE = '42501';
    END IF;

    -- 3. Enforce sales.convert_lead granular permission
    IF NOT public.has_permission(v_user_id, 'sales.convert_lead') THEN
        RAISE EXCEPTION 'Unauthorized: Account lacks sales.convert_lead permission'
            USING ERRCODE = '42501';
    END IF;

    -- 4. Fetch existing deal
    SELECT * INTO v_deal
    FROM public.deals
    WHERE id = p_deal_id;

    IF v_deal.id IS NULL THEN
        RAISE EXCEPTION 'Deal % not found', p_deal_id
            USING ERRCODE = 'P0002';
    END IF;

    -- 5. Authorization check: worker can only convert their own deal unless admin
    IF NOT public.is_admin(v_user_id) AND v_deal.sales_owner_id != v_user_id THEN
        RAISE EXCEPTION 'Unauthorized: Worker may only convert their own assigned deal'
            USING ERRCODE = '42501';
    END IF;

    -- 6. Canonical client resolution and validation
    v_resolved_client_id := COALESCE(p_client_id, v_deal.client_id);
    IF v_resolved_client_id IS NULL THEN
        RAISE EXCEPTION 'A valid SADA Client ID is required to convert a lead and record sales commission.'
            USING ERRCODE = '23502';
    END IF;

    -- 7. Validate that canonical client exists in public.clients to satisfy foreign key constraint
    IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = v_resolved_client_id) THEN
        RAISE EXCEPTION 'Selected client % does not exist in public.clients.', v_resolved_client_id
            USING ERRCODE = '23503';
    END IF;

    -- 8. Resolve commission beneficiary team member ID atomically within the transaction
    v_comm_recipient_id := v_deal.commission_recipient_id;
    IF v_comm_recipient_id IS NULL THEN
        -- First attempt: team member matching the deal sales owner profile
        SELECT id INTO v_comm_recipient_id
        FROM public.team_members
        WHERE profile_id = COALESCE(v_deal.sales_owner_id, v_user_id)
        LIMIT 1;

        -- Second attempt: current authenticated actor if team member exists
        IF v_comm_recipient_id IS NULL THEN
            SELECT id INTO v_comm_recipient_id
            FROM public.team_members
            WHERE profile_id = v_user_id
            LIMIT 1;
        END IF;
    END IF;

    -- 9. Read package name if package_id provided
    IF p_package_id IS NOT NULL THEN
        SELECT name INTO v_pkg_name
        FROM public.package_catalog
        WHERE id = p_package_id;
    END IF;

    -- 10. Read active commission rate from business_rules (fallback 15) using canonical column numeric_value
    SELECT COALESCE(numeric_value, 15)
    INTO v_comm_rate
    FROM public.business_rules
    WHERE rule_key = 'initial_commission_rate' AND is_active = true
    LIMIT 1;

    IF v_comm_rate IS NULL THEN
        v_comm_rate := 15;
    END IF;

    -- 11. Commissionable amount calculation: Sale amount - Sponsoring (Strict Sponsoring Deduction)
    v_comm_basis := GREATEST(0, p_sale_amount - COALESCE(p_sponsoring_amount, 0));
    v_comm_amount := ROUND((v_comm_basis * v_comm_rate) / 100.0, 2);

    -- 12. Build immutable rule snapshot
    v_snapshot := jsonb_build_object(
        'rule_key', 'initial_commission_rate',
        'rule_name', 'Initial Sales Commission Rate',
        'rate_percent', v_comm_rate,
        'deal_type', 'initial',
        'total_amount', p_sale_amount,
        'sponsoring_deducted', COALESCE(p_sponsoring_amount, 0),
        'commissionable_amount', v_comm_basis,
        'calculated_commission', v_comm_amount,
        'client_id', v_resolved_client_id,
        'snapshot_date', now()
    );

    -- 13. Update deal to won atomically
    UPDATE public.deals
    SET stage = 'won',
        client_id = v_resolved_client_id,
        package_id = p_package_id,
        deal_value = p_sale_amount,
        service_revenue = v_comm_basis,
        sponsoring_budget = COALESCE(p_sponsoring_amount, 0),
        payment_status = p_payment_status,
        commission_rate = v_comm_rate,
        commission_recipient_id = COALESCE(v_comm_recipient_id, v_deal.commission_recipient_id),
        commission_rule_snapshot = v_snapshot,
        won_date = p_sale_date,
        notes = COALESCE(p_notes, v_deal.notes),
        updated_at = now()
    WHERE id = p_deal_id;

    -- 14. Idempotency: check if commission already recorded for this deal
    SELECT id INTO v_comm_id
    FROM public.sales_commissions
    WHERE deal_id = p_deal_id
    LIMIT 1;

    IF v_comm_id IS NULL AND v_comm_recipient_id IS NOT NULL THEN
        INSERT INTO public.sales_commissions (
            deal_id,
            team_member_id,
            client_id,
            package_id,
            package_name,
            total_sale_amount,
            service_revenue,
            sponsoring_amount,
            commission_rate,
            commission_amount,
            commission_rule_snapshot,
            period_month,
            status,
            notes
        ) VALUES (
            p_deal_id,
            v_comm_recipient_id,
            v_resolved_client_id,
            p_package_id,
            v_pkg_name,
            p_sale_amount,
            v_comm_basis,
            COALESCE(p_sponsoring_amount, 0),
            v_comm_rate,
            v_comm_amount,
            v_snapshot,
            to_char(p_sale_date, 'YYYY-MM'),
            CASE WHEN p_payment_status = 'paid' THEN 'paid' ELSE 'pending' END,
            'Generated via convert_lead_to_sale RPC'
        )
        RETURNING id INTO v_comm_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'deal_id', p_deal_id,
        'client_id', v_resolved_client_id,
        'commission_id', v_comm_id,
        'commission_amount', v_comm_amount,
        'commission_rate', v_comm_rate,
        'commissionable_basis', v_comm_basis
    );
END;
$$;

-- Enforce physical unique index on sales_commissions(deal_id) for concurrent request idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_commissions_deal_id_unique
    ON public.sales_commissions(deal_id)
    WHERE deal_id IS NOT NULL;

-- Strip excessive execution privileges from public pseudo-role and anonymous callers
REVOKE EXECUTE ON FUNCTION public.convert_lead_to_sale(
    UUID, UUID, UUID, NUMERIC, NUMERIC, TEXT, DATE, TEXT
) FROM PUBLIC, anon;

-- Ensure explicit execute grants for authenticated users and service_role
GRANT EXECUTE ON FUNCTION public.convert_lead_to_sale(
    UUID, UUID, UUID, NUMERIC, NUMERIC, TEXT, DATE, TEXT
) TO authenticated, service_role;

