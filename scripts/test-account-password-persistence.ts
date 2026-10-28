import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { createAccount, resetAccountPassword, deleteAccount } from "../src/lib/account-service";

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

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY!;

function assert(condition: boolean, testName: string, detail?: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${testName}${detail ? ` - ${detail}` : ""}`);
    throw new Error(`Assertion failed: ${testName}`);
  }
  console.log(`✓ PASS: ${testName}${detail ? ` (${detail})` : ""}`);
}

async function runTestSuite() {
  console.log("=======================================================================");
  console.log("SADA OS — ACCOUNT PASSWORD PERSISTENCE & MANAGEMENT E2E TEST SUITE");
  console.log("=======================================================================\n");

  // 1. Authenticate as Super Admin
  const saClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("Authenticating as Super Admin (qa.superadmin@sada.agency)...");
  const { data: saAuth, error: saAuthErr } = await saClient.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  assert(!saAuthErr && Boolean(saAuth.user), "Super Admin Authentication", `User ID: ${saAuth.user?.id}`);

  // Create isolated Super Admin client with JWT bearer header
  const authSaClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${saAuth.session?.access_token}`,
      },
    },
  });

  // Dedicated test account setup
  const timestamp = Date.now();
  const testAccountEmail = `test.persistent.user.${timestamp}@sada.agency`;
  const initialPassword = `InitialTempPass${timestamp}!`;
  let targetUserId = "";

  try {
    console.log(`\n[PROVISIONING] Creating dedicated test account: ${testAccountEmail}...`);
    const provRes = await createAccount(
      {
        email: testAccountEmail,
        password: initialPassword,
        displayName: "Persistent Test Account",
        role: "worker",
        division: "Development",
        position: "Security Tester",
        createTeamMember: true,
        status: "active",
      },
      authSaClient
    );
    targetUserId = provRes.user_id;
    assert(Boolean(targetUserId), "Dedicated test account provisioned", `ID: ${targetUserId}`);

    // =========================================================================
    // SCENARIO A: Admin sets a specific persistent password
    // =========================================================================
    console.log("\n-----------------------------------------------------------------------");
    console.log("SCENARIO A — Super Admin sets a specific password");
    console.log("-----------------------------------------------------------------------");

    const adminChosenPassword = `AdminSetCustomPersistentPass${timestamp}!#`;
    console.log(`Setting specific password for account ${testAccountEmail}...`);
    const resetResult = await resetAccountPassword(targetUserId, adminChosenPassword, undefined, authSaClient);
    assert(resetResult.success === true, "Scenario A.1: Password update succeeded on server");

    // Client authenticates using the new admin-set password
    const testUserClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: loginA, error: loginAErr } = await testUserClient.auth.signInWithPassword({
      email: testAccountEmail,
      password: adminChosenPassword,
    });
    assert(
      !loginAErr && loginA.user?.id === targetUserId,
      "Scenario A.2: Target user successfully authenticates with the admin-set password",
      `User ID: ${loginA.user?.id}`
    );

    // =========================================================================
    // SCENARIO B: Password persists across repeated logins and fresh browser sessions
    // =========================================================================
    console.log("\n-----------------------------------------------------------------------");
    console.log("SCENARIO B — Password persists across repeated logins & fresh sessions");
    console.log("-----------------------------------------------------------------------");

    // Login 1: Already performed in Scenario A. Now sign out.
    await testUserClient.auth.signOut();

    // Login 2: Log in again using exact same password
    const { data: loginB1, error: loginB1Err } = await testUserClient.auth.signInWithPassword({
      email: testAccountEmail,
      password: adminChosenPassword,
    });
    assert(!loginB1Err && Boolean(loginB1.session), "Scenario B.1: Second login succeeds with same password");
    await testUserClient.auth.signOut();

    // Login 3: Simulate fresh browser session (completely fresh client instance without memory cache)
    const freshBrowserClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: loginB2, error: loginB2Err } = await freshBrowserClient.auth.signInWithPassword({
      email: testAccountEmail,
      password: adminChosenPassword,
    });
    assert(
      !loginB2Err && Boolean(loginB2.session),
      "Scenario B.2: Third login succeeds in a simulated fresh browser session"
    );

    // Login 4: Simulate page refresh (another independent request)
    const refreshedClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: loginB3, error: loginB3Err } = await refreshedClient.auth.signInWithPassword({
      email: testAccountEmail,
      password: adminChosenPassword,
    });
    assert(!loginB3Err && Boolean(loginB3.session), "Scenario B.3: Repeated login works without invalidation");

    // =========================================================================
    // SCENARIO C: No automatic password rotation or replacement upon login
    // =========================================================================
    console.log("\n-----------------------------------------------------------------------");
    console.log("SCENARIO C — No automatic password rotation or replacement");
    console.log("-----------------------------------------------------------------------");

    // Check account status and role remains untouched after multiple logins
    const { data: accountsList } = await authSaClient.rpc("admin_list_accounts");
    const accountState = (accountsList || []).find((a: any) => a.user_id === targetUserId);
    assert(Boolean(accountState), "Scenario C.1: Account retrieved from authoritative accounts list");
    assert(accountState.role === "worker", "Scenario C.2: Account role remains unchanged ('worker')");
    assert(accountState.status === "active", "Scenario C.3: Account status remains unchanged ('active')");

    // Authenticate once more to verify no background handler altered the credentials
    const { data: loginC, error: loginCErr } = await freshBrowserClient.auth.signInWithPassword({
      email: testAccountEmail,
      password: adminChosenPassword,
    });
    assert(!loginCErr && Boolean(loginC.session), "Scenario C.4: Same password remains valid after state inspection");

    // =========================================================================
    // SCENARIO D: Explicit password update
    // =========================================================================
    console.log("\n-----------------------------------------------------------------------");
    console.log("SCENARIO D — Explicit password update by Super Admin");
    console.log("-----------------------------------------------------------------------");

    const updatedAdminPassword = `UpdatedSecondPersistentPass${timestamp}!@`;
    console.log("Super Admin updating password to second persistent password...");
    await resetAccountPassword(targetUserId, updatedAdminPassword, undefined, authSaClient);

    // Old password must fail
    const { error: oldPassErr } = await freshBrowserClient.auth.signInWithPassword({
      email: testAccountEmail,
      password: adminChosenPassword,
    });
    assert(
      Boolean(oldPassErr),
      "Scenario D.1: Old password is no longer accepted after explicit update",
      oldPassErr?.message
    );

    // New password authenticates successfully
    const { data: loginD1, error: loginD1Err } = await freshBrowserClient.auth.signInWithPassword({
      email: testAccountEmail,
      password: updatedAdminPassword,
    });
    assert(!loginD1Err && Boolean(loginD1.session), "Scenario D.2: New password authenticates successfully");

    // New password persists across subsequent logins
    const { data: loginD2, error: loginD2Err } = await freshBrowserClient.auth.signInWithPassword({
      email: testAccountEmail,
      password: updatedAdminPassword,
    });
    assert(!loginD2Err && Boolean(loginD2.session), "Scenario D.3: New password persists across subsequent logins");

    // =========================================================================
    // SCENARIO E: Security, Authorization & Regression
    // =========================================================================
    console.log("\n-----------------------------------------------------------------------");
    console.log("SCENARIO E — Security, Authorization, Privacy & Regression");
    console.log("-----------------------------------------------------------------------");

    // E.1: Non-Super Admin cannot change passwords
    console.log("Attempting password reset as non-Super Admin (target user)...");
    const nonSaClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${loginD1.session?.access_token}` } },
    });
    const { error: unauthorizedErr } = await nonSaClient.rpc("admin_reset_account_password", {
      _user_id: saAuth.user?.id,
      _new_password: "HackerPassword123!",
    });
    assert(
      Boolean(unauthorizedErr) && (unauthorizedErr?.message || "").includes("Only Super Admin"),
      "Scenario E.1: Non-Super Admin is strictly rejected by RPC authorization",
      unauthorizedErr?.message
    );

    // E.2: Minimum password length validation
    console.log("Attempting password reset with password < 8 characters...");
    let shortPassRejected = false;
    try {
      await resetAccountPassword(targetUserId, "short", undefined, authSaClient);
    } catch (e: any) {
      shortPassRejected = true;
    }
    assert(shortPassRejected, "Scenario E.2: Passwords under 8 characters are strictly rejected");

    // E.3: Audit Log contains NO plaintext password or hash
    console.log("Checking audit log immutability and privacy...");
    const { data: auditLogs } = await authSaClient
      .from("account_audit_logs")
      .select("metadata, action, target_email")
      .eq("target_user_id", targetUserId)
      .eq("action", "password_changed");

    assert(Boolean(auditLogs && auditLogs.length >= 2), "Scenario E.3: Audit records created for password changes");
    const auditString = JSON.stringify(auditLogs || []);
    assert(
      !auditString.includes(adminChosenPassword) && !auditString.includes(updatedAdminPassword),
      "Scenario E.4: Zero plaintext passwords leaked in audit metadata"
    );
    assert(
      !auditString.includes("$2a$") && !auditString.includes("$2b$"),
      "Scenario E.5: Zero password hashes leaked in audit metadata"
    );

    // E.4: No service role key in client or browser environment
    assert(!anonKey.includes("service_role"), "Scenario E.6: Service role key is not used as public anon key");

    console.log("\nAll Scenarios A through E completed successfully!");
  } finally {
    // Clean up dedicated test account
    if (targetUserId) {
      console.log(`\n[CLEANUP] Deleting dedicated test account: ${targetUserId}...`);
      try {
        await deleteAccount(targetUserId, undefined, authSaClient);
        console.log(`✓ Cleaned up test account: ${testAccountEmail}`);
      } catch (cleanErr: any) {
        console.warn("Cleanup notice:", cleanErr?.message);
      }
    }
  }
}

runTestSuite().catch((err) => {
  console.error("Test suite execution failed:", err);
  process.exit(1);
});
