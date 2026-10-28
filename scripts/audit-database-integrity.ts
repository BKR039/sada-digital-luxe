import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load environment variables from .env
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = (match[2] || "").trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      process.env[match[1]] = value;
    }
  });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

const client = createClient(supabaseUrl!, anonKey!);

async function runAudit() {
  console.log("==================================================");
  console.log("SADA OS — DATABASE INTEGRITY AUDIT");
  console.log("==================================================");

  const authRes = await client.auth.signInWithPassword({
    email: "sec.admin@sada.agency",
    password: "AdminPassword123!",
  });

  if (authRes.error) {
    console.error("Auth error:", authRes.error);
    process.exit(1);
  }

  const supabase = client;

  const { data: tasks, error: tErr } = await supabase.from("project_tasks").select("*");
  if (tErr) {
    console.error("Error fetching tasks:", tErr);
    process.exit(1);
  }

  const { data: clients } = await supabase.from("clients").select("id");
  const clientIds = new Set((clients || []).map((c: any) => c.id));

  const { data: projects } = await supabase.from("client_projects").select("id");
  const projectIds = new Set((projects || []).map((p: any) => p.id));

  const { data: profiles } = await supabase.from("profiles").select("id");
  const profileIds = new Set((profiles || []).map((p: any) => p.id));

  const { data: teamMembers } = await supabase.from("team_members").select("id, profile_id");
  const tmIds = new Set((teamMembers || []).map((m: any) => m.id));
  const validMemberProfileIds = new Set([...profileIds, ...tmIds]);

  let orphanTasks = 0;
  let invalidClientFk = 0;
  let invalidProjectFk = 0;
  let invalidAssigneeFk = 0;
  let invalidAssignedByFk = 0;
  let impossibleDateRanges = 0;
  let invalidCompletedStates = 0;

  for (const t of tasks || []) {
    if (t.client_id && !clientIds.has(t.client_id)) invalidClientFk++;
    if (t.project_id && !projectIds.has(t.project_id)) invalidProjectFk++;
    if (!t.project_id && !t.client_id) orphanTasks++;
    if (t.assignee_id && !validMemberProfileIds.has(t.assignee_id)) invalidAssigneeFk++;
    if (t.assigned_by_id && !validMemberProfileIds.has(t.assigned_by_id)) invalidAssignedByFk++;

    if (t.start_date && t.deadline) {
      const s = new Date(t.start_date).getTime();
      const d = new Date(t.deadline + "T23:59:59").getTime();
      if (s > d) impossibleDateRanges++;
    }

    if (t.status === "done" && !t.completed_at) {
      invalidCompletedStates++;
      console.log("Task done without completed_at:", t.id, t.title);
    }
    if (t.status !== "done" && t.completed_at) {
      invalidCompletedStates++;
      console.log("Task NOT done with completed_at:", t.id, t.title, t.status);
    }
  }

  // Duplicate pending handoffs
  const { data: handoffs } = await supabase.from("task_handoffs").select("*").eq("status", "pending");
  const handoffTaskCounts = new Map<string, number>();
  let duplicatePendingHandoffs = 0;
  for (const h of handoffs || []) {
    const count = (handoffTaskCounts.get(h.task_id) || 0) + 1;
    handoffTaskCounts.set(h.task_id, count);
    if (count > 1) duplicatePendingHandoffs++;
  }

  console.log(`Total project_tasks checked:       ${tasks?.length}`);
  console.log(`Orphan tasks (no client & project): ${orphanTasks}`);
  console.log(`Invalid client_id FK:              ${invalidClientFk}`);
  console.log(`Invalid project_id FK:             ${invalidProjectFk}`);
  console.log(`Invalid assignee_id FK:            ${invalidAssigneeFk}`);
  console.log(`Invalid assigned_by_id FK:         ${invalidAssignedByFk}`);
  console.log(`Impossible date ranges (start>end): ${impossibleDateRanges}`);
  console.log(`Invalid completed states:          ${invalidCompletedStates}`);
  console.log(`Duplicate pending handoffs:        ${duplicatePendingHandoffs}`);
  console.log("==================================================");
}

runAudit();
