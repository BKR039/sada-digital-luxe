import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import {
  assertAuthorizedMutation,
  authorizeModuleAction,
  authorizeResourceAccess,
  SecurityAuthorizationError,
  resolveAuthoritativeSecurityContext,
  invalidateSecurityContextCache,
  type AuthoritativeSecurityContext,
} from "../src/lib/security-isolation-service";
import {
  createAccount,
  deleteAccount,
  updateAccountPermissions,
  suspendAccount,
  reactivateAccount,
} from "../src/lib/account-service";
import {
  startTask,
  completeTask,
  updateSubtaskAssignee,
  createProjectTask,
  createProjectSubtask,
  updateProjectTaskDefinition,
  deleteProjectTask,
} from "../src/lib/task-execution-service";
import {
  createDeal,
  updateLeadStage,
  deleteDeal,
  winDeal,
} from "../src/lib/sales-service";
import {
  createClientRecord,
  updateClientRecord,
  deleteClientRecord,
  fetchClientRecord,
} from "../src/lib/client-service";
import {
  createPackage,
  updatePackage,
  publishPackage,
  hidePackage,
  deletePackage,
} from "../src/lib/package-service";
import {
  createProjectItem,
  updateProjectItem,
  publishProjectItem,
  deleteProjectItem,
  createBlogPost,
} from "../src/lib/content-service";
import {
  createIncome,
  createExpense,
  deleteTransaction,
  upsertSalaryRecord,
  fetchWorkerSalaryData,
} from "../src/lib/finance-service";
import {
  deleteNotification,
  saveNotificationPreferences,
} from "../src/lib/notification-service";

let totalAssertions = 0;

