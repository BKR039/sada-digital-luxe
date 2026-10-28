-- ============================================================
-- SADA WORK OS — MIGRATION: 20261007180000
-- PHASE H: SALES GRANULAR ACCESS HARDENING
--
-- 1. convert_lead_to_sale RPC: Enforce public.has_permission(v_user_id, 'sales.convert_lead')
-- 2. RLS Policies on public.deals:
--    - SELECT: requires public.has_permission(auth.uid(), 'sales.view')
--    - INSERT: requires public.has_permission(auth.uid(), 'sales.create_lead')
--    - UPDATE: requires public.has_permission(auth.uid(), 'sales.edit_lead') OR 'sales.change_stage' OR 'sales.convert_lead'
--    - DELETE: requires public.is_super_admin(auth.uid()) AND public.has_permission(auth.uid(), 'sales.delete_lead')
-- 3. Database Trigger: trg_guard_deals_action_permissions
--    - Enforces stage change vs deal edit vs deal conversion vs delete
--    - Enforces worker data scope isolation
-- ============================================================

-- 1. UPDATE convert_lead_to_sale RPC WITH GRANULAR PERMISSION ENFORCEMENT
CREATE OR REPLACE FUNCTION public.convert_lead_to_sale(
    p_deal_id UUID,
    p_client_id UUID,
    p_package_id UUID,
    p_sale_amount NUMERIC,
    p_sponsoring_amount NUMERIC,
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
BEGIN
    -- Verify authentication
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
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

-- 2. HARDEN RLS ON public.deals FOR GRANULAR ACCESS
DROP POLICY IF EXISTS "Deals viewable by authenticated users" ON public.deals;
DROP POLICY IF EXISTS "Deals manageable by authenticated users" ON public.deals;
DROP POLICY IF EXISTS "Staff read authorized deals" ON public.deals;
DROP POLICY IF EXISTS "Staff insert authorized deals" ON public.deals;
DROP POLICY IF EXISTS "Staff update authorized deals" ON public.deals;
DROP POLICY IF EXISTS "Super Admins delete deals" ON public.deals;

-- SELECT: requires sales.view AND role/ownership authorization
CREATE POLICY "Staff read authorized deals"
    ON public.deals FOR SELECT
    USING (
        public.has_permission(auth.uid(), 'sales.view') AND (
            public.is_admin(auth.uid()) OR
            sales_owner_id = auth.uid() OR
            commission_recipient_id = auth.uid() OR
            commission_recipient_id IN (
                SELECT id FROM public.team_members WHERE profile_id = auth.uid()
            )
        )
    );

-- INSERT: requires sales.create_lead AND valid ownership attribution
CREATE POLICY "Staff insert authorized deals"
    ON public.deals FOR INSERT
    WITH CHECK (
        public.has_permission(auth.uid(), 'sales.create_lead') AND (
            public.is_admin(auth.uid()) OR
            sales_owner_id = auth.uid()
        )
    );

-- UPDATE: requires relevant sales action permission (edit_lead, change_stage, or convert_lead)
CREATE POLICY "Staff update authorized deals"
    ON public.deals FOR UPDATE
    USING (
        (public.has_permission(auth.uid(), 'sales.edit_lead') OR
         public.has_permission(auth.uid(), 'sales.change_stage') OR
         public.has_permission(auth.uid(), 'sales.convert_lead')) AND (
            public.is_admin(auth.uid()) OR
            sales_owner_id = auth.uid()
        )
    )
    WITH CHECK (
        (public.has_permission(auth.uid(), 'sales.edit_lead') OR
         public.has_permission(auth.uid(), 'sales.change_stage') OR
         public.has_permission(auth.uid(), 'sales.convert_lead')) AND (
            public.is_admin(auth.uid()) OR
            sales_owner_id = auth.uid()
        )
    );

-- DELETE: strictly Super Admin exclusive with sales.delete_lead permission
CREATE POLICY "Super Admins delete deals"
    ON public.deals FOR DELETE
    USING (
        public.is_super_admin(auth.uid()) AND
        public.has_permission(auth.uid(), 'sales.delete_lead')
    );

-- 3. DATABASE TRIGGER TO GUARD FIELD-LEVEL SALES MUTATIONS
CREATE OR REPLACE FUNCTION public.guard_deals_action_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _actor_id UUID := auth.uid();
BEGIN
    -- Service role or internal background jobs bypass
    IF _actor_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Super Admin has root bypass
    IF public.is_super_admin(_actor_id) THEN
        RETURN NEW;
    END IF;

    -- 1. General sales module access check
    IF NOT public.has_permission(_actor_id, 'sales.view') THEN
        RAISE EXCEPTION 'Unauthorized: Access to module ''sales'' is disabled for this account.'
            USING ERRCODE = '42501';
    END IF;

    -- 2. Worker Data Scope Isolation: Workers cannot modify deals owned by other reps
    IF NOT public.is_admin(_actor_id) THEN
        IF OLD.sales_owner_id IS NOT NULL AND OLD.sales_owner_id != _actor_id THEN
            RAISE EXCEPTION 'Data Scope Violation: Worker cannot modify deals assigned to other sales representatives.'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 3. Stage mutations
    IF NEW.stage IS DISTINCT FROM OLD.stage THEN
        IF NEW.stage = 'won' THEN
            IF NOT public.has_permission(_actor_id, 'sales.convert_lead') THEN
                RAISE EXCEPTION 'Unauthorized: Action ''sales.convert_lead'' on module ''sales'' is prohibited for this account.'
                    USING ERRCODE = '42501';
            END IF;
        ELSE
            IF NOT public.has_permission(_actor_id, 'sales.change_stage') THEN
                RAISE EXCEPTION 'Unauthorized: Action ''sales.change_stage'' on module ''sales'' is prohibited for this account.'
                    USING ERRCODE = '42501';
            END IF;
        END IF;
    END IF;

    -- 4. Deal definition edits (non-stage fields)
    IF (
        NEW.title IS DISTINCT FROM OLD.title OR
        NEW.company_name IS DISTINCT FROM OLD.company_name OR
        NEW.contact_name IS DISTINCT FROM OLD.contact_name OR
        NEW.contact_email IS DISTINCT FROM OLD.contact_email OR
        NEW.contact_phone IS DISTINCT FROM OLD.contact_phone OR
        NEW.package_id IS DISTINCT FROM OLD.package_id OR
        NEW.deal_value IS DISTINCT FROM OLD.deal_value OR
        NEW.service_revenue IS DISTINCT FROM OLD.service_revenue OR
        NEW.sponsoring_budget IS DISTINCT FROM OLD.sponsoring_budget OR
        NEW.notes IS DISTINCT FROM OLD.notes OR
        NEW.expected_close_date IS DISTINCT FROM OLD.expected_close_date
    ) THEN
        IF NOT public.has_permission(_actor_id, 'sales.edit_lead') THEN
            RAISE EXCEPTION 'Unauthorized: Action ''sales.edit_lead'' on module ''sales'' is prohibited for this account.'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_deals_action_permissions ON public.deals;
CREATE TRIGGER trg_guard_deals_action_permissions
    BEFORE UPDATE ON public.deals
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_deals_action_permissions();
