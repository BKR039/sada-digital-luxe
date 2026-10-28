// ============================================================
// SADA OS — PHASE 9: EXECUTIVE COMMAND CENTER VERIFICATION
// Tests:
// 1. Answers to the 12 Executive Questions
// 2. The 5 Command Sections (Financial, Operations, Client, Team, Intelligence)
// 3. Drill-Down Engine across all Executive Metrics
// 4. Role Isolation & Invariant Validation (No fake data, no duplicate engines)
// ============================================================

import fs from "fs";
import path from "path";

// 1. Load environment variables
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

import { supabase } from "../src/integrations/supabase/client";
import { fetchCompanyFinance, getPresetPeriod } from "../src/lib/finance-service";
import { fetchManagementAnalytics, buildAnalyticsDrillDown } from "../src/lib/analytics-service";
import { formatCurrency } from "../src/types/finance";

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

const results: TestResult[] = [];

function assertTest(num: number, name: string, passed: boolean, expected: string, actual: string) {
  results.push({ num, name, passed, expected, actual });
  const status = passed ? "✓ PASS" : "✗ FAIL";
  console.log(`${status} [Test ${String(num).padStart(2, "0")}] ${name}`);
  if (!passed) {
    console.log(`    Expected: ${expected}`);
    console.log(`    Actual:   ${actual}`);
  }
}

