-- ============================================================
-- SADA OS — MIGRATION: 20261010133000_admin_revoke_audit_log_fix.sql
-- Ensure admin_revoke_session writes to system_audit_logs with entity_id and reason
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_revoke_session(
    _session_id TEXT,
    _reason TEXT DEFAULT 'Revoked by administrator'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_email TEXT;
    v_session RECORD;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_clean_reason TEXT := COALESCE(TRIM(_reason), 'Administrative security revocation');
BEGIN
    IF NOT public.is_super_admin(v_caller_id) THEN
        RAISE EXCEPTION 'Unauthorized: Only Super Admin can revoke sessions.';
    END IF;

    SELECT email INTO v_caller_email FROM auth.users WHERE id = v_caller_id;

    SELECT * INTO v_session
    FROM public.user_sessions
    WHERE session_id = _session_id;

    IF v_session.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'SESSION_NOT_FOUND');
    END IF;

    UPDATE public.user_sessions
    SET status = 'revoked',
        revoked_at = v_now,
        revoked_by = v_caller_id,
        revocation_reason = v_clean_reason,
        updated_at = v_now
    WHERE id = v_session.id;

    INSERT INTO public.system_audit_logs (
        action,
        entity_type,
        entity_id,
        actor_id,
        actor_name,
        actor_role,
        old_values,
        new_values,
        created_at
    ) VALUES (
        'SESSION_REVOKED',
        'user_session',
        _session_id,
        v_caller_id,
        COALESCE(v_caller_email, 'Super Admin'),
        'super_admin',
        jsonb_build_object('status', v_session.status),
        jsonb_build_object('status', 'revoked', 'reason', v_clean_reason),
        v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'session_id', v_session.session_id,
        'status', 'revoked',
        'target_user_id', v_session.user_id
    );
END;
$$;
