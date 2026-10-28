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

  // Query database using an RPC or inspect
  // Let's create an RPC or inspect the columns via SQL or RPC
  // Wait, let's see what admin_list_accounts or custom RPC gives
  const userGood = "cf8777d5-2827-437a-8592-6ff482621359"; // worked
  const userBad = "dc9a9cfa-4d9e-4705-9042-1d13ebf4b294"; // 500 error

  const { data: accounts } = await client.rpc("admin_list_accounts");
  console.log("Good user:", accounts?.find((a: any) => a.user_id === userGood));
  console.log("Bad user:", accounts?.find((a: any) => a.user_id === userBad));
}

run().catch(console.error);
