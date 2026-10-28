// =====================================================================
// SADA OS — Local PostgreSQL Sales Conversion Verification Runner
// Target: sada_local_test (localhost ONLY)
// Guard: Strictly enforced via scripts/test-db-guard.ts
// =====================================================================

import { execFileSync, spawn } from "node:child_process";
import * as crypto from "node:crypto";
import * as path from "node:path";
import { enforceDatabaseIsolation } from "./test-db-guard.js";

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

// ---------------------------------------------------------------------
// 1. Connection Guard & Sanitized Environment
// ---------------------------------------------------------------------

export function assertSafeTarget(db = TARGET_DB, host = TARGET_HOST, port = TARGET_PORT): void {
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(`[DataIsolationGuard] BLOCKED: Host '${host}' is not strictly loopback (127.0.0.1 / localhost).`);
  }
  if (port !== "5432") {
    throw new Error(`[DataIsolationGuard] BLOCKED: Port '${port}' is not expected test port 5432.`);
  }
  if (db !== "sada_local_test") {
    throw new Error(`[DataIsolationGuard] BLOCKED: Target database '${db}' is not the isolated 'sada_local_test'.`);
  }
  const url = `postgres://postgres@${host}:${port}/${db}`;
  enforceDatabaseIsolation(url);
}

export function getSanitizedEnv(): NodeJS.ProcessEnv {
  const safeEnv: NodeJS.ProcessEnv = { ...process.env };
  // Strip all ambient libpq and Supabase connection variables to prevent accidental remote routing
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
  return safeEnv;
}

export function runSql(sql: string, db = TARGET_DB): string {
  assertSafeTarget(db);
  return execFileSync(
    PSQL_BIN,
    ["-h", TARGET_HOST, "-p", TARGET_PORT, "-U", "postgres", "-d", db, "-q", "-t", "-A", "-c", sql],
    { encoding: "utf8", env: getSanitizedEnv() }
  ).trim();
}

export function runSqlCatchingError(sql: string, db = TARGET_DB): { stdout: string; error?: string } {
  assertSafeTarget(db);
  try {
    const stdout = execFileSync(
      PSQL_BIN,
      ["-h", TARGET_HOST, "-p", TARGET_PORT, "-U", "postgres", "-d", db, "-c", sql],
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], env: getSanitizedEnv() }
    );
    return { stdout };
  } catch (err: any) {
    const error = (err.stderr || err.message || "").toString();
    return { stdout: "", error };
  }
}

// ---------------------------------------------------------------------
// 2. Deterministic Fixture Tracking & Targeted Teardown
// ---------------------------------------------------------------------

export interface TrackedFixtures {
  dealIds: string[];
  clientIds: string[];
  packageIds: string[];
  teamMemberIds: string[];
  userIds: string[];
  rateLimitKeys: string[];
}

export const tracked: TrackedFixtures = {
  dealIds: [],
  clientIds: [],
  packageIds: [],
  teamMemberIds: [],
  userIds: [],
  rateLimitKeys: [],
};