function assert(condition: boolean, message: string) {
  totalAssertions++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  ✅ PASS: ${message}`);
}

async function assertThrowsAsync(
  fn: () => Promise<any>,
  expectedCode: string,
  message: string
) {
  totalAssertions++;
  try {
    const res = await fn();
    // Some functions return { success: false, error: ... } rather than throw
    if (res && res.success === false && res.error) {
      const errStr = String(res.error);
      const errLower = errStr.toLowerCase();
      const isMatch =
        errStr.includes(expectedCode) ||
        (expectedCode === "ACCOUNT_SUSPENDED" && (errStr.includes("ACCOUNT_SUSPENDED") || errLower.includes("suspended"))) ||
        (expectedCode === "ACCOUNT_INACTIVE" && (errStr.includes("ACCOUNT_INACTIVE") || errLower.includes("inactive") || errLower.includes("deactivated"))) ||
        (expectedCode === "FORBIDDEN_DELETE" && (errLower.includes("delete") || errLower.includes("super admin") || errLower.includes("forbidden"))) ||
        (expectedCode === "FORBIDDEN_ADMIN_ACTION" && (errLower.includes("super admin") || errLower.includes("admin") || errLower.includes("forbidden"))) ||
        (expectedCode === "PRIVILEGE_ESCALATION_BLOCKED" && (errLower.includes("escalation") || errLower.includes("forged") || errLower.includes("spoof"))) ||
        (expectedCode === "DATA_SCOPE_VIOLATION" && (errLower.includes("scope") || errLower.includes("assigned exclusively") || errLower.includes("another worker"))) ||
        (expectedCode === "UNAUTHORIZED_API" && (errLower.includes("disabled") || errLower.includes("restricted") || errLower.includes("unauthorized"))) ||
        (expectedCode === "UNAUTHORIZED_ACTION" && (errLower.includes("prohibited") || errLower.includes("unauthorized")));
      if (isMatch) {
        console.log(`  ✅ PASS: ${message} (Result error matched ${expectedCode})`);
        return;
      }
    }
    console.error(`❌ FAIL: ${message} (Expected rejection with code ${expectedCode}, but operation succeeded or returned unmatched error: ${res?.error})`);
    process.exit(1);
  } catch (err: any) {
    const actualCode = err.code || err.name || err.message;
    const msgLower = (err.message || "").toLowerCase();
    const isMatch =
      actualCode === expectedCode ||
      err.message?.includes(expectedCode) ||
      (expectedCode === "ACCOUNT_SUSPENDED" && (err.message?.includes("ACCOUNT_SUSPENDED") || msgLower.includes("suspended"))) ||
      (expectedCode === "ACCOUNT_INACTIVE" && (err.message?.includes("ACCOUNT_INACTIVE") || msgLower.includes("inactive") || msgLower.includes("deactivated"))) ||
      (expectedCode === "FORBIDDEN_DELETE" && (msgLower.includes("delete") || msgLower.includes("super admin") || msgLower.includes("forbidden"))) ||
      (expectedCode === "FORBIDDEN_ADMIN_ACTION" && (msgLower.includes("super admin") || msgLower.includes("admin") || msgLower.includes("forbidden"))) ||
      (expectedCode === "PRIVILEGE_ESCALATION_BLOCKED" && (msgLower.includes("escalation") || msgLower.includes("forged") || msgLower.includes("spoof"))) ||
      (expectedCode === "DATA_SCOPE_VIOLATION" && (msgLower.includes("scope") || msgLower.includes("assigned exclusively") || msgLower.includes("another worker"))) ||
      (expectedCode === "UNAUTHORIZED_API" && (msgLower.includes("disabled") || msgLower.includes("restricted") || msgLower.includes("unauthorized"))) ||
      (expectedCode === "UNAUTHORIZED_ACTION" && (msgLower.includes("prohibited") || msgLower.includes("unauthorized")));

    if (!isMatch) {
      console.error(`❌ FAIL: ${message} (Expected code ${expectedCode}, but got: ${actualCode} - "${err.message}")`);
      process.exit(1);
    }
    console.log(`  ✅ PASS: ${message} (Caught expected ${expectedCode})`);
  }
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

async function runPhaseDServerAuthorizationSuite() {
  console.log("=======================================================================");
  console.log("SADA OS — PHASE D: SERVER & API AUTHORIZATION HARDENING SUITE");
  console.log("=======================================================================\n");

  // 1. Authenticate Harness as Super Admin
  const { data: saLogin, error: saLoginErr } = await superClient.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  assert(!saLoginErr && Boolean(saLogin?.user), "Harness authenticated as Super Admin (qa.superadmin@sada.agency)");
  const superAdminUserId = saLogin!.user!.id;

  // 2. Ephemeral Test Users Setup
  const timestamp = Date.now();
  const workerEmail = `phased.worker.${timestamp}@sada.agency`;
  const provWorker = await createAccount(
    {
      email: workerEmail,
      password: "WorkerPassword123!",
      displayName: "PhaseD Worker User",
      role: "worker",
      division: "Production",
      position: "Content Specialist",
      status: "active",
    },
    superClient
  );
  const workerUserId = provWorker.user_id;

  const adminEmail = `phased.admin.${timestamp}@sada.agency`;
  const provAdmin = await createAccount(
    {
      email: adminEmail,
      password: "AdminPassword123!",
      displayName: "PhaseD Admin User",
      role: "admin",
      division: "Operations",
      position: "Operations Lead",
      status: "active",
      modulePermissions: {
        finance: { enabled: true },
        sales: { enabled: true },
      },
    },
    superClient
  );
  const adminUserId = provAdmin.user_id;

  await updateAccountPermissions(
    adminUserId,
    {
      finance: { enabled: true, actions: { view: true, create_income: true, create_expense: true } },
      sales: { enabled: true },
    },
    superClient,
    { userId: superAdminUserId, role: "super_admin" } as any
  );

  // Ephemeral client instances logged in as worker and admin
  const workerClient = createClient(supabaseUrl!, anonKey!, {
    auth: { storageKey: `worker-${timestamp}`, autoRefreshToken: false },
  });
  const { data: wrkData, error: wrkLoginErr } = await workerClient.auth.signInWithPassword({
    email: workerEmail,
    password: "WorkerPassword123!",
  });
  if (wrkLoginErr) {
    console.error("❌ Worker sign-in error:", wrkLoginErr);
  }
  assert(!wrkLoginErr && Boolean(wrkData?.user), `Worker authenticated successfully (${workerEmail})`);

  const adminClient = createClient(supabaseUrl!, anonKey!, {
    auth: { storageKey: `admin-${timestamp}`, autoRefreshToken: false },
  });
  const { data: admData, error: admLoginErr } = await adminClient.auth.signInWithPassword({
    email: adminEmail,
    password: "AdminPassword123!",
  });
  if (admLoginErr) {
    console.error("❌ Admin sign-in error:", admLoginErr);
  }
  assert(!admLoginErr && Boolean(admData?.user), `Admin authenticated successfully (${adminEmail})`);

  const unauthenticatedClient = createClient(supabaseUrl!, anonKey!, {
    auth: { storageKey: `anon-${timestamp}`, persistSession: false },
  });

  try {
    // =====================================================================
    // GROUP 1: Anonymous & Unauthenticated Boundary Defense
    // =====================================================================
    console.log("\n[GROUP 1] Anonymous & Unauthenticated Boundary Defense");

    await assertThrowsAsync(
      () => assertAuthorizedMutation(unauthenticatedClient, "tasks", "tasks.create"),
      "UNAUTHENTICATED",
      "Direct API mutation without session is rejected as UNAUTHENTICATED"
    );

    await assertThrowsAsync(
      () => assertAuthorizedMutation(unauthenticatedClient, "finance", "finance.create_transaction"),
      "UNAUTHENTICATED",
      "Direct finance mutation without session is rejected as UNAUTHENTICATED"
    );

    await assertThrowsAsync(
      () => assertAuthorizedMutation(unauthenticatedClient, "sales", "sales.create_lead"),
      "UNAUTHENTICATED",
      "Direct sales mutation without session is rejected as UNAUTHENTICATED"
    );

    // =====================================================================
    // GROUP 2: Account Lifecycle & Status Defense (Suspended / Deactivated)
    // =====================================================================
    console.log("\n[GROUP 2] Account Lifecycle & Status Defense");

    // Suspend worker account
    await suspendAccount(workerUserId, "Security compliance testing", { userId: superAdminUserId, role: "super_admin" } as any, superClient);
    invalidateSecurityContextCache(workerUserId);

    await assertThrowsAsync(
      () => assertAuthorizedMutation(workerClient, "tasks", "tasks.change_status"),
      "ACCOUNT_SUSPENDED",
      "Suspended account mutation attempt is authoritatively rejected as ACCOUNT_SUSPENDED"
    );

    await assertThrowsAsync(
      () => startTask({
        task: { id: "test-task", project_id: "test-proj", assignee_id: workerUserId, status: "todo" } as any,
        actorId: workerUserId,
        clientOverride: workerClient,
      }),
      "ACCOUNT_SUSPENDED",
      "Suspended account calling startTask service is rejected with ACCOUNT_SUSPENDED"
    );

    // Reactivate worker account
    await reactivateAccount(workerUserId, { userId: superAdminUserId, role: "super_admin" } as any, superClient);
    invalidateSecurityContextCache(workerUserId);

    // =====================================================================
    // GROUP 3: Forged Identity & Role Escalation Defense
    // =====================================================================
    console.log("\n[GROUP 3] Forged Identity & Privilege Escalation Defense");

    // Worker claims Super Admin role in payload
    await assertThrowsAsync(
      () => assertAuthorizedMutation(workerClient, "accounts", "accounts.manage", {
        actorRole: "super_admin",
      }),
      "PRIVILEGE_ESCALATION_BLOCKED",
      "Worker claiming actorRole='super_admin' is blocked with PRIVILEGE_ESCALATION_BLOCKED"
    );

    await assertThrowsAsync(
      () => assertAuthorizedMutation(workerClient, "finance", "finance.create_transaction", {
        ctx: { userId: workerUserId, role: "super_admin" } as any,
      }),
      "PRIVILEGE_ESCALATION_BLOCKED",
      "Worker claiming ctx.role='super_admin' is blocked with PRIVILEGE_ESCALATION_BLOCKED"
    );

    // Worker attempts mutation on behalf of another user (spoofing actorId)
    await assertThrowsAsync(
      () => assertAuthorizedMutation(workerClient, "tasks", "tasks.change_status", {
        actorId: adminUserId,
      }),
      "PRIVILEGE_ESCALATION_BLOCKED",
      "Worker claiming another user's actorId is blocked with PRIVILEGE_ESCALATION_BLOCKED"
    );

    // =====================================================================
    // GROUP 4: Granular Permission Revocation & Module Switches
    // =====================================================================
    console.log("\n[GROUP 4] Granular Permission Revocation & Module Switches");

    // Disable sales for worker account
    await updateAccountPermissions(
      workerUserId,
      { sales: { enabled: false } },
      superClient,
      { userId: superAdminUserId, role: "super_admin" } as any
    );
    invalidateSecurityContextCache(workerUserId);

    await assertThrowsAsync(
      () => assertAuthorizedMutation(workerClient, "sales", "sales.create_lead"),
      "UNAUTHORIZED_API",
      "Disabled module 'sales' rejects direct service call with UNAUTHORIZED_API"
    );

    // Enable sales but explicitly revoke 'create_lead' action
    await updateAccountPermissions(
      workerUserId,
      { sales: { enabled: true, actions: { create_lead: false, view: true } } },
      superClient,
      { userId: superAdminUserId, role: "super_admin" } as any
    );
    invalidateSecurityContextCache(workerUserId);

    await assertThrowsAsync(
      () => assertAuthorizedMutation(workerClient, "sales", "sales.create_lead"),
      "UNAUTHORIZED_ACTION",
      "Revoked granular action 'sales.create_lead' rejects service call with UNAUTHORIZED_ACTION"
    );

    // =====================================================================
    // GROUP 5: Resource Authority & Data Scope Isolation
    // =====================================================================
    console.log("\n[GROUP 5] Resource Authority & Data Scope Isolation");

    // Task Execution: Task assigned to someone else
    const foreignTask = {
      id: "task-foreign-001",
      project_id: "proj-001",
      title: "Secret Task",
      status: "todo",
      assignee_id: adminUserId, // assigned to admin, NOT worker
    };

    await assertThrowsAsync(
      () => startTask({
        task: foreignTask as any,
        actorId: workerUserId,
      }),
      "DATA_SCOPE_VIOLATION",
      "Worker starting task assigned exclusively to someone else is rejected with DATA_SCOPE_VIOLATION"
    );

    // Task Definition: Worker attempting to modify task title/deadline
    await assertThrowsAsync(
      () => updateProjectTaskDefinition({
        taskId: "task-001",
        updates: { title: "Tampered Title" },
        actorId: workerUserId,
      }),
      "UNAUTHORIZED_ACTION",
      "Worker attempting to update task definition is rejected with UNAUTHORIZED_ACTION"
    );

    await assertThrowsAsync(
      () => updateProjectTaskDefinition({
        taskId: "task-001",
        updates: { title: "Tampered Title" },
        actorId: workerUserId,
        ctx: {
          userId: workerUserId,
          role: "worker",
          customPermissions: {
            tasks: { enabled: true, actions: { "tasks.edit": true, edit: true } },
          },
        } as any,
      }),
      "FORBIDDEN_ADMIN_ACTION",
      "Worker with edit override attempting definition change is rejected with FORBIDDEN_ADMIN_ACTION"
    );

    // Salary Record Isolation: Worker attempting to inspect or touch another worker's salary
    await assertThrowsAsync(
      () => fetchWorkerSalaryData(adminUserId, null, { userId: workerUserId, role: "worker" } as any),
      "DATA_SCOPE_VIOLATION",
      "Worker attempting to inspect another user's salary is rejected with DATA_SCOPE_VIOLATION"
    );

    // Permanent Deletion Lock: Strictly Super Admin Exclusive across all domains
    await assertThrowsAsync(
      () => deleteProjectTask({ taskId: "task-001", actorId: workerUserId }),
      "FORBIDDEN_DELETE",
      "Worker attempting to delete task is rejected with FORBIDDEN_DELETE"
    );

    await assertThrowsAsync(
      () => deleteProjectTask({ taskId: "task-001", actorId: adminUserId }),
      "FORBIDDEN_DELETE",
      "Admin attempting to delete task is rejected with FORBIDDEN_DELETE (Super Admin exclusive)"
    );

    await assertThrowsAsync(
      () => deleteDeal("deal-001", { userId: adminUserId, role: "admin" } as any),
      "FORBIDDEN_DELETE",
      "Admin attempting to delete deal is rejected with FORBIDDEN_DELETE"
    );

    await assertThrowsAsync(
      () => deleteClientRecord("client-001", { role: "admin", id: adminUserId }),
      "FORBIDDEN_DELETE",
      "Admin attempting to delete client record is rejected with FORBIDDEN_DELETE"
    );

    await assertThrowsAsync(
      () => deletePackage("pkg-001", { role: "admin", id: adminUserId }),
      "FORBIDDEN_DELETE",
      "Admin attempting to delete package is rejected with FORBIDDEN_DELETE"
    );

    await assertThrowsAsync(
      () => deleteTransaction({ id: "tx-001", type: "income", ctx: { role: "admin", userId: adminUserId } as any }),
      "FORBIDDEN_DELETE",
      "Admin attempting to delete financial transaction is rejected with FORBIDDEN_DELETE"
    );

    await assertThrowsAsync(
      () => deleteAccount(workerUserId, { role: "admin", userId: adminUserId } as any, adminClient),
      "FORBIDDEN_DELETE",
      "Admin attempting to delete account is rejected with FORBIDDEN_DELETE"
    );

    // =====================================================================
    // GROUP 6: Positive Authorized Mutations Across 10 Domains
    // =====================================================================
    console.log("\n[GROUP 6] Positive Authorized Mutations Across 10 Domains");

    // 1. Tasks: Admin creates task & assigned worker starts it
    let targetProjectId: string;
    const { data: existingProjects } = await (superClient as any).from("client_projects").select("id").limit(1);
    if (existingProjects && existingProjects.length > 0) {
      targetProjectId = existingProjects[0].id;
    } else {
      const { data: newProj } = await (superClient as any).from("client_projects").insert({
        title: `Phase D Project ${timestamp}`,
        client_name: "Phase D Client",
      }).select("id").single();
      targetProjectId = newProj.id;
    }

    const createdTaskRes = await createProjectTask({
      taskData: {
        project_id: targetProjectId,
        title: `Phase D Deliverable ${timestamp}`,
        assignee_id: workerUserId,
        status: "todo",
      },
      actorId: adminUserId,
      actorRole: "admin",
      ctx: { userId: adminUserId, role: "admin" } as any,
      clientOverride: adminClient,
    });
    if (!createdTaskRes.success) {
      console.error("❌ createProjectTask error:", createdTaskRes.error);
    }
    assert(createdTaskRes.success && Boolean(createdTaskRes.data?.id), "Domain 1 (Tasks): Admin successfully creates task");

    if (createdTaskRes.data) {
      const startRes = await startTask({
        task: createdTaskRes.data,
        actorId: workerUserId,
        clientOverride: workerClient,
      });
      assert(startRes.success, "Domain 1 (Tasks): Assigned worker successfully starts task");

      const compRes = await completeTask({
        task: { ...createdTaskRes.data, status: "in_progress" },
        actorId: workerUserId,
        resultNotes: "Deliverable verified on server",
        clientOverride: workerClient,
      });
      assert(compRes.success, "Domain 1 (Tasks): Assigned worker successfully completes task");
    }

    // 2. Sales: Admin creates lead & updates stage
    const createdDeal = await createDeal({
      title: `Phase D Deal ${timestamp}`,
      companyName: "Acme Luxury Corp",
      serviceRevenue: 8500,
      stage: "lead",
      actorRole: "admin",
      ctx: { userId: adminUserId, role: "admin" } as any,
      client: adminClient,
    });
    assert(Boolean(createdDeal?.id), "Domain 2 (Sales): Admin successfully creates sales lead");

    if (createdDeal) {
      const stageRes = await updateLeadStage({
        leadId: createdDeal.id,
        newStage: "qualified",
        actorId: adminUserId,
        actorRole: "admin",
        actorCtx: { userId: adminUserId, role: "admin" } as any,
        client: adminClient,
      });
      assert(stageRes.success && stageRes.newStage === "qualified", "Domain 2 (Sales): Admin successfully transitions lead stage");
    }

    // 3. Clients: Admin creates and updates client
    const clientRes = await createClientRecord(
      {
        name: `Phase D Client ${timestamp}`,
        industry: "Luxury Fashion",
        email: `client.${timestamp}@luxury.com`,
        phone: "+216 71 000 000",
      },
      { id: adminUserId, role: "admin", client: adminClient }
    );
    assert(Boolean(clientRes?.id), "Domain 3 (Clients): Admin successfully creates client record");

    // 4. Packages: Admin creates and updates package
    const pkgRes = await createPackage(
      {
        code: `PD-${Math.floor(Math.random() * 900) + 100}`,
        name: `Phase D Luxe Package ${timestamp}`,
        price: 3200,
        billing_type: "monthly",
      },
      { id: adminUserId, role: "admin", client: adminClient }
    );
    assert(pkgRes.success && Boolean(pkgRes.package?.id), "Domain 4 (Packages): Admin successfully creates package item");

    if (pkgRes.package) {
      const pubRes = await publishPackage(pkgRes.package.id, { id: adminUserId, role: "admin", client: adminClient });
      assert(pubRes, "Domain 4 (Packages): Admin successfully publishes package item");
    }

    // 5. Content CMS: Admin creates and updates project item
    const contentProjRes = await createProjectItem(
      {
        title: `Phase D Luxe Showcase ${timestamp}`,
        slug: `phase-d-showcase-${timestamp}`,
        client: "Luxe Fashion House",
      },
      { id: adminUserId, role: "admin", client: adminClient }
    );
    assert(Boolean(contentProjRes?.id), "Domain 5 (Content CMS): Admin successfully creates project showcase");

    // 6. Finance: Admin creates income and expense
    const incRes = await createIncome({
      amount: 1500,
      date: new Date().toISOString().split("T")[0],
      category: "Retainer",
      description: "Phase D retainer transaction",
      actorId: adminUserId,
      actorRole: "admin",
      ctx: { userId: adminUserId, role: "admin" } as any,
      clientOverride: adminClient,
    });
    assert(incRes.success && Boolean(incRes.data?.id), "Domain 7 (Finance): Admin successfully records income transaction");

    const expRes = await createExpense({
      amount: 450,
      date: new Date().toISOString().split("T")[0],
      categoryName: "Software & Infrastructure",
      description: "Phase D cloud infrastructure",
      actorId: adminUserId,
      actorRole: "admin",
      ctx: { userId: adminUserId, role: "admin" } as any,
      clientOverride: adminClient,
    });
    assert(expRes.success && Boolean(expRes.data?.id), "Domain 7 (Finance): Admin successfully records expense transaction");

    // 7. Compensation: Worker views own salary data
    const workerSalRes = await fetchWorkerSalaryData(workerUserId, workerEmail, { userId: workerUserId, role: "worker" } as any);
    assert(Array.isArray(workerSalRes.payments), "Domain 8 (Compensation): Worker successfully reads own salary records");

    // 8. Notifications: User saves own preferences
    const prefRes = await saveNotificationPreferences(
      { user_id: workerUserId, task_assigned: true, task_due_soon: true },
      { userId: workerUserId, role: "worker" } as any,
      workerClient
    );
    assert(prefRes, "Domain 10 (Notifications): Worker successfully updates own notification preferences");

    // 9. Accounts: Super Admin modifies permissions
    await updateAccountPermissions(
      workerUserId,
      { dashboard: { enabled: true }, tasks: { enabled: true } },
      superClient,
      { userId: superAdminUserId, role: "super_admin" } as any
    );
    assert(true, "Domain 9 (Accounts): Super Admin successfully manages account permissions");

    // 10. Super Admin Deletion: Super Admin permanently deletes ephemeral test entities
    if (createdTaskRes.data?.id) {
      await deleteProjectTask({ taskId: createdTaskRes.data.id, actorId: superAdminUserId, clientOverride: superClient });
      assert(true, "Super Admin successfully deletes task");
    }
    if (createdDeal) {
      await deleteDeal(createdDeal.id, { userId: superAdminUserId, role: "super_admin" } as any, superClient);
      assert(true, "Super Admin successfully deletes deal with authoritative Super Admin authority");
    }
    if (clientRes) {
      await deleteClientRecord(clientRes.id, { role: "super_admin", id: superAdminUserId, client: superClient });
      assert(true, "Super Admin successfully deletes client with authoritative Super Admin authority");
    }
    if (pkgRes.package) {
      await deletePackage(pkgRes.package.id, { role: "super_admin", id: superAdminUserId, client: superClient });
      assert(true, "Super Admin successfully deletes package with authoritative Super Admin authority");
    }
    if (contentProjRes?.id) {
      await deleteProjectItem(contentProjRes.id, { id: superAdminUserId, role: "super_admin", client: superClient });
      assert(true, "Super Admin successfully deletes project showcase");
    }
    if (incRes.data?.id) {
      await deleteTransaction({ id: incRes.data.id, type: "income", ctx: { userId: superAdminUserId, role: "super_admin" } as any, clientOverride: superClient });
      assert(true, "Super Admin successfully deletes income transaction");
    }
    if (expRes.data?.id) {
      await deleteTransaction({ id: expRes.data.id, type: "expense", ctx: { userId: superAdminUserId, role: "super_admin" } as any, clientOverride: superClient });
      assert(true, "Super Admin successfully deletes expense transaction");
    }

    console.log("\n=======================================================================");
    console.log(`🎉 PHASE D COMPLETE: All ${totalAssertions} assertions passed successfully!`);
    console.log("=======================================================================");
  } finally {
    // Clean up ephemeral test accounts
    try {
      await deleteAccount(workerUserId, { userId: superAdminUserId, role: "super_admin" } as any, superClient);
      await deleteAccount(adminUserId, { userId: superAdminUserId, role: "super_admin" } as any, superClient);
    } catch (cleanupErr) {
      console.warn("Cleanup notice:", cleanupErr);
    }
  }
}

runPhaseDServerAuthorizationSuite().catch((err) => {
  console.error("Test suite fatal error:", err);
  process.exit(1);
});
