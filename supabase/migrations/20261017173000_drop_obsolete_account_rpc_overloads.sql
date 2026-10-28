-- ============================================================
-- SADA OS - MIGRATION: 20261017173000_drop_obsolete_account_rpc_overloads.sql
-- Resolution for DEFECT-P2-06: PostgREST RPC Function Overload Ambiguity
-- ============================================================
-- Architecture Rationale:
-- 1. In migration 20260925180000, admin_update_account was created with 11 parameters.
--    In migration 20261017150000, admin_update_account was hardened with 12 parameters
--    (_status TEXT DEFAULT NULL) and database-level self-demotion/self-suspension guards.
-- 2. In migration 20260925183000, admin_provision_account was created with 8 parameters.
--    In migrations 20261007143000 and 20261016140000, admin_provision_account was hardened
--    with 10 parameters (_status TEXT, _module_permissions JSONB) and published = false default.
-- 3. In PostgreSQL, adding parameters with defaults creates an overload rather than
--    replacing the function if the previous signature is not explicitly dropped.
-- 4. Under PostgREST HTTP RPC invocation (/rest/v1/rpc/admin_update_account), having multiple
--    functions with overlapping parameter names triggers:
--    PGRST204: Could not choose a best candidate function between ...
--    (Precedent: resolved identically in 20261007221000_phase_j_drop_obsolete_overload.sql).
-- 5. This forward-only migration defensively drops the obsolete signatures, ensuring exactly
--    ONE canonical function exists for each RPC name.
-- ============================================================

-- 1. Drop obsolete 11-argument admin_update_account
DROP FUNCTION IF EXISTS public.admin_update_account(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], JSONB, BOOLEAN, BOOLEAN
);

-- 2. Drop obsolete 8-argument admin_provision_account
DROP FUNCTION IF EXISTS public.admin_provision_account(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN
);

-- 3. Drop obsolete 9-argument admin_provision_account (if present from intermediate migrations)
DROP FUNCTION IF EXISTS public.admin_provision_account(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT
);
