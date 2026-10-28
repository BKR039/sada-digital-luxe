-- ==============================================================================
-- SADA OS — MIGRATION: 20261002080000_fix_worker_salary_advance_resolution_and_rls.sql
-- Fix Worker -> Team Profile -> Compensation -> Base Salary flow,
-- harden RLS policies, auto-link user accounts with team profiles, and support admin configuration.
-- ==============================================================================

-- 1. HARDEN get_team_member_id AS PURE STABLE SECURITY DEFINER (NO DML/UPDATE)
CREATE OR REPLACE FUNCTION public.get_team_member_id(_user_id UUID)
RETURNS UUID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _mid UUID;
  _uemail TEXT;
BEGIN
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 1. Match by profile_id OR user_id
  SELECT id INTO _mid FROM public.team_members
  WHERE profile_id = _user_id OR user_id = _user_id
  ORDER BY (is_active = true) DESC, created_at ASC
  LIMIT 1;

  IF _mid IS NOT NULL THEN
    RETURN _mid;
  END IF;

  -- 2. Fallback: match by auth.users email
  SELECT email INTO _uemail FROM auth.users WHERE id = _user_id LIMIT 1;
  IF _uemail IS NOT NULL THEN
    SELECT id INTO _mid FROM public.team_members
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(_uemail))
    ORDER BY (is_active = true) DESC, created_at ASC
    LIMIT 1;

    IF _mid IS NOT NULL THEN
      RETURN _mid;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_member_id(UUID) TO authenticated, anon, service_role;

-- 2. AUTO-LINK TRIGGER ON team_members (BEFORE INSERT OR UPDATE)
CREATE OR REPLACE FUNCTION public.trg_auto_link_team_member_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _matched_uid UUID;
BEGIN
  -- If email is provided and (user_id IS NULL OR profile_id IS NULL)
  IF NEW.email IS NOT NULL AND (NEW.user_id IS NULL OR NEW.profile_id IS NULL) THEN
    SELECT id INTO _matched_uid
    FROM auth.users
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(NEW.email))
    LIMIT 1;

    IF _matched_uid IS NOT NULL THEN
      NEW.user_id := COALESCE(NEW.user_id, _matched_uid);
      NEW.profile_id := COALESCE(NEW.profile_id, _matched_uid);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_team_members_auto_link ON public.team_members;
CREATE TRIGGER trg_team_members_auto_link
  BEFORE INSERT OR UPDATE OF email, user_id, profile_id
  ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_auto_link_team_member_user();

-- 3. AUTO-LINK TRIGGER ON profiles (AFTER INSERT OR UPDATE)
CREATE OR REPLACE FUNCTION public.trg_auto_link_profile_to_team_member()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uemail TEXT;
BEGIN
  SELECT email INTO _uemail FROM auth.users WHERE id = NEW.id LIMIT 1;

  IF _uemail IS NOT NULL THEN
    UPDATE public.team_members
    SET user_id = NEW.id,
        profile_id = COALESCE(profile_id, NEW.id),
        updated_at = now()
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(_uemail))
      AND (user_id IS NULL OR profile_id IS NULL OR user_id != NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_auto_link_team ON public.profiles;
CREATE TRIGGER trg_profiles_auto_link_team
  AFTER INSERT OR UPDATE OF id
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_auto_link_profile_to_team_member();

-- 4. HARDEN admin_provision_account TO SET BOTH profile_id AND user_id
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

  -- 5. Audit trail
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

-- 5. HARDEN admin_update_account TO SET BOTH profile_id AND user_id
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

  -- 5. Audit Log
  INSERT INTO public.account_audit_logs (
    actor_id, actor_email, target_user_id, target_email, action, metadata
  ) VALUES (
    _actor_id, _actor_email, _user_id, _target_email, 'account_updated',
    jsonb_build_object(
      'display_name', _display_name,
      'role', _clean_role,
      'status', COALESCE(_clean_status, _current_status),
      'role_changed', _role_changed,
      'status_changed', _status_changed
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 6. AUTHORITATIVE RLS POLICIES FOR team_members, salary_records, salary_requests, salary_payments

-- team_members
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workers view own team_members" ON public.team_members;
CREATE POLICY "Workers view own team_members"
  ON public.team_members FOR SELECT
  USING (
    (auth.uid() IS NOT NULL) AND (
      (profile_id = auth.uid()) OR
      (user_id = auth.uid()) OR
      (email IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM(COALESCE(auth.jwt()->>'email', ''))))
    )
  );

DROP POLICY IF EXISTS "Workers update own non-sensitive profile" ON public.team_members;
CREATE POLICY "Workers update own non-sensitive profile"
  ON public.team_members FOR UPDATE
  USING (
    (auth.uid() IS NOT NULL) AND (
      (profile_id = auth.uid()) OR
      (user_id = auth.uid()) OR
      (email IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM(COALESCE(auth.jwt()->>'email', ''))))
    )
  )
  WITH CHECK (
    (auth.uid() IS NOT NULL) AND (
      (profile_id = auth.uid()) OR
      (user_id = auth.uid()) OR
      (email IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM(COALESCE(auth.jwt()->>'email', ''))))
    )
  );

