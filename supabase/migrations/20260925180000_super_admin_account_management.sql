-- ============================================================
-- SADA WORK OS — Migration: 20260925180000_super_admin_account_management.sql
-- Module: Centralized Identity, Account Creation & Account Lifecycle
-- Super Admin Exclusive Account Management Center
-- ============================================================

-- 1. Profiles Table Extension: status and phone
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'suspended', 'deleted'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);

-- 2. Account Security & Audit Trail Table
CREATE TABLE IF NOT EXISTS public.account_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  target_user_id UUID,
  target_email TEXT,
  action TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_audit_target ON public.account_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_account_audit_action ON public.account_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_account_audit_created ON public.account_audit_logs(created_at DESC);

ALTER TABLE public.account_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super Admins read account_audit_logs" ON public.account_audit_logs;
CREATE POLICY "Super Admins read account_audit_logs"
  ON public.account_audit_logs FOR SELECT
  USING (public.is_super_admin(auth.uid()));

-- 3. Core Protection Helper: Count Active Super Admins
CREATE OR REPLACE FUNCTION public.count_active_super_admins()
RETURNS INTEGER LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(DISTINCT ur.user_id)::INTEGER
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role::text = 'super_admin'
    AND p.status = 'active';
$$;

REVOKE EXECUTE ON FUNCTION public.count_active_super_admins() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.count_active_super_admins() TO authenticated, service_role;

-- 4. Update Engine RBAC Helpers to Enforce Non-Suspended Status
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.role::text = 'super_admin'
      AND p.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.role::text IN ('admin', 'super_admin')
      AND p.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_sada_access(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.role::text IN ('worker', 'admin', 'super_admin')
      AND p.status = 'active'
  );
$$;

-- 5. RPC: List Accounts for Super Admin (Secure Projection)
CREATE OR REPLACE FUNCTION public.admin_list_accounts()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  display_name TEXT,
  phone TEXT,
  role TEXT,
  status TEXT,
  is_super_admin BOOLEAN,
  created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  banned_until TIMESTAMPTZ,
  team_member_id UUID,
  team_member_name TEXT,
  team_position TEXT,
  division TEXT,
  photo_url TEXT,
  bio TEXT,
  specialties TEXT[],
  socials JSONB,
  published BOOLEAN,
  is_active BOOLEAN
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin can view account management records.';
  END IF;

  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email::TEXT,
    COALESCE(p.display_name, (u.raw_user_meta_data->>'display_name'), (u.raw_user_meta_data->>'name'), split_part(u.email, '@', 1))::TEXT AS display_name,
    p.phone::TEXT,
    COALESCE(ur.role::TEXT, tm.role, 'worker')::TEXT AS role,
    COALESCE(p.status, 'active')::TEXT AS status,
    (COALESCE(ur.role::TEXT, '') = 'super_admin') AS is_super_admin,
    u.created_at,
    u.last_sign_in_at,
    u.banned_until,
    tm.id AS team_member_id,
    tm.name::TEXT AS team_member_name,
    tm.position::TEXT AS team_position,
    COALESCE(tm.division, 'Development')::TEXT AS division,
    tm.photo_url::TEXT,
    tm.bio::TEXT,
    tm.specialties,
    COALESCE(tm.socials, '{}'::jsonb) AS socials,
    COALESCE(tm.published, true) AS published,
    COALESCE(tm.is_active, true) AS is_active
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.user_roles ur ON ur.user_id = u.id
  LEFT JOIN public.team_members tm ON (tm.profile_id = u.id OR LOWER(tm.email) = LOWER(u.email))
  WHERE COALESCE(p.status, 'active') != 'deleted'
  ORDER BY u.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_accounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_accounts() TO authenticated, service_role;

-- 6. RPC: Create Account (Super Admin Exclusive)
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
DECLARE
  _actor_id UUID := auth.uid();
  _actor_email TEXT;
  _new_user_id UUID;
  _clean_email TEXT := LOWER(TRIM(_email));
  _clean_role TEXT := LOWER(TRIM(_role));
  _tm_id UUID;
