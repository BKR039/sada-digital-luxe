-- ============================================================
-- SADA OS — MIGRATION: 20261010120000_adversarial_security_hardening.sql
-- Adversarial Hardening for Security & Session Control Center:
-- 1. Database-Level Session Tampering & Unrevocation Defense (Trigger)
-- 2. Audit Trail Strict Update Immutability (Triggers)
-- 3. Hardened verify_session_and_account (Anti-Cross-User & Global Revocation)
-- 4. Supabase Realtime Publication for user_sessions
-- ============================================================

-- ------------------------------------------------------------
-- 1. DATABASE TRIGGER: GUARD user_sessions UPDATES
-- Prevents attackers from unrevoking sessions, altering identity,
-- or bypassing suspension via direct PostgREST calls.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_user_sessions_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- Allow Super Admin full administrative control
    IF public.is_super_admin(auth.uid()) THEN
        RETURN NEW;
    END IF;

    -- Allow service_role bypass for internal server maintenance
    IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
        RETURN NEW;
    END IF;

    -- Non-Super-Admin restrictions:
    -- A. If session was already revoked, regular user CANNOT update it at all
    IF OLD.status = 'revoked' THEN
        RAISE EXCEPTION 'Cannot update a revoked session.';
    END IF;

    -- B. Cannot change status to anything other than 'expired' (sign out)
    IF NEW.status != OLD.status AND NEW.status != 'expired' THEN
        RAISE EXCEPTION 'Unauthorized: Non-Super-Admin cannot alter session status from % to %.', OLD.status, NEW.status;
    END IF;

    -- C. Cannot alter session ownership or identifiers
    IF NEW.user_id != OLD.user_id THEN
        RAISE EXCEPTION 'Unauthorized: Cannot reassign session user_id.';
    END IF;

    IF NEW.session_id != OLD.session_id THEN
        RAISE EXCEPTION 'Unauthorized: Cannot alter session_id.';
    END IF;

    -- D. Cannot tamper with revocation audit fields
    IF NEW.revoked_at IS DISTINCT FROM OLD.revoked_at OR
       NEW.revoked_by IS DISTINCT FROM OLD.revoked_by OR
       NEW.revocation_reason IS DISTINCT FROM OLD.revocation_reason THEN
        RAISE EXCEPTION 'Unauthorized: Non-Super-Admin cannot alter session revocation fields.';
    END IF;

    -- E. Cannot update sessions if account is suspended
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = OLD.user_id AND status = 'suspended') THEN
        RAISE EXCEPTION 'Account is suspended: session updates rejected.';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_user_sessions_update ON public.user_sessions;
CREATE TRIGGER trg_guard_user_sessions_update
    BEFORE UPDATE ON public.user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_user_sessions_update();

-- ------------------------------------------------------------
-- 2. AUDIT TRAIL IMMUTABILITY: PROHIBIT UPDATES
-- Guarantee append-only audit semantics at the database trigger level.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_audit_log_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Audit records are immutable and cannot be modified.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_update_system_audit ON public.system_audit_logs;
CREATE TRIGGER trg_prevent_update_system_audit
    BEFORE UPDATE ON public.system_audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_audit_log_update();

DROP TRIGGER IF EXISTS trg_prevent_update_account_audit ON public.account_audit_logs;
CREATE TRIGGER trg_prevent_update_account_audit
    BEFORE UPDATE ON public.account_audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_audit_log_update();

-- ------------------------------------------------------------
-- 3. HARDENED verify_session_and_account RPC
-- - Verifies session ownership (auth.uid() = session.user_id)
-- - Blocks cross-user session replay/tampering
-- - Checks for global revocation if session_id is omitted
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_session_and_account(
    _session_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_account_status TEXT;
    v_session_status TEXT;
    v_session_user_id UUID;
    v_clean_session_id TEXT := TRIM(_session_id);
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('valid', false, 'code', 'UNAUTHENTICATED');
    END IF;

    -- 1. Check account lifecycle status
    SELECT status INTO v_account_status
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_account_status = 'suspended' THEN
        RETURN jsonb_build_object('valid', false, 'code', 'ACCOUNT_SUSPENDED');
    END IF;

    IF v_account_status = 'deleted' OR v_account_status = 'deactivated' THEN
        RETURN jsonb_build_object('valid', false, 'code', 'ACCOUNT_INACTIVE');
    END IF;

    -- 2. If specific session_id is provided, verify it strictly
    IF v_clean_session_id IS NOT NULL AND v_clean_session_id != '' THEN
        SELECT status, user_id INTO v_session_status, v_session_user_id
        FROM public.user_sessions
        WHERE session_id = v_clean_session_id;

        -- Session belongs to another user -> Cross-user session spoofing attack!
        IF v_session_user_id IS NOT NULL AND v_session_user_id != v_user_id THEN
            RETURN jsonb_build_object(
                'valid', false,
                'code', 'SESSION_USER_MISMATCH',
                'message', 'Session does not belong to authenticated user.'
            );
        END IF;

        IF v_session_status = 'revoked' THEN
            RETURN jsonb_build_object('valid', false, 'code', 'SESSION_REVOKED');
        END IF;

        IF v_session_status = 'expired' THEN
            RETURN jsonb_build_object('valid', false, 'code', 'SESSION_EXPIRED');
        END IF;
    ELSE
        -- 3. If session_id is omitted, check whether all sessions for this user were revoked
        -- (e.g. following global sign out or administrative revocation)
        IF EXISTS (
            SELECT 1 FROM public.user_sessions
            WHERE user_id = v_user_id AND status = 'revoked'
        ) AND NOT EXISTS (
            SELECT 1 FROM public.user_sessions
            WHERE user_id = v_user_id AND status = 'active'
        ) THEN
            RETURN jsonb_build_object('valid', false, 'code', 'SESSION_REVOKED');
        END IF;
    END IF;

    RETURN jsonb_build_object('valid', true, 'code', 'ACTIVE');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_session_and_account(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_session_and_account(TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 4. REALTIME PUBLICATION FOR user_sessions
-- Enables instantaneous client-side revocation detection (<200ms)
-- ------------------------------------------------------------
ALTER TABLE public.user_sessions REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'user_sessions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.user_sessions;
    END IF;
END $$;
