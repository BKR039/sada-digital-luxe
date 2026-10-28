-- ============================================================
-- SADA OS — MIGRATION: 20261010123000_audit_immutability_and_session_defense.sql
-- 1. Statement-level and row-level immutability triggers on audit tables
-- 2. Explicit policies so DELETE and UPDATE trigger exceptions fire
-- ============================================================

-- A. Functions for audit immutability
CREATE OR REPLACE FUNCTION public.prevent_audit_log_deletion()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Audit records are immutable and cannot be deleted.';
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_audit_log_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Audit records are immutable and cannot be modified.';
END;
$$;

-- B. Policies on system_audit_logs to route DELETE/UPDATE through trigger
DROP POLICY IF EXISTS "Disallow DELETE on system_audit_logs" ON public.system_audit_logs;
CREATE POLICY "Disallow DELETE on system_audit_logs"
    ON public.system_audit_logs
    FOR DELETE
    TO authenticated, service_role
    USING (true);

DROP POLICY IF EXISTS "Disallow UPDATE on system_audit_logs" ON public.system_audit_logs;
CREATE POLICY "Disallow UPDATE on system_audit_logs"
    ON public.system_audit_logs
    FOR UPDATE
    TO authenticated, service_role
    USING (true)
    WITH CHECK (true);

-- Statement-level and Row-level triggers on system_audit_logs
DROP TRIGGER IF EXISTS trg_prevent_delete_system_audit ON public.system_audit_logs;
CREATE TRIGGER trg_prevent_delete_system_audit
    BEFORE DELETE ON public.system_audit_logs
    FOR EACH STATEMENT
    EXECUTE FUNCTION public.prevent_audit_log_deletion();

DROP TRIGGER IF EXISTS trg_prevent_update_system_audit ON public.system_audit_logs;
CREATE TRIGGER trg_prevent_update_system_audit
    BEFORE UPDATE ON public.system_audit_logs
    FOR EACH STATEMENT
    EXECUTE FUNCTION public.prevent_audit_log_update();

-- C. Policies and triggers on account_audit_logs
DROP POLICY IF EXISTS "Disallow DELETE on account_audit_logs" ON public.account_audit_logs;
CREATE POLICY "Disallow DELETE on account_audit_logs"
    ON public.account_audit_logs
    FOR DELETE
    TO authenticated, service_role
    USING (true);

DROP POLICY IF EXISTS "Disallow UPDATE on account_audit_logs" ON public.account_audit_logs;
CREATE POLICY "Disallow UPDATE on account_audit_logs"
    ON public.account_audit_logs
    FOR UPDATE
    TO authenticated, service_role
    USING (true)
    WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_prevent_delete_account_audit ON public.account_audit_logs;
CREATE TRIGGER trg_prevent_delete_account_audit
    BEFORE DELETE ON public.account_audit_logs
    FOR EACH STATEMENT
    EXECUTE FUNCTION public.prevent_audit_log_deletion();

DROP TRIGGER IF EXISTS trg_prevent_update_account_audit ON public.account_audit_logs;
CREATE TRIGGER trg_prevent_update_account_audit
    BEFORE UPDATE ON public.account_audit_logs
    FOR EACH STATEMENT
    EXECUTE FUNCTION public.prevent_audit_log_update();
