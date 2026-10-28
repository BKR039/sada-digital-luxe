-- ==============================================================================
-- SADA OS — MIGRATION: 20261002130000_fix_account_provisioning_and_auth_integrity.sql
-- Fix Account Provisioning, Auth Identity Integrity, and Super Admin User Lookup
-- ==============================================================================

-- 1. CLEAN UP CORRUPTED AUTH USER FROM DEPRECATED SQL INSERT
DELETE FROM public.team_members WHERE email = 'test.rpc.create.1790942909790@sada.agency' OR user_id = 'dc9a9cfa-4d9e-4705-9042-1d13ebf4b294';
DELETE FROM public.user_roles WHERE user_id = 'dc9a9cfa-4d9e-4705-9042-1d13ebf4b294';
DELETE FROM public.profiles WHERE id = 'dc9a9cfa-4d9e-4705-9042-1d13ebf4b294';
DELETE FROM auth.identities WHERE user_id = 'dc9a9cfa-4d9e-4705-9042-1d13ebf4b294';
DELETE FROM auth.users WHERE id = 'dc9a9cfa-4d9e-4705-9042-1d13ebf4b294';

-- 2. HARDEN admin_provision_account TO ENSURE EMAIL CONFIRMATION AND UNBAN ON ACTIVE
CREATE OR REPLACE FUNCTION public.admin_provision_account(
  _user_id UUID,
  _email TEXT,
  _display_name TEXT,
  _role TEXT,
  _division TEXT DEFAULT 'Development',
  _position TEXT DEFAULT 'Specialist',
  _phone TEXT DEFAULT NULL,
  _create_team_member BOOLEAN DEFAULT true,
  _status TEXT DEFAULT 'active'
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor_id UUID := auth.uid();
  _actor_email TEXT;
  _clean_email TEXT := LOWER(TRIM(_email));
  _clean_role TEXT := LOWER(TRIM(_role));
  _clean_status TEXT := LOWER(TRIM(COALESCE(_status, 'active')));
  _tm_id UUID;
  _is_active_flag BOOLEAN;
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

  -- 2. Upsert public.profiles record
  INSERT INTO public.profiles (id, display_name, phone, status, created_at, updated_at)
  VALUES (_user_id, TRIM(_display_name), TRIM(_phone), _clean_status, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    phone = EXCLUDED.phone,
    status = _clean_status,
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

  -- 6. Audit trail
  INSERT INTO public.account_audit_logs (
    actor_id, actor_email, target_user_id, target_email, action, metadata
  ) VALUES (
    _actor_id, _actor_email, _user_id, _clean_email, 'account_created',
    jsonb_build_object(
      'display_name', _display_name,
      'role', _clean_role,
      'status', _clean_status,
      'division', _division,
      'position', _position,
      'team_member_id', _tm_id
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

REVOKE EXECUTE ON FUNCTION public.admin_provision_account(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_provision_account(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO authenticated, service_role;

-- 3. HELPER: SUPER ADMIN GET AUTH USER ID BY EMAIL
CREATE OR REPLACE FUNCTION public.admin_get_auth_user_id_by_email(_email TEXT)
RETURNS UUID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid UUID;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin can look up auth identities.';
  END IF;

  SELECT id INTO _uid
  FROM auth.users
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(_email))
  LIMIT 1;

  RETURN _uid;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_auth_user_id_by_email(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_auth_user_id_by_email(TEXT) TO authenticated, service_role;

-- 4. DEPRECATE DIRECT SQL INSERT IN admin_create_account
CREATE OR REPLACE FUNCTION public.admin_create_account(
  _email TEXT,
  _password TEXT,
  _display_name TEXT,
  _role TEXT,
  _division TEXT DEFAULT 'Development',
  _position TEXT DEFAULT 'Specialist',
  _phone TEXT DEFAULT NULL,
  _create_team_member BOOLEAN DEFAULT true
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'admin_create_account direct SQL is deprecated. Accounts must be provisioned via client-side Auth API and admin_provision_account.';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_create_account(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_account(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated, service_role;
