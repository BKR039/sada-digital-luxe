-- ============================================================
-- SADA OS — CENTRALIZED BUSINESS RULES & CONFIGURATION ENGINE
-- Canonical PostgreSQL Schema, Versioning, Immutability & RLS
-- ============================================================

-- 1. Create public.business_rules table
CREATE TABLE IF NOT EXISTS public.business_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_key TEXT UNIQUE NOT NULL,
    rule_name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
        'sales_commissions',
        'sponsoring_advertising',
        'profitability',
        'cash_treasury',
        'fixed_burn',
        'smart_insights',
        'notifications_alerts',
        'operations'
    )),
    value_type TEXT NOT NULL CHECK (value_type IN ('numeric', 'boolean', 'text', 'json')),
    numeric_value NUMERIC NULL,
    boolean_value BOOLEAN NULL,
    text_value TEXT NULL,
    json_value JSONB NULL,
    unit TEXT NULL,
    min_value NUMERIC NULL,
    max_value NUMERIC NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    effective_until TIMESTAMPTZ NULL,
    version INTEGER NOT NULL DEFAULT 1,
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create public.business_rule_versions table for historical audit
CREATE TABLE IF NOT EXISTS public.business_rule_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES public.business_rules(id) ON DELETE CASCADE,
    rule_key TEXT NOT NULL,
    version INTEGER NOT NULL,
    numeric_value NUMERIC NULL,
    boolean_value BOOLEAN NULL,
    text_value TEXT NULL,
    json_value JSONB NULL,
    effective_from TIMESTAMPTZ NOT NULL,
    effective_until TIMESTAMPTZ NULL,
    change_reason TEXT NULL,
    changed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Automatic Version Archival Trigger
CREATE OR REPLACE FUNCTION public.archive_business_rule_version()
RETURNS TRIGGER AS $$
BEGIN
    -- Only archive if a value or status actually changed
    IF (OLD.numeric_value IS DISTINCT FROM NEW.numeric_value OR
        OLD.boolean_value IS DISTINCT FROM NEW.boolean_value OR
        OLD.text_value IS DISTINCT FROM NEW.text_value OR
        OLD.json_value IS DISTINCT FROM NEW.json_value OR
        OLD.is_active IS DISTINCT FROM NEW.is_active) THEN
        
        -- Increment version
        NEW.version := OLD.version + 1;
        NEW.updated_at := now();
        
        -- Archive prior version
        INSERT INTO public.business_rule_versions (
            rule_id,
            rule_key,
            version,
            numeric_value,
            boolean_value,
            text_value,
            json_value,
            effective_from,
            effective_until,
            changed_by,
            created_at
        ) VALUES (
            OLD.id,
            OLD.rule_key,
            OLD.version,
            OLD.numeric_value,
            OLD.boolean_value,
            OLD.text_value,
            OLD.json_value,
            OLD.effective_from,
            now(),
            NEW.updated_by,
            now()
        );
        
        -- Set new effective_from
        NEW.effective_from := now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_archive_business_rule_version ON public.business_rules;
CREATE TRIGGER trg_archive_business_rule_version
    BEFORE UPDATE ON public.business_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.archive_business_rule_version();

-- 4. Prevent Deletion of Historical Rule Versions
CREATE OR REPLACE FUNCTION public.prevent_rule_version_deletion()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Business rule historical versions are immutable and cannot be deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_rule_version_deletion ON public.business_rule_versions;
CREATE TRIGGER trg_prevent_rule_version_deletion
    BEFORE DELETE ON public.business_rule_versions
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_rule_version_deletion();

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_business_rules_key ON public.business_rules(rule_key);
CREATE INDEX IF NOT EXISTS idx_business_rules_category ON public.business_rules(category);
CREATE INDEX IF NOT EXISTS idx_business_rule_versions_rule_id ON public.business_rule_versions(rule_id);
CREATE INDEX IF NOT EXISTS idx_business_rule_versions_key ON public.business_rule_versions(rule_key);

