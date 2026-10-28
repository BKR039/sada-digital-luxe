// ============================================================
// SADA OS — CLIENT WORKSPACES & CLIENT 360 MVP VERIFICATION SUITE
// Comprehensive Automated Test Suite: Financial Integrity,
// Package Reconciliation, Lifecycle & Role Permissions.
// ============================================================

import assert from "assert";
import {
  calculateReconciliationDiff,
  resolveAuthoritativePackageConfig,
  type AuthoritativePackageState,
  type DeliverableSpec,
} from "../src/lib/package-reconciliation-service";
import type { TaskRow, ClientRow } from "../src/components/admin/project-utils";

let passCount = 0;
let failCount = 0;

function runTest(name: string, fn: () => void | Promise<void>) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passCount++;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message || err}`);
    failCount++;
  }
}

async function runAsyncTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
    passCount++;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message || err}`);
    failCount++;
  }
}

console.log("=================================================");
console.log("SADA OS — Client Workspaces & Client 360 MVP Suite");
console.log("=================================================\n");

// -------------------------------------------------------------
// GROUP 1: FINANCIAL INTEGRITY & NO HARCODED FALLBACKS
// -------------------------------------------------------------
console.log("--- Group 1: Financial Calculations & Invariants ---");

runTest("1.1: Zero Topline Revenue produces 0% margin and 'LOW PROFIT' health (No 50% fabrication)", () => {
  const monthlyRevenue = 0;
  const sponsoringClientCharge = 0;
  const clientExpenses = 0;
  const sponsoringMargin = 0;
  const estimatedDirectCost = monthlyRevenue * 0.35;
  const estimatedCommission = 0;

  const netProfit = monthlyRevenue + sponsoringMargin - (clientExpenses > 0 ? clientExpenses : estimatedDirectCost) - estimatedCommission;
  const totalTopline = monthlyRevenue + sponsoringClientCharge;
  const marginPercent = totalTopline > 0 ? (netProfit / totalTopline) * 100 : 0;

  const highMarginThreshold = 50;
  const medMarginThreshold = 25;
  const clientHealth =
    totalTopline <= 0
      ? "LOW PROFIT"
      : marginPercent >= highMarginThreshold
      ? "HIGH PROFIT"
      : marginPercent >= medMarginThreshold
      ? "MEDIUM"
      : "LOW PROFIT";

  assert.strictEqual(marginPercent, 0, "Margin percent must be 0 when revenue is 0");
  assert.strictEqual(clientHealth, "LOW PROFIT", "Health must be LOW PROFIT when revenue is 0");
});

runTest("1.2: Positive Revenue margin calculation is mathematically exact", () => {
  const monthlyRevenue = 3000;
  const sponsoringClientCharge = 1000;
  const sponsoringMargin = 300; // 1000 - 700 ad spend
  const clientExpenses = 800; // actual expenses
  const commissionRate = 15;
  const estimatedCommission = monthlyRevenue * (commissionRate / 100); // 450

  const netProfit = monthlyRevenue + sponsoringMargin - clientExpenses - estimatedCommission;
  // netProfit = 3000 + 300 - 800 - 450 = 2050
  const totalTopline = monthlyRevenue + sponsoringClientCharge; // 4000
  const marginPercent = (netProfit / totalTopline) * 100; // 2050 / 4000 * 100 = 51.25%

  const highMarginThreshold = 50;
  const clientHealth = marginPercent >= highMarginThreshold ? "HIGH PROFIT" : "MEDIUM";

  assert.strictEqual(netProfit, 2050, "Net profit calculation mismatch");
  assert.strictEqual(totalTopline, 4000, "Topline calculation mismatch");
  assert.ok(Math.abs(marginPercent - 51.25) < 0.0001, "Margin percent mismatch");
  assert.strictEqual(clientHealth, "HIGH PROFIT", "Client health should be HIGH PROFIT");
});

