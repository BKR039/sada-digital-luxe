-- ============================================================
-- SADA OS — MIGRATION: 20261021140000_account_credentials_vault_and_single_source_of_truth.sql
-- 1. Deduplicate user_roles and enforce UNIQUE(user_id) constraint
-- 2. Create public.account_credentials vault for Super Admin visibility & persistence
-- 3. Update admin_reset_account_password to sync Supabase Auth & credential vault
-- 4. Create admin_update_account_email for seamless email synchronization
-- 5. Update admin_list_accounts to return current_password and eliminate duplicate rows
-- 6. Initialize credentials for existing users
-- ============================================================

-- ------------------------------------------------------------
-- 1. DEDUPLICATE user_roles & ENFORCE UNIQUE(user_id)
-- ------------------------------------------------------------
-- Delete lower-privilege duplicate rows if a user has multiple roles
DELETE FROM public.user_roles ur1
WHERE EXISTS (
  SELECT 1 FROM public.user_roles ur2
  WHERE ur2.user_id = ur1.user_id
    AND ur2.id <> ur1.id
    AND (
      (ur2.role = 'super_admin' AND ur1.role <> 'super_admin')
      OR (ur2.role = 'admin' AND ur1.role = 'worker')
      OR (ur2.role = ur1.role AND ur2.created_at < ur1.created_at)
    )
);

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_key;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);

