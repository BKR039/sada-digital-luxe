-- ============================================================
-- SADA OS — MIGRATION: 20261021130000_make_prevent_delete_user_sessions_security_definer.sql
-- Ensure prevent_delete_user_sessions() is SECURITY DEFINER so that
-- check on auth.users does not fail with permission denied on auth.users
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_delete_user_sessions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  -- Permitted deletion paths:
  -- A. During Super Admin account deletion / clean purge
  IF current_setting('sada.in_account_deletion', true) = 'true' THEN
    RETURN OLD;
  END IF;

  -- B. Authorized Super Admin maintenance
  IF public.is_super_admin(auth.uid()) THEN
    RETURN OLD;
  END IF;

  -- C. Service role / server-side maintenance
  IF current_setting('request.jwt.claim.role', true) = 'service_role' OR auth.role() = 'service_role' THEN
    RETURN OLD;
  END IF;

  -- D. Cascading cleanup when auth user no longer exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.user_id) THEN
    RETURN OLD;
  END IF;

  -- Reject rogue or regular user deletion attempts to preserve audit history
  RAISE EXCEPTION 'Historical session records are immutable and cannot be deleted.';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prevent_delete_user_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prevent_delete_user_sessions() TO authenticated, service_role;
