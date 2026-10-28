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
  console.table(commRules);

  const { data: deals } = await client
    .from("deals")
    .select("id, title, company_name, stage, sales_owner_id, commission_recipient_id, deal_value, service_revenue, sponsoring_budget, commission_rate, client_id, package_id, created_at");

  console.log("\n=== REAL DEALS DATA (First 15) ===");
  console.table(deals?.slice(0, 15));

  const { data: comms } = await client
    .from("sales_commissions")
    .select("id, deal_id, team_member_id, client_id, total_sale_amount, service_revenue, sponsoring_amount, commission_rate, commission_amount, status, created_at");

  console.log("\n=== REAL SALES COMMISSIONS DATA ===");
  console.table(comms);

  // Check user_roles table
  const { data: roles } = await client.from("user_roles").select("*");
  console.log("\n=== USER ROLES ===");
  console.table(roles);

  // Check profiles / team_members
  const { data: profiles } = await client.from("profiles").select("id, full_name, email, role");
  console.log("\n=== PROFILES ===");
  console.table(profiles);
}

main().catch(console.error);
