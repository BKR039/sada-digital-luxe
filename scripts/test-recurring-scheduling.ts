/**
 * SADA OS — Test Suite: Recurring Client-Service Scheduling Engine
 *
 * Verifies:
 * 1. Canonical Package Commitment Presets:
 *    - Stories shooting: 2 times/week.
 *    - Reels shooting: 2 days/month.
 *    - Posts: 8/month.
 *    - Photography: 1/month.
 * 2. Package deliverable derivation (deriveCommitmentsFromPackage).
 * 3. Schedule occurrence calculation for daily, weekly, and monthly semantics.
 * 4. Automated idempotent generation: rerunning generation never duplicates tasks.
 * 5. Client Lifecycle semantics:
 *    - Active: generation proceeds.
 *    - Paused: future generation suspended without deleting historical records.
 *    - Inactive: future generation halts; historical records remain permanently.
 *    - Reactivated: resumes future generation safely without duplicating prior records.
 * 6. Calendar entry data completeness: client, service, assigned worker, stage/task, and date.
 */

import {
  CANONICAL_SERVICE_COMMITMENT_PRESETS,
  calculateCommitmentOccurrences,
  deriveCommitmentsFromPackage,
  generateCommitmentTasks,
} from "../src/lib/recurring-scheduling-service";
import type { ServiceCommitment } from "../src/types/service-commitment";
import type { TaskRow } from "../src/components/admin/project-utils";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("SADA OS — Recurring Client-Service Scheduling Engine Test");
  console.log("=======================================================\n");

  // TEST SUITE 1: Canonical Package Presets Verification
  console.log("--- 1. Canonical Package Commitment Presets ---");
  assert(CANONICAL_SERVICE_COMMITMENT_PRESETS.length >= 4, "At least 4 canonical presets defined");

  // Preset 1: Stories shooting: 2 times/week
  const storiesPreset = CANONICAL_SERVICE_COMMITMENT_PRESETS.find(
    (p) => p.service_name.toLowerCase().includes("stories")
  );
  assert(Boolean(storiesPreset), "Stories shooting preset exists");
  assert(storiesPreset?.frequency === "weekly", "Stories preset frequency is weekly");
  assert(storiesPreset?.quantity === 2, "Stories preset quantity is 2 times/week");
  assert(
    Array.isArray(storiesPreset?.schedule_rule?.days_of_week) &&
      storiesPreset?.schedule_rule?.days_of_week?.length === 2,
    "Stories preset has 2 designated days per week (e.g. Tue, Thu)"
  );

  // Preset 2: Reels shooting: 2 days/month
  const reelsPreset = CANONICAL_SERVICE_COMMITMENT_PRESETS.find(
    (p) => p.service_name.toLowerCase().includes("reels")
  );
  assert(Boolean(reelsPreset), "Reels shooting preset exists");
  assert(reelsPreset?.frequency === "monthly", "Reels preset frequency is monthly");
  assert(reelsPreset?.quantity === 2, "Reels preset quantity is 2 days/month");
  assert(
    Array.isArray(reelsPreset?.schedule_rule?.days_of_month) &&
      reelsPreset?.schedule_rule?.days_of_month?.length === 2,
    "Reels preset has 2 designated shoot days of the month"
  );

  // Preset 3: Posts: 8/month
  const postsPreset = CANONICAL_SERVICE_COMMITMENT_PRESETS.find(
    (p) => p.service_name.toLowerCase().includes("post")
  );
  assert(Boolean(postsPreset), "Posts preset exists");
  assert(postsPreset?.frequency === "monthly", "Posts preset frequency is monthly");
  assert(postsPreset?.quantity === 8, "Posts preset quantity is 8/month");

  // Preset 4: Photography: 1/month
  const photoPreset = CANONICAL_SERVICE_COMMITMENT_PRESETS.find(
    (p) => p.service_name.toLowerCase().includes("photo")
  );
  assert(Boolean(photoPreset), "Photography preset exists");
  assert(photoPreset?.frequency === "monthly", "Photography preset frequency is monthly");
  assert(photoPreset?.quantity === 1, "Photography preset quantity is 1/month");

  // TEST SUITE 2: Derivation from Package Deliverables
  console.log("\n--- 2. Derivation from Package Catalog Deliverables ---");
  const sampleDeliverables = [
    { name: "Stories shooting 2x/week", count: 8 },
    { name: "Monthly Reels Shoot (2 days)", count: 2 },
    { name: "8 Feed Posts & Carousels", count: 8 },
    { name: "Photography Session (1/month)", count: 1 },
  ];
  const derived = deriveCommitmentsFromPackage("pkg-lux-001", "client-test-1", sampleDeliverables);
  assert(derived.length === 4, "Derives 4 commitments from sample package deliverables");
  assert(
    derived.some((c) => c.service_name.toLowerCase().includes("stories") && c.frequency === "weekly"),
    "Derives weekly stories commitment with frequency weekly"
  );
  assert(
    derived.some((c) => c.service_name.toLowerCase().includes("reels") && c.frequency === "monthly"),
    "Derives monthly reels shoot commitment"
  );
  assert(
    derived.some((c) => c.service_name.toLowerCase().includes("posts") && c.quantity === 8),
    "Derives monthly posts commitment with quantity 8"
  );
  assert(
    derived.some((c) => c.service_name.toLowerCase().includes("photo") && c.quantity === 1),
    "Derives monthly photo session commitment with quantity 1"
  );

  // TEST SUITE 3: Occurrence Date Calculation Semantics
  console.log("\n--- 3. Schedule Occurrence Calculation (Daily, Weekly, Monthly) ---");
  
  // Weekly occurrences: 2 times/week on Tuesday (day 2) and Thursday (day 4) for 2 weeks
  const sampleWeeklyCommitment: ServiceCommitment = {
    id: "commit-stories-test",
    client_id: "client-001",
    service_name: "Stories shooting",
    category: "content",
    task_type: "story",
    quantity: 2,
    frequency: "weekly",
    lifecycle_status: "active",
    start_date: "2026-10-01",
    end_date: "2026-10-31",
    schedule_rule: {
      days_of_week: [2, 4], // Tuesday & Thursday
      default_time: "10:00",
      estimated_minutes: 90,
    },
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  };

  const weeklyDates = calculateCommitmentOccurrences(
    sampleWeeklyCommitment,
    new Date("2026-10-01T00:00:00"),
    new Date("2026-10-14T23:59:59")
  );
  assert(weeklyDates.length === 4, `Weekly 2x/wk calculates exactly 4 occurrences in 2 weeks (got: ${weeklyDates.length})`);
  assert(weeklyDates.every((occ) => occ.target_date >= "2026-10-01" && occ.target_date <= "2026-10-14"), "All occurrences within bounds");

  // Monthly occurrences with specific shoot days (Reels: 5th & 20th of month)
  const sampleReelsMonthly: ServiceCommitment = {
    id: "commit-reels-test",
    client_id: "client-001",
    service_name: "Reels shooting",
    category: "video",
    task_type: "reel",
    quantity: 2,
    frequency: "monthly",
    lifecycle_status: "active",
    start_date: "2026-10-01",
    schedule_rule: {
      days_of_month: [5, 20],
      default_time: "14:00",
      estimated_minutes: 240,
    },
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  };

  const monthlySpecificDates = calculateCommitmentOccurrences(
    sampleReelsMonthly,
    new Date("2026-10-01T00:00:00"),
    new Date("2026-10-31T23:59:59")
  );
  assert(monthlySpecificDates.length === 2, `Reels 2 days/mo calculates 2 occurrences in October (got: ${monthlySpecificDates.length})`);
  assert(monthlySpecificDates[0].target_date === "2026-10-05", "First shoot occurrence is 2026-10-05");
  assert(monthlySpecificDates[1].target_date === "2026-10-20", "Second shoot occurrence is 2026-10-20");

  // Monthly occurrences with count distribution (Posts: 8/month)
  const samplePostsMonthly: ServiceCommitment = {
    id: "commit-posts-test",
    client_id: "client-001",
    service_name: "Feed Posts & Carousels",
    category: "design",
    task_type: "design",
    quantity: 8,
    frequency: "monthly",
    lifecycle_status: "active",
    start_date: "2026-10-01",
    schedule_rule: {
      default_time: "11:00",
    },
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  };

  const distributedPosts = calculateCommitmentOccurrences(
    samplePostsMonthly,
    new Date("2026-10-01T00:00:00"),
    new Date("2026-10-31T23:59:59")
  );
  assert(distributedPosts.length === 8, `Posts 8/month generates exactly 8 occurrences in one month (got: ${distributedPosts.length})`);

  // Daily occurrences: 1/day for 5 days
  const sampleDaily: ServiceCommitment = {
    id: "commit-daily-test",
    client_id: "client-001",
    service_name: "Community Engagement",
    category: "management",
    task_type: "general",
    quantity: 1,
    frequency: "daily",
    lifecycle_status: "active",
    start_date: "2026-10-01",
    schedule_rule: {
      interval_days: 1,
      default_time: "09:00",
    },
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  };
  const dailyDates = calculateCommitmentOccurrences(
    sampleDaily,
    new Date("2026-10-01T00:00:00"),
    new Date("2026-10-05T23:59:59")
  );
  assert(dailyDates.length === 5, `Daily 1/day generates 5 occurrences across 5 days (got: ${dailyDates.length})`);

  // TEST SUITE 4: Automated & Idempotent Generation Engine
  console.log("\n--- 4. Automated Idempotent Generation Engine ---");
  
  // Track tasks in an in-memory accumulator to verify idempotency without side effects
  let mockDatabaseTasks: TaskRow[] = [];

  // Run 1: Initial generation for October 1 to October 15
  const run1Result = await generateCommitmentTasks({
    commitment: sampleWeeklyCommitment,
    client: { id: "client-001", name: "Luxe Brand Co", status: "active" },
    startDate: new Date("2026-10-01T00:00:00"),
    endDate: new Date("2026-10-15T23:59:59"),
    existingTasks: mockDatabaseTasks,
    commitToDatabase: false, // In-memory dry/unit mode
  });

  assert(run1Result.tasks_created > 0, `Run 1 creates tasks (created: ${run1Result.tasks_created})`);
  assert(run1Result.tasks_skipped_existing === 0, "Run 1 has 0 tasks skipped as existing");

  // Populate mock database with created tasks
  mockDatabaseTasks = [...run1Result.created_tasks];

  // Run 2: Exact same horizon rerunning — MUST BE STRICTLY IDEMPOTENT
  const run2Result = await generateCommitmentTasks({
    commitment: sampleWeeklyCommitment,
    client: { id: "client-001", name: "Luxe Brand Co", status: "active" },
    startDate: new Date("2026-10-01T00:00:00"),
    endDate: new Date("2026-10-15T23:59:59"),
    existingTasks: mockDatabaseTasks,
    commitToDatabase: false,
  });

  assert(run2Result.tasks_created === 0, `Run 2 creates 0 new tasks (Idempotency guarantee met: ${run2Result.tasks_created})`);
  assert(run2Result.tasks_skipped_existing === run1Result.tasks_created, `Run 2 skips all existing ${run1Result.tasks_created} tasks`);
  assert(mockDatabaseTasks.length === run1Result.tasks_created, "Database task count remained unchanged (no duplicates)");

  // TEST SUITE 5: Client Lifecycle Semantics (Active, Paused, Inactive, Reactivated)
  console.log("\n--- 5. Client Lifecycle Invariants (Active, Paused, Inactive, Reactivated) ---");

  // Lifecycle A: Client Paused
  const pausedResult = await generateCommitmentTasks({
    commitment: sampleWeeklyCommitment,
    client: { id: "client-001", name: "Luxe Brand Co", status: "paused" },
    startDate: new Date("2026-10-16T00:00:00"),
    endDate: new Date("2026-10-31T23:59:59"),
    existingTasks: mockDatabaseTasks,
    commitToDatabase: false,
  });

  assert(pausedResult.tasks_created === 0, "Paused client generates 0 new tasks");
  assert(pausedResult.tasks_skipped_paused > 0, `Paused client correctly tracks skipped future tasks (skipped: ${pausedResult.tasks_skipped_paused})`);
  assert(mockDatabaseTasks.length === run1Result.tasks_created, "Historical tasks preserved completely; none deleted during pause");

  // Lifecycle B: Client Inactive
  const inactiveResult = await generateCommitmentTasks({
    commitment: sampleWeeklyCommitment,
    client: { id: "client-001", name: "Luxe Brand Co", status: "inactive" },
    startDate: new Date("2026-10-16T00:00:00"),
    endDate: new Date("2026-10-31T23:59:59"),
    existingTasks: mockDatabaseTasks,
    commitToDatabase: false,
  });
  assert(inactiveResult.tasks_created === 0, "Inactive client generation halts completely");
  assert(inactiveResult.tasks_skipped_inactive > 0, "Inactive client records tasks as halted/inactive");
  assert(mockDatabaseTasks.length === run1Result.tasks_created, "History remains intact after client becomes inactive");

  // Lifecycle C: Client Reactivation
  // Commitment marked active with reactivated_at = "2026-10-20"
  const reactivatedCommitment: ServiceCommitment = {
    ...sampleWeeklyCommitment,
    lifecycle_status: "active",
    reactivated_at: "2026-10-20T00:00:00Z",
  };

  const reactivatedResult = await generateCommitmentTasks({
    commitment: reactivatedCommitment,
    client: { id: "client-001", name: "Luxe Brand Co", status: "active" },
    startDate: new Date("2026-10-01T00:00:00"), // Window spans whole month
    endDate: new Date("2026-10-31T23:59:59"),
    existingTasks: mockDatabaseTasks,
    commitToDatabase: false,
  });

  // Dates before Oct 15 were already in mockDatabaseTasks and skipped.
  // Dates between Oct 20 and Oct 31 are generated fresh without duplicating Oct 1-15.
  assert(reactivatedResult.tasks_created > 0, `Reactivation generates future tasks post-reactivation (created: ${reactivatedResult.tasks_created})`);
  assert(reactivatedResult.tasks_skipped_existing > 0, `Pre-existing historical tasks prior to reactivation are preserved and skipped (skipped: ${reactivatedResult.tasks_skipped_existing})`);

  // Verify all new tasks are on or after reactivated date
  const allPostReactivation = reactivatedResult.created_tasks.every(
    (t) => (t.deadline || "") >= "2026-10-20"
  );
  assert(allPostReactivation, "All newly generated tasks have deadlines on or after reactivation date");

  // TEST SUITE 6: Calendar Entry Completeness
  console.log("\n--- 6. Calendar Entry Data Model Completeness ---");
  const sampleGeneratedTask = run1Result.created_tasks[0];
  assert(Boolean(sampleGeneratedTask.client_id), `Calendar item has client_id: ${sampleGeneratedTask.client_id}`);
  assert(Boolean(sampleGeneratedTask.service), `Calendar item has service name: ${sampleGeneratedTask.service}`);
  assert(Boolean(sampleGeneratedTask.title), `Calendar item has deliverable stage/task title: ${sampleGeneratedTask.title}`);
  assert(Boolean(sampleGeneratedTask.deadline), `Calendar item has scheduled date: ${sampleGeneratedTask.deadline}`);
  assert(Boolean(sampleGeneratedTask.category), `Calendar item has task category: ${sampleGeneratedTask.category}`);

  console.log("\n=======================================================");
  console.log(`SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
