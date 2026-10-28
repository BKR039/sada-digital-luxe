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
    .order("created_at", { ascending: true })
    .limit(18);

  console.log("=== FIRST 18 DEALS ===");
  deals?.forEach((d, idx) => {
    console.log(
      `[${idx + 1}] ID: ${d.id} | Title: "${d.title}" | Company: "${d.company_name}" | Stage: ${d.stage} | Value: ${d.deal_value} TND | Sponsoring: ${d.sponsoring_budget} TND | Client: ${d.client?.name || d.client_id || "None"} | Pkg: ${d.package?.name || d.package_id || "None"} | Owner: ${d.sales_owner_id || "None"} | Created: ${d.created_at}`
    );
  });
}

main().catch(console.error);
