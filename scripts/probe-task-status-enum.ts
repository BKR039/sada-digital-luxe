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

async function probe() {
  console.log("Probing project_tasks status column and enum values...");
  const statuses = [
    "todo",
    "in_progress",
    "ready_for_review",
    "review",
    "changes_requested",
    "approved",
    "completed",
    "done",
    "paused",
    "blocked",
    "postponed",
    "cancelled",
  ];

  for (const s of statuses) {
    const { data, error } = await (supabase as any)
      .from("project_tasks")
      .select("id")
      .eq("status", s)
      .limit(1);
    if (error) {
      console.log(`Status '${s}': ERROR -> ${error.message} (${error.code})`);
    } else {
      console.log(`Status '${s}': VALID query, rows returned: ${data?.length || 0}`);
    }
  }

  // Also query existing distinct statuses in the table
  const { data: rows } = await (supabase as any)
    .from("project_tasks")
    .select("status");
  const distinct = Array.from(new Set((rows || []).map((r: any) => r.status)));
  console.log("Distinct existing statuses in project_tasks:", distinct);
}

probe();
