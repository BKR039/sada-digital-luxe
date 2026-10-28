-- ============================================================
-- SADA OS — MIGRATION: 20261021123000_reactivate_qa_super_admin.sql
-- Reactivate QA Super Admin profile status
-- ============================================================

UPDATE public.profiles
SET status = 'active'
WHERE id IN (
  SELECT id FROM auth.users WHERE LOWER(email) = 'qa.superadmin@sada.agency'
);
