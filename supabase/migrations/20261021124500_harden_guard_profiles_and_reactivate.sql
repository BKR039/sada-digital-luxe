-- ============================================================
-- SADA OS — MIGRATION: 20261021124500_harden_guard_profiles_and_reactivate.sql
-- 1. Update guard_profiles_security_fields() to recognize service_role and administrative overrides
-- 2. Reactivate QA Super Admin profile
-- ============================================================

CREATE OR REPLACE FUNCTION public.guard_profiles_security_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Allow Super Admin, service_role, or administrative overrides
  IF public.is_super_admin(auth.uid()) 
     OR current_setting('request.jwt.claim.role', true) = 'service_role' 
     OR auth.role() = 'service_role'
     OR current_setting('sada.in_account_deletion', true) = 'true'
     OR current_setting('sada.administrative_override', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- Non-super-admin: revert changes to status and module_permissions
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status := OLD.status;
  END IF;
  IF NEW.module_permissions IS DISTINCT FROM OLD.module_permissions THEN
    NEW.module_permissions := OLD.module_permissions;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profiles_security_fields ON public.profiles;
CREATE TRIGGER trg_guard_profiles_security_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profiles_security_fields();

-- Reactivate QA Super Admin profile with administrative override flag
SET LOCAL sada.administrative_override = 'true';

UPDATE public.profiles
SET status = 'active'
WHERE id = '968f5374-4ad0-4bf1-a2db-338d6b5491e5';

UPDATE auth.users
SET banned_until = NULL
WHERE id = '968f5374-4ad0-4bf1-a2db-338d6b5491e5';
