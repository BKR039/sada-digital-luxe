-- ============================================================
-- SADA OS — MIGRATION: 20261010140000_harden_session_registration_and_isolation.sql
-- Prevent cross-user session theft and collision in register_user_session
-- ============================================================

CREATE OR REPLACE FUNCTION public.register_user_session(
    _session_id TEXT DEFAULT NULL,
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
    v_jwt_session_id TEXT := auth.jwt() ->> 'session_id';
    v_canonical_session_id TEXT := COALESCE(NULLIF(TRIM(_session_id), ''), v_jwt_session_id);
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthenticated');
    END IF;

    IF v_canonical_session_id IS NULL OR v_canonical_session_id = '' THEN
        v_canonical_session_id := 'sess_' || replace(gen_random_uuid()::text, '-', '');
    END IF;

    -- 1. Verify Account Status
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

    IF v_account_status IN ('deleted', 'deactivated') THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'ACCOUNT_INACTIVE',
            'message', 'This account has been deactivated.'
        );
    END IF;

    -- 2. Check Existing Session strictly by session_id
    SELECT * INTO v_existing_session
    FROM public.user_sessions
    WHERE session_id = v_canonical_session_id;

    IF v_existing_session.id IS NOT NULL THEN
        -- CRITICAL HARDENING: Cross-user session binding protection
        -- If session ID already belongs to another user, DO NOT allow session reuse or hijacking!
        -- Generate a new distinct session ID for the authenticated caller.
        IF v_existing_session.user_id <> v_user_id THEN
            v_canonical_session_id := 'sess_' || replace(gen_random_uuid()::text, '-', '');
            -- Fall through to insert fresh session for v_user_id
        ELSE
            IF v_existing_session.status = 'revoked' THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'error', 'SESSION_REVOKED',
                    'message', 'This session has been revoked.'
                );
            END IF;

            UPDATE public.user_sessions
            SET last_activity_at = v_now,
                status = 'active',
                jwt_session_id = COALESCE(jwt_session_id, v_jwt_session_id),
                updated_at = v_now
            WHERE id = v_existing_session.id;

            RETURN jsonb_build_object(
                'success', true,
                'session_id', v_existing_session.session_id,
                'jwt_session_id', v_jwt_session_id,
                'status', 'active',
                'is_new', false
            );
        END IF;
    END IF;

    -- 3. Register New Session
    INSERT INTO public.user_sessions (
        session_id,
        jwt_session_id,
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
        auth_method,
        metadata
    ) VALUES (
        v_canonical_session_id,
        v_jwt_session_id,
        v_user_id,
        v_email,
        'active',
        v_now,
        v_now,
        v_expires_at,
        _ip_address,
        _user_agent,
        COALESCE(_device_type, 'desktop'),
        _browser_name,
        _os_name,
        _auth_method,
        '{}'::jsonb
    );

    RETURN jsonb_build_object(
        'success', true,
        'session_id', v_canonical_session_id,
        'jwt_session_id', v_jwt_session_id,
        'status', 'active',
        'is_new', true
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_user_session(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_user_session(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;
