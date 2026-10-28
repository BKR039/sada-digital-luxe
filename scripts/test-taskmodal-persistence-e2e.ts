// ============================================================
// SADA WORK OS — E2E Real Database Persistence Test
// Simulating Exact TaskModal / Dashboard / Calendar / Team Workload Path
// ============================================================

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { enforceDatabaseIsolation } from "./test-db-guard";
import { resolveToProfileId, getAssignmentMemberInfo, type TeamMemberRow, type ProfileRow } from "../src/components/admin/project-utils";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✓ PASS: ${message}`);
}

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

const client = createClient(supabaseUrl, anonKey);

async function runE2EPersistenceSuite() {
  console.log("=================================================================");
  console.log("SADA WORK OS — TASKMODAL & REAL DATABASE PERSISTENCE E2E SUITE");
  console.log("=================================================================\n");

  // Hardened Zero-Trust Environment Isolation Guard
  enforceDatabaseIsolation(supabaseUrl);

  // Step 1: Sign up and sign in with a fresh test user, then grant admin role
  console.log("1. Setting up Authenticated Admin User...");
  const testEmail = `e2e.admin.${Date.now()}@sada.agency`;
  const testPassword = "E2EAdminPassword123!";

  const { data: signUpData, error: signUpErr } = await client.auth.signUp({
    email: testEmail,
    password: testPassword,
  });

  if (signUpErr || !signUpData.user) {
    console.error("SignUp failed:", signUpErr?.message);
    process.exit(1);
  }

  const currentUserId = signUpData.user.id;
  console.log(`Created test user ${testEmail} with ID: ${currentUserId}`);

  // Grant admin role via child_process using supabase db query --linked
  const { execSync } = await import("child_process");
  execSync(
    `npx supabase db query --linked "INSERT INTO public.user_roles (user_id, role) VALUES ('${currentUserId}', 'admin') ON CONFLICT DO NOTHING;"`,
    { encoding: "utf-8" }
  );
  console.log("Granted 'admin' role to test user.");

  const { data: authData, error: authErr } = await client.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (authErr || !authData.user) {
    console.error("Auth failed:", authErr?.message);
    process.exit(1);
  }

  const currentUser = authData.user;
  assert(Boolean(currentUser?.id), `Successfully signed in as admin. User ID: ${currentUser.id}`);

  // Step 2: Fetch profiles and team_members exactly as admin components do
  console.log("\n2. Fetching profiles and team_members from remote database...");
  const { data: rawProfiles, error: profErr } = await client.from("profiles").select("id, display_name");
  assert(!profErr, `Fetched profiles successfully (${rawProfiles?.length} records)`);
  const profiles = (rawProfiles || []) as ProfileRow[];

  const { data: rawMembers, error: memErr } = await client.from("team_members").select("*");
  assert(!memErr, `Fetched team_members successfully (${rawMembers?.length} records)`);
  const teamMembers = (rawMembers || []) as TeamMemberRow[];

  // Verify currentUser has a profile
  const userProfile = profiles.find((p) => p.id === currentUser.id);
  assert(Boolean(userProfile), `Current auth user profile exists in public.profiles: ${userProfile?.display_name || userProfile?.id}`);

  // Also verify previously missing user boubakar.hamedsghaier@gmail.com
  const boubakarProfile = profiles.find((p) => p.id === "f4184256-97c4-4f81-9346-176ec5dfb43a");
  assert(Boolean(boubakarProfile), `Backfilled profile exists for boubakar.hamedsghaier@gmail.com: ${boubakarProfile?.id}`);

  // Fetch or create a test client project to attach tasks
  console.log("\n3. Resolving test project...");
  const { data: projects, error: projErr } = await client.from("client_projects").select("id, title").limit(1);
  let testProjectId: string;
  if (!projErr && projects && projects.length > 0) {
    testProjectId = projects[0].id;
    console.log(`Using existing client project: ${projects[0].title} (${testProjectId})`);
  } else {
    const { data: newProj, error: newProjErr } = await client
      .from("client_projects")
      .insert({ title: "E2E Task Persistence Verification", status: "active" })
      .select("id")
      .single();
    if (newProjErr) {
      console.error("Failed to ensure client project:", newProjErr.message);
      process.exit(1);
    }
    testProjectId = newProj.id;
    console.log(`Created test client project: ${testProjectId}`);
  }

  // Choose a member or user for assignment
  const memberWithProfile = teamMembers.find((m) => Boolean(m.profile_id));
  const assigneeInputId = memberWithProfile ? memberWithProfile.id : currentUser.id;
  const assignedByInputId = currentUser.id;

  // -------------------------------------------------------------
  // TEST A: CREATE TASK (Dashboard / Admin TaskModal flow)
  // -------------------------------------------------------------
  console.log("\n--- TEST A: CREATE TASK (Dashboard TaskModal flow) ---");
  const finalAssigneeId = resolveToProfileId(assigneeInputId, teamMembers, profiles);
  let finalAssignedById = resolveToProfileId(assignedByInputId, teamMembers, profiles);
  if (!finalAssignedById && currentUser.id) {
    if (profiles.some((p) => p.id === currentUser.id)) {
      finalAssignedById = currentUser.id;
    }
  }

  console.log("[TaskModal Payload Resolution]");
  console.log("  Input assigneeId:", assigneeInputId, "→ finalAssigneeId:", finalAssigneeId);
  console.log("  Input assignedById:", assignedByInputId, "→ finalAssignedById:", finalAssignedById);

  assert(Boolean(finalAssignedById), `finalAssignedById resolved to valid profile ID: ${finalAssignedById}`);
  assert(profiles.some((p) => p.id === finalAssignedById), `finalAssignedById strictly exists in public.profiles!`);

  const taskPayload = {
    project_id: testProjectId,
    title: `E2E Verified Task - ${Date.now()}`,
    description: "Verifying TaskModal assignment FK constraints",
    status: "todo",
    priority: "high",
    assignee_id: finalAssigneeId || null,
    assigned_by_id: finalAssignedById || null,
    category: "Development",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: createdTask, error: createErr } = await client
    .from("project_tasks")
    .insert(taskPayload)
    .select("*")
    .single();

  assert(!createErr, `Task inserted WITHOUT FK constraint violation! (Error: ${createErr?.message || "none"})`);
  assert(Boolean(createdTask?.id), `Task created with ID: ${createdTask?.id}`);
  assert(createdTask.assigned_by_id === finalAssignedById, `Persisted assigned_by_id matches: ${createdTask.assigned_by_id}`);
  console.log("✓ Task creation passed 100%!");

  const testTaskId = createdTask.id;

  // -------------------------------------------------------------
  // TEST B: EDIT EXISTING TASK & CHANGE ASSIGNED BY
  // -------------------------------------------------------------
  console.log("\n--- TEST B: EDIT EXISTING TASK & CHANGE ASSIGNED BY ---");
  // Change assigned_by to boubakar's newly backfilled profile
  const updatedAssignedById = "f4184256-97c4-4f81-9346-176ec5dfb43a";
  const resolvedNewAssignedBy = resolveToProfileId(updatedAssignedById, teamMembers, profiles);

  const { data: updatedTask, error: updateErr } = await client
    .from("project_tasks")
    .update({
      assigned_by_id: resolvedNewAssignedBy,
      priority: "urgent",
      updated_at: new Date().toISOString(),
    })
    .eq("id", testTaskId)
    .select("*")
    .single();

  assert(!updateErr, `Task updated with new assigned_by_id WITHOUT FK error! (${updateErr?.message || "none"})`);
  assert(updatedTask.assigned_by_id === updatedAssignedById, `Updated assigned_by_id matches boubakar's profile ID!`);
  console.log("✓ Edit task and change Assigned By passed 100%!");

  // -------------------------------------------------------------
  // TEST C: REASSIGN FROM TEAM WORKLOAD
  // -------------------------------------------------------------
  console.log("\n--- TEST C: REASSIGN TASK (Team Workload flow) ---");
  const previousAssignee = createdTask.assignee_id;
  const newAssigneeId = currentUser.id; // Reassign to current user profile

  const { data: reassignedTask, error: reassignErr } = await client
    .from("project_tasks")
    .update({
      assignee_id: newAssigneeId,
      previous_assignee_id: previousAssignee,
      handoff_reason: "Reassigned via Team Workload operational rebalance",
      updated_at: new Date().toISOString(),
    })
    .eq("id", testTaskId)
    .select("*")
    .single();

  assert(!reassignErr, `Task reassigned WITHOUT FK violation! (${reassignErr?.message || "none"})`);
  assert(reassignedTask.assignee_id === newAssigneeId, `New assignee_id persisted: ${reassignedTask.assignee_id}`);
  assert(reassignedTask.previous_assignee_id === previousAssignee, `Previous assignee_id persisted: ${reassignedTask.previous_assignee_id}`);
  console.log("✓ Team Workload reassignment passed 100%!");

  // -------------------------------------------------------------
  // TEST D: CREATE TASK FROM CALENDAR (Calendar flow)
  // -------------------------------------------------------------
  console.log("\n--- TEST D: CREATE TASK FROM CALENDAR ---");
  const calendarDate = "2026-09-20";
  const calTaskPayload = {
    project_id: testProjectId,
    title: `Calendar Scheduled Task - ${Date.now()}`,
    status: "todo",
    priority: "medium",
    start_date: new Date(calendarDate).toISOString(),
    deadline: calendarDate,
    assignee_id: newAssigneeId,
    assigned_by_id: currentUser.id,
  };

  const { data: calTask, error: calErr } = await client
    .from("project_tasks")
    .insert(calTaskPayload)
    .select("*")
    .single();

  assert(!calErr, `Calendar task created WITHOUT FK error! (${calErr?.message || "none"})`);
  assert(Boolean(calTask?.id), `Calendar task created with ID: ${calTask?.id}`);
  console.log("✓ Calendar task creation passed 100%!");

  // -------------------------------------------------------------
  // TEST E: CLEANUP TEST TASKS & USER
  // -------------------------------------------------------------
  console.log("\n--- Cleaning up test tasks & user ---");
  await client.from("project_tasks").delete().in("id", [testTaskId, calTask.id]);
  execSync(`npx supabase db query --linked "DELETE FROM auth.users WHERE id = '${currentUserId}';"`, { encoding: "utf-8" });
  console.log("✓ Cleaned up test tasks and user successfully.");

  console.log("\n=================================================================");
  console.log("✅ ALL REAL DATABASE PERSISTENCE E2E TESTS PASSED 100%!");
  console.log("=================================================================");
}

runE2EPersistenceSuite().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
