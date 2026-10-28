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

async function check() {
  const { data: saLogin, error: saErr } = await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (saErr) {
    console.error("Login failed:", saErr);
    return;
  }
  console.log("Logged in as Super Admin:", saLogin.user.id);

  // Check sample task
  const { data: tasks, error: taskErr } = await client
    .from("project_tasks")
    .select("id, title, category, status, result_links, notes")
    .limit(3);
  console.log("Tasks sample:", tasks, "Error:", taskErr?.message);

  // Check team_members
  const { data: tms, error: tmErr } = await client
    .from("team_members")
    .select("id, name, role, position, specialties")
    .limit(3);
  console.log("Team members sample:", tms, "Error:", tmErr?.message);

  // Check clients
  const { data: cls, error: clErr } = await client
    .from("clients")
    .select("id, name, notes")
    .limit(3);
  console.log("Clients sample:", cls, "Error:", clErr?.message);
}

check();
