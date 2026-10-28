-- ============================================================
-- SADA OS — MIGRATION: 20261010103000_fix_security_session_schema_and_delete_policy.sql
-- 1. Fix email resolution in register_user_session (query auth.users instead of profiles.email)
-- 2. Add DELETE policy on user_sessions so trigger intercept is guaranteed
-- ============================================================

-- 1. FIX register_user_session email resolution
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

    -- 1. Verify Account Status & Email from auth.users + profiles
    SELECT COALESCE(p.status, 'active'), u.email
    INTO v_account_status, v_email
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE u.id = v_user_id;

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

-- 2. ADD DELETE POLICY ON user_sessions SO IMMUTABILITY TRIGGER ALWAYS INTERCEPTS
DROP POLICY IF EXISTS "Delete blocked on user_sessions" ON public.user_sessions;
CREATE POLICY "Delete blocked on user_sessions"
    ON public.user_sessions
    FOR DELETE
    TO authenticated, service_role
    USING (true);
