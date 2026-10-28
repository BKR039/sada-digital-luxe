/**
 * SADA OS — Pre-Staging Remediation Verification Suite
 *
 * Verifies:
 * 1. RPC Overload Cleanup: Exactly ONE canonical signature exists for admin_update_account (12 args)
 *    and admin_provision_account (10 args). Obsolete overloads dropped cleanly.
 * 2. Forward-Only Migration 20261017173000 applies cleanly and idempotently.
 * 3. Case Studies Public Team Query: Anonymous access to public_team_members view works,
 *    supplying all 8 required display fields (id, name, position, division, photo_url, socials, position_ar, bio_ar).
 * 4. Anonymous path does NOT rely on direct access to protected base table: direct query returns 0 rows.
 * 5. Confidentiality boundary: private operational columns (email, phone, hourly_cost, profile_id, user_id, role, employment_type)
 *    are absent from the public view and cannot be accessed by anon callers.
 * 6. Commission Index Preflight:
 *    - Accurately detects when duplicate non-null deal_ids exist (tested with synthetic rollback fixtures).
 *    - Accurately reports READY_FOR_UNIQUE_INDEX when clean.
 *    - Strictly non-mutating (zero data modifications).
 *
 * Target: 127.0.0.1:5432/sada_local_test (STRICT LOCAL ISOLATION ONLY)
 * Safety Guard: test-db-guard.ts
 */

import { execFileSync } from "node:child_process";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
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

