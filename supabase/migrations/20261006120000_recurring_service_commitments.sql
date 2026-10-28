-- ============================================================
-- SADA OS — RECURRING CLIENT-SERVICE SCHEDULING MIGRATION
-- Phase 2: Service Commitments, Recurring Rules & Idempotent Generation
-- ============================================================

-- 1. SERVICE COMMITMENTS TABLE
CREATE TABLE IF NOT EXISTS public.service_commitments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    package_id UUID REFERENCES public.package_catalog(id) ON DELETE SET NULL,
    service_name TEXT NOT NULL,
    deliverable_type TEXT NOT NULL DEFAULT 'custom',
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('daily', 'weekly', 'monthly', 'bi_weekly')),
    schedule_rule JSONB NOT NULL DEFAULT '{}'::jsonb,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    preferred_time TEXT,
    duration_hours NUMERIC(4,2),
    assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    assignment_rule TEXT NOT NULL DEFAULT 'specialist_role' CHECK (assignment_rule IN ('manual', 'specialist_role', 'project_lead', 'specific_worker')),
    default_role TEXT,
    workflow_template_id UUID REFERENCES public.workflow_templates(id) ON DELETE SET NULL,
    task_type TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'inactive', 'completed')),
    paused_at TIMESTAMPTZ,
    reactivated_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_service_commitments_client_id ON public.service_commitments(client_id);
CREATE INDEX IF NOT EXISTS idx_service_commitments_status ON public.service_commitments(status);
CREATE INDEX IF NOT EXISTS idx_service_commitments_workflow_template_id ON public.service_commitments(workflow_template_id);

-- 2. ENHANCE PROJECT_TASKS FOR COMMITMENT INTEGRATION & IDEMPOTENCY
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'project_tasks' AND column_name = 'commitment_id'
    ) THEN
        ALTER TABLE public.project_tasks ADD COLUMN commitment_id UUID REFERENCES public.service_commitments(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'project_tasks' AND column_name = 'idempotency_key'
    ) THEN
        ALTER TABLE public.project_tasks ADD COLUMN idempotency_key TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'project_tasks' AND column_name = 'scheduled_date'
    ) THEN
        ALTER TABLE public.project_tasks ADD COLUMN scheduled_date DATE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_project_tasks_commitment_id ON public.project_tasks(commitment_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_idempotency_key ON public.project_tasks(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 3. ROW-LEVEL SECURITY POLICIES
ALTER TABLE public.service_commitments ENABLE ROW LEVEL SECURITY;

-- Read policy: Authenticated users can view commitments
DROP POLICY IF EXISTS "service_commitments_read_authenticated" ON public.service_commitments;
CREATE POLICY "service_commitments_read_authenticated"
ON public.service_commitments
FOR SELECT
TO authenticated
USING (true);

-- Insert/Update/Delete policy: Admins and Super Admins
DROP POLICY IF EXISTS "service_commitments_admin_write" ON public.service_commitments;
CREATE POLICY "service_commitments_admin_write"
ON public.service_commitments
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'super_admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin', 'super_admin')
    )
);
