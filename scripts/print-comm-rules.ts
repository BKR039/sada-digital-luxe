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

  const { data: commRules } = await client
    .from("business_rules")
    .select("rule_key, rule_name, category, value_type, numeric_value, text_value, is_active, version, updated_at")
    .ilike("rule_key", "%commiss%");

  console.log("=== COMMISSION RULES IN BUSINESS_RULES ===");
  console.log(JSON.stringify(commRules, null, 2));
}

main().catch(console.error);
