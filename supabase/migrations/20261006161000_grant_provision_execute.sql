-- ============================================================
-- SADA WORK OS — Migration: 20261006161000_grant_provision_execute.sql
-- Grant EXECUTE on admin_provision_account to authenticated and service_role
-- ============================================================

GRANT EXECUTE ON FUNCTION public.admin_provision_account(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, JSONB
) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.admin_update_account_permissions(
  UUID, JSONB
) TO authenticated, service_role;
