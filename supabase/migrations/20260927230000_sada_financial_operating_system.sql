-- ============================================================
-- SADA FINANCIAL OPERATING SYSTEM (SADA OS)
-- Migration: 20260927230000_sada_financial_operating_system.sql
-- Modules: Central Financial Ledger, Sponsoring Engine, Invoices,
-- Commissions, Cash Accounts, Monthly Closing, and Client Profitability
-- ============================================================

-- 1. Financial Accounts (Treasury & Cash Flow Management)
CREATE TABLE IF NOT EXISTS public.financial_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  account_type TEXT NOT NULL CHECK (account_type IN ('bank', 'cash', 'gateway', 'other')),
  currency TEXT NOT NULL DEFAULT 'TND',
  opening_balance NUMERIC(12, 3) NOT NULL DEFAULT 0,
  current_balance NUMERIC(12, 3) NOT NULL DEFAULT 0,
  account_number TEXT,
  bank_name TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_status ON public.financial_accounts(status);

-- Seed Default SADA Accounts if none exist
INSERT INTO public.financial_accounts (name, account_type, currency, opening_balance, current_balance, bank_name, is_default)
VALUES
  ('BIAT Corporate Account', 'bank', 'TND', 15000.000, 15000.000, 'Banque Internationale Arabe de Tunisie', true),
  ('Petty Cash Box (Caisse)', 'cash', 'TND', 1200.000, 1200.000, 'SADA Agency Safe', false),
  ('USD Ad Spend Card (Wise/Stripe)', 'gateway', 'USD', 2000.000, 2000.000, 'Wise Business', false)
ON CONFLICT (name) DO NOTHING;

-- 2. Extend clients with Financial Profile Fields
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS monthly_package_price NUMERIC(12, 3) DEFAULT 0 CHECK (monthly_package_price >= 0),
  ADD COLUMN IF NOT EXISTS default_service_fee NUMERIC(12, 3) DEFAULT 0 CHECK (default_service_fee >= 0),
  ADD COLUMN IF NOT EXISTS default_sponsoring_budget NUMERIC(12, 3) DEFAULT 0 CHECK (default_sponsoring_budget >= 0),
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5, 2) DEFAULT 10.00 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  ADD COLUMN IF NOT EXISTS commission_recipient_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_commission_recipient ON public.clients(commission_recipient_id);

-- 3. Invoices (Canonical Revenue & Invoicing Engine)
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  project_id UUID REFERENCES public.client_projects(id) ON DELETE SET NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  service_revenue NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (service_revenue >= 0),
  sponsoring_budget NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (sponsoring_budget >= 0),
  other_revenue NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (other_revenue >= 0),
  subtotal NUMERIC(12, 3) NOT NULL CHECK (subtotal >= 0),
  tax_amount NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount NUMERIC(12, 3) NOT NULL CHECK (total_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'TND',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled')),
  paid_amount NUMERIC(12, 3) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_client ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON public.invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(due_date);

-- 4. Sponsoring Campaigns (Specialized Ad Spend & Currency Arbitrage Engine)
CREATE TABLE IF NOT EXISTS public.sponsoring_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.client_projects(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  campaign_name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'Meta Ads' CHECK (platform IN ('Meta Ads', 'Google Ads', 'TikTok Ads', 'LinkedIn Ads', 'Snapchat Ads', 'Other')),
  budget_tnd NUMERIC(12, 3) NOT NULL CHECK (budget_tnd >= 0),
  usd_amount NUMERIC(12, 2) NOT NULL CHECK (usd_amount >= 0),
  purchase_rate NUMERIC(10, 4) NOT NULL CHECK (purchase_rate >= 0),
  purchase_cost_tnd NUMERIC(12, 3) NOT NULL CHECK (purchase_cost_tnd >= 0),
  client_rate NUMERIC(10, 4) NOT NULL DEFAULT 4.0000,
  client_charge_tnd NUMERIC(12, 3) NOT NULL CHECK (client_charge_tnd >= 0),
  margin_tnd NUMERIC(12, 3) NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'partially_paid', 'cancelled')),
  execution_status TEXT NOT NULL DEFAULT 'active' CHECK (execution_status IN ('planning', 'active', 'completed', 'paused')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  period_month TEXT DEFAULT to_char(CURRENT_DATE, 'YYYY-MM'),
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sponsoring_client ON public.sponsoring_campaigns(client_id);
CREATE INDEX IF NOT EXISTS idx_sponsoring_status ON public.sponsoring_campaigns(payment_status);
CREATE INDEX IF NOT EXISTS idx_sponsoring_date ON public.sponsoring_campaigns(date);
CREATE INDEX IF NOT EXISTS idx_sponsoring_period ON public.sponsoring_campaigns(period_month);

-- 5. Sales Commissions (Directly connected to client service revenue)
CREATE TABLE IF NOT EXISTS public.sales_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  service_revenue NUMERIC(12, 3) NOT NULL CHECK (service_revenue >= 0),
  commission_rate NUMERIC(5, 2) NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 100),
  commission_amount NUMERIC(12, 3) NOT NULL CHECK (commission_amount >= 0),
  period_month TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  salary_payment_id UUID REFERENCES public.salary_payments(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commissions_member ON public.sales_commissions(team_member_id);
CREATE INDEX IF NOT EXISTS idx_commissions_client ON public.sales_commissions(client_id);
CREATE INDEX IF NOT EXISTS idx_commissions_period ON public.sales_commissions(period_month);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON public.sales_commissions(status);

-- 6. Monthly Financial Closing Periods
CREATE TABLE IF NOT EXISTS public.financial_closing_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  checklist JSONB NOT NULL DEFAULT '{
    "client_payments_reconciled": false,
    "invoices_reconciled": false,
    "sponsoring_reconciled": false,
    "commissions_calculated": false,
    "payroll_processed": false,
    "expenses_reviewed": false,
    "requests_reviewed": false,
    "outstanding_checked": false
  }'::jsonb,
  closing_summary JSONB DEFAULT '{}'::jsonb,
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reopened_at TIMESTAMPTZ,
  reopened_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reopen_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_closing_periods_month ON public.financial_closing_periods(period_month);