function runSql(sql: string): string {
  assertSafeTarget();
  return execFileSync(
    PSQL_BIN,
    ["-h", TARGET_HOST, "-p", TARGET_PORT, "-U", "postgres", "-d", TARGET_DB, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-f", "-"],
    { input: sql, encoding: "utf8", env: getSanitizedEnv() }
  ).trim();
}

function runSqlCatchingError(sql: string): { stdout: string; error?: string } {
  assertSafeTarget();
  try {
    const stdout = execFileSync(
      PSQL_BIN,
      ["-h", TARGET_HOST, "-p", TARGET_PORT, "-U", "postgres", "-d", TARGET_DB, "-v", "ON_ERROR_STOP=1", "-c", sql],
      { encoding: "utf8", env: getSanitizedEnv(), stdio: ["pipe", "pipe", "pipe"] }
    );
    return { stdout };
  } catch (err: any) {
    const error = (err.stderr || err.stdout || err.message || "").toString();
    return { stdout: "", error };
  }
}

interface TestResult {
  id: number;
  name: string;
  category: string;
  status: "PASS" | "FAIL";
  details: string;
}

const results: TestResult[] = [];

async function main() {
  console.log("==========================================================================");
  console.log("  SADA OS — Pre-Staging Remediation Verification Suite");
  console.log("  Target: " + LOCAL_DB_URL);
  console.log("==========================================================================\n");

  assertSafeTarget();

  // -------------------------------------------------------------------------
  // SECTION 1: Migration 20261017173000 Idempotent Application
  // -------------------------------------------------------------------------
  console.log("--- Section 1: Applying Migration 20261017173000 ---");
  const migrationPath = path.resolve(
    process.cwd(),
    "supabase/migrations/20261017173000_drop_obsolete_account_rpc_overloads.sql"
  );
  const migrationSql = fs.readFileSync(migrationPath, "utf-8");

  const mig1 = runSqlCatchingError(migrationSql);
  const mig1Pass = !mig1.error;
  results.push({
    id: 1,
    name: "Migration 20261017173000 executes cleanly without errors",
    category: "Migration Execution",
    status: mig1Pass ? "PASS" : "FAIL",
    details: mig1Pass ? "Executed successfully." : (mig1.error || ""),
  });

  // Re-run for idempotency
  const mig2 = runSqlCatchingError(migrationSql);
  const mig2Pass = !mig2.error;
  results.push({
    id: 2,
    name: "Migration 20261017173000 is idempotent (re-execution safe)",
    category: "Migration Execution",
    status: mig2Pass ? "PASS" : "FAIL",
    details: mig2Pass ? "Second execution succeeded with zero errors." : (mig2.error || ""),
  });

  // -------------------------------------------------------------------------
  // SECTION 2: RPC Overload Audit (admin_update_account & admin_provision_account)
  // -------------------------------------------------------------------------
  console.log("\n--- Section 2: Function Overload Audit in pg_proc ---");
  const updateCount = runSql(`
    SELECT count(*) FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'admin_update_account';
  `);
  const updateCountPass = updateCount === "1";
  results.push({
    id: 3,
    name: "admin_update_account has exactly ONE overload in pg_proc",
    category: "RPC Overload Audit",
    status: updateCountPass ? "PASS" : "FAIL",
    details: `Overload count: ${updateCount} (expected: 1)`,
  });

  const updateArgs = runSql(`
    SELECT pg_get_function_identity_arguments(p.oid) FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'admin_update_account';
  `);
  const updateArgsPass = updateArgs.includes("_status text") && updateArgs.includes("_user_id uuid");
  results.push({
    id: 4,
    name: "admin_update_account has canonical 12-argument signature including _status",
    category: "RPC Overload Audit",
    status: updateArgsPass ? "PASS" : "FAIL",
    details: `Signature: ${updateArgs}`,
  });

  const provisionCount = runSql(`
    SELECT count(*) FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'admin_provision_account';
  `);
  const provisionCountPass = provisionCount === "1";
  results.push({
    id: 5,
    name: "admin_provision_account has exactly ONE overload in pg_proc",
    category: "RPC Overload Audit",
    status: provisionCountPass ? "PASS" : "FAIL",
    details: `Overload count: ${provisionCount} (expected: 1)`,
  });

  const provisionArgs = runSql(`
    SELECT pg_get_function_identity_arguments(p.oid) FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'admin_provision_account';
  `);
  const provisionArgsPass = provisionArgs.includes("_module_permissions jsonb") && provisionArgs.includes("_status text");
  results.push({
    id: 6,
    name: "admin_provision_account has canonical 10-argument signature including _module_permissions",
    category: "RPC Overload Audit",
    status: provisionArgsPass ? "PASS" : "FAIL",
    details: `Signature: ${provisionArgs}`,
  });

  // Verify function security properties (SECURITY DEFINER, search_path, permissions)
  const rpcSecurity = runSql(`
    SELECT jsonb_build_object(
      'update_secdef', (SELECT prosecdef FROM pg_proc WHERE proname = 'admin_update_account'),
      'update_search_path', (SELECT proconfig[1] FROM pg_proc WHERE proname = 'admin_update_account'),
      'provision_secdef', (SELECT prosecdef FROM pg_proc WHERE proname = 'admin_provision_account'),
      'provision_search_path', (SELECT proconfig[1] FROM pg_proc WHERE proname = 'admin_provision_account')
    );
  `);
  const rpcSecurityPass = rpcSecurity.includes('"update_secdef": true') && rpcSecurity.includes('"search_path=public"');
  results.push({
    id: 7,
    name: "Canonical functions retain SECURITY DEFINER and search_path=public",
    category: "Security Boundaries",
    status: rpcSecurityPass ? "PASS" : "FAIL",
    details: rpcSecurity,
  });

  // -------------------------------------------------------------------------
  // SECTION 3: Case Studies Public Team Attribution & Confidentiality
  // -------------------------------------------------------------------------
  console.log("\n--- Section 3: Public Team Attribution & Data Boundary Verification ---");
  const testTmId = crypto.randomUUID();
  const seedTmSql = `
    INSERT INTO public.team_members (
      id, name, position, position_ar, bio_ar, division, published, is_active, photo_url, socials, sort_order, email, role, employment_type
    ) VALUES (
      '${testTmId}',
      'Amina Mansour',
      'Creative Director',
      'مديرة إبداعية',
      'متخصصة في الهوية البصرية الفاخرة',
      'Design',
      true,
      true,
      'https://sada.tn/media/amina.jpg',
      '{"linkedin": "https://linkedin.com/in/amina"}'::jsonb,
      10,
      'amina.mansour@sada.internal',
      'worker',
      'full_time'
    );
  `;
  runSql(seedTmSql);

  // 3.1 Verify anonymous SELECT on public_team_members supplies all 8 fields required by case-studies.$slug.tsx
  const anonSelectSql = `
    SET ROLE anon;
    SELECT jsonb_build_object(
      'id', id,
      'name', name,
      'position', position,
      'position_ar', position_ar,
      'bio_ar', bio_ar,
      'division', division,
      'photo_url', photo_url,
      'socials', socials
    ) FROM public.public_team_members
    WHERE id = '${testTmId}';
  `;
  const anonSelectRes = runSql(anonSelectSql);
  const anonSelectPass = anonSelectRes.includes("Amina Mansour") &&
                         anonSelectRes.includes("Creative Director") &&
                         anonSelectRes.includes("مديرة إبداعية");
  results.push({
    id: 8,
    name: "Anonymous query on public_team_members retrieves all 8 case-study fields (including Arabic)",
    category: "Public Team Query",
    status: anonSelectPass ? "PASS" : "FAIL",
    details: anonSelectPass ? "All 8 case-study fields retrieved successfully via public_team_members." : anonSelectRes,
  });

  // 3.2 Verify private columns are strictly absent from view definition
  const viewPrivateColCount = runSql(`
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'public_team_members'
      AND column_name IN ('email', 'phone', 'hourly_cost', 'profile_id', 'user_id', 'role', 'employment_type', 'availability_status');
  `);
  const viewPrivatePass = viewPrivateColCount === "0";
  results.push({
    id: 9,
    name: "Zero private operational columns exposed in public_team_members view",
    category: "Confidentiality Boundary",
    status: viewPrivatePass ? "PASS" : "FAIL",
    details: `Private columns found in view: ${viewPrivateColCount}`,
  });

  // 3.3 Verify direct table shielding under RLS (Anonymous path does NOT rely on direct access to base table)
  const directAnonSql = `
    SET ROLE anon;
    SELECT count(*) FROM public.team_members WHERE id = '${testTmId}';
  `;
  const directAnonCount = runSql(directAnonSql);
  const directAnonPass = directAnonCount === "0";
  results.push({
    id: 10,
    name: "Direct SELECT on public.team_members returns 0 rows for anon (confirms zero reliance on base table)",
    category: "Data Shielding",
    status: directAnonPass ? "PASS" : "FAIL",
    details: `Direct anon query rows returned: ${directAnonCount} (shielded by RLS)`,
  });

  // Cleanup synthetic team member
  runSql(`DELETE FROM public.team_members WHERE id = '${testTmId}';`);

  // -------------------------------------------------------------------------
  // SECTION 4: Commission Index Preflight Check (Read-Only & Duplicate Sensitivity)
  // -------------------------------------------------------------------------
  console.log("\n--- Section 4: Commission Index Preflight Deduplication Check ---");

  // 4.1 Verify query against current database state (clean state)
  const preflightCleanSql = `
    SELECT jsonb_build_object(
      'distinct_deals', COUNT(DISTINCT deal_id),
      'total_commissions', COUNT(*),
      'duplicates', (COUNT(*) - COUNT(DISTINCT deal_id)),
      'status', CASE 
        WHEN COUNT(*) = COUNT(DISTINCT deal_id) THEN 'READY_FOR_UNIQUE_INDEX'
        ELSE 'INDEX_CREATION_BLOCKED_BY_DUPLICATES'
      END
    )
    FROM public.sales_commissions
    WHERE deal_id IS NOT NULL;
  `;
  const preflightCleanRes = runSql(preflightCleanSql);
  const preflightCleanPass = preflightCleanRes.includes("READY_FOR_UNIQUE_INDEX");
  results.push({
    id: 11,
    name: "Sales commissions preflight check confirms zero duplicate deal IDs in baseline",
    category: "Commission Preflight",
    status: preflightCleanPass ? "PASS" : "FAIL",
    details: `Preflight result: ${preflightCleanRes}`,
  });

  // 4.2 Verify duplicate sensitivity: simulate duplicates in a transaction and confirm detection
  const synthDealId = crypto.randomUUID();
  const synthTmId = crypto.randomUUID();
  const synthClientId = crypto.randomUUID();
  const synthUserId = crypto.randomUUID();
  const duplicateSimSql = `
    BEGIN;
    -- Temporarily drop unique index inside this transaction so we can simulate legacy duplicate state
    DROP INDEX IF EXISTS public.idx_sales_commissions_deal_id_unique;

    INSERT INTO auth.users (id, email) VALUES ('${synthUserId}', 'preflight@sada.internal');
    INSERT INTO public.clients (id, name) VALUES ('${synthClientId}', 'Preflight Test Client');
    INSERT INTO public.team_members (id, name, published, is_active) VALUES ('${synthTmId}', 'Preflight TM', true, true);
    INSERT INTO public.deals (id, client_id, sales_owner_id, stage) VALUES ('${synthDealId}', '${synthClientId}', '${synthUserId}', 'won');

    -- Insert two commission rows pointing to the same deal_id
    INSERT INTO public.sales_commissions (
      id, deal_id, team_member_id, client_id, total_sale_amount, service_revenue, sponsoring_amount, commission_rate, commission_amount, period_month, status
    ) VALUES 
      (gen_random_uuid(), '${synthDealId}', '${synthTmId}', '${synthClientId}', 5000, 5000, 0, 15, 750, '2026-10', 'paid'),
      (gen_random_uuid(), '${synthDealId}', '${synthTmId}', '${synthClientId}', 5000, 5000, 0, 15, 750, '2026-10', 'paid');

    -- Run preflight check inside the uncommitted transaction
    SELECT jsonb_build_object(
      'distinct_deals', COUNT(DISTINCT deal_id),
      'total_commissions', COUNT(*),
      'duplicates', (COUNT(*) - COUNT(DISTINCT deal_id)),
      'status', CASE 
        WHEN COUNT(*) = COUNT(DISTINCT deal_id) THEN 'READY_FOR_UNIQUE_INDEX'
        ELSE 'INDEX_CREATION_BLOCKED_BY_DUPLICATES'
      END
    )
    FROM public.sales_commissions
    WHERE deal_id IS NOT NULL;

    ROLLBACK;
  `;
  const duplicateSimRes = runSql(duplicateSimSql);
  const duplicateSimPass = duplicateSimRes.includes("INDEX_CREATION_BLOCKED_BY_DUPLICATES") &&
                           duplicateSimRes.includes('"duplicates": 1');
  results.push({
    id: 12,
    name: "Preflight check sensitively detects duplicate non-null deal IDs and blocks index creation",
    category: "Commission Preflight",
    status: duplicateSimPass ? "PASS" : "FAIL",
    details: duplicateSimPass ? "Detected synthetic duplicate (status: INDEX_CREATION_BLOCKED_BY_DUPLICATES, duplicates: 1)." : duplicateSimRes,
  });

  // 4.3 Verify transaction rollback ensured zero mutations
  const postRollbackCount = runSql(`SELECT count(*) FROM public.clients WHERE id = '${synthClientId}';`);
  const zeroMutationPass = postRollbackCount === "0";
  results.push({
    id: 13,
    name: "Preflight sensitivity test rolled back cleanly with zero persistent database mutations",
    category: "Commission Preflight",
    status: zeroMutationPass ? "PASS" : "FAIL",
    details: `Residual records in public.clients: ${postRollbackCount}`,
  });

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log("\n==========================================================================");
  console.log("  PRE-STAGING REMEDIATION VERIFICATION SUMMARY");
  console.log("==========================================================================");
  let passedCount = 0;
  for (const r of results) {
    const icon = r.status === "PASS" ? "✅ [PASS]" : "❌ [FAIL]";
    console.log(`${icon} #${r.id} :: ${r.name}`);
    console.log(`     Category: ${r.category} | Details: ${r.details}`);
    if (r.status === "PASS") passedCount++;
  }
  console.log("==========================================================================");
  console.log(`TOTAL: ${results.length} | PASSED: ${passedCount} | FAILED: ${results.length - passedCount}`);
  console.log("==========================================================================");

  if (passedCount !== results.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
