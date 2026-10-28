-- ============================================================
-- SADA OS — Personal Team Calendar, Alert Engine & Handoffs
-- Migration: 20260920203000_calendar_execution_and_handoffs.sql
-- ============================================================

-- 1. Extend project_tasks table with deadline alert configuration
ALTER TABLE public.project_tasks
  ADD COLUMN IF NOT EXISTS deadline_alert_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS deadline_alert_days INT DEFAULT 3,
  ADD COLUMN IF NOT EXISTS deadline_alert_message TEXT;

-- 2. Create task_handoffs workflow table
CREATE TABLE IF NOT EXISTS public.task_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.client_projects(id) ON DELETE CASCADE,
  requested_by_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  from_assignee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_assignee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_reason TEXT NOT NULL,
  new_assignee_accepted_at TIMESTAMPTZ,
  assigner_approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejected_by_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance & lookups
CREATE INDEX IF NOT EXISTS idx_task_handoffs_task_id ON public.task_handoffs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_handoffs_from_assignee ON public.task_handoffs(from_assignee_id);
CREATE INDEX IF NOT EXISTS idx_task_handoffs_to_assignee ON public.task_handoffs(to_assignee_id);
CREATE INDEX IF NOT EXISTS idx_task_handoffs_assigner ON public.task_handoffs(assigner_id);
CREATE INDEX IF NOT EXISTS idx_task_handoffs_status ON public.task_handoffs(status);

-- 3. Enable RLS on task_handoffs
ALTER TABLE public.task_handoffs ENABLE ROW LEVEL SECURITY;

-- Read: SADA staff can read handoffs
DROP POLICY IF EXISTS "Sada access read task_handoffs" ON public.task_handoffs;
CREATE POLICY "Sada access read task_handoffs"
  ON public.task_handoffs FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Insert: SADA staff can request handoff for their assigned task or admins
DROP POLICY IF EXISTS "Sada access insert task_handoffs" ON public.task_handoffs;
CREATE POLICY "Sada access insert task_handoffs"
  ON public.task_handoffs FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      requested_by_id = auth.uid() OR
      public.is_admin(auth.uid())
    )
  );

-- Update: SADA staff involved in handoff (or admin) can update
DROP POLICY IF EXISTS "Sada access update task_handoffs" ON public.task_handoffs;
CREATE POLICY "Sada access update task_handoffs"
  ON public.task_handoffs FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND (
      to_assignee_id = auth.uid() OR
      assigner_id = auth.uid() OR
      requested_by_id = auth.uid() OR
      public.is_admin(auth.uid())
    )
  );

