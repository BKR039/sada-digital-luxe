-- ============================================================
-- SADA WORK OS — Migration: 20260928200000_account_lifecycle_and_crm_integrity.sql
-- 1. Account Lifecycle: Support ACTIVE, SUSPENDED, PENDING, DISABLED
-- 2. CRM Integrity: Link legacy orphan projects to canonical clients
-- ============================================================

-- 1. Expand public.profiles status constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check
  CHECK (status IN ('active', 'suspended', 'pending', 'disabled', 'deleted'));

-- 2. CRM Integrity: Create canonical Internal Operations client if needed
DO $$
DECLARE
  _internal_client_id UUID;
  _audit_luxury_id UUID := 'be178ac0-0cb6-444e-b02d-49bd64585266';
BEGIN
  -- Check if Audit Luxury SARL exists
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = _audit_luxury_id) THEN
    SELECT id INTO _audit_luxury_id FROM public.clients WHERE name ILIKE '%luxury%' LIMIT 1;
  END IF;

  -- Ensure internal operations client exists
  SELECT id INTO _internal_client_id FROM public.clients WHERE name = 'SADA Internal Operations' LIMIT 1;
  IF _internal_client_id IS NULL THEN
    INSERT INTO public.clients (
      name, industry, status, notes
    ) VALUES (
      'SADA Internal Operations',
      'Agency Operations',
      'active',
      'Canonical agency workspace client for internal oversight and legacy verification projects'
    ) RETURNING id INTO _internal_client_id;
  END IF;

  -- Link Luxury Atelier project to Audit Luxury SARL (or internal if not found)
  UPDATE public.client_projects
  SET client_id = COALESCE(_audit_luxury_id, _internal_client_id)
  WHERE title ILIKE '%Luxury Atelier%' AND client_id IS NULL;

  -- Link any other remaining orphan projects to SADA Internal Operations
  UPDATE public.client_projects
  SET client_id = _internal_client_id
  WHERE client_id IS NULL;
END;
$$;

-- 3. Enhance admin_provision_account to support status parameter
DROP FUNCTION IF EXISTS public.admin_provision_account(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.admin_update_account(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], JSONB, BOOLEAN, BOOLEAN);

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

  -- If status is suspended or disabled, ban in auth.users
  IF _clean_status IN ('suspended', 'disabled') THEN
    UPDATE auth.users
    SET banned_until = '3000-01-01 00:00:00+00'::timestamptz,
        updated_at = now()
    WHERE id = _user_id;
  END IF;

  -- 3. Set canonical user_roles
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _clean_role::app_role);

  -- 4. Team Member provisioning / linking
  IF _create_team_member THEN
    SELECT id INTO _tm_id FROM public.team_members
    WHERE LOWER(email) = _clean_email OR profile_id = _user_id LIMIT 1;

    IF _tm_id IS NOT NULL THEN
      UPDATE public.team_members
      SET profile_id = _user_id,
          role = _clean_role,
          division = COALESCE(_division, division),
          position = COALESCE(TRIM(_position), position),
          name = COALESCE(TRIM(_display_name), name),
          is_active = _is_active_flag,
          updated_at = now()
      WHERE id = _tm_id;
    ELSE
      INSERT INTO public.team_members (
        name, position, division, role, email, profile_id, is_active, published, sort_order, created_at, updated_at
      ) VALUES (
        TRIM(_display_name),
        COALESCE(TRIM(_position), 'Specialist'),
        COALESCE(_division, 'Development'),
        _clean_role,
        _clean_email,
        _user_id,
        _is_active_flag,
        true,
        50,
        now(),
        now()
      ) RETURNING id INTO _tm_id;
    END IF;
  END IF;

  -- 5. Audit trail
  INSERT INTO public.account_audit_logs (
    actor_id, actor_email, target_user_id, target_email, action, metadata
  ) VALUES (
    _actor_id, _actor_email, _user_id, _clean_email, 'account_created',
    jsonb_build_object(
      'role', _clean_role,
      'status', _clean_status,
      'division', _division,
      'position', _position,
      'team_member_created', _create_team_member,
      'team_member_id', _tm_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
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

-- 4. Enhance admin_update_account to accept status
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
  IF NOT public.is_super_admin(_actor_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin can update account profiles.';
  END IF;

  IF _clean_role NOT IN ('super_admin', 'admin', 'worker') THEN
    RAISE EXCEPTION 'Invalid role. Role must be super_admin, admin, or worker.';
  END IF;

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

  -- Super Admin Protection: Prevent demoting or deactivating last active Super Admin
  IF _current_role = 'super_admin' AND (_clean_role != 'super_admin' OR (_clean_status IS NOT NULL AND _clean_status != 'active')) THEN
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

  -- 1. Update Profiles
  UPDATE public.profiles
  SET display_name = TRIM(_display_name),
      phone = TRIM(_phone),
      status = COALESCE(_clean_status, status),
      updated_at = now()
  WHERE id = _user_id;

  -- Auth login ban synchronization
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

  -- 2. Update Auth metadata
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{display_name}',
        to_jsonb(TRIM(_display_name))
      ),
      updated_at = now()
  WHERE id = _user_id;

  -- 3. Update Role
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, _clean_role::app_role);

  -- 4. Update linked Team Member if exists
  UPDATE public.team_members
  SET name = TRIM(_display_name),
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
  WHERE profile_id = _user_id OR LOWER(email) = LOWER(_target_email);

  -- 5. Audit Log
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

  IF _status_changed THEN
    INSERT INTO public.account_audit_logs (
      actor_id, actor_email, target_user_id, target_email, action, metadata
    ) VALUES (
      _actor_id, _actor_email, _user_id, _target_email, 'status_changed',
      jsonb_build_object(
        'previous_status', _current_status,
        'new_status', _clean_status
      )
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'user_id', _user_id, 'role', _clean_role, 'status', COALESCE(_clean_status, _current_status));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_account(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], JSONB, BOOLEAN, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_account(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], JSONB, BOOLEAN, BOOLEAN, TEXT) TO authenticated, service_role;
