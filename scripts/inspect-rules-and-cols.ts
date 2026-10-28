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

  const { data: brSample } = await client.from("business_rules").select("*").limit(2);
  console.log("business_rules columns:", brSample ? Object.keys(brSample[0]) : "none");
  console.log("business_rules sample:", brSample);

  const { data: brAll } = await client.from("business_rules").select("*");
  console.log("\nAll Business Rules:");
  brAll?.forEach((r) => {
    console.log(`- ${r.rule_key}:`, JSON.stringify(r.rule_value || r.value || r));
  });

  const { data: dealsSample } = await client.from("deals").select("*").limit(1);
  console.log("\ndeals columns:", dealsSample ? Object.keys(dealsSample[0]) : "none");

  const { data: commsSample } = await client.from("sales_commissions").select("*").limit(1);
  console.log("\nsales_commissions columns:", commsSample ? Object.keys(commsSample[0]) : "none");

  const { data: auditSample } = await client.from("system_audit_logs").select("*").limit(1);
  console.log("\nsystem_audit_logs columns on REMOTE:", auditSample && auditSample[0] ? Object.keys(auditSample[0]) : "none");
}

main().catch(console.error);
