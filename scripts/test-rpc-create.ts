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
  await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  const testEmail = `test.rpc.create.${Date.now()}@sada.agency`;
  const testPass = "SecurePass123!@#";

  const { data, error } = await client.rpc("admin_create_account", {
    _email: testEmail,
    _password: testPass,
    _display_name: "RPC Test User",
    _role: "admin",
    _division: "Development",
    _position: "Test Position",
    _phone: "+21612345678",
    _create_team_member: true,
  });

  console.log("admin_create_account result:", { data, error });

  if (data?.user_id) {
    console.log("Now testing signInWithPassword with the RPC-created user...");
    const loginClient = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const loginRes = await loginClient.auth.signInWithPassword({
      email: testEmail,
      password: testPass,
    });
    console.log("Login result:", {
      user: loginRes.data.user?.id,
      error: loginRes.error?.message,
    });
  }
}

run().catch(console.error);