-- ------------------------------------------------------------
-- 2. CREDENTIAL VAULT TABLE: public.account_credentials
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_credentials (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  current_password TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.account_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super Admin can view account credentials" ON public.account_credentials;
CREATE POLICY "Super Admin can view account credentials"
  ON public.account_credentials
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super Admin can manage account credentials" ON public.account_credentials;
CREATE POLICY "Super Admin can manage account credentials"
  ON public.account_credentials
  FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

REVOKE ALL ON public.account_credentials FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_credentials TO authenticated, service_role;

-- ------------------------------------------------------------
-- 3. HARDEN admin_reset_account_password
-- ------------------------------------------------------------
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

  -- 1. Update auth.users encrypted password for Supabase Auth login
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(_new_password, extensions.gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      banned_until = NULL,
      updated_at = now()
  WHERE id = _user_id;

  -- 2. Store in credentials vault for Super Admin visibility & single source of truth
  INSERT INTO public.account_credentials (
    user_id, email, current_password, updated_at, updated_by
  ) VALUES (
    _user_id, _target_email, _new_password, now(), _actor_id
  )
  ON CONFLICT (user_id) DO UPDATE
  SET current_password = EXCLUDED.current_password,
      email = EXCLUDED.email,
      updated_at = now(),
      updated_by = EXCLUDED.updated_by;

  -- 3. Audit Log
  INSERT INTO public.account_audit_logs (
    actor_id, actor_email, target_user_id, target_email, action, metadata
  ) VALUES (
    _actor_id, _actor_email, _user_id, _target_email, 'password_changed',
    jsonb_build_object('method', 'super_admin_reset')
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', _user_id,
    'current_password', _new_password
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_reset_account_password(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_account_password(UUID, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 4. RPC: admin_update_account_email
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_account_email(
  _user_id UUID,
  _new_email TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor_id UUID := auth.uid();
  _actor_email TEXT;
  _old_email TEXT;
  _clean_email TEXT;
BEGIN
  IF NOT public.is_super_admin(_actor_id) THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin can update account emails.';
  END IF;

  _clean_email := LOWER(TRIM(_new_email));

  IF _clean_email IS NULL OR char_length(_clean_email) < 5 OR _clean_email NOT LIKE '%@%.%' THEN
    RAISE EXCEPTION 'Invalid email address format. Email must include @ and a valid domain.';
  END IF;

  SELECT email INTO _actor_email FROM auth.users WHERE id = _actor_id;
  SELECT email INTO _old_email FROM auth.users WHERE id = _user_id;

  IF _old_email IS NULL THEN
    RAISE EXCEPTION 'Account not found.';
  END IF;

  -- Check if another user already has this email
  IF EXISTS (SELECT 1 FROM auth.users WHERE LOWER(email) = _clean_email AND id <> _user_id) THEN
    RAISE EXCEPTION 'An account with email % already exists.', _clean_email;
  END IF;

  -- 1. Update auth.users
  UPDATE auth.users
  SET email = _clean_email,
      raw_user_meta_data = jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{email}',
        to_jsonb(_clean_email)
      ),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
  WHERE id = _user_id;

  -- 2. Update auth.identities
  UPDATE auth.identities
  SET identity_data = jsonb_set(
        COALESCE(identity_data, '{}'::jsonb),
        '{email}',
        to_jsonb(_clean_email)
      ),
      updated_at = now()
  WHERE user_id = _user_id;

  -- 3. Update public.team_members
  UPDATE public.team_members
  SET email = _clean_email,
      updated_at = now()
  WHERE profile_id = _user_id OR user_id = _user_id;

  -- 4. Update public.account_credentials
  UPDATE public.account_credentials
  SET email = _clean_email,
      updated_at = now()
  WHERE user_id = _user_id;

  -- 5. Audit Log
  INSERT INTO public.account_audit_logs (
    actor_id, actor_email, target_user_id, target_email, action, metadata
  ) VALUES (
    _actor_id, _actor_email, _user_id, _clean_email, 'email_updated',
    jsonb_build_object('old_email', _old_email, 'new_email', _clean_email)
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', _user_id,
    'old_email', _old_email,
    'email', _clean_email
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_account_email(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_account_email(UUID, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 5. UPDATE admin_list_accounts TO INCLUDE current_password
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_list_accounts();

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
  is_active BOOLEAN,
  current_password TEXT
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
    COALESCE(tm.is_active, true) AS is_active,
    ac.current_password::TEXT AS current_password
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.user_roles ur ON ur.user_id = u.id
  LEFT JOIN public.account_credentials ac ON ac.user_id = u.id
  LEFT JOIN LATERAL (
    SELECT t.id, t.name, t.position, t.division, t.photo_url, t.bio, t.specialties, t.socials, t.published, t.is_active, t.role
    FROM public.team_members t
    WHERE t.profile_id = u.id OR LOWER(t.email) = LOWER(u.email)
    ORDER BY (t.profile_id = u.id) DESC, t.updated_at DESC NULLS LAST
    LIMIT 1
  ) tm ON true
  WHERE u.deleted_at IS NULL
    AND COALESCE((u.raw_user_meta_data->>'deleted')::boolean, false) = false
  ORDER BY
    (COALESCE(ur.role::TEXT, '') = 'super_admin') DESC,
    u.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_accounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_accounts() TO authenticated, service_role;

-- ------------------------------------------------------------
-- 6. INITIALIZE CREDENTIALS & FIX EMAIL TYPO FOR TARGET ACCOUNT
-- ------------------------------------------------------------
-- Fix email typo from boubakarhamedsgail@gmailcom to boubakarhamedsgail@gmail.com
UPDATE auth.users
SET email = 'boubakarhamedsgail@gmail.com',
    raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{email}',
      to_jsonb('boubakarhamedsgail@gmail.com'::text)
    ),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    banned_until = NULL,
    encrypted_password = extensions.crypt('Boubakar2026!', extensions.gen_salt('bf')),
    updated_at = now()
WHERE id = 'a598a200-e5cc-405a-94b7-153bcb5ee10a';

UPDATE auth.identities
SET identity_data = jsonb_set(
      COALESCE(identity_data, '{}'::jsonb),
      '{email}',
      to_jsonb('boubakarhamedsgail@gmail.com'::text)
    ),
    updated_at = now()
WHERE user_id = 'a598a200-e5cc-405a-94b7-153bcb5ee10a';

UPDATE public.team_members
SET email = 'boubakarhamedsgail@gmail.com',
    updated_at = now()
WHERE profile_id = 'a598a200-e5cc-405a-94b7-153bcb5ee10a'
   OR email = 'boubakarhamedsgail@gmailcom';

-- Save credentials in vault
INSERT INTO public.account_credentials (
  user_id, email, current_password, updated_at
) VALUES (
  'a598a200-e5cc-405a-94b7-153bcb5ee10a',
  'boubakarhamedsgail@gmail.com',
  'Boubakar2026!',
  now()
)
ON CONFLICT (user_id) DO UPDATE
SET current_password = EXCLUDED.current_password,
    email = EXCLUDED.email,
    updated_at = now();
