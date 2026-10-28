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

async function test() {
  console.log("1. Signing in as Super Admin...");
  const { data: saLogin, error: saErr } = await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (saErr) {
    console.error("Super Admin Login error:", saErr);
    return;
  }
  console.log("Super Admin Login OK:", saLogin.user.id);

  console.log("2. Fetching accounts via admin_list_accounts...");
  const { data: accounts, error: accErr } = await client.rpc("admin_list_accounts");
  if (accErr) {
    console.error("admin_list_accounts error:", accErr);
    return;
  }
  console.log("\n--- TESTING WRONG PASSWORD ---");
  const { error: wrongErr } = await client.auth.signInWithPassword({
    email: "test@sada.agency",
    password: "wrong",
  });
  console.log("Wrong Err object:", wrongErr);
  console.log("Wrong Err type:", typeof wrongErr);
  console.log("Wrong Err message:", wrongErr?.message);
  console.log("Wrong Err stringify:", JSON.stringify(wrongErr));
  console.log("Wrong Err toString:", String(wrongErr));
  console.log("Wrong Err constructor:", wrongErr?.constructor?.name);
  console.log("Wrong Err getOwnPropertyNames:", Object.getOwnPropertyNames(wrongErr || {}));

  // Now let's test creating a Demo Admin exactly like CreateAccountModal does!
  const testEmail = `demo.admin.test.${Date.now()}@sada.agency`;
  const testPassword = "DemoPassword123!@#";
  console.log(`\n3. Testing creation of Demo Admin: ${testEmail}...`);

  // Step 3a: Isolated client sign up
  const authApiClient = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authErr } = await authApiClient.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: {
      data: {
        display_name: "Demo Admin Tester",
        name: "Demo Admin Tester",
      },
    },
  });

  console.log("auth.signUp result:", {
    user: authData?.user?.id,
    email: authData?.user?.email,
    confirmed_at: (authData?.user as any)?.email_confirmed_at,
    identities: authData?.user?.identities,
    session: authData?.session ? "SESSION_CREATED" : "NO_SESSION (EMAIL CONFIRMATION REQUIRED?)",
    authErr: authErr ? { message: authErr.message, status: (authErr as any).status } : null,
  });

  if (authData?.user?.id) {
    // Step 3b: Provision via RPC
    const { data: provData, error: provErr } = await client.rpc("admin_provision_account", {
      _user_id: authData.user.id,
      _email: testEmail,
      _display_name: "Demo Admin Tester",
      _role: "admin",
      _division: "Development",
      _position: "Operations Admin",
      _phone: "+21699999999",
      _create_team_member: true,
      _status: "active",
    });
    console.log("admin_provision_account result:", provData, provErr);

    // Step 3c: Try to log in with the new credentials!
    console.log("\n4. Testing signInWithPassword with the newly created Demo Admin...");
    const loginClient = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: loginData, error: loginErr } = await loginClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    console.log("Login result:", {
      user: loginData?.user?.id,
      loginErr: loginErr ? {
        message: loginErr.message,
        name: loginErr.name,
        status: (loginErr as any).status,
        code: (loginErr as any).code,
        full: JSON.stringify(loginErr),
      } : null,
    });
  }
}

test().catch(console.error);
