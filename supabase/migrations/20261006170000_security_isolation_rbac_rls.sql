-- ============================================================
-- SADA WORK OS — Migration: 20261006170000_security_isolation_rbac_rls.sql
-- Module: Security Isolation, Database RLS & Multi-Tier Authorization (Phase 5)
-- 1. Database Function: public.has_module_access
-- 2. Enhanced Financial RLS (Super Admin + Admins with explicit Finance permission)
-- 3. Permanent Deletion Invariant (Super Admin Only)
-- 4. Compensation Data Scope & Worker Isolation
-- ============================================================

-- 1. Canonical Database Function: public.has_module_access
CREATE OR REPLACE FUNCTION public.has_module_access(_user_id UUID, _module TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role TEXT;
  _override_enabled BOOLEAN;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Security Invariant: Accounts management is strictly Super Admin root exclusive
  IF _module = 'accounts' THEN
    RETURN public.is_super_admin(_user_id);
  END IF;

  -- Root Super Admin invariant: full access by default
  IF public.is_super_admin(_user_id) THEN
    SELECT enabled INTO _override_enabled
    FROM public.user_module_permissions
    WHERE user_id = _user_id AND module = _module;
    IF _override_enabled IS NOT NULL THEN
      RETURN _override_enabled;
    END IF;
    RETURN true;
  END IF;

  -- Check explicit user override from canonical user_module_permissions
  SELECT enabled INTO _override_enabled
  FROM public.user_module_permissions
  WHERE user_id = _user_id AND module = _module;

  IF _override_enabled IS NOT NULL THEN
    RETURN _override_enabled;
  END IF;

  -- Fallback to authoritative role baseline defaults
  SELECT role INTO _role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1;

  IF _role IS NULL THEN
    SELECT role INTO _role
    FROM public.profiles
    WHERE id = _user_id
    LIMIT 1;
  END IF;

  IF _role = 'admin' THEN
    -- Admin baseline: workflows, business_rules, accounts, finance are false by default
    IF _module IN ('workflows', 'business_rules', 'accounts', 'finance') THEN
      RETURN false;
    ELSE
      RETURN true;
    END IF;
  ELSIF _role = 'worker' THEN
    -- Worker baseline: dashboard, clients, tasks, calendar, compensation are true
    IF _module IN ('dashboard', 'clients', 'tasks', 'calendar', 'compensation') THEN
      RETURN true;
    ELSE
      RETURN false;
    END IF;
  END IF;

  RETURN false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.has_module_access(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_module_access(UUID, TEXT) TO authenticated, service_role, anon;

-- 2. Enhanced Financial RLS Policies:
-- Allow Super Admins OR users with explicit 'finance' module access.
-- Reject workers and admins without finance access.

-- income_transactions
ALTER TABLE public.income_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super Admins read income_transactions" ON public.income_transactions;
DROP POLICY IF EXISTS "Authorized finance read income_transactions" ON public.income_transactions;
CREATE POLICY "Authorized finance read income_transactions"
  ON public.income_transactions FOR SELECT
  USING (
    public.is_super_admin(auth.uid()) OR
    public.has_module_access(auth.uid(), 'finance')
  );

DROP POLICY IF EXISTS "Super Admins insert income_transactions" ON public.income_transactions;
DROP POLICY IF EXISTS "Authorized finance insert income_transactions" ON public.income_transactions;
CREATE POLICY "Authorized finance insert income_transactions"
  ON public.income_transactions FOR INSERT
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    public.has_module_access(auth.uid(), 'finance')
  );

DROP POLICY IF EXISTS "Super Admins update income_transactions" ON public.income_transactions;
DROP POLICY IF EXISTS "Authorized finance update income_transactions" ON public.income_transactions;
CREATE POLICY "Authorized finance update income_transactions"
  ON public.income_transactions FOR UPDATE
  USING (
    public.is_super_admin(auth.uid()) OR
    public.has_module_access(auth.uid(), 'finance')
  )
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    public.has_module_access(auth.uid(), 'finance')
  );

