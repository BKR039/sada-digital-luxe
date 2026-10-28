import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { getDeliveriesByProject } from "../src/components/admin/project-utils";

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

  const { data: projects } = await client.from("client_projects").select("*");
  const { data: tasks } = await client.from("project_tasks").select("*");

  const deliveries = getDeliveriesByProject(projects || [], tasks || []);
  console.log("Deliveries by project total:", deliveries.length);
  for (const d of deliveries) {
    console.log(`Project: ${d.project.title} | Deliverables count: ${d.deliverables.length}`);
  }
}

main().catch(console.error);
