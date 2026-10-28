-- ============================================================
-- SADA OS — RECURRING SCHEDULING HARDENING & INTEGRITY MIGRATION
-- Phase 2.1: Structured Occurrence Identity & Database Uniqueness Constraints
-- ============================================================

-- 1. ADD DELIVERABLE LINKAGE TO SERVICE COMMITMENTS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'service_commitments' AND column_name = 'deliverable_id'
    ) THEN
        ALTER TABLE public.service_commitments
        ADD COLUMN deliverable_id UUID REFERENCES public.client_deliverables(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_service_commitments_deliverable_id
ON public.service_commitments(deliverable_id);

-- 2. ENHANCE PROJECT_TASKS WITH STRUCTURED OCCURRENCE IDENTITY
DO $$
BEGIN
    -- Ensure commitment_id exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'project_tasks' AND column_name = 'commitment_id'
    ) THEN
        ALTER TABLE public.project_tasks
        ADD COLUMN commitment_id UUID REFERENCES public.service_commitments(id) ON DELETE SET NULL;
    END IF;

    -- Ensure occurrence_date exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'project_tasks' AND column_name = 'occurrence_date'
    ) THEN
        ALTER TABLE public.project_tasks
        ADD COLUMN occurrence_date DATE;
    END IF;

    -- Ensure sequence_index exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'project_tasks' AND column_name = 'sequence_index'
    ) THEN
        ALTER TABLE public.project_tasks
        ADD COLUMN sequence_index INTEGER;
    END IF;

    -- Ensure idempotency_key exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'project_tasks' AND column_name = 'idempotency_key'
    ) THEN
        ALTER TABLE public.project_tasks
        ADD COLUMN idempotency_key TEXT;
    END IF;

    -- Ensure scheduled_date exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'project_tasks' AND column_name = 'scheduled_date'
    ) THEN
        ALTER TABLE public.project_tasks
        ADD COLUMN scheduled_date DATE;
    END IF;

    -- Ensure deliverable_id exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'project_tasks' AND column_name = 'deliverable_id'
    ) THEN
        ALTER TABLE public.project_tasks
        ADD COLUMN deliverable_id UUID REFERENCES public.client_deliverables(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. STRUCTURED LOOKUP INDEXES
CREATE INDEX IF NOT EXISTS idx_project_tasks_commitment_occurrence
ON public.project_tasks (commitment_id, occurrence_date, sequence_index)
WHERE commitment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_project_tasks_deliverable_id
ON public.project_tasks (deliverable_id)
WHERE deliverable_id IS NOT NULL;

-- 4. DATABASE-LEVEL IDEMPOTENCY ENFORCEMENT
-- A. Uniqueness on idempotency_key (protects both recurring tasks and workflow stages)
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_tasks_idempotency_key_unique
ON public.project_tasks (idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- B. Uniqueness on structured recurring occurrence composite identity
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_tasks_commitment_occurrence_seq_unique
ON public.project_tasks (commitment_id, occurrence_date, sequence_index)
WHERE commitment_id IS NOT NULL AND occurrence_date IS NOT NULL AND sequence_index IS NOT NULL;