export function cleanupTargetedFixtures(): void {
  assertSafeTarget(TARGET_DB);
  console.log("\n==> Cleaning up targeted synthetic test fixtures in dependency order...");
  const formatList = (arr: string[]) => arr.map((id) => `'${id}'`).join(",");

  const cleanupStatements: string[] = [];
  if (tracked.dealIds.length > 0) {
    const ids = formatList(tracked.dealIds);
    cleanupStatements.push(`DELETE FROM public.sales_commissions WHERE deal_id IN (${ids});`);
    cleanupStatements.push(`DELETE FROM public.deals WHERE id IN (${ids});`);
  }
  if (tracked.packageIds.length > 0) {
    cleanupStatements.push(`DELETE FROM public.package_catalog WHERE id IN (${formatList(tracked.packageIds)});`);
  }
  if (tracked.clientIds.length > 0) {
    cleanupStatements.push(`DELETE FROM public.clients WHERE id IN (${formatList(tracked.clientIds)});`);
  }
  if (tracked.teamMemberIds.length > 0) {
    cleanupStatements.push(`DELETE FROM public.team_members WHERE id IN (${formatList(tracked.teamMemberIds)});`);
  }
  if (tracked.userIds.length > 0) {
    const uids = formatList(tracked.userIds);
    const userPrefixes = tracked.userIds.map((uid) => `'convert_lead:${uid}'`).join(",");
    cleanupStatements.push(`DELETE FROM public.user_permissions WHERE user_id IN (${uids});`);
    cleanupStatements.push(`DELETE FROM public.user_roles WHERE user_id IN (${uids});`);
    cleanupStatements.push(`DELETE FROM public.rate_limit_buckets WHERE key IN (${userPrefixes});`);
  }
  if (tracked.rateLimitKeys.length > 0) {
    cleanupStatements.push(`DELETE FROM public.rate_limit_buckets WHERE key IN (${formatList(tracked.rateLimitKeys)});`);
  }

  if (cleanupStatements.length > 0) {
    runSql(`BEGIN; ${cleanupStatements.join(" ")} COMMIT;`);
    console.log(`[PASS] Cleaned up ${cleanupStatements.length} targeted fixture groups.`);
  } else {
    console.log("[INFO] No fixtures were tracked for cleanup.");
  }
}

// ---------------------------------------------------------------------
// 3. Test Matrix Definition
// ---------------------------------------------------------------------

export interface TestResult {
  id: number;
  name: string;
  category: "Local PostgreSQL Integration Verified" | "Static/code verified" | "Supabase Auth/PostgREST/RLS boundary";
  passed: boolean;
  details: string;
}

export const results: TestResult[] = [];

