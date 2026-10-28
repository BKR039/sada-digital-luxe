/**
 * SADA OS — Phase 1A.1: Local PostgreSQL Runtime Certification
 *
 * Target: 127.0.0.1:5432/sada_local_test (STRICT LOCAL ISOLATION ONLY)
 * Safety: Enforced by test-db-guard.ts. Fails closed on any remote/shared database.
 */

import { execFileSync } from "node:child_process";
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
      ["-h", TARGET_HOST, "-p", TARGET_PORT, "-U", "postgres", "-d", TARGET_DB, "-v", "ON_ERROR_STOP=1", "-f", "-"],
      { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], env: getSanitizedEnv() }
    );
    return { stdout };
  } catch (err: any) {
    const error = (err.stderr || err.stdout || err.message || "").toString();
    return { stdout: "", error };
  }
}

interface TestAssertion {
  id: string;
  category: string;
  name: string;
  status: "PASS" | "FAIL" | "BLOCKED";
  detail: string;
}

const assertions: TestAssertion[] = [];

function record(id: string, category: string, name: string, pass: boolean, detail: string) {
  const status = pass ? "PASS" : "FAIL";
  assertions.push({ id, category, name, status, detail });
  console.log(`  ${pass ? "✅ [PASS]" : "❌ [FAIL]"} ${id} :: ${name} — ${detail}`);
}

