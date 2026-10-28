-- ============================================================
-- SADA WORK OS — Migration: 20260924090000_fix_task_completed_at_integrity.sql
-- BUG-001 Remediation: Completed Task Timestamp Integrity & Trigger
-- ============================================================

-- 1. Backfill legacy completed tasks missing completed_at
UPDATE public.project_tasks
SET completed_at = updated_at
WHERE status = 'done'
  AND completed_at IS NULL;

-- 2. Canonical Trigger Function for completed_at enforcement
CREATE OR REPLACE FUNCTION public.handle_project_task_completed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Handle INSERT operations
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'done' AND NEW.completed_at IS NULL THEN
      NEW.completed_at = NOW();
    ELSIF NEW.status <> 'done' THEN
      NEW.completed_at = NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- Handle UPDATE operations
  -- 1. Transitioning to 'done': populate completed_at if not explicitly provided
  IF NEW.status = 'done' AND (OLD.status IS DISTINCT FROM 'done') AND NEW.completed_at IS NULL THEN
    NEW.completed_at = NOW();
  -- 2. Transitioning away from 'done': clear completed_at
  ELSIF NEW.status <> 'done' THEN
    NEW.completed_at = NULL;
  END IF;

  -- 3. If remaining 'done' (done -> done), existing timestamp is preserved
  RETURN NEW;
END;
$$;

-- 3. Idempotently bind the trigger to public.project_tasks
DROP TRIGGER IF EXISTS trg_project_tasks_completed_at ON public.project_tasks;

CREATE TRIGGER trg_project_tasks_completed_at
  BEFORE INSERT OR UPDATE ON public.project_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_project_task_completed_at();

-- 4. Grant execution permissions
REVOKE EXECUTE ON FUNCTION public.handle_project_task_completed_at() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.handle_project_task_completed_at() TO authenticated, service_role;
