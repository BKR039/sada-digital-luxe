import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { createAccount } from "../src/lib/account-service";

const envPath = path.resolve(process.cwd(), ".env");
const env: Record<string, string> = {};
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
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
}

const supabaseUrl = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;

const saClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const testUserClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function assert(condition: boolean, title: string, details?: any) {
  if (!condition) {
    console.error(`❌ FAIL: ${title}`, details || "");
    process.exit(1);
  }
  console.log(`✅ PASS: ${title}`, details || "");
}

async function runTest() {
  console.log("===============================================================================");
  console.log("TEST: PERMANENT ACCOUNT DELETION WITH HISTORICAL SESSIONS");
  console.log("===============================================================================\n");

  // 1. Authenticate as Super Admin
  const { data: saAuth, error: saAuthErr } = await saClient.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  assert(!saAuthErr && !!saAuth?.user, "Super Admin Authentication", saAuth?.user?.email);

  const authSaClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${saAuth.session?.access_token}`,
      },
    },
  });

  // Ensure active session for Super Admin
  await (authSaClient as any).rpc("register_user_session", {
    _session_id: `sa_session_${Date.now()}`,
    _device_type: "desktop",
    _auth_method: "password",
  });
  const timestamp = Date.now();
  const testEmail = `test.del.session.${timestamp}@sada.agency`;
  const testPassword = "SessionTestPassword123!";

  console.log(`Creating test account: ${testEmail}...`);
  const created = await createAccount(
    {
      email: testEmail,
      password: testPassword,
      displayName: "Session Deletion Tester",
      role: "worker",
      division: "Development",
      position: "QA Tester",
      createTeamMember: true,
      status: "active",
    },
    authSaClient
  );

  const testUserId = created.user_id;
  assert(!!testUserId, "Test account created successfully", `User ID: ${testUserId}`);

  // 3. Log in as the test account to register live sessions in public.user_sessions
  console.log("Logging in as test user to generate active sessions...");
  const { data: userAuth, error: userAuthErr } = await testUserClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });
  assert(!userAuthErr && !!userAuth?.user, "Test user logged in successfully");

  // Call register_user_session RPC to simulate real frontend session registration
  const userAuthedClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${userAuth.session?.access_token}`,
      },
    },
  });

  const sessionId = `test_sess_${timestamp}`;
  const { data: regData, error: regErr } = await (userAuthedClient as any).rpc("register_user_session", {
    _session_id: sessionId,
    _user_agent: "TestAgent/1.0 (Windows NT 10.0; Win64; x64)",
    _ip_address: "127.0.0.1",
    _device_type: "desktop",
    _browser_name: "Chrome",
    _os_name: "Windows",
  });
  assert(!regErr, "register_user_session RPC executed", regData);

  // 4. Verify the session exists in public.user_sessions
  const { data: sessionRows, error: sessErr } = await (authSaClient as any)
    .from("user_sessions")
    .select("id, session_id, user_id, status")
    .eq("user_id", testUserId);

  assert(!sessErr && sessionRows?.length > 0, "Historical sessions exist in public.user_sessions", {
    count: sessionRows?.length,
    sessions: sessionRows,
  });

  // 5. Test immutability defense: non-super-admin direct deletion MUST FAIL
  console.log("Testing that non-super-admin direct deletion is STILL rejected by trigger...");
  const { error: blockedDeleteErr } = await (userAuthedClient as any)
    .from("user_sessions")
    .delete()
    .eq("session_id", sessionId);

  assert(
    !!blockedDeleteErr && blockedDeleteErr.message.includes("Historical session records are immutable and cannot be deleted"),
    "Non-super-admin direct DELETE correctly rejected by trigger",
    blockedDeleteErr?.message
  );

  // 6. Test Super Admin permanently deletes the account WITH sessions
  console.log("Super Admin permanently deleting the account with historical sessions...");
  const { data: delResult, error: delError } = await (authSaClient as any).rpc("admin_delete_account", {
    _user_id: testUserId,
  });

  assert(!delError, "admin_delete_account succeeded without error", delResult);
  assert(delResult?.success === true, "Deletion result marked success: true");

  // 7. Verify the user is completely removed from auth.users, profiles, and user_sessions
  const { data: remainingSessions } = await (authSaClient as any)
    .from("user_sessions")
    .select("id")
    .eq("user_id", testUserId);

  assert(!remainingSessions || remainingSessions.length === 0, "User sessions cleanly removed");

  const { data: remainingProfiles } = await (authSaClient as any)
    .from("profiles")
    .select("id")
    .eq("id", testUserId);

  assert(!remainingProfiles || remainingProfiles.length === 0, "Profile cleanly removed");

  console.log("\n===============================================================================");
  console.log("🎉 ALL ASSERTIONS PASSED! Account with sessions deleted safely and permanently.");
  console.log("===============================================================================\n");
}

runTest().catch((err) => {
  console.error("Test failed with unexpected error:", err);
  process.exit(1);
});