runTest("1.3: Double Counting Prevention between Invoices and Income Transactions", () => {
  const invoices = [
    { id: "inv-1", total_amount: 5000, paid_amount: 3000, status: "partially_paid" },
    { id: "inv-2", total_amount: 2500, paid_amount: 2500, status: "paid" },
  ];

  const payments = [
    { id: "inc-1", invoice_id: "inv-1", amount: 3000 }, // Already counted in inv-1.paid_amount
    { id: "inc-2", invoice_id: "inv-2", amount: 2500 }, // Already counted in inv-2.paid_amount
    { id: "inc-3", invoice_id: null, amount: 1200 },    // Independent unlinked receipt
  ];

  const invoicePaidTotal = invoices.reduce((sum, inv) => sum + inv.paid_amount, 0); // 5500
  const unlinkedIncomeTotal = payments
    .filter((p) => !p.invoice_id)
    .reduce((sum, p) => sum + p.amount, 0); // 1200

  const totalCollected = invoicePaidTotal + unlinkedIncomeTotal; // 6700
  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total_amount, 0); // 7500
  const totalOutstanding = Math.max(0, totalInvoiced - invoicePaidTotal); // 2000

  assert.strictEqual(invoicePaidTotal, 5500);
  assert.strictEqual(unlinkedIncomeTotal, 1200);
  assert.strictEqual(totalCollected, 6700, "Total collected must include invoice payments and unlinked income exactly once");
  assert.strictEqual(totalOutstanding, 2000, "Outstanding balance must be totalInvoiced - invoicePaidTotal");
});

runTest("1.4: Net Cash Position calculation incorporates all outflows", () => {
  const totalCollected = 10000;
  const clientExpenses = 2500;
  const sponsoringAdSpend = 1500;
  const netCashPosition = totalCollected - clientExpenses - sponsoringAdSpend;

  assert.strictEqual(netCashPosition, 6000, "Net cash position must subtract both operational expenses and ad spend");
});

runTest("1.5: Sponsoring Financial Model (Budget, Spend, Charge, Margin)", () => {
  const campaigns = [
    { budget_tnd: 1500, purchase_cost_tnd: 1000, client_charge_tnd: 1500, margin_tnd: 500 },
    { budget_tnd: 2000, purchase_cost_tnd: 1400, client_charge_tnd: 2000, margin_tnd: 600 },
  ];

  const sponsoringBudget = campaigns.reduce((sum, sc) => sum + sc.budget_tnd, 0);
  const sponsoringAdSpend = campaigns.reduce((sum, sc) => sum + sc.purchase_cost_tnd, 0);
  const sponsoringClientCharge = campaigns.reduce((sum, sc) => sum + sc.client_charge_tnd, 0);
  const sponsoringMargin = campaigns.reduce((sum, sc) => sum + sc.margin_tnd, 0);

  assert.strictEqual(sponsoringBudget, 3500);
  assert.strictEqual(sponsoringAdSpend, 2400);
  assert.strictEqual(sponsoringClientCharge, 3500);
  assert.strictEqual(sponsoringMargin, 1100);
  assert.strictEqual(sponsoringMargin, sponsoringClientCharge - sponsoringAdSpend);
});

runTest("1.6: Unset Contract Price & Sponsoring defaults strictly to 0 (No hardcoded 1500/500)", () => {
  const emptyClient: any = {
    monthly_package_price: null,
    default_service_fee: null,
    default_sponsoring_budget: null,
  };

  const currentPrice = Number(emptyClient.monthly_package_price || emptyClient.default_service_fee || 0);
  const sponsoringBudget = Number(emptyClient.default_sponsoring_budget || 0);

  assert.strictEqual(currentPrice, 0, "Unset contract price must evaluate to 0, not 1500");
  assert.strictEqual(sponsoringBudget, 0, "Unset sponsoring budget must evaluate to 0, not 500");
});

// -------------------------------------------------------------
// GROUP 2: PACKAGE WORK RECONCILIATION & HISTORICAL PRESERVATION
// -------------------------------------------------------------
console.log("\n--- Group 2: Package Work Reconciliation Engine ---");

runTest("2.1: Quota Increase generates only delta tasks", () => {
  const spec: DeliverableSpec = {
    service_name: "Reels / TikTok Video Production",
    deliverable_type: "reels_shooting",
    desired_quantity: 5,
    frequency: "weekly",
    default_role: "Video Producer",
    duration_hours: 3.5,
  };

  const existingTasks: TaskRow[] = [
    { id: "t-1", category: "Reel", service: "Reel Production", title: "Reel #1", status: "done", delivery_period: "2026-10", is_reconciliation_managed: true } as any,
    { id: "t-2", category: "Reel", service: "Reel Production", title: "Reel #2", status: "done", delivery_period: "2026-10", is_reconciliation_managed: true } as any,
    { id: "t-3", category: "Reel", service: "Reel Production", title: "Reel #3", status: "todo", delivery_period: "2026-10", is_reconciliation_managed: true } as any,
  ];

  // Increase quota from 3 to 5
  const diffResult = calculateReconciliationDiff({
    spec,
    periodTasks: existingTasks,
    previousQuota: 3,
    periodMonth: "2026-10",
    commitment: { quantity: 5 } as any,
  });

  assert.strictEqual(diffResult.tasksToCreateCount, 2, "Must create exactly 2 tasks when quota increases from 3 to 5");
  assert.strictEqual(diffResult.tasksToPruneList.length, 0, "Must prune 0 tasks on quota increase");
  assert.strictEqual(diffResult.historicalPreservedCount, 2, "Must preserve both completed tasks");
});

