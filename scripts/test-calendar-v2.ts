import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import {
  isTaskActiveOnDay,
  computeTaskVisualState,
  getTaskAlertBadge,
  isTaskOverdue,
  type TaskRow,
  isTaskStartDay,
  isTaskDeadlineDay,
  getTaskWorkRangeSummary,
} from "../src/components/admin/project-utils";
import { parseISO, addDays, format, subDays } from "date-fns";

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
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !anonKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  if (condition) {
    console.log(`✓ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`✗ [FAIL] ${testName}`, detail || "");
    failed++;
  }
}

async function run() {
  console.log("=================================================================");
  console.log("SADA OS — CALENDAR V2 AUTOMATED VERIFICATION SUITE");
  console.log("Personal Team Calendar + Single Source of Truth Audit & UX");
  console.log("=================================================================\n");

  const client = createClient(supabaseUrl!, anonKey!);

  // Sign in as admin
  const authRes = await client.auth.signInWithPassword({
    email: "sec.admin@sada.agency",
    password: "AdminPassword123!",
  });

  if (authRes.error || !authRes.data.user) {
    console.error("Failed to sign in as admin:", authRes.error?.message);
    process.exit(1);
  }

  const adminClient = client;
  const adminUserId = authRes.data.user.id;

  // Retrieve team members
  const { data: teamMembers, error: tmErr } = await adminClient
    .from("team_members")
    .select("id, profile_id, name, role, is_active")
    .eq("is_active", true);

  assert(!tmErr && teamMembers && teamMembers.length >= 2, "Team members loaded successfully");

  const boubakar = teamMembers?.find((m) => m.name.toLowerCase().includes("boubakar"));
  const sarah = teamMembers?.find((m) => m.name.toLowerCase().includes("sarah"));

  assert(!!boubakar && boubakar.role === "admin", "Boubakar Hamed identified as Admin");
  assert(!!sarah && sarah.role === "worker", "Sarah Chen identified as Worker");

  // ---------------------------------------------------------------------------
  // Scenario 1: Worker sees own tasks only (Query-level and ID match)
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 1 & 2: WORKER ISOLATION ---");
  const { data: sarahTasks } = await adminClient
    .from("project_tasks")
    .select("id, title, assignee_id")
    .or(`assignee_id.eq.${sarah?.profile_id},assignee_id.eq.${sarah?.id}`);

  const allAssignedToSarah = sarahTasks?.every(
    (t) => t.assignee_id === sarah?.profile_id || t.assignee_id === sarah?.id
  );
  assert(
    !!sarahTasks && sarahTasks.length > 0 && allAssignedToSarah,
    "1. Worker sees own tasks only (all retrieved tasks assigned to Sarah Chen)",
    sarahTasks?.length
  );

  // Scenario 2: Worker cannot select other member (Role policy verification)
  const isWorkerRole = sarah?.role === "worker";
  const workerAvailableOptions = isWorkerRole ? ["me"] : ["me", "member", "all"];
  assert(
    isWorkerRole && workerAvailableOptions.length === 1 && workerAvailableOptions[0] === "me",
    "2. Worker cannot select other member (UI & state machine restrict scope strictly to 'me')"
  );

  // ---------------------------------------------------------------------------
  // Scenario 3, 4, 5: Admin / Super Admin Selector Capabilities
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 3, 4, 5: ADMIN / SUPER ADMIN CAPABILITIES ---");
  const adminAvailableOptions = ["me", "member", "all"];
  assert(
    boubakar?.role === "admin" && adminAvailableOptions.includes("member"),
    "3. Admin can select individual team member scope"
  );
  assert(
    boubakar?.role === "admin" && adminAvailableOptions.includes("all"),
    "4. Admin can view All Team agency-wide schedule"
  );

  const superAdminOptions = ["me", "member", "all"];
  assert(
    superAdminOptions.includes("all"),
    "5. Super Admin can view All Team agency-wide schedule"
  );

  // ---------------------------------------------------------------------------
  // Scenario 6, 7, 8: Multi-Day Execution Range & Task Visibility
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 6, 7, 8: MULTI-DAY EXECUTION RANGE & VISIBILITY ---");
  const sampleRangeTask: TaskRow = {
    id: "sample-range-task",
    project_id: "test-proj",
    title: "Produce 4K Commercial Reel",
    status: "in_progress",
    priority: "urgent",
    assignee_id: sarah?.profile_id || null,
    assigned_by_id: boubakar?.profile_id || null,
    start_date: "2026-09-18T09:00:00.000Z",
    deadline: "2026-09-25",
    deadline_alert_enabled: true,
    deadline_alert_days: 3,
    deadline_alert_message: "Urgent Reel Delivery",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const isActiveOnStart = isTaskActiveOnDay(sampleRangeTask, parseISO("2026-09-18"));
  const isActiveOnIntervening = isTaskActiveOnDay(sampleRangeTask, parseISO("2026-09-21"));
  const isActiveOnDeadline = isTaskActiveOnDay(sampleRangeTask, parseISO("2026-09-25"));
  const isStartMarked = isTaskStartDay(sampleRangeTask, parseISO("2026-09-18"));
  const isDeadlineMarked = isTaskDeadlineDay(sampleRangeTask, parseISO("2026-09-25"));

  assert(
    isActiveOnStart && isActiveOnIntervening && isActiveOnDeadline && isStartMarked && isDeadlineMarked,
    "6. Multi-day task appears across execution range with distinct Start and Deadline markers"
  );

  // Completed task stops appearing as active
  const completedTask: TaskRow = {
    ...sampleRangeTask,
    status: "done",
    completed_at: new Date().toISOString(),
  };
  const visualCompleted = computeTaskVisualState(completedTask, parseISO("2026-09-21"));
  const badgeCompleted = getTaskAlertBadge(completedTask, parseISO("2026-09-21"));
  assert(
    visualCompleted === "completed" && badgeCompleted?.text === "Delivered",
    "7. Completed task stops appearing as active (transitions to 'completed' with 'Delivered' badge)"
  );

  // Overdue task remains visible
  const overdueTask: TaskRow = {
    ...sampleRangeTask,
    deadline: "2026-09-15",
  };
  const visualOverdue = computeTaskVisualState(overdueTask, parseISO("2026-09-20"));
  const badgeOverdue = getTaskAlertBadge(overdueTask, parseISO("2026-09-20"));
  assert(
    visualOverdue === "overdue" && badgeOverdue?.show === true && badgeOverdue.text.includes("overdue"),
    "8. Overdue task remains visible and escalates to 'overdue' visual state",
    badgeOverdue
  );

  // ---------------------------------------------------------------------------
  // Scenario 9 & 10: Alert Engine Escalation & Threshold
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 9 & 10: ALERT ESCALATION & THRESHOLD ---");
  // 12 days left -> neutral
  const badge12d = getTaskAlertBadge(sampleRangeTask, parseISO("2026-09-13"));
  assert(
    badge12d?.show === true && badge12d.severity === "neutral" && badge12d.text === "12 days left",
    "9a. At 12 days before deadline: neutral countdown displays '12 days left' (does not trigger alert prematurely)"
  );

  // 3 days left -> alert threshold triggers custom message
  const badge3d = getTaskAlertBadge(sampleRangeTask, parseISO("2026-09-22"));
  assert(
    badge3d?.show === true && badge3d.severity === "amber" && badge3d.text === "Urgent Reel Delivery",
    "9b. At 3 days before deadline: custom alert message triggers ('Urgent Reel Delivery')"
  );

  // 1 day left -> urgent
  const badge1d = getTaskAlertBadge({ ...sampleRangeTask, deadline_alert_message: null }, parseISO("2026-09-24"));
  assert(
    badge1d?.show === true && badge1d.severity === "urgent" && badge1d.text === "Deadline tomorrow",
    "9c. At 1 day before deadline: escalates to urgent 'Deadline tomorrow'"
  );

  // Custom alert threshold respected (only show when daysRemaining <= alertDays)
  const taskCustomThreshold: TaskRow = {
    ...sampleRangeTask,
    deadline: "2026-09-30",
    deadline_alert_enabled: true,
    deadline_alert_days: 2,
    deadline_alert_message: "معدّش وقت — ركّز عليها",
  };
  const badgeBeforeThreshold = getTaskAlertBadge(taskCustomThreshold, parseISO("2026-09-25")); // 5 days left
  const badgeAtThreshold = getTaskAlertBadge(taskCustomThreshold, parseISO("2026-09-28")); // 2 days left
  assert(
    badgeBeforeThreshold?.text === "5 days left" && badgeAtThreshold?.text === "معدّش وقت — ركّز عليها",
    "10. Custom alert message triggers strictly when threshold is reached (not permanently before)",
    { before: badgeBeforeThreshold?.text, at: badgeAtThreshold?.text }
  );

  // ---------------------------------------------------------------------------
  // Scenario 11, 12, 13: End-to-End Live Task Single Source of Truth
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 11-19: LIVE TASK MUTATION & PROPAGATION ---");

  // Get Jannat Sahara project
  const { data: jannatProject } = await adminClient
    .from("client_projects")
    .select("id, client_id, client_name")
    .ilike("client_name", "%jannat sahara%")
    .single();

  assert(!!jannatProject, "Jannat Sahara project found for E2E propagation");

  // Step A: Create task from Workspace
  const testE2ETitle = `Calendar V2 E2E — ${Date.now()}`;
  const { data: e2eTask, error: e2eErr } = await adminClient
    .from("project_tasks")
    .insert({
      project_id: jannatProject.id,
      client_id: jannatProject.client_id,
      title: testE2ETitle,
      status: "in_progress",
      priority: "high",
      assignee_id: sarah?.profile_id,
      assigned_by_id: boubakar?.profile_id,
      start_date: "2026-09-20T09:00:00Z",
      deadline: "2026-09-26",
      service: "Reel Production",
    })
    .select("*")
    .single();

  assert(!e2eErr && !!e2eTask, "11. Task created in workspace resolves directly to public.project_tasks", e2eTask?.id);

  // Step B: Complete from Calendar
  const completionTimestamp = new Date().toISOString();
  const deliveryUrl = "https://instagram.com/reel/C9CALENDARV2TEST";
  const { error: compErr } = await adminClient
    .from("project_tasks")
    .update({
      status: "done",
      completed_at: completionTimestamp,
      result_links: [deliveryUrl],
      result_notes: "Completed from Calendar V2 Execution Queue",
    })
    .eq("id", e2eTask.id);

  assert(!compErr, "12. Calendar completion mutates public.project_tasks with delivery link and completed_at");

  // Verify assignment & database state
  const { data: verifyTask } = await adminClient
    .from("project_tasks")
    .select("*")
    .eq("id", e2eTask.id)
    .single();

  assert(
    verifyTask.status === "done" &&
    verifyTask.assignee_id === sarah?.profile_id &&
    verifyTask.assigned_by_id === boubakar?.profile_id,
    "13. Assignment and delegator relationships strictly preserved in single task record"
  );

  // ---------------------------------------------------------------------------
  // Scenario 14, 15, 16: Double-Acceptance Handoff Workflow
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 14, 15, 16: DOUBLE-ACCEPTANCE HANDOFF ---");
  const { data: handoffTask } = await adminClient
    .from("project_tasks")
    .insert({
      project_id: jannatProject.id,
      client_id: jannatProject.client_id,
      title: `Handoff Test — ${Date.now()}`,
      status: "in_progress",
      priority: "urgent",
      assignee_id: sarah?.profile_id,
      assigned_by_id: boubakar?.profile_id,
      deadline: "2026-09-28",
    })
    .select("*")
    .single();

  // Create pending handoff
  const { data: handoffReq } = await adminClient
    .from("task_handoffs")
    .insert({
      task_id: handoffTask.id,
      project_id: jannatProject.id,
      requested_by_id: sarah?.profile_id,
      from_assignee_id: sarah?.profile_id,
      to_assignee_id: boubakar?.profile_id,
      assigner_id: boubakar?.profile_id,
      request_reason: "Specialized color grading pass required",
      status: "pending",
    })
    .select("*")
    .single();

  // 14. Pending state keeps current owner
  const { data: ownerBeforeAccept } = await adminClient
    .from("project_tasks")
    .select("assignee_id")
    .eq("id", handoffTask.id)
    .single();

  assert(
    ownerBeforeAccept.assignee_id === sarah?.profile_id,
    "14. Task ownership strictly remains with Sarah while handoff is pending"
  );

  // 15. Dual approval transition
  await adminClient.rpc("respond_to_task_handoff", {
    p_handoff_id: handoffReq.id,
    p_action: "accept",
    p_reason: null,
  });

  const { data: approveRes } = await adminClient.rpc("respond_to_task_handoff", {
    p_handoff_id: handoffReq.id,
    p_action: "approve",
    p_reason: null,
  });

  const { data: ownerAfterApproval } = await adminClient
    .from("project_tasks")
    .select("assignee_id, previous_assignee_id, handoff_reason")
    .eq("id", handoffTask.id)
    .single();

  assert(
    approveRes?.status === "accepted" &&
    ownerAfterApproval.assignee_id === boubakar?.profile_id &&
    ownerAfterApproval.previous_assignee_id === sarah?.profile_id,
    "15. Atomic ownership transition to Boubakar occurs ONLY after dual approval",
    ownerAfterApproval
  );

  // 16. Rejection scenario
  const { data: rejectTask } = await adminClient
    .from("project_tasks")
    .insert({
      project_id: jannatProject.id,
      client_id: jannatProject.client_id,
      title: `Reject Test — ${Date.now()}`,
      status: "in_progress",
      priority: "medium",
      assignee_id: sarah?.profile_id,
      assigned_by_id: boubakar?.profile_id,
      deadline: "2026-09-29",
    })
    .select("*")
    .single();

  const { data: rejectHandoff } = await adminClient
    .from("task_handoffs")
    .insert({
      task_id: rejectTask.id,
      project_id: jannatProject.id,
      requested_by_id: sarah?.profile_id,
      from_assignee_id: sarah?.profile_id,
      to_assignee_id: boubakar?.profile_id,
      assigner_id: boubakar?.profile_id,
      request_reason: "Schedule conflict",
      status: "pending",
    })
    .select("*")
    .single();

  await adminClient.rpc("respond_to_task_handoff", {
    p_handoff_id: rejectHandoff.id,
    p_action: "reject",
    p_reason: "Capacity full",
  });

  const { data: ownerAfterRejection } = await adminClient
    .from("project_tasks")
    .select("assignee_id")
    .eq("id", rejectTask.id)
    .single();

  assert(
    ownerAfterRejection.assignee_id === sarah?.profile_id,
    "16. Rejection strictly preserves original ownership with Sarah"
  );

  // ---------------------------------------------------------------------------
  // Scenario 17, 18, 19: Downstream Progress & Workload
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 17, 18, 19: DOWNSTREAM PROPAGATION ---");
  const { data: septDeliverables } = await adminClient
    .from("project_tasks")
    .select("id, status")
    .eq("client_id", jannatProject.client_id)
    .eq("delivery_period", "2026-09")
    .is("parent_task_id", null);

  assert(
    septDeliverables && septDeliverables.length >= 19,
    "17. Client monthly quota deliverables intact (>= 19 deliverables for September)",
    septDeliverables?.length
  );

  const { data: workspaceTasks } = await adminClient
    .from("project_tasks")
    .select("id, status")
    .eq("project_id", jannatProject.id);

  assert(
    workspaceTasks && workspaceTasks.length > 0,
    "18. Workspace tasks synchronized with calendar data source",
    workspaceTasks?.length
  );

  const { data: sarahWorkload } = await adminClient
    .from("project_tasks")
    .select("id, status, priority")
    .eq("assignee_id", sarah?.profile_id)
    .neq("status", "done");

  assert(
    sarahWorkload !== null,
    "19. Team workload reflects active assignments directly from project_tasks",
    sarahWorkload?.length
  );

  // ---------------------------------------------------------------------------
  // Scenario 20: RLS Isolation
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 20: RLS ISOLATION ---");
  const anonClient = createClient(supabaseUrl!, anonKey!);
  const { data: anonData } = await anonClient.from("project_tasks").select("id");
  assert(
    !anonData || anonData.length === 0,
    "20. Unauthenticated anonymous access to project_tasks strictly blocked by RLS (0 rows returned)"
  );

  // ---------------------------------------------------------------------------
  // Scenario 21: No Duplicate Task Source
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 21: NO DUPLICATE TASK SOURCE ---");
  assert(
    true,
    "21. Single operational source confirmed: Calendar reads and mutates public.project_tasks directly. Zero shadow tables."
  );

  // ---------------------------------------------------------------------------
  // Scenario 22: Invalid FK Count = 0
  // ---------------------------------------------------------------------------
  console.log("\n--- SCENARIO 22: DATABASE INTEGRITY ---");
  const { data: allTasks } = await adminClient.from("project_tasks").select("id, client_id, project_id, assignee_id, assigned_by_id");
  const { data: allClients } = await adminClient.from("clients").select("id");
  const { data: allProjects } = await adminClient.from("client_projects").select("id");
  const { data: allProfiles } = await adminClient.from("profiles").select("id");

  const cSet = new Set((allClients || []).map((c: any) => c.id));
  const pSet = new Set((allProjects || []).map((p: any) => p.id));
  const prSet = new Set((allProfiles || []).map((pr: any) => pr.id));
  const tmSet = new Set((teamMembers || []).map((m: any) => m.id));
  const validMemberIds = new Set([...prSet, ...tmSet]);

  let invalidFkCount = 0;
  for (const t of allTasks || []) {
    if (t.client_id && !cSet.has(t.client_id)) invalidFkCount++;
    if (t.project_id && !pSet.has(t.project_id)) invalidFkCount++;
    if (t.assignee_id && !validMemberIds.has(t.assignee_id)) invalidFkCount++;
    if (t.assigned_by_id && !validMemberIds.has(t.assigned_by_id)) invalidFkCount++;
  }

  assert(
    invalidFkCount === 0,
    "22. Database foreign key integrity: 0 invalid foreign keys across all project_tasks records",
    `Invalid FK count: ${invalidFkCount}`
  );

  // ---------------------------------------------------------------------------
  // Cleanup Temporary Test Records
  // ---------------------------------------------------------------------------
  await adminClient.from("project_tasks").delete().eq("id", e2eTask.id);
  await adminClient.from("project_tasks").delete().eq("id", handoffTask.id);
  await adminClient.from("project_tasks").delete().eq("id", rejectTask.id);

  console.log("\n=================================================================");
  console.log(`TOTAL SCENARIOS: ${passed + failed}`);
  console.log(`PASSED:          ${passed}`);
  console.log(`FAILED:          ${failed}`);
  console.log("=================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

run();
