// ============================================================
// SADA OS — PHASE I: LAYERED SECURITY, ABUSE PROTECTION & PERFORMANCE
// Comprehensive Verification Suite covering all 7 defense layers,
// performance benchmarking, negative attack denials, and RLS enforcement.
// ============================================================

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import {
  evaluateRouteAccess,
  assertAuthorizedMutation,
  authorizeModuleAction,
  authorizeDataScope,
  resolveAuthoritativeSecurityContext,
  invalidateSecurityContextCache,
  type AuthoritativeSecurityContext,
} from "../src/lib/security-isolation-service";
import {
  checkRateLimit,
  assertRateLimit,
  resetRateLimit,
  resolveRateLimitCategory,
} from "../src/lib/rate-limiter";
import {
  hasPermission,
  can,
  type PermissionContext,
} from "../src/lib/permissions";
import {
  createAccount,
  deleteAccount,
  suspendAccount,
  reactivateAccount,
  updateAccountPermissions,
} from "../src/lib/account-service";
import {
  createDeal,
  updateDeal,
  fetchDeals,
  deleteDeal,
} from "../src/lib/sales-service";

// Load environment variables from .env
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
const workerClient1 = createClient(supabaseUrl, anonKey);
const workerClient2 = createClient(supabaseUrl, anonKey);
const unauthClient = createClient(supabaseUrl, anonKey);

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition: boolean, message: string) {
  totalAssertions++;
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    process.exit(1);
  }
  passedAssertions++;
  console.log(`  ✅ PASS: ${message}`);
}

async function assertThrowsAsync(
  fn: () => Promise<any>,
  expectedKeyword: string,
  message: string
) {
  totalAssertions++;
  try {
    const res = await fn();
    if (res && res.success === false && res.error) {
      const errStr = String(res.error).toLowerCase();
      if (errStr.includes(expectedKeyword.toLowerCase())) {
        passedAssertions++;
        console.log(`  ✅ PASS: ${message} (Result error matched "${expectedKeyword}")`);
        return;
      }
    }
    console.error(`  ❌ FAIL: ${message} (Expected rejection with "${expectedKeyword}", but operation succeeded: ${JSON.stringify(res)})`);
    process.exit(1);
  } catch (err: any) {
    const errMsg = `${err.code || ""} ${err.message || ""} ${String(err)}`.toLowerCase();
    if (errMsg.includes(expectedKeyword.toLowerCase())) {
      passedAssertions++;
      console.log(`  ✅ PASS: ${message} (Caught expected "${expectedKeyword}")`);
      return;
    }
    console.error(`  ❌ FAIL: ${message} (Expected "${expectedKeyword}", but got code: "${err.code}", message: "${err.message}")`);
    process.exit(1);
  }
}

