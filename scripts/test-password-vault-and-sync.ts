import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { resetAccountPassword, updateAccountEmail } from "../src/lib/account-service";

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

function assert(condition: boolean, title: string, details?: any) {
  if (!condition) {
    console.error(`❌ FAIL: ${title}`, details || "");
    throw new Error(`Assertion failed: ${title}`);
  }
  console.log(`✅ PASS: ${title}`, details ? `(${JSON.stringify(details)})` : "");
}

async function runTests() {
  console.log("===============================================================================");
  console.log("TEST: ACCOUNT CREDENTIALS VAULT, PASSWORD VISIBILITY & SINGLE SOURCE OF TRUTH");
  console.log("===============================================================================\n");

  // 1. Authenticate as Super Admin with known credentials
  const saClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("Step 1: Authenticating as Super Admin (boubakarhamedsgail@gmail.com)...");
  const { data: authData, error: authErr } = await saClient.auth.signInWithPassword({
    email: "boubakarhamedsgail@gmail.com",
    password: "Boubakar2026!",
  });

  assert(!authErr && Boolean(authData.user), "Super Admin Authentication with Boubakar2026!", {
    userId: authData.user?.id,
    email: authData.user?.email,
  });

  const authSaClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${authData.session?.access_token}`,
      },
    },
  });

  // 2. Query admin_list_accounts() and verify single source of truth (no duplicates!)
  console.log("\nStep 2: Testing admin_list_accounts() projection & deduplication...");
  const { data: accounts, error: listErr } = await authSaClient.rpc("admin_list_accounts");
  assert(!listErr && Array.isArray(accounts), "admin_list_accounts RPC succeeded", { count: accounts?.length });

  console.log("Accounts returned:");
  const userIds = new Set<string>();
  let targetAccount: any = null;

  accounts.forEach((acc: any) => {
    console.log(`- [${acc.role}] ${acc.display_name} <${acc.email}> (ID: ${acc.user_id}) | Password in vault: "${acc.current_password || '(none)'}"`);
    assert(!userIds.has(acc.user_id), `Zero account duplication: User ID ${acc.user_id} appears exactly once`);
    userIds.add(acc.user_id);
    if (acc.email === "boubakarhamedsgail@gmail.com") {
      targetAccount = acc;
    }
  });

  assert(Boolean(targetAccount), "Target account found in accounts list", { email: targetAccount?.email });
  assert(targetAccount.current_password === "Boubakar2026!", "Current password visible from vault", {
    current_password: targetAccount.current_password,
  });

  // 3. Test Super Admin setting a new password (e.g. NewSecretPass2026!)
  console.log("\nStep 3: Setting a new persistent password via resetAccountPassword...");
  const testNewPass = "NewSecretPass2026!";
  const resetRes = await resetAccountPassword(targetAccount.user_id, testNewPass, undefined, authSaClient);
  assert(resetRes.success === true, "resetAccountPassword returned success", resetRes);

  // 4. Test logging in with the new password from a completely isolated client (another device simulation)
  console.log("\nStep 4: Simulating login from another device using new password...");
  const deviceClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: newLoginData, error: newLoginErr } = await deviceClient.auth.signInWithPassword({
    email: "boubakarhamedsgail@gmail.com",
    password: testNewPass,
  });

  assert(!newLoginErr && Boolean(newLoginData.user), "Login from another device succeeded with new password!", {
    user: newLoginData.user?.id,
  });

  // 5. Verify that admin_list_accounts() immediately reflects the new password in the vault
  console.log("\nStep 5: Verifying vault updated in admin_list_accounts()...");
  const { data: reloadedAccounts } = await authSaClient.rpc("admin_list_accounts");
  const reloadedTarget = reloadedAccounts.find((a: any) => a.user_id === targetAccount.user_id);
  assert(reloadedTarget?.current_password === testNewPass, "Vault reflects the newly set password immediately", {
    vault_password: reloadedTarget?.current_password,
  });

  // 6. Reset password back to Boubakar2026! so the user's expected credentials remain unchanged
  console.log("\nStep 6: Resetting password back to canonical Boubakar2026!...");
  await resetAccountPassword(targetAccount.user_id, "Boubakar2026!", undefined, authSaClient);

  // 7. Verify login again with Boubakar2026!
  console.log("\nStep 7: Verifying login with canonical Boubakar2026!...");
  const { data: finalAuth, error: finalErr } = await deviceClient.auth.signInWithPassword({
    email: "boubakarhamedsgail@gmail.com",
    password: "Boubakar2026!",
  });
  assert(!finalErr && Boolean(finalAuth.user), "Canonical password Boubakar2026! confirmed active in Supabase Auth");

  console.log("\n===============================================================================");
  console.log("ALL PASSWORD PERSISTENCE, VAULT & SINGLE SOURCE OF TRUTH TESTS PASSED! (100%)");
  console.log("===============================================================================");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
