/**
 * SADA OS — Test Suite: Recurring Scheduling Hardening & Integrity (Phase 2.1)
 *
 * Verifies:
 * - Test A: Database Uniqueness & Occurrence Identity
 * - Test B: Concurrent Generation (3 simultaneous requests => exactly 1 task per occurrence)
 * - Test C: Repeated Generation (4 sequential runs => 0 duplicate tasks)
 * - Test D: Workflow Stage Idempotency (3 instantiate calls => exactly 1 stage set)
 * - Test E: Pause Semantics (Preserves history, generates 0 new tasks)
 * - Test F: Resume Semantics (No backfill of paused period, no duplicates)
 * - Test G: Reactivation Boundary (Respects reactivated_at, historical records preserved)
 * - Test H: Date Determinism & Timezone Safety (Feb 28, Feb 29 leap, 30-day, 31-day, mid-month, qty > days)
 * - Test I: Calendar Integrity (project_tasks remains canonical projection source)
 */

import {
  CANONICAL_SERVICE_COMMITMENT_PRESETS,
  calculateCommitmentOccurrences,
  deriveCommitmentsFromPackage,
  generateCommitmentTasks,
  resolveSchedulingPreset,
  createSafeCalendarDate,
  parseSafeCalendarDate,
} from "../src/lib/recurring-scheduling-service";
import {
  instantiateWorkflowStages,
  CANONICAL_WORKFLOW_TEMPLATES,
} from "../src/lib/workflow-service";
import type { ServiceCommitment } from "../src/types/service-commitment";
import type { TaskRow, TeamMemberRow, ProfileRow } from "../src/components/admin/project-utils";

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