-- 6. Row Level Security (RLS)
ALTER TABLE public.business_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_rule_versions ENABLE ROW LEVEL SECURITY;

-- Read policy: All authenticated users can view active business rules for financial calculations
DROP POLICY IF EXISTS "Authenticated users can read business rules" ON public.business_rules;
CREATE POLICY "Authenticated users can read business rules"
    ON public.business_rules
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can read business rule versions" ON public.business_rule_versions;
CREATE POLICY "Authenticated users can read business rule versions"
    ON public.business_rule_versions
    FOR SELECT
    TO authenticated
    USING (true);

-- Mutation policy: ONLY Super Admin can insert, update, or delete business rules
DROP POLICY IF EXISTS "Super Admin can insert business rules" ON public.business_rules;
CREATE POLICY "Super Admin can insert business rules"
    ON public.business_rules
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super Admin can update business rules" ON public.business_rules;
CREATE POLICY "Super Admin can update business rules"
    ON public.business_rules
    FOR UPDATE
    TO authenticated
    USING (public.is_super_admin(auth.uid()))
    WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super Admin can delete business rules" ON public.business_rules;
CREATE POLICY "Super Admin can delete business rules"
    ON public.business_rules
    FOR DELETE
    TO authenticated
    USING (public.is_super_admin(auth.uid()));

-- Add to Supabase Realtime publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'business_rules'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.business_rules;
    END IF;
END $$;

-- 7. Seed Canonical Business Rules with Initial Values
INSERT INTO public.business_rules (
    rule_key, rule_name, description, category, value_type, numeric_value, unit, min_value, max_value
) VALUES
-- Category 1: Sales & Commissions
(
    'initial_commission_rate',
    'Initial Deal Commission Rate',
    'Default commission percentage earned by salesperson during the initial contract lifecycle.',
    'sales_commissions',
    'numeric',
    15,
    '%',
    0,
    100
),
(
    'initial_commission_duration_months',
    'Initial Commission Duration',
    'Duration in months that the initial acquisition commission rate applies before transitioning to renewal rate.',
    'sales_commissions',
    'numeric',
    6,
    'months',
    1,
    36
),
(
    'renewal_commission_rate',
    'Renewal Commission Rate',
    'Commission percentage earned by salesperson for contract renewals beyond initial duration.',
    'sales_commissions',
    'numeric',
    5,
    '%',
    0,
    100
),
(
    'renewal_commission_duration_months',
    'Renewal Commission Duration',
    'Duration in months that renewal commission rate applies (or ongoing).',
    'sales_commissions',
    'numeric',
    12,
    'months',
    1,
    60
),
(
    'upsell_commission_rate',
    'Upsell Commission Rate',
    'Commission percentage earned on package upgrades and service expansion.',
    'sales_commissions',
    'numeric',
    5,
    '%',
    0,
    100
),

-- Category 2: Sponsoring & Advertising
(
    'sponsoring_purchase_rate',
    'Benchmark USD Purchase Rate',
    'Estimated exchange rate (TND per 1 USD) incurred when funding international ad platforms (Meta, TikTok).',
    'sponsoring_advertising',
    'numeric',
    3.37,
    'TND/USD',
    1,
    10
),
(
    'sponsoring_client_rate',
    'Client Sponsoring Billing Rate',
    'Exchange rate (TND per 1 USD) billed to client for sponsored ad budget execution.',
    'sponsoring_advertising',
    'numeric',
    4.00,
    'TND/USD',
    1,
    10
),
(
    'sponsoring_min_margin_percent',
    'Minimum Sponsoring Arbitrage Margin',
    'Benchmark target margin percentage required on ad spend management.',
    'sponsoring_advertising',
    'numeric',
    15,
    '%',
    0,
    100
),