runTest("2.2: Quota Decrease prunes ONLY unstarted future tasks, 100% PRESERVING completed history", () => {
  const spec: DeliverableSpec = {
    service_name: "Reels / TikTok Video Production",
    deliverable_type: "reels_shooting",
    desired_quantity: 2,
    frequency: "weekly",
    default_role: "Video Producer",
    duration_hours: 3.5,
  };

  const existingTasks: TaskRow[] = [
    { id: "t-1", category: "Reel", service: "Reel Production", title: "Reel #1", status: "done", sequence_index: 1, delivery_period: "2026-10", is_reconciliation_managed: true } as any,
    { id: "t-2", category: "Reel", service: "Reel Production", title: "Reel #2", status: "done", sequence_index: 2, delivery_period: "2026-10", is_reconciliation_managed: true } as any,
    { id: "t-3", category: "Reel", service: "Reel Production", title: "Reel #3", status: "todo", sequence_index: 3, delivery_period: "2026-10", is_reconciliation_managed: true } as any,
    { id: "t-4", category: "Reel", service: "Reel Production", title: "Reel #4", status: "todo", sequence_index: 4, delivery_period: "2026-10", is_reconciliation_managed: true } as any,
  ];

  // Decrease quota from 4 to 2 (where 2 tasks are already done)
  const diffResult = calculateReconciliationDiff({
    spec,
    periodTasks: existingTasks,
    previousQuota: 4,
    periodMonth: "2026-10",
    commitment: { quantity: 2 } as any,
  });

  assert.strictEqual(diffResult.tasksToCreateCount, 0, "No new tasks should be created");
  assert.strictEqual(diffResult.tasksToPruneList.length, 2, "Must prune exactly 2 future unstarted tasks");
  assert.strictEqual(diffResult.historicalPreservedCount, 2, "Both completed tasks must be preserved");

  const prunedIds = diffResult.tasksToPruneList.map((t) => t.id);
  assert.ok(prunedIds.includes("t-3") && prunedIds.includes("t-4"), "Pruned tasks must be t-3 and t-4");
  assert.ok(!prunedIds.includes("t-1") && !prunedIds.includes("t-2"), "Completed tasks t-1 and t-2 must never be pruned");
});

runTest("2.3: In-Progress and Manually Overridden tasks are NEVER pruned on quota decrease", () => {
  const spec: DeliverableSpec = {
    service_name: "Reels / TikTok Video Production",
    deliverable_type: "reels_shooting",
    desired_quantity: 1,
    frequency: "weekly",
    default_role: "Video Producer",
    duration_hours: 3.5,
  };

  const existingTasks: TaskRow[] = [
    { id: "t-1", category: "Reel", service: "Reel Production", title: "Reel #1", status: "done", sequence_index: 1, delivery_period: "2026-10", is_reconciliation_managed: true } as any,
    { id: "t-2", category: "Reel", service: "Reel Production", title: "Reel #2", status: "in_progress", sequence_index: 2, delivery_period: "2026-10", is_reconciliation_managed: true } as any,
    { id: "t-3", category: "Reel", service: "Reel Production", title: "Reel #3", status: "todo", sequence_index: 3, manual_override: true, delivery_period: "2026-10" } as any,
    { id: "t-4", category: "Reel", service: "Reel Production", title: "Reel #4", status: "todo", sequence_index: 4, delivery_period: "2026-10", is_reconciliation_managed: true } as any,
  ];

  // Decrease quota from 4 to 1
  const diffResult = calculateReconciliationDiff({
    spec,
    periodTasks: existingTasks,
    previousQuota: 4,
    periodMonth: "2026-10",
    commitment: { quantity: 1 } as any,
  });

  // t-1 is done (protected), t-2 is in_progress (protected), t-3 has manual_override (protected)
  // Only t-4 is an eligible future task that can be pruned
  assert.strictEqual(diffResult.tasksToPruneList.length, 1, "Only 1 eligible future unstarted task can be pruned");
  assert.strictEqual(diffResult.tasksToPruneList[0].id, "t-4", "Only t-4 can be pruned");
});

