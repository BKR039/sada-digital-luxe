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

async function main() {
  const authRes = await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  console.log("Logged in user:", authRes.data.user.id, authRes.data.user.email);

  const { data: roles } = await client.from("user_roles").select("*").eq("user_id", authRes.data.user.id);
  console.log("user_roles for qa.superadmin:", roles);

  const { data: rpcIsSa } = await client.rpc("is_super_admin", { user_id: authRes.data.user.id });
  console.log("rpc is_super_admin:", rpcIsSa);

  const { data: rpcIsAdmin } = await client.rpc("is_admin", { user_id: authRes.data.user.id });
  console.log("rpc is_admin:", rpcIsAdmin);
}

main().catch(console.error);
