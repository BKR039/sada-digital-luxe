-- ============================================================
-- SADA OS — BUSINESS RULES VERSIONING & REASON HARDENING
-- Ensures immutable version history records the NEW version state
-- alongside change_reason, actor, and full metadata.
-- ============================================================

-- 1. Ensure change_reason column exists on business_rules table
ALTER TABLE public.business_rules
ADD COLUMN IF NOT EXISTS change_reason TEXT NULL;

-- 2. Update automatic version archival trigger
CREATE OR REPLACE FUNCTION public.archive_business_rule_version()
RETURNS TRIGGER AS $$
BEGIN
    -- Only archive if a value, condition, status or policy actually changed
    IF (OLD.numeric_value IS DISTINCT FROM NEW.numeric_value OR
        OLD.boolean_value IS DISTINCT FROM NEW.boolean_value OR
        OLD.text_value IS DISTINCT FROM NEW.text_value OR
        OLD.json_value IS DISTINCT FROM NEW.json_value OR
        OLD.operator IS DISTINCT FROM NEW.operator OR
        OLD.severity IS DISTINCT FROM NEW.severity OR
        OLD.applies_to IS DISTINCT FROM NEW.applies_to OR
        OLD.is_active IS DISTINCT FROM NEW.is_active) THEN
        
        -- Increment version strictly
        NEW.version := OLD.version + 1;
        NEW.updated_at := now();
        
        -- Record the NEW version state in business_rule_versions
        INSERT INTO public.business_rule_versions (
            rule_id,
            rule_key,
            version,
            numeric_value,
            boolean_value,
            text_value,
            json_value,
            operator,
            severity,
            applies_to,
            metadata,
            effective_from,
            effective_until,
            change_reason,
            changed_by,
            created_at
        ) VALUES (
            NEW.id,
            NEW.rule_key,
            NEW.version,
            NEW.numeric_value,
            NEW.boolean_value,
            NEW.text_value,
            NEW.json_value,
            NEW.operator,
            NEW.severity,
            NEW.applies_to,
            NEW.metadata,
            COALESCE(NEW.effective_from, now()),
            NEW.effective_until,
            COALESCE(NEW.change_reason, 'Modified by Super Admin'),
            COALESCE(auth.uid(), NEW.updated_by),
            now()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS trg_archive_business_rule_version ON public.business_rules;
CREATE TRIGGER trg_archive_business_rule_version
    BEFORE UPDATE ON public.business_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.archive_business_rule_version();

-- 3. Strict immutability trigger on business_rule_versions
CREATE OR REPLACE FUNCTION public.prevent_rule_version_deletion()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'business_rule_versions is immutable. Historical version deletion is prohibited by regulatory audit policy.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_rule_version_deletion ON public.business_rule_versions;
CREATE TRIGGER trg_prevent_rule_version_deletion
    BEFORE DELETE ON public.business_rule_versions
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_rule_version_deletion();

-- 4. Update reset_business_rule_to_default RPC to pass change_reason to business_rules
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
    RAISE EXCEPTION 'Unauthorized: Only Super Admin can reset business rules to default.';
  END IF;

  -- Fetch existing rule
  SELECT * INTO v_rule
  FROM public.business_rules
  WHERE id = p_rule_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business rule not found for ID: %', p_rule_id;
  END IF;

  -- Update rule back to factory defaults; trigger will increment version and record p_reason
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
    p_rule_id::TEXT,
    to_jsonb(v_rule),
    v_result
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Backfill any missing current version rows in business_rule_versions
INSERT INTO public.business_rule_versions (
    rule_id,
    rule_key,
    version,
    numeric_value,
    boolean_value,
    text_value,
    json_value,
    operator,
    severity,
    applies_to,
    effective_from,
    change_reason,
    changed_by,
    created_at
)
SELECT
    r.id,
    r.rule_key,
    r.version,
    r.numeric_value,
    r.boolean_value,
    r.text_value,
    r.json_value,
    r.operator,
    r.severity,
    r.applies_to,
    r.effective_from,
    'System factory default baseline',
    r.updated_by,
    r.created_at
FROM public.business_rules r
WHERE NOT EXISTS (
    SELECT 1 FROM public.business_rule_versions v WHERE v.rule_id = r.id AND v.version = r.version
);
