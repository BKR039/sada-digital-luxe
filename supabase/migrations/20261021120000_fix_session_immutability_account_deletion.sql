-- ============================================================
-- SADA OS — MIGRATION: 20261021120000_fix_session_immutability_account_deletion.sql
-- Fix Account Deletion Blocked by Session Immutability Trigger:
-- 1. Update prevent_delete_user_sessions():
--    - Allow deletion during administrative account purge (current_setting('sada.in_account_deletion', true) = 'true').
--    - Allow deletion when executed by an authorized Super Admin (public.is_super_admin(auth.uid())).
--    - Allow deletion by service_role (backend maintenance / automated scripts).
--    - Allow cascading deletion when referencing auth.users record is removed.
--    - Strict immutability exception remains active for non-Super-Admin direct deletes.
-- 2. Harden admin_delete_account:
--    - Sets transaction-local flag 'sada.in_account_deletion' = 'true'.
--    - Authorizes Super Admin caller; enforces anti-self-deletion safeguard.
--    - Protects the last active Super Admin only when target account is currently active.
--    - Analyzes dependencies (financial and operational) to block accounts with authentic ledgers.
--    - Performs atomic clean purge of security_alerts, user_sessions, notifications,
--      preferences, module permissions, roles, profiles, and auth credentials.
--    - Writes immutable system and account audit logs for the deletion event.
-- 3. Harden admin_list_accounts deduplication:
--    - Deduplicate team_members join via LATERAL subquery with LIMIT 1 so duplicate
--      historical team rows do not duplicate user entries in the accounts table.
-- 4. Reactivate / unban qa.superadmin@sada.agency so administrative workflows are restored.
-- ============================================================

-- ------------------------------------------------------------
-- 1. HARDEN SESSION IMMUTABILITY TRIGGER FUNCTION
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_delete_user_sessions()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Permitted deletion paths:
  -- A. During Super Admin account deletion / clean purge
  IF current_setting('sada.in_account_deletion', true) = 'true' THEN
    RETURN OLD;
  END IF;

  -- B. Authorized Super Admin maintenance
  IF public.is_super_admin(auth.uid()) THEN
    RETURN OLD;
  END IF;

  -- C. Service role / server-side maintenance
  IF current_setting('request.jwt.claim.role', true) = 'service_role' OR auth.role() = 'service_role' THEN
    RETURN OLD;
  END IF;

  -- D. Cascading cleanup when auth user no longer exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.user_id) THEN
    RETURN OLD;
  END IF;

  -- Reject rogue or regular user deletion attempts to preserve audit history
  RAISE EXCEPTION 'Historical session records are immutable and cannot be deleted.';
END;
$$;

-- Ensure trigger is active on public.user_sessions
DROP TRIGGER IF EXISTS trg_prevent_delete_user_sessions ON public.user_sessions;
CREATE TRIGGER trg_prevent_delete_user_sessions
  BEFORE DELETE ON public.user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_delete_user_sessions();

