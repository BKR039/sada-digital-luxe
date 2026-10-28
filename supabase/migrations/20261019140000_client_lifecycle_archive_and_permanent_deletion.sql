-- ============================================================
-- SADA WORK OS — MIGRATION: 20261019140000_client_lifecycle_archive_and_permanent_deletion.sql
-- Client Lifecycle Management:
-- 1. admin_analyze_client_lifecycle: Pre-flight audit & financial dependency detection.
-- 2. admin_delete_client_permanently: Hard deletion of operational records, blocking
--    on financial invoices or paid commissions, safe dependency ordering & immutable audit.
-- 3. admin_archive_client: Reversible freeze of client, pauses service commitments,
--    pauses uncompleted tasks while preserving original status, preserves history.
-- 4. admin_restore_client: Reactivates client and commitments, restores tasks to
--    their exact preserved status, idempotent re-alignment.
-- ============================================================

-- ------------------------------------------------------------
-- 1. ADMIN ANALYZE CLIENT LIFECYCLE
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_analyze_client_lifecycle(
  _client_id UUID
) RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _client_name TEXT;
  _client_status TEXT;
  _client_type TEXT;
  _package_name TEXT;
  _tasks_count INTEGER := 0;
  _projects_count INTEGER := 0;
  _commitments_count INTEGER := 0;
  _deliverables_count INTEGER := 0;
  _bookings_count INTEGER := 0;
  _campaigns_count INTEGER := 0;
  _comms_count INTEGER := 0;
  _invoices_count INTEGER := 0;
  _financial_commissions_count INTEGER := 0;
  _income_count INTEGER := 0;
  _expense_count INTEGER := 0;
  _can_delete BOOLEAN := true;
  _blocking_reasons TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Caller authorization check: SADA access required
  IF auth.role() = 'service_role' OR auth.uid() IS NULL THEN
    NULL; -- internal/direct DB execution
  ELSE
    IF NOT public.has_sada_access(auth.uid()) THEN
      RAISE EXCEPTION 'Unauthorized: SADA access required.';
    END IF;
  END IF;

  SELECT name, status, client_type, package_name
  INTO _client_name, _client_status, _client_type, _package_name
  FROM public.clients WHERE id = _client_id;

  IF _client_name IS NULL THEN
    RAISE EXCEPTION 'Client not found.';
  END IF;

  -- 1. Operational dependencies safe to remove on hard delete
  SELECT COUNT(*)::INTEGER INTO _tasks_count
  FROM public.project_tasks
  WHERE client_id = _client_id OR project_id IN (SELECT id FROM public.client_projects WHERE client_id = _client_id);

  SELECT COUNT(*)::INTEGER INTO _projects_count
  FROM public.client_projects WHERE client_id = _client_id;

  SELECT COUNT(*)::INTEGER INTO _commitments_count
  FROM public.service_commitments WHERE client_id = _client_id;

  SELECT COUNT(*)::INTEGER INTO _deliverables_count
  FROM public.client_deliverables WHERE client_id = _client_id OR project_id IN (SELECT id FROM public.client_projects WHERE client_id = _client_id);

  SELECT COUNT(*)::INTEGER INTO _bookings_count
  FROM public.production_bookings WHERE client_id = _client_id OR project_id IN (SELECT id FROM public.client_projects WHERE client_id = _client_id);

  SELECT COUNT(*)::INTEGER INTO _campaigns_count
  FROM public.sponsoring_campaigns WHERE client_id = _client_id OR project_id IN (SELECT id FROM public.client_projects WHERE client_id = _client_id);

  SELECT COUNT(*)::INTEGER INTO _comms_count
  FROM public.client_communication_logs WHERE client_id = _client_id OR project_id IN (SELECT id FROM public.client_projects WHERE client_id = _client_id);

  -- 2. Financial Safeguards (Blocking if exists)
  SELECT COUNT(*)::INTEGER INTO _invoices_count
  FROM public.invoices WHERE client_id = _client_id;

  SELECT COUNT(*)::INTEGER INTO _financial_commissions_count
  FROM public.sales_commissions
  WHERE client_id = _client_id AND (status IN ('approved', 'paid') OR salary_payment_id IS NOT NULL);

  -- 3. Historical Financial Ledger References (Nullified if client is deleted, retained in ledger)
  SELECT COUNT(*)::INTEGER INTO _income_count
  FROM public.income_transactions WHERE client_id = _client_id;

  SELECT COUNT(*)::INTEGER INTO _expense_count
  FROM public.expense_transactions WHERE client_id = _client_id;

  IF _invoices_count > 0 THEN
    _can_delete := false;
    _blocking_reasons := array_append(
      _blocking_reasons,
      'Client has ' || _invoices_count || ' issued invoice(s) on file. Financial and accounting regulations require retaining all issued invoices. Permanent deletion is blocked to preserve fiscal auditability. Please use Archive Client instead.'
    );
  END IF;

  IF _financial_commissions_count > 0 THEN
    _can_delete := false;
    _blocking_reasons := array_append(
      _blocking_reasons,
      'Client has ' || _financial_commissions_count || ' approved or paid sales commission(s) linked to payroll compensation. Permanent deletion is blocked to preserve compensation integrity.'
    );
  END IF;

  RETURN jsonb_build_object(
    'client_id', _client_id,
    'client_name', _client_name,
    'client_status', _client_status,
    'client_type', _client_type,
    'package_name', _package_name,
    'can_delete_permanently', _can_delete,
    'blocking_reasons', to_jsonb(_blocking_reasons),
    'counts', jsonb_build_object(
      'tasks', _tasks_count,
      'projects', _projects_count,
      'commitments', _commitments_count,
      'deliverables', _deliverables_count,
      'bookings', _bookings_count,
      'campaigns', _campaigns_count,
      'communications', _comms_count,
      'invoices', _invoices_count,
      'financial_commissions', _financial_commissions_count,
      'income_transactions', _income_count,
      'expense_transactions', _expense_count
    )
  );
