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

  const { data: deals } = await client
    .from("deals")
    .select("*, package:package_catalog(name), client:clients(name)")
    .order("created_at", { ascending: true });

  console.log("=== ALL DEALS IN DB (" + deals?.length + ") ===");
  deals?.forEach((d, idx) => {
    console.log(
      `[${idx + 1}] ID: ${d.id} | Title: "${d.title}" | Company: "${d.company_name}" | Stage: ${d.stage} | Value: ${d.deal_value} TND | Sponsoring: ${d.sponsoring_budget} TND | Client: ${d.client?.name || d.client_id || "None"} | Pkg: ${d.package?.name || d.package_id || "None"} | Owner: ${d.sales_owner_id || "None"} | Created: ${d.created_at}`
    );
  });

  const { data: comms } = await client
    .from("sales_commissions")
    .select("*, client:clients(name), deal:deals(title)")
    .order("created_at", { ascending: true });

  console.log("\n=== ALL SALES COMMISSIONS IN DB (" + comms?.length + ") ===");
  comms?.forEach((c, idx) => {
    console.log(
      `[${idx + 1}] ID: ${c.id} | Deal: "${c.deal?.title || c.deal_id || "None"}" | Client: "${c.client?.name || c.client_id || "None"}" | Status: ${c.status} | Total: ${c.total_sale_amount} | Service: ${c.service_revenue} | Sponsoring: ${c.sponsoring_amount} | Rate: ${c.commission_rate}% | Comm: ${c.commission_amount} TND | TeamMember: ${c.team_member_id || "None"} | Created: ${c.created_at}`
    );
  });
}

main().catch(console.error);
