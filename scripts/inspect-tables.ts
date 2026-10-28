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

async function run() {
  await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  // Check public.profiles
  const { data: profiles, error: pErr } = await client.from("profiles").select("*");
  console.log("Profiles count:", profiles?.length, pErr);

  // Check public.user_roles
  const { data: userRoles, error: urErr } = await client.from("user_roles").select("*");
  console.log("User Roles count:", userRoles?.length, urErr);

  // Check public.team_members
  const { data: teamMembers, error: tmErr } = await client.from("team_members").select("*");
  console.log("Team members count:", teamMembers?.length, tmErr);

  // Check account_audit_logs
  const { data: logs, error: lErr } = await client.from("account_audit_logs").select("*").order("created_at", { ascending: false }).limit(5);
  console.log("Recent account audit logs:", JSON.stringify(logs, null, 2));
}

run().catch(console.error);
