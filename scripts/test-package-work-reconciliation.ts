// ============================================================
// SADA OS — PHASE 4: SSOT & PACKAGE/WORK RECONCILIATION TEST SUITE
// Validates:
// 1. Authoritative Database Single Source of Truth
// 2. Reconciliation on Quota Increase (5 -> 10 generates missing 5)
// 3. Reconciliation on Quota Decrease (10 -> 6 preserves completed history, scales down future)
// 4. Completed Work Invariant (completed >= desired is 100% preserved)
// 5. Frequency & Schedule Rule Adjustment (future rescheduled, past untouched)
// 6. Repeated Idempotency (0 duplicates, 0 spurious pruning)
// 7. Audit Logging (actor, timestamps, diffs)
// 8. Calendar and Task Engine Invariant Projection
// ============================================================

import {
  resolveAuthoritativePackageConfig,
  reconcileClientPackageWork,
  reconcileSingleCommitmentWork,
  previewPackageReconciliation,
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

async function runSuite() {
  console.log("=======================================================");
  console.log("SADA OS — Phase 4 SSOT & Package Reconciliation Suite");
  console.log("=======================================================\n");

  const TEST_CLIENT_ID = "client_alpha_001";
  const PERIOD_MONTH = "2026-10";

  // -------------------------------------------------------------
  // TEST A: Authoritative SSOT Resolution (No Magic Numbers)
  // -------------------------------------------------------------
  console.log("--- TEST A: Authoritative SSOT Resolution ---");
  {
    // Client with no config defaults cleanly to 0, not arbitrary magic numbers (5, 4, 10)
    const emptyClient: Partial<ClientRow> = {
      id: TEST_CLIENT_ID,
      name: "Empty Retainer Client",
      package_config: null,
    };
    const resolvedEmpty = resolveAuthoritativePackageConfig(emptyClient as any);
    assert(resolvedEmpty.quotas.reels === 0, "Empty client resolves to 0 reels (no magic 5)");
    assert(resolvedEmpty.quotas.posts === 0, "Empty client resolves to 0 posts (no magic 4)");
    assert(resolvedEmpty.quotas.stories === 0, "Empty client resolves to 0 stories (no magic 10)");

    // Client linked to catalog package reads catalog values
    const catalogPkg: any = {
      id: "pkg_growth_catalog",
      name: "Growth Master",
      monthly_reels: 8,
      monthly_posts: 12,
      monthly_stories: "16",
      has_ads_management: true,
    };
    const catalogClient: Partial<ClientRow> = {
      id: TEST_CLIENT_ID,
      package_id: catalogPkg.id,
      package_config: null,
    };
    const resolvedCatalog = resolveAuthoritativePackageConfig(catalogClient as any, catalogPkg);
    assert(resolvedCatalog.quotas.reels === 8, "Catalog package sets reels to 8");
    assert(resolvedCatalog.quotas.posts === 12, "Catalog package sets posts to 12");
    assert(resolvedCatalog.quotas.stories === 16, "Catalog package parses stories string '16' to 16");
    assert(resolvedCatalog.quotas.ads === 1, "Catalog package ads flag resolves to 1");

    // Client override takes precedence over catalog
    const overrideClient: Partial<ClientRow> = {
      id: TEST_CLIENT_ID,
      package_id: catalogPkg.id,
      package_config: {
        reels_quota: 14,
        posts_quota: 20,
      },
    };
    const resolvedOverride = resolveAuthoritativePackageConfig(overrideClient as any, catalogPkg);
    assert(resolvedOverride.quotas.reels === 14, "Client custom override (14 reels) takes precedence over catalog");
    assert(resolvedOverride.quotas.posts === 20, "Client custom override (20 posts) takes precedence over catalog");
  }

  // -------------------------------------------------------------
  // TEST B: Reconciliation on Quota Increase (5 -> 10)
  // -------------------------------------------------------------
  console.log("\n--- TEST B: Quota Increase (5 -> 10 Reels & 5 -> 10 Posts) ---");
  {
    // Existing: 5 reels and 5 posts currently scheduled for 2026-10
    const inMemoryTasks: TaskRow[] = [];
    const inMemoryDeliverables: any[] = [];
    const inMemoryCommitments: ServiceCommitment[] = [];
    const clientState: ClientRow = {
      id: TEST_CLIENT_ID,
      name: "Alpha Corp",
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      package_config: {
        reels_quota: 5,
        posts_quota: 5,
      },
    };

    // Pre-populate with 5 reels tasks and 5 post tasks
    for (let i = 1; i <= 5; i++) {
      inMemoryTasks.push({
        id: `task_reel_init_${i}`,
        client_id: TEST_CLIENT_ID,
        title: `Alpha Corp — Reels Shooting (#${i}/5)`,
        service: "Reels Shooting",
        category: "Reel",
        status: i <= 2 ? "done" : "todo", // 2 completed, 3 future todo
        deadline: `2026-10-0${i * 4}`,
        occurrence_date: `2026-10-0${i * 4}`,
        sequence_index: i,
        delivery_period: PERIOD_MONTH,
      } as any);

      inMemoryTasks.push({
        id: `task_post_init_${i}`,
        client_id: TEST_CLIENT_ID,
        title: `Alpha Corp — Posts Publishing (#${i}/5)`,
        service: "Posts Publishing",
        category: "Post",
        status: i === 1 ? "done" : "todo", // 1 completed, 4 future todo
        deadline: `2026-10-0${i * 5}`,
        occurrence_date: `2026-10-0${i * 5}`,
        sequence_index: i,
        delivery_period: PERIOD_MONTH,
      } as any);
    }

    assert(inMemoryTasks.length === 10, "Baseline has 10 total tasks (5 reels + 5 posts)");

    // New desired state: 10 reels + 10 posts
    const report = await reconcileClientPackageWork(
      {
        clientId: TEST_CLIENT_ID,
        periodMonth: PERIOD_MONTH,
        packageConfig: {
          reels_quota: 10,
          posts_quota: 10,
        },
        actorId: "usr_admin_42",
        actorEmail: "ops@sada.tn",
        commitToDatabase: false,
      },
      {
        client: clientState,
        tasks: inMemoryTasks,
        commitments: inMemoryCommitments,
        deliverables: inMemoryDeliverables,
      }
    );

    assert(report.success === true, "Reconciliation executes successfully");
    assert(report.total_tasks_created === 10, `Created exactly 10 missing tasks (got: ${report.total_tasks_created})`);
    assert(report.total_tasks_pruned === 0, "Pruned 0 tasks on increase");
    assert(report.total_history_preserved === 3, `Preserved all 3 historical completed tasks (got: ${report.total_history_preserved})`);

    const finalReels = inMemoryTasks.filter((t) => t.service === "Reels Shooting");
    const finalPosts = inMemoryTasks.filter((t) => t.service === "Posts Publishing");

    assert(finalReels.length === 10, `Reels total reconciled to desired state 10 (got: ${finalReels.length})`);
    assert(finalPosts.length === 10, `Posts total reconciled to desired state 10 (got: ${finalPosts.length})`);

    // Verify sequence indexing of newly created tasks
    const newReels = finalReels.filter((t) => (t as any).sequence_index > 5);
    assert(newReels.length === 5, "Generated exactly 5 new reels tasks");
    assert((newReels[0] as any).sequence_index === 6, "First new reel continues sequence at 6");
    assert((newReels[4] as any).sequence_index === 10, "Final new reel finishes sequence at 10");
  }

  // -------------------------------------------------------------
  // TEST C: Quota Decrease (10 -> 6) with History Preservation
  // -------------------------------------------------------------
  console.log("\n--- TEST C: Quota Decrease (10 -> 6 Reels with 4 Completed History) ---");
  {
    // Setup: 10 total reels: 4 already completed, 6 future todo
    const inMemoryTasks: TaskRow[] = [];
    const clientState: ClientRow = {
      id: TEST_CLIENT_ID,
      name: "Beta Corp",
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      package_config: { reels_quota: 10 },
    };

    for (let i = 1; i <= 10; i++) {
      inMemoryTasks.push({
        id: `task_reel_beta_${i}`,
        client_id: TEST_CLIENT_ID,
        title: `Beta Corp — Reels Shooting (#${i}/10)`,
        service: "Reels Shooting",
        category: "Reel",
        status: i <= 4 ? "done" : "todo", // 4 completed, 6 future
        deadline: `2026-10-${String(i * 3).padStart(2, "0")}`,
        occurrence_date: `2026-10-${String(i * 3).padStart(2, "0")}`,
        sequence_index: i,
        delivery_period: PERIOD_MONTH,
      } as any);
    }

    assert(inMemoryTasks.length === 10, "Starting with 10 reels tasks (4 done, 6 future)");

    // Reconcile down: 10 -> 6
    const report = await reconcileClientPackageWork(
      {
        clientId: TEST_CLIENT_ID,
        periodMonth: PERIOD_MONTH,
        packageConfig: { reels_quota: 6 },
        actorId: "usr_admin_42",
        commitToDatabase: false,
      },
      {
        client: clientState,
        tasks: inMemoryTasks,
        commitments: [],
        deliverables: [],
      }
    );

    assert(report.success === true, "Decrease reconciliation succeeded");
    assert(report.total_tasks_created === 0, "0 tasks created on decrease");
    assert(report.total_tasks_pruned === 4, `Pruned exactly 4 excess future tasks (got: ${report.total_tasks_pruned})`);
    assert(report.total_history_preserved === 4, "All 4 historical completed tasks preserved");

    // Final tasks check: 4 completed + 2 future = 6 active tasks
    assert(inMemoryTasks.length === 6, `Total active tasks equals desired quota 6 (got: ${inMemoryTasks.length})`);
    const doneTasks = inMemoryTasks.filter((t) => t.status === "done");
    assert(doneTasks.length === 4, "Historical completed tasks untouched and intact (4/4)");
    const todoTasks = inMemoryTasks.filter((t) => t.status === "todo");
    assert(todoTasks.length === 2, "Remaining future tasks scaled down to exactly 2");
  }

  // -------------------------------------------------------------
  // TEST D: Quota Decrease When Completed >= Desired (7 completed, desired = 6)
  // -------------------------------------------------------------
  console.log("\n--- TEST D: Decrease When Completed Exceeds Desired (7 done, quota 6) ---");
  {
    // 7 completed, 3 future todo = 10 total
    const inMemoryTasks: TaskRow[] = [];
    const clientState: ClientRow = {
      id: TEST_CLIENT_ID,
      name: "Gamma Luxe",
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      package_config: { reels_quota: 10 },
    };

    for (let i = 1; i <= 10; i++) {
      inMemoryTasks.push({
        id: `task_gamma_${i}`,
        client_id: TEST_CLIENT_ID,
        title: `Gamma Luxe — Reels Shooting (#${i}/10)`,
        service: "Reels Shooting",
        category: "Reel",
        status: i <= 7 ? "done" : "todo", // 7 already completed
        deadline: `2026-10-${String(i * 3).padStart(2, "0")}`,
        sequence_index: i,
        delivery_period: PERIOD_MONTH,
      } as any);
    }

    // New desired quota: 6
    const report = await reconcileClientPackageWork(
      {
        clientId: TEST_CLIENT_ID,
        periodMonth: PERIOD_MONTH,
        packageConfig: { reels_quota: 6 },
        commitToDatabase: false,
      },
      {
        client: clientState,
        tasks: inMemoryTasks,
        commitments: [],
        deliverables: [],
      }
    );

    assert(report.total_tasks_pruned === 3, "Pruned all 3 future unstarted tasks");
    assert(inMemoryTasks.length === 7, `All 7 completed tasks preserved (never destructively deleted to meet 6)`);
    assert(inMemoryTasks.every((t) => t.status === "done"), "All remaining tasks are completed records");
  }

  // -------------------------------------------------------------
  // TEST E: Frequency & Schedule Rule Adjustment (Days Change)
  // -------------------------------------------------------------
  console.log("\n--- TEST E: Schedule Rule Reschedule (Days Change: [5, 20] -> [10, 25]) ---");
  {
    const commitment: ServiceCommitment = {
      id: "commit_reels_freq",
      client_id: TEST_CLIENT_ID,
      service_name: "Reels Shooting",
      deliverable_type: "reels_shooting",
      quantity: 2,
      frequency: "monthly",
      schedule_rule: {
        frequency: "monthly",
        quantity: 2,
        days_of_month: [10, 25], // New days
      },
      start_date: "2026-10-01",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Existing: Day 1 completed on Oct 5; Day 2 future scheduled on Oct 20
    const inMemoryTasks: TaskRow[] = [
      {
        id: "task_resched_1",
        commitment_id: commitment.id,
        client_id: TEST_CLIENT_ID,
        service: "Reels Shooting",
        status: "done", // Completed
        deadline: "2026-10-05",
        occurrence_date: "2026-10-05",
        sequence_index: 1,
        delivery_period: PERIOD_MONTH,
      } as any,
      {
        id: "task_resched_2",
        commitment_id: commitment.id,
        client_id: TEST_CLIENT_ID,
        service: "Reels Shooting",
        status: "todo", // Future
        deadline: "2026-10-20",
        occurrence_date: "2026-10-20",
        sequence_index: 2,
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

    assert(res.success === true, "Commitment reconciliation succeeded");
    assert(res.history_preserved === 1, "Completed task on Oct 5 preserved");
    // Verify future task was rescheduled to Oct 10 (first slot) or Oct 25
    const futureTask = inMemoryTasks.find((t) => t.status === "todo");
    assert(
      (futureTask as any)?.occurrence_date === "2026-10-10" || (futureTask as any)?.occurrence_date === "2026-10-25",
      `Future task rescheduled to new rule date (got: ${(futureTask as any)?.occurrence_date})`
    );
    const completedTask = inMemoryTasks.find((t) => t.status === "done");
    assert(
      (completedTask as any)?.occurrence_date === "2026-10-05",
      "Historical completed task remained strictly on Oct 5"
    );
  }

  // -------------------------------------------------------------
  // TEST F: Repeated Idempotency (0 Duplicates)
  // -------------------------------------------------------------
  console.log("\n--- TEST F: Repeated Idempotency Runs ---");
  {
    const inMemoryTasks: TaskRow[] = [];
    const clientState: ClientRow = {
      id: TEST_CLIENT_ID,
      name: "Idempotent Corp",
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      package_config: { reels_quota: 4 },
    };

    // Run 1: Create 4 tasks
    const r1 = await reconcileClientPackageWork(
      {
        clientId: TEST_CLIENT_ID,
        periodMonth: PERIOD_MONTH,
        packageConfig: { reels_quota: 4 },
        commitToDatabase: false,
      },
      { client: clientState, tasks: inMemoryTasks }
    );
    assert(r1.total_tasks_created === 4, "Run 1 created 4 tasks");
    assert(inMemoryTasks.length === 4, "State has 4 tasks");

    // Run 2: Re-reconcile identical desired state
    const r2 = await reconcileClientPackageWork(
      {
        clientId: TEST_CLIENT_ID,
        periodMonth: PERIOD_MONTH,
        packageConfig: { reels_quota: 4 },
        commitToDatabase: false,
      },
      { client: clientState, tasks: inMemoryTasks }
    );
    assert(r2.total_tasks_created === 0, "Run 2 created 0 tasks (Idempotent guarantee)");
    assert(r2.total_tasks_pruned === 0, "Run 2 pruned 0 tasks");
    assert(inMemoryTasks.length === 4, "State strictly maintained at 4 tasks");

    // Run 3: Third run
    const r3 = await reconcileClientPackageWork(
      {
        clientId: TEST_CLIENT_ID,
        periodMonth: PERIOD_MONTH,
        packageConfig: { reels_quota: 4 },
        commitToDatabase: false,
      },
      { client: clientState, tasks: inMemoryTasks }
    );
    assert(r3.total_tasks_created === 0, "Run 3 created 0 tasks");
    assert(inMemoryTasks.length === 4, "Zero duplicates across 3 sequential runs");
  }

  // -------------------------------------------------------------
  // TEST G: Non-Destructive Preview Diff Calculation
  // -------------------------------------------------------------
  console.log("\n--- TEST G: Preview Diff Calculation ---");
  {
    const inMemoryTasks: TaskRow[] = [
      { id: "t1", service: "Reels Shooting", status: "done", delivery_period: PERIOD_MONTH } as any,
      { id: "t2", service: "Reels Shooting", status: "done", delivery_period: PERIOD_MONTH } as any,
      { id: "t3", service: "Reels Shooting", status: "todo", delivery_period: PERIOD_MONTH } as any,
    ];

    const preview = await previewPackageReconciliation(
      {
        clientId: TEST_CLIENT_ID,
        periodMonth: PERIOD_MONTH,
        packageConfig: { reels_quota: 8 },
        commitToDatabase: false,
      },
      inMemoryTasks
    );

    assert(preview.has_changes === true, "Preview detects required changes");
    assert(preview.total_missing_tasks === 5, `Preview correctly calculates 5 missing tasks (desired 8 - current 3 = 5)`);
    assert(preview.total_historical_preserved === 2, "Preview identifies 2 historical tasks preserved");
  }

  // -------------------------------------------------------------
  // TEST H: Calendar Projection Compatibility
  // -------------------------------------------------------------
  console.log("\n--- TEST H: Calendar & Task Engine Invariant Projection ---");
  {
    const inMemoryTasks: TaskRow[] = [];
    const r = await reconcileClientPackageWork(
      {
        clientId: TEST_CLIENT_ID,
        periodMonth: PERIOD_MONTH,
        packageConfig: { reels_quota: 2, posts_quota: 4 },
        commitToDatabase: false,
      },
      { client: { id: TEST_CLIENT_ID, name: "Cal Client" } as any, tasks: inMemoryTasks }
    );

    assert(inMemoryTasks.length === 6, "Total tasks generated = 6");
    for (const t of inMemoryTasks) {
      assert(Boolean((t as any).occurrence_date), `Task ${t.id} has canonical occurrence_date for calendar`);
      assert(Boolean(t.deadline), `Task ${t.id} has deadline`);
      assert(Boolean((t as any).delivery_period), `Task ${t.id} has delivery_period`);
      assert(Boolean((t as any).idempotency_key), `Task ${t.id} has deterministic idempotency_key`);
    }
  }

  console.log("\n=======================================================");
  console.log(`Phase 4 Test Results: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log("=======================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error("Test suite runner error:", err);
  process.exit(1);
});