BEGIN
  -- 1. Authorization Guard
  IF NOT public.is_super_admin(_actor_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin can create accounts.';
  END IF;

  -- 2. Input Validation
  IF _clean_email IS NULL OR _clean_email = '' OR _clean_email NOT LIKE '%@%.%' THEN
    RAISE EXCEPTION 'A valid email address is required.';
  END IF;

  IF _password IS NULL OR char_length(_password) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters long.';
  END IF;

  IF _clean_role NOT IN ('super_admin', 'admin', 'worker') THEN
    RAISE EXCEPTION 'Invalid role. Role must be super_admin, admin, or worker.';
  END IF;

  -- Check if user already exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE LOWER(email) = _clean_email) THEN
    RAISE EXCEPTION 'An account with this email address already exists.';
  END IF;

  SELECT email INTO _actor_email FROM auth.users WHERE id = _actor_id;

  -- 3. Create canonical auth.users record
  _new_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    _new_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    _clean_email,
    extensions.crypt(_password, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('display_name', TRIM(_display_name), 'name', TRIM(_display_name)),
    now(),
    now()
  );

  -- 4. Create auth.identities record
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, provider_id
  ) VALUES (
    _new_user_id,
    _new_user_id,
    format('{"sub":"%s","email":"%s"}', _new_user_id, _clean_email)::jsonb,
    'email',
    now(),
    now(),
    now(),
    _clean_email
  );

  -- 5. Upsert public.profiles record
  INSERT INTO public.profiles (id, display_name, phone, status, created_at, updated_at)
  VALUES (_new_user_id, TRIM(_display_name), TRIM(_phone), 'active', now(), now())
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    phone = EXCLUDED.phone,
    status = 'active',
    updated_at = now();

  -- 6. Insert canonical user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_new_user_id, _clean_role::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- 7. Team Member provisioning / linking
  IF _create_team_member THEN
    SELECT id INTO _tm_id FROM public.team_members
    WHERE LOWER(email) = _clean_email OR profile_id = _new_user_id LIMIT 1;

    IF _tm_id IS NOT NULL THEN
      UPDATE public.team_members
      SET profile_id = _new_user_id,
          role = _clean_role,
          division = COALESCE(_division, division),
          position = COALESCE(TRIM(_position), position),
          name = COALESCE(TRIM(_display_name), name),
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
        _new_user_id,
        true,
        true,
        50,
        now(),
        now()
      ) RETURNING id INTO _tm_id;
    END IF;
  END IF;

  -- 8. Audit trail
  INSERT INTO public.account_audit_logs (
    actor_id, actor_email, target_user_id, target_email, action, metadata
  ) VALUES (
    _actor_id, _actor_email, _new_user_id, _clean_email, 'account_created',
    jsonb_build_object(
      'role', _clean_role,
      'division', _division,
      'position', _position,
      'team_member_created', _create_team_member,
      'team_member_id', _tm_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', _new_user_id,
    'email', _clean_email,
    'role', _clean_role,
    'team_member_id', _tm_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_create_account(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_account(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated, service_role;

-- 7. RPC: Update Account & Team Profile (Super Admin Exclusive)
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
  _is_active BOOLEAN
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor_id UUID := auth.uid();
  _actor_email TEXT;
  _target_email TEXT;
  _current_role TEXT;
  _clean_role TEXT := LOWER(TRIM(_role));
  _role_changed BOOLEAN := false;
BEGIN
  IF NOT public.is_super_admin(_actor_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin can update account profiles.';
  END IF;

  IF _clean_role NOT IN ('super_admin', 'admin', 'worker') THEN
    RAISE EXCEPTION 'Invalid role. Role must be super_admin, admin, or worker.';
  END IF;

  SELECT email INTO _actor_email FROM auth.users WHERE id = _actor_id;
  SELECT email INTO _target_email FROM auth.users WHERE id = _user_id;

  IF _target_email IS NULL THEN
    RAISE EXCEPTION 'Account not found.';
  END IF;

  -- Super Admin Protection: Prevent demoting last Super Admin
  SELECT role::TEXT INTO _current_role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
  IF _current_role = 'super_admin' AND _clean_role != 'super_admin' THEN
    IF public.count_active_super_admins() <= 1 THEN
      RAISE EXCEPTION 'At least one active Super Admin is required.';
    END IF;
  END IF;

  IF _current_role IS DISTINCT FROM _clean_role THEN
    _role_changed := true;
  END IF;

  -- 1. Update Profiles
  UPDATE public.profiles
  SET display_name = TRIM(_display_name),
      phone = TRIM(_phone),
      updated_at = now()
  WHERE id = _user_id;

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
      is_active = COALESCE(_is_active, is_active),
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
      'division', _division,
      'position', _position,
      'role_changed', _role_changed,
      'previous_role', _current_role
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

  RETURN jsonb_build_object('success', true, 'user_id', _user_id, 'role', _clean_role);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_account(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], JSONB, BOOLEAN, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_account(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], JSONB, BOOLEAN, BOOLEAN) TO authenticated, service_role;

-- 8. RPC: Suspend Account (Super Admin Exclusive)
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

  -- 4. Audit Log
  INSERT INTO public.account_audit_logs (
    actor_id, actor_email, target_user_id, target_email, action, metadata
  ) VALUES (
    _actor_id, _actor_email, _user_id, _target_email, 'account_suspended',
    jsonb_build_object('reason', _reason)
  );

  RETURN jsonb_build_object('success', true, 'user_id', _user_id, 'status', 'suspended');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_suspend_account(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_suspend_account(UUID, TEXT) TO authenticated, service_role;

-- 9. RPC: Reactivate Account (Super Admin Exclusive)
CREATE OR REPLACE FUNCTION public.admin_reactivate_account(
  _user_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor_id UUID := auth.uid();
  _actor_email TEXT;
  _target_email TEXT;
BEGIN
  IF NOT public.is_super_admin(_actor_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin can reactivate accounts.';
  END IF;

  SELECT email INTO _actor_email FROM auth.users WHERE id = _actor_id;
  SELECT email INTO _target_email FROM auth.users WHERE id = _user_id;

  IF _target_email IS NULL THEN
    RAISE EXCEPTION 'Account not found.';
  END IF;

  -- 1. Restore Profile status to active
  UPDATE public.profiles
  SET status = 'active',
      updated_at = now()
  WHERE id = _user_id;

  -- 2. Clear ban in auth.users
  UPDATE auth.users
  SET banned_until = NULL,
      updated_at = now()
  WHERE id = _user_id;

  -- 3. Restore operational status in team_members
  UPDATE public.team_members
  SET is_active = true,
      updated_at = now()
  WHERE profile_id = _user_id OR LOWER(email) = LOWER(_target_email);

  -- 4. Audit Log
  INSERT INTO public.account_audit_logs (
    actor_id, actor_email, target_user_id, target_email, action, metadata
  ) VALUES (
    _actor_id, _actor_email, _user_id, _target_email, 'account_reactivated',
    jsonb_build_object('status', 'active')
  );

  RETURN jsonb_build_object('success', true, 'user_id', _user_id, 'status', 'active');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_reactivate_account(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reactivate_account(UUID) TO authenticated, service_role;

-- 10. RPC: Reset Password (Super Admin Exclusive)
CREATE OR REPLACE FUNCTION public.admin_reset_account_password(
  _user_id UUID,
  _new_password TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor_id UUID := auth.uid();
  _actor_email TEXT;
  _target_email TEXT;
BEGIN
  IF NOT public.is_super_admin(_actor_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin can reset account passwords.';
  END IF;

  IF _new_password IS NULL OR char_length(_new_password) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters long.';
  END IF;

  SELECT email INTO _actor_email FROM auth.users WHERE id = _actor_id;
  SELECT email INTO _target_email FROM auth.users WHERE id = _user_id;

  IF _target_email IS NULL THEN
    RAISE EXCEPTION 'Account not found.';
  END IF;

  -- Update auth.users encrypted password
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(_new_password, extensions.gen_salt('bf')),
      updated_at = now()
  WHERE id = _user_id;

  -- Audit Log (NO PASSWORD DATA STORED)
  INSERT INTO public.account_audit_logs (
    actor_id, actor_email, target_user_id, target_email, action, metadata
  ) VALUES (
    _actor_id, _actor_email, _user_id, _target_email, 'password_changed',
    jsonb_build_object('method', 'super_admin_reset')
  );

  RETURN jsonb_build_object('success', true, 'user_id', _user_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_reset_account_password(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_account_password(UUID, TEXT) TO authenticated, service_role;

-- 11. RPC: Dependency Analysis Before Deletion
CREATE OR REPLACE FUNCTION public.admin_analyze_account_dependencies(
  _user_id UUID
) RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _assigned_tasks INTEGER := 0;
  _created_tasks INTEGER := 0;
  _activity_count INTEGER := 0;
  _salary_records_count INTEGER := 0;
  _salary_payments_count INTEGER := 0;
  _salary_requests_count INTEGER := 0;
  _lead_projects_count INTEGER := 0;
  _target_email TEXT;
  _tm_id UUID;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin can analyze account dependencies.';
  END IF;

  SELECT email INTO _target_email FROM auth.users WHERE id = _user_id;
  SELECT id INTO _tm_id FROM public.team_members WHERE profile_id = _user_id OR LOWER(email) = LOWER(_target_email) LIMIT 1;

  -- Count tasks
  SELECT COUNT(*)::INTEGER INTO _assigned_tasks
  FROM public.project_tasks
  WHERE assignee_id = _user_id OR (_tm_id IS NOT NULL AND assignee_id = _tm_id);

  SELECT COUNT(*)::INTEGER INTO _created_tasks
  FROM public.project_tasks
  WHERE assigned_by_id = _user_id;

  -- Count activities
  SELECT COUNT(*)::INTEGER INTO _activity_count
  FROM public.project_activity
  WHERE actor_id = _user_id;

  -- Count projects led
  SELECT COUNT(*)::INTEGER INTO _lead_projects_count
  FROM public.client_projects
  WHERE project_lead_id = _user_id OR (_tm_id IS NOT NULL AND project_lead_id = _tm_id);

  -- Count financial records
  IF _tm_id IS NOT NULL THEN
    SELECT COUNT(*)::INTEGER INTO _salary_records_count FROM public.salary_records WHERE team_member_id = _tm_id;
    SELECT COUNT(*)::INTEGER INTO _salary_payments_count FROM public.salary_payments WHERE team_member_id = _tm_id;
    SELECT COUNT(*)::INTEGER INTO _salary_requests_count FROM public.salary_requests WHERE team_member_id = _tm_id;
  END IF;

  RETURN jsonb_build_object(
    'user_id', _user_id,
    'team_member_id', _tm_id,
    'assigned_tasks', _assigned_tasks,
    'created_tasks', _created_tasks,
    'activity_count', _activity_count,
    'lead_projects_count', _lead_projects_count,
    'salary_records_count', _salary_records_count,
    'salary_payments_count', _salary_payments_count,
    'salary_requests_count', _salary_requests_count,
    'has_business_dependencies', (_assigned_tasks > 0 OR _created_tasks > 0 OR _salary_records_count > 0 OR _salary_payments_count > 0 OR _salary_requests_count > 0 OR _lead_projects_count > 0)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_analyze_account_dependencies(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_analyze_account_dependencies(UUID) TO authenticated, service_role;

-- 12. RPC: Delete Account (Safe Lifecycle with Zero Financial/Task Data Loss)
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
  IF NOT public.is_super_admin(_actor_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin can delete accounts.';
  END IF;

  SELECT email INTO _actor_email FROM auth.users WHERE id = _actor_id;
  SELECT email INTO _target_email FROM auth.users WHERE id = _user_id;

  IF _target_email IS NULL THEN
    RAISE EXCEPTION 'Account not found.';
  END IF;

  -- Super Admin Protection: Prevent deleting last Super Admin
  SELECT role::TEXT INTO _target_role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
  IF _target_role = 'super_admin' THEN
    IF public.count_active_super_admins() <= 1 THEN
      RAISE EXCEPTION 'At least one active Super Admin is required.';
    END IF;
  END IF;

  _deps := public.admin_analyze_account_dependencies(_user_id);

  -- If user has historical dependencies (financial history, tasks, client projects):
  -- Preserve historical records intact, unlink identity safely, and remove authentication access
  IF (_deps->>'has_business_dependencies')::BOOLEAN THEN
    -- 1. Unlink team_member so foreign keys in salary/tasks don't cascade or violate constraints
    UPDATE public.team_members
    SET profile_id = NULL,
        is_active = false,
        updated_at = now()
    WHERE profile_id = _user_id OR LOWER(email) = LOWER(_target_email);

    -- 2. Mark profile as deleted
    UPDATE public.profiles
    SET status = 'deleted',
        display_name = '[Deleted Account]',
        updated_at = now()
    WHERE id = _user_id;

    -- 3. Delete user role
    DELETE FROM public.user_roles WHERE user_id = _user_id;

    -- 4. Delete auth credentials / identities
    DELETE FROM auth.identities WHERE user_id = _user_id;
    DELETE FROM auth.users WHERE id = _user_id;
  ELSE
    -- No historical dependencies: perform clean removal
    DELETE FROM public.team_members WHERE profile_id = _user_id OR LOWER(email) = LOWER(_target_email);
    DELETE FROM public.user_roles WHERE user_id = _user_id;
    DELETE FROM public.profiles WHERE id = _user_id;
    DELETE FROM auth.identities WHERE user_id = _user_id;
    DELETE FROM auth.users WHERE id = _user_id;
  END IF;

  -- 5. Audit Log
  INSERT INTO public.account_audit_logs (
    actor_id, actor_email, target_user_id, target_email, action, metadata
  ) VALUES (
    _actor_id, _actor_email, _user_id, _target_email, 'account_deleted',
    jsonb_build_object(
      'safely_preserved_dependencies', (_deps->>'has_business_dependencies')::BOOLEAN,
      'dependencies', _deps
    )
  );

  RETURN jsonb_build_object('success', true, 'user_id', _user_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_account(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_account(UUID) TO authenticated, service_role;

-- 13. RPC: List Account Audit Logs
CREATE OR REPLACE FUNCTION public.admin_list_account_audit_logs(
  _target_user_id UUID DEFAULT NULL
) RETURNS TABLE (
  id UUID,
  actor_id UUID,
  actor_email TEXT,
  target_user_id UUID,
  target_email TEXT,
  action TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin can view account audit logs.';
  END IF;

  RETURN QUERY
  SELECT
    aal.id,
    aal.actor_id,
    aal.actor_email,
    aal.target_user_id,
    aal.target_email,
    aal.action,
    aal.metadata,
    aal.created_at
  FROM public.account_audit_logs aal
  WHERE (_target_user_id IS NULL OR aal.target_user_id = _target_user_id)
  ORDER BY aal.created_at DESC
  LIMIT 100;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_account_audit_logs(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_account_audit_logs(UUID) TO authenticated, service_role;

-- 14. RPC: Provision Account Profile and Role (Post Auth API user creation)
CREATE OR REPLACE FUNCTION public.admin_provision_account(
  _user_id UUID,
  _email TEXT,
  _display_name TEXT,
  _role TEXT,
  _division TEXT DEFAULT 'Development',
  _position TEXT DEFAULT 'Specialist',
  _phone TEXT DEFAULT NULL,
  _create_team_member BOOLEAN DEFAULT true
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor_id UUID := auth.uid();
  _actor_email TEXT;
  _clean_email TEXT := LOWER(TRIM(_email));
  _clean_role TEXT := LOWER(TRIM(_role));
  _tm_id UUID;
BEGIN
  -- 1. Authorization Guard: ONLY Super Admin can provision accounts
  IF NOT public.is_super_admin(_actor_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin can provision accounts.';
  END IF;

  IF _clean_role NOT IN ('super_admin', 'admin', 'worker') THEN
    RAISE EXCEPTION 'Invalid role. Role must be super_admin, admin, or worker.';
  END IF;

  SELECT email INTO _actor_email FROM auth.users WHERE id = _actor_id;

  -- 2. Upsert public.profiles record
  INSERT INTO public.profiles (id, display_name, phone, status, created_at, updated_at)
  VALUES (_user_id, TRIM(_display_name), TRIM(_phone), 'active', now(), now())
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    phone = EXCLUDED.phone,
    status = 'active',
    updated_at = now();

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
        true,
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
    'team_member_id', _tm_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_provision_account(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_provision_account(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated, service_role;

