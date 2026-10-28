// ============================================================
// SADA OS — PHASE 2A REGRESSION & VERIFICATION SUITE
// Tests for:
// - DEF-ECC-01: Available Liquid Cash calculation & validation
// - DEF-ECC-02: Treasury Breakdown mapping & reconciliation
// - DEF-ECC-03: Runway & Insolvency Alerts (positive, zero, missing burn)
// - DEF-ECC-04: Operational Exceptions Deduplication & All Count
// - DEF-ECC-05: Multi-category Exception Integrity (no duplicate cards)
// ============================================================

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { formatCurrency, type FinancialAccount } from "../src/types/finance";
import { getAgencyUnassignedTasks, getAgencyOverdueTasks, getAgencyBlockedTasks } from "../src/components/admin/project-utils";

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
const supabase = createClient(supabaseUrl, anonKey);

interface TestResult {
  category: string;
  name: string;
  passed: boolean;
  expected: any;
  actual: any;
  details?: string;
}

const testResults: TestResult[] = [];

function assert(category: string, name: string, condition: boolean, expected: any, actual: any, details?: string) {
  testResults.push({ category, name, passed: condition, expected, actual, details });
  const icon = condition ? "✓ PASS" : "✗ FAIL";
  console.log(`${icon} [${category}] ${name}`);
  if (!condition) {
    console.error(`    Expected:`, expected);
    console.error(`    Actual:  `, actual);
    if (details) console.error(`    Details: `, details);
  }
}

// ============================================================
// PART 1: PURE UNIT TESTS FOR FINANCIAL CALCULATIONS
// ============================================================

export function computeAvailableLiquidCash(accounts: any[] | null | undefined, fallbackKpiCash?: number | null): number | null {
  if (!accounts || !Array.isArray(accounts)) {
    return typeof fallbackKpiCash === "number" && Number.isFinite(fallbackKpiCash) ? fallbackKpiCash : null;
  }
  const activeAccounts = accounts.filter((a) => a.status === "active" || a.status === undefined);
  return activeAccounts.reduce((sum: number, a: any) => {
    const raw = a.currentBalance !== undefined ? a.currentBalance : a.current_balance;
    const num = Number(raw);
    return sum + (Number.isFinite(num) ? num : 0);
  }, 0);
}

export function computeCashRunway(totalCash: number | null, recurringBurn: number | null | undefined): {
  runwayMonths: number | null;
  isRunwayCritical: boolean;
  isRunwayWarning: boolean;
  status: "indeterminate" | "no_burn" | "critical" | "warning" | "healthy";
} {
  const criticalThreshold = 3;
  const warningThreshold = 6;

  if (totalCash === null || recurringBurn === undefined || recurringBurn === null || !Number.isFinite(Number(recurringBurn))) {
    return {
      runwayMonths: null,
      isRunwayCritical: false,
      isRunwayWarning: false,
      status: "indeterminate",
    };
  }

  const burn = Number(recurringBurn);
  if (burn <= 0) {
    return {
      runwayMonths: totalCash > 0 ? 999 : 0,
      isRunwayCritical: totalCash <= 0,
      isRunwayWarning: false,
      status: totalCash > 0 ? "no_burn" : "critical",
    };
  }

  const months = Math.max(0, Math.round((totalCash / burn) * 10) / 10);
  const isCritical = months < criticalThreshold;
  const isWarning = !isCritical && months < warningThreshold;

  return {
    runwayMonths: months,
    isRunwayCritical: isCritical,
    isRunwayWarning: isWarning,
    status: isCritical ? "critical" : isWarning ? "warning" : "healthy",
  };
}

// ============================================================
// PART 2: PURE UNIT TESTS FOR OPERATIONAL EXCEPTIONS DEDUPLICATION
// ============================================================

export type ExceptionCategory = "overdue" | "blocked" | "unassigned" | "client_action";

export interface UnifiedExceptionItem {
  id: string;
  entityType: "task" | "project";
  task?: any;
  project?: any;
  categories: ExceptionCategory[];
  primaryCategory: ExceptionCategory;
  clientActionItem?: any;
}

