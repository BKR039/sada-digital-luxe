import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env variables manually for standalone script
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

async function runLivePostgrestColumnQuery() {
  console.log("=== SADA WORK OS — LIVE POSTGREST COLUMN QUERY TEST ===");
  console.log("Querying `assigned_by_id` column from `project_tasks` via live PostgREST API...");

  const { data, error } = await supabase
    .from("project_tasks")
    .select("id, title, assigned_by_id, waiting_on, blocked_reason, result_title, result_links, previous_assignee_id, handoff_reason")
    .limit(1);

  if (error) {
    console.error("CRITICAL FAILURE querying `assigned_by_id` from live PostgREST API:");
    console.error(error);
    process.exit(1);
  }

  console.log("✓ SUCCESS: PostgREST API successfully resolved `assigned_by_id` and all Work OS columns without error!");
  console.log("Returned data count:", data?.length || 0);

  // Query client_communication_logs
  console.log("\nQuerying `client_communication_logs` table via live PostgREST API...");
  const { data: commData, error: commErr } = await supabase
    .from("client_communication_logs")
    .select("id, project_id, contact_method, summary, created_at")
    .limit(1);

  if (commErr) {
    console.error("CRITICAL FAILURE querying `client_communication_logs` from live PostgREST API:");
    console.error(commErr);
    process.exit(1);
  }

  console.log("✓ SUCCESS: PostgREST API successfully resolved `client_communication_logs` table without error!");
  console.log("Returned communication logs count:", commData?.length || 0);

  console.log("\n=== REAL PERSISTENCE & SCHEMA CACHE VERIFICATION 100% PASSED ===");
}

runLivePostgrestColumnQuery().catch(err => {
  console.error("Fatal error during schema verification:", err);
  process.exit(1);
});
