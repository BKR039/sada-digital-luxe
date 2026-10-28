-- ============================================================
-- SADA OS — MIGRATION: 20261001230000
-- FIX SALARY RLS POLICIES & ADVANCE REQUEST COMPENSATION FLOW
-- ============================================================

-- 1. DROP ALL OBSOLETE / CONFLICTING POLICIES ON SALARY TABLES
DROP POLICY IF EXISTS "Read salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Super Admins insert salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Super Admins update salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Super Admins delete salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Admins manage salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Workers view own salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Admins create salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Admins update salary_records" ON public.salary_records;

DROP POLICY IF EXISTS "Read salary_payments" ON public.salary_payments;
DROP POLICY IF EXISTS "Super Admins insert salary_payments" ON public.salary_payments;
DROP POLICY IF EXISTS "Super Admins update salary_payments" ON public.salary_payments;
DROP POLICY IF EXISTS "Super Admins delete salary_payments" ON public.salary_payments;
DROP POLICY IF EXISTS "Admins manage salary_payments" ON public.salary_payments;
DROP POLICY IF EXISTS "Workers view own salary_payments" ON public.salary_payments;

DROP POLICY IF EXISTS "Read salary_requests" ON public.salary_requests;
DROP POLICY IF EXISTS "Insert salary_requests" ON public.salary_requests;
DROP POLICY IF EXISTS "Super Admins update salary_requests" ON public.salary_requests;
DROP POLICY IF EXISTS "Super Admins delete salary_requests" ON public.salary_requests;
DROP POLICY IF EXISTS "Admins manage salary_requests" ON public.salary_requests;
DROP POLICY IF EXISTS "Workers view own salary_requests" ON public.salary_requests;
DROP POLICY IF EXISTS "Workers insert own salary_requests" ON public.salary_requests;

-- 2. HARDEN get_team_member_id HELPER FUNCTION
CREATE OR REPLACE FUNCTION public.get_team_member_id(_user_id UUID)
RETURNS UUID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _mid UUID;
  _uemail TEXT;
BEGIN
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 1. Check direct profile_id OR user_id match
  SELECT id INTO _mid FROM public.team_members
  WHERE profile_id = _user_id OR user_id = _user_id
  LIMIT 1;
  
  IF _mid IS NOT NULL THEN
    RETURN _mid;
  END IF;
  
  -- 2. Fallback: match by auth.users email
  SELECT email INTO _uemail FROM auth.users WHERE id = _user_id LIMIT 1;
  IF _uemail IS NOT NULL THEN
    SELECT id INTO _mid FROM public.team_members
    WHERE LOWER(email) = LOWER(_uemail)
    LIMIT 1;
    IF _mid IS NOT NULL THEN
      -- Self-healing: link user_id if null
      UPDATE public.team_members
      SET user_id = _user_id,
          profile_id = COALESCE(profile_id, _user_id)
      WHERE id = _mid AND (user_id IS NULL OR profile_id IS NULL);

      RETURN _mid;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

-- Grant execute to authenticated, anon, and service_role to avoid 42501 permission denied
GRANT EXECUTE ON FUNCTION public.get_team_member_id(UUID) TO authenticated, anon, service_role;

-- 3. RE-CREATE AUTHORITATIVE RLS POLICIES FOR SALARY_RECORDS
ALTER TABLE public.salary_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage salary_records"
  ON public.salary_records FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Workers view own salary_records"
  ON public.salary_records FOR SELECT
  USING (
    team_member_id IN (
      SELECT id FROM public.team_members
      WHERE profile_id = auth.uid() OR user_id = auth.uid()
    )
  );

-- 4. RE-CREATE AUTHORITATIVE RLS POLICIES FOR SALARY_PAYMENTS
ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage salary_payments"
  ON public.salary_payments FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Workers view own salary_payments"
  ON public.salary_payments FOR SELECT
  USING (
    team_member_id IN (
      SELECT id FROM public.team_members
      WHERE profile_id = auth.uid() OR user_id = auth.uid()
    )
  );

-- 5. RE-CREATE AUTHORITATIVE RLS POLICIES FOR SALARY_REQUESTS
ALTER TABLE public.salary_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage salary_requests"
  ON public.salary_requests FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Workers view own salary_requests"
  ON public.salary_requests FOR SELECT
  USING (
    team_member_id IN (
      SELECT id FROM public.team_members
      WHERE profile_id = auth.uid() OR user_id = auth.uid()
    )
  );

CREATE POLICY "Workers insert own salary_requests"
  ON public.salary_requests FOR INSERT
  WITH CHECK (
    status = 'pending' AND
    team_member_id IN (
      SELECT id FROM public.team_members
      WHERE profile_id = auth.uid() OR user_id = auth.uid()
    )
  );

-- 6. PROVISION AUTHORITATIVE SALARY RECORD FOR SARAH CHEN (CORE WORKER)
INSERT INTO public.salary_records (
  team_member_id,
  base_amount,
  currency,
  salary_type,
  payment_frequency,
  standard_monthly_hours,
  hourly_rate,
  status,
  effective_date,
  payment_method
)
SELECT
  '1ca08e63-0b39-4247-bcc8-ce58f71178b2',
  1800.000,
  'TND',
  'monthly',
  'monthly',
  160,
  11.250,
  'active',
  '2026-09-01',
  'Bank Transfer'
WHERE NOT EXISTS (
  SELECT 1 FROM public.salary_records WHERE team_member_id = '1ca08e63-0b39-4247-bcc8-ce58f71178b2'
);
