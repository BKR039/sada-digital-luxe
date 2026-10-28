-- SADA OS — Migration: 20260916160000_fix_rbac_delete_policies.sql
-- Description: Remove legacy permissive DELETE policies on team_members and contact_submissions
-- Ensures that only Super Admin can permanently delete records, while preserving operational access.

-- 1. team_members: Drop legacy policies that grant DELETE access to non-super-admins
DROP POLICY IF EXISTS "Anyone manage team_members" ON public.team_members;
DROP POLICY IF EXISTS "Admins manage team" ON public.team_members;

-- Ensure Workers and SADA users can read team members for internal workload and project context
DROP POLICY IF EXISTS "Sada access read team_members" ON public.team_members;
CREATE POLICY "Sada access read team_members"
  ON public.team_members FOR SELECT
  USING (public.has_sada_access(auth.uid()));

-- 2. contact_submissions: Drop legacy Admin delete policy
DROP POLICY IF EXISTS "Admins delete contact" ON public.contact_submissions;
