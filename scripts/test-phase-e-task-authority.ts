import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { enforceDatabaseIsolation } from "./test-db-guard";
import {
  assertAuthorizedMutation,
  SecurityAuthorizationError,
  invalidateSecurityContextCache,
} from "../src/lib/security-isolation-service";
import {
  hasParentTaskAuthority,
  canCreateSubtaskForTask,
  type PermissionContext,
} from "../src/lib/permissions";
import {
  createAccount,
  deleteAccount,
  updateAccountPermissions,
} from "../src/lib/account-service";
import {
  createProjectTask,
  createProjectSubtask,
  updateProjectTaskDefinition,
  updateSubtaskAssignee,
  deleteProjectTask,
} from "../src/lib/task-execution-service";

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
  expectedCode: string,
  message: string
) {
  totalAssertions++;
  try {
    const res = await fn();
    if (res && res.success === false && res.error) {
      const errStr = String(res.error);
      const isMatch =
        errStr.includes(expectedCode) ||
        (expectedCode === "PARENT_TASK_AUTHORITY_DENIED" &&
          (errStr.includes("PARENT_TASK_AUTHORITY_DENIED") ||
            errStr.toLowerCase().includes("authority") ||
            errStr.toLowerCase().includes("parent task authority"))) ||
        (expectedCode === "UNAUTHORIZED_ACTION" &&
          (errStr.includes("UNAUTHORIZED_ACTION") ||
            errStr.toLowerCase().includes("prohibited") ||
            errStr.toLowerCase().includes("lacks") ||
            errStr.toLowerCase().includes("unauthorized")));

      if (isMatch) {
        console.log(`  ✅ PASS: ${message} (Result error matched ${expectedCode})`);
        return;
      }
    }
    console.error(`❌ FAIL: ${message} (Expected rejection with code ${expectedCode}, but operation succeeded or returned unmatched error: ${res?.error})`);
    process.exit(1);
  } catch (err: any) {
    const actualCode = err.code || err.name || err.message;
    const errStr = String(err.message || actualCode);
    const isMatch =
      actualCode === expectedCode ||
      errStr.includes(expectedCode) ||
      (expectedCode === "PARENT_TASK_AUTHORITY_DENIED" &&
        (errStr.includes("PARENT_TASK_AUTHORITY_DENIED") ||
          errStr.toLowerCase().includes("authority") ||
          errStr.toLowerCase().includes("parent task authority"))) ||
      (expectedCode === "UNAUTHORIZED_ACTION" &&
        (errStr.includes("UNAUTHORIZED_ACTION") ||
          errStr.toLowerCase().includes("prohibited") ||
          errStr.toLowerCase().includes("lacks") ||
          errStr.toLowerCase().includes("unauthorized")));

    if (!isMatch) {
      console.error(`❌ FAIL: ${message} (Expected code ${expectedCode}, but got: ${actualCode} - "${err.message}")`);
      process.exit(1);
    }
    console.log(`  ✅ PASS: ${message} (Caught expected ${expectedCode})`);
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

async function runPhaseETaskAuthoritySuite() {
  console.log("=======================================================================");
  console.log("SADA OS — PHASE E: RESOURCE-LEVEL TASK & SUBTASK AUTHORITY SUITE");
  console.log("=======================================================================\n");

  // Hardened Zero-Trust Environment Isolation Guard
  enforceDatabaseIsolation(supabaseUrl);

  // 1. Authenticate Harness as Super Admin
  const { data: saLogin, error: saLoginErr } = await superClient.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  assert(!saLoginErr && Boolean(saLogin?.user), "Harness authenticated as Super Admin (qa.superadmin@sada.agency)");
  const superAdminUserId = saLogin!.user!.id;

  const timestamp = Date.now();

  // 2. Provision Test Users
  // User A: Admin Creator (creates the parent task)
  const creatorEmail = `phasee.creator.${timestamp}@sada.agency`;
  const provCreator = await createAccount(
    {
      email: creatorEmail,
      password: "CreatorPassword123!",
      displayName: "PhaseE Admin Creator",
      role: "admin",
      division: "Operations",
      position: "Operations Lead",
      status: "active",
      modulePermissions: {
        tasks: { enabled: true, actions: { create_subtask: true, assign: true } },
      },
    },
    superClient
  );
  const creatorUserId = provCreator.user_id;

  // User B: Admin Unrelated (Admin role with permissions, but unrelated to this task)
  const unrelatedAdminEmail = `phasee.unrelated.admin.${timestamp}@sada.agency`;
  const provUnrelatedAdmin = await createAccount(
    {
      email: unrelatedAdminEmail,
      password: "UnrelatedAdminPassword123!",
      displayName: "PhaseE Unrelated Admin",
      role: "admin",
      division: "Operations",
      position: "Associate Admin",
      status: "active",
      modulePermissions: {
        tasks: { enabled: true, actions: { create_subtask: true, assign: true } },
      },
    },
    superClient
  );
  const unrelatedAdminUserId = provUnrelatedAdmin.user_id;

  // User C: Worker Assignee (Current main task assignee, granted tasks.create_subtask)
  const workerAssigneeEmail = `phasee.worker.assignee.${timestamp}@sada.agency`;
  const provWorkerAssignee = await createAccount(
    {
      email: workerAssigneeEmail,
      password: "WorkerAssigneePassword123!",
      displayName: "PhaseE Worker Main Assignee",
      role: "worker",
      division: "Production",
      position: "Senior Video Editor",
      status: "active",
      modulePermissions: {
        tasks: { enabled: true, actions: { create_subtask: true } },
      },
    },
    superClient
  );
  const workerAssigneeUserId = provWorkerAssignee.user_id;

  // User D: Worker Unrelated With Permission (has tasks.create_subtask, but no task connection)
  const workerUnrelatedEmail = `phasee.worker.unrelated.${timestamp}@sada.agency`;
  const provWorkerUnrelated = await createAccount(
    {
      email: workerUnrelatedEmail,
      password: "WorkerUnrelatedPassword123!",
      displayName: "PhaseE Worker Unrelated With Perm",
      role: "worker",
      division: "Production",
      position: "Motion Designer",
      status: "active",
      modulePermissions: {
        tasks: { enabled: true, actions: { create_subtask: true } },
      },
    },
    superClient
  );
  const workerUnrelatedUserId = provWorkerUnrelated.user_id;

  // User E: Worker Without Permission (Worker without tasks.create_subtask)
  const workerWithoutPermEmail = `phasee.worker.noperm.${timestamp}@sada.agency`;
  const provWorkerWithoutPerm = await createAccount(
    {
      email: workerWithoutPermEmail,
      password: "WorkerNoPermPassword123!",
      displayName: "PhaseE Worker Without Perm",
      role: "worker",
      division: "Production",
      position: "Sound Designer",
      status: "active",
    },
    superClient
  );
  const workerWithoutPermUserId = provWorkerWithoutPerm.user_id;

  // User F: Worker Subtask Assignee (assigned to subtask S1, has tasks.create_subtask)
  const workerSubtaskAssigneeEmail = `phasee.worker.subassignee.${timestamp}@sada.agency`;
  const provWorkerSubtaskAssignee = await createAccount(
    {
      email: workerSubtaskAssigneeEmail,
      password: "WorkerSubAssigneePassword123!",
      displayName: "PhaseE Worker Subtask Assignee",
      role: "worker",
      division: "Production",
      position: "Colorist",
      status: "active",
      modulePermissions: {
        tasks: { enabled: true, actions: { create_subtask: true } },
      },
    },
    superClient
  );
  const workerSubtaskAssigneeUserId = provWorkerSubtaskAssignee.user_id;

  // User G: Worker Reassignee (will become the new main assignee)
  const workerReassigneeEmail = `phasee.worker.reassignee.${timestamp}@sada.agency`;
  const provWorkerReassignee = await createAccount(
    {
      email: workerReassigneeEmail,
      password: "WorkerReassigneePassword123!",
      displayName: "PhaseE Worker Reassignee",
      role: "worker",
      division: "Production",
      position: "Post Production Lead",
      status: "active",
      modulePermissions: {
        tasks: { enabled: true, actions: { create_subtask: true } },
      },
    },
    superClient
  );
  const workerReassigneeUserId = provWorkerReassignee.user_id;

  // Authenticate user clients
  const creatorClient = createClient(supabaseUrl, anonKey);
  await creatorClient.auth.signInWithPassword({ email: creatorEmail, password: "CreatorPassword123!" });

  const unrelatedAdminClient = createClient(supabaseUrl, anonKey);
  await unrelatedAdminClient.auth.signInWithPassword({ email: unrelatedAdminEmail, password: "UnrelatedAdminPassword123!" });

  const workerAssigneeClient = createClient(supabaseUrl, anonKey);
  await workerAssigneeClient.auth.signInWithPassword({ email: workerAssigneeEmail, password: "WorkerAssigneePassword123!" });

  const workerUnrelatedClient = createClient(supabaseUrl, anonKey);
  await workerUnrelatedClient.auth.signInWithPassword({ email: workerUnrelatedEmail, password: "WorkerUnrelatedPassword123!" });

  const workerWithoutPermClient = createClient(supabaseUrl, anonKey);
  await workerWithoutPermClient.auth.signInWithPassword({ email: workerWithoutPermEmail, password: "WorkerNoPermPassword123!" });

  const workerSubtaskAssigneeClient = createClient(supabaseUrl, anonKey);
  await workerSubtaskAssigneeClient.auth.signInWithPassword({ email: workerSubtaskAssigneeEmail, password: "WorkerSubAssigneePassword123!" });

  const workerReassigneeClient = createClient(supabaseUrl, anonKey);
  await workerReassigneeClient.auth.signInWithPassword({ email: workerReassigneeEmail, password: "WorkerReassigneePassword123!" });

  console.log("\n[SETUP] Test users provisioned and authenticated successfully.");

  // Resolve a real project for seeding
  const { data: anyProject } = await superClient.from("client_projects").select("id").limit(1).single();
  const projectId = anyProject?.id || "00000000-0000-0000-0000-000000000001";

  // Create Parent Task: Created by Admin Creator, assigned to Worker Main Assignee
  const createParentRes = await createProjectTask({
    taskData: {
      project_id: projectId,
      title: "Phase E Parent Task (Campaign Master)",
      category: "Production",
      priority: "high",
      status: "todo",
      assigned_by_id: creatorUserId,
      assignee_id: workerAssigneeUserId,
    },
    clientOverride: creatorClient,
  });

  assert(createParentRes.success && Boolean(createParentRes.data?.id), "Parent task created successfully by Admin Creator");
  const parentTaskId = createParentRes.data!.id;

  // =======================================================================
  // [GROUP 1] Positive Authorized Subtask Creations
  // =======================================================================
  console.log("\n[GROUP 1] Positive Authorized Subtask Creations");

  // 1. Task Creator (with tasks.create_subtask) creates subtask
  const creatorSubtaskRes = await createProjectSubtask({
    parentTaskId,
    subtaskData: {
      project_id: projectId,
      title: "Subtask 1: Script Review (by Creator)",
      status: "todo",
    },
    clientOverride: creatorClient,
  });
  assert(creatorSubtaskRes.success && Boolean(creatorSubtaskRes.data?.id), "Authority 1 (Creator): Creator successfully creates subtask");
  const subtask1Id = creatorSubtaskRes.data!.id;

  // 2. Current Main Assignee (with tasks.create_subtask) creates subtask
  const mainAssigneeSubtaskRes = await createProjectSubtask({
    parentTaskId,
    subtaskData: {
      project_id: projectId,
      title: "Subtask 2: Raw Footage Ingest (by Main Assignee)",
      status: "todo",
    },
    clientOverride: workerAssigneeClient,
  });
  assert(mainAssigneeSubtaskRes.success && Boolean(mainAssigneeSubtaskRes.data?.id), "Authority 2 (Main Assignee): Current main assignee successfully creates subtask");
  const subtask2Id = mainAssigneeSubtaskRes.data!.id;

  // 3. Default Assignee Inheritance verification
  // Subtask created without explicit assignee_id must inherit parent task assignee
  assert(
    mainAssigneeSubtaskRes.data?.assignee_id === workerAssigneeUserId,
    "Inheritance Invariant: New subtask without assignee inherits parent task main assignee by default"
  );

  // 4. Super Admin (Global authority bypass) creates subtask
  const saSubtaskRes = await createProjectSubtask({
    parentTaskId,
    subtaskData: {
      project_id: projectId,
      title: "Subtask 3: Executive Oversight Stage (by Super Admin)",
      status: "todo",
    },
    clientOverride: superClient,
  });
  assert(saSubtaskRes.success && Boolean(saSubtaskRes.data?.id), "Authority 3 (Super Admin): Super Admin successfully creates subtask");
  const subtask3Id = saSubtaskRes.data!.id;

  // 5. Independent Subtask Assignment: Explicit assignee is preserved
  const independentSubtaskRes = await createProjectSubtask({
    parentTaskId,
    subtaskData: {
      project_id: projectId,
      title: "Subtask 4: Color Grading (Assigned to Specialist)",
      status: "todo",
      assignee_id: workerSubtaskAssigneeUserId,
    },
    clientOverride: creatorClient,
  });
  assert(
    independentSubtaskRes.success && independentSubtaskRes.data?.assignee_id === workerSubtaskAssigneeUserId,
    "Independent Assignment Invariant: Explicit subtask assignee is respected without overriding"
  );
  const subtask4Id = independentSubtaskRes.data!.id;

  // =======================================================================
  // [GROUP 2] Negative Unauthorized Subtask Creations
  // =======================================================================
  console.log("\n[GROUP 2] Negative Unauthorized Subtask Creations");

  // 6. Unrelated Admin with permission (Has tasks.create_subtask, but NOT creator, NOT main assignee)
  await assertThrowsAsync(
    () =>
      createProjectSubtask({
        parentTaskId,
        subtaskData: {
          project_id: projectId,
          title: "Illegal Subtask by Unrelated Admin",
          status: "todo",
        },
        clientOverride: unrelatedAdminClient,
      }),
    "PARENT_TASK_AUTHORITY_DENIED",
    "Unrelated Admin with permission is rejected with PARENT_TASK_AUTHORITY_DENIED"
  );

  // 7. Unrelated Worker with permission (Has tasks.create_subtask, but NOT creator, NOT main assignee)
  await assertThrowsAsync(
    () =>
      createProjectSubtask({
        parentTaskId,
        subtaskData: {
          project_id: projectId,
          title: "Illegal Subtask by Unrelated Worker",
          status: "todo",
        },
        clientOverride: workerUnrelatedClient,
      }),
    "PARENT_TASK_AUTHORITY_DENIED",
    "Unrelated Worker with permission is rejected with PARENT_TASK_AUTHORITY_DENIED"
  );

  // 8. User without permission (Lacks tasks.create_subtask)
  await assertThrowsAsync(
    () =>
      createProjectSubtask({
        parentTaskId,
        subtaskData: {
          project_id: projectId,
          title: "Illegal Subtask by Worker Without Permission",
          status: "todo",
        },
        clientOverride: workerWithoutPermClient,
      }),
    "UNAUTHORIZED_ACTION",
    "User without tasks.create_subtask is rejected with UNAUTHORIZED_ACTION"
  );

  // 9. Subtask Assignee does NOT gain parent authority
  // workerSubtaskAssignee is assigned to Subtask 4, but is NOT creator or main assignee of parent
  await assertThrowsAsync(
    () =>
      createProjectSubtask({
        parentTaskId,
        subtaskData: {
          project_id: projectId,
          title: "Illegal Subtask by Subtask Assignee",
          status: "todo",
        },
        clientOverride: workerSubtaskAssigneeClient,
      }),
    "PARENT_TASK_AUTHORITY_DENIED",
    "Subtask Assignee attempting to create another subtask is rejected with PARENT_TASK_AUTHORITY_DENIED"
  );

  // =======================================================================
  // [GROUP 3] Parent Task Reassignment & Historical Ownership Invariants
  // =======================================================================
  console.log("\n[GROUP 3] Parent Task Reassignment & Historical Ownership Invariants");

  // Reassign parent task from workerAssignee to workerReassignee
  const reassignParentRes = await updateProjectTaskDefinition({
    taskId: parentTaskId,
    updates: {
      assignee_id: workerReassigneeUserId,
    },
    clientOverride: superClient,
  });
  assert(reassignParentRes.success, "Parent task successfully reassigned to new main assignee");

  // Invariant A: Historical subtask ownership is NOT rewritten
  const { data: checkSubtask2 } = await superClient
    .from("project_tasks")
    .select("assignee_id")
    .eq("id", subtask2Id)
    .single();
  assert(
    checkSubtask2?.assignee_id === workerAssigneeUserId,
    "Historical Ownership Invariant: Reassigning parent task does NOT rewrite historical subtask assignees"
  );

  // Invariant B: New main assignee GAINS parent authority
  const newAssigneeSubtaskRes = await createProjectSubtask({
    parentTaskId,
    subtaskData: {
      project_id: projectId,
      title: "Subtask 5: Audio Mastering (by New Main Assignee)",
      status: "todo",
    },
    clientOverride: workerReassigneeClient,
  });
  assert(
    newAssigneeSubtaskRes.success && Boolean(newAssigneeSubtaskRes.data?.id),
    "Authority Transfer Invariant: New main assignee successfully creates subtask"
  );
  assert(
    newAssigneeSubtaskRes.data?.assignee_id === workerReassigneeUserId,
    "Inheritance Invariant: New subtask created by new main assignee defaults to new main assignee"
  );
  const subtask5Id = newAssigneeSubtaskRes.data!.id;

  // Invariant C: Previous main assignee LOSES parent authority (since not creator)
  await assertThrowsAsync(
    () =>
      createProjectSubtask({
        parentTaskId,
        subtaskData: {
          project_id: projectId,
          title: "Illegal Subtask by Previous Main Assignee",
          status: "todo",
        },
        clientOverride: workerAssigneeClient,
      }),
    "PARENT_TASK_AUTHORITY_DENIED",
    "Authority Revocation Invariant: Previous main assignee loses parent authority after parent reassignment"
  );

  // Invariant D: Creator STILL retains authority even after parent reassignment
  const creatorPostReassignRes = await createProjectSubtask({
    parentTaskId,
    subtaskData: {
      project_id: projectId,
      title: "Subtask 6: Final QA Check (by Creator post-reassignment)",
      status: "todo",
    },
    clientOverride: creatorClient,
  });
  assert(
    creatorPostReassignRes.success && Boolean(creatorPostReassignRes.data?.id),
    "Creator Permanence Invariant: Creator retains parent authority after parent task reassignment"
  );
  const subtask6Id = creatorPostReassignRes.data!.id;

  // =======================================================================
  // [GROUP 4] Independent Subtask Reassignment
  // =======================================================================
  console.log("\n[GROUP 4] Independent Subtask Reassignment");

  // Reassign Subtask 4 from workerSubtaskAssignee to workerUnrelated
  const reassignSubtaskRes = await updateSubtaskAssignee({
    taskId: subtask4Id,
    newAssigneeId: workerUnrelatedUserId,
    actorCtx: {
      userId: superAdminUserId,
      role: "super_admin",
    },
    clientOverride: superClient,
  });
  assert(reassignSubtaskRes.success, "Subtask successfully reassigned independently via updateSubtaskAssignee");

  // Invariant: Parent task assignee remains workerReassignee
  const { data: checkParent } = await superClient
    .from("project_tasks")
    .select("assignee_id")
    .eq("id", parentTaskId)
    .single();
  assert(
    checkParent?.assignee_id === workerReassigneeUserId,
    "Subtask Independence Invariant: Reassigning a subtask leaves parent task assignee completely untouched"
  );

  // Invariant: Sibling subtasks remain untouched
  const { data: checkSubtask1 } = await superClient
    .from("project_tasks")
    .select("assignee_id")
    .eq("id", subtask1Id)
    .single();
  assert(
    checkSubtask1?.assignee_id === workerAssigneeUserId || checkSubtask1?.assignee_id === null || checkSubtask1?.assignee_id === creatorUserId,
    "Subtask Independence Invariant: Sibling subtasks are completely unaffected by subtask reassignment"
  );

  // =======================================================================
  // [GROUP 5] Global Permission Revocation (Formula: global perm AND parent authority)
  // =======================================================================
  console.log("\n[GROUP 5] Global Permission Revocation");

  // Revoke tasks.create_subtask from workerReassignee (even though still main assignee)
  await updateAccountPermissions(
    workerReassigneeUserId,
    {
      tasks: { enabled: true, actions: { create_subtask: false } },
    },
    superClient
  );
  invalidateSecurityContextCache(workerReassigneeUserId);

  await assertThrowsAsync(
    () =>
      createProjectSubtask({
        parentTaskId,
        subtaskData: {
          project_id: projectId,
          title: "Illegal Subtask by Main Assignee With Revoked Permission",
          status: "todo",
        },
        clientOverride: workerReassigneeClient,
      }),
    "UNAUTHORIZED_ACTION",
    "Formula Invariant: Main assignee with tasks.create_subtask revoked is blocked with UNAUTHORIZED_ACTION"
  );

  // =======================================================================
  // [GROUP 6] Database Engine Defense (Trigger & RLS Direct Bypass Defense)
  // =======================================================================
  console.log("\n[GROUP 6] Database Engine Defense (Trigger & RLS Direct Bypass Defense)");

  // Attempt direct SQL insert bypassing API via unrelatedAdminClient
  await assertThrowsAsync(
    async () => {
      const { data, error } = await unrelatedAdminClient.from("project_tasks").insert({
        project_id: projectId,
        parent_task_id: parentTaskId,
        title: "Direct SQL Injection / API Bypass Subtask",
        status: "todo",
      }).select().single();
      if (error) throw error;
      return { success: true, data };
    },
    "PARENT_TASK_AUTHORITY_DENIED",
    "Database trigger / RLS blocks direct client insert lacking parent task authority"
  );

  // Attempt direct SQL insert as workerWithoutPermClient
  await assertThrowsAsync(
    async () => {
      const { data, error } = await workerWithoutPermClient.from("project_tasks").insert({
        project_id: projectId,
        parent_task_id: parentTaskId,
        title: "Direct SQL Insert Without Permission",
        status: "todo",
      }).select().single();
      if (error) throw error;
      return { success: true, data };
    },
    "UNAUTHORIZED_ACTION",
    "Database trigger / RLS blocks direct client insert lacking global permission"
  );

  // =======================================================================
  // [GROUP 7] Authority-Sensitive Audit Logging
  // =======================================================================
  console.log("\n[GROUP 7] Authority-Sensitive Audit Logging");

  const { data: taskActivities } = await superClient
    .from("project_activity")
    .select("action, task_id, details")
    .eq("project_id", projectId);

  const subtaskCreatedLogs = (taskActivities || []).filter(a => a.action === "subtask_created");
  assert(
    subtaskCreatedLogs.length >= 4,
    `Audit Trail Invariant: Found ${subtaskCreatedLogs.length} authoritative 'subtask_created' activity logs in project_activity`
  );

  // =======================================================================
  // [CLEANUP]
  // =======================================================================
  console.log("\n[CLEANUP] Deleting test tasks and ephemeral accounts...");
  const subtaskIds = [subtask1Id, subtask2Id, subtask3Id, subtask4Id, subtask5Id, subtask6Id];
  for (const stId of subtaskIds) {
    if (stId) await deleteProjectTask({ taskId: stId, clientOverride: superClient });
  }
  if (parentTaskId) await deleteProjectTask({ taskId: parentTaskId, clientOverride: superClient });

  const testUserIds = [
    creatorUserId,
    unrelatedAdminUserId,
    workerAssigneeUserId,
    workerUnrelatedUserId,
    workerWithoutPermUserId,
    workerSubtaskAssigneeUserId,
    workerReassigneeUserId,
  ];

  for (const uid of testUserIds) {
    try {
      await deleteAccount(uid, superClient);
    } catch (e) {
      // Non-fatal cleanup
    }
  }

  console.log("\n=======================================================================");
  console.log(`🎉 PHASE E COMPLETE: All ${totalAssertions} assertions passed successfully!`);
  console.log("=======================================================================\n");
}

runPhaseETaskAuthoritySuite().catch((err) => {
  console.error("FATAL ERROR in Phase E Suite:", err);
  process.exit(1);
});
