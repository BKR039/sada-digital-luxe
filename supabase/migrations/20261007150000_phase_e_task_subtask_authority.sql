-- ============================================================
-- SADA WORK OS — MIGRATION: 20261007150000
-- PHASE E: Resource-Level Task & Subtask Authority Enforcement
-- 1. public.has_parent_task_authority: Validates Super Admin, Creator, or Main Assignee
-- 2. trg_enforce_subtask_parent_authority: Enforces default assignee inheritance & parent authority
-- 3. RLS policy update on public.project_tasks for authorized task and subtask inserts
-- ============================================================

-- 1. CANONICAL DATABASE FUNCTION: public.has_parent_task_authority
CREATE OR REPLACE FUNCTION public.has_parent_task_authority(
  _parent_task_id UUID,
  _user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_super BOOLEAN;
  v_assigned_by_id UUID;
  v_assignee_id UUID;
  v_worker_tm_id UUID;
BEGIN
  IF _user_id IS NULL OR _parent_task_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 1. Super Admin Authority (Global Root Bypass)
  SELECT public.is_super_admin(_user_id) INTO v_is_super;
  IF COALESCE(v_is_super, false) = TRUE THEN
    RETURN TRUE;
  END IF;

  -- Fetch parent task assigned_by_id (Creator) and assignee_id (Current Main Assignee)
  SELECT assigned_by_id, assignee_id
  INTO v_assigned_by_id, v_assignee_id
  FROM public.project_tasks
  WHERE id = _parent_task_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Resolve user's team_member ID if mapped
  SELECT id INTO v_worker_tm_id
  FROM public.team_members
  WHERE profile_id = _user_id
  LIMIT 1;

  -- 2. Creator Authority: Parent task was created/delegated by this user
  IF v_assigned_by_id IS NOT NULL AND (
    v_assigned_by_id = _user_id OR
    (v_worker_tm_id IS NOT NULL AND v_assigned_by_id = v_worker_tm_id)
  ) THEN
    RETURN TRUE;
  END IF;

  -- 3. Current Main Assignee Authority: Parent task is currently assigned to this user
  IF v_assignee_id IS NOT NULL AND (
    v_assignee_id = _user_id OR
    (v_worker_tm_id IS NOT NULL AND v_assignee_id = v_worker_tm_id)
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_parent_task_authority(UUID, UUID) TO authenticated, service_role;

-- 2. TRIGGER FUNCTION: Enforce parent task authority & default assignee inheritance on subtasks
CREATE OR REPLACE FUNCTION public.check_subtask_parent_authority()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent RECORD;
  v_user_id UUID := auth.uid();
BEGIN
  -- Only process subtasks
  IF NEW.parent_task_id IS NOT NULL THEN
    -- Fetch parent task record
    SELECT id, assignee_id, assigned_by_id, project_id, client_id
    INTO v_parent
    FROM public.project_tasks
    WHERE id = NEW.parent_task_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'PARENT_TASK_NOT_FOUND: Parent task % does not exist.', NEW.parent_task_id;
    END IF;

    -- Subtask Assignee Inheritance:
    -- New subtasks inherit the current main assignee only as a default at creation
    IF NEW.assignee_id IS NULL AND v_parent.assignee_id IS NOT NULL THEN
      NEW.assignee_id := v_parent.assignee_id;
    END IF;

    -- Inherit client_id from parent task if not explicitly provided
    IF NEW.client_id IS NULL AND v_parent.client_id IS NOT NULL THEN
      NEW.client_id := v_parent.client_id;
    END IF;

    -- When executed in an authenticated user session (auth.uid() present), enforce authority
    IF v_user_id IS NOT NULL THEN
      -- Formula: global permission AND (Super Admin OR creator OR main assignee)
      IF NOT public.has_permission(v_user_id, 'tasks.create_subtask') THEN
        RAISE EXCEPTION 'UNAUTHORIZED_ACTION: User lacks tasks.create_subtask permission.';
      END IF;

      IF NOT public.has_parent_task_authority(NEW.parent_task_id, v_user_id) THEN
        RAISE EXCEPTION 'PARENT_TASK_AUTHORITY_DENIED: User lacks parent task authority (Super Admin, Task Creator, or Current Main Assignee required).';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_subtask_parent_authority ON public.project_tasks;
CREATE TRIGGER trg_enforce_subtask_parent_authority
  BEFORE INSERT ON public.project_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.check_subtask_parent_authority();

-- 3. RLS POLICY: Update INSERT policy on public.project_tasks
DROP POLICY IF EXISTS "Admins create project_tasks" ON public.project_tasks;
DROP POLICY IF EXISTS "Authorized task and subtask insert" ON public.project_tasks;

CREATE POLICY "Authorized task and subtask insert"
  ON public.project_tasks FOR INSERT
  WITH CHECK (
    -- Main tasks: requires admin role and tasks.create permission
    (
      parent_task_id IS NULL AND
      public.is_admin(auth.uid()) AND
      public.has_permission(auth.uid(), 'tasks.create')
    )
    OR
    -- Subtasks: requires tasks.create_subtask permission AND authority over parent task
    (
      parent_task_id IS NOT NULL AND
      public.has_permission(auth.uid(), 'tasks.create_subtask') AND
      public.has_parent_task_authority(parent_task_id, auth.uid())
    )
  );