CREATE INDEX IF NOT EXISTS idx_closing_periods_status ON public.financial_closing_periods(status);

-- 7. Extend income_transactions with Ledger relationships
ALTER TABLE public.income_transactions
  ADD COLUMN IF NOT EXISTS allocation TEXT NOT NULL DEFAULT 'client_service' CHECK (allocation IN ('client_service', 'sponsoring_collected', 'product_revenue', 'other_revenue')),
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transaction_type TEXT NOT NULL DEFAULT 'CLIENT_PAYMENT' CHECK (transaction_type IN ('CLIENT_PAYMENT', 'SPONSORING_PAYMENT', 'PRODUCT_REVENUE', 'OTHER_INCOME', 'REFUND', 'TRANSFER')),
  ADD COLUMN IF NOT EXISTS period_month TEXT DEFAULT to_char(CURRENT_DATE, 'YYYY-MM');

CREATE INDEX IF NOT EXISTS idx_income_transactions_invoice ON public.income_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_income_transactions_account ON public.income_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_income_transactions_allocation ON public.income_transactions(allocation);
CREATE INDEX IF NOT EXISTS idx_income_transactions_period ON public.income_transactions(period_month);

-- 8. Extend expense_transactions with Ledger relationships
ALTER TABLE public.expense_transactions
  ADD COLUMN IF NOT EXISTS allocation TEXT NOT NULL DEFAULT 'operating_expense' CHECK (allocation IN ('operating_expense', 'sponsoring_purchase', 'payroll', 'commission', 'equipment', 'software', 'tax_fees', 'other')),
  ADD COLUMN IF NOT EXISTS sponsoring_campaign_id UUID REFERENCES public.sponsoring_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commission_id UUID REFERENCES public.sales_commissions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transaction_type TEXT NOT NULL DEFAULT 'EXPENSE' CHECK (transaction_type IN ('EXPENSE', 'SPONSORING_PURCHASE', 'SALARY', 'COMMISSION', 'WITHDRAWAL', 'TRANSFER')),
  ADD COLUMN IF NOT EXISTS period_month TEXT DEFAULT to_char(CURRENT_DATE, 'YYYY-MM');

CREATE INDEX IF NOT EXISTS idx_expense_transactions_sponsoring ON public.expense_transactions(sponsoring_campaign_id);
CREATE INDEX IF NOT EXISTS idx_expense_transactions_commission ON public.expense_transactions(commission_id);
CREATE INDEX IF NOT EXISTS idx_expense_transactions_account ON public.expense_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_expense_transactions_allocation ON public.expense_transactions(allocation);
CREATE INDEX IF NOT EXISTS idx_expense_transactions_period ON public.expense_transactions(period_month);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsoring_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_closing_periods ENABLE ROW LEVEL SECURITY;

-- 1. financial_accounts (Super Admin only)
DROP POLICY IF EXISTS "Super Admins read financial_accounts" ON public.financial_accounts;
DROP POLICY IF EXISTS "Super Admins manage financial_accounts" ON public.financial_accounts;

CREATE POLICY "Super Admins read financial_accounts"
  ON public.financial_accounts FOR SELECT
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super Admins manage financial_accounts"
  ON public.financial_accounts FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 2. invoices (Super Admin & Admin can read/manage)
DROP POLICY IF EXISTS "Admins read invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admins manage invoices" ON public.invoices;

CREATE POLICY "Admins read invoices"
  ON public.invoices FOR SELECT
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Admins manage invoices"
  ON public.invoices FOR ALL
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- 3. sponsoring_campaigns (Super Admin & Admin manage)
DROP POLICY IF EXISTS "Admins read sponsoring_campaigns" ON public.sponsoring_campaigns;
DROP POLICY IF EXISTS "Admins manage sponsoring_campaigns" ON public.sponsoring_campaigns;

CREATE POLICY "Admins read sponsoring_campaigns"
  ON public.sponsoring_campaigns FOR SELECT
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Admins manage sponsoring_campaigns"
  ON public.sponsoring_campaigns FOR ALL
  USING (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_super_admin(auth.uid()));

-- 4. sales_commissions (Super Admin manages all, Worker sees ONLY own commissions)
DROP POLICY IF EXISTS "Read sales_commissions" ON public.sales_commissions;
DROP POLICY IF EXISTS "Super Admins manage sales_commissions" ON public.sales_commissions;

CREATE POLICY "Read sales_commissions"
  ON public.sales_commissions FOR SELECT
  USING (
    public.is_super_admin(auth.uid()) OR
    team_member_id = public.get_team_member_id(auth.uid())
  );

CREATE POLICY "Super Admins manage sales_commissions"
  ON public.sales_commissions FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 5. financial_closing_periods (Super Admin only)
DROP POLICY IF EXISTS "Super Admins read financial_closing_periods" ON public.financial_closing_periods;
DROP POLICY IF EXISTS "Super Admins manage financial_closing_periods" ON public.financial_closing_periods;

CREATE POLICY "Super Admins read financial_closing_periods"
  ON public.financial_closing_periods FOR SELECT
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super Admins manage financial_closing_periods"
  ON public.financial_closing_periods FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
