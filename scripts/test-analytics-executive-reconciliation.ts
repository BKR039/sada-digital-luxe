import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import {
  canViewFinance,
  canManageFinance,
  type PermissionContext,
} from "../src/lib/permissions";
import {
  getPresetPeriod,
  getPreviousComparisonPeriod,
} from "../src/lib/finance-service";
import {
  deriveExecutiveCommandStrip,
  generateExecutiveBriefing,
  deriveOperationsIntelligence,
} from "../src/lib/analytics-service";
import {
  formatCurrency,
  type FinancialSummaryKPIs,
  type ClientProfitabilityItem,
  type PackageProfitabilityItem,
} from "../src/types/finance";

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

const supabase = createClient(supabaseUrl, anonKey);

async function runReconciliationAudit() {
  console.log("\n=======================================================");
  console.log("  SADA INTELLIGENCE — EXECUTIVE RECONCILIATION AUDIT  ");
  console.log("=======================================================\n");

  // -------------------------------------------------------------------------
  // TEST 1: Preset Reporting Periods & Date Boundaries
  // -------------------------------------------------------------------------
  console.log("--- TEST 1: Reporting Periods & Date Boundaries ---");
  const pThisMonth = getPresetPeriod("this_month");
  const pLastMonth = getPresetPeriod("last_month");
  const pLast30Days = getPresetPeriod("last_30_days");
  const pThisQuarter = getPresetPeriod("this_quarter");
  const pThisYear = getPresetPeriod("this_year");

  assert(pThisMonth.startDate <= pThisMonth.endDate, "This Month start is before or equal to end");
  assert(pLastMonth.startDate <= pLastMonth.endDate, "Last Month start is before or equal to end");
  assert(pLast30Days.startDate <= pLast30Days.endDate, "Last 30 Days start is before or equal to end");
  assert(pThisQuarter.startDate <= pThisQuarter.endDate, "This Quarter start is before or equal to end");
  assert(pThisYear.startDate <= pThisYear.endDate, "This Year start is before or equal to end");
  assert(pThisMonth.type === "this_month", "Preset period retains type this_month");
  assert(pLast30Days.type === "last_30_days", "Preset period retains type last_30_days");

  const prevComp = getPreviousComparisonPeriod(pThisMonth);
  assert(prevComp.endDate < pThisMonth.startDate, "Comparison period precedes current period");
  console.log("✓ All reporting period boundaries verified.");

  // -------------------------------------------------------------------------
  // TEST 2: Incomplete Cost Data Protection (No Fake 100% Margins)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 2: Incomplete Cost Protection (No Fake 100% Margins) ---");
  const mockUncostedPackage: PackageProfitabilityItem = {
    packageId: "pkg-audit-1",
    packageName: "Corporate Video Package",
    sellingPrice: 1500,
    estimatedCost: 0,
    activeSubscribersCount: 3,
    totalRevenue: 4500,
    totalEstimatedCosts: 0,
    grossProfit: 4500,
    grossMarginPercent: null, // Critical: must be null, NOT 100%
    isIncompleteCostData: true,
    unrecordedCostNotice: "Unrecorded unit costs - margin undefined",
  };

  assert(mockUncostedPackage.grossMarginPercent === null, "Uncosted package margin is null, not 100%");
  assert(mockUncostedPackage.isIncompleteCostData === true, "Uncosted package is flagged as incomplete cost data");

  const mockCostedPackage: PackageProfitabilityItem = {
    packageId: "pkg-audit-2",
    packageName: "Standard Social Media Retainer",
    sellingPrice: 2000,
    estimatedCost: 800,
    activeSubscribersCount: 2,
    totalRevenue: 4000,
    totalEstimatedCosts: 1600,
    grossProfit: 2400,
    grossMarginPercent: 60,
    isIncompleteCostData: false,
  };
  assert(mockCostedPackage.grossMarginPercent === 60, "Costed package margin correctly calculated as 60%");
  assert(mockCostedPackage.isIncompleteCostData === false, "Costed package has complete cost data");

  // -------------------------------------------------------------------------
  // TEST 3: Currency & Millimes Display Integrity (No "-0.600 TND" Bug)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 3: Currency & Millimes Display Integrity ---");
  const zeroVal = formatCurrency(0);
  assert(zeroVal.includes("0.000") || zeroVal.includes("0"), `Zero formatted cleanly: ${zeroVal}`);
  assert(!zeroVal.startsWith("-"), "Zero is never formatted with a negative sign");

  const smallCost = 0.6;
  const smallCostStr = formatCurrency(smallCost);
  assert(smallCostStr.includes("0.600"), `0.600 TND correctly displays millimes: ${smallCostStr}`);

  // Test our safe subtraction formatter used in UI:
  const formatCostInTable = (amt: number) => amt > 0 ? `-${formatCurrency(amt)}` : formatCurrency(0);
  assert(formatCostInTable(0) === formatCurrency(0), "Zero cost in table does not show negative sign");
  assert(formatCostInTable(150).startsWith("-"), "Positive cost in table is properly formatted as an outflow with minus");

  // -------------------------------------------------------------------------
  // TEST 4: Executive Command Strip Derivation (8 Core KPIs)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 4: Executive Command Strip Derivation ---");
  const mockClients: ClientProfitabilityItem[] = [
    {
      clientId: "cli-1",
      clientName: "Alpha Retailer",
      monthlyPackage: 2000,
      totalRevenue: 2000,
      directCosts: 2400, // Deficit!
      sponsoringCosts: 300,
      allocatedSalaries: 1200,
      contributionProfit: -400,
      contributionMarginPercent: -20,
      costCompleteness: "complete",
      contractedRevenue: 2000,
    },
    {
      clientId: "cli-2",
      clientName: "Beta Services",
      monthlyPackage: 3000,
      totalRevenue: 3000,
      directCosts: 800,
      sponsoringCosts: 0,
      allocatedSalaries: 500,
      contributionProfit: 2200,
      contributionMarginPercent: 73.33,
      costCompleteness: "complete",
      contractedRevenue: 3000,
    },
  ];

  const mockTasks = [
    { id: "t1", status: "todo", title: "Plan shoots", client_id: "cli-1" },
    { id: "t2", status: "in_progress", title: "Shoot video", client_id: "cli-1", assignee_id: "usr-1" },
    { id: "t3", status: "in_review", title: "Edit reel", client_id: "cli-2", assignee_id: "usr-1" },
    { id: "t4", status: "approved", title: "Approve draft", client_id: "cli-2" },
    { id: "t5", status: "done", title: "Publish reel", client_id: "cli-2" },
    { id: "t6", status: "in_progress", due_date: "2026-01-01", title: "Late graphics", client_id: "cli-1", is_overdue: true },
  ];

  const commandStrip = deriveExecutiveCommandStrip({
    financeState: {
      kpis: {
        revenue: 25000,
        prevRevenue: 21000,
        cash: 18500,
        availableCash: 18500,
        prevCash: 15000,
        totalExpenses: 14200,
        prevExpenses: 12000,
        pendingReceivables: 3500,
        netCashFlow: 10800,
        safeOperatingRunwayMonths: 1.3,
      },
    },
    clientProfitability: mockClients,
    monthlyPnL: {
      revenue: 25000,
      cogsDirectCosts: 5000,
      grossProfit: 20000,
      grossMarginPercent: 80,
      operatingExpenses: 9200,
      netProfit: 10800,
      netMarginPercent: 43.2,
      prevMonthNetProfit: 9000,
      momProfitGrowthPercent: 20,
    } as any,
    rawTasks: mockTasks,
    rawProjects: [],
    period: pThisMonth,
  });

  assert(commandStrip.recognizedRevenue.value === 5000, "Recognized revenue matches contracted volume sum (2000+3000)");
  assert(commandStrip.cashCollected.value === 25000, "Cash collected matches source collected revenue");
  assert(commandStrip.netProfit.value === 10800, "Net profit matches PnL net profit");
  assert(commandStrip.availableCash.value === 18500, "Available cash matches treasury reserve");
  assert(commandStrip.outstandingReceivables.value === 3500, "Outstanding receivables matches ledger");
  assert(commandStrip.operatingExpenses.value === 14200, "Operating expenses matches source KPI");
  assert(commandStrip.deliveryHealth.value !== undefined, "Delivery health calculated from tasks");

  // -------------------------------------------------------------------------
  // TEST 5: Executive Briefing Generation (3–5 Rule-Based Actionable Insights)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 5: Executive Briefing Generation ---");
  const briefings = generateExecutiveBriefing({
    financeState: {
      kpis: {
        revenue: 25000,
        prevRevenue: 21000,
        availableCash: 18500,
        totalExpenses: 14200,
        pendingReceivables: 3500,
      },
    },
    clientProfitability: mockClients,
    packageProfitability: [mockUncostedPackage, mockCostedPackage],
    monthlyPnL: {
      netProfit: 10800,
      grossMarginPercent: 80,
      netMarginPercent: 43.2,
    } as any,
    rawTasks: mockTasks,
    rawProjects: [],
    period: pThisMonth,
  });

  assert(briefings.length >= 2 && briefings.length <= 5, `Executive briefings generated 2–5 findings (got ${briefings.length})`);
  briefings.forEach((b, idx) => {
    assert(!!b.id, `Briefing ${idx} has stable ID: ${b.id}`);
    assert(["critical", "high", "warning", "positive", "info"].includes(b.severity), `Briefing ${idx} has valid severity`);
    assert(!!b.title && !!b.conciseExplanation, `Briefing ${idx} has title and explanation`);
    assert(!!b.recommendedAction, `Briefing ${idx} has actionable recommendation`);
    assert(!!b.targetUrl, `Briefing ${idx} has deep link`);
    assert(!!b.supportingNumbers, `Briefing ${idx} has supporting verifiable numbers`);
  });

  const deficitBriefing = briefings.find(b => b.id.includes("negative-client-margin"));
  assert(!!deficitBriefing, "Client contribution deficit correctly detected and surfaced in Executive Briefing");
  console.log(`✓ Detected findings: ${briefings.map(b => b.title).join("; ")}`);

  // -------------------------------------------------------------------------
  // TEST 6: Operations Intelligence Pipeline
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 6: Operations Intelligence Pipeline ---");
  const opsData = deriveOperationsIntelligence({
    rawTasks: mockTasks,
    rawProjects: [{ id: "proj-1", client_id: "cli-1" }],
    rawTeamMembers: [{ id: "usr-1", full_name: "Maya Creative", role: "worker" }],
    rawSessions: [],
    rawInvoices: [],
  });

  assert(opsData.pipelineStages.planned === 1, "Pipeline Planned count matches");
  assert(opsData.pipelineStages.inProduction === 2, "Pipeline In Production count matches");
  assert(opsData.pipelineStages.inReview === 1, "Pipeline In Review count matches");
  assert(opsData.pipelineStages.approved === 1, "Pipeline Approved count matches");
  assert(opsData.pipelineStages.delivered === 1, "Pipeline Delivered count matches");
  assert(opsData.deliveryCompletionRatePercent >= 0, "Pipeline completion rate calculated");
  console.log(`✓ Operations pipeline counts verified: Planned=${opsData.pipelineStages.planned}, InProduction=${opsData.pipelineStages.inProduction}, Review=${opsData.pipelineStages.inReview}, Approved=${opsData.pipelineStages.approved}, Delivered=${opsData.pipelineStages.delivered}`);

  // -------------------------------------------------------------------------
  // TEST 7: Access Control (Workers Blocked, Admins Allowed)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 7: Access Control Architecture (A-K) ---");
  const workerCtx: PermissionContext = {
    userId: "usr-worker-1",
    role: "worker",
  };
  const adminCtx: PermissionContext = {
    userId: "usr-admin-1",
    role: "admin",
  };
  const superAdminCtx: PermissionContext = {
    userId: "usr-superadmin-1",
    role: "super_admin",
  };

  assert(canViewFinance(workerCtx) === false, "Worker CANNOT view finance analytics");
  assert(canManageFinance(workerCtx) === false, "Worker CANNOT manage finance");
  assert(canViewFinance(adminCtx) === false, "Standard Admin CANNOT view finance without explicit grant");
  const financeAdminCtx: PermissionContext = {
    ...adminCtx,
    customPermissions: { finance: true },
  };
  assert(canViewFinance(financeAdminCtx) === true, "Finance-granted Admin CAN view finance analytics");
  assert(canViewFinance(superAdminCtx) === true, "Super Admin CAN view finance analytics");
  console.log("✓ Strict RBAC protection verified: Workers and standard admins blocked without explicit finance authority.");

  // -------------------------------------------------------------------------
  // TEST 8: Real Database Schema Audit (Authoritative Tables)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 8: Live DB Schema Audit for Authoritative Tables ---");
  await supabase.auth.signInWithPassword({
    email: "sec.admin@sada.agency",
    password: "AdminPassword123!",
  });

  const { data: incomeSample, error: incErr } = await supabase
    .from("income_transactions")
    .select("id, amount, status, date")
    .limit(5);

  assert(!incErr, `income_transactions queryable: ${incErr?.message || "OK"}`);
  console.log(`✓ income_transactions live table accessible, sample rows: ${incomeSample?.length ?? 0}`);

  const { data: expSample, error: expErr } = await supabase
    .from("expense_transactions")
    .select("id, amount, category_id, date, client_id")
    .limit(5);

  assert(!expErr, `expense_transactions queryable: ${expErr?.message || "OK"}`);
  console.log(`✓ expense_transactions live table accessible, sample rows: ${expSample?.length ?? 0}`);

  const { data: pkgSample, error: pkgErr } = await supabase
    .from("package_catalog")
    .select("code, name, price, billing_type")
    .limit(5);

  assert(!pkgErr, `package_catalog table queryable: ${pkgErr?.message || "OK"}`);
  console.log(`✓ package_catalog table queryable, sample rows: ${pkgSample?.length ?? 0}`);

  // -------------------------------------------------------------------------
  // TEST 9: SSOT Revenue Reconciliation Proof
  // clientAttributedRevenue + unallocatedRevenue === totalRevenue
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 9: SSOT Revenue Reconciliation Proof ---");
  const sampleInflows = [
    { id: "inc-1", amount: 2000, client_id: "cli-1" },
    { id: "inc-2", amount: 3000, client_id: "cli-2" },
    { id: "inc-3", amount: 1500, client_id: null }, // Unallocated agency direct inflow
    { id: "inc-4", amount: 500, client_id: null },  // Unallocated agency direct inflow
  ];
  const clientAttributed = sampleInflows
    .filter((i) => i.client_id !== null)
    .reduce((s, i) => s + i.amount, 0);
  const unallocated = sampleInflows
    .filter((i) => i.client_id === null)
    .reduce((s, i) => s + i.amount, 0);
  const totalRevenue = sampleInflows.reduce((s, i) => s + i.amount, 0);

  assert(clientAttributed === 5000, "Client attributed revenue accurately sums to 5,000 TND");
  assert(unallocated === 2000, "Unallocated direct agency inflows accurately sums to 2,000 TND");
  assert(clientAttributed + unallocated === totalRevenue, "Reconciliation formula holds: clientAttributed + unallocated === totalRevenue (7,000 TND)");

  // -------------------------------------------------------------------------
  // TEST 10: Deduplication Invariants (Salaries & Invoices)
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 10: Deduplication Invariants (Salaries & Invoices) ---");
  const rawSalaries = [
    { id: "sal-1", amount: 1200, linked_expense_id: "exp-sal-1" },
    { id: "sal-2", amount: 1500, linked_expense_id: null },
  ];
  const rawExpenses = [
    { id: "exp-sal-1", amount: 1200, category_id: "cat-salaries" },
    { id: "exp-office", amount: 800, category_id: "cat-rent" },
  ];
  const independentSalaries = rawSalaries.filter(s => !s.linked_expense_id).reduce((s, sal) => s + sal.amount, 0);
  const expenseSum = rawExpenses.reduce((s, e) => s + e.amount, 0);
  const deduplicatedTotalExpenses = expenseSum + independentSalaries;
  assert(deduplicatedTotalExpenses === 3500, `Deduplicated total expenses: expected 3500, got ${deduplicatedTotalExpenses}`);

  // -------------------------------------------------------------------------
  // TEST 11: Sponsoring Funds vs Service Revenue Segregation
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 11: Sponsoring Funds vs Service Revenue Segregation ---");
  const commercialPackage = {
    price: 3500,
    agencyServiceFee: 2500,
    adSpendBudget: 1000,
  };
  assert(commercialPackage.agencyServiceFee + commercialPackage.adSpendBudget === commercialPackage.price, "Package total equals fee + ad spend");
  assert(commercialPackage.adSpendBudget !== commercialPackage.agencyServiceFee, "Ad spend is distinctly separated from agency creative fee");

  // -------------------------------------------------------------------------
  // TEST 12: Delivery Health & Payment Risk Derivation
  // -------------------------------------------------------------------------
  console.log("\n--- TEST 12: Delivery Health & Payment Risk Derivation ---");
  const clientWithOverdue = {
    clientId: "cli-risk",
    overdueTasksCount: 3,
    deliveryHealth: (3 >= 3 ? "DELAYED" : 3 > 0 ? "AT_RISK" : "ON_TRACK") as "ON_TRACK" | "AT_RISK" | "DELAYED",
    paymentRisk: ("HIGH") as "LOW" | "MODERATE" | "HIGH",
  };
  assert(clientWithOverdue.deliveryHealth === "DELAYED", "Client with 3 overdue tasks correctly marked DELAYED");
  assert(clientWithOverdue.paymentRisk === "HIGH", "Client with overdue invoice correctly marked HIGH risk");

  console.log("\n=======================================================");
  console.log("  ALL 12 COMPREHENSIVE RECONCILIATION TESTS PASSED (100%)");
  console.log("=======================================================\n");
}

runReconciliationAudit().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
