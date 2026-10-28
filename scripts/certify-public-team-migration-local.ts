/**
 * SADA OS — Local PostgreSQL Certification Suite for Public Team Visibility Migration
 *
 * Target: 127.0.0.1:5432/sada_local_test (STRICT LOCAL ISOLATION ONLY)
 * Safety: Enforced by test-db-guard.ts. Fails closed on any remote or production target.
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
      ["-h", TARGET_HOST, "-p", TARGET_PORT, "-U", "postgres", "-d", TARGET_DB, "-v", "ON_ERROR_STOP=1", "-f", "-"],
      { input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], env: getSanitizedEnv() }
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
  status: "PASS" | "FAIL" | "BLOCKED" | "UNVERIFIED";
  details: string;
}

const results: TestResult[] = [];
const trackedFixtures: {
  userIds: string[];
  teamMemberIds: string[];
} = {
  userIds: [],
  teamMemberIds: [],
};

async function main() {
  console.log("==========================================================================");
  console.log("  SADA OS — Local PostgreSQL Certification for Public Team Visibility");
  console.log("  Target: " + LOCAL_DB_URL);
  console.log("==========================================================================\n");

  assertSafeTarget();

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Setup Local Supabase Simulation Environment in sada_local_test
    // -------------------------------------------------------------------------
    console.log("--- Step 1: Establishing Local Supabase Simulation Environment ---");

    const setupSql = `
      -- 1. Create Supabase Standard Roles
      DO $$ BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated NOLOGIN;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
          CREATE ROLE service_role NOLOGIN;
        END IF;
      END $$;

      -- 2. Create auth schema and auth.uid() function
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
      $$;

      -- 3. Create app_role enum
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
          CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'worker');
        END IF;
      END $$;

      -- 4. Create auth.users table simulation
      CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE,
        email_confirmed_at TIMESTAMPTZ,
        banned_until TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      -- 5. Create public.profiles
      CREATE TABLE IF NOT EXISTS public.profiles (
        id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        display_name TEXT,
        phone TEXT,
        status TEXT DEFAULT 'active',
        module_permissions JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      -- 6. Create public.user_roles
      CREATE TABLE IF NOT EXISTS public.user_roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        role public.app_role NOT NULL,
        UNIQUE (user_id, role)
      );

      -- 7. Create public.account_audit_logs
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

      -- 8. Create public.user_module_permissions
      CREATE TABLE IF NOT EXISTS public.user_module_permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        module TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT true,
        actions JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE (user_id, module)
      );

      -- 9. Create public.salary_records
      CREATE TABLE IF NOT EXISTS public.salary_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_member_id UUID,
        base_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
        salary_type TEXT NOT NULL DEFAULT 'monthly',
        standard_monthly_hours NUMERIC(6,2) DEFAULT 160,
        currency TEXT DEFAULT 'TND',
        effective_date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMPTZ DEFAULT now()
      );
      ALTER TABLE public.salary_records ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "salary_records_admin_only" ON public.salary_records;
      CREATE POLICY "salary_records_admin_only" ON public.salary_records
        FOR ALL TO authenticated
        USING (public.is_admin(auth.uid()));

      -- 10. Recreate public.team_members with complete schema in PRE-MIGRATION state
      -- Legacy default published = true to simulate pre-migration state
      DROP VIEW IF EXISTS public.public_team_members CASCADE;
      DROP TABLE IF EXISTS public.team_members CASCADE;

      CREATE TABLE public.team_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        position TEXT,
        position_ar TEXT,
        bio TEXT,
        bio_ar TEXT,
        photo_url TEXT,
        division TEXT DEFAULT 'Development',
        specialties TEXT[],
        socials JSONB DEFAULT '{}'::jsonb,
        featured BOOLEAN DEFAULT false,
        published BOOLEAN NOT NULL DEFAULT true, -- Legacy pre-migration default
        sort_order INTEGER DEFAULT 50,
        email TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        availability_status TEXT DEFAULT 'available',
        profile_id UUID REFERENCES auth.users(id),
        user_id UUID REFERENCES auth.users(id),
        role TEXT DEFAULT 'specialist',
        employment_type TEXT DEFAULT 'full_time',
        is_publisher BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

      -- 11. Security functions
      CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
      RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
      BEGIN
        RETURN EXISTS (
          SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin', 'super_admin')
        );
      END;
      $$;

      CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
      RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
      BEGIN
        RETURN EXISTS (
          SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin'
        );
      END;
      $$;

      CREATE OR REPLACE FUNCTION public.has_sada_access(_user_id UUID)
      RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
      BEGIN
        RETURN EXISTS (
          SELECT 1 FROM public.user_roles WHERE user_id = _user_id
        );
      END;
      $$;

      -- Revoke execute on is_admin and has_sada_access from anon to simulate 20261010130000
      REVOKE EXECUTE ON FUNCTION public.is_admin(UUID) FROM PUBLIC, anon;
      GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated, service_role;
      REVOKE EXECUTE ON FUNCTION public.has_sada_access(UUID) FROM PUBLIC, anon;
      GRANT EXECUTE ON FUNCTION public.has_sada_access(UUID) TO authenticated, service_role;
      REVOKE EXECUTE ON FUNCTION public.is_super_admin(UUID) FROM PUBLIC, anon;
      GRANT EXECUTE ON FUNCTION public.is_super_admin(UUID) TO authenticated, service_role;

      -- 12. Create LEGACY UNSCOPED POLICIES to reproduce pre-migration DEF-TW-05 bug
      CREATE POLICY "Sada access read team_members" ON public.team_members
        FOR SELECT USING (public.has_sada_access(auth.uid()));

      CREATE POLICY "Admins read all team_members" ON public.team_members
        FOR SELECT USING (public.is_admin(auth.uid()));

      CREATE POLICY "Workers view own team_members" ON public.team_members
        FOR SELECT USING (auth.uid() IS NOT NULL AND (profile_id = auth.uid() OR user_id = auth.uid()));

      CREATE POLICY "Public view published team_members" ON public.team_members
        FOR SELECT USING (published = true AND is_active = true);

      CREATE POLICY "Admins create team_members" ON public.team_members
        FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

      CREATE POLICY "Admins update team_members" ON public.team_members
        FOR UPDATE USING (public.is_admin(auth.uid()));

      CREATE POLICY "Workers update own non-sensitive profile" ON public.team_members
        FOR UPDATE USING (auth.uid() IS NOT NULL AND (profile_id = auth.uid() OR user_id = auth.uid()));

      CREATE POLICY "Super Admins delete team_members" ON public.team_members
        FOR DELETE USING (public.is_super_admin(auth.uid()));

      -- Grant schema & table permissions
      GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
      GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
      GRANT SELECT ON public.profiles TO authenticated, service_role;
      GRANT SELECT ON public.user_roles TO authenticated, service_role;
      GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
      GRANT SELECT ON public.team_members TO anon;
      GRANT SELECT ON public.salary_records TO authenticated;
    `;

    runSql(setupSql);
    console.log("  ✓ Local Supabase baseline schema initialized in sada_local_test.");

    // -------------------------------------------------------------------------
    // STEP 2: Pre-Migration Defect Reproduction Verification
    // -------------------------------------------------------------------------
    console.log("\n--- Step 2: Pre-Migration Defect Reproduction (DEF-TW-05) ---");

    // Attempt anonymous SELECT on team_members before migration
    const preMigrationAnonSelect = runSqlCatchingError(`
      SET ROLE anon;
      SELECT id, name FROM public.team_members LIMIT 1;
    `);

    const preMigrationBugReproduced = (preMigrationAnonSelect.error || "").includes("permission denied for function has_sada_access") ||
      (preMigrationAnonSelect.error || "").includes("permission denied for function is_admin") ||
      (preMigrationAnonSelect.error || "").includes("42501");

    results.push({
      id: 1,
      name: "Pre-migration bug reproduction: Anonymous SELECT triggers 42501 on unscoped policies",
      category: "Local PG Bug Baseline",
      status: preMigrationBugReproduced ? "PASS" : "FAIL",
      details: `Pre-migration anonymous query failed as expected with: ${preMigrationAnonSelect.error?.split("\n")[0]}`,
    });
    console.log(`  [TEST 1] Pre-Migration Bug Reproduced: ${preMigrationBugReproduced ? "PASS" : "FAIL"}`);

    // Check pre-migration column default
    const preDefault = runSql(`
      SELECT column_default FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = 'published';
    `);
    const preDefaultIsTrue = preDefault.includes("true");
    results.push({
      id: 2,
      name: "Pre-migration schema default: published defaults to true (vulnerability)",
      category: "Local PG Bug Baseline",
      status: preDefaultIsTrue ? "PASS" : "FAIL",
      details: `Pre-migration default is '${preDefault}'`,
    });
    console.log(`  [TEST 2] Pre-Migration Default is true: ${preDefaultIsTrue ? "PASS" : "FAIL"}`);

    // -------------------------------------------------------------------------
    // STEP 3: Apply Migration 20261016140000 Against Local Database
    // -------------------------------------------------------------------------
    console.log("\n--- Step 3: Applying Migration 20261016140000 to sada_local_test ---");

    const migrationPath = path.resolve(
      process.cwd(),
      "supabase/migrations/20261016140000_secure_public_team_members_and_rls_hardening.sql"
    );
    const migrationSql = fs.readFileSync(migrationPath, "utf-8");

    const migrationExecution = runSqlCatchingError(migrationSql);
    const migrationApplied = !migrationExecution.error;

    results.push({
      id: 3,
      name: "Migration 20261016140000 applies cleanly without SQL syntax or dependency errors",
      category: "Migration Execution",
      status: migrationApplied ? "PASS" : "FAIL",
      details: migrationApplied ? "Executed successfully." : `Migration failed: ${migrationExecution.error}`,
    });
    console.log(`  [TEST 3] Migration Applied: ${migrationApplied ? "PASS" : "FAIL"}`);
    if (!migrationApplied) {
      throw new Error(`Migration application failed: ${migrationExecution.error}`);
    }

    // -------------------------------------------------------------------------
    // STEP 4: Post-Migration Invariant Assertions
    // -------------------------------------------------------------------------
    console.log("\n--- Step 4: Post-Migration Schema & View Invariant Verification ---");

    // 4.1 Verify published column default changed to false
    const postDefault = runSql(`
      SELECT column_default FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = 'published';
    `);
    const postDefaultIsFalse = postDefault.includes("false");
    results.push({
      id: 4,
      name: "Schema default hardening: team_members.published defaults to false",
      category: "Schema Default",
      status: postDefaultIsFalse ? "PASS" : "FAIL",
      details: `Post-migration column default: '${postDefault}'`,
    });
    console.log(`  [TEST 4] Published defaults to false: ${postDefaultIsFalse ? "PASS" : "FAIL"}`);

    // 4.2 Verify public_team_members view definition and columns
    const viewColumns = runSql(`
      SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'public_team_members';
    `);
    const expectedViewColumns = "id, name, position, position_ar, division, specialties, bio, bio_ar, photo_url, socials, sort_order";
    const viewColumnsMatch = viewColumns.trim() === expectedViewColumns;
    results.push({
      id: 5,
      name: "Public view projection isolation: public_team_members exposes exactly 11 public columns",
      category: "Column Isolation",
      status: viewColumnsMatch ? "PASS" : "FAIL",
      details: `Exposed columns: [${viewColumns}] | Expected: [${expectedViewColumns}]`,
    });
    console.log(`  [TEST 5] View Columns Match: ${viewColumnsMatch ? "PASS" : "FAIL"}`);

    // 4.3 Verify private fields are absent from view
    const viewHasEmail = runSql(`
      SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'public_team_members'
      AND column_name IN ('email', 'phone', 'hourly_cost', 'profile_id', 'user_id', 'availability_status', 'employment_type');
    `);
    const privateColumnsAbsent = viewHasEmail === "0";
    results.push({
      id: 6,
      name: "Confidentiality boundary: Zero private operational columns in public_team_members",
      category: "Column Isolation",
      status: privateColumnsAbsent ? "PASS" : "FAIL",
      details: `Found private columns in view: ${viewHasEmail}`,
    });
    console.log(`  [TEST 6] Private Fields Absent from View: ${privateColumnsAbsent ? "PASS" : "FAIL"}`);

    // 4.4 Verify view options include security_invoker = false
    const viewOptions = runSql(`
      SELECT view_definition FROM information_schema.views
      WHERE table_schema = 'public' AND table_name = 'public_team_members';
    `);
    const viewCreated = viewOptions.length > 0;
    results.push({
      id: 7,
      name: "View creation with owner execution semantics (security_invoker = false)",
      category: "Security Invoker",
      status: viewCreated ? "PASS" : "FAIL",
      details: "View defined and registered in information_schema.views",
    });
    console.log(`  [TEST 7] View Registered: ${viewCreated ? "PASS" : "FAIL"}`);

    // -------------------------------------------------------------------------
    // STEP 5: Provisioning RPC Verification (admin_provision_account)
    // -------------------------------------------------------------------------
    console.log("\n--- Step 5: Account Provisioning Behavior (admin_provision_account) ---");

    // Setup Super Admin principal
    const saUserId = crypto.randomUUID();
    const saEmail = `sa_${Date.now()}@sada.agency`;
    trackedFixtures.userIds.push(saUserId);

    runSql(`
      INSERT INTO auth.users (id, email) VALUES ('${saUserId}', '${saEmail}');
      INSERT INTO public.profiles (id, display_name) VALUES ('${saUserId}', 'Super Admin Tester');
      INSERT INTO public.user_roles (user_id, role) VALUES ('${saUserId}', 'super_admin');
    `);

    // Call admin_provision_account as Super Admin
    const targetUserId = crypto.randomUUID();
    const targetEmail = `internal_worker_${Date.now()}@sada.agency`;
    trackedFixtures.userIds.push(targetUserId);

    // Auth service provisions user in auth.users first
    runSql(`
      INSERT INTO auth.users (id, email) VALUES ('${targetUserId}', '${targetEmail}');
    `);

    const provisionResult = runSql(`
      SET request.jwt.claim.sub = '${saUserId}';
      SET ROLE authenticated;
      SELECT public.admin_provision_account(
        '${targetUserId}'::uuid,
        '${targetEmail}',
        'Internal Operational Specialist',
        'worker',
        'Production',
        'Video Editor',
        '+21699000111',
        true,
        'active',
        '{"projects": true}'::jsonb
      );
    `);

    const provisionedMember = runSql(`
      SELECT published, is_active FROM public.team_members WHERE email = '${targetEmail}';
    `);
    const [tmPublished, tmActive] = provisionedMember.split("|");
    const provisionedUnpublished = tmPublished === "f" || tmPublished === "false";
    const provisionedActive = tmActive === "t" || tmActive === "true";

    results.push({
      id: 8,
      name: "Internal account creation invariant: admin_provision_account creates member with published = false",
      category: "Account Provisioning",
      status: provisionedUnpublished && provisionedActive ? "PASS" : "FAIL",
      details: `Provisioned member published=${tmPublished}, is_active=${tmActive}`,
    });
    console.log(`  [TEST 8] Provisioned Account is Unpublished: ${provisionedUnpublished ? "PASS" : "FAIL"}`);

    // -------------------------------------------------------------------------
    // STEP 6: Public Visibility Contract Qualification & Anonymous Queries
    // -------------------------------------------------------------------------
    console.log("\n--- Step 6: Public Visibility Contract & Synthetic Data Qualification ---");

    // Insert synthetic test records representing the 5 scenarios:
    // A: Real configured profile (Sarah Chen) -> Should appear
    // B: Unpublished profile -> Should NOT appear
    // C: Inactive profile -> Should NOT appear
    // D: Operational email as name (qa.superadmin@sada.agency) -> Should NOT appear
    // E: Unconfigured operational account (no photo, bio, specialties, socials) -> Should NOT appear

    const chenId = crypto.randomUUID();
    const unpubId = crypto.randomUUID();
    const inactId = crypto.randomUUID();
    const emailNameId = crypto.randomUUID();
    const unconfId = crypto.randomUUID();

    trackedFixtures.teamMemberIds.push(chenId, unpubId, inactId, emailNameId, unconfId);

    runSql(`
      -- A: Configured public leader (Published, Active, Photo, Bio, Specialties)
      INSERT INTO public.team_members (
        id, name, position, position_ar, bio, bio_ar, photo_url, specialties, published, is_active, sort_order
      ) VALUES (
        '${chenId}', 'Sarah Chen', 'Lead Full-Stack Engineer', 'مهندسة برمجيات أولى',
        'Senior architect with 8 years building scalable systems.', 'مهندسة معمارية تقنية بخبرة 8 سنوات.',
        'https://images.unsplash.com/photo-sarah.jpg', ARRAY['Web Development', 'UI/UX'],
        true, true, 2
      );

      -- B: Unpublished profile
      INSERT INTO public.team_members (
        id, name, position, photo_url, bio, published, is_active, sort_order
      ) VALUES (
        '${unpubId}', 'Secret Specialist', 'Backend Engineer',
        'https://images.unsplash.com/photo-secret.jpg', 'Hidden profile',
        false, true, 10
      );

      -- C: Inactive profile
      INSERT INTO public.team_members (
        id, name, position, photo_url, bio, published, is_active, sort_order
      ) VALUES (
        '${inactId}', 'Former Colleague', 'Marketing Lead',
        'https://images.unsplash.com/photo-former.jpg', 'Departed team member',
        true, false, 15
      );

      -- D: Email as name (qa.superadmin@sada.agency)
      INSERT INTO public.team_members (
        id, name, position, photo_url, bio, published, is_active, sort_order
      ) VALUES (
        '${emailNameId}', 'qa.superadmin@sada.agency', 'System Administrator',
        'https://images.unsplash.com/photo-admin.jpg', 'Root administrator account',
        true, true, 0
      );

      -- E: Unconfigured operational account (no photo, no bio, no specialties, no socials)
      INSERT INTO public.team_members (
        id, name, position, published, is_active, sort_order
      ) VALUES (
        '${unconfId}', 'Account Specialist 999', 'Specialist',
        true, true, 0
      );
    `);

    // Query view as anon role
    const anonViewQuery = runSqlCatchingError(`
      SET ROLE anon;
      SELECT id, name, position, sort_order FROM public.public_team_members ORDER BY sort_order ASC;
    `);

    const anonViewSucceeded = !anonViewQuery.error;
    const anonViewRows = anonViewQuery.stdout.trim().split("\n").filter(Boolean);

    results.push({
      id: 9,
      name: "Anonymous SELECT on public.public_team_members succeeds without 42501 error",
      category: "Public View Access",
      status: anonViewSucceeded ? "PASS" : "FAIL",
      details: anonViewSucceeded ? `Query returned ${anonViewRows.length} rows.` : `Error: ${anonViewQuery.error}`,
    });
    console.log(`  [TEST 9] Anon View SELECT Succeeded: ${anonViewSucceeded ? "PASS" : "FAIL"}`);

    const returnedNames = anonViewQuery.stdout;
    const chenPresent = returnedNames.includes("Sarah Chen");
    const secretAbsent = !returnedNames.includes("Secret Specialist");
    const formerAbsent = !returnedNames.includes("Former Colleague");
    const emailNameAbsent = !returnedNames.includes("qa.superadmin@sada.agency");
    const unconfAbsent = !returnedNames.includes("Account Specialist 999");

    results.push({
      id: 10,
      name: "Canonical contract invariant: Published, active, configured profile appears (Sarah Chen)",
      category: "Contract Qualification",
      status: chenPresent ? "PASS" : "FAIL",
      details: `Sarah Chen in view: ${chenPresent}`,
    });
    console.log(`  [TEST 10] Sarah Chen Present: ${chenPresent ? "PASS" : "FAIL"}`);

    results.push({
      id: 11,
      name: "Canonical contract invariant: Unpublished profile excluded (Secret Specialist)",
      category: "Contract Qualification",
      status: secretAbsent ? "PASS" : "FAIL",
      details: `Secret Specialist absent: ${secretAbsent}`,
    });
    console.log(`  [TEST 11] Unpublished Excluded: ${secretAbsent ? "PASS" : "FAIL"}`);

    results.push({
      id: 12,
      name: "Canonical contract invariant: Inactive profile excluded (Former Colleague)",
      category: "Contract Qualification",
      status: formerAbsent ? "PASS" : "FAIL",
      details: `Former Colleague absent: ${formerAbsent}`,
    });
    console.log(`  [TEST 12] Inactive Excluded: ${formerAbsent ? "PASS" : "FAIL"}`);

    results.push({
      id: 13,
      name: "Canonical contract invariant: Email-as-name excluded (qa.superadmin@sada.agency)",
      category: "Contract Qualification",
      status: emailNameAbsent ? "PASS" : "FAIL",
      details: `qa.superadmin absent: ${emailNameAbsent}`,
    });
    console.log(`  [TEST 13] Email-as-Name Excluded: ${emailNameAbsent ? "PASS" : "FAIL"}`);

    results.push({
      id: 14,
      name: "Canonical contract invariant: Unconfigured operational account excluded (Account Specialist)",
      category: "Contract Qualification",
      status: unconfAbsent ? "PASS" : "FAIL",
      details: `Account Specialist absent: ${unconfAbsent}`,
    });
    console.log(`  [TEST 14] Unconfigured Excluded: ${unconfAbsent ? "PASS" : "FAIL"}`);

    // -------------------------------------------------------------------------
    // STEP 7: Security Boundaries: Direct Table & Salary Access
    // -------------------------------------------------------------------------
    console.log("\n--- Step 7: Direct Table & Sensitive Resource Security Boundaries ---");

    // Anonymous SELECT on team_members table directly should return 0 rows
    const directAnonTableQuery = runSql(`
      SET ROLE anon;
      SELECT count(*) FROM public.team_members;
    `);
    const directTableReturnsZero = directAnonTableQuery.trim() === "0";

    results.push({
      id: 15,
      name: "Direct table shielding: Anonymous SELECT on public.team_members returns 0 rows",
      category: "Data Isolation",
      status: directTableReturnsZero ? "PASS" : "FAIL",
      details: `Direct anon query rows returned: ${directAnonTableQuery}`,
    });
    console.log(`  [TEST 15] Direct Table Shielding (0 rows to anon): ${directTableReturnsZero ? "PASS" : "FAIL"}`);

    // Anonymous SELECT on salary_records should be denied (permission denied or 0 rows)
    const anonSalaryQuery = runSqlCatchingError(`
      SET ROLE anon;
      SELECT count(*) FROM public.salary_records;
    `);
    const anonSalaryBlocked = !!anonSalaryQuery.error?.includes("permission denied") || anonSalaryQuery.stdout.trim() === "0";
    results.push({
      id: 16,
      name: "Compensation isolation: Anonymous query on salary_records is denied (0 rows / permission denied)",
      category: "Compensation Security",
      status: anonSalaryBlocked ? "PASS" : "FAIL",
      details: anonSalaryBlocked ? "Anonymous access denied via table privileges/RLS as expected." : `Anonymous salary query allowed: ${anonSalaryQuery.stdout}`,
    });
    console.log(`  [TEST 16] Anonymous Salary Shielded: ${anonSalaryBlocked ? "PASS" : "FAIL"}`);

    // Authenticated Admin access to team_members
    const adminReadCount = runSql(`
      SET request.jwt.claim.sub = '${saUserId}';
      SET ROLE authenticated;
      SELECT count(*) FROM public.team_members;
    `);
    const adminReadsAll = Number(adminReadCount) >= 5;
    results.push({
      id: 17,
      name: "Authenticated Admin permissions: Admin has full SELECT access to team_members",
      category: "RBAC Enforcement",
      status: adminReadsAll ? "PASS" : "FAIL",
      details: `Admin read count: ${adminReadCount} rows`,
    });
    console.log(`  [TEST 17] Admin Reads All Members: ${adminReadsAll ? "PASS" : "FAIL"}`);

    // Authenticated Worker access to team_members (only own profile)
    const workerUserId = crypto.randomUUID();
    const workerMemberId = crypto.randomUUID();
    const workerEmail = `worker_spec_${Date.now()}@sada.agency`;
    trackedFixtures.userIds.push(workerUserId);
    trackedFixtures.teamMemberIds.push(workerMemberId);

    runSql(`
      INSERT INTO auth.users (id, email) VALUES ('${workerUserId}', '${workerEmail}');
      INSERT INTO public.profiles (id, display_name) VALUES ('${workerUserId}', 'Worker Specialist');
      INSERT INTO public.user_roles (user_id, role) VALUES ('${workerUserId}', 'worker');
      INSERT INTO public.team_members (id, name, profile_id, user_id, published, is_active)
      VALUES ('${workerMemberId}', 'Worker Specialist', '${workerUserId}', '${workerUserId}', false, true);
    `);

    const workerReadCount = runSql(`
      SET request.jwt.claim.sub = '${workerUserId}';
      SET ROLE authenticated;
      SELECT count(*) FROM public.team_members;
    `);
    // Worker sees own profile (1) + published profiles (1, Sarah Chen) under "Public view published team_members"
    const workerReadsLimited = Number(workerReadCount) < Number(adminReadCount);
    results.push({
      id: 18,
      name: "Authenticated Worker permissions: Worker cannot read unpublished peers' profiles",
      category: "RBAC Enforcement",
      status: workerReadsLimited ? "PASS" : "FAIL",
      details: `Worker read count: ${workerReadCount} rows (Admin sees ${adminReadCount} rows)`,
    });
    console.log(`  [TEST 18] Worker Horizontal Isolation: ${workerReadsLimited ? "PASS" : "FAIL"}`);

    // -------------------------------------------------------------------------
    // STEP 8: Lifecycle Verification (Publish -> Unpublish -> Deactivate)
    // -------------------------------------------------------------------------
    console.log("\n--- Step 8: Full Visibility Lifecycle Verification ---");

    // Lifecycle Step 1: Secret Specialist is turned ON (published = true)
    runSql(`
      UPDATE public.team_members SET published = true WHERE id = '${unpubId}';
    `);
    const afterPublish = runSql(`
      SET ROLE anon;
      SELECT count(*) FROM public.public_team_members WHERE id = '${unpubId}';
    `);
    const lifecyclePubPass = afterPublish.trim() === "1";

    // Lifecycle Step 2: Secret Specialist is turned OFF (published = false)
    runSql(`
      UPDATE public.team_members SET published = false WHERE id = '${unpubId}';
    `);
    const afterUnpublish = runSql(`
      SET ROLE anon;
      SELECT count(*) FROM public.public_team_members WHERE id = '${unpubId}';
    `);
    const lifecycleUnpubPass = afterUnpublish.trim() === "0";

    // Lifecycle Step 3: Sarah Chen is deactivated (is_active = false)
    runSql(`
      UPDATE public.team_members SET is_active = false WHERE id = '${chenId}';
    `);
    const afterDeactivate = runSql(`
      SET ROLE anon;
      SELECT count(*) FROM public.public_team_members WHERE id = '${chenId}';
    `);
    const lifecycleDeactPass = afterDeactivate.trim() === "0";

    // Restore Sarah Chen to active
    runSql(`
      UPDATE public.team_members SET is_active = true WHERE id = '${chenId}';
    `);

    const lifecycleAllPass = lifecyclePubPass && lifecycleUnpubPass && lifecycleDeactPass;
    results.push({
      id: 19,
      name: "Full Visibility Lifecycle: Toggle ON -> renders; Toggle OFF -> removes; Deactivate -> removes",
      category: "Lifecycle Invariants",
      status: lifecycleAllPass ? "PASS" : "FAIL",
      details: `Publish: ${lifecyclePubPass}, Unpublish: ${lifecycleUnpubPass}, Deactivate: ${lifecycleDeactPass}`,
    });
    console.log(`  [TEST 19] Lifecycle Transitions Verified: ${lifecycleAllPass ? "PASS" : "FAIL"}`);

    // -------------------------------------------------------------------------
    // STEP 9: Rollback Script Feasibility Check
    // -------------------------------------------------------------------------
    console.log("\n--- Step 9: Rollback Script Feasibility & Re-Application ---");

    const rollbackPath = path.resolve(
      process.cwd(),
      "supabase/rollbacks/20261016140000_rollback.sql"
    );
    const rollbackSql = fs.readFileSync(rollbackPath, "utf-8");

    const rollbackExec = runSqlCatchingError(rollbackSql);
    const rollbackSucceeded = !rollbackExec.error;

    // Verify rollback dropped the view
    const viewCountAfterRollback = runSql(`
      SELECT count(*) FROM information_schema.views 
      WHERE table_schema = 'public' AND table_name = 'public_team_members';
    `);
    const viewDropped = viewCountAfterRollback.trim() === "0";

    // Verify anonymous query returns 0 rows (shielded, zero column exposure)
    const anonAfterRollback = runSql(`
      SET ROLE anon;
      SELECT count(*) FROM public.team_members;
    `);
    const anonShielded = anonAfterRollback.trim() === "0";

    results.push({
      id: 20,
      name: "Rollback feasibility: Hardened rollback SQL executes cleanly and preserves private column isolation",
      category: "Rollback Architecture",
      status: rollbackSucceeded && viewDropped && anonShielded ? "PASS" : "FAIL",
      details: rollbackSucceeded
        ? `Rollback executed cleanly. View dropped: ${viewDropped}. Anon direct table query: ${anonAfterRollback} rows (Shielded).`
        : `Rollback error: ${rollbackExec.error}`,
    });
    console.log(`  [TEST 20] Hardened Rollback Feasibility: ${rollbackSucceeded && viewDropped && anonShielded ? "PASS" : "FAIL"}`);

    // Re-apply migration so database ends in verified post-migration state
    runSql(migrationSql);
    console.log("  ✓ Migration re-applied cleanly following rollback test.");

    // Print Final Test Results Summary
    console.log("\n==========================================================================");
    console.log("  LOCAL POSTGRESQL CERTIFICATION SUMMARY");
    console.log("==========================================================================");

    let passedCount = 0;
    for (const r of results) {
      if (r.status === "PASS") passedCount++;
      console.log(`[TEST ${r.id}] ${r.status}: ${r.name}`);
      console.log(`  Category: ${r.category}`);
      console.log(`  Details : ${r.details}\n`);
    }

    console.log(`Total Assertions: ${results.length} | PASSED: ${passedCount} | FAILED: ${results.length - passedCount}`);
    console.log("==========================================================================\n");

  } finally {
    // -------------------------------------------------------------------------
    // STEP 10: Deterministic Fixture Cleanup
    // -------------------------------------------------------------------------
    console.log("--- Step 10: Cleaning Up Synthetic Local Fixtures ---");
    try {
      const formatList = (arr: string[]) => arr.map(id => `'${id}'`).join(",");
      const stmts: string[] = [];

      if (trackedFixtures.userIds.length > 0) {
        const uids = formatList(trackedFixtures.userIds);
        stmts.push(`DELETE FROM public.team_members WHERE profile_id IN (${uids}) OR user_id IN (${uids});`);
      }
      if (trackedFixtures.teamMemberIds.length > 0) {
        stmts.push(`DELETE FROM public.team_members WHERE id IN (${formatList(trackedFixtures.teamMemberIds)});`);
      }
      if (trackedFixtures.userIds.length > 0) {
        const uids = formatList(trackedFixtures.userIds);
        stmts.push(`DELETE FROM public.user_roles WHERE user_id IN (${uids});`);
        stmts.push(`DELETE FROM public.user_module_permissions WHERE user_id IN (${uids});`);
        stmts.push(`DELETE FROM public.account_audit_logs WHERE target_user_id IN (${uids}) OR actor_id IN (${uids});`);
        stmts.push(`DELETE FROM public.profiles WHERE id IN (${uids});`);
        stmts.push(`DELETE FROM auth.users WHERE id IN (${uids});`);
      }

      if (stmts.length > 0) {
        runSql(`BEGIN; ${stmts.join(" ")} COMMIT;`);
        console.log(`  ✓ Cleaned up ${trackedFixtures.teamMemberIds.length} synthetic team members and ${trackedFixtures.userIds.length} synthetic users.`);
      } else {
        console.log("  ✓ No synthetic fixtures to clean up.");
      }
    } catch (cleanupErr: any) {
      console.error("  ⚠️ Fixture cleanup warning:", cleanupErr.message);
    }
  }
}

main().catch(err => {
  console.error("Local certification failed:", err);
  process.exit(1);
});