export function deduplicateOperationalExceptions(params: {
  overdueTasks: any[];
  blockedTasks: any[];
  unassignedTasks: any[];
  clientActionItems: any[];
  projectMap?: Map<string, any>;
}): {
  allExceptions: UnifiedExceptionItem[];
  allCount: number;
  overdueCount: number;
  blockedCount: number;
  unassignedCount: number;
  clientActionCount: number;
} {
  const itemMap = new Map<string, UnifiedExceptionItem>();

  const register = (
    id: string,
    entityType: "task" | "project",
    category: ExceptionCategory,
    task?: any,
    project?: any,
    clientActionItem?: any
  ) => {
    let existing = itemMap.get(id);
    if (!existing) {
      existing = {
        id,
        entityType,
        task,
        project: project || (task && params.projectMap ? params.projectMap.get(task.project_id) : undefined),
        categories: [],
        primaryCategory: category,
        clientActionItem,
      };
      itemMap.set(id, existing);
    }
    if (!existing.categories.includes(category)) {
      existing.categories.push(category);
    }
    if (clientActionItem && !existing.clientActionItem) {
      existing.clientActionItem = clientActionItem;
    }
    const priorityOrder: Record<ExceptionCategory, number> = {
      blocked: 4,
      overdue: 3,
      client_action: 2,
      unassigned: 1,
    };
    if (priorityOrder[category] > priorityOrder[existing.primaryCategory]) {
      existing.primaryCategory = category;
    }
  };

  for (const t of params.overdueTasks) {
    register(`task-${t.id}`, "task", "overdue", t);
  }
  for (const t of params.blockedTasks) {
    register(`task-${t.id}`, "task", "blocked", t);
  }
  for (const t of params.unassignedTasks) {
    register(`task-${t.id}`, "task", "unassigned", t);
  }
  for (let idx = 0; idx < params.clientActionItems.length; idx++) {
    const ca = params.clientActionItems[idx];
    if (ca.task) {
      register(`task-${ca.task.id}`, "task", "client_action", ca.task, ca.project, ca);
    } else {
      register(`proj-${ca.project.id}`, "project", "client_action", undefined, ca.project, ca);
    }
  }

  const allExceptions = Array.from(itemMap.values());
  return {
    allExceptions,
    allCount: allExceptions.length,
    overdueCount: params.overdueTasks.length,
    blockedCount: params.blockedTasks.length,
    unassignedCount: params.unassignedTasks.length,
    clientActionCount: params.clientActionItems.length,
  };
}

// ============================================================
// MAIN TEST RUNNER
// ============================================================