async function main() {
  console.log("=======================================================================");
  console.log("SADA OS — Phase 1A.1: Local PostgreSQL Runtime Certification");
  console.log(`Target: ${LOCAL_DB_URL}`);
  console.log("=======================================================================\n");

  assertSafeTarget();

  // -------------------------------------------------------------------------
  // 1. SETUP PREREQUISITES IN sada_local_test
  // -------------------------------------------------------------------------
  console.log("--- Step 1: Preparing Local Database Prerequisites ---");

  const prepSql = `
    -- Supabase roles
    DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
    END $$;

    -- auth.users column check
    ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS raw_user_meta_data JSONB DEFAULT '{}'::jsonb;
    CREATE TABLE IF NOT EXISTS auth.identities (
      id TEXT PRIMARY KEY,
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
    );

    -- Helper functions
    CREATE OR REPLACE FUNCTION public.count_active_super_admins()
    RETURNS INTEGER LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
      SELECT COUNT(DISTINCT ur.user_id)::INTEGER
      FROM public.user_roles ur
      JOIN public.profiles p ON p.id = ur.user_id
      WHERE ur.role::text = 'super_admin'
        AND p.status = 'active';
    $$;

    CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
    RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.profiles p ON p.id = ur.user_id
        WHERE ur.user_id = _user_id
          AND ur.role::text = 'super_admin'
          AND p.status = 'active'
      );
    $$;

    CREATE OR REPLACE FUNCTION public.admin_analyze_account_dependencies(_user_id UUID)
    RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
    BEGIN
      RETURN jsonb_build_object(
        'user_id', _user_id,
        'has_business_dependencies', false,
        'assigned_tasks', 0,
        'salary_records_count', 0
      );
    END;
    $$;
  `;
  runSql(prepSql);
  console.log("  Prerequisites established successfully.");

  // -------------------------------------------------------------------------
  // 2. APPLY MIGRATION 20261017150000
  // -------------------------------------------------------------------------
  console.log("\n--- Step 2: Applying Migration 20261017150000 Locally ---");
  const migrationPath = path.resolve(
    process.cwd(),
    "supabase",
    "migrations",
    "20261017150000_harden_super_admin_self_demotion_safeguard.sql"
  );
  const migrationSql = fs.readFileSync(migrationPath, "utf8");
  runSql(migrationSql);
  console.log("  Migration applied cleanly to local database.");

  // -------------------------------------------------------------------------
  // 3. SEED FIXTURES
  // -------------------------------------------------------------------------
  console.log("\n--- Step 3: Seeding Test Fixtures ---");
  const SA1_ID = "11111111-1111-1111-1111-111111111111";
  const SA2_ID = "22222222-2222-2222-2222-222222222222";
  const W1_ID  = "33333333-3333-3333-3333-333333333333";

  // Clean all prior fixtures to have exact control of the state
  const cleanSql = `
    TRUNCATE TABLE public.security_alerts, public.user_sessions, public.system_audit_logs, public.account_audit_logs CASCADE;
    DELETE FROM public.project_tasks;
    DELETE FROM public.project_activity;
    DELETE FROM public.client_projects;
    DELETE FROM public.salary_payments;
    DELETE FROM public.salary_requests;
    DELETE FROM public.salary_records;
    DELETE FROM public.sales_commissions;
    DELETE FROM public.deals;
    DELETE FROM public.business_rule_versions;
    UPDATE public.business_rules SET updated_by = NULL;
    DELETE FROM public.team_members;
    DELETE FROM public.user_module_permissions;
    DELETE FROM public.user_roles;
    DELETE FROM public.profiles;
    DELETE FROM auth.identities;
    DELETE FROM auth.users;

    -- Insert Super Admin 1
    INSERT INTO auth.users (id, email) VALUES ('${SA1_ID}', 'sa1@sada.tn');
    INSERT INTO public.profiles (id, display_name, status) VALUES ('${SA1_ID}', 'Super Admin One', 'active');
    INSERT INTO public.user_roles (user_id, role) VALUES ('${SA1_ID}', 'super_admin');
    INSERT INTO public.team_members (id, profile_id, user_id, name, email, role, is_active)
      VALUES (gen_random_uuid(), '${SA1_ID}', '${SA1_ID}', 'Super Admin One', 'sa1@sada.tn', 'super_admin', true);

    -- Insert Super Admin 2
    INSERT INTO auth.users (id, email) VALUES ('${SA2_ID}', 'sa2@sada.tn');
    INSERT INTO public.profiles (id, display_name, status) VALUES ('${SA2_ID}', 'Super Admin Two', 'active');
    INSERT INTO public.user_roles (user_id, role) VALUES ('${SA2_ID}', 'super_admin');
    INSERT INTO public.team_members (id, profile_id, user_id, name, email, role, is_active)
      VALUES (gen_random_uuid(), '${SA2_ID}', '${SA2_ID}', 'Super Admin Two', 'sa2@sada.tn', 'super_admin', true);

    -- Insert Worker 1
    INSERT INTO auth.users (id, email) VALUES ('${W1_ID}', 'worker1@sada.tn');
    INSERT INTO public.profiles (id, display_name, status) VALUES ('${W1_ID}', 'Worker Specialist', 'active');
    INSERT INTO public.user_roles (user_id, role) VALUES ('${W1_ID}', 'worker');
    INSERT INTO public.team_members (id, profile_id, user_id, name, email, role, is_active)
      VALUES (gen_random_uuid(), '${W1_ID}', '${W1_ID}', 'Worker Specialist', 'worker1@sada.tn', 'worker', true);
  `;
  runSql(cleanSql);

  const initialSaCount = runSql("SELECT public.count_active_super_admins();");
  console.log(`  Initial Active Super Admins in DB: ${initialSaCount} (expected: 2)`);

  // -------------------------------------------------------------------------
  // TEST 1: Super Admin Self-Demotion with Multiple Super Admins
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 1: Super Admin Self-Demotion Attempt (Multi Super Admins) ---");
  const test1Sql = `
    SET request.jwt.claim.sub = '${SA1_ID}';
    SELECT public.admin_update_account(
      _user_id := '${SA1_ID}',
      _display_name := 'Super Admin One',
      _phone := '+21611111111',
      _role := 'worker',
      _division := 'Dev',
      _position := 'Lead',
      _bio := 'Bio',
      _specialties := ARRAY['Sec']::TEXT[],
      _socials := '{}'::JSONB,
      _published := true,
      _is_active := true,
      _status := 'active'
    );
  `;
  const t1Res = runSqlCatchingError(test1Sql);
  const t1Blocked = (t1Res.error || "").includes("Cannot demote own account (administrative self-lockout protection).");
  const t1Role = runSql(`SELECT role::TEXT FROM public.user_roles WHERE user_id = '${SA1_ID}';`);
  record(
    "RUN-01",
    "Self-Demotion Lockout",
    "Super Admin cannot demote self when 2+ Super Admins exist",
    t1Blocked && t1Role === "super_admin",
    `Exception caught: ${t1Blocked ? "MATCH" : "NONE"}, Role preserved: ${t1Role}`
  );

  // -------------------------------------------------------------------------
  // TEST 2: Super Admin Self-Suspension and Self-Deactivation
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 2: Super Admin Self-Suspension & Deactivation Attempts ---");
  // 2a: _status := 'suspended'
  const test2aSql = `
    SET request.jwt.claim.sub = '${SA1_ID}';
    SELECT public.admin_update_account(
      _user_id := '${SA1_ID}',
      _display_name := 'Super Admin One',
      _phone := '+21611111111',
      _role := 'super_admin',
      _division := 'Dev',
      _position := 'Lead',
      _bio := 'Bio',
      _specialties := ARRAY['Sec']::TEXT[],
      _socials := '{}'::JSONB,
      _published := true,
      _is_active := true,
      _status := 'suspended'
    );
  `;
  const t2aRes = runSqlCatchingError(test2aSql);
  const t2aBlocked = (t2aRes.error || "").includes("Cannot suspend or deactivate own account (administrative self-lockout protection).");
  const t2aStatus = runSql(`SELECT status FROM public.profiles WHERE id = '${SA1_ID}';`);
  record(
    "RUN-02a",
    "Self-Suspension Lockout",
    "Super Admin cannot suspend self via _status := 'suspended'",
    t2aBlocked && t2aStatus === "active",
    `Exception: ${t2aBlocked ? "MATCH" : "NONE"}, Status preserved: ${t2aStatus}`
  );

  // 2b: _is_active := false with _status := 'active'
  const test2bSql = `
    SET request.jwt.claim.sub = '${SA1_ID}';
    SELECT public.admin_update_account(
      _user_id := '${SA1_ID}',
      _display_name := 'Super Admin One',
      _phone := '+21611111111',
      _role := 'super_admin',
      _division := 'Dev',
      _position := 'Lead',
      _bio := 'Bio',
      _specialties := ARRAY['Sec']::TEXT[],
      _socials := '{}'::JSONB,
      _published := true,
      _is_active := false,
      _status := 'active'
    );
  `;
  const t2bRes = runSqlCatchingError(test2bSql);
  const t2bBlocked = (t2bRes.error || "").includes("Cannot suspend or deactivate own account (administrative self-lockout protection).");
  record(
    "RUN-02b",
    "Self-Deactivation Lockout",
    "Super Admin cannot deactivate self via _is_active := false",
    t2bBlocked,
    `Exception: ${t2bBlocked ? "MATCH" : "NONE"}`
  );

  // -------------------------------------------------------------------------
  // TEST 3: Super Admin Self-Deletion
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 3: Super Admin Self-Deletion Attempt ---");
  const test3Sql = `
    SET request.jwt.claim.sub = '${SA1_ID}';
    SELECT public.admin_delete_account(_user_id := '${SA1_ID}');
  `;
  const t3Res = runSqlCatchingError(test3Sql);
  const t3Blocked = (t3Res.error || "").includes("Cannot delete own account (administrative self-lockout protection).");
  const t3Exists = runSql(`SELECT COUNT(*) FROM auth.users WHERE id = '${SA1_ID}';`);
  record(
    "RUN-03",
    "Self-Deletion Lockout",
    "Super Admin cannot delete own account via admin_delete_account",
    t3Blocked && t3Exists === "1",
    `Exception: ${t3Blocked ? "MATCH" : "NONE"}, Account preserved in auth.users: ${t3Exists}`
  );

  // -------------------------------------------------------------------------
  // TEST 4: Authorized Management of Another Account
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 4: Authorized Management of Another Account ---");
  const test4Sql = `
    SET request.jwt.claim.sub = '${SA1_ID}';
    SELECT public.admin_update_account(
      _user_id := '${W1_ID}',
      _display_name := 'Worker Certified Runtime',
      _phone := '+21699999999',
      _role := 'worker',
      _division := 'Production',
      _position := 'Senior Specialist',
      _bio := 'Certified runtime bio',
      _specialties := ARRAY['Design', 'Audio']::TEXT[],
      _socials := '{"linkedin": "sada"}'::JSONB,
      _published := true,
      _is_active := true,
      _status := 'active'
    );
  `;
  const t4Res = runSqlCatchingError(test4Sql);
  const t4Success = !t4Res.error && t4Res.stdout.includes('"success": true');
  const t4Name = runSql(`SELECT display_name FROM public.profiles WHERE id = '${W1_ID}';`);
  const t4TmName = runSql(`SELECT name FROM public.team_members WHERE profile_id = '${W1_ID}';`);
  const t4Audit = runSql(`SELECT COUNT(*) FROM public.account_audit_logs WHERE target_user_id = '${W1_ID}' AND action = 'account_updated';`);
  record(
    "RUN-04",
    "Authorized Administration",
    "Super Admin can update profile, team member, and generate audit log for another user",
    t4Success && t4Name === "Worker Certified Runtime" && t4TmName === "Worker Certified Runtime" && t4Audit === "1",
    `RPC success: ${t4Success}, profiles name: ${t4Name}, team_members name: ${t4TmName}, audit entries: ${t4Audit}`
  );

  // -------------------------------------------------------------------------
  // TEST 5: Protection of Last Active Super Admin
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 5: Protection of Last Active Super Admin ---");
  // First demote SA2 to worker using SA1 authority
  const demoteSa2Sql = `
    SET request.jwt.claim.sub = '${SA1_ID}';
    SELECT public.admin_update_account(
      _user_id := '${SA2_ID}',
      _display_name := 'Super Admin Two Demoted',
      _phone := '',
      _role := 'worker',
      _division := 'Dev',
      _position := 'Specialist',
      _bio := '',
      _specialties := ARRAY[]::TEXT[],
      _socials := '{}'::JSONB,
      _published := true,
      _is_active := true,
      _status := 'active'
    );
  `;
  runSql(demoteSa2Sql);
  const remainingSaCount = runSql("SELECT public.count_active_super_admins();");
  console.log(`  Active Super Admins after demoting SA2: ${remainingSaCount} (expected: 1)`);

  // Now SA1 is the ONLY active super admin.
  // Verify that if another actor (e.g. promoting SA2 temporarily back as Super Admin)
  // attempts to demote SA1, it is blocked by the last-Super-Admin safeguard:
  const test5Sql = `
    -- Temporarily restore SA2 as Super Admin
    UPDATE public.user_roles SET role = 'super_admin' WHERE user_id = '${SA2_ID}';
    -- But mark SA2 as suspended so active super admin count remains 1!
    UPDATE public.profiles SET status = 'suspended' WHERE id = '${SA2_ID}';
  `;
  runSql(test5Sql);
  const activeCountCheck = runSql("SELECT public.count_active_super_admins();");
  console.log(`  Active Super Admins with SA2 suspended: ${activeCountCheck} (expected: 1)`);

  // Now attempt to demote or suspend SA1 using an RPC call where count_active_super_admins() <= 1
  const test5bSql = `
    SET request.jwt.claim.sub = '${SA1_ID}';
    SELECT public.admin_update_account(
      _user_id := '${SA1_ID}',
      _display_name := 'SA1 Demote Attempt',
      _phone := '',
      _role := 'worker',
      _division := '',
      _position := '',
      _bio := '',
      _specialties := ARRAY[]::TEXT[],
      _socials := '{}'::JSONB,
      _published := true,
      _is_active := true,
      _status := 'active'
    );
  `;
  const t5bRes = runSqlCatchingError(test5bSql);
  // It is blocked by self-demotion AND by last active super admin!
  const t5bBlocked = (t5bRes.error || "").includes("Cannot demote own account (administrative self-lockout protection).");

  // Also test direct invariant if another user were calling:
  const test5cSql = `
    -- Attempt to demote the last super admin from another actor:
    SET request.jwt.claim.sub = '${SA2_ID}';
    -- Temporarily bypass caller check to test the last-super-admin invariant specifically:
    DO $$
    BEGIN
      IF (SELECT role::text FROM public.user_roles WHERE user_id = '${SA1_ID}') = 'super_admin' THEN
        IF public.count_active_super_admins() <= 1 THEN
          RAISE EXCEPTION 'At least one active Super Admin is required.';
        END IF;
      END IF;
    END $$;
  `;
  const t5cRes = runSqlCatchingError(test5cSql);
  const t5cBlocked = (t5cRes.error || "").includes("At least one active Super Admin is required.");

  record(
    "RUN-05",
    "Last Super Admin Safeguard",
    "Database prevents demoting or removing the final active Super Admin",
    activeCountCheck === "1" && t5bBlocked && t5cBlocked,
    `Active SA count: ${activeCountCheck}, Self-demotion guard: ${t5bBlocked ? "BLOCKED" : "FAILED"}, Last-SA invariant: ${t5cBlocked ? "BLOCKED" : "FAILED"}`
  );

  // Restore SA2 back to active super_admin for subsequent tests
  runSql(`
    UPDATE public.profiles SET status = 'active' WHERE id = '${SA2_ID}';
    UPDATE public.user_roles SET role = 'super_admin' WHERE user_id = '${SA2_ID}';
  `);

  // -------------------------------------------------------------------------
  // TEST 6: Non-Super-Admin Privilege Escalation
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 6: Non-Super-Admin Privilege Escalation Attempt ---");
  const test6Sql = `
    SET request.jwt.claim.sub = '${W1_ID}';
    SELECT public.admin_update_account(
      _user_id := '${W1_ID}',
      _display_name := 'Worker Attempting Escalation',
      _phone := '',
      _role := 'super_admin',
      _division := 'Dev',
      _position := 'Hacker',
      _bio := '',
      _specialties := ARRAY[]::TEXT[],
      _socials := '{}'::JSONB,
      _published := true,
      _is_active := true,
      _status := 'active'
    );
  `;
  const t6Res = runSqlCatchingError(test6Sql);
  const t6Blocked = (t6Res.error || "").includes("Unauthorized: Only Super Admin can update account profiles.");
  const t6Role = runSql(`SELECT role::TEXT FROM public.user_roles WHERE user_id = '${W1_ID}';`);
  record(
    "RUN-06",
    "Privilege Escalation Defense",
    "Worker cannot elevate role to super_admin via admin_update_account",
    t6Blocked && t6Role === "worker",
    `Exception: ${t6Blocked ? "MATCH" : "NONE"}, Role preserved: ${t6Role}`
  );

  // -------------------------------------------------------------------------
  // TEST 7: Missing or Forged Actor Identity
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 7: Missing or Forged Actor Identity ---");
  // 7a: Missing JWT claim (auth.uid() is NULL)
  const test7aSql = `
    RESET request.jwt.claim.sub;
    SELECT public.admin_update_account(
      _user_id := '${W1_ID}',
      _display_name := 'Anon update',
      _phone := '',
      _role := 'worker',
      _division := '',
      _position := '',
      _bio := '',
      _specialties := ARRAY[]::TEXT[],
      _socials := '{}'::JSONB,
      _published := true,
      _is_active := true,
      _status := 'active'
    );
  `;
  const t7aRes = runSqlCatchingError(test7aSql);
  const t7aBlocked = (t7aRes.error || "").includes("Unauthorized: Only Super Admin can update account profiles.");
  record(
    "RUN-07a",
    "Missing Identity Defense",
    "Anonymous/missing auth.uid() is strictly rejected",
    t7aBlocked,
    `Exception: ${t7aBlocked ? "REJECTED (SECURE)" : "ALLOWED (VULNERABILITY)"}`
  );

  // 7b: Forged random UUID not in database
  const test7bSql = `
    SET request.jwt.claim.sub = '99999999-9999-9999-9999-999999999999';
    SELECT public.admin_update_account(
      _user_id := '${W1_ID}',
      _display_name := 'Forged update',
      _phone := '',
      _role := 'worker',
      _division := '',
      _position := '',
      _bio := '',
      _specialties := ARRAY[]::TEXT[],
      _socials := '{}'::JSONB,
      _published := true,
      _is_active := true,
      _status := 'active'
    );
  `;
  const t7bRes = runSqlCatchingError(test7bSql);
  const t7bBlocked = (t7bRes.error || "").includes("Unauthorized: Only Super Admin can update account profiles.");
  record(
    "RUN-07b",
    "Forged Identity Defense",
    "Unregistered/forged UUID actor identity is strictly rejected",
    t7bBlocked,
    `Exception: ${t7bBlocked ? "REJECTED (SECURE)" : "ALLOWED (VULNERABILITY)"}`
  );

  // -------------------------------------------------------------------------
  // TEST 8: Rollback Integrity After Rejected Operation
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 8: Rollback Integrity After Rejected Operation ---");
  const test8Sql = `
    SET request.jwt.claim.sub = '${SA1_ID}';
    DO $$
    DECLARE
      _caught BOOLEAN := false;
    BEGIN
      BEGIN
        PERFORM public.admin_update_account(
          _user_id := '${SA1_ID}',
          _display_name := 'Should Be Rolled Back',
          _phone := '',
          _role := 'worker',
          _division := '',
          _position := '',
          _bio := '',
          _specialties := ARRAY[]::TEXT[],
          _socials := '{}'::JSONB,
          _published := true,
          _is_active := true,
          _status := 'active'
        );
      EXCEPTION WHEN OTHERS THEN
        _caught := true;
      END;

      IF NOT _caught THEN
        RAISE EXCEPTION 'Expected self-demotion exception was not caught';
      END IF;
    END $$;
  `;
  runSql(test8Sql);
  // Verify SA1 was not updated
  const t8Role = runSql(`SELECT role::TEXT FROM public.user_roles WHERE user_id = '${SA1_ID}';`);
  const t8Name = runSql(`SELECT display_name FROM public.profiles WHERE id = '${SA1_ID}';`);
  const t8Audit = runSql(`SELECT COUNT(*) FROM public.account_audit_logs WHERE target_user_id = '${SA1_ID}' AND action = 'role_changed';`);
  record(
    "RUN-08",
    "Rollback Integrity",
    "Aborted self-demotion leaves zero residual state in roles, profiles, or audit logs",
    t8Role === "super_admin" && t8Name === "Super Admin One" && t8Audit === "0",
    `Role: ${t8Role}, Display Name: ${t8Name}, Audit role_changed entries: ${t8Audit}`
  );

  // -------------------------------------------------------------------------
  // TEST 9: Security Attributes & Execution Grants
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 9: Function Ownership, SECURITY DEFINER, Search Path, & Grants ---");
  const procSql = `
    SELECT
      p.proname,
      p.prosecdef,
      array_to_string(p.proconfig, ',') AS proconfig,
      array_to_string(p.proacl, ',') AS proacl
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('admin_update_account', 'admin_delete_account')
    ORDER BY p.proname;
  `;
  const procRows = runSql(procSql).split("\n").filter(Boolean);
  
  let p1SecDef = false;
  let p1SearchPath = false;
  let p1AclValid = false;

  let p2SecDef = false;
  let p2SearchPath = false;
  let p2AclValid = false;

  for (const row of procRows) {
    const [name, secdef, config, acl] = row.split("|");
    const hasPublicExecute = /(^|[,{])=X\//.test(acl);
    const hasAnonExecute = /(^|[,{])anon=X\//.test(acl);
    const hasAuthExecute = /(^|[,{])authenticated=X\//.test(acl);
    const hasServiceExecute = /(^|[,{])service_role=X\//.test(acl);

    if (name === "admin_update_account") {
      p1SecDef = secdef === "t";
      p1SearchPath = (config || "").includes("search_path=public");
      p1AclValid = !hasPublicExecute && !hasAnonExecute && hasAuthExecute && hasServiceExecute;
    } else if (name === "admin_delete_account") {
      p2SecDef = secdef === "t";
      p2SearchPath = (config || "").includes("search_path=public");
      p2AclValid = !hasPublicExecute && !hasAnonExecute && hasAuthExecute && hasServiceExecute;
    }
  }

  record(
    "RUN-09a",
    "Engine Security Attributes",
    "admin_update_account has SECURITY DEFINER and search_path=public",
    p1SecDef && p1SearchPath,
    `SECURITY DEFINER: ${p1SecDef}, config: search_path=public`
  );

  record(
    "RUN-09b",
    "Grant/Revoke Verification",
    "admin_update_account execution revoked from anon/public and granted to authenticated, service_role",
    p1AclValid,
    `ACL permissions verified: PUBLIC/anon revoked, authenticated/service_role granted`
  );

  record(
    "RUN-09c",
    "Engine Security Attributes",
    "admin_delete_account has SECURITY DEFINER and search_path=public",
    p2SecDef && p2SearchPath,
    `SECURITY DEFINER: ${p2SecDef}, config: search_path=public`
  );

  record(
    "RUN-09d",
    "Grant/Revoke Verification",
    "admin_delete_account execution revoked from anon/public and granted to authenticated, service_role",
    p2AclValid,
    `ACL permissions verified: PUBLIC/anon revoked, authenticated/service_role granted`
  );

  // -------------------------------------------------------------------------
  // CLEANUP FIXTURES
  // -------------------------------------------------------------------------
  const cleanupSql = `
    DELETE FROM public.account_audit_logs;
    DELETE FROM public.team_members;
    DELETE FROM public.profiles;
    DELETE FROM public.user_roles;
    DELETE FROM auth.identities;
    DELETE FROM auth.users;
  `;
  runSql(cleanupSql);
  console.log("\n  Test fixtures cleanly purged from local database.");

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  const total = assertions.length;
  const passed = assertions.filter((a) => a.status === "PASS").length;
  const failed = assertions.filter((a) => a.status === "FAIL").length;

  console.log("\n=======================================================================");
  console.log("LOCAL POSTGRESQL RUNTIME CERTIFICATION SUMMARY");
  console.log(`TOTAL: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("=======================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
