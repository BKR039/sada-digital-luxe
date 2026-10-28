-- ============================================================
-- SADA OS — MIGRATION: 20261010100000_sada_security_and_session_control_center.sql
-- Unified SADA Security & Session Control Center:
-- 1. Canonical public.user_sessions inventory & lifecycle tracking
-- 2. Rule-based public.security_alerts detection table
-- 3. Server-enforced RPCs for session revocation & global sign-out
-- 4. Server-enforced account suspension with instant session invalidation
-- 5. Safe emergency controls (anti-self-lockout & last Super Admin protection)
-- 6. Real-time session & account validity verification RPC
-- 7. Immutable audit logging triggers for all security operations
-- ============================================================

-- ------------------------------------------------------------
-- 1. CANONICAL USER SESSIONS TABLE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_email TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'idle', 'expired', 'revoked')),
    sign_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    revocation_reason TEXT,
    ip_address TEXT,
    user_agent TEXT,
    device_type TEXT DEFAULT 'desktop',
    browser_name TEXT,
    os_name TEXT,
    auth_method TEXT DEFAULT 'password',
    is_suspicious BOOLEAN NOT NULL DEFAULT false,
    suspicious_reason TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_status ON public.user_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON public.user_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_activity ON public.user_sessions(last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_created_at ON public.user_sessions(created_at DESC);

-- Enable RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view their own sessions" ON public.user_sessions;
CREATE POLICY "Users view their own sessions"
    ON public.user_sessions
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Users update their own session activity" ON public.user_sessions;
CREATE POLICY "Users update their own session activity"
    ON public.user_sessions
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id OR public.is_super_admin(auth.uid()))
    WITH CHECK (auth.uid() = user_id OR public.is_super_admin(auth.uid()));

-- Immutability on sessions: DELETE is blocked to preserve audit history!
DROP TRIGGER IF EXISTS trg_prevent_delete_user_sessions ON public.user_sessions;
CREATE OR REPLACE FUNCTION public.prevent_delete_user_sessions()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Historical session records are immutable and cannot be deleted.';
END;
$$;

CREATE TRIGGER trg_prevent_delete_user_sessions
    BEFORE DELETE ON public.user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_delete_user_sessions();

-- ------------------------------------------------------------
-- 2. SECURITY ALERTS TABLE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.security_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT,
    session_id UUID REFERENCES public.user_sessions(id) ON DELETE SET NULL,
    trigger_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    recommended_action TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'dismissed')),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON public.security_alerts(status);
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON public.security_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_security_alerts_user ON public.security_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_created_at ON public.security_alerts(created_at DESC);

ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super Admins access security_alerts" ON public.security_alerts;
CREATE POLICY "Super Admins access security_alerts"
    ON public.security_alerts
    FOR ALL
    TO authenticated, service_role
    USING (public.is_super_admin(auth.uid()))
    WITH CHECK (public.is_super_admin(auth.uid()));

-- ------------------------------------------------------------
-- 3. CLIENT AUTH & SESSION LIFECYCLE RPCs
-- ------------------------------------------------------------

