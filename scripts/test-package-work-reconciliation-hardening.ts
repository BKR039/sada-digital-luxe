// ============================================================
// SADA OS — PHASE 4.1: RECONCILIATION SAFETY & WORK PROVENANCE HARDENING TEST SUITE
// Validates:
// Group A: Quantity Ownership & Authority Hierarchy
// Group B: Manual Task Isolation (Manual tasks never cancelled)
// Group C: Manual Date Override Protection (Reschedule safety)
// Group D: Manual Assignee Override Protection
// Group E: Historical Work Protection (Done/delivered/approved immutable)
// Group F: In-Progress Work Protection (In-progress/review/revision/blocked immutable)
// Group G: Quota Increase (Deterministic sequence continuation, no duplicates)
// Group H: Quota Decrease with Mixed Work
// Group I: Repeated Idempotency (4 sequential runs -> zero unexpected mutations)
// Group J: Concurrency & Race Safety (Simultaneous reconciliations)
// Group K: Schedule Rule Change with Mixed Tasks
// Group L: Audit Trail Integrity & Zero Fake Mutation Records
// Group M: Live Preview vs Actual Reconciliation Parity
// ============================================================

import {
  resolveAuthoritativePackageConfig,
  reconcileClientPackageWork,
  reconcileSingleCommitmentWork,
  previewPackageReconciliation,
  calculateReconciliationDiff,
  isTaskReconciliationControlled,
  type AuthoritativePackageState,
} from "../src/lib/package-reconciliation-service";
import type { ClientRow, TaskRow } from "../src/components/admin/project-utils";
import type { ServiceCommitment } from "../src/types/service-commitment";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${detail ? ` — ${detail}` : ""}`);
    failedCount++;
  }
}

async function runHardeningSuite() {
  console.log("=======================================================================");
  console.log("SADA OS — Phase 4.1 Reconciliation Safety & Provenance Hardening Suite");
  console.log("=======================================================================\n");

  const TEST_CLIENT_ID = "client_hardening_401";
  const PERIOD_MONTH = "2026-10";

  // -------------------------------------------------------------
  // GROUP A: Quantity Ownership & Authority Hierarchy
  // -------------------------------------------------------------
  console.log("--- GROUP A: Quantity Ownership & Authority Hierarchy ---");
  {
    // 1. Catalog default package definition
    const catalogItem: any = {
      id: "pkg_standard_catalog",
      name: "Standard Catalog Package",
      monthly_reels: 4,
      monthly_posts: 8,
      monthly_stories: "12",
      has_ads_management: false,
    };

    // 2. Client with no override inherits catalog defaults
    const clientWithCatalog: Partial<ClientRow> = {
      id: TEST_CLIENT_ID,
      package_id: catalogItem.id,
      package_config: null,
    };
    const resolvedCatalog = resolveAuthoritativePackageConfig(clientWithCatalog as any, catalogItem);
    assert(resolvedCatalog.quotas.reels === 4, "Catalog default: reels = 4");
    assert(resolvedCatalog.quotas.posts === 8, "Catalog default: posts = 8");
    assert(resolvedCatalog.quotas.stories === 12, "Catalog default: stories = 12");

    // 3. Client override explicitly takes precedence over catalog
    const clientWithOverride: Partial<ClientRow> = {
      id: TEST_CLIENT_ID,
      package_id: catalogItem.id,
      package_config: {
        reels_quota: 10,
        posts_quota: 15,
        stories_quota: 20,
      },
    };
    const resolvedOverride = resolveAuthoritativePackageConfig(clientWithOverride as any, catalogItem);
    assert(resolvedOverride.quotas.reels === 10, "Client override takes precedence: reels = 10");
    assert(resolvedOverride.quotas.posts === 15, "Client override takes precedence: posts = 15");
    assert(resolvedOverride.quotas.stories === 20, "Client override takes precedence: stories = 20");

    // 4. Invariant: Service commitment does NOT compete with package entitlement
    const commitmentWithDifferentQty: ServiceCommitment = {
      id: "commit_reels_test",
      client_id: TEST_CLIENT_ID,
      service_name: "Reels Shooting",
      deliverable_type: "reels_shooting",
      quantity: 2, // 2 dedicated shoot sessions per month
      frequency: "monthly",
      schedule_rule: {
        frequency: "monthly",
        quantity: 2,
        days_of_month: [5, 20],
      },
      start_date: "2026-10-01",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const inMemoryDeliverables = [
      {
        id: "deliv_reels_oct",
        client_id: TEST_CLIENT_ID,
        deliverable_type: "reels_shooting",
        target_quantity: 10, // Canonical deliverable target
        done_quantity: 0,
        remaining_quantity: 10,
        period_month: PERIOD_MONTH,
      },
    ];

    const clientWithReelsOnly: Partial<ClientRow> = {
      id: TEST_CLIENT_ID,
      name: "Authority Client",
      package_config: {
        reels_quota: 10,
      },
    };

    const inMemoryTasks: TaskRow[] = [];
    const report = await reconcileClientPackageWork(
      {
        clientId: TEST_CLIENT_ID,
        periodMonth: PERIOD_MONTH,
        packageConfig: { reels_quota: 10 },
        commitToDatabase: false,
      },
      {
        client: clientWithReelsOnly as any,
        tasks: inMemoryTasks,
        commitments: [commitmentWithDifferentQty],
        deliverables: inMemoryDeliverables,
      }
    );

    const reelsDiff = report.diffs.find((d) => d.deliverable_type === "reels_shooting");
    const reelsTasks = inMemoryTasks.filter((t) => t.service === "Reels Shooting");

    assert(reelsDiff?.desired_quota === 10, "Canonical deliverable target (10) determines quantity, NOT commitment quantity (2)");
    assert(reelsTasks.length === 10, "Total generated tasks equals authoritative deliverable target 10");
  }

  // -------------------------------------------------------------
  // GROUP B: Manual Task Isolation (Protection of Human Work)
  // -------------------------------------------------------------
  console.log("\n--- GROUP B: Manual Task Isolation ---");
  {
    // Setup: 8 generated tasks + 2 manual tasks = 10 total todo tasks
    const inMemoryTasks: TaskRow[] = [];
    const clientState: ClientRow = {
      id: TEST_CLIENT_ID,
      name: "Isolation Corp",
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      package_config: { reels_quota: 10 },
    };

    // 8 system-generated reconciliation tasks
    for (let i = 1; i <= 8; i++) {
      inMemoryTasks.push({
        id: `task_gen_${i}`,
        client_id: TEST_CLIENT_ID,
        title: `Isolation Corp — Reels Shooting (#${i}/10)`,
        service: "Reels Shooting",
        category: "Reel",
        status: "todo",
        deadline: `2026-10-${String(i * 3).padStart(2, "0")}`,
        occurrence_date: `2026-10-${String(i * 3).padStart(2, "0")}`,
        sequence_index: i,
        delivery_period: PERIOD_MONTH,
        source_type: "package_reconciliation",
        is_reconciliation_managed: true,
        manual_override: false,
      } as any);
    }

    // 2 manually created tasks by operations team
    inMemoryTasks.push({
      id: "task_manual_vip_1",
      client_id: TEST_CLIENT_ID,
      title: "VIP CEO Urgent Statement Reel",
      service: "Reels Shooting",
      category: "Reel",
      status: "todo",
      deadline: "2026-10-18",
      occurrence_date: "2026-10-18",
      delivery_period: PERIOD_MONTH,
      source_type: "manual",
      is_reconciliation_managed: false,
      manual_override: false,
    } as any);

    inMemoryTasks.push({
      id: "task_manual_vip_2",
      client_id: TEST_CLIENT_ID,
      title: "Product Launch Teaser Reel",
      service: "Reels Shooting",
      category: "Reel",
      status: "todo",
      deadline: "2026-10-28",
      occurrence_date: "2026-10-28",
      delivery_period: PERIOD_MONTH,
      source_type: "manual",
      is_reconciliation_managed: false,
      manual_override: false,
    } as any);

    assert(inMemoryTasks.length === 10, "Starting with 10 tasks (8 generated + 2 manual)");

    // Decrease package quota: 10 -> 6
    const report = await reconcileClientPackageWork(
      {
        clientId: TEST_CLIENT_ID,
        periodMonth: PERIOD_MONTH,
        packageConfig: { reels_quota: 6 },
        commitToDatabase: false,
      },
      { client: clientState, tasks: inMemoryTasks }
    );

    assert(report.total_tasks_pruned === 4, `Exactly 4 excess tasks pruned (got: ${report.total_tasks_pruned})`);
    assert(inMemoryTasks.length === 6, `Total remaining tasks is 6 (got: ${inMemoryTasks.length})`);

    // Verify manual tasks are 100% intact!
    const manual1 = inMemoryTasks.find((t) => t.id === "task_manual_vip_1");
    const manual2 = inMemoryTasks.find((t) => t.id === "task_manual_vip_2");
    assert(Boolean(manual1), "Manual Task 1 (VIP CEO) was NOT deleted or cancelled");
    assert(Boolean(manual2), "Manual Task 2 (Product Launch) was NOT deleted or cancelled");
    assert(manual1?.status === "todo", "Manual Task 1 status remains 'todo'");
    assert(manual2?.status === "todo", "Manual Task 2 status remains 'todo'");

    // Verify that the 4 pruned tasks were strictly from the generated group
    assert(!inMemoryTasks.some((t) => t.id === "task_gen_8"), "Generated task 8 pruned");
    assert(!inMemoryTasks.some((t) => t.id === "task_gen_7"), "Generated task 7 pruned");
    assert(!inMemoryTasks.some((t) => t.id === "task_gen_6"), "Generated task 6 pruned");
    assert(!inMemoryTasks.some((t) => t.id === "task_gen_5"), "Generated task 5 pruned");
    assert(inMemoryTasks.some((t) => t.id === "task_gen_1"), "Generated task 1 preserved");
  }

  // -------------------------------------------------------------
  // GROUP C: Manual Date Override Protection
  // -------------------------------------------------------------
  console.log("\n--- GROUP C: Manual Date Override Protection ---");
  {
    const commitment: ServiceCommitment = {
      id: "commit_override_test",
      client_id: TEST_CLIENT_ID,
      service_name: "Reels Shooting",
      deliverable_type: "reels_shooting",
      quantity: 2,
      frequency: "monthly",
      schedule_rule: {
        frequency: "monthly",
        quantity: 2,
        days_of_month: [10, 25], // Changed rule from [5, 20] to [10, 25]
      },
      start_date: "2026-10-01",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Task originally generated on Oct 5, manager manually moved to Oct 8
    const inMemoryTasks: TaskRow[] = [
      {
        id: "task_manually_moved",
        commitment_id: commitment.id,
        client_id: TEST_CLIENT_ID,
        service: "Reels Shooting",
        status: "todo",
        deadline: "2026-10-08", // Manually changed to 8th
        occurrence_date: "2026-10-08",
        sequence_index: 1,
        delivery_period: PERIOD_MONTH,
        source_type: "package_reconciliation",
        is_reconciliation_managed: true,
        manual_override: true, // Human flag set!
      } as any,
      {
        id: "task_untouched_gen",
        commitment_id: commitment.id,
        client_id: TEST_CLIENT_ID,
        service: "Reels Shooting",
        status: "todo",
        deadline: "2026-10-20", // Originally 20th
        occurrence_date: "2026-10-20",
        sequence_index: 2,
        delivery_period: PERIOD_MONTH,
        source_type: "package_reconciliation",
        is_reconciliation_managed: true,
        manual_override: false, // Untouched by humans
      } as any,
    ];

    const res = await reconcileSingleCommitmentWork({
      clientId: TEST_CLIENT_ID,
      commitment,
      periodMonth: PERIOD_MONTH,
      existingTasks: inMemoryTasks,
      commitToDatabase: false,
    });

    assert(res.success === true, "Commitment reconciliation succeeded");
    const movedTask = inMemoryTasks.find((t) => t.id === "task_manually_moved");
    assert(
      (movedTask as any)?.occurrence_date === "2026-10-08",
      `Manually moved task remains strictly on Oct 8 (got: ${(movedTask as any)?.occurrence_date})`
    );
    assert(movedTask?.deadline === "2026-10-08", "Deadline remains Oct 8");

    const untouchedTask = inMemoryTasks.find((t) => t.id === "task_untouched_gen");
    assert(
      (untouchedTask as any)?.occurrence_date === "2026-10-25" || (untouchedTask as any)?.occurrence_date === "2026-10-10",
      `Untouched generated task was rescheduled to new recurrence date (got: ${(untouchedTask as any)?.occurrence_date})`
    );
  }

  // -------------------------------------------------------------
  // GROUP D: Manual Assignee Override Protection
  // -------------------------------------------------------------
  console.log("\n--- GROUP D: Manual Assignee Override Protection ---");
  {
    const taskWithAssigneeOverride: TaskRow = {
      id: "task_assignee_override",
      client_id: TEST_CLIENT_ID,
      title: "Reels Shooting with Lead Videographer",
      service: "Reels Shooting",
      category: "Reel",
      status: "todo",
      deadline: "2026-10-15",
      occurrence_date: "2026-10-15",
      sequence_index: 1,
      delivery_period: PERIOD_MONTH,
      source_type: "package_reconciliation",
      is_reconciliation_managed: true,
      manual_override: true,
      assignee_id: "usr_specialist_bob",
    };

    assert(isTaskReconciliationControlled(taskWithAssigneeOverride) === false, "Task with manual_override=true is NOT reconciliation controlled");

    const inMemoryTasks = [taskWithAssigneeOverride];
    const report = await reconcileClientPackageWork(
      {
        clientId: TEST_CLIENT_ID,
        periodMonth: PERIOD_MONTH,
        packageConfig: { reels_quota: 1 },
        commitToDatabase: false,
      },
      {
        client: { id: TEST_CLIENT_ID, name: "Assignee Corp", package_config: { reels_quota: 1 } } as any,
        tasks: inMemoryTasks,
      }
    );

    assert(inMemoryTasks.length === 1, "Task maintained in sync");
    assert(inMemoryTasks[0].assignee_id === "usr_specialist_bob", "Assignee remained 'usr_specialist_bob' (never overwritten)");
  }

  // -------------------------------------------------------------
  // GROUP E: Historical Work Protection (Done, Approved, Delivered)
  // -------------------------------------------------------------
  console.log("\n--- GROUP E: Historical Work Protection ---");
  {
    const inMemoryTasks: TaskRow[] = [
      { id: "t_done_1", status: "done", service: "Reels Shooting", delivery_period: PERIOD_MONTH } as any,
      { id: "t_done_2", status: "done", service: "Reels Shooting", delivery_period: PERIOD_MONTH } as any,
      { id: "t_delivered_1", status: "delivered", service: "Reels Shooting", delivery_period: PERIOD_MONTH } as any,
      { id: "t_approved_1", status: "approved", service: "Reels Shooting", delivery_period: PERIOD_MONTH } as any,
      {
        id: "t_todo_1",
        status: "todo",
        service: "Reels Shooting",
        delivery_period: PERIOD_MONTH,
        source_type: "package_reconciliation",
        is_reconciliation_managed: true,
        sequence_index: 5,
      } as any,
      {
        id: "t_todo_2",
        status: "todo",
        service: "Reels Shooting",
        delivery_period: PERIOD_MONTH,
        source_type: "package_reconciliation",
        is_reconciliation_managed: true,
        sequence_index: 6,
      } as any,
    ];

    // Desired quota reduced drastically to 2 (even though 4 are already finished)
    const report = await reconcileClientPackageWork(
      {
        clientId: TEST_CLIENT_ID,
        periodMonth: PERIOD_MONTH,
        packageConfig: { reels_quota: 2 },
        commitToDatabase: false,
      },
      {
        client: { id: TEST_CLIENT_ID, name: "History Corp", package_config: { reels_quota: 6 } } as any,
        tasks: inMemoryTasks,
      }
    );

    assert(report.total_tasks_pruned === 2, "Pruned both future unstarted todo tasks");
    assert(report.total_history_preserved === 4, "Preserved all 4 historical completed/delivered/approved tasks");
    assert(inMemoryTasks.length === 4, "State strictly maintains the 4 historical tasks");
    assert(inMemoryTasks.some((t) => t.id === "t_done_1"), "Done task 1 preserved");
    assert(inMemoryTasks.some((t) => t.id === "t_delivered_1"), "Delivered task preserved");
    assert(inMemoryTasks.some((t) => t.id === "t_approved_1"), "Approved task preserved");
  }

  // -------------------------------------------------------------
  // GROUP F: In-Progress / Blocked / Review Work Protection
  // -------------------------------------------------------------
  console.log("\n--- GROUP F: In-Progress & Active Work Protection ---");
  {
    const inMemoryTasks: TaskRow[] = [
      { id: "t_prog_1", status: "in_progress", service: "Reels Shooting", delivery_period: PERIOD_MONTH } as any,
      { id: "t_rev_1", status: "review", service: "Reels Shooting", delivery_period: PERIOD_MONTH } as any,
      { id: "t_block_1", status: "blocked", service: "Reels Shooting", delivery_period: PERIOD_MONTH } as any,
      { id: "t_postpone_1", status: "postponed", service: "Reels Shooting", delivery_period: PERIOD_MONTH } as any,
      {
        id: "t_todo_gen_1",
        status: "todo",
        service: "Reels Shooting",
        delivery_period: PERIOD_MONTH,
        source_type: "package_reconciliation",
        is_reconciliation_managed: true,
        sequence_index: 5,
      } as any,
    ];

    // Desired quota reduced to 2
    const report = await reconcileClientPackageWork(
      {
        clientId: TEST_CLIENT_ID,
        periodMonth: PERIOD_MONTH,
        packageConfig: { reels_quota: 2 },
        commitToDatabase: false,
      },
      {
        client: { id: TEST_CLIENT_ID, name: "Active Corp", package_config: { reels_quota: 5 } } as any,
        tasks: inMemoryTasks,
      }
    );

    assert(report.total_tasks_pruned === 1, "Only the 1 unstarted todo task was pruned");
    assert(inMemoryTasks.length === 4, "All 4 active work tasks (in_progress, review, blocked, postponed) preserved");
    assert(inMemoryTasks.some((t) => t.id === "t_prog_1"), "in_progress task preserved");
    assert(inMemoryTasks.some((t) => t.id === "t_rev_1"), "review task preserved");
    assert(inMemoryTasks.some((t) => t.id === "t_block_1"), "blocked task preserved");
    assert(inMemoryTasks.some((t) => t.id === "t_postpone_1"), "postponed task preserved");
  }

  // -------------------------------------------------------------
  // GROUP G: Quota Increase (5 -> 10)
  // -------------------------------------------------------------
  console.log("\n--- GROUP G: Quota Increase (5 -> 10) ---");
  {
    const inMemoryTasks: TaskRow[] = [];
    for (let i = 1; i <= 5; i++) {
      inMemoryTasks.push({
        id: `t_inc_${i}`,
        status: i <= 2 ? "done" : "todo",
        service: "Posts Publishing",
        category: "Post",
        sequence_index: i,
        occurrence_date: `2026-10-0${i}`,
        deadline: `2026-10-0${i}`,
        delivery_period: PERIOD_MONTH,
        source_type: "package_reconciliation",
        is_reconciliation_managed: true,
      } as any);
    }

    const report = await reconcileClientPackageWork(
      {
        clientId: TEST_CLIENT_ID,
        periodMonth: PERIOD_MONTH,
        packageConfig: { posts_quota: 10 },
        commitToDatabase: false,
      },
      {
        client: { id: TEST_CLIENT_ID, name: "Inc Corp", package_config: { posts_quota: 5 } } as any,
        tasks: inMemoryTasks,
      }
    );

    assert(report.total_tasks_created === 5, `Created exactly 5 missing tasks (got: ${report.total_tasks_created})`);
    assert(inMemoryTasks.length === 10, "Total active tasks equals 10");
    const newTasks = inMemoryTasks.filter((t) => (t as any).sequence_index > 5);
    assert(newTasks.length === 5, "5 new tasks appended to sequence");
    assert(newTasks.every((t) => t.source_type === "package_reconciliation"), "All new tasks tagged with source_type='package_reconciliation'");
    assert(newTasks.every((t) => t.is_reconciliation_managed === true), "All new tasks tagged with is_reconciliation_managed=true");
    assert(newTasks.every((t) => t.manual_override === false), "All new tasks tagged with manual_override=false");
  }

  // -------------------------------------------------------------
  // GROUP H: Quota Decrease with Mixed Work
  // -------------------------------------------------------------
  console.log("\n--- GROUP H: Quota Decrease with Mixed Work ---");
  {
    const inMemoryTasks: TaskRow[] = [
      { id: "h_done_1", status: "done", service: "Reels Shooting", sequence_index: 1, delivery_period: PERIOD_MONTH } as any,
      { id: "h_done_2", status: "done", service: "Reels Shooting", sequence_index: 2, delivery_period: PERIOD_MONTH } as any,
      { id: "h_done_3", status: "done", service: "Reels Shooting", sequence_index: 3, delivery_period: PERIOD_MONTH } as any,
      { id: "h_manual_1", status: "todo", service: "Reels Shooting", source_type: "manual", is_reconciliation_managed: false, delivery_period: PERIOD_MONTH } as any,
      { id: "h_override_1", status: "todo", service: "Reels Shooting", manual_override: true, is_reconciliation_managed: true, delivery_period: PERIOD_MONTH } as any,
      { id: "h_gen_1", status: "todo", service: "Reels Shooting", source_type: "package_reconciliation", is_reconciliation_managed: true, sequence_index: 6, delivery_period: PERIOD_MONTH } as any,
      { id: "h_gen_2", status: "todo", service: "Reels Shooting", source_type: "package_reconciliation", is_reconciliation_managed: true, sequence_index: 7, delivery_period: PERIOD_MONTH } as any,
      { id: "h_gen_3", status: "todo", service: "Reels Shooting", source_type: "package_reconciliation", is_reconciliation_managed: true, sequence_index: 8, delivery_period: PERIOD_MONTH } as any,
      { id: "h_gen_4", status: "todo", service: "Reels Shooting", source_type: "package_reconciliation", is_reconciliation_managed: true, sequence_index: 9, delivery_period: PERIOD_MONTH } as any,
      { id: "h_gen_5", status: "todo", service: "Reels Shooting", source_type: "package_reconciliation", is_reconciliation_managed: true, sequence_index: 10, delivery_period: PERIOD_MONTH } as any,
    ];

    // Decrease from 10 to 6
    // Protected work: 3 done + 1 manual + 1 manual override = 5 protected tasks.
    // Allowed to keep = 6. Allowed eligible future = 6 - 5 = 1.
    // Eligible future = 5 (h_gen_1..5). Pruned = 5 - 1 = 4.
    const report = await reconcileClientPackageWork(
      {
        clientId: TEST_CLIENT_ID,
        periodMonth: PERIOD_MONTH,
        packageConfig: { reels_quota: 6 },
        commitToDatabase: false,
      },
      {
        client: { id: TEST_CLIENT_ID, name: "Mixed Corp", package_config: { reels_quota: 10 } } as any,
        tasks: inMemoryTasks,
      }
    );

    assert(report.total_tasks_pruned === 4, `Pruned exactly 4 eligible tasks (got: ${report.total_tasks_pruned})`);
    assert(inMemoryTasks.length === 6, `Total remaining tasks is 6 (got: ${inMemoryTasks.length})`);
    assert(inMemoryTasks.some((t) => t.id === "h_manual_1"), "Manual task preserved");
    assert(inMemoryTasks.some((t) => t.id === "h_override_1"), "Manual override task preserved");
    assert(inMemoryTasks.some((t) => t.id === "h_gen_1"), "Earliest generated task kept to meet quota 6");
  }

  // -------------------------------------------------------------
  // GROUP I: Repeated Reconciliation Idempotency
  // -------------------------------------------------------------
  console.log("\n--- GROUP I: Repeated Reconciliation Idempotency ---");
  {
    const inMemoryTasks: TaskRow[] = [];
    const clientState: ClientRow = {
      id: TEST_CLIENT_ID,
      name: "Idempotent Repeat Corp",
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      package_config: { reels_quota: 5 },
    };

    // Run 1: Provisioning 5 tasks
    const r1 = await reconcileClientPackageWork(
      {
        clientId: TEST_CLIENT_ID,
        periodMonth: PERIOD_MONTH,
        packageConfig: { reels_quota: 5 },
        commitToDatabase: false,
      },
      { client: clientState, tasks: inMemoryTasks }
    );
    assert(r1.total_tasks_created === 5, "Run 1 created 5 tasks");
    assert(inMemoryTasks.length === 5, "Total tasks is 5");

    // Run 2: Re-reconcile identical state
    const r2 = await reconcileClientPackageWork(
      {
        clientId: TEST_CLIENT_ID,
        periodMonth: PERIOD_MONTH,
        packageConfig: { reels_quota: 5 },
        commitToDatabase: false,
      },
      { client: clientState, tasks: inMemoryTasks }
    );
    assert(r2.total_tasks_created === 0, "Run 2 created 0 tasks (Idempotency guarantee)");
    assert(r2.total_tasks_pruned === 0, "Run 2 pruned 0 tasks");
    assert(r2.total_tasks_rescheduled === 0, "Run 2 rescheduled 0 tasks");
    assert(inMemoryTasks.length === 5, "State maintains exactly 5 tasks");

    // Run 3: Re-reconcile
    const r3 = await reconcileClientPackageWork(
      {
        clientId: TEST_CLIENT_ID,
        periodMonth: PERIOD_MONTH,
        packageConfig: { reels_quota: 5 },
        commitToDatabase: false,
      },
      { client: clientState, tasks: inMemoryTasks }
    );
    assert(r3.total_tasks_created === 0, "Run 3 created 0 tasks");
    assert(inMemoryTasks.length === 5, "State maintains exactly 5 tasks");

    // Run 4: Re-reconcile
    const r4 = await reconcileClientPackageWork(
      {
        clientId: TEST_CLIENT_ID,
        periodMonth: PERIOD_MONTH,
        packageConfig: { reels_quota: 5 },
        commitToDatabase: false,
      },
      { client: clientState, tasks: inMemoryTasks }
    );
    assert(r4.total_tasks_created === 0, "Run 4 created 0 tasks");
    assert(inMemoryTasks.length === 5, "State maintains exactly 5 tasks across 4 runs");
  }

  // -------------------------------------------------------------
  // GROUP J: Concurrency & Race Safety
  // -------------------------------------------------------------
  console.log("\n--- GROUP J: Concurrency & Race Safety ---");
  {
    const inMemoryTasks: TaskRow[] = [];
    const clientState: ClientRow = {
      id: TEST_CLIENT_ID,
      name: "Concurrency Corp",
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      package_config: { reels_quota: 4 },
    };

    // Run two simultaneous reconciliation operations on the same client
    const [runA, runB] = await Promise.all([
      reconcileClientPackageWork(
        {
          clientId: TEST_CLIENT_ID,
          periodMonth: PERIOD_MONTH,
          packageConfig: { reels_quota: 4 },
          commitToDatabase: false,
        },
        { client: clientState, tasks: inMemoryTasks }
      ),
      reconcileClientPackageWork(
        {
          clientId: TEST_CLIENT_ID,
          periodMonth: PERIOD_MONTH,
          packageConfig: { reels_quota: 4 },
          commitToDatabase: false,
        },
        { client: clientState, tasks: inMemoryTasks }
      ),
    ]);

    assert(inMemoryTasks.length === 4, `Concurrent execution resulted in exactly 4 total tasks, not 8 (got: ${inMemoryTasks.length})`);
    const idempotencyKeys = inMemoryTasks.map((t) => (t as any).idempotency_key);
    const uniqueKeys = new Set(idempotencyKeys);
    assert(uniqueKeys.size === 4, "All 4 tasks have strictly unique idempotency keys");
    assert(runA.total_tasks_created + runB.total_tasks_created === 4, "Total created across both concurrent workers equals 4");
  }

  // -------------------------------------------------------------
  // GROUP K: Schedule Rule Change with Mixed Tasks
  // -------------------------------------------------------------
  console.log("\n--- GROUP K: Schedule Rule Change with Mixed Tasks ---");
  {
    const commitment: ServiceCommitment = {
      id: "commit_rule_change_k",
      client_id: TEST_CLIENT_ID,
      service_name: "Reels Shooting",
      deliverable_type: "reels_shooting",
      quantity: 3,
      frequency: "monthly",
      schedule_rule: {
        frequency: "monthly",
        quantity: 3,
        days_of_month: [10, 20, 30], // New days
      },
      start_date: "2026-10-01",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const inMemoryTasks: TaskRow[] = [
      {
        id: "k_done_oct5",
        commitment_id: commitment.id,
        status: "done",
        service: "Reels Shooting",
        occurrence_date: "2026-10-05",
        deadline: "2026-10-05",
        delivery_period: PERIOD_MONTH,
      } as any,
      {
        id: "k_override_oct8",
        commitment_id: commitment.id,
        status: "todo",
        service: "Reels Shooting",
        occurrence_date: "2026-10-08",
        deadline: "2026-10-08",
        manual_override: true,
        delivery_period: PERIOD_MONTH,
      } as any,
      {
        id: "k_gen_oct15",
        commitment_id: commitment.id,
        status: "todo",
        service: "Reels Shooting",
        occurrence_date: "2026-10-15",
        deadline: "2026-10-15",
        source_type: "package_reconciliation",
        is_reconciliation_managed: true,
        manual_override: false,
        delivery_period: PERIOD_MONTH,
      } as any,
    ];

    const res = await reconcileSingleCommitmentWork({
      clientId: TEST_CLIENT_ID,
      commitment,
      periodMonth: PERIOD_MONTH,
      existingTasks: inMemoryTasks,
      commitToDatabase: false,
    });

    assert(res.success === true, "Single commitment reconciliation completed");
    const tDone = inMemoryTasks.find((t) => t.id === "k_done_oct5");
    assert((tDone as any)?.occurrence_date === "2026-10-05", "Completed task remains on Oct 5");

    const tOverride = inMemoryTasks.find((t) => t.id === "k_override_oct8");
    assert((tOverride as any)?.occurrence_date === "2026-10-08", "Manually moved task remains on Oct 8");

    const tGen = inMemoryTasks.find((t) => t.id === "k_gen_oct15");
    assert(
      (tGen as any)?.occurrence_date === "2026-10-20" || (tGen as any)?.occurrence_date === "2026-10-30",
      `Untouched generated task rescheduled to new recurrence date (got: ${(tGen as any)?.occurrence_date})`
    );
  }

  // -------------------------------------------------------------
  // GROUP L: Audit Trail Integrity & Zero Fake Mutation Records
  // -------------------------------------------------------------
  console.log("\n--- GROUP L: Audit Trail Integrity ---");
  {
    const inMemoryTasks: TaskRow[] = [];
    const clientState: ClientRow = {
      id: TEST_CLIENT_ID,
      name: "Audit Corp",
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      package_config: { reels_quota: 2 },
    };

    // 1. Initial reconciliation creates 2 tasks
    const r1 = await reconcileClientPackageWork(
      {
        clientId: TEST_CLIENT_ID,
        periodMonth: PERIOD_MONTH,
        packageConfig: { reels_quota: 2 },
        actorId: "usr_manager_99",
        actorEmail: "manager@sada.tn",
        commitToDatabase: false,
      },
      { client: clientState, tasks: inMemoryTasks }
    );

    assert(Boolean(r1.mutations && r1.mutations.length === 2), "Recorded 2 mutations for 2 created tasks");
    const mut1 = r1.mutations?.[0];
    assert(mut1?.mutation_type === "task_created", "Mutation type is 'task_created'");
    assert(mut1?.client_id === TEST_CLIENT_ID, "Mutation contains client_id");
    assert(Boolean(mut1?.task_id), "Mutation contains task_id");
    assert(Boolean(mut1?.new_state?.date), "Mutation records new state date");
    assert(Boolean(mut1?.reason), "Mutation records human-readable reason");
    assert(Boolean(mut1?.timestamp), "Mutation records ISO timestamp");
    assert(!JSON.stringify(mut1).includes("password"), "No password or auth token leaked in audit metadata");

    // 2. Second idempotent run with 0 changes
    const r2 = await reconcileClientPackageWork(
      {
        clientId: TEST_CLIENT_ID,
        periodMonth: PERIOD_MONTH,
        packageConfig: { reels_quota: 2 },
        actorId: "usr_manager_99",
        actorEmail: "manager@sada.tn",
        commitToDatabase: false,
      },
      { client: clientState, tasks: inMemoryTasks }
    );

    assert(
      !r2.mutations || r2.mutations.length === 0,
      `Idempotent run produced 0 fake mutation records (got: ${r2.mutations?.length || 0})`
    );
  }

  // -------------------------------------------------------------
  // GROUP M: Live Preview vs Actual Parity
  // -------------------------------------------------------------
  console.log("\n--- GROUP M: Live Preview vs Actual Parity ---");
  {
    const inMemoryTasks: TaskRow[] = [
      { id: "p1", service: "Reels Shooting", status: "done", delivery_period: PERIOD_MONTH } as any,
      { id: "p2", service: "Reels Shooting", status: "done", delivery_period: PERIOD_MONTH } as any,
      { id: "p3", service: "Reels Shooting", status: "todo", source_type: "manual", delivery_period: PERIOD_MONTH } as any,
      {
        id: "p4",
        service: "Reels Shooting",
        status: "todo",
        source_type: "package_reconciliation",
        is_reconciliation_managed: true,
        sequence_index: 4,
        delivery_period: PERIOD_MONTH,
      } as any,
    ];

    const desiredConfig = { reels_quota: 6 };

    // 1. Calculate Preview
    const preview = await previewPackageReconciliation(
      {
        clientId: TEST_CLIENT_ID,
        periodMonth: PERIOD_MONTH,
        packageConfig: desiredConfig,
        commitToDatabase: false,
      },
      inMemoryTasks
    );

    // 2. Run Actual Apply on duplicate state
    const clonedTasks = [...inMemoryTasks];
    const actualReport = await reconcileClientPackageWork(
      {
        clientId: TEST_CLIENT_ID,
        periodMonth: PERIOD_MONTH,
        packageConfig: desiredConfig,
        commitToDatabase: false,
      },
      {
        client: { id: TEST_CLIENT_ID, name: "Parity Corp", package_config: { reels_quota: 4 } } as any,
        tasks: clonedTasks,
      }
    );

    assert(preview.total_missing_tasks === actualReport.total_tasks_created, `Preview create count (${preview.total_missing_tasks}) equals actual created count (${actualReport.total_tasks_created})`);
    assert(preview.total_excess_tasks === actualReport.total_tasks_pruned, `Preview prune count (${preview.total_excess_tasks}) equals actual pruned count (${actualReport.total_tasks_pruned})`);
    assert(preview.total_historical_preserved === actualReport.total_history_preserved, `Preview history preserved (${preview.total_historical_preserved}) equals actual history preserved (${actualReport.total_history_preserved})`);
    assert(preview.total_manual_preserved === actualReport.total_manual_preserved, `Preview manual preserved (${preview.total_manual_preserved}) equals actual manual preserved (${actualReport.total_manual_preserved})`);
  }

  console.log("\n=======================================================================");
  console.log(`Phase 4.1 Hardening Test Results: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log("=======================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runHardeningSuite().catch((err) => {
  console.error("Test suite execution error:", err);
  process.exit(1);
});
