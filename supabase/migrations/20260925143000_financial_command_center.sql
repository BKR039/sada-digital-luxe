-- ============================================================
-- SADA OS — FINANCE & COMPENSATION COMMAND CENTER
-- Migration: 20260925143000_financial_command_center.sql
-- Module: Super Admin Finance + Worker Salary Center
-- ============================================================

-- 1. Helper function to resolve auth.uid() to team_members.id
CREATE OR REPLACE FUNCTION public.get_team_member_id(_user_id UUID)
RETURNS UUID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _mid UUID;
  _uemail TEXT;
BEGIN
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 1. Check direct profile_id match
  SELECT id INTO _mid FROM public.team_members WHERE profile_id = _user_id LIMIT 1;
  IF _mid IS NOT NULL THEN
    RETURN _mid;
  END IF;
  
  -- 2. Fallback: match by auth.users email
  SELECT email INTO _uemail FROM auth.users WHERE id = _user_id LIMIT 1;
  IF _uemail IS NOT NULL THEN
    SELECT id INTO _mid FROM public.team_members WHERE LOWER(email) = LOWER(_uemail) LIMIT 1;
    IF _mid IS NOT NULL THEN
      RETURN _mid;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_team_member_id(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_member_id(UUID) TO authenticated, service_role;

-- 2. Expense Categories Table
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#8B5CF6',
  icon TEXT DEFAULT 'receipt',
  is_system BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_categories_name ON public.expense_categories(name);
CREATE INDEX IF NOT EXISTS idx_expense_categories_sort ON public.expense_categories(sort_order);

-- Seed Canonical Categories
INSERT INTO public.expense_categories (name, description, color, icon, is_system, sort_order)
VALUES
  ('People & Salaries', 'Salaries, contract payouts, compensation advances, and team bonuses', '#10B981', 'users', true, 1),
  ('Software & SaaS', 'Development tools, cloud infrastructure, AI models, and subscriptions', '#6366F1', 'laptop', true, 2),
  ('Equipment & Hardware', 'Workstations, photo/video production gear, audio, and studio hardware', '#F59E0B', 'cpu', true, 3),
  ('Production & Creative', 'Set costs, photography, film props, locations, voiceovers, and prints', '#EC4899', 'video', true, 4),
  ('Marketing & Advertising', 'Ad spend (Meta, Google, LinkedIn), sponsored promos, events, and collaterals', '#8B5CF6', 'megaphone', true, 5),
  ('Office & Utilities', 'HQ rent, studio expenses, internet, power, supplies, and maintenance', '#3B82F6', 'building', true, 6),
  ('Travel & Transport', 'Client meetings, shoot travel, logistics, fuel, and transport expenses', '#14B8A6', 'car', true, 7),
  ('Professional Services', 'Legal, accounting, external audits, compliance, and government fees', '#06B6D4', 'briefcase', true, 8),
  ('Other Operational', 'Miscellaneous operational and unexpected administrative costs', '#64748B', 'circle-dot', true, 9)
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  color = EXCLUDED.color,
  icon = EXCLUDED.icon,
  is_system = EXCLUDED.is_system;

-- 3. Subscriptions / Recurring Expenses Table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  vendor TEXT,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  category_name TEXT NOT NULL DEFAULT 'Software & SaaS',
  amount NUMERIC(12, 3) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'TND',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'quarterly', 'yearly')),
  billing_day INTEGER DEFAULT 1 CHECK (billing_day >= 1 AND billing_day <= 31),
  next_billing_date DATE,
  payment_method TEXT DEFAULT 'Credit Card',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing ON public.subscriptions(next_billing_date);

-- 4. Salary Records (Canonical Compensation Structure per Team Member)
CREATE TABLE IF NOT EXISTS public.salary_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE UNIQUE,
  base_amount NUMERIC(12, 3) NOT NULL CHECK (base_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'TND',
  salary_type TEXT NOT NULL DEFAULT 'monthly' CHECK (salary_type IN ('monthly', 'hourly', 'fixed_contract', 'per_project')),
  payment_frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (payment_frequency IN ('monthly', 'bi_weekly', 'weekly', 'on_delivery')),
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  next_payment_date DATE,
  payment_method TEXT NOT NULL DEFAULT 'Bank Transfer',
  bank_details TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'terminated')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_salary_records_member ON public.salary_records(team_member_id);
CREATE INDEX IF NOT EXISTS idx_salary_records_status ON public.salary_records(status);

