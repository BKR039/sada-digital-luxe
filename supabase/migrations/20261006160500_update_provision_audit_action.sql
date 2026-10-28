-- ============================================================
-- SADA WORK OS — Migration: 20261006160500_update_provision_audit_action.sql
-- Ensure admin_provision_account logs 'account_created' action in public.account_audit_logs
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
        INSERT INTO public.user_module_permissions (user_id, module, enabled, actions, updated_at)
        VALUES (
          _user_id,
          _mod_key,
          _is_enabled,
          jsonb_build_object('view', _is_enabled, 'create', _is_enabled, 'edit', _is_enabled, 'delete', false, 'approve', false),
          now()
        )
        ON CONFLICT (user_id, module) DO UPDATE SET
          enabled = _is_enabled,
          actions = jsonb_build_object('view', _is_enabled, 'create', _is_enabled, 'edit', _is_enabled, 'delete', false, 'approve', false),
          updated_at = now();
      ELSIF jsonb_typeof(_mod_val) = 'object' THEN
        _is_enabled := COALESCE((_mod_val->>'enabled')::boolean, true);
        INSERT INTO public.user_module_permissions (user_id, module, enabled, actions, updated_at)
        VALUES (
          _user_id,
          _mod_key,
          _is_enabled,
          COALESCE(_mod_val->'actions', '{}'::jsonb),
          now()
        )
        ON CONFLICT (user_id, module) DO UPDATE SET
          enabled = _is_enabled,
          actions = COALESCE(_mod_val->'actions', user_module_permissions.actions),
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
