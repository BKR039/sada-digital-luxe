-- ============================================================
-- SADA OS — Update project_task_completed_at trigger
-- Support Phase 4 delivery statuses: 'done', 'delivered', 'approved'
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_project_task_completed_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- Handle INSERT operations
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('done', 'delivered', 'approved') AND NEW.completed_at IS NULL THEN
      NEW.completed_at = NOW();
    ELSIF NEW.status NOT IN ('done', 'delivered', 'approved') THEN
      NEW.completed_at = NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- Handle UPDATE operations
  -- 1. Transitioning to completed status: populate completed_at if not explicitly provided
  IF NEW.status IN ('done', 'delivered', 'approved') AND (OLD.status NOT IN ('done', 'delivered', 'approved')) AND NEW.completed_at IS NULL THEN
    NEW.completed_at = NOW();
  -- 2. Transitioning away from completed status: clear completed_at
  ELSIF NEW.status NOT IN ('done', 'delivered', 'approved') THEN
    NEW.completed_at = NULL;
  END IF;

  -- 3. If remaining completed, existing timestamp is preserved
  RETURN NEW;
END;
$$;