-- 5. Salary Payments (Canonical Employee Payout Transactions)
CREATE TABLE IF NOT EXISTS public.salary_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE RESTRICT,
  salary_record_id UUID REFERENCES public.salary_records(id) ON DELETE SET NULL,
  salary_request_id UUID,
  amount NUMERIC(12, 3) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'TND',
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  period_start DATE,
  period_end DATE,
  payment_type TEXT NOT NULL DEFAULT 'regular' CHECK (payment_type IN ('regular', 'advance', 'bonus', 'adjustment')),
  payment_method TEXT NOT NULL DEFAULT 'Bank Transfer',
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'pending', 'cancelled')),
  receipt_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_salary_payments_member ON public.salary_payments(team_member_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_date ON public.salary_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_salary_payments_status ON public.salary_payments(status);

-- 6. Salary Requests (Early Advance / Payout Requests Submitted by Workers)
CREATE TABLE IF NOT EXISTS public.salary_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  requested_amount NUMERIC(12, 3) NOT NULL CHECK (requested_amount > 0),
  currency TEXT NOT NULL DEFAULT 'TND',
  requested_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  approved_amount NUMERIC(12, 3) CHECK (approved_amount IS NULL OR approved_amount > 0),
  salary_payment_id UUID REFERENCES public.salary_payments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_salary_requests_member ON public.salary_requests(team_member_id);
CREATE INDEX IF NOT EXISTS idx_salary_requests_status ON public.salary_requests(status);
CREATE INDEX IF NOT EXISTS idx_salary_requests_date ON public.salary_requests(requested_date);

-- Add foreign key back to salary_payments.salary_request_id safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_salary_payments_request'
  ) THEN
    ALTER TABLE public.salary_payments
      ADD CONSTRAINT fk_salary_payments_request
      FOREIGN KEY (salary_request_id) REFERENCES public.salary_requests(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 7. Expense Transactions (Canonical Outflow Transactions for Company Finance)
CREATE TABLE IF NOT EXISTS public.expense_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC(12, 3) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'TND',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  category_name TEXT NOT NULL,
  subcategory TEXT,
  vendor TEXT,
  description TEXT NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'Bank Transfer',
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'pending', 'cancelled')),
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  salary_payment_id UUID REFERENCES public.salary_payments(id) ON DELETE SET NULL,
  team_member_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.client_projects(id) ON DELETE SET NULL,
  reference TEXT,
  receipt_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_transactions_date ON public.expense_transactions(date);
CREATE INDEX IF NOT EXISTS idx_expense_transactions_cat ON public.expense_transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_expense_transactions_status ON public.expense_transactions(status);
CREATE INDEX IF NOT EXISTS idx_expense_transactions_salary_pay ON public.expense_transactions(salary_payment_id);
CREATE INDEX IF NOT EXISTS idx_expense_transactions_client ON public.expense_transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_expense_transactions_project ON public.expense_transactions(project_id);

-- 8. Income Transactions (Canonical Inflow Transactions for Company Finance)
CREATE TABLE IF NOT EXISTS public.income_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC(12, 3) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'TND',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL DEFAULT 'Client Payment' CHECK (category IN ('Client Payment', 'Project Payment', 'Retainer', 'Product Revenue', 'Other')),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.client_projects(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'Bank Transfer',
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'pending', 'cancelled')),
  reference TEXT,
  receipt_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_income_transactions_date ON public.income_transactions(date);
CREATE INDEX IF NOT EXISTS idx_income_transactions_client ON public.income_transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_income_transactions_project ON public.income_transactions(project_id);
CREATE INDEX IF NOT EXISTS idx_income_transactions_status ON public.income_transactions(status);

