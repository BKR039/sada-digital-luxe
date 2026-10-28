-- ============================================================
-- SADA OS — MIGRATION: 20261007220000_phase_j_fix_rate_limit_call.sql
-- Casts _actor_id::text in check_rate_limit call
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_update_account_permissions(
  _target_user_id UUID,
  _permissions JSONB,
  _reason TEXT DEFAULT NULL,
  _request_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor_id UUID := auth.uid();
  _actor_email TEXT;
  _target_email TEXT;
  _target_role TEXT;
  _previous_permissions JSONB := '{}'::jsonb;
  _mod_key TEXT;
  _mod_val JSONB;
  _is_enabled BOOLEAN;
  _actions_obj JSONB;
  _diff JSONB := jsonb_build_object('added', '[]'::jsonb, 'modified', '[]'::jsonb, 'removed', '[]'::jsonb);
  _target_accounts_setting JSONB;
  _rate_chk JSONB;
BEGIN
  -- 1. AUTHORIZATION GUARD: Strict Super Admin enforcement
  IF NOT public.is_super_admin(_actor_id) THEN
    RAISE EXCEPTION 'Must be super admin to update permissions';
  END IF;

  -- 2. TARGET VALIDATION: Verify target account exists
  SELECT module_permissions INTO _previous_permissions
  FROM public.profiles
  WHERE id = _target_user_id;

  SELECT email INTO _target_email FROM auth.users WHERE id = _target_user_id;
  SELECT role::TEXT INTO _target_role FROM public.user_roles WHERE user_id = _target_user_id LIMIT 1;
  SELECT email INTO _actor_email FROM auth.users WHERE id = _actor_id;

  IF _target_email IS NULL THEN
    RAISE EXCEPTION 'Target user not found.';
  END IF;

  -- 3. ADMINISTRATIVE SELF-LOCKOUT DEFENSE:
  IF _actor_id = _target_user_id AND _permissions IS NOT NULL THEN
    _target_accounts_setting := _permissions->'accounts';
    IF _target_accounts_setting IS NOT NULL THEN
      IF (jsonb_typeof(_target_accounts_setting) = 'boolean' AND _target_accounts_setting::boolean = false) OR
         (jsonb_typeof(_target_accounts_setting) = 'object' AND (_target_accounts_setting->>'enabled')::boolean = false) THEN
        RAISE EXCEPTION 'Cannot revoke own access to account management (administrative self-lockout protection).';
      END IF;
    END IF;
  END IF;

  -- 4. ABUSE PROTECTION & TARGETED RATE LIMITING
  _rate_chk := public.check_rate_limit(_actor_id::text, 'permission_mutation', 15, 60, 120);
  IF NOT COALESCE((_rate_chk->>'allowed')::boolean, true) THEN
    RAISE EXCEPTION 'Rate limit exceeded for permission administration. Retry after % seconds.',
      COALESCE((_rate_chk->>'retry_after')::int, 60);
  END IF;

  -- 5. COMPUTE AUDIT DIFF
  IF _previous_permissions IS NOT NULL AND _permissions IS NOT NULL THEN
    FOR _mod_key IN SELECT jsonb_object_keys(_permissions) LOOP
      IF NOT (_previous_permissions ? _mod_key) THEN
        _diff := jsonb_set(_diff, '{added}', (_diff->'added') || to_jsonb(_mod_key));
      ELSIF (_permissions->_mod_key) != (_previous_permissions->_mod_key) THEN
        _diff := jsonb_set(_diff, '{modified}', (_diff->'modified') || to_jsonb(_mod_key));
      END IF;
    END LOOP;
    FOR _mod_key IN SELECT jsonb_object_keys(_previous_permissions) LOOP
      IF NOT (_permissions ? _mod_key) THEN
        _diff := jsonb_set(_diff, '{removed}', (_diff->'removed') || to_jsonb(_mod_key));
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
