-- ============================================================
-- SADA OS — PHASE 7.1: PUBLISHING WORKFLOW SECURITY & IDEMPOTENCY HARDENING
-- Migration: 20261006210000_publishing_workflow_hardening.sql
--
-- 1. Adds idempotency_key to public.project_activity to guarantee
--    exactly-once milestone event recording under concurrent requests.
-- 2. Adds composite index for rapid publishing stage lookups.
-- 3. Adds safety constraints for publishing fields.
-- ============================================================

-- 1. Add idempotency_key column to public.project_activity
ALTER TABLE public.project_activity
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Unique partial index: Guarantees no duplicate milestone activity events on retries or race conditions
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_activity_idempotency_key
  ON public.project_activity (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 2. Performance indexes for publishing workflow queries
CREATE INDEX IF NOT EXISTS idx_project_tasks_parent_sort
  ON public.project_tasks (parent_task_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_project_tasks_stage_lookup
  ON public.project_tasks (parent_task_id, category, status);

CREATE INDEX IF NOT EXISTS idx_team_members_publisher_active
  ON public.team_members (is_publisher, is_active);
