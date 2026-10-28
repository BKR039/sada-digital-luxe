-- ============================================================
-- SADA OS — MIGRATION: 20261010131500_refine_session_closure_and_rbac.sql
-- Refine session registration, sibling session independence, and verify_session_and_account
-- ============================================================

-- 1. REFINED register_user_session
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
        v_canonical_session_id := 'sess_' || gen_random_uuid()::text;
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
        COALESCE(_auth_method, 'password'),
        jsonb_build_object('registered_at', v_now, 'jwt_session_id', v_jwt_session_id)
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

-- 2. REFINED verify_session_and_account
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
    v_clean_id TEXT := TRIM(_session_id);
    v_jwt_session_id TEXT := auth.jwt() ->> 'session_id';
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

    IF v_account_status IN ('deleted', 'deactivated') THEN
        RETURN jsonb_build_object('valid', false, 'code', 'ACCOUNT_INACTIVE');
    END IF;

    -- 2. If specific session_id is provided, check that specific session
    IF v_clean_id IS NOT NULL AND v_clean_id <> '' THEN
        SELECT status, user_id INTO v_session_status, v_session_user_id
        FROM public.user_sessions
        WHERE session_id = v_clean_id;

        IF v_session_user_id IS NULL THEN
            RETURN jsonb_build_object(
                'valid', false,
                'code', 'SESSION_NOT_FOUND',
                'message', 'Session does not exist.'
            );
        END IF;

        IF v_session_user_id <> v_user_id THEN
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

        RETURN jsonb_build_object('valid', true, 'code', 'ACTIVE');
    END IF;

    -- 3. If session_id is omitted, check JWT session_id if present
    IF v_jwt_session_id IS NOT NULL AND v_jwt_session_id <> '' THEN
        SELECT status, user_id INTO v_session_status, v_session_user_id
        FROM public.user_sessions
        WHERE (session_id = v_jwt_session_id OR jwt_session_id = v_jwt_session_id)
          AND user_id = v_user_id
        ORDER BY created_at DESC
        LIMIT 1;

        IF v_session_status = 'revoked' THEN
            RETURN jsonb_build_object('valid', false, 'code', 'SESSION_REVOKED');
        END IF;

        IF v_session_status = 'expired' THEN
            RETURN jsonb_build_object('valid', false, 'code', 'SESSION_EXPIRED');
        END IF;
    END IF;

    -- 4. Check whether all sessions for this user were revoked (global sign out)
    IF EXISTS (
        SELECT 1 FROM public.user_sessions
        WHERE user_id = v_user_id AND status = 'revoked'
    ) AND NOT EXISTS (
        SELECT 1 FROM public.user_sessions
        WHERE user_id = v_user_id AND status = 'active'
    ) THEN
        RETURN jsonb_build_object('valid', false, 'code', 'SESSION_REVOKED');
    END IF;

    RETURN jsonb_build_object('valid', true, 'code', 'ACTIVE');
END;
$$;

-- 3. REFINED revoke_user_session strictly by session_id
CREATE OR REPLACE FUNCTION public.revoke_user_session(
    _session_id TEXT,
    _reason TEXT DEFAULT 'Revoked by user'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_session RECORD;
    v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthenticated');
    END IF;

    SELECT * INTO v_session
    FROM public.user_sessions
    WHERE session_id = _session_id;

    IF v_session.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'SESSION_NOT_FOUND');
    END IF;

    IF v_session.user_id <> v_caller_id AND NOT public.is_super_admin(v_caller_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'UNAUTHORIZED');
    END IF;

    UPDATE public.user_sessions
    SET status = 'revoked',
        revoked_at = v_now,
        revoked_by = v_caller_id,
        revocation_reason = _reason,
        updated_at = v_now
    WHERE id = v_session.id;

    RETURN jsonb_build_object('success', true, 'status', 'revoked', 'session_id', v_session.session_id);
END;
$$;

-- 4. REFINED admin_revoke_session strictly by session_id
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
    v_session RECORD;
    v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
    IF NOT public.is_super_admin(v_caller_id) THEN
        RAISE EXCEPTION 'Unauthorized: Only Super Admin can revoke sessions.';
    END IF;

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
        revocation_reason = _reason,
        updated_at = v_now
    WHERE id = v_session.id;

    RETURN jsonb_build_object(
        'success', true,
        'session_id', v_session.session_id,
        'status', 'revoked',
        'target_user_id', v_session.user_id
    );
END;
$$;
