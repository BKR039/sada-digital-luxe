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

export function runSqlCatchingError(sql: string): { stdout: string; error: string | null } {
  assertSafeTarget();
  try {
    const stdout = runSql(sql);
    return { stdout, error: null };
  } catch (err: any) {
    return { stdout: "", error: (err.stderr || err.stdout || err.message || String(err)).toString() };
  }
}

async function main() {
  console.log("=== TEST SET ROLE authenticated WITH GRANTS ===");
  const WORKER_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
  const SUPER_ADMIN_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

  runSql(`
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_rules TO authenticated, service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_rule_versions TO authenticated, service_role;
  `);

  // 1. Worker update test under SET ROLE authenticated
  const workerRes = runSqlCatchingError(`
    SET ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub', '${WORKER_ID}', false);
    SELECT set_config('request.jwt.claim.role', 'authenticated', false);
    UPDATE public.business_rules SET numeric_value = 99 WHERE rule_key = 'critical_runway_months';
  `);
  console.log("Worker update error/stdout:", workerRes);

  const valAfterWorker = runSql("SELECT numeric_value FROM public.business_rules WHERE rule_key = 'critical_runway_months';");
  console.log("Value after worker attempt:", valAfterWorker);

  // 2. Super Admin update test under SET ROLE authenticated
  const saRes = runSqlCatchingError(`
    SET ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub', '${SUPER_ADMIN_ID}', false);
    SELECT set_config('request.jwt.claim.role', 'authenticated', false);
    UPDATE public.business_rules SET numeric_value = 4 WHERE rule_key = 'critical_runway_months';
  `);
  console.log("Super Admin update error/stdout:", saRes);

  const valAfterSa = runSql("SELECT numeric_value FROM public.business_rules WHERE rule_key = 'critical_runway_months';");
  console.log("Value after Super Admin attempt:", valAfterSa);

  // 3. Worker calling reset RPC
  const ruleId = runSql("SELECT id FROM public.business_rules WHERE rule_key = 'critical_runway_months';");
  const workerRpc = runSqlCatchingError(`
    SET ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub', '${WORKER_ID}', false);
    SELECT set_config('request.jwt.claim.role', 'authenticated', false);
    SELECT public.reset_business_rule_to_default('${ruleId}', 'Worker unauthorized reset');
  `);
  console.log("Worker RPC call (should fail):", workerRpc.error ? "DENIED: " + workerRpc.error.split("\n")[0] : "ALLOWED");

  // 4. Super Admin calling reset RPC
  const saRpc = runSqlCatchingError(`
    SET ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub', '${SUPER_ADMIN_ID}', false);
    SELECT set_config('request.jwt.claim.role', 'authenticated', false);
    SELECT public.reset_business_rule_to_default('${ruleId}', 'Super Admin authorized reset');
  `);
  console.log("Super Admin RPC call (should pass):", saRpc.error ? "FAILED: " + saRpc.error : "SUCCESS");

  const valAfterReset = runSql("SELECT numeric_value FROM public.business_rules WHERE rule_key = 'critical_runway_months';");
  console.log("Value after reset RPC:", valAfterReset);
}

main().catch(console.error);
