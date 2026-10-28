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
  await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  const { data: deals } = await client.from("deals").select("*").limit(2);
  console.log("DEALS columns:", deals && deals.length > 0 ? Object.keys(deals[0]) : "Empty");
  console.log("Sample deal:", deals?.[0]);

  const { data: comms } = await client.from("sales_commissions").select("*").limit(2);
  console.log("SALES_COMMISSIONS columns:", comms && comms.length > 0 ? Object.keys(comms[0]) : "Empty");
  console.log("Sample comm:", comms?.[0]);

  const { data: rules } = await client.from("business_rules").select("*");
  console.log("BUSINESS_RULES count:", rules?.length);
  console.log("Rules:", rules?.map(r => ({ id: r.id, rule_key: r.rule_key, name: r.name, value: r.rule_value, is_active: r.is_active })));
}

main().catch(console.error);
