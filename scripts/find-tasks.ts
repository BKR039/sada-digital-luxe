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
const supabase = createClient(supabaseUrl, anonKey);

async function run() {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (authErr) {
    console.error("Auth error:", authErr.message);
    return;
  }

  const { data: tasks, error } = await supabase
    .from("project_tasks")
    .select("id, title, status, priority, parent_task_id, project_id, client_id, deadline")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Query error:", error.message);
    return;
  }
  console.log("Tasks count:", tasks?.length);
  for (const t of tasks || []) {
    console.log(`Task: ${t.id} | "${t.title}" | parent: ${t.parent_task_id} | status: ${t.status}`);
  }
}

run();
