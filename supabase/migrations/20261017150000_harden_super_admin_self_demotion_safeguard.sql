-- ============================================================
-- SADA OS — MIGRATION: 20261017150000_harden_super_admin_self_demotion_safeguard.sql
-- Hardens database-level protections against administrative self-lockout:
-- 1. admin_update_account: explicit database-level guard preventing a Super Admin
--    from demoting themselves (even if multiple Super Admins exist).
-- 2. admin_update_account: explicit database-level guard preventing a Super Admin
--    from suspending or disabling their own account.
-- 3. admin_delete_account: explicit database-level guard preventing a Super Admin
--    from deleting their own account.
-- 4. Preserves last-active-Super-Admin safeguard across all administrative write paths.
-- ============================================================

-- ------------------------------------------------------------
-- 1. HARDEN admin_update_account WITH DATABASE-LEVEL ANTI-SELF-LOCKOUT
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_account(
  _user_id UUID,
  _display_name TEXT,
  _phone TEXT,
  _role TEXT,
  _division TEXT,
  _position TEXT,
  _bio TEXT,
  _specialties TEXT[],
  _socials JSONB,
  _published BOOLEAN,
  _is_active BOOLEAN,
  _status TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor_id UUID := auth.uid();
  _actor_email TEXT;
  _target_email TEXT;
  _current_role TEXT;
  _current_status TEXT;
  _clean_role TEXT := LOWER(TRIM(_role));
  _clean_status TEXT := CASE WHEN _status IS NOT NULL THEN LOWER(TRIM(_status)) ELSE NULL END;
  _role_changed BOOLEAN := false;
  _status_changed BOOLEAN := false;
BEGIN
  -- 1. Strict Caller Authorization: Super Admin only
  IF NOT public.is_super_admin(_actor_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin can update account profiles.';
  END IF;

  -- 2. Role validation
  IF _clean_role NOT IN ('super_admin', 'admin', 'worker') THEN
    RAISE EXCEPTION 'Invalid role. Role must be super_admin, admin, or worker.';
  END IF;

  -- 3. Status validation
  IF _clean_status IS NOT NULL AND _clean_status NOT IN ('active', 'suspended', 'pending', 'disabled') THEN
    RAISE EXCEPTION 'Invalid status. Status must be active, suspended, pending, or disabled.';
  END IF;

  SELECT email INTO _actor_email FROM auth.users WHERE id = _actor_id;
  SELECT email INTO _target_email FROM auth.users WHERE id = _user_id;

  IF _target_email IS NULL THEN
    RAISE EXCEPTION 'Account not found.';
  END IF;

  SELECT status INTO _current_status FROM public.profiles WHERE id = _user_id;
  SELECT role::TEXT INTO _current_role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;

  -- 4. DATABASE INVARIANT: Anti-Self-Demotion Guard
  -- A Super Admin cannot demote their own account, regardless of the number of Super Admins.
  IF _actor_id = _user_id AND _clean_role != 'super_admin' THEN
    RAISE EXCEPTION 'Cannot demote own account (administrative self-lockout protection).';
  END IF;

  -- 5. DATABASE INVARIANT: Anti-Self-Suspension / Deactivation Guard
  -- A Super Admin cannot suspend, disable, or deactivate their own account.
  IF _actor_id = _user_id AND ((_clean_status IS NOT NULL AND _clean_status != 'active') OR _is_active IS FALSE) THEN
    RAISE EXCEPTION 'Cannot suspend or deactivate own account (administrative self-lockout protection).';
  END IF;

  -- 6. DATABASE INVARIANT: Last Active Super Admin Protection
  -- Prevent demoting or deactivating the last remaining active Super Admin.
  IF _current_role = 'super_admin' AND (_clean_role != 'super_admin' OR (_clean_status IS NOT NULL AND _clean_status != 'active') OR _is_active IS FALSE) THEN
    IF public.count_active_super_admins() <= 1 THEN
      RAISE EXCEPTION 'At least one active Super Admin is required.';
    END IF;
  END IF;

  IF _current_role IS DISTINCT FROM _clean_role THEN
    _role_changed := true;
  END IF;

  IF _clean_status IS NOT NULL AND _clean_status IS DISTINCT FROM _current_status THEN
    _status_changed := true;
  END IF;

  -- 7. Update Profiles projection
  UPDATE public.profiles
  SET display_name = TRIM(_display_name),
      phone = TRIM(_phone),
      status = COALESCE(_clean_status, status),
      updated_at = now()
  WHERE id = _user_id;

  -- 8. Auth login ban synchronization
  IF _clean_status IS NOT NULL THEN
    IF _clean_status IN ('suspended', 'disabled') THEN
      UPDATE auth.users
      SET banned_until = '3000-01-01 00:00:00+00'::timestamptz,
          updated_at = now()
      WHERE id = _user_id;
    ELSIF _clean_status = 'active' THEN
      UPDATE auth.users
      SET banned_until = NULL,
          updated_at = now()
      WHERE id = _user_id;
    END IF;
  END IF;

  -- 9. Update Auth metadata display name
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{display_name}',
        to_jsonb(TRIM(_display_name))
      ),
      updated_at = now()
  WHERE id = _user_id;

  -- 10. Update canonical user_roles
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _clean_role::app_role);

  -- 11. Update linked Team Member if exists
  UPDATE public.team_members
  SET profile_id = _user_id,
      user_id = _user_id,
      name = TRIM(_display_name),
      role = _clean_role,
      division = COALESCE(_division, division),
      position = COALESCE(TRIM(_position), position),
      bio = _bio,
      specialties = COALESCE(_specialties, specialties),
      socials = COALESCE(_socials, socials),
      published = COALESCE(_published, published),
      is_active = CASE 
        WHEN _clean_status IS NOT NULL AND _clean_status != 'active' THEN false
        ELSE COALESCE(_is_active, is_active)
      END,
      updated_at = now()
  WHERE profile_id = _user_id OR user_id = _user_id OR LOWER(TRIM(email)) = LOWER(TRIM(_target_email));

  -- 12. Audit Log (Immutable record)
  INSERT INTO public.account_audit_logs (
    actor_id, actor_email, target_user_id, target_email, action, metadata
  ) VALUES (
    _actor_id, _actor_email, _user_id, _target_email, 'account_updated',
    jsonb_build_object(
      'display_name', _display_name,
      'role', _clean_role,
      'status', COALESCE(_clean_status, _current_status),
      'division', _division,
      'position', _position,
      'role_changed', _role_changed,
      'status_changed', _status_changed,
      'previous_role', _current_role,
      'previous_status', _current_status
    )
  );

  IF _role_changed THEN
    INSERT INTO public.account_audit_logs (
      actor_id, actor_email, target_user_id, target_email, action, metadata
    ) VALUES (
      _actor_id, _actor_email, _user_id, _target_email, 'role_changed',
      jsonb_build_object(
        'previous_role', _current_role,
        'new_role', _clean_role
      )
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_account(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], JSONB, BOOLEAN, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_account(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], JSONB, BOOLEAN, BOOLEAN, TEXT) TO authenticated, service_role;


