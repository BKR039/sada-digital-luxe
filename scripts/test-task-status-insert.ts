import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envContent = fs.readFileSync(".env", "utf-8");
const env: Record<string, string> = {};
envContent.split(/\r?\n/).forEach((l) => {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) {
    let val = (m[2] || "").trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    }
    env[m[1]] = val;
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function testStatusInserts() {
  await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  const { data: proj } = await (supabase as any)
    .from("client_projects")
    .select("id")
    .limit(1)
    .single();

  const statusesToTest = [
    "todo",
    "in_progress",
    "review",
    "ready_for_review",
    "approved",
    "changes_requested",
    "done",
    "completed",
    "paused",
    "blocked",
    "postponed",
    "cancelled",
  ];

  console.log("Testing INSERT with project_id:", proj.id);
  for (const s of statusesToTest) {
    const { data, error } = await (supabase as any)
      .from("project_tasks")
      .insert({
        project_id: proj.id,
        title: `Test status ${s}`,
        status: s,
      })
      .select("id, status")
      .single();

    if (error) {
      console.log(`❌ Status '${s}': FAILED -> ${error.message}`);
    } else {
      console.log(`✅ Status '${s}': SUCCESS! ID=${data.id}`);
      await (supabase as any).from("project_tasks").delete().eq("id", data.id);
    }
  }
}

testStatusInserts();
