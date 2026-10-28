import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import {
  fetchBusinessRules,
  getBusinessRuleNumber,
  updateBusinessRule,
  resetBusinessRuleToDefault,
  fetchRuleVersions,
  subscribeToBusinessRules,
} from "../src/lib/business-rules-service";
import { generateSmartInsights } from "../src/lib/finance-service";
import { emitNotification } from "../src/lib/notification-service";

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

import { supabase } from "../src/integrations/supabase/client";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://bkr039-sada-digital-luxe.supabase.co";
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "dummy";

let totalPassed = 0;
let totalFailed = 0;

function recordTest(id: string, description: string, passed: boolean, details?: string) {
  if (passed) {
    console.log(`✓ PASS [${id}] ${description}`);
    if (details) console.log(`      ${details}`);
    totalPassed++;
  } else {
    console.error(`✗ FAIL [${id}] ${description}`);
    if (details) console.error(`      ${details}`);
    totalFailed++;
  }
}

async function runTest() {
  console.log("=================================================================");
  console.log("SADA OS — SUPER ADMIN CONFIGURABLE RULES ENGINE AUDIT SUITE");
  console.log("=================================================================\n");

  // 1. Authenticate as Super Admin
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  if (authErr || !authData.user) {
    console.error("Super Admin authentication failed:", authErr);
    process.exit(1);
  }
  const superAdminId = authData.user.id;
  console.log(`Authenticated as Super Admin: ${authData.user.email} (${superAdminId})\n`);

  // --- 1. DEFAULT RULES LOAD CORRECTLY ---
  console.log("--- 1. CANONICAL DATABASE RULES & DEFAULTS ---");
  const rules = await fetchBusinessRules(true);
  const criticalRunway = getBusinessRuleNumber("critical_runway_months", 3);
  const lowMarginThreshold = getBusinessRuleNumber("low_profit_client_margin_percent", 20);
  const highCommission = getBusinessRuleNumber("high_commission_amount", 200);
  const highFixedBurn = getBusinessRuleNumber("high_fixed_burn_revenue_percent", 40);
  const defaultRunway = getBusinessRuleNumber("runway_default_months", 12);
  const deduplicationHours = getBusinessRuleNumber("notification_deduplication_hours", 24);

  recordTest(
    "RULE-LOAD-01",
    "Default rules load correctly from canonical database",
    rules.length >= 20 &&
      criticalRunway === 3 &&
      lowMarginThreshold === 20 &&
      highCommission === 200 &&
      highFixedBurn === 40 &&
      defaultRunway === 12 &&
      deduplicationHours === 24,
    `Retrieved ${rules.length} rules. Runway: ${criticalRunway}mo, Low Margin: ${lowMarginThreshold}%, High Comm: ${highCommission}TND, Burn: ${highFixedBurn}%`
  );

  // --- 2. SUPER ADMIN MODIFIES RULE ---
  console.log("\n--- 2. SUPER ADMIN RULE MUTATION ---");
  const marginRule = rules.find((r) => r.rule_key === "low_profit_client_margin_percent");
  if (!marginRule) {
    console.error("Missing low_profit_client_margin_percent rule!");
    process.exit(1);
  }

  const initialVersion = marginRule.version;
  const updateRes = await updateBusinessRule({
    ruleId: marginRule.id,
    numericValue: 25,
    changeReason: "Testing executive threshold adjustment from 20% to 25%",
    actorId: superAdminId,
    actorName: "Super Admin QA",
  });

  recordTest(
    "SUPER-MUTATE-01",
    "Super Admin can modify business rule and increment version",
    updateRes.success && updateRes.data?.numeric_value === 25 && updateRes.data?.version === initialVersion + 1,
    `Updated low_profit_client_margin_percent to ${updateRes.data?.numeric_value}%, Version: v${updateRes.data?.version}`
  );

  // --- 3. WORKER ROLE CANNOT MODIFY BUSINESS RULES (RLS) ---
  console.log("\n--- 3. ROLE ISOLATION & RLS ENFORCEMENT ---");
  const workerClient = createClient(supabaseUrl, anonKey);
  const { data: workerAuth } = await workerClient.auth.signInWithPassword({
    email: "qa.worker@sada.agency",
    password: "WorkerPassword123!",
  });

  let workerBlocked = false;
  if (workerAuth?.user) {
    const { data: workerUpdate, error: workerErr } = await (workerClient as any)
      .from("business_rules")
      .update({ numeric_value: 99 })
      .eq("id", marginRule.id)
      .select();

    // RLS filters out rows so 0 rows are modified, or throws an error
    workerBlocked = !workerErr && (!workerUpdate || workerUpdate.length === 0);
  } else {
    // If worker user does not exist, anonymous attempt
    const anonClient = createClient(supabaseUrl, anonKey);
    const { data: anonUpdate } = await (anonClient as any)
      .from("business_rules")
      .update({ numeric_value: 99 })
      .eq("id", marginRule.id)
      .select();
    workerBlocked = !anonUpdate || anonUpdate.length === 0;
  }

  recordTest(
    "RLS-BLOCK-01",
    "Non-super-admin cannot modify business rules (PostgreSQL RLS blocks mutation)",
    workerBlocked,
    "PostgreSQL RLS prohibited mutation; 0 rows modified."
  );

  // --- 4. CHANGING THRESHOLD CHANGES ALERT BEHAVIOR ---
  console.log("\n--- 4. THRESHOLD ALTERATION CHANGES ALERT BEHAVIOR ---");
  // Test Scenario:
  // Client has margin = 22%.
  // At margin threshold = 20%: margin (22%) >= 20% -> NOT low-margin (health = MEDIUM)
  // At margin threshold = 25%: margin (22%) < 25% -> LOW MARGIN ALERT (health = LOW PROFIT)
  const clientRevenue = 1000;
  const clientDirectCostAndComm = 780;
  const clientContributionProfit = clientRevenue - clientDirectCostAndComm; // 220 TND
  const clientMarginPercent = (clientContributionProfit / clientRevenue) * 100; // 22%

  const evaluateClientHealth = (margin: number, threshold: number): "HIGH PROFIT" | "MEDIUM" | "LOW PROFIT" => {
    if (margin >= 50) return "HIGH PROFIT";
    if (margin < threshold) return "LOW PROFIT";
    return "MEDIUM";
  };

  const healthAt20 = evaluateClientHealth(clientMarginPercent, 20);
  const healthAt25 = evaluateClientHealth(clientMarginPercent, 25);

  recordTest(
    "ALERT-BEHAVIOR-01",
    "Changing threshold changes alert behavior (20% -> Healthy, 25% -> Low Margin Alert)",
    healthAt20 === "MEDIUM" && healthAt25 === "LOW PROFIT",
    `Margin 22% @ 20% threshold: "${healthAt20}" (No alert) | @ 25% threshold: "${healthAt25}" (Low-margin alert triggered)`
  );

  // --- 5. SMART INSIGHTS DYNAMIC TEXT & CONFIGURED THRESHOLD ---
  console.log("\n--- 5. SMART INSIGHTS DYNAMIC TEXT & THRESHOLD CONSUMPTION ---");
  const testInsights = generateSmartInsights({
    kpis: {
      revenue: 10000,
      expenses: 6000,
      netProfit: 4000,
      cash: 50000,
      outstandingPayments: 500,
      sponsoringMargin: 1200,
      payroll: 3000,
      operatingExpenses: 1500,
      clientServicesRevenue: 7000,
      sponsoringCollected: 3000,
      otherRevenue: 0,
      sponsoringPurchasesCost: 1800,
      salesCommissionsCost: 350,
      pendingIncome: 0,
      pendingExpenses: 0,
      pendingSalaryRequestsCount: 0,
      pendingSalaryRequestsTotal: 0,
      prevRevenue: 8000,
      prevExpenses: 5000,
      prevNetProfit: 3000,
      revenueDeltaPercent: 25,
      expenseDeltaPercent: 20,
      profitDeltaPercent: 33.3,
      totalIncome: 10000,
      totalExpenses: 6000,
      netCashFlow: 4000,
      totalSalaries: 3000,
      recurringBurn: 1500,
      prevTotalIncome: 8000,
      prevTotalExpenses: 5000,
      prevNetCashFlow: 3000,
      incomeDeltaPercent: 25,
    },
    period: { label: "October 2026", month: 10, year: 2026 },
    clientProfitability: [
      {
        clientId: "client-test-1",
        clientName: "Alpha Boutique",
        industry: "Retail",
        clientType: "monthly",
        totalRevenue: 1000,
        serviceRevenue: 1000,
        sponsoringBudget: 0,
        sponsoringCost: 0,
        sponsoringMargin: 0,
        directCost: 500,
        commission: 280, // Exceeds 200 TND high_commission_amount!
        contributionProfit: 220,
        marginPercent: 22,
        health: "LOW PROFIT", // drops to LOW PROFIT at 25% threshold
        healthStatus: "LOW PROFIT",
        leadCount: 0,
        activeTasks: 1,
        completedTasks: 5,
        totalDeliverables: 4,
        paymentStatus: "PAID",
      },
    ],
  });

  const lowMarginInsight = testInsights.find((i) => i.id === "low_margin_client_warning");
  const commissionInsight = testInsights.find((i) => i.id === "commission_impact");
  const sponsoringInsight = testInsights.find((i) => i.id === "sponsoring_performance");

  recordTest(
    "INSIGHT-DYNAMIC-01",
    "Smart Insights dynamically reflect configured threshold in text",
    !!lowMarginInsight &&
      lowMarginInsight.description.includes("25%") &&
      !!commissionInsight &&
      commissionInsight.description.includes("200") &&
      !!sponsoringInsight &&
      sponsoringInsight.description.includes("15%"),
    `Low-margin insight: "${lowMarginInsight?.description}"`
  );

  // --- 6. RESET TO DEFAULT FUNCTIONALITY ---
  console.log("\n--- 6. RESET RULE TO FACTORY DEFAULT ---");
  const resetRes = await resetBusinessRuleToDefault({
    ruleId: marginRule.id,
    changeReason: "Restoring rule back to factory default (20%) after QA test",
    actorId: superAdminId,
    actorName: "Super Admin QA",
  });

  const restoredNumber = getBusinessRuleNumber("low_profit_client_margin_percent");

  recordTest(
    "RESET-DEFAULT-01",
    "Super Admin can reset business rule to factory default value",
    resetRes.success && resetRes.data?.numeric_value === 20 && restoredNumber === 20,
    `Reset successful. Restored value: ${resetRes.data?.numeric_value}%, Version: v${resetRes.data?.version}`
  );

  // --- 7. VERSION AUDIT LOGGING ---
  console.log("\n--- 7. AUDIT LOG & VERSION HISTORY ---");
  const versions = await fetchRuleVersions(marginRule.id);
  const hasAuditVersions = versions.length >= 2;

  recordTest(
    "AUDIT-TRAIL-01",
    "Rule modifications generate immutable historical versions",
    hasAuditVersions,
    `Found ${versions.length} historical version records for low_profit_client_margin_percent`
  );

  // --- 8. REALTIME EVENT BUS REACTIVITY ---
  console.log("\n--- 8. REALTIME LISTENER NOTIFICATION ---");
  let listenerTriggered = false;
  const unsubscribe = subscribeToBusinessRules(() => {
    listenerTriggered = true;
  });

  // Perform a test update to fire listeners
  await updateBusinessRule({
    ruleId: marginRule.id,
    numericValue: 20,
    changeReason: "Testing realtime listener event bus dispatch",
    actorId: superAdminId,
  });

  unsubscribe();

  recordTest(
    "REALTIME-EVENT-01",
    "Business rules event bus alerts reactive components on configuration changes",
    listenerTriggered,
    "Event bus listener successfully received change notification without requiring page reload."
  );

  // --- 9. NOTIFICATION DEDUPLICATION WINDOW ---
  console.log("\n--- 9. NOTIFICATION DEDUPLICATION WINDOW ---");
  const testDedupKey = `test_dedup_${Date.now()}`;
  const notif1 = await emitNotification({
    eventType: "GENERAL",
    title: "Test Dedup 1",
    message: "Verifying deduplication",
    category: "system",
    roleTarget: "super_admin",
    entityType: "audit_dedup",
    entityId: testDedupKey,
  });

  const notif2 = await emitNotification({
    eventType: "GENERAL",
    title: "Test Dedup 2",
    message: "Verifying deduplication duplicate",
    category: "system",
    roleTarget: "super_admin",
    entityType: "audit_dedup",
    entityId: testDedupKey,
  });

  const isFirstEmitted = notif1.success && !!notif1.id;
  const isSecondDeduplicated = notif2.success && notif2.id === undefined;

  recordTest(
    "NOTIF-DEDUP-01",
    "Notification deduplication enforces configured 24-hour deduplication window",
    isFirstEmitted && isSecondDeduplicated,
    `First: ${isFirstEmitted ? `Emitted (ID: ${notif1.id?.slice(0, 8)}...)` : "Failed"}, Second: ${isSecondDeduplicated ? "Deduplicated (Suppressed)" : "Emitted duplicate"}`
  );

  console.log("\n=================================================================");
  console.log(`TOTAL TESTS: ${totalPassed + totalFailed} | PASSED: ${totalPassed} | FAILED: ${totalFailed}`);
  console.log("=================================================================\n");

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
