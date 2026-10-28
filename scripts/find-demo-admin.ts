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

  const { data: accounts } = await client.rpc("admin_list_accounts");
  
  console.log("TOTAL ACCOUNTS IN admin_list_accounts:", accounts?.length);
  for (const a of accounts || []) {
    if (
      a.role === "admin" ||
      a.email.includes("demo") ||
      a.display_name?.toLowerCase().includes("demo") ||
      a.display_name?.toLowerCase().includes("admin")
    ) {
      console.log(`- [${a.role}] Email: "${a.email}" | Name: "${a.display_name}" | ID: ${a.user_id} | Created: ${a.created_at} | Status: ${a.status}`);
    }
  }
}

run().catch(console.error);
