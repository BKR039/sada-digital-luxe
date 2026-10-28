import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { resolveAuthoritativeSecurityContext, assertAuthorizedMutation, SecurityAuthorizationError } from "../src/lib/security-isolation-service";

const envContent = fs.readFileSync(".env", "utf-8");
const env: Record<string, string> = {};
envContent.split(/\r?\n/).forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = (match[2] || "").trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.substring(1, value.length - 1);
    env[match[1]] = value;
  }
});

const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function run() {
  console.log("=== REPRODUCING P0 DEFECT WITH EXACT PARAMETERS ===");

  // 1. Authenticate as QA Super Admin
  const { data: authData, error: loginErr } = await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (loginErr || !authData.user) {
    console.error("Login failed:", loginErr);
    return;
  }
  const saUser = authData.user;
  console.log("Super Admin Actor ID:", saUser.id, saUser.email);

  // Target account BKR039
  const { data: accounts } = await client.rpc("admin_list_accounts");
  const bkrAccount = accounts.find((a: any) => a.display_name === "BKR039" || a.email === "boubakarhamedsgail@gmail.com");
  console.log("Target User ID (BKR039):", bkrAccount?.user_id, "Target Role:", bkrAccount?.role);

  // Get BKR039's session reference
  const { data: bkrSessions } = await client.rpc("admin_list_user_sessions", {
    _user_id: bkrAccount.user_id,
    _status: null,
    _limit: 10,
    _offset: 0,
  });
  const bkrSessionId = bkrSessions?.[0]?.session_id;
  console.log("Target BKR039 Session ID:", bkrSessionId);

  // Test 1: Direct RPC verify_session_and_account with target session ID while authenticated as SA
  console.log("\n--- Test 1: Direct RPC verify_session_and_account with target session ID ---");
  const { data: rpcRes, error: rpcErr } = await (client as any).rpc("verify_session_and_account", {
    _session_id: bkrSessionId,
  });
  console.log("RPC Result:", rpcRes, "RPC Error:", rpcErr);

  // Test 2: resolveAuthoritativeSecurityContext for SA with BKR039 session ID
  console.log("\n--- Test 2: resolveAuthoritativeSecurityContext for SA with BKR039 session ID ---");
  try {
    const secCtx = await resolveAuthoritativeSecurityContext(client, saUser.id, {
      forceFresh: true,
      sessionId: bkrSessionId,
    });
    console.log("resolveAuthoritativeSecurityContext succeeded unexpectedly:", secCtx.role);
  } catch (err: any) {
    console.log("resolveAuthoritativeSecurityContext caught error:", err.message);
    console.log("Error code:", err.code);
  }

  // Test 3: assertAuthorizedMutation with BKR039 session ID
  console.log("\n--- Test 3: assertAuthorizedMutation with BKR039 session ID ---");
  try {
    await assertAuthorizedMutation(client, "accounts", "accounts.manage", {
      sessionId: bkrSessionId,
      resourceType: "user_account",
      resource: { user_id: bkrAccount.user_id },
      resourceAction: "write",
    });
    console.log("assertAuthorizedMutation succeeded unexpectedly");
  } catch (err: any) {
    console.log("assertAuthorizedMutation caught error:", err.message);
    console.log("Error code:", err.code);
  }
}

run().catch(console.error);
