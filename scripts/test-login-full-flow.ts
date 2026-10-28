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

async function testDemoAdminLogin() {
  const email = "demo.admin.test.1790932575829@sada.agency";
  const password = "DemoPassword123!@#";

  console.log("1. Testing login with Demo Admin...");
  const { data: authData, error: authErr } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (authErr) {
    console.error("Login failed:", authErr);
    return;
  }

  const user = authData.user;
  console.log("Login successful! User ID:", user.id, "Email:", user.email);

  console.log("2. Checking profile...");
  const { data: profile, error: pErr } = await client
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  console.log("Profile:", profile, "Error:", pErr);

  console.log("3. Checking user_roles...");
  const { data: roles, error: rErr } = await client
    .from("user_roles")
    .select("*")
    .eq("user_id", user.id);
  console.log("Roles:", roles, "Error:", rErr);

  console.log("4. Checking team_members...");
  const { data: tm, error: tmErr } = await client
    .from("team_members")
    .select("*")
    .eq("profile_id", user.id);
  console.log("Team Member:", tm, "Error:", tmErr);

  console.log("5. Testing resolve_and_link_current_team_member RPC...");
  const { data: rpcTm, error: rpcErr } = await client.rpc(
    "resolve_and_link_current_team_member",
    {
      _user_id: user.id,
      _email: user.email,
    }
  );
  console.log("RPC Team Member:", rpcTm, "Error:", rpcErr);

  console.log("6. Testing access to admin data: clients...");
  const { data: clients, error: cErr } = await client
    .from("clients")
    .select("id, name")
    .limit(5);
  console.log("Clients:", clients?.length, "Error:", cErr);
}

testDemoAdminLogin().catch(console.error);
