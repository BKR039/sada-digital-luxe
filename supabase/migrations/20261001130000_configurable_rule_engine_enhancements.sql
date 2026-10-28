-- ==============================================================================
-- SADA OS — CONFIGURABLE RULE ENGINE ENHANCEMENTS
-- Adds Operator, Severity, Applies To, Default Values, and Reset to Default RPC
-- ==============================================================================

-- 1. Add missing metadata and default value columns to business_rules
ALTER TABLE public.business_rules
  ADD COLUMN IF NOT EXISTS operator VARCHAR(20) DEFAULT '<=',
  ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'warning',
  ADD COLUMN IF NOT EXISTS applies_to VARCHAR(100) DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS default_numeric_value NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS default_boolean_value BOOLEAN,
  ADD COLUMN IF NOT EXISTS default_text_value TEXT,
  ADD COLUMN IF NOT EXISTS default_json_value JSONB,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 2. Add corresponding columns to business_rule_versions for complete auditability
ALTER TABLE public.business_rule_versions
  ADD COLUMN IF NOT EXISTS operator VARCHAR(20),
  ADD COLUMN IF NOT EXISTS severity VARCHAR(20),
  ADD COLUMN IF NOT EXISTS applies_to VARCHAR(100),
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- 3. Populate default values and metadata for all existing rules
UPDATE public.business_rules
SET
  default_numeric_value = numeric_value,
  default_boolean_value = boolean_value,
  default_text_value = text_value,
  default_json_value = json_value
WHERE default_numeric_value IS NULL AND default_text_value IS NULL AND default_boolean_value IS NULL;

-- 4. Seed and/or standardize canonical rules specified by Product Architecture
INSERT INTO public.business_rules (
  rule_key, rule_name, description, category, value_type, numeric_value, default_numeric_value, unit, operator, severity, applies_to, is_active
) VALUES
  (
    'low_profit_client_margin_percent',
    'Low-Profit Client Margin Threshold',
    'Clients with a net contribution margin below this percentage trigger low-margin alerts and are classified as LOW PROFIT in CRM and Executive decks.',
    'profitability',
    'numeric',
    20.0000,
    20.0000,
    '%',
    '<',
    'warning',
    'clients',
    true
  ),
  (
    'high_commission_amount',
    'High Commission Impact Alert',
    'Monthly salesperson commission payouts exceeding this TND amount trigger executive attention and Smart Insight warnings.',
    'sales_commissions',
    'numeric',
    200.0000,
    200.0000,
    'TND',
    '>',
    'info',
    'smart_insights',
    true
  ),
  (
    'high_fixed_burn_revenue_percent',
    'High Fixed Burn Revenue Ratio',
    'Fixed monthly recurring expenses (subscriptions, SaaS, licenses) exceeding this percentage of monthly revenue trigger burn rate warnings.',
    'fixed_burn',
    'numeric',
    40.0000,
    40.0000,
    '%',
    '>',
    'warning',
    'treasury',
    true
  ),
  (
    'runway_default_months',
    'Default Cash Runway Fallback',
    'Fallback runway duration assumed when company operates at cash breakeven or zero monthly recurring burn.',
    'cash_treasury',
    'numeric',
    12.0000,
    12.0000,
    'months',
    '==',
    'info',
    'treasury',
    true
  ),
  (
    'minimum_net_margin_for_sponsoring_efficiency',
    'Minimum Sponsoring Arbitrage Net Margin',
    'Target agency arbitrage net margin from paid media sponsoring. Margins below this trigger efficiency warnings.',
    'sponsoring_advertising',
    'numeric',
    15.0000,
    15.0000,
    '%',
    '>',
    'warning',
    'smart_insights',
    true
  )
ON CONFLICT (rule_key) DO UPDATE SET
  default_numeric_value = EXCLUDED.default_numeric_value,
  operator = EXCLUDED.operator,
  severity = EXCLUDED.severity,
  applies_to = EXCLUDED.applies_to;

