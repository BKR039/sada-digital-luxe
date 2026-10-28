import { execFileSync } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";
import { enforceDatabaseIsolation } from "./test-db-guard";

const TARGET_HOST = "127.0.0.1";
const TARGET_PORT = "5432";
const TARGET_DB = "sada_local_test";
const LOCAL_DB_URL = `postgres://postgres@${TARGET_HOST}:${TARGET_PORT}/${TARGET_DB}`;

const PSQL_BIN = path.join(
  process.env.LOCALAPPDATA || "",
  "Programs",
  "PostgreSQL16",
  "pgsql",
  "bin",
  "psql.exe"
);

function assertSafeTarget(): void {
  enforceDatabaseIsolation(LOCAL_DB_URL);
  if (!fs.existsSync(PSQL_BIN)) {
    throw new Error(`psql binary not found at ${PSQL_BIN}`);
  }
}

function getSanitizedEnv(): NodeJS.ProcessEnv {
  const safeEnv: NodeJS.ProcessEnv = { ...process.env };
  safeEnv.PGHOST = TARGET_HOST;
  safeEnv.PGPORT = TARGET_PORT;
  safeEnv.PGDATABASE = TARGET_DB;
  safeEnv.PGUSER = "postgres";
  return safeEnv;
}

function runSql(sql: string): string {
  assertSafeTarget();
  return execFileSync(
    PSQL_BIN,
    ["-X", "-A", "-t", "-d", TARGET_DB, "-c", sql],
    {
      env: getSanitizedEnv(),
      encoding: "utf-8",
    }
  ).trim();
}

