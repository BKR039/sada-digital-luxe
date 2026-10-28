-- ============================================================
-- SADA WORK OS — MIGRATION: 20261017170000_remediate_hard_purge_dependency_integrity.sql
-- Remediate Hard-Purge Dependency Integrity (DEFECT-P2-05):
-- 1. Extend admin_analyze_account_dependencies to comprehensively query:
--    - Sales commissions (team_member_id, approved_by)
--    - Commercial deals (sales_owner_id, commission_recipient_id)
--    - Governance business rules (business_rules.updated_by, business_rule_versions.changed_by)
--    - Immutable audit trails (account_audit_logs.actor_id, system_audit_logs.actor_id)
-- 2. Enforce that ANY historical, commercial, governance, financial, or audit
--    reference strictly routes account deletion to Branch A (Retention / Soft-Archive)
-- 3. Restrict Branch B Hard-Purge exclusively to genuinely dependency-free accounts
-- 4. Preserve atomic rollback guarantees, strict Super Admin authorization,
--    self-deletion prevention, and last active Super Admin safeguards
-- ============================================================

-- ------------------------------------------------------------
-- 1. HARDEN admin_analyze_account_dependencies WITH FULL PROVENANCE
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
  _sales_commissions_count INTEGER := 0;
  _deals_count INTEGER := 0;
  _business_rules_count INTEGER := 0;
  _business_rule_versions_count INTEGER := 0;
  _account_audit_actor_count INTEGER := 0;
  _system_audit_actor_count INTEGER := 0;
  _target_email TEXT;
  _tm_id UUID;
  _has_business_deps BOOLEAN := false;
  _has_security_deps BOOLEAN := false;
  _has_governance_deps BOOLEAN := false;
  _has_total_deps BOOLEAN := false;
