import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envContent = fs.readFileSync(".env", "utf-8");
const env: Record<string, string> = {};
envContent.split(/\r?\n/).forEach((l) => {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) {
    let val = (m[2] || "").trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.substring(1, val.length - 1);
    env[m[1]] = val;
  }
});

const client = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const { data: ump, error: e1 } = await client.from("user_module_permissions").select("*").limit(10);
  console.log("user_module_permissions rows:", ump?.length, "error:", e1?.message);
  
  const { data: profs, error: e2 } = await client
    .from("profiles")
    .select("id, module_permissions")
    .limit(10);
  console.log("profiles rows:", profs?.length, "error:", e2?.message);

  const { data: rules, error: e3 } = await client
    .from("business_rules")
    .select("rule_key")
    .like("rule_key", "user_permissions_%");
  console.log("business_rules user_permissions_ count:", rules?.length, "error:", e3?.message);
}

run();
