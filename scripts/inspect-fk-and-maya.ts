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
    process.env[m[1]] = val;
  }
});

const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function inspectSchema() {
  console.log("=== INSPECTING CLIENTS FOREIGN KEY CONSTRAINT ===");

  // Sign in as Super Admin
  await client.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  // Query constraint using rpc or direct query
  // Let's check team_members table and profiles table
  const { data: teamMembers, error: tmErr } = await client
    .from("team_members")
    .select("id, name, email, role, profile_id, user_id, is_active");
  console.log("Team Members count:", teamMembers?.length);
  console.log("Sample Team Members:", teamMembers?.slice(0, 5));

  // Let's find Maya Trabelsi in team_members and profiles
  const { data: mayaTM } = await client
    .from("team_members")
    .select("id, name, email, role, profile_id, user_id, is_active")
    .ilike("name", "%maya%");
  console.log("Maya in team_members:", mayaTM);

  const { data: mayaProf } = await client
    .from("profiles")
    .select("id, display_name, email")
    .ilike("display_name", "%maya%");
  console.log("Maya in profiles:", mayaProf);

  // Let's also check Boubakar
  const { data: boubakarTM } = await client
    .from("team_members")
    .select("id, name, email, role, profile_id, user_id, is_active")
    .ilike("name", "%boubakar%");
  console.log("Boubakar in team_members:", boubakarTM);
}

inspectSchema().catch(console.error);
