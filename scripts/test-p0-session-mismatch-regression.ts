import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import {
  resolveAuthoritativeSecurityContext,
  assertAuthorizedMutation,
  SecurityAuthorizationError,
} from "../src/lib/security-isolation-service";
import { updateAccount } from "../src/lib/account-service";

// Load .env
const envPath = path.resolve(process.cwd(), ".env");
const env: Record<string, string> = {};
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = (match[2] || "").trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.substring(1, value.length - 1);
      env[match[1]] = value;
    }
  });
}

const supabaseUrl = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

function getClient() {
  return createClient(supabaseUrl, anonKey);
}

interface TestResult {
  vector: number;
  description: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

async function main() {
  console.log("================================================================");
  console.log("P0 REGRESSION SUITE: ACCOUNT DETAILS SESSION MISMATCH DEFECT");
  console.log("================================================================\n");

  const saClient = getClient();
  const workerClient = getClient();

  // 1. Authenticate QA Super Admin
  const { data: saAuth, error: saAuthErr } = await saClient.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (saAuthErr || !saAuth.user) {
    throw new Error(`Failed to log in as Super Admin: ${saAuthErr?.message}`);
  }
  const saUser = saAuth.user;
  console.log("Super Admin Authenticated:", saUser.email, `(${saUser.id})`);

  // 2. Authenticate QA Worker
  const { data: workerAuth, error: workerAuthErr } = await workerClient.auth.signInWithPassword({
    email: "qa.worker@sada.agency",
    password: "WorkerPassword123!",
  });
  if (workerAuthErr || !workerAuth.user) {
    throw new Error(`Failed to log in as QA Worker: ${workerAuthErr?.message}`);
  }
  const workerUser = workerAuth.user;
  console.log("Worker Authenticated:", workerUser.email, `(${workerUser.id})`);

  // 3. Locate Target Account BKR039
  const { data: accounts, error: accsErr } = await saClient.rpc("admin_list_accounts");
  if (accsErr || !accounts) {
    throw new Error(`Failed to list accounts: ${accsErr?.message}`);
  }
  const bkrAccount = accounts.find(
    (a: any) => a.display_name === "BKR039" || a.email === "boubakarhamedsgail@gmail.com"
  );
  if (!bkrAccount) {
    throw new Error("Target account BKR039 not found");
  }
  console.log("Target Account Found: BKR039", `(${bkrAccount.user_id}, role: ${bkrAccount.role})\n`);

  // Fetch BKR039's session
  const { data: bkrSessions } = await saClient.rpc("admin_list_user_sessions", {
    _user_id: bkrAccount.user_id,
    _status: null,
    _limit: 10,
    _offset: 0,
  });
  const bkrSession = bkrSessions?.[0];
  const bkrSessionId = bkrSession?.session_id || "sess_ba992ed2b12144138e7af28ef2f8ab51";
  console.log("Target Account Session Reference:", bkrSessionId, "\n");

  // -------------------------------------------------------------------------
  // VECTOR 1: Super Admin opens target account drawer successfully
  // -------------------------------------------------------------------------
  try {
    const secCtx = await resolveAuthoritativeSecurityContext(saClient, saUser.id, { forceFresh: true });
    const isTargetCorrect = bkrAccount.user_id === "560fd7c4-c38b-4562-8f9d-95729dfb2bab";
    if (secCtx.role === "super_admin" && isTargetCorrect) {
      results.push({
        vector: 1,
        description: "Super Admin resolves authoritative context and inspects target account BKR039",
        passed: true,
        details: `Actor role ${secCtx.role} verified, target account ${bkrAccount.display_name} loaded cleanly.`,
      });
    } else {
      results.push({
        vector: 1,
        description: "Super Admin resolves authoritative context and inspects target account BKR039",
        passed: false,
        details: `Unexpected context or target mismatch: role=${secCtx.role}`,
      });
    }
  } catch (err: any) {
    results.push({
      vector: 1,
      description: "Super Admin resolves authoritative context and inspects target account BKR039",
      passed: false,
      details: err.message,
    });
  }

  // -------------------------------------------------------------------------
  // VECTOR 2: Super Admin can save authorized target profile change
  // -------------------------------------------------------------------------
  try {
    const testBio = `Verified QA profile update at ${new Date().toISOString()}`;
    await updateAccount(
      {
        userId: bkrAccount.user_id,
        displayName: bkrAccount.display_name,
        role: bkrAccount.role,
        bio: testBio,
        position: bkrAccount.team_position || "Developer",
        division: bkrAccount.division || "Development",
        status: bkrAccount.status || "active",
      },
      saClient
    );
    results.push({
      vector: 2,
      description: "Super Admin can save authorized target profile change without session reference mismatch",
      passed: true,
      details: "Profile update succeeded cleanly. Zero session tampering exceptions raised.",
    });
  } catch (err: any) {
    results.push({
      vector: 2,
      description: "Super Admin can save authorized target profile change without session reference mismatch",
      passed: false,
      details: `Failed to update target account: ${err.message}`,
    });
  }

  // -------------------------------------------------------------------------
  // VECTOR 3: Super Admin can inspect target sessions without treating target session as actor session
  // -------------------------------------------------------------------------
  try {
    const { data: listedSessions, error: listErr } = await saClient.rpc("admin_list_user_sessions", {
      _user_id: bkrAccount.user_id,
      _status: null,
      _limit: 10,
      _offset: 0,
    });
    if (listErr) throw listErr;
    const targetSessionCount = listedSessions?.length ?? 0;
    
    // Check that Super Admin's session is distinct from target sessions
    const { data: saSessions } = await saClient.rpc("admin_list_user_sessions", {
      _user_id: saUser.id,
      _status: "active",
      _limit: 10,
      _offset: 0,
    });
    const saSessionId = saSessions?.[0]?.session_id;
    const areDistinct = !listedSessions.some((s: any) => s.session_id === saSessionId);

    results.push({
      vector: 3,
      description: "Super Admin inspects target sessions; actor session remains strictly isolated",
      passed: targetSessionCount > 0 && areDistinct,
      details: `Target has ${targetSessionCount} sessions. Actor session ${saSessionId} is isolated: ${areDistinct}`,
    });
  } catch (err: any) {
    results.push({
      vector: 3,
      description: "Super Admin inspects target sessions; actor session remains strictly isolated",
      passed: false,
      details: err.message,
    });
  }

  // -------------------------------------------------------------------------
  // VECTOR 4: Unauthorized user (worker) cannot mutate target account
  // -------------------------------------------------------------------------
  try {
    await updateAccount(
      {
        userId: bkrAccount.user_id,
        displayName: "Hacked by Worker",
        role: "admin",
      },
      workerClient
    );
    results.push({
      vector: 4,
      description: "Unauthorized user (worker) cannot mutate target account",
      passed: false,
      details: "CRITICAL FAILURE: Worker was able to update target account!",
    });
  } catch (err: any) {
    const isBlocked =
      err instanceof SecurityAuthorizationError ||
      err.message.includes("permission") ||
      err.message.includes("Privilege") ||
      err.message.includes("Unauthorized") ||
      err.message.includes("FORBIDDEN") ||
      err.message.includes("Access denied");

    results.push({
      vector: 4,
      description: "Unauthorized user (worker) cannot mutate target account",
      passed: isBlocked,
      details: `Worker mutation properly blocked: ${err.message}`,
    });
  }

  // -------------------------------------------------------------------------
  // VECTOR 5: Forged session reference belonging to another user passed explicitly is strictly rejected with SESSION_USER_MISMATCH
  // -------------------------------------------------------------------------
  try {
    await assertAuthorizedMutation(saClient, "accounts", "accounts.manage", {
      sessionId: bkrSessionId, // Explicitly forged target session
      resourceType: "user_account",
      resource: { user_id: bkrAccount.user_id },
      resourceAction: "write",
    });
    results.push({
      vector: 5,
      description: "Forged foreign session passed explicitly is strictly rejected with SESSION_USER_MISMATCH",
      passed: false,
      details: "CRITICAL FAILURE: Forged explicit foreign session was accepted!",
    });
  } catch (err: any) {
    const isExpectedMismatch =
      err instanceof SecurityAuthorizationError &&
      err.message.includes("Session reference does not match authenticated user") &&
      err.code === "PRIVILEGE_ESCALATION_BLOCKED";

    results.push({
      vector: 5,
      description: "Forged foreign session passed explicitly is strictly rejected with SESSION_USER_MISMATCH",
      passed: isExpectedMismatch,
      details: `Tampering strictly blocked: "${err.message}" (code: ${err.code})`,
    });
  }

  // -------------------------------------------------------------------------
  // VECTOR 6: Actor's own invalid or revoked session is strictly rejected (SESSION_REVOKED)
  // -------------------------------------------------------------------------
  try {
    // Register a temporary session for SA then revoke it
    const tempSid = "sess_revoked_test_" + Date.now();
    const { error: regErr } = await (saClient as any).rpc("register_user_session", {
      _session_id: tempSid,
      _user_agent: "QA Revocation Test",
      _device_type: "desktop",
    });
    if (regErr) throw regErr;

    // Revoke it in DB via admin_revoke_session RPC
    const { data: revData, error: revErr } = await (saClient as any).rpc("admin_revoke_session", {
      _session_id: tempSid,
      _reason: "Automated regression test",
    });
    if (revErr) throw revErr;

    // Now test resolveAuthoritativeSecurityContext with this revoked session
    await resolveAuthoritativeSecurityContext(saClient, saUser.id, {
      forceFresh: true,
      sessionId: tempSid,
    });

    results.push({
      vector: 6,
      description: "Actor's own revoked session is strictly rejected (SESSION_REVOKED)",
      passed: false,
      details: "CRITICAL FAILURE: Revoked session was accepted as valid!",
    });
  } catch (err: any) {
    const isRevoked =
      err instanceof SecurityAuthorizationError &&
      (err.code === "SESSION_REVOKED" || err.message.includes("Session Revoked"));

    results.push({
      vector: 6,
      description: "Actor's own revoked session is strictly rejected (SESSION_REVOKED)",
      passed: isRevoked,
      details: `Revoked session properly rejected: "${err.message}" (code: ${err.code})`,
    });
  }

  // -------------------------------------------------------------------------
  // VECTOR 7: Role changes, suspension, and permissions remain correctly protected
  // -------------------------------------------------------------------------
  try {
    // Verify SA cannot demote themselves (self-lockout protection)
    let selfDemoteBlocked = false;
    try {
      await updateAccount(
        {
          userId: saUser.id,
          role: "worker",
        },
        saClient
      );
    } catch (selfErr: any) {
      selfDemoteBlocked =
        selfErr.message.includes("demote own account") ||
        selfErr.message.includes("self-lockout");
    }

    // Verify worker cannot promote themselves
    let workerEscalateBlocked = false;
    try {
      await updateAccount(
        {
          userId: workerUser.id,
          role: "super_admin",
        },
        workerClient
      );
    } catch (escErr: any) {
      workerEscalateBlocked = true;
    }

    const passed = selfDemoteBlocked && workerEscalateBlocked;
    results.push({
      vector: 7,
      description: "Role changes, self-lockout defense, and privilege hierarchy remain protected",
      passed,
      details: `Self-demotion blocked: ${selfDemoteBlocked}, Worker escalation blocked: ${workerEscalateBlocked}`,
    });
  } catch (err: any) {
    results.push({
      vector: 7,
      description: "Role changes, self-lockout defense, and privilege hierarchy remain protected",
      passed: false,
      details: err.message,
    });
  }

  // -------------------------------------------------------------------------
  // VECTOR 8: Session registration is hardened against cross-user theft
  // -------------------------------------------------------------------------
  try {
    // While authenticated as Worker, attempt to register BKR039's session ID
    const { data: hijackAttempt, error: hijackErr } = await (workerClient as any).rpc(
      "register_user_session",
      {
        _session_id: bkrSessionId,
      }
    );

    // The hardened registration function MUST NOT assign BKR039's session to Worker.
    // It should generate a new distinct session ID for the caller!
    const isTheftPrevented =
      !hijackErr &&
      hijackAttempt &&
      hijackAttempt.success === true &&
      hijackAttempt.session_id !== bkrSessionId;

    results.push({
      vector: 8,
      description: "Database register_user_session strictly prevents cross-user session theft",
      passed: isTheftPrevented,
      details: `Hijack attempt gave new session ${hijackAttempt?.session_id} instead of foreign session ${bkrSessionId}. Theft prevented: ${isTheftPrevented}`,
    });
  } catch (err: any) {
    results.push({
      vector: 8,
      description: "Database register_user_session strictly prevents cross-user session theft",
      passed: false,
      details: err.message,
    });
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log("\n================================================================");
  console.log("TEST RESULTS SUMMARY");
  console.log("================================================================\n");

  let allPassed = true;
  for (const r of results) {
    const icon = r.passed ? "✅ [PASS]" : "❌ [FAIL]";
    console.log(`${icon} Vector ${r.vector}: ${r.description}`);
    console.log(`         Details: ${r.details}`);
    if (!r.passed) allPassed = false;
  }

  console.log("\n================================================================");
  if (allPassed) {
    console.log("ALL 8 VECTORS PASSED PERFECTLY!");
  } else {
    console.log("SOME VECTORS FAILED. SEE DETAILS ABOVE.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal test suite error:", err);
  process.exit(1);
});
