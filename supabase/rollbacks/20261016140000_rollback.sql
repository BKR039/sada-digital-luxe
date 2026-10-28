-- ============================================================
-- SADA WORK OS — HARDENED ROLLBACK SCRIPT: 20261016140000_rollback.sql
-- Safe, Zero-Leakage Reversal of 20261016140000_secure_public_team_members_and_rls_hardening.sql
-- ============================================================
-- Security Notice:
-- A naive rollback that recreates an unscoped "Public view published team_members"
-- policy on public.team_members directly exposes private operational columns
-- (email, phone, profile_id, user_id, availability_status, employment_type) to
-- anonymous callers via PostgREST, because RLS filters rows but NOT columns.
-- Furthermore, an unscoped "Admins read all team_members" policy triggers ERROR 42501
-- for anonymous callers because EXECUTE on is_admin(UUID) is revoked from anon.
--
-- Safe Recovery Architecture:
-- 1. Drops the public view public.public_team_members.
-- 2. Restores internal staff SELECT policies on public.team_members strictly scoped
--    TO authenticated, preventing any direct anonymous column or row exposure (fail-closed).
-- 3. If public team visibility is suspended, /about safely displays an empty roster
--    rather than leaking private operational data or crashing with 42501.
-- 4. Restores published column default to false (safe by default).
-- ============================================================

-- 1. Drop public view
DROP VIEW IF EXISTS public.public_team_members;

-- 2. Ensure schema default for published remains false (safe by default)
ALTER TABLE public.team_members ALTER COLUMN published SET DEFAULT false;

-- 3. Recreate internal staff SELECT policies strictly scoped TO authenticated
-- (Prevents anonymous 42501 errors and prevents direct anonymous table/column queries)
DROP POLICY IF EXISTS "Admins read all team_members" ON public.team_members;
DROP POLICY IF EXISTS "Workers view own team_members" ON public.team_members;
DROP POLICY IF EXISTS "Public view published team_members" ON public.team_members;

CREATE POLICY "Admins read all team_members"
  ON public.team_members FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Workers view own team_members"
  ON public.team_members FOR SELECT
  TO authenticated
  USING (
    auth.uid() IS NOT NULL AND (
      profile_id = auth.uid() OR
      user_id = auth.uid()
    )
  );

CREATE POLICY "Public view published team_members"
  ON public.team_members FOR SELECT
  TO authenticated
  USING (
    published = true AND is_active = true
  );

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
