-- ============================================================
-- SADA OS — RECONCILIATION SAFETY & TASK PROVENANCE MIGRATION
-- Phase 4.1: Task Provenance, Manual Protection & Override Tracking
-- ============================================================

-- 1. ADD STRUCTURED PROVENANCE & MANUAL OVERRIDE COLUMNS TO PROJECT_TASKS
DO $$
BEGIN
    -- A. source_type: distinguishes manual, recurring schedule, package reconciliation, and workflow
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'project_tasks' AND column_name = 'source_type'
    ) THEN
        ALTER TABLE public.project_tasks
        ADD COLUMN source_type TEXT NOT NULL DEFAULT 'manual'
        CHECK (source_type IN ('manual', 'recurring_schedule', 'package_reconciliation', 'workflow'));
    END IF;

    -- B. is_reconciliation_managed: true only for tasks controlled by automatic reconciliation
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'project_tasks' AND column_name = 'is_reconciliation_managed'
    ) THEN
        ALTER TABLE public.project_tasks
        ADD COLUMN is_reconciliation_managed BOOLEAN NOT NULL DEFAULT false;
    END IF;

    -- C. manual_override: true when a human manually moves/reassigns/edits a generated task
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'project_tasks' AND column_name = 'manual_override'
    ) THEN
        ALTER TABLE public.project_tasks
        ADD COLUMN manual_override BOOLEAN NOT NULL DEFAULT false;
    END IF;

    -- D. cancelled_reason: audit explanation when an unstarted future task is cancelled via reconciliation
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'project_tasks' AND column_name = 'cancelled_reason'
    ) THEN
        ALTER TABLE public.project_tasks
        ADD COLUMN cancelled_reason TEXT;
    END IF;
END $$;

-- 2. STRUCTURED INDEXES FOR PROVENANCE & RECONCILIATION FILTERING
CREATE INDEX IF NOT EXISTS idx_project_tasks_reconcile_guard
ON public.project_tasks (client_id, is_reconciliation_managed, manual_override, status)
WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_project_tasks_source_type
ON public.project_tasks (source_type);

-- 3. RECONCILIATION MUTATION AUDIT LOGS TABLE
-- Dedicated, structured audit trail for every automated task mutation (create, cancel, reschedule)
CREATE TABLE IF NOT EXISTS public.reconciliation_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    deliverable_id UUID REFERENCES public.client_deliverables(id) ON DELETE SET NULL,
    commitment_id UUID REFERENCES public.service_commitments(id) ON DELETE SET NULL,
    task_id UUID REFERENCES public.project_tasks(id) ON DELETE SET NULL,
    mutation_type TEXT NOT NULL CHECK (mutation_type IN ('task_created', 'task_cancelled', 'task_rescheduled', 'quota_synced')),
    old_state JSONB DEFAULT '{}'::jsonb,
    new_state JSONB DEFAULT '{}'::jsonb,
    reason TEXT NOT NULL,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_email TEXT,
    period_month TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_audit_client
ON public.reconciliation_audit_logs (client_id, period_month);

ALTER TABLE public.reconciliation_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reconciliation_audit_logs_read" ON public.reconciliation_audit_logs;
CREATE POLICY "reconciliation_audit_logs_read"
ON public.reconciliation_audit_logs
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "reconciliation_audit_logs_insert" ON public.reconciliation_audit_logs;
CREATE POLICY "reconciliation_audit_logs_insert"
ON public.reconciliation_audit_logs
FOR INSERT
TO authenticated
WITH CHECK (true);