-- Category 3: Profitability
(
    'client_high_profit_margin_percent',
    'High Profit Margin Threshold',
    'Client contribution margin percentage threshold qualifying an account as HIGH PROFIT.',
    'profitability',
    'numeric',
    50,
    '%',
    0,
    100
),
(
    'client_high_profit_amount_tnd',
    'High Profit Amount Threshold',
    'Absolute monthly contribution profit in TND qualifying an account as HIGH PROFIT.',
    'profitability',
    'numeric',
    1000,
    'TND',
    0,
    100000
),
(
    'client_medium_profit_margin_percent',
    'Medium Profit Margin Threshold',
    'Client contribution margin percentage threshold qualifying an account as MEDIUM profit.',
    'profitability',
    'numeric',
    25,
    '%',
    0,
    100
),
(
    'client_medium_profit_amount_tnd',
    'Medium Profit Amount Threshold',
    'Absolute monthly contribution profit in TND qualifying an account as MEDIUM profit.',
    'profitability',
    'numeric',
    400,
    'TND',
    0,
    100000
),
(
    'low_margin_client_threshold_percent',
    'Low Margin Client Alert Threshold',
    'Threshold below which client margin triggers an executive margin warning.',
    'profitability',
    'numeric',
    20,
    '%',
    0,
    100
),

-- Category 4: Cash & Treasury
(
    'critical_runway_months',
    'Critical Runway Warning Threshold',
    'Cash runway duration in months below which a CRITICAL treasury alert is triggered.',
    'cash_treasury',
    'numeric',
    3,
    'months',
    0.5,
    24
),
(
    'warning_runway_months',
    'Moderate Runway Warning Threshold',
    'Cash runway duration in months below which a moderate treasury alert is triggered.',
    'cash_treasury',
    'numeric',
    6,
    'months',
    1,
    36
),

-- Category 5: Fixed Burn
(
    'fixed_burn_warning_percent',
    'Fixed Monthly Burn Warning Ratio',
    'Maximum healthy percentage of monthly revenue consumed by recurring SaaS and subscriptions.',
    'fixed_burn',
    'numeric',
    40,
    '%',
    5,
    100
),

-- Category 6: Smart Insights
(
    'high_commission_insight_threshold_tnd',
    'High Commission Impact Threshold',
    'Commission amount threshold triggering commission impact insights on client accounts.',
    'smart_insights',
    'numeric',
    200,
    'TND',
    0,
    10000
),

-- Category 7: Notifications & Alerts
(
    'notification_deduplication_hours',
    'Notification Deduplication Window',
    'Rolling time window in hours to prevent emitting duplicate notifications for identical events and entities.',
    'notifications_alerts',
    'numeric',
    24,
    'hours',
    1,
    168
),
(
    'task_due_soon_days',
    'Task Due Soon Notification Lead Days',
    'Number of days before a task deadline to emit an impending deadline alert.',
    'notifications_alerts',
    'numeric',
    2,
    'days',
    1,
    14
),

-- Category 8: Operations
(
    'standard_monthly_working_hours',
    'Standard Monthly Working Hours',
    'Standard labor hours per month per full-time specialist for hourly cost allocation calculation.',
    'operations',
    'numeric',
    160,
    'hours',
    40,
    300
),
(
    'max_salary_advance_percent',
    'Maximum Salary Advance Percentage',
    'Maximum percentage of monthly base salary allowed for an unapproved early advance request.',
    'operations',
    'numeric',
    50,
    '%',
    10,
    100
)
ON CONFLICT (rule_key) DO UPDATE SET
    rule_name = EXCLUDED.rule_name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    unit = EXCLUDED.unit,
    min_value = EXCLUDED.min_value,
    max_value = EXCLUDED.max_value;

COMMENT ON TABLE public.business_rules IS 'Centralized SADA OS business rules configuration. Modifiable ONLY by Super Admin.';
COMMENT ON TABLE public.business_rule_versions IS 'Immutable historical version audit log of all business rule modifications.';
