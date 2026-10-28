import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import {
  SADA_MODULES,
  ROLE_DEFAULT_MODULE_PERMISSIONS,
  getEffectiveModulePermission,
  canPerformModuleAction,
  resolveModuleFromPath,
  type SadaModule,
  type SadaRole,
  type SadaAction,
  type UserModulePermissions,
} from "../src/types/permissions";
import {
  canAccessModule,
  assertCanAccessModule,
  assertActorCanAccessModule,
  assertActorCanPerformAction,
  assertCanDelete,
  assertCanManageAccounts,
  type PermissionContext,
} from "../src/lib/permissions";
import {
  createAccount,
  deleteAccount,
  fetchUserModulePermissions,
  updateAccountPermissions,
} from "../src/lib/account-service";
import {
  createIncome,
  createExpense,
  deleteTransaction,
} from "../src/lib/finance-service";
import { createDeal } from "../src/lib/sales-service";
import { saveWorkflowTemplate } from "../src/lib/workflow-service";
import { createPackage, deletePackage } from "../src/lib/package-service";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✓ PASS: ${message}`);
}

// Load environment variables
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

async function runSecurityHardeningSuite() {
  console.log("=================================================================");
  console.log("SADA OS — PHASE 3.1 PERMISSION & SECURITY HARDENING TEST SUITE");
  console.log("=================================================================\n");

  // Authenticate as Super Admin for baseline test harness operations
  const { data: saLogin, error: saLoginErr } = await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  assert(!saLoginErr && Boolean(saLogin?.user), "Harness authenticated as Super Admin (qa.superadmin@sada.agency)");

  const superAdminUserId = saLogin!.user!.id;

  // -------------------------------------------------------------
  // GROUP A: CANONICAL PERMISSION SOURCE OF TRUTH
  // -------------------------------------------------------------
  console.log("--- GROUP A: Canonical Permission Source of Truth ---");

  // Create temporary test user to test permission store
  const testUserEmail = `sec.canonical.${Date.now()}@sada.agency`;
  const provAccount = await createAccount(
    {
      email: testUserEmail,
      password: "TestPassword123!",
      displayName: "Security Canonical Tester",
      role: "worker",
      status: "active",
    },
    client
  );
  const testUserId = provAccount.user_id;

  // 1. Update permissions via authoritative RPC
  await updateAccountPermissions(
    testUserId,
    {
      finance: true,
      sales: true,
    },
    client
  );

  // 2. Verify stored authoritatively in public.user_module_permissions table
  const { data: permRows, error: pErr } = await client
    .from("user_module_permissions")
    .select("module, enabled")
    .eq("user_id", testUserId);

  assert(!pErr, "Queried public.user_module_permissions successfully");
  assert(
    permRows && permRows.some((r) => r.module === "finance" && r.enabled === true),
    "Authoritative row exists in public.user_module_permissions for finance = true"
  );
  assert(
    permRows && permRows.some((r) => r.module === "sales" && r.enabled === true),
    "Authoritative row exists in public.user_module_permissions for sales = true"
  );

  // 3. Verify fetchUserModulePermissions reads from the canonical store
  const fetchedPerms = await fetchUserModulePermissions(testUserId, client);
  assert(fetchedPerms !== null, "fetchUserModulePermissions returns resolved permissions");
  assert(
    fetchedPerms?.finance === true || (typeof fetchedPerms?.finance === "object" && fetchedPerms.finance.enabled),
    "fetchUserModulePermissions correctly reflects finance enabled"
  );
  assert(
    fetchedPerms?.sales === true || (typeof fetchedPerms?.sales === "object" && fetchedPerms.sales.enabled),
    "fetchUserModulePermissions correctly reflects sales enabled"
  );

  // 4. Verify competing business_rules store is DEAD and NOT read
  const { error: brInsertErr } = await client
    .from("business_rules")
    .upsert({
      rule_key: `user_permissions_${testUserId}`,
      category: "permissions",
      description: "Competing legacy test rule",
      json_value: { finance: false, sales: false },
      updated_at: new Date().toISOString(),
    }, { onConflict: "rule_key" });

  // Regardless of legacy entry in business_rules, fetchUserModulePermissions STILL returns canonical true!
  const fetchedAfterCompete = await fetchUserModulePermissions(testUserId, client);
  assert(
    fetchedAfterCompete?.finance === true || (typeof fetchedAfterCompete?.finance === "object" && fetchedAfterCompete.finance.enabled),
    "Canonical user_module_permissions takes precedence; dead business_rules does NOT hijack permissions"
  );

  // -------------------------------------------------------------
  // GROUP B: SERVER / API AUTHORIZATION
  // -------------------------------------------------------------
  console.log("\n--- GROUP B: Server / API Authorization ---");

  const workerCtxNoFinance: PermissionContext = { role: "worker", customPermissions: {} };
  const adminCtxNoFinance: PermissionContext = { role: "admin", customPermissions: {} };
  const workerCtxNoSales: PermissionContext = { role: "worker", customPermissions: {} };
  const adminCtxNoAccounts: PermissionContext = { role: "admin", customPermissions: {} };
  const workerCtxAccountOp: PermissionContext = { role: "worker", customPermissions: {} };

  // 1. Worker without Finance -> direct Finance server operation -> DENIED
  let workerFinanceDenied = false;
  try {
    const res = await createIncome({
      amount: 1000,
      date: "2026-10-06",
      category: "Client Retainer",
      description: "Direct unauthorized income insert",
      ctx: workerCtxNoFinance,
    });
    if (!res.success && res.error?.message?.includes("Unauthorized")) {
      workerFinanceDenied = true;
    }
  } catch (err: any) {
    workerFinanceDenied = err.message.includes("Unauthorized") && err.message.includes("finance");
  }
  assert(workerFinanceDenied, "Worker without Finance -> createIncome is DENIED server-side");

  // 2. Admin without Finance -> direct Finance server operation -> DENIED
  let adminFinanceDenied = false;
  try {
    const res = await createExpense({
      amount: 500,
      date: "2026-10-06",
      categoryName: "Office Supplies",
      description: "Direct unauthorized expense insert",
      ctx: adminCtxNoFinance,
    });
    if (!res.success && res.error?.message?.includes("Unauthorized")) {
      adminFinanceDenied = true;
    }
  } catch (err: any) {
    adminFinanceDenied = err.message.includes("Unauthorized") && err.message.includes("finance");
  }
  assert(adminFinanceDenied, "Admin without Finance -> createExpense is DENIED server-side");

  // 3. Worker without Sales -> direct Sales operation -> DENIED
  let workerSalesDenied = false;
  try {
    await createDeal({
      title: "Unauthorized Deal",
      companyName: "Acme Corp",
      serviceRevenue: 3000,
      ctx: workerCtxNoSales,
    });
  } catch (err: any) {
    workerSalesDenied = err.message.includes("Unauthorized") && err.message.includes("sales");
  }
  assert(workerSalesDenied, "Worker without Sales -> createDeal is DENIED server-side");

  // 4. Admin without Accounts -> direct Account Management operation -> DENIED
  let adminAccountsDenied = false;
  try {
    await createAccount({
      email: "should.fail@sada.agency",
      password: "Password123!",
      displayName: "Unauthorized Account",
      role: "worker",
    }, undefined, adminCtxNoAccounts);
  } catch (err: any) {
    adminAccountsDenied = err.message.includes("Unauthorized") || err.message.includes("Super Admin");
  }
  assert(adminAccountsDenied, "Admin -> createAccount is DENIED server-side");

  // 5. Worker attempting Account Management -> direct account operation -> DENIED
  let workerAccountOpDenied = false;
  try {
    await deleteAccount("00000000-0000-0000-0000-000000000000", workerCtxAccountOp);
  } catch (err: any) {
    workerAccountOpDenied = err.message.includes("Unauthorized");
  }
  assert(workerAccountOpDenied, "Worker -> deleteAccount is DENIED server-side");

  // 6. Non-Super Admin attempting permission modification via RPC -> DENIED by database
  const workerClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
  });
  // Sign in as worker
  const { data: workerAuth, error: wAuthErr } = await workerClient.auth.signInWithPassword({
    email: testUserEmail,
    password: "TestPassword123!",
  });
  assert(!wAuthErr && Boolean(workerAuth?.user), "Worker authenticated for negative database tests");

  const { error: wRpcErr } = await workerClient.rpc("admin_update_account_permissions", {
    _target_user_id: testUserId,
    _permissions: { finance: true },
  });
  assert(
    Boolean(wRpcErr) && (wRpcErr!.message.includes("Unauthorized") || wRpcErr!.message.includes("Super Admin")),
    "Worker calling admin_update_account_permissions -> DENIED by database authorization"
  );

  // -------------------------------------------------------------
  // GROUP C: DATABASE / RLS LEVEL VERIFICATION
  // -------------------------------------------------------------
  console.log("\n--- GROUP C: Database / RLS Level Verification ---");

  // 1. Worker direct write to user_module_permissions table -> DENIED by RLS
  const { error: wTablePermErr } = await workerClient
    .from("user_module_permissions")
    .insert({
      user_id: testUserId,
      module: "accounts",
      enabled: true,
      actions: { view: true, delete: true },
    });
  assert(Boolean(wTablePermErr), "Worker direct INSERT into public.user_module_permissions is BLOCKED by RLS");

  // 2. Worker attempting privilege escalation via self-profile update -> Trigger BLOCKS mutation
  const { error: wProfileErr } = await workerClient
    .from("profiles")
    .update({ module_permissions: { accounts: true, finance: true } })
    .eq("id", testUserId);

  // Check whether trigger blocked escalation or preserved existing values
  const { data: profAfterEscalation } = await client
    .from("profiles")
    .select("module_permissions")
    .eq("id", testUserId)
    .single();

  const accountsEscalated = Boolean(profAfterEscalation?.module_permissions?.accounts);
  assert(!accountsEscalated, "Trigger trg_guard_profiles_module_permissions BLOCKED privilege escalation attempt");

  // 3. Worker reading account audit logs -> DENIED by RLS (returns 0 rows or error)
  const { data: wAuditRows } = await workerClient.from("account_audit_logs").select("*");
  assert(
    !wAuditRows || wAuditRows.length === 0,
    "Worker reading account_audit_logs yields 0 rows due to strict RLS isolation"
  );

  // -------------------------------------------------------------
  // GROUP D: ROOT ACCOUNTS INVARIANT
  // -------------------------------------------------------------
  console.log("\n--- GROUP D: Root Accounts Invariant ---");

  // 1. Super Admin has accounts = true
  assert(
    getEffectiveModulePermission("accounts", "super_admin") === true,
    "Super Admin has accounts access"
  );

  // 2. Admin cannot have accounts access even with explicit override = true
  const adminWithAccountsOverride: UserModulePermissions = { accounts: true };
  assert(
    getEffectiveModulePermission("accounts", "admin", adminWithAccountsOverride) === false,
    "Admin + accounts override -> DENIED (mathematically enforced)"
  );

  // 3. Worker cannot have accounts access even with explicit override = true
  const workerWithAccountsOverride: UserModulePermissions = { accounts: true };
  assert(
    getEffectiveModulePermission("accounts", "worker", workerWithAccountsOverride) === false,
    "Worker + accounts override -> DENIED (mathematically enforced)"
  );

  // 4. canAccessModule rejects accounts for non-superadmin
  assert(
    canAccessModule("admin", "accounts", adminWithAccountsOverride) === false,
    "canAccessModule('admin', 'accounts') returns false"
  );
  assert(
    canAccessModule("worker", "accounts", workerWithAccountsOverride) === false,
    "canAccessModule('worker', 'accounts') returns false"
  );

  // -------------------------------------------------------------
  // GROUP E: DELETE ACTION INVARIANT
  // -------------------------------------------------------------
  console.log("\n--- GROUP E: Delete Action Invariant ---");

  // 1. Delete is allowed for Super Admin
  assert(
    canPerformModuleAction("tasks", "delete", "super_admin") === true,
    "Super Admin can perform delete action"
  );

  // 2. Delete is prohibited for Admin even if enabled in custom actions
  const adminDeleteOverride: UserModulePermissions = {
    tasks: { enabled: true, actions: { delete: true, edit: true } },
  };
  assert(
    canPerformModuleAction("tasks", "delete", "admin", adminDeleteOverride) === false,
    "Admin CANNOT perform delete action even if delete=true in custom override"
  );

  // 3. Delete is prohibited for Worker
  const workerDeleteOverride: UserModulePermissions = {
    tasks: { enabled: true, actions: { delete: true, edit: true } },
  };
  assert(
    canPerformModuleAction("tasks", "delete", "worker", workerDeleteOverride) === false,
    "Worker CANNOT perform delete action even if delete=true in custom override"
  );

  // 4. Server-level delete rejected for non-Super Admin
  let workerDeleteThrew = false;
  try {
    assertCanDelete(workerCtxAccountOp, "task");
  } catch (err: any) {
    workerDeleteThrew = err.message.includes("Super Admin") && err.message.includes("delete");
  }
  assert(workerDeleteThrew, "assertCanDelete threw for Worker");

  // 5. deletePackage rejects non-superadmin actor
  const pkgDeleteResult = await deletePackage("00000000-0000-0000-0000-000000000000", { role: "admin" });
  assert(
    pkgDeleteResult.success === false && pkgDeleteResult.error?.includes("Super Admin"),
    "deletePackage rejected Admin actor: Only Super Admin can delete packages"
  );

  // -------------------------------------------------------------
  // GROUP F: ACCOUNT PROVISIONING & COMPENSATING ROLLBACK
  // -------------------------------------------------------------
  console.log("\n--- GROUP F: Account Provisioning & Compensating Rollback ---");

  const provisionSuccessEmail = `prov.success.${Date.now()}@sada.agency`;
  const provCustomPerms: UserModulePermissions = {
    sales: true,
    calendar: true,
  };

  // 1. Successful Provisioning with custom module permissions
  const successfulProv = await createAccount(
    {
      email: provisionSuccessEmail,
      password: "Password123!",
      displayName: "Successful Provisioning Specialist",
      role: "worker",
      division: "Design",
      position: "UI Specialist",
      modulePermissions: provCustomPerms,
    },
    client
  );

  assert(Boolean(successfulProv.user_id), "Account created with user_id");
  assert(Boolean(successfulProv.team_member_id), "Team member linked atomically");

  // Verify profile and permissions exist
  const { data: provProf } = await client.from("profiles").select("*").eq("id", successfulProv.user_id).single();
  assert(provProf && provProf.display_name === "Successful Provisioning Specialist", "Profile created with correct name");

  const { data: provUmp } = await client
    .from("user_module_permissions")
    .select("module, enabled")
    .eq("user_id", successfulProv.user_id);

  assert(
    provUmp && provUmp.some((r) => r.module === "sales" && r.enabled === true),
    "user_module_permissions created transactionally during provisioning"
  );

  // 2. Compensating Rollback on Provisioning Failure
  // Simulate provisioning call with an invalid role that causes PostgreSQL RPC to fail
  const failingEmail = `prov.fail.${Date.now()}@sada.agency`;
  let provFailedCaught = false;
  try {
    await createAccount(
      {
        email: failingEmail,
        password: "Password123!",
        displayName: "Will Fail",
        role: "invalid_hacker_role" as any,
      },
      client
    );
  } catch (err: any) {
    provFailedCaught = true;
  }
  assert(provFailedCaught, "Provisioning with invalid role failed as expected");

  // Verify compensating rollback: Auth user lookup returns null / no orphaned user
  const { data: orphanedUid } = await client.rpc("admin_get_auth_user_id_by_email", {
    _email: failingEmail,
  });
  assert(
    orphanedUid === null || orphanedUid === undefined,
    "Compensating rollback verified: No orphaned auth user left in system"
  );

  // -------------------------------------------------------------
  // GROUP G: COMPLETE MODULE ROUTE MAPPING
  // -------------------------------------------------------------
  console.log("\n--- GROUP G: Complete Module Route Mapping ---");

  // Verify all 16 canonical modules
  assert(resolveModuleFromPath("/admin") === "dashboard", "/admin -> dashboard");
  assert(resolveModuleFromPath("/admin/clients") === "clients", "/admin/clients -> clients");
  assert(resolveModuleFromPath("/admin/clients/123-abc") === "clients", "/admin/clients/:id -> clients");
  assert(resolveModuleFromPath("/admin/my-work") === "tasks", "/admin/my-work -> tasks");
  assert(resolveModuleFromPath("/admin/calendar") === "calendar", "/admin/calendar -> calendar");
  assert(resolveModuleFromPath("/admin/client-projects") === "workspaces", "/admin/client-projects -> workspaces");
  assert(resolveModuleFromPath("/admin/client-projects/proj-99") === "workspaces", "/admin/client-projects/:id -> workspaces");
  assert(resolveModuleFromPath("/admin/team-workload") === "team", "/admin/team-workload -> team");
  assert(resolveModuleFromPath("/admin/sales") === "sales", "/admin/sales -> sales");
  assert(resolveModuleFromPath("/admin/deals") === "sales", "/admin/deals -> sales");
  assert(resolveModuleFromPath("/admin/commissions") === "sales", "/admin/commissions -> sales");
  assert(resolveModuleFromPath("/admin/packages") === "packages", "/admin/packages -> packages");
  assert(resolveModuleFromPath("/admin/analytics") === "analytics", "/admin/analytics -> analytics");
  assert(resolveModuleFromPath("/admin/contact") === "inquiries", "/admin/contact -> inquiries");
  assert(resolveModuleFromPath("/admin/finance") === "finance", "/admin/finance -> finance");
  assert(resolveModuleFromPath("/admin/my-salary") === "compensation", "/admin/my-salary -> compensation");
  assert(resolveModuleFromPath("/admin/salary") === "compensation", "/admin/salary -> compensation");
  assert(resolveModuleFromPath("/admin/workflow-templates") === "workflows", "/admin/workflow-templates -> workflows");
  assert(resolveModuleFromPath("/admin/business-rules") === "business_rules", "/admin/business-rules -> business_rules");
  assert(resolveModuleFromPath("/admin/settings/business-rules") === "business_rules", "/admin/settings/business-rules -> business_rules");
  assert(resolveModuleFromPath("/admin/accounts") === "accounts", "/admin/accounts -> accounts");

  // Verify Content CMS child routes
  assert(resolveModuleFromPath("/admin/projects") === "content_cms", "/admin/projects -> content_cms");
  assert(resolveModuleFromPath("/admin/projects/proj-123") === "content_cms", "/admin/projects/:id -> content_cms");
  assert(resolveModuleFromPath("/admin/reels") === "content_cms", "/admin/reels -> content_cms");
  assert(resolveModuleFromPath("/admin/blog") === "content_cms", "/admin/blog -> content_cms");
  assert(resolveModuleFromPath("/admin/blog/post-456") === "content_cms", "/admin/blog/:id -> content_cms");
  assert(resolveModuleFromPath("/admin/products") === "content_cms", "/admin/products -> content_cms");
  assert(resolveModuleFromPath("/admin/products/item-789") === "content_cms", "/admin/products/:id -> content_cms");
  assert(resolveModuleFromPath("/admin/testimonials") === "content_cms", "/admin/testimonials -> content_cms");
  assert(resolveModuleFromPath("/admin/testimonials/test-101") === "content_cms", "/admin/testimonials/:id -> content_cms");

  // Verify parent module route protection applies to child routes
  const workerWithCMS = { role: "worker", customPermissions: { content_cms: true } };
  const workerWithoutCMS = { role: "worker", customPermissions: { content_cms: false } };
  assert(canAccessModule(workerWithCMS, resolveModuleFromPath("/admin/projects/proj-123")!) === true, "Worker with CMS can access /admin/projects/:id");
  assert(canAccessModule(workerWithoutCMS, resolveModuleFromPath("/admin/projects/proj-123")!) === false, "Worker without CMS cannot access /admin/projects/:id");

  // -------------------------------------------------------------
  // GROUP H: PERMISSION REFRESH & SESSION CONSISTENCY
  // -------------------------------------------------------------
  console.log("\n--- GROUP H: Permission Refresh & Session Consistency ---");

  // 1. Initial State: testUserId had sales = true, finance = true
  const initialPerms = await fetchUserModulePermissions(testUserId, client);
  assert(Boolean(initialPerms?.finance), "Initial permission has finance = true");

  // 2. Super Admin updates permissions: Revoke finance, grant packages
  await updateAccountPermissions(
    testUserId,
    {
      finance: false,
      packages: true,
    },
    client
  );

  // 3. Immediately re-fetch from canonical store
  const updatedPerms = await fetchUserModulePermissions(testUserId, client);
  assert(
    !updatedPerms?.finance || (typeof updatedPerms.finance === "object" && !updatedPerms.finance.enabled),
    "Refreshed permissions reflect finance = false without application rebuild"
  );
  assert(
    updatedPerms?.packages === true || (typeof updatedPerms?.packages === "object" && updatedPerms.packages.enabled),
    "Refreshed permissions reflect packages = true dynamically"
  );

  // 4. Verify effective permission computation updates immediately
  const effectivePackages = getEffectiveModulePermission("packages", "worker", updatedPerms);
  const effectiveFinance = getEffectiveModulePermission("finance", "worker", updatedPerms);
  assert(effectivePackages === true, "Effective permission for packages is now TRUE");
  assert(effectiveFinance === false, "Effective permission for finance is now FALSE");

  // Cleanup test accounts
  await deleteAccount(testUserId, undefined, client);
  await deleteAccount(successfulProv.user_id, undefined, client);
  console.log("Cleaned up test accounts successfully.");

  console.log("\n=================================================================");
  console.log("🎉 ALL PHASE 3.1 SECURITY HARDENING TESTS PASSED (100% SUCCESS)");
  console.log("=================================================================\n");
}

runSecurityHardeningSuite().catch((err) => {
  console.error("Test suite unhandled error:", err);
  process.exit(1);
});
