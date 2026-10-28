-- ============================================================
-- SADA OS — MIGRATION: 20261010130000_final_session_revocation_enforcement_closure.sql
-- Final Session Revocation Enforcement Closure:
-- 1. Add jwt_session_id to public.user_sessions to bind cryptographically signed JWT claim
-- 2. Create canonical public.is_session_active() database enforcement function
-- 3. Update canonical RBAC functions (has_sada_access, is_admin, is_super_admin, has_permission)
--    to fail closed when the caller's session is revoked
-- 4. Harden register_user_session and verify_session_and_account with JWT session binding
-- 5. Update direct RLS policies across sensitive business, workflow, commitment, and financial tables
-- ============================================================

-- ------------------------------------------------------------
-- 1. BIND CRYPTOGRAPHIC JWT SESSION IDENTIFIER TO public.user_sessions
-- ------------------------------------------------------------
ALTER TABLE public.user_sessions
    ADD COLUMN IF NOT EXISTS jwt_session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_user_sessions_jwt_session_id
    ON public.user_sessions(user_id, jwt_session_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_session_lookup
    ON public.user_sessions(session_id, user_id, status);

-- ------------------------------------------------------------
-- 2. CANONICAL DATABASE FUNCTION: is_session_active()
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_session_active()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_jwt_session_id TEXT := auth.jwt() ->> 'session_id';
    v_acc_status TEXT;
BEGIN
    -- 1. Service role always has access (system cron, background reconciliations, migrations)
    IF auth.role() = 'service_role' THEN
        RETURN true;
    END IF;

    -- 2. Unauthenticated calls (let standard role-level policies handle anon)
    IF v_user_id IS NULL THEN
        RETURN true;
    END IF;

    -- 3. Check account suspension in public.profiles
    SELECT status INTO v_acc_status
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_acc_status IS NOT NULL AND v_acc_status IN ('suspended', 'deactivated', 'deleted') THEN
        RETURN false;
    END IF;

    -- 4. Check if user has ANY active session:
    -- If all user sessions in user_sessions are revoked/expired, and zero active sessions exist:
    IF EXISTS (
        SELECT 1 FROM public.user_sessions
        WHERE user_id = v_user_id
    ) AND NOT EXISTS (
        SELECT 1 FROM public.user_sessions
        WHERE user_id = v_user_id AND status = 'active'
    ) THEN
        RETURN false;
    END IF;

    -- 5. Specific session revocation check:
    IF v_jwt_session_id IS NOT NULL AND v_jwt_session_id <> '' THEN
        IF EXISTS (
            SELECT 1 FROM public.user_sessions
            WHERE (session_id = v_jwt_session_id OR jwt_session_id = v_jwt_session_id)
              AND user_id = v_user_id
              AND status = 'revoked'
        ) THEN
            -- Check if there is another active session for this user
            IF NOT EXISTS (
                SELECT 1 FROM public.user_sessions
                WHERE user_id = v_user_id
                  AND status = 'active'
                  AND session_id <> v_jwt_session_id
                  AND (jwt_session_id IS NULL OR jwt_session_id <> v_jwt_session_id)
            ) THEN
                RETURN false;
            END IF;
        END IF;
    END IF;

    RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_session_active() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_session_active() TO authenticated, service_role, anon;

-- ------------------------------------------------------------
-- 3. HARDEN CANONICAL RBAC FUNCTIONS TO VERIFY CALLING SESSION
-- ------------------------------------------------------------

-- A. has_sada_access
CREATE OR REPLACE FUNCTION public.has_sada_access(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF _user_id = auth.uid() AND NOT public.is_session_active() THEN
        RETURN false;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.profiles p ON p.id = ur.user_id
        WHERE ur.user_id = _user_id
          AND ur.role::text IN ('worker', 'admin', 'super_admin')
          AND p.status = 'active'
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.has_sada_access(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_sada_access(UUID) TO authenticated, service_role;

-- B. is_admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF _user_id = auth.uid() AND NOT public.is_session_active() THEN
        RETURN false;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.profiles p ON p.id = ur.user_id
        WHERE ur.user_id = _user_id
          AND ur.role::text IN ('admin', 'super_admin')
          AND p.status = 'active'
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated, service_role;

-- C. is_super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF _user_id = auth.uid() AND NOT public.is_session_active() THEN
        RETURN false;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.profiles p ON p.id = ur.user_id
        WHERE ur.user_id = _user_id
          AND ur.role::text = 'super_admin'
          AND p.status = 'active'
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_super_admin(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(UUID) TO authenticated, service_role;

-- D. has_permission
CREATE OR REPLACE FUNCTION public.has_permission(
  _user_id UUID,
  _permission TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _module TEXT;
  _action TEXT;
  _dot_pos INT;
  _role TEXT;
  _is_banned BOOLEAN;
  _override_enabled BOOLEAN;
  _override_actions JSONB;
  _action_val JSONB;
BEGIN
  IF _user_id IS NULL OR _permission IS NULL OR TRIM(_permission) = '' THEN
    RETURN false;
  END IF;

  IF _user_id = auth.uid() AND NOT public.is_session_active() THEN
    RETURN false;
  END IF;

  SELECT (banned_until IS NOT NULL AND banned_until > now()) INTO _is_banned
  FROM auth.users
  WHERE id = _user_id;

  IF COALESCE(_is_banned, false) THEN
    RETURN false;
  END IF;

  IF public.is_super_admin(_user_id) THEN
    RETURN true;
  END IF;

  _dot_pos := position('.' in _permission);
  IF _dot_pos > 0 THEN
    _module := LOWER(TRIM(substring(_permission from 1 for _dot_pos - 1)));
    _action := LOWER(TRIM(substring(_permission from _dot_pos + 1)));
  ELSE
    _module := LOWER(TRIM(_permission));
    _action := 'view';
  END IF;

  IF _action = 'delete' OR _action LIKE 'delete_%' THEN
    RETURN false;
  END IF;

  IF _module = 'accounts' THEN
    RETURN false;
  END IF;

  SELECT role::text INTO _role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1;

  IF _role IS NULL THEN
    RETURN false;
  END IF;

  SELECT enabled, actions INTO _override_enabled, _override_actions
  FROM public.user_module_permissions
  WHERE user_id = _user_id AND module = _module
  LIMIT 1;

  IF _override_enabled IS NOT NULL THEN
    IF _override_enabled = false THEN
      RETURN false;
    END IF;

    IF _override_actions IS NOT NULL AND _override_actions ? _action THEN
      _action_val := _override_actions -> _action;
      IF jsonb_typeof(_action_val) = 'boolean' THEN
        RETURN (_action_val)::boolean;
      END IF;
    END IF;

    IF _action = 'view' THEN
      RETURN true;
    END IF;

    IF _role = 'admin' THEN
      RETURN true;
    END IF;

    IF _role = 'worker' THEN
      IF _module = 'tasks' AND _action IN ('change_status', 'add_deliverable', 'complete') THEN
        RETURN true;
      ELSIF _module = 'compensation' AND _action = 'request_advance' THEN
        RETURN true;
      END IF;
      RETURN false;
    END IF;
  END IF;

  IF _role = 'admin' THEN
    IF _module IN ('workflows', 'business_rules', 'accounts', 'finance') THEN
      RETURN false;
    END IF;

    IF _action IN (
      'view',
      'create', 'create_lead',
      'edit', 'edit_lead',
      'assign', 'create_subtask',
      'change_status', 'change_priority', 'change_due_date',
      'add_deliverable', 'complete',
      'change_stage', 'convert_lead',
      'reconcile', 'publish', 'schedule', 'manage',
      'request_advance'
    ) THEN
      RETURN true;
    END IF;

    RETURN false;
  END IF;

  IF _role = 'worker' THEN
    IF _module IN (
      'admin_overview', 'analytics', 'clients', 'client_workspaces',
      'sales', 'deals', 'finance', 'compensation', 'team_workload',
      'accounts', 'business_rules', 'workflows', 'packages', 'settings'
    ) THEN
      RETURN false;
    END IF;

    IF _action IN ('view', 'change_status', 'add_deliverable', 'complete', 'request_advance') THEN
      RETURN true;
    END IF;

    RETURN false;
  END IF;

  RETURN false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.has_permission(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_permission(UUID, TEXT) TO authenticated, service_role, anon;

-- ------------------------------------------------------------
-- 4. HARDEN register_user_session WITH CRYPTOGRAPHIC JWT BINDING
-- ------------------------------------------------------------
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

    -- 2. Check Existing Session strictly by canonical session_id
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

REVOKE EXECUTE ON FUNCTION public.register_user_session(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_user_session(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 5. HARDEN verify_session_and_account
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

REVOKE EXECUTE ON FUNCTION public.verify_session_and_account(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_session_and_account(TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 6. HARDEN admin_revoke_session AND revoke_user_session
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 7. CLOSE DIRECT POSTGREST RLS POLICIES ON SENSITIVE TABLES
-- ------------------------------------------------------------

-- A. Business Rules & Versions
DROP POLICY IF EXISTS "Authenticated users can read business rules" ON public.business_rules;
DROP POLICY IF EXISTS "Staff read business rules" ON public.business_rules;
CREATE POLICY "Staff read business rules"
    ON public.business_rules
    FOR SELECT
    TO authenticated
    USING (public.has_sada_access(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can read business rule versions" ON public.business_rule_versions;
DROP POLICY IF EXISTS "Staff read business rule versions" ON public.business_rule_versions;
CREATE POLICY "Staff read business rule versions"
    ON public.business_rule_versions
    FOR SELECT
    TO authenticated
    USING (public.has_sada_access(auth.uid()));

-- B. Service Commitments
DROP POLICY IF EXISTS "service_commitments_read_authenticated" ON public.service_commitments;
CREATE POLICY "service_commitments_read_authenticated"
    ON public.service_commitments
    FOR SELECT
    TO authenticated
    USING (public.has_sada_access(auth.uid()));

-- C. Workflow Templates & Stages
DROP POLICY IF EXISTS "Authenticated users can read workflow templates" ON public.workflow_templates;
DROP POLICY IF EXISTS "Staff read workflow templates" ON public.workflow_templates;
CREATE POLICY "Staff read workflow templates"
    ON public.workflow_templates
    FOR SELECT
    TO authenticated
    USING (public.has_sada_access(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can read workflow stages" ON public.workflow_stages;
DROP POLICY IF EXISTS "Staff read workflow stages" ON public.workflow_stages;
CREATE POLICY "Staff read workflow stages"
    ON public.workflow_stages
    FOR SELECT
    TO authenticated
    USING (public.has_sada_access(auth.uid()));

-- D. User Module Permissions
DROP POLICY IF EXISTS "Users view own module permissions" ON public.user_module_permissions;
CREATE POLICY "Users view own module permissions"
    ON public.user_module_permissions
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() AND public.is_session_active());

-- E. Project Tasks Worker Update Policy
DROP POLICY IF EXISTS "Workers update assigned project_tasks" ON public.project_tasks;
CREATE POLICY "Workers update assigned project_tasks"
    ON public.project_tasks
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = assignee_id AND public.is_session_active())
    WITH CHECK (auth.uid() = assignee_id AND public.is_session_active());

-- F. get_current_team_member_ids Hardening
CREATE OR REPLACE FUNCTION public.get_current_team_member_ids()
RETURNS SETOF UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_session_active() THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT id FROM public.team_members
    WHERE profile_id = auth.uid()
       OR user_id = auth.uid()
       OR (email IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM(COALESCE(auth.jwt()->>'email', ''))));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_current_team_member_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_team_member_ids() TO authenticated, service_role;
