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
const client = createClient(supabaseUrl, anonKey);

async function inspectAllProjectsAndClients() {
  await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  const { data: clients } = await client.from("clients").select("id, name, status, monthly_package_price, created_at");
  const { data: projects } = await client.from("client_projects").select("id, title, client_name, client_id, status, created_at");
  const { data: tasks } = await client.from("project_tasks").select("id, project_id, title, status");

  console.log("=== ALL 24 CLIENT PROJECTS ===");
  for (const p of projects || []) {
    const linkedTasks = tasks?.filter(t => t.project_id === p.id) || [];
    console.log(`- Project: [${p.id}] "${p.title}" | Client: [${p.client_id}] "${p.client_name}" | Status: ${p.status} | Tasks: ${linkedTasks.length}`);
  }

  console.log("\n=== ALL 45 CLIENTS ===");
  for (const c of clients || []) {
    const linkedProjs = projects?.filter(p => p.client_id === c.id) || [];
    const projIds = linkedProjs.map(p => p.id);
    const linkedTasks = tasks?.filter(t => projIds.includes(t.project_id)) || [];
    console.log(`- Client: [${c.id}] "${c.name}" | Status: ${c.status} | Pkg: ${c.monthly_package_price} | Projs: ${linkedProjs.length} | Tasks: ${linkedTasks.length} | Created: ${c.created_at}`);
  }
}

inspectAllProjectsAndClients().catch(console.error);
