-- ============================================================
-- SADA WORK OS — MIGRATION: 20261017163000_remediate_account_deletion_integrity.sql
-- Remediate Account Deletion Integrity & Lifecycle Invariants:
-- 1. DEFECT-P2-01: Fix team_members referential integrity in admin_delete_account Branch A (nullify user_id and profile_id)
-- 2. DEFECT-P2-02: Fix session immutability conflict (admin_analyze_account_dependencies incorporates user_sessions; Branch A revokes active sessions without hard deletion)
-- 3. DEFECT-P2-03: Fix profile tombstone annihilation (Branch A locks auth.users rather than deleting row, preserving profiles ON DELETE CASCADE)
-- 4. Preserve Last Active Super Admin guard, strict authorization, and immutable audit logs
-- ============================================================

-- ------------------------------------------------------------
-- 1. HARDEN admin_analyze_account_dependencies WITH SESSION TELEMETRY
-- ------------------------------------------------------------
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
  _session_count INTEGER := 0;
  _target_email TEXT;
  _tm_id UUID;
  _has_business_deps BOOLEAN;
  _has_security_deps BOOLEAN;
  _has_total_deps BOOLEAN;
BEGIN
  -- Strict Super Admin authorization
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin can analyze account dependencies.';
  END IF;

  SELECT email INTO _target_email FROM auth.users WHERE id = _user_id;
  SELECT id INTO _tm_id FROM public.team_members WHERE profile_id = _user_id OR user_id = _user_id OR LOWER(email) = LOWER(_target_email) LIMIT 1;

  -- 1. Count assigned and created tasks
  SELECT COUNT(*)::INTEGER INTO _assigned_tasks
  FROM public.project_tasks
  WHERE assignee_id = _user_id OR (_tm_id IS NOT NULL AND assignee_id = _tm_id);

  SELECT COUNT(*)::INTEGER INTO _created_tasks
  FROM public.project_tasks
  WHERE assigned_by_id = _user_id;

  -- 2. Count project activities
  SELECT COUNT(*)::INTEGER INTO _activity_count
  FROM public.project_activity
  WHERE actor_id = _user_id;

  -- 3. Count projects led
  SELECT COUNT(*)::INTEGER INTO _lead_projects_count
  FROM public.client_projects
  WHERE lead_id = _user_id OR (_tm_id IS NOT NULL AND lead_id = _tm_id);

  -- 4. Count financial records
  IF _tm_id IS NOT NULL THEN
    SELECT COUNT(*)::INTEGER INTO _salary_records_count FROM public.salary_records WHERE team_member_id = _tm_id;
    SELECT COUNT(*)::INTEGER INTO _salary_payments_count FROM public.salary_payments WHERE team_member_id = _tm_id;
    SELECT COUNT(*)::INTEGER INTO _salary_requests_count FROM public.salary_requests WHERE team_member_id = _tm_id;
  END IF;

  -- 5. Count historical session records in public.user_sessions
  SELECT COUNT(*)::INTEGER INTO _session_count
  FROM public.user_sessions
  WHERE user_id = _user_id;

  _has_business_deps := (
    _assigned_tasks > 0 OR
    _created_tasks > 0 OR
    _activity_count > 0 OR
    _lead_projects_count > 0 OR
    _salary_records_count > 0 OR
    _salary_payments_count > 0 OR
    _salary_requests_count > 0
  );

  _has_security_deps := (_session_count > 0);
  _has_total_deps := (_has_business_deps OR _has_security_deps);

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
    'session_count', _session_count,
    'has_business_dependencies', _has_total_deps,
    'requires_soft_archive', _has_total_deps
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_analyze_account_dependencies(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_analyze_account_dependencies(UUID) TO authenticated, service_role;


-- ------------------------------------------------------------
-- 2. REMEDIATE admin_delete_account WITH ZERO-DATA-LOSS ARCHIVE & CLEAN PURGE
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
  _requires_soft_archive BOOLEAN;
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
  _requires_soft_archive := (_deps->>'has_business_dependencies')::BOOLEAN;

  -- ------------------------------------------------------------
  -- Branch A: Historical dependencies or security sessions exist
  -- Strategy: Safe Soft-Archive Deactivation (Zero Data Loss)
  -- ------------------------------------------------------------
  IF _requires_soft_archive THEN
    -- A1. De-link team member identity (nullify BOTH profile_id AND user_id)
    -- Preserves the team_members row so historical task/payroll records remain valid
    UPDATE public.team_members
    SET profile_id = NULL,
        user_id = NULL,
        is_active = false,
        updated_at = now()
    WHERE profile_id = _user_id OR user_id = _user_id OR LOWER(email) = LOWER(_target_email);

    -- A2. Instantly revoke any active/idle sessions while preserving immutable history
    UPDATE public.user_sessions
    SET status = 'revoked',
        revoked_at = now(),
        revoked_by = _actor_id,
        revocation_reason = 'account_deleted',
        updated_at = now()
    WHERE user_id = _user_id AND status IN ('active', 'idle');

    -- A3. Tombstone public.profiles record
    UPDATE public.profiles
    SET status = 'deleted',
        display_name = '[Deleted Account]',
        module_permissions = '{}'::jsonb,
        updated_at = now()
    WHERE id = _user_id;

    -- A4. Eradicate all active permissions & operational roles
    DELETE FROM public.user_roles WHERE user_id = _user_id;
    DELETE FROM public.user_module_permissions WHERE user_id = _user_id;
    DELETE FROM auth.identities WHERE user_id = _user_id;

    -- A5. Lock authenticatable identity permanently in auth.users without row deletion
    -- (Preserves foreign key integrity with user_sessions and profiles tombstone)
    UPDATE auth.users
    SET banned_until = '3000-01-01 00:00:00+00'::timestamptz,
        encrypted_password = NULL,
        raw_user_meta_data = jsonb_build_object(
          'deleted', true,
          'deleted_at', now(),
          'deleted_by', _actor_id,
          'original_email', _target_email
        )
    WHERE id = _user_id;

  -- ------------------------------------------------------------
  -- Branch B: Clean purge when ZERO dependencies and ZERO session history
  -- Strategy: Complete Referential Cascade Purge
  -- ------------------------------------------------------------
  ELSE
    DELETE FROM public.team_members WHERE profile_id = _user_id OR user_id = _user_id OR LOWER(email) = LOWER(_target_email);
    DELETE FROM public.user_module_permissions WHERE user_id = _user_id;
    DELETE FROM public.user_roles WHERE user_id = _user_id;
    DELETE FROM public.profiles WHERE id = _user_id;
    DELETE FROM auth.identities WHERE user_id = _user_id;
    DELETE FROM auth.users WHERE id = _user_id;
  END IF;

  -- 5. Immutable Audit Trail Logging
  INSERT INTO public.account_audit_logs (
    actor_id, actor_email, target_user_id, target_email, action, metadata
  ) VALUES (
    _actor_id, _actor_email, _user_id, _target_email, 'account_deleted',
    jsonb_build_object(
      'safely_preserved_dependencies', _requires_soft_archive,
      'strategy', CASE WHEN _requires_soft_archive THEN 'soft_archive_deactivate' ELSE 'clean_purge' END,
      'dependencies', _deps
    )
  );

  INSERT INTO public.system_audit_logs (
    action, entity_type, entity_id, actor_id, actor_name, actor_role, old_values, new_values, created_at
  ) VALUES (
    'ACCOUNT_DELETED',
    'user_account',
    _user_id::text,
    _actor_id,
    COALESCE(_actor_email, 'Super Admin'),
    'super_admin',
    jsonb_build_object('status', 'active'),
    jsonb_build_object(
      'status', 'deleted',
      'strategy', CASE WHEN _requires_soft_archive THEN 'soft_archive_deactivate' ELSE 'clean_purge' END,
      'preserved_dependencies', _requires_soft_archive
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'preserved_dependencies', _requires_soft_archive,
    'strategy', CASE WHEN _requires_soft_archive THEN 'soft_archive_deactivate' ELSE 'clean_purge' END
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_account(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_account(UUID) TO authenticated, service_role;
