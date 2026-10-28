import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env");
const envContent = fs.readFileSync(envPath, "utf-8");
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

const client = createClient(
  env.VITE_SUPABASE_URL || env.SUPABASE_URL,
  env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY
);

async function run() {
  await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  console.log("=== CHECKING CLIENT-RELATED TABLES & SAMPLE DATA ===");
  const tables = [
    "clients",
    "client_deliverables",
    "client_projects",
    "project_tasks",
    "service_commitments",
    "invoices",
    "payments",
    "production_bookings",
    "deals",
    "package_catalog",
    "team_members",
    "profiles",
  ];

  for (const t of tables) {
    const { data, count, error } = await client
      .from(t)
      .select("*", { count: "exact" })
      .limit(2);
    if (error) {
      console.log(`[${t}] ERROR:`, error.message);
    } else {
      console.log(`[${t}] Total rows: ${count}`);
      if (data && data.length > 0) {
        console.log(`  Columns (${Object.keys(data[0]).length}):`, Object.keys(data[0]).join(", "));
        console.log(`  Sample row:`, JSON.stringify(data[0], null, 2).substring(0, 300) + "...");
      }
    }
  }

  // Also query a sample client and its linked entities
  const { data: sampleClients } = await client
    .from("clients")
    .select("id, name, status, client_type, package_id, package_config, monthly_package_price")
    .limit(5);

  console.log("\n=== SAMPLE CLIENTS ===");
  console.log(JSON.stringify(sampleClients, null, 2));

  if (sampleClients && sampleClients.length > 0) {
    const cid = sampleClients[0].id;
    console.log(`\n=== DEEP DIVE SAMPLE CLIENT: ${sampleClients[0].name} (${cid}) ===`);
    
    const { data: deliverables } = await client.from("client_deliverables").select("*").eq("client_id", cid);
    console.log(`Deliverables count:`, deliverables?.length);
    if (deliverables?.length) console.log(`Deliverables:`, deliverables);

    const { data: projects } = await client.from("client_projects").select("*").eq("client_id", cid);
    console.log(`Projects / Workspaces count:`, projects?.length);
    if (projects?.length) console.log(`Projects:`, projects);

    const { data: tasks } = await client.from("project_tasks").select("id, title, status, deliverable_id, assignee_id, due_date").eq("client_id", cid);
    console.log(`Tasks count for client_id:`, tasks?.length);
    if (tasks?.length) console.log(`Sample tasks:`, tasks.slice(0, 3));

    const { data: commitments } = await client.from("service_commitments").select("*").eq("client_id", cid);
    console.log(`Commitments count:`, commitments?.length);

    const { data: invoices } = await client.from("invoices").select("*").eq("client_id", cid);
    console.log(`Invoices count:`, invoices?.length);

    const { data: payments } = await client.from("payments").select("*").eq("client_id", cid);
    console.log(`Payments count:`, payments?.length);
  }
}

run().catch(console.error);
