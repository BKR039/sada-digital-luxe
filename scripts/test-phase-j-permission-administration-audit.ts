// ============================================================
// SADA OS — PHASE J: PERMISSION ADMINISTRATION, AUDIT & REVOCATION
// Comprehensive Verification Suite covering:
// 1. Super Admin grant/revoke lifecycle
// 2. Authoritative revocation & stale client cache invariant
// 3. Suspended account overrides all permissions
// 4. Audit trail integrity verification (actor, target, diff, reason, metadata, timestamps)
// 5. Non-Super Admin negative attack denials (Worker/Admin rejected, RLS, trigger defenses)
// 6. Administrative self-lockout & anti-escalation protection
// ============================================================

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import {
  evaluateRouteAccess,
  assertAuthorizedMutation,
  resolveAuthoritativeSecurityContext,
  invalidateSecurityContextCache,
  SecurityAuthorizationError,
} from "../src/lib/security-isolation-service";
import {
  createAccount,
  deleteAccount,
  suspendAccount,
  reactivateAccount,
  updateAccountPermissions,
} from "../src/lib/account-service";

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
const adminClient = createClient(supabaseUrl, anonKey);
const workerClient = createClient(supabaseUrl, anonKey);

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

async function runPhaseJPermissionAdminSuite() {
  console.log("=======================================================================");
  console.log("SADA OS — PHASE J: PERMISSION ADMINISTRATION, AUDIT & REVOCATION SUITE");
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

    // Setup Fixture 1: Target Worker Account
    const targetWorkerEmail = `phasej.target.worker.${ts}@sada.agency`;
    const targetWorkerAcc = await createAccount({
      email: targetWorkerEmail,
      password: "TestPassword123!",
      displayName: "PhaseJ Target Worker",
      role: "worker",
      division: "Sales",
      position: "Sales Representative",
      status: "active",
      modulePermissions: {
        sales: false,
        tasks: true,
      },
    }, superClient);
    testAccountsToClean.push(targetWorkerAcc.user_id);
    console.log(`Created target worker account: ${targetWorkerEmail} (${targetWorkerAcc.user_id})`);

    // Setup Fixture 2: Standard Worker Account (attacker/actor)
    const workerAttackerEmail = `phasej.attacker.worker.${ts}@sada.agency`;
    const workerAttackerAcc = await createAccount({
      email: workerAttackerEmail,
      password: "TestPassword123!",
      displayName: "PhaseJ Worker Attacker",
      role: "worker",
      division: "Operations",
      position: "Operations Clerk",
      status: "active",
      modulePermissions: {
        dashboard: true,
      },
    }, superClient);
    testAccountsToClean.push(workerAttackerAcc.user_id);

    // Setup Fixture 3: Admin Account (non-super-admin manager)
    const adminEmail = `phasej.admin.${ts}@sada.agency`;
    const adminAcc = await createAccount({
      email: adminEmail,
      password: "TestPassword123!",
      displayName: "PhaseJ Operational Admin",
      role: "admin",
      division: "Operations",
      position: "Operations Manager",
      status: "active",
      modulePermissions: {
        sales: true,
        tasks: true,
      },
    }, superClient);
    testAccountsToClean.push(adminAcc.user_id);

    // Authenticate worker client
    const { data: workerLogin, error: workerLoginErr } = await workerClient.auth.signInWithPassword({
      email: workerAttackerEmail,
      password: "TestPassword123!",
    });
    assert(!workerLoginErr && Boolean(workerLogin?.user), "Worker client authenticated");

    // Authenticate admin client
    const { data: adminLogin, error: adminLoginErr } = await adminClient.auth.signInWithPassword({
      email: adminEmail,
      password: "TestPassword123!",
    });
    assert(!adminLoginErr && Boolean(adminLogin?.user), "Admin client authenticated");

    // -------------------------------------------------------------------------
    // SECTION 1: Super Admin Grant/Revoke Lifecycle
    // -------------------------------------------------------------------------
    console.log("\n--- SECTION 1: Super Admin Grant/Revoke Lifecycle ---");

    // 1.1 Initial state: target worker does not have sales access
    const initialWorkerCtx = await resolveAuthoritativeSecurityContext(
      superClient,
      targetWorkerAcc.user_id,
      { forceFresh: true }
    );
    assert(initialWorkerCtx.effectivePermissions.sales === false, "Initial state: Target worker sales module is disabled");

    // Attempting sales action with initial worker context must fail
    await assertThrowsAsync(
      async () => {
        await assertAuthorizedMutation(superClient, "sales", "sales.edit_lead", {
          ctx: initialWorkerCtx as any,
          resourceType: "deal",
          resource: { id: "deal-101" },
          resourceAction: "write",
        });
      },
      ["forbidden_module_action", "unauthorized", "sales"],
      "Target worker denied from sales action when sales module is disabled"
    );

    // 1.2 Super Admin grants sales module + granular action
    const grantReason = "Granting sales module for Q4 high-volume campaign";
    const grantMetadata = { ip: "192.168.1.100", agent: "QA-Runner/1.0", channel: "Admin-UI" };

    const grantResult = await updateAccountPermissions(
      targetWorkerAcc.user_id,
      {
        sales: {
          enabled: true,
          actions: {
            "sales.view": true,
            "sales.edit_lead": true,
          },
        },
      },
      superClient,
      undefined,
      { reason: grantReason, requestMetadata: grantMetadata }
    );
    assert(grantResult?.success === true, "Super Admin successfully granted sales module permissions");

    // 1.3 Verify effective permission is now TRUE in database and resolved context
    const grantedWorkerCtx = await resolveAuthoritativeSecurityContext(
      superClient,
      targetWorkerAcc.user_id,
      { forceFresh: true }
    );
    assert(
      grantedWorkerCtx.effectivePermissions.sales === true,
      "Target worker now has sales module enabled in authoritative security context"
    );

    // Target worker now authorized to perform sales.edit_lead
    await assertAuthorizedMutation(superClient, "sales", "sales.edit_lead", {
      ctx: grantedWorkerCtx as any,
      resourceType: "deal",
      resource: { id: "deal-101" },
      resourceAction: "write",
    });
    assert(true, "Target worker successfully authorized for sales.edit_lead after grant");

    // 1.4 Super Admin revokes sales module
    const revokeReason = "Campaign concluded, revoking sales module access";
    const revokeResult = await updateAccountPermissions(
      targetWorkerAcc.user_id,
      {
        sales: false,
      },
      superClient,
      undefined,
      { reason: revokeReason }
    );
    assert(revokeResult?.success === true, "Super Admin successfully revoked sales module permissions");

    // 1.5 Verify effective permission is now FALSE
    const revokedWorkerCtx = await resolveAuthoritativeSecurityContext(
      superClient,
      targetWorkerAcc.user_id,
      { forceFresh: true }
    );
    assert(revokedWorkerCtx.effectivePermissions.sales === false, "Target worker sales module is disabled in database");

    // Target worker now immediately denied
    await assertThrowsAsync(
      async () => {
        await assertAuthorizedMutation(superClient, "sales", "sales.edit_lead", {
          ctx: revokedWorkerCtx as any,
          resourceType: "deal",
          resource: { id: "deal-101" },
          resourceAction: "write",
        });
      },
      ["forbidden_module_action", "unauthorized", "sales"],
      "Target worker immediately denied after Super Admin revocation"
    );

    // -------------------------------------------------------------------------
    // SECTION 2: Authoritative Revocation & Stale Client Cache Invariant
    // -------------------------------------------------------------------------
    console.log("\n--- SECTION 2: Authoritative Revocation & Stale Client Cache Invariant ---");

    // Simulate a client holding a stale client-side cache where sales was enabled:
    const forgedStaleContext = {
      ...revokedWorkerCtx,
      customModulePermissions: {
        sales: {
          enabled: true,
          actions: { "sales.edit_lead": true },
        },
      },
    };

    // When the server authorizes a mutation with forceFresh: true, stale client cache MUST NOT grant real access
    await assertThrowsAsync(
      async () => {
        await assertAuthorizedMutation(superClient, "sales", "sales.edit_lead", {
          ctx: forgedStaleContext as any,
          forceFresh: true,
          resourceType: "deal",
          resource: { id: "deal-101" },
          resourceAction: "write",
        });
      },
      ["forbidden_module_action", "unauthorized", "sales"],
      "Stale client cache rejected: Server pulls authoritative DB state and denies mutation"
    );

    // -------------------------------------------------------------------------
    // SECTION 3: Suspended Account Overrides All Permissions
    // -------------------------------------------------------------------------
    console.log("\n--- SECTION 3: Suspended Account Overrides All Permissions ---");

    // Grant all permissible modules to target worker first
    await updateAccountPermissions(
      targetWorkerAcc.user_id,
      {
        sales: true,
        tasks: true,
        clients: true,
      },
      superClient
    );

    // Super Admin suspends the target worker account
    const suspendReason = "Suspected compromise during operational audit";
    await suspendAccount(targetWorkerAcc.user_id, suspendReason, undefined, superClient);

    // Verify profile status in DB
    const { data: suspendedProfile } = await superClient
      .from("profiles")
      .select("status")
      .eq("id", targetWorkerAcc.user_id)
      .single();
    assert(suspendedProfile?.status === "suspended", "Account profile status in database is 'suspended'");

    // Authoritative security context resolution for suspended user must throw ACCOUNT_SUSPENDED
    await assertThrowsAsync(
      async () => {
        await resolveAuthoritativeSecurityContext(
          superClient,
          targetWorkerAcc.user_id,
          { forceFresh: true }
        );
      },
      ["account_suspended", "suspended"],
      "Authoritative context resolver strictly rejects suspended user with ACCOUNT_SUSPENDED"
    );

    // Context representing a suspended state for evaluating downstream security gates
    const suspendedCtx: any = {
      authenticated: true,
      userId: targetWorkerAcc.user_id,
      role: "worker",
      status: "suspended",
      effectivePermissions: { sales: true, tasks: true, dashboard: true },
    };

    // Route access must be universally blocked
    const salesRouteAccess = evaluateRouteAccess("/admin/sales", suspendedCtx);
    assert(salesRouteAccess.allowed === false, "Route /admin/sales blocked for suspended account");
    assert(salesRouteAccess.reason?.toLowerCase().includes("suspended"), "Route denial explicitly cites account suspension");

    const dashRouteAccess = evaluateRouteAccess("/admin/dashboard", suspendedCtx);
    assert(dashRouteAccess.allowed === false, "Route /admin/dashboard blocked for suspended account");

    // Mutations must be blocked with FORBIDDEN_ACCOUNT_SUSPENDED
    await assertThrowsAsync(
      async () => {
        await assertAuthorizedMutation(superClient, "sales", "sales.edit_lead", {
          ctx: suspendedCtx as any,
          resourceType: "deal",
          resource: { id: "deal-101" },
          resourceAction: "write",
        });
      },
      ["forbidden_account_suspended", "suspended"],
      "Mutations strictly denied for suspended account even with modules enabled"
    );

    // Reactivate account
    await reactivateAccount(targetWorkerAcc.user_id, undefined, superClient);
    const { data: reactivatedProfile } = await superClient
      .from("profiles")
      .select("status")
      .eq("id", targetWorkerAcc.user_id)
      .single();
    assert(reactivatedProfile?.status === "active", "Account reactivated successfully by Super Admin");

    // -------------------------------------------------------------------------
    // SECTION 4: Audit Trail Integrity Verification
    // -------------------------------------------------------------------------
    console.log("\n--- SECTION 4: Audit Trail Integrity Verification ---");

    // Query public.account_audit_logs for target worker
    const { data: auditRows, error: auditErr } = await superClient
      .from("account_audit_logs")
      .select("*")
      .eq("target_user_id", targetWorkerAcc.user_id)
      .order("created_at", { ascending: false });

    assert(!auditErr && Array.isArray(auditRows) && auditRows.length >= 3, "Account audit logs exist for target worker operations");

    // Find permissions_updated log
    const permLog = auditRows!.find((r) => (r.action === "account_permissions_updated" || r.action === "permissions_updated") && r.metadata?.reason === grantReason);
    assert(Boolean(permLog), "Found audit log entry for permission grant with specified reason");
    assert(permLog!.actor_id === superAdminUserId, "Audit log records correct actor_id (Super Admin)");
    assert(permLog!.actor_email === superAdminEmail, "Audit log records correct actor_email");
    assert(permLog!.target_user_id === targetWorkerAcc.user_id, "Audit log records correct target_user_id");
    assert(Boolean(permLog!.metadata?.previous_state), "Audit log records previous_state");
    assert(Boolean(permLog!.metadata?.new_state), "Audit log records new_state");
    assert(Boolean(permLog!.metadata?.diff), "Audit log records calculated diff");
    assert(permLog!.metadata?.diff?.added?.includes("sales") || permLog!.metadata?.diff?.modified?.includes("sales"), "Audit diff accurately identifies 'sales' modification");
    assert(permLog!.metadata?.request_metadata?.ip === "192.168.1.100", "Audit log records request_metadata.ip");

    // Find account_suspended log
    const suspendLog = auditRows!.find((r) => r.action === "account_suspended");
    assert(Boolean(suspendLog), "Found audit log entry for account suspension");
    assert(suspendLog!.metadata?.reason === suspendReason, "Audit log records suspension reason");

    // Check system_audit_logs dual-log correlation
    const { data: sysLogs } = await superClient
      .from("system_audit_logs")
      .select("*")
      .eq("entity_id", targetWorkerAcc.user_id)
      .order("created_at", { ascending: false });

    assert(Array.isArray(sysLogs) && sysLogs.length >= 2, "System audit logs dual-log correlated entries exist");
    const sysPermLog = sysLogs!.find((r) => r.action === "PERMISSIONS_UPDATED");
    assert(Boolean(sysPermLog), "Correlated system audit entry found for PERMISSIONS_UPDATED");
    assert(sysPermLog!.actor_id === superAdminUserId, "System audit entry correctly identifies Super Admin actor");

    // -------------------------------------------------------------------------
    // SECTION 5: Non-Super Admin Negative Attack Denials
    // -------------------------------------------------------------------------
    console.log("\n--- SECTION 5: Non-Super Admin Negative Attack Denials ---");

    // 5.1 Worker calling updateAccountPermissions via TypeScript service
    await assertThrowsAsync(
      async () => {
        await updateAccountPermissions(
          targetWorkerAcc.user_id,
          { sales: true },
          workerClient
        );
      },
      ["forbidden_admin_action", "forbidden_module_action", "unauthorized", "super admin"],
      "Worker calling updateAccountPermissions rejected by service layer"
    );

    // 5.2 Admin calling updateAccountPermissions via TypeScript service
    await assertThrowsAsync(
      async () => {
        await updateAccountPermissions(
          targetWorkerAcc.user_id,
          { sales: true },
          adminClient
        );
      },
      ["forbidden_admin_action", "forbidden_module_action", "unauthorized", "super admin"],
      "Admin calling updateAccountPermissions rejected by service layer (Super Admin exclusive)"
    );

    // 5.3 Worker calling admin_update_account_permissions RPC directly over PostgREST
    await assertThrowsAsync(
      async () => {
        const { error } = await (workerClient as any).rpc("admin_update_account_permissions", {
          _target_user_id: targetWorkerAcc.user_id,
          _permissions: { sales: true },
        });
        if (error) throw error;
      },
      ["must be super admin to update permissions", "unauthorized"],
      "Worker calling admin_update_account_permissions RPC directly rejected by PostgreSQL"
    );

    // 5.4 Admin calling admin_update_account_permissions RPC directly over PostgREST
    await assertThrowsAsync(
      async () => {
        const { error } = await (adminClient as any).rpc("admin_update_account_permissions", {
          _target_user_id: targetWorkerAcc.user_id,
          _permissions: { sales: true },
        });
        if (error) throw error;
      },
      ["must be super admin to update permissions", "unauthorized"],
      "Admin calling admin_update_account_permissions RPC directly rejected by PostgreSQL"
    );

    // 5.5 Worker direct PostgREST mutation on user_module_permissions table
    const { error: directInsertErr } = await (workerClient as any)
      .from("user_module_permissions")
      .insert({
        user_id: workerAttackerAcc.user_id,
        module: "finance",
        enabled: true,
      });
    assert(Boolean(directInsertErr), "Worker direct PostgREST insert into user_module_permissions rejected by RLS");

    // 5.6 Worker direct PostgREST update attempting to forge role to 'super_admin'
    await (workerClient as any)
      .from("user_roles")
      .update({ role: "super_admin" })
      .eq("user_id", workerAttackerAcc.user_id);

    // Verify role in database was not escalated (0 rows updated due to RLS filter):
    const { data: roleCheck } = await superClient
      .from("user_roles")
      .select("role")
      .eq("user_id", workerAttackerAcc.user_id)
      .single();
    assert(roleCheck?.role === "worker", "Direct DB privilege escalation blocked: user_roles remains 'worker'");

    // Also attempt direct INSERT into user_roles which violates WITH CHECK:
    const { error: insertRoleErr } = await (workerClient as any)
      .from("user_roles")
      .insert({ user_id: workerAttackerAcc.user_id, role: "super_admin" });
    assert(Boolean(insertRoleErr), "Direct DB role insertion rejected by RLS WITH CHECK policy");

    // 5.7 Worker direct PostgREST update attempting to forge module_permissions and status
    await (workerClient as any)
      .from("profiles")
      .update({ module_permissions: { accounts: true, finance: true }, status: "suspended" })
      .eq("id", workerAttackerAcc.user_id);

    const { data: attackerProfile } = await superClient
      .from("profiles")
      .select("status, module_permissions")
      .eq("id", workerAttackerAcc.user_id)
      .single();
    assert(
      !attackerProfile?.module_permissions?.accounts && !attackerProfile?.module_permissions?.finance,
      "Direct DB permission tampering blocked: trg_guard_profiles_security_fields reverted unauthorized module changes"
    );
    assert(
      attackerProfile?.status === "active",
      "Direct DB status tampering blocked: trg_guard_profiles_security_fields reverted unauthorized status change"
    );

    // -------------------------------------------------------------------------
    // SECTION 6: Administrative Self-Lockout & Anti-Escalation Defense
    // -------------------------------------------------------------------------
    console.log("\n--- SECTION 6: Administrative Self-Lockout & Anti-Escalation Defense ---");

    // 6.1 Super Admin attempting to revoke own accounts module access via service
    await assertThrowsAsync(
      async () => {
        await updateAccountPermissions(
          superAdminUserId,
          { accounts: false },
          superClient
        );
      },
      ["cannot revoke own access to account management", "administrative self-lockout protection", "forbidden_admin_action"],
      "Self-lockout defense: Super Admin cannot revoke own access to account management via service"
    );

    // 6.2 Super Admin attempting direct RPC call to revoke own accounts module
    await assertThrowsAsync(
      async () => {
        const { error } = await (superClient as any).rpc("admin_update_account_permissions", {
          _target_user_id: superAdminUserId,
          _permissions: { accounts: false },
        });
        if (error) throw error;
      },
      ["cannot revoke own access to account management", "administrative self-lockout protection"],
      "Self-lockout defense: PostgreSQL RPC throws exception if Super Admin revokes own accounts module"
    );

    // 6.3 Super Admin attempting to suspend own account via service
    await assertThrowsAsync(
      async () => {
        await suspendAccount(superAdminUserId, "Accidental self-suspension", undefined, superClient);
      },
      ["cannot suspend own account", "administrative self-lockout protection", "forbidden_admin_action"],
      "Self-lockout defense: Super Admin cannot suspend own account via service"
    );

    // 6.4 Super Admin attempting direct RPC call to suspend own account
    await assertThrowsAsync(
      async () => {
        const { error } = await (superClient as any).rpc("admin_suspend_account", {
          _user_id: superAdminUserId,
          _reason: "Accidental direct self-suspension",
        });
        if (error) throw error;
      },
      ["cannot suspend own account", "administrative self-lockout protection"],
      "Self-lockout defense: PostgreSQL RPC throws exception if Super Admin suspends own account"
    );

    console.log("\n=======================================================================");
    console.log(`PHASE J TEST RESULTS: ${passedAssertions}/${totalAssertions} ASSERTIONS PASSED (100%)`);
    console.log("=======================================================================\n");

  } finally {
    // Teardown: Clean up test accounts
    console.log("Cleaning up temporary test accounts...");
    for (const uid of testAccountsToClean) {
      try {
        await deleteAccount(uid, undefined, superClient);
      } catch (err) {
        // Ignored in cleanup
      }
    }
    console.log("Cleanup complete.");
  }
}

runPhaseJPermissionAdminSuite().catch((err) => {
  console.error("Unexpected error in Phase J test suite:", err);
  process.exit(1);
});
