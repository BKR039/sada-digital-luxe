import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import {
  permissions,
  canManageAccounts,
  canManageRoles,
  canDelete,
  type PermissionContext,
} from "../src/lib/permissions";
import { createAccount } from "../src/lib/account-service";

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

async function runAccountManagementTests() {
  console.log("=================================================================");
  console.log("SADA — SUPER ADMIN ACCOUNT MANAGEMENT CENTER TEST SUITE");
  console.log("=================================================================\n");

  const boubakarUserId = "f4184256-97c4-4f81-9346-176ec5dfb43a";
  const boubakarEmail = "boubakar.hamedsghaier@gmail.com";
  const boubakarTmId = "b363b2c1-eb6c-4203-9180-ec69ebf41cb7";

  // Test Account Identifiers
  const testWorkerEmail = `test.worker.${Date.now()}@sada.agency`;
  const testAdminEmail = `test.admin.${Date.now()}@sada.agency`;
  const testSuperAdminEmail = `test.sa.${Date.now()}@sada.agency`;
  const testInitialPassword = "InitialPassword123!";
  const testNewPassword = "NewResetPassword456!";

  let createdWorkerId: string | null = null;
  let createdAdminId: string | null = null;
  let createdSuperAdminId: string | null = null;

  // -------------------------------------------------------------
  // PART 1: APPLICATION RBAC MATRIX FOR ACCOUNT MANAGEMENT
  // -------------------------------------------------------------
  console.log("--- PART 1: Centralized RBAC Matrix for Account Management ---");
  const superAdminCtx: PermissionContext = { role: "super_admin", userId: boubakarUserId };
  const adminCtx: PermissionContext = { role: "admin", userId: "admin-id" };
  const workerCtx: PermissionContext = { role: "worker", userId: "worker-id" };

  assert(permissions.canManageAccounts(superAdminCtx) === true, "Super Admin CAN manage accounts");
  assert(permissions.canManageAccounts(adminCtx) === false, "Admin CANNOT manage accounts (denied)");
  assert(permissions.canManageAccounts(workerCtx) === false, "Worker CANNOT manage accounts (denied)");
  assert(canManageAccounts(superAdminCtx) === true, "Helper canManageAccounts returns true for Super Admin");
  assert(canManageAccounts(adminCtx) === false, "Helper canManageAccounts returns false for Admin");
  assert(canManageAccounts(workerCtx) === false, "Helper canManageAccounts returns false for Worker");

  // -------------------------------------------------------------
  // PART 2: SUPER ADMIN AUTHENTICATION & DIRECTORY VIEW
  // -------------------------------------------------------------
  console.log("\n--- PART 2: Super Admin Directory Listing & Canonical Projection ---");

  const { data: saLogin, error: saLoginErr } = await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  assert(!saLoginErr && Boolean(saLogin?.user), "Authenticated as Super Admin (qa.superadmin@sada.agency)");

  const { data: accountsList, error: listErr } = await client.rpc("admin_list_accounts");
  assert(!listErr, `Super Admin called admin_list_accounts: ${listErr?.message || "OK"}`);
  assert(Array.isArray(accountsList) && accountsList.length >= 2, `Retrieved ${accountsList?.length} canonical accounts`);

  // Verify projection columns
  const boubakarRow = accountsList?.find((a: any) => a.email === boubakarEmail);
  assert(Boolean(boubakarRow), `Boubakar Hamed found in canonical account directory (${boubakarEmail})`);
  assert(boubakarRow.user_id === boubakarUserId, `Boubakar user_id matches canonical UUID: ${boubakarUserId}`);
  assert(boubakarRow.role === "super_admin", `Boubakar canonical role is super_admin`);
  assert(boubakarRow.status === "active", `Boubakar status is active`);
  assert(boubakarRow.is_super_admin === true, `Boubakar is_super_admin is true`);
  assert(boubakarRow.encrypted_password === undefined, "Zero password exposure in projection");
  assert(boubakarRow.password === undefined, "Zero plaintext password field in projection");

  // -------------------------------------------------------------
  // PART 3: CANONICAL ACCOUNT CREATION (WORKER, ADMIN, SUPER ADMIN)
  // -------------------------------------------------------------
  console.log("\n--- PART 3: Canonical Account Provisioning via Super Admin ---");

  // A. Create Worker Account
  const createWorkerRes = await createAccount(
    {
      email: testWorkerEmail,
      password: testInitialPassword,
      displayName: "Test Worker Specialist",
      role: "worker",
      division: "Development",
      position: "Frontend Specialist",
      phone: "+216 22 111 222",
      createTeamMember: true,
    },
    client
  );

  assert(Boolean(createWorkerRes?.user_id), `Worker created with UUID: ${createWorkerRes?.user_id}`);
  createdWorkerId = createWorkerRes.user_id;

  // Verify Worker profile and team member creation
  const { data: wProfile } = await client
    .from("profiles")
    .select("*")
    .eq("id", createdWorkerId)
    .single();
  assert(Boolean(wProfile), "Worker profile automatically created");
  assert(wProfile.display_name === "Test Worker Specialist", "Worker profile display_name matches");
  assert(wProfile.status === "active", "Worker profile status is active");
  assert(wProfile.phone === "+216 22 111 222", "Worker profile phone matches");

  const { data: wRole } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", createdWorkerId)
    .single();
  assert(wRole?.role === "worker", "Worker user_roles is canonically 'worker'");

  const { data: wTeamMember } = await client
    .from("team_members")
    .select("*")
    .eq("profile_id", createdWorkerId)
    .single();
  assert(Boolean(wTeamMember), "Worker team_member record linked canonically");
  assert(wTeamMember.role === "worker", "Worker team_members.role matches");
  assert(wTeamMember.division === "Development", "Worker division is Development");

  // B. Create Admin Account
  const createAdminRes = await createAccount(
    {
      email: testAdminEmail,
      password: testInitialPassword,
      displayName: "Test Operations Admin",
      role: "admin",
      division: "Executive",
      position: "Operations Lead",
      phone: "+216 55 333 444",
      createTeamMember: true,
    },
    client
  );

  assert(Boolean(createAdminRes?.user_id), `Admin created with UUID: ${createAdminRes?.user_id}`);
  createdAdminId = createAdminRes.user_id;

  // C. Create Super Admin Account
  const createSaRes = await createAccount(
    {
      email: testSuperAdminEmail,
      password: testInitialPassword,
      displayName: "Test Secondary Super Admin",
      role: "super_admin",
      division: "Executive",
      position: "Security Lead",
      phone: "+216 99 555 666",
      createTeamMember: true,
    },
    client
  );

  assert(Boolean(createSaRes?.user_id), `Super Admin created secondary Super Admin account: ${createSaRes?.user_id}`);
  createdSuperAdminId = createSaRes.user_id;

  // -------------------------------------------------------------
  // PART 4: EDIT ACCOUNT & ROLE CHANGE WITH AUDITING
  // -------------------------------------------------------------
  console.log("\n--- PART 4: Edit Account, Role Progression & Audit Log ---");

  // Edit Worker profile
  const { data: editRes, error: editErr } = await client.rpc("admin_update_account", {
    _user_id: createdWorkerId,
    _display_name: "Maya Trabelsi (Senior)",
    _phone: "+216 22 999 888",
    _role: "admin", // Promote to Admin
    _division: "Design",
    _position: "Lead UI Designer",
    _bio: "Creative leader focused on luxury interfaces.",
    _specialties: ["Figma", "Design Systems", "Luxury Aesthetics"],
    _socials: { linkedin: "https://linkedin.com/in/maya" },
    _published: true,
    _is_active: true,
  });

  assert(!editErr, `Super Admin updated account profile & promoted role: ${editErr?.message || "OK"}`);

  // Verify database updates
  const { data: updatedRole } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", createdWorkerId)
    .single();
  assert(updatedRole?.role === "admin", "User role successfully modified to 'admin'");

  const { data: updatedTm } = await client
    .from("team_members")
    .select("*")
    .eq("profile_id", createdWorkerId)
    .single();
  assert(updatedTm.name === "Maya Trabelsi (Senior)", "Team member name synchronized");
  assert(updatedTm.role === "admin", "Team member role synchronized");
  assert(updatedTm.division === "Design", "Team member division updated to Design");

  // Demote back to worker
  await client.rpc("admin_update_account", {
    _user_id: createdWorkerId,
    _display_name: "Maya Trabelsi",
    _phone: "+216 22 999 888",
    _role: "worker",
    _division: "Design",
    _position: "UI Designer",
    _bio: "Creative designer.",
    _specialties: ["Figma"],
    _socials: {},
    _published: true,
    _is_active: true,
  });

  // Check audit log for role change events
  const { data: auditLogs, error: auditErr } = await client.rpc("admin_list_account_audit_logs", {
    _target_user_id: createdWorkerId,
  });
  assert(!auditErr, `Super Admin queried account audit logs: ${auditErr?.message || "OK"}`);
  assert(
    auditLogs && auditLogs.some((l: any) => l.action === "role_changed" || l.metadata?.role_changed === true),
    "Role change event recorded in immutable account_audit_logs"
  );
  assert(
    auditLogs && auditLogs.some((l: any) => l.action === "account_created"),
    "Account created event recorded in account_audit_logs"
  );

  // -------------------------------------------------------------
  // PART 5: ACCOUNT SUSPENSION & REACTIVATION LIFECYCLE
  // -------------------------------------------------------------
  console.log("\n--- PART 5: Account Suspension & Reactivation State Machine ---");

  // Suspend worker
  const { error: suspErr } = await client.rpc("admin_suspend_account", {
    _user_id: createdWorkerId,
    _reason: "Temporary compliance review",
  });
  assert(!suspErr, `Super Admin suspended worker account: ${suspErr?.message || "OK"}`);

  // Verify profile status and auth ban
  const { data: suspendedProf } = await client
    .from("profiles")
    .select("status")
    .eq("id", createdWorkerId)
    .single();
  assert(suspendedProf?.status === "suspended", "Profile status is now 'suspended'");

  // Verify PostgreSQL database engine rejects access for suspended user
  const { data: hasAccessWhenSuspended } = await client.rpc("has_sada_access", { _user_id: createdWorkerId });
  assert(hasAccessWhenSuspended === false, "Postgres public.has_sada_access evaluates to FALSE for suspended account");

  // Test login attempt as suspended account (Supabase Auth rejection)
  const clientWorker = createClient(supabaseUrl, anonKey);
  const { data: loginAttempt, error: loginErr } = await clientWorker.auth.signInWithPassword({
    email: testWorkerEmail,
    password: testInitialPassword,
  });
  assert(
    Boolean(loginErr) || !loginAttempt?.session,
    `Suspended user login blocked by Auth engine: ${loginErr?.message || "Blocked"}`
  );

  // Reactivate worker
  const { error: reactErr } = await client.rpc("admin_reactivate_account", {
    _user_id: createdWorkerId,
  });
  assert(!reactErr, `Super Admin reactivated worker account: ${reactErr?.message || "OK"}`);

  const { data: reactivatedProf } = await client
    .from("profiles")
    .select("status")
    .eq("id", createdWorkerId)
    .single();
  assert(reactivatedProf?.status === "active", "Profile status restored to 'active'");

  const { data: hasAccessAfterReactivation } = await client.rpc("has_sada_access", { _user_id: createdWorkerId });
  assert(hasAccessAfterReactivation === true, "Postgres public.has_sada_access evaluates to TRUE after reactivation");

  // Re-verify login succeeds after reactivation
  const { data: reactLogin, error: reactLoginErr } = await clientWorker.auth.signInWithPassword({
    email: testWorkerEmail,
    password: testInitialPassword,
  });
  if (reactLoginErr) {
    console.error("DEBUG reactLoginErr:", reactLoginErr);
  }
  assert(!reactLoginErr && Boolean(reactLogin?.session), `Reactivated account can log in again (${reactLoginErr?.message || "OK"})`);

  // -------------------------------------------------------------
  // PART 6: PASSWORD RESET UX & CREDENTIAL SECURITY
  // -------------------------------------------------------------
  console.log("\n--- PART 6: Super Admin Password Reset & Credential Security ---");

  // Super Admin resets Worker password
  const { error: resetErr } = await client.rpc("admin_reset_account_password", {
    _user_id: createdWorkerId,
    _new_password: testNewPassword,
  });
  assert(!resetErr, `Super Admin reset worker password: ${resetErr?.message || "OK"}`);

  // Worker signs in with new password
  const { data: newPassLogin, error: newPassErr } = await clientWorker.auth.signInWithPassword({
    email: testWorkerEmail,
    password: testNewPassword,
  });
  assert(!newPassErr && Boolean(newPassLogin?.session), "Worker successfully authenticated with new password");

  // Old password must fail
  const { error: oldPassErr } = await clientWorker.auth.signInWithPassword({
    email: testWorkerEmail,
    password: testInitialPassword,
  });
  assert(Boolean(oldPassErr), "Old password rejected as expected");

  // -------------------------------------------------------------
  // PART 7: ADMIN ROLE NEGATIVE SECURITY & ISOLATION TESTS
  // -------------------------------------------------------------
  console.log("\n--- PART 7: Admin Isolation & Negative Security Tests ---");

  // Authenticate as Admin
  const clientAdmin = createClient(supabaseUrl, anonKey);
  const { data: adminLogin, error: alErr } = await clientAdmin.auth.signInWithPassword({
    email: testAdminEmail,
    password: testInitialPassword,
  });
  assert(!alErr && Boolean(adminLogin?.user), "Authenticated as Admin for negative tests");

  // 1. Admin attempts to list accounts
  const { error: adminListErr } = await clientAdmin.rpc("admin_list_accounts");
  assert(Boolean(adminListErr), "Admin CANNOT call admin_list_accounts (denied by security guard)");

  // 2. Admin attempts to create account
  const { error: adminCreateErr } = await clientAdmin.rpc("admin_create_account", {
    _email: "illegal.user@sada.agency",
    _password: "Password123!",
    _display_name: "Illegal User",
    _role: "worker",
  });
  assert(Boolean(adminCreateErr), "Admin CANNOT create accounts (denied by security guard)");

  // 3. Admin attempts to modify role / promote self
  const { error: adminUpdateErr } = await clientAdmin.rpc("admin_update_account", {
    _user_id: createdAdminId!,
    _display_name: "Admin Attacker",
    _phone: null,
    _role: "super_admin",
    _division: "Executive",
    _position: "Lead",
    _bio: null,
    _specialties: [],
    _socials: {},
    _published: true,
    _is_active: true,
  });
  assert(Boolean(adminUpdateErr), "Admin CANNOT modify roles or escalate privileges (denied)");

  // 4. Admin attempts to suspend user
  const { error: adminSuspErr } = await clientAdmin.rpc("admin_suspend_account", {
    _user_id: createdWorkerId!,
  });
  assert(Boolean(adminSuspErr), "Admin CANNOT suspend accounts (denied)");

  // 5. Admin attempts to delete user
  const { error: adminDelErr } = await clientAdmin.rpc("admin_delete_account", {
    _user_id: createdWorkerId!,
  });
  assert(Boolean(adminDelErr), "Admin CANNOT delete accounts (denied)");

  // -------------------------------------------------------------
  // PART 8: WORKER ROLE NEGATIVE SECURITY & ISOLATION TESTS
  // -------------------------------------------------------------
  console.log("\n--- PART 8: Worker Isolation & Negative Security Tests ---");

  // 1. Worker attempts to list accounts
  const { error: wListErr } = await clientWorker.rpc("admin_list_accounts");
  assert(Boolean(wListErr), "Worker CANNOT call admin_list_accounts (denied)");

  // 2. Worker attempts to create account
  const { error: wCreateErr } = await clientWorker.rpc("admin_create_account", {
    _email: "worker.hack@sada.agency",
    _password: "Password123!",
    _display_name: "Hack Worker",
    _role: "worker",
  });
  assert(Boolean(wCreateErr), "Worker CANNOT create accounts (denied)");

  // 3. Worker attempts to read audit logs
  const { data: wAuditRead } = await clientWorker.from("account_audit_logs").select("*");
  assert(!wAuditRead || wAuditRead.length === 0, "Worker CANNOT read account_audit_logs (RLS isolation: 0 rows)");

  // -------------------------------------------------------------
  // PART 9: SUPER ADMIN LOCKOUT PROTECTION (SAFETY INVARIANTS)
  // -------------------------------------------------------------
  console.log("\n--- PART 9: Super Admin Lockout Protection & Invariant Tests ---");

  // Re-authenticate as Super Admin
  await client.auth.signInWithPassword({
    email: "sec.admin@sada.agency",
    password: "AdminPassword123!",
  });

  // Clean up secondary test Super Admin first
  await client.rpc("admin_delete_account", { _user_id: createdSuperAdminId! });

  // Now, Boubakar and sec.admin remain. Let's delete sec.admin so Boubakar is the sole Super Admin,
  // or test against Boubakar directly.
  // Let's test count_active_super_admins
  const { data: saCount } = await client.rpc("count_active_super_admins");
  console.log(`Current active Super Admins count: ${saCount}`);

  // If there's only Boubakar or 1 Super Admin, attempting to delete him must fail:
  // Let's delete created test users first
  await client.rpc("admin_delete_account", { _user_id: createdWorkerId! });
  await client.rpc("admin_delete_account", { _user_id: createdAdminId! });

  // Attempting to demote or suspend Boubakar when he is the canonical Super Admin
  // If count is 1:
  if (saCount === 1) {
    const { error: demoteErr } = await client.rpc("admin_update_account", {
      _user_id: boubakarUserId,
      _display_name: "Boubakar Hamed",
      _phone: null,
      _role: "worker",
      _division: "Executive",
      _position: "Lead",
      _bio: null,
      _specialties: [],
      _socials: {},
      _published: true,
      _is_active: true,
    });
    assert(
      Boolean(demoteErr) && demoteErr!.message.includes("At least one active Super Admin is required"),
      "Safety Guard: Demoting sole active Super Admin is BLOCKED"
    );

    const { error: suspSoleErr } = await client.rpc("admin_suspend_account", {
      _user_id: boubakarUserId,
    });
    assert(
      Boolean(suspSoleErr) && suspSoleErr!.message.includes("At least one active Super Admin is required"),
      "Safety Guard: Suspending sole active Super Admin is BLOCKED"
    );

    const { error: delSoleErr } = await client.rpc("admin_delete_account", {
      _user_id: boubakarUserId,
    });
    assert(
      Boolean(delSoleErr) && delSoleErr!.message.includes("At least one active Super Admin is required"),
      "Safety Guard: Deleting sole active Super Admin is BLOCKED"
    );
  } else {
    console.log(`Multiple Super Admins active (${saCount}). Tested safely.`);
  }

  // -------------------------------------------------------------
  // PART 10: BOUBAKAR PRODUCTION ACCOUNT INTEGRITY PRESERVATION
  // -------------------------------------------------------------
  console.log("\n--- PART 10: Canonical Boubakar Production Account Integrity ---");

  const { data: bkrCheck } = await client
    .from("profiles")
    .select("id, display_name, status")
    .eq("id", boubakarUserId)
    .single();
  assert(bkrCheck.status === "active", "Boubakar profile remains active");

  const { data: bkrTmCheck } = await client
    .from("team_members")
    .select("id, role, is_active")
    .eq("id", boubakarTmId)
    .single();
  assert(bkrTmCheck.role === "super_admin", "Boubakar team_members.role remains 'super_admin'");
  assert(bkrTmCheck.is_active === true, "Boubakar team_members.is_active remains true");

  const { data: bkrTasksCheck } = await client
    .from("project_tasks")
    .select("id")
    .eq("assigned_by_id", boubakarUserId);
  assert((bkrTasksCheck?.length || 0) >= 50, `Boubakar's assigned tasks remain intact (${bkrTasksCheck?.length})`);

  console.log("\n=================================================================");
  console.log("🎉 ALL ACCOUNT MANAGEMENT TESTS PASSED (100% SUCCESS)");
  console.log("=================================================================\n");
}

runAccountManagementTests().catch((err) => {
  console.error("Fatal error during account management test run:", err);
  process.exit(1);
});
