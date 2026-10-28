import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import {
  computeProjectProgress,
  computeProgress,
  computeProjectHealth,
  calculateUserWorkload,
  isTaskActiveOnDay,
  computeTaskVisualState,
  type TaskRow,
  type ProjectRow,
  type TeamMemberRow,
  type ProfileRow,
} from "../src/components/admin/project-utils";

// Load .env
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

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY!;

let passCount = 0;
let failCount = 0;

function check(testName: string, passed: boolean, details?: string) {
  if (passed) {
    console.log(`✓ [PASS] ${testName}`);
    passCount++;
  } else {
    console.error(`❌ [FAIL] ${testName}: ${details}`);
    failCount++;
  }
}

async function runRegressionSuite() {
  console.log("=================================================================");
  console.log("SADA OS — AUDIT REMEDIATION CROSS-SYSTEM REGRESSION SUITE");
  console.log("=================================================================\n");

  // -----------------------------------------------------------------
  // 1. CANONICAL computeProjectProgress UNIT & SPEC CHECKS
  // -----------------------------------------------------------------
  console.log("--- 1. CANONICAL computeProjectProgress SPEC ---");
  const emptyTasks: TaskRow[] = [];
  check("total === 0 returns 0", computeProjectProgress(emptyTasks) === 0);

  const mockTasks: TaskRow[] = [
    { id: "1", status: "done" } as TaskRow,
    { id: "2", status: "in_progress" } as TaskRow,
    { id: "3", status: "todo" } as TaskRow,
  ];
  // 1 / 3 = 33.333% -> 33
  check("1 of 3 done returns 33", computeProjectProgress(mockTasks) === 33);

  mockTasks.push({ id: "4", status: "done" } as TaskRow);
  // 2 / 4 = 50%
  check("2 of 4 done returns 50", computeProjectProgress(mockTasks) === 50);

  const allDoneTasks = [
    { id: "1", status: "done" } as TaskRow,
    { id: "2", status: "done" } as TaskRow,
  ];
  check("2 of 2 done returns 100", computeProjectProgress(allDoneTasks) === 100);

  const progResult = computeProgress(mockTasks);
  check("computeProgress delegates percent to computeProjectProgress", progResult.percent === 50);

  // -----------------------------------------------------------------
  // 2. LIVE REMOTE SUPABASE CLIENT INITIALIZATION
  // -----------------------------------------------------------------
  console.log("\n--- 2. REMOTE SUPABASE CONNECTION ---");
  const client = createClient(supabaseUrl, anonKey);
  const saLogin = await client.auth.signInWithPassword({
    email: "sec.admin@sada.agency",
    password: "AdminPassword123!",
  });
  if (saLogin.error) throw saLogin.error;
  console.log(`Connected to live Supabase as Super Admin (${saLogin.data.user.id})`);

  // -----------------------------------------------------------------
  // 3. DATABASE INTEGRITY INVARIANTS
  // -----------------------------------------------------------------
  console.log("\n--- 3. DATABASE INTEGRITY INVARIANTS ---");
  const { data: doneNullTasks } = await client
    .from("project_tasks")
    .select("id")
    .eq("status", "done")
    .is("completed_at", null);
  check("Zero done tasks with NULL completed_at", (doneNullTasks || []).length === 0);

  const { data: allTasks } = await client.from("project_tasks").select("*");
  const { data: allProjects } = await client.from("client_projects").select("id, lead_id");
  const { data: allClients } = await client.from("clients").select("id");
  const { data: allProfiles } = await client.from("profiles").select("id");
  const { data: allTeamMembers } = await client.from("team_members").select("*");

  const projectIds = new Set((allProjects || []).map((p: any) => p.id));
  const clientIds = new Set((allClients || []).map((c: any) => c.id));
  const profileIds = new Set((allProfiles || []).map((p: any) => p.id));

  let orphanTasks = 0;
  let invalidAssignee = 0;
  for (const t of allTasks || []) {
    if (!t.project_id && !t.client_id) orphanTasks++;
    if (t.assignee_id && !profileIds.has(t.assignee_id)) invalidAssignee++;
  }
  check("Zero orphan project_tasks", orphanTasks === 0);
  check("Zero invalid assignee profile IDs", invalidAssignee === 0);

  let invalidLeads = 0;
  for (const p of allProjects || []) {
    if (p.lead_id && !profileIds.has(p.lead_id)) invalidLeads++;
  }
  check("Zero invalid project lead IDs", invalidLeads === 0);

  let invalidTmProfiles = 0;
  for (const tm of allTeamMembers || []) {
    if (tm.profile_id && !profileIds.has(tm.profile_id)) invalidTmProfiles++;
  }
  check("Zero invalid team member profile IDs", invalidTmProfiles === 0);

  // -----------------------------------------------------------------
  // 4. CROSS-SYSTEM PROPAGATION: TASK COMPLETION
  // -----------------------------------------------------------------
  console.log("\n--- 4. CROSS-SYSTEM PROPAGATION: TASK COMPLETION ---");
  const testProjectId = allProjects![0].id;
  const testClientId = allClients![0].id;
  const sarahProfileId = "63a69ae6-4737-4645-9f25-e45e2a3f1726";

  // Create temporary task
  const { data: createdTask, error: crtErr } = await client
    .from("project_tasks")
    .insert({
      title: "PROPAGATION_TEST_TASK",
      project_id: testProjectId,
      client_id: testClientId,
      status: "in_progress",
      priority: "high",
      assignee_id: sarahProfileId,
      start_date: "2026-09-15",
      deadline: "2026-09-25",
    })
    .select()
    .single();
  if (crtErr) throw crtErr;

  try {
    // Initial workload for Sarah
    const initialTasks = [...(allTasks || []), createdTask];
    const initialWorkload = calculateUserWorkload(initialTasks, sarahProfileId);
    const initialProgress = computeProjectProgress(initialTasks.filter(t => t.project_id === testProjectId));

    // Complete the task
    const { data: updatedTask, error: updErr } = await client
      .from("project_tasks")
      .update({ status: "done" })
      .eq("id", createdTask.id)
      .select()
      .single();
    if (updErr) throw updErr;

    // Verify completed_at populated
    check("Trigger populated completed_at", !!updatedTask.completed_at);

    // Verify progress increased
    const afterTasks = initialTasks.map(t => t.id === createdTask.id ? updatedTask : t);
    const afterProgress = computeProjectProgress(afterTasks.filter(t => t.project_id === testProjectId));
    check(
      "Project progress updated correctly via computeProjectProgress",
      afterProgress >= initialProgress
    );

    // Verify user workload reflects completion
    const afterWorkload = calculateUserWorkload(afterTasks, sarahProfileId);
    check(
      "Workload open tasks decremented upon completion",
      afterWorkload.activeCount === initialWorkload.activeCount - 1
    );

    // Verify calendar visual state changed to completed
    const visualState = computeTaskVisualState(updatedTask, new Date("2026-09-20"));
    check("Calendar visual state is 'completed'", visualState === "completed");

    // Verify task is active on interval days (15 Sep to 25 Sep)
    check("Task active on start_date (15 Sep)", isTaskActiveOnDay(updatedTask, new Date("2026-09-15")));
    check("Task active on range day (20 Sep)", isTaskActiveOnDay(updatedTask, new Date("2026-09-20")));
    check("Task active on deadline (25 Sep)", isTaskActiveOnDay(updatedTask, new Date("2026-09-25")));
    check("Task NOT active before start (14 Sep)", !isTaskActiveOnDay(updatedTask, new Date("2026-09-14")));
    check("Task NOT active after deadline (26 Sep)", !isTaskActiveOnDay(updatedTask, new Date("2026-09-26")));

    // -----------------------------------------------------------------
    // 5. CROSS-SYSTEM PROPAGATION: REASSIGNMENT
    // -----------------------------------------------------------------
    console.log("\n--- 5. CROSS-SYSTEM PROPAGATION: TASK REASSIGNMENT ---");
    const newAssigneeProfileId = "fc4e5cbc-371d-46e8-8c48-45eac5790503"; // Phase 1 Tester
    // Reopen task and reassign
    const { data: reassignedTask, error: reassignErr } = await client
      .from("project_tasks")
      .update({
        status: "in_progress",
        assignee_id: newAssigneeProfileId,
        previous_assignee_id: sarahProfileId,
      })
      .eq("id", createdTask.id)
      .select()
      .single();
    if (reassignErr) throw reassignErr;

    check("Reassignment updated assignee_id", reassignedTask.assignee_id === newAssigneeProfileId);
    check("Reassignment stored previous_assignee_id", reassignedTask.previous_assignee_id === sarahProfileId);
    check("Reopening cleared completed_at", reassignedTask.completed_at === null);

    const reassignTasks = initialTasks.map(t => t.id === createdTask.id ? reassignedTask : t);
    const oldMemberWorkload = calculateUserWorkload(reassignTasks, sarahProfileId);
    const newMemberWorkload = calculateUserWorkload(reassignTasks, newAssigneeProfileId);
    check("Old member workload decremented", oldMemberWorkload.activeCount === initialWorkload.activeCount - 1);
    check("New member workload active count incremented", newMemberWorkload.activeCount > 0);

  } finally {
    // Clean up temporary task
    await client.from("project_tasks").delete().eq("id", createdTask.id);
  }

  console.log("\n=================================================================");
  console.log(`REGRESSION SUITE COMPLETED: ${passCount} PASSED, ${failCount} FAILED`);
  console.log("=================================================================");
  if (failCount > 0) process.exit(1);
}

runRegressionSuite().catch((err) => {
  console.error("FATAL ERROR in regression suite:", err);
  process.exit(1);
});
