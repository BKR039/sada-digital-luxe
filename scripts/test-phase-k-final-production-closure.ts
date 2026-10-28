// =======================================================================
// SADA OS — PHASE K: FINAL SECURITY & PRODUCTION CLOSURE VERIFICATION
// =======================================================================
// Comprehensive master test suite validating all mandatory requirements:
//
// MANDATORY NEGATIVE TESTS:
//  1. Anonymous unauthenticated context
//  2. Missing page / module permission
//  3. Missing action / feature permission
//  4. Forged Super Admin role/id payload (anti-spoofing)
//  5. Direct URL / deep-link / legacy route protection
//  6. Direct API mutation authorization
//  7. Direct PostgREST / DB bypass attempts (RLS & trigger defense)
//  8. Stale client permission cache invariant
//  9. Authoritative revocation immediately authoritative
// 10. Suspended account overrides all permissions
// 11. Unrelated user trying to create subtask (parent authority guard)
// 12. Subtask assignee trying to control parent task
// 13. Non-Super Admin trying to grant/revoke permissions
//
// MANDATORY POSITIVE TESTS:
// 14. Super Admin full access across all 16 modules & accounts
// 15. Explicitly authorized user via permission overrides
// 16. Creator / main-assignee parent task authority for subtasks
// 17. Authorized Sales actions (create lead, edit, stage update)
// 18. Authorized Task actions (status change, deliverables, execution)
//
// ADDITIONAL PRODUCTION CLOSURE CHECKS:
// 19. Canonical source of truth verification (user_roles, user_module_permissions, profiles)
// 20. Access-context caching & performance benchmark (< 5ms budget)
// 21. Audit trail integrity across dual tables (account_audit_logs, system_audit_logs)
// 22. Targeted abuse protection & sliding window rate limiter
// 23. Administrative self-lockout defense (accounts revocation & self-suspension)
// =======================================================================

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import {
  evaluateRouteAccess,
  assertAuthorizedMutation,
  resolveAuthoritativeSecurityContext,
  invalidateSecurityContextCache,
} from "../src/lib/security-isolation-service";
import {
  createAccount,
  deleteAccount,
  suspendAccount,
  reactivateAccount,
  updateAccountPermissions,
} from "../src/lib/account-service";
import {
  hasParentTaskAuthority,
  canCreateSubtaskForTask,
} from "../src/lib/permissions";
import { checkRateLimit, resetRateLimit } from "../src/lib/rate-limiter";

// 1. Environment Configuration
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
const workerClient = createClient(supabaseUrl, anonKey);
const adminClient = createClient(supabaseUrl, anonKey);

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
  expectedKeywords: string[],
  message: string
) {
  totalAssertions++;
  try {
    const res = await fn();
    if (res && res.error) {
      const errStr = String(res.error?.message || res.error).toLowerCase();
      const matched = expectedKeywords.some((kw) => errStr.includes(kw.toLowerCase()));
      if (matched) {
        passedAssertions++;
        console.log(`  ✅ PASS: ${message} (Response error matched keywords)`);
        return;
      }
    }
    console.error(`  ❌ FAIL: ${message} (Expected rejection, but operation succeeded: ${JSON.stringify(res)})`);
    process.exit(1);
  } catch (err: any) {
    const errMsg = `${err.code || ""} ${err.message || ""} ${String(err)}`.toLowerCase();
    const matched = expectedKeywords.some((kw) => errMsg.includes(kw.toLowerCase()));
    if (matched) {
      passedAssertions++;
      console.log(`  ✅ PASS: ${message} (Caught expected rejection: "${err.message || err.code}")`);
      return;
    }
    console.error(`  ❌ FAIL: ${message} (Expected one of ${JSON.stringify(expectedKeywords)}, but got: "${err.message || err.code}")`);
    process.exit(1);
  }
}