-- Register or Heartbeat Session
CREATE OR REPLACE FUNCTION public.register_user_session(
    _session_id TEXT,
    _user_agent TEXT DEFAULT NULL,
    _ip_address TEXT DEFAULT NULL,
    _device_type TEXT DEFAULT 'desktop',
    _browser_name TEXT DEFAULT NULL,
    _os_name TEXT DEFAULT NULL,
    _auth_method TEXT DEFAULT 'password'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_email TEXT;
    v_account_status TEXT;
    v_existing_session RECORD;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_expires_at TIMESTAMPTZ := v_now + INTERVAL '7 days';
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthenticated');
    END IF;

    -- 1. Verify Account Status
    SELECT status, email INTO v_account_status, v_email
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_account_status = 'suspended' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'ACCOUNT_SUSPENDED',
            'message', 'Your account has been suspended by an administrator.'
        );
    END IF;

    IF v_account_status = 'deleted' OR v_account_status = 'deactivated' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'ACCOUNT_INACTIVE',
            'message', 'This account has been deactivated.'
        );
    END IF;

    -- 2. Check Existing Session
    SELECT * INTO v_existing_session
    FROM public.user_sessions
    WHERE session_id = _session_id;

    IF v_existing_session.id IS NOT NULL THEN
        -- If previously revoked, DENY immediately
        IF v_existing_session.status = 'revoked' THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'SESSION_REVOKED',
                'message', 'This session has been revoked by an administrator.'
            );
        END IF;

        -- Update activity and metadata
        UPDATE public.user_sessions
        SET last_activity_at = v_now,
            status = 'active',
            user_agent = COALESCE(_user_agent, user_agent),
            ip_address = COALESCE(_ip_address, ip_address),
            device_type = COALESCE(_device_type, device_type),
            browser_name = COALESCE(_browser_name, browser_name),
            os_name = COALESCE(_os_name, os_name),
            updated_at = v_now
        WHERE id = v_existing_session.id;

        RETURN jsonb_build_object(
            'success', true,
            'session_id', _session_id,
            'status', 'active',
            'is_new', false
        );
    END IF;

    -- 3. Insert New Session
    INSERT INTO public.user_sessions (
        session_id,
        user_id,
        user_email,
        status,
        sign_in_at,
        last_activity_at,
        expires_at,
        ip_address,
        user_agent,
        device_type,
        browser_name,
        os_name,
        auth_method
    ) VALUES (
        _session_id,
        v_user_id,
        v_email,
        'active',
        v_now,
        v_now,
        v_expires_at,
        _ip_address,
        _user_agent,
        _device_type,
        _browser_name,
        _os_name,
        _auth_method
    );

    -- Log Session Creation in System Audit
    INSERT INTO public.system_audit_logs (
        action,
        entity_type,
        entity_id,
        actor_id,
        actor_name,
        actor_role,
        new_values,
        ip_address,
        user_agent,
        created_at
    ) VALUES (
        'SESSION_CREATED',
        'user_session',
        _session_id,
        v_user_id,
        COALESCE(v_email, 'User'),
        (SELECT role::text FROM public.user_roles WHERE user_id = v_user_id LIMIT 1),
        jsonb_build_object(
            'session_id', _session_id,
            'device_type', _device_type,
            'browser', _browser_name,
            'os', _os_name,
            'auth_method', _auth_method
        ),
        _ip_address,
        _user_agent,
        v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'session_id', _session_id,
        'status', 'active',
        'is_new', true
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_user_session(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_user_session(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- Record Session Activity Heartbeat (throttled by client)
CREATE OR REPLACE FUNCTION public.record_session_heartbeat(
    _session_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_status TEXT;
    v_account_status TEXT;
    v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthenticated');
    END IF;

    -- Verify profile is not suspended
    SELECT status INTO v_account_status
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_account_status = 'suspended' THEN
        RETURN jsonb_build_object('success', false, 'error', 'ACCOUNT_SUSPENDED');
    END IF;

    -- Check session
    SELECT status INTO v_status
    FROM public.user_sessions
    WHERE session_id = _session_id;

    IF v_status IS NULL THEN
        -- Session not yet recorded; auto-register basic record
        INSERT INTO public.user_sessions (
            session_id, user_id, status, sign_in_at, last_activity_at, expires_at
        ) VALUES (
            _session_id, v_user_id, 'active', v_now, v_now, v_now + INTERVAL '7 days'
        ) ON CONFLICT (session_id) DO UPDATE
        SET last_activity_at = v_now, updated_at = v_now;

        RETURN jsonb_build_object('success', true, 'status', 'active');
    END IF;

    IF v_status = 'revoked' THEN
        RETURN jsonb_build_object('success', false, 'error', 'SESSION_REVOKED');
    END IF;

    UPDATE public.user_sessions
    SET last_activity_at = v_now,
        status = 'active',
        updated_at = v_now
    WHERE session_id = _session_id;

    RETURN jsonb_build_object('success', true, 'status', 'active');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_session_heartbeat(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_session_heartbeat(TEXT) TO authenticated, service_role;

-- Fast Session & Account Validity Verification (Used by client guards & mutations)
CREATE OR REPLACE FUNCTION public.verify_session_and_account(
    _session_id TEXT
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
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('valid', false, 'code', 'UNAUTHENTICATED');
    END IF;

    SELECT status INTO v_account_status
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_account_status = 'suspended' THEN
        RETURN jsonb_build_object('valid', false, 'code', 'ACCOUNT_SUSPENDED');
    END IF;

    IF _session_id IS NOT NULL AND _session_id != '' THEN
        SELECT status INTO v_session_status
        FROM public.user_sessions
        WHERE session_id = _session_id;

        IF v_session_status = 'revoked' THEN
            RETURN jsonb_build_object('valid', false, 'code', 'SESSION_REVOKED');
        END IF;
    END IF;

    RETURN jsonb_build_object('valid', true, 'code', 'ACTIVE');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_session_and_account(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_session_and_account(TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 4. EMERGENCY SESSION CONTROL & ADMINISTRATIVE ACTIONS
-- ------------------------------------------------------------

-- A. Revoke Single Session
CREATE OR REPLACE FUNCTION public.admin_revoke_session(
    _session_id TEXT,
    _reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_id UUID := auth.uid();
    v_actor_email TEXT;
    v_target RECORD;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_clean_reason TEXT := COALESCE(TRIM(_reason), 'Administrative security revocation');
BEGIN
    -- 1. Super Admin Authorization Guard
    IF NOT public.is_super_admin(v_actor_id) THEN
        RAISE EXCEPTION 'Unauthorized: Only Super Admin can revoke sessions.';
    END IF;

    SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor_id;

    -- 2. Find target session
    SELECT * INTO v_target
    FROM public.user_sessions
    WHERE session_id = _session_id;

    IF v_target.id IS NULL THEN
        RAISE EXCEPTION 'Session not found.';
    END IF;

    -- 3. Update session status
    UPDATE public.user_sessions
    SET status = 'revoked',
        revoked_at = v_now,
        revoked_by = v_actor_id,
        revocation_reason = v_clean_reason,
        updated_at = v_now
    WHERE id = v_target.id;

    -- 4. Append Immutable Audit Trail (System Audit Logs)
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
        v_actor_id,
        COALESCE(v_actor_email, 'Super Admin'),
        'super_admin',
        jsonb_build_object('status', v_target.status, 'last_activity_at', v_target.last_activity_at),
        jsonb_build_object(
            'status', 'revoked',
            'reason', v_clean_reason,
            'target_user_id', v_target.user_id,
            'target_email', v_target.user_email
        ),
        v_now
    );

    -- 5. Append Immutable Account Audit Trail
    INSERT INTO public.account_audit_logs (
        actor_id,
        actor_email,
        target_user_id,
        target_email,
        action,
        metadata
    ) VALUES (
        v_actor_id,
        v_actor_email,
        v_target.user_id,
        v_target.user_email,
        'session_revoked',
        jsonb_build_object(
            'session_id', _session_id,
            'reason', v_clean_reason,
            'device_type', v_target.device_type,
            'browser', v_target.browser_name,
            'ip_address', v_target.ip_address,
            'timestamp', v_now
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'session_id', _session_id,
        'target_user_id', v_target.user_id,
        'status', 'revoked'
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_revoke_session(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_revoke_session(TEXT, TEXT) TO authenticated, service_role;

-- B. Sign Out Everywhere (Revoke All Sessions for User)
CREATE OR REPLACE FUNCTION public.admin_revoke_all_user_sessions(
    _target_user_id UUID,
    _reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_id UUID := auth.uid();
    v_actor_email TEXT;
    v_target_email TEXT;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_clean_reason TEXT := COALESCE(TRIM(_reason), 'Global session revocation (Sign out everywhere)');
    v_revoked_count INT;
BEGIN
    -- 1. Super Admin Guard
    IF NOT public.is_super_admin(v_actor_id) THEN
        RAISE EXCEPTION 'Unauthorized: Only Super Admin can perform global session revocation.';
    END IF;

    SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor_id;
    SELECT email INTO v_target_email FROM auth.users WHERE id = _target_user_id;

    IF v_target_email IS NULL THEN
        RAISE EXCEPTION 'Target user not found.';
    END IF;

    -- 2. Revoke all active or idle sessions for this user
    UPDATE public.user_sessions
    SET status = 'revoked',
        revoked_at = v_now,
        revoked_by = v_actor_id,
        revocation_reason = v_clean_reason,
        updated_at = v_now
    WHERE user_id = _target_user_id AND status IN ('active', 'idle');

    GET DIAGNOSTICS v_revoked_count = ROW_COUNT;

    -- 3. Audit Trails
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
        'GLOBAL_SIGN_OUT',
        'user_account',
        _target_user_id::text,
        v_actor_id,
        COALESCE(v_actor_email, 'Super Admin'),
        'super_admin',
        jsonb_build_object('action', 'sign_out_everywhere'),
        jsonb_build_object(
            'revoked_count', v_revoked_count,
            'reason', v_clean_reason,
            'target_user_id', _target_user_id,
            'target_email', v_target_email
        ),
        v_now
    );

    INSERT INTO public.account_audit_logs (
        actor_id,
        actor_email,
        target_user_id,
        target_email,
        action,
        metadata
    ) VALUES (
        v_actor_id,
        v_actor_email,
        _target_user_id,
        v_target_email,
        'global_sign_out',
        jsonb_build_object(
            'revoked_sessions_count', v_revoked_count,
            'reason', v_clean_reason,
            'timestamp', v_now
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'target_user_id', _target_user_id,
        'revoked_count', v_revoked_count
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_revoke_all_user_sessions(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_revoke_all_user_sessions(UUID, TEXT) TO authenticated, service_role;

-- C. Suspend Account with Session Invalidation (Upgrades admin_suspend_account)
CREATE OR REPLACE FUNCTION public.admin_suspend_account_with_sessions(
    _target_user_id UUID,
    _reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_id UUID := auth.uid();
    v_actor_email TEXT;
    v_target_email TEXT;
    v_target_role TEXT;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_clean_reason TEXT := COALESCE(TRIM(_reason), 'Account suspended for security compliance');
    v_revoked_sessions_count INT := 0;
BEGIN
    -- 1. Super Admin Guard
    IF NOT public.is_super_admin(v_actor_id) THEN
        RAISE EXCEPTION 'Unauthorized: Only Super Admin can suspend accounts.';
    END IF;

    -- 2. Anti-Self-Lockout Guard
    IF v_actor_id = _target_user_id THEN
        RAISE EXCEPTION 'Cannot suspend own account (administrative self-lockout protection).';
    END IF;

    SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor_id;
    SELECT email INTO v_target_email FROM auth.users WHERE id = _target_user_id;

    IF v_target_email IS NULL THEN
        RAISE EXCEPTION 'Target account not found.';
    END IF;

    -- 3. Last Active Super Admin Protection
    SELECT role::TEXT INTO v_target_role FROM public.user_roles WHERE user_id = _target_user_id LIMIT 1;
    IF v_target_role = 'super_admin' THEN
        IF public.count_active_super_admins() <= 1 THEN
            RAISE EXCEPTION 'At least one active Super Admin is required.';
        END IF;
    END IF;

    -- 4. Mark Profile as suspended
    UPDATE public.profiles
    SET status = 'suspended',
        updated_at = v_now
    WHERE id = _target_user_id;

    -- 5. Ban in auth.users (blocks GoTrue login)
    UPDATE auth.users
    SET banned_until = '3000-01-01 00:00:00+00'::timestamptz,
        updated_at = v_now
    WHERE id = _target_user_id;

    -- 6. Deactivate team_members record
    UPDATE public.team_members
    SET is_active = false,
        updated_at = v_now
    WHERE profile_id = _target_user_id OR LOWER(email) = LOWER(v_target_email);

    -- 7. Real-Time Access Enforcement: Invalidate all existing sessions in user_sessions
    UPDATE public.user_sessions
    SET status = 'revoked',
        revoked_at = v_now,
        revoked_by = v_actor_id,
        revocation_reason = 'Account suspended: ' || v_clean_reason,
        updated_at = v_now
    WHERE user_id = _target_user_id AND status IN ('active', 'idle');

    GET DIAGNOSTICS v_revoked_sessions_count = ROW_COUNT;

    -- 8. Audit Trails
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
        'ACCOUNT_SUSPENDED',
        'user_account',
        _target_user_id::text,
        v_actor_id,
        COALESCE(v_actor_email, 'Super Admin'),
        'super_admin',
        jsonb_build_object('status', 'active'),
        jsonb_build_object(
            'status', 'suspended',
            'reason', v_clean_reason,
            'revoked_sessions', v_revoked_sessions_count,
            'target_email', v_target_email
        ),
        v_now
    );

    INSERT INTO public.account_audit_logs (
        actor_id,
        actor_email,
        target_user_id,
        target_email,
        action,
        metadata
    ) VALUES (
        v_actor_id,
        v_actor_email,
        _target_user_id,
        v_target_email,
        'account_suspended',
        jsonb_build_object(
            'reason', v_clean_reason,
            'revoked_sessions_count', v_revoked_sessions_count,
            'timestamp', v_now
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'user_id', _target_user_id,
        'status', 'suspended',
        'revoked_sessions', v_revoked_sessions_count
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_suspend_account_with_sessions(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_suspend_account_with_sessions(UUID, TEXT) TO authenticated, service_role;

-- D. Reactivate Account with Fresh Authentication Enforced
CREATE OR REPLACE FUNCTION public.admin_reactivate_account_with_security(
    _target_user_id UUID,
    _reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_id UUID := auth.uid();
    v_actor_email TEXT;
    v_target_email TEXT;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_clean_reason TEXT := COALESCE(TRIM(_reason), 'Account reactivated by administrator');
BEGIN
    IF NOT public.is_super_admin(v_actor_id) THEN
        RAISE EXCEPTION 'Unauthorized: Only Super Admin can reactivate accounts.';
    END IF;

    SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor_id;
    SELECT email INTO v_target_email FROM auth.users WHERE id = _target_user_id;

    IF v_target_email IS NULL THEN
        RAISE EXCEPTION 'Account not found.';
    END IF;

    -- 1. Restore Profile status
    UPDATE public.profiles
    SET status = 'active',
        updated_at = v_now
    WHERE id = _target_user_id;

    -- 2. Clear ban in auth.users
    UPDATE auth.users
    SET banned_until = NULL,
        updated_at = v_now
    WHERE id = _target_user_id;

    -- 3. Restore team_members
    UPDATE public.team_members
    SET is_active = true,
        updated_at = v_now
    WHERE profile_id = _target_user_id OR LOWER(email) = LOWER(v_target_email);

    -- NOTE: Intentionally do NOT restore revoked sessions!
    -- This enforces the requirement: "Reactivation does not restore revoked sessions; requires fresh authentication."

    -- 4. Audit Log
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
        'ACCOUNT_REACTIVATED',
        'user_account',
        _target_user_id::text,
        v_actor_id,
        COALESCE(v_actor_email, 'Super Admin'),
        'super_admin',
        jsonb_build_object('status', 'suspended'),
        jsonb_build_object(
            'status', 'active',
            'reason', v_clean_reason,
            'target_email', v_target_email
        ),
        v_now
    );

    INSERT INTO public.account_audit_logs (
        actor_id,
        actor_email,
        target_user_id,
        target_email,
        action,
        metadata
    ) VALUES (
        v_actor_id,
        v_actor_email,
        _target_user_id,
        v_target_email,
        'account_reactivated',
        jsonb_build_object('reason', v_clean_reason, 'timestamp', v_now)
    );

    RETURN jsonb_build_object('success', true, 'user_id', _target_user_id, 'status', 'active');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_reactivate_account_with_security(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reactivate_account_with_security(UUID, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 5. SECURITY KPI & INVENTORY PROJECTIONS
-- ------------------------------------------------------------

-- A. List Sessions for Super Admin
CREATE OR REPLACE FUNCTION public.admin_list_user_sessions(
    _user_id UUID DEFAULT NULL,
    _status TEXT DEFAULT NULL,
    _limit INT DEFAULT 100,
    _offset INT DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    session_id TEXT,
    user_id UUID,
    user_email TEXT,
    display_name TEXT,
    role TEXT,
    account_status TEXT,
    session_status TEXT,
    sign_in_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT,
    ip_address TEXT,
    user_agent TEXT,
    device_type TEXT,
    browser_name TEXT,
    os_name TEXT,
    auth_method TEXT,
    is_suspicious BOOLEAN,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_super_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Unauthorized: Only Super Admin can view session inventory.';
    END IF;

    RETURN QUERY
    SELECT
        s.id,
        s.session_id,
        s.user_id,
        s.user_email,
        COALESCE(p.display_name, split_part(s.user_email, '@', 1))::TEXT AS display_name,
        COALESCE(ur.role::TEXT, 'worker')::TEXT AS role,
        COALESCE(p.status, 'active')::TEXT AS account_status,
        s.status::TEXT AS session_status,
        s.sign_in_at,
        s.last_activity_at,
        s.expires_at,
        s.revoked_at,
        s.revocation_reason,
        s.ip_address,
        s.user_agent,
        s.device_type,
        s.browser_name,
        s.os_name,
        s.auth_method,
        s.is_suspicious,
        s.created_at
    FROM public.user_sessions s
    LEFT JOIN public.profiles p ON p.id = s.user_id
    LEFT JOIN public.user_roles ur ON ur.user_id = s.user_id
    WHERE (_user_id IS NULL OR s.user_id = _user_id)
      AND (_status IS NULL OR _status = 'all' OR s.status = _status)
    ORDER BY s.last_activity_at DESC
    LIMIT _limit
    OFFSET _offset;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_user_sessions(UUID, TEXT, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_user_sessions(UUID, TEXT, INT, INT) TO authenticated, service_role;

-- B. Security KPIs Calculation
CREATE OR REPLACE FUNCTION public.admin_get_security_kpis()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_active_sessions INT;
    v_unique_active_users INT;
    v_revoked_sessions INT;
    v_suspended_accounts INT;
    v_open_alerts INT;
    v_high_risk_actions INT;
BEGIN
    IF NOT public.is_super_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Unauthorized: Only Super Admin can view security KPIs.';
    END IF;

    -- 1. Active sessions (with activity in last 24h)
    SELECT COUNT(*), COUNT(DISTINCT user_id)
    INTO v_active_sessions, v_unique_active_users
    FROM public.user_sessions
    WHERE status = 'active' AND last_activity_at > (now() - INTERVAL '24 hours');

    -- 2. Revoked sessions in last 30 days
    SELECT COUNT(*)
    INTO v_revoked_sessions
    FROM public.user_sessions
    WHERE status = 'revoked' AND revoked_at > (now() - INTERVAL '30 days');

    -- 3. Suspended accounts
    SELECT COUNT(*)
    INTO v_suspended_accounts
    FROM public.profiles
    WHERE status = 'suspended';

    -- 4. Open security alerts
    SELECT COUNT(*)
    INTO v_open_alerts
    FROM public.security_alerts
    WHERE status = 'open';

    -- 5. High-risk administrative actions in last 7 days
    SELECT COUNT(*)
    INTO v_high_risk_actions
    FROM public.system_audit_logs
    WHERE action IN ('ACCOUNT_SUSPENDED', 'SESSION_REVOKED', 'GLOBAL_SIGN_OUT', 'ROLE_CHANGE', 'PERMISSIONS_UPDATED')
      AND created_at > (now() - INTERVAL '7 days');

    RETURN jsonb_build_object(
        'active_sessions_count', COALESCE(v_active_sessions, 0),
        'unique_active_users_count', COALESCE(v_unique_active_users, 0),
        'revoked_sessions_count', COALESCE(v_revoked_sessions, 0),
        'suspended_accounts_count', COALESCE(v_suspended_accounts, 0),
        'open_security_alerts_count', COALESCE(v_open_alerts, 0),
        'high_risk_actions_count', COALESCE(v_high_risk_actions, 0),
        'last_security_sync_at', now()
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_security_kpis() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_security_kpis() TO authenticated, service_role;

-- C. Record Failed Sign-In & Trigger Security Alert if repeated
CREATE OR REPLACE FUNCTION public.record_failed_sign_in_attempt(
    _email TEXT,
    _ip_address TEXT DEFAULT NULL,
    _user_agent TEXT DEFAULT NULL,
    _reason TEXT DEFAULT 'Invalid credentials'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_email TEXT := LOWER(TRIM(_email));
    v_recent_failures INT;
    v_user_id UUID;
    v_alert_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM auth.users WHERE LOWER(email) = v_clean_email;

    -- Record in system audit logs
    INSERT INTO public.system_audit_logs (
        action,
        entity_type,
        entity_id,
        actor_id,
        actor_name,
        actor_role,
        old_values,
        new_values,
        ip_address,
        user_agent,
        created_at
    ) VALUES (
        'AUTH_FAILED',
        'auth_attempt',
        v_clean_email,
        v_user_id,
        COALESCE(v_clean_email, 'Anonymous'),
        'unauthenticated',
        jsonb_build_object('reason', _reason),
        jsonb_build_object('email', v_clean_email, 'attempt_at', now()),
        _ip_address,
        _user_agent,
        now()
    );

    -- Count failures for this email in the last 15 minutes
    SELECT COUNT(*) INTO v_recent_failures
    FROM public.system_audit_logs
    WHERE action = 'AUTH_FAILED'
      AND entity_id = v_clean_email
      AND created_at > (now() - INTERVAL '15 minutes');

    -- If 3 or more failed sign-in attempts, generate an automated Security Alert
    IF v_recent_failures >= 3 THEN
        -- Check if open alert already exists
        SELECT id INTO v_alert_id
        FROM public.security_alerts
        WHERE user_email = v_clean_email AND rule_id = 'REPEATED_AUTH_FAILURES' AND status = 'open'
        LIMIT 1;

        IF v_alert_id IS NULL THEN
            INSERT INTO public.security_alerts (
                rule_id,
                severity,
                title,
                description,
                user_id,
                user_email,
                trigger_evidence,
                recommended_action,
                status
            ) VALUES (
                'REPEATED_AUTH_FAILURES',
                'high',
                'Repeated Failed Sign-In Attempts Detected',
                'Multiple consecutive failed authentication attempts (' || v_recent_failures || ') detected for ' || v_clean_email || ' within 15 minutes.',
                v_user_id,
                v_clean_email,
                jsonb_build_object(
                    'failure_count', v_recent_failures,
                    'last_ip', _ip_address,
                    'user_agent', _user_agent,
                    'window_minutes', 15
                ),
                'Inspect IP origin, notify the user, or temporarily suspend account if unauthorized.',
                'open'
            );
        END IF;
    END IF;

    RETURN jsonb_build_object('success', true, 'recent_failures', v_recent_failures);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_failed_sign_in_attempt(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_failed_sign_in_attempt(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
