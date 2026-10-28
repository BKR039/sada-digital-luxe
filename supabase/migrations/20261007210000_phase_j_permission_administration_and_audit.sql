-- ============================================================
-- SADA OS — Migration: 20261007210000_phase_j_permission_administration_and_audit.sql
-- PHASE J: Permission Administration Hardening, Audit & Revocation
-- 1. Guard public.profiles security fields (role, status, module_permissions) against direct escalation
-- 2. Comprehensive admin_update_account_permissions with previous_state, new_state, diff, actor, and metadata
-- 3. Administrative self-lockout protection (prevent Super Admin from locking out self from accounts)
-- 4. Audit trail logging in both public.account_audit_logs and public.system_audit_logs
-- 5. Administrative self-lockout protection in admin_suspend_account
-- ============================================================

-- 1. Guard public.profiles security fields against direct manipulation by non-Super-Admins
CREATE OR REPLACE FUNCTION public.guard_profiles_security_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- If actor is not Super Admin, strictly reject/revert modifications to security fields
  IF NOT public.is_super_admin(auth.uid()) THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      NEW.role := OLD.role;
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      NEW.status := OLD.status;
    END IF;
    IF NEW.module_permissions IS DISTINCT FROM OLD.module_permissions THEN
      NEW.module_permissions := OLD.module_permissions;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profiles_security_fields ON public.profiles;
CREATE TRIGGER trg_guard_profiles_security_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profiles_security_fields();


