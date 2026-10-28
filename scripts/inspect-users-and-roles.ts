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
    email: "sec.admin@sada.agency",
    password: "AdminPassword123!"
  });

  const { data: teamMembers } = await client.from("team_members").select("*");
  console.log("=== ALL TEAM MEMBERS ===");
  console.log(teamMembers?.map(m => ({ id: m.id, name: m.name, email: m.email, role: m.role, profile_id: m.profile_id })));

  const { data: userRoles } = await client.from("user_roles").select("*");
  console.log("=== ALL USER ROLES ===");
  console.log(userRoles);

  const { data: profiles } = await client.from("profiles").select("*");
  console.log("=== ALL PROFILES ===");
  console.log(profiles);
}

main().catch(console.error);
