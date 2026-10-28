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
  updateProjectTaskDefinition,
  updateTaskPriority,
  updateTaskDueDate,
  assignProjectTask,
  addTaskDeliverable,
  updateTaskStatus,
  startTask,
  pauseTask,
  completeTask,
  deleteProjectTask,
  bulkUpdateTasksStatus,
  bulkAssignTasks,
  bulkDeleteTasks,
  fetchTaskActivity,
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
        errStr.includes("cannot execute") ||
        errStr.includes("only super admin")
      ) {
        console.log(`  ✅ PASS: ${message} (Result error matched: ${res.error})`);
        return;
      }
    }
    console.error(
      `❌ FAIL: ${message} (Expected rejection matching "${expectedPattern}", but operation succeeded: ${JSON.stringify(
        res
      )})`
    );
    process.exit(1);
  } catch (err: any) {
    const errStr = String(err.message || err.code || "").toLowerCase();
    if (
      errStr.includes(expectedPattern.toLowerCase()) ||
      errStr.includes("unauthorized") ||
      errStr.includes("forbidden") ||
      errStr.includes("securityauthorizationerror") ||
      errStr.includes("only super admin")
    ) {
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

async function runPhaseGTaskActionPermissionsSuite() {
  console.log("=======================================================================");
  console.log("SADA OS — PHASE G: TASK ACTION PERMISSIONS TEST SUITE");
  console.log("=======================================================================\n");

  // 1. Authenticate Harness as Super Admin
  const { data: saLogin, error: saLoginErr } = await superClient.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  assert(!saLoginErr && Boolean(saLogin?.user), "Harness authenticated as Super Admin");
  const superAdminUserId = saLogin!.user!.id;

  const timestamp = Date.now();

  // 2. Provision Test Accounts
  // User A: Production Lead (Role: admin, full tasks permissions)
  const leadEmail = `phaseg.lead.${timestamp}@sada.agency`;
  const provLead = await createAccount(
    {
      email: leadEmail,
      password: "LeadPassword123!",
      displayName: "PhaseG Production Lead",
      role: "admin",
      division: "Production",
      position: "Creative Lead",
      status: "active",
      modulePermissions: {
        tasks: {
          enabled: true,
          actions: {
            view: true,
            create: true,
            edit: true,
            assign: true,
            create_subtask: true,
            change_status: true,
            change_priority: true,
            change_due_date: true,
            add_deliverable: true,
            complete: true,
          },
        },
      },
    },
    superClient
  );
  const leadUserId = provLead.user_id;

  // User B: Worker Assigned (Role: worker, only status, complete, add_deliverable, view)
  const assignedWorkerEmail = `phaseg.assigned.${timestamp}@sada.agency`;
  const provAssignedWorker = await createAccount(
    {
      email: assignedWorkerEmail,
      password: "AssignedPassword123!",
      displayName: "PhaseG Assigned Worker",
      role: "worker",
      division: "Production",
      position: "Senior Designer",
      status: "active",
      modulePermissions: {
        tasks: {
          enabled: true,
          actions: {
            view: true,
            create: false,
            edit: false,
            delete: false,
            assign: false,
            create_subtask: false,
            change_status: true,
            change_priority: false,
            change_due_date: false,
            add_deliverable: true,
            complete: true,
          },
        },
      },
    },
    superClient
  );
  const assignedWorkerUserId = provAssignedWorker.user_id;

  // User C: Worker Bystander (Role: worker, cannot touch tasks they aren't assigned to)
  const bystanderEmail = `phaseg.bystander.${timestamp}@sada.agency`;
  const provBystander = await createAccount(
    {
      email: bystanderEmail,
      password: "BystanderPassword123!",
      displayName: "PhaseG Worker Bystander",
      role: "worker",
      division: "Marketing",
      position: "Copywriter",
      status: "active",
      modulePermissions: {
        tasks: {
          enabled: true,
          actions: {
            view: true,
            change_status: true,
            complete: true,
            add_deliverable: true,
          },
        },
      },
    },
    superClient
  );
  const bystanderUserId = provBystander.user_id;

  // User D: Restricted User (Role: worker, tasks module disabled)
  const restrictedEmail = `phaseg.restricted.${timestamp}@sada.agency`;
  const provRestricted = await createAccount(
    {
      email: restrictedEmail,
      password: "RestrictedPassword123!",
      displayName: "PhaseG Restricted User",
      role: "worker",
      division: "Operations",
      position: "Office Assistant",
      status: "active",
      modulePermissions: {
        tasks: {
          enabled: false,
        },
      },
    },
    superClient
  );
  const restrictedUserId = provRestricted.user_id;

  // 3. Resolve Project
  const { data: anyProject } = await superClient
    .from("client_projects")
    .select("id, client_id, client_name")
    .limit(1)
    .single();
  const projectId = anyProject?.id;
  const clientId = anyProject?.client_id;

  let mainTaskId: string | null = null;
  let subtaskId: string | null = null;
  const createdTaskIds: string[] = [];

  try {
    // -------------------------------------------------------------------------
    // TEST 1: tasks.create (Top-Level Task Creation)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 1: tasks.create (Top-Level Task Creation) ---");

    // Positive: Admin creates top-level task
    const createRes = await createProjectTask({
      taskData: {
        project_id: projectId,
        client_id: clientId,
        title: "Phase G Master Campaign Task",
        description: "Primary creative pipeline deliverable",
        status: "todo",
        priority: "high",
        deadline: "2026-11-15",
        due_date: "2026-11-15",
        assignee_id: assignedWorkerUserId,
        assigned_by_id: leadUserId,
        created_by: leadUserId,
      },
      actorId: leadUserId,
      actorRole: "admin",
      clientOverride: superClient,
    });
    assert(createRes.success && Boolean(createRes.data?.id), "Authorized Admin created top-level task (tasks.create)");
    mainTaskId = createRes.data!.id;
    createdTaskIds.push(mainTaskId);

    // Negative: Worker Assigned attempts to create top-level task
    await assertThrowsAsync(
      () =>
        createProjectTask({
          taskData: {
            project_id: projectId,
            client_id: clientId,
            title: "Illicit Worker Top-Level Task",
            status: "todo",
            priority: "low",
          },
          actorId: assignedWorkerUserId,
          actorRole: "worker",
          clientOverride: superClient,
        }),
      "tasks.create",
      "Worker Assigned denied creating top-level task without tasks.create"
    );

    // Negative: Restricted Worker attempts to create top-level task
    await assertThrowsAsync(
      () =>
        createProjectTask({
          taskData: {
            project_id: projectId,
            title: "Restricted User Task",
            status: "todo",
          },
          actorId: restrictedUserId,
          actorRole: "worker",
          clientOverride: superClient,
        }),
      "unauthorized",
      "Restricted User denied creating top-level task"
    );

    // -------------------------------------------------------------------------
    // TEST 2: tasks.create_subtask & Parent Task Authority
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 2: tasks.create_subtask & Parent Task Authority ---");

    // Positive: Admin with parent authority creates subtask
    const subtaskRes = await createProjectSubtask({
      parentTaskId: mainTaskId,
      subtaskData: {
        project_id: projectId,
        client_id: clientId,
        title: "Phase G Subtask: Visual Identity Draft",
        status: "todo",
        priority: "medium",
        deadline: "2026-11-10",
        due_date: "2026-11-10",
        assignee_id: assignedWorkerUserId,
        created_by: leadUserId,
      },
      actorId: leadUserId,
      actorRole: "admin",
      clientOverride: superClient,
    });
    assert(subtaskRes.success && Boolean(subtaskRes.data?.id), "Admin with parent authority created subtask (tasks.create_subtask)");
    subtaskId = subtaskRes.data!.id;
    createdTaskIds.push(subtaskId);

    // Negative: Worker Bystander (not creator/assignee, lacks parent authority) denied subtask creation
    await assertThrowsAsync(
      () =>
        createProjectSubtask({
          parentTaskId: mainTaskId,
          subtaskData: {
            project_id: projectId,
            title: "Illicit Subtask by Bystander",
            status: "todo",
          },
          actorId: bystanderUserId,
          actorRole: "worker",
          clientOverride: superClient,
        }),
      "parent",
      "Worker Bystander denied creating subtask (lacks parent task authority)"
    );

    // Bypass check: Calling createProjectTask with parent_task_id routes to subtask check
    await assertThrowsAsync(
      () =>
        createProjectTask({
          taskData: {
            project_id: projectId,
            title: "Bypass Attempt: Subtask via createProjectTask",
            parent_task_id: mainTaskId,
            status: "todo",
          },
          actorId: bystanderUserId,
          actorRole: "worker",
          clientOverride: superClient,
        }),
      "unauthorized",
      "createProjectTask automatically enforces subtask authority when parent_task_id is present"
    );

    // -------------------------------------------------------------------------
    // TEST 3: tasks.edit (Task Definition Changes)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 3: tasks.edit (Task Definition Changes) ---");

    // Positive: Admin updates task definition
    const editRes = await updateProjectTaskDefinition({
      taskId: mainTaskId,
      updates: {
        title: "Phase G Master Campaign Task (Updated Title)",
        description: "Updated authoritative task description",
        category: "Creative Direction",
      },
      actorId: leadUserId,
      actorRole: "admin",
      clientOverride: superClient,
    });
    assert(editRes.success && editRes.data?.title === "Phase G Master Campaign Task (Updated Title)", "Admin updated task definition (tasks.edit)");

    // Negative: Worker Assigned attempts definition change
    await assertThrowsAsync(
      () =>
        updateProjectTaskDefinition({
          taskId: mainTaskId,
          updates: {
            title: "Worker Illicit Title Override",
          },
          actorId: assignedWorkerUserId,
          actorRole: "worker",
          clientOverride: superClient,
        }),
      "tasks.edit",
      "Worker Assigned denied updating task definition without tasks.edit"
    );

    // Negative: Worker Bystander attempts definition change
    await assertThrowsAsync(
      () =>
        updateProjectTaskDefinition({
          taskId: mainTaskId,
          updates: {
            description: "Bystander injected description",
          },
          actorId: bystanderUserId,
          actorRole: "worker",
          clientOverride: superClient,
        }),
      "tasks.edit",
      "Worker Bystander denied updating task definition without tasks.edit"
    );

    // -------------------------------------------------------------------------
    // TEST 4: tasks.assign (Task & Subtask Assignment)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 4: tasks.assign (Assignment & Reassignment) ---");

    // Positive: Admin reassigns task
    const assignRes = await assignProjectTask({
      taskId: subtaskId,
      assigneeId: assignedWorkerUserId,
      reason: "Lead confirmed assignment to specialist",
      actorId: leadUserId,
      actorRole: "admin",
      clientOverride: superClient,
    });
    assert(assignRes.success && assignRes.data?.assignee_id === assignedWorkerUserId, "Admin assigned subtask via assignProjectTask (tasks.assign)");

    // Negative: Worker Assigned attempts to reassign task
    await assertThrowsAsync(
      () =>
        assignProjectTask({
          taskId: subtaskId,
          assigneeId: bystanderUserId,
          actorId: assignedWorkerUserId,
          actorRole: "worker",
          clientOverride: superClient,
        }),
      "tasks.assign",
      "Worker Assigned denied reassigning subtask without tasks.assign"
    );

    // Negative: Sneak attempt through updateProjectTaskDefinition with assignee_id
    await assertThrowsAsync(
      () =>
        updateProjectTaskDefinition({
          taskId: subtaskId,
          updates: { assignee_id: bystanderUserId },
          actorId: assignedWorkerUserId,
          actorRole: "worker",
          clientOverride: superClient,
        }),
      "tasks.assign",
      "updateProjectTaskDefinition blocks sneak assignee_id modification without tasks.assign"
    );

    // -------------------------------------------------------------------------
    // TEST 5: tasks.change_priority
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 5: tasks.change_priority ---");

    // Positive: Admin updates priority
    const priorityRes = await updateTaskPriority({
      taskId: mainTaskId,
      priority: "urgent",
      actorId: leadUserId,
      actorRole: "admin",
      clientOverride: superClient,
    });
    assert(priorityRes.success && priorityRes.data?.priority === "urgent", "Admin updated priority to urgent (tasks.change_priority)");

    // Negative: Worker Assigned attempts to change priority
    await assertThrowsAsync(
      () =>
        updateTaskPriority({
          taskId: mainTaskId,
          priority: "low",
          actorId: assignedWorkerUserId,
          actorRole: "worker",
          clientOverride: superClient,
        }),
      "tasks.change_priority",
      "Worker Assigned denied updating priority without tasks.change_priority"
    );

    // Negative: Sneak attempt through updateProjectTaskDefinition with priority
    await assertThrowsAsync(
      () =>
        updateProjectTaskDefinition({
          taskId: mainTaskId,
          updates: { priority: "low" },
          actorId: assignedWorkerUserId,
          actorRole: "worker",
          clientOverride: superClient,
        }),
      "tasks.change_priority",
      "updateProjectTaskDefinition blocks sneak priority modification without tasks.change_priority"
    );

    // -------------------------------------------------------------------------
    // TEST 6: tasks.change_due_date
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 6: tasks.change_due_date ---");

    // Positive: Admin updates due date
    const dueDateRes = await updateTaskDueDate({
      taskId: mainTaskId,
      dueDate: "2026-12-01",
      reason: "Client agreed to production extension",
      actorId: leadUserId,
      actorRole: "admin",
      clientOverride: superClient,
    });
    assert(dueDateRes.success && dueDateRes.data?.due_date === "2026-12-01", "Admin updated due date to 2026-12-01 (tasks.change_due_date)");

    // Negative: Worker Assigned attempts to change due date
    await assertThrowsAsync(
      () =>
        updateTaskDueDate({
          taskId: mainTaskId,
          dueDate: "2027-01-01",
          actorId: assignedWorkerUserId,
          actorRole: "worker",
          clientOverride: superClient,
        }),
      "tasks.change_due_date",
      "Worker Assigned denied updating due date without tasks.change_due_date"
    );

    // Negative: Sneak attempt through updateProjectTaskDefinition with deadline
    await assertThrowsAsync(
      () =>
        updateProjectTaskDefinition({
          taskId: mainTaskId,
          updates: { deadline: "2027-01-01" },
          actorId: assignedWorkerUserId,
          actorRole: "worker",
          clientOverride: superClient,
        }),
      "tasks.change_due_date",
      "updateProjectTaskDefinition blocks sneak deadline modification without tasks.change_due_date"
    );

    // -------------------------------------------------------------------------
    // TEST 7: tasks.add_deliverable (Deliverable / Asset Attachment)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 7: tasks.add_deliverable ---");

    // Positive: Worker Assigned attaches deliverable to their task
    const deliverableRes = await addTaskDeliverable({
      taskId: mainTaskId,
      deliverableUrl: "https://drive.google.com/file/d/phase-g-master-asset/view",
      notes: "Primary 4K render master file",
      actorId: assignedWorkerUserId,
      actorRole: "worker",
      clientOverride: superClient,
    });
    assert(deliverableRes.success && Boolean(deliverableRes.data?.result_links?.length), "Assigned Worker added deliverable to assigned task (tasks.add_deliverable)");

    // Negative: Worker Bystander (not assigned to task) attempts to attach deliverable
    await assertThrowsAsync(
      () =>
        addTaskDeliverable({
          taskId: mainTaskId,
          deliverableUrl: "https://drive.google.com/file/d/illicit-bystander-file/view",
          actorId: bystanderUserId,
          actorRole: "worker",
          clientOverride: superClient,
        }),
      "scope",
      "Worker Bystander denied attaching deliverable to task not assigned to them"
    );

    // -------------------------------------------------------------------------
    // TEST 8: tasks.change_status (Workflow Progressions)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 8: tasks.change_status (Status Transitions) ---");

    // Positive: Worker Assigned transitions task: todo -> in_progress
    const startRes = await startTask({
      task: { ...createRes.data!, assignee_id: assignedWorkerUserId },
      actorId: assignedWorkerUserId,
      actorRole: "worker",
      clientOverride: superClient,
    });
    assert(startRes.success && startRes.updatedTask?.status === "in_progress", "Assigned Worker started task (todo -> in_progress)");

    // Positive: Worker Assigned pauses task: in_progress -> paused
    const pauseRes = await pauseTask({
      task: { ...createRes.data!, status: "in_progress", assignee_id: assignedWorkerUserId },
      actorId: assignedWorkerUserId,
      actorRole: "worker",
      usePausedStatus: true,
      reason: "Awaiting color grading approval",
      clientOverride: superClient,
    });
    assert(pauseRes.success && pauseRes.updatedTask?.status === "paused", "Assigned Worker paused task (in_progress -> paused)");

    // Negative: Worker Bystander denied transitioning status on someone else's task
    await assertThrowsAsync(
      () =>
        startTask({
          task: { ...createRes.data!, status: "paused", assignee_id: assignedWorkerUserId },
          actorId: bystanderUserId,
          actorRole: "worker",
          clientOverride: superClient,
        }),
      "scope",
      "Worker Bystander denied transitioning status on unassigned task"
    );

    // -------------------------------------------------------------------------
    // TEST 9: tasks.complete (Task & Subtask Completion)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 9: tasks.complete (Completion Verification) ---");

    // Negative: Worker Bystander denied completing task
    await assertThrowsAsync(
      () =>
        completeTask({
          task: { ...createRes.data!, status: "in_progress", assignee_id: assignedWorkerUserId },
          actorId: bystanderUserId,
          actorRole: "worker",
          clientOverride: superClient,
        }),
      "scope",
      "Worker Bystander denied completing unassigned task"
    );

    // Positive: Worker Assigned completes assigned task
    const completeRes = await completeTask({
      task: { ...createRes.data!, status: "in_progress", assignee_id: assignedWorkerUserId },
      actorId: assignedWorkerUserId,
      actorRole: "worker",
      deliveryLinks: ["https://drive.google.com/file/d/final-render/view"],
      resultNotes: "Approved final deliverables packaged",
      clientOverride: superClient,
    });
    assert(completeRes.success && completeRes.updatedTask?.status === "done", "Assigned Worker completed task (tasks.complete)");

    // -------------------------------------------------------------------------
    // TEST 10: tasks.delete (Super Admin Exclusive Protection)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 10: tasks.delete (Super Admin Exclusivity) ---");

    // Negative: Worker Assigned attempts deletion
    await assertThrowsAsync(
      () =>
        deleteProjectTask({
          taskId: subtaskId,
          actorId: assignedWorkerUserId,
          actorRole: "worker",
          clientOverride: superClient,
        }),
      "super admin",
      "Worker Assigned denied deleting task (Super Admin only)"
    );

    // Negative: Admin Manager attempts deletion
    await assertThrowsAsync(
      () =>
        deleteProjectTask({
          taskId: subtaskId,
          actorId: leadUserId,
          actorRole: "admin",
          clientOverride: superClient,
        }),
      "super admin",
      "Admin Manager denied deleting task (Super Admin only)"
    );

    // Positive: Super Admin deletes subtask
    const delSubtaskRes = await deleteProjectTask({
      taskId: subtaskId,
      actorId: superAdminUserId,
      actorRole: "super_admin",
      clientOverride: superClient,
    });
    assert(delSubtaskRes.success, "Super Admin successfully deleted subtask");

    // -------------------------------------------------------------------------
    // TEST 11: Bulk Operations Protection
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 11: Bulk Operations Protection ---");

    // Create 2 quick tasks for bulk tests
    const bTask1 = await createProjectTask({
      taskData: { project_id: projectId, title: "Bulk Target 1", status: "todo", priority: "low" },
      actorId: leadUserId,
      actorRole: "admin",
      clientOverride: superClient,
    });
    const bTask2 = await createProjectTask({
      taskData: { project_id: projectId, title: "Bulk Target 2", status: "todo", priority: "low" },
      actorId: leadUserId,
      actorRole: "admin",
      clientOverride: superClient,
    });
    const bulkIds = [bTask1.data!.id, bTask2.data!.id];
    createdTaskIds.push(...bulkIds);

    // Positive: Admin bulk updates status
    const bulkStatusRes = await bulkUpdateTasksStatus({
      taskIds: bulkIds,
      newStatus: "in_progress",
      actorId: leadUserId,
      actorRole: "admin",
      clientOverride: superClient,
    });
    assert(bulkStatusRes.success && bulkStatusRes.updatedCount === 2, "Admin bulk updated status for 2 tasks");

    // Positive: Admin bulk assigns tasks
    const bulkAssignRes = await bulkAssignTasks({
      taskIds: bulkIds,
      assigneeId: assignedWorkerUserId,
      actorId: leadUserId,
      actorRole: "admin",
      clientOverride: superClient,
    });
    assert(bulkAssignRes.success && bulkAssignRes.updatedCount === 2, "Admin bulk assigned 2 tasks to worker");

    // Negative: Worker attempts bulk status update
    await assertThrowsAsync(
      () =>
        bulkUpdateTasksStatus({
          taskIds: bulkIds,
          newStatus: "done",
          actorId: bystanderUserId,
          actorRole: "worker",
          clientOverride: superClient,
        }),
      "unauthorized",
      "Worker Bystander denied bulk status update"
    );

    // Negative: Admin attempts bulk delete (Super Admin only)
    await assertThrowsAsync(
      () =>
        bulkDeleteTasks({
          taskIds: bulkIds,
          actorId: leadUserId,
          actorRole: "admin",
          clientOverride: superClient,
        }),
      "super admin",
      "Admin Manager denied bulk delete (Super Admin only)"
    );

    // Positive: Super Admin bulk deletes tasks
    const bulkDelRes = await bulkDeleteTasks({
      taskIds: bulkIds,
      actorId: superAdminUserId,
      actorRole: "super_admin",
      clientOverride: superClient,
    });
    assert(bulkDelRes.success && bulkDelRes.deletedCount === 2, "Super Admin successfully bulk deleted tasks");

    // -------------------------------------------------------------------------
    // TEST 12: Audit Trail Verification
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 12: Audit Trail Verification ---");

    const activities = await fetchTaskActivity(mainTaskId, superClient);
    assert(Array.isArray(activities) && activities.length > 0, "Fetched task activity logs from project_activity");
    const actionsLogged = activities.map((e: any) => e.action);

    assert(actionsLogged.includes("priority_changed"), "Audit log contains 'priority_changed'");
    assert(actionsLogged.includes("due_date_changed"), "Audit log contains 'due_date_changed'");
    assert(actionsLogged.includes("deliverable_added"), "Audit log contains 'deliverable_added'");
    assert(actionsLogged.includes("task_paused"), "Audit log contains 'task_paused'");
    assert(actionsLogged.includes("completed") || actionsLogged.includes("task_completed"), "Audit log contains 'completed'");
    console.log(`  Logged actions verified: ${Array.from(new Set(actionsLogged)).join(", ")}`);

    console.log("\n=======================================================================");
    console.log(`ALL PHASE G ASSERTIONS PASSED (${totalAssertions}/${totalAssertions})!`);
    console.log("=======================================================================\n");
  } finally {
    console.log("Cleaning up test resources...");
    // Delete main task if still present
    if (mainTaskId) {
      await superClient.from("project_tasks").delete().eq("id", mainTaskId);
    }
    for (const tid of createdTaskIds) {
      await superClient.from("project_tasks").delete().eq("id", tid);
    }
    // Delete provisioned accounts
    await deleteAccount(leadUserId, superClient).catch(() => {});
    await deleteAccount(assignedWorkerUserId, superClient).catch(() => {});
    await deleteAccount(bystanderUserId, superClient).catch(() => {});
    await deleteAccount(restrictedUserId, superClient).catch(() => {});
    console.log("Cleanup completed.");
  }
}

runPhaseGTaskActionPermissionsSuite().catch((err) => {
  console.error("Test Suite crashed:", err);
  process.exit(1);
});
