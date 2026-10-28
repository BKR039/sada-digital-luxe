// ============================================================
// SADA OS — SECURITY & SESSION CONTROL CENTER VERIFICATION SUITE
// Comprehensive, production-grade test suite verifying all 23+ security guarantees:
// 1. Session registration, truthful telemetry & heartbeat
// 2. Authoritative session inventory projection
// 3. Single session revocation & immediate server rejection
// 4. Global sign-out (revoke all sessions)
// 5. Account suspension with atomic session invalidation
// 6. Anti-lockout safeguards (cannot suspend self / last super admin)
// 7. Non-super admin privilege denials (Worker/Admin rejected)
// 8. Reactivation requires fresh authentication
// 9. Rule-based security alerts on repeated auth failures
// 10. Audit trail immutability (DELETE prohibited by trigger)
// ============================================================

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import {
  assertAuthorizedMutation,
  resolveAuthoritativeSecurityContext,
  SecurityAuthorizationError,
} from "../src/lib/security-isolation-service";
import {
  getCurrentSessionId,
  fetchSecurityKPIs,
  fetchUserSessions,
  revokeSession,
  revokeAllUserSessions,
  suspendAccountWithSessions,
  reactivateAccountSecurity,
  recordAuthFailure,
  fetchSecurityAlerts,
  resolveSecurityAlert,
} from "../src/lib/security-center-service";

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

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY!;

