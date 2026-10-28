-- ============================================================
-- SADA WORK OS — MIGRATION: 20261007143000
-- PHASE B ALIGNMENT: Overrides & Baseline Permission Resolution
-- 1. Updates public.has_permission to cleanly resolve enabled module views & operational capabilities
-- 2. Aligns public.admin_provision_account to store normalized actions
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
  IF _action IN ('delete', 'delete_lead', 'delete_transaction', 'delete_subtask') THEN
    RETURN false;
  END IF;

  -- 6. Resolve authoritative user role
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

  -- 7. Check explicit user override from canonical public.user_module_permissions
  SELECT enabled, actions INTO _override_enabled, _override_actions
  FROM public.user_module_permissions
  WHERE user_id = _user_id AND module = _module;

  IF _override_enabled IS NOT NULL THEN
    -- If module master switch is explicitly disabled for user, all module actions are denied
    IF NOT _override_enabled THEN
      RETURN false;
    END IF;

    -- If granular action override is explicitly configured
    IF _override_actions IS NOT NULL AND _override_actions ? _action THEN
      _action_val := _override_actions -> _action;
      IF jsonb_typeof(_action_val) = 'boolean' THEN
        RETURN (_action_val::text)::boolean;
      END IF;
    END IF;

    -- If module is explicitly enabled and checking 'view' (or module-level access)
    IF _action = 'view' THEN
      RETURN true;
    END IF;

    -- For Admin role with explicitly enabled module:
    -- grant standard operational actions unless explicitly denied in _override_actions
    IF _role = 'admin' THEN
      RETURN true;
    END IF;

    -- For Worker role with explicitly enabled module:
    IF _role = 'worker' THEN
      IF _module = 'tasks' AND _action IN ('change_status', 'add_deliverable', 'complete') THEN
        RETURN true;
      ELSIF _module = 'compensation' AND _action = 'request_advance' THEN
        RETURN true;
      END IF;
      RETURN false;
    END IF;
  END IF;

  -- 8. Fallback to authoritative role baseline defaults (when no override exists for this module)
  IF _role = 'admin' THEN
    -- System administration & financial modules require explicit Super Admin grant
    IF _module IN ('workflows', 'business_rules', 'accounts', 'finance') THEN
      RETURN false;
    END IF;

    -- Standard Admin operational capabilities for default modules
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
-- 2. UPDATE public.admin_provision_account FOR GRANULAR COMPATIBILITY
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_provision_account(
  _user_id UUID,
  _email TEXT,
  _display_name TEXT,
  _role TEXT,
  _division TEXT DEFAULT 'Development',
  _position TEXT DEFAULT 'Specialist',
  _phone TEXT DEFAULT NULL,
  _create_team_member BOOLEAN DEFAULT true,
  _status TEXT DEFAULT 'active',
  _module_permissions JSONB DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor_id UUID := auth.uid();
  _actor_email TEXT;
  _clean_email TEXT := LOWER(TRIM(_email));
  _clean_role TEXT := LOWER(TRIM(_role));
  _clean_status TEXT := LOWER(TRIM(COALESCE(_status, 'active')));
  _tm_id UUID;
  _is_active_flag BOOLEAN;
  _mod_key TEXT;
  _mod_val JSONB;
  _is_enabled BOOLEAN;
  _actions_obj JSONB;
BEGIN
  -- 1. Authorization Guard: ONLY Super Admin can provision accounts
  IF NOT public.is_super_admin(_actor_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin can provision accounts.';
  END IF;

  IF _clean_role NOT IN ('super_admin', 'admin', 'worker') THEN
    RAISE EXCEPTION 'Invalid role. Role must be super_admin, admin, or worker.';
  END IF;

  IF _clean_status NOT IN ('active', 'suspended', 'pending', 'disabled') THEN
    RAISE EXCEPTION 'Invalid status. Status must be active, suspended, pending, or disabled.';
  END IF;

  _is_active_flag := (_clean_status = 'active');

  SELECT email INTO _actor_email FROM auth.users WHERE id = _actor_id;

  -- 2. Upsert public.profiles record with module permissions cache
  INSERT INTO public.profiles (id, display_name, phone, status, module_permissions, created_at, updated_at)
  VALUES (
    _user_id,
    TRIM(_display_name),
    TRIM(_phone),
    _clean_status,
    COALESCE(_module_permissions, '{}'::jsonb),
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    phone = EXCLUDED.phone,
    status = _clean_status,
    module_permissions = COALESCE(_module_permissions, profiles.module_permissions),
    updated_at = now();

  -- 3. Update auth.users status: auto-confirm email and ensure ban state is consistent
  IF _clean_status IN ('suspended', 'disabled') THEN
    UPDATE auth.users
    SET banned_until = '3000-01-01 00:00:00+00'::timestamptz,
        updated_at = now()
    WHERE id = _user_id;
  ELSIF _clean_status = 'active' THEN
    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
        banned_until = NULL,
        updated_at = now()
    WHERE id = _user_id;
  END IF;

  -- 4. Set canonical user_roles
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _clean_role::app_role);

  -- 5. Team Member provisioning / linking
  IF _create_team_member THEN
    SELECT id INTO _tm_id FROM public.team_members
    WHERE LOWER(TRIM(email)) = _clean_email OR profile_id = _user_id OR user_id = _user_id
    LIMIT 1;

    IF _tm_id IS NOT NULL THEN
      UPDATE public.team_members
      SET profile_id = _user_id,
          user_id = _user_id,
          role = _clean_role,
          division = COALESCE(_division, division),
          position = COALESCE(TRIM(_position), position),
          name = COALESCE(TRIM(_display_name), name),
          email = COALESCE(_clean_email, email),
          is_active = _is_active_flag,
          updated_at = now()
      WHERE id = _tm_id;
    ELSE
      INSERT INTO public.team_members (
        name, position, division, role, email, profile_id, user_id, is_active, published, sort_order, created_at, updated_at
      ) VALUES (
        TRIM(_display_name),
        COALESCE(TRIM(_position), 'Specialist'),
        COALESCE(_division, 'Development'),
        _clean_role,
        _clean_email,
        _user_id,
        _user_id,
        _is_active_flag,
        true,
        50,
        now(),
        now()
      ) RETURNING id INTO _tm_id;
    END IF;
  END IF;

  -- 6. Canonical user_module_permissions table synchronization
  DELETE FROM public.user_module_permissions WHERE user_id = _user_id;
  IF _module_permissions IS NOT NULL AND jsonb_typeof(_module_permissions) = 'object' THEN
    FOR _mod_key, _mod_val IN SELECT * FROM jsonb_each(_module_permissions) LOOP
      IF jsonb_typeof(_mod_val) = 'boolean' THEN
        _is_enabled := _mod_val::boolean;
        _actions_obj := jsonb_build_object('view', _is_enabled, 'create', _is_enabled, 'edit', _is_enabled, 'delete', false, 'approve', false);
        INSERT INTO public.user_module_permissions (user_id, module, enabled, actions, updated_at)
        VALUES (
          _user_id,
          _mod_key,
          _is_enabled,
          _actions_obj,
          now()
        )
        ON CONFLICT (user_id, module) DO UPDATE SET
          enabled = _is_enabled,
          actions = _actions_obj,
          updated_at = now();
      ELSIF jsonb_typeof(_mod_val) = 'object' THEN
        _is_enabled := COALESCE((_mod_val->>'enabled')::boolean, true);
        _actions_obj := COALESCE(_mod_val->'actions', '{}'::jsonb);
        IF _clean_role != 'super_admin' AND _actions_obj ? 'delete' THEN
          _actions_obj := jsonb_set(_actions_obj, '{delete}', 'false'::jsonb);
        END IF;

        INSERT INTO public.user_module_permissions (user_id, module, enabled, actions, updated_at)
        VALUES (
          _user_id,
          _mod_key,
          _is_enabled,
          _actions_obj,
          now()
        )
        ON CONFLICT (user_id, module) DO UPDATE SET
          enabled = _is_enabled,
          actions = _actions_obj,
          updated_at = now();
      END IF;
    END LOOP;
  END IF;

  -- 7. Audit trail (action: account_created)
  INSERT INTO public.account_audit_logs (
    actor_id, actor_email, target_user_id, target_email, action, metadata
  ) VALUES (
    _actor_id,
    _actor_email,
    _user_id,
    _clean_email,
    'account_created',
    jsonb_build_object(
      'display_name', TRIM(_display_name),
      'role', _clean_role,
      'status', _clean_status,
      'division', _division,
      'position', _position,
      'team_member_id', _tm_id,
      'has_custom_permissions', (_module_permissions IS NOT NULL)
    )
  );

  RETURN jsonb_build_object(
    'user_id', _user_id,
    'email', _clean_email,
    'role', _clean_role,
    'status', _clean_status,
    'team_member_id', _tm_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_provision_account(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_provision_account(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, JSONB) TO authenticated, service_role;
