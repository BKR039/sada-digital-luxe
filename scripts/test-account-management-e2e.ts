import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import {
  assertAuthorizedMutation,
  resolveAuthoritativeSecurityContext,
  SecurityAuthorizationError,
  invalidateSecurityContextCache,
} from "../src/lib/security-isolation-service";
import {
  updateAccount,
  updateAccountPermissions,
  suspendAccount,
  reactivateAccount,
  fetchUserModulePermissions,
} from "../src/lib/account-service";
import {
  revokeSession,
  revokeAllUserSessions,
} from "../src/lib/security-center-service";
import { getEffectiveModulePermission } from "../src/types/permissions";
import { resetRateLimit } from "../src/lib/rate-limiter";

// Load environment variables directly from .env
const envPath = path.resolve(process.cwd(), ".env");
const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
const env: Record<string, string> = {};
for (const line of lines) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = (match[2] || "").trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1]] = val;
  }
}

const SUPABASE_URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ Missing Supabase credentials in .env");
  process.exit(1);
}

const SUPERADMIN_EMAIL = "qa.superadmin@sada.agency";
const SUPERADMIN_PASS = "SuperAdminPassword123!";
const TARGET_USER_EMAIL = "adv.target.test@sada.agency";
const TARGET_USER_ID = "9550f6d4-f64d-4d5d-ac89-c3badf163266";
const TARGET_USER_PASS = "TargetUserPassword123!";

let totalPasses = 0;
let totalFails = 0;

function assert(condition: boolean, testName: string, details?: any) {
  if (condition) {
    totalPasses++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    totalFails++;
    console.error(`  ❌ [FAIL] ${testName}`, details || "");
  }
}