-- ------------------------------------------------------------
-- 2. HARDEN admin_delete_account WITH DATABASE-LEVEL ANTI-SELF-DELETION
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_account(
  _user_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor_id UUID := auth.uid();
  _actor_email TEXT;
  _target_email TEXT;
  _target_role TEXT;
  _deps JSONB;
BEGIN
  -- 1. Strict Caller Authorization: Super Admin only
  IF NOT public.is_super_admin(_actor_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin can delete accounts.';
  END IF;

  -- 2. Anti-Self-Deletion Guard: Super Admin cannot delete own account
  IF _actor_id = _user_id THEN
    RAISE EXCEPTION 'Cannot delete own account (administrative self-lockout protection).';
  END IF;

  SELECT email INTO _actor_email FROM auth.users WHERE id = _actor_id;
  SELECT email INTO _target_email FROM auth.users WHERE id = _user_id;

  IF _target_email IS NULL THEN
    RAISE EXCEPTION 'Account not found.';
  END IF;

  -- 3. Last Active Super Admin Protection: Prevent deleting last Super Admin
  SELECT role::TEXT INTO _target_role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
  IF _target_role = 'super_admin' THEN
    IF public.count_active_super_admins() <= 1 THEN
      RAISE EXCEPTION 'At least one active Super Admin is required.';
    END IF;
  END IF;

  -- 4. Dependency Analysis Before Deletion
  _deps := public.admin_analyze_account_dependencies(_user_id);

  -- Branch A: Historical dependencies exist (Preserve financial/task integrity)
  IF (_deps->>'has_business_dependencies')::BOOLEAN THEN
    UPDATE public.team_members
    SET profile_id = NULL,
        is_active = false,
        updated_at = now()
    WHERE profile_id = _user_id OR LOWER(email) = LOWER(_target_email);

    UPDATE public.profiles
    SET status = 'deleted',
        display_name = '[Deleted Account]',
        updated_at = now()
    WHERE id = _user_id;

    DELETE FROM public.user_roles WHERE user_id = _user_id;
    DELETE FROM auth.identities WHERE user_id = _user_id;
    DELETE FROM auth.users WHERE id = _user_id;
  ELSE
    -- Branch B: Clean purge when zero dependencies
    DELETE FROM public.team_members WHERE profile_id = _user_id OR LOWER(email) = LOWER(_target_email);
    DELETE FROM public.user_roles WHERE user_id = _user_id;
    DELETE FROM public.profiles WHERE id = _user_id;
    DELETE FROM auth.identities WHERE user_id = _user_id;
    DELETE FROM auth.users WHERE id = _user_id;
  END IF;

  -- 5. Audit Log (Immutable record)
  INSERT INTO public.account_audit_logs (
    actor_id, actor_email, target_user_id, target_email, action, metadata
  ) VALUES (
    _actor_id, _actor_email, _user_id, _target_email, 'account_deleted',
    jsonb_build_object(
      'safely_preserved_dependencies', (_deps->>'has_business_dependencies')::BOOLEAN,
      'dependencies', _deps
    )
  );

  RETURN jsonb_build_object('success', true, 'preserved_dependencies', (_deps->>'has_business_dependencies')::BOOLEAN);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_account(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_account(UUID) TO authenticated, service_role;
