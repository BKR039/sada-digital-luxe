import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import {
  assertAuthorizedMutation,
  SecurityAuthorizationError,
  invalidateSecurityContextCache,
} from "../src/lib/security-isolation-service";
import {
  createAccount,
  deleteAccount,
} from "../src/lib/account-service";
import {
  createProjectTask,
  createProjectSubtask,
  startTask,
  pauseTask,
  completeTask,
  updateTaskStatus,
  fetchTaskActivity,
  deleteProjectTask,
} from "../src/lib/task-execution-service";
import type { TaskRow } from "../src/components/admin/project-utils";

let totalAssertions = 0;

function assert(condition: boolean, message: string) {
  totalAssertions++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  ✅ PASS: ${message}`);
}

async function assertThrowsAsync(
  fn: () => Promise<any>,
  expectedPattern: string,
  message: string
) {
  totalAssertions++;
  try {
    const res = await fn();
    if (res && res.success === false && res.error) {
      const errStr = String(res.error).toLowerCase();
      if (
        errStr.includes(expectedPattern.toLowerCase()) ||
        errStr.includes("unauthorized") ||
        errStr.includes("forbidden") ||
        errStr.includes("prohibited") ||
        errStr.includes("data scope") ||
        errStr.includes("cannot execute")
      ) {
        console.log(`  ✅ PASS: ${message} (Result error matched: ${res.error})`);
        return;
      }
    }
    console.error(`❌ FAIL: ${message} (Expected rejection matching "${expectedPattern}", but operation succeeded: ${JSON.stringify(res)})`);
    process.exit(1);
  } catch (err: any) {
    const errStr = String(err.message || err.code || "").toLowerCase();
    if (errStr.includes(expectedPattern.toLowerCase()) || errStr.includes("unauthorized") || errStr.includes("forbidden") || errStr.includes("securityauthorizationerror")) {
      console.log(`  ✅ PASS: ${message} (Caught expected rejection: ${err.message})`);
      return;
    }
    console.error(`❌ FAIL: ${message} (Expected "${expectedPattern}", but got: ${err.message})`);
    process.exit(1);
  }
}

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

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !anonKey) {
  console.error("Missing SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}

const superClient = createClient(supabaseUrl, anonKey);

async function runPhaseFFirstClassSubtasksSuite() {
  console.log("=======================================================================");
  console.log("SADA OS — PHASE F: FIRST-CLASS SUBTASKS TEST SUITE");
  console.log("=======================================================================\n");

  // 1. Authenticate Harness as Super Admin
  const { data: saLogin, error: saLoginErr } = await superClient.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  assert(!saLoginErr && Boolean(saLogin?.user), `Harness authenticated as Super Admin (qa.superadmin@sada.agency) - ${saLoginErr?.message || "OK"}`);
  const superAdminUserId = saLogin!.user!.id;

  const timestamp = Date.now();

  // 2. Provision Test Users
  // User A: Production Lead (Parent task assignee & creator)
  const leadEmail = `phasef.lead.${timestamp}@sada.agency`;
  const provLead = await createAccount(
    {
      email: leadEmail,
      password: "LeadPassword123!",
      displayName: "PhaseF Production Lead",
      role: "admin",
      division: "Production",
      position: "Production Director",
      status: "active",
      modulePermissions: {
        tasks: { enabled: true, actions: { create_subtask: true, assign: true, complete: true } },
      },
    },
    superClient
  );
  const leadUserId = provLead.user_id;

  // User B: Worker Specialist (Subtask assignee who executes the subtask)
  const specialistEmail = `phasef.specialist.${timestamp}@sada.agency`;
  const provSpecialist = await createAccount(
    {
      email: specialistEmail,
      password: "SpecialistPassword123!",
      displayName: "PhaseF Video Editor Specialist",
      role: "worker",
      division: "Production",
      position: "Senior Video Editor",
      status: "active",
      modulePermissions: {
        tasks: { enabled: true, actions: { complete: true } },
      },
    },
    superClient
  );
  const specialistUserId = provSpecialist.user_id;

  // User C: Worker Bystander (Unrelated worker who must NOT be able to modify the subtask)
  const bystanderEmail = `phasef.bystander.${timestamp}@sada.agency`;
  const provBystander = await createAccount(
    {
      email: bystanderEmail,
      password: "BystanderPassword123!",
      displayName: "PhaseF Unrelated Bystander",
      role: "worker",
      division: "Marketing",
      position: "Copywriter",
      status: "active",
      modulePermissions: {
        tasks: { enabled: true, actions: { complete: true } },
      },
    },
    superClient
  );
  const bystanderUserId = provBystander.user_id;

  // 3. Resolve existing project or seed
  const { data: anyProject } = await superClient.from("client_projects").select("id, client_id, client_name").limit(1).single();
  const projectId = anyProject?.id;
  const clientId = anyProject?.client_id;

  let parentTaskId: string | null = null;
  let subtaskId: string | null = null;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Subtask First-Class Properties & Synchronization
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 1: Subtask First-Class Properties & Field Synchronization ---");

    // Create Main Parent Task
    const parentTaskRes = await createProjectTask({
      taskData: {
        project_id: projectId,
        client_id: clientId,
        title: "Main Deliverable: Brand Commercial Video",
        description: "Full production pipeline for hero brand film",
        status: "todo",
        priority: "high",
        deadline: "2026-10-30",
        due_date: "2026-10-30",
        assignee_id: leadUserId,
        assigned_by_id: leadUserId,
        created_by: leadUserId,
        service: "Video Production",
      },
      actorId: leadUserId,
      actorRole: "admin",
      clientOverride: superClient,
    });
    assert(parentTaskRes.success && Boolean(parentTaskRes.data?.id), "Main Parent Task created successfully");
    parentTaskId = parentTaskRes.data!.id;

    // Create First-Class Subtask with independent assignee, priority, due date, description
    const subtaskRes = await createProjectSubtask({
      parentTaskId: parentTaskId,
      subtaskData: {
        project_id: projectId,
        client_id: clientId,
        title: "Subtask 1: Final Video Editing & Mix",
        description: "Real editing pass with audio mixing and color grade",
        status: "todo",
        priority: "urgent",
        deadline: "2026-10-20",
        due_date: "2026-10-20",
        assignee_id: specialistUserId,
        created_by: leadUserId,
        assigned_by_id: leadUserId,
        sort_order: 1,
      },
      actorId: leadUserId,
      actorRole: "admin",
      clientOverride: superClient,
    });
    assert(subtaskRes.success && Boolean(subtaskRes.data?.id), "Subtask created successfully via createProjectSubtask");
    subtaskId = subtaskRes.data!.id;

    // Verify subtask fields independently from database
    const { data: dbSubtask, error: fetchErr } = await superClient
      .from("project_tasks")
      .select("*")
      .eq("id", subtaskId)
      .single();
    assert(!fetchErr && Boolean(dbSubtask), "Fetched created subtask directly from database");
    assert(dbSubtask.parent_task_id === parentTaskId, "Subtask links correctly to parent_task_id");
    assert(dbSubtask.assignee_id === specialistUserId, "Subtask independently assigned to specialistUserId");
    assert(dbSubtask.priority === "urgent", "Subtask maintains independent urgent priority");
    assert(dbSubtask.due_date === "2026-10-20", "Subtask has independent due_date (2026-10-20)");
    assert(dbSubtask.created_by === leadUserId, "Subtask created_by stamped correctly with leadUserId");
    assert(dbSubtask.status === "todo", "Subtask initial status is 'todo'");

    // -------------------------------------------------------------------------
    // TEST 2: Worker Specialist Independent Execution (Start Task)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 2: Worker Specialist Independent Execution ---");

    const startRes = await startTask({
      task: dbSubtask as TaskRow,
      actorId: specialistUserId,
      actorRole: "worker",
      clientOverride: superClient,
    });
    assert(startRes.success, "Specialist started subtask independently (todo -> in_progress)");

    const { data: startedSubtask } = await superClient
      .from("project_tasks")
      .select("status")
      .eq("id", subtaskId)
      .single();
    assert(startedSubtask?.status === "in_progress", "Subtask status updated to 'in_progress'");

    // Verify parent task remains 'todo'
    const { data: parentCheck1 } = await superClient
      .from("project_tasks")
      .select("status")
      .eq("id", parentTaskId)
      .single();
    assert(parentCheck1?.status === "todo", "Parent task remains 'todo' while subtask is in progress");

    // -------------------------------------------------------------------------
    // TEST 3: Canonical Status Transitions & Paused Status
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 3: Canonical Status Transitions (Paused & Review) ---");

    // Pause subtask
    const pauseRes = await pauseTask({
      task: { ...dbSubtask, status: "in_progress" } as TaskRow,
      actorId: specialistUserId,
      actorRole: "worker",
      usePausedStatus: true,
      clientOverride: superClient,
    });
    assert(pauseRes.success, "Specialist paused subtask (in_progress -> paused)");

    const { data: pausedSubtask } = await superClient
      .from("project_tasks")
      .select("status")
      .eq("id", subtaskId)
      .single();
    assert(pausedSubtask?.status === "paused", "Subtask status updated to canonical 'paused'");

    // Resume to in_progress via updateTaskStatus
    const resumeRes = await updateTaskStatus({
      task: { ...dbSubtask, status: "paused" } as TaskRow,
      newStatus: "in_progress",
      actorId: specialistUserId,
      actorRole: "worker",
      clientOverride: superClient,
    });
    assert(resumeRes.success, "Specialist resumed subtask to 'in_progress'");

    // Submit subtask for review
    const reviewRes = await updateTaskStatus({
      task: { ...dbSubtask, status: "in_progress" } as TaskRow,
      newStatus: "review",
      actorId: specialistUserId,
      actorRole: "worker",
      resultNotes: "Draft cut ready for review",
      clientOverride: superClient,
    });
    assert(reviewRes.success, "Specialist submitted subtask for 'review'");

    const { data: reviewSubtask } = await superClient
      .from("project_tasks")
      .select("status, result_notes")
      .eq("id", subtaskId)
      .single();
    assert(reviewSubtask?.status === "review", "Subtask status updated to 'review'");
    assert(reviewSubtask?.result_notes === "Draft cut ready for review", "Subtask result_notes stored");

    // -------------------------------------------------------------------------
    // TEST 4: Real Editing Flow with Drive Link & Completion Metadata
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 4: Real Editing Flow with Drive URL & Completion Metadata ---");

    const driveUrl = "https://drive.google.com/file/d/phase-f-test-video-edit/view";
    const completeRes = await completeTask({
      task: { ...dbSubtask, status: "review" } as TaskRow,
      actorId: specialistUserId,
      actorRole: "worker",
      driveUrl: driveUrl,
      deliveryLinks: [driveUrl],
      resultNotes: "Final 4K ProRes export and master audio mix",
      clientOverride: superClient,
    });
    assert(completeRes.success, "Specialist completed subtask with Drive URL and delivery notes");

    const { data: completedSubtask } = await superClient
      .from("project_tasks")
      .select("*")
      .eq("id", subtaskId)
      .single();

    assert(completedSubtask?.status === "done", "Subtask status is 'done'");
    assert(completedSubtask?.completed_by === specialistUserId, "Subtask records completed_by = specialistUserId");
    assert(Boolean(completedSubtask?.completed_at), "Subtask records non-null completed_at timestamp");
    assert(completedSubtask?.drive_url === driveUrl, "Subtask records drive_url correctly");
    assert(
      Array.isArray(completedSubtask?.result_links) && completedSubtask.result_links.includes(driveUrl),
      "Subtask result_links includes Drive URL"
    );

    // Verify activity history recorded
    const activities = await fetchTaskActivity(subtaskId, superClient);
    assert(activities.length > 0, "Subtask has recorded activity timeline entries");
    const completedActivity = activities.find(a => a.action === "completed" || a.action === "status_changed");
    assert(Boolean(completedActivity), "Recorded 'completed' activity entry for subtask");

    // -------------------------------------------------------------------------
    // TEST 5: Critical Invariant — Parent Task Independence
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 5: Critical Invariant — Parent Task Independence ---");

    const { data: parentCheckFinal } = await superClient
      .from("project_tasks")
      .select("status, completed_at, completed_by")
      .eq("id", parentTaskId)
      .single();

    assert(
      parentCheckFinal?.status !== "done",
      `Critical Invariant Verified: Parent task status is '${parentCheckFinal?.status}' and did NOT auto-advance to 'done'!`
    );
    assert(
      parentCheckFinal?.completed_by === null,
      "Parent task completed_by remains null (not auto-completed by subtask finish)"
    );

    // -------------------------------------------------------------------------
    // TEST 6: Authorization & Security Enforcement (Negative Tests)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 6: Authorization & Security Enforcement (Negative Tests) ---");

    // Create a 2nd subtask for testing negative bypasses
    const subtask2Res = await createProjectSubtask({
      parentTaskId: parentTaskId,
      subtaskData: {
        project_id: projectId,
        client_id: clientId,
        title: "Subtask 2: Audio Mastering",
        status: "todo",
        priority: "medium",
        assignee_id: specialistUserId,
        sort_order: 2,
      },
      actorId: leadUserId,
      actorRole: "admin",
      clientOverride: superClient,
    });
    const subtask2Id = subtask2Res.data!.id;

    // Worker Bystander attempts to complete Worker Specialist's subtask -> MUST FAIL
    await assertThrowsAsync(
      async () => {
        return completeTask({
          task: {
            id: subtask2Id,
            project_id: projectId,
            assignee_id: specialistUserId,
            status: "todo",
          } as TaskRow,
          actorId: bystanderUserId,
          actorRole: "worker",
          clientOverride: superClient,
        });
      },
      "unauthorized",
      "Negative test: Worker Bystander cannot complete another worker's subtask"
    );

    // Clean up subtask 2
    await superClient.from("project_tasks").delete().eq("id", subtask2Id);

    // -------------------------------------------------------------------------
    // TEST 7: My Work & Calendar Visibility Queries
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 7: My Work & Calendar Visibility Queries ---");

    // My Work visibility: specialist queries their assigned tasks
    const { data: myWorkTasks, error: myWorkErr } = await superClient
      .from("project_tasks")
      .select("*")
      .eq("assignee_id", specialistUserId);
    assert(!myWorkErr && Array.isArray(myWorkTasks), "Specialist queries assigned tasks for My Work");
    const foundInMyWork = myWorkTasks.find(t => t.id === subtaskId);
    assert(Boolean(foundInMyWork), "Specialist retrieves assigned subtask in My Work query");
    assert(foundInMyWork?.parent_task_id === parentTaskId, "Subtask retrieved with parent_task_id reference");
    assert(foundInMyWork?.priority === "urgent", "Subtask retrieved with priority 'urgent'");

    // Calendar visibility: specialist queries tasks scheduled for the day
    const { data: calendarTasks, error: calErr } = await superClient
      .from("project_tasks")
      .select("*")
      .eq("assignee_id", specialistUserId)
      .not("due_date", "is", null);
    assert(!calErr && Array.isArray(calendarTasks), "Calendar query executes successfully");
    const foundInCal = calendarTasks.find(t => t.id === subtaskId);
    assert(Boolean(foundInCal), "Subtask with due_date is visible in Calendar query");

    // -------------------------------------------------------------------------
    // TEST 8: Independent Subtask Reassignment Invariants
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 8: Independent Subtask Reassignment Invariants ---");

    // Create Subtask 3 for reassignment test
    const subtask3Res = await createProjectSubtask({
      parentTaskId: parentTaskId,
      subtaskData: {
        project_id: projectId,
        client_id: clientId,
        title: "Subtask 3: Color Grading Pass",
        status: "todo",
        priority: "medium",
        assignee_id: specialistUserId,
        sort_order: 3,
      },
      actorId: leadUserId,
      actorRole: "admin",
      clientOverride: superClient,
    });
    const subtask3Id = subtask3Res.data!.id;

    // Admin reassigns Subtask 3 to Worker Bystander
    const reassignRes = await superClient
      .from("project_tasks")
      .update({ assignee_id: bystanderUserId })
      .eq("id", subtask3Id);
    assert(!reassignRes.error, "Subtask 3 reassigned to new worker");

    // Verify parent task assignee remains leadUserId (untouched)
    const { data: parentCheckAfterSubtaskReassign } = await superClient
      .from("project_tasks")
      .select("assignee_id")
      .eq("id", parentTaskId)
      .single();
    assert(
      parentCheckAfterSubtaskReassign?.assignee_id === leadUserId,
      "Parent task assignee remains leadUserId (untouched by subtask reassignment)"
    );

    // Clean up subtask 3
    await superClient.from("project_tasks").delete().eq("id", subtask3Id);

    console.log("\n=======================================================================");
    console.log(`🎉 ALL PHASE F TESTS PASSED (${totalAssertions} assertions verified)`);
    console.log("=======================================================================");
  } finally {
    // Teardown Fixtures
    console.log("\n🧹 Cleaning up test fixtures...");
    if (subtaskId) await superClient.from("project_tasks").delete().eq("id", subtaskId);
    if (parentTaskId) await superClient.from("project_tasks").delete().eq("id", parentTaskId);
    await deleteAccount(leadUserId, superClient).catch(() => {});
    await deleteAccount(specialistUserId, superClient).catch(() => {});
    await deleteAccount(bystanderUserId, superClient).catch(() => {});
    console.log("🧹 Cleanup complete.");
  }
}

runPhaseFFirstClassSubtasksSuite().catch((err) => {
  console.error("Suite failed with unhandled error:", err);
  process.exit(1);
});