-- salary_records
ALTER TABLE public.salary_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workers view own salary_records" ON public.salary_records;
CREATE POLICY "Workers view own salary_records"
  ON public.salary_records FOR SELECT
  USING (
    team_member_id IN (
      SELECT id FROM public.team_members
      WHERE profile_id = auth.uid()
         OR user_id = auth.uid()
         OR (email IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM(COALESCE(auth.jwt()->>'email', ''))))
    )
  );

-- salary_requests
ALTER TABLE public.salary_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workers view own salary_requests" ON public.salary_requests;
CREATE POLICY "Workers view own salary_requests"
  ON public.salary_requests FOR SELECT
  USING (
    team_member_id IN (
      SELECT id FROM public.team_members
      WHERE profile_id = auth.uid()
         OR user_id = auth.uid()
         OR (email IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM(COALESCE(auth.jwt()->>'email', ''))))
    )
  );

DROP POLICY IF EXISTS "Workers insert own salary_requests" ON public.salary_requests;
CREATE POLICY "Workers insert own salary_requests"
  ON public.salary_requests FOR INSERT
  WITH CHECK (
    status = 'pending' AND
    team_member_id IN (
      SELECT id FROM public.team_members
      WHERE profile_id = auth.uid()
         OR user_id = auth.uid()
         OR (email IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM(COALESCE(auth.jwt()->>'email', ''))))
    )
  );

-- salary_payments
ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workers view own salary_payments" ON public.salary_payments;
CREATE POLICY "Workers view own salary_payments"
  ON public.salary_payments FOR SELECT
  USING (
    team_member_id IN (
      SELECT id FROM public.team_members
      WHERE profile_id = auth.uid()
         OR user_id = auth.uid()
         OR (email IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM(COALESCE(auth.jwt()->>'email', ''))))
    )
  );

-- 7. ONE-TIME SYNCHRONIZATION AND REPAIR OF EXISTING TEAM MEMBERS & USERS
UPDATE public.team_members tm
SET user_id = u.id,
    profile_id = COALESCE(tm.profile_id, u.id),
    updated_at = now()
FROM auth.users u
WHERE LOWER(TRIM(tm.email)) = LOWER(TRIM(u.email))
  AND (tm.user_id IS NULL OR tm.profile_id IS NULL OR tm.user_id != u.id);

-- Ensure Test Worker Finance has correct email populated if null
UPDATE public.team_members
SET email = 'worker.test.finance@sada.agency',
    updated_at = now()
WHERE id = 'ec47b0e8-e2b8-4479-8219-97d3d4955e84' AND email IS NULL;
