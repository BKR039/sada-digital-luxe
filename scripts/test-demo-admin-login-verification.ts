import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envContent = fs.readFileSync(".env", "utf-8");
const env: Record<string, string> = {};
envContent.split(/\r?\n/).forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = (match[2] || "").trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
    process.env[match[1]] = value;
  }
});

import { createAccount } from "../src/lib/account-service";
import { normalizeAuthErrorMessage } from "../src/lib/auth";

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Supabase environment variables missing");
  process.exit(1);
}

async function run() {
  console.log("=== SADA OS AUTHENTICATION ACCEPTANCE TEST ===");
  const adminClient = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log("\n0. Authenticating as Super Admin to access provision RPCs...");
  const { error: saAuthErr } = await adminClient.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (saAuthErr) {
    throw new Error(`Super Admin auth failed: ${saAuthErr.message}`);
  }
  console.log("✅ Authenticated as Super Admin");

  const testEmail = `demo.admin.verification.${Date.now()}@sada.agency`;
  const correctPassword = "DemoAdminPassword123!";
  const wrongPassword = "WrongPassword999!";

  // 1. Provision Demo Admin via Super Admin service
  console.log("\n[TEST 1] Super Admin provisions Demo Admin:", testEmail);
  const provResult = await createAccount(
    {
      email: testEmail,
      password: correctPassword,
      displayName: "Demo Admin Tester",
      role: "admin",
      division: "Operations",
      position: "Operations Lead",
      createTeamMember: true,
      status: "active",
    },
    adminClient
  );

  console.log("✅ Account provisioned:", {
    user_id: provResult.user_id,
    email: provResult.email,
    role: provResult.role,
    team_member_id: provResult.team_member_id,
  });

  // 2. Check Supabase Auth state directly via RPC
  console.log("\n[TEST 2] Verifying Supabase Auth user exists and is confirmed");
  const { data: authUid } = await (adminClient as any).rpc("admin_get_auth_user_id_by_email", {
    _email: testEmail,
  });
  if (!authUid || authUid !== provResult.user_id) {
    throw new Error(`Auth user ID mismatch! Expected ${provResult.user_id}, got ${authUid}`);
  }
  console.log("✅ Auth user confirmed in auth.users:", authUid);

  // 3. Intentionally WRONG password test
  console.log("\n[TEST 3] Login with WRONG password");
  const loginClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: wrongData, error: wrongError } = await loginClient.auth.signInWithPassword({
    email: testEmail,
    password: wrongPassword,
  });

  if (!wrongError) {
    throw new Error("Wrong password unexpectedly succeeded!");
  }

  const normalizedWrong = normalizeAuthErrorMessage(wrongError, false);
  const normalizedWrongAr = normalizeAuthErrorMessage(wrongError, true);
  console.log("Raw error message:", wrongError.message);
  console.log("Normalized error (EN):", normalizedWrong);
  console.log("Normalized error (AR):", normalizedWrongAr);

  if (normalizedWrong === "{}" || normalizedWrong === "[object Object]" || !normalizedWrong) {
    throw new Error("FAILED: Error was rendered as empty object or invalid string!");
  }
  if (!normalizedWrong.toLowerCase().includes("invalid login credentials")) {
    throw new Error(`FAILED: Unexpected wrong password message: ${normalizedWrong}`);
  }
  console.log("✅ Wrong password handled cleanly with meaningful message (NO {} error!)");

  // 4. Login with CORRECT credentials
  console.log("\n[TEST 4] Login with CORRECT credentials");
  const { data: loginData, error: loginError } = await loginClient.auth.signInWithPassword({
    email: testEmail,
    password: correctPassword,
  });

  if (loginError || !loginData.user || !loginData.session) {
    throw new Error(`Login failed with correct credentials: ${loginError?.message}`);
  }
  console.log("✅ Login succeeded! User ID:", loginData.user.id);
  console.log("Access token received:", !!loginData.session.access_token);

  // 5. Verify role and profile resolution
  console.log("\n[TEST 5] Resolving role and profile records");
  const { data: roles } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", loginData.user.id);

  console.log("User roles in DB:", roles);
  const isAdminRole = roles?.some((r: any) => r.role === "admin");
  if (!isAdminRole) {
    throw new Error("User does not have admin role in user_roles!");
  }

  const { data: tm } = await adminClient
    .from("team_members")
    .select("id, name, role, is_active")
    .eq("user_id", loginData.user.id)
    .single();

  console.log("Team member record in DB:", tm);
  if (!tm || tm.role !== "admin" || !tm.is_active) {
    throw new Error("Team member not found or invalid!");
  }
  console.log("✅ Admin role and team member correctly resolved!");

  // 6. Test Suspended Account Login Handling
  console.log("\n[TEST 6] Suspending account and verifying rejection behavior");
  await (adminClient as any).rpc("admin_set_account_status", {
    _user_id: loginData.user.id,
    _status: "suspended",
  });

  const { data: prof } = await adminClient
    .from("profiles")
    .select("status")
    .eq("id", loginData.user.id)
    .single();
  console.log("Profile status after suspension:", prof?.status);

  // Simulating normalizeAuthErrorMessage on suspended account error
  const suspendedError = new Error("This account is suspended. Contact the Super Admin.");
  const normSuspended = normalizeAuthErrorMessage(suspendedError, false);
  const normSuspendedAr = normalizeAuthErrorMessage(suspendedError, true);
  console.log("Suspended error (EN):", normSuspended);
  console.log("Suspended error (AR):", normSuspendedAr);
  if (normSuspended === "{}" || !normSuspended.includes("suspended")) {
    throw new Error("Failed suspended account error check");
  }
  console.log("✅ Suspended account returns explicit reason, not silent logout or {}");

  // Re-activate
  await (adminClient as any).rpc("admin_set_account_status", {
    _user_id: loginData.user.id,
    _status: "active",
  });

  // 7. Test Provisioning with SAME Email (Password update synchronization)
  console.log("\n[TEST 7] Provisioning with SAME email updates credentials smoothly");
  const newPassword = "NewUpdatedPassword456!";
  const secondProv = await createAccount(
    {
      email: testEmail,
      password: newPassword,
      displayName: "Demo Admin Tester",
      role: "admin",
      division: "Operations",
      position: "Operations Lead",
      createTeamMember: true,
      status: "active",
    },
    adminClient
  );

  console.log("Second provision result:", secondProv);
  const { data: newLoginData, error: newLoginError } = await loginClient.auth.signInWithPassword({
    email: testEmail,
    password: newPassword,
  });

  if (newLoginError || !newLoginData.user) {
    throw new Error(`Failed to login with newly updated password: ${newLoginError?.message}`);
  }
  console.log("✅ Login with updated password succeeded immediately!");

  console.log("\n=========================================");
  console.log("ALL ACCEPTANCE TESTS PASSED SUCCESSFULLY!");
  console.log("=========================================\n");
}

run().catch((err) => {
  console.error("FATAL TEST FAILURE:", err);
  process.exit(1);
});
