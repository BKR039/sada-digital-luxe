import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

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
  console.log("SADA OS — CLIENT-CENTRIC OPERATIONS AUTOMATED TEST SUITE");
  console.log("=================================================================");

  const client = createClient(supabaseUrl!, anonKey!);

  // Sign in as admin to verify operations
  const authRes = await client.auth.signInWithPassword({
    email: "sec.admin@sada.agency",
    password: "AdminPassword123!",
  });

  if (authRes.error || !authRes.data.user) {
    console.error("Failed to sign in as sec.admin:", authRes.error?.message);
    process.exit(1);
  }

  const adminClient = client;

  // 1. Schema check: clients table has new columns
  const { data: cSample, error: cErr } = await adminClient
    .from("clients")
    .select("id, name, client_type, package_name, package_config, current_period_month, billing_start_date")
    .limit(5);

  assert(!cErr, "1. Clients table has client_type, package_name, package_config columns", cErr?.message);

  // 2. Schema check: project_tasks table has client_id, parent_task_id, delivery_period
  const { data: tSample, error: tErr } = await adminClient
    .from("project_tasks")
    .select("id, title, client_id, parent_task_id, delivery_period, assigned_by_id, assignee_id")
    .limit(5);

  assert(!tErr, "2. project_tasks has client_id, parent_task_id, delivery_period columns", tErr?.message);

  // 3. Verify Flagship Monthly Client: Jannat Sahara
  const { data: jannat, error: jErr } = await adminClient
    .from("clients")
    .select("*")
    .ilike("name", "%jannat sahara%")
    .single();

  assert(!!jannat && jannat.client_type === "monthly", "3. Jannat Sahara exists as a 'monthly' client", jannat);
  assert(jannat?.package_name?.includes("Growth"), "4. Jannat Sahara has 'Growth — Custom' package", jannat?.package_name);
  assert(
    jannat?.package_config?.reels_quota === 5 &&
    jannat?.package_config?.posts_quota === 4 &&
    jannat?.package_config?.stories_quota === 10,
    "5. Jannat Sahara has 5 Reels, 4 Posts, 10 Stories package configuration",
    jannat?.package_config
  );

  // 6. Verify Jannat Sahara September 2026 Deliverables
  const { data: jannatSeptTasks, error: jsErr } = await adminClient
    .from("project_tasks")
    .select("*")
    .eq("client_id", jannat.id)
    .eq("delivery_period", "2026-09")
    .is("parent_task_id", null);

  assert(!jsErr && jannatSeptTasks.length >= 19, "6. Jannat Sahara has >= 19 September 2026 deliverables (5 Reels, 4 Posts, 10 Stories)", jannatSeptTasks?.length);

  const reels = jannatSeptTasks.filter(t => t.category === "Reel" || t.title.startsWith("Reel"));
  const posts = jannatSeptTasks.filter(t => t.category === "Post" || t.title.startsWith("Post"));
  const stories = jannatSeptTasks.filter(t => t.category === "Story" || t.title.startsWith("Story"));

  assert(reels.length >= 5, "7. Jannat Sahara has 5 Reels deliverables", reels.length);
  assert(posts.length >= 4, "8. Jannat Sahara has 4 Posts deliverables", posts.length);
  assert(stories.length >= 10, "9. Jannat Sahara has 10 Stories deliverables", stories.length);

  // 10. Verify Reel 03 has Subtasks
  const reel3 = reels.find(r => r.title.includes("Reel 03"));
  assert(!!reel3, "10. Reel 03 exists for Jannat Sahara", reel3?.title);

  if (reel3) {
    const { data: subtasks, error: stErr } = await adminClient
      .from("project_tasks")
      .select("*")
      .eq("parent_task_id", reel3.id);

    assert(!stErr && subtasks.length >= 4, "11. Reel 03 has execution subtasks (Concept, Shooting, Editing, Review, Delivery)", subtasks?.length);
  }

  // 12. Verify Jannat Sahara August 2026 Historical Archive (Immutable)
  const { data: jannatAugTasks, error: jaErr } = await adminClient
    .from("project_tasks")
    .select("*")
    .eq("client_id", jannat.id)
    .eq("delivery_period", "2026-08");

  assert(!jaErr && jannatAugTasks.length === 19, "12. Jannat Sahara has August 2026 historical deliverables (19/19 completed)", jannatAugTasks?.length);
  const allAugDone = jannatAugTasks.every(t => t.status === "done");
  assert(allAugDone, "13. All August 2026 historical deliverables are in 'done' state", allAugDone);

  // 14. Verify Flagship One-Off Client: Café 707
  const { data: cafe, error: cfErr } = await adminClient
    .from("clients")
    .select("*")
    .or("name.ilike.%café 707%,name.ilike.%caffe 707%")
    .single();

  assert(!!cafe && cafe.client_type === "one_off", "14. Café 707 exists as a 'one_off' client", cafe);

  // 15. Verify Café 707 One-Off Service Task
  const { data: cafeTasks, error: cftErr } = await adminClient
    .from("project_tasks")
    .select("*")
    .eq("client_id", cafe.id)
    .is("parent_task_id", null);

  assert(!cftErr && cafeTasks.length >= 1, "15. Café 707 has a primary one-off service deliverable", cafeTasks?.length);
  const cafeMain = cafeTasks[0];
  assert(cafeMain?.service?.includes("Reel") || cafeMain?.title?.includes("Reel"), "16. Café 707 primary service is Reel Production", cafeMain?.title);

  // 17. Verify Assigned By / Assigned To on Café 707
  assert(!!cafeMain?.assigned_by_id, "17. Café 707 task has ASSIGNED BY recorded (Delegating Lead)", cafeMain?.assigned_by_id);
  assert(!!cafeMain?.assignee_id, "18. Café 707 task has ASSIGNED TO recorded (Executing Specialist)", cafeMain?.assignee_id);

  // 19. Verify Subtasks on Café 707
  const { data: cafeSubtasks, error: cstErr } = await adminClient
    .from("project_tasks")
    .select("*")
    .eq("parent_task_id", cafeMain.id);

  assert(!cstErr && cafeSubtasks.length >= 4, "19. Café 707 has subtasks (Shooting, Editing, Review, Delivery)", cafeSubtasks?.length);

  // 20. Worker Role RLS Check: Worker can read clients, cannot delete client
  const ts = Date.now();
  const workerEmail = `client.ops.worker.${ts}@sada.agency`;
  const testPassword = "TestPassword123!";

  const workerSignUp = await client.auth.signUp({ email: workerEmail, password: testPassword });
  if (workerSignUp.data.user) {
    const workerUserId = workerSignUp.data.user.id;
    const { execSync } = await import("child_process");
    execSync(
      `npx supabase db query --linked "INSERT INTO public.user_roles (user_id, role) VALUES ('${workerUserId}', 'worker') ON CONFLICT DO NOTHING;"`,
      { encoding: "utf-8" }
    );

    // Query with workerClient
    const workerClient = createClient(supabaseUrl!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await workerClient.auth.signInWithPassword({ email: workerEmail, password: testPassword });

    const { data: workerClients, error: wcErr } = await workerClient
      .from("clients")
      .select("id, name, client_type");

    assert(!wcErr && workerClients.length > 0, "20. Worker can read clients directory under RLS", workerClients?.length);

    // Worker attempts delete on client (MUST BE BLOCKED by RLS - 0 rows deleted)
    const { error: wdErr, count: wdCount } = await workerClient
      .from("clients")
      .delete({ count: "exact" })
      .eq("id", cafe.id);

    const { data: cafeStillExists } = await adminClient
      .from("clients")
      .select("id")
      .eq("id", cafe.id)
      .single();

    assert((wdCount === 0 || !!wdErr) && !!cafeStillExists, "21. Worker deletion of clients is strictly BLOCKED by RLS (0 rows affected, client preserved)", { wdCount, wdErr, cafeStillExists });
  }

  console.log("=================================================================");
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED:      ${passed}`);
  console.log(`FAILED:      ${failed}`);
  console.log("=================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

run();