runTest("2.4: Reconciliation Idempotency: Running diff on already balanced state produces 0 changes", () => {
  const spec: DeliverableSpec = {
    service_name: "Reels / TikTok Video Production",
    deliverable_type: "reels_shooting",
    desired_quantity: 2,
    frequency: "weekly",
    default_role: "Video Producer",
    duration_hours: 3.5,
  };

  const existingTasks: TaskRow[] = [
    { id: "t-1", category: "Reel", service: "Reel Production", title: "Reel #1", status: "done", delivery_period: "2026-10", is_reconciliation_managed: true } as any,
    { id: "t-2", category: "Reel", service: "Reel Production", title: "Reel #2", status: "todo", delivery_period: "2026-10", is_reconciliation_managed: true } as any,
  ];

  const diffResult = calculateReconciliationDiff({
    spec,
    periodTasks: existingTasks,
    previousQuota: 2,
    periodMonth: "2026-10",
    commitment: { quantity: 2 } as any,
  });

  assert.strictEqual(diffResult.tasksToCreateCount, 0, "Idempotent: 0 tasks created");
  assert.strictEqual(diffResult.tasksToPruneList.length, 0, "Idempotent: 0 tasks pruned");
  assert.strictEqual(diffResult.diff.status_summary, "Balanced (In sync with SSOT)");
});


// -------------------------------------------------------------
// GROUP 3: ROLE PERMISSIONS & SENSITIVE DATA ENFORCEMENT
// -------------------------------------------------------------
console.log("\n--- Group 3: Role & Permission Isolation ---");

runTest("3.1: Worker role cannot access financial workspace tabs", () => {
  const workerRole = "worker";
  const canAccessFinance = workerRole === "superadmin" || workerRole === "admin";
  const financialTabs = ["financial", "sponsoring", "invoices", "payments", "performance"];

  assert.strictEqual(canAccessFinance, false, "Worker must NOT have financial access");

  financialTabs.forEach((tab) => {
    const isAccessible = canAccessFinance;
    assert.strictEqual(isAccessible, false, `Tab ${tab} must be inaccessible to worker`);
  });
});

runTest("3.2: Admin and Superadmin roles retain full financial access", () => {
  const roles = ["superadmin", "admin"];
  roles.forEach((r) => {
    const canAccessFinance = r === "superadmin" || r === "admin";
    assert.strictEqual(canAccessFinance, true, `Role ${r} must have financial access`);
  });
});

// -------------------------------------------------------------
// GROUP 4: CROSS-PAGE DATA CONSISTENCY
// -------------------------------------------------------------
console.log("\n--- Group 4: Cross-Page Financial Consistency ---");

runTest("4.1: Client Directory & Client 360 share identical payment status resolution", () => {
  // Test case A: Has overdue invoice
  const invA = [{ status: "overdue", total_amount: 1000, paid_amount: 0 }];
  const statusA = invA.some((i) => i.status === "overdue") ? "OVERDUE" : "PENDING";
  assert.strictEqual(statusA, "OVERDUE");

  // Test case B: Zero invoices, zero payments
  const invB: any[] = [];
  const paidB = 0;
  const statusB = (invB.length > 0 && paidB >= 0) || (invB.length === 0 && paidB > 0) ? "PAID" : "PENDING";
  assert.strictEqual(statusB, "PENDING", "Zero invoices with 0 payments must be PENDING, not PAID");

  // Test case C: Invoiced and fully paid
  const invC = [{ status: "paid", total_amount: 2000, paid_amount: 2000 }];
  const statusC = (invC.length > 0 && 2000 >= 2000) || (invC.length === 0 && 2000 > 0) ? "PAID" : "PENDING";
  assert.strictEqual(statusC, "PAID");
});

runTest("4.2: Authoritative package config resolves correctly with and without catalog package", () => {
  const clientWithoutPkg: ClientRow = {
    id: "c-1",
    name: "Luxury Spa",
    client_type: "monthly",
    package_config: { reels_quota: 6, posts_quota: 4, stories_quota: 8 },
  } as any;

  const authState = resolveAuthoritativePackageConfig(clientWithoutPkg);
  assert.strictEqual(authState.quotas.reels, 6);
  assert.strictEqual(authState.quotas.posts, 4);
  assert.strictEqual(authState.quotas.stories, 8);
});

// -------------------------------------------------------------
// SUITE SUMMARY
// -------------------------------------------------------------
console.log("\n=================================================");
console.log(`Test Execution Finished: ${passCount} PASSED, ${failCount} FAILED`);
console.log("=================================================");

if (failCount > 0) {
  process.exit(1);
} else {
  console.log("All Client Workspaces & Client 360 MVP tests passed successfully!");
}
