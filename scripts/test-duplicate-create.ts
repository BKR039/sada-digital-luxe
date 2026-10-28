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
  console.log("1. Sign in as super admin...");
  await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  const existingEmail = "demo.admin.test.1790942033375@sada.agency";
  const newPass = "BrandNewPassword12345!";

  console.log(`2. Calling createAccount with ALREADY EXISTING email: ${existingEmail}...`);
  try {
    const res = await createAccount({
      email: existingEmail,
      password: newPass,
      displayName: "Duplicate Demo Admin",
      role: "admin",
    }, client);
    console.log("createAccount result on duplicate:", res);

    console.log("3. Now trying to sign in with the new credentials...");
    const loginClient = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const loginRes = await loginClient.auth.signInWithPassword({
      email: existingEmail,
      password: newPass,
    });
    console.log("Login result with new password:", {
      user: loginRes.data.user?.id,
      error: loginRes.error?.message,
      code: (loginRes.error as any)?.code,
    });
  } catch (err) {
    console.error("createAccount error:", err);
  }
}

run().catch(console.error);
