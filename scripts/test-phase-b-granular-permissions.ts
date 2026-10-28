import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import {
  type SadaRole,
  type SadaModule,
  getEffectiveModulePermission,
  getEffectiveActionPermission,
  canPerformAction,
  hasPermission,
  MODULE_ACTIONS_CATALOG,
} from "../src/types/permissions";
import {
  can,
  canAccessModule,
  normalizeRole,
  type PermissionContext,
} from "../src/lib/permissions";
import {
  evaluateRouteAccess,
  resolveAuthoritativeSecurityContext,
  invalidateSecurityContextCache,
} from "../src/lib/security-isolation-service";
import { createAccount, deleteAccount, updateAccountPermissions } from "../src/lib/account-service";
import { createDeal } from "../src/lib/sales-service";

let totalAssertions = 0;

function assert(condition: boolean, message: string) {
  totalAssertions++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  ✅ PASS: ${message}`);
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

const superClient = createClient(supabaseUrl, anonKey);

async function runPhaseBGranularPermissionsSuite() {
  console.log("=======================================================================");
  console.log("SADA OS — PHASE B GRANULAR PERMISSIONS & ACCESS CONTROL TEST SUITE");
  console.log("=======================================================================\n");

  // 1. Authenticate Harness as Super Admin
  const { data: saLogin, error: saLoginErr } = await superClient.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  assert(!saLoginErr && Boolean(saLogin?.user), "Harness authenticated as Super Admin (qa.superadmin@sada.agency)");
  const superAdminUserId = saLogin!.user!.id;

  // 2. Create Ephemeral Test Users:
  // a) Test Admin
  const testAdminEmail = `phaseb.admin.${Date.now()}@sada.agency`;
  const provAdmin = await createAccount(
    {
      email: testAdminEmail,
      password: "AdminPassword123!",
      displayName: "PhaseB Test Admin",
      role: "admin",
      division: "Operations",
      position: "Operations Coordinator",
      status: "active",
    },
    superClient
  );
  const adminUserId = provAdmin.user_id;

  // b) Test Worker
  const testWorkerEmail = `phaseb.worker.${Date.now()}@sada.agency`;
  const provWorker = await createAccount(
    {
      email: testWorkerEmail,
      password: "WorkerPassword123!",
      displayName: "PhaseB Test Worker",
      role: "worker",
      division: "Production",
      position: "Video Specialist",
      status: "active",
    },
    superClient
  );
  const workerUserId = provWorker.user_id;

  try {
    // =====================================================================
    // GROUP 1: Super Admin Root Access Invariant
    // =====================================================================
    console.log("\n--- GROUP 1: Super Admin Full Granular Root Access ---");

    // DB function has_permission
    const { data: saPerm1 } = await (superClient as any).rpc("has_permission", {
      _user_id: superAdminUserId,
      _permission: "sales.create_lead",
    });
    assert(saPerm1 === true, "Super Admin has sales.create_lead (DB level)");

    const { data: saPerm2 } = await (superClient as any).rpc("has_permission", {
      _user_id: superAdminUserId,
      _permission: "sales.delete_lead",
    });
    assert(saPerm2 === true, "Super Admin has sales.delete_lead (DB level)");

    const { data: saPerm3 } = await (superClient as any).rpc("has_permission", {
      _user_id: superAdminUserId,
      _permission: "tasks.delete",
    });
    assert(saPerm3 === true, "Super Admin has tasks.delete (DB level)");

    const { data: saPerm4 } = await (superClient as any).rpc("has_permission", {
      _user_id: superAdminUserId,
      _permission: "finance.create_income",
    });
    assert(saPerm4 === true, "Super Admin has finance.create_income (DB level)");

    const { data: saPerm5 } = await (superClient as any).rpc("has_permission", {
      _user_id: superAdminUserId,
      _permission: "accounts.manage",
    });
    assert(saPerm5 === true, "Super Admin has accounts.manage (DB level)");

    // get_effective_user_permissions RPC
    const { data: effData, error: effErr } = await (superClient as any).rpc("get_effective_user_permissions", {
      _target_user_id: superAdminUserId,
    });
    assert(!effErr && effData?.is_super_admin === true, "get_effective_user_permissions reflects Super Admin status");

    // =====================================================================
    // GROUP 2: Role Baseline Inheritance
    // =====================================================================
    console.log("\n--- GROUP 2: Role Baseline Inheritance (Admin & Worker) ---");

    // Admin Defaults
    const { data: admTaskCreate } = await (superClient as any).rpc("has_permission", {
      _user_id: adminUserId,
      _permission: "tasks.create",
    });
    assert(admTaskCreate === true, "Admin baseline inherits tasks.create = true");

    const { data: admTaskAssign } = await (superClient as any).rpc("has_permission", {
      _user_id: adminUserId,
      _permission: "tasks.assign",
    });
    assert(admTaskAssign === true, "Admin baseline inherits tasks.assign = true");

    const { data: admTaskSubtask } = await (superClient as any).rpc("has_permission", {
      _user_id: adminUserId,
      _permission: "tasks.create_subtask",
    });
    assert(admTaskSubtask === true, "Admin baseline inherits tasks.create_subtask = true");

    const { data: admTaskDelete } = await (superClient as any).rpc("has_permission", {
      _user_id: adminUserId,
      _permission: "tasks.delete",
    });
    assert(admTaskDelete === false, "Admin baseline delete is false (permanent delete invariant)");

    const { data: admSalesLead } = await (superClient as any).rpc("has_permission", {
      _user_id: adminUserId,
      _permission: "sales.create_lead",
    });
    assert(admSalesLead === true, "Admin baseline inherits sales.create_lead = true");

    const { data: admSalesDelete } = await (superClient as any).rpc("has_permission", {
      _user_id: adminUserId,
      _permission: "sales.delete_lead",
    });
    assert(admSalesDelete === false, "Admin baseline sales.delete_lead is false");

    const { data: admFinanceIncome } = await (superClient as any).rpc("has_permission", {
      _user_id: adminUserId,
      _permission: "finance.create_income",
    });
    assert(admFinanceIncome === false, "Admin baseline finance.create_income is false (finance disabled by default)");

    // Worker Defaults
    const { data: wrkTaskView } = await (superClient as any).rpc("has_permission", {
      _user_id: workerUserId,
      _permission: "tasks.view",
    });
    assert(wrkTaskView === true, "Worker baseline inherits tasks.view = true");

    const { data: wrkTaskStatus } = await (superClient as any).rpc("has_permission", {
      _user_id: workerUserId,
      _permission: "tasks.change_status",
    });
    assert(wrkTaskStatus === true, "Worker baseline inherits tasks.change_status = true");

    const { data: wrkTaskCreate } = await (superClient as any).rpc("has_permission", {
      _user_id: workerUserId,
      _permission: "tasks.create",
    });
    assert(wrkTaskCreate === false, "Worker baseline tasks.create is false");

    const { data: wrkTaskSubtask } = await (superClient as any).rpc("has_permission", {
      _user_id: workerUserId,
      _permission: "tasks.create_subtask",
    });
    assert(wrkTaskSubtask === false, "Worker baseline tasks.create_subtask is false");

    const { data: wrkSalesLead } = await (superClient as any).rpc("has_permission", {
      _user_id: workerUserId,
      _permission: "sales.create_lead",
    });
    assert(wrkSalesLead === false, "Worker baseline sales.create_lead is false");

    // =====================================================================
    // GROUP 3: Granular Overrides & Module Master Switch
    // =====================================================================
    console.log("\n--- GROUP 3: Granular Overrides & Module Master Switch ---");

    // 1. Disable tasks module master switch for Admin
    await updateAccountPermissions(adminUserId, {
      tasks: { enabled: false },
    }, superClient);

    const { data: admTaskDisabledModule } = await (superClient as any).rpc("has_permission", {
      _user_id: adminUserId,
      _permission: "tasks.create",
    });
    assert(admTaskDisabledModule === false, "Module master switch OFF disables all granular actions for tasks");

    const { data: admTaskViewDisabled } = await (superClient as any).rpc("has_permission", {
      _user_id: adminUserId,
      _permission: "tasks.view",
    });
    assert(admTaskViewDisabled === false, "Module master switch OFF disables tasks.view");

    // 2. Re-enable tasks, but explicitly disable tasks.assign
    await updateAccountPermissions(adminUserId, {
      tasks: {
        enabled: true,
        actions: { assign: false, create: true },
      },
    }, superClient);

    const { data: admTaskCreateReenabled } = await (superClient as any).rpc("has_permission", {
      _user_id: adminUserId,
      _permission: "tasks.create",
    });
    assert(admTaskCreateReenabled === true, "Explicit action tasks.create = true succeeds");

    const { data: admTaskAssignOverridden } = await (superClient as any).rpc("has_permission", {
      _user_id: adminUserId,
      _permission: "tasks.assign",
    });
    assert(admTaskAssignOverridden === false, "Explicit action override tasks.assign = false takes precedence over admin default");

    // 3. Grant worker sales.create_lead explicitly
    await updateAccountPermissions(workerUserId, {
      sales: {
        enabled: true,
        actions: { create_lead: true, edit_lead: false },
      },
    }, superClient);

    const { data: wrkSalesGranted } = await (superClient as any).rpc("has_permission", {
      _user_id: workerUserId,
      _permission: "sales.create_lead",
    });
    assert(wrkSalesGranted === true, "Worker explicitly granted sales.create_lead = true evaluates to true");

    const { data: wrkSalesEditDenied } = await (superClient as any).rpc("has_permission", {
      _user_id: workerUserId,
      _permission: "sales.edit_lead",
    });
    assert(wrkSalesEditDenied === false, "Worker sales.edit_lead = false is strictly enforced");

    // 4. Invariant: Permanent delete cannot be granted to non-super-admins
    await updateAccountPermissions(adminUserId, {
      tasks: {
        enabled: true,
        actions: { delete: true },
      },
    }, superClient);

    const { data: admDeleteAttempt } = await (superClient as any).rpc("has_permission", {
      _user_id: adminUserId,
      _permission: "tasks.delete",
    });
    assert(admDeleteAttempt === false, "Permanent delete invariant: tasks.delete returns false even if explicit override attempted");

    // =====================================================================
    // GROUP 4: Non-Super-Admin Negative & Forged Payload Tests
    // =====================================================================
    console.log("\n--- GROUP 4: Non-Super-Admin Negative & Security Invariants ---");

    // Authenticate client as Admin
    const adminClient = createClient(supabaseUrl, anonKey);
    const { error: admLoginErr } = await adminClient.auth.signInWithPassword({
      email: testAdminEmail,
      password: "AdminPassword123!",
    });
    assert(!admLoginErr, "Authenticated as test Admin");

    // Negative 1: Admin calls admin_update_account_permissions RPC -> must fail
    const { error: admRpcErr } = await (adminClient as any).rpc("admin_update_account_permissions", {
      _target_user_id: workerUserId,
      _permissions: { finance: { enabled: true } },
    });
    assert(Boolean(admRpcErr), `Admin rejected when invoking admin_update_account_permissions (${admRpcErr?.message})`);

    // Negative 2: Admin direct insert into user_module_permissions table -> must fail RLS
    const { error: admTableInsertErr } = await (adminClient as any)
      .from("user_module_permissions")
      .insert({
        user_id: adminUserId,
        module: "finance",
        enabled: true,
      });
    assert(Boolean(admTableInsertErr), `Admin direct INSERT on user_module_permissions rejected by RLS (${admTableInsertErr?.message})`);

    // Negative 3: Admin inspects other user's permissions via get_effective_user_permissions RPC -> must fail
    const { error: admEffInspectErr } = await (adminClient as any).rpc("get_effective_user_permissions", {
      _target_user_id: superAdminUserId,
    });
    assert(Boolean(admEffInspectErr), `Admin inspecting another user's permissions rejected (${admEffInspectErr?.message})`);

    // Negative 4: Authenticate client as Worker and verify rejection
    const workerClient = createClient(supabaseUrl, anonKey);
    const { error: wrkLoginErr } = await workerClient.auth.signInWithPassword({
      email: testWorkerEmail,
      password: "WorkerPassword123!",
    });
    assert(!wrkLoginErr, "Authenticated as test Worker");

    const { error: wrkRpcErr } = await (workerClient as any).rpc("admin_update_account_permissions", {
      _target_user_id: workerUserId,
      _permissions: { finance: { enabled: true } },
    });
    assert(Boolean(wrkRpcErr), `Worker rejected when invoking admin_update_account_permissions (${wrkRpcErr?.message})`);

    // Negative 5: Forged role in sales service cannot bypass permissions
    try {
      await createDeal({
        title: "Forged Lead",
        companyName: "Fake Corp",
        serviceRevenue: 1000,
        actorRole: "super_admin", // Forged!
        ctx: { role: "worker", userId: workerUserId, customPermissions: { sales: false } },
      });
      assert(false, "Forged role should have failed");
    } catch (forgedErr: any) {
      assert(true, `Forged actorRole='super_admin' rejected: ${forgedErr?.message}`);
    }

    // =====================================================================
    // GROUP 5: Route Access & Cache Invalidation
    // =====================================================================
    console.log("\n--- GROUP 5: Route Access & Permission Revocation ---");

    // Route evaluation with tasks disabled
    const evalBlocked = evaluateRouteAccess("/admin/my-work", {
      authenticated: true,
      userId: adminUserId,
      email: testAdminEmail,
      role: "admin",
      status: "active",
      effectivePermissions: { tasks: false } as any,
    });
    assert(evalBlocked.allowed === false, "Route /admin/my-work blocked when tasks module is disabled");

    const evalAllowed = evaluateRouteAccess("/admin/my-work", {
      authenticated: true,
      userId: adminUserId,
      email: testAdminEmail,
      role: "admin",
      status: "active",
      effectivePermissions: { tasks: true } as any,
    });
    assert(evalAllowed.allowed === true, "Route /admin/my-work allowed when tasks module is enabled");

    // Revocation in DB
    await updateAccountPermissions(workerUserId, {
      sales: { enabled: false },
    }, superClient);

    const { data: wrkRevoked } = await (superClient as any).rpc("has_permission", {
      _user_id: workerUserId,
      _permission: "sales.create_lead",
    });
    assert(wrkRevoked === false, "Subsequent permission check immediately returns false after revocation");

    // =====================================================================
    // GROUP 6: Audit Logging Integrity
    // =====================================================================
    console.log("\n--- GROUP 6: Audit Logging Verification ---");

    const { data: auditRows, error: auditErr } = await (superClient as any)
      .from("account_audit_logs")
      .select("*")
      .eq("action", "account_permissions_updated")
      .eq("target_user_id", workerUserId)
      .order("created_at", { ascending: false });

    assert(!auditErr && auditRows && auditRows.length > 0, "Audit trail recorded 'account_permissions_updated' log");
    const latestAudit = auditRows![0];
    assert(latestAudit.actor_id === superAdminUserId, "Audit log records authoritative actor_id");
    assert(latestAudit.target_user_id === workerUserId, "Audit log records target_user_id");
    assert(Boolean(latestAudit.metadata?.permissions), "Audit log preserves permissions metadata snapshot");

  } finally {
    // Cleanup ephemeral test accounts
    console.log("\nCleaning up ephemeral test accounts...");
    try {
      await deleteAccount(adminUserId, undefined, superClient);
      await deleteAccount(workerUserId, undefined, superClient);
      console.log("Cleanup complete.");
    } catch (cleanupErr) {
      console.warn("Cleanup notice:", cleanupErr);
    }
  }

  console.log("\n=======================================================================");
  console.log(`TOTAL PHASE B ASSERTIONS: ${totalAssertions} | ALL PASSED (100% SUCCESS)`);
  console.log("=======================================================================\n");
}

runPhaseBGranularPermissionsSuite().catch((err) => {
  console.error("Test Suite Unhandled Exception:", err);
  process.exit(1);
});
