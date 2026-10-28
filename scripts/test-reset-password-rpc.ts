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
  }
});

const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function run() {
  console.log("1. Sign in as super admin...");
  await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  const testEmail = "demo.admin.test.1790942033375@sada.agency";
  const newPass = "ResetPassword987!#";

  // Find user_id
  const { data: accounts } = await client.rpc("admin_list_accounts");
  const target = (accounts || []).find((a: any) => a.email === testEmail);
  if (!target) {
    console.log("Target not found!");
    return;
  }

  console.log(`2. Resetting password for ${testEmail} (id: ${target.user_id}) using admin_reset_account_password...`);
  const { data: resetData, error: resetErr } = await client.rpc("admin_reset_account_password", {
    _user_id: target.user_id,
    _new_password: newPass,
  });
  console.log("Reset RPC result:", resetData, resetErr);

  console.log("3. Trying to sign in with the new password...");
  const loginClient = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const loginRes = await loginClient.auth.signInWithPassword({
    email: testEmail,
    password: newPass,
  });
  console.log("Login with reset password:", {
    user: loginRes.data.user?.id,
    error: loginRes.error?.message,
    errorCode: (loginRes.error as any)?.code,
    fullError: loginRes.error
  });
}

run().catch(console.error);
