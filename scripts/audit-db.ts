import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      if (value.length > 0 && value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      process.env[key] = value;
    }
  });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function audit() {
  console.log("=== AUDITING DB: PROFILES, TEAM_MEMBERS, PROJECT_TASKS ===");

  const { data: profiles, error: pErr } = await supabase.from("profiles").select("*");
  console.log("PROFILES:", pErr || profiles);

  const { data: teamMembers, error: tErr } = await supabase.from("team_members").select("*");
  console.log("TEAM MEMBERS:", tErr || teamMembers);

  const { data: tasks, error: taskErr } = await supabase.from("project_tasks").select("id, title, assignee_id, assigned_by_id, previous_assignee_id");
  console.log("PROJECT TASKS:", taskErr || tasks);

  const { data: projects, error: projErr } = await supabase.from("client_projects").select("id, title, client_name");
  console.log("CLIENT PROJECTS:", projErr || projects);
}

audit();