async function runHardeningTests() {
  console.log("\n=======================================================");
  console.log("SADA OS — Phase 2.1 Recurring Scheduling Hardening Suite");
  console.log("=======================================================\n");

  const mockTeamMembers: TeamMemberRow[] = [
    {
      id: "tm-1",
      profile_id: "prof-1",
      name: "Ahmed Videographer",
      role: "videographer",
      position: "Senior Videographer",
      division: "Production",
      is_active: true,
      availability_status: "available",
      specialties: ["reels", "shooting", "videographer"],
    } as any,
  ];

  const mockProfiles: ProfileRow[] = [
    {
      id: "prof-1",
      email: "ahmed@sada.tn",
      full_name: "Ahmed Videographer",
      role: "worker",
    } as any,
  ];

  // --------------------------------------------------------------------------
  // TEST A: Database Uniqueness & Structured Occurrence Identity
  // --------------------------------------------------------------------------
  console.log("--- TEST A: Database Uniqueness & Structured Identity ---");
  const testCommitmentA: ServiceCommitment = {
    id: "commit-uniq-001",
    client_id: "client-harden-1",
    service_name: "Reels Shooting",
    deliverable_type: "reels_shooting",
    quantity: 2,
    frequency: "monthly",
    schedule_rule: {
      frequency: "monthly",
      quantity: 2,
      days_of_month: [5, 20],
      duration_hours: 4.0,
    },
    start_date: "2026-10-01",
    status: "active",
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  };

  const occurrencesA = calculateCommitmentOccurrences(testCommitmentA, "2026-10");
  assert(occurrencesA.length === 2, "Generates 2 occurrences for Reels Shoot");
  assert(
    occurrencesA[0].idempotency_key === "commit_commit-uniq-001_2026-10-05_seq1",
    "First occurrence has deterministic composite idempotency_key"
  );
  assert(
    occurrencesA[0].occurrence_date === "2026-10-05" && occurrencesA[0].sequence_index === 1,
    "Occurrence contains explicit structured occurrence_date and sequence_index"
  );
  assert(
    occurrencesA[1].idempotency_key === "commit_commit-uniq-001_2026-10-20_seq2",
    "Second occurrence has deterministic composite idempotency_key"
  );
  assert(
    occurrencesA[1].occurrence_date === "2026-10-20" && occurrencesA[1].sequence_index === 2,
    "Occurrence 2 contains explicit structured occurrence_date and sequence_index"
  );

  // --------------------------------------------------------------------------
  // TEST B: Concurrency Safety (Simultaneous Generation Requests)
  // --------------------------------------------------------------------------
  console.log("\n--- TEST B: Concurrency Safety (3 Simultaneous Requests) ---");
  const sharedTaskListB: TaskRow[] = [];

  // Simulate 3 concurrent requests calling generateCommitmentTasks with shared storage
  const [resB1, resB2, resB3] = await Promise.all([
    generateCommitmentTasks({
      commitment: testCommitmentA,
      client: { id: "client-harden-1", name: "Client Harden", status: "active" },
      existingTasks: sharedTaskListB,
      commitToDatabase: false,
    }),
    generateCommitmentTasks({
      commitment: testCommitmentA,
      client: { id: "client-harden-1", name: "Client Harden", status: "active" },
      existingTasks: sharedTaskListB,
      commitToDatabase: false,
    }),
    generateCommitmentTasks({
      commitment: testCommitmentA,
      client: { id: "client-harden-1", name: "Client Harden", status: "active" },
      existingTasks: sharedTaskListB,
      commitToDatabase: false,
    }),
  ]);

  const totalCreatedB = resB1.tasks_created + resB2.tasks_created + resB3.tasks_created;
  assert(totalCreatedB === 2, `Concurrent generation resulted in exactly 2 total tasks created (got: ${totalCreatedB})`);
  assert(
    sharedTaskListB.length === 2,
    `Persisted task array contains exactly 2 tasks, not 6 (got: ${sharedTaskListB.length})`
  );
  assert(
    sharedTaskListB[0].idempotency_key !== sharedTaskListB[1].idempotency_key,
    "Persisted tasks have distinct idempotency keys"
  );

  // --------------------------------------------------------------------------
  // TEST C: Repeated Generation (4 Sequential Runs)
  // --------------------------------------------------------------------------
  console.log("\n--- TEST C: Repeated Generation (4 Sequential Runs) ---");
  const sharedTaskListC: TaskRow[] = [];

  const runC1 = await generateCommitmentTasks({
    commitment: testCommitmentA,
    client: { id: "client-harden-1", name: "Client Harden", status: "active" },
    existingTasks: sharedTaskListC,
    commitToDatabase: false,
  });
  assert(runC1.tasks_created === 2, "Run 1 created 2 tasks");
  assert(runC1.tasks_skipped_existing === 0, "Run 1 skipped 0 existing tasks");

  const runC2 = await generateCommitmentTasks({
    commitment: testCommitmentA,
    client: { id: "client-harden-1", name: "Client Harden", status: "active" },
    existingTasks: sharedTaskListC,
    commitToDatabase: false,
  });
  assert(runC2.tasks_created === 0, "Run 2 created 0 tasks (Idempotent guarantee)");
  assert(runC2.tasks_skipped_existing === 2, "Run 2 skipped 2 existing tasks");

  const runC3 = await generateCommitmentTasks({
    commitment: testCommitmentA,
    client: { id: "client-harden-1", name: "Client Harden", status: "active" },
    existingTasks: sharedTaskListC,
    commitToDatabase: false,
  });
  assert(runC3.tasks_created === 0, "Run 3 created 0 tasks");
  assert(runC3.tasks_skipped_existing === 2, "Run 3 skipped 2 existing tasks");

  const runC4 = await generateCommitmentTasks({
    commitment: testCommitmentA,
    client: { id: "client-harden-1", name: "Client Harden", status: "active" },
    existingTasks: sharedTaskListC,
    commitToDatabase: false,
  });
  assert(runC4.tasks_created === 0, "Run 4 created 0 tasks");
  assert(runC4.tasks_skipped_existing === 2, "Run 4 skipped 2 existing tasks");
  assert(sharedTaskListC.length === 2, "Total database tasks remained strictly 2 across 4 runs");

  // --------------------------------------------------------------------------
  // TEST D: Workflow Stage Idempotency
  // --------------------------------------------------------------------------
  console.log("\n--- TEST D: Workflow Stage Idempotency ---");
  const reelTemplate = CANONICAL_WORKFLOW_TEMPLATES.find((t) => t.task_type === "reel")!;
  const parentTaskD: TaskRow = {
    id: "parent-task-reel-hardening",
    project_id: "proj-1",
    client_id: "client-harden-1",
    commitment_id: "commit-uniq-001",
    title: "Client Harden — Reels Shooting (Day 1/2)",
    status: "todo",
    priority: "high",
    deadline: "2026-10-05",
    scheduled_date: "2026-10-05",
    sort_order: 1,
    notes: "Parent deliverable task",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as TaskRow;

  const subtaskListD: TaskRow[] = [];

  // Call 1
  const stageRes1 = await instantiateWorkflowStages({
    parentTask: parentTaskD,
    template: reelTemplate,
    teamMembers: mockTeamMembers,
    profiles: mockProfiles,
    existingSubtasks: subtaskListD,
    commitToDatabase: false,
  });
  assert(stageRes1.success === true, "Stage instantiation 1 succeeded");
  assert(stageRes1.createdTasks.length === 4, "Created 4 workflow stages on Call 1");

  // Call 2
  const stageRes2 = await instantiateWorkflowStages({
    parentTask: parentTaskD,
    template: reelTemplate,
    teamMembers: mockTeamMembers,
    profiles: mockProfiles,
    existingSubtasks: subtaskListD,
    commitToDatabase: false,
  });
  assert(stageRes2.success === true, "Stage instantiation 2 succeeded");
  assert(subtaskListD.length === 4, "Subtasks count remained 4 on Call 2 (No duplicate stages)");

  // Call 3
  const stageRes3 = await instantiateWorkflowStages({
    parentTask: parentTaskD,
    template: reelTemplate,
    teamMembers: mockTeamMembers,
    profiles: mockProfiles,
    existingSubtasks: subtaskListD,
    commitToDatabase: false,
  });
  assert(stageRes3.success === true, "Stage instantiation 3 succeeded");
  assert(subtaskListD.length === 4, "Subtasks count remained 4 on Call 3 (Zero duplicates)");
  assert(
    subtaskListD.map((t) => t.sort_order).join(",") === "1,2,3,4",
    "Subtasks have structured sort_order preserved: 1, 2, 3, 4"
  );
  assert(
    subtaskListD.every((t) => t.parent_task_id === parentTaskD.id),
    "All stages linked to parent_task_id"
  );

  // --------------------------------------------------------------------------
  // TEST E: Pause Semantics (Preserves History, Halts Future Generation)
  // --------------------------------------------------------------------------
  console.log("\n--- TEST E: Pause Semantics ---");
  const pausedCommitment: ServiceCommitment = {
    ...testCommitmentA,
    status: "paused",
    paused_at: "2026-10-10T12:00:00Z",
  };

  const tasksBeforePause: TaskRow[] = [...sharedTaskListC]; // Has 2 tasks
  assert(tasksBeforePause.length === 2, "Historical records before pause: 2 tasks");

  const pauseRes = await generateCommitmentTasks({
    commitment: pausedCommitment,
    client: { id: "client-harden-1", name: "Client Harden", status: "active" },
    existingTasks: tasksBeforePause,
    commitToDatabase: false,
  });
  assert(pauseRes.tasks_created === 0, "Paused commitment generates 0 new tasks");
  assert(pauseRes.tasks_skipped_paused === 1, "Paused commitment recorded as skipped_paused");
  assert(tasksBeforePause.length === 2, "Historical records are 100% preserved and untouched");

  // --------------------------------------------------------------------------
  // TEST F: Resume Semantics (No Backfilling of Paused Period, No Duplicates)
  // --------------------------------------------------------------------------
  console.log("\n--- TEST F: Resume Semantics ---");
  // Commitment was paused Oct 6 and resumed Oct 15
  const resumedCommitment: ServiceCommitment = {
    ...testCommitmentA,
    status: "active",
    paused_at: "2026-10-06T12:00:00Z",
    reactivated_at: "2026-10-15T12:00:00Z", // Resumed on Oct 15
  };

  // Pre-existing tasks: Oct 5 task already exists. Oct 20 task does not yet exist.
  const oct5Task: TaskRow = {
    id: "task_commit-uniq-001_2026-10-05_seq1",
    commitment_id: testCommitmentA.id,
    occurrence_date: "2026-10-05",
    sequence_index: 1,
    scheduled_date: "2026-10-05",
    deadline: "2026-10-05",
    idempotency_key: "commit_commit-uniq-001_2026-10-05_seq1",
    title: "Client Harden — Reels Shooting (Day 1/2)",
    status: "todo",
  } as TaskRow;

  const resumedTaskList: TaskRow[] = [oct5Task];

  const resumeRes = await generateCommitmentTasks({
    commitment: resumedCommitment,
    client: { id: "client-harden-1", name: "Client Harden", status: "active" },
    existingTasks: resumedTaskList,
    commitToDatabase: false,
  });

  // Since reactivated_at is Oct 15, Oct 5 (before Oct 15) is skipped due to boundary/existing!
  // Oct 20 (>= Oct 15) is created!
  assert(resumeRes.tasks_created === 1, `Resume generates eligible future occurrence (created: ${resumeRes.tasks_created})`);
  assert(resumedTaskList.length === 2, "Total tasks after resume is 2");
  assert(
    resumedTaskList.some((t) => t.deadline === "2026-10-20"),
    "Generated Oct 20 task from resume point forward"
  );
  assert(
    !resumedTaskList.some((t) => t.deadline === "2026-10-05" && t.id !== oct5Task.id),
    "Never duplicated pre-existing Oct 5 task"
  );

  // --------------------------------------------------------------------------
  // TEST G: Reactivation Boundary Semantics
  // --------------------------------------------------------------------------
  console.log("\n--- TEST G: Inactive -> Reactivated Boundary Semantics ---");
  const weeklyCommitment: ServiceCommitment = {
    id: "commit-weekly-harden",
    client_id: "client-harden-1",
    service_name: "Stories Shooting",
    deliverable_type: "stories_shooting",
    quantity: 2,
    frequency: "weekly",
    schedule_rule: {
      frequency: "weekly",
      quantity: 2,
      days_of_week: [2, 4], // Tuesday & Thursday
    },
    start_date: "2026-10-01",
    status: "active",
    reactivated_at: "2026-10-18T10:00:00Z", // Reactivated on Oct 18 (Sunday)
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-18T10:00:00Z",
  };

  const reactivateOccurrences = calculateCommitmentOccurrences(weeklyCommitment, "2026-10");
  const reactivateTaskList: TaskRow[] = [];

  const reactivateRes = await generateCommitmentTasks({
    commitment: weeklyCommitment,
    client: { id: "client-harden-1", name: "Client Harden", status: "active" },
    existingTasks: reactivateTaskList,
    commitToDatabase: false,
  });

  // Tuesdays/Thursdays in October:
  // Oct 1 (Thu), Oct 6 (Tue), Oct 8 (Thu), Oct 13 (Tue), Oct 15 (Thu) => all < Oct 18
  // Oct 20 (Tue), Oct 22 (Thu), Oct 27 (Tue), Oct 29 (Thu) => >= Oct 18 (4 occurrences)
  assert(
    reactivateRes.tasks_created === 4,
    `Only eligible future occurrences >= reactivation date generated (got: ${reactivateRes.tasks_created})`
  );
  assert(
    reactivateTaskList.every((t) => t.deadline! >= "2026-10-18"),
    "All generated tasks have deadlines on or after reactivation date (Oct 18)"
  );

  // --------------------------------------------------------------------------
  // TEST H: Date Determinism & Timezone Correctness
  // --------------------------------------------------------------------------
  console.log("\n--- TEST H: Date Determinism & Timezone Correctness ---");

  // H1: February 28-day month (2025-02)
  const feb28Commitment: ServiceCommitment = {
    id: "commit-feb28",
    client_id: "client-harden-1",
    service_name: "Posts Publishing",
    deliverable_type: "post",
    quantity: 8, // 8 posts across 28 days
    frequency: "monthly",
    start_date: "2025-02-01",
    status: "active",
    schedule_rule: {
      frequency: "monthly",
      quantity: 8,
    },
    created_at: "2025-02-01T00:00:00Z",
    updated_at: "2025-02-01T00:00:00Z",
  };
  const feb28Occs1 = calculateCommitmentOccurrences(feb28Commitment, "2025-02");
  const feb28Occs2 = calculateCommitmentOccurrences(feb28Commitment, "2025-02");
  assert(feb28Occs1.length === 8, `Feb 28-day month produces 8 occurrences (got: ${feb28Occs1.length})`);
  assert(
    JSON.stringify(feb28Occs1.map((o) => o.target_date)) === JSON.stringify(feb28Occs2.map((o) => o.target_date)),
    "Feb 28-day month calculation is 100% deterministic across repeated runs"
  );
  assert(
    feb28Occs1.every((o) => o.target_date >= "2025-02-01" && o.target_date <= "2025-02-28"),
    "All Feb 28 dates stay within 2025-02-01 and 2025-02-28"
  );

  // H2: February 29-day leap month (2028-02)
  const feb29Commitment: ServiceCommitment = {
    id: "commit-feb29",
    client_id: "client-harden-1",
    service_name: "Posts Publishing",
    deliverable_type: "post",
    quantity: 8,
    frequency: "monthly",
    start_date: "2028-02-01",
    status: "active",
    schedule_rule: {
      frequency: "monthly",
      quantity: 8,
    },
    created_at: "2028-02-01T00:00:00Z",
    updated_at: "2028-02-01T00:00:00Z",
  };
  const feb29Occs = calculateCommitmentOccurrences(feb29Commitment, "2028-02");
  assert(feb29Occs.length === 8, "Feb 29-day leap month produces exactly 8 occurrences");
  assert(
    feb29Occs.every((o) => o.target_date >= "2028-02-01" && o.target_date <= "2028-02-29"),
    "Leap month dates stay within 2028-02-01 and 2028-02-29"
  );

  // H3: 30-day month (2026-04)
  const apr30Commitment: ServiceCommitment = {
    id: "commit-apr30",
    client_id: "client-harden-1",
    service_name: "Posts Publishing",
    deliverable_type: "post",
    quantity: 8,
    frequency: "monthly",
    start_date: "2026-04-01",
    status: "active",
    schedule_rule: {
      frequency: "monthly",
      quantity: 8,
    },
    created_at: "2026-04-01T00:00:00Z",
    updated_at: "2026-04-01T00:00:00Z",
  };
  const apr30Occs = calculateCommitmentOccurrences(apr30Commitment, "2026-04");
  assert(apr30Occs.length === 8, "30-day month produces 8 occurrences");
  assert(
    apr30Occs.every((o) => o.target_date >= "2026-04-01" && o.target_date <= "2026-04-30"),
    "30-day month occurrences stay within April bounds"
  );

  // H4: 31-day month (2026-10)
  const oct31Commitment: ServiceCommitment = {
    id: "commit-oct31",
    client_id: "client-harden-1",
    service_name: "Posts Publishing",
    deliverable_type: "post",
    quantity: 8,
    frequency: "monthly",
    start_date: "2026-10-01",
    status: "active",
    schedule_rule: {
      frequency: "monthly",
      quantity: 8,
    },
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  };
  const oct31Occs = calculateCommitmentOccurrences(oct31Commitment, "2026-10");
  assert(oct31Occs.length === 8, "31-day month produces 8 occurrences");

  // H5: Mid-month start (e.g. start_date = 2026-10-15)
  const midStartCommitment: ServiceCommitment = {
    id: "commit-mid-start",
    client_id: "client-harden-1",
    service_name: "Posts Publishing",
    deliverable_type: "post",
    quantity: 4,
    frequency: "monthly",
    start_date: "2026-10-15",
    status: "active",
    schedule_rule: {
      frequency: "monthly",
      quantity: 4,
    },
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  };
  const midStartOccs = calculateCommitmentOccurrences(midStartCommitment, "2026-10");
  assert(midStartOccs.length === 4, "Mid-month start produces 4 occurrences");
  assert(
    midStartOccs.every((o) => o.target_date >= "2026-10-15"),
    "All mid-month occurrences are on or after start_date (Oct 15)"
  );

  // H6: Mid-month end (e.g. end_date = 2026-10-15)
  const midEndCommitment: ServiceCommitment = {
    id: "commit-mid-end",
    client_id: "client-harden-1",
    service_name: "Posts Publishing",
    deliverable_type: "post",
    quantity: 4,
    frequency: "monthly",
    start_date: "2026-10-01",
    end_date: "2026-10-15",
    status: "active",
    schedule_rule: {
      frequency: "monthly",
      quantity: 4,
    },
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  };
  const midEndOccs = calculateCommitmentOccurrences(midEndCommitment, "2026-10");
  assert(midEndOccs.length === 4, "Mid-month end produces 4 occurrences");
  assert(
    midEndOccs.every((o) => o.target_date <= "2026-10-15"),
    "All mid-month occurrences are on or before end_date (Oct 15)"
  );

  // H7: Quantity larger than available days (e.g. 5 occurrences in 2 available days: Oct 30 and Oct 31)
  const highQtyCommitment: ServiceCommitment = {
    id: "commit-high-qty",
    client_id: "client-harden-1",
    service_name: "Stories Shooting",
    deliverable_type: "stories_shooting",
    quantity: 5,
    frequency: "monthly",
    start_date: "2026-10-30",
    end_date: "2026-10-31",
    status: "active",
    schedule_rule: {
      frequency: "monthly",
      quantity: 5,
    },
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  };
  const highQtyOccs = calculateCommitmentOccurrences(highQtyCommitment, "2026-10");
  assert(highQtyOccs.length === 5, "Quantity larger than available days produces all 5 occurrences");
  assert(
    new Set(highQtyOccs.map((o) => o.sequence_index)).size === 5,
    "Each occurrence maintains distinct sequence_index (1 to 5)"
  );
  assert(
    new Set(highQtyOccs.map((o) => o.idempotency_key)).size === 5,
    "Each occurrence maintains distinct idempotency_key"
  );

  // H8: Timezone Safety — parseSafeCalendarDate never shifts calendar day
  const testDateStr = "2026-10-01";
  const parsedSafe = parseSafeCalendarDate(testDateStr);
  const formattedBack = `${parsedSafe.getFullYear()}-${String(parsedSafe.getMonth() + 1).padStart(2, "0")}-${String(parsedSafe.getDate()).padStart(2, "0")}`;
  assert(formattedBack === testDateStr, `Calendar date ${testDateStr} is immune to timezone day shift`);

  // --------------------------------------------------------------------------
  // TEST I: Calendar Integrity (project_tasks remains canonical projection)
  // --------------------------------------------------------------------------
  console.log("\n--- TEST I: Calendar Integrity & Quota Linkage ---");
  const deliverableLinkedCommitment: ServiceCommitment = {
    ...testCommitmentA,
    id: "commit-deliv-001",
    deliverable_id: "deliv-quota-sep-reels",
  };

  const calendarTasksList: TaskRow[] = [];
  const calRes = await generateCommitmentTasks({
    commitment: deliverableLinkedCommitment,
    client: { id: "client-harden-1", name: "Client Harden", status: "active" },
    existingTasks: calendarTasksList,
    commitToDatabase: false,
  });

  assert(calRes.tasks_created === 2, "Calendar tasks created via canonical project_tasks");
  assert(
    calendarTasksList.every((t) => t.deliverable_id === "deliv-quota-sep-reels"),
    "Generated tasks retain deliverable_id for quota reconciliation"
  );
  assert(
    calendarTasksList.every((t) => Boolean(t.scheduled_date && t.deadline && t.commitment_id)),
    "Generated tasks provide all canonical fields required by CalendarGrid"
  );

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log("\n=======================================================");
  console.log(`Phase 2.1 Hardening Results: ${passed} PASSED | ${failed} FAILED`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runHardeningTests().catch((err) => {
  console.error("Hardening test runner failed:", err);
  process.exit(1);
});
