-- ============================================================
-- SADA OS — MIGRATION: 20261007221000_phase_j_drop_obsolete_overload.sql
-- Drops the obsolete 2-parameter admin_update_account_permissions(UUID, JSONB)
-- to resolve ambiguity with the canonical 4-parameter function.
-- ============================================================

DROP FUNCTION IF EXISTS public.admin_update_account_permissions(UUID, JSONB);
