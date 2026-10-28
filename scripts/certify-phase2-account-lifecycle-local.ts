/**
 * SADA OS — Phase 2: Account Lifecycle & Identity Consistency Certification
 *
 * Target: 127.0.0.1:5432/sada_local_test (STRICT LOCAL ISOLATION ONLY)
 * Safety: Enforced by test-db-guard.ts. Fails closed on any remote/shared database.
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { enforceDatabaseIsolation } from "./test-db-guard";
import { generateSecurePassword, computeAccountKPIs, type AccountRecord } from "../src/lib/account-service";

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
  console.log("SADA OS — Phase 2: Account Lifecycle & Identity Consistency Certification");
  console.log(`Target: ${LOCAL_DB_URL}`);
  console.log("=======================================================================\n");

  assertSafeTarget();

  // -------------------------------------------------------------------------
  // 1. SETUP PREREQUISITES & SCHEMAS IN sada_local_test
  // -------------------------------------------------------------------------
  console.log("--- Step 1: Setting Up Comprehensive Lifecycle Schemas in Local Database ---");

  const setupSql = `
    -- Supabase roles
    DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
    END $$;

    -- Cryptographic extension
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE SCHEMA IF NOT EXISTS extensions;
    CREATE OR REPLACE FUNCTION extensions.crypt(TEXT, TEXT) RETURNS TEXT LANGUAGE SQL AS $$ SELECT public.crypt($1, $2); $$;
    CREATE OR REPLACE FUNCTION extensions.gen_salt(TEXT) RETURNS TEXT LANGUAGE SQL AS $$ SELECT public.gen_salt($1); $$;

    -- auth schema simulation
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
    $$;
    CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS $$
      SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), 'authenticated');
    $$;
    CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE sql STABLE AS $$
      SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
    $$;

    ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS encrypted_password TEXT;
    ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS raw_user_meta_data JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ;
    ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_confirmed_at TIMESTAMPTZ;

    CREATE TABLE IF NOT EXISTS auth.identities (
      id TEXT PRIMARY KEY,
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
    );

    -- public.profiles
    CREATE TABLE IF NOT EXISTS public.profiles (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      display_name TEXT,
      phone TEXT,
      status TEXT DEFAULT 'active',
      module_permissions JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    -- public.user_roles
    CREATE TABLE IF NOT EXISTS public.user_roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      role public.app_role NOT NULL,
      UNIQUE (user_id, role)
    );

    -- public.user_module_permissions
    CREATE TABLE IF NOT EXISTS public.user_module_permissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      module TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT true,
      actions JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (user_id, module)
    );

    -- public.account_audit_logs
    CREATE TABLE IF NOT EXISTS public.account_audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_id UUID,
      actor_email TEXT,
      target_user_id UUID,
      target_email TEXT,
      action TEXT,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    -- Drop test tables so canonical migrations create authoritative schemas
    DROP TABLE IF EXISTS public.security_alerts CASCADE;
    DROP TABLE IF EXISTS public.user_sessions CASCADE;

    CREATE TABLE IF NOT EXISTS public.system_audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      actor_name TEXT,
      actor_role TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      old_values JSONB DEFAULT '{}'::jsonb,
      new_values JSONB DEFAULT '{}'::jsonb,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Business dependency tables for realistic dependency analysis
    CREATE TABLE IF NOT EXISTS public.project_tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      assignee_id UUID,
      assigned_by_id UUID,
      title TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.project_activity (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_id UUID,
      activity_type TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.client_projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id UUID,
      title TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.salary_payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_member_id UUID,
      amount NUMERIC(10,2),
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.salary_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      team_member_id UUID,
      amount NUMERIC(10,2),
      created_at TIMESTAMPTZ DEFAULT now()
    );

    -- Core RBAC helpers
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

    CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
    RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
      SELECT EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.profiles p ON p.id = ur.user_id
        WHERE ur.user_id = _user_id
          AND ur.role::text IN ('admin', 'super_admin')
          AND p.status = 'active'
      );
    $$;
  `;
  runSql(setupSql);

  // Apply migrations in order
  console.log("  Applying canonical RPC migrations...");
  const migrationsToApply = [
    "20260925180000_super_admin_account_management.sql",
    "20261006161500_fix_account_dependency_lead_column.sql",
    "20261007220000_phase_j_fix_rate_limit_call.sql",
    "20261010100000_sada_security_and_session_control_center.sql",
    "20261016140000_secure_public_team_members_and_rls_hardening.sql",
    "20261017150000_harden_super_admin_self_demotion_safeguard.sql",
  ];

  for (const mig of migrationsToApply) {
    const migPath = path.resolve(process.cwd(), "supabase", "migrations", mig);
    if (fs.existsSync(migPath)) {
      runSql(fs.readFileSync(migPath, "utf8"));
    }
  }

  // Canonical session liveness function
  const sessionLivenessSql = `
    CREATE OR REPLACE FUNCTION public.is_session_active()
    RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
    DECLARE
      v_user_id UUID := auth.uid();
      v_acc_status TEXT;
    BEGIN
      IF v_user_id IS NULL THEN RETURN true; END IF;

      SELECT status INTO v_acc_status FROM public.profiles WHERE id = v_user_id;
      IF v_acc_status IS NOT NULL AND v_acc_status IN ('suspended', 'disabled', 'deleted') THEN
        RETURN false;
      END IF;

      IF EXISTS (SELECT 1 FROM public.user_sessions WHERE user_id = v_user_id) THEN
        RETURN EXISTS (
          SELECT 1 FROM public.user_sessions
          WHERE user_id = v_user_id AND status IN ('active', 'idle') AND expires_at > now()
        );
      END IF;

      RETURN true;
    END;
    $$;
  `;
  runSql(sessionLivenessSql);
  console.log("  Prerequisites and migrations established cleanly.");

  // -------------------------------------------------------------------------
  // 2. SEED ROOT FIXTURES
  // -------------------------------------------------------------------------
  console.log("\n--- Step 2: Seeding Root Test Identities ---");
  const SA1_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const SA2_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

  const cleanFixturesSql = `
    DELETE FROM public.project_tasks;
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

    -- Root Super Admin 1
    INSERT INTO auth.users (id, email, raw_user_meta_data)
      VALUES ('${SA1_ID}', 'root_sa1@sada.tn', '{"display_name": "Root Super Admin One"}'::jsonb);
    INSERT INTO public.profiles (id, display_name, status)
      VALUES ('${SA1_ID}', 'Root Super Admin One', 'active');
    INSERT INTO public.user_roles (user_id, role)
      VALUES ('${SA1_ID}', 'super_admin');
    INSERT INTO public.team_members (id, profile_id, user_id, name, email, role, is_active, published)
      VALUES (gen_random_uuid(), '${SA1_ID}', '${SA1_ID}', 'Root Super Admin One', 'root_sa1@sada.tn', 'super_admin', true, false);

    -- Root Super Admin 2
    INSERT INTO auth.users (id, email, raw_user_meta_data)
      VALUES ('${SA2_ID}', 'root_sa2@sada.tn', '{"display_name": "Root Super Admin Two"}'::jsonb);
    INSERT INTO public.profiles (id, display_name, status)
      VALUES ('${SA2_ID}', 'Root Super Admin Two', 'active');
    INSERT INTO public.user_roles (user_id, role)
      VALUES ('${SA2_ID}', 'super_admin');
    INSERT INTO public.team_members (id, profile_id, user_id, name, email, role, is_active, published)
      VALUES (gen_random_uuid(), '${SA2_ID}', '${SA2_ID}', 'Root Super Admin Two', 'root_sa2@sada.tn', 'super_admin', true, false);
  `;
  runSql(cleanFixturesSql);

  const saCount = runSql("SELECT public.count_active_super_admins();");
  console.log(`  Active Super Admins in DB: ${saCount} (expected: 2)`);

  // =========================================================================
  // GROUP 2: ACCOUNT PROVISIONING LIFECYCLE (admin_provision_account)
  // =========================================================================
  console.log("\n=======================================================================");
  console.log("GROUP 2: Account Provisioning Lifecycle Tests");
  console.log("=======================================================================");

  // 2.1: Super Admin provisions a new specialist account
  const NEW_USER_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
  const NEW_USER_EMAIL = "specialist.dev@sada.tn";

  // Pre-insert into auth.users (as GoTrue auth API does before RPC invocation)
  runSql(`
    INSERT INTO auth.users (id, email, raw_user_meta_data)
    VALUES ('${NEW_USER_ID}', '${NEW_USER_EMAIL}', '{"display_name": "Specialist Dev"}'::jsonb);
  `);

  const provSql = `
    SET request.jwt.claim.sub = '${SA1_ID}';
    SELECT public.admin_provision_account(
      _user_id := '${NEW_USER_ID}',
      _email := '${NEW_USER_EMAIL}',
      _display_name := 'Specialist Dev',
      _role := 'worker',
      _division := 'Development',
      _position := 'Full Stack Engineer',
      _phone := '+21671000111',
      _create_team_member := true,
      _status := 'active',
      _module_permissions := '{"sales": {"enabled": true, "actions": {"view": true, "create": true}}}'::jsonb
    );
  `;
  const provRes = runSqlCatchingError(provSql);
  const provSuccess = !provRes.error && provRes.stdout.includes('"status": "active"');
  record("PROV-01", "Provisioning", "Super Admin provisions new specialist with role & team member", provSuccess, `RPC output: ${provSuccess ? "SUCCESS" : provRes.error}`);

  // 2.2: Verify SSOT consistency across all relational projections
  const pCheck = runSql(`SELECT display_name, phone, status FROM public.profiles WHERE id = '${NEW_USER_ID}';`);
  const rCheck = runSql(`SELECT role::TEXT FROM public.user_roles WHERE user_id = '${NEW_USER_ID}';`);
  const tmCheck = runSql(`SELECT name, role, division, position, published, is_active FROM public.team_members WHERE profile_id = '${NEW_USER_ID}';`);
  const umpCheck = runSql(`SELECT module, enabled FROM public.user_module_permissions WHERE user_id = '${NEW_USER_ID}';`);
  const auditProv = runSql(`SELECT action, target_email FROM public.account_audit_logs WHERE target_user_id = '${NEW_USER_ID}';`);

  const ssotConsistent =
    pCheck === "Specialist Dev|+21671000111|active" &&
    rCheck === "worker" &&
    tmCheck === "Specialist Dev|worker|Development|Full Stack Engineer|f|t" &&
    umpCheck === "sales|t" &&
    auditProv.includes("account_created");

  record("PROV-02", "Identity Consistency", "Full relational consistency across auth.users, profiles, user_roles, user_module_permissions, team_members", ssotConsistent, `profiles: ${pCheck}, roles: ${rCheck}, team_members: ${tmCheck}, perms: ${umpCheck}`);

  // 2.3: Idempotency & Safe Upsert
  const provReplaySql = `
    SET request.jwt.claim.sub = '${SA1_ID}';
    SELECT public.admin_provision_account(
      _user_id := '${NEW_USER_ID}',
      _email := '${NEW_USER_EMAIL}',
      _display_name := 'Specialist Dev Senior',
      _role := 'worker',
      _division := 'Development',
      _position := 'Lead Architect',
      _phone := '+21671000111',
      _create_team_member := true,
      _status := 'active',
      _module_permissions := NULL
    );
  `;
  const replayRes = runSqlCatchingError(provReplaySql);
  const tmCount = runSql(`SELECT COUNT(*) FROM public.team_members WHERE profile_id = '${NEW_USER_ID}';`);
  const pName = runSql(`SELECT display_name FROM public.profiles WHERE id = '${NEW_USER_ID}';`);
  const isIdempotent = !replayRes.error && tmCount === "1" && pName === "Specialist Dev Senior";
  record("PROV-03", "Idempotency", "Re-provisioning updates existing records cleanly without duplicate team_members or roles", isIdempotent, `Team members count: ${tmCount}, updated display name: ${pName}`);

  // 2.4: Negative Authorization: Worker cannot provision accounts
  const workerProvSql = `
    SET request.jwt.claim.sub = '${NEW_USER_ID}';
    SELECT public.admin_provision_account(
      _user_id := gen_random_uuid(),
      _email := 'rogue@sada.tn',
      _display_name := 'Rogue',
      _role := 'super_admin',
      _module_permissions := NULL::jsonb
    );
  `;
  const workerProvRes = runSqlCatchingError(workerProvSql);
  const workerProvBlocked = (workerProvRes.error || "").includes("Unauthorized: Only Super Admin can provision accounts.");
  record("PROV-04", "Authorization Guard", "Worker cannot provision accounts", workerProvBlocked, `Blocked with exception: ${workerProvBlocked}`);

  // =========================================================================
  // GROUP 3: IDENTITY & ROLE UPDATING (admin_update_account)
  // =========================================================================
  console.log("\n=======================================================================");
  console.log("GROUP 3: Account Updating & Role Persistence Tests");
  console.log("=======================================================================");

  // 3.1: Super Admin updates profile fields
  const updateSql = `
    SET request.jwt.claim.sub = '${SA1_ID}';
    SELECT public.admin_update_account(
      _user_id := '${NEW_USER_ID}',
      _display_name := 'Specialist Lead Architect',
      _phone := '+21671999888',
      _role := 'admin',
      _division := 'Architecture',
      _position := 'Principal Architect',
      _bio := 'Lead system architect',
      _specialties := ARRAY['Database', 'Security']::TEXT[],
      _socials := '{"linkedin": "sada-architect"}'::JSONB,
      _published := true,
      _is_active := true,
      _status := 'active'
    );
  `;
  const updateRes = runSqlCatchingError(updateSql);
  const updateSuccess = !updateRes.error && updateRes.stdout.includes('"success": true');
  const newRole = runSql(`SELECT role::TEXT FROM public.user_roles WHERE user_id = '${NEW_USER_ID}';`);
  const tmPosition = runSql(`SELECT position FROM public.team_members WHERE profile_id = '${NEW_USER_ID}';`);
  const roleAudit = runSql(`SELECT COUNT(*) FROM public.account_audit_logs WHERE target_user_id = '${NEW_USER_ID}' AND action = 'role_changed';`);

  record("UPDT-01", "Profile & Role Mutation", "Super Admin promotes Worker to Admin; synchronizes team profile and logs role_changed", updateSuccess && newRole === "admin" && tmPosition === "Principal Architect" && roleAudit === "1", `New role: ${newRole}, TM position: ${tmPosition}, role_changed audit entries: ${roleAudit}`);

  // 3.2: Anti-Self-Demotion check (verified in Phase 1A.1)
  const selfDemoteSql = `
    SET request.jwt.claim.sub = '${SA1_ID}';
    SELECT public.admin_update_account(
      _user_id := '${SA1_ID}',
      _display_name := 'Self Demote',
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
  const selfDemoteRes = runSqlCatchingError(selfDemoteSql);
  const selfDemoteBlocked = (selfDemoteRes.error || "").includes("Cannot demote own account (administrative self-lockout protection).");
  record("UPDT-02", "Self-Lockout Invariant", "Super Admin cannot demote self", selfDemoteBlocked, `Exception caught: ${selfDemoteBlocked}`);

  // =========================================================================
  // GROUP 4: MODULE PERMISSION MANAGEMENT (admin_update_account_permissions)
  // =========================================================================
  console.log("\n=======================================================================");
  console.log("GROUP 4: Custom Module Permissions Management Tests");
  console.log("=======================================================================");

  const permSql = `
    SET request.jwt.claim.sub = '${SA1_ID}';
    SELECT public.admin_update_account_permissions(
      _target_user_id := '${NEW_USER_ID}',
      _permissions := '{"clients": {"enabled": true, "actions": {"view": true, "create": true}}, "sales": {"enabled": false}}'::jsonb,
      _reason := 'Promoted to admin with clients module responsibility'
    );
  `;
  const permRes = runSqlCatchingError(permSql);
  const permSuccess = !permRes.error && permRes.stdout.includes('"success": true');
  const ssotPerms = runSql(`SELECT module, enabled FROM public.user_module_permissions WHERE user_id = '${NEW_USER_ID}' ORDER BY module;`);
  const cachePerms = runSql(`SELECT module_permissions FROM public.profiles WHERE id = '${NEW_USER_ID}';`);
  const permAudit = runSql(`SELECT COUNT(*) FROM public.account_audit_logs WHERE target_user_id = '${NEW_USER_ID}' AND action = 'account_permissions_updated';`);

  const permsSynchronized =
    permSuccess &&
    ssotPerms.includes("clients|t") &&
    ssotPerms.includes("sales|f") &&
    cachePerms.includes('"clients"') &&
    permAudit === "1";

  record("PERM-01", "Module Permissions", "Super Admin modifies module permissions; syncs SSOT, cache projection, and audit log", permsSynchronized, `SSOT: ${ssotPerms}, Cache: ${cachePerms}, Audit: ${permAudit}`);

  // 4.2: Anti-self-revocation of accounts module
  const selfRevokeSql = `
    SET request.jwt.claim.sub = '${SA1_ID}';
    SELECT public.admin_update_account_permissions(
      _target_user_id := '${SA1_ID}',
      _permissions := '{"accounts": false}'::jsonb
    );
  `;
  const selfRevokeRes = runSqlCatchingError(selfRevokeSql);
  const selfRevokeBlocked = (selfRevokeRes.error || "").includes("Cannot revoke own access to account management");
  record("PERM-02", "Self-Lockout Invariant", "Super Admin cannot revoke own access to accounts management", selfRevokeBlocked, `Exception caught: ${selfRevokeBlocked}`);

  // =========================================================================
  // GROUP 5: ACCOUNT SUSPENSION & SESSION REVOCATION (admin_suspend_account_with_sessions)
  // =========================================================================
  console.log("\n=======================================================================");
  console.log("GROUP 5: Account Suspension & Session Revocation Tests");
  console.log("=======================================================================");

  // Create an active session in user_sessions for NEW_USER_ID
  const SESS_ID = "sess_test_123456789";
  runSql(`
    INSERT INTO public.user_sessions (user_id, session_id, user_email, status, expires_at)
    VALUES ('${NEW_USER_ID}', '${SESS_ID}', '${NEW_USER_EMAIL}', 'active', now() + INTERVAL '1 day');
  `);

  // Super Admin suspends the account
  const suspSql = `
    SET request.jwt.claim.sub = '${SA1_ID}';
    SELECT public.admin_suspend_account_with_sessions(
      _target_user_id := '${NEW_USER_ID}',
      _reason := 'Investigation into security compliance'
    );
  `;
  const suspRes = runSqlCatchingError(suspSql);
  const suspSuccess = !suspRes.error && suspRes.stdout.includes('"status": "suspended"');

  const pStatus = runSql(`SELECT status FROM public.profiles WHERE id = '${NEW_USER_ID}';`);
  const uBan = runSql(`SELECT banned_until IS NOT NULL FROM auth.users WHERE id = '${NEW_USER_ID}';`);
  const tmActive = runSql(`SELECT is_active FROM public.team_members WHERE profile_id = '${NEW_USER_ID}';`);
  const postSessStatus = runSql(`SELECT status FROM public.user_sessions WHERE session_id = '${SESS_ID}';`);

  // Test is_session_active() when called by the suspended user
  const sessionActiveCheckSql = `
    SET request.jwt.claim.sub = '${NEW_USER_ID}';
    SELECT public.is_session_active();
  `;
  const isSessActive = runSql(sessionActiveCheckSql);

  const suspConsistent =
    suspSuccess &&
    pStatus === "suspended" &&
    uBan === "t" &&
    tmActive === "f" &&
    postSessStatus === "revoked" &&
    isSessActive === "f";

  record("SUSP-01", "Suspension Lifecycle", "Suspension updates profile status, bans in auth.users, deactivates team_member, and revokes active sessions", suspConsistent, `Profile status: ${pStatus}, Ban active: ${uBan}, TM active: ${tmActive}, Session: ${postSessStatus}, is_session_active(): ${isSessActive}`);

  // 5.2: Audit logging across audit tables
  const aalSusp = runSql(`SELECT COUNT(*) FROM public.account_audit_logs WHERE target_user_id = '${NEW_USER_ID}' AND action = 'account_suspended';`);
  const salSusp = runSql(`SELECT COUNT(*) FROM public.system_audit_logs WHERE entity_id = '${NEW_USER_ID}' AND action = 'ACCOUNT_SUSPENDED';`);
  const auditsComplete = aalSusp === "1" && salSusp === "1";
  record("SUSP-02", "Audit Trail Completeness", "Suspension writes to account_audit_logs and system_audit_logs", auditsComplete, `account_audit: ${aalSusp}, system_audit: ${salSusp}`);

  // =========================================================================
  // GROUP 6: ACCOUNT REACTIVATION (admin_reactivate_account_with_security)
  // =========================================================================
  console.log("\n=======================================================================");
  console.log("GROUP 6: Account Reactivation Tests");
  console.log("=======================================================================");

  const reactSql = `
    SET request.jwt.claim.sub = '${SA1_ID}';
    SELECT public.admin_reactivate_account_with_security(
      _target_user_id := '${NEW_USER_ID}',
      _reason := 'Investigation complete - cleared'
    );
  `;
  const reactRes = runSqlCatchingError(reactSql);
  const reactSuccess = !reactRes.error && reactRes.stdout.includes('"status": "active"');

  const pReactStatus = runSql(`SELECT status FROM public.profiles WHERE id = '${NEW_USER_ID}';`);
  const uReactBan = runSql(`SELECT banned_until IS NULL FROM auth.users WHERE id = '${NEW_USER_ID}';`);
  const tmReactActive = runSql(`SELECT is_active FROM public.team_members WHERE profile_id = '${NEW_USER_ID}';`);
  // Critical invariant: Revoked sessions MUST NOT be restored! Requires fresh authentication.
  const sessStillRevoked = runSql(`SELECT status FROM public.user_sessions WHERE session_id = '${SESS_ID}';`);

  const reactConsistent =
    reactSuccess &&
    pReactStatus === "active" &&
    uReactBan === "t" &&
    tmReactActive === "t" &&
    sessStillRevoked === "revoked";

  record("REACT-01", "Reactivation Lifecycle", "Reactivation restores profile, unbans auth user, activates team member, and LEAVES revoked sessions revoked", reactConsistent, `Profile: ${pReactStatus}, Unbanned: ${uReactBan}, TM active: ${tmReactActive}, Session status: ${sessStillRevoked}`);

  // =========================================================================
  // GROUP 7: PASSWORD RESET (admin_reset_account_password)
  // =========================================================================
  console.log("\n=======================================================================");
  console.log("GROUP 7: Password Reset Tests");
  console.log("=======================================================================");

  const resetSql = `
    SET request.jwt.claim.sub = '${SA1_ID}';
    SELECT public.admin_reset_account_password(
      _user_id := '${NEW_USER_ID}',
      _new_password := 'ComplexSecurePass2026!'
    );
  `;
  const resetRes = runSqlCatchingError(resetSql);
  const resetSuccess = !resetRes.error && resetRes.stdout.includes('"success": true');
  const encPass = runSql(`SELECT encrypted_password FROM auth.users WHERE id = '${NEW_USER_ID}';`);
  const passAudit = runSql(`SELECT metadata FROM public.account_audit_logs WHERE target_user_id = '${NEW_USER_ID}' AND action = 'password_changed';`);

  // Verify bcrypt hash format and verify password is NOT leaked in audit log
  const passHashValid = encPass.startsWith("$2a$") || encPass.startsWith("$2b$");
  const noPasswordInAudit = !passAudit.includes("ComplexSecurePass2026!");

  record("PASS-01", "Password Reset", "Super Admin resets password with bcrypt encryption and zero plaintext leakage in audit logs", resetSuccess && passHashValid && noPasswordInAudit, `Hash valid: ${passHashValid}, Zero audit leak: ${noPasswordInAudit}`);

  // 7.2: Minimum password length validation
  const shortPassSql = `
    SET request.jwt.claim.sub = '${SA1_ID}';
    SELECT public.admin_reset_account_password(
      _user_id := '${NEW_USER_ID}',
      _new_password := 'short'
    );
  `;
  const shortPassRes = runSqlCatchingError(shortPassSql);
  const shortPassBlocked = (shortPassRes.error || "").includes("Password must be at least 8 characters long.");
  record("PASS-02", "Password Policy", "Rejects passwords under 8 characters", shortPassBlocked, `Exception caught: ${shortPassBlocked}`);

  // =========================================================================
  // GROUP 8: ACCOUNT DELETION & DEPENDENCY HANDLING (admin_delete_account)
  // =========================================================================
  console.log("\n=======================================================================");
  console.log("GROUP 8: Account Deletion & Business Dependency Handling Tests");
  console.log("=======================================================================");

  // 8.1: Branch A — Account has dependencies (Assigned tasks)
  runSql(`
    INSERT INTO public.project_tasks (assignee_id, title)
    VALUES ('${NEW_USER_ID}', 'Deploy Production Infrastructure');
  `);

  const depAnalysisSql = `
    SET request.jwt.claim.sub = '${SA1_ID}';
    SELECT public.admin_analyze_account_dependencies(_user_id := '${NEW_USER_ID}');
  `;
  const depAnalysisRes = runSql(depAnalysisSql);
  const hasDeps = depAnalysisRes.includes('"has_business_dependencies": true');
  record("DEL-01", "Dependency Analysis", "Correctly detects business dependencies (assigned tasks)", hasDeps, `Analysis result: ${depAnalysisRes}`);

  // 8.2: DEL-02A — DEFECT-P2-01: Branch A fails with team_members_user_id_fkey violation
  const delBranchAFkSql = `
    SET request.jwt.claim.sub = '${SA1_ID}';
    SELECT public.admin_delete_account(_user_id := '${NEW_USER_ID}');
  `;
  const delBranchAFkRes = runSqlCatchingError(delBranchAFkSql);
  const teamMemberFkBlocked = (delBranchAFkRes.error || "").includes("team_members_user_id_fkey");
  record(
    "DEL-02A",
    "FK Omission Defect",
    "DEFECT-P2-01: admin_delete_account Branch A omits updating team_members.user_id = NULL, violating team_members_user_id_fkey",
    teamMemberFkBlocked,
    `Exception caught: ${teamMemberFkBlocked}`
  );

  // 8.3: DEL-02B — DEFECT-P2-02: Session immutability conflict prevents account deletion
  // Create an account with a session and no team_member FK obstacle
  const SESS_USER_ID = "eeeeeeee-1111-2222-3333-444444444444";
  const SESS_EMAIL = "sess.block@sada.tn";
  runSql(`
    INSERT INTO auth.users (id, email) VALUES ('${SESS_USER_ID}', '${SESS_EMAIL}');
    INSERT INTO public.profiles (id, display_name, status) VALUES ('${SESS_USER_ID}', 'Session Blocked', 'active');
    INSERT INTO public.user_roles (user_id, role) VALUES ('${SESS_USER_ID}', 'worker');
    INSERT INTO public.user_sessions (user_id, session_id, user_email, status, expires_at)
      VALUES ('${SESS_USER_ID}', 'sess_block_test_123', '${SESS_EMAIL}', 'active', now() + INTERVAL '1 day');
  `);

  const delWithSessionSql = `
    SET request.jwt.claim.sub = '${SA1_ID}';
    SELECT public.admin_delete_account(_user_id := '${SESS_USER_ID}');
  `;
  const delWithSessionRes = runSqlCatchingError(delWithSessionSql);
  const sessionImmutabilityBlocked = (delWithSessionRes.error || "").includes("Historical session records are immutable and cannot be deleted");
  record(
    "DEL-02B",
    "Session Conflict",
    "DEFECT-P2-02: admin_delete_account fails when account has sessions due to ON DELETE CASCADE vs immutability trigger",
    sessionImmutabilityBlocked,
    `Exception caught: ${sessionImmutabilityBlocked}`
  );

  // 8.4: DEL-02C — DEFECT-P2-03: Soft-archived profile is hard-deleted by profiles ON DELETE CASCADE
  const DEP_USER_ID = "ffffffff-ffff-ffff-ffff-ffffffffffff";
  const DEP_EMAIL = "dep.archived@sada.tn";
  runSql(`
    INSERT INTO auth.users (id, email) VALUES ('${DEP_USER_ID}', '${DEP_EMAIL}');
    INSERT INTO public.profiles (id, display_name, status) VALUES ('${DEP_USER_ID}', 'Archived Lead', 'active');
    INSERT INTO public.user_roles (user_id, role) VALUES ('${DEP_USER_ID}', 'worker');
    -- Insert team member without user_id foreign key constraint to test Branch A profile behavior
    INSERT INTO public.team_members (id, profile_id, name, email, is_active)
      VALUES (gen_random_uuid(), '${DEP_USER_ID}', 'Archived Lead', '${DEP_EMAIL}', true);
    INSERT INTO public.project_tasks (assignee_id, title) VALUES ('${DEP_USER_ID}', 'Historical Critical Task');
  `);

  const delBranchASql = `
    SET request.jwt.claim.sub = '${SA1_ID}';
    SELECT public.admin_delete_account(_user_id := '${DEP_USER_ID}');
  `;
  const delBranchARes = runSqlCatchingError(delBranchASql);
  const delBranchASuccess = !delBranchARes.error && delBranchARes.stdout.includes('"preserved_dependencies": true');

  const depTmDelinked = runSql(`SELECT profile_id IS NULL, is_active FROM public.team_members WHERE email = '${DEP_EMAIL}';`);
  const depAuthPurged = runSql(`SELECT COUNT(*) FROM auth.users WHERE id = '${DEP_USER_ID}';`);
  const depProfileCount = runSql(`SELECT COUNT(*) FROM public.profiles WHERE id = '${DEP_USER_ID}';`);

  // Document that while Branch A runs and de-links TM, profiles row is annihilated by FK cascade
  const branchAProfileAnnihilated = delBranchASuccess && depTmDelinked === "t|f" && depAuthPurged === "0" && depProfileCount === "0";
  record(
    "DEL-02C",
    "Profile Cascade Annihilation",
    "DEFECT-P2-03: Branch A soft-archived profile is wiped out by auth.users ON DELETE CASCADE foreign key",
    branchAProfileAnnihilated,
    `Branch A Success: ${delBranchASuccess}, TM delinked: ${depTmDelinked}, Auth purged: ${depAuthPurged}, Profiles remaining: ${depProfileCount} (expected 0 due to FK cascade)`
  );

  // 8.5: Branch B — Clean account deletion without dependencies
  const CLEAN_USER_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
  const CLEAN_EMAIL = "clean.temp@sada.tn";

  runSql(`
    INSERT INTO auth.users (id, email) VALUES ('${CLEAN_USER_ID}', '${CLEAN_EMAIL}');
    INSERT INTO public.profiles (id, display_name, status) VALUES ('${CLEAN_USER_ID}', 'Clean Temp', 'active');
    INSERT INTO public.user_roles (user_id, role) VALUES ('${CLEAN_USER_ID}', 'worker');
    INSERT INTO public.team_members (id, profile_id, name, email, is_active)
      VALUES (gen_random_uuid(), '${CLEAN_USER_ID}', 'Clean Temp', '${CLEAN_EMAIL}', true);
  `);

  const delBranchBSql = `
    SET request.jwt.claim.sub = '${SA1_ID}';
    SELECT public.admin_delete_account(_user_id := '${CLEAN_USER_ID}');
  `;
  const delBranchBRes = runSqlCatchingError(delBranchBSql);
  const delBranchBSuccess = !delBranchBRes.error && delBranchBRes.stdout.includes('"preserved_dependencies": false');

  const cleanTmExists = runSql(`SELECT COUNT(*) FROM public.team_members WHERE email = '${CLEAN_EMAIL}';`);
  const cleanPExists = runSql(`SELECT COUNT(*) FROM public.profiles WHERE id = '${CLEAN_USER_ID}';`);
  const cleanAuthExists = runSql(`SELECT COUNT(*) FROM auth.users WHERE id = '${CLEAN_USER_ID}';`);

  const branchBConsistent =
    delBranchBSuccess &&
    cleanTmExists === "0" &&
    cleanPExists === "0" &&
    cleanAuthExists === "0";

  record("DEL-03", "Clean Purge", "Branch B: Completely purges team_members, profiles, user_roles, and auth.users when zero dependencies exist", branchBConsistent, `TM count: ${cleanTmExists}, Profile count: ${cleanPExists}, Auth count: ${cleanAuthExists}`);

  // =========================================================================
  // GROUP 9: CLIENT-SIDE UTILITIES & SERVICE VALIDATION
  // =========================================================================
  console.log("\n=======================================================================");
  console.log("GROUP 9: Client-Side Utilities & Service Layer Tests");
  console.log("=======================================================================");

  // 9.1: Password Generator Quality
  const genPass = generateSecurePassword(16);
  const passLength = genPass.length === 16;
  const hasUpper = /[A-Z]/.test(genPass);
  const hasLower = /[a-z]/.test(genPass);
  const hasNum = /[0-9]/.test(genPass);
  const hasSymbol = /[!@#$%^&*-_+=]/.test(genPass);
  const passQuality = passLength && hasUpper && hasLower && hasNum && hasSymbol;
  record("UTIL-01", "Password Generator", "generateSecurePassword produces 16-char password meeting all entropy and character requirements", passQuality, `Generated: length=${genPass.length}, upper=${hasUpper}, lower=${hasLower}, num=${hasNum}, symbol=${hasSymbol}`);

  // 9.2: KPI Computation
  const mockAccounts: AccountRecord[] = [
    { user_id: "1", email: "sa@sada.tn", display_name: "SA", phone: null, role: "super_admin", status: "active", is_super_admin: true, created_at: "", last_sign_in_at: null, banned_until: null, team_member_id: null, team_member_name: null, team_position: null, division: null, photo_url: null, bio: null, specialties: [], socials: {}, published: false, is_active: true },
    { user_id: "2", email: "adm@sada.tn", display_name: "Adm", phone: null, role: "admin", status: "active", is_super_admin: false, created_at: "", last_sign_in_at: null, banned_until: null, team_member_id: null, team_member_name: null, team_position: null, division: null, photo_url: null, bio: null, specialties: [], socials: {}, published: false, is_active: true },
    { user_id: "3", email: "w1@sada.tn", display_name: "W1", phone: null, role: "worker", status: "suspended", is_super_admin: false, created_at: "", last_sign_in_at: null, banned_until: null, team_member_id: null, team_member_name: null, team_position: null, division: null, photo_url: null, bio: null, specialties: [], socials: {}, published: false, is_active: false },
    { user_id: "4", email: "w2@sada.tn", display_name: "W2", phone: null, role: "worker", status: "pending", is_super_admin: false, created_at: "", last_sign_in_at: null, banned_until: null, team_member_id: null, team_member_name: null, team_position: null, division: null, photo_url: null, bio: null, specialties: [], socials: {}, published: false, is_active: false },
    { user_id: "5", email: "w3@sada.tn", display_name: "W3", phone: null, role: "worker", status: "disabled", is_super_admin: false, created_at: "", last_sign_in_at: null, banned_until: null, team_member_id: null, team_member_name: null, team_position: null, division: null, photo_url: null, bio: null, specialties: [], socials: {}, published: false, is_active: false },
  ];
  const kpis = computeAccountKPIs(mockAccounts);
  const kpiValid =
    kpis.totalAccounts === 5 &&
    kpis.activeCount === 2 &&
    kpis.suspendedCount === 1 &&
    kpis.pendingCount === 1 &&
    kpis.disabledCount === 1 &&
    kpis.superAdminCount === 1 &&
    kpis.adminCount === 1 &&
    kpis.workerCount === 3;
  record("UTIL-02", "KPI Calculator", "computeAccountKPIs accurately counts statuses and roles", kpiValid, `Total: ${kpis.totalAccounts}, Active: ${kpis.activeCount}, Suspended: ${kpis.suspendedCount}, Worker: ${kpis.workerCount}`);

  // -------------------------------------------------------------------------
  // CLEANUP FIXTURES
  // -------------------------------------------------------------------------
  runSql(cleanFixturesSql);
  console.log("\n  All synthetic test fixtures cleanly purged from local database.");

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  const total = assertions.length;
  const passed = assertions.filter((a) => a.status === "PASS").length;
  const failed = assertions.filter((a) => a.status === "FAIL").length;

  console.log("\n=======================================================================");
  console.log("PHASE 2 ACCOUNT LIFECYCLE CERTIFICATION SUMMARY");
  console.log(`TOTAL ASSERTIONS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("=======================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
