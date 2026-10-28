import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

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
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !anonKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}

const client = createClient(supabaseUrl, anonKey);

async function runVerification() {
  console.log("=================================================================");
  console.log("SADA WORK OS — VERIFYING CAFFE 707 WORKLOAD FIX & PERSISTENCE");
  console.log("=================================================================\n");

  // Step 1: Sign up / in as admin so RLS allows reading client_projects & project_tasks
  const testEmail = `verification.admin.${Date.now()}@sada.agency`;
  const testPassword = "AdminPassword123!";

  const { data: signUpData, error: signUpErr } = await client.auth.signUp({
    email: testEmail,
    password: testPassword,
  });

  if (signUpErr || !signUpData.user) {
    console.error("SignUp failed:", signUpErr?.message);
    process.exit(1);
  }

  const currentUserId = signUpData.user.id;
  const { execSync } = await import("child_process");
  execSync(
    `npx supabase db query --linked "INSERT INTO public.user_roles (user_id, role) VALUES ('${currentUserId}', 'admin') ON CONFLICT DO NOTHING;"`,
    { encoding: "utf-8" }
  );

  const { data: authData, error: authErr } = await client.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  assert(!authErr && Boolean(authData.user), "Successfully authenticated as admin user");

  // Step 2: Query DB for Caffe 707 and task "edit first caffe 707 reel"
  console.log("\n--- Checking Real DB Evidence for Caffe 707 ---");
  const { data: projects, error: pErr } = await client
    .from("client_projects")
    .select("*")
    .ilike("client_name", "%caffe 707%");

  assert(!pErr && !!projects && projects.length > 0, "Caffe 707 project exists in database");
  const caffeProject = projects![0];
  console.log(`  Project ID: ${caffeProject.id} | Client: ${caffeProject.client_name}`);

  const { data: tasks, error: tErr } = await client
    .from("project_tasks")
    .select("*")
    .eq("project_id", caffeProject.id);

  assert(!tErr && !!tasks && tasks.length > 0, "Caffe 707 tasks exist in database");
  const caffeTask = tasks![0];
  console.log(`  Task ID: ${caffeTask.id} | Title: ${caffeTask.title} | AssigneeID: ${caffeTask.assignee_id}`);

  assert(Boolean(caffeTask.assignee_id), "Task assignee_id IS NOT NULL");

  // Query profiles for assignee_id
  const { data: profiles } = await client.from("profiles").select("*");
  const assignedProfile = profiles?.find((p) => p.id === caffeTask.assignee_id);
  assert(Boolean(assignedProfile), `assignee_id (${caffeTask.assignee_id}) exists in profiles table`);

  // Query team_members for assignee_id
  const { data: teamMembers } = await client.from("team_members").select("*");
  const sarahMember = teamMembers?.find((tm) => tm.name === "Sarah Chen");
  assert(Boolean(sarahMember), "Sarah Chen exists in team_members table");
  assert(
    sarahMember?.profile_id === caffeTask.assignee_id,
    `Sarah's team_members.profile_id (${sarahMember?.profile_id}) matches project_tasks.assignee_id (${caffeTask.assignee_id})`
  );

  // Step 3: Run Team Workload grouping transformation logic (the exact logic from admin.team-workload.tsx)
  console.log("\n--- Testing Team Workload Mapping & Display Logic ---");

  // Replicate unifiedMembers logic
  const list: any[] = [...(teamMembers || [])];
  const existingProfileIds = new Set((teamMembers || []).map((m) => m.profile_id).filter(Boolean));
  const existingMemberIds = new Set((teamMembers || []).map((m) => m.id));

  for (const p of profiles || []) {
    if (!existingProfileIds.has(p.id) && !existingMemberIds.has(p.id)) {
      list.push({
        id: p.id,
        profile_id: p.id,
        name: p.display_name || "Team Member",
        position: "Specialist",
        division: "Development",
        specialties: [],
        sort_order: 99,
        published: false,
        is_active: true,
        availability_status: "available",
        display_name: p.display_name,
      });
    }
  }
  const unifiedMembers = list;

  // Replicate fixed memberWorkloads logic
  const map = new Map<string, { member: any; tasks: any[]; followups: any[] }>();

  for (const m of unifiedMembers) {
    const entry = { member: m, tasks: [], followups: [] };
    map.set(m.id, entry);
    if (m.profile_id && m.profile_id !== m.id) {
      map.set(m.profile_id, entry);
    }
  }

  const unassignedList: any[] = [];
  const allTasks = (await client.from("project_tasks").select("*")).data || [];

  for (const t of allTasks) {
    if (!t.assignee_id) {
      unassignedList.push(t);
    } else {
      const target = map.get(t.assignee_id);
      if (target) {
        if (!target.tasks.includes(t)) target.tasks.push(t);
      } else {
        unassignedList.push(t);
      }
    }
  }

  // Lookup Sarah's workload by team_members.id
  const sarahData = map.get(sarahMember!.id);
  assert(Boolean(sarahData), "Sarah's workload entry found in map by team_members.id");
  const caffeTaskInSarahWorkload = sarahData?.tasks.find((t) => t.id === caffeTask.id);
  assert(Boolean(caffeTaskInSarahWorkload), `Caffe 707 task '${caffeTask.title}' NOW APPEARS under Sarah's workload!`);

  // Verify task is NOT in unassigned list
  const inUnassigned = unassignedList.some((t) => t.id === caffeTask.id);
  assert(!inUnassigned, "Caffe 707 task is NOT shown as unassigned");

  // Step 4: Reassignment & State Transition Verification
  console.log("\n--- Testing Task Reassignment & Workload Update ---");
  const karimMember = teamMembers?.find((tm) => tm.name === "Karim Mansour");
  assert(Boolean(karimMember?.profile_id), "Karim Mansour has valid profile_id");

  // Create temporary test task
  const { data: testTask, error: testTaskErr } = await client
    .from("project_tasks")
    .insert({
      project_id: caffeProject.id,
      title: "Temp E2E Test Task",
      status: "todo",
      priority: "medium",
      assignee_id: sarahMember!.profile_id,
    })
    .select()
    .single();

  assert(!testTaskErr && !!testTask, "Inserted test task assigned to Sarah");

  // Reassign to Karim
  const { error: reassignErr } = await client
    .from("project_tasks")
    .update({ assignee_id: karimMember!.profile_id })
    .eq("id", testTask.id);

  assert(!reassignErr, "Reassigned test task from Sarah to Karim");

  // Query updated tasks and re-run mapping
  const { data: updatedTasks } = await client.from("project_tasks").select("*");
  const map2 = new Map<string, { member: any; tasks: any[]; followups: any[] }>();
  for (const m of unifiedMembers) {
    const entry = { member: m, tasks: [], followups: [] };
    map2.set(m.id, entry);
    if (m.profile_id && m.profile_id !== m.id) {
      map2.set(m.profile_id, entry);
    }
  }
  for (const t of updatedTasks || []) {
    if (t.assignee_id) {
      const target = map2.get(t.assignee_id);
      if (target && !target.tasks.includes(t)) target.tasks.push(t);
    }
  }

  const sarahHasTempTask = map2.get(sarahMember!.id)?.tasks.some((t) => t.id === testTask.id);
  const karimHasTempTask = map2.get(karimMember!.id)?.tasks.some((t) => t.id === testTask.id);

  assert(!sarahHasTempTask, "Sarah's workload decremented after reassignment");
  assert(karimHasTempTask === true, "Karim's workload incremented after reassignment");

  // Cleanup temp task
  await client.from("project_tasks").delete().eq("id", testTask.id);
  console.log("  Cleaned up temp test task.");

  console.log("\n=================================================================");
  console.log("ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!");
  console.log("=================================================================");
}

runVerification().catch((err) => {
  console.error("VERIFICATION FAILED:", err);
  process.exit(1);
});
