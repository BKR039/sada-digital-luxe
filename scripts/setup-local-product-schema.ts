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
  safeEnv.PGCLIENTENCODING = "UTF8";
  return safeEnv;
}

function runSqlFile(filePath: string): string {
  assertSafeTarget();
  return execFileSync(
    PSQL_BIN,
    ["-X", "-A", "-t", "-d", TARGET_DB, "-v", "ON_ERROR_STOP=1", "-f", filePath],
    {
      env: getSanitizedEnv(),
      encoding: "utf-8",
    }
  ).trim();
}

async function setup() {
  console.log("Setting up Digital Products CMS schema on sada_local_test...");
  const migrationPath = path.resolve(
    process.cwd(),
    "supabase/migrations/20261018220000_digital_products_cms_multilingual_and_rls_hardening.sql"
  );
  const out = runSqlFile(migrationPath);
  console.log("Migration executed successfully:\n", out);
}

setup().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