async function setup() {
  console.log("Setting up Financial Command Center schema on sada_local_test...");

  const ddl = `
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
      is_demo BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_financial_accounts_status ON public.financial_accounts(status);
    CREATE INDEX IF NOT EXISTS idx_financial_accounts_demo ON public.financial_accounts(is_demo);

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

    -- 4. Extend clients with Financial Profile Fields & is_demo
    ALTER TABLE public.clients
      ADD COLUMN IF NOT EXISTS monthly_package_price NUMERIC(12, 3) DEFAULT 0 CHECK (monthly_package_price >= 0),
      ADD COLUMN IF NOT EXISTS default_service_fee NUMERIC(12, 3) DEFAULT 0 CHECK (default_service_fee >= 0),
      ADD COLUMN IF NOT EXISTS default_sponsoring_budget NUMERIC(12, 3) DEFAULT 0 CHECK (default_sponsoring_budget >= 0),
      ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5, 2) DEFAULT 10.00 CHECK (commission_rate >= 0 AND commission_rate <= 100),
      ADD COLUMN IF NOT EXISTS commission_recipient_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

    -- 5. Invoices
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
      is_demo BOOLEAN NOT NULL DEFAULT false,
      created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_invoices_client ON public.invoices(client_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);

    -- 6. Sponsoring Campaigns
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
      is_demo BOOLEAN NOT NULL DEFAULT false,
      created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_sponsoring_client ON public.sponsoring_campaigns(client_id);
    CREATE INDEX IF NOT EXISTS idx_sponsoring_status ON public.sponsoring_campaigns(payment_status);

    -- 7. Salary Records
    CREATE TABLE IF NOT EXISTS public.salary_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE UNIQUE,
      base_amount NUMERIC(12, 3) NOT NULL CHECK (base_amount >= 0),
      currency TEXT NOT NULL DEFAULT 'TND',
      payment_frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (payment_frequency IN ('monthly', 'biweekly', 'weekly')),
      payment_method TEXT NOT NULL DEFAULT 'Bank Transfer',
      bank_account_info TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- 8. Salary Requests
    CREATE TABLE IF NOT EXISTS public.salary_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
      request_type TEXT NOT NULL DEFAULT 'advance' CHECK (request_type IN ('advance', 'reimbursement', 'bonus', 'other')),
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
      salary_payment_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- 9. Salary Payments
    CREATE TABLE IF NOT EXISTS public.salary_payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
      salary_record_id UUID REFERENCES public.salary_records(id) ON DELETE SET NULL,
      salary_request_id UUID REFERENCES public.salary_requests(id) ON DELETE SET NULL,
      amount NUMERIC(12, 3) NOT NULL CHECK (amount > 0),
      currency TEXT NOT NULL DEFAULT 'TND',
      payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
      payment_type TEXT NOT NULL DEFAULT 'salary' CHECK (payment_type IN ('salary', 'advance', 'bonus', 'commission', 'reimbursement')),
      payment_method TEXT NOT NULL DEFAULT 'Bank Transfer',
      reference TEXT,
      receipt_url TEXT,
      status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'pending', 'cancelled')),
      notes TEXT,
      created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- 10. Sales Commissions
    CREATE TABLE IF NOT EXISTS public.sales_commissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
      client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
      deal_id UUID REFERENCES public.sales_deals(id) ON DELETE SET NULL,
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
    CREATE INDEX IF NOT EXISTS idx_commissions_status ON public.sales_commissions(status);

    -- 11. Income Transactions
    CREATE TABLE IF NOT EXISTS public.income_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      amount NUMERIC(12, 3) NOT NULL CHECK (amount > 0),
      currency TEXT NOT NULL DEFAULT 'TND',
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      category TEXT NOT NULL DEFAULT 'Client Payment',
      allocation TEXT NOT NULL DEFAULT 'client_service' CHECK (allocation IN ('client_service', 'sponsoring_collected', 'product_revenue', 'other_revenue', 'transfer', 'other')),
      invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
      account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
      transaction_type TEXT NOT NULL DEFAULT 'CLIENT_PAYMENT',
      period_month TEXT DEFAULT to_char(CURRENT_DATE, 'YYYY-MM'),
      client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
      project_id UUID REFERENCES public.client_projects(id) ON DELETE SET NULL,
      description TEXT NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'Bank Transfer',
      status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'pending', 'cancelled')),
      reference TEXT,
      receipt_url TEXT,
      notes TEXT,
      is_demo BOOLEAN NOT NULL DEFAULT false,
      created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_income_transactions_date ON public.income_transactions(date);
    CREATE INDEX IF NOT EXISTS idx_income_transactions_status ON public.income_transactions(status);
    CREATE INDEX IF NOT EXISTS idx_income_transactions_demo ON public.income_transactions(is_demo);

    -- 12. Expense Transactions
    CREATE TABLE IF NOT EXISTS public.expense_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      amount NUMERIC(12, 3) NOT NULL CHECK (amount > 0),
      currency TEXT NOT NULL DEFAULT 'TND',
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
      category_name TEXT NOT NULL,
      allocation TEXT NOT NULL DEFAULT 'operating_expense' CHECK (allocation IN ('operating_expense', 'sponsoring_purchase', 'payroll', 'commission', 'sales_commission', 'equipment', 'software', 'tax_fees', 'transfer', 'other')),
      sponsoring_campaign_id UUID REFERENCES public.sponsoring_campaigns(id) ON DELETE SET NULL,
      commission_id UUID REFERENCES public.sales_commissions(id) ON DELETE SET NULL,
      account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
      transaction_type TEXT NOT NULL DEFAULT 'EXPENSE',
      period_month TEXT DEFAULT to_char(CURRENT_DATE, 'YYYY-MM'),
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
      is_demo BOOLEAN NOT NULL DEFAULT false,
      created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_expense_transactions_date ON public.expense_transactions(date);
    CREATE INDEX IF NOT EXISTS idx_expense_transactions_status ON public.expense_transactions(status);
    CREATE INDEX IF NOT EXISTS idx_expense_transactions_demo ON public.expense_transactions(is_demo);

    -- 13. Financial Closing Periods
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

    -- 14. Financial Audit Logs
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

    -- 15. Seed Default Categories if none exist
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

    -- 16. Seed Standard Canonical SADA Financial Accounts (Non-demo)
    INSERT INTO public.financial_accounts (name, account_type, currency, opening_balance, current_balance, bank_name, is_default, is_demo)
    VALUES
      ('BIAT Corporate Account', 'bank', 'TND', 15000.000, 15000.000, 'Banque Internationale Arabe de Tunisie', true, false),
      ('Petty Cash Box (Caisse)', 'cash', 'TND', 1200.000, 1200.000, 'SADA Agency Safe', false, false),
      ('USD Ad Spend Card (Wise/Stripe)', 'gateway', 'USD', 2000.000, 2000.000, 'Wise Business', false, false)
    ON CONFLICT (name) DO UPDATE SET
      opening_balance = EXCLUDED.opening_balance,
      current_balance = EXCLUDED.current_balance;
  `;

  runSql(ddl);
  console.log("✓ Financial Command Center schema setup successfully on sada_local_test!");
}

setup().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
