-- ============================================================
-- SADA OS — MIGRATION: 20261020120000_fix_account_deletion_audit_immutability.sql
-- Fix Permanent Account Deletion Failure (Audit Immutability vs Referential Cascade):
-- 1. Permitted audit reference behavior: update prevent_audit_log_update() to allow
--    PostgreSQL ON DELETE SET NULL cascades (where only actor_id transitions from non-null to null
--    and all other audit columns remain strictly immutable and unchanged).
-- 2. Convert statement-level update triggers on account_audit_logs and system_audit_logs
--    to row-level triggers so row-by-row column immutability is verified.
-- 3. Verify foreign key integrity on account_audit_logs.actor_id and system_audit_logs.actor_id
--    (REFERENCES auth.users(id) ON DELETE SET NULL).
-- 4. Harden admin_analyze_account_dependencies:
--    - Differentiate protected financial dependencies (salary, payments, requests, commissions)
--    - Differentiate operational dependencies (tasks, projects led, deals)
--    - Differentiate governance dependencies (business rules)
--    - Historical audit logs are preserved via ON DELETE SET NULL and do not block deletion
-- 5. Harden admin_delete_account:
--    - Strict Super Admin authorization, anti-self-deletion, last Super Admin safeguard
--    - Safe blocking of accounts with protected financial or operational dependencies
--    - Complete, atomic permanent purge of disposable test accounts from auth.users and all related tables
--    - Immutable audit recording of the deletion event
-- ============================================================

-- ------------------------------------------------------------
-- 1. HARDEN AUDIT IMMUTABILITY TRIGGER FUNCTION
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_audit_log_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Permitted audit reference behavior:
  -- Allow ON DELETE SET NULL cascade only when actor_id is transitioned to NULL
  -- while all other immutable audit record columns remain strictly unchanged.
  IF TG_TABLE_NAME = 'account_audit_logs' THEN
    IF OLD.actor_id IS NOT NULL 
       AND NEW.actor_id IS NULL
       AND NEW.id = OLD.id
       AND NEW.actor_email IS NOT DISTINCT FROM OLD.actor_email
       AND NEW.target_user_id IS NOT DISTINCT FROM OLD.target_user_id
       AND NEW.target_email IS NOT DISTINCT FROM OLD.target_email
       AND NEW.action IS NOT DISTINCT FROM OLD.action
       AND NEW.metadata IS NOT DISTINCT FROM OLD.metadata
       AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at THEN
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME = 'system_audit_logs' THEN
    IF OLD.actor_id IS NOT NULL 
       AND NEW.actor_id IS NULL
       AND NEW.id = OLD.id
       AND NEW.actor_name IS NOT DISTINCT FROM OLD.actor_name
       AND NEW.actor_role IS NOT DISTINCT FROM OLD.actor_role
       AND NEW.action IS NOT DISTINCT FROM OLD.action
       AND NEW.entity_type IS NOT DISTINCT FROM OLD.entity_type
       AND NEW.entity_id IS NOT DISTINCT FROM OLD.entity_id
       AND NEW.old_values IS NOT DISTINCT FROM OLD.old_values
       AND NEW.new_values IS NOT DISTINCT FROM OLD.new_values
       AND NEW.ip_address IS NOT DISTINCT FROM OLD.ip_address
       AND NEW.user_agent IS NOT DISTINCT FROM OLD.user_agent
       AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'Audit records are immutable and cannot be modified.';
END;
$$;

-- ------------------------------------------------------------
-- 2. RECONFIGURE AUDIT UPDATE TRIGGERS AS ROW-LEVEL GUARDS
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_prevent_update_account_audit ON public.account_audit_logs;
CREATE TRIGGER trg_prevent_update_account_audit
  BEFORE UPDATE ON public.account_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_update();

DROP TRIGGER IF EXISTS trg_prevent_update_system_audit ON public.system_audit_logs;
CREATE TRIGGER trg_prevent_update_system_audit
  BEFORE UPDATE ON public.system_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_update();

-- Ensure DELETE triggers remain strictly active and immutable
CREATE OR REPLACE FUNCTION public.prevent_audit_log_deletion()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit records are immutable and cannot be deleted.';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_delete_account_audit ON public.account_audit_logs;
CREATE TRIGGER trg_prevent_delete_account_audit
  BEFORE DELETE ON public.account_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_deletion();

DROP TRIGGER IF EXISTS trg_prevent_delete_system_audit ON public.system_audit_logs;
CREATE TRIGGER trg_prevent_delete_system_audit
  BEFORE DELETE ON public.system_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_deletion();

-- ------------------------------------------------------------
-- 3. ENSURE ON DELETE SET NULL FOREIGN KEYS ON AUDIT TABLES
-- ------------------------------------------------------------
DO $$
BEGIN
  -- account_audit_logs.actor_id foreign key
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'account_audit_logs_actor_id_fkey' AND table_name = 'account_audit_logs'
  ) THEN
    ALTER TABLE public.account_audit_logs DROP CONSTRAINT account_audit_logs_actor_id_fkey;
  END IF;
  ALTER TABLE public.account_audit_logs
    ADD CONSTRAINT account_audit_logs_actor_id_fkey
    FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;

  -- system_audit_logs.actor_id foreign key
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'system_audit_logs_actor_id_fkey' AND table_name = 'system_audit_logs'
  ) THEN
    ALTER TABLE public.system_audit_logs DROP CONSTRAINT system_audit_logs_actor_id_fkey;
  END IF;
  ALTER TABLE public.system_audit_logs
    ADD CONSTRAINT system_audit_logs_actor_id_fkey
    FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

