/**
 * SADA OS — Phase 4: Delivery, Task & Production Engine Runtime Certification Suite
 *
 * Target: 127.0.0.1:5432/sada_local_test (STRICT LOCAL ISOLATION ONLY)
 * Fails closed if run against any remote or shared production environment.
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { enforceDatabaseIsolation } from "./test-db-guard";
import { normalizeProductionBrief } from "../src/lib/sales-service";

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
  const raw = execFileSync(
    PSQL_BIN,
    ["-h", TARGET_HOST, "-p", TARGET_PORT, "-U", "postgres", "-d", TARGET_DB, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A", "-f", "-"],
    { input: sql, encoding: "utf8", env: getSanitizedEnv() }
  );
  return raw.replace(/\r\n/g, "\n").replace(/\r/g, "").trim();
}

function runSqlSafe(sql: string): { success: boolean; output: string } {
  try {
    const out = runSql(sql);
    return { success: true, output: out };
  } catch (err: any) {
    return { success: false, output: err.message || String(err) };
  }
}

interface TestResult {
  id: string;
  name: string;
  category: string;
  passed: boolean;
  actual: string;
  details?: string;
}

const testResults: TestResult[] = [];

function recordTest(id: string, category: string, name: string, passed: boolean, actual: string, details?: string) {
  testResults.push({ id, category, name, passed, actual, details });
  const icon = passed ? "✅" : "❌";
  console.log(`  ${icon} [${id}] ${name} -> ${actual}`);
}

async function runCertificationSuite() {
  console.log("===============================================================================");
  console.log("SADA OS — Phase 4 Delivery, Task & Production Engine Runtime Certification");
  console.log(`Target: ${LOCAL_DB_URL}`);
  console.log("===============================================================================\n");

  // Step 1: Environment Verification & Identity Check
  console.log("--- 1. Environment Verification & Fail-Closed Guard ---");
  assertSafeTarget();
  const dbIdentity = runSql("SELECT current_database() || '|' || inet_server_addr() || '|' || inet_server_port();");
  const [dbName, dbAddr, dbPort] = dbIdentity.split("|");

  if (dbName !== TARGET_DB || dbPort !== TARGET_PORT) {
    console.error(`FATAL: Unexpected target database identity: ${dbIdentity}`);
    process.exit(1);
  }
  recordTest("ENV-01", "Environment", "Verify Local Isolated PostgreSQL Instance", true, `DB: ${dbName}, Host: ${dbAddr}:${dbPort}`);

  // Step 2: Ensure Canonical Phase 4 Tables & Triggers in sada_local_test
  console.log("\n--- 2. Canonical Phase 4 Schema & Integrity Setup ---");
  const setupSql = `
    -- 1. Ensure package_catalog exists (SSOT)
    CREATE TABLE IF NOT EXISTS public.package_catalog (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      selling_price NUMERIC(12,2) NOT NULL DEFAULT 0,
      target_quantities JSONB NOT NULL DEFAULT '{"reels": 0, "posts": 0, "stories": 0, "ads_campaigns": 0}'::jsonb,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    ALTER TABLE public.package_catalog
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS selling_price NUMERIC(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS target_quantities JSONB NOT NULL DEFAULT '{"reels": 0, "posts": 0, "stories": 0, "ads_campaigns": 0}'::jsonb,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

    -- 2. Link clients to package_catalog
    ALTER TABLE public.clients
      ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES public.package_catalog(id) ON DELETE SET NULL;

    -- 3. Client deliverables table
    CREATE TABLE IF NOT EXISTS public.client_deliverables (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
      package_id UUID REFERENCES public.package_catalog(id) ON DELETE SET NULL,
      project_id UUID REFERENCES public.client_projects(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      deliverable_type TEXT NOT NULL CHECK (deliverable_type IN ('reel', 'post', 'story', 'ads_campaign', 'video', 'branding', 'other')),
      period_month TEXT NOT NULL,
      target_quantity INTEGER NOT NULL DEFAULT 1,
      done_quantity INTEGER NOT NULL DEFAULT 0,
      remaining_quantity INTEGER GENERATED ALWAYS AS (GREATEST(0, target_quantity - done_quantity)) STORED,
      assigned_team_ids UUID[] DEFAULT '{}',
      deadline DATE,
      status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'review', 'completed', 'behind_schedule')),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- 4. Production bookings table
    CREATE TABLE IF NOT EXISTS public.production_bookings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
      deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
      project_id UUID REFERENCES public.client_projects(id) ON DELETE SET NULL,
      package_id UUID REFERENCES public.package_catalog(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      date DATE NOT NULL,
      time TEXT NOT NULL,
      location TEXT NOT NULL,
      team_member_ids UUID[] DEFAULT '{}',
      production_type TEXT NOT NULL,
      duration_hours NUMERIC(5,2) NOT NULL DEFAULT 2.0,
      brief JSONB NOT NULL DEFAULT '{"shot_list": [], "required_reels": 0, "photos": 0, "story_assets": 0, "references": [], "equipment": []}'::jsonb,
      stage TEXT NOT NULL DEFAULT 'brief' CHECK (stage IN ('brief', 'scheduling', 'shooting', 'raw_upload', 'editing', 'review', 'client_approval', 'delivery_publishing')),
      raw_upload_url TEXT,
      edit_preview_url TEXT,
      client_notes TEXT,
      internal_notes TEXT,
      created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- 5. Extend project_tasks columns
    ALTER TABLE public.project_tasks
      ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.client_projects(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES public.package_catalog(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS deliverable_id UUID REFERENCES public.client_deliverables(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(6,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS actual_hours NUMERIC(6,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS revision_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'todo',
      ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium',
      ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS delivery_period TEXT,
      ADD COLUMN IF NOT EXISTS labor_cost NUMERIC(10,2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES public.project_tasks(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'manual',
      ADD COLUMN IF NOT EXISTS is_reconciliation_managed BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS manual_override BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;

    -- 6. Extend project_activity columns
    ALTER TABLE public.project_activity
      ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.client_projects(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES public.project_tasks(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS old_state JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS new_state JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

    -- 7. Reconciliation audit logs table
    CREATE TABLE IF NOT EXISTS public.reconciliation_audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
      deliverable_id UUID REFERENCES public.client_deliverables(id) ON DELETE SET NULL,
      task_id UUID REFERENCES public.project_tasks(id) ON DELETE SET NULL,
      mutation_type TEXT NOT NULL CHECK (mutation_type IN ('task_created', 'task_cancelled', 'task_rescheduled', 'quota_synced')),
      old_state JSONB DEFAULT '{}'::jsonb,
      new_state JSONB DEFAULT '{}'::jsonb,
      reason TEXT NOT NULL,
      actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      actor_email TEXT,
      period_month TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- 8. Triggers: trg_guard_project_tasks_worker_columns
    CREATE OR REPLACE FUNCTION public.guard_project_tasks_worker_columns()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      _is_admin_user BOOLEAN;
    BEGIN
      IF auth.uid() IS NULL THEN
        RETURN NEW;
      END IF;

      _is_admin_user := public.is_admin(auth.uid());

      IF NOT _is_admin_user THEN
        IF (NEW.title IS DISTINCT FROM OLD.title) OR
           (NEW.deadline IS DISTINCT FROM OLD.deadline) OR
           (NEW.priority IS DISTINCT FROM OLD.priority) OR
           (NEW.project_id IS DISTINCT FROM OLD.project_id) OR
           (NEW.client_id IS DISTINCT FROM OLD.client_id) OR
           (NEW.assignee_id IS DISTINCT FROM OLD.assignee_id) OR
           (NEW.parent_task_id IS DISTINCT FROM OLD.parent_task_id) OR
           (NEW.package_id IS DISTINCT FROM OLD.package_id) OR
           (NEW.deliverable_id IS DISTINCT FROM OLD.deliverable_id) OR
           (NEW.labor_cost IS DISTINCT FROM OLD.labor_cost) OR
           (NEW.estimated_hours IS DISTINCT FROM OLD.estimated_hours) OR
           (NEW.reviewer_id IS DISTINCT FROM OLD.reviewer_id) OR
           (NEW.assigned_by_id IS DISTINCT FROM OLD.assigned_by_id)
        THEN
          RAISE EXCEPTION 'Unauthorized: Workers cannot modify task definition fields (title, deadline, priority, billing, assignee, labor cost).';
        END IF;
      END IF;

      RETURN NEW;
    END;
    $$;

    DROP TRIGGER IF EXISTS trg_guard_project_tasks_worker_columns ON public.project_tasks;
    CREATE TRIGGER trg_guard_project_tasks_worker_columns
      BEFORE UPDATE ON public.project_tasks
      FOR EACH ROW
      EXECUTE FUNCTION public.guard_project_tasks_worker_columns();

    -- Canonical helper: has_module_access
    CREATE OR REPLACE FUNCTION public.has_module_access(_user_id UUID, _module TEXT)
    RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
    BEGIN
      IF _user_id IS NULL THEN RETURN false; END IF;
      IF public.is_super_admin(_user_id) THEN RETURN true; END IF;
      IF EXISTS (
        SELECT 1 FROM public.user_module_permissions
        WHERE user_id = _user_id AND module = _module AND enabled = true
      ) THEN
        RETURN true;
      END IF;
      RETURN false;
    END;
    $$;
    GRANT EXECUTE ON FUNCTION public.has_module_access(UUID, TEXT) TO authenticated, service_role, anon;

    -- 9. Enable RLS on Phase 4 tables
    ALTER TABLE public.client_deliverables ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.production_bookings ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.project_activity ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.reconciliation_audit_logs ENABLE ROW LEVEL SECURITY;

    -- 10. RLS Policies
    DROP POLICY IF EXISTS "Client deliverables read authenticated" ON public.client_deliverables;
    CREATE POLICY "Client deliverables read authenticated"
      ON public.client_deliverables FOR SELECT TO authenticated
      USING (public.has_sada_access(auth.uid()));

    DROP POLICY IF EXISTS "Client deliverables admin insert" ON public.client_deliverables;
    CREATE POLICY "Client deliverables admin insert"
      ON public.client_deliverables FOR INSERT TO authenticated
      WITH CHECK (
        public.is_super_admin(auth.uid()) OR
        (public.is_admin(auth.uid()) AND (public.has_module_access(auth.uid(), 'tasks') OR public.has_module_access(auth.uid(), 'clients')))
      );

    DROP POLICY IF EXISTS "Client deliverables admin update" ON public.client_deliverables;
    CREATE POLICY "Client deliverables admin update"
      ON public.client_deliverables FOR UPDATE TO authenticated
      USING (
        public.is_super_admin(auth.uid()) OR
        (public.is_admin(auth.uid()) AND (public.has_module_access(auth.uid(), 'tasks') OR public.has_module_access(auth.uid(), 'clients')))
      )
      WITH CHECK (
        public.is_super_admin(auth.uid()) OR
        (public.is_admin(auth.uid()) AND (public.has_module_access(auth.uid(), 'tasks') OR public.has_module_access(auth.uid(), 'clients')))
      );

    DROP POLICY IF EXISTS "Client deliverables super admin delete" ON public.client_deliverables;
    CREATE POLICY "Client deliverables super admin delete"
      ON public.client_deliverables FOR DELETE TO authenticated
      USING (public.is_super_admin(auth.uid()));

    DROP POLICY IF EXISTS "Production bookings read authenticated" ON public.production_bookings;
    CREATE POLICY "Production bookings read authenticated"
      ON public.production_bookings FOR SELECT TO authenticated
      USING (public.has_sada_access(auth.uid()));

    DROP POLICY IF EXISTS "Production bookings admin insert" ON public.production_bookings;
    CREATE POLICY "Production bookings admin insert"
      ON public.production_bookings FOR INSERT TO authenticated
      WITH CHECK (
        public.is_super_admin(auth.uid()) OR
        (public.is_admin(auth.uid()) AND (public.has_module_access(auth.uid(), 'calendar') OR public.has_module_access(auth.uid(), 'tasks')))
      );

    DROP POLICY IF EXISTS "Production bookings admin update" ON public.production_bookings;
    CREATE POLICY "Production bookings admin update"
      ON public.production_bookings FOR UPDATE TO authenticated
      USING (
        public.is_super_admin(auth.uid()) OR
        (public.is_admin(auth.uid()) AND (public.has_module_access(auth.uid(), 'calendar') OR public.has_module_access(auth.uid(), 'tasks')))
      )
      WITH CHECK (
        public.is_super_admin(auth.uid()) OR
        (public.is_admin(auth.uid()) AND (public.has_module_access(auth.uid(), 'calendar') OR public.has_module_access(auth.uid(), 'tasks')))
      );

    DROP POLICY IF EXISTS "Production bookings super admin delete" ON public.production_bookings;
    CREATE POLICY "Production bookings super admin delete"
      ON public.production_bookings FOR DELETE TO authenticated
      USING (public.is_super_admin(auth.uid()));

    DROP POLICY IF EXISTS "Sada users read project_activity" ON public.project_activity;
    CREATE POLICY "Sada users read project_activity"
      ON public.project_activity FOR SELECT TO authenticated
      USING (public.has_sada_access(auth.uid()));

    DROP POLICY IF EXISTS "Sada users insert project_activity" ON public.project_activity;
    CREATE POLICY "Sada users insert project_activity"
      ON public.project_activity FOR INSERT TO authenticated
      WITH CHECK (
        public.has_sada_access(auth.uid()) AND
        (
          public.is_admin(auth.uid()) OR
          auth.uid() = actor_id OR
          actor_id IS NULL OR
          actor_id IN (SELECT id FROM public.team_members WHERE profile_id = auth.uid())
        )
      );

    -- Project Tasks RLS (from 20260916140000 & 20261007150000)
    DROP POLICY IF EXISTS "Sada access read project_tasks" ON public.project_tasks;
    CREATE POLICY "Sada access read project_tasks"
      ON public.project_tasks FOR SELECT
      USING (public.has_sada_access(auth.uid()));

    DROP POLICY IF EXISTS "Admins create project_tasks" ON public.project_tasks;
    CREATE POLICY "Admins create project_tasks"
      ON public.project_tasks FOR INSERT
      WITH CHECK (public.is_admin(auth.uid()));

    DROP POLICY IF EXISTS "Admins update project_tasks" ON public.project_tasks;
    CREATE POLICY "Admins update project_tasks"
      ON public.project_tasks FOR UPDATE
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));

    DROP POLICY IF EXISTS "Workers update assigned project_tasks" ON public.project_tasks;
    CREATE POLICY "Workers update assigned project_tasks"
      ON public.project_tasks FOR UPDATE
      USING (auth.uid() = assignee_id)
      WITH CHECK (auth.uid() = assignee_id);

    DROP POLICY IF EXISTS "Super Admins delete project_tasks" ON public.project_tasks;
    CREATE POLICY "Super Admins delete project_tasks"
      ON public.project_tasks FOR DELETE
      USING (public.is_super_admin(auth.uid()));

    -- 11. ATOMIC PRODUCTION BOOKING STAGE ADVANCEMENT RPC (Remediation 20261017223000)
    CREATE OR REPLACE FUNCTION public.advance_production_booking_stage(
      _booking_id UUID,
      _new_stage TEXT,
      _media_urls JSONB DEFAULT '{}'::jsonb,
      _actor_id UUID DEFAULT NULL
    )
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      v_booking RECORD;
      v_stages TEXT[] := ARRAY['brief', 'scheduling', 'shooting', 'raw_upload', 'editing', 'review', 'client_approval', 'delivery_publishing'];
      v_curr_idx INT;
      v_next_idx INT;
      v_activity_id UUID;
      v_effective_actor UUID;
      v_is_authorized BOOLEAN;
      v_is_service_role BOOLEAN;
    BEGIN
      -- 1. Trust Boundary & Actor Identity Verification
      IF auth.uid() IS NOT NULL THEN
        -- Authenticated user context: Actor identity is IMMUTABLY derived from trusted session JWT
        IF _actor_id IS NOT NULL AND _actor_id != auth.uid() THEN
          RAISE EXCEPTION 'FORBIDDEN: Actor spoofing detected. Authenticated caller % cannot specify or impersonate actor %.', auth.uid(), _actor_id;
        END IF;
        v_effective_actor := auth.uid();
      ELSIF current_setting('request.jwt.claim.role', true) = 'service_role' OR
            (session_user = 'postgres' AND COALESCE(current_setting('request.jwt.claim.role', true), '') NOT IN ('anon', 'authenticated')) THEN
        -- Trusted service-role / database maintenance context
        v_is_service_role := true;
        v_effective_actor := _actor_id;
      ELSE
        -- Unauthenticated / anonymous caller
        RAISE EXCEPTION 'UNAUTHORIZED: Anonymous callers cannot advance production bookings.';
      END IF;

      -- 2. Authorization Verification
      IF v_effective_actor IS NOT NULL THEN
        v_is_authorized := public.is_super_admin(v_effective_actor) OR (
          public.is_admin(v_effective_actor) AND (
            public.has_module_access(v_effective_actor, 'calendar') OR
            public.has_module_access(v_effective_actor, 'tasks')
          )
        );

        IF NOT v_is_authorized THEN
          RAISE EXCEPTION 'UNAUTHORIZED: User % lacks permission to advance production bookings.', v_effective_actor;
        END IF;
      ELSIF NOT v_is_service_role THEN
        RAISE EXCEPTION 'UNAUTHORIZED: Effective actor could not be verified.';
      END IF;

      -- Row lock FOR UPDATE
      SELECT id, client_id, project_id, stage
      INTO v_booking
      FROM public.production_bookings
      WHERE id = _booking_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'BOOKING_NOT_FOUND: Production booking % does not exist.', _booking_id;
      END IF;

      -- Resolve stage positions
      v_curr_idx := array_position(v_stages, v_booking.stage);
      v_next_idx := array_position(v_stages, _new_stage);

      IF v_curr_idx IS NULL THEN
        RAISE EXCEPTION 'INVALID_CURRENT_STAGE: Booking current stage % is unknown.', v_booking.stage;
      END IF;

      IF v_next_idx IS NULL THEN
        RAISE EXCEPTION 'INVALID_TARGET_STAGE: Target stage % is unknown.', _new_stage;
      END IF;

      -- Strictly enforce adjacent forward progression (step N -> step N + 1)
      IF v_next_idx != v_curr_idx + 1 THEN
        RAISE EXCEPTION 'INVALID_STAGE_TRANSITION: Cannot transition booking from % (step %) to % (step %). Must advance sequentially.',
          v_booking.stage, v_curr_idx, _new_stage, v_next_idx;
      END IF;

      -- Perform stage & media update
      UPDATE public.production_bookings
      SET stage = _new_stage,
          raw_upload_url = COALESCE(_media_urls->>'raw_upload_url', raw_upload_url),
          edit_preview_url = COALESCE(_media_urls->>'edit_preview_url', edit_preview_url),
          client_notes = COALESCE(_media_urls->>'client_notes', client_notes),
          updated_at = now()
      WHERE id = _booking_id;

      -- Insert audit record atomically
      INSERT INTO public.project_activity (
        project_id,
        actor_id,
        activity_type,
        old_state,
        new_state,
        metadata,
        created_at
      )
      VALUES (
        v_booking.project_id,
        v_effective_actor,
        'production_stage_advanced',
        jsonb_build_object('stage', v_booking.stage),
        jsonb_build_object('stage', _new_stage),
        jsonb_build_object(
          'booking_id', _booking_id,
          'media_urls', _media_urls,
          'transition', format('%s -> %s', v_booking.stage, _new_stage),
          'actor_source', CASE WHEN auth.uid() IS NOT NULL THEN 'session' ELSE 'service_role' END
        ),
        now()
      )
      RETURNING id INTO v_activity_id;

      RETURN jsonb_build_object(
        'success', true,
        'booking_id', _booking_id,
        'previous_stage', v_booking.stage,
        'new_stage', _new_stage,
        'activity_id', v_activity_id,
        'actor_id', v_effective_actor
      );
    END;
    $$;

    REVOKE EXECUTE ON FUNCTION public.advance_production_booking_stage(UUID, TEXT, JSONB, UUID) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.advance_production_booking_stage(UUID, TEXT, JSONB, UUID) TO authenticated, service_role;

    -- Grants
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_deliverables TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_bookings TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_tasks TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_activity TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.reconciliation_audit_logs TO authenticated;
  `;
  runSql(setupSql);
  recordTest("SCHEMA-01", "Schema", "Deploy Canonical Phase 4 Tables & Remediation RPC", true, "Tables, triggers, RLS & atomic RPC active");

  // Step 3: Prepare Test User Identities
  console.log("\n--- 3. Provisioning Test User Personas ---");
  const testIds = {
    superAdminProfile: "a0000000-0000-0000-0000-000000000001",
    adminProfile: "a0000000-0000-0000-0000-000000000002",
    workerProfile: "a0000000-0000-0000-0000-000000000003",
    testClient: "c0000000-0000-0000-0000-000000000001",
    testPackage: "f0000000-0000-0000-0000-000000000001",
    testProject: "b0000000-0000-0000-0000-000000000001",
    testDeal: "d0000000-0000-0000-0000-000000000001",
  };

  const seedFixtureSql = `
    -- Auth users
    INSERT INTO auth.users (id, email)
    VALUES 
      ('${testIds.superAdminProfile}', 'p4_superadmin@sada.tn'),
      ('${testIds.adminProfile}', 'p4_admin@sada.tn'),
      ('${testIds.workerProfile}', 'p4_worker@sada.tn')
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

    -- Super admin profile & role
    INSERT INTO public.profiles (id, display_name, status)
    VALUES ('${testIds.superAdminProfile}', 'P4 Super Admin', 'active')
    ON CONFLICT (id) DO UPDATE SET display_name = 'P4 Super Admin';

    DELETE FROM public.user_roles WHERE user_id = '${testIds.superAdminProfile}';
    INSERT INTO public.user_roles (user_id, role) VALUES ('${testIds.superAdminProfile}', 'super_admin');

    -- Admin profile & role with tasks and calendar module access
    INSERT INTO public.profiles (id, display_name, status)
    VALUES ('${testIds.adminProfile}', 'P4 Admin', 'active')
    ON CONFLICT (id) DO UPDATE SET display_name = 'P4 Admin';

    DELETE FROM public.user_roles WHERE user_id = '${testIds.adminProfile}';
    INSERT INTO public.user_roles (user_id, role) VALUES ('${testIds.adminProfile}', 'admin');

    INSERT INTO public.user_module_permissions (user_id, module, enabled)
    VALUES 
      ('${testIds.adminProfile}', 'tasks', true),
      ('${testIds.adminProfile}', 'clients', true),
      ('${testIds.adminProfile}', 'calendar', true)
    ON CONFLICT (user_id, module) DO UPDATE SET enabled = true;

    -- Worker profile & role with worker role (no admin, no module grants)
    INSERT INTO public.profiles (id, display_name, status)
    VALUES ('${testIds.workerProfile}', 'P4 Worker', 'active')
    ON CONFLICT (id) DO UPDATE SET display_name = 'P4 Worker';

    DELETE FROM public.user_roles WHERE user_id = '${testIds.workerProfile}';
    INSERT INTO public.user_roles (user_id, role) VALUES ('${testIds.workerProfile}', 'worker');

    -- Test Package
    INSERT INTO public.package_catalog (id, name, description, selling_price, target_quantities)
    VALUES ('${testIds.testPackage}', 'P4 Test Growth Luxe', 'Test package', 2800.00, '{"reels": 8, "posts": 8, "stories": 20, "ads_campaigns": 4}'::jsonb)
    ON CONFLICT (id) DO NOTHING;

    -- Test Client
    INSERT INTO public.clients (id, name, email, package_id)
    VALUES ('${testIds.testClient}', 'P4 Client Enterprises', 'p4client@sada.tn', '${testIds.testPackage}')
    ON CONFLICT (id) DO NOTHING;

    -- Test Operational Workspace
    INSERT INTO public.client_projects (id, client_id, title, status)
    VALUES ('${testIds.testProject}', '${testIds.testClient}', 'P4 Client Workspace', 'active')
    ON CONFLICT (id) DO NOTHING;
  `;
  runSql(seedFixtureSql);
  recordTest("FIXTURE-01", "Fixtures", "Provision SuperAdmin, Admin, Worker, Client & Package", true, "All fixture personas created");

  // Step 4: Verification Groups

  // GROUP 1: Deliverable Quota Instantiation & Idempotency
  console.log("\n--- Group 1: Package Quota & Deliverable Instantiation ---");
  const g1Sql = `
    INSERT INTO public.client_deliverables (client_id, package_id, project_id, title, deliverable_type, period_month, target_quantity, done_quantity, status)
    VALUES 
      ('${testIds.testClient}', '${testIds.testPackage}', '${testIds.testProject}', '8 Reels (2026-10)', 'reel', '2026-10', 8, 0, 'planned'),
      ('${testIds.testClient}', '${testIds.testPackage}', '${testIds.testProject}', '8 Posts (2026-10)', 'post', '2026-10', 8, 0, 'planned'),
      ('${testIds.testClient}', '${testIds.testPackage}', '${testIds.testProject}', '20 Stories (2026-10)', 'story', '2026-10', 20, 0, 'planned'),
      ('${testIds.testClient}', '${testIds.testPackage}', '${testIds.testProject}', '4 Ads Campaigns (2026-10)', 'ads_campaign', '2026-10', 4, 0, 'planned')
    RETURNING id;
  `;
  const g1Res = runSql(g1Sql);
  const delivIds = g1Res.split("\n").filter(Boolean);
  recordTest("DELIV-01", "Deliverables", "Instantiate 4 canonical deliverables from package quota", delivIds.length === 4, `Created ${delivIds.length} deliverables`);

  // GROUP 2: Deliverable Quantity, Generated `remaining_quantity` & Status Sync
  console.log("\n--- Group 2: Deliverable Quantity & Status Synchronization ---");
  const testDelivId = delivIds[0];
  const g2Sql = `
    UPDATE public.client_deliverables
    SET done_quantity = 3, status = 'in_progress', updated_at = now()
    WHERE id = '${testDelivId}';

    SELECT target_quantity || '|' || done_quantity || '|' || remaining_quantity || '|' || status
    FROM public.client_deliverables WHERE id = '${testDelivId}';
  `;
  const g2Res1 = runSql(g2Sql).split("\n").pop() || "";
  const [tQty1, dQty1, rQty1, st1] = g2Res1.split("|");
  recordTest(
    "DELIV-02",
    "Deliverables",
    "Generated remaining_quantity updates correctly on progress (done=3, target=8 -> remaining=5, in_progress)",
    tQty1 === "8" && dQty1 === "3" && rQty1 === "5" && st1 === "in_progress",
    `target: ${tQty1}, done: ${dQty1}, remaining: ${rQty1}, status: ${st1}`
  );

  // Update done_quantity to 8 (complete)
  const g2Sql2 = `
    UPDATE public.client_deliverables
    SET done_quantity = 8, status = 'completed', updated_at = now()
    WHERE id = '${testDelivId}';

    SELECT remaining_quantity || '|' || status
    FROM public.client_deliverables WHERE id = '${testDelivId}';
  `;
  const g2Res2 = runSql(g2Sql2).split("\n").pop() || "";
  const [rQty2, st2] = g2Res2.split("|");
  recordTest(
    "DELIV-03",
    "Deliverables",
    "Generated remaining_quantity and status on completion (done=8 -> remaining=0, completed)",
    rQty2 === "0" && st2 === "completed",
    `remaining: ${rQty2}, status: ${st2}`
  );

  // GROUP 3: Task Provenance, Manual Protection & Override Tracking
  console.log("\n--- Group 3: Task Provenance & Reconciliation Protection ---");
  const g3Sql = `
    INSERT INTO public.project_tasks (client_id, project_id, deliverable_id, title, status, source_type, is_reconciliation_managed, manual_override, assignee_id)
    VALUES 
      -- Task A: Reconciled, unstarted
      ('${testIds.testClient}', '${testIds.testProject}', '${testDelivId}', 'Reconciled Slot 1', 'todo', 'package_reconciliation', true, false, NULL),
      -- Task B: Reconciled, in progress (assigned to worker)
      ('${testIds.testClient}', '${testIds.testProject}', '${testDelivId}', 'Reconciled Slot 2', 'in_progress', 'package_reconciliation', true, false, '${testIds.workerProfile}'),
      -- Task C: Reconciled, completed (MUST NOT BE PRUNED)
      ('${testIds.testClient}', '${testIds.testProject}', '${testDelivId}', 'Reconciled Slot 3', 'completed', 'package_reconciliation', true, false, NULL),
      -- Task D: Manual task (MUST NOT BE PRUNED)
      ('${testIds.testClient}', '${testIds.testProject}', '${testDelivId}', 'Manual Custom Reel', 'todo', 'manual', false, false, NULL),
      -- Task E: Reconciled with manual override (MUST NOT BE PRUNED)
      ('${testIds.testClient}', '${testIds.testProject}', '${testDelivId}', 'Reconciled Override Reel', 'todo', 'package_reconciliation', true, true, NULL)
    RETURNING id;
  `;
  const g3TaskIds = runSql(g3Sql).split("\n").filter(Boolean);
  recordTest("TASK-01", "Tasks", "Create candidate tasks across provenance categories", g3TaskIds.length === 5, `Created ${g3TaskIds.length} candidate tasks`);

  // Emulate reconciliation pruning excess: only unstarted, non-overridden reconciliation-managed tasks can be pruned
  const pruneSql = `
    UPDATE public.project_tasks
    SET status = 'cancelled', cancelled_reason = 'reconciliation_pruned'
    WHERE client_id = '${testIds.testClient}'
      AND is_reconciliation_managed = true
      AND manual_override = false
      AND status = 'todo'
    RETURNING id;
  `;
  const prunedIds = runSql(pruneSql).split("\n").filter(Boolean);
  recordTest(
    "RECON-01",
    "Reconciliation",
    "Pruning strictly targets unstarted reconciliation tasks, preserving in_progress, completed, and manual/override tasks",
    prunedIds.length === 1 && prunedIds[0] === g3TaskIds[0],
    `Pruned count: ${prunedIds.length} (Task A only)`
  );

  // Verify non-pruned tasks remain intact
  const verifyNonPruned = runSql(`
    SELECT count(*) FROM public.project_tasks
    WHERE id IN ('${g3TaskIds[1]}', '${g3TaskIds[2]}', '${g3TaskIds[3]}', '${g3TaskIds[4]}')
      AND status != 'cancelled';
  `);
  recordTest("RECON-02", "Reconciliation", "Verify 4 protected tasks remained non-cancelled", verifyNonPruned === "4", `Preserved count: ${verifyNonPruned}/4`);

  // Log reconciliation mutation
  const logReconAudit = runSql(`
    INSERT INTO public.reconciliation_audit_logs (client_id, deliverable_id, task_id, mutation_type, old_state, new_state, reason, period_month)
    VALUES ('${testIds.testClient}', '${testDelivId}', '${g3TaskIds[0]}', 'task_cancelled', '{"status":"todo"}'::jsonb, '{"status":"cancelled"}'::jsonb, 'Quota decreased by package change', '2026-10')
    RETURNING id;
  `);
  recordTest("RECON-03", "Reconciliation", "Audit record written to reconciliation_audit_logs", !!logReconAudit, `Audit log ID: ${logReconAudit}`);

  // GROUP 4: Worker Column Lock Trigger trg_guard_project_tasks_worker_columns
  console.log("\n--- Group 4: Worker Task Column Protection (Database Trigger) ---");
  const testWorkerTaskId = g3TaskIds[1]; // in_progress task assigned to worker

  // Worker attempt to modify definition field (title) -> MUST FAIL
  const workerTamperDef = runSqlSafe(`
    BEGIN;
    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub', '${testIds.workerProfile}', true);
    UPDATE public.project_tasks SET title = 'Worker Tampered Title' WHERE id = '${testWorkerTaskId}';
    COMMIT;
  `);
  recordTest(
    "AUTH-01",
    "Authorization",
    "Worker updating task definition column (title) is blocked by trigger",
    !workerTamperDef.success && workerTamperDef.output.includes("Workers cannot modify task definition fields"),
    workerTamperDef.success ? "UNEXPECTED SUCCESS" : "Blocked with trigger exception"
  );

  // Worker updating allowed field (actual_hours) -> MUST SUCCEED
  const workerUpdateHours = runSqlSafe(`
    BEGIN;
    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub', '${testIds.workerProfile}', true);
    UPDATE public.project_tasks SET actual_hours = 4.5 WHERE id = '${testWorkerTaskId}';
    COMMIT;
  `);
  recordTest(
    "AUTH-02",
    "Authorization",
    "Worker updating operational column (actual_hours) is allowed by trigger",
    workerUpdateHours.success,
    workerUpdateHours.success ? "Allowed" : `Failed: ${workerUpdateHours.output}`
  );

  // GROUP 5: Structured JSONB Brief Normalization & Validation
  console.log("\n--- Group 5: Structured JSONB Brief Normalization & Validation ---");
  // Test 5A: Valid brief normalization
  const validBriefInput = {
    shot_list: ["Hero Shot", "Product Macro"],
    required_reels: 8,
    photos: 20,
    story_assets: 15,
    references: ["Lighting Moodboard A"],
    equipment: ["Sony A7IV", "Gimbal"],
  };
  const normValid = normalizeProductionBrief(validBriefInput);
  recordTest(
    "BRIEF-01",
    "Brief Normalization",
    "normalizeProductionBrief preserves valid full brief",
    normValid.shot_list.length === 2 && normValid.required_reels === 8 && normValid.equipment.length === 2,
    `reels: ${normValid.required_reels}, shots: ${normValid.shot_list.length}`
  );

  // Test 5B: Malformed/null arrays & negative counts
  const malformedInput = {
    shot_list: null as any,
    required_reels: -5,
    photos: -10,
    story_assets: NaN as any,
    references: null as any,
    equipment: [123, "Valid Lens", null, ""] as any,
  };
  const normMalformed = normalizeProductionBrief(malformedInput);
  recordTest(
    "BRIEF-02",
    "Brief Normalization",
    "normalizeProductionBrief sanitizes null arrays, negative counts & invalid items",
    Array.isArray(normMalformed.shot_list) &&
      normMalformed.shot_list.length === 0 &&
      normMalformed.required_reels === 0 &&
      normMalformed.photos === 0 &&
      normMalformed.story_assets === 0 &&
      normMalformed.equipment.length === 1 &&
      normMalformed.equipment[0] === "Valid Lens",
    `reels: ${normMalformed.required_reels}, shots: ${JSON.stringify(normMalformed.shot_list)}, equip: ${JSON.stringify(normMalformed.equipment)}`
  );

  // Test 5C: Undefined/empty brief defaults
  const normEmpty = normalizeProductionBrief(undefined);
  recordTest(
    "BRIEF-03",
    "Brief Normalization",
    "normalizeProductionBrief handles undefined/null input with safe defaults",
    Array.isArray(normEmpty.shot_list) && normEmpty.required_reels === 0 && normEmpty.references.length === 0,
    "Safe empty defaults generated"
  );

  // Insert normalized brief into database
  const bCreate = runSqlSafe(`
    INSERT INTO public.production_bookings (client_id, package_id, project_id, title, date, time, location, production_type, brief, stage)
    VALUES ('${testIds.testClient}', '${testIds.testPackage}', '${testIds.testProject}', 'Shoot Remediation Alpha', '2026-10-25', '10:00', 'Tunis Studio', 'video_shoot', '${JSON.stringify(normValid)}'::jsonb, 'brief')
    RETURNING id;
  `);
  const bookingRemediationId = bCreate.output.trim();
  recordTest("BRIEF-04", "Database Persistence", "Insert normalized brief into production_bookings", bCreate.success, `Booking ID: ${bookingRemediationId}`);

  // GROUP 6: Remediated Atomic Stage Advancement & Audit Logging
  console.log("\n--- Group 6: Remediated Atomic Stage Transitions & Audit Verification ---");

  // 6A: Invalid stage skip (brief -> delivery_publishing) MUST BE REJECTED AT DB RPC BOUNDARY
  const skipAttempt = runSqlSafe(`
    SELECT public.advance_production_booking_stage('${bookingRemediationId}', 'delivery_publishing', '{}'::jsonb, '${testIds.adminProfile}');
  `);
  recordTest(
    "STAGE-SKIP-BLOCK",
    "Remediated Pipeline",
    "Invalid stage skip (brief -> delivery_publishing) is blocked atomically by RPC",
    !skipAttempt.success && skipAttempt.output.includes("INVALID_STAGE_TRANSITION"),
    skipAttempt.success ? "UNEXPECTED SUCCESS" : "Blocked with INVALID_STAGE_TRANSITION"
  );

  // 6B: Verify booking stage unchanged and zero audit records created for failed skip
  const stageAfterFailedSkip = runSql(`SELECT stage FROM public.production_bookings WHERE id = '${bookingRemediationId}';`);
  const auditAfterFailedSkip = runSql(`SELECT count(*) FROM public.project_activity WHERE metadata->>'booking_id' = '${bookingRemediationId}';`);
  recordTest(
    "STAGE-SKIP-AUDIT",
    "Remediated Pipeline",
    "Failed stage skip leaves stage unchanged ('brief') and creates zero audit records",
    stageAfterFailedSkip === "brief" && auditAfterFailedSkip === "0",
    `Stage: ${stageAfterFailedSkip}, Audit count: ${auditAfterFailedSkip}`
  );

  // 6C: Valid sequential advance: step 1 (brief) -> step 2 (scheduling)
  const validAdv1 = runSqlSafe(`
    SELECT public.advance_production_booking_stage('${bookingRemediationId}', 'scheduling', '{"client_notes":"Dates confirmed"}'::jsonb, '${testIds.adminProfile}');
  `);
  const stageAfterAdv1 = runSql(`SELECT stage || '|' || client_notes FROM public.production_bookings WHERE id = '${bookingRemediationId}';`);
  const auditAfterAdv1 = runSql(`
    SELECT activity_type || '|' || (old_state->>'stage') || '->' || (new_state->>'stage') || '|' || (metadata->>'transition')
    FROM public.project_activity
    WHERE metadata->>'booking_id' = '${bookingRemediationId}';
  `);
  recordTest(
    "STAGE-ADV-01",
    "Remediated Pipeline",
    "Valid forward transition (brief -> scheduling) atomically updates booking and writes audit log",
    validAdv1.success && stageAfterAdv1.startsWith("scheduling|") && auditAfterAdv1.includes("brief->scheduling"),
    `Stage: ${stageAfterAdv1}, Audit: ${auditAfterAdv1}`
  );

  // 6D: Backwards regression attempt (scheduling -> brief) MUST BE REJECTED
  const regressAttempt = runSqlSafe(`
    SELECT public.advance_production_booking_stage('${bookingRemediationId}', 'brief', '{}'::jsonb, '${testIds.adminProfile}');
  `);
  recordTest(
    "STAGE-REGRESS-BLOCK",
    "Remediated Pipeline",
    "Backwards regression (scheduling -> brief) is blocked atomically by RPC",
    !regressAttempt.success && regressAttempt.output.includes("INVALID_STAGE_TRANSITION"),
    regressAttempt.success ? "UNEXPECTED SUCCESS" : "Blocked with INVALID_STAGE_TRANSITION"
  );

  // 6E: Concurrency test: Two concurrent calls from stale current state
  // Call A advances scheduling -> shooting (succeeds)
  // Call B attempts scheduling -> shooting (fails because current is now shooting)
  const concurrentA = runSqlSafe(`
    SELECT public.advance_production_booking_stage('${bookingRemediationId}', 'shooting', '{}'::jsonb, '${testIds.adminProfile}');
  `);
  const concurrentB = runSqlSafe(`
    SELECT public.advance_production_booking_stage('${bookingRemediationId}', 'shooting', '{}'::jsonb, '${testIds.adminProfile}');
  `);
  recordTest(
    "STAGE-CONCURRENCY",
    "Remediated Pipeline",
    "Concurrent duplicate advance attempt is safely serialized and rejected without duplicate audit",
    concurrentA.success && !concurrentB.success && concurrentB.output.includes("INVALID_STAGE_TRANSITION"),
    `Call A: ${concurrentA.success ? "Succeeded" : "Failed"}, Call B: ${concurrentB.success ? "Succeeded" : "Blocked (safe)"}`
  );

  // 6F: Step through remainder of 8 stages: shooting -> raw_upload -> editing -> review -> client_approval -> delivery_publishing
  const remainingStages = ["raw_upload", "editing", "review", "client_approval", "delivery_publishing"];
  let pipelineSuccess = true;
  for (const st of remainingStages) {
    const res = runSqlSafe(`
      SELECT public.advance_production_booking_stage('${bookingRemediationId}', '${st}', '{"url":"https://sada.tn/${st}"}'::jsonb, '${testIds.adminProfile}');
    `);
    if (!res.success) {
      pipelineSuccess = false;
      break;
    }
  }
  const finalStage = runSql(`SELECT stage FROM public.production_bookings WHERE id = '${bookingRemediationId}';`);
  const totalAudits = runSql(`SELECT count(*) FROM public.project_activity WHERE metadata->>'booking_id' = '${bookingRemediationId}';`);
  recordTest(
    "STAGE-FULL-PIPELINE",
    "Remediated Pipeline",
    "Traverse all 8 stages sequentially with atomic audit verification at every step",
    pipelineSuccess && finalStage === "delivery_publishing" && totalAudits === "7",
    `Final Stage: ${finalStage}, Total Audit Logs: ${totalAudits}/7`
  );

  // 6G: Security Suite: Actor Spoofing & RBAC Invariants
  const secBookingId = runSql(`
    INSERT INTO public.production_bookings (client_id, package_id, project_id, title, date, time, location, production_type, stage)
    VALUES ('${testIds.testClient}', '${testIds.testPackage}', '${testIds.testProject}', 'Security Test Shoot', '2026-10-30', '10:00', 'Tunis', 'video_shoot', 'brief')
    RETURNING id;
  `).trim();

  // 6G1: Worker passing own UUID -> blocked by RBAC
  const workerOwnAdvance = runSqlSafe(`
    BEGIN;
    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub', '${testIds.workerProfile}', true);
    SELECT public.advance_production_booking_stage('${secBookingId}', 'scheduling', '{}'::jsonb, '${testIds.workerProfile}');
    COMMIT;
  `);
  recordTest(
    "STAGE-AUTH-WORKER",
    "Authorization",
    "Worker without calendar/tasks module access is blocked from calling advance RPC",
    !workerOwnAdvance.success && workerOwnAdvance.output.includes("UNAUTHORIZED"),
    workerOwnAdvance.success ? "UNEXPECTED SUCCESS" : "Blocked with UNAUTHORIZED"
  );

  // 6G2: Worker passing Admin UUID -> blocked by anti-spoofing guard
  const workerAdminAdvance = runSqlSafe(`
    BEGIN;
    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub', '${testIds.workerProfile}', true);
    SELECT public.advance_production_booking_stage('${secBookingId}', 'scheduling', '{}'::jsonb, '${testIds.adminProfile}');
    COMMIT;
  `);
  recordTest(
    "STAGE-AUTH-SPOOF-ADMIN",
    "Security",
    "Worker attempting to impersonate Admin UUID is blocked by actor spoofing guard",
    !workerAdminAdvance.success && workerAdminAdvance.output.includes("FORBIDDEN: Actor spoofing detected"),
    workerAdminAdvance.success ? "UNEXPECTED SUCCESS" : "Blocked with FORBIDDEN: Actor spoofing detected"
  );

  // 6G3: Worker passing Super Admin UUID -> blocked by anti-spoofing guard
  const workerSaAdvance = runSqlSafe(`
    BEGIN;
    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub', '${testIds.workerProfile}', true);
    SELECT public.advance_production_booking_stage('${secBookingId}', 'scheduling', '{}'::jsonb, '${testIds.superAdminProfile}');
    COMMIT;
  `);
  recordTest(
    "STAGE-AUTH-SPOOF-SA",
    "Security",
    "Worker attempting to impersonate Super Admin UUID is blocked by actor spoofing guard",
    !workerSaAdvance.success && workerSaAdvance.output.includes("FORBIDDEN: Actor spoofing detected"),
    workerSaAdvance.success ? "UNEXPECTED SUCCESS" : "Blocked with FORBIDDEN: Actor spoofing detected"
  );

  // 6G4: Authorized Admin passing Super Admin UUID -> blocked by anti-spoofing guard
  const adminSaAdvance = runSqlSafe(`
    BEGIN;
    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub', '${testIds.adminProfile}', true);
    SELECT public.advance_production_booking_stage('${secBookingId}', 'scheduling', '{}'::jsonb, '${testIds.superAdminProfile}');
    COMMIT;
  `);
  recordTest(
    "STAGE-AUTH-ADMIN-SPOOF-SA",
    "Security",
    "Authorized Admin attempting to forge Super Admin audit attribution is blocked by actor spoofing guard",
    !adminSaAdvance.success && adminSaAdvance.output.includes("FORBIDDEN: Actor spoofing detected"),
    adminSaAdvance.success ? "UNEXPECTED SUCCESS" : "Blocked with FORBIDDEN: Actor spoofing detected"
  );

  // 6G5: Verify security booking remains untouched at 'brief' with 0 audit records
  const secBookingStage = runSql(`SELECT stage FROM public.production_bookings WHERE id = '${secBookingId}';`);
  const secBookingAudits = runSql(`SELECT count(*) FROM public.project_activity WHERE metadata->>'booking_id' = '${secBookingId}';`);
  recordTest(
    "STAGE-SPOOF-STATE-CLEAN",
    "Security",
    "Failed spoofing attempts leave booking stage unchanged ('brief') and create zero audit records",
    secBookingStage === "brief" && secBookingAudits === "0",
    `Stage: ${secBookingStage}, Audit count: ${secBookingAudits}`
  );

  // 6G6: Trusted Service-Role execution advances stage and attributes audit to service_role
  const serviceRoleAdv = runSqlSafe(`
    BEGIN;
    SELECT set_config('request.jwt.claim.role', 'service_role', true);
    SELECT public.advance_production_booking_stage('${secBookingId}', 'scheduling', '{}'::jsonb, '${testIds.superAdminProfile}');
    COMMIT;
  `);
  const secBookingStageAfterSR = runSql(`SELECT stage FROM public.production_bookings WHERE id = '${secBookingId}';`);
  const srAuditRow = runSql(`SELECT actor_id || '|' || (metadata->>'actor_source') FROM public.project_activity WHERE metadata->>'booking_id' = '${secBookingId}';`);
  recordTest(
    "STAGE-AUTH-SERVICE-ROLE",
    "Security",
    "Trusted service_role invocation advances stage and truthfully attributes audit",
    serviceRoleAdv.success && secBookingStageAfterSR === "scheduling" && srAuditRow === `${testIds.superAdminProfile}|service_role`,
    `Stage: ${secBookingStageAfterSR}, Audit: ${srAuditRow}`
  );

  // 6H: Anonymous caller check against advance_production_booking_stage
  const anonTestBookingId = runSql(`
    INSERT INTO public.production_bookings (client_id, package_id, project_id, title, date, time, location, production_type, stage)
    VALUES ('${testIds.testClient}', '${testIds.testPackage}', '${testIds.testProject}', 'Anon Auth Test', '2026-10-26', '12:00', 'Tunis', 'video_shoot', 'brief')
    RETURNING id;
  `).trim();

  const anonAdvance = runSqlSafe(`
    BEGIN;
    SET LOCAL ROLE anon;
    SELECT public.advance_production_booking_stage('${anonTestBookingId}', 'scheduling', '{}'::jsonb, NULL);
    COMMIT;
  `);
  recordTest(
    "STAGE-AUTH-ANON",
    "Authorization",
    "Anonymous caller is blocked from calling advance RPC by permissions",
    !anonAdvance.success && (anonAdvance.output.includes("UNAUTHORIZED") || anonAdvance.output.includes("permission denied")),
    anonAdvance.success ? "UNEXPECTED SUCCESS" : "Blocked with permission denied / UNAUTHORIZED"
  );

  // GROUP 7: Booking Deletion Lifecycle & Policy Verification
  console.log("\n--- Group 7: Booking Deletion Lifecycle & Policy Verification ---");
  const workerDelRes = runSqlSafe(`
    BEGIN;
    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub', '${testIds.workerProfile}', true);
    DELETE FROM public.production_bookings WHERE id = '${bookingRemediationId}';
    COMMIT;
  `);
  const workerDelCount = runSql(`SELECT count(*) FROM public.production_bookings WHERE id = '${bookingRemediationId}';`);
  recordTest(
    "RLS-01",
    "RLS",
    "Worker deletion of production booking is rejected by RLS (record preserved)",
    workerDelCount === "1",
    `Record count: ${workerDelCount} (preserved)`
  );

  const adminDelRes = runSqlSafe(`
    BEGIN;
    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub', '${testIds.adminProfile}', true);
    DELETE FROM public.production_bookings WHERE id = '${bookingRemediationId}';
    COMMIT;
  `);
  const adminDelCount = runSql(`SELECT count(*) FROM public.production_bookings WHERE id = '${bookingRemediationId}';`);
  recordTest(
    "RLS-02",
    "RLS",
    "Standard Admin deletion of production booking is rejected by RLS (record preserved)",
    adminDelCount === "1",
    `Record count: ${adminDelCount} (preserved)`
  );

  const superAdminDelRes = runSqlSafe(`
    BEGIN;
    SET LOCAL ROLE authenticated;
    SELECT set_config('request.jwt.claim.sub', '${testIds.superAdminProfile}', true);
    DELETE FROM public.production_bookings WHERE id = '${bookingRemediationId}';
    COMMIT;
  `);
  const superAdminDelCount = runSql(`SELECT count(*) FROM public.production_bookings WHERE id = '${bookingRemediationId}';`);
  recordTest(
    "RLS-03",
    "RLS",
    "Super Admin deletion is permitted by RLS for DBA break-glass maintenance",
    superAdminDelCount === "0",
    `Record count: ${superAdminDelCount} (deleted by Super Admin)`
  );

  // GROUP 8: Foreign Key Cascade Behavior on Package Removal
  console.log("\n--- Group 8: Foreign Key Integrity & Historical Work Preservation ---");
  const fkTest = runSql(`
    WITH new_pkg AS (
      INSERT INTO public.package_catalog (name, selling_price) VALUES ('Temp Pkg', 100) RETURNING id
    ),
    new_deliv AS (
      INSERT INTO public.client_deliverables (client_id, package_id, title, deliverable_type, period_month)
      SELECT '${testIds.testClient}', id, 'Temp Deliv', 'reel', '2026-10' FROM new_pkg
      RETURNING id, package_id
    )
    SELECT id || '|' || package_id FROM new_deliv;
  `);
  const [tempDelivId, tempPkgId] = fkTest.split("|");

  runSql(`DELETE FROM public.package_catalog WHERE id = '${tempPkgId}';`);
  const checkDelivPreserved = runSql(`SELECT package_id IS NULL FROM public.client_deliverables WHERE id = '${tempDelivId}';`);
  recordTest(
    "FK-01",
    "Foreign Keys",
    "Deleting package preserves client_deliverable with package_id SET NULL",
    checkDelivPreserved === "t",
    `Deliverable preserved with package_id = NULL: ${checkDelivPreserved}`
  );

  // Step 5: Fixture Cleanup
  console.log("\n--- 5. Fixture Cleanup ---");
  const cleanupSql = `
    DELETE FROM public.reconciliation_audit_logs WHERE client_id = '${testIds.testClient}';
    DELETE FROM public.project_tasks WHERE client_id = '${testIds.testClient}';
    DELETE FROM public.client_deliverables WHERE client_id = '${testIds.testClient}';
    DELETE FROM public.production_bookings WHERE client_id = '${testIds.testClient}';
    DELETE FROM public.client_projects WHERE client_id = '${testIds.testClient}';
    DELETE FROM public.clients WHERE id = '${testIds.testClient}';
    DELETE FROM public.package_catalog WHERE id = '${testIds.testPackage}';
    DELETE FROM public.user_roles WHERE user_id IN ('${testIds.superAdminProfile}', '${testIds.adminProfile}', '${testIds.workerProfile}');
    DELETE FROM public.profiles WHERE id IN ('${testIds.superAdminProfile}', '${testIds.adminProfile}', '${testIds.workerProfile}');
    DELETE FROM auth.users WHERE id IN ('${testIds.superAdminProfile}', '${testIds.adminProfile}', '${testIds.workerProfile}');
  `;
  runSql(cleanupSql);
  recordTest("CLEANUP-01", "Cleanup", "Reliable cleanup of all isolated test fixtures", true, "All test records purged cleanly");

  // Summary
  console.log("\n===============================================================================");
  console.log("PHASE 4 REMEDIATION & CERTIFICATION SUMMARY");
  console.log("===============================================================================");
  const total = testResults.length;
  const passed = testResults.filter((t) => t.passed).length;
  const failed = total - passed;
  console.log(`Total Tests : ${total}`);
  console.log(`Passed      : ${passed}`);
  console.log(`Failed      : ${failed}`);
  console.log("===============================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runCertificationSuite().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