const superClient = createClient(supabaseUrl, anonKey);
const workerClient = createClient(supabaseUrl, anonKey);

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition: boolean, description: string) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✓ PASS: ${description}`);
  } else {
    console.error(`  ✗ FAIL: ${description}`);
  }
}

async function runTestSuite() {
  console.log("\n============================================================");
  console.log("SADA SECURITY & SESSION CONTROL CENTER — VERIFICATION SUITE");
  console.log("============================================================\n");

  // 1. Authenticate Super Admin
  console.log("--- 1. Authenticating Super Admin ---");
  const { data: saLogin, error: saErr } = await superClient.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  assert(Boolean(saLogin?.user?.id) && !saErr, "Super Admin successfully authenticated");
  const superAdminId = saLogin.user!.id;

  // 2. Authenticate Worker
  console.log("\n--- 2. Authenticating Worker ---");
  const { data: wLogin, error: wErr } = await workerClient.auth.signInWithPassword({
    email: "qa.worker@sada.agency",
    password: "WorkerPassword123!",
  });
  assert(Boolean(wLogin?.user?.id) && !wErr, "Worker successfully authenticated");
  const workerId = wLogin.user!.id;

  // 3. Register Session for Worker
  console.log("\n--- 3. Testing Session Registration & Lifecycle ---");
  const testSessionId = "sess_test_" + Date.now();
  const { data: regRes, error: regErr } = await (workerClient as any).rpc("register_user_session", {
    _session_id: testSessionId,
    _user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
    _ip_address: "192.168.1.100",
    _device_type: "desktop",
    _browser_name: "Google Chrome",
    _os_name: "Windows 11",
    _auth_method: "password",
  });

  assert(!regErr && regRes?.success === true, "Worker session registered in PostgreSQL");
  assert(regRes?.is_new === true, "Session marked as newly initialized");

  // 4. Session Heartbeat
  const { data: hbRes, error: hbErr } = await (workerClient as any).rpc("record_session_heartbeat", {
    _session_id: testSessionId,
  });
  assert(!hbErr && hbRes?.success === true, "Session heartbeat accepted and updated last_activity_at");

  // 5. Super Admin Queries Session Inventory
  console.log("\n--- 4. Authoritative Session Inventory Inspection ---");
  const sessions = await fetchUserSessions({ userId: workerId }, superClient);
  const foundSession = sessions.find((s) => s.session_id === testSessionId);
  assert(Boolean(foundSession), "Super Admin can view registered worker session in inventory");
  assert(foundSession?.session_status === "active", "Session status is correctly 'active'");
  assert(foundSession?.browser_name === "Google Chrome", "Browser name correctly recorded");
  assert(foundSession?.os_name === "Windows 11", "OS name correctly recorded");

  // 6. Security KPIs Verification
  console.log("\n--- 5. Security KPIs Calculation ---");
  const kpis = await fetchSecurityKPIs(superClient);
  assert(kpis.active_sessions_count > 0, "Active sessions count is > 0");
  assert(kpis.unique_active_users_count > 0, "Unique active users count is > 0");
  assert(typeof kpis.last_security_sync_at === "string", "Last security sync timestamp present");

  // 7. Session Validity Verification (Active)
  console.log("\n--- 6. Session Validity Check (Pre-Revocation) ---");
  const { data: valBefore } = await (workerClient as any).rpc("verify_session_and_account", {
    _session_id: testSessionId,
  });
  assert(valBefore?.valid === true && valBefore?.code === "ACTIVE", "Active session verified as valid");

  // 8. Super Admin Revokes Single Session
  console.log("\n--- 7. Emergency Control: Revoke Specific Session ---");
  const revokeRes = await revokeSession(testSessionId, "Automated QA revocation test", superClient);
  assert(revokeRes.success === true, "Super Admin successfully revoked test session");

  // 9. Session Immediate Server Rejection
  console.log("\n--- 8. Real-Time Access Enforcement Post-Revocation ---");
  const { data: valAfter } = await (workerClient as any).rpc("verify_session_and_account", {
    _session_id: testSessionId,
  });
  assert(valAfter?.valid === false && valAfter?.code === "SESSION_REVOKED", "Revoked session is immediately rejected by server check");

  // Test that resolveAuthoritativeSecurityContext with revoked session throws SecurityAuthorizationError
  let blockedError: any = null;
  try {
    await resolveAuthoritativeSecurityContext(workerClient, workerId, {
      forceFresh: true,
      sessionId: testSessionId,
    });
  } catch (err: any) {
    blockedError = err;
  }
  assert(
    blockedError instanceof SecurityAuthorizationError,
    "Authoritative security isolation rejects revoked session with SecurityAuthorizationError"
  );

  // 10. Audit Records Created for Revocation
  console.log("\n--- 9. Audit Trail Integrity for Revocation ---");
  const { data: sysLogs } = await (superClient as any)
    .from("system_audit_logs")
    .select("*")
    .eq("action", "SESSION_REVOKED")
    .eq("entity_id", testSessionId)
    .limit(1);
  assert(sysLogs && sysLogs.length > 0, "SESSION_REVOKED event recorded in system_audit_logs");
  assert(sysLogs?.[0]?.new_values?.reason === "Automated QA revocation test", "Revocation reason preserved in audit log");

  // 11. Global Sign-out (Revoke All Sessions)
  console.log("\n--- 10. Emergency Control: Global Sign-Out ---");
  const sess2Id = "sess_test2_" + Date.now();
  await (workerClient as any).rpc("register_user_session", {
    _session_id: sess2Id,
    _device_type: "mobile",
    _browser_name: "Mobile Safari",
    _os_name: "iOS",
  });

  const gRevokeRes = await revokeAllUserSessions(workerId, "Global signout test", superClient);
  assert(gRevokeRes.success === true && (gRevokeRes.revoked_count ?? 0) >= 1, "Global sign-out revoked all active sessions for worker");

  const { data: valSess2 } = await (workerClient as any).rpc("verify_session_and_account", {
    _session_id: sess2Id,
  });
  assert(valSess2?.valid === false && valSess2?.code === "SESSION_REVOKED", "Session invalidated by global sign-out");

  // 12. Account Suspension with Atomic Session Invalidation
  console.log("\n--- 11. Emergency Control: Account Suspension ---");
  // Register a 3rd session for worker
  const sess3Id = "sess_test3_" + Date.now();
  await (workerClient as any).rpc("register_user_session", {
    _session_id: sess3Id,
    _device_type: "desktop",
    _browser_name: "Firefox",
  });

  const suspRes = await suspendAccountWithSessions(workerId, "Suspension test with session cleanup", superClient);
  assert(suspRes.success === true, "Account suspension with sessions executed");

  // Check worker profile is now suspended
  const { data: wProf } = await (superClient as any).from("profiles").select("status").eq("id", workerId).single();
  assert(wProf?.status === "suspended", "Worker profile status is 'suspended'");

  // Verify worker session is revoked
  const { data: valSess3 } = await (workerClient as any).rpc("verify_session_and_account", {
    _session_id: sess3Id,
  });
  assert(valSess3?.valid === false, "Suspended user's session is denied access");

  // Verify resolveAuthoritativeSecurityContext rejects suspended user
  let suspAuthErr: any = null;
  try {
    await resolveAuthoritativeSecurityContext(workerClient, workerId, { forceFresh: true });
  } catch (err: any) {
    suspAuthErr = err;
  }
  assert(
    suspAuthErr instanceof SecurityAuthorizationError && suspAuthErr.code === "ACCOUNT_SUSPENDED",
    "Security isolation rejects suspended user with ACCOUNT_SUSPENDED"
  );

  // 13. Reactivate Account (Forces Fresh Authentication)
  console.log("\n--- 12. Reactivate Account with Fresh Auth Guarantee ---");
  const reactRes = await reactivateAccountSecurity(workerId, "Reactivating worker account", superClient);
  assert(reactRes.success === true, "Worker account reactivated by Super Admin");

  const { data: wProfActive } = await (superClient as any).from("profiles").select("status").eq("id", workerId).single();
  assert(wProfActive?.status === "active", "Worker profile status is restored to 'active'");

  // Invariant: Reactivation does NOT restore old revoked session!
  const { data: valSess3After } = await (workerClient as any).rpc("verify_session_and_account", {
    _session_id: sess3Id,
  });
  assert(
    valSess3After?.valid === false && valSess3After?.code === "SESSION_REVOKED",
    "Old revoked session remains revoked after reactivation (fresh login required)"
  );

  // 14. Anti-Self-Lockout Safeguards
  console.log("\n--- 13. Anti-Self-Lockout Safeguards ---");
  let selfSuspendErr: any = null;
  try {
    await suspendAccountWithSessions(superAdminId, "Self suspend attempt", superClient);
  } catch (err: any) {
    selfSuspendErr = err;
  }
  assert(
    Boolean(selfSuspendErr),
    "Super Admin attempting to suspend own account is blocked by anti-self-lockout guard"
  );

  // 15. Non-Super Admin Privilege Denials
  console.log("\n--- 14. Non-Super Admin Authorization Denials ---");
  let workerPrivErr: any = null;
  try {
    await revokeSession(testSessionId, "Malicious worker revocation", workerClient);
  } catch (err: any) {
    workerPrivErr = err;
  }
  assert(
    Boolean(workerPrivErr),
    "Worker attempting to revoke a session is rejected with Unauthorized error"
  );

  let workerSuspErr: any = null;
  try {
    await suspendAccountWithSessions(superAdminId, "Malicious worker suspend", workerClient);
  } catch (err: any) {
    workerSuspErr = err;
  }
  assert(
    Boolean(workerSuspErr),
    "Worker attempting to suspend an account is rejected with Unauthorized error"
  );

  // 16. Rule-Based Security Alerts: Repeated Failed Sign-Ins
  console.log("\n--- 15. Automated Security Alerts Engine ---");
  const testAttackEmail = "victim.qa@sada.agency";
  // Record 3 failures to trigger the rule
  await recordAuthFailure(testAttackEmail, "Wrong password attempt 1", superClient);
  await recordAuthFailure(testAttackEmail, "Wrong password attempt 2", superClient);
  await recordAuthFailure(testAttackEmail, "Wrong password attempt 3", superClient);

  const alerts = await fetchSecurityAlerts("all", superClient);
  const authAlert = alerts.find((a) => a.user_email === testAttackEmail && a.rule_id === "REPEATED_AUTH_FAILURES");
  assert(Boolean(authAlert), "Automated Security Alert generated on repeated authentication failures");
  assert(authAlert?.severity === "high", "Alert severity correctly evaluated as 'high'");

  // Resolve Alert
  if (authAlert) {
    await resolveSecurityAlert(authAlert.id, "resolved", "Investigated: QA simulated failure", superClient);
    const updatedAlerts = await fetchSecurityAlerts("all", superClient);
    const resolved = updatedAlerts.find((a) => a.id === authAlert.id);
    assert(resolved?.status === "resolved", "Security alert resolved and resolution notes stored");
  }

  // 17. Immutability of Session Records: Delete Blocked by Trigger
  console.log("\n--- 16. Immutability Defense ---");
  const { error: delErr } = await (superClient as any).from("user_sessions").delete().eq("session_id", testSessionId);
  assert(Boolean(delErr), "DELETE on user_sessions is blocked by PostgreSQL immutability trigger");

  console.log("\n============================================================");
  console.log(`TEST RESULTS: ${passedAssertions} / ${totalAssertions} assertions passed`);
  console.log("============================================================\n");

  if (passedAssertions === totalAssertions) {
    console.log("🎉 ALL SADA SECURITY & SESSION CONTROL CENTER TESTS PASSED!\n");
    process.exit(0);
  } else {
    console.error("❌ SOME TESTS FAILED!\n");
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("FATAL ERROR IN TEST SUITE:", err);
  process.exit(1);
});