-- 4. Atomic Double-Acceptance Response Function
CREATE OR REPLACE FUNCTION public.respond_to_task_handoff(
  p_handoff_id UUID,
  p_action TEXT, -- 'accept', 'approve', 'reject', 'cancel'
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_handoff RECORD;
  v_caller UUID;
  v_is_admin BOOLEAN;
  v_both_approved BOOLEAN := false;
  v_task RECORD;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_handoff FROM public.task_handoffs WHERE id = p_handoff_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Handoff request not found';
  END IF;

  IF v_handoff.status != 'pending' THEN
    RAISE EXCEPTION 'Handoff request is no longer pending (current status: %)', v_handoff.status;
  END IF;

  v_is_admin := public.is_admin(v_caller);

  -- Handle actions
  IF p_action = 'accept' THEN
    -- Only the proposed new assignee (or admin) can accept
    IF v_caller != v_handoff.to_assignee_id AND NOT v_is_admin THEN
      RAISE EXCEPTION 'Only the proposed assignee can accept this handoff';
    END IF;

    UPDATE public.task_handoffs
    SET new_assignee_accepted_at = now(), updated_at = now()
    WHERE id = p_handoff_id;

    -- Check if assigner already approved or caller is also assigner/admin
    IF v_handoff.assigner_approved_at IS NOT NULL OR (v_is_admin AND v_caller = v_handoff.assigner_id) THEN
      v_both_approved := true;
    END IF;

  ELSIF p_action = 'approve' THEN
    -- Only the original assigner (or admin) can approve
    IF v_caller != v_handoff.assigner_id AND NOT v_is_admin THEN
      RAISE EXCEPTION 'Only the task assigner can approve this handoff';
    END IF;

    UPDATE public.task_handoffs
    SET assigner_approved_at = now(), updated_at = now()
    WHERE id = p_handoff_id;

    -- Check if proposed assignee already accepted
    IF v_handoff.new_assignee_accepted_at IS NOT NULL THEN
      v_both_approved := true;
    END IF;

  ELSIF p_action = 'reject' THEN
    -- Either proposed assignee, assigner, or admin can reject
    IF v_caller != v_handoff.to_assignee_id AND v_caller != v_handoff.assigner_id AND NOT v_is_admin THEN
      RAISE EXCEPTION 'Unauthorized to reject this handoff';
    END IF;

    UPDATE public.task_handoffs
    SET
      status = 'rejected',
      rejected_at = now(),
      rejected_by_id = v_caller,
      rejection_reason = COALESCE(p_reason, 'Rejected by party'),
      updated_at = now()
    WHERE id = p_handoff_id;

    -- Log activity
    INSERT INTO public.project_activity (project_id, task_id, actor_id, action, details)
    VALUES (
      v_handoff.project_id,
      v_handoff.task_id,
      v_caller,
      'handoff_rejected',
      jsonb_build_object(
        'from_assignee_id', v_handoff.from_assignee_id,
        'to_assignee_id', v_handoff.to_assignee_id,
        'reason', p_reason
      )
    );

    RETURN jsonb_build_object('success', true, 'status', 'rejected');

  ELSIF p_action = 'cancel' THEN
    -- The requester or admin can cancel
    IF v_caller != v_handoff.requested_by_id AND NOT v_is_admin THEN
      RAISE EXCEPTION 'Only the requester can cancel this handoff';
    END IF;

    UPDATE public.task_handoffs
    SET
      status = 'cancelled',
      updated_at = now()
    WHERE id = p_handoff_id;

    RETURN jsonb_build_object('success', true, 'status', 'cancelled');
  ELSE
    RAISE EXCEPTION 'Unknown action: %', p_action;
  END IF;

  -- Re-read handoff to check if both approved
  SELECT * INTO v_handoff FROM public.task_handoffs WHERE id = p_handoff_id;
  IF v_handoff.new_assignee_accepted_at IS NOT NULL AND v_handoff.assigner_approved_at IS NOT NULL THEN
    v_both_approved := true;
  END IF;

  -- If both accepted and approved, execute ownership transfer
  IF v_both_approved THEN
    UPDATE public.task_handoffs
    SET status = 'accepted', updated_at = now()
    WHERE id = p_handoff_id;

    UPDATE public.project_tasks
    SET
      assignee_id = v_handoff.to_assignee_id,
      previous_assignee_id = v_handoff.from_assignee_id,
      handoff_reason = v_handoff.request_reason,
      updated_at = now()
    WHERE id = v_handoff.task_id;

    -- Log activity
    INSERT INTO public.project_activity (project_id, task_id, actor_id, action, details)
    VALUES (
      v_handoff.project_id,
      v_handoff.task_id,
      v_caller,
      'handoff_completed',
      jsonb_build_object(
        'from_assignee_id', v_handoff.from_assignee_id,
        'to_assignee_id', v_handoff.to_assignee_id,
        'approved_by_assigner_at', v_handoff.assigner_approved_at,
        'accepted_by_assignee_at', v_handoff.new_assignee_accepted_at,
        'reason', v_handoff.request_reason
      )
    );

    RETURN jsonb_build_object('success', true, 'status', 'accepted', 'assigned_to', v_handoff.to_assignee_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'pending',
    'accepted_by_assignee', v_handoff.new_assignee_accepted_at IS NOT NULL,
    'approved_by_assigner', v_handoff.assigner_approved_at IS NOT NULL
  );
END;
$$;
