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
  
  // Sort by created_at descending
  const sorted = (accounts || []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  console.log("TOP 10 NEWEST ACCOUNTS:");
  for (const a of sorted.slice(0, 10)) {
    console.log(`- ${a.email} | ${a.display_name} | Role: ${a.role} | Status: ${a.status} | Created: ${a.created_at} | LastSignIn: ${a.last_sign_in_at}`);
  }
}

run().catch(console.error);
