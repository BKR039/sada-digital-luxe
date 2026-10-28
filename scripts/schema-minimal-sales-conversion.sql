-- =====================================================================
-- SADA OS — MINIMAL LOCAL TEST SCHEMA: SALES CONVERSION RPC
-- Target Database: sada_local_test (localhost ONLY)
-- Dependencies extracted from: 20261014220000_harden_convert_lead_client_id.sql
-- =====================================================================

-- 1. Emulate auth.uid() using transaction-local configuration
CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
$$;

-- 2. Clients table (Required by FK and existence check)
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Package catalog (Required by package_id resolution)
CREATE TABLE IF NOT EXISTS public.package_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL
);

-- 4. Team members (Required for commission recipient resolution)
CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL,
    name TEXT NOT NULL DEFAULT 'Synthetic Member'
);

-- 5. Business rules (Required for commission rate lookup)
CREATE TABLE IF NOT EXISTS public.business_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_key TEXT NOT NULL UNIQUE,
    numeric_value NUMERIC NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- Seed default initial commission rate rule
INSERT INTO public.business_rules (rule_key, numeric_value, is_active)
VALUES ('initial_commission_rate', 15, true)
ON CONFLICT (rule_key) DO UPDATE SET numeric_value = 15, is_active = true;

-- 6. Deals table
CREATE TABLE IF NOT EXISTS public.deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id),
    sales_owner_id UUID NOT NULL,
    package_id UUID REFERENCES public.package_catalog(id),
    commission_recipient_id UUID REFERENCES public.team_members(id),
    stage TEXT NOT NULL DEFAULT 'lead',
    deal_value NUMERIC DEFAULT 0,
    service_revenue NUMERIC DEFAULT 0,
    sponsoring_budget NUMERIC DEFAULT 0,
    payment_status TEXT DEFAULT 'pending',
    commission_rate NUMERIC,
    commission_rule_snapshot JSONB,
    won_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Sales commissions table (with strict NOT NULL on client_id and unique deal_id index)
CREATE TABLE IF NOT EXISTS public.sales_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID REFERENCES public.deals(id),
    team_member_id UUID NOT NULL REFERENCES public.team_members(id),
    client_id UUID NOT NULL REFERENCES public.clients(id),
    package_id UUID,
    package_name TEXT,
    total_sale_amount NUMERIC NOT NULL,
    service_revenue NUMERIC NOT NULL,
    sponsoring_amount NUMERIC NOT NULL,
    commission_rate NUMERIC NOT NULL,
    commission_amount NUMERIC NOT NULL,
    commission_rule_snapshot JSONB,
    period_month TEXT NOT NULL,
    status TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_commissions_deal_id_unique
    ON public.sales_commissions(deal_id)
    WHERE deal_id IS NOT NULL;

-- 7b. Test-only rollback verification trigger (only fires if deals.notes = 'TRIGGER_COMMISSION_FAILURE')
CREATE OR REPLACE FUNCTION public.trg_fn_rollback_test()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.deals WHERE id = NEW.deal_id AND notes = 'TRIGGER_COMMISSION_FAILURE') THEN
        RAISE EXCEPTION 'Simulated failure during commission creation' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_test_rollback_on_demand ON public.sales_commissions;
CREATE TRIGGER trg_test_rollback_on_demand
    BEFORE INSERT ON public.sales_commissions
    FOR EACH ROW EXECUTE FUNCTION public.trg_fn_rollback_test();

-- 8. Rate limit buckets and check_rate_limit function
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL,
    action_category TEXT NOT NULL,
    user_id UUID,
    request_count INT DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL,
    blocked_until TIMESTAMPTZ
);

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
    -- Check if key is currently blocked
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

    -- Calculate requests in the active sliding window
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

        INSERT INTO public.rate_limit_buckets (key, action_category, request_count, window_start, blocked_until)
        VALUES (p_key, p_action_category, 1, v_now, v_blocked_until);

        RETURN jsonb_build_object(
            'allowed', false,
            'remaining', 0,
            'retry_after', v_retry_after,
            'reason', 'rate_limited'
        );
    END IF;

    -- Record request
    INSERT INTO public.rate_limit_buckets (key, action_category, request_count, window_start)
    VALUES (p_key, p_action_category, 1, v_now);

    v_remaining := GREATEST(0, p_max_requests - (v_total_requests + 1));
    RETURN jsonb_build_object(
        'allowed', true,
        'remaining', v_remaining,
        'retry_after', 0
    );
END;
$$;

-- 9. RBAC & Granular Permission emulation
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    permission TEXT NOT NULL
);

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role IN ('admin', 'super_admin')
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    IF public.is_admin(_user_id) THEN
        RETURN true;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.user_permissions
        WHERE user_id = _user_id AND permission = _permission
    );
END;
$$;

-- 10. EXACT TARGET RPC from 20261014220000_harden_convert_lead_client_id.sql
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

-- Strip excessive execution privileges from public pseudo-role and anonymous callers
REVOKE EXECUTE ON FUNCTION public.convert_lead_to_sale(
    UUID, UUID, UUID, NUMERIC, NUMERIC, TEXT, DATE, TEXT
) FROM PUBLIC;

-- Ensure explicit execute grants for authenticated users and service_role
GRANT EXECUTE ON FUNCTION public.convert_lead_to_sale(
    UUID, UUID, UUID, NUMERIC, NUMERIC, TEXT, DATE, TEXT
) TO PUBLIC;

