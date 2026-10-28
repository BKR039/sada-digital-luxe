-- ==============================================================================
-- SADA OS — FIX RESET BUSINESS RULE AUDIT LOGGING COLUMNS
-- Replaces obsolete before_state/after_state column references with
-- canonical old_values/new_values in public.reset_business_rule_to_default RPC.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.reset_business_rule_to_default(
  p_rule_id UUID,
  p_reason TEXT DEFAULT 'Reset to system default value'
)
RETURNS JSONB AS $$
DECLARE
  v_rule public.business_rules%ROWTYPE;
  v_result JSONB;
BEGIN
  -- Strict Super Admin authorization check
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin can reset business rules to default.'
      USING ERRCODE = '42501';
  END IF;

  -- Fetch existing rule
  SELECT * INTO v_rule
  FROM public.business_rules
  WHERE id = p_rule_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business rule not found for ID: %', p_rule_id;
  END IF;

  -- Update rule back to factory defaults
  UPDATE public.business_rules
  SET
    numeric_value = COALESCE(default_numeric_value, numeric_value),
    boolean_value = COALESCE(default_boolean_value, boolean_value),
    text_value = COALESCE(default_text_value, text_value),
    json_value = COALESCE(default_json_value, json_value),
    change_reason = p_reason,
    updated_by = auth.uid(),
    updated_at = NOW()
  WHERE id = p_rule_id
  RETURNING to_jsonb(public.business_rules.*) INTO v_result;

  -- Canonical audit log entry in public.system_audit_logs
  INSERT INTO public.system_audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    old_values,
    new_values,
    created_at
  ) VALUES (
    auth.uid(),
    'BUSINESS_RULE_RESET_DEFAULT',
    'business_rule',
    p_rule_id::TEXT,
    to_jsonb(v_rule),
    v_result,
    NOW()
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.reset_business_rule_to_default(UUID, TEXT) TO authenticated, service_role;
