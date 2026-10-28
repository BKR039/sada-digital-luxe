import { executeLocalSql, runLocalSql } from "./local-db-client";
import { enforceDatabaseIsolation } from "./test-db-guard";

const TARGET_HOST = "127.0.0.1";
const TARGET_PORT = "5432";
const TARGET_DB = "sada_local_test";
const LOCAL_DB_URL = `postgres://postgres@${TARGET_HOST}:${TARGET_PORT}/${TARGET_DB}`;

enforceDatabaseIsolation(LOCAL_DB_URL);

console.log("Applying complete canonical schema extensions to sada_local_test...");

// 1. Ensure profiles has the QA test accounts
executeLocalSql(`
  INSERT INTO public.profiles (id, display_name, status, module_permissions)
  VALUES 
    ('10000000-0000-0000-0000-000000000001', 'QA Super Admin', 'active', '{"all": true, "finance": true}'::jsonb),
    ('20000000-0000-0000-0000-000000000002', 'QA Worker Specialist', 'active', '{"finance": false}'::jsonb)
  ON CONFLICT (id) DO UPDATE SET 
    module_permissions = EXCLUDED.module_permissions;
`);

// 2. Extend financial_accounts check constraint
executeLocalSql(`
  ALTER TABLE public.financial_accounts DROP CONSTRAINT IF EXISTS financial_accounts_account_type_check;
  ALTER TABLE public.financial_accounts ADD CONSTRAINT financial_accounts_account_type_check 
    CHECK (account_type IN ('bank', 'cash', 'gateway', 'checking', 'savings', 'credit_card', 'other'));
`);

// 3. Extend salary_payments
executeLocalSql(`
  ALTER TABLE public.salary_payments
    ADD COLUMN IF NOT EXISTS salary_record_id UUID REFERENCES public.salary_records(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS salary_request_id UUID,
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'TND',
    ADD COLUMN IF NOT EXISTS payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'salary',
    ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'Bank Transfer',
    ADD COLUMN IF NOT EXISTS reference TEXT,
    ADD COLUMN IF NOT EXISTS receipt_url TEXT,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'paid',
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
`);

// 4. Extend salary_requests
executeLocalSql(`
  ALTER TABLE public.salary_requests
    ADD COLUMN IF NOT EXISTS request_type TEXT NOT NULL DEFAULT 'advance',
    ADD COLUMN IF NOT EXISTS requested_amount NUMERIC(12, 3) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'TND',
    ADD COLUMN IF NOT EXISTS requested_date DATE NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS reason TEXT DEFAULT 'Advance',
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS review_notes TEXT,
    ADD COLUMN IF NOT EXISTS approved_amount NUMERIC(12, 3),
    ADD COLUMN IF NOT EXISTS salary_payment_id UUID,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
`);

// 5. Extend sales_commissions
executeLocalSql(`
  ALTER TABLE public.sales_commissions
    ADD COLUMN IF NOT EXISTS deal_value NUMERIC(12, 3) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS invoice_id UUID,
    ADD COLUMN IF NOT EXISTS salary_payment_id UUID,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
`);

console.log("Canonical schema extensions applied successfully.");