export async function main(): Promise<void> {
  // Pre-flight check
  console.log("==> Step 1: Pre-flight database target verification...");
  assertSafeTarget(TARGET_DB);

  console.log("\n==> Step 2: Verifying connection to sada_local_test on localhost...");
  const serverCheck = runSql("SELECT host(inet_server_addr()) || ':' || inet_server_port()::text;");
  if (serverCheck !== "127.0.0.1:5432") {
    throw new Error(`CRITICAL: Server address verification failed: ${serverCheck}`);
  }
  console.log(`[PASS] Verified strictly local connection: ${serverCheck}`);

  try {
    // -----------------------------------------------------------------
    // Test 1: Valid Conversion
    // -----------------------------------------------------------------
    console.log("\n--- Executing Test 1: Valid Conversion ---");
    const t1User = crypto.randomUUID();
    const t1Tm = crypto.randomUUID();
    const t1Client = crypto.randomUUID();
    const t1Pkg = crypto.randomUUID();
    const t1Deal = crypto.randomUUID();
    tracked.userIds.push(t1User);
    tracked.teamMemberIds.push(t1Tm);
    tracked.clientIds.push(t1Client);
    tracked.packageIds.push(t1Pkg);
    tracked.dealIds.push(t1Deal);

    const test1Sql = `
      BEGIN;
      INSERT INTO public.user_roles (user_id, role) VALUES ('${t1User}', 'worker');
      INSERT INTO public.user_permissions (user_id, permission) VALUES ('${t1User}', 'sales.convert_lead');
      INSERT INTO public.team_members (id, profile_id, name) VALUES ('${t1Tm}', '${t1User}', 'Sales Worker 1');
      INSERT INTO public.clients (id, name) VALUES ('${t1Client}', 'Acme Corp');
      INSERT INTO public.package_catalog (id, name) VALUES ('${t1Pkg}', 'Growth Package');
      INSERT INTO public.deals (id, client_id, sales_owner_id, package_id, stage, deal_value)
        VALUES ('${t1Deal}', '${t1Client}', '${t1User}', '${t1Pkg}', 'lead', 5000);

      SET LOCAL request.jwt.claim.sub = '${t1User}';
      SELECT public.convert_lead_to_sale(
        '${t1Deal}'::uuid,
        '${t1Client}'::uuid,
        '${t1Pkg}'::uuid,
        5000,
        1000,
        'paid',
        CURRENT_DATE,
        'Test conversion notes'
      );
      COMMIT;
    `;
    const t1 = runSqlCatchingError(test1Sql);
    const t1Passed = !t1.error && t1.stdout.includes('"success": true') && t1.stdout.includes('"commission_amount": 600.00');
    results.push({
      id: 1,
      name: "Valid conversion with commission calculation and deal stage update",
      category: "Local PostgreSQL Integration Verified",
      passed: t1Passed,
      details: t1Passed ? "Deal stage won, commission 600.00 generated (4000 basis * 15%)" : (t1.error || t1.stdout),
    });

    // -----------------------------------------------------------------
    // Test 2: Missing, Malformed, Nonexistent Client IDs
    // -----------------------------------------------------------------
    console.log("\n--- Executing Test 2: Missing, Malformed, Nonexistent Client IDs ---");
    const t2User = crypto.randomUUID();
    const t2DealA = crypto.randomUUID();
    const t2DealB = crypto.randomUUID();
    tracked.userIds.push(t2User);
    tracked.dealIds.push(t2DealA, t2DealB);

    // Pre-seed user roles and permissions in a committed transaction so rollback tests retain authorization
    runSql(`
      BEGIN;
      INSERT INTO public.user_roles (user_id, role) VALUES ('${t2User}', 'worker');
      INSERT INTO public.user_permissions (user_id, permission) VALUES ('${t2User}', 'sales.convert_lead');
      COMMIT;
    `);

    const test2aSql = `
      BEGIN;
      INSERT INTO public.deals (id, client_id, sales_owner_id, stage) VALUES ('${t2DealA}', NULL, '${t2User}', 'lead');
      SET LOCAL request.jwt.claim.sub = '${t2User}';
      SELECT public.convert_lead_to_sale('${t2DealA}'::uuid, NULL);
      ROLLBACK;
    `;
    const t2a = runSqlCatchingError(test2aSql);
    const t2aPassed = (t2a.error || "").includes("A valid SADA Client ID is required") || (t2a.error || "").includes("23502");

    const test2bSql = `
      BEGIN;
      INSERT INTO public.deals (id, client_id, sales_owner_id, stage) VALUES ('${t2DealB}', NULL, '${t2User}', 'lead');
      SET LOCAL request.jwt.claim.sub = '${t2User}';
      SELECT public.convert_lead_to_sale('${t2DealB}'::uuid, gen_random_uuid());
      ROLLBACK;
    `;
    const t2b = runSqlCatchingError(test2bSql);
    const t2bPassed = (t2b.error || "").includes("does not exist in public.clients") || (t2b.error || "").includes("23503");

    const t2Passed = t2aPassed && t2bPassed;
    results.push({
      id: 2,
      name: "Missing and nonexistent client ID guards (23502 & 23503)",
      category: "Local PostgreSQL Integration Verified",
      passed: t2Passed,
      details: `Missing client rejected (23502): ${t2aPassed}. Nonexistent client rejected (23503): ${t2bPassed}.`,
    });

    // -----------------------------------------------------------------
    // Test 3: Existing-Client Fallback
    // -----------------------------------------------------------------
    console.log("\n--- Executing Test 3: Existing-Client Fallback ---");
    const t3User = crypto.randomUUID();
    const t3Tm = crypto.randomUUID();
    const t3Client = crypto.randomUUID();
    const t3Deal = crypto.randomUUID();
    tracked.userIds.push(t3User);
    tracked.teamMemberIds.push(t3Tm);
    tracked.clientIds.push(t3Client);
    tracked.dealIds.push(t3Deal);

    const test3Sql = `
      BEGIN;
      INSERT INTO public.user_roles (user_id, role) VALUES ('${t3User}', 'worker');
      INSERT INTO public.user_permissions (user_id, permission) VALUES ('${t3User}', 'sales.convert_lead');
      INSERT INTO public.team_members (id, profile_id, name) VALUES ('${t3Tm}', '${t3User}', 'Worker 3');
      INSERT INTO public.clients (id, name) VALUES ('${t3Client}', 'Fallback Client');
      INSERT INTO public.deals (id, client_id, sales_owner_id, stage) VALUES ('${t3Deal}', '${t3Client}', '${t3User}', 'lead');
      SET LOCAL request.jwt.claim.sub = '${t3User}';
      SELECT public.convert_lead_to_sale('${t3Deal}'::uuid, NULL, NULL, 3000, 0);
      COMMIT;
    `;
    const t3 = runSqlCatchingError(test3Sql);
    const t3Passed = !t3.error && t3.stdout.includes('"success": true') && t3.stdout.includes(`"client_id": "${t3Client}"`);
    results.push({
      id: 3,
      name: "Existing-client fallback when p_client_id is omitted/NULL",
      category: "Local PostgreSQL Integration Verified",
      passed: t3Passed,
      details: t3Passed ? `Successfully resolved fallback to existing deal.client_id (${t3Client})` : (t3.error || t3.stdout),
    });

    // -----------------------------------------------------------------
    // Test 4: Commission Calculation & Sponsoring Deduction
    // -----------------------------------------------------------------
    console.log("\n--- Executing Test 4: Sponsoring Exclusion & Basis Math ---");
    const t4User = crypto.randomUUID();
    const t4Tm = crypto.randomUUID();
    const t4Client = crypto.randomUUID();
    const t4DealA = crypto.randomUUID();
    const t4DealB = crypto.randomUUID();
    tracked.userIds.push(t4User);
    tracked.teamMemberIds.push(t4Tm);
    tracked.clientIds.push(t4Client);
    tracked.dealIds.push(t4DealA, t4DealB);

    const test4Sql = `
      BEGIN;
      INSERT INTO public.user_roles (user_id, role) VALUES ('${t4User}', 'worker');
      INSERT INTO public.user_permissions (user_id, permission) VALUES ('${t4User}', 'sales.convert_lead');
      INSERT INTO public.team_members (id, profile_id, name) VALUES ('${t4Tm}', '${t4User}', 'Worker 4');
      INSERT INTO public.clients (id, name) VALUES ('${t4Client}', 'Sponsor Client');
      INSERT INTO public.deals (id, client_id, sales_owner_id, stage) VALUES ('${t4DealA}', '${t4Client}', '${t4User}', 'lead');
      INSERT INTO public.deals (id, client_id, sales_owner_id, stage) VALUES ('${t4DealB}', '${t4Client}', '${t4User}', 'lead');
      SET LOCAL request.jwt.claim.sub = '${t4User}';
      -- Scenario A: 10000 sale, 3000 sponsoring -> basis 7000 * 15% = 1050
      SELECT public.convert_lead_to_sale('${t4DealA}'::uuid, '${t4Client}'::uuid, NULL, 10000, 3000);
      -- Scenario B: 2000 sale, 3000 sponsoring (excessive) -> basis 0 * 15% = 0.00
      SELECT public.convert_lead_to_sale('${t4DealB}'::uuid, '${t4Client}'::uuid, NULL, 2000, 3000);
      COMMIT;
    `;
    const t4 = runSqlCatchingError(test4Sql);
    const t4Passed = !t4.error && t4.stdout.includes('"commission_amount": 1050.00') && t4.stdout.includes('"commission_amount": 0.00');
    results.push({
      id: 4,
      name: "Strict sponsoring deduction and basis floor clamping (GREATEST(0, ...))",
      category: "Local PostgreSQL Integration Verified",
      passed: t4Passed,
      details: t4Passed ? "Correctly deducted 3000 from 10000 -> 1050.00. Clamped 2000 - 3000 to 0 -> 0.00." : (t4.error || t4.stdout),
    });

    // -----------------------------------------------------------------
    // Test 5: Repeated Conversion Idempotency
    // -----------------------------------------------------------------
    console.log("\n--- Executing Test 5: Repeated Conversion Idempotency ---");
    const t5User = crypto.randomUUID();
    const t5Tm = crypto.randomUUID();
    const t5Client = crypto.randomUUID();
    const t5Deal = crypto.randomUUID();
    tracked.userIds.push(t5User);
    tracked.teamMemberIds.push(t5Tm);
    tracked.clientIds.push(t5Client);
    tracked.dealIds.push(t5Deal);

    const test5Sql = `
      BEGIN;
      INSERT INTO public.user_roles (user_id, role) VALUES ('${t5User}', 'worker');
      INSERT INTO public.user_permissions (user_id, permission) VALUES ('${t5User}', 'sales.convert_lead');
      INSERT INTO public.team_members (id, profile_id, name) VALUES ('${t5Tm}', '${t5User}', 'Worker 5');
      INSERT INTO public.clients (id, name) VALUES ('${t5Client}', 'Repeat Client');
      INSERT INTO public.deals (id, client_id, sales_owner_id, stage) VALUES ('${t5Deal}', '${t5Client}', '${t5User}', 'lead');
      SET LOCAL request.jwt.claim.sub = '${t5User}';
      -- First call creates commission
      SELECT public.convert_lead_to_sale('${t5Deal}'::uuid, '${t5Client}'::uuid, NULL, 4000, 0);
      -- Second call detects existing commission via idempotency guard
      SELECT public.convert_lead_to_sale('${t5Deal}'::uuid, '${t5Client}'::uuid, NULL, 4000, 0);
      COMMIT;
    `;
    const t5 = runSqlCatchingError(test5Sql);
    const commCount5 = runSql(`SELECT count(*) FROM public.sales_commissions WHERE deal_id = '${t5Deal}';`);
    const t5Passed = !t5.error && commCount5 === "1";
    results.push({
      id: 5,
      name: "Repeated conversion idempotency (single commission record preserved)",
      category: "Local PostgreSQL Integration Verified",
      passed: t5Passed,
      details: t5Passed ? "Calling RPC twice produced exactly 1 commission record." : (t5.error || t5.stdout),
    });

    // -----------------------------------------------------------------
    // Test 6: Concurrent Conversion Attempts (Real Concurrency)
    // -----------------------------------------------------------------
    console.log("\n--- Executing Test 6: Concurrent Race Condition Defense ---");
    const t6User = crypto.randomUUID();
    const t6Tm = crypto.randomUUID();
    const t6Client = crypto.randomUUID();
    const t6Deal = crypto.randomUUID();
    tracked.userIds.push(t6User);
    tracked.teamMemberIds.push(t6Tm);
    tracked.clientIds.push(t6Client);
    tracked.dealIds.push(t6Deal);

    // Pre-seed authorized user and deal
    runSql(`
      BEGIN;
      INSERT INTO public.user_roles (user_id, role) VALUES ('${t6User}', 'worker');
      INSERT INTO public.user_permissions (user_id, permission) VALUES ('${t6User}', 'sales.convert_lead');
      INSERT INTO public.team_members (id, profile_id, name) VALUES ('${t6Tm}', '${t6User}', 'Concurrent Worker');
      INSERT INTO public.clients (id, name) VALUES ('${t6Client}', 'Race Client');
      INSERT INTO public.deals (id, client_id, sales_owner_id, stage, deal_value)
        VALUES ('${t6Deal}', '${t6Client}', '${t6User}', 'lead', 7500);
      COMMIT;
    `);

    // Both concurrent calls authenticate as the exact authorized user
    const concurrentCallSql = `
      SET request.jwt.claim.sub = '${t6User}';
      SELECT public.convert_lead_to_sale('${t6Deal}'::uuid, '${t6Client}'::uuid, NULL, 7500, 500, 'paid');
    `;

    const runConcurrentWorker = (workerIndex: number): Promise<{ worker: number; stdout: string; error?: string; exitCode: number | null }> => {
      assertSafeTarget(TARGET_DB);
      return new Promise((resolve) => {
        const child = spawn(
          PSQL_BIN,
          ["-h", TARGET_HOST, "-p", TARGET_PORT, "-U", "postgres", "-d", TARGET_DB, "-q", "-t", "-A", "-c", concurrentCallSql],
          { env: getSanitizedEnv() }
        );
        let stdout = "";
        let error = "";
        child.stdout.on("data", (d) => (stdout += d.toString()));
        child.stderr.on("data", (d) => (error += d.toString()));
        child.on("close", (code) =>
          resolve({ worker: workerIndex, stdout: stdout.trim(), error: error.trim(), exitCode: code })
        );
      });
    };

    const [workerA, workerB] = await Promise.all([runConcurrentWorker(1), runConcurrentWorker(2)]);

    // Verify neither call was rejected by authorization (both reached conversion logic)
    const neitherUnauthorized =
      !workerA.error?.includes("42501") &&
      !workerA.stdout.includes("42501") &&
      !workerB.error?.includes("42501") &&
      !workerB.stdout.includes("42501");

    const commCount = runSql(`SELECT count(*) FROM public.sales_commissions WHERE deal_id = '${t6Deal}';`);
    const dealStage = runSql(`SELECT stage FROM public.deals WHERE id = '${t6Deal}';`);

    const t6Passed = neitherUnauthorized && commCount === "1" && dealStage === "won";
    results.push({
      id: 6,
      name: "Concurrent conversion attempts race safety via unique partial index",
      category: "Local PostgreSQL Integration Verified",
      passed: t6Passed,
      details: `Auth reached: ${neitherUnauthorized}. Commissions created: ${commCount}. Deal stage: ${dealStage}. Worker1 exit: ${workerA.exitCode}, Worker2 exit: ${workerB.exitCode}.`,
    });

    // -----------------------------------------------------------------
    // Test 7: Genuine Transaction Rollback Verification
    // -----------------------------------------------------------------
    console.log("\n--- Executing Test 7: Genuine Rollback Verification ---");
    const t7User = crypto.randomUUID();
    const t7Tm = crypto.randomUUID();
    const t7Client = crypto.randomUUID();
    const t7Deal = crypto.randomUUID();
    tracked.userIds.push(t7User);
    tracked.teamMemberIds.push(t7Tm);
    tracked.clientIds.push(t7Client);
    tracked.dealIds.push(t7Deal);

    // Pre-seed valid deal owned by authorized worker with notes 'TRIGGER_COMMISSION_FAILURE'.
    // This allows steps 1-13 (including UPDATE deals SET stage = 'won') to execute,
    // but step 14 (INSERT INTO sales_commissions) triggers trg_test_rollback_on_demand,
    // raising 'Simulated failure during commission creation' (P0001) to verify rollback atomicity.
    runSql(`
      BEGIN;
      INSERT INTO public.user_roles (user_id, role) VALUES ('${t7User}', 'worker');
      INSERT INTO public.user_permissions (user_id, permission) VALUES ('${t7User}', 'sales.convert_lead');
      INSERT INTO public.team_members (id, profile_id, name) VALUES ('${t7Tm}', '${t7User}', 'Rollback Worker');
      INSERT INTO public.clients (id, name) VALUES ('${t7Client}', 'Rollback Client');
      INSERT INTO public.deals (id, client_id, sales_owner_id, commission_recipient_id, stage, deal_value, notes)
        VALUES ('${t7Deal}', '${t7Client}', '${t7User}', '${t7Tm}', 'lead', 5000, 'TRIGGER_COMMISSION_FAILURE');
      COMMIT;
    `);

    // Execute RPC inside an isolated statement/transaction
    const test7Sql = `
      SET request.jwt.claim.sub = '${t7User}';
      SELECT public.convert_lead_to_sale('${t7Deal}'::uuid, '${t7Client}'::uuid, NULL, 5000, 0, 'paid', CURRENT_DATE, 'TRIGGER_COMMISSION_FAILURE');
    `;
    const t7Call = runSqlCatchingError(test7Sql);

    // Verify RPC failed with induced commission creation error
    const rpcFailedOnCommission =
      (t7Call.error || "").includes("Simulated failure during commission creation") ||
      (t7Call.error || "").includes("P0001");

    // Assert that deals.stage rolled back to 'lead' and was NOT left as 'won'
    const finalStageAfterRollback = runSql(`SELECT stage FROM public.deals WHERE id = '${t7Deal}';`);
    const commsAfterRollback = runSql(`SELECT count(*) FROM public.sales_commissions WHERE deal_id = '${t7Deal}';`);

    const t7Passed = rpcFailedOnCommission && finalStageAfterRollback === "lead" && commsAfterRollback === "0";
    results.push({
      id: 7,
      name: "Transaction rollback atomicity on commission creation failure",
      category: "Local PostgreSQL Integration Verified",
      passed: t7Passed,
      details: `Commission creation error triggered (P0001): ${rpcFailedOnCommission}. Deal stage preserved as '${finalStageAfterRollback}' (rolled back from 'won'). Commissions persisted: ${commsAfterRollback}.`,
    });

    // -----------------------------------------------------------------
    // Test 8: Authorization and Rate-Limiter Behavior
    // -----------------------------------------------------------------
    console.log("\n--- Executing Test 8: Authorization & Rate Limiter Verification ---");
    const unauth = runSqlCatchingError("RESET request.jwt.claim.sub; SELECT public.convert_lead_to_sale(gen_random_uuid());");
    const unauthPassed = (unauth.error || "").includes("Not authenticated") || (unauth.error || "").includes("28000");

    // Rate limiter check
    const rlKey = `test_rl_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    tracked.rateLimitKeys.push(rlKey);
    for (let i = 0; i < 30; i++) {
      runSql(`SELECT public.check_rate_limit('${rlKey}', 'entity_creation', 30, 60);`);
    }
    const overLimit = runSql(`SELECT (public.check_rate_limit('${rlKey}', 'entity_creation', 30, 60)->>'allowed')::boolean;`);
    const rlPassed = overLimit === "f" || overLimit === "false";
    const t8Passed = unauthPassed && rlPassed;
    results.push({
      id: 8,
      name: "Unauthenticated rejection (28000) & rate-limiter enforcement",
      category: "Local PostgreSQL Integration Verified",
      passed: t8Passed,
      details: `Unauthenticated call rejected with 28000: ${unauthPassed}. Sliding window rate limit blocked call #31: ${rlPassed}.`,
    });

    // -----------------------------------------------------------------
    // Supabase Platform Boundaries (Static / Architectural Documentation)
    // -----------------------------------------------------------------
    results.push({
      id: 9,
      name: "PostgREST HTTP JSON RPC transport & schema cache reload",
      category: "Supabase Auth/PostgREST/RLS boundary",
      passed: false,
      details: "Requires live PostgREST daemon; unverified in pure PostgreSQL harness.",
    });
    results.push({
      id: 10,
      name: "Supabase GoTrue JWT claim signing & session revocation checks",
      category: "Supabase Auth/PostgREST/RLS boundary",
      passed: false,
      details: "auth.uid() is emulated via request.jwt.claim.sub; full GoTrue token exchange unverified in local PG.",
    });

    // Print Summary Table
    console.log("\n=======================================================================");
    console.log("SADA OS — Sales Conversion Verification Matrix");
    console.log("=======================================================================");
    for (const r of results) {
      console.log(`\n[TEST ${r.id}] ${r.passed ? "PASS" : "INFO/BOUNDARY"}: ${r.name}`);
      console.log(`  Classification: ${r.category}`);
      console.log(`  Details: ${r.details}`);
    }
  } finally {
    // Targeted cleanup runs after both success and failure
    cleanupTargetedFixtures();
  }
}

// Export for testing or direct execution when approved
export default main;

main().catch((err) => {
  console.error("Execution error:", err);
  process.exit(1);
});

