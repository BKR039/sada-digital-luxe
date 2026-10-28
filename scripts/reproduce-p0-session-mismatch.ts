import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envContent = fs.readFileSync(".env", "utf-8");
const env: Record<string, string> = {};
envContent.split(/\r?\n/).forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = (match[2] || "").trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.substring(1, value.length - 1);
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
  const bkrAccount = accounts.find((a: any) => a.display_name === "BKR039" || a.email === "boubakarhamedsgail@gmail.com");

  const { data: sessions } = await client.rpc("admin_list_user_sessions", {
    _user_id: bkrAccount?.user_id,
    _status: null,
    _limit: 100,
    _offset: 0,
  });

  console.log("BKR039 User ID:", bkrAccount?.user_id);
  console.log("BKR039 Sessions:", sessions);
}

run().catch(console.error);
