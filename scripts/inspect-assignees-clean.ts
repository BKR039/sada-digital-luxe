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
    email: "qa.worker@sada.agency",
    password: "WorkerPassword123!"
  });

  const { data: tasks } = await client.from("project_tasks").select("id, title, assignee_id, status");
  const counts: Record<string, number> = {};
  for (const t of tasks || []) {
    const k = t.assignee_id || "UNASSIGNED";
    counts[k] = (counts[k] || 0) + 1;
  }
  console.log("Counts by assignee_id:", JSON.stringify(counts, null, 2));

  // Find out who those UUIDs belong to in profiles and team_members
  const uuids = Object.keys(counts).filter(k => k !== "UNASSIGNED");
  const { data: profiles } = await client.from("profiles").select("id, display_name").in("id", uuids);
  console.log("Profiles matching assignees:", profiles);

  const { data: members } = await client.from("team_members").select("id, name, email, profile_id, role").in("profile_id", uuids);
  console.log("Members matching profile_ids:", members);

  const { data: membersById } = await client.from("team_members").select("id, name, email, profile_id, role").in("id", uuids);
  console.log("Members matching ids:", membersById);
}

main().catch(console.error);
