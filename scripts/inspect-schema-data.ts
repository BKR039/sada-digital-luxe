import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = (match[2] || "").trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      process.env[match[1]] = value;
    }
  });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const client = createClient(supabaseUrl, serviceRoleKey || anonKey);

async function inspectSchemaAndData() {
  console.log("--- Client Projects ---");
  const { data: cp, error: cpErr } = await client.from("client_projects").select("*").limit(5);
  console.log("Client projects count:", cp?.length, "error:", cpErr);
  if (cp && cp.length > 0) {
    console.log("Keys in client_projects:", Object.keys(cp[0]));
    console.log("First client_project:", cp[0]);
  }

  console.log("\n--- Project Tasks ---");
  const { data: pt, error: ptErr } = await client.from("project_tasks").select("*");
  console.log("Project tasks total count:", pt?.length, "error:", ptErr);
  if (pt && pt.length > 0) {
    console.log("Keys in project_tasks:", Object.keys(pt[0]));
    console.log("Sample tasks:", pt.slice(0, 3));
  }

  console.log("\n--- Clients ---");
  const { data: cl, error: clErr } = await client.from("clients").select("*").limit(5);
  console.log("Clients count:", cl?.length, "error:", clErr);
  if (cl && cl.length > 0) {
    console.log("First client:", cl[0].name, cl[0].id);
  }

  console.log("\n--- Deals / Pipeline ---");
  const { data: dl, error: dlErr } = await client.from("deals").select("*").limit(5);
  console.log("Deals count:", dl?.length, "error:", dlErr);
  if (dl && dl.length > 0) {
    console.log("Keys in deals:", Object.keys(dl[0]));
    console.log("Sample deal:", dl[0]);
  }

  console.log("\n--- Existing Sales / Commission references ---");
  // Check any table with sale or commission
  const { data: tables, error: tErr } = await client.rpc("get_schema_tables"); // if exists
  if (tErr) {
    console.log("get_schema_tables RPC not present, testing specific tables...");
  }
}

inspectSchemaAndData().catch(console.error);