DROP POLICY IF EXISTS "Super Admins delete income_transactions" ON public.income_transactions;
CREATE POLICY "Super Admins delete income_transactions"
  ON public.income_transactions FOR DELETE
  USING (public.is_super_admin(auth.uid()));

-- expense_transactions
ALTER TABLE public.expense_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super Admins read expense_transactions" ON public.expense_transactions;
DROP POLICY IF EXISTS "Authorized finance read expense_transactions" ON public.expense_transactions;
CREATE POLICY "Authorized finance read expense_transactions"
  ON public.expense_transactions FOR SELECT
  USING (
    public.is_super_admin(auth.uid()) OR
    public.has_module_access(auth.uid(), 'finance')
  );

DROP POLICY IF EXISTS "Super Admins insert expense_transactions" ON public.expense_transactions;
DROP POLICY IF EXISTS "Authorized finance insert expense_transactions" ON public.expense_transactions;
CREATE POLICY "Authorized finance insert expense_transactions"
  ON public.expense_transactions FOR INSERT
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    public.has_module_access(auth.uid(), 'finance')
  );

DROP POLICY IF EXISTS "Super Admins update expense_transactions" ON public.expense_transactions;
DROP POLICY IF EXISTS "Authorized finance update expense_transactions" ON public.expense_transactions;
CREATE POLICY "Authorized finance update expense_transactions"
  ON public.expense_transactions FOR UPDATE
  USING (
    public.is_super_admin(auth.uid()) OR
    public.has_module_access(auth.uid(), 'finance')
  )
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    public.has_module_access(auth.uid(), 'finance')
  );

DROP POLICY IF EXISTS "Super Admins delete expense_transactions" ON public.expense_transactions;
CREATE POLICY "Super Admins delete expense_transactions"
  ON public.expense_transactions FOR DELETE
  USING (public.is_super_admin(auth.uid()));

-- 3. Strict Worker Compensation Scope Reinforcement:
-- Super Admin OR users with finance access can read company-wide compensation records.
-- Workers can strictly read ONLY their own records.

DROP POLICY IF EXISTS "Read salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Workers view own salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Authorized view salary_records" ON public.salary_records;
CREATE POLICY "Authorized view salary_records"
  ON public.salary_records FOR SELECT
  USING (
    public.is_super_admin(auth.uid()) OR
    public.has_module_access(auth.uid(), 'finance') OR
    (
      team_member_id IN (
        SELECT id FROM public.team_members
        WHERE profile_id = auth.uid()
           OR user_id = auth.uid()
           OR (email IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM(COALESCE(auth.jwt()->>'email', ''))))
      )
    )
  );

-- salary_payments: Super Admin / Finance OR own worker records
DROP POLICY IF EXISTS "Workers view own salary_payments" ON public.salary_payments;
DROP POLICY IF EXISTS "Authorized view salary_payments" ON public.salary_payments;
CREATE POLICY "Authorized view salary_payments"
  ON public.salary_payments FOR SELECT
  USING (
    public.is_super_admin(auth.uid()) OR
    public.has_module_access(auth.uid(), 'finance') OR
    (
      team_member_id IN (
        SELECT id FROM public.team_members
        WHERE profile_id = auth.uid()
           OR user_id = auth.uid()
           OR (email IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM(COALESCE(auth.jwt()->>'email', ''))))
      )
    )
  );

-- salary_requests: Super Admin / Finance OR own worker requests
DROP POLICY IF EXISTS "Workers view own salary_requests" ON public.salary_requests;
DROP POLICY IF EXISTS "Authorized view salary_requests" ON public.salary_requests;
CREATE POLICY "Authorized view salary_requests"
  ON public.salary_requests FOR SELECT
  USING (
    public.is_super_admin(auth.uid()) OR
    public.has_module_access(auth.uid(), 'finance') OR
    (
      team_member_id IN (
        SELECT id FROM public.team_members
        WHERE profile_id = auth.uid()
           OR user_id = auth.uid()
           OR (email IS NOT NULL AND LOWER(TRIM(email)) = LOWER(TRIM(COALESCE(auth.jwt()->>'email', ''))))
      )
    )
  );