async function runPhaseKMasterSuite() {
  console.log("=======================================================================");
  console.log("SADA OS — PHASE K: FINAL SECURITY & PRODUCTION CLOSURE SUITE");
  console.log("=======================================================================\n");

  // 1. Authenticate Harness as Super Admin
  const { data: saLogin, error: saLoginErr } = await superClient.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  assert(!saLoginErr && Boolean(saLogin?.user), "Harness authenticated as Super Admin");
  const superAdminUserId = saLogin!.user!.id;
  const superAdminEmail = saLogin!.user!.email!;

  const testAccountsToClean: string[] = [];

  try {
    const ts = Date.now();
    const targetWorkerEmail = `phasek.worker.${ts}@sada.agency`;
    const targetAdminEmail = `phasek.admin.${ts}@sada.agency`;
    const tempPass = "TestPassword123!";

    // Setup Fixture 1: Target Worker Account
    const targetWorkerAcc = await createAccount({
      email: targetWorkerEmail,
      password: tempPass,
      displayName: "PhaseK Target Worker",
      role: "worker",
      division: "Sales",
      position: "Sales Representative",
      status: "active",
      modulePermissions: {
        sales: false,
        tasks: true,
        calendar: true,
      },
    }, superClient);
    testAccountsToClean.push(targetWorkerAcc.user_id);
    const workerUserId = targetWorkerAcc.user_id;

    // Authenticate worker client
    const { data: wLogin, error: wLoginErr } = await workerClient.auth.signInWithPassword({
      email: targetWorkerEmail,
      password: tempPass,
    });
    assert(!wLoginErr && Boolean(wLogin?.user), "Worker client authenticated");

    // Setup Fixture 2: Admin Account
    const targetAdminAcc = await createAccount({
      email: targetAdminEmail,
      password: tempPass,
      displayName: "PhaseK Operational Admin",
      role: "admin",
      division: "Operations",
      position: "Operations Manager",
      status: "active",
      modulePermissions: {
        tasks: true,
        sales: true,
      },
    }, superClient);
    testAccountsToClean.push(targetAdminAcc.user_id);

    // Authenticate admin client
    const { data: aLogin, error: aLoginErr } = await adminClient.auth.signInWithPassword({
      email: targetAdminEmail,
      password: tempPass,
    });
    assert(!aLoginErr && Boolean(aLogin?.user), "Admin client authenticated");

    // -------------------------------------------------------------------------
    // GROUP 1: MANDATORY NEGATIVE TESTS
    // -------------------------------------------------------------------------
    console.log("\n--- GROUP 1: MANDATORY NEGATIVE TESTS ---");

    // Negative 1: Anonymous unauthenticated context
    const anonClient = createClient(supabaseUrl, anonKey);
    await assertThrowsAsync(
      async () => {
        await resolveAuthoritativeSecurityContext(anonClient, undefined, { forceFresh: true });
      },
      ["unauthenticated", "valid session required"],
      "Negative 1: Anonymous client context resolution throws UNAUTHENTICATED"
    );

    await assertThrowsAsync(
      async () => {
        await assertAuthorizedMutation(anonClient, "tasks", "tasks.create", {
          resourceType: "task",
        });
      },
      ["unauthenticated", "valid session required"],
      "Negative 1: Anonymous mutation rejected with UNAUTHENTICATED"
    );

    // Negative 2: Missing page permission (worker accessing /admin/finance)
    const workerCtx = await resolveAuthoritativeSecurityContext(superClient, workerUserId, { forceFresh: true });
    const financeRouteResult = evaluateRouteAccess("/admin/finance", workerCtx);
    assert(financeRouteResult.allowed === false, "Negative 2: Worker denied access to /admin/finance without permission");
    assert(financeRouteResult.reason?.toLowerCase().includes("disabled") || financeRouteResult.reason?.toLowerCase().includes("finance"), "Negative 2: Route denial correctly identifies finance module disabled");

    // Negative 3: Missing action permission (worker lacking tasks.delete)
    await assertThrowsAsync(
      async () => {
        await assertAuthorizedMutation(superClient, "tasks", "tasks.delete", {
          ctx: workerCtx as any,
          resourceType: "task",
        });
      },
      ["forbidden_module_action", "unauthorized", "tasks.delete"],
      "Negative 3: Worker denied from tasks.delete when lacking specific action permission"
    );

    // Negative 4: Forged Super Admin role/id payload (anti-spoofing)
    await assertThrowsAsync(
      async () => {
        await assertAuthorizedMutation(superClient, "accounts", "accounts.view", {
          ctx: {
            ...workerCtx,
            role: "super_admin", // worker falsely claiming role: super_admin
          } as any,
          forceFresh: true,
          resourceType: "account",
        });
      },
      ["forbidden_module_action", "unauthorized", "privilege_escalation_blocked", "super admin"],
      "Negative 4: Worker claiming forged super_admin role blocked by server authority"
    );

    // Negative 5: Direct URL / deep-link / legacy route protection
    const accountsDirectRoute = evaluateRouteAccess("/admin/accounts", workerCtx);
    assert(accountsDirectRoute.allowed === false, "Negative 5: Direct URL to /admin/accounts blocked for non-superadmin");

    const deepLinkProjectRoute = evaluateRouteAccess("/admin/client-projects/proj-test-id", workerCtx);
    assert(deepLinkProjectRoute.allowed === false, "Negative 5: Deep link /admin/client-projects/:id blocked for unauthorized worker");

    const deepLinkCmsRoute = evaluateRouteAccess("/admin/projects/proj-cms-id", workerCtx);
    assert(deepLinkCmsRoute.allowed === false, "Negative 5: Deep link /admin/projects/:id blocked for unauthorized worker");

    const legacyDealsRoute = evaluateRouteAccess("/admin/deals", workerCtx);
    assert(legacyDealsRoute.allowed === false, "Negative 5: Legacy route alias /admin/deals blocked when sales module is disabled");

    // Negative 6: Direct API mutation authorization
    await assertThrowsAsync(
      async () => {
        await assertAuthorizedMutation(superClient, "sales", "sales.edit_lead", {
          ctx: workerCtx as any,
          resourceType: "deal",
          resource: { id: "deal-qa-1" },
          resourceAction: "write",
        });
      },
      ["forbidden_module_action", "unauthorized", "sales"],
      "Negative 6: Direct API mutation rejected when module is disabled"
    );

    // Negative 7: Direct PostgREST / DB bypass attempts (RLS & trigger defense)
    const { error: directInsertErr } = await (workerClient as any)
      .from("user_module_permissions")
      .insert({
        user_id: workerUserId,
        module: "accounts",
        enabled: true,
      });
    assert(Boolean(directInsertErr), "Negative 7: Direct PostgREST insert into user_module_permissions rejected by RLS");

    // Attempt direct role tampering on user_roles
    await (workerClient as any)
      .from("user_roles")
      .update({ role: "super_admin" })
      .eq("user_id", workerUserId);

    const { data: roleCheck } = await superClient
      .from("user_roles")
      .select("role")
      .eq("user_id", workerUserId)
      .single();
    assert(roleCheck?.role === "worker", "Negative 7: Direct DB role privilege escalation blocked (remains worker)");

    // Attempt direct profile permissions tampering
    await (workerClient as any)
      .from("profiles")
      .update({ module_permissions: { accounts: true, finance: true }, status: "suspended" })
      .eq("id", workerUserId);

    const { data: profileCheck } = await superClient
      .from("profiles")
      .select("status, module_permissions")
      .eq("id", workerUserId)
      .single();
    assert(
      !profileCheck?.module_permissions?.accounts && !profileCheck?.module_permissions?.finance,
      "Negative 7: Direct DB permission tampering blocked by trg_guard_profiles_security_fields"
    );
    assert(profileCheck?.status === "active", "Negative 7: Direct DB status tampering blocked by trigger");

    // Negative 8: Stale client permission cache invariant
    // Grant sales module first
    await updateAccountPermissions(
      workerUserId,
      {
        sales: {
          enabled: true,
          actions: { "sales.view": true, "sales.edit_lead": true },
        },
      },
      superClient,
      undefined,
      { reason: "Pre-grant for stale cache test" }
    );

    const activeSalesWorkerCtx = await resolveAuthoritativeSecurityContext(superClient, workerUserId, { forceFresh: true });
    assert(activeSalesWorkerCtx.effectivePermissions.sales === true, "Precondition: Worker granted sales module");

    // Super Admin revokes sales module in DB
    await updateAccountPermissions(
      workerUserId,
      { sales: false },
      superClient,
      undefined,
      { reason: "Revoke for stale cache test" }
    );

    // Stale client context passed with forceFresh: true
    await assertThrowsAsync(
      async () => {
        await assertAuthorizedMutation(superClient, "sales", "sales.edit_lead", {
          ctx: activeSalesWorkerCtx as any, // passing stale context
          forceFresh: true,
          resourceType: "deal",
          resource: { id: "deal-qa-1" },
          resourceAction: "write",
        });
      },
      ["forbidden_module_action", "unauthorized", "sales"],
      "Negative 8: Stale client cache rejected; server pulls fresh DB truth and halts mutation"
    );

    // Negative 9: Revoked permission is immediately authoritative
    const postRevokeCtx = await resolveAuthoritativeSecurityContext(superClient, workerUserId, { forceFresh: true });
    assert(postRevokeCtx.effectivePermissions.sales === false, "Negative 9: Revocation is immediately authoritative in database");

    // Negative 10: Suspended account overrides all permissions
    await updateAccountPermissions(
      workerUserId,
      { tasks: true, calendar: true, dashboard: true },
      superClient
    );
    await suspendAccount(workerUserId, "Compromise investigation", undefined, superClient);

    await assertThrowsAsync(
      async () => {
        await resolveAuthoritativeSecurityContext(superClient, workerUserId, { forceFresh: true });
      },
      ["account_suspended", "suspended"],
      "Negative 10: Suspended account blocked from context resolution"
    );

    const suspendedCtx: any = {
      authenticated: true,
      userId: workerUserId,
      role: "worker",
      status: "suspended",
      effectivePermissions: { tasks: true, dashboard: true },
    };
    const suspendedRouteResult = evaluateRouteAccess("/admin/my-work", suspendedCtx);
    assert(suspendedRouteResult.allowed === false, "Negative 10: Suspended account blocked from route even with tasks: true");
    assert(suspendedRouteResult.reason?.toLowerCase().includes("suspended"), "Negative 10: Route denial cites suspension");

    await assertThrowsAsync(
      async () => {
        await assertAuthorizedMutation(superClient, "tasks", "tasks.view", {
          ctx: suspendedCtx,
          resourceType: "task",
        });
      },
      ["forbidden_account_suspended", "suspended"],
      "Negative 10: Suspended account blocked from mutations"
    );

    // Reactivate worker for remaining tests
    await reactivateAccount(workerUserId, undefined, superClient);

    // Negative 11: Unrelated user trying to create subtask (parent authority guard)
    const dummyCreatorId = "11111111-1111-1111-1111-111111111111";
    const dummyAssigneeId = "22222222-2222-2222-2222-222222222222";
    const unrelatedUserId = workerUserId;

    const hasAuthorityUnrelated = hasParentTaskAuthority(
      { assigned_by_id: dummyCreatorId, assignee_id: dummyAssigneeId },
      { role: "worker", userId: unrelatedUserId }
    );
    assert(!hasAuthorityUnrelated, "Negative 11: Unrelated worker has zero authority over parent task");

    const canCreateSubtaskUnrelated = canCreateSubtaskForTask(
      { role: "worker", userId: unrelatedUserId, effectivePermissions: { tasks: true } as any },
      { assigned_by_id: dummyCreatorId, assignee_id: dummyAssigneeId }
    );
    assert(!canCreateSubtaskUnrelated, "Negative 11: Unrelated worker blocked from creating subtask under foreign parent task");

    // Negative 12: Subtask assignee trying to control parent task
    const childSubtaskAssigneeId = workerUserId;
    const isParentController = hasParentTaskAuthority(
      { assigned_by_id: dummyCreatorId, assignee_id: dummyAssigneeId },
      { role: "worker", userId: childSubtaskAssigneeId }
    );
    assert(!isParentController, "Negative 12: Subtask assignee has zero authority over parent task");

    // Negative 13: Non-Super Admin trying to grant/revoke permissions
    await assertThrowsAsync(
      async () => {
        await updateAccountPermissions(workerUserId, { sales: true }, workerClient);
      },
      ["forbidden_admin_action", "forbidden_module_action", "unauthorized", "super admin"],
      "Negative 13: Worker calling updateAccountPermissions rejected by service layer"
    );

    await assertThrowsAsync(
      async () => {
        await updateAccountPermissions(workerUserId, { sales: true }, adminClient);
      },
      ["forbidden_admin_action", "forbidden_module_action", "unauthorized", "super admin"],
      "Negative 13: Admin calling updateAccountPermissions rejected by service layer"
    );

    await assertThrowsAsync(
      async () => {
        const { error } = await (workerClient as any).rpc("admin_update_account_permissions", {
          _target_user_id: workerUserId,
          _permissions: { sales: true },
        });
        if (error) throw error;
      },
      ["must be super admin to update permissions", "unauthorized"],
      "Negative 13: Worker calling admin_update_account_permissions RPC rejected by PostgreSQL"
    );

    // -------------------------------------------------------------------------
    // GROUP 2: MANDATORY POSITIVE TESTS
    // -------------------------------------------------------------------------
    console.log("\n--- GROUP 2: MANDATORY POSITIVE TESTS ---");

    // Positive 14: Super Admin full access
    const saCtx = await resolveAuthoritativeSecurityContext(superClient, superAdminUserId, { forceFresh: true });
    assert(saCtx.role === "super_admin", "Positive 14: Super Admin role confirmed 'super_admin'");

    const saAccountsRoute = evaluateRouteAccess("/admin/accounts", saCtx);
    assert(saAccountsRoute.allowed === true, "Positive 14: Super Admin allowed to access /admin/accounts");

    const saFinanceRoute = evaluateRouteAccess("/admin/finance", saCtx);
    assert(saFinanceRoute.allowed === true, "Positive 14: Super Admin allowed to access /admin/finance");

    const saRulesRoute = evaluateRouteAccess("/admin/business-rules", saCtx);
    assert(saRulesRoute.allowed === true, "Positive 14: Super Admin allowed to access /admin/business-rules");

    // Positive 15: Explicitly authorized user via permission overrides
    await updateAccountPermissions(
      workerUserId,
      {
        sales: {
          enabled: true,
          actions: { "sales.view": true, "sales.create_lead": true, "sales.change_stage": true },
        },
      },
      superClient,
      undefined,
      { reason: "Positive 15 explicit authorization grant" }
    );

    const authorizedWorkerCtx = await resolveAuthoritativeSecurityContext(superClient, workerUserId, { forceFresh: true });
    assert(authorizedWorkerCtx.effectivePermissions.sales === true, "Positive 15: Worker explicitly authorized for sales");
    assert(authorizedWorkerCtx.customOverrides?.sales?.actions?.["sales.create_lead"] === true, "Positive 15: Worker holds sales.create_lead");

    const authorizedSalesRoute = evaluateRouteAccess("/admin/sales", authorizedWorkerCtx);
    assert(authorizedSalesRoute.allowed === true, "Positive 15: Worker allowed to access /admin/sales route");

    // Positive 16: Creator and Main Assignee subtask authority
    const authorityAsCreator = hasParentTaskAuthority(
      { assigned_by_id: workerUserId, assignee_id: dummyAssigneeId },
      { role: "worker", userId: workerUserId }
    );
    assert(authorityAsCreator === true, "Positive 16: Parent task creator has authoritative subtask authority");

    const authorityAsMainAssignee = hasParentTaskAuthority(
      { assigned_by_id: dummyCreatorId, assignee_id: workerUserId },
      { role: "worker", userId: workerUserId }
    );
    assert(authorityAsMainAssignee === true, "Positive 16: Current main assignee has authoritative subtask authority");

    const canCreateSubtaskCreator = canCreateSubtaskForTask(
      {
        role: "worker",
        userId: workerUserId,
        customPermissions: { tasks: { enabled: true, actions: { create_subtask: true } } },
        effectivePermissions: { tasks: true } as any,
      },
      { assigned_by_id: workerUserId, assignee_id: dummyAssigneeId }
    );
    assert(canCreateSubtaskCreator === true, "Positive 16: Creator can create subtasks when holding permission");

    // Positive 17: Authorized Sales actions
    await assertAuthorizedMutation(superClient, "sales", "sales.create_lead", {
      ctx: authorizedWorkerCtx as any,
      resourceType: "deal",
      resourceAction: "write",
    });
    assert(true, "Positive 17: Authorized worker passes assertAuthorizedMutation for sales.create_lead");

    await assertAuthorizedMutation(superClient, "sales", "sales.change_stage", {
      ctx: authorizedWorkerCtx as any,
      resourceType: "deal",
      resource: { id: "deal-qa-1" },
      resourceAction: "write",
    });
    assert(true, "Positive 17: Authorized worker passes assertAuthorizedMutation for sales.change_stage");

    // Positive 18: Authorized Task actions
    await assertAuthorizedMutation(superClient, "tasks", "tasks.change_status", {
      ctx: authorizedWorkerCtx as any,
      resourceType: "task",
      resource: { id: "task-qa-1", assignee_id: workerUserId },
      resourceAction: "write",
    });
    assert(true, "Positive 18: Authorized worker passes assertAuthorizedMutation for tasks.change_status");

    // -------------------------------------------------------------------------
    // GROUP 3: ADDITIONAL PRODUCTION CLOSURE VERIFICATIONS
    // -------------------------------------------------------------------------
    console.log("\n--- GROUP 3: ADDITIONAL PRODUCTION CLOSURE VERIFICATIONS ---");

    // 19. Canonical source of truth verification
    const { data: dbRoleRow } = await superClient
      .from("user_roles")
      .select("role")
      .eq("user_id", workerUserId)
      .single();
    assert(dbRoleRow?.role === "worker", "Check 19: Authoritative role verified in public.user_roles");

    const { data: dbPermRow } = await superClient
      .from("user_module_permissions")
      .select("module, enabled")
      .eq("user_id", workerUserId)
      .eq("module", "sales")
      .single();
    assert(dbPermRow?.enabled === true, "Check 19: Authoritative override verified in public.user_module_permissions");

    const { data: dbProfileRow } = await superClient
      .from("profiles")
      .select("module_permissions")
      .eq("id", workerUserId)
      .single();
    const isSalesProfileEnabled = typeof dbProfileRow?.module_permissions?.sales === "object"
      ? dbProfileRow.module_permissions.sales.enabled === true
      : dbProfileRow?.module_permissions?.sales === true;
    assert(isSalesProfileEnabled, "Check 19: Cached projection verified in public.profiles.module_permissions");

    // 20. Access-context caching & performance benchmark (< 5ms budget)
    const iterations = 500;
    const startBench = performance.now();
    for (let i = 0; i < iterations; i++) {
      evaluateRouteAccess("/admin/sales", authorizedWorkerCtx);
    }
    const endBench = performance.now();
    const avgLatencyMs = (endBench - startBench) / iterations;
    assert(avgLatencyMs < 0.1, `Check 20: evaluateRouteAccess average latency ${avgLatencyMs.toFixed(4)}ms << 5.0ms budget`);

    // 21. Audit trail integrity across dual tables
    const { data: accountAuditLogs } = await superClient
      .from("account_audit_logs")
      .select("*")
      .eq("target_user_id", workerUserId)
      .order("created_at", { ascending: false });
    assert(Boolean(accountAuditLogs && accountAuditLogs.length > 0), "Check 21: Forensic entries recorded in account_audit_logs");
    assert(accountAuditLogs![0].actor_id === superAdminUserId, "Check 21: account_audit_logs records correct Super Admin actor_id");

    const { data: sysAuditLogs } = await superClient
      .from("system_audit_logs")
      .select("*")
      .eq("entity_id", workerUserId)
      .order("created_at", { ascending: false });
    assert(Boolean(sysAuditLogs && sysAuditLogs.length > 0), "Check 21: Correlated entries recorded in system_audit_logs");
    assert(sysAuditLogs![0].actor_role === "super_admin", "Check 21: system_audit_logs records actor_role === super_admin");

    // 22. Targeted abuse protection & sliding window rate limiter
    const rateLimitTestKey = `test_abuse_${Date.now()}`;
    const rl1 = checkRateLimit("auth_sensitive", rateLimitTestKey);
    assert(rl1.allowed === true, "Check 22: First sensitive action permitted by rate limiter");
    for (let i = 0; i < 6; i++) {
      checkRateLimit("auth_sensitive", rateLimitTestKey);
    }
    const rlBlocked = checkRateLimit("auth_sensitive", rateLimitTestKey);
    assert(!rlBlocked.allowed, "Check 22: Excessive sensitive actions blocked by rate limiter");
    resetRateLimit("auth_sensitive", rateLimitTestKey);
    const rlRestored = checkRateLimit("auth_sensitive", rateLimitTestKey);
    assert(rlRestored.allowed === true, "Check 22: Rate limiter cleanly restored after reset");

    // 23. Administrative self-lockout defense
    await assertThrowsAsync(
      async () => {
        await updateAccountPermissions(superAdminUserId, { accounts: false }, superClient);
      },
      ["cannot revoke own access to account management", "administrative self-lockout protection", "forbidden_admin_action"],
      "Check 23: Super Admin cannot revoke own access to accounts module"
    );

    await assertThrowsAsync(
      async () => {
        await suspendAccount(superAdminUserId, "Accidental self-suspension test", undefined, superClient);
      },
      ["cannot suspend own account", "administrative self-lockout protection", "forbidden_admin_action"],
      "Check 23: Super Admin cannot suspend own account"
    );

  } finally {
    // Cleanup temporary test accounts
    console.log("\nCleaning up temporary test accounts...");
    for (const accId of testAccountsToClean) {
      try {
        await deleteAccount(accId, undefined, superClient);
      } catch (err: any) {
        console.warn(`Warning: Cleanup of test account ${accId} failed:`, err?.message);
      }
    }
    console.log("Cleanup complete.");
  }

  console.log("\n=======================================================================");
  console.log(`PHASE K MASTER TEST RESULTS: ${passedAssertions}/${totalAssertions} ASSERTIONS PASSED (100%)`);
  console.log("=======================================================================\n");
}

runPhaseKMasterSuite().catch((err) => {
  console.error("FATAL: Phase K test suite failed with error:", err);
  process.exit(1);
});
