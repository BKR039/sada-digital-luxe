import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

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

async function runTriggerTests() {
  console.log("=================================================================");
  console.log("SADA OS — DATABASE TRIGGER TEST SUITE (BUG-001 ENFORCEMENT)");
  console.log("=================================================================\n");

  const adminClient = createClient(supabaseUrl, anonKey);
  const workerClient = createClient(supabaseUrl, anonKey);

  // Authenticate Admin
  const adminAuth = await adminClient.auth.signInWithPassword({
    email: "phase1.tester@sada.agency",
    password: "Phase1TestPassword123!",
  });
  if (adminAuth.error) throw new Error(`Admin login failed: ${adminAuth.error.message}`);
  const adminUser = adminAuth.data.user;
  console.log(`✓ Admin logged in: ${adminUser.email} (${adminUser.id})`);

  // Authenticate Worker
  const workerAuth = await workerClient.auth.signInWithPassword({
    email: "team.e2e.1789469945865@sada.agency",
    password: "TestPassword123!",
  });
  if (workerAuth.error) throw new Error(`Worker login failed: ${workerAuth.error.message}`);
  const workerUser = workerAuth.data.user;
  console.log(`✓ Worker logged in: ${workerUser.email} (${workerUser.id})`);

  // Fetch an existing project to attach test tasks to
  const { data: projects, error: prjErr } = await adminClient
    .from("client_projects")
    .select("id, client_id")
    .limit(1);
  if (prjErr || !projects || projects.length === 0) {
    throw new Error(`Failed to find client project: ${prjErr?.message}`);
  }
  const testProjectId = projects[0].id;
  const testClientId = projects[0].client_id;
  console.log(`✓ Using Project ${testProjectId} (Client ${testClientId})`);

  // Helper to fetch task
  const getTask = async (id: string) => {
    const { data, error } = await adminClient
      .from("project_tasks")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  };

  let testTaskId = "";

  try {
    // -------------------------------------------------------------
    // Test 1: todo -> done => completed_at populated
    // -------------------------------------------------------------
    console.log("\n--- TEST 1: todo -> done => completed_at populated ---");
    const { data: task1, error: t1Err } = await adminClient
      .from("project_tasks")
      .insert({
        title: "TRIGGER_TEST_TASK_LIFECYCLE",
        project_id: testProjectId,
        client_id: testClientId,
        status: "todo",
        priority: "medium",
        assignee_id: workerUser.id,
        assigned_by_id: adminUser.id,
      })
      .select()
      .single();
    if (t1Err) throw new Error(`Create task failed: ${t1Err.message}`);
    testTaskId = task1.id;
    console.log(`Task created: ${testTaskId}, status: ${task1.status}, completed_at: ${task1.completed_at}`);

    if (task1.completed_at !== null) {
      throw new Error(`Expected completed_at to be NULL for new 'todo' task, got: ${task1.completed_at}`);
    }

    const { error: upd1Err } = await adminClient
      .from("project_tasks")
      .update({ status: "done" })
      .eq("id", testTaskId);
    if (upd1Err) throw new Error(`Update todo -> done failed: ${upd1Err.message}`);

    const afterDone1 = await getTask(testTaskId);
    console.log(`After todo -> done: status = ${afterDone1.status}, completed_at = ${afterDone1.completed_at}`);
    if (!afterDone1.completed_at) {
      throw new Error("TEST 1 FAILED: completed_at was not populated on todo -> done!");
    }
    console.log("✓ TEST 1 PASSED: todo -> done populated completed_at");

    // -------------------------------------------------------------
    // Test 3: done -> in_progress => completed_at cleared
    // -------------------------------------------------------------
    console.log("\n--- TEST 3: done -> in_progress => completed_at cleared ---");
    const { error: upd3Err } = await adminClient
      .from("project_tasks")
      .update({ status: "in_progress" })
      .eq("id", testTaskId);
    if (upd3Err) throw new Error(`Update done -> in_progress failed: ${upd3Err.message}`);

    const afterInProg = await getTask(testTaskId);
    console.log(`After done -> in_progress: status = ${afterInProg.status}, completed_at = ${afterInProg.completed_at}`);
    if (afterInProg.completed_at !== null) {
      throw new Error(`TEST 3 FAILED: completed_at was NOT cleared on done -> in_progress! Value: ${afterInProg.completed_at}`);
    }
    console.log("✓ TEST 3 PASSED: done -> in_progress cleared completed_at");

    // -------------------------------------------------------------
    // Test 2: in_progress -> done => completed_at populated
    // -------------------------------------------------------------
    console.log("\n--- TEST 2: in_progress -> done => completed_at populated ---");
    const { error: upd2Err } = await adminClient
      .from("project_tasks")
      .update({ status: "done" })
      .eq("id", testTaskId);
    if (upd2Err) throw new Error(`Update in_progress -> done failed: ${upd2Err.message}`);

    const afterDone2 = await getTask(testTaskId);
    console.log(`After in_progress -> done: status = ${afterDone2.status}, completed_at = ${afterDone2.completed_at}`);
    if (!afterDone2.completed_at) {
      throw new Error("TEST 2 FAILED: completed_at was not populated on in_progress -> done!");
    }
    console.log("✓ TEST 2 PASSED: in_progress -> done populated completed_at");

    // -------------------------------------------------------------
    // Test 4: done -> blocked => completed_at cleared
    // -------------------------------------------------------------
    console.log("\n--- TEST 4: done -> blocked => completed_at cleared ---");
    const { error: upd4Err } = await adminClient
      .from("project_tasks")
      .update({ status: "blocked" })
      .eq("id", testTaskId);
    if (upd4Err) throw new Error(`Update done -> blocked failed: ${upd4Err.message}`);

    const afterBlocked = await getTask(testTaskId);
    console.log(`After done -> blocked: status = ${afterBlocked.status}, completed_at = ${afterBlocked.completed_at}`);
    if (afterBlocked.completed_at !== null) {
      throw new Error(`TEST 4 FAILED: completed_at was NOT cleared on done -> blocked! Value: ${afterBlocked.completed_at}`);
    }
    console.log("✓ TEST 4 PASSED: done -> blocked cleared completed_at");

    // -------------------------------------------------------------
    // Test 5: done -> done => existing timestamp preserved
    // -------------------------------------------------------------
    console.log("\n--- TEST 5: done -> done => existing timestamp preserved ---");
    // Move to done first
    await adminClient.from("project_tasks").update({ status: "done" }).eq("id", testTaskId);
    const initialDone = await getTask(testTaskId);
    const initialTimestamp = initialDone.completed_at;
    console.log(`Initial done completed_at: ${initialTimestamp}`);

    // Wait 1.5 seconds to ensure NOW() would differ if erroneously overwritten
    await new Promise((r) => setTimeout(r, 1500));

    // Update another field while status stays 'done'
    const { error: updTitleErr } = await adminClient
      .from("project_tasks")
      .update({ title: "TRIGGER_TEST_TASK_LIFECYCLE_RENAMED" })
      .eq("id", testTaskId);
    if (updTitleErr) throw new Error(`Update title failed: ${updTitleErr.message}`);

    const afterSameDone = await getTask(testTaskId);
    console.log(`After renaming done task: status = ${afterSameDone.status}, completed_at = ${afterSameDone.completed_at}`);
    if (afterSameDone.completed_at !== initialTimestamp) {
      throw new Error(`TEST 5 FAILED: completed_at was overwritten! Original: ${initialTimestamp}, New: ${afterSameDone.completed_at}`);
    }
    console.log("✓ TEST 5 PASSED: done -> done preserved existing completed_at timestamp");

    // -------------------------------------------------------------
    // Test 6: Worker completing own task => still works
    // -------------------------------------------------------------
    console.log("\n--- TEST 6: Worker completing own task => still works ---");
    // Move back to in_progress first
    await adminClient.from("project_tasks").update({ status: "in_progress" }).eq("id", testTaskId);

    // Worker executes completion
    const { error: workerUpdErr } = await workerClient
      .from("project_tasks")
      .update({ status: "done" })
      .eq("id", testTaskId);
    if (workerUpdErr) throw new Error(`Worker completing own task failed: ${workerUpdErr.message}`);

    const afterWorkerDone = await getTask(testTaskId);
    console.log(`After worker completed own task: status = ${afterWorkerDone.status}, completed_at = ${afterWorkerDone.completed_at}`);
    if (afterWorkerDone.status !== "done" || !afterWorkerDone.completed_at) {
      throw new Error("TEST 6 FAILED: Worker could not complete own task or completed_at not set!");
    }
    console.log("✓ TEST 6 PASSED: Worker completed own task with trigger-enforced completed_at");

    // -------------------------------------------------------------
    // Test 7: Admin completing task => still works
    // -------------------------------------------------------------
    console.log("\n--- TEST 7: Admin completing task => still works ---");
    // Move to todo
    await adminClient.from("project_tasks").update({ status: "todo" }).eq("id", testTaskId);

    // Admin executes completion
    const { error: adminUpdErr } = await adminClient
      .from("project_tasks")
      .update({ status: "done" })
      .eq("id", testTaskId);
    if (adminUpdErr) throw new Error(`Admin completing task failed: ${adminUpdErr.message}`);

    const afterAdminDone = await getTask(testTaskId);
    console.log(`After admin completed task: status = ${afterAdminDone.status}, completed_at = ${afterAdminDone.completed_at}`);
    if (afterAdminDone.status !== "done" || !afterAdminDone.completed_at) {
      throw new Error("TEST 7 FAILED: Admin could not complete task or completed_at not set!");
    }
    console.log("✓ TEST 7 PASSED: Admin completed task with trigger-enforced completed_at");

  } finally {
    // Clean up test task
    if (testTaskId) {
      console.log("\nCleaning up test task...");
      // Super admin deletes test task
      const saClient = createClient(supabaseUrl, anonKey);
      await saClient.auth.signInWithPassword({
        email: "sec.admin@sada.agency",
        password: "AdminPassword123!",
      });
      await saClient.from("project_tasks").delete().eq("id", testTaskId);
      console.log("✓ Cleaned up test task.");
    }
  }

  console.log("\n=================================================================");
  console.log("ALL 7 DATABASE-LEVEL TRIGGER ENFORCEMENT SCENARIOS PASSED!");
  console.log("=================================================================");
}

runTriggerTests().catch((err) => {
  console.error("FATAL ERROR in trigger test suite:", err);
  process.exit(1);
});