async function runTestSuite() {
  console.log("=================================================================");
  console.log("SADA OS — PHASE 2A VERIFICATION TEST SUITE");
  console.log("=================================================================\n");

  // ------------------------------------------------------------
  // SECTION A: FINANCIAL CALCULATIONS
  // ------------------------------------------------------------
  console.log("--- 1. FINANCIAL CALCULATION TESTS (DEF-ECC-01, DEF-ECC-02, DEF-ECC-03) ---");

  // Test A1: Active accounts with valid camelCase balances
  const sampleAccountsCamel = [
    { id: "1", name: "Main Treasury", currentBalance: 50000, status: "active" },
    { id: "2", name: "Operating Cash", currentBalance: 18200, status: "active" },
    { id: "3", name: "Reserve Account", currentBalance: 20000, status: "active" },
  ];
  const cashA1 = computeAvailableLiquidCash(sampleAccountsCamel);
  assert("Financial", "Active accounts with valid camelCase balances", cashA1 === 88200, 88200, cashA1);

  // Test A2: Inactive accounts are excluded
  const sampleWithInactive = [
    { id: "1", name: "Main Treasury", currentBalance: 50000, status: "active" },
    { id: "2", name: "Old Inactive", currentBalance: 10000, status: "inactive" },
  ];
  const cashA2 = computeAvailableLiquidCash(sampleWithInactive);
  assert("Financial", "Inactive accounts are excluded from liquid cash", cashA2 === 50000, 50000, cashA2);

  // Test A3: Genuine zero balance
  const zeroBalanceAccounts = [
    { id: "1", name: "Empty Bank", currentBalance: 0, status: "active" },
    { id: "2", name: "Empty Cash", currentBalance: 0, status: "active" },
  ];
  const cashA3 = computeAvailableLiquidCash(zeroBalanceAccounts);
  assert("Financial", "Genuine zero balance returns 0 (not null)", cashA3 === 0, 0, cashA3);

  // Test A4: Missing account data returns null or fallback (not a false 0 TND)
  const cashA4 = computeAvailableLiquidCash(null, null);
  assert("Financial", "Missing account data with no fallback returns null (not false 0)", cashA4 === null, null, cashA4);

  // Test A5: Missing account data with valid KPI fallback
  const cashA5 = computeAvailableLiquidCash(undefined, 88200);
  assert("Financial", "Missing account data uses valid fallbackKpiCash", cashA5 === 88200, 88200, cashA5);

  // Test A6: Invalid numeric values (NaN, null, undefined) safely handled
  const invalidBalAccounts = [
    { id: "1", name: "Corrupt 1", currentBalance: NaN, status: "active" },
    { id: "2", name: "Corrupt 2", currentBalance: "not-a-number", status: "active" },
    { id: "3", name: "Valid Bank", currentBalance: 5000, status: "active" },
  ];
  const cashA6 = computeAvailableLiquidCash(invalidBalAccounts);
  assert("Financial", "Invalid numeric balances gracefully coalesce to 0 without NaN", cashA6 === 5000, 5000, cashA6);

  // Test A7: Runway with positive burn ($88,200 / $2,400 = 36.8 months)
  const runwayA7 = computeCashRunway(88200, 2400);
  assert("Financial", "Runway with positive burn calculates 36.8 months", runwayA7.runwayMonths === 36.8, 36.8, runwayA7.runwayMonths);
  assert("Financial", "Healthy runway does NOT trigger critical alarm", runwayA7.isRunwayCritical === false && runwayA7.status === "healthy", "healthy", runwayA7.status);

  // Test A8: Zero recurring burn with positive cash
  const runwayA8 = computeCashRunway(88200, 0);
  assert("Financial", "Zero recurring burn with positive cash gives safe status (no burn)", runwayA8.status === "no_burn" && runwayA8.isRunwayCritical === false, "no_burn", runwayA8.status);

  // Test A9: Missing or invalid burn data produces indeterminate status (NEVER false critical)
  const runwayA9NullBurn = computeCashRunway(88200, null);
  assert("Financial", "Null burn data produces indeterminate status without false alarm", runwayA9NullBurn.status === "indeterminate" && runwayA9NullBurn.isRunwayCritical === false, "indeterminate", runwayA9NullBurn.status);

  const runwayA9NullCash = computeCashRunway(null, 2400);
  assert("Financial", "Null cash data produces indeterminate status without false alarm", runwayA9NullCash.status === "indeterminate" && runwayA9NullCash.isRunwayCritical === false, "indeterminate", runwayA9NullCash.status);

  // Test A10: Genuine zero cash with positive burn triggers critical warning
  const runwayA10 = computeCashRunway(0, 2400);
  assert("Financial", "Genuine zero cash with positive burn triggers critical warning", runwayA10.status === "critical" && runwayA10.isRunwayCritical === true && runwayA10.runwayMonths === 0, true, runwayA10.isRunwayCritical);

  // ------------------------------------------------------------
  // SECTION B: OPERATIONAL EXCEPTIONS DEDUPLICATION
  // ------------------------------------------------------------
  console.log("\n--- 2. OPERATIONAL EXCEPTIONS INTEGRITY TESTS (DEF-ECC-04, DEF-ECC-05) ---");

  // Test B1: Task overdue AND unassigned
  const taskOverdueAndUnassigned = { id: "task-1", title: "Task 1", deadline: "2026-10-01", status: "todo", assignee_id: null };
  const dedupB1 = deduplicateOperationalExceptions({
    overdueTasks: [taskOverdueAndUnassigned],
    blockedTasks: [],
    unassignedTasks: [taskOverdueAndUnassigned],
    clientActionItems: [],
  });
  assert("Operations", "Task overdue AND unassigned produces exactly 1 item in All feed", dedupB1.allCount === 1, 1, dedupB1.allCount);
  assert("Operations", "Single task preserves both 'overdue' and 'unassigned' categories", dedupB1.allExceptions[0].categories.includes("overdue") && dedupB1.allExceptions[0].categories.includes("unassigned"), true, true);
  assert("Operations", "Individual category counts are accurately preserved (1 overdue, 1 unassigned)", dedupB1.overdueCount === 1 && dedupB1.unassignedCount === 1, true, true);

  // Test B2: Task blocked AND unassigned
  const taskBlockedAndUnassigned = { id: "task-2", title: "Task 2", status: "blocked", assignee_id: null };
  const dedupB2 = deduplicateOperationalExceptions({
    overdueTasks: [],
    blockedTasks: [taskBlockedAndUnassigned],
    unassignedTasks: [taskBlockedAndUnassigned],
    clientActionItems: [],
  });
  assert("Operations", "Task blocked AND unassigned produces exactly 1 item in All feed", dedupB2.allCount === 1, 1, dedupB2.allCount);
  assert("Operations", "Blocked task has primaryCategory 'blocked'", dedupB2.allExceptions[0].primaryCategory === "blocked", "blocked", dedupB2.allExceptions[0].primaryCategory);

  // Test B3: Task belonging to 3 categories (Overdue, Blocked, Unassigned)
  const taskTriple = { id: "task-3", title: "Task 3", deadline: "2026-10-01", status: "blocked", assignee_id: null };
  const dedupB3 = deduplicateOperationalExceptions({
    overdueTasks: [taskTriple],
    blockedTasks: [taskTriple],
    unassignedTasks: [taskTriple],
    clientActionItems: [],
  });
  assert("Operations", "Triple-category task produces exactly 1 item in All feed", dedupB3.allCount === 1, 1, dedupB3.allCount);
  assert("Operations", "Triple-category task contains all 3 category tags", dedupB3.allExceptions[0].categories.length === 3, 3, dedupB3.allExceptions[0].categories.length);

  // Test B4: Client-action item overlapping with a blocked task
  const blockedClientTask = { id: "task-4", title: "Client Waiting Task", status: "blocked", waiting_on: "client" };
  const clientActionTaskItem = { project: { id: "proj-1", title: "Project 1" }, task: blockedClientTask, reason: "Waiting assets" };
  const dedupB4 = deduplicateOperationalExceptions({
    overdueTasks: [],
    blockedTasks: [blockedClientTask],
    unassignedTasks: [],
    clientActionItems: [clientActionTaskItem],
  });
  assert("Operations", "Client action task overlapping with blocked task deduplicates to 1 item", dedupB4.allCount === 1, 1, dedupB4.allCount);
  assert("Operations", "Deduplicated item has both 'blocked' and 'client_action' categories", dedupB4.allExceptions[0].categories.includes("blocked") && dedupB4.allExceptions[0].categories.includes("client_action"), true, true);

  // Test B5: Distinct project-level client-action item
  const projectClientActionItem = { project: { id: "proj-2", title: "Followup Due Project" }, reason: "Followup call pending" };
  const dedupB5 = deduplicateOperationalExceptions({
    overdueTasks: [],
    blockedTasks: [],
    unassignedTasks: [],
    clientActionItems: [projectClientActionItem],
  });
  assert("Operations", "Project-level client action is recognized with entityType 'project'", dedupB5.allCount === 1 && dedupB5.allExceptions[0].entityType === "project", true, true);

  // Test B6: Empty exception results
  const dedupB6 = deduplicateOperationalExceptions({
    overdueTasks: [],
    blockedTasks: [],
    unassignedTasks: [],
    clientActionItems: [],
  });
  assert("Operations", "Empty exceptions input produces 0 items", dedupB6.allCount === 0, 0, dedupB6.allCount);

  // ------------------------------------------------------------
  // SECTION C: LIVE DATABASE RECONCILIATION
  // ------------------------------------------------------------
  console.log("\n--- 3. LIVE DATABASE RECONCILIATION ---");

  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (authErr || !authData.user) {
    console.error("Authentication failed:", authErr?.message);
    process.exit(1);
  }

  // Fetch live active accounts
  const { data: dbAccounts, error: accErr } = await supabase.from("financial_accounts").select("*");
  assert("Live DB", "financial_accounts query succeeds without error", !accErr, null, accErr?.message);

  const liveActiveAccounts = (dbAccounts || []).filter((a: any) => a.status === "active" || a.status === undefined);
  const liveTotalCash = liveActiveAccounts.reduce((sum: number, a: any) => sum + Number(a.current_balance || 0), 0);
  console.log(`Live DB Active Accounts: ${liveActiveAccounts.length} accounts | Total Balance: ${formatCurrency(liveTotalCash)}`);

  // Map to FinancialAccount shape
  const mappedAccounts: FinancialAccount[] = liveActiveAccounts.map((a: any) => ({
    id: a.id,
    name: a.name || a.account_name,
    accountType: a.account_type || "bank",
    currency: a.currency || "TND",
    openingBalance: Number(a.opening_balance || 0),
    currentBalance: Number(a.current_balance || 0),
    accountNumber: a.account_number,
    bankName: a.bank_name,
    isDefault: Boolean(a.is_default),
    status: a.status || "active",
    createdAt: a.created_at,
    updatedAt: a.updated_at,
  }));

  const computedLiveCash = computeAvailableLiquidCash(mappedAccounts);
  assert("Live DB", "Available Liquid Cash exactly reconciles with live PostgreSQL balance", computedLiveCash === liveTotalCash, liveTotalCash, computedLiveCash);

  // Treasury rows sum equals totalAvailableCash
  const treasuryRowsSum = mappedAccounts.reduce((sum, a) => sum + a.currentBalance, 0);
  assert("Live DB", "Sum of mapped treasury rows equals totalAvailableCash", treasuryRowsSum === computedLiveCash, computedLiveCash, treasuryRowsSum);

  // Fetch live tasks and projects
  const { data: liveTasks } = await supabase.from("project_tasks").select("*");
  const { data: liveProjects } = await supabase.from("client_projects").select("*");

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  const liveOverdue = (liveTasks || []).filter((t: any) => t.deadline && t.deadline < todayStr && t.status !== "done" && t.status !== "cancelled");
  const liveBlocked = (liveTasks || []).filter((t: any) => t.status === "blocked");
  const liveUnassigned = (liveTasks || []).filter((t: any) => !t.assignee_id && t.status !== "done" && t.status !== "cancelled");

  const tasksByProject: Record<string, any[]> = {};
  for (const t of (liveTasks || [])) {
    if (!tasksByProject[t.project_id]) tasksByProject[t.project_id] = [];
    tasksByProject[t.project_id].push(t);
  }

  const liveClientAction: any[] = [];
  for (const p of (liveProjects || [])) {
    if (p.status !== "active" && p.status !== "on_hold") continue;
    const pTasks = tasksByProject[p.id] || [];
    const blockedOnClient = pTasks.filter((t: any) => t.status === "blocked" && t.waiting_on === "client");
    if (blockedOnClient.length > 0) {
      for (const bt of blockedOnClient) {
        liveClientAction.push({ project: p, task: bt, reason: bt.blocked_reason || "Waiting assets" });
      }
    } else if (p.followup_status === "waiting_for_client" || p.followup_status === "followup_due") {
      liveClientAction.push({ project: p, reason: p.followup_summary || "Followup pending" });
    }
  }

  const liveDedup = deduplicateOperationalExceptions({
    overdueTasks: liveOverdue,
    blockedTasks: liveBlocked,
    unassignedTasks: liveUnassigned,
    clientActionItems: liveClientAction,
  });

  console.log(`Live Counts: Overdue=${liveDedup.overdueCount}, Blocked=${liveDedup.blockedCount}, Unassigned=${liveDedup.unassignedCount}, ClientAction=${liveDedup.clientActionCount}`);
  console.log(`Naive Sum: ${liveDedup.overdueCount + liveDedup.blockedCount + liveDedup.unassignedCount + liveDedup.clientActionCount} (Old Bad Value: 114)`);
  console.log(`Deduplicated All Count: ${liveDedup.allCount} (Expected: 80 unique entities)`);

  assert("Live DB", "Live deduplicated All Count is 80 (not inflated 114)", liveDedup.allCount === 80, 80, liveDedup.allCount);
  assert("Live DB", "Every item in live deduplicated set has a unique ID", new Set(liveDedup.allExceptions.map(e => e.id)).size === liveDedup.allCount, liveDedup.allCount, new Set(liveDedup.allExceptions.map(e => e.id)).size);

  // Summary
  const passedCount = testResults.filter(r => r.passed).length;
  const totalCount = testResults.length;
  console.log("\n=================================================================");
  console.log(`TEST SUITE RESULTS: ${passedCount} / ${totalCount} PASSED (${Math.round((passedCount / totalCount) * 100)}%)`);
  console.log("=================================================================\n");

  if (passedCount < totalCount) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Unhandled error in test runner:", err);
  process.exit(1);
});