-- 2. ENHANCED SUPER ADMIN RPC: admin_update_account_permissions
-- Authoritative single write path with complete audit capture and self-lockout defense
CREATE OR REPLACE FUNCTION public.admin_update_account_permissions(
  _target_user_id UUID,
  _permissions JSONB,
  _reason TEXT DEFAULT NULL,
  _request_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_id UUID := auth.uid();
  _actor_email TEXT;
  _target_email TEXT;
  _previous_permissions JSONB := '{}'::jsonb;
  _diff JSONB := '[]'::jsonb;
  _mod_key TEXT;
  _mod_val JSONB;
  _is_enabled BOOLEAN;
  _actions_obj JSONB;
  _rate_chk JSONB;
BEGIN
  -- 1. STRICT AUTHORIZATION GUARD: ONLY Super Admin can modify permissions
  IF _actor_id IS NULL OR NOT public.is_super_admin(_actor_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin can modify account permissions.';
  END IF;

  -- 1b. Targeted Abuse Rate Limiting (Phase I integration)
  _rate_chk := public.check_rate_limit(_actor_id::text, 'permission_mutation', 15, 60, 120);
  IF (_rate_chk->>'allowed')::boolean = false THEN
    RAISE EXCEPTION 'Rate limit exceeded: Too many permission mutation requests. Please wait % seconds.', (_rate_chk->>'retry_after')::text;
  END IF;

  -- 2. Resolve Emails
  SELECT email INTO _actor_email FROM auth.users WHERE id = _actor_id;
  SELECT email INTO _target_email FROM auth.users WHERE id = _target_user_id;

  IF _target_email IS NULL THEN
    RAISE EXCEPTION 'Target user does not exist.';
  END IF;

  -- 3. ADMINISTRATIVE SELF-LOCKOUT PROTECTION
  -- A Super Admin cannot revoke their own access to the accounts module
  IF _actor_id = _target_user_id THEN
    IF _permissions ? 'accounts' THEN
      IF (_permissions->'accounts' = 'false'::jsonb) OR
         (jsonb_typeof(_permissions->'accounts') = 'object' AND (_permissions->'accounts'->>'enabled')::boolean = false) THEN
        RAISE EXCEPTION 'Cannot revoke own access to account management (administrative self-lockout protection).';
      END IF;
    END IF;
  END IF;

  -- 4. CAPTURE PREVIOUS STATE
  SELECT COALESCE(
    (SELECT jsonb_object_agg(module, jsonb_build_object('enabled', enabled, 'actions', actions))
     FROM public.user_module_permissions WHERE user_id = _target_user_id),
    p.module_permissions,
    '{}'::jsonb
  ) INTO _previous_permissions
  FROM public.profiles p
  WHERE p.id = _target_user_id;

  IF _previous_permissions IS NULL THEN
    _previous_permissions := '{}'::jsonb;
  END IF;

  -- 5. COMPUTE GRANULAR DIFF
  IF _permissions IS NOT NULL AND jsonb_typeof(_permissions) = 'object' THEN
    FOR _mod_key, _mod_val IN SELECT * FROM jsonb_each(_permissions) LOOP
      IF _previous_permissions ? _mod_key THEN
        IF (_previous_permissions->_mod_key) IS DISTINCT FROM _mod_val THEN
          _diff := _diff || jsonb_build_array(jsonb_build_object(
            'module', _mod_key,
            'previous', _previous_permissions->_mod_key,
            'new', _mod_val,
            'type', 'modified'
          ));
        END IF;
      ELSE
        _diff := _diff || jsonb_build_array(jsonb_build_object(
          'module', _mod_key,
          'previous', null,
          'new', _mod_val,
          'type', 'added'
        ));
      END IF;
    END LOOP;

    FOR _mod_key, _mod_val IN SELECT * FROM jsonb_each(_previous_permissions) LOOP
      IF NOT (_permissions ? _mod_key) THEN
        _diff := _diff || jsonb_build_array(jsonb_build_object(
          'module', _mod_key,
          'previous', _mod_val,
          'new', null,
          'type', 'removed'
        ));
      END IF;
    END LOOP;
  END IF;

  -- 6. UPDATE public.profiles cache projection
  UPDATE public.profiles
  SET module_permissions = COALESCE(_permissions, '{}'::jsonb),
      updated_at = now()
  WHERE id = _target_user_id;

  -- 7. AUTHORITATIVE SYNC of public.user_module_permissions
  DELETE FROM public.user_module_permissions WHERE user_id = _target_user_id;

  IF _permissions IS NOT NULL AND jsonb_typeof(_permissions) = 'object' THEN
    FOR _mod_key, _mod_val IN SELECT * FROM jsonb_each(_permissions) LOOP
      IF jsonb_typeof(_mod_val) = 'boolean' THEN
        _is_enabled := _mod_val::boolean;
        _actions_obj := jsonb_build_object(
          'view', _is_enabled,
          'create', _is_enabled,
          'edit', _is_enabled,
          'delete', false,
          'approve', false
        );

        INSERT INTO public.user_module_permissions (user_id, module, enabled, actions, updated_at)
        VALUES (
          _target_user_id,
          _mod_key,
          _is_enabled,
          _actions_obj,
          now()
        );
      ELSIF jsonb_typeof(_mod_val) = 'object' THEN
        _is_enabled := COALESCE((_mod_val->>'enabled')::boolean, true);
        _actions_obj := COALESCE(_mod_val->'actions', '{}'::jsonb);

        -- Security invariant: delete actions cannot be delegated to non-super-admins
        IF NOT public.is_super_admin(_target_user_id) AND _actions_obj ? 'delete' THEN
          _actions_obj := jsonb_set(_actions_obj, '{delete}', 'false'::jsonb);
        END IF;

        INSERT INTO public.user_module_permissions (user_id, module, enabled, actions, updated_at)
        VALUES (
          _target_user_id,
          _mod_key,
          _is_enabled,
          _actions_obj,
          now()
        );
      END IF;
    END LOOP;
  END IF;

  -- 8. AUDIT LOGGING in public.account_audit_logs
  INSERT INTO public.account_audit_logs (
    actor_id,
    actor_email,
    target_user_id,
    target_email,
    action,
    metadata
  ) VALUES (
    _actor_id,
    _actor_email,
    _target_user_id,
    _target_email,
    'account_permissions_updated',
    jsonb_build_object(
      'actor_id', _actor_id,
      'actor_email', _actor_email,
      'target_user_id', _target_user_id,
      'target_email', _target_email,
      'permission', 'module_permissions',
      'previous_state', _previous_permissions,
      'new_state', _permissions,
      'diff', _diff,
      'reason', COALESCE(_reason, 'Administrative permission modification'),
      'request_metadata', _request_metadata,
      'timestamp', now()
    )
  );

  -- 9. AUDIT LOGGING in public.system_audit_logs
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
    'PERMISSIONS_UPDATED',
    'user_account',
    _target_user_id::text,
    _actor_id,
    COALESCE(_actor_email, 'Super Admin'),
    'super_admin',
    jsonb_build_object('permissions', _previous_permissions),
    jsonb_build_object(
      'permissions', _permissions,
      'diff', _diff,
      'reason', _reason,
      'target_email', _target_email
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', _target_user_id,
    'previous_permissions', _previous_permissions,
    'permissions', _permissions,
    'diff', _diff
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_account_permissions(UUID, JSONB, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_account_permissions(UUID, JSONB, TEXT, JSONB) TO authenticated, service_role;


-- 3. SELF-LOCKOUT PROTECTION in admin_suspend_account
CREATE OR REPLACE FUNCTION public.admin_suspend_account(
  _user_id UUID,
  _reason TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor_id UUID := auth.uid();
  _actor_email TEXT;
  _target_email TEXT;
  _target_role TEXT;
BEGIN
  IF NOT public.is_super_admin(_actor_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin can suspend accounts.';
  END IF;

  -- SELF-LOCKOUT PROTECTION: Super Admin cannot suspend themselves
  IF _user_id = _actor_id THEN
    RAISE EXCEPTION 'Cannot suspend own account (administrative self-lockout protection).';
  END IF;

  SELECT email INTO _actor_email FROM auth.users WHERE id = _actor_id;
  SELECT email INTO _target_email FROM auth.users WHERE id = _user_id;

  IF _target_email IS NULL THEN
    RAISE EXCEPTION 'Account not found.';
  END IF;

  -- Super Admin Protection
  SELECT role::TEXT INTO _target_role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
  IF _target_role = 'super_admin' THEN
    IF public.count_active_super_admins() <= 1 THEN
      RAISE EXCEPTION 'At least one active Super Admin is required.';
    END IF;
  END IF;

  -- 1. Mark Profile as suspended
  UPDATE public.profiles
  SET status = 'suspended',
      updated_at = now()
  WHERE id = _user_id;

  -- 2. Ban in auth.users (blocks GoTrue login)
  UPDATE auth.users
  SET banned_until = '3000-01-01 00:00:00+00'::timestamptz,
      updated_at = now()
  WHERE id = _user_id;

  -- 3. Deactivate operational status in team_members while preserving all records
  UPDATE public.team_members
  SET is_active = false,
      updated_at = now()
  WHERE profile_id = _user_id OR LOWER(email) = LOWER(_target_email);

  -- 4. Audit Log in account_audit_logs
  INSERT INTO public.account_audit_logs (
    actor_id, actor_email, target_user_id, target_email, action, metadata
  ) VALUES (
    _actor_id, _actor_email, _user_id, _target_email, 'account_suspended',
    jsonb_build_object(
      'reason', _reason,
      'target_role', _target_role,
      'timestamp', now()
    )
  );

  -- 5. Audit Log in system_audit_logs
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
    _user_id::text,
    _actor_id,
    COALESCE(_actor_email, 'Super Admin'),
    'super_admin',
    jsonb_build_object('status', 'active', 'target_role', _target_role),
    jsonb_build_object('status', 'suspended', 'reason', _reason, 'target_email', _target_email),
    now()
  );

  RETURN jsonb_build_object('success', true, 'user_id', _user_id, 'status', 'suspended');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_suspend_account(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_suspend_account(UUID, TEXT) TO authenticated, service_role;