BEGIN
  -- 1. Strict Super Admin authorization check inside RPC
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin can analyze account dependencies.';
  END IF;

  SELECT email INTO _target_email FROM auth.users WHERE id = _user_id;
  SELECT id INTO _tm_id FROM public.team_members
  WHERE profile_id = _user_id OR user_id = _user_id OR LOWER(email) = LOWER(_target_email)
  LIMIT 1;

  -- 2. Tasks & Activity provenance
  SELECT COUNT(*)::INTEGER INTO _assigned_tasks
  FROM public.project_tasks
  WHERE assignee_id = _user_id OR (_tm_id IS NOT NULL AND assignee_id = _tm_id);

  SELECT COUNT(*)::INTEGER INTO _created_tasks
  FROM public.project_tasks
  WHERE assigned_by_id = _user_id;

  SELECT COUNT(*)::INTEGER INTO _activity_count
  FROM public.project_activity
  WHERE actor_id = _user_id;

  -- 3. Projects Led
  SELECT COUNT(*)::INTEGER INTO _lead_projects_count
  FROM public.client_projects
  WHERE lead_id = _user_id OR (_tm_id IS NOT NULL AND lead_id = _tm_id);

  -- 4. Compensation & Financial records
  IF _tm_id IS NOT NULL THEN
    SELECT COUNT(*)::INTEGER INTO _salary_records_count FROM public.salary_records WHERE team_member_id = _tm_id;
    SELECT COUNT(*)::INTEGER INTO _salary_payments_count FROM public.salary_payments WHERE team_member_id = _tm_id;
    SELECT COUNT(*)::INTEGER INTO _salary_requests_count FROM public.salary_requests WHERE team_member_id = _tm_id;
  END IF;

  -- 5. Sales Commissions (Commercial ledger provenance)
  IF to_regclass('public.sales_commissions') IS NOT NULL THEN
    IF _tm_id IS NOT NULL THEN
      EXECUTE 'SELECT COUNT(*)::INTEGER FROM public.sales_commissions WHERE team_member_id = $1'
      INTO _sales_commissions_count USING _tm_id;
    END IF;
    -- Also count commissions approved by this user
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'sales_commissions' AND column_name = 'approved_by'
    ) THEN
      EXECUTE 'SELECT COALESCE($1, 0) + COUNT(*)::INTEGER FROM public.sales_commissions WHERE approved_by = $2'
      INTO _sales_commissions_count USING _sales_commissions_count, _user_id;
    END IF;
  END IF;

  -- 6. Commercial Deals (Sales pipeline ownership & commission recipient)
  IF to_regclass('public.deals') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*)::INTEGER FROM public.deals WHERE sales_owner_id = $1 OR ($2 IS NOT NULL AND commission_recipient_id = $2)'
    INTO _deals_count USING _user_id, _tm_id;
  END IF;

  -- 7. Governance: Business Rules Updates & Version History
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'business_rules' AND column_name = 'updated_by'
  ) THEN
    EXECUTE 'SELECT COUNT(*)::INTEGER FROM public.business_rules WHERE updated_by = $1'
    INTO _business_rules_count USING _user_id;
  END IF;

  IF to_regclass('public.business_rule_versions') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*)::INTEGER FROM public.business_rule_versions WHERE changed_by = $1'
    INTO _business_rule_versions_count USING _user_id;
  END IF;

  -- 8. Immutable Audit Trail Provenance (Actor records)
  IF to_regclass('public.account_audit_logs') IS NOT NULL THEN
    SELECT COUNT(*)::INTEGER INTO _account_audit_actor_count
    FROM public.account_audit_logs
    WHERE actor_id = _user_id;
  END IF;

  IF to_regclass('public.system_audit_logs') IS NOT NULL THEN
    SELECT COUNT(*)::INTEGER INTO _system_audit_actor_count
    FROM public.system_audit_logs
    WHERE actor_id = _user_id;
  END IF;

  -- 9. Security Sessions & Telemetry
  SELECT COUNT(*)::INTEGER INTO _session_count
  FROM public.user_sessions
  WHERE user_id = _user_id;

  -- Aggregation of Dependencies
  _has_business_deps := (
    _assigned_tasks > 0 OR
    _created_tasks > 0 OR
    _activity_count > 0 OR
    _lead_projects_count > 0 OR
    _salary_records_count > 0 OR
    _salary_payments_count > 0 OR
    _salary_requests_count > 0 OR
    _sales_commissions_count > 0 OR
    _deals_count > 0
  );

  _has_security_deps := (_session_count > 0);

  _has_governance_deps := (
    _business_rules_count > 0 OR
    _business_rule_versions_count > 0 OR
    _account_audit_actor_count > 0 OR
    _system_audit_actor_count > 0
  );

  _has_total_deps := (_has_business_deps OR _has_security_deps OR _has_governance_deps);

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
    'sales_commissions_count', _sales_commissions_count,
    'deals_count', _deals_count,
    'business_rules_count', _business_rules_count,
    'business_rule_versions_count', _business_rule_versions_count,
    'account_audit_actor_count', _account_audit_actor_count,
    'system_audit_actor_count', _system_audit_actor_count,
    'session_count', _session_count,
    'has_business_dependencies', _has_total_deps,
    'requires_soft_archive', _has_total_deps
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_analyze_account_dependencies(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_analyze_account_dependencies(UUID) TO authenticated, service_role;


-- ------------------------------------------------------------
-- 2. HARDEN admin_delete_account ATOMICITY & BRANCH ROUTING
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

  -- 4. Dependency Analysis: Evaluate All Provenance Categories
  _deps := public.admin_analyze_account_dependencies(_user_id);
  _requires_soft_archive := (_deps->>'requires_soft_archive')::BOOLEAN;

  -- ------------------------------------------------------------
  -- Branch A: Dependencies or Historical Telemetry Exist
  -- Strategy: Safe Soft-Archive Deactivation (Zero Data Loss)
  -- ------------------------------------------------------------
  IF _requires_soft_archive THEN
    -- A1. De-link team member identity (nullify BOTH profile_id AND user_id)
    -- Preserves the team_members row so task/commission/salary references remain valid
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
    -- (Preserves foreign key integrity with audit logs, rules, sessions, and profiles tombstone)
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
  -- Branch B: Clean Hard Purge ONLY when ZERO dependencies exist
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
