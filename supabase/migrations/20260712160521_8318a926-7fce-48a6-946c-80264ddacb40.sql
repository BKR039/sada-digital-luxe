
-- 1. Fix search_path on set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- 2. Revoke EXECUTE on SECURITY DEFINER functions from anon/authenticated/public
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO service_role;

-- 3. Contact submissions: replace WITH CHECK (true) with column-value constraints
DROP POLICY IF EXISTS "Anyone submits contact" ON public.contact_submissions;
CREATE POLICY "Anyone submits contact"
ON public.contact_submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'new'
  AND char_length(name) BETWEEN 2 AND 100
  AND char_length(email) BETWEEN 3 AND 255
  AND char_length(message) BETWEEN 10 AND 2000
  AND (phone IS NULL OR char_length(phone) <= 40)
  AND (business_name IS NULL OR char_length(business_name) <= 120)
  AND (service IS NULL OR char_length(service) <= 80)
  AND (budget IS NULL OR char_length(budget) <= 40)
);

-- 4. Storage: drop the broad SELECT policy on media so listing is denied.
-- Public bucket URLs continue to work (they bypass RLS via the public path).
DROP POLICY IF EXISTS "Public reads media" ON storage.objects;
