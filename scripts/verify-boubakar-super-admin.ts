import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import {
  canViewFinance,
  canManageFinance,
  canManageSalaries,
  canApproveSalaryRequest,
  canDelete,
  canManageRoles,
  canViewOwnCompensation,
  canRequestEarlyPayment,
  type PermissionContext,
} from "../src/lib/permissions";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✓ PASS: ${message}`);
}

// Load .env
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = (match[2] || "").trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      process.env[match[1]] = value;
    }
  });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !anonKey) {
  console.error("Missing SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}

const client = createClient(supabaseUrl, anonKey);

async function runVerification() {
  console.log("=================================================================");
  console.log("SADA — BOUBAKAR HAMED SUPER ADMIN PROMOTION VERIFICATION SUITE");
  console.log("=================================================================\n");

  const boubakarUserId = "f4184256-97c4-4f81-9346-176ec5dfb43a";
  const boubakarEmail = "boubakar.hamedsghaier@gmail.com";
  const boubakarTmId = "b363b2c1-eb6c-4203-9180-ec69ebf41cb7";
  const syntheticAdminId = "11111111-1111-1111-1111-111111111111";

  // Step 1: Authenticate Super Admin session
  const { data: saLogin, error: saLoginErr } = await client.auth.signInWithPassword({
    email: "sec.admin@sada.agency",
    password: "AdminPassword123!",
  });
  assert(!saLoginErr && Boolean(saLogin?.user), "Authenticated admin session for database inspection");

  // -------------------------------------------------------------
  // TEST 1: IDENTITY & PROFILE INTEGRITY
  // -------------------------------------------------------------
  console.log("\n--- TEST 1: Boubakar Identity & Profile Integrity ---");

  const { data: bProfiles, error: bpErr } = await client
    .from("profiles")
    .select("*")
    .eq("id", boubakarUserId);

  assert(!bpErr, `Queried profiles for Boubakar without error: ${bpErr?.message || "OK"}`);
  assert(bProfiles?.length === 1, `Exactly 1 profile exists for Boubakar (count: ${bProfiles?.length})`);
  assert(bProfiles![0].id === boubakarUserId, `Profile UUID matches: ${boubakarUserId}`);
  console.log(`Boubakar Profile: ID=${bProfiles![0].id}, DisplayName=${bProfiles![0].display_name}`);

  // Check no duplicate profiles with Boubakar's email
  const { data: dupProfiles } = await client
    .from("profiles")
    .select("*")
    .ilike("display_name", `%${boubakarEmail}%`);
  assert(dupProfiles?.length === 1, `Zero duplicate profiles (found ${dupProfiles?.length})`);

  // -------------------------------------------------------------
  // TEST 2: TEAM MEMBER RECORD INTEGRITY
  // -------------------------------------------------------------
  console.log("\n--- TEST 2: Team Member Record Integrity & Role ---");

  const { data: bTeamMembers, error: tmErr } = await client
    .from("team_members")
    .select("*")
    .eq("id", boubakarTmId);

  assert(!tmErr, `Queried team_members for Boubakar without error: ${tmErr?.message || "OK"}`);
  assert(bTeamMembers?.length === 1, `Exactly 1 team member record exists (count: ${bTeamMembers?.length})`);

  const boubakarTm = bTeamMembers![0];
  assert(boubakarTm.name === "Boubakar Hamed", `Name matches: ${boubakarTm.name}`);
  assert(boubakarTm.email === boubakarEmail, `Email matches: ${boubakarTm.email}`);
  assert(boubakarTm.profile_id === boubakarUserId, `profile_id properly links to auth UUID: ${boubakarTm.profile_id}`);
  assert(boubakarTm.role === "super_admin", `team_members.role is canonical 'super_admin' (found: ${boubakarTm.role})`);
  assert(boubakarTm.is_active === true, "Boubakar is_active is true");
  assert(boubakarTm.division === "Executive", `division is Executive: ${boubakarTm.division}`);
  console.log(`Boubakar Team Member: ID=${boubakarTm.id}, Name=${boubakarTm.name}, Role=${boubakarTm.role}`);

  // -------------------------------------------------------------
  // TEST 3: DATABASE USER_ROLES & POSTGRES ENGINE IS_SUPER_ADMIN
  // -------------------------------------------------------------
  console.log("\n--- TEST 3: Canonical user_roles & Database Engine Authorization ---");

  const { data: bUserRoles, error: urErr } = await client
    .from("user_roles")
    .select("*")
    .eq("user_id", boubakarUserId);

  assert(!urErr, `Queried user_roles without error: ${urErr?.message || "OK"}`);
  assert(bUserRoles?.length === 1, `Exactly 1 user_role row for Boubakar (count: ${bUserRoles?.length})`);
  assert(bUserRoles![0].role === "super_admin", `user_roles.role is 'super_admin' (found: ${bUserRoles![0].role})`);

  // RPC database function test
  const { data: bkrIsSuperAdmin, error: rpcErr } = await client.rpc("is_super_admin", { _user_id: boubakarUserId });
  assert(!rpcErr, `is_super_admin RPC executed without error: ${rpcErr?.message || "OK"}`);
  assert(bkrIsSuperAdmin === true, "PostgreSQL public.is_super_admin(boubakarUserId) evaluates to TRUE");

  const { data: bkrIsAdmin } = await client.rpc("is_admin", { _user_id: boubakarUserId });
  assert(bkrIsAdmin === true, "PostgreSQL public.is_admin(boubakarUserId) evaluates to TRUE (super_admin inherits admin)");

  // -------------------------------------------------------------
  // TEST 4: APPLICATION PERMISSION MATRIX & PROPAGATION
  // -------------------------------------------------------------
  console.log("\n--- TEST 4: Application RBAC Matrix & Permission Helpers ---");

  const boubakarCtx: PermissionContext = {
    role: "super_admin",
    userId: boubakarUserId,
    memberProfileId: boubakarUserId,
    memberId: boubakarTmId,
  };

  assert(canViewFinance(boubakarCtx) === true, "canViewFinance returns true for Boubakar");
  assert(canManageFinance(boubakarCtx) === true, "canManageFinance returns true for Boubakar");
  assert(canManageSalaries(boubakarCtx) === true, "canManageSalaries returns true for Boubakar");
  assert(canApproveSalaryRequest(boubakarCtx) === true, "canApproveSalaryRequest returns true for Boubakar");
  assert(canDelete(boubakarCtx) === true, "canDelete returns true for Boubakar");
  assert(canManageRoles(boubakarCtx) === true, "canManageRoles returns true for Boubakar");
  assert(canViewOwnCompensation(boubakarCtx) === true, "canViewOwnCompensation returns true for Boubakar");
  assert(canRequestEarlyPayment(boubakarCtx) === true, "canRequestEarlyPayment returns true for Boubakar");

  // -------------------------------------------------------------
  // TEST 5: ADMIN ISOLATION VERIFICATION
  // -------------------------------------------------------------
  console.log("\n--- TEST 5: Admin Role Isolation Verification ---");

  const adminCtx: PermissionContext = {
    role: "admin",
    userId: "admin-tester-id",
    memberProfileId: "admin-tester-id",
    memberId: "admin-tester-tm-id",
  };

  assert(canViewFinance(adminCtx) === false, "Admin CANNOT view company Finance");
  assert(canManageFinance(adminCtx) === false, "Admin CANNOT manage company Finance");
  assert(canManageSalaries(adminCtx) === false, "Admin CANNOT manage all salaries");
  assert(canApproveSalaryRequest(adminCtx) === false, "Admin CANNOT approve salary advance requests");
  assert(canDelete(adminCtx) === false, "Admin CANNOT delete data (Super Admin only)");
  assert(canManageRoles(adminCtx) === false, "Admin CANNOT manage roles");
  assert(canViewOwnCompensation(adminCtx) === true, "Admin CAN view own salary");
  assert(canRequestEarlyPayment(adminCtx) === true, "Admin CAN submit early salary request");

  // -------------------------------------------------------------
  // TEST 6: WORKER ISOLATION & NEGATIVE RLS TESTS
  // -------------------------------------------------------------
  console.log("\n--- TEST 6: Worker Isolation & Live RLS Enforcement ---");

  // Authenticate as Worker
  const { data: wAuth, error: wAuthErr } = await client.auth.signInWithPassword({
    email: "worker.test.finance@sada.agency",
    password: "WorkerTestPassword123!",
  });
  assert(!wAuthErr && Boolean(wAuth?.user), `Worker authenticated: ${wAuth?.user?.email}`);

  // Worker negative queries
  const { data: wIncomes } = await client.from("income_transactions" as any).select("*");
  assert(!wIncomes || wIncomes.length === 0, "Worker cannot read income_transactions (0 rows returned)");

  const { data: wExpenses } = await client.from("expense_transactions" as any).select("*");
  assert(!wExpenses || wExpenses.length === 0, "Worker cannot read expense_transactions (0 rows returned)");

  const { data: wSubs } = await client.from("subscriptions" as any).select("*");
  assert(!wSubs || wSubs.length === 0, "Worker cannot read subscriptions (0 rows returned)");

  const { data: wAudit } = await client.from("financial_audit_logs" as any).select("*");
  assert(!wAudit || wAudit.length === 0, "Worker cannot read financial_audit_logs (0 rows returned)");

  // IDOR protection: worker cannot query Boubakar's salary record
  const { data: bkrSalaryViewedByWorker } = await client
    .from("salary_records" as any)
    .select("*")
    .eq("team_member_id", boubakarTmId);
  assert(
    !bkrSalaryViewedByWorker || bkrSalaryViewedByWorker.length === 0,
    "IDOR Protection: Worker CANNOT view Boubakar's salary record (0 rows returned)"
  );

  // -------------------------------------------------------------
  // TEST 7: BUSINESS DATA INTEGRITY & RELATIONSHIPS PRESERVED
  // -------------------------------------------------------------
  console.log("\n--- TEST 7: Business Data Integrity & Foreign Key Preservation ---");

  // Re-sign in as Super Admin
  await client.auth.signInWithPassword({ email: "sec.admin@sada.agency", password: "AdminPassword123!" });

  const { data: assignedTasks } = await client
    .from("project_tasks")
    .select("id")
    .eq("assigned_by_id", boubakarUserId);
  assert(
    (assignedTasks?.length || 0) >= 50,
    `Boubakar's 50+ assigned tasks remain intact (found: ${assignedTasks?.length})`
  );

  const { data: activities } = await client
    .from("project_activity")
    .select("id")
    .eq("actor_id", boubakarUserId);
  assert(
    (activities?.length || 0) >= 8,
    `Boubakar's project activities remain intact (found: ${activities?.length})`
  );

  // -------------------------------------------------------------
  // TEST 8: SYNTHETIC ACCOUNT STATUS
  // -------------------------------------------------------------
  console.log("\n--- TEST 8: Synthetic Account Status Verification ---");

  const { data: synProfile } = await client
    .from("profiles")
    .select("id, display_name")
    .eq("id", syntheticAdminId)
    .maybeSingle();

  assert(Boolean(synProfile), `Synthetic test admin profile remains intact (ID: ${syntheticAdminId})`);

  const { data: synRole } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", syntheticAdminId)
    .maybeSingle();

  assert(synRole?.role === "super_admin", "Synthetic test admin maintains role for test suites");
  console.log("Synthetic account preserved safely for automated testing without conflicts.");

  console.log("\n=================================================================");
  console.log("🎉 ALL BOUBAKAR SUPER ADMIN VERIFICATION TESTS PASSED (100% SUCCESS)");
  console.log("=================================================================");
}

runVerification().catch((err) => {
  console.error("Fatal error during verification:", err);
  process.exit(1);
});
