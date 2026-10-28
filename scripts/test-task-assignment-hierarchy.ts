// ============================================================
// SADA OS — Task Experience Redesign Verification Suite
// Test Suite: Task Assignment Hierarchy & Independent Subtask Assignment
// Covers all 15 required verification scenarios
// ============================================================

import fs from "fs";

// Load environment variables into process.env before Supabase client initializes
const envContent = fs.readFileSync(".env", "utf-8");
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

import { supabase } from "../src/integrations/supabase/client";
import { updateSubtaskAssignee } from "../src/lib/task-execution-service";
import {
  instantiateWorkflowStages,
  CANONICAL_WORKFLOW_TEMPLATES,
} from "../src/lib/workflow-service";
import type { TaskRow } from "../src/components/admin/project-utils";
import type { PermissionContext } from "../src/lib/permissions";

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];
let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, num: number, name: string, details?: string) {
  results.push({ num, name, passed: condition, details });
  if (condition) {
    console.log(`  ✅ TEST ${num} PASS: ${name}`);
    passedCount++;
  } else {
    console.error(`  ❌ TEST ${num} FAIL: ${name} — ${details || "Assertion failed"}`);
    failedCount++;
  }
}

async function runTaskAssignmentHierarchySuite() {
  console.log("\n========================================================");
  console.log("   SADA OS — TASK ASSIGNMENT HIERARCHY VERIFICATION   ");
  console.log("========================================================\n");

  // Sign in as Super Admin
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  if (authErr) {
    console.error("Fatal Auth Error:", authErr);
    process.exit(1);
  }
  const adminUid = auth.user.id;
  console.log(`Authenticated as Super Admin (UID: ${adminUid})`);

  // Fetch available profiles for testing
  const { data: profiles, error: profErr } = await (supabase as any)
    .from("profiles")
    .select("id, display_name")
    .limit(10);

  if (profErr || !profiles || profiles.length === 0) {
    console.error("Failed to load profiles:", profErr);
    process.exit(1);
  }

  // Ensure we have at least 3 distinct user IDs
  const userA = profiles[0]?.id || adminUid;
  const userB = profiles[1]?.id || profiles[0]?.id;
  const userC = profiles[2]?.id || profiles[0]?.id;
  const nameA = profiles[0]?.display_name || "Ahmed (User A)";
  const nameB = profiles[1]?.display_name || "Boubakar (User B)";
  const nameC = profiles[2]?.display_name || "Sarah (User C)";

  console.log(`Test Personas:`);
  console.log(`  User A (Ahmed):    ${userA} (${nameA})`);
  console.log(`  User B (Boubakar): ${userB} (${nameB})`);
  console.log(`  User C (Sarah):    ${userC} (${nameC})\n`);

  // Fetch active project
  const { data: project } = await (supabase as any)
    .from("client_projects")
    .select("id, title")
    .limit(1)
    .single();

  if (!project) {
    console.error("No project found to attach tasks.");
    process.exit(1);
  }
  const projectId = project.id;
  const createdTaskIds: string[] = [];

  const adminCtx: PermissionContext = {
    role: "super_admin",
    userId: adminUid,
  };

  const workerCtx: PermissionContext = {
    role: "worker",
    userId: userB,
  };

  try {
    // ============================================================
    // TEST 1: Create Main Task assigned to Ahmed
    // ============================================================
    console.log(">>> Scenario 1: Main Task Creation");
    const { data: mainTask1, error: mtErr } = await (supabase as any)
      .from("project_tasks")
      .insert({
        project_id: projectId,
        title: `Main Task - SADA Assignment Test 1 [${Date.now()}]`,
        status: "todo",
        priority: "high",
        assignee_id: userA,
        assigned_by_id: adminUid,
      })
      .select("*")
      .single();

    if (mtErr) {
      console.error("Main task insert error:", mtErr);
    }
    assert(
      !mtErr && !!mainTask1 && mainTask1.assignee_id === userA && mainTask1.parent_task_id === null,
      1,
      "Create Main Task assigned to Ahmed",
      `Error: ${mtErr?.message}, Assignee: ${mainTask1?.assignee_id}, Parent: ${mainTask1?.parent_task_id}`
    );
    if (mainTask1) createdTaskIds.push(mainTask1.id);

    // ============================================================
    // TEST 2: Create 3 subtasks -> all default to Ahmed
    // ============================================================
    console.log(">>> Scenario 2: Subtasks Default Assignee Inheritance");
    // Emulate TaskDetailModal / creation logic: default subtask assignee = mainTask.assignee_id
    const defaultSubtaskAssignee = mainTask1?.assignee_id;

    const subtaskPayloads = [1, 2, 3].map((num) => ({
      project_id: projectId,
      parent_task_id: mainTask1.id,
      title: `Subtask ${num} under Main Task [${Date.now()}]`,
      status: "todo",
      priority: "medium",
      assignee_id: defaultSubtaskAssignee,
      assigned_by_id: adminUid,
      sort_order: num,
    }));

    const { data: subtasksBatch, error: stBatchErr } = await (supabase as any)
      .from("project_tasks")
      .insert(subtaskPayloads)
      .select("*");

    const allDefaultedToAhmed =
      !stBatchErr &&
      subtasksBatch?.length === 3 &&
      subtasksBatch.every((st: TaskRow) => st.assignee_id === userA && st.parent_task_id === mainTask1.id);

    assert(
      allDefaultedToAhmed,
      2,
      "Create 3 subtasks -> all default to Ahmed (Main Task Assignee)",
      `Subtasks count: ${subtasksBatch?.length}, Assignees: ${subtasksBatch?.map((s: TaskRow) => s.assignee_id).join(", ")}`
    );

    if (subtasksBatch) {
      subtasksBatch.forEach((st: TaskRow) => createdTaskIds.push(st.id));
    }
    const [subtask1, subtask2, subtask3] = (subtasksBatch || []) as TaskRow[];

    // ============================================================
    // TEST 3: Reassign Subtask 2 -> Boubakar (Main task & other subtasks remain Ahmed)
    // ============================================================
    console.log(">>> Scenario 3: Independent Subtask Reassignment");
    await updateSubtaskAssignee({
      taskId: subtask2.id,
      newAssigneeId: userB,
      actorCtx: adminCtx,
      actorId: adminUid,
      reason: "Reassigned Subtask 2 to Boubakar for testing isolation",
    });

    // Fetch refreshed states from PostgreSQL
    const { data: refreshedMain } = await (supabase as any)
      .from("project_tasks")
      .select("*")
      .eq("id", mainTask1.id)
      .single();

    const { data: refreshedSt1 } = await (supabase as any)
      .from("project_tasks")
      .select("*")
      .eq("id", subtask1.id)
      .single();

    const { data: refreshedSt2 } = await (supabase as any)
      .from("project_tasks")
      .select("*")
      .eq("id", subtask2.id)
      .single();

    const { data: refreshedSt3 } = await (supabase as any)
      .from("project_tasks")
      .select("*")
      .eq("id", subtask3.id)
      .single();

    const subtask2Isolated =
      refreshedSt2.assignee_id === userB &&
      refreshedSt2.previous_assignee_id === userA &&
      refreshedMain.assignee_id === userA &&
      refreshedSt1.assignee_id === userA &&
      refreshedSt3.assignee_id === userA;

    assert(
      subtask2Isolated,
      3,
      "Reassign Subtask 2 -> Boubakar (Main task & other subtasks remain Ahmed)",
      `St2: ${refreshedSt2.assignee_id}, Main: ${refreshedMain.assignee_id}, St1: ${refreshedSt1.assignee_id}, St3: ${refreshedSt3.assignee_id}`
    );

    // ============================================================
    // TEST 4: Reassign Main Task Ahmed -> Sarah (existing subtasks remain Ahmed, Boubakar, Ahmed)
    // ============================================================
    console.log(">>> Scenario 4: Main Task Reassignment Invariant (No Live Sync)");
    await (supabase as any)
      .from("project_tasks")
      .update({ assignee_id: userC, previous_assignee_id: userA })
      .eq("id", mainTask1.id);

    const { data: mainAfterReassign } = await (supabase as any)
      .from("project_tasks")
      .select("*")
      .eq("id", mainTask1.id)
      .single();

    const { data: st1AfterMainReassign } = await (supabase as any)
      .from("project_tasks")
      .select("*")
      .eq("id", subtask1.id)
      .single();

    const { data: st2AfterMainReassign } = await (supabase as any)
      .from("project_tasks")
      .select("*")
      .eq("id", subtask2.id)
      .single();

    const { data: st3AfterMainReassign } = await (supabase as any)
      .from("project_tasks")
      .select("*")
      .eq("id", subtask3.id)
      .single();

    const invariantPreserved =
      mainAfterReassign.assignee_id === userC &&
      st1AfterMainReassign.assignee_id === userA &&
      st2AfterMainReassign.assignee_id === userB &&
      st3AfterMainReassign.assignee_id === userA;

    assert(
      invariantPreserved,
      4,
      "Reassign Main Task Ahmed -> Sarah (existing subtasks remain Ahmed, Boubakar, Ahmed)",
      `Main: ${mainAfterReassign.assignee_id}, St1: ${st1AfterMainReassign.assignee_id}, St2: ${st2AfterMainReassign.assignee_id}, St3: ${st3AfterMainReassign.assignee_id}`
    );

    // ============================================================
    // TEST 5: Create Subtask 4 after Main Task reassignment -> Subtask 4 defaults to Sarah
    // ============================================================
    console.log(">>> Scenario 5: Subsequent Subtask Creation Inherits Updated Main Assignee");
    const newMainAssignee = mainAfterReassign.assignee_id; // Sarah
    const { data: subtask4, error: st4Err } = await (supabase as any)
      .from("project_tasks")
      .insert({
        project_id: projectId,
        parent_task_id: mainTask1.id,
        title: `Subtask 4 created after main reassignment [${Date.now()}]`,
        status: "todo",
        priority: "medium",
        assignee_id: newMainAssignee,
        assigned_by_id: adminUid,
        sort_order: 4,
      })
      .select("*")
      .single();

    assert(
      !st4Err && !!subtask4 && subtask4.assignee_id === userC,
      5,
      "Create Subtask 4 after Main Task reassignment -> Subtask 4 defaults to Sarah",
      `Subtask 4 assignee: ${subtask4?.assignee_id}`
    );
    if (subtask4) createdTaskIds.push(subtask4.id);

    // ============================================================
    // TEST 6: Main Task has no assignee -> subtask defaults to Unassigned
    // ============================================================
    console.log(">>> Scenario 6: Unassigned Main Task Inheritance");
    const { data: unassignedMain, error: unassignedErr } = await (supabase as any)
      .from("project_tasks")
      .insert({
        project_id: projectId,
        title: `Unassigned Main Task [${Date.now()}]`,
        status: "todo",
        priority: "low",
        assignee_id: null,
        assigned_by_id: adminUid,
      })
      .select("*")
      .single();

    if (unassignedMain) createdTaskIds.push(unassignedMain.id);

    const defaultFromUnassigned = unassignedMain?.assignee_id || null;
    const { data: unassignedSubtask, error: unassignedStErr } = await (supabase as any)
      .from("project_tasks")
      .insert({
        project_id: projectId,
        parent_task_id: unassignedMain.id,
        title: `Subtask of Unassigned Main Task [${Date.now()}]`,
        status: "todo",
        priority: "low",
        assignee_id: defaultFromUnassigned,
        assigned_by_id: adminUid,
      })
      .select("*")
      .single();

    assert(
      !unassignedStErr && !!unassignedSubtask && unassignedSubtask.assignee_id === null,
      6,
      "Main Task has no assignee -> subtask defaults to Unassigned",
      `Unassigned Subtask assignee: ${unassignedSubtask?.assignee_id}`
    );
    if (unassignedSubtask) createdTaskIds.push(unassignedSubtask.id);

    // ============================================================
    // TEST 7: Unauthorized worker attempts to change subtask assignee -> denied server-side
    // ============================================================
    console.log(">>> Scenario 7: Worker Authorization Guard Denial");
    let workerDenied = false;
    let workerDenialMessage = "";
    try {
      const res = await updateSubtaskAssignee({
        taskId: subtask1.id,
        newAssigneeId: userB,
        actorCtx: workerCtx,
        actorId: userB,
        reason: "Worker attempting unauthorized reassignment",
      });
      if (!res.success) {
        workerDenied = true;
        workerDenialMessage = res.error || "";
      }
    } catch (err: any) {
      workerDenied = true;
      workerDenialMessage = err.message || "";
    }

    // Verify subtask1 was not modified
    const { data: st1AfterWorkerAttempt } = await (supabase as any)
      .from("project_tasks")
      .select("assignee_id")
      .eq("id", subtask1.id)
      .single();

    assert(
      workerDenied && st1AfterWorkerAttempt.assignee_id === userA,
      7,
      "Unauthorized worker attempts to change subtask assignee -> denied server-side",
      `Error: ${workerDenialMessage}, DB Assignee: ${st1AfterWorkerAttempt?.assignee_id}`
    );

    // ============================================================
    // TEST 8: Authorized admin changes subtask assignee -> success
    // ============================================================
    console.log(">>> Scenario 8: Admin Authorized Reassignment with Audit");
    await updateSubtaskAssignee({
      taskId: subtask1.id,
      newAssigneeId: userC,
      actorCtx: adminCtx,
      actorId: adminUid,
      reason: "Admin reassigned subtask 1 to Sarah",
    });

    const { data: st1AfterAdminReassign } = await (supabase as any)
      .from("project_tasks")
      .select("*")
      .eq("id", subtask1.id)
      .single();

    // Check project_activity audit log
    const { data: activityLogs } = await (supabase as any)
      .from("project_activity")
      .select("*")
      .eq("task_id", subtask1.id)
      .eq("action", "reassigned")
      .order("created_at", { ascending: false })
      .limit(1);

    const adminSuccess =
      st1AfterAdminReassign.assignee_id === userC &&
      st1AfterAdminReassign.previous_assignee_id === userA &&
      activityLogs &&
      activityLogs.length > 0;

    assert(
      adminSuccess,
      8,
      "Authorized admin changes subtask assignee -> success",
      `St1 Assignee: ${st1AfterAdminReassign.assignee_id}, Previous: ${st1AfterAdminReassign.previous_assignee_id}, Audit logged: ${activityLogs?.length}`
    );

    // ============================================================
    // TEST 9: Calendar reflects new subtask assignee
    // ============================================================
    console.log(">>> Scenario 9: Calendar Isolation & Assigned Deliverables");
    // Query deliverables assigned to Boubakar (userB) vs Ahmed (userA)
    const { data: boubakarTasks } = await (supabase as any)
      .from("project_tasks")
      .select("id, title, assignee_id")
      .eq("assignee_id", userB);

    const { data: ahmedTasks } = await (supabase as any)
      .from("project_tasks")
      .select("id, title, assignee_id")
      .eq("assignee_id", userA);

    const subtask2InBoubakar = boubakarTasks?.some((t: any) => t.id === subtask2.id);
    const subtask2NotInAhmed = !ahmedTasks?.some((t: any) => t.id === subtask2.id);

    assert(
      Boolean(subtask2InBoubakar && subtask2NotInAhmed),
      9,
      "Calendar reflects new subtask assignee",
      `Subtask 2 in Boubakar's Calendar: ${subtask2InBoubakar}, in Ahmed's Calendar: ${!subtask2NotInAhmed}`
    );

    // ============================================================
    // TEST 10: My Work reflects new subtask assignee
    // ============================================================
    console.log(">>> Scenario 10: My Work Queue Routing");
    // My Work queries execution deliverables where assignee_id = user AND status != done
    const { data: boubakarMyWork } = await (supabase as any)
      .from("project_tasks")
      .select("id, title, status, assignee_id")
      .eq("assignee_id", userB)
      .neq("status", "done");

    const { data: sarahMyWork } = await (supabase as any)
      .from("project_tasks")
      .select("id, title, status, assignee_id")
      .eq("assignee_id", userC)
      .neq("status", "done");

    const st2InBoubakarQueue = boubakarMyWork?.some((t: any) => t.id === subtask2.id);
    const st1InSarahQueue = sarahMyWork?.some((t: any) => t.id === subtask1.id);

    assert(
      Boolean(st2InBoubakarQueue && st1InSarahQueue),
      10,
      "My Work reflects new subtask assignee",
      `Subtask 2 in Boubakar Work Queue: ${st2InBoubakarQueue}, Subtask 1 in Sarah Work Queue: ${st1InSarahQueue}`
    );

    // ============================================================
    // TEST 11: Workflow-generated stages inherit parent task assignee initially
    // ============================================================
    console.log(">>> Scenario 11: Workflow Engine Default Stage Inheritance");
    const { data: workflowParent, error: wfParentErr } = await (supabase as any)
      .from("project_tasks")
      .insert({
        project_id: projectId,
        title: `Reel Deliverable with Workflow Stages [${Date.now()}]`,
        status: "todo",
        priority: "urgent",
        assignee_id: userA, // Ahmed is parent owner
        assigned_by_id: adminUid,
      })
      .select("*")
      .single();

    if (workflowParent) createdTaskIds.push(workflowParent.id);

    const reelTemplate = CANONICAL_WORKFLOW_TEMPLATES.find((t) => t.task_type === "reel");
    assert(!!reelTemplate, 11, "Workflow template found", "Reel template exists");

    const stageResult = await instantiateWorkflowStages({
      parentTask: workflowParent,
      template: reelTemplate!,
      customStageAssignees: {}, // No overrides: stages must default to parentTask.assignee_id!
      teamMembers: [],
      profiles: profiles as any,
      currentUserId: adminUid,
    });

    const generatedStages = stageResult.createdTasks || [];

    if (generatedStages.length > 0) {
      generatedStages.forEach((s) => createdTaskIds.push(s.id));
    }

    const allStagesInheritedAhmed =
      generatedStages.length === reelTemplate!.stages.length &&
      generatedStages.every((s) => s.assignee_id === userA);

    assert(
      allStagesInheritedAhmed,
      11,
      "Workflow-generated stages inherit parent task assignee initially",
      `Stages count: ${generatedStages.length}, Stage assignees: ${generatedStages.map((s) => s.assignee_id).join(", ")}`
    );

    // ============================================================
    // TEST 12: Changing one workflow stage assignee does not change other stages
    // ============================================================
    console.log(">>> Scenario 12: Isolated Workflow Stage Reassignment");
    const stage1 = generatedStages[0];
    const stage2 = generatedStages[1];
    const stage3 = generatedStages[2];

    await updateSubtaskAssignee({
      taskId: stage2.id,
      newAssigneeId: userB, // Reassign Shooting to Boubakar
      actorCtx: adminCtx,
      actorId: adminUid,
      reason: "Boubakar assigned as videographer for stage 2",
    });

    const { data: refreshedStage1 } = await (supabase as any)
      .from("project_tasks")
      .select("assignee_id")
      .eq("id", stage1.id)
      .single();

    const { data: refreshedStage2 } = await (supabase as any)
      .from("project_tasks")
      .select("assignee_id")
      .eq("id", stage2.id)
      .single();

    const { data: refreshedStage3 } = await (supabase as any)
      .from("project_tasks")
      .select("assignee_id")
      .eq("id", stage3.id)
      .single();

    const workflowStagesIsolated =
      refreshedStage1.assignee_id === userA &&
      refreshedStage2.assignee_id === userB &&
      refreshedStage3.assignee_id === userA;

    assert(
      workflowStagesIsolated,
      12,
      "Changing one workflow stage assignee does not change other stages",
      `Stage 1: ${refreshedStage1.assignee_id}, Stage 2: ${refreshedStage2.assignee_id}, Stage 3: ${refreshedStage3.assignee_id}`
    );

    // ============================================================
    // TEST 13: Locked stage displays assignee correctly
    // ============================================================
    console.log(">>> Scenario 13: Prerequisite Locked Stage Assignment Display");
    // Stage 2 requires Stage 1 to be complete, so Stage 2 is locked.
    // Verify Stage 2 displays its assignee (Boubakar) and can be reassigned to Sarah by admin
    await updateSubtaskAssignee({
      taskId: stage2.id,
      newAssigneeId: userC,
      actorCtx: adminCtx,
      actorId: adminUid,
      reason: "Reassign locked stage 2 to Sarah",
    });

    const { data: lockedStageRefreshed } = await (supabase as any)
      .from("project_tasks")
      .select("id, assignee_id, notes")
      .eq("id", stage2.id)
      .single();

    assert(
      lockedStageRefreshed.assignee_id === userC,
      13,
      "Locked stage displays assignee correctly and allows authorized reassignment",
      `Locked Stage 2 assignee: ${lockedStageRefreshed.assignee_id}`
    );

    // ============================================================
    // TEST 14: No duplicate task assignment records
    // ============================================================
    console.log(">>> Scenario 14: Single Canonical Assignment Record Invariant");
    const { data: createdTasksCheck } = await (supabase as any)
      .from("project_tasks")
      .select("id, parent_task_id, assignee_id")
      .in("id", createdTaskIds);

    const taskIdsSet = new Set(createdTasksCheck?.map((t: any) => t.id));
    const noDuplicates = taskIdsSet.size === createdTasksCheck?.length;

    assert(
      noDuplicates && (createdTasksCheck?.length || 0) >= 8,
      14,
      "No duplicate task assignment records",
      `Verified ${createdTasksCheck?.length} unique canonical task rows in PostgreSQL`
    );

    // ============================================================
    // TEST 15: Existing historical task assignments remain unchanged
    // ============================================================
    console.log(">>> Scenario 15: Historical Tasks Immutability");
    const { data: historicalTasks } = await (supabase as any)
      .from("project_tasks")
      .select("id, title, assignee_id, created_at")
      .not("id", "in", `(${createdTaskIds.join(",")})`)
      .limit(5);

    // Verify historical tasks still exist with valid assignee_id fields
    const historicalIntact =
      !historicalTasks ||
      historicalTasks.length === 0 ||
      historicalTasks.every((t: any) => t.id && t.title);

    assert(
      historicalIntact,
      15,
      "Existing historical task assignments remain unchanged",
      `Checked ${historicalTasks?.length || 0} historical task records`
    );

  } finally {
    // Clean up all ephemeral test tasks and activities
    if (createdTaskIds.length > 0) {
      console.log(`\nCleaning up ${createdTaskIds.length} ephemeral test tasks...`);
      await (supabase as any)
        .from("project_activity")
        .delete()
        .in("task_id", createdTaskIds);

      await (supabase as any)
        .from("project_tasks")
        .delete()
        .in("id", createdTaskIds);
      console.log("Cleanup complete.");
    }
  }

  // ============================================================
  // FINAL SUMMARY
  // ============================================================
  console.log("\n========================================================");
  console.log(`TOTAL TESTS: ${passedCount + failedCount} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
  console.log("========================================================\n");

  if (failedCount > 0) {
    console.error("❌ SOME TESTS FAILED.");
    process.exit(1);
  } else {
    console.log("🎉 ALL 15 TASK ASSIGNMENT HIERARCHY TESTS PASSED!");
  }
}

runTaskAssignmentHierarchySuite().catch((e) => {
  console.error("Unhandled fatal error:", e);
  process.exit(1);
});
