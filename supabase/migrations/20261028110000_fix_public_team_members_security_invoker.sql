-- Run public team roster queries with the caller's permissions and RLS policies.
-- The view exposes public-profile columns only; anonymous callers must not gain
-- access to private team-member fields by querying the base table directly.

ALTER VIEW public.public_team_members
  SET (security_invoker = true);

-- Remove table-level SELECT inherited by anonymous users and PUBLIC, then allow
-- only the columns needed by the public view. Keep authenticated CMS access;
-- RLS continues to restrict which rows each authenticated user can read.
REVOKE SELECT ON TABLE public.team_members FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.team_members TO authenticated;
GRANT SELECT (
  id,
  name,
  position,
  position_ar,
  division,
  specialties,
  bio,
  bio_ar,
  photo_url,
  socials,
  sort_order,
  published,
  is_active
) ON TABLE public.team_members TO anon;

-- Invoker views require a caller-scoped policy on the underlying table.
DROP POLICY IF EXISTS "Public view published team_members" ON public.team_members;
CREATE POLICY "Public view published team_members"
  ON public.team_members
  FOR SELECT
  TO anon, authenticated
  USING (published = true AND is_active = true);

GRANT SELECT ON TABLE public.public_team_members TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
