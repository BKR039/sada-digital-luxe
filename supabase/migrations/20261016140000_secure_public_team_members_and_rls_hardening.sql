-- ============================================================
-- SADA WORK OS — Migration: 20261016140000_secure_public_team_members_and_rls_hardening.sql
-- Narrow & Hardened Fix for DEF-TW-05 & DEF-TW-06 (Public Team Visibility & Zero-Trust RLS)
-- ============================================================
-- Architecture Rationale:
-- 1. In migration 20261010130000, EXECUTE on has_sada_access(UUID) and is_admin(UUID) was
--    correctly revoked from PUBLIC and anon to prevent adversarial session enumeration.
-- 2. Legacy policies on public.team_members ("Sada access read team_members" and
--    unscoped "Admins read all team_members") were applied to PUBLIC (including anon).
--    When anon ran a SELECT, PostgreSQL evaluated the admin policy expressions, causing
--    ERROR 42501 (permission denied for function has_sada_access).
-- 3. Blindly granting EXECUTE on has_sada_access to anon would undermine session isolation
--    and allow unauthenticated user probing.
-- 4. In migration 20260508145232, team_members.published was created with DEFAULT true,
--    and admin_provision_account hardcoded published = true on insert, causing internal
--    staff and test accounts to be published by default.
-- 5. Solution:
--    a) Set column default on public.team_members.published to false.
--    b) Update admin_provision_account to insert new members with published = false.
--    c) Clean up legacy unscoped policies on public.team_members.
--    d) Recreate internal admin & worker policies strictly scoped TO authenticated.
--    e) Create dedicated public view public.public_team_members WITH (security_invoker = false)
--       that projects ONLY the 11 public-facing fields and enforces the Canonical Public
--       Visibility Contract, preventing horizontal leakage of internal operational fields
--       (email, phone, profile_id, user_id, availability_status, employment_type).
--    f) Grant SELECT on public.public_team_members TO anon, authenticated.
-- ============================================================

-- 1. Alter schema default for published to false (safe by default)
ALTER TABLE public.team_members ALTER COLUMN published SET DEFAULT false;

-- 2. Clean up legacy and unscoped policies on team_members
DROP POLICY IF EXISTS "Sada access read team_members" ON public.team_members;
DROP POLICY IF EXISTS "Admins read all team_members" ON public.team_members;
DROP POLICY IF EXISTS "Workers view own team_members" ON public.team_members;
DROP POLICY IF EXISTS "Public view published team_members" ON public.team_members;

-- 3. Internal Administrative Read - strictly scoped to authenticated staff
CREATE POLICY "Admins read all team_members"
  ON public.team_members FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- 4. Worker Self-Profile Read - strictly scoped to authenticated staff
CREATE POLICY "Workers view own team_members"
  ON public.team_members FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL AND (
      profile_id = auth.uid() OR
      user_id = auth.uid()
    )
  );

-- 5. Authenticated Staff Published Read
CREATE POLICY "Public view published team_members"
  ON public.team_members FOR SELECT
  TO authenticated
  USING (
    published = true AND is_active = true
  );

-- 6. Dedicated Public Safe View (Zero Column Leakage)
-- Exposes ONLY public website attributes. Prevents enumeration of email, phone, profile_id.
-- Strictly enforces canonical public visibility conditions:
-- - published = true AND is_active = true
-- - valid public identity (name not empty and not an email address)
-- - intentionally configured public profile (has photo, bio, specialties, or socials)
CREATE OR REPLACE VIEW public.public_team_members
WITH (security_invoker = false) AS
SELECT
  id,
  name,
  position,
  position_ar,
  division,
  specialties,
  bio,
  bio_ar,
  photo_url,
  socials,
  sort_order
FROM public.team_members
WHERE published = true
  AND is_active = true
  AND name IS NOT NULL
  AND TRIM(name) != ''
  AND name NOT LIKE '%@%'
  AND position IS NOT NULL
  AND TRIM(position) != ''
  AND (
    (photo_url IS NOT NULL AND TRIM(photo_url) != '') OR
    (bio IS NOT NULL AND TRIM(bio) != '') OR
    (bio_ar IS NOT NULL AND TRIM(bio_ar) != '') OR
    (specialties IS NOT NULL AND array_length(specialties, 1) > 0) OR
    (socials IS NOT NULL AND socials != '{}'::jsonb AND socials != 'null'::jsonb)
  );

-- Grant public read access to the view only
GRANT SELECT ON public.public_team_members TO anon, authenticated;

-- 7. Update admin_provision_account to provision internal accounts as unpublished (published = false)
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
      -- Published is explicitly set to FALSE for newly provisioned internal accounts
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
        false,
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