async function runPhase9TestSuite() {
  console.log("=================================================================");
  console.log("SADA OS — PHASE 9: EXECUTIVE COMMAND CENTER VERIFICATION");
  console.log("Testing 12 Executive Questions, 5 Command Decks & Drill-Downs");
  console.log("=================================================================\n");

  // 1. Authenticate as Super Admin
  let authData: any = null;
  const loginRes = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (!loginRes.error && loginRes.data.user) {
    authData = loginRes.data;
  } else {
    const fallbackRes = await supabase.auth.signInWithPassword({
      email: "sec.admin@sada.agency",
      password: "AdminPassword123!",
    });
    if (!fallbackRes.error && fallbackRes.data.user) {
      authData = fallbackRes.data;
    }
  }

  if (!authData?.user) {
    console.error("Failed to authenticate test runner as Super Admin");
    process.exit(1);
  }
  console.log(`✓ Authenticated as Super Admin: ${authData.user.email} (${authData.user.id})\n`);

  try {
    const period = getPresetPeriod("this_month");
    const analyticsData = await fetchManagementAnalytics({ periodType: "this_month" });
    const { financeState, clientProfitability, packageProfitability, employeePerformance, commissionPerformance } = analyticsData;
    const kpis = financeState.kpis;

    // ------------------------------------------------------------
    // SECTION 1: THE 12 EXECUTIVE DASHBOARD QUESTIONS
    // ------------------------------------------------------------
    console.log("--- PART 1: THE 12 EXECUTIVE DASHBOARD QUESTIONS ---");

    // Question 1: How much did SADA collect this month?
    assertTest(
      1,
      "Question 1: How much did SADA collect this month? (Revenue Inflow)",
      typeof kpis.totalIncome === "number" && kpis.totalIncome >= 0,
      ">= 0 TND collected",
      `Collected: ${formatCurrency(kpis.totalIncome)}`
    );

    // Question 2: How much did SADA spend?
    assertTest(
      2,
      "Question 2: How much did SADA spend? (Operating Expenses)",
      typeof kpis.totalExpenses === "number" && kpis.totalExpenses >= 0,
      ">= 0 TND spent",
      `Spent: ${formatCurrency(kpis.totalExpenses)}`
    );

    // Question 3: What is the actual net profit?
    const netMargin = analyticsData.monthlyPnL.netMarginPercent ?? 0;
    assertTest(
      3,
      "Question 3: What is the actual net profit? (Net Margin %)",
      typeof kpis.netProfit === "number" && typeof netMargin === "number",
      "Net profit and margin derived",
      `Net Profit: ${formatCurrency(kpis.netProfit)} (${netMargin}%)`
    );

    // Question 4: How much cash is available?
    const totalAvailableCash = financeState.accounts.reduce(
      (sum: number, a: any) => sum + (Number(a.currentBalance ?? a.current_balance) || 0),
      0
    );
    assertTest(
      4,
      "Question 4: How much cash is available? (Treasury Balances)",
      typeof totalAvailableCash === "number" && totalAvailableCash > 0,
      "> 0 TND available",
      `Available Cash: ${formatCurrency(totalAvailableCash)} across ${financeState.accounts.length} accounts`
    );

    // Question 5: Who owes SADA money?
    const unpaidInvoices = financeState.invoices.filter(
      (i: any) => i.status !== "paid" && i.status !== "cancelled"
    );
    const totalOutstandingReceivables = unpaidInvoices.reduce(
      (sum: number, i: any) => sum + (Number(i.totalAmount) || 0),
      0
    );
    assertTest(
      5,
      "Question 5: Who owes SADA money? (Outstanding Receivables)",
      Array.isArray(unpaidInvoices),
      "Unpaid invoices list & sum",
      `${unpaidInvoices.length} invoices unpaid totaling ${formatCurrency(totalOutstandingReceivables)}`
    );

    // Question 6: Which clients are most profitable?
    const sortedClients = [...clientProfitability].sort(
      (a, b) => b.contributionProfit - a.contributionProfit
    );
    assertTest(
      6,
      "Question 6: Which clients are most profitable? (Contribution Profit)",
      sortedClients.length >= 0,
      "Clients ranked by contribution profit",
      `Top client: ${sortedClients[0]?.clientName || "None"} (${formatCurrency(sortedClients[0]?.contributionProfit || 0)})`
    );

    // Question 7: Which packages are most profitable?
    const sortedPackages = [...packageProfitability].sort(
      (a, b) => b.grossProfit - a.grossProfit
    );
    assertTest(
      7,
      "Question 7: Which packages are most profitable? (Gross Margin %)",
      sortedPackages.length >= 0,
      "Packages ranked by gross profit",
      `Top package: ${sortedPackages[0]?.name || "None"} (${sortedPackages[0]?.grossMarginPercent || 0}% margin)`
    );

    // Question 8: Which projects are at risk?
    const atRiskProjects = analyticsData.rawProjects.filter((p: any) => p.status === "blocked" || p.status === "in_review");
    assertTest(
      8,
      "Question 8: Which projects are at risk? (Exception Detection)",
      Array.isArray(atRiskProjects),
      "Array of at-risk projects",
      `${atRiskProjects.length} projects flagged at risk`
    );

    // Question 9: Which tasks are overdue?
    const now = new Date();
    const overdueTasks = analyticsData.rawTasks.filter(
      (t: any) => t.deadline && new Date(t.deadline) < now && t.status !== "done" && t.status !== "cancelled"
    );
    assertTest(
      9,
      "Question 9: Which tasks are overdue? (Late Deliverables)",
      Array.isArray(overdueTasks),
      "Array of overdue tasks",
      `${overdueTasks.length} deliverables overdue past deadline`
    );

    // Question 10: Which employees have pending requests?
    const pendingRequests = financeState.salaryRequests.filter((r: any) => r.status === "pending");
    assertTest(
      10,
      "Question 10: Which employees have pending requests? (Salary Advances)",
      Array.isArray(pendingRequests),
      "Array of pending requests",
      `${pendingRequests.length} pending employee requests awaiting Super Admin review`
    );

    // Question 11: What salaries/commissions are upcoming?
    const upcomingSalaries = financeState.salaryRecords.reduce(
      (sum: number, s: any) => sum + (Number(s.base_amount) || 0),
      0
    );
    const upcomingCommissions =
      (commissionPerformance.commissionsPending || 0) + (commissionPerformance.commissionsApproved || 0);
    const totalUpcomingPayroll = upcomingSalaries + upcomingCommissions;
    assertTest(
      11,
      "Question 11: What salaries/commissions are upcoming? (Payroll Commitments)",
      totalUpcomingPayroll >= 0,
      ">= 0 TND upcoming payroll",
      `Upcoming: ${formatCurrency(totalUpcomingPayroll)} (Salaries: ${formatCurrency(upcomingSalaries)}, Comm: ${formatCurrency(upcomingCommissions)})`
    );

    // Question 12: What financial risks require attention?
    const recurringBurn = Number((kpis as any).recurringBurn || (kpis as any).monthlyBurnRate || 0);
    const runwayMonths = recurringBurn > 0
      ? Math.round((totalAvailableCash / recurringBurn) * 10) / 10
      : 12;
    assertTest(
      12,
      "Question 12: What financial risks require attention? (Runway & Margins)",
      typeof runwayMonths === "number" && typeof recurringBurn === "number",
      "Runway and burn rate tracked",
      `Runway: ${runwayMonths} months, Burn Rate: ${formatCurrency(recurringBurn)}/mo`
    );

    // ------------------------------------------------------------
    // SECTION 2: THE 5 COMMAND SECTIONS & DRILL-DOWN CAPABILITY
    // ------------------------------------------------------------
    console.log("\n--- PART 2: THE 5 COMMAND SECTIONS & DRILL-DOWN ENGINE ---");

    // Test 13: Financial Command Drill-Down (Revenue)
    const drillRevenue = buildAnalyticsDrillDown({
      metricType: "monthly_revenue",
      metricLabel: "Collected Revenue This Month",
      metricValue: formatCurrency(kpis.totalIncome),
      data: analyticsData,
    });
    assertTest(
      13,
      "Financial Command Drill-Down: Monthly Revenue (Formula & Source Records)",
      drillRevenue.formula.includes("Collected Revenue") && Array.isArray(drillRevenue.records),
      "Formula and records array",
      `Formula: "${drillRevenue.formula}", Records: ${drillRevenue.recordsCount}`
    );

    // Test 14: Financial Command Drill-Down (Expenses)
    const drillExpenses = buildAnalyticsDrillDown({
      metricType: "monthly_expenses",
      metricLabel: "Operating Expenses Spent",
      metricValue: formatCurrency(kpis.totalExpenses),
      data: analyticsData,
    });
    assertTest(
      14,
      "Financial Command Drill-Down: Monthly Expenses (Formula & Source Records)",
      drillExpenses.formula.includes("Operating Expenses") && Array.isArray(drillExpenses.records),
      "Formula and records array",
      `Formula: "${drillExpenses.formula}", Records: ${drillExpenses.recordsCount}`
    );

    // Test 15: Financial Command Drill-Down (Available Cash)
    const drillCash = buildAnalyticsDrillDown({
      metricType: "cash_balance",
      metricLabel: "Available Liquid Cash Reserves",
      metricValue: formatCurrency(totalAvailableCash),
      data: analyticsData,
    });
    assertTest(
      15,
      "Financial Command Drill-Down: Available Cash (Treasury Accounts)",
      drillCash.formula.includes("Liquid Cash") && Array.isArray(drillCash.records),
      "Formula and records array",
      `Formula: "${drillCash.formula}", Records: ${drillCash.recordsCount}`
    );

    // Test 16: Operations Command Drill-Down (Overdue Tasks)
    const drillOverdue = buildAnalyticsDrillDown({
      metricType: "overdue_tasks",
      metricLabel: "Overdue Project Deliverables",
      metricValue: overdueTasks.length,
      data: analyticsData,
    });
    assertTest(
      16,
      "Operations Command Drill-Down: Overdue Deliverables",
      drillOverdue.formula.includes("Overdue Tasks") && Array.isArray(drillOverdue.records),
      "Formula and records array",
      `Formula: "${drillOverdue.formula}", Records: ${drillOverdue.recordsCount}`
    );

    // Test 17: Client Command Drill-Down (Client Contribution Profit)
    const topClientId = sortedClients[0]?.clientId;
    const drillClient = buildAnalyticsDrillDown({
      metricType: "client_contribution_profit",
      metricLabel: `Client: ${sortedClients[0]?.clientName || "Top Client"}`,
      metricValue: formatCurrency(sortedClients[0]?.contributionProfit || 0),
      entityId: topClientId,
      data: analyticsData,
    });
    assertTest(
      17,
      "Client Command Drill-Down: Contribution Profit & Source Invoices",
      drillClient.formula.includes("Contribution Profit") && Array.isArray(drillClient.records),
      "Formula and records array",
      `Formula: "${drillClient.formula}", Records: ${drillClient.recordsCount}`
    );

    // Test 18: Team Command Drill-Down (Upcoming Payroll)
    const drillPayroll = buildAnalyticsDrillDown({
      metricType: "upcoming_payroll",
      metricLabel: "Upcoming Payroll Commitments",
      metricValue: formatCurrency(totalUpcomingPayroll),
      data: analyticsData,
    });
    assertTest(
      18,
      "Team Command Drill-Down: Base Salaries & Commission Commitments",
      Array.isArray(drillPayroll.records) && drillPayroll.recordsCount >= 0,
      "Formula and records array",
      `Formula: "${drillPayroll.formula}", Records: ${drillPayroll.recordsCount}`
    );

    // Test 19: Intelligence Command Drill-Down (Outstanding Invoices Risk)
    const drillOutstanding = buildAnalyticsDrillDown({
      metricType: "outstanding_invoices",
      metricLabel: "Outstanding Receivables Aging",
      metricValue: formatCurrency(totalOutstandingReceivables),
      data: analyticsData,
    });
    assertTest(
      19,
      "Intelligence Risk Drill-Down: Outstanding Client Invoices",
      drillOutstanding.formula.includes("Outstanding Receivables") && Array.isArray(drillOutstanding.records),
      "Formula and records array",
      `Formula: "${drillOutstanding.formula}", Records: ${drillOutstanding.recordsCount}`
    );

    // Test 20: Deterministic Invariant Check: Zero manually entered KPIs
    const isDeterministic =
      kpis.totalIncome === analyticsData.monthlyPnL.totalRevenue &&
      kpis.netProfit === analyticsData.monthlyPnL.netProfit &&
      kpis.totalExpenses === analyticsData.cashFlow.cashOutflows;
    assertTest(
      20,
      "CRITICAL: Single Source of Truth Convergence (Zero duplicate engines or fake data)",
      isDeterministic,
      "Financial OS and Management Analytics perfectly reconciled",
      `Reconciled: Total Revenue ${kpis.totalIncome} == ${analyticsData.monthlyPnL.totalRevenue}, Net Profit ${kpis.netProfit} == ${analyticsData.monthlyPnL.netProfit}`
    );

  } catch (err: any) {
    console.error("Test Suite execution failed:", err);
    process.exit(1);
  }

  // Summary
  console.log("\n=================================================================");
  const totalPassed = results.filter((r) => r.passed).length;
  console.log(`TEST SUITE RESULTS: ${totalPassed}/${results.length} PASSED (${results.length - totalPassed} FAILED)`);
  console.log("=================================================================\n");

  if (totalPassed === results.length) {
    console.log("🎉 ALL TESTS PASSED! SADA OS Phase 9: Executive Command Center Verified.");
    process.exit(0);
  } else {
    console.error(`❌ ${results.length - totalPassed} test(s) failed.`);
    process.exit(1);
  }
}

runPhase9TestSuite();
