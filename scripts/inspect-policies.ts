import fs from "fs";
import { createClient } from "@supabase/supabase-js";

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

const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(env.VITE_SUPABASE_URL, serviceKey);

async function inspectPolicies() {
  const { data, error } = await (supabase as any).rpc("exec_sql", {
    query: `SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE tablename IN ('salary_records', 'salary_requests', 'team_members');`
  });
  if (error) {
    console.log("exec_sql error:", error);
    // fallback: query using direct select if permitted or test via raw error
  } else {
    console.log("Policies:", data);
  }
}

inspectPolicies();