-- 9. Financial Audit Trail
CREATE TABLE IF NOT EXISTS public.financial_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_audit_logs_created ON public.financial_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_financial_audit_logs_actor ON public.financial_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_financial_audit_logs_entity ON public.financial_audit_logs(entity_type, entity_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on all financial tables
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. expense_categories (Super Admin full management)
DROP POLICY IF EXISTS "Super Admins read expense_categories" ON public.expense_categories;
DROP POLICY IF EXISTS "Super Admins manage expense_categories" ON public.expense_categories;

CREATE POLICY "Super Admins read expense_categories"
  ON public.expense_categories FOR SELECT
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super Admins insert expense_categories"
  ON public.expense_categories FOR INSERT
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super Admins update expense_categories"
  ON public.expense_categories FOR UPDATE
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super Admins delete expense_categories"
  ON public.expense_categories FOR DELETE
  USING (public.is_super_admin(auth.uid()));

-- 2. subscriptions (Super Admin ONLY)
DROP POLICY IF EXISTS "Super Admins read subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Super Admins insert subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Super Admins update subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Super Admins delete subscriptions" ON public.subscriptions;

CREATE POLICY "Super Admins read subscriptions"
  ON public.subscriptions FOR SELECT
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super Admins insert subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super Admins update subscriptions"
  ON public.subscriptions FOR UPDATE
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super Admins delete subscriptions"
  ON public.subscriptions FOR DELETE
  USING (public.is_super_admin(auth.uid()));

-- 3. expense_transactions (Super Admin ONLY)
DROP POLICY IF EXISTS "Super Admins read expense_transactions" ON public.expense_transactions;
DROP POLICY IF EXISTS "Super Admins insert expense_transactions" ON public.expense_transactions;
DROP POLICY IF EXISTS "Super Admins update expense_transactions" ON public.expense_transactions;
DROP POLICY IF EXISTS "Super Admins delete expense_transactions" ON public.expense_transactions;

CREATE POLICY "Super Admins read expense_transactions"
  ON public.expense_transactions FOR SELECT
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super Admins insert expense_transactions"
  ON public.expense_transactions FOR INSERT
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super Admins update expense_transactions"
  ON public.expense_transactions FOR UPDATE
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super Admins delete expense_transactions"
  ON public.expense_transactions FOR DELETE
  USING (public.is_super_admin(auth.uid()));

-- 4. income_transactions (Super Admin ONLY)
DROP POLICY IF EXISTS "Super Admins read income_transactions" ON public.income_transactions;
DROP POLICY IF EXISTS "Super Admins insert income_transactions" ON public.income_transactions;
DROP POLICY IF EXISTS "Super Admins update income_transactions" ON public.income_transactions;
DROP POLICY IF EXISTS "Super Admins delete income_transactions" ON public.income_transactions;

CREATE POLICY "Super Admins read income_transactions"
  ON public.income_transactions FOR SELECT
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super Admins insert income_transactions"
  ON public.income_transactions FOR INSERT
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super Admins update income_transactions"
  ON public.income_transactions FOR UPDATE
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super Admins delete income_transactions"
  ON public.income_transactions FOR DELETE
  USING (public.is_super_admin(auth.uid()));

-- 5. salary_records:
-- Super Admin sees all. Worker sees ONLY their own.
DROP POLICY IF EXISTS "Read salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Super Admins insert salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Super Admins update salary_records" ON public.salary_records;
DROP POLICY IF EXISTS "Super Admins delete salary_records" ON public.salary_records;

CREATE POLICY "Read salary_records"
  ON public.salary_records FOR SELECT
  USING (
    public.is_super_admin(auth.uid()) OR
    team_member_id = public.get_team_member_id(auth.uid())
  );

CREATE POLICY "Super Admins insert salary_records"
  ON public.salary_records FOR INSERT
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super Admins update salary_records"
  ON public.salary_records FOR UPDATE
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super Admins delete salary_records"
  ON public.salary_records FOR DELETE
  USING (public.is_super_admin(auth.uid()));

-- 6. salary_payments:
-- Super Admin sees all. Worker sees ONLY their own payments.
DROP POLICY IF EXISTS "Read salary_payments" ON public.salary_payments;
DROP POLICY IF EXISTS "Super Admins insert salary_payments" ON public.salary_payments;
DROP POLICY IF EXISTS "Super Admins update salary_payments" ON public.salary_payments;
DROP POLICY IF EXISTS "Super Admins delete salary_payments" ON public.salary_payments;

CREATE POLICY "Read salary_payments"
  ON public.salary_payments FOR SELECT
  USING (
    public.is_super_admin(auth.uid()) OR
    team_member_id = public.get_team_member_id(auth.uid())
  );

CREATE POLICY "Super Admins insert salary_payments"
  ON public.salary_payments FOR INSERT
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super Admins update salary_payments"
  ON public.salary_payments FOR UPDATE
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super Admins delete salary_payments"
  ON public.salary_payments FOR DELETE
  USING (public.is_super_admin(auth.uid()));

-- 7. salary_requests:
-- Super Admin sees all. Worker sees ONLY their own.
-- Worker can INSERT request for their own team_member_id only.
-- Super Admin can UPDATE (approve / reject). Worker CANNOT update.
-- Super Admin can DELETE. Worker CANNOT delete.
DROP POLICY IF EXISTS "Read salary_requests" ON public.salary_requests;
DROP POLICY IF EXISTS "Insert salary_requests" ON public.salary_requests;
DROP POLICY IF EXISTS "Super Admins update salary_requests" ON public.salary_requests;
DROP POLICY IF EXISTS "Super Admins delete salary_requests" ON public.salary_requests;

CREATE POLICY "Read salary_requests"
  ON public.salary_requests FOR SELECT
  USING (
    public.is_super_admin(auth.uid()) OR
    team_member_id = public.get_team_member_id(auth.uid())
  );

CREATE POLICY "Insert salary_requests"
  ON public.salary_requests FOR INSERT
  WITH CHECK (
    public.is_super_admin(auth.uid()) OR
    (
      team_member_id = public.get_team_member_id(auth.uid()) AND
      status = 'pending'
    )
  );

CREATE POLICY "Super Admins update salary_requests"
  ON public.salary_requests FOR UPDATE
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super Admins delete salary_requests"
  ON public.salary_requests FOR DELETE
  USING (public.is_super_admin(auth.uid()));

-- 8. financial_audit_logs:
-- Super Admin sees all audit logs.
-- Authenticated users (Workers and Admins) can INSERT their own action logs (e.g. requesting early pay).
DROP POLICY IF EXISTS "Super Admins read financial_audit_logs" ON public.financial_audit_logs;
DROP POLICY IF EXISTS "Insert financial_audit_logs" ON public.financial_audit_logs;

CREATE POLICY "Super Admins read financial_audit_logs"
  ON public.financial_audit_logs FOR SELECT
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Insert financial_audit_logs"
  ON public.financial_audit_logs FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    (actor_id IS NULL OR actor_id = auth.uid())
  );
