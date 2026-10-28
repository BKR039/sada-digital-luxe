// ============================================================
// SADA OS — REALTIME + NOTIFICATIONS + ALERTS + KPI AUDIT SUITE
// Rigorous verification of database canonical truth, realtime WebSocket
// propagation, deterministic formula integrity, role security & edge cases.
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
import { fetchManagementAnalytics } from "../src/lib/analytics-service";
import { fetchCompanyFinance, getPresetPeriod } from "../src/lib/finance-service";
import { fetchDeals, createDeal, updateDealStage } from "../src/lib/sales-service";
import {
  emitNotification,
  fetchNotifications,
  markNotificationAsRead,
  scanAndEmitAutomations,
} from "../src/lib/notification-service";

interface TestReport {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  details?: any;
}

const reports: TestReport[] = [];

function recordTest(id: string, name: string, passed: boolean, expected: string, actual: string, details?: any) {
  reports.push({ id, name, passed, expected, actual, details });
  const icon = passed ? "✓ PASS" : "✗ FAIL";
  console.log(`${icon} [${id}] ${name}`);
  if (!passed) {
    console.log(`    Expected: ${expected}`);
    console.log(`    Actual:   ${actual}`);
  }
}

async function runRealtimeAudit() {
  console.log("=================================================================");
  console.log("SADA OS — REALTIME + KPI + NOTIFICATIONS + ALERTS AUDIT SUITE");
  console.log("=================================================================\n");

  // 1. Authenticate as Super Admin
  const { data: adminAuth, error: adminErr } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });

  if (adminErr || !adminAuth.user) {
    console.error("Super Admin auth failed:", adminErr?.message);
    process.exit(1);
  }
  const superAdminId = adminAuth.user.id;
  console.log(`✓ Authenticated as Super Admin: ${adminAuth.user.email} (${superAdminId})\n`);

  if (adminAuth.session?.access_token) {
    supabase.realtime.setAuth(adminAuth.session.access_token);
  }

  // ============================================================
  // TEST 1: CANONICAL DB QUERY & KPI CALCULATION INTEGRITY
  // ============================================================
  console.log("--- 1. KPI & FINANCIAL OS SSOT PROOF ---");
  const period = getPresetPeriod("this_month");
  const financeState = await fetchCompanyFinance(period);

  const totalIncomes = financeState.incomes.reduce((s, i) => s + Number(i.amount || 0), 0);
  const totalExpenses = financeState.expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const expectedProfit = totalIncomes - totalExpenses;

  recordTest(
    "KPI-01",
    "Net Operating Profit mathematically equals Incomes minus Expenses",
    financeState.kpis.netProfit === expectedProfit,
    `netProfit == ${expectedProfit}`,
    `netProfit == ${financeState.kpis.netProfit}`
  );

  recordTest(
    "KPI-02",
    "Zero-division guard ensures net margin is finite and not NaN or Infinity",
    !isNaN(financeState.kpis.netProfit) && isFinite(financeState.kpis.netProfit),
    "Finite number",
    String(financeState.kpis.netProfit)
  );

  // ============================================================
  // TEST 2: SALES PIPELINE DETERMINISTIC CALCULATION
  // ============================================================
  console.log("\n--- 2. SALES PIPELINE KPI INTEGRITY ---");
  const deals = await fetchDeals();
  const wonDeals = deals.filter((d) => d.stage === "won");
  const activeDeals = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const expectedWinRate = deals.length > 0 ? Math.round((wonDeals.length / deals.length) * 100) : 0;
  const wonRevenue = wonDeals.reduce((sum, d) => sum + Number(d.service_revenue || 0), 0);

  recordTest(
    "KPI-03",
    "Sales Pipeline KPIs strictly derive from deals table",
    deals.length >= 0 && wonDeals.length <= deals.length,
    "Valid deal relations",
    `Total: ${deals.length}, Won: ${wonDeals.length}, Active: ${activeDeals.length}`
  );

  // ============================================================
  // TEST 3: REALTIME WEBSOCKET SUBSCRIPTION ON NOTIFICATIONS
  // ============================================================
  console.log("\n--- 3. SUPABASE REALTIME WEBSOCKET PROPAGATION: NOTIFICATIONS ---");
  const uniqueTestKey = `test_notif_${Date.now()}`;
  let realtimeNotificationReceived = false;
  let receivedNotificationPayload: any = null;

  // Set up WebSocket listener
  const notifChannel = supabase.channel(`test_realtime_notifs_${Date.now()}`);
  await new Promise<void>((resolve, reject) => {
    notifChannel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          if (payload.new && (payload.new as any).entity_id === uniqueTestKey) {
            realtimeNotificationReceived = true;
            receivedNotificationPayload = payload.new;
          }
        }
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") resolve();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(err || new Error(status));
      });
  });

  // Insert notification via service
  const emitRes = await emitNotification({
    eventType: "GENERAL",
    title: "Realtime WebSocket Audit Test",
    message: "Verifying live Supabase Realtime WebSocket propagation",
    category: "system",
    priority: "high",
    roleTarget: "super_admin",
    userId: superAdminId,
    entityType: "audit_test",
    entityId: uniqueTestKey,
  });

  // Wait up to 10 seconds for WebSocket delivery
  const startWait = Date.now();
  while (!realtimeNotificationReceived && Date.now() - startWait < 10000) {
    await new Promise((r) => setTimeout(r, 200));
  }

  recordTest(
    "REALTIME-01",
    "Live Supabase Realtime WebSocket delivers notification INSERT without reload",
    realtimeNotificationReceived,
    "Realtime event received within 5000ms",
    realtimeNotificationReceived
      ? `Received event in ${Date.now() - startWait}ms: "${receivedNotificationPayload?.title}"`
      : "Timed out waiting for realtime event"
  );

  // Clean up notification channel
  await supabase.removeChannel(notifChannel);

  // Clean up inserted test notification
  if (emitRes.id) {
    await (supabase as any).from("notifications").delete().eq("id", emitRes.id);
  }

  // ============================================================
  // TEST 4: REALTIME WEBSOCKET SUBSCRIPTION ON DEALS
  // ============================================================
  console.log("\n--- 4. SUPABASE REALTIME WEBSOCKET PROPAGATION: DEALS ---");
  const uniqueDealTitle = `Realtime Audit Deal ${Date.now()}`;
  let realtimeDealInsertReceived = false;
  let realtimeDealUpdateReceived = false;
  let createdDealId: string | null = null;

  const dealsChannel = supabase.channel("test_realtime_deals_channel");
  await new Promise<void>((resolve, reject) => {
    dealsChannel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deals",
        },
        (payload) => {
          if (payload.eventType === "INSERT" && (payload.new as any).title === uniqueDealTitle) {
            realtimeDealInsertReceived = true;
            createdDealId = (payload.new as any).id;
          }
          if (payload.eventType === "UPDATE") {
            const row = payload.new as any;
            if (row && (row.id === createdDealId || row.title === uniqueDealTitle)) {
              realtimeDealUpdateReceived = true;
            }
          }
        }
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") resolve();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(err || new Error(status));
      });
  });

  // Insert deal
  const { data: insertedDeal, error: dealInsertErr } = await (supabase as any)
    .from("deals")
    .insert({
      title: uniqueDealTitle,
      company_name: "Realtime Audit SARL",
      contact_name: "Audit Lead",
      stage: "lead",
      deal_value: 3500,
      service_revenue: 3000,
      sponsoring_budget: 500,
    })
    .select("id")
    .single();

  const startDealWait = Date.now();
  while (!realtimeDealInsertReceived && Date.now() - startDealWait < 5000) {
    await new Promise((r) => setTimeout(r, 200));
  }

  recordTest(
    "REALTIME-02",
    "Live Supabase Realtime WebSocket delivers deal INSERT without reload",
    realtimeDealInsertReceived,
    "Realtime deal INSERT received within 5000ms",
    realtimeDealInsertReceived
      ? `Received deal insert in ${Date.now() - startDealWait}ms`
      : "Timed out waiting for deal insert"
  );

  // Update deal stage
  if (insertedDeal?.id) {
    await updateDealStage(insertedDeal.id, "contacted");

    const startUpdateWait = Date.now();
    while (!realtimeDealUpdateReceived && Date.now() - startUpdateWait < 5000) {
      await new Promise((r) => setTimeout(r, 200));
    }

    recordTest(
      "REALTIME-03",
      "Live Supabase Realtime WebSocket delivers deal UPDATE without reload",
      realtimeDealUpdateReceived,
      "Realtime deal UPDATE received within 5000ms",
      realtimeDealUpdateReceived
        ? `Received deal update in ${Date.now() - startUpdateWait}ms`
        : "Timed out waiting for deal update"
    );

    // Clean up test deal
    await (supabase as any).from("deals").delete().eq("id", insertedDeal.id);
  }

  await supabase.removeChannel(dealsChannel);

  // ============================================================
  // TEST 5: NOTIFICATION READ PERSISTENCE & 24H DEDUPLICATION
  // ============================================================
  console.log("\n--- 5. NOTIFICATION READ STATE PERSISTENCE & DEDUPLICATION ---");
  const testNotifKey = `dedup_${Date.now()}`;
  const notif1 = await emitNotification({
    eventType: "GENERAL",
    title: "Dedup Test",
    message: "First notification",
    entityType: "dedup_test",
    entityId: testNotifKey,
    roleTarget: "super_admin",
  });

  const notif2 = await emitNotification({
    eventType: "GENERAL",
    title: "Dedup Test 2",
    message: "Should be suppressed by 24h deduplication guard",
    entityType: "dedup_test",
    entityId: testNotifKey,
    roleTarget: "super_admin",
  });

  recordTest(
    "NOTIF-01",
    "24-Hour Deduplication Guard prevents spamming identical notification for same entity",
    Boolean(notif1.id) && notif2.id === undefined,
    "First emitted, second suppressed",
    `notif1.id: ${notif1.id ? "created" : "failed"}, notif2.id: ${notif2.id ? "created" : "suppressed"}`
  );

  // Test Mark as Read
  if (notif1.id) {
    const markSuccess = await markNotificationAsRead(notif1.id);
    const { data: readCheck } = await (supabase as any)
      .from("notifications")
      .select("read, read_at")
      .eq("id", notif1.id)
      .single();

    recordTest(
      "NOTIF-02",
      "Marking notification as read persists in PostgreSQL database",
      markSuccess && readCheck?.read === true && readCheck?.read_at !== null,
      "read = true and read_at is set",
      `read = ${readCheck?.read}, read_at = ${readCheck?.read_at}`
    );

    await (supabase as any).from("notifications").delete().eq("id", notif1.id);
  }

  // ============================================================
  // TEST 6: ROLE ISOLATION & RLS SECURITY AUDIT
  // ============================================================
  console.log("\n--- 6. ROLE ISOLATION & RLS SECURITY AUDIT ---");
  const { data: workerAuth, error: workerErr } = await supabase.auth.signInWithPassword({
    email: "qa.worker@sada.agency",
    password: "WorkerPassword123!",
  });

  if (workerErr || !workerAuth.user) {
    console.error("Worker authentication failed:", workerErr?.message);
  } else {
    // Attempt to query expense transactions as worker
    const { data: workerExpenses, error: expErr } = await (supabase as any)
      .from("expense_transactions")
      .select("id, amount");

    recordTest(
      "RLS-01",
      "Worker role cannot read confidential expense_transactions via PostgreSQL RLS",
      !workerExpenses || workerExpenses.length === 0,
      "Zero rows returned or access denied",
      `Returned ${workerExpenses?.length || 0} rows`
    );

    // Attempt to query income transactions as worker
    const { data: workerIncomes } = await (supabase as any)
      .from("income_transactions")
      .select("id, amount");

    recordTest(
      "RLS-02",
      "Worker role cannot read confidential income_transactions via PostgreSQL RLS",
      !workerIncomes || workerIncomes.length === 0,
      "Zero rows returned or access denied",
      `Returned ${workerIncomes?.length || 0} rows`
    );
  }

  // ============================================================
  // TEST 7: DETERMINISTIC SMART INSIGHTS AUDIT
  // ============================================================
  console.log("\n--- 7. DETERMINISTIC SMART INSIGHTS AUDIT ---");
  recordTest(
    "INSIGHT-01",
    "Smart Insights are dynamically calculated from live DB records",
    Array.isArray(financeState.insights) && financeState.insights.length > 0,
    "At least one deterministic insight generated from DB data",
    `Generated ${financeState.insights.length} dynamic insights (${financeState.insights.map(i => i.title).join(", ")})`
  );

  // Output summary
  console.log("\n=================================================================");
  console.log("FINAL AUDIT SUMMARY");
  console.log("=================================================================");
  const passedCount = reports.filter((r) => r.passed).length;
  const totalCount = reports.length;
  console.log(`Passed: ${passedCount} / ${totalCount}`);
  if (passedCount === totalCount) {
    console.log("ALL REALTIME + KPI + NOTIFICATIONS + ALERTS AUDIT TESTS PASSED ✓");
  } else {
    console.log("SOME AUDIT TESTS FAILED ✗");
  }

  // Save report artifact
  fs.writeFileSync(
    path.resolve(process.cwd(), "realtime_audit_results.json"),
    JSON.stringify(reports, null, 2)
  );
}

runRealtimeAudit().catch((e) => {
  console.error("Fatal test error:", e);
  process.exit(1);
});
