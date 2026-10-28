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
  
  console.log("ALL ACCOUNTS IN SYSTEM:");
  (accounts || []).forEach((a: any, i: number) => {
    console.log(`${i + 1}. [${a.role}] ${a.email} | Name: "${a.display_name}" | ID: ${a.user_id} | Status: ${a.status} | Created: ${a.created_at}`);
  });
}

run().catch(console.error);
