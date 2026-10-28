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
  const { data: saLogin, error: saErr } = await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  console.log("SA Login:", saLogin?.user?.id, saErr?.message);

  const { data: userRoles } = await client.from("user_roles").select("*");
  console.log("All user_roles:", userRoles);

  const { data: accounts, error: accErr } = await client.rpc("admin_list_accounts");
  console.log("admin_list_accounts error:", accErr?.message);
  console.log("Accounts found:", accounts?.length);
  if (accounts) {
    for (const a of accounts.slice(0, 15)) {
      console.log(`User: ${a.email} | ID: ${a.user_id} | Role: ${a.role} | Status: ${a.status} | Name: ${a.display_name} | Created: ${a.created_at}`);
    }
  }
}

main().catch(console.error);