async function runE2ETests() {
  console.log("============================================================");
  console.log("SADA OS — ACCOUNT MANAGEMENT & EMERGENCY SESSION CONTROL E2E");
  console.log("============================================================\n");

  // Create isolated Super Admin client
  const saClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: saAuth, error: saAuthErr } = await saClient.auth.signInWithPassword({
    email: SUPERADMIN_EMAIL,
    password: SUPERADMIN_PASS,
  });

  if (saAuthErr || !saAuth?.user) {
    console.error("❌ Failed to authenticate Super Admin:", saAuthErr?.message);
    process.exit(1);
  }
  const saUserId = saAuth.user.id;
  console.log(`[Setup] Super Admin signed in: ${saUserId} (${saAuth.user.email})`);

  // Ensure target user has credentials & team member record for realistic testing
  await (saClient as any).rpc("admin_reset_account_password", {
    _user_id: TARGET_USER_ID,
    _new_password: TARGET_USER_PASS,
  });

  // Ensure team_members row exists for target account
  const { data: existingTm } = await saClient
    .from("team_members")
    .select("id")
    .or(`user_id.eq.${TARGET_USER_ID},profile_id.eq.${TARGET_USER_ID}`)
    .maybeSingle();

  if (!existingTm) {
    await saClient.from("team_members").insert({
      user_id: TARGET_USER_ID,
      profile_id: TARGET_USER_ID,
      name: "Adversarial Target Account",
      email: TARGET_USER_EMAIL,
      role: "worker",
      position: "Specialist",
      division: "Development",
      is_active: true,
      published: true,
    });
  }

  // Create target user client
  const targetClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await targetClient.auth.signInWithPassword({
    email: TARGET_USER_EMAIL,
    password: TARGET_USER_PASS,
  });

  // Create anonymous client
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ------------------------------------------------------------
  // SCENARIO A: Authorized Super Admin workspace load without false unauthorized error
  // ------------------------------------------------------------
  console.log("\n--- Scenario A: Super Admin Context & Workspace Load ---");
  {
    invalidateSecurityContextCache();
    const saSecCtx = await resolveAuthoritativeSecurityContext(saClient, saUserId);
    assert(saSecCtx.authenticated === true, "Super Admin is authenticated");
    assert(saSecCtx.role === "super_admin", "Authoritative role is super_admin");
    assert(saSecCtx.status === "active", "Account status is active");
    assert(saSecCtx.effectivePermissions.accounts === true, "Accounts module is authorized");

    let mutationOk = false;
    try {
      await assertAuthorizedMutation(saClient, "accounts", "accounts.manage");
      mutationOk = true;
    } catch (err: any) {
      console.error("Mutation failed unexpectedly:", err);
    }
    assert(mutationOk, "assertAuthorizedMutation('accounts', 'accounts.manage') succeeds for Super Admin");

    const { data: accounts, error: listErr } = await (saClient as any).rpc("admin_list_accounts");
    assert(!listErr && Array.isArray(accounts) && accounts.length > 0, "admin_list_accounts returns account records", listErr?.message);
    const targetFound = (accounts || []).some((a: any) => a.user_id === TARGET_USER_ID);
    assert(targetFound, `Target test account ${TARGET_USER_ID} is present in accounts directory`);
  }

  // ------------------------------------------------------------
  // SCENARIO B: Super Admin changes role with database persistence & audit
  // ------------------------------------------------------------
  console.log("\n--- Scenario B: Role Modification & Database Persistence ---");
  {
    // Step 1: Promote Worker -> Admin
    let updateOk = false;
    try {
      await updateAccount(
        {
          userId: TARGET_USER_ID,
          displayName: "Adversarial Target Account",
          role: "admin",
          division: "Development",
          position: "Lead Engineer",
          status: "active",
        },
        saClient
      );
      updateOk = true;
    } catch (err: any) {
      console.error("updateAccount to admin failed:", err);
    }
    assert(updateOk, "updateAccount successfully changes role to 'admin'");

    // Verify in database: user_roles table
    const { data: roleRowsAdmin } = await saClient
      .from("user_roles")
      .select("role")
      .eq("user_id", TARGET_USER_ID);
    const hasAdminRole = (roleRowsAdmin || []).some((r: any) => r.role === "admin");
    assert(hasAdminRole, "public.user_roles reflects role 'admin' in database");

    // Verify in database: team_members table
    const { data: tmAdmin } = await saClient
      .from("team_members")
      .select("role")
      .or(`user_id.eq.${TARGET_USER_ID},profile_id.eq.${TARGET_USER_ID}`)
      .maybeSingle();
    assert(tmAdmin?.role === "admin", "public.team_members reflects role 'admin'");

    // Step 2: Demote back Admin -> Worker
    let revertOk = false;
    try {
      await updateAccount(
        {
          userId: TARGET_USER_ID,
          displayName: "Adversarial Target Account",
          role: "worker",
          division: "Development",
          position: "Specialist",
          status: "active",
        },
        saClient
      );
      revertOk = true;
    } catch (err: any) {
      console.error("updateAccount to worker failed:", err);
    }
    assert(revertOk, "updateAccount successfully reverts role to 'worker'");

    const { data: roleRowsWorker } = await saClient
      .from("user_roles")
      .select("role")
      .eq("user_id", TARGET_USER_ID);
    const hasWorkerRole = (roleRowsWorker || []).some((r: any) => r.role === "worker");
    assert(hasWorkerRole, "public.user_roles reflects reverted role 'worker' in database");

    // Verify audit log record exists for role update
    const { data: auditLogs } = await (saClient as any).rpc("admin_list_account_audit_logs", {
      _target_user_id: TARGET_USER_ID,
    });
    const roleAudit = (auditLogs || []).some(
      (l: any) => l.action === "account_updated" || l.action === "update_profile"
    );
    assert(roleAudit, "account_audit_logs contains audit record for role update");
  }

  // ------------------------------------------------------------
  // SCENARIO C: Module Permissions Save, Persistence, and Access Enforcement
  // ------------------------------------------------------------
  console.log("\n--- Scenario C: Granular Module Permissions & Enforcement ---");
  {
    const customPerms = {
      sales: { enabled: true, actions: { create_lead: true, edit_lead: true, delete_lead: false } },
      finance: false,
    };

    let permOk = false;
    try {
      await updateAccountPermissions(
        TARGET_USER_ID,
        customPerms as any,
        saClient,
        undefined,
        { reason: "E2E Automated Verification Test" }
      );
      permOk = true;
    } catch (err: any) {
      console.error("updateAccountPermissions failed:", err);
    }
    assert(permOk, "updateAccountPermissions completes successfully via Super Admin RPC");

    const fetchedPerms = await fetchUserModulePermissions(TARGET_USER_ID, saClient);
    assert(Boolean(fetchedPerms?.sales), "user_module_permissions has persistent entry for 'sales'");
    assert(
      typeof fetchedPerms?.sales === "object" && (fetchedPerms.sales as any).enabled === true,
      "sales module is enabled in persistent store"
    );

    const effectiveSales = getEffectiveModulePermission("sales", "worker", fetchedPerms || {});
    assert(effectiveSales === true, "Worker with override has effective access to sales");
    const effectiveFinance = getEffectiveModulePermission("finance", "worker", fetchedPerms || {});
    assert(effectiveFinance === false, "Worker with finance=false is locked out of finance");

    // Reset permissions
    await updateAccountPermissions(TARGET_USER_ID, {}, saClient);
    const resetPerms = await fetchUserModulePermissions(TARGET_USER_ID, saClient);
    assert(!resetPerms?.sales, "Custom permissions successfully reset");
  }

  // ------------------------------------------------------------
  // SCENARIO D: Account Lifecycle Suspension & Reactivation Transition
  // ------------------------------------------------------------
  console.log("\n--- Scenario D: Account Lifecycle Suspension & Reactivation ---");
  {
    // 1. Suspend target account
    let suspendOk = false;
    try {
      await suspendAccount(TARGET_USER_ID, "E2E Lifecycle Test Suspension", undefined, saClient);
      suspendOk = true;
    } catch (err: any) {
      console.error("suspendAccount failed:", err);
    }
    assert(suspendOk, "suspendAccount executes cleanly");

    const { data: suspendedProf } = await saClient
      .from("profiles")
      .select("status")
      .eq("id", TARGET_USER_ID)
      .maybeSingle();
    assert(suspendedProf?.status === "suspended", "public.profiles.status is 'suspended'");

    // Verify security context resolver strictly rejects suspended user with ACCOUNT_SUSPENDED
    invalidateSecurityContextCache(TARGET_USER_ID);
    let caughtSuspendedContextErr = false;
    try {
      await resolveAuthoritativeSecurityContext(saClient, TARGET_USER_ID, { forceFresh: true });
    } catch (err: any) {
      if (
        (err instanceof SecurityAuthorizationError || err.name === "SecurityAuthorizationError") &&
        err.code === "ACCOUNT_SUSPENDED"
      ) {
        caughtSuspendedContextErr = true;
      }
    }
    assert(caughtSuspendedContextErr, "Authoritative security context resolver strictly blocks suspended account with ACCOUNT_SUSPENDED error");

    // 2. Reactivate target account
    let reactivateOk = false;
    try {
      await reactivateAccount(TARGET_USER_ID, undefined, saClient);
      reactivateOk = true;
    } catch (err: any) {
      console.error("reactivateAccount failed:", err);
    }
    assert(reactivateOk, "reactivateAccount executes cleanly");

    const { data: reactivatedProf } = await saClient
      .from("profiles")
      .select("status")
      .eq("id", TARGET_USER_ID)
      .maybeSingle();
    assert(reactivatedProf?.status === "active", "public.profiles.status is restored to 'active'");

    invalidateSecurityContextCache(TARGET_USER_ID);
    const activeCtx = await resolveAuthoritativeSecurityContext(saClient, TARGET_USER_ID, { forceFresh: true });
    assert(activeCtx.status === "active", "Reactivated account resolves with 'active' status");
  }

  // ------------------------------------------------------------
  // SCENARIO E: Revoke Single Session (Authenticated Target Principal Flow)
  // ------------------------------------------------------------
  console.log("\n--- Scenario E: Revoke Single Target Session ---");
  {
    const targetSessionId = "sess_e2e_target_" + Date.now();
    // Register real session via targetClient (authenticated as target user)
    const { data: regRes, error: regErr } = await (targetClient as any).rpc("register_user_session", {
      _session_id: targetSessionId,
      _user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
      _ip_address: "127.0.0.1",
      _device_type: "desktop",
      _browser_name: "Google Chrome",
      _os_name: "Windows 11 / 10",
      _auth_method: "password",
    });
    assert(!regErr && regRes?.success, "Target user registers active session via canonical RPC", regErr?.message);

    // Super Admin revokes this session
    let revokeOk = false;
    try {
      const res = await revokeSession(targetSessionId, "E2E Test Session Revocation", saClient);
      revokeOk = res.success;
    } catch (err: any) {
      console.error("revokeSession failed:", err);
    }
    assert(revokeOk, "revokeSession returns success: true");

    // Verify session status in public.user_sessions
    const { data: sessRow } = await saClient
      .from("user_sessions")
      .select("status, revocation_reason")
      .eq("session_id", targetSessionId)
      .maybeSingle();
    assert(sessRow?.status === "revoked", "Database public.user_sessions status is 'revoked'");
    assert(
      sessRow?.revocation_reason?.includes("E2E Test"),
      "Revocation reason accurately persisted in database"
    );

    // Verify system audit trail record
    const { data: auditRow } = await saClient
      .from("system_audit_logs")
      .select("action, entity_id")
      .eq("entity_id", targetSessionId)
      .maybeSingle();
    assert(auditRow?.action === "SESSION_REVOKED", "system_audit_logs contains immutable SESSION_REVOKED record");

    // Cleanup session
    await saClient.from("user_sessions").delete().eq("session_id", targetSessionId);
  }

  // ------------------------------------------------------------
  // SCENARIO F: Revoke All Sessions for Account (Global Sign Out)
  // ------------------------------------------------------------
  console.log("\n--- Scenario F: Revoke All Sessions (Sign Out Everywhere) ---");
  {
    const sess1 = "sess_e2e_bulk1_" + Date.now();
    const sess2 = "sess_e2e_bulk2_" + Date.now();

    await (targetClient as any).rpc("register_user_session", {
      _session_id: sess1,
      _user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
      _ip_address: "127.0.0.1",
      _device_type: "mobile",
      _browser_name: "Mobile Safari",
      _os_name: "iOS",
      _auth_method: "password",
    });

    await (targetClient as any).rpc("register_user_session", {
      _session_id: sess2,
      _user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/120.0.0.0",
      _ip_address: "127.0.0.1",
      _device_type: "desktop",
      _browser_name: "Microsoft Edge",
      _os_name: "Windows 11 / 10",
      _auth_method: "password",
    });

    let bulkRevokeOk = false;
    try {
      const res = await revokeAllUserSessions(TARGET_USER_ID, "Emergency global logout test", saClient);
      bulkRevokeOk = res.success && (res.revoked_count ?? 0) >= 2;
    } catch (err: any) {
      console.error("revokeAllUserSessions failed:", err);
    }
    assert(bulkRevokeOk, "revokeAllUserSessions revokes all target user sessions");

    const { data: checkSess } = await saClient
      .from("user_sessions")
      .select("session_id, status")
      .in("session_id", [sess1, sess2]);
    const allRevoked = (checkSess || []).every((s: any) => s.status === "revoked");
    assert(allRevoked, "All target account sessions transitioned to 'revoked' status in DB");

    // Cleanup
    await saClient.from("user_sessions").delete().in("session_id", [sess1, sess2]);
  }

  // ------------------------------------------------------------
  // SCENARIO G: Unauthorized Principals Denied (Anonymous & Worker)
  // ------------------------------------------------------------
  console.log("\n--- Scenario G: Unauthorized Principals Denied ---");
  {
    // 1. Anonymous client attempt
    let anonBlocked = false;
    try {
      await updateAccount(
        {
          userId: TARGET_USER_ID,
          displayName: "Hacked Name",
          role: "super_admin",
          division: "Executive",
          position: "Root",
        },
        anonClient
      );
    } catch (err: any) {
      anonBlocked =
        err instanceof SecurityAuthorizationError &&
        (err.code === "UNAUTHENTICATED" || err.code === "FORBIDDEN_ADMIN_ACTION");
    }
    assert(anonBlocked, "Anonymous client is blocked from updateAccount with UNAUTHENTICATED error");

    // 2. Anonymous client attempt at session revocation
    let anonRevokeBlocked = false;
    try {
      await revokeSession("any_session_id", "Malicious revocation", anonClient);
    } catch (err: any) {
      anonRevokeBlocked =
        err instanceof SecurityAuthorizationError &&
        (err.code === "UNAUTHENTICATED" || err.code === "FORBIDDEN_ADMIN_ACTION");
    }
    assert(anonRevokeBlocked, "Anonymous client is blocked from revokeSession with UNAUTHENTICATED error");

    // 3. Worker client attempt to invoke updateAccount
    let workerUpdateBlocked = false;
    try {
      await updateAccount(
        {
          userId: TARGET_USER_ID,
          displayName: "Worker Trying To Change Role",
          role: "super_admin",
          division: "Executive",
          position: "Hacker",
        },
        targetClient
      );
    } catch (err: any) {
      workerUpdateBlocked =
        err instanceof SecurityAuthorizationError &&
        err.code === "FORBIDDEN_ADMIN_ACTION";
    }
    assert(workerUpdateBlocked, "Worker client is strictly blocked from updateAccount with FORBIDDEN_ADMIN_ACTION");

    // 4. Worker client attempt to invoke revokeSession
    let workerRevokeBlocked = false;
    try {
      await revokeSession("some_session_id", "Worker unauthorized revoke", targetClient);
    } catch (err: any) {
      workerRevokeBlocked =
        err instanceof SecurityAuthorizationError &&
        err.code === "FORBIDDEN_ADMIN_ACTION";
    }
    assert(workerRevokeBlocked, "Worker client is strictly blocked from revokeSession with FORBIDDEN_ADMIN_ACTION");

    // 5. Worker direct RPC call rejected by PostgreSQL SECURITY DEFINER
    const { error: workerRpcErr } = await (targetClient as any).rpc("admin_revoke_session", {
      _session_id: "some_session",
      _reason: "Hacker",
    });
    assert(Boolean(workerRpcErr), "PostgreSQL SECURITY DEFINER RPC rejects Worker caller directly", workerRpcErr?.message);
  }

  // ------------------------------------------------------------
  // SCENARIO H: Administrative Self-Lockout & Anti-Escalation Protections
  // ------------------------------------------------------------
  console.log("\n--- Scenario H: Administrative Self-Lockout & Anti-Escalation ---");
  {
    resetRateLimit();
    // 1. Super Admin self-demotion blocked
    let selfDemoteBlocked = false;
    try {
      await updateAccount(
        {
          userId: saUserId,
          displayName: "Super Admin",
          role: "worker",
          division: "Executive",
          position: "Super Admin",
        },
        saClient
      );
    } catch (err: any) {
      if (
        (err instanceof SecurityAuthorizationError || err.name === "SecurityAuthorizationError") &&
        err.code === "FORBIDDEN_ADMIN_ACTION"
      ) {
        selfDemoteBlocked = true;
      }
    }
    assert(selfDemoteBlocked, "Super Admin self-demotion is strictly blocked by administrative self-lockout defense");

    resetRateLimit();
    // 2. Super Admin self-suspension blocked
    let selfSuspendBlocked = false;
    try {
      await suspendAccount(saUserId, "Accidental self-suspend", undefined, saClient);
    } catch (err: any) {
      if (
        (err instanceof SecurityAuthorizationError || err.name === "SecurityAuthorizationError") &&
        err.code === "FORBIDDEN_ADMIN_ACTION"
      ) {
        selfSuspendBlocked = true;
      }
    }
    assert(selfSuspendBlocked, "Super Admin self-suspension is strictly blocked by administrative self-lockout defense");

    resetRateLimit();
    // 3. Super Admin global sign out on self blocked
    let selfBulkRevokeBlocked = false;
    try {
      await revokeAllUserSessions(saUserId, "Accidental self logout all", saClient);
    } catch (err: any) {
      if (
        (err instanceof SecurityAuthorizationError || err.name === "SecurityAuthorizationError") &&
        err.code === "FORBIDDEN_ADMIN_ACTION"
      ) {
        selfBulkRevokeBlocked = true;
      }
    }
    assert(selfBulkRevokeBlocked, "Super Admin revoke-all-sessions on own account is blocked by self-lockout defense");
  }

  // ------------------------------------------------------------
  // SCENARIO I: Audit Records Immutability
  // ------------------------------------------------------------
  console.log("\n--- Scenario I: Audit Records Immutability ---");
  {
    const { error: delAuditErr } = await saClient
      .from("account_audit_logs")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    assert(
      Boolean(delAuditErr),
      "Direct DELETE on account_audit_logs is rejected by PostgreSQL RLS immutability policy",
      delAuditErr?.message
    );
  }

  // ------------------------------------------------------------
  // SCENARIO J: Failure Visibility & Actionable Error Reporting
  // ------------------------------------------------------------
  console.log("\n--- Scenario J: Failure Visibility & Actionable Error Codes ---");
  {
    const { error: badUidErr } = await (saClient as any).rpc("admin_suspend_account_with_sessions", {
      _target_user_id: "00000000-0000-0000-0000-000000000000",
      _reason: "Test non-existent",
    });
    assert(
      Boolean(badUidErr && badUidErr.message?.toLowerCase().includes("not found")),
      "Actionable error returned for non-existent target user",
      badUidErr?.message
    );
  }

  console.log("\n============================================================");
  console.log(`TEST RESULTS: ${totalPasses} Passed, ${totalFails} Failed`);
  console.log("============================================================");

  if (totalFails > 0) {
    process.exit(1);
  }
}

runE2ETests().catch((err) => {
  console.error("Unexpected error in E2E suite:", err);
  process.exit(1);
});
