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

console.log("Supabase URL:", supabaseUrl);
console.log("Supabase Key present:", !!supabaseKey);

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('=== 1. SEARCHING PROJECTS ===');
  const { data: projects, error: pErr } = await supabase
    .from('client_projects')
    .select('*');

  console.log('Projects count:', projects?.length, pErr);
  if (projects) {
    for (const p of projects) {
      console.log(`- Project ID: ${p.id} | Name: ${p.name} | Client: ${p.client_name}`);
    }
  }

  console.log('\n=== 2. SEARCHING TASKS ===');
  const { data: allTasks, error: allTErr } = await supabase
    .from('project_tasks')
    .select('*');

  console.log('Tasks count:', allTasks?.length, allTErr);
  if (allTasks) {
    for (const t of allTasks) {
      console.log(`- Task ID: ${t.id} | Title: ${t.title} | ProjectID: ${t.project_id} | AssigneeID: ${t.assignee_id} | AssignedByID: ${t.assigned_by_id} | Status: ${t.status}`);
    }
  }

  console.log('\n=== 3. SEARCHING TEAM MEMBERS ===');
  const { data: teamMembers, error: tmErr } = await supabase
    .from('team_members')
    .select('*');

  console.log('Team Members count:', teamMembers?.length, tmErr);
  if (teamMembers) {
    for (const tm of teamMembers) {
      console.log(`- TM ID: ${tm.id} | ProfileID: ${tm.profile_id} | Name: ${tm.name} | Active: ${tm.is_active}`);
    }
  }

  console.log('\n=== 4. SEARCHING PROFILES ===');
  const { data: profiles, error: prErr } = await supabase
    .from('profiles')
    .select('*');

  console.log('Profiles count:', profiles?.length, prErr);
  if (profiles) {
    for (const pr of profiles) {
      console.log(`- Profile ID: ${pr.id} | DisplayName: ${pr.display_name} | Role: ${pr.role}`);
    }
  }
}

main().catch(err => {
  console.error("MAIN ERROR:", err);
});
