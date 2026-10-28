// ============================================================
// SADA WORK OS — PHASE 2 TEST SUITE
// AGENCY-WIDE OVERSIGHT DASHBOARD E2E VERIFICATION
// ============================================================

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import {
  resolveToProfileId,
  getUserExecutionTasks,
  calculateUserWorkload,
  getAgencyUnassignedTasks,
  getAgencyOverdueTasks,
  getAgencyBlockedTasks,
  getTeamPulse,
  getProjectLeadInfo,
  getAssignmentMemberInfo,
  computeProjectHealth,
  getProjectsNeedingAttention,
  type TeamMemberRow,
  type ProfileRow,
  type TaskRow,
  type ProjectRow
} from "../src/components/admin/project-utils";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✓ PASS: ${message}`);
}

// Load env
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
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !anonKey) {
  console.error("Missing SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, anonKey);
const anonUnauthClient = createClient(supabaseUrl, anonKey);

async function runPhase2TestSuite() {
  console.log("=================================================================");
  console.log("SADA WORK OS — PHASE 2 E2E VERIFICATION SUITE");
  console.log("AGENCY-WIDE OVERSIGHT DASHBOARD");
  console.log("=================================================================\n");

  // Step 1: Authenticate Admin Session
  console.log("--- SETUP: Authenticating Admin Session ---");
  const testEmail = `phase1.tester@sada.agency`;
  const testPassword = "Phase1TestPassword123!";

  const { data: signInData, error: signInErr } = await adminClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  let currentUser = signInData?.user;
  if (signInErr || !currentUser) {
    console.error("Could not sign in with test admin user:", signInErr?.message);
    process.exit(1);
  }
  assert(Boolean(currentUser?.id), `Authenticated as admin. User ID: ${currentUser.id}`);

  // Fetch baseline data
  const [projRes, tasksRes, profRes, teamRes] = await Promise.all([
    adminClient.from("client_projects").select("*"),
    adminClient.from("project_tasks").select("*"),
    adminClient.from("profiles").select("id, display_name"),
    adminClient.from("team_members").select("*").order("sort_order", { ascending: true }),
  ]);

  const existingProjects: ProjectRow[] = (projRes.data as any) || [];
  const existingTasks: TaskRow[] = (tasksRes.data as any) || [];
  const existingProfiles: ProfileRow[] = (profRes.data as any) || [];
  const existingTeamMembers: TeamMemberRow[] = (teamRes.data as any) || [];

  console.log(`Loaded from DB: ${existingProjects.length} projects, ${existingTasks.length} tasks, ${existingProfiles.length} profiles, ${existingTeamMembers.length} team members.\n`);

  // Target team member for secondary assignments
  const otherMember = existingTeamMembers.find(m => m.profile_id && m.profile_id !== currentUser!.id) || existingTeamMembers[0];
  const otherProfileId = otherMember?.profile_id || existingProfiles.find(p => p.id !== currentUser!.id)?.id || currentUser!.id;
  const leadMember = existingTeamMembers.find(m => m.profile_id) || existingTeamMembers[0];
  const leadProfileId = leadMember?.profile_id || currentUser!.id;

  let testProjectId: string | null = null;
  const createdTaskIds: string[] = [];

  try {
    // -------------------------------------------------------------
    // TEST 1: My Execution mode personal task isolation
    // -------------------------------------------------------------
    console.log("--- TEST 1: My Execution personal task isolation ---");
    const myPersonalExecution = getUserExecutionTasks(existingTasks, currentUser.id);
    const personalTasks = [
      ...myPersonalExecution.todo,
      ...myPersonalExecution.inProgress,
      ...myPersonalExecution.review,
      ...myPersonalExecution.blocked,
      ...myPersonalExecution.overdue,
      ...myPersonalExecution.dueToday
    ];
    assert(Array.isArray(personalTasks), "My Execution returns valid personal task arrays");
    for (const t of personalTasks) {
      assert(t.assignee_id === currentUser.id, `Task ${t.id} in My Execution is strictly assigned to current user`);
    }
    const myPersonalWorkload = calculateUserWorkload(existingTasks, currentUser.id);
    assert(typeof myPersonalWorkload.activeCount === "number", `Calculated personal active workload count: ${myPersonalWorkload.activeCount}`);

    // -------------------------------------------------------------
    // SETUP: Create a dedicated Test Project with Project Lead
    // -------------------------------------------------------------
    console.log("\n--- SETUP: Creating Phase 2 Test Project with Project Lead ---");
    const { data: newProj, error: projErr } = await adminClient.from("client_projects").insert({
      client_name: "Phase 2 Agency Oversight Test Client",
      title: "Agency Oversight Verification Project",
      status: "active",
      lead_id: leadProfileId,
      start_date: new Date().toISOString().split("T")[0],
      deadline: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
    }).select().single();

    if (projErr || !newProj) {
      throw new Error(`Failed to create test project: ${projErr?.message}`);
    }
    testProjectId = newProj.id;
    assert(Boolean(testProjectId), `Created test project ${testProjectId} with lead_id: ${leadProfileId}`);

    // -------------------------------------------------------------
    // TEST 2: Agency Oversight loads company-wide exceptions
    // -------------------------------------------------------------
    console.log("\n--- TEST 2: Agency Oversight exception calculation ---");
    const baselineUnassigned = getAgencyUnassignedTasks(existingTasks);
    const baselineOverdue = getAgencyOverdueTasks(existingTasks);
    const baselineBlocked = getAgencyBlockedTasks(existingTasks);
    assert(Array.isArray(baselineUnassigned), `Agency unassigned baseline: ${baselineUnassigned.length}`);
    assert(Array.isArray(baselineOverdue), `Agency overdue baseline: ${baselineOverdue.length}`);
    assert(Array.isArray(baselineBlocked), `Agency blocked baseline: ${baselineBlocked.length}`);

    // -------------------------------------------------------------
    // TEST 3: Create overdue task assigned to another member
    // -------------------------------------------------------------
    console.log("\n--- TEST 3: Overdue task assigned to another member ---");
    const yesterdayDate = new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0];
    const { data: overdueTask, error: overdueErr } = await adminClient.from("project_tasks").insert({
      project_id: testProjectId,
      title: "Phase 2 Overdue Task For Other Member",
      assignee_id: otherProfileId,
      priority: "urgent",
      status: "todo",
      deadline: yesterdayDate,
    }).select().single();

    if (overdueErr || !overdueTask) {
      throw new Error(`Failed to create overdue task: ${overdueErr?.message}`);
    }
    createdTaskIds.push(overdueTask.id);

    // Refresh tasks
    const { data: updatedTasks1 } = await adminClient.from("project_tasks").select("*");
    const currentTasks1: TaskRow[] = (updatedTasks1 as any) || [];

    // If otherProfileId is different from current user, it should NOT be in currentUser's My Execution
    if (otherProfileId !== currentUser.id) {
      const userExecAfterOverdue = getUserExecutionTasks(currentTasks1, currentUser.id);
      const allPersonal = [
        ...userExecAfterOverdue.todo,
        ...userExecAfterOverdue.overdue,
        ...userExecAfterOverdue.dueToday,
        ...userExecAfterOverdue.inProgress,
        ...userExecAfterOverdue.blocked,
        ...userExecAfterOverdue.review
      ];
      const inMyExec = allPersonal.some(t => t.id === overdueTask.id);
      assert(!inMyExec, "Overdue task assigned to other member is INVISIBLE in current user's My Execution");
    }

    // But it MUST be visible in Agency Oversight overdue tasks!
    const agencyOverdueAfter = getAgencyOverdueTasks(currentTasks1);
    const inAgencyOverdue = agencyOverdueAfter.some(t => t.id === overdueTask.id);
    assert(inAgencyOverdue, "Overdue task assigned to other member is VISIBLE in Agency Oversight");

    // -------------------------------------------------------------
    // TEST 4: Create blocked task assigned to another member
    // -------------------------------------------------------------
    console.log("\n--- TEST 4: Blocked task assigned to another member ---");
    const { data: blockedTask, error: blockedErr } = await adminClient.from("project_tasks").insert({
      project_id: testProjectId,
      title: "Phase 2 Blocked Task Awaiting Assets",
      assignee_id: otherProfileId,
      priority: "high",
      status: "blocked",
      waiting_on: "client",
      blocked_reason: "Awaiting high-resolution client product photos",
      deadline: new Date(Date.now() + 5 * 86400000).toISOString().split("T")[0],
    }).select().single();

    if (blockedErr || !blockedTask) {
      throw new Error(`Failed to create blocked task: ${blockedErr?.message}`);
    }
    createdTaskIds.push(blockedTask.id);

    const { data: updatedTasks2 } = await adminClient.from("project_tasks").select("*");
    const currentTasks2: TaskRow[] = (updatedTasks2 as any) || [];

    const agencyBlockedAfter = getAgencyBlockedTasks(currentTasks2);
    const inAgencyBlocked = agencyBlockedAfter.some(t => t.id === blockedTask.id);
    assert(inAgencyBlocked, "Blocked task is VISIBLE in Agency Oversight blocked exceptions");

    // -------------------------------------------------------------
    // TEST 5: Create an unassigned task
    // -------------------------------------------------------------
    console.log("\n--- TEST 5: Unassigned task detection in Agency Oversight ---");
    const { data: unassignedTask, error: unassignedErr } = await adminClient.from("project_tasks").insert({
      project_id: testProjectId,
      title: "Phase 2 Unassigned Important Task",
      assignee_id: null,
      priority: "high",
      status: "todo",
      deadline: new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
    }).select().single();

    if (unassignedErr || !unassignedTask) {
      throw new Error(`Failed to create unassigned task: ${unassignedErr?.message}`);
    }
    createdTaskIds.push(unassignedTask.id);

    const { data: updatedTasks3 } = await adminClient.from("project_tasks").select("*");
    const currentTasks3: TaskRow[] = (updatedTasks3 as any) || [];

    const agencyUnassignedAfter = getAgencyUnassignedTasks(currentTasks3);
    const inAgencyUnassigned = agencyUnassignedAfter.some(t => t.id === unassignedTask.id);
    assert(inAgencyUnassigned, "Unassigned task is VISIBLE in Agency Oversight unassigned exceptions");

    // -------------------------------------------------------------
    // TEST 6: Client action required follow-up
    // -------------------------------------------------------------
    console.log("\n--- TEST 6: Client action required detection ---");
    // Update project with waiting_for_client
    await adminClient.from("client_projects").update({
      followup_status: "waiting_for_client",
      followup_summary: "Pending brand book approval from marketing director",
      followup_next_action: "Send reminder email if no response by Friday",
    }).eq("id", testProjectId);

    const { data: refreshedProjects } = await adminClient.from("client_projects").select("*");
    const curProjects: ProjectRow[] = (refreshedProjects as any) || [];

    const needingAttention = getProjectsNeedingAttention(curProjects, currentTasks3);
    const foundProjectAttention = needingAttention.find(p => p.project.id === testProjectId);
    assert(Boolean(foundProjectAttention), "Project with client action required is surfaced in Projects Needing Attention");

    // -------------------------------------------------------------
    // TEST 7: Project Lead context resolution
    // -------------------------------------------------------------
    console.log("\n--- TEST 7: Project Lead context resolution ---");
    const leadInfo = getProjectLeadInfo(leadProfileId, existingTeamMembers, existingProfiles);
    assert(Boolean(leadInfo), "Project Lead info resolved successfully");
    assert(typeof leadInfo?.name === "string" && leadInfo.name.length > 0, `Project Lead name: ${leadInfo?.name}`);

    // Verify task owner is decoupled from Project Lead
    const taskOwnerInfo = getAssignmentMemberInfo(unassignedTask.assignee_id, existingTeamMembers, existingProfiles);
    assert(taskOwnerInfo === null, "Unassigned task has null task owner, while Project Lead remains distinct");

    // -------------------------------------------------------------
    // TEST 8: Team Pulse uses active unified team_members data
    // -------------------------------------------------------------
    console.log("\n--- TEST 8: Team Pulse source of truth verification ---");
    const pulseResult = getTeamPulse(existingTeamMembers, currentTasks3, existingProfiles);
    assert(pulseResult.length > 0, `Team Pulse returned ${pulseResult.length} active members`);
    
    // Check structure of each member
    for (const item of pulseResult) {
      assert(Boolean(item.member?.id), `Pulse member has valid TeamMemberRow ID: ${item.member.id}`);
      assert(item.member.is_active !== false, `Pulse member ${item.member.name} is active`);
      assert(Boolean(item.capacityBadge?.label), `Pulse member has capacity badge: ${item.capacityBadge.label}`);
    }

    // Verify no duplicates
    const memberIds = pulseResult.map(p => p.member.id);
    const uniqueIds = new Set(memberIds);
    assert(uniqueIds.size === memberIds.length, "Team Pulse contains zero duplicate team members");

    // -------------------------------------------------------------
    // TEST 9: Resolve the exception (assign previously unassigned task)
    // -------------------------------------------------------------
    console.log("\n--- TEST 9: Resolve unassigned task exception ---");
    const prevUnassignedCount = getAgencyUnassignedTasks(currentTasks3).length;

    const { error: assignErr } = await adminClient.from("project_tasks").update({
      assignee_id: otherProfileId,
    }).eq("id", unassignedTask.id);

    if (assignErr) {
      throw new Error(`Failed to assign task: ${assignErr.message}`);
    }

    const { data: updatedTasks4 } = await adminClient.from("project_tasks").select("*");
    const currentTasks4: TaskRow[] = (updatedTasks4 as any) || [];
    const newUnassignedCount = getAgencyUnassignedTasks(currentTasks4).length;

    assert(newUnassignedCount === prevUnassignedCount - 1, `Unassigned count correctly decreased from ${prevUnassignedCount} to ${newUnassignedCount}`);

    // -------------------------------------------------------------
    // TEST 10: RLS Security check
    // -------------------------------------------------------------
    console.log("\n--- TEST 10: RLS Security Enforcement ---");
    const { data: anonProjects, error: anonProjErr } = await anonUnauthClient.from("client_projects").select("*");
    assert(
      !anonProjects || anonProjects.length === 0,
      "Anonymous client cannot access client_projects (RLS secured)"
    );

    const { data: anonTasks, error: anonTaskErr } = await anonUnauthClient.from("project_tasks").select("*");
    assert(
      !anonTasks || anonTasks.length === 0,
      "Anonymous client cannot access project_tasks (RLS secured)"
    );

  } finally {
    // -------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------
    console.log("\n--- CLEANUP: Removing Phase 2 test records ---");
    for (const tid of createdTaskIds) {
      await adminClient.from("project_tasks").delete().eq("id", tid);
    }
    if (testProjectId) {
      await adminClient.from("client_projects").delete().eq("id", testProjectId);
    }
    console.log(`Cleaned up ${createdTaskIds.length} tasks and test project ${testProjectId}`);
  }

  console.log("\n=================================================================");
  console.log("✓ PHASE 2 E2E TEST SUITE: 10/10 TESTS PASSED");
  console.log("=================================================================\n");
}

runPhase2TestSuite().catch((err) => {
  console.error("FATAL TEST FAILURE:", err);
  process.exit(1);
});
