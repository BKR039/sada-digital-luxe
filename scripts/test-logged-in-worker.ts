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

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function testWorker() {
  console.log("=== LOGGING IN AS qa.worker@sada.agency ===");
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: "qa.worker@sada.agency",
    password: "WorkerPassword123!"
  });

  if (authErr) {
    console.error("Auth error:", authErr);
    return;
  }

  console.log("Logged in UID:", auth.user.id);

  // 1. Query team_members
  const { data: tm, error: tmErr } = await supabase
    .from("team_members")
    .select("*")
    .or(`profile_id.eq.${auth.user.id},user_id.eq.${auth.user.id}`);
  console.log("team_members error:", tmErr);
  console.log("team_members count:", tm?.length, tm?.[0]?.name, tm?.[0]?.id);

  // 2. Query salary_records
  const { data: sr, error: srErr } = await supabase
    .from("salary_records")
    .select("*, team_member:team_members(id, name)")
    .eq("team_member_id", tm?.[0]?.id);
  console.log("salary_records error:", srErr);
  console.log("salary_records count:", sr?.length, sr?.[0]);

  // 3. Query salary_requests
  const { data: sq, error: sqErr } = await supabase
    .from("salary_requests")
    .select("*")
    .eq("team_member_id", tm?.[0]?.id);
  console.log("salary_requests error:", sqErr);
  console.log("salary_requests count:", sq?.length);

  // 4. Test other worker if any
  console.log("\n=== LOGGING IN AS SUPER ADMIN (qa.superadmin@sada.agency) ===");
  const { data: adminAuth, error: adminAuthErr } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!"
  });
  if (adminAuthErr) {
    console.log("boubakar login failed:", adminAuthErr.message);
  } else {
    console.log("Logged in as super admin!");
    const { data: allTms } = await supabase.from("team_members").select("id, name, email, role, profile_id, user_id, is_active");
    const { data: allSrs } = await supabase.from("salary_records").select("*");
    console.log("Team members count:", allTms?.length);
    console.log("Salary records count:", allSrs?.length);
    for (const tm of allTms || []) {
      const s = allSrs?.find(sr => sr.team_member_id === tm.id);
      console.log(`TM: ${tm.name} (${tm.email}) [role: ${tm.role}, profile_id: ${tm.profile_id}, user_id: ${tm.user_id}] => Salary: ${s ? s.base_amount + ' TND' : 'MISSING'}`);
    }
  }
}

testWorker().catch(err => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
