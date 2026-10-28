-- ============================================================
-- SADA WORK OS — MIGRATION: 20261007140000
-- PHASE B: GRANULAR PERMISSIONS & SUPER ADMIN CONTROL CENTER
--
-- 1. Canonical Permission Resolution: public.has_permission(_user_id, _permission)
--    Supports module-level (e.g. 'sales') and action-level (e.g. 'sales.create_lead', 'tasks.assign')
-- 2. Enhanced Super Admin RPC: public.admin_update_account_permissions
--    Strict Super Admin root check, atomic override sync, and comprehensive audit logging
-- 3. High-Performance Snapshot: public.get_effective_user_permissions
-- 4. Module Access Helper alignment: public.has_module_access delegates cleanly
-- ============================================================

-- ============================================================
-- 1. CANONICAL DATABASE FUNCTION: public.has_permission
-- ============================================================

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
  -- Null check
  IF _user_id IS NULL OR _permission IS NULL OR TRIM(_permission) = '' THEN
    RETURN false;
  END IF;

  -- 1. Check if user is suspended, banned, or inactive
  SELECT (banned_until IS NOT NULL AND banned_until > now()) INTO _is_banned
  FROM auth.users
  WHERE id = _user_id;

  IF COALESCE(_is_banned, false) THEN
    RETURN false;
  END IF;

  -- 2. Root Super Admin invariant: Full root access to all modules and actions
  IF public.is_super_admin(_user_id) THEN
    RETURN true;
  END IF;

  -- 3. Parse permission into module and action
  -- Format: 'module.action' (e.g. 'sales.create_lead', 'tasks.assign') or 'module' (e.g. 'finance')
  _dot_pos := position('.' in _permission);
  IF _dot_pos > 0 THEN
    _module := LOWER(TRIM(substring(_permission from 1 for _dot_pos - 1)));
    _action := LOWER(TRIM(substring(_permission from _dot_pos + 1)));
  ELSE
    _module := LOWER(TRIM(_permission));
    _action := 'view';
  END IF;

  -- 4. Accounts management is strictly Super Admin root exclusive
  IF _module = 'accounts' THEN
    RETURN false;
  END IF;

  -- 5. Permanent deletion invariant: Only Super Admin can delete records
  IF _action = 'delete' OR _action = 'delete_lead' OR _action = 'delete_transaction' THEN
    RETURN false;
  END IF;

  -- 6. Check explicit user override from canonical public.user_module_permissions
  SELECT enabled, actions INTO _override_enabled, _override_actions
  FROM public.user_module_permissions
  WHERE user_id = _user_id AND module = _module;

  IF _override_enabled IS NOT NULL THEN
    -- If module is explicitly disabled for user, all module actions are denied
    IF NOT _override_enabled THEN
      RETURN false;
    END IF;

    -- If granular action override is explicitly configured
    IF _override_actions IS NOT NULL AND _override_actions ? _action THEN
      _action_val := _override_actions -> _action;
      IF jsonb_typeof(_action_val) = 'boolean' THEN
        RETURN _action_val::boolean;
      END IF;
    END IF;
  END IF;

  -- 7. Fallback to authoritative role baseline defaults
  SELECT role INTO _role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1;

  IF _role IS NULL THEN
    SELECT role INTO _role
    FROM public.profiles
    WHERE id = _user_id
    LIMIT 1;
  END IF;

  IF _role IS NULL THEN
    _role := 'worker';
  END IF;

  -- Role Baseline Defaults
  IF _role = 'admin' THEN
    -- System administration & financial modules require explicit Super Admin grant
    IF _module IN ('workflows', 'business_rules', 'accounts', 'finance') THEN
      RETURN false;
    END IF;

    -- Standard Admin operational capabilities
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

  ELSIF _role = 'worker' THEN
    -- Worker baseline capabilities
    IF _module = 'tasks' THEN
      RETURN _action IN ('view', 'change_status', 'add_deliverable', 'complete');
    ELSIF _module = 'clients' THEN
      RETURN _action = 'view';
    ELSIF _module = 'calendar' THEN
      RETURN _action = 'view';
    ELSIF _module = 'compensation' THEN
      RETURN _action IN ('view', 'request_advance');
    ELSIF _module = 'dashboard' THEN
      RETURN _action = 'view';
    ELSE
      RETURN false;
    END IF;
  END IF;

  RETURN false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.has_permission(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_permission(UUID, TEXT) TO authenticated, service_role, anon;

-- ============================================================
-- 2. ALIGN public.has_module_access TO USE public.has_permission
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_module_access(
  _user_id UUID,
  _module TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_permission(_user_id, LOWER(TRIM(_module)) || '.view');
$$;

REVOKE EXECUTE ON FUNCTION public.has_module_access(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_module_access(UUID, TEXT) TO authenticated, service_role, anon;

-- ============================================================
-- 3. ENHANCED SUPER ADMIN RPC: admin_update_account_permissions
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_update_account_permissions(
  _target_user_id UUID,
  _permissions JSONB
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
  _mod_key TEXT;
  _mod_val JSONB;
  _is_enabled BOOLEAN;
  _actions_obj JSONB;
BEGIN
  -- 1. STRICT AUTHORIZATION GUARD: ONLY Super Admin can modify permissions
  IF _actor_id IS NULL OR NOT public.is_super_admin(_actor_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin can modify account permissions.';
  END IF;

  SELECT email INTO _actor_email FROM auth.users WHERE id = _actor_id;
  SELECT email INTO _target_email FROM auth.users WHERE id = _target_user_id;

  IF _target_email IS NULL THEN
    RAISE EXCEPTION 'Target user does not exist.';
  END IF;

  -- 2. Update public.profiles cache projection
  UPDATE public.profiles
  SET module_permissions = COALESCE(_permissions, '{}'::jsonb),
      updated_at = now()
  WHERE id = _target_user_id;

  -- 3. Authoritative sync of public.user_module_permissions
  -- Transactionally clear prior overrides to prevent stale or competing states
  DELETE FROM public.user_module_permissions WHERE user_id = _target_user_id;

  -- Insert normalized overrides if provided
  IF _permissions IS NOT NULL AND jsonb_typeof(_permissions) = 'object' THEN
    FOR _mod_key, _mod_val IN SELECT * FROM jsonb_each(_permissions) LOOP
      IF jsonb_typeof(_mod_val) = 'boolean' THEN
        _is_enabled := _mod_val::boolean;
        -- Generate sensible default actions when given boolean master switch
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

  -- 4. Audit Logging in public.account_audit_logs
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
      'permissions', _permissions,
      'updated_at', now()
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', _target_user_id,
    'permissions', _permissions
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_account_permissions(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_account_permissions(UUID, JSONB) TO authenticated, service_role;

-- ============================================================
-- 4. AUTHORITATIVE SNAPSHOT: public.get_effective_user_permissions
-- Returns effective permissions dictionary for current user or targeted user
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_effective_user_permissions(
  _target_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller_id UUID := auth.uid();
  _is_caller_super BOOLEAN := public.is_super_admin(_caller_id);
  _target_role TEXT;
  _is_target_super BOOLEAN;
  _overrides RECORD;
  _modules_result JSONB := '{}'::jsonb;
  _mod_name TEXT;
  _mod_enabled BOOLEAN;
  _mod_actions JSONB;
BEGIN
  -- Security Guard: Caller can inspect themselves, or Super Admin can inspect any user
  IF _caller_id != _target_user_id AND NOT _is_caller_super THEN
    RAISE EXCEPTION 'Unauthorized: Users can only inspect their own effective permissions.';
  END IF;

  -- Resolve target role
  SELECT role INTO _target_role
  FROM public.user_roles
  WHERE user_id = _target_user_id
  LIMIT 1;

  IF _target_role IS NULL THEN
    SELECT role INTO _target_role
    FROM public.profiles
    WHERE id = _target_user_id
    LIMIT 1;
  END IF;

  _target_role := COALESCE(_target_role, 'worker');
  _is_target_super := (_target_role = 'super_admin');

  -- Compile effective module states
  FOR _mod_name IN SELECT unnest(ARRAY[
    'dashboard', 'clients', 'tasks', 'calendar', 'workspaces', 'team',
    'sales', 'packages', 'analytics', 'inquiries', 'finance', 'compensation',
    'content_cms', 'workflows', 'business_rules', 'accounts'
  ]) LOOP
    _mod_enabled := public.has_permission(_target_user_id, _mod_name || '.view');

    SELECT actions INTO _mod_actions
    FROM public.user_module_permissions
    WHERE user_id = _target_user_id AND module = _mod_name;

    _modules_result := jsonb_set(
      _modules_result,
      ARRAY[_mod_name],
      jsonb_build_object(
        'enabled', _mod_enabled,
        'actions', COALESCE(_mod_actions, '{}'::jsonb)
      )
    );
  END LOOP;

  RETURN jsonb_build_object(
    'user_id', _target_user_id,
    'role', _target_role,
    'is_super_admin', _is_target_super,
    'modules', _modules_result
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_effective_user_permissions(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_effective_user_permissions(UUID) TO authenticated, service_role;
