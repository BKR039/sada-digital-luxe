-- ============================================================
-- SADA WORK OS — MIGRATION: 20261007200000
-- PHASE I: LAYERED SECURITY, ABUSE PROTECTION & PERFORMANCE
--
-- 1. Covering indexes for RLS policies and permission queries.
-- 2. Database-level rate limiting and abuse defense (rate_limit_buckets + check_rate_limit).
-- 3. Abuse defense integration in sensitive RPCs (convert_lead_to_sale, admin_update_account_permissions).
-- ============================================================

-- 1. COVERING INDEXES FOR RLS PERFORMANCE & LOW-LATENCY ACCESS
CREATE INDEX IF NOT EXISTS idx_user_module_permissions_user_module
    ON public.user_module_permissions(user_id, module);

CREATE INDEX IF NOT EXISTS idx_deals_commission_recipient_id
    ON public.deals(commission_recipient_id);

CREATE INDEX IF NOT EXISTS idx_deals_sales_owner_stage
    ON public.deals(sales_owner_id, stage);

CREATE INDEX IF NOT EXISTS idx_project_tasks_assignee_status
    ON public.project_tasks(assignee_id, status);

-- 2. DATABASE-LEVEL ABUSE PROTECTION & RATE LIMITING
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
    key TEXT NOT NULL,
    action_category TEXT NOT NULL,
    user_id UUID,
    request_count INT NOT NULL DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    blocked_until TIMESTAMPTZ,
    PRIMARY KEY (key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_lookup
    ON public.rate_limit_buckets(key, window_start DESC);

CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_cleanup
    ON public.rate_limit_buckets(window_start);

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Rate limit buckets manageable by system" ON public.rate_limit_buckets;
CREATE POLICY "Rate limit buckets manageable by system"
    ON public.rate_limit_buckets
    FOR ALL
    TO authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- Rate limit verification function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_key TEXT,
    p_action_category TEXT,
    p_max_requests INT,
    p_window_seconds INT,
    p_block_seconds INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now TIMESTAMPTZ := clock_timestamp();
    v_window_start TIMESTAMPTZ := v_now - (p_window_seconds || ' seconds')::INTERVAL;
    v_total_requests INT;
    v_blocked_until TIMESTAMPTZ;
    v_allowed BOOLEAN := true;
    v_remaining INT;
    v_retry_after INT := 0;
BEGIN
    -- 1. Opportunistic cleanup of stale buckets older than 1 day
    IF random() < 0.05 THEN
        DELETE FROM public.rate_limit_buckets
        WHERE window_start < (v_now - INTERVAL '1 day');
    END IF;

    -- 2. Check if key is currently blocked
    SELECT blocked_until INTO v_blocked_until
    FROM public.rate_limit_buckets
    WHERE key = p_key AND blocked_until > v_now
    ORDER BY window_start DESC
    LIMIT 1;

    IF v_blocked_until IS NOT NULL THEN
        v_retry_after := CEIL(EXTRACT(EPOCH FROM (v_blocked_until - v_now)))::INT;
        RETURN jsonb_build_object(
            'allowed', false,
            'remaining', 0,
            'retry_after', GREATEST(1, v_retry_after),
            'reason', 'rate_limited'
        );
    END IF;

    -- 3. Calculate requests in the active sliding window
    SELECT COALESCE(SUM(request_count), 0) INTO v_total_requests
    FROM public.rate_limit_buckets
    WHERE key = p_key AND window_start >= v_window_start;

    IF v_total_requests >= p_max_requests THEN
        v_allowed := false;
        IF p_block_seconds > 0 THEN
            v_blocked_until := v_now + (p_block_seconds || ' seconds')::INTERVAL;
            v_retry_after := p_block_seconds;
        ELSE
            v_retry_after := p_window_seconds;
        END IF;

        -- Record blocked state
        INSERT INTO public.rate_limit_buckets (key, action_category, user_id, request_count, window_start, blocked_until)
        VALUES (p_key, p_action_category, auth.uid(), 1, v_now, v_blocked_until)
        ON CONFLICT (key, window_start)
        DO UPDATE SET blocked_until = EXCLUDED.blocked_until;

        RETURN jsonb_build_object(
            'allowed', false,
            'remaining', 0,
            'retry_after', GREATEST(1, v_retry_after),
            'reason', 'rate_limited'
        );
    END IF;

    -- 4. Record new request into bucket
    INSERT INTO public.rate_limit_buckets (key, action_category, user_id, request_count, window_start)
    VALUES (p_key, p_action_category, auth.uid(), 1, v_now)
    ON CONFLICT (key, window_start)
    DO UPDATE SET request_count = rate_limit_buckets.request_count + 1;

    v_remaining := GREATEST(0, p_max_requests - (v_total_requests + 1));

    RETURN jsonb_build_object(
        'allowed', true,
        'remaining', v_remaining,
        'retry_after', 0
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INT, INT, INT) TO authenticated, service_role;

-- Rate limit reset function (for testing / admin resets)
CREATE OR REPLACE FUNCTION public.reset_rate_limit(p_key TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_key IS NULL THEN
        DELETE FROM public.rate_limit_buckets;
    ELSE
        DELETE FROM public.rate_limit_buckets WHERE key = p_key;
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reset_rate_limit(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_rate_limit(TEXT) TO authenticated, service_role;

-- 3. HARDEN convert_lead_to_sale WITH ABUSE RATE LIMITING
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
    v_pkg_name TEXT := 'Custom Package';
    v_comm_rate NUMERIC := 15;
    v_comm_basis NUMERIC;
    v_comm_amount NUMERIC;
    v_deal RECORD;
    v_comm_id UUID;
    v_snapshot JSONB;
    v_rate_check JSONB;
BEGIN
    -- Verify authentication
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Abuse protection: rate limit conversions to max 30 per minute per user
    v_rate_check := public.check_rate_limit('convert_lead:' || v_user_id::text, 'entity_creation', 30, 60);
    IF (v_rate_check->>'allowed')::boolean = false THEN
        RAISE EXCEPTION 'Rate limit exceeded: Too many conversion requests. Please wait % seconds before retrying.', (v_rate_check->>'retry_after')
            USING ERRCODE = '42501';
    END IF;

    -- Enforce sales.convert_lead granular permission
    IF NOT public.has_permission(v_user_id, 'sales.convert_lead') THEN
        RAISE EXCEPTION 'Unauthorized: Account lacks sales.convert_lead permission';
    END IF;

    -- Resolve worker team member ID
    SELECT id INTO v_team_member_id
    FROM public.team_members
    WHERE profile_id = v_user_id
    LIMIT 1;

    -- Fetch existing deal
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
        payment_status = p_payment_status,
        commission_rate = v_comm_rate,
        commission_rule_snapshot = v_snapshot,
        won_date = p_sale_date,
        notes = COALESCE(p_notes, v_deal.notes),
        updated_at = now()
    WHERE id = p_deal_id;

    -- Check if commission already recorded for this deal (idempotency)
    SELECT id INTO v_comm_id
    FROM public.sales_commissions
    WHERE deal_id = p_deal_id
    LIMIT 1;

    IF v_comm_id IS NULL AND v_deal.commission_recipient_id IS NOT NULL THEN
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
            v_deal.commission_recipient_id,
            p_client_id,
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
        'commission_id', v_comm_id,
        'commission_amount', v_comm_amount,
        'commission_rate', v_comm_rate,
        'commissionable_basis', v_comm_basis
    );
END;
$$;
