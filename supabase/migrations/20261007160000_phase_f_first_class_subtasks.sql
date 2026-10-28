-- ============================================================
-- SADA OS — Migration: 20261007160000_phase_f_first_class_subtasks.sql
-- PHASE F: First-Class Subtask schema, completion metadata,
-- status alignment, and bidirectional field synchronization.
-- ============================================================

-- 1. Ensure 'paused' exists in task_status enum
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'paused';

-- 2. Add first-class metadata columns to public.project_tasks
ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. Backfill created_by from assigned_by_id and due_date from deadline
UPDATE public.project_tasks
SET created_by = assigned_by_id
WHERE created_by IS NULL AND assigned_by_id IS NOT NULL;

UPDATE public.project_tasks
SET due_date = deadline
WHERE due_date IS NULL AND deadline IS NOT NULL;

-- 4. Create indexes for performance and queries
CREATE INDEX IF NOT EXISTS idx_project_tasks_parent_task_id ON public.project_tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_created_by ON public.project_tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_project_tasks_due_date ON public.project_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_project_tasks_completed_by ON public.project_tasks(completed_by);

-- 5. Canonical Trigger for created_by and due_date bidirectional synchronization
CREATE OR REPLACE FUNCTION public.sync_project_task_canonical_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- Synchronize created_by <-> assigned_by_id
  IF NEW.created_by IS NOT NULL AND (NEW.assigned_by_id IS NULL OR NEW.created_by <> OLD.created_by) THEN
    NEW.assigned_by_id = NEW.created_by;
  ELSIF NEW.assigned_by_id IS NOT NULL AND (NEW.created_by IS NULL OR NEW.assigned_by_id <> OLD.assigned_by_id) THEN
    NEW.created_by = NEW.assigned_by_id;
  END IF;

  -- Synchronize due_date <-> deadline
  IF NEW.due_date IS NOT NULL AND (NEW.deadline IS NULL OR NEW.due_date <> OLD.due_date) THEN
    NEW.deadline = NEW.due_date;
  ELSIF NEW.deadline IS NOT NULL AND (NEW.due_date IS NULL OR NEW.deadline <> OLD.deadline) THEN
    NEW.due_date = NEW.deadline;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_project_task_canonical_fields ON public.project_tasks;
CREATE TRIGGER trg_sync_project_task_canonical_fields
  BEFORE INSERT OR UPDATE ON public.project_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_project_task_canonical_fields();

-- 6. Upgrade handle_project_task_completed_at() to populate completed_by
CREATE OR REPLACE FUNCTION public.handle_project_task_completed_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- Handle INSERT operations
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('done', 'delivered', 'approved') THEN
      IF NEW.completed_at IS NULL THEN
        NEW.completed_at = NOW();
      END IF;
      IF NEW.completed_by IS NULL THEN
        NEW.completed_by = auth.uid();
      END IF;
    ELSIF NEW.status NOT IN ('done', 'delivered', 'approved') THEN
      NEW.completed_at = NULL;
      NEW.completed_by = NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- Handle UPDATE operations
  -- 1. Transitioning to completed status: populate completed_at and completed_by if not set
  IF NEW.status IN ('done', 'delivered', 'approved') AND (OLD.status NOT IN ('done', 'delivered', 'approved')) THEN
    IF NEW.completed_at IS NULL THEN
      NEW.completed_at = NOW();
    END IF;
    IF NEW.completed_by IS NULL THEN
      NEW.completed_by = auth.uid();
    END IF;
  -- 2. Transitioning away from completed status: clear completed_at and completed_by
  ELSIF NEW.status NOT IN ('done', 'delivered', 'approved') THEN
    NEW.completed_at = NULL;
    NEW.completed_by = NULL;
  END IF;

  -- 3. If remaining completed, preserve existing values
  RETURN NEW;
END;
$$;
