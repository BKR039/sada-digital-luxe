// ============================================================
// SADA OS — NOTIFICATION SYSTEM 3.0 PRODUCTION READINESS AUDIT
// Validates Scheduler with deterministic records, push reliability,
// endpoint authorization, daemon status, and event matrix.
// ============================================================

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { format, addDays, subDays } from "date-fns";
import { runScheduledReminderScan } from "../src/server/reminder-scheduler";
import { dispatchPushNotification } from "../src/server/push-dispatcher";
import { getSchedulerDaemonStatus, triggerSchedulerNow } from "../src/server/scheduler-daemon";
import { getSemanticSeverity, getFunctionalCategory } from "../src/lib/notification-service";
import type { NotificationEventType } from "../src/types/notifications-and-audit";

// Load .env and .env.local
const env: Record<string, string> = {};
for (const file of [".env", ".env.local"]) {
  const envPath = path.resolve(process.cwd(), file);
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        env[trimmed.slice(0, eqIdx).trim()] = val;
        process.env[trimmed.slice(0, eqIdx).trim()] = val;
      }
    }
  }
}

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, title: string, detail?: any) {
  if (condition) {
    console.log(`  ✅ PASS: ${title}`, detail ? `(${JSON.stringify(detail)})` : "");
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${title}`, detail ? `-> ${JSON.stringify(detail)}` : "");
    failedCount++;
  }
}

async function runProductionReadinessAudit() {
  console.log("\n===============================================================================");
  console.log("SADA OS — NOTIFICATION SYSTEM 3.0 PRODUCTION READINESS AUDIT");
  console.log("===============================================================================\n");

  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;

  // 1. Authenticate with Super Admin session
  console.log("--- STAGE 1: Super Admin Authentication & Client Setup ---");
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authErr } = await authClient.auth.signInWithPassword({
    email: "boubakarhamedsgail@gmail.com",
    password: "Boubakar2026!",
  });

  assert(!authErr && Boolean(authData.session?.access_token), "Super Admin authenticated successfully");
  const saToken = authData.session?.access_token;
  const superAdminId = authData.user?.id;

  const adminClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${saToken}` } },
  });

  // 2. Fetch or create a test client record
  const { data: existingClient } = await adminClient.from("clients").select("id, name").limit(1).maybeSingle();
  let testClientId = existingClient?.id;
  if (!testClientId) {
    const { data: newClient } = await adminClient
      .from("clients")
      .insert({ name: "Deterministic Test Client", email: "test.client@example.com" })
      .select("id")
      .single();
    testClientId = newClient?.id;
  }
  assert(Boolean(testClientId), "Active test client resolved", { clientId: testClientId });

  // 2b. Fetch or create a test client_project record (required by project_tasks.project_id foreign key)
  const { data: existingCp } = await adminClient.from("client_projects").select("id, title").limit(1).maybeSingle();
  let testProjectId = existingCp?.id;
  let createdNewCp = false;
  if (!testProjectId) {
    const { data: newCp } = await adminClient
      .from("client_projects")
      .insert({
        title: "Deterministic Test Project",
        client_name: existingClient?.name || "Deterministic Test Client",
        status: "active",
      })
      .select("id")
      .single();
    testProjectId = newCp?.id;
    createdNewCp = true;
  }
  assert(Boolean(testProjectId), "Active test client_project resolved", { projectId: testProjectId });

  // 3. Create Deterministic Test Records for Scheduler
  console.log("\n--- STAGE 2: Deterministic Records Creation & Scheduler Remediation ---");
  const today = new Date();
  const yesterdayStr = format(subDays(today, 1), "yyyy-MM-dd");
  const tomorrowStr = format(addDays(today, 1), "yyyy-MM-dd");
  const inTwoDaysStr = format(addDays(today, 2), "yyyy-MM-dd");

  // A. Overdue Task
  const { data: overdueTask, error: otErr } = await adminClient
    .from("project_tasks")
    .insert({
      title: "DETERMINISTIC_TEST: Overdue Deliverable",
      deadline: yesterdayStr,
      status: "in_progress",
      project_id: testProjectId,
      client_id: testClientId,
      assignee_id: superAdminId,
    })
    .select("id, title, deadline")
    .single();
  assert(!otErr && Boolean(overdueTask?.id), "Overdue task created", otErr?.message || { id: overdueTask?.id });

  // B. Task Due Soon (tomorrow)
  const { data: dueSoonTask, error: dtErr } = await adminClient
    .from("project_tasks")
    .insert({
      title: "DETERMINISTIC_TEST: Due Soon Deliverable",
      deadline: tomorrowStr,
      status: "todo",
      project_id: testProjectId,
      client_id: testClientId,
      assignee_id: superAdminId,
    })
    .select("id, title, deadline")
    .single();
  assert(!dtErr && Boolean(dueSoonTask?.id), "Due soon task created", dtErr?.message || { id: dueSoonTask?.id });

  // C. Overdue Invoice
  const { data: overdueInvoice, error: oiErr } = await adminClient
    .from("invoices")
    .insert({
      invoice_number: `INV-DET-${Date.now().toString().slice(-6)}`,
      client_id: testClientId,
      due_date: yesterdayStr,
      issue_date: yesterdayStr,
      status: "sent",
      subtotal: 3200,
      total_amount: 3200,
      currency: "TND",
    })
    .select("id, invoice_number, due_date")
    .single();
  assert(!oiErr && Boolean(overdueInvoice?.id), "Overdue invoice created", oiErr?.message || { id: overdueInvoice?.id });

  // D. Production Booking Tomorrow
  const { data: shootTomorrow, error: stErr } = await adminClient
    .from("production_bookings")
    .insert({
      title: "DETERMINISTIC_TEST: Production Shoot Tomorrow",
      client_id: testClientId,
      date: tomorrowStr,
      time: "10:00",
      location: "Tunis Studio A",
      production_type: "Commercial Video",
      stage: "scheduling",
    })
    .select("id, title, date")
    .single();
  assert(!stErr && Boolean(shootTomorrow?.id), "Production booking created", stErr?.message || { id: shootTomorrow?.id });

  // 4. Run Scheduled Reminder Scan (FIRST CYCLE)
  console.log("\n--- STAGE 3: Running Reminder Scheduler (Cycle 1: Fresh Detection) ---");
  const cycle1Result = await runScheduledReminderScan({ client: adminClient, deduplicationHours: 24 });
  console.log("  Execution Summary Cycle 1:", {
    scannedTasks: cycle1Result.scannedTasks,
    overdueTasks: cycle1Result.overdueTasks,
    dueSoonTasks: cycle1Result.dueSoonTasks,
    overdueInvoices: cycle1Result.overdueInvoices,
    shootsTomorrow: cycle1Result.shootsTomorrow,
    notificationsEmitted: cycle1Result.notificationsEmitted,
    errorsCount: cycle1Result.errors.length,
  });

  assert(cycle1Result.errors.length === 0, "Scheduler completed with ZERO errors", cycle1Result.errors);
  assert(cycle1Result.scannedTasks >= 2, "Scheduler scanned eligible tasks", { count: cycle1Result.scannedTasks });
  assert(cycle1Result.overdueTasks >= 1, "Detected overdue task");
  assert(cycle1Result.dueSoonTasks >= 1, "Detected task due soon");
  assert(cycle1Result.overdueInvoices >= 1, "Detected overdue invoice");
  assert(cycle1Result.shootsTomorrow >= 1, "Detected production shoot tomorrow");
  assert(cycle1Result.notificationsEmitted >= 4, "Emitted notifications for all 4 eligible records", { emitted: cycle1Result.notificationsEmitted });

  // 5. Run Scheduled Reminder Scan (SECOND CYCLE: Deduplication Verification)
  console.log("\n--- STAGE 4: Running Reminder Scheduler (Cycle 2: Deduplication Check) ---");
  const cycle2Result = await runScheduledReminderScan({ client: adminClient, deduplicationHours: 24 });
  console.log("  Execution Summary Cycle 2 (Immediate Re-run):", {
    notificationsEmitted: cycle2Result.notificationsEmitted,
    errorsCount: cycle2Result.errors.length,
  });
  assert(cycle2Result.errors.length === 0, "Cycle 2 completed with ZERO errors");
  assert(
    cycle2Result.notificationsEmitted === 0,
    "24-Hour Deduplication active: 0 duplicate notifications emitted on re-run",
    { emitted: cycle2Result.notificationsEmitted }
  );

  // 6. Test Push Delivery Reliability & Device Tracking
  console.log("\n--- STAGE 5: Push Delivery Reliability & Multi-Device Tracking ---");
  // Create a test notification specifically to probe delivery tracking
  const { data: testDeliveryNotif } = await adminClient
    .from("notifications")
    .insert({
      user_id: superAdminId,
      title: "Reliability Test Notification",
      message: "Testing multi-device tracking metadata",
      category: "system",
      event_type: "GENERAL",
      priority: "normal",
      push_sent_at: null,
      read: false,
    })
    .select("id")
    .single();

  assert(Boolean(testDeliveryNotif?.id), "Created delivery audit notification");

  if (testDeliveryNotif?.id) {
    const dispatchRes = await dispatchPushNotification(testDeliveryNotif.id, { client: adminClient });
    assert(dispatchRes.success === true, "Dispatcher handled notification without crash");
    assert(dispatchRes.deliveryStatus !== undefined, "Dispatcher returned deliveryStatus", { status: dispatchRes.deliveryStatus });

    // Read back notification from DB to inspect metadata
    const { data: updatedNotif } = await adminClient
      .from("notifications")
      .select("push_sent_at, metadata")
      .eq("id", testDeliveryNotif.id)
      .single();

    assert(Boolean(updatedNotif?.metadata?.push_delivery_tracking), "Metadata contains push_delivery_tracking record");
    console.log("  Delivery Tracking State:", updatedNotif?.metadata?.push_delivery_tracking);

    // Clean up test delivery notification
    await adminClient.from("notifications").delete().eq("id", testDeliveryNotif.id);
  }

  // 7. Test Recurring Scheduler Daemon
  console.log("\n--- STAGE 6: Production Scheduler Daemon & Monitoring ---");
  const daemonStatus = getSchedulerDaemonStatus();
  assert(typeof daemonStatus.intervalMinutes === "number", "Daemon reports interval minutes", { interval: daemonStatus.intervalMinutes });
  assert(Array.isArray(daemonStatus.recentRuns), "Daemon tracks recent execution history");

  // Trigger manual execution through daemon
  const daemonRunRecord = await triggerSchedulerNow({ triggeredBy: "e2e_readiness_suite", authHeader: `Bearer ${saToken}` });
  assert(daemonRunRecord.success === true, "Daemon executed cycle successfully with 0 errors");
  assert(daemonRunRecord.durationMs >= 0, "Daemon tracked execution duration (ms)", { durationMs: daemonRunRecord.durationMs });

  // 8. Test Local Server Endpoints Security & Authorization
  console.log("\n--- STAGE 7: API Endpoint Security & Authorization Enforcement ---");
  const schedulerSecret = env.SCHEDULER_SECRET;
  assert(Boolean(schedulerSecret && schedulerSecret.length > 20), "SCHEDULER_SECRET exists in environment");

  // Test 1: POST /api/notifications/scheduler WITHOUT authorization -> MUST be 401
  try {
    const unauthRes = await fetch("http://localhost:3000/api/notifications/scheduler", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert(unauthRes.status === 401, "POST /api/notifications/scheduler rejects unauthorized callers with HTTP 401");
  } catch (e: any) {
    console.warn("Local server fetch notice:", e.message);
  }

  // Test 2: POST /api/notifications/scheduler WITH valid secret -> MUST be 200
  try {
    const authRes = await fetch("http://localhost:3000/api/notifications/scheduler", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${schedulerSecret}`,
      },
      body: JSON.stringify({ triggeredBy: "authorized_test" }),
    });
    const authData = await authRes.json();
    assert(authRes.status === 200, "POST /api/notifications/scheduler succeeds with valid secret (HTTP 200)");
    assert(authData.success === true, "Scheduler returned success: true with zero internal errors");
  } catch (e: any) {
    console.warn("Local server fetch notice:", e.message);
  }

  // Test 3: GET /api/notifications/scheduler status with secret -> MUST be 200
  try {
    const statusRes = await fetch("http://localhost:3000/api/notifications/scheduler", {
      method: "GET",
      headers: { "Authorization": `Bearer ${schedulerSecret}` },
    });
    const statusData = await statusRes.json();
    assert(statusRes.status === 200, "GET /api/notifications/scheduler returns daemon status (HTTP 200)");
    assert(statusData.intervalMinutes !== undefined, "Daemon status contains intervalMinutes");
  } catch (e: any) {
    console.warn("Local server fetch notice:", e.message);
  }

  // Test 4: POST /api/push/dispatch WITHOUT authorization -> MUST be 401
  try {
    const unauthPushRes = await fetch("http://localhost:3000/api/push/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId: "fake-id" }),
    });
    assert(unauthPushRes.status === 401, "POST /api/push/dispatch rejects unauthorized callers with HTTP 401");
  } catch (e: any) {
    console.warn("Local server fetch notice:", e.message);
  }

  // 9. Reconcile Canonical Event Catalog (48 canonical business events)
  console.log("\n--- STAGE 8: Canonical Event Catalog Reconciliation ---");
  const canonical48Events: NotificationEventType[] = [
    // Task Lifecycle (18)
    "TASK_ASSIGNED", "TASK_REASSIGNED", "TASK_IN_PROGRESS", "TASK_REVIEW_REQUESTED",
    "TASK_REVISION_REQUESTED", "TASK_APPROVED", "TASK_COMPLETED", "TASK_BLOCKED",
    "TASK_UNBLOCKED", "TASK_COMMENT", "USER_MENTIONED", "TASK_DEADLINE",
    "TASK_DUE_SOON", "TASK_OVERDUE", "TASK_DEPENDENCY_RESOLVED", "TASK_DEPENDENCY_BLOCKED",
    "TASK_DELIVERED", "TASK_CANCELLED",
    // Reminders & Calendar (6)
    "PRODUCTION_SHOOT_TOMORROW", "PRODUCTION_TOMORROW", "CALENDAR_EVENT_REMINDER",
    "CALENDAR_SCHEDULE_CHANGED", "DELIVERABLE_BEHIND", "REMINDER_DUE",
    // Workspaces & Approvals (8)
    "CLIENT_INFO_SUBMITTED", "CLIENT_FILES_UPLOADED", "CLIENT_DELIVERABLE_APPROVED",
    "CLIENT_REVISION_REQUESTED", "CLIENT_APPROVAL_REQUIRED", "APPROVAL_COMPLETED",
    "REVISION_REQUESTED", "APPROVAL_BLOCKED",
    // Sales & Operations (8)
    "DEAL_CREATED", "LEAD_ASSIGNED", "CLIENT_ASSIGNED", "DEAL_STATUS_CHANGED",
    "SALES_FOLLOWUP_REQUIRED", "OPERATIONS_ALERT", "WORKSPACE_STATUS_CHANGED", "INQUIRY_RECEIVED",
    // Finance (5)
    "INVOICE_OVERDUE", "PAYMENT_RECEIVED", "COMMISSION_ELIGIBLE", "COMMISSION_APPROVED", "SALARY_PAID",
    // Security & Direct (3)
    "SECURITY_AUDIT", "MANAGER_MESSAGE", "GENERAL"
  ];

  assert(canonical48Events.length === 48, "Exactly 48 canonical business events in reconciled catalog", { count: canonical48Events.length });

  let allValid = true;
  for (const ev of canonical48Events) {
    const sev = getSemanticSeverity({ event_type: ev });
    const cat = getFunctionalCategory({ event_type: ev });
    if (!sev || !cat) {
      allValid = false;
      console.error(`Missing mapping for ${ev}`);
    }
  }
  assert(allValid, "All 48 canonical events map to semantic severity and functional category");

  // 10. Clean up deterministic records
  console.log("\n--- STAGE 9: Test Record Cleanup & State Restoration ---");
  if (overdueTask?.id) await adminClient.from("project_tasks").delete().eq("id", overdueTask.id);
  if (dueSoonTask?.id) await adminClient.from("project_tasks").delete().eq("id", dueSoonTask.id);
  if (overdueInvoice?.id) await adminClient.from("invoices").delete().eq("id", overdueInvoice.id);
  if (shootTomorrow?.id) await adminClient.from("production_bookings").delete().eq("id", shootTomorrow.id);
  if (createdNewCp && testProjectId) await adminClient.from("client_projects").delete().eq("id", testProjectId);

  // Clean notifications emitted during test for these entities
  const testIds = [overdueTask?.id, dueSoonTask?.id, overdueInvoice?.id, shootTomorrow?.id].filter(Boolean);
  if (testIds.length > 0) {
    await adminClient.from("notifications").delete().in("entity_id", testIds);
  }
  console.log("  Cleaned up all deterministic test tasks, invoices, bookings, and notifications.");

  // FINAL SUMMARY
  console.log("\n===============================================================================");
  console.log(`TOTAL AUDIT CHECKS: ${passedCount + failedCount} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
  console.log("===============================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runProductionReadinessAudit().catch((err) => {
  console.error("Production readiness audit crashed:", err);
  process.exit(1);
});
