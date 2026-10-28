-- ============================================================
-- SADA OS — PACKAGE CATALOG DATA INTEGRITY & SECURITY RECONCILIATION
-- Migration: 20261020150000_reconcile_package_catalog_integrity.sql
--
-- Reconciles:
-- 1. Production Packages monthly_posts -> 0 (PR-01..04, PUB-OD-01..03)
--    Pure shooting/production packages exclude social media management and
--    publishing. Photo counts (10–15, 20, 25, 30–40) are asset deliverables
--    faithfully preserved in included_items JSON. Setting monthly_posts = 0
--    prevents misleading deliverable metrics in CRM, reports, and matchers.
-- 2. Hardens package_catalog RLS SELECT policies by splitting role-specific
--    policies for 'anon' and 'authenticated':
--    - 'anon' role only sees active, published, non-internal, approved records.
--      Never invokes admin helper functions.
--    - 'authenticated' role only sees non-public records if is_admin / is_super_admin.
-- 3. Hardens table privileges for anon role: revokes write grants.
-- ============================================================

-- 1. Reconcile monthly_posts for pure production entries
UPDATE public.package_catalog
SET monthly_posts = 0,
    updated_at = NOW()
WHERE code IN ('PR-01', 'PR-02', 'PR-03', 'PR-04', 'PUB-OD-01', 'PUB-OD-02', 'PUB-OD-03')
  AND monthly_posts <> 0;

-- 2. Drop existing SELECT policies on package_catalog
DROP POLICY IF EXISTS "Public packages viewable" ON public.package_catalog;
DROP POLICY IF EXISTS "Public packages viewable by anon" ON public.package_catalog;
DROP POLICY IF EXISTS "Packages viewable by authenticated" ON public.package_catalog;

-- Role-specific SELECT policy for anon
CREATE POLICY "Public packages viewable by anon"
  ON public.package_catalog
  FOR SELECT
  TO anon
  USING (
    is_active = true 
    AND is_published = true 
    AND is_internal_only = false 
    AND approval_status = 'approved'
  );

-- Role-specific SELECT policy for authenticated
CREATE POLICY "Packages viewable by authenticated"
  ON public.package_catalog
  FOR SELECT
  TO authenticated
  USING (
    (
      is_active = true 
      AND is_published = true 
      AND is_internal_only = false 
      AND approval_status = 'approved'
    )
    OR (
      is_super_admin(auth.uid()) 
      OR is_admin(auth.uid())
    )
  );

-- 3. Clean up and harden table privileges for anon role
REVOKE INSERT, UPDATE, DELETE ON public.package_catalog FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.package_categories FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.package_addons FROM anon;
