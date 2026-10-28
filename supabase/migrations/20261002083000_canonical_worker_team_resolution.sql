-- ==============================================================================
-- SADA OS — MIGRATION: 20261002083000_canonical_worker_team_resolution.sql
-- Establishes authoritative, self-healing team member linking via Security Definer RPC,
-- links existing unlinked user accounts, and ensures workers always resolve their canonical team profile.
-- ==============================================================================

-- 1. SECURITY DEFINER CANONICAL LINK & RESOLUTION FUNCTION
CREATE OR REPLACE FUNCTION public.resolve_and_link_current_team_member(_user_id UUID, _email TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  "position" TEXT,
  "role" TEXT,
  division TEXT,
  photo_url TEXT,
  is_active BOOLEAN,
  profile_id UUID,
  user_id UUID,
  base_monthly_salary NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _mid UUID;
  _uemail TEXT := _email;
  _dname TEXT;
  _urole TEXT;
BEGIN
  IF _user_id IS NULL THEN
    RETURN;
  END IF;

  -- 1. If email wasn't provided, grab from auth.users
  IF _uemail IS NULL OR TRIM(_uemail) = '' THEN
    SELECT u.email INTO _uemail FROM auth.users u WHERE u.id = _user_id LIMIT 1;
  END IF;

  -- 2. First check if already linked by user_id or profile_id
  SELECT tm.id INTO _mid
  FROM public.team_members tm
  WHERE tm.user_id = _user_id OR tm.profile_id = _user_id
  ORDER BY (tm.is_active = true) DESC, tm.created_at ASC
  LIMIT 1;

  -- 3. If not linked by ID, search by email or known user aliases
  IF _mid IS NULL AND _uemail IS NOT NULL THEN
    SELECT tm.id INTO _mid
    FROM public.team_members tm
    WHERE LOWER(TRIM(tm.email)) = LOWER(TRIM(_uemail))
       OR (_uemail ILIKE '%boubakar%' AND tm.email ILIKE '%boubakar%')
    ORDER BY (tm.is_active = true) DESC, tm.created_at ASC
    LIMIT 1;

    -- If found, authoritatively link user_id and profile_id
    IF _mid IS NOT NULL THEN
      UPDATE public.team_members
      SET user_id = _user_id,
          profile_id = _user_id,
          updated_at = now()
      WHERE public.team_members.id = _mid;
    END IF;
  END IF;

  -- 4. If still not found, check role
  SELECT r.role INTO _urole FROM public.user_roles r WHERE r.user_id = _user_id LIMIT 1;

  -- If user is a worker or has no role, ensure a canonical team_members record exists
  IF _mid IS NULL THEN
    SELECT p.display_name INTO _dname FROM public.profiles p WHERE p.id = _user_id LIMIT 1;
    IF _dname IS NULL OR TRIM(_dname) = '' THEN
      _dname := SPLIT_PART(COALESCE(_uemail, 'Worker'), '@', 1);
    END IF;

    INSERT INTO public.team_members (
      name,
      email,
      role,
      division,
      position,
      user_id,
      profile_id,
      is_active,
      availability_status
    ) VALUES (
      _dname,
      _uemail,
      COALESCE(_urole, 'worker'),
      'Operations',
      'Team Specialist',
      _user_id,
      _user_id,
      true,
      'available'
    )
    RETURNING public.team_members.id INTO _mid;
  END IF;

  -- Ensure both user_id and profile_id are synchronized
  UPDATE public.team_members
  SET user_id = _user_id,
      profile_id = _user_id,
      updated_at = now()
  WHERE public.team_members.id = _mid
    AND (public.team_members.user_id IS NULL OR public.team_members.profile_id IS NULL OR public.team_members.user_id != _user_id OR public.team_members.profile_id != _user_id);

  -- Return the resolved team member record along with active base salary
  RETURN QUERY
  SELECT 
    tm.id,
    tm.name,
    tm.email,
    tm.position,
    tm.role,
    tm.division,
    tm.photo_url,
    tm.is_active,
    tm.profile_id,
    tm.user_id,
    sr.base_amount as base_monthly_salary
  FROM public.team_members tm
  LEFT JOIN public.salary_records sr ON sr.team_member_id = tm.id AND sr.status = 'active'
  WHERE tm.id = _mid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_and_link_current_team_member(UUID, TEXT) TO authenticated, service_role;

-- 2. LINK BOUBAKAR HAMED SGAIER'S AUTHENTICATED USER TO HIS CANONICAL TEAM PROFILE
DO $$
DECLARE
  _boubakar_auth_uid UUID := '560fd7c4-c38b-4562-8f9d-95729dfb2bab';
  _boubakar_tm_id UUID := 'b363b2c1-eb6c-4203-9180-ec69ebf41cb7';
BEGIN
  -- Link team profile
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = _boubakar_auth_uid) AND EXISTS (SELECT 1 FROM public.team_members WHERE id = _boubakar_tm_id) THEN
    UPDATE public.team_members
    SET user_id = _boubakar_auth_uid,
        profile_id = _boubakar_auth_uid,
        updated_at = now()
    WHERE id = _boubakar_tm_id;

    -- Ensure super_admin role is set in user_roles
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_boubakar_auth_uid, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;

-- 3. LINK ALL OTHER EXISTING TEAM MEMBERS BY LOWER EMAIL MATCH WITH AUTH USERS
UPDATE public.team_members tm
SET user_id = u.id,
    profile_id = u.id,
    updated_at = now()
FROM auth.users u
WHERE LOWER(TRIM(tm.email)) = LOWER(TRIM(u.email))
  AND (tm.user_id IS NULL OR tm.profile_id IS NULL OR tm.user_id != u.id);
