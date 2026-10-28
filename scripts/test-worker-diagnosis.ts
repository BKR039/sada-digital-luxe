import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Load .env
const envPath = path.resolve(process.cwd(), ".env");
const envContent = fs.readFileSync(envPath, "utf-8");
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

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL!;
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY!;

async function main() {
  console.log("=== DIAGNOSIS: Super Admin vs Worker Queries ===");

  // 1. Super Admin Client
  const saClient = createClient(supabaseUrl, anonKey);
  const saAuth = await saClient.auth.signInWithPassword({
    email: "sec.admin@sada.agency",
    password: "AdminPassword123!",
  });
  console.log("SA Auth:", saAuth.error ? saAuth.error.message : `Logged in as ${saAuth.data.user?.id}`);

  // 2. Worker Client
  const workerClient = createClient(supabaseUrl, anonKey);
  const workerAuth = await workerClient.auth.signInWithPassword({
    email: "qa.worker@sada.agency",
    password: "WorkerPassword123!",
  });
  console.log("Worker Auth:", workerAuth.error ? workerAuth.error.message : `Logged in as ${workerAuth.data.user?.id}`);

  if (saAuth.data.user) {
    console.log("\n--- SUPER ADMIN VIEW ---");
    const { data: saRoles } = await saClient.from("user_roles").select("*").eq("user_id", saAuth.data.user.id);
    console.log("SA Roles:", saRoles);

    const { data: saProjects, error: saProjErr } = await saClient.from("client_projects").select("id, title, client_name, client_id");
    console.log("SA client_projects count:", saProjects?.length, saProjErr?.message || "");
    if (saProjects && saProjects.length > 0) {
      console.log("SA first 3 projects:", saProjects.slice(0, 3));
    }

    const { data: saTasks, error: saTasksErr } = await saClient.from("project_tasks").select("id, title, status, priority, assignee_id, project_id, client_id");
    console.log("SA project_tasks count:", saTasks?.length, saTasksErr?.message || "");
    if (saTasks && saTasks.length > 0) {
      console.log("SA first 5 tasks:", saTasks.slice(0, 5));
    }

    const { data: saDeals, error: saDealsErr } = await saClient.from("deals").select("id, title, status, stage, client_id, deal_value, owner_id");
    console.log("SA deals count:", saDeals?.length, saDealsErr?.message || "");
    if (saDeals && saDeals.length > 0) {
      console.log("SA first 3 deals:", saDeals.slice(0, 3));
    }

    const { data: saComms, error: saCommsErr } = await saClient.from("sales_commissions").select("*");
    console.log("SA sales_commissions count:", saComms?.length, saCommsErr?.message || "");

    const { data: saRules, error: saRulesErr } = await saClient.from("business_rules").select("id, rule_key, name, rule_value");
    console.log("SA business_rules count:", saRules?.length, saRulesErr?.message || "");
    if (saRules) {
      console.log("Rules keys:", saRules.map(r => r.rule_key));
    }
  }

  if (workerAuth.data.user) {
    console.log("\n--- TASK ASSIGNEES BREAKDOWN ---");
    const { data: allTasks } = await workerClient.from("project_tasks").select("id, title, assignee_id, status, priority, project_id");
    const assigneeCounts: Record<string, number> = {};
    for (const t of (allTasks || [])) {
      const a = t.assignee_id || "UNASSIGNED";
      assigneeCounts[a] = (assigneeCounts[a] || 0) + 1;
    }
    console.log("Task counts by assignee_id:", assigneeCounts);

    const { data: allMembers } = await workerClient.from("team_members").select("id, name, email, role, profile_id");
    console.log("\nTeam members mapping:");
    for (const m of (allMembers || [])) {
      console.log(`Member ID: ${m.id} | Profile ID: ${m.profile_id} | Name: ${m.name} | Role: ${m.role} | Tasks assigned by profile_id: ${assigneeCounts[m.profile_id || ""] || 0} | Tasks assigned by member_id: ${assigneeCounts[m.id] || 0}`);
    }

    console.log("\nProject leads / owners in client_projects:");
    const { data: projs } = await workerClient.from("client_projects").select("id, title, lead_id, followup_owner_id");
    const leadCounts: Record<string, number> = {};
    for (const p of (projs || [])) {
      const l = p.lead_id || "NO_LEAD";
      leadCounts[l] = (leadCounts[l] || 0) + 1;
    }
    console.log("Project counts by lead_id:", leadCounts);
  }
}

main().catch(console.error);