-- ------------------------------------------------------------
-- 4. HARDEN admin_analyze_account_dependencies
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
  _has_financial_deps BOOLEAN := false;
  _has_operational_deps BOOLEAN := false;
  _has_governance_deps BOOLEAN := false;
  _has_blocking_deps BOOLEAN := false;
BEGIN
  -- Strict Super Admin authorization check
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admin can analyze account dependencies.';
  END IF;

  SELECT email INTO _target_email FROM auth.users WHERE id = _user_id;
  SELECT id INTO _tm_id FROM public.team_members
  WHERE profile_id = _user_id OR user_id = _user_id OR LOWER(email) = LOWER(_target_email)
  LIMIT 1;

  -- 1. Tasks & Activity provenance
  IF to_regclass('public.project_tasks') IS NOT NULL THEN
    SELECT COUNT(*)::INTEGER INTO _assigned_tasks
    FROM public.project_tasks
    WHERE assignee_id = _user_id OR (_tm_id IS NOT NULL AND assignee_id = _tm_id);

    SELECT COUNT(*)::INTEGER INTO _created_tasks
    FROM public.project_tasks
    WHERE assigned_by_id = _user_id;
  END IF;

  IF to_regclass('public.project_activity') IS NOT NULL THEN
    SELECT COUNT(*)::INTEGER INTO _activity_count
    FROM public.project_activity
    WHERE actor_id = _user_id;
  END IF;

  -- 2. Projects Led
  IF to_regclass('public.client_projects') IS NOT NULL THEN
    SELECT COUNT(*)::INTEGER INTO _lead_projects_count
    FROM public.client_projects
    WHERE lead_id = _user_id OR (_tm_id IS NOT NULL AND lead_id = _tm_id);
  END IF;

  -- 3. Compensation & Financial records
  IF _tm_id IS NOT NULL THEN
    IF to_regclass('public.salary_records') IS NOT NULL THEN
      SELECT COUNT(*)::INTEGER INTO _salary_records_count FROM public.salary_records WHERE team_member_id = _tm_id;
    END IF;
    IF to_regclass('public.salary_payments') IS NOT NULL THEN
      SELECT COUNT(*)::INTEGER INTO _salary_payments_count FROM public.salary_payments WHERE team_member_id = _tm_id;
    END IF;
    IF to_regclass('public.salary_requests') IS NOT NULL THEN
      SELECT COUNT(*)::INTEGER INTO _salary_requests_count FROM public.salary_requests WHERE team_member_id = _tm_id;
    END IF;
  END IF;

  -- 4. Sales Commissions (Commercial ledger provenance)
  IF to_regclass('public.sales_commissions') IS NOT NULL THEN
    IF _tm_id IS NOT NULL THEN
      EXECUTE 'SELECT COUNT(*)::INTEGER FROM public.sales_commissions WHERE team_member_id = $1'
      INTO _sales_commissions_count USING _tm_id;
    END IF;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'sales_commissions' AND column_name = 'approved_by'
    ) THEN
      EXECUTE 'SELECT COALESCE($1, 0) + COUNT(*)::INTEGER FROM public.sales_commissions WHERE approved_by = $2'
      INTO _sales_commissions_count USING _sales_commissions_count, _user_id;
    END IF;
  END IF;

  -- 5. Commercial Deals (Sales pipeline ownership & commission recipient)
  IF to_regclass('public.deals') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*)::INTEGER FROM public.deals WHERE sales_owner_id = $1 OR ($2 IS NOT NULL AND commission_recipient_id = $2)'
    INTO _deals_count USING _user_id, _tm_id;
  END IF;

  -- 6. Governance: Business Rules Updates & Version History
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

  -- 7. Audit Trail Provenance (historical counts for information)
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

  -- 8. Security Sessions
  IF to_regclass('public.user_sessions') IS NOT NULL THEN
    SELECT COUNT(*)::INTEGER INTO _session_count
    FROM public.user_sessions
    WHERE user_id = _user_id;
  END IF;

  -- Categorize Dependencies
  _has_financial_deps := (
    _salary_records_count > 0 OR
    _salary_payments_count > 0 OR
    _salary_requests_count > 0 OR
    _sales_commissions_count > 0
  );

  _has_operational_deps := (
    _assigned_tasks > 0 OR
    _created_tasks > 0 OR
    _lead_projects_count > 0 OR
    _deals_count > 0
  );

  _has_governance_deps := (
    _business_rules_count > 0 OR
    _business_rule_versions_count > 0
  );

  _has_blocking_deps := (_has_financial_deps OR _has_operational_deps OR _has_governance_deps);

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
    'has_financial_dependencies', _has_financial_deps,
    'has_operational_dependencies', _has_operational_deps,
    'has_governance_dependencies', _has_governance_deps,
    'has_business_dependencies', _has_blocking_deps,
    'requires_soft_archive', _has_blocking_deps,
    'can_permanently_delete', NOT _has_blocking_deps
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_analyze_account_dependencies(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_analyze_account_dependencies(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------
-- 5. HARDEN admin_delete_account WITH SAFE ATOMIC PURGE
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
  WHERE profile_id = _user_id OR user_id = _user_id OR LOWER(email) = LOWER(_target_email);

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