-- ------------------------------------------------------------
-- 2. HARDEN admin_delete_account WITH SAFE SESSION PURGE
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_account(
  _user_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor_id UUID := auth.uid();
  _actor_email TEXT;
  _target_email TEXT;
  _target_role TEXT;
  _target_status TEXT;
  _deps JSONB;
BEGIN
  -- 0. Set transaction-local flag so all triggers know this is an authorized account deletion
  PERFORM set_config('sada.in_account_deletion', 'true', true);

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

  -- 3. Last Active Super Admin Protection:
  -- Only block if target is an ACTIVE Super Admin and there is <= 1 active Super Admin left
  SELECT role::TEXT INTO _target_role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
  SELECT status::TEXT INTO _target_status FROM public.profiles WHERE id = _user_id LIMIT 1;

  IF _target_role = 'super_admin' AND COALESCE(_target_status, 'active') = 'active' THEN
    IF public.count_active_super_admins() <= 1 THEN
      RAISE EXCEPTION 'At least one active Super Admin is required.';
    END IF;
  END IF;

  -- 4. Dependency Analysis Before Deletion
  _deps := public.admin_analyze_account_dependencies(_user_id);

  -- 4A. Protected Financial Dependencies Guard:
  IF (_deps->>'has_financial_dependencies')::BOOLEAN THEN
    RAISE EXCEPTION 'Cannot delete account with protected financial records (% salary records, % payments, % requests, % sales commissions). Financial history must be preserved.',
      COALESCE((_deps->>'salary_records_count')::INTEGER, 0),
      COALESCE((_deps->>'salary_payments_count')::INTEGER, 0),
      COALESCE((_deps->>'salary_requests_count')::INTEGER, 0),
      COALESCE((_deps->>'sales_commissions_count')::INTEGER, 0);
  END IF;

  -- 4B. Active Operational / Governance Dependencies Guard:
  IF (_deps->>'has_business_dependencies')::BOOLEAN THEN
    RAISE EXCEPTION 'Cannot delete account with active dependencies (% assigned tasks, % lead projects, % deals, % business rules). Dependencies must be reassigned before permanent deletion.',
      COALESCE((_deps->>'assigned_tasks')::INTEGER, 0),
      COALESCE((_deps->>'lead_projects_count')::INTEGER, 0),
      COALESCE((_deps->>'deals_count')::INTEGER, 0),
      COALESCE((_deps->>'business_rules_count')::INTEGER, 0);
  END IF;

  -- ------------------------------------------------------------
  -- 5. ATOMIC CLEAN PURGE FOR ELIGIBLE ACCOUNT
  -- ------------------------------------------------------------
  DELETE FROM public.team_members
  WHERE profile_id = _user_id OR LOWER(email) = LOWER(_target_email);

  IF to_regclass('public.security_alerts') IS NOT NULL THEN
    DELETE FROM public.security_alerts WHERE user_id = _user_id;
  END IF;

  IF to_regclass('public.user_sessions') IS NOT NULL THEN
    DELETE FROM public.user_sessions WHERE user_id = _user_id;
  END IF;

  IF to_regclass('public.notifications') IS NOT NULL THEN
    DELETE FROM public.notifications WHERE user_id = _user_id;
  END IF;

  IF to_regclass('public.notification_preferences') IS NOT NULL THEN
    DELETE FROM public.notification_preferences WHERE user_id = _user_id;
  END IF;

  IF to_regclass('public.user_module_permissions') IS NOT NULL THEN
    DELETE FROM public.user_module_permissions WHERE user_id = _user_id;
  END IF;

  IF to_regclass('public.user_roles') IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = _user_id;
  END IF;

  IF to_regclass('public.profiles') IS NOT NULL THEN
    DELETE FROM public.profiles WHERE id = _user_id;
  END IF;

  DELETE FROM auth.identities WHERE user_id = _user_id;
  DELETE FROM auth.users WHERE id = _user_id;

  -- ------------------------------------------------------------
  -- 6. IMMUTABLE AUDIT RECORDING
  -- ------------------------------------------------------------
  IF to_regclass('public.account_audit_logs') IS NOT NULL THEN
    INSERT INTO public.account_audit_logs (
      actor_id, actor_email, target_user_id, target_email, action, metadata
    ) VALUES (
      _actor_id, _actor_email, _user_id, _target_email, 'account_deleted',
      jsonb_build_object(
        'strategy', 'clean_purge',
        'dependencies', _deps
      )
    );
  END IF;

  IF to_regclass('public.system_audit_logs') IS NOT NULL THEN
    INSERT INTO public.system_audit_logs (
      action, entity_type, entity_id, actor_id, actor_name, actor_role, old_values, new_values, created_at
    ) VALUES (
      'ACCOUNT_DELETED',
      'user_account',
      _user_id::text,
      _actor_id,
      COALESCE(_actor_email, 'Super Admin'),
      'super_admin',
      jsonb_build_object('status', 'active', 'email', _target_email),
      jsonb_build_object('status', 'deleted', 'strategy', 'clean_purge'),
      now()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'strategy', 'clean_purge',
    'deleted_user_id', _user_id,
    'deleted_email', _target_email
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_account(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_account(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 3. DEDUPLICATE admin_list_accounts PROJECTION
-- ------------------------------------------------------------
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
  LEFT JOIN LATERAL (
    SELECT t.id, t.name, t.position, t.division, t.photo_url, t.bio, t.specialties, t.socials, t.published, t.is_active, t.role
    FROM public.team_members t
    WHERE t.profile_id = u.id OR LOWER(t.email) = LOWER(u.email)
    ORDER BY (t.profile_id = u.id) DESC, t.updated_at DESC NULLS LAST
    LIMIT 1
  ) tm ON true
  WHERE COALESCE(p.status, 'active') != 'deleted'
  ORDER BY u.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_accounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_accounts() TO authenticated, service_role;

-- ------------------------------------------------------------
-- 4. UNBAN AND REACTIVATE QA SUPER ADMIN
-- ------------------------------------------------------------
UPDATE auth.users
SET banned_until = NULL
WHERE LOWER(email) = 'qa.superadmin@sada.agency';

UPDATE public.profiles
SET status = 'active'
WHERE id IN (
  SELECT id FROM auth.users WHERE LOWER(email) = 'qa.superadmin@sada.agency'
);
