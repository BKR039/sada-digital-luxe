-- ============================================================
-- SADA WORK OS — Migration: 20261006161500_fix_account_dependency_lead_column.sql
-- Fix lead_id column reference in admin_analyze_account_dependencies
-- ============================================================

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

  -- Count projects led (column is lead_id)
  SELECT COUNT(*)::INTEGER INTO _lead_projects_count
  FROM public.client_projects
  WHERE lead_id = _user_id OR (_tm_id IS NOT NULL AND lead_id = _tm_id);

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
    'has_business_dependencies', (
      _assigned_tasks > 0 OR
      _created_tasks > 0 OR
      _activity_count > 0 OR
      _lead_projects_count > 0 OR
      _salary_records_count > 0 OR
      _salary_payments_count > 0 OR
      _salary_requests_count > 0
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_analyze_account_dependencies(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_account(UUID) TO authenticated, service_role;