-- Seed text rule for historical profit comparison behavior
INSERT INTO public.business_rules (
  rule_key, rule_name, description, category, value_type, text_value, default_text_value, unit, operator, severity, applies_to, is_active
) VALUES (
  'historical_profit_zero_behavior',
  'Historical Profit Zero Delta Behavior',
  'Defines KPI behavior when previous financial period net profit was exactly zero (null = display no percentage delta, zero = display 0%, hundred = display 100% when positive).',
  'profitability',
  'text',
  'null',
  'null',
  'mode',
  '==',
  'info',
  'kpi',
  true
)
ON CONFLICT (rule_key) DO UPDATE SET
  default_text_value = EXCLUDED.default_text_value,
  operator = EXCLUDED.operator,
  severity = EXCLUDED.severity,
  applies_to = EXCLUDED.applies_to;

-- Update operator, severity, and applies_to for existing rules
UPDATE public.business_rules SET operator = '<', severity = 'critical', applies_to = 'treasury' WHERE rule_key = 'critical_runway_months';
UPDATE public.business_rules SET operator = '<', severity = 'warning', applies_to = 'treasury' WHERE rule_key = 'warning_runway_months';
UPDATE public.business_rules SET operator = '>=', severity = 'info', applies_to = 'clients' WHERE rule_key = 'high_profit_contribution_tnd';
UPDATE public.business_rules SET operator = '>=', severity = 'info', applies_to = 'clients' WHERE rule_key = 'high_profit_margin_percent';
UPDATE public.business_rules SET operator = '==', severity = 'info', applies_to = 'sales' WHERE rule_key IN ('initial_sales_commission_rate', 'renewal_sales_commission_rate', 'upsell_sales_commission_rate', 'initial_commission_duration_months');
UPDATE public.business_rules SET operator = '==', severity = 'info', applies_to = 'sponsoring' WHERE rule_key IN ('sponsoring_purchase_rate', 'sponsoring_client_rate');
UPDATE public.business_rules SET operator = '>', severity = 'critical', applies_to = 'treasury' WHERE rule_key = 'receivables_critical_days';
UPDATE public.business_rules SET operator = '<=', severity = 'info', applies_to = 'notifications' WHERE rule_key = 'notification_deduplication_hours';
UPDATE public.business_rules SET operator = '<=', severity = 'info', applies_to = 'operations' WHERE rule_key = 'task_due_soon_lead_days';
UPDATE public.business_rules SET operator = '==', severity = 'info', applies_to = 'operations' WHERE rule_key = 'standard_monthly_working_hours';

-- 5. Create Canonical Reset to Default Function
CREATE OR REPLACE FUNCTION public.reset_business_rule_to_default(
  p_rule_id UUID,
  p_reason TEXT DEFAULT 'Reset to system default value'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule RECORD;
  v_result JSONB;
BEGIN
  -- Strict Super Admin check
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access Denied: Only Super Admin can reset business rules to default.';
  END IF;

  SELECT * INTO v_rule FROM public.business_rules WHERE id = p_rule_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business rule not found with ID %', p_rule_id;
  END IF;

  -- Reset values to default_*_value
  UPDATE public.business_rules
  SET
    numeric_value = COALESCE(default_numeric_value, numeric_value),
    boolean_value = COALESCE(default_boolean_value, boolean_value),
    text_value = COALESCE(default_text_value, text_value),
    json_value = COALESCE(default_json_value, json_value),
    updated_by = auth.uid(),
    updated_at = NOW()
  WHERE id = p_rule_id
  RETURNING to_jsonb(public.business_rules.*) INTO v_result;

  -- Update change reason on the version row created by trigger
  UPDATE public.business_rule_versions
  SET change_reason = p_reason
  WHERE rule_id = p_rule_id AND version = v_rule.version;

  -- Audit log entry
  INSERT INTO public.system_audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    before_state,
    after_state
  ) VALUES (
    auth.uid(),
    'BUSINESS_RULE_RESET_DEFAULT',
    'business_rule',
    v_rule.rule_key,
    jsonb_build_object(
      'numeric_value', v_rule.numeric_value,
      'boolean_value', v_rule.boolean_value,
      'text_value', v_rule.text_value,
      'version', v_rule.version
    ),
    v_result
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_business_rule_to_default(UUID, TEXT) TO authenticated;
