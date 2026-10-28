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

  const { data: blockedTasks } = await client.from("project_tasks").select("id, title, status, waiting_on, blocked_reason, project_id, assignee_id").eq("status", "blocked");
  console.log("Blocked tasks in DB:", blockedTasks);

  const { data: followups } = await client.from("client_projects").select("id, title, followup_status, followup_summary, followup_next_action, next_followup_date").not("followup_status", "is", null);
  console.log("Projects with follow-up in DB:", followups);

  const { data: allProjs } = await client.from("client_projects").select("id, title, followup_status");
  const followupStatuses: Record<string, number> = {};
  for (const p of allProjs || []) {
    const s = p.followup_status || "NULL";
    followupStatuses[s] = (followupStatuses[s] || 0) + 1;
  }
  console.log("Project followup_status distribution:", followupStatuses);
}

main().catch(console.error);
