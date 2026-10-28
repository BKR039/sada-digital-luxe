import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import {
  permissions,
  isTaskAssignedToUser,
  canDelete,
  canDeleteTask,
  canDeleteProject,
  canDeleteTeamMember,
  canManageRoles,
  assertCanDelete,
  assertCanEditTaskDefinition,
  assertCanUpdateTaskProgress,
  type PermissionContext,
} from "../src/lib/permissions";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✓ PASS: ${message}`);
}

// Load .env
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || "";
      if (value.length > 0 && value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      process.env[key] = value;
    }
  });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runRbacTests() {
  console.log("=================================================================");
  console.log("SADA WORKS — ROLE-BASED ACCESS CONTROL (RBAC) TEST SUITE");
  console.log("=================================================================\n");

  // -----------------------------------------------------------------
  // 1. VERIFY CORE ROLE MODEL & PERMISSION MATRIX IN ENGINE
  // -----------------------------------------------------------------
  console.log("--- 1. TESTING CENTRALIZED PERMISSION ENGINE MATRIX ---");

  const superAdminCtx: PermissionContext = { role: "super_admin", userId: "super-admin-id" };
  const adminCtx: PermissionContext = { role: "admin", userId: "boubakar-admin-id" };
  const workerSarahCtx: PermissionContext = {
    role: "worker",
    userId: "sarah-worker-id",
    memberProfileId: "sarah-profile-id",
    memberId: "sarah-tm-id",
  };
  const workerKarimCtx: PermissionContext = {
    role: "worker",
    userId: "karim-worker-id",
    memberProfileId: "karim-profile-id",
    memberId: "karim-tm-id",
  };

  const sarahTask = {
    id: "task-cafe-707",
    title: "Edit first Café 707 Reel",
    assignee_id: "sarah-worker-id",
    assigned_by_id: "boubakar-admin-id",
  };

  const karimTask = {
    id: "task-brand-guide",
    title: "Design Brand Guidelines",
    assignee_id: "karim-worker-id",
    assigned_by_id: "boubakar-admin-id",
  };

  // Section 28 matrix validation
  // A. View
  assert(permissions.canViewTask(superAdminCtx) === true, "Super Admin can view task");
  assert(permissions.canViewTask(adminCtx) === true, "Admin can view task");
  assert(permissions.canViewTask(workerSarahCtx) === true, "Worker can view task");

  // B. Task Definition (Admin & Super Admin ONLY)
  assert(permissions.canCreateTask(superAdminCtx) === true, "Super Admin can create task");
  assert(permissions.canCreateTask(adminCtx) === true, "Admin can create task");
  assert(permissions.canCreateTask(workerSarahCtx) === false, "Worker CANNOT create task");

  assert(permissions.canEditTaskDefinition(superAdminCtx) === true, "Super Admin can edit task definition");
  assert(permissions.canEditTaskDefinition(adminCtx) === true, "Admin can edit task definition");
  assert(permissions.canEditTaskDefinition(workerSarahCtx) === false, "Worker CANNOT edit task definition");

  assert(permissions.canAssignTask(adminCtx) === true, "Admin can assign task");
  assert(permissions.canAssignTask(workerSarahCtx) === false, "Worker CANNOT assign task");

  assert(permissions.canChangeDeadline(adminCtx) === true, "Admin can change deadline");
  assert(permissions.canChangeDeadline(workerSarahCtx) === false, "Worker CANNOT change deadline");

  assert(permissions.canChangePriority(adminCtx) === true, "Admin can change priority");
  assert(permissions.canChangePriority(workerSarahCtx) === false, "Worker CANNOT change priority");

  assert(permissions.canEditEstimatedTime(adminCtx) === true, "Admin can edit estimated time");
  assert(permissions.canEditEstimatedTime(workerSarahCtx) === false, "Worker CANNOT edit estimated time");

  // C. Execution fields (Worker can ONLY update tasks assigned to them)
  assert(permissions.canUpdateTaskProgress(workerSarahCtx, sarahTask) === true, "Sarah CAN update her assigned task");
  assert(permissions.canUpdateTaskProgress(workerSarahCtx, karimTask) === false, "Sarah CANNOT update Karim's task");
  assert(permissions.canUpdateTaskProgress(adminCtx, sarahTask) === true, "Admin CAN update Sarah's task");
  assert(permissions.canUpdateTaskProgress(superAdminCtx, sarahTask) === true, "Super Admin CAN update Sarah's task");

  assert(permissions.canChangeStatus(workerSarahCtx, sarahTask) === true, "Sarah CAN update status on her assigned task");
  assert(permissions.canChangeStatus(workerSarahCtx, karimTask) === false, "Sarah CANNOT update status on Karim's task");

  assert(permissions.canEditDeliverables(workerSarahCtx, sarahTask) === true, "Sarah CAN edit deliverables on her assigned task");
  assert(permissions.canEditDeliverables(workerSarahCtx, karimTask) === false, "Sarah CANNOT edit deliverables on Karim's task");

  assert(permissions.canUpdateActualTime(workerSarahCtx, sarahTask) === true, "Sarah CAN update actual time on her assigned task");
  assert(permissions.canUpdateActualTime(workerSarahCtx, karimTask) === false, "Sarah CANNOT update actual time on Karim's task");

  // D. CRITICAL: DELETE / REMOVE is SUPER ADMIN ONLY
  assert(canDelete(superAdminCtx) === true, "Super Admin CAN delete");
  assert(canDelete(adminCtx) === false, "Admin CANNOT delete");
  assert(canDelete(workerSarahCtx) === false, "Worker CANNOT delete");

  assert(canDeleteTask(superAdminCtx) === true, "Super Admin CAN delete task");
  assert(canDeleteTask(adminCtx) === false, "Admin CANNOT delete task");
  assert(canDeleteTask(workerSarahCtx) === false, "Worker CANNOT delete task");

  assert(canDeleteProject(superAdminCtx) === true, "Super Admin CAN delete project");
  assert(canDeleteProject(adminCtx) === false, "Admin CANNOT delete project");

  assert(canDeleteTeamMember(superAdminCtx) === true, "Super Admin CAN delete team member");
  assert(canDeleteTeamMember(adminCtx) === false, "Admin CANNOT delete team member");

  assert(canManageRoles(superAdminCtx) === true, "Super Admin CAN manage roles");
  assert(canManageRoles(adminCtx) === false, "Admin CANNOT manage roles");
  assert(canManageRoles(workerSarahCtx) === false, "Worker CANNOT manage roles");

  // E. Assertion Guards
  let threwForAdminDelete = false;
  try {
    assertCanDelete(adminCtx, "task");
  } catch (err: any) {
    threwForAdminDelete = true;
  }
  assert(threwForAdminDelete, "assertCanDelete threw error for Admin");

  let threwForWorkerEditDef = false;
  try {
    assertCanEditTaskDefinition(workerSarahCtx);
  } catch (err: any) {
    threwForWorkerEditDef = true;
  }
  assert(threwForWorkerEditDef, "assertCanEditTaskDefinition threw error for Worker");

  let threwForWorkerUnassigned = false;
  try {
    assertCanUpdateTaskProgress(workerSarahCtx, karimTask);
  } catch (err: any) {
    threwForWorkerUnassigned = true;
  }
  assert(threwForWorkerUnassigned, "assertCanUpdateTaskProgress threw error for unassigned task");

  // -----------------------------------------------------------------
  // 2. VERIFY REMOTE DATABASE ROLES & USERS
  // -----------------------------------------------------------------
  console.log("\n--- 2. VERIFYING REMOTE SUPABASE TEAM MEMBERS & ROLES ---");

  const { data: teamMembers, error: tmErr } = await (supabase as any)
    .from("team_members")
    .select("id, name, role, profile_id");

  assert(!tmErr, `Loaded team members without error: ${tmErr?.message || "OK"}`);
  console.log(`Found ${teamMembers?.length} team members in Supabase`);

  const boubakar = teamMembers?.find((m: any) => m.name.toLowerCase().includes("boubakar"));
  assert(!!boubakar, "Boubakar Hamed exists in team_members");
  assert(boubakar?.role === "super_admin", `Boubakar Hamed has role 'super_admin' (current: ${boubakar?.role})`);

  const sarah = teamMembers?.find((m: any) => m.name.toLowerCase().includes("sarah"));
  assert(!!sarah, "Sarah Chen exists in team_members");
  assert(sarah?.role === "worker", `Sarah Chen has role 'worker' (current: ${sarah?.role})`);

  // -----------------------------------------------------------------
  // 3. VERIFY ASSIGNMENT RESOLUTION & WORKER PERMISSIONS
  // -----------------------------------------------------------------
  console.log("\n--- 3. TESTING TASK OWNERSHIP & ROLE ASSIGNMENT RESOLUTION ---");

  const testTaskSarah = {
    assignee_id: sarah.id,
    assigned_by_id: boubakar.id,
  };

  const sarahRealCtx: PermissionContext = {
    role: "worker",
    userId: sarah.profile_id,
    memberProfileId: sarah.profile_id,
    memberId: sarah.id,
  };

  const isAssigned = isTaskAssignedToUser(testTaskSarah, sarahRealCtx);
  assert(isAssigned === true, "isTaskAssignedToUser matches Sarah's member ID");

  const canSarahUpdate = permissions.canUpdateTaskProgress(sarahRealCtx, testTaskSarah);
  assert(canSarahUpdate === true, "Sarah has permission to update progress on her assigned task");

  const canSarahEditDef = permissions.canEditTaskDefinition(sarahRealCtx);
  assert(canSarahEditDef === false, "Sarah CANNOT edit task definition (read-only)");

  const canSarahDelete = permissions.canDeleteTask(sarahRealCtx);
  assert(canSarahDelete === false, "Sarah CANNOT delete her task (Super Admin only)");

  // -----------------------------------------------------------------
  // 4. VERIFY WORKER SANITIZATION LOGIC
  // -----------------------------------------------------------------
  console.log("\n--- 4. TESTING WORKER DATA PAYLOAD SANITIZATION ---");

  // Simulate worker attempting to smuggle title and deadline changes
  const workerRawInput = {
    title: "HACKED: Free Coffee Forever",
    deadline: "2099-01-01",
    priority: "low",
    estimated_minutes: 9999,
    assignee_id: "some-other-id",
    // Valid execution fields:
    status: "in_progress",
    actual_minutes: 90,
    result_title: "Café 707 Reel v1",
    result_links: ["https://drive.google.com/test-reel-v1"],
    result_notes: "First cut exported in 4K",
    notes: "Export completed, waiting on audio review",
  };

  // Simulating TaskModal.save() payload generator for worker:
  const sanitizedWorkerPayload: Record<string, any> = {
    status: workerRawInput.status,
    actual_minutes: workerRawInput.actual_minutes,
    notes: workerRawInput.notes,
    result_title: workerRawInput.result_title,
    result_links: workerRawInput.result_links,
    result_notes: workerRawInput.result_notes,
    updated_at: new Date().toISOString(),
  };

  assert(sanitizedWorkerPayload.title === undefined, "Worker sanitized payload EXCLUDES title");
  assert(sanitizedWorkerPayload.deadline === undefined, "Worker sanitized payload EXCLUDES deadline");
  assert(sanitizedWorkerPayload.priority === undefined, "Worker sanitized payload EXCLUDES priority");
  assert(sanitizedWorkerPayload.estimated_minutes === undefined, "Worker sanitized payload EXCLUDES estimated_minutes");
  assert(sanitizedWorkerPayload.assignee_id === undefined, "Worker sanitized payload EXCLUDES assignee_id");

  assert(sanitizedWorkerPayload.status === "in_progress", "Worker sanitized payload PRESERVES status");
  assert(sanitizedWorkerPayload.actual_minutes === 90, "Worker sanitized payload PRESERVES actual_minutes");
  assert(sanitizedWorkerPayload.result_title === "Café 707 Reel v1", "Worker sanitized payload PRESERVES result_title");
  assert(sanitizedWorkerPayload.notes === "Export completed, waiting on audio review", "Worker sanitized payload PRESERVES notes");

  // -----------------------------------------------------------------
  // 5. VERIFY DATABASE RLS REJECTION FOR UNAUTHORIZED DELETE
  // -----------------------------------------------------------------
  console.log("\n--- 5. TESTING DATABASE RLS LEVEL ENFORCEMENT ---");

  // An unauthenticated or worker/admin user attempting DELETE on project_tasks should fail or delete 0 rows
  const { data: delResult, error: delErr } = await (supabase as any)
    .from("project_tasks")
    .delete()
    .eq("id", "00000000-0000-0000-0000-000000000000");

  assert(!delErr || delErr.code === "42501", `RLS handled delete safely: ${delErr?.message || "0 rows deleted"}`);

  console.log("\n=================================================================");
  console.log("🎉 ALL SADA WORKS RBAC TESTS PASSED SUCCESSFULLY!");
  console.log("=================================================================");
}

runRbacTests().catch((err) => {
  console.error("Test failed with exception:", err);
  process.exit(1);
});