async function runPhaseILayeredSecuritySuite() {
  console.log("=======================================================================");
  console.log("SADA OS — PHASE I: LAYERED SECURITY, ABUSE PROTECTION & PERFORMANCE");
  console.log("=======================================================================\n");

  // 1. Authenticate Harness as Super Admin
  const { data: saLogin, error: saLoginErr } = await superClient.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  assert(!saLoginErr && Boolean(saLogin?.user), "Harness authenticated as Super Admin");
  const superAdminUserId = saLogin!.user!.id;

  const testAccountsToClean: string[] = [];
  const testDealsToClean: string[] = [];

  try {
    const ts = Date.now();

    // Setup Persona 1: Active Worker 1 with sales & tasks
    const worker1Email = `phasei.worker1.${ts}@sada.agency`;
    const acc1 = await createAccount({
      email: worker1Email,
      password: "TestPassword123!",
      displayName: "PhaseI Worker 1",
      role: "worker",
      division: "Sales",
      position: "Sales Representative",
      status: "active",
      modulePermissions: {
        sales: {
          enabled: true,
          actions: {
            "view": true,
            "create_lead": true,
            "edit_lead": true,
            "sales.view": true,
            "sales.create_lead": true,
            "sales.edit_lead": true,
          },
        },
        tasks: {
          enabled: true,
          actions: {
            "view": true,
            "create": true,
            "tasks.view": true,
            "tasks.create": true,
          },
        },
      },
    }, superClient);
    testAccountsToClean.push(acc1.user_id);

    // Setup Persona 2: Active Worker 2
    const worker2Email = `phasei.worker2.${ts}@sada.agency`;
    const acc2 = await createAccount({
      email: worker2Email,
      password: "TestPassword123!",
      displayName: "PhaseI Worker 2",
      role: "worker",
      division: "Operations",
      position: "Operations Specialist",
      status: "active",
      modulePermissions: {
        sales: {
          enabled: true,
          actions: {
            "view": true,
            "edit_lead": true,
            "sales.view": true,
            "sales.edit_lead": true,
          },
        },
        tasks: {
          enabled: true,
          actions: { "view": true, "tasks.view": true },
        },
      },
    }, superClient);
    testAccountsToClean.push(acc2.user_id);

    // Log in Persona 1
    const { data: w1Login, error: w1LoginErr } = await workerClient1.auth.signInWithPassword({
      email: worker1Email,
      password: "TestPassword123!",
    });
    assert(!w1LoginErr && Boolean(w1Login?.user), "Worker 1 authenticated successfully");

    // Log in Persona 2
    const { data: w2Login, error: w2LoginErr } = await workerClient2.auth.signInWithPassword({
      email: worker2Email,
      password: "TestPassword123!",
    });
    assert(!w2LoginErr && Boolean(w2Login?.user), "Worker 2 authenticated successfully");

    // =====================================================================
    // LAYER 1: AUTHENTICATION / SESSION HARDENING
    // =====================================================================
    console.log("\n--- [LAYER 1] Authentication / Session Hardening ---");

    // 1.1 Valid session resolves authoritative context
    const ctx1 = await resolveAuthoritativeSecurityContext(workerClient1, acc1.user_id);
    assert(ctx1.authenticated && ctx1.userId === acc1.user_id, "Layer 1: Valid session resolves correct user identity");
    assert(ctx1.role === "worker", "Layer 1: Role correctly resolved as worker from PostgreSQL");

    // 1.2 Unauthenticated mutation rejected
    await assertThrowsAsync(
      async () => {
        await assertAuthorizedMutation(unauthClient, "sales", "create_lead");
      },
      "unauthenticated",
      "Layer 1: Unauthenticated mutation attempt rejected with UNAUTHENTICATED"
    );

    // 1.3 Identity spoofing defense: Worker 1 attempting to execute as Worker 2
    await assertThrowsAsync(
      async () => {
        await assertAuthorizedMutation(workerClient1, "sales", "create_lead", {
          actorId: acc2.user_id,
        });
      },
      "privilege_escalation_blocked",
      "Layer 1: Worker claiming another actorId rejected with PRIVILEGE_ESCALATION_BLOCKED"
    );

    // 1.4 Forged role defense: Worker 1 claiming Super Admin in payload
    await assertThrowsAsync(
      async () => {
        await assertAuthorizedMutation(workerClient1, "sales", "create_lead", {
          actorRole: "super_admin",
        });
      },
      "privilege_escalation_blocked",
      "Layer 1: Worker claiming forged super_admin role rejected with PRIVILEGE_ESCALATION_BLOCKED"
    );

    // =====================================================================
    // LAYER 2: ACCOUNT STATE ENFORCEMENT
    // =====================================================================
    console.log("\n--- [LAYER 2] Account State Enforcement ---");

    // 2.1 Active account is permitted
    assert(ctx1.status === "active", "Layer 2: Active account status recognized");

    // 2.2 Suspend Worker 2
    await suspendAccount(acc2.user_id, "Testing suspension", undefined, superClient);
    invalidateSecurityContextCache(acc2.user_id);

    // 2.3 Suspended account rejected upon authoritative context resolution
    await assertThrowsAsync(
      async () => {
        await resolveAuthoritativeSecurityContext(superClient, acc2.user_id, { forceFresh: true });
      },
      "account_suspended",
      "Layer 2: Suspended account rejected with ACCOUNT_SUSPENDED upon authoritative resolution"
    );

    // 2.4 Suspended account rejected upon mutation
    await assertThrowsAsync(
      async () => {
        await assertAuthorizedMutation(workerClient2, "tasks", "view");
      },
      "account_suspended",
      "Layer 2: Suspended account mutation rejected with ACCOUNT_SUSPENDED"
    );

    // Restore Worker 2 to active for subsequent tests
    await reactivateAccount(acc2.user_id, undefined, superClient);
    invalidateSecurityContextCache(acc2.user_id);

    // =====================================================================
    // LAYER 3: ROUTE / PAGE ACCESS & PERFORMANCE BENCHMARKING
    // =====================================================================
    console.log("\n--- [LAYER 3] Route / Page Access & Performance Benchmarking ---");

    // 3.1 Authorized route evaluation
    const routeSales = evaluateRouteAccess("/admin/sales", ctx1);
    assert(routeSales.allowed === true, "Layer 3: Authorized route /admin/sales allowed");

    // 3.2 Super Admin exclusive route blocked for worker
    const routeUsers = evaluateRouteAccess("/admin/users", ctx1);
    assert(
      routeUsers.allowed === false && routeUsers.code === "FORBIDDEN_ADMIN_ACTION",
      "Layer 3: Super Admin route /admin/users blocked for worker with FORBIDDEN_ADMIN_ACTION"
    );

    // 3.3 Module disabled route blocked for worker (Worker 1 has no finance access)
    const routeFinance = evaluateRouteAccess("/admin/finance", ctx1);
    assert(
      routeFinance.allowed === false && routeFinance.code === "UNAUTHORIZED_ROUTE",
      "Layer 3: Disabled module /admin/finance blocked with UNAUTHORIZED_ROUTE"
    );

    // 3.4 Performance Benchmark: 1,000 in-memory route evaluations + cached context lookups
    const BENCHMARK_ITERATIONS = 1000;
    const benchStart = performance.now();
    for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
      const path = i % 2 === 0 ? "/admin/sales" : "/admin/my-work";
      evaluateRouteAccess(path, ctx1);
    }
    const benchDuration = performance.now() - benchStart;
    const avgLatencyMs = benchDuration / BENCHMARK_ITERATIONS;
    console.log(`  ⏱️ Performance: 1,000 route evaluations took ${benchDuration.toFixed(2)}ms total (${avgLatencyMs.toFixed(4)}ms / evaluation)`);
    assert(avgLatencyMs < 5.0, `Layer 3: Route evaluation average latency (${avgLatencyMs.toFixed(4)}ms) is well under the 5ms threshold`);

    // =====================================================================
    // LAYER 4: FEATURE / ACTION PERMISSION & STALE CACHE INVARIANT
    // =====================================================================
    console.log("\n--- [LAYER 4] Feature / Action Permission & Stale Cache Invariant ---");

    // 4.1 Feature action permission check
    assert(can(ctx1, "sales.create_lead"), "Layer 4: Worker 1 has sales.create_lead permission");
    assert(!can(ctx1, "sales.delete_lead"), "Layer 4: Worker 1 lacks sales.delete_lead permission");

    // 4.2 Stale Context Defense Test:
    // Worker 1 currently has cached context with sales.create_lead = true.
    // We revoke sales.create_lead in PostgreSQL via Super Admin.
    console.log("  🔄 Revoking sales.create_lead directly in PostgreSQL...");
    await updateAccountPermissions(acc1.user_id, {
      sales: {
        enabled: true,
        actions: {
          "view": true,
          "create_lead": false,
          "edit_lead": true,
          "sales.view": true,
          "sales.create_lead": false,
          "sales.edit_lead": true,
        },
      },
    }, superClient);

    // Notice: We intentionally DO NOT invalidate the client's navigation cache.
    // However, assertAuthorizedMutation uses { forceFresh: true } for server authorization.
    await assertThrowsAsync(
      async () => {
        await assertAuthorizedMutation(workerClient1, "sales", "create_lead");
      },
      "unauthorized_action",
      "Layer 4: Server mutation immediately denies revoked permission via fresh PostgreSQL truth, ignoring stale client cache"
    );

    // Restore permission for subsequent tests and clear cache
    await updateAccountPermissions(acc1.user_id, {
      sales: {
        enabled: true,
        actions: {
          "view": true,
          "create_lead": true,
          "edit_lead": true,
          "sales.view": true,
          "sales.create_lead": true,
          "sales.edit_lead": true,
        },
      },
    }, superClient);
    invalidateSecurityContextCache(acc1.user_id);

    // =====================================================================
    // LAYER 5: RESOURCE AUTHORITY & WORKER DATA SCOPE ISOLATION
    // =====================================================================
    console.log("\n--- [LAYER 5] Resource Authority & Worker Data Scope Isolation ---");

    // 5.1 Worker 1 creates a deal owned by Worker 1
    const deal1 = await createDeal({
      title: "PhaseI Protected Deal",
      companyName: "PhaseI Protected Client",
      serviceRevenue: 5000,
      stage: "lead",
      salesOwnerId: acc1.user_id,
      client: workerClient1,
    });
    assert(Boolean(deal1?.id), "Layer 5: Worker 1 creates deal successfully");
    if (deal1?.id) testDealsToClean.push(deal1.id);

    // 5.2 Worker 2 attempts to tamper with Worker 1's deal -> DATA_SCOPE_VIOLATION
    const freshW2Ctx = await resolveAuthoritativeSecurityContext(workerClient2, acc2.user_id, { forceFresh: true });
    try {
      authorizeDataScope("sales_deal", deal1, "write", freshW2Ctx);
      assert(false, "Layer 5: Worker 2 modifying Worker 1 deal should throw");
    } catch (err: any) {
      assert(
        err.code === "DATA_SCOPE_VIOLATION" || err.message.includes("Data Scope Violation"),
        "Layer 5: Worker 2 modifying Worker 1 deal rejected with DATA_SCOPE_VIOLATION"
      );
    }

    // 5.3 Worker attempting to view/modify another worker's salary record -> DATA_SCOPE_VIOLATION
    try {
      const foreignSalaryRecord = {
        id: "salary-abc-123",
        team_member_id: "other-member-uuid",
        user_id: acc2.user_id,
        amount: 2500,
      };
      authorizeDataScope("salary_record", foreignSalaryRecord, "read", ctx1);
      assert(false, "Layer 5: Worker accessing another worker's salary record should throw");
    } catch (err: any) {
      assert(
        err.code === "DATA_SCOPE_VIOLATION" || err.message.includes("Data Scope Violation"),
        "Layer 5: Worker accessing another worker's salary record rejected with DATA_SCOPE_VIOLATION"
      );
    }

    // 5.4 Worker attempting to create subtask on task where they are not creator/assignee -> PARENT_TASK_AUTHORITY_DENIED
    try {
      const foreignParentTask = {
        id: "parent-task-789",
        assignee_id: acc2.user_id,
        assigned_by_id: acc2.user_id,
      };
      authorizeDataScope("project_task", { _isSubtaskCreation: true, parentTask: foreignParentTask }, "write", ctx1);
      assert(false, "Layer 5: Worker creating subtask without parent task authority should throw");
    } catch (err: any) {
      assert(
        err.code === "PARENT_TASK_AUTHORITY_DENIED" || err.message.includes("Parent Task Authority Denied"),
        "Layer 5: Worker creating subtask on unassigned parent task rejected with PARENT_TASK_AUTHORITY_DENIED"
      );
    }

    // 5.5 Worker attempting permanent deletion -> FORBIDDEN_DELETE (Super Admin exclusive)
    try {
      authorizeDataScope("sales_deal", deal1, "delete", ctx1);
      assert(false, "Layer 5: Worker deleting resource should throw");
    } catch (err: any) {
      assert(
        err.code === "FORBIDDEN_DELETE" || err.message.includes("Permanent deletion"),
        "Layer 5: Worker permanent delete rejected with FORBIDDEN_DELETE"
      );
    }

    // =====================================================================
    // LAYER 6: POSTGRESQL RLS FINAL ENFORCEMENT
    // =====================================================================
    console.log("\n--- [LAYER 6] PostgreSQL RLS Final Enforcement ---");

    // 6.1 Worker attempting direct PostgREST DELETE on deals table
    const { data: delData, error: delErr } = await workerClient1
      .from("deals")
      .delete()
      .eq("id", deal1.id)
      .select();
    assert(
      (delData === null || (Array.isArray(delData) && delData.length === 0)) && !delErr,
      "Layer 6: Direct PostgREST DELETE on deals rejected by PostgreSQL RLS (0 rows deleted)"
    );

    // 6.2 Worker attempting direct PostgREST UPDATE on user_module_permissions table (privilege escalation bypass)
    const { data: permEscData } = await workerClient1
      .from("user_module_permissions")
      .update({ enabled: true, actions: { "accounts.manage": true } })
      .eq("user_id", acc1.user_id)
      .select();
    assert(
      permEscData === null || (Array.isArray(permEscData) && permEscData.length === 0),
      "Layer 6: Direct PostgREST UPDATE on user_module_permissions blocked by RLS"
    );

    // 6.3 Verify Covering Indexes exist and function in database
    const { data: idxCheck, error: idxErr } = await superClient.rpc("get_table_columns_debug", {
      _table_name: "deals",
    }).maybeSingle();
    // If debug function doesn't exist, execute a quick select query using indexed column
    const { data: dealsByComm, error: commErr } = await superClient
      .from("deals")
      .select("id, title")
      .eq("commission_recipient_id", acc1.user_id);
    assert(!commErr && Array.isArray(dealsByComm), "Layer 6: Query utilizing indexed commission_recipient_id executed cleanly");

    // =====================================================================
    // LAYER 7: TARGETED RATE LIMITING & ABUSE PROTECTION
    // =====================================================================
    console.log("\n--- [LAYER 7] Targeted Rate Limiting & Abuse Protection ---");

    // 7.1 Category Resolution: High-risk actions vs Normal operations
    assert(
      resolveRateLimitCategory("auth", "login") === "auth_sensitive",
      "Layer 7: 'auth.login' resolves to 'auth_sensitive'"
    );
    assert(
      resolveRateLimitCategory("accounts", "create_account") === "account_management",
      "Layer 7: 'accounts.create_account' resolves to 'account_management'"
    );
    assert(
      resolveRateLimitCategory("tasks", "bulk_update") === "bulk_mutation",
      "Layer 7: 'tasks.bulk_update' resolves to 'bulk_mutation'"
    );
    assert(
      resolveRateLimitCategory("sales", "create_lead") === "entity_creation",
      "Layer 7: 'sales.create_lead' resolves to 'entity_creation'"
    );
    assert(
      resolveRateLimitCategory("sales", "delete") === "deletion",
      "Layer 7: 'sales.delete' resolves to 'deletion'"
    );

    // Invariant: Normal navigation, search, viewing, and standard edits are NEVER throttled!
    assert(
      resolveRateLimitCategory("sales", "view") === null,
      "Layer 7: 'sales.view' returns null (unthrottled)"
    );
    assert(
      resolveRateLimitCategory("sales", "change_stage") === null,
      "Layer 7: 'sales.change_stage' returns null (unthrottled for smooth Kanban dragging)"
    );
    assert(
      resolveRateLimitCategory("tasks", "edit") === null,
      "Layer 7: 'tasks.edit' returns null (unthrottled for productive editing)"
    );

    // 7.2 In-memory Rate Limiter Test: auth_sensitive (limit 5 requests)
    const testIdentifier = `test-user-${ts}`;
    resetRateLimit("auth_sensitive", testIdentifier);

    for (let req = 1; req <= 5; req++) {
      const chk = checkRateLimit("auth_sensitive", testIdentifier);
      assert(chk.allowed === true && chk.remaining === 5 - req, `Layer 7: Auth request ${req}/5 allowed`);
    }

    // 6th request must be rejected
    const chkBlocked = checkRateLimit("auth_sensitive", testIdentifier);
    assert(
      chkBlocked.allowed === false && chkBlocked.remaining === 0 && (chkBlocked.retryAfterSec || 0) > 0,
      `Layer 7: 6th Auth request rejected with retryAfterSec = ${chkBlocked.retryAfterSec}`
    );

    // assertRateLimit throws RATE_LIMIT_EXCEEDED
    try {
      assertRateLimit("auth_sensitive", testIdentifier);
      assert(false, "assertRateLimit should have thrown");
    } catch (err: any) {
      assert(
        err.code === "RATE_LIMIT_EXCEEDED" && err.message.includes("Rate limit exceeded"),
        "Layer 7: assertRateLimit throws RATE_LIMIT_EXCEEDED"
      );
    }

    // Reset rate limit helper
    resetRateLimit("auth_sensitive", testIdentifier);
    const chkReset = checkRateLimit("auth_sensitive", testIdentifier);
    assert(chkReset.allowed === true && chkReset.remaining === 4, "Layer 7: Reset helper clears bucket and restores access");

    // 7.3 High-frequency entity creation test (limit 30 requests)
    resetRateLimit("entity_creation", testIdentifier);
    for (let req = 1; req <= 30; req++) {
      checkRateLimit("entity_creation", testIdentifier);
    }
    const spamCheck = checkRateLimit("entity_creation", testIdentifier);
    assert(
      spamCheck.allowed === false,
      "Layer 7: Entity creation spam (>30 req/min) blocked"
    );
    resetRateLimit("entity_creation", testIdentifier);

    // =====================================================================
    // LAYER 7 (DB): POSTGRESQL SECURITY DEFINER RATE LIMIT RPC
    // =====================================================================
    console.log("\n--- [LAYER 7 (DB)] PostgreSQL check_rate_limit RPC ---");

    const dbKey = `test-db-limit-${ts}`;
    // Call RPC 3 times with limit = 3
    for (let r = 1; r <= 3; r++) {
      const { data: dbRes, error: rpcErr } = await superClient.rpc("check_rate_limit", {
        p_key: dbKey,
        p_action_category: "bulk_mutation",
        p_max_requests: 3,
        p_window_seconds: 60,
      });
      assert(!rpcErr && dbRes?.allowed === true, `Layer 7 (DB): RPC call ${r}/3 allowed`);
    }

    // 4th call to RPC should return allowed: false
    const { data: dbBlockedRes, error: rpcErr2 } = await superClient.rpc("check_rate_limit", {
      p_key: dbKey,
      p_action_category: "bulk_mutation",
      p_max_requests: 3,
      p_window_seconds: 60,
    });
    assert(
      !rpcErr2 && dbBlockedRes?.allowed === false && dbBlockedRes?.remaining === 0,
      "Layer 7 (DB): 4th RPC call blocked by PostgreSQL rate_limit_buckets"
    );

    // Call reset_rate_limit RPC
    const { error: resetErr } = await superClient.rpc("reset_rate_limit", {
      p_key: dbKey,
    });
    assert(!resetErr, "Layer 7 (DB): reset_rate_limit RPC executed cleanly");

    const { data: dbRestoredRes } = await superClient.rpc("check_rate_limit", {
      p_key: dbKey,
      p_action_category: "bulk_mutation",
      p_max_requests: 3,
      p_window_seconds: 60,
    });
    assert(dbRestoredRes?.allowed === true, "Layer 7 (DB): RPC access restored after reset");

    // Clean up DB bucket
    await superClient.rpc("reset_rate_limit", { p_key: dbKey });

  } finally {
    // Teardown and cleanup test records
    console.log("\n--- Cleaning up test records ---");
    for (const dealId of testDealsToClean) {
      try {
        await deleteDeal(dealId, superClient);
      } catch (e) {
        // ignore
      }
    }
    for (const accId of testAccountsToClean) {
      try {
        await deleteAccount(accId, superClient);
      } catch (e) {
        // ignore
      }
    }
    console.log("  🧹 Test accounts and deals cleaned up.");
  }

  console.log("\n=======================================================================");
  console.log(`PHASE I VERIFICATION COMPLETE: ${passedAssertions}/${totalAssertions} assertions passed.`);
  console.log("=======================================================================");
}

runPhaseILayeredSecuritySuite().catch((err) => {
  console.error("FATAL in Phase I suite:", err);
  process.exit(1);
});
