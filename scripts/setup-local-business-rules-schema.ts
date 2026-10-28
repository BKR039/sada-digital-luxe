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
  delete safeEnv.DATABASE_URL;
  delete safeEnv.SUPABASE_DB_URL;
  delete safeEnv.PGSERVICE;
  delete safeEnv.PGSERVICEFILE;
  delete safeEnv.PGHOSTADDR;
  delete safeEnv.PGOPTIONS;
  delete safeEnv.PGSSLMODE;
  delete safeEnv.PGDATABASE;
  delete safeEnv.PGUSER;
  safeEnv.PGHOST = TARGET_HOST;
  safeEnv.PGPORT = TARGET_PORT;
  safeEnv.PGDATABASE = TARGET_DB;
  safeEnv.PGCLIENTENCODING = "UTF8";
  return safeEnv;
}

export function runSql(sql: string): string {
  assertSafeTarget();
  return execFileSync(
    PSQL_BIN,
    ["-h", TARGET_HOST, "-p", TARGET_PORT, "-U", "postgres", "-d", TARGET_DB, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-f", "-"],
    { input: sql, encoding: "utf8", env: getSanitizedEnv() }
  ).trim();
}

async function setupLocalSchema() {
  console.log("=== ALIGNING LOCAL sada_local_test WITH CANONICAL BUSINESS RULES SCHEMA ===");

  const sql = `
    -- 1. Ensure all columns on public.business_rules
    ALTER TABLE public.business_rules ALTER COLUMN numeric_value DROP NOT NULL;
    ALTER TABLE public.business_rules ADD COLUMN IF NOT EXISTS rule_name TEXT;
    ALTER TABLE public.business_rules ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE public.business_rules ADD COLUMN IF NOT EXISTS category TEXT;
    ALTER TABLE public.business_rules ADD COLUMN IF NOT EXISTS value_type TEXT DEFAULT 'numeric';
    ALTER TABLE public.business_rules ADD COLUMN IF NOT EXISTS boolean_value BOOLEAN;
    ALTER TABLE public.business_rules ADD COLUMN IF NOT EXISTS text_value TEXT;
    ALTER TABLE public.business_rules ADD COLUMN IF NOT EXISTS json_value JSONB;
    ALTER TABLE public.business_rules ADD COLUMN IF NOT EXISTS unit TEXT;
    ALTER TABLE public.business_rules ADD COLUMN IF NOT EXISTS min_value NUMERIC;
    ALTER TABLE public.business_rules ADD COLUMN IF NOT EXISTS max_value NUMERIC;
    ALTER TABLE public.business_rules ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ DEFAULT now();
    ALTER TABLE public.business_rules ADD COLUMN IF NOT EXISTS effective_until TIMESTAMPTZ;
    ALTER TABLE public.business_rules ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
    ALTER TABLE public.business_rules ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
    ALTER TABLE public.business_rules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
    ALTER TABLE public.business_rules ADD COLUMN IF NOT EXISTS operator VARCHAR(20) DEFAULT '<=';
    ALTER TABLE public.business_rules ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'warning';
    ALTER TABLE public.business_rules ADD COLUMN IF NOT EXISTS applies_to VARCHAR(100) DEFAULT 'system';
    ALTER TABLE public.business_rules ADD COLUMN IF NOT EXISTS default_numeric_value NUMERIC(12, 4);
    ALTER TABLE public.business_rules ADD COLUMN IF NOT EXISTS default_boolean_value BOOLEAN;
    ALTER TABLE public.business_rules ADD COLUMN IF NOT EXISTS default_text_value TEXT;
    ALTER TABLE public.business_rules ADD COLUMN IF NOT EXISTS default_json_value JSONB;
    ALTER TABLE public.business_rules ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE public.business_rules ADD COLUMN IF NOT EXISTS change_reason TEXT;

    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'business_rules_rule_key_key'
      ) THEN
        ALTER TABLE public.business_rules ADD CONSTRAINT business_rules_rule_key_key UNIQUE (rule_key);
      END IF;
    END $$;

    -- 2. Ensure all columns on public.business_rule_versions
    ALTER TABLE public.business_rule_versions ADD COLUMN IF NOT EXISTS numeric_value NUMERIC;
    ALTER TABLE public.business_rule_versions ADD COLUMN IF NOT EXISTS boolean_value BOOLEAN;
    ALTER TABLE public.business_rule_versions ADD COLUMN IF NOT EXISTS text_value TEXT;
    ALTER TABLE public.business_rule_versions ADD COLUMN IF NOT EXISTS json_value JSONB;
    ALTER TABLE public.business_rule_versions ADD COLUMN IF NOT EXISTS operator VARCHAR(20);
    ALTER TABLE public.business_rule_versions ADD COLUMN IF NOT EXISTS severity VARCHAR(20);
    ALTER TABLE public.business_rule_versions ADD COLUMN IF NOT EXISTS applies_to VARCHAR(100);
    ALTER TABLE public.business_rule_versions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE public.business_rule_versions ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ DEFAULT now();
    ALTER TABLE public.business_rule_versions ADD COLUMN IF NOT EXISTS effective_until TIMESTAMPTZ;
    ALTER TABLE public.business_rule_versions ADD COLUMN IF NOT EXISTS change_reason TEXT;

    -- 3. Automatic Version Archival Trigger
    CREATE OR REPLACE FUNCTION public.archive_business_rule_version()
    RETURNS TRIGGER AS $$
    BEGIN
        -- Only archive if a value, condition, status or policy actually changed
        IF (OLD.numeric_value IS DISTINCT FROM NEW.numeric_value OR
            OLD.boolean_value IS DISTINCT FROM NEW.boolean_value OR
            OLD.text_value IS DISTINCT FROM NEW.text_value OR
            OLD.json_value IS DISTINCT FROM NEW.json_value OR
            OLD.operator IS DISTINCT FROM NEW.operator OR
            OLD.severity IS DISTINCT FROM NEW.severity OR
            OLD.applies_to IS DISTINCT FROM NEW.applies_to OR
            OLD.is_active IS DISTINCT FROM NEW.is_active) THEN
            
            -- Increment version strictly
            NEW.version := OLD.version + 1;
            NEW.updated_at := now();
            
            -- Record the NEW version state in business_rule_versions
            INSERT INTO public.business_rule_versions (
                rule_id,
                rule_key,
                version,
                numeric_value,
                boolean_value,
                text_value,
                json_value,
                operator,
                severity,
                applies_to,
                metadata,
                effective_from,
                effective_until,
                change_reason,
                changed_by,
                created_at
            ) VALUES (
                NEW.id,
                NEW.rule_key,
                NEW.version,
                NEW.numeric_value,
                NEW.boolean_value,
                NEW.text_value,
                NEW.json_value,
                NEW.operator,
                NEW.severity,
                NEW.applies_to,
                NEW.metadata,
                COALESCE(NEW.effective_from, now()),
                NEW.effective_until,
                COALESCE(NEW.change_reason, 'Modified by Super Admin'),
                COALESCE(auth.uid(), NEW.updated_by),
                now()
            );
        END IF;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    DROP TRIGGER IF EXISTS trg_archive_business_rule_version ON public.business_rules;
    CREATE TRIGGER trg_archive_business_rule_version
        BEFORE UPDATE ON public.business_rules
        FOR EACH ROW
        EXECUTE FUNCTION public.archive_business_rule_version();

    -- 4. Immutability trigger on business_rule_versions
    CREATE OR REPLACE FUNCTION public.prevent_rule_version_deletion()
    RETURNS TRIGGER AS $$
    BEGIN
        RAISE EXCEPTION 'business_rule_versions is immutable. Historical version deletion is prohibited by regulatory audit policy.';
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_prevent_rule_version_deletion ON public.business_rule_versions;
    CREATE TRIGGER trg_prevent_rule_version_deletion
        BEFORE DELETE ON public.business_rule_versions
        FOR EACH ROW
        EXECUTE FUNCTION public.prevent_rule_version_deletion();

    -- 5. Reset to Default RPC
    CREATE OR REPLACE FUNCTION public.reset_business_rule_to_default(
      p_rule_id UUID,
      p_reason TEXT DEFAULT 'Reset to system default value'
    )
    RETURNS JSONB AS $$
    DECLARE
      v_rule public.business_rules%ROWTYPE;
      v_result JSONB;
    BEGIN
      -- Strict Super Admin authorization check
      IF NOT public.is_super_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Unauthorized: Only Super Admin can reset business rules to default.'
          USING ERRCODE = '42501';
      END IF;

      -- Fetch existing rule
      SELECT * INTO v_rule
      FROM public.business_rules
      WHERE id = p_rule_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Business rule not found for ID: %', p_rule_id;
      END IF;

      -- Update rule back to factory defaults
      UPDATE public.business_rules
      SET
        numeric_value = COALESCE(default_numeric_value, numeric_value),
        boolean_value = COALESCE(default_boolean_value, boolean_value),
        text_value = COALESCE(default_text_value, text_value),
        json_value = COALESCE(default_json_value, json_value),
        change_reason = p_reason,
        updated_by = auth.uid(),
        updated_at = NOW()
      WHERE id = p_rule_id
      RETURNING to_jsonb(public.business_rules.*) INTO v_result;

      -- Audit log entry
      INSERT INTO public.system_audit_logs (
        actor_id,
        action,
        entity_type,
        entity_id,
        old_values,
        new_values,
        created_at
      ) VALUES (
        auth.uid(),
        'BUSINESS_RULE_RESET_DEFAULT',
        'business_rule',
        p_rule_id::TEXT,
        to_jsonb(v_rule),
        v_result,
        NOW()
      );

      RETURN v_result;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    -- 6. RLS Setup
    ALTER TABLE public.business_rules ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.business_rule_versions ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Authenticated users can read business rules" ON public.business_rules;
    CREATE POLICY "Authenticated users can read business rules"
        ON public.business_rules FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS "Super Admin can update business rules" ON public.business_rules;
    CREATE POLICY "Super Admin can update business rules"
        ON public.business_rules FOR UPDATE TO authenticated
        USING (public.is_super_admin(auth.uid()))
        WITH CHECK (public.is_super_admin(auth.uid()));

    DROP POLICY IF EXISTS "Super Admin can insert business rules" ON public.business_rules;
    CREATE POLICY "Super Admin can insert business rules"
        ON public.business_rules FOR INSERT TO authenticated
        WITH CHECK (public.is_super_admin(auth.uid()));

    DROP POLICY IF EXISTS "Super Admin can delete business rules" ON public.business_rules;
    CREATE POLICY "Super Admin can delete business rules"
        ON public.business_rules FOR DELETE TO authenticated
        USING (public.is_super_admin(auth.uid()));

    DROP POLICY IF EXISTS "Authenticated users can read business rule versions" ON public.business_rule_versions;
    CREATE POLICY "Authenticated users can read business rule versions"
        ON public.business_rule_versions FOR SELECT TO authenticated USING (true);

    -- 7. Ensure test users exist:
    -- Worker: cccccccc-cccc-cccc-cccc-cccccccccccc
    INSERT INTO auth.users (id, email)
    VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'qa_worker@sada.tn')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.profiles (id, display_name, status)
    VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'QA Worker Specialist', 'active')
    ON CONFLICT (id) DO NOTHING;

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc') THEN
        INSERT INTO public.user_roles (id, user_id, role) VALUES (gen_random_uuid(), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'worker');
      END IF;
    END $$;

    -- Admin (non-super): dddddddd-dddd-dddd-dddd-dddddddddddd
    INSERT INTO auth.users (id, email)
    VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'qa_admin@sada.tn')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.profiles (id, display_name, status)
    VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'QA Standard Admin', 'active')
    ON CONFLICT (id) DO NOTHING;

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd') THEN
        INSERT INTO public.user_roles (id, user_id, role) VALUES (gen_random_uuid(), 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'admin');
      END IF;
    END $$;

    -- 8. Seed all 27 Canonical Business Rules
    INSERT INTO public.business_rules (
      rule_key, rule_name, description, category, value_type,
      numeric_value, default_numeric_value, text_value, default_text_value,
      unit, min_value, max_value, operator, severity, applies_to, is_active, version
    ) VALUES
      ('critical_runway_months', 'Critical Runway Warning Threshold', 'Cash runway duration in months below which a CRITICAL treasury alert is triggered.', 'cash_treasury', 'numeric', 3, 3, null, null, 'months', 0.5, 24, '<', 'critical', 'treasury', true, 1),
      ('warning_runway_months', 'Moderate Runway Warning Threshold', 'Cash runway duration in months below which a moderate treasury alert is triggered.', 'cash_treasury', 'numeric', 6, 6, null, null, 'months', 1, 36, '<', 'warning', 'treasury', true, 1),
      ('runway_default_months', 'Default Cash Runway Fallback', 'Fallback runway duration assumed when company operates at cash breakeven or zero monthly recurring burn.', 'cash_treasury', 'numeric', 12, 12, null, null, 'months', null, null, '==', 'info', 'treasury', true, 1),
      ('fixed_burn_warning_percent', 'Fixed Monthly Burn Warning Ratio', 'Fixed recurring subscriptions exceeding this percentage of monthly revenue trigger burn rate warnings.', 'fixed_burn', 'numeric', 40, 40, null, null, '%', null, null, '>', 'warning', 'treasury', true, 1),
      ('high_fixed_burn_revenue_percent', 'High Fixed Burn Revenue Ratio', 'Fixed monthly recurring expenses exceeding this percentage of monthly revenue trigger burn rate warnings.', 'fixed_burn', 'numeric', 40, 40, null, null, '%', null, null, '>', 'warning', 'treasury', true, 1),
      ('notification_deduplication_hours', 'Notification Deduplication Window', 'Rolling time window in hours to prevent emitting duplicate notifications for identical events and entities.', 'notifications_alerts', 'numeric', 24, 24, null, null, 'hours', 1, 168, '<=', 'info', 'notifications', true, 1),
      ('task_due_soon_days', 'Task Due Soon Notification Lead Days', 'Proximity threshold in days to trigger upcoming task deadline reminders.', 'notifications_alerts', 'numeric', 2, 2, null, null, 'days', 1, 14, '<=', 'warning', 'notifications', true, 1),
      ('max_salary_advance_percent', 'Maximum Salary Advance Percentage', 'Maximum percentage of specialist net monthly base salary eligible for mid-month salary advance requests.', 'operations', 'numeric', 50, 50, null, null, '%', 10, 100, '<=', 'info', 'operations', true, 1),
      ('standard_monthly_working_hours', 'Standard Monthly Working Hours', 'Standard labor hours per month per full-time specialist for hourly cost allocation calculation.', 'operations', 'numeric', 160, 160, null, null, 'hours', 40, 300, '==', 'info', 'operations', true, 1),
      ('low_profit_client_margin_percent', 'Low-Profit Client Margin Threshold', 'Clients with a net contribution margin below this percentage trigger low-margin alerts and are classified as LOW PROFIT in CRM and Executive decks.', 'profitability', 'numeric', 20, 20, null, null, '%', 0, 100, '<', 'warning', 'clients', true, 1),
      ('low_margin_client_threshold_percent', 'Low Margin Client Alert Threshold', 'Target contribution margin below which client account triggers low-profit warning alerts.', 'profitability', 'numeric', 20, 20, null, null, '%', 0, 100, '<', 'warning', 'clients', true, 1),
      ('client_medium_profit_margin_percent', 'Medium Profit Margin Threshold', 'Contribution margin floor for medium-tier client health categorization.', 'profitability', 'numeric', 25, 25, null, null, '%', 0, 100, '>=', 'info', 'clients', true, 1),
      ('client_high_profit_margin_percent', 'High Profit Margin Threshold', 'Contribution margin benchmark required for high-profit flagship client health status.', 'profitability', 'numeric', 50, 50, null, null, '%', 0, 100, '>=', 'info', 'clients', true, 1),
      ('client_medium_profit_amount_tnd', 'Medium Profit Amount Threshold', 'Absolute net contribution profit amount in TND qualifying client for moderate profit tier.', 'profitability', 'numeric', 400, 400, null, null, 'TND', 0, 10000, '>=', 'info', 'clients', true, 1),
      ('client_high_profit_amount_tnd', 'High Profit Amount Threshold', 'Absolute net contribution profit amount in TND qualifying client for flagship tier.', 'profitability', 'numeric', 1000, 1000, null, null, 'TND', 0, 100000, '>=', 'info', 'clients', true, 1),
      ('historical_profit_zero_behavior', 'Historical Profit Zero Delta Behavior', 'Defines KPI behavior when previous financial period net profit was exactly zero.', 'profitability', 'text', null, null, 'null', 'null', 'mode', null, null, '==', 'info', 'kpi', true, 1),
      ('initial_commission_rate', 'Initial Deal Commission Rate', 'Default commission percentage earned by salesperson during the initial contract lifecycle.', 'sales_commissions', 'numeric', 15, 15, null, null, '%', 0, 100, '==', 'info', 'sales_commissions', true, 1),
      ('initial_commission_duration_months', 'Initial Commission Duration', 'Duration in months that the initial acquisition commission rate applies before transitioning to renewal rate.', 'sales_commissions', 'numeric', 6, 6, null, null, 'months', 1, 36, '==', 'info', 'sales_commissions', true, 1),
      ('renewal_commission_rate', 'Renewal Commission Rate', 'Commission percentage earned by salesperson for contract renewals beyond initial duration.', 'sales_commissions', 'numeric', 5, 5, null, null, '%', 0, 100, '==', 'info', 'sales_commissions', true, 1),
      ('renewal_commission_duration_months', 'Renewal Commission Duration', 'Duration in months that renewal commission rate applies (or ongoing).', 'sales_commissions', 'numeric', 12, 12, null, null, 'months', 1, 60, '==', 'info', 'sales_commissions', true, 1),
      ('upsell_commission_rate', 'Upsell Commission Rate', 'Commission percentage earned on package upgrades and service expansion.', 'sales_commissions', 'numeric', 5, 5, null, null, '%', 0, 100, '==', 'info', 'sales_commissions', true, 1),
      ('high_commission_amount', 'High Commission Impact Alert', 'Monthly salesperson commission payouts exceeding this TND amount trigger executive attention and Smart Insight warnings.', 'sales_commissions', 'numeric', 200, 200, null, null, 'TND', null, null, '>', 'info', 'smart_insights', true, 1),
      ('high_commission_insight_threshold_tnd', 'High Commission Impact Threshold', 'Individual salesperson single-deal commission amount triggering executive smart insight review.', 'smart_insights', 'numeric', 200, 200, null, null, 'TND', null, null, '>=', 'warning', 'smart_insights', true, 1),
      ('sponsoring_purchase_rate', 'Benchmark USD Purchase Rate', 'Estimated exchange rate (TND per 1 USD) incurred when funding international ad platforms.', 'sponsoring_advertising', 'numeric', 3.44, 3.44, null, null, 'TND/USD', null, null, '==', 'info', 'sponsoring_advertising', true, 1),
      ('sponsoring_client_rate', 'Client Sponsoring Billing Rate', 'Contractual billing exchange rate charged to agency clients funding media campaigns.', 'sponsoring_advertising', 'numeric', 4.00, 4.00, null, null, 'TND/USD', null, null, '>', 'info', 'sponsoring_advertising', true, 1),
      ('sponsoring_min_margin_percent', 'Minimum Sponsoring Arbitrage Margin', 'Minimum allowable arbitrage gross margin percentage on client media spend.', 'sponsoring_advertising', 'numeric', 15, 15, null, null, '%', null, null, '>=', 'warning', 'sponsoring_advertising', true, 1),
      ('minimum_net_margin_for_sponsoring_efficiency', 'Minimum Sponsoring Arbitrage Net Margin', 'Target agency arbitrage net margin from paid media sponsoring. Margins below this trigger efficiency warnings.', 'sponsoring_advertising', 'numeric', 15, 15, null, null, '%', null, null, '>', 'warning', 'smart_insights', true, 1)
    ON CONFLICT (rule_key) DO UPDATE SET
      rule_name = EXCLUDED.rule_name,
      description = EXCLUDED.description,
      category = EXCLUDED.category,
      value_type = EXCLUDED.value_type,
      numeric_value = COALESCE(business_rules.numeric_value, EXCLUDED.numeric_value),
      default_numeric_value = EXCLUDED.default_numeric_value,
      text_value = COALESCE(business_rules.text_value, EXCLUDED.text_value),
      default_text_value = EXCLUDED.default_text_value,
      unit = EXCLUDED.unit,
      min_value = EXCLUDED.min_value,
      max_value = EXCLUDED.max_value,
      operator = EXCLUDED.operator,
      severity = EXCLUDED.severity,
      applies_to = EXCLUDED.applies_to,
      is_active = true;

    -- 9. Backfill baseline version in business_rule_versions
    INSERT INTO public.business_rule_versions (
      rule_id, rule_key, version, numeric_value, text_value, operator, severity, applies_to, effective_from, change_reason, changed_by, created_at
    )
    SELECT
      r.id, r.rule_key, r.version, r.numeric_value, r.text_value, r.operator, r.severity, r.applies_to, r.effective_from, 'Initial canonical factory default baseline', r.updated_by, r.created_at
    FROM public.business_rules r
    WHERE NOT EXISTS (
      SELECT 1 FROM public.business_rule_versions v WHERE v.rule_id = r.id AND v.version = r.version
    );
  `;

  runSql(sql);
  console.log("✓ Schema alignment completed successfully in sada_local_test!");

  const finalCount = runSql("SELECT count(*) FROM public.business_rules;");
  console.log(`Final business_rules count in sada_local_test: ${finalCount} / 27`);

  const finalVersions = runSql("SELECT count(*) FROM public.business_rule_versions;");
  console.log(`Final business_rule_versions count in sada_local_test: ${finalVersions}`);
}

setupLocalSchema().catch(console.error);
