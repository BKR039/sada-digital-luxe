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

const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function run() {
  console.log("1. Signing in as Super Admin...");
  await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  // TEST 1: Create a brand new Demo Admin
  const newEmail = `demo.admin.fresh.${Date.now()}@sada.agency`;
  const newPass = "FreshDemoPass2026!#";
  console.log(`\n2. Creating brand new account: ${newEmail}...`);
  const provNew = await createAccount({
    email: newEmail,
    password: newPass,
    displayName: "Fresh Demo Admin",
    role: "admin",
    division: "Development",
    position: "Operations Admin",
    status: "active",
  }, client);
  console.log("Provision result for new user:", provNew);

  // Test login with brand new account
  const loginClient1 = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const loginRes1 = await loginClient1.auth.signInWithPassword({
    email: newEmail,
    password: newPass,
  });
  console.log("Login result for new account:", {
    userId: loginRes1.data.user?.id,
    session: Boolean(loginRes1.data.session),
    error: loginRes1.error?.message,
  });

  if (loginRes1.error) {
    throw new Error(`Login failed for new user: ${loginRes1.error.message}`);
  }

  // TEST 2: Re-provision existing account with a NEW password (simulate user recreation)
  const updatedPass = "UpdatedDemoPass999!#";
  console.log(`\n3. Re-provisioning existing account: ${newEmail} with new password...`);
  const provExisting = await createAccount({
    email: newEmail,
    password: updatedPass,
    displayName: "Fresh Demo Admin Updated",
    role: "admin",
    division: "Executive",
    position: "Managing Director",
    status: "active",
  }, client);
  console.log("Provision result for existing user:", provExisting);

  // Test login with updated password
  const loginClient2 = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const loginRes2 = await loginClient2.auth.signInWithPassword({
    email: newEmail,
    password: updatedPass,
  });
  console.log("Login result with updated password:", {
    userId: loginRes2.data.user?.id,
    session: Boolean(loginRes2.data.session),
    error: loginRes2.error?.message,
  });

  if (loginRes2.error) {
    throw new Error(`Login failed for existing user updated password: ${loginRes2.error.message}`);
  }

  console.log("\n✅ BOTH NEW AND EXISTING ACCOUNT PROVISIONING & LOGINS PASSED PERFECTLY!");
}

run().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