END;
$$;


-- ------------------------------------------------------------
-- 2. ADMIN DELETE CLIENT PERMANENTLY
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_client_permanently(
  _client_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor_id UUID := auth.uid();
  _actor_name TEXT;
  _analysis JSONB;
  _client_name TEXT;
  _client_status TEXT;
  _can_delete BOOLEAN;
  _blocking_reasons JSONB;
BEGIN
  -- 1. Authorization: Super Admin only
  IF auth.role() = 'service_role' OR auth.uid() IS NULL THEN
    NULL; -- internal/direct DB execution
  ELSE
    IF NOT public.is_super_admin(_actor_id) THEN
      RAISE EXCEPTION 'Unauthorized: Only Super Admin can permanently delete clients.';
    END IF;
  END IF;

  SELECT name, status INTO _client_name, _client_status
  FROM public.clients WHERE id = _client_id;

  IF _client_name IS NULL THEN
    RAISE EXCEPTION 'Client not found.';
  END IF;

  -- 2. Pre-flight dependency & financial safeguard check
  _analysis := public.admin_analyze_client_lifecycle(_client_id);
  _can_delete := (_analysis->>'can_delete_permanently')::BOOLEAN;
  _blocking_reasons := _analysis->'blocking_reasons';

  IF NOT _can_delete THEN
    RAISE EXCEPTION 'CANNOT_DELETE_FINANCIAL_RECORDS: Client cannot be permanently deleted: %', _blocking_reasons->>0;
  END IF;

  -- Resolve actor name for audit
  IF _actor_id IS NOT NULL THEN
    SELECT display_name INTO _actor_name FROM public.profiles WHERE id = _actor_id;
  END IF;
  _actor_name := COALESCE(_actor_name, 'Super Admin');

  -- 3. Detach nullable ledger / historical links safely
  UPDATE public.contact_submissions SET client_id = NULL WHERE client_id = _client_id;
  UPDATE public.contact_submissions SET converted_project_id = NULL
  WHERE converted_project_id IN (SELECT id FROM public.client_projects WHERE client_id = _client_id);

  UPDATE public.testimonials SET client_id = NULL WHERE client_id = _client_id;
  UPDATE public.deals SET client_id = NULL WHERE client_id = _client_id;

  UPDATE public.work_sessions SET client_id = NULL, project_id = NULL
  WHERE client_id = _client_id OR project_id IN (SELECT id FROM public.client_projects WHERE client_id = _client_id);

  UPDATE public.income_transactions SET client_id = NULL, project_id = NULL
  WHERE client_id = _client_id OR project_id IN (SELECT id FROM public.client_projects WHERE client_id = _client_id);

  UPDATE public.expense_transactions SET client_id = NULL, project_id = NULL
  WHERE client_id = _client_id OR project_id IN (SELECT id FROM public.client_projects WHERE client_id = _client_id);

  -- Safe delete of non-financial draft commissions if any
  DELETE FROM public.sales_commissions WHERE client_id = _client_id;

  -- 4. Delete dependent operational records in safe order
  DELETE FROM public.client_communication_logs
  WHERE client_id = _client_id OR project_id IN (SELECT id FROM public.client_projects WHERE client_id = _client_id);

  DELETE FROM public.reconciliation_audit_logs WHERE client_id = _client_id;

  DELETE FROM public.client_deliverables
  WHERE client_id = _client_id OR project_id IN (SELECT id FROM public.client_projects WHERE client_id = _client_id);

  DELETE FROM public.production_bookings
  WHERE client_id = _client_id OR project_id IN (SELECT id FROM public.client_projects WHERE client_id = _client_id);

  DELETE FROM public.sponsoring_campaigns
  WHERE client_id = _client_id OR project_id IN (SELECT id FROM public.client_projects WHERE client_id = _client_id);

  DELETE FROM public.service_commitments WHERE client_id = _client_id;

  DELETE FROM public.task_handoffs
  WHERE task_id IN (
    SELECT id FROM public.project_tasks
    WHERE client_id = _client_id OR project_id IN (SELECT id FROM public.client_projects WHERE client_id = _client_id)
  ) OR project_id IN (SELECT id FROM public.client_projects WHERE client_id = _client_id);

  DELETE FROM public.project_activity
  WHERE project_id IN (SELECT id FROM public.client_projects WHERE client_id = _client_id);

  DELETE FROM public.project_members
  WHERE project_id IN (SELECT id FROM public.client_projects WHERE client_id = _client_id);

  DELETE FROM public.project_tasks
  WHERE client_id = _client_id OR project_id IN (SELECT id FROM public.client_projects WHERE client_id = _client_id);

  DELETE FROM public.client_projects WHERE client_id = _client_id;

  DELETE FROM public.clients WHERE id = _client_id;

  -- 5. Record immutable audit log
  INSERT INTO public.system_audit_logs (
    action, entity_type, entity_id, actor_id, actor_name, actor_role, old_values, new_values, created_at
  ) VALUES (
    'CLIENT_DELETED',
    'client',
    _client_id::text,
    _actor_id,
    _actor_name,
    'super_admin',
    jsonb_build_object(
      'client_name', _client_name,
      'previous_status', _client_status,
      'deleted_dependencies', _analysis->'counts'
    ),
    jsonb_build_object('deleted', true, 'purged_at', now()),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'deleted_client_id', _client_id,
    'client_name', _client_name
  );
END;
$$;


-- ------------------------------------------------------------
-- 3. ADMIN ARCHIVE CLIENT
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_archive_client(
  _client_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor_id UUID := auth.uid();
  _actor_name TEXT;
  _client_name TEXT;
  _current_status TEXT;
  _paused_tasks_count INTEGER := 0;
  _paused_commitments_count INTEGER := 0;
BEGIN
  -- 1. Authorization: Admin or Super Admin
  IF auth.role() = 'service_role' OR auth.uid() IS NULL THEN
    NULL; -- internal/direct DB execution
  ELSE
    IF NOT (public.is_super_admin(_actor_id) OR (public.is_admin(_actor_id) AND public.has_module_access(_actor_id, 'clients'::text))) THEN
      RAISE EXCEPTION 'Unauthorized: Only Super Admin or Admin with clients module access can archive clients.';
    END IF;
  END IF;

  SELECT name, status INTO _client_name, _current_status
  FROM public.clients WHERE id = _client_id;

  IF _client_name IS NULL THEN
    RAISE EXCEPTION 'Client not found.';
  END IF;

  IF _current_status = 'archived' THEN
    RETURN jsonb_build_object('success', true, 'client_id', _client_id, 'already_archived', true);
  END IF;

  -- Resolve actor name for audit
  IF _actor_id IS NOT NULL THEN
    SELECT display_name INTO _actor_name FROM public.profiles WHERE id = _actor_id;
  END IF;
  _actor_name := COALESCE(_actor_name, 'Admin');

  -- 2. Update canonical client status to 'archived'
  UPDATE public.clients
  SET status = 'archived', updated_at = now()
  WHERE id = _client_id;

  -- 3. Pause all active service commitments (stops recurring generator)
  WITH paused_comm AS (
    UPDATE public.service_commitments
    SET status = 'paused',
        paused_at = now(),
        updated_at = now()
    WHERE client_id = _client_id AND status = 'active'
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER INTO _paused_commitments_count FROM paused_comm;

  -- 4. Pause uncompleted operational tasks, preserving previous status in notes
  WITH updated_tasks AS (
    UPDATE public.project_tasks
    SET notes = CASE
          WHEN notes IS NULL OR TRIM(notes) = '' THEN '[ARCHIVED_PREV_STATUS:' || status::text || ']'
          WHEN notes ~ '\[ARCHIVED_PREV_STATUS:[a-z_]+\]' THEN notes
          ELSE '[ARCHIVED_PREV_STATUS:' || status::text || '] ' || notes
        END,
        status = 'paused'::public.task_status,
        updated_at = now()
    WHERE (client_id = _client_id OR project_id IN (SELECT id FROM public.client_projects WHERE client_id = _client_id))
      AND status IN ('todo', 'in_progress', 'review', 'blocked', 'revision', 'postponed')
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER INTO _paused_tasks_count FROM updated_tasks;

  -- 5. Record immutable audit log
  INSERT INTO public.system_audit_logs (
    action, entity_type, entity_id, actor_id, actor_name, actor_role, old_values, new_values, created_at
  ) VALUES (
    'CLIENT_ARCHIVED',
    'client',
    _client_id::text,
    _actor_id,
    _actor_name,
    'admin',
    jsonb_build_object('status', _current_status),
    jsonb_build_object(
      'status', 'archived',
      'paused_tasks', _paused_tasks_count,
      'paused_commitments', _paused_commitments_count,
      'archived_at', now()
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'client_id', _client_id,
    'client_name', _client_name,
    'status', 'archived',
    'paused_tasks_count', _paused_tasks_count,
    'paused_commitments_count', _paused_commitments_count
  );
END;
$$;


-- ------------------------------------------------------------
-- 4. ADMIN RESTORE CLIENT
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_restore_client(
  _client_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _actor_id UUID := auth.uid();
  _actor_name TEXT;
  _client_name TEXT;
  _current_status TEXT;
  _restored_tasks_count INTEGER := 0;
  _reactivated_commitments_count INTEGER := 0;
  _t RECORD;
  _extracted_status TEXT;
  _clean_notes TEXT;
BEGIN
  -- 1. Authorization: Admin or Super Admin
  IF auth.role() = 'service_role' OR auth.uid() IS NULL THEN
    NULL; -- internal/direct DB execution
  ELSE
    IF NOT (public.is_super_admin(_actor_id) OR (public.is_admin(_actor_id) AND public.has_module_access(_actor_id, 'clients'::text))) THEN
      RAISE EXCEPTION 'Unauthorized: Only Super Admin or Admin with clients module access can restore clients.';
    END IF;
  END IF;

  SELECT name, status INTO _client_name, _current_status
  FROM public.clients WHERE id = _client_id;

  IF _client_name IS NULL THEN
    RAISE EXCEPTION 'Client not found.';
  END IF;

  IF _current_status = 'active' THEN
    RETURN jsonb_build_object('success', true, 'client_id', _client_id, 'already_active', true);
  END IF;

  -- Resolve actor name for audit
  IF _actor_id IS NOT NULL THEN
    SELECT display_name INTO _actor_name FROM public.profiles WHERE id = _actor_id;
  END IF;
  _actor_name := COALESCE(_actor_name, 'Admin');

  -- 2. Restore canonical client status to 'active'
  UPDATE public.clients
  SET status = 'active', updated_at = now()
  WHERE id = _client_id;

  -- 3. Reactivate paused service commitments
  WITH reactivated_comm AS (
    UPDATE public.service_commitments
    SET status = 'active',
        reactivated_at = now(),
        updated_at = now()
    WHERE client_id = _client_id AND status = 'paused'
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER INTO _reactivated_commitments_count FROM reactivated_comm;

  -- 4. Restore paused tasks, restoring original status from preserved tag
  FOR _t IN
    SELECT id, notes, status
    FROM public.project_tasks
    WHERE (client_id = _client_id OR project_id IN (SELECT id FROM public.client_projects WHERE client_id = _client_id))
      AND status = 'paused'::public.task_status
  LOOP
    IF _t.notes IS NOT NULL AND _t.notes ~ '\[ARCHIVED_PREV_STATUS:[a-z_]+\]' THEN
      _extracted_status := SUBSTRING(_t.notes FROM '\[ARCHIVED_PREV_STATUS:([a-z_]+)\]');
      _clean_notes := REGEXP_REPLACE(_t.notes, '\[ARCHIVED_PREV_STATUS:[a-z_]+\]\s*', '', 'g');
      
      -- Verify valid enum status, default to 'todo'
      IF _extracted_status NOT IN ('todo', 'in_progress', 'review', 'blocked', 'revision', 'postponed') THEN
        _extracted_status := 'todo';
      END IF;

      UPDATE public.project_tasks
      SET status = _extracted_status::public.task_status,
          notes = NULLIF(TRIM(_clean_notes), ''),
          updated_at = now()
      WHERE id = _t.id;
    ELSE
      UPDATE public.project_tasks
      SET status = 'todo'::public.task_status,
          updated_at = now()
      WHERE id = _t.id;
    END IF;

    _restored_tasks_count := _restored_tasks_count + 1;
  END LOOP;

  -- 5. Record immutable audit log
  INSERT INTO public.system_audit_logs (
    action, entity_type, entity_id, actor_id, actor_name, actor_role, old_values, new_values, created_at
  ) VALUES (
    'CLIENT_RESTORED',
    'client',
    _client_id::text,
    _actor_id,
    _actor_name,
    'admin',
    jsonb_build_object('status', _current_status),
    jsonb_build_object(
      'status', 'active',
      'restored_tasks', _restored_tasks_count,
      'reactivated_commitments', _reactivated_commitments_count,
      'restored_at', now()
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'client_id', _client_id,
    'client_name', _client_name,
    'status', 'active',
    'restored_tasks_count', _restored_tasks_count,
    'reactivated_commitments_count', _reactivated_commitments_count
  );
END;
$$;


-- ------------------------------------------------------------
-- 5. FUNCTION PERMISSIONS & GRANTS
-- ------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.admin_analyze_client_lifecycle(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_analyze_client_lifecycle(UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.admin_delete_client_permanently(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_client_permanently(UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.admin_archive_client(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_archive_client(UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.admin_restore_client(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_restore_client(UUID) TO authenticated, service_role;
