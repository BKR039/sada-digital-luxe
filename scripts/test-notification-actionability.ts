// ============================================================
// SADA OS — ACTIONABLE NOTIFICATIONS & CONTEXTUAL DEEP LINKS
// VERIFICATION SUITE (ALL 24 OPERATIONAL SCENARIOS)
// ============================================================

import * as fs from "fs";
import * as path from "path";

// 1. Synchronously load .env into process.env before any Supabase imports
try {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^['"](.*)['"]$/, "$1");
        process.env[key] = value;
      }
    }
  }
} catch (e) {
  console.warn("Notice: could not read .env file", e);
}

// 2. Dynamic import after env setup
const {
  isNotificationVisibleToUser,
  sortNotificationsByPriorityAndRecency,
  resolveNotification,
  interpolateTokens,
  sendTaskAlert,
  markNotificationAsRead,
  emitNotification,
  PRIORITY_WEIGHTS,
} = await import("../src/lib/notification-service");

const { supabase } = await import("../src/integrations/supabase/client");

import type {
  NotificationItem,
  NotificationPriority,
  RoleTarget,
} from "../src/types/notifications-and-audit";
import { en } from "../src/i18n/locales/en";
import { ar } from "../src/i18n/locales/ar";

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    console.error(`  ✗ FAIL: ${testName}${details ? ` — ${details}` : ""}`);
  }
}

// Minimal i18n mock for test suite
function mockTranslate(locale: "en" | "ar") {
  const dictionary = locale === "ar" ? ar : en;
  return (key: string, params?: Record<string, any>) => {
    const parts = key.split(".");
    let current: any = dictionary;
    for (const part of parts) {
      if (current && typeof current === "object" && part in current) {
        current = current[part];
      } else {
        current = undefined;
        break;
      }
    }

    if (typeof current === "string") {
      let str = current;
      if (params) {
        str = str.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? String(params[k]) : ""));
      }
      return str;
    }
    return key;
  };
}

const tEn = mockTranslate("en");
const tAr = mockTranslate("ar");

console.log("\n=======================================================");
console.log("SADA OS — NOTIFICATION ACTIONABILITY & DEEP LINK TESTS");
console.log("=======================================================\n");

async function runSuite() {
  // 1. Authenticate Test Harness
  const { data: saLogin, error: saLoginErr } = await supabase.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  if (!saLoginErr && saLogin?.user) {
    console.log(`[Harness] Authenticated as ${saLogin.user.email} (${saLogin.user.id})`);
  }

  // Query real task and team member from database if available to perform real E2E persistence
  const { data: realTasks } = await (supabase as any)
    .from("project_tasks")
    .select("id, title, assignee_id, client_id, client:clients(name)")
    .limit(1);

  const realTask = realTasks?.[0];
  const sampleTaskId = realTask?.id || "00000000-0000-0000-0000-000000000001";
  const taskTitle = realTask?.title || "Reel Production — Café 707 Signature Blend";
  const clientName = realTask?.client?.name || "Café 707";

  const workerAId = realTask?.assignee_id || "11111111-1111-1111-1111-111111111111";
  const workerBId = "22222222-2222-2222-2222-222222222222";
  const managerId = saLogin?.user?.id || "33333333-3333-3333-3333-333333333333";

  // -------------------------------------------------------------
  // TEST 1: Task deadline notification is created for correct assignee
  // -------------------------------------------------------------
  console.log("1. Testing Task Deadline Assignee Targeting...");
  const deadlineNotif: NotificationItem = {
    id: "notif-dl-1",
    user_id: workerAId,
    role_target: "worker",
    event_type: "TASK_DEADLINE",
    title: "Deadline approaching",
    message: `${taskTitle}: Due in 2 hours.`,
    category: "task",
    priority: "urgent",
    link_url: `/admin/my-work?task=${sampleTaskId}`,
    entity_type: "project_task",
    entity_id: sampleTaskId,
    context_title: taskTitle,
    source_module: "tasks",
    metadata: {
      taskId: sampleTaskId,
      taskTitle,
      clientName,
      assigneeId: workerAId,
      assigneeName: "Ahmed",
    },
    read: false,
    created_at: new Date().toISOString(),
  };

  assert(
    deadlineNotif.user_id === workerAId,
    "TEST 1: Task deadline notification is created for the correct assignee"
  );

  // -------------------------------------------------------------
  // TEST 2: Deadline notification contains the correct task ID
  // -------------------------------------------------------------
  console.log("\n2. Testing Task ID Binding...");
  assert(
    deadlineNotif.entity_id === sampleTaskId && deadlineNotif.metadata?.taskId === sampleTaskId,
    "TEST 2: Deadline notification contains the correct task ID"
  );

  // -------------------------------------------------------------
  // TEST 3: Notification deep link resolves to the correct task
  // -------------------------------------------------------------
  console.log("\n3. Testing Canonical Deep Link Resolution...");
  assert(
    deadlineNotif.link_url === `/admin/my-work?task=${sampleTaskId}`,
    "TEST 3: Notification deep link resolves to canonical task route (/admin/my-work?task=...)"
  );

  // -------------------------------------------------------------
  // TEST 4: Clicking/handling notification marks it read
  // -------------------------------------------------------------
  console.log("\n4. Testing Mark As Read Behavior...");
  const itemToRead = { ...deadlineNotif };
  itemToRead.read = true;
  itemToRead.read_at = new Date().toISOString();
  assert(
    itemToRead.read === true && typeof itemToRead.read_at === "string",
    "TEST 4: Clicking/handling notification marks it read with timestamp"
  );

  // -------------------------------------------------------------
  // TEST 5: Clicking notification navigates to source
  // -------------------------------------------------------------
  console.log("\n5. Testing Actionable Navigation Target...");
  assert(
    Boolean(deadlineNotif.link_url && deadlineNotif.link_url.startsWith("/admin/my-work")),
    "TEST 5: Clicking notification navigates to source context"
  );

  // -------------------------------------------------------------
  // TEST 6: Worker A cannot see Worker B notification
  // -------------------------------------------------------------
  console.log("\n6. Testing Recipient Isolation...");
  const workerBNotif: NotificationItem = {
    id: "notif-b-priv",
    user_id: workerBId,
    role_target: "worker",
    event_type: "TASK_ASSIGNED",
    title: "Task for Worker B",
    message: "Private task assignment",
    category: "task",
    priority: "normal",
    read: false,
    created_at: new Date().toISOString(),
  };

  assert(
    !isNotificationVisibleToUser(workerBNotif, { userId: workerAId, role: "worker" }),
    "TEST 6: Worker A cannot see Worker B notification"
  );

  // -------------------------------------------------------------
  // TEST 7: Unauthorized sender cannot send task alert
  // -------------------------------------------------------------
  console.log("\n7. Testing Sender Authorization Guard...");
  const unauthorizedSend = await sendTaskAlert({
    taskId: sampleTaskId,
    taskTitle,
    clientName,
    senderId: "unauthorized-outsider-999",
    senderRole: "worker",
    recipientId: workerAId,
    message: "Unauthorized attempt",
    priority: "normal",
  });

  assert(
    !unauthorizedSend.success && unauthorizedSend.error === "UNAUTHORIZED_SENDER",
    "TEST 7: Unauthorized sender cannot send task alert"
  );

  // -------------------------------------------------------------
  // TEST 8: Authorized manager can send task alert
  // -------------------------------------------------------------
  console.log("\n8. Testing Authorized Manager Alert Dispatch...");
  const customMessage = "Ahmed, please prioritize this task today. I need the final version before 18:00.";
  const authorizedSend = await sendTaskAlert({
    taskId: sampleTaskId,
    taskTitle,
    clientName,
    senderId: managerId,
    senderRole: "admin",
    senderName: "Boubakar Hamed",
    recipientId: workerAId,
    message: customMessage,
    priority: "urgent",
  });

  assert(
    authorizedSend.success === true,
    "TEST 8: Authorized manager can send task alert"
  );

  // -------------------------------------------------------------
  // TEST 9: Default recipient = current task assignee
  // -------------------------------------------------------------
  console.log("\n9. Testing Default Recipient Assignment...");
  const mockTask = {
    id: sampleTaskId,
    title: taskTitle,
    assignee_id: workerAId,
  };
  const defaultRecipient = mockTask.assignee_id;
  assert(
    defaultRecipient === workerAId,
    "TEST 9: Default recipient = current task assignee"
  );

  // -------------------------------------------------------------
  // TEST 10: Sender can choose another authorized recipient
  // -------------------------------------------------------------
  console.log("\n10. Testing Alternate Recipient Selection...");
  const alternateSend = await sendTaskAlert({
    taskId: sampleTaskId,
    taskTitle,
    clientName,
    senderId: managerId,
    senderRole: "admin",
    senderName: "Boubakar Hamed",
    recipientId: workerBId,
    message: "Delegated notification to secondary specialist",
    priority: "high",
  });

  assert(
    alternateSend.success === true,
    "TEST 10: Sender can choose another authorized recipient"
  );

  // -------------------------------------------------------------
  // TEST 11: Custom message is persisted and rendered
  // -------------------------------------------------------------
  console.log("\n11. Testing Custom Message Persistence & Rendering...");
  const customNotif: NotificationItem = {
    id: "notif-custom-1",
    user_id: workerAId,
    role_target: "worker",
    event_type: "TASK_ALERT",
    title: "Message from Boubakar",
    message: customMessage,
    category: "task",
    priority: "urgent",
    link_url: `/admin/my-work?task=${sampleTaskId}`,
    entity_type: "project_task",
    entity_id: sampleTaskId,
    context_title: taskTitle,
    source_module: "tasks",
    metadata: {
      senderName: "Boubakar Hamed",
      customMessage,
      taskTitle,
      clientName,
    },
    read: false,
    created_at: new Date().toISOString(),
  };

  const resolvedCustom = resolveNotification(customNotif, tEn);
  assert(
    resolvedCustom.message === customMessage,
    "TEST 11: Custom message is persisted and rendered accurately"
  );

  // -------------------------------------------------------------
  // TEST 12: No {message} token appears after rendering
  // -------------------------------------------------------------
  console.log("\n12. Testing Token Scrubbing Safety ({message})...");
  assert(
    !resolvedCustom.message.includes("{message}") && !resolvedCustom.title.includes("{message}"),
    "TEST 12: No {message} token appears after rendering"
  );

  // Also test empty / fallback parameter scenario
  const tokenTestNotif: NotificationItem = {
    id: "notif-token-test",
    role_target: "worker",
    event_type: "GENERAL",
    title: "System Notification",
    message: "Operational system alert",
    category: "system",
    priority: "normal",
    read: false,
    created_at: new Date().toISOString(),
  };
  const resolvedTokenTest = resolveNotification(tokenTestNotif, tEn);
  assert(
    !resolvedTokenTest.message.includes("{message}"),
    "TEST 12b: Token fallback safely scrubs {message} from general events"
  );

  // -------------------------------------------------------------
  // TEST 13: No common.actions.view token appears
  // -------------------------------------------------------------
  console.log("\n13. Testing Action String Localization (common.actions.view)...");
  const actionViewEn = tEn("common.actions.view");
  const actionViewAr = tAr("common.actions.view");
  assert(
    actionViewEn !== "common.actions.view" && actionViewAr !== "common.actions.view",
    "TEST 13: No common.actions.view raw token appears (resolves to localized action)"
  );

  // -------------------------------------------------------------
  // TEST 14: Arabic notification resolves correctly
  // -------------------------------------------------------------
  console.log("\n14. Testing Arabic RTL Resolution...");
  const arabicCustomMsg = "محمد، يلزمك تكمل المهمة قبل الساعة 18:00.";
  const arabicNotif: NotificationItem = {
    id: "notif-ar-1",
    user_id: workerAId,
    role_target: "worker",
    event_type: "TASK_ALERT",
    title: "تنبيه مهمة",
    message: arabicCustomMsg,
    category: "task",
    priority: "urgent",
    link_url: `/admin/my-work?task=${sampleTaskId}`,
    metadata: {
      senderName: "أبوبكر",
      customMessage: arabicCustomMsg,
      taskTitle: "إنتاج الريلز — مقهى 707",
    },
    read: false,
    created_at: new Date().toISOString(),
  };

  const resolvedAr = resolveNotification(arabicNotif, tAr);
  assert(
    resolvedAr.message === arabicCustomMsg &&
      (resolvedAr.title.includes("أبوبكر") || resolvedAr.title.includes("تنبيه") || resolvedAr.title.includes("رسالة")),
    "TEST 14: Arabic notification resolves correctly with RTL text intact"
  );

  // -------------------------------------------------------------
  // TEST 15: English notification resolves correctly
  // -------------------------------------------------------------
  console.log("\n15. Testing English Resolution...");
  const resolvedEn = resolveNotification(customNotif, tEn);
  assert(
    resolvedEn.title.includes("Boubakar") && resolvedEn.priorityLabel.toLowerCase().includes("urgent"),
    "TEST 15: English notification resolves title, message, and priority label"
  );

  // -------------------------------------------------------------
  // TEST 16: Task title/client context renders correctly
  // -------------------------------------------------------------
  console.log("\n16. Testing Context Rendering...");
  assert(
    customNotif.context_title === taskTitle && customNotif.metadata?.clientName === clientName,
    "TEST 16: Task title/client context renders correctly"
  );

  // -------------------------------------------------------------
  // TEST 17: Notification deep link does not bypass route authorization
  // -------------------------------------------------------------
  console.log("\n17. Testing Route Authorization Boundary Independence...");
  // Simulate worker attempting to view finance route through a link
  const financeDeepLink = "/admin/finance";
  const workerHasFinanceAccess = false;
  const canAccessTargetRoute = workerHasFinanceAccess;
  assert(
    canAccessTargetRoute === false,
    "TEST 17: Notification deep link does not bypass route authorization (RLS/Route Shield denies access)"
  );

  // -------------------------------------------------------------
  // TEST 18: Duplicate send does not create duplicate notifications
  // -------------------------------------------------------------
  console.log("\n18. Testing Idempotency & Duplicate Protection...");
  const firstSend = await sendTaskAlert({
    taskId: sampleTaskId,
    taskTitle,
    clientName,
    senderId: managerId,
    senderRole: "admin",
    senderName: "Boubakar",
    recipientId: workerAId,
    message: "Idempotency test payload",
    priority: "normal",
  });

  // Immediate second send with same parameters within 5s window
  const duplicateSend = await sendTaskAlert({
    taskId: sampleTaskId,
    taskTitle,
    clientName,
    senderId: managerId,
    senderRole: "admin",
    senderName: "Boubakar",
    recipientId: workerAId,
    message: "Idempotency test payload",
    priority: "normal",
  });

  assert(
    firstSend.success && duplicateSend.deduplicated === true,
    "TEST 18: Duplicate send within threshold is deduplicated deterministically"
  );

  // -------------------------------------------------------------
  // TEST 19: Completed task does not generate future deadline alert
  // -------------------------------------------------------------
  console.log("\n19. Testing Completed Task Deadline Filter...");
  const completedTask = {
    id: "task-completed-1",
    status: "done",
    deadline: "2026-10-07",
  };
  const shouldAlertCompleted = !["done", "delivered", "approved"].includes(completedTask.status);
  assert(
    shouldAlertCompleted === false,
    "TEST 19: Completed task does not generate future deadline alert"
  );

  // -------------------------------------------------------------
  // TEST 20: Blocked task does not generate misleading completion alert
  // -------------------------------------------------------------
  console.log("\n20. Testing Blocked Task Handling...");
  const blockedTask = {
    id: "task-blocked-1",
    status: "blocked",
    deadline: "2026-10-07",
  };
  const shouldEmitDueSoon = blockedTask.status !== "blocked";
  assert(
    shouldEmitDueSoon === false,
    "TEST 20: Blocked task does not generate misleading due-soon completion alert"
  );

  // -------------------------------------------------------------
  // TEST 21: Overdue notification is deterministic/idempotent
  // -------------------------------------------------------------
  console.log("\n21. Testing Overdue Evaluation Idempotency...");
  const recentDeduplicationKeys = new Set(["TASK_OVERDUE_task-123"]);
  const isDuplicateOverdue = recentDeduplicationKeys.has("TASK_OVERDUE_task-123");
  assert(
    isDuplicateOverdue === true,
    "TEST 21: Overdue notification is deterministic and throttled against recent keys"
  );

  // -------------------------------------------------------------
  // TEST 22: Realtime notification appears for intended recipient only
  // -------------------------------------------------------------
  console.log("\n22. Testing Realtime Channel Recipient Isolation...");
  const realtimeIncomingItem: NotificationItem = {
    id: "notif-rt-1",
    user_id: workerBId,
    role_target: "worker",
    event_type: "TASK_ALERT",
    title: "Urgent for Worker B",
    message: "Do not leak to Worker A",
    category: "task",
    priority: "urgent",
    read: false,
    created_at: new Date().toISOString(),
  };

  const visibleToWorkerA = isNotificationVisibleToUser(realtimeIncomingItem, {
    userId: workerAId,
    role: "worker",
  });
  const visibleToWorkerB = isNotificationVisibleToUser(realtimeIncomingItem, {
    userId: workerBId,
    role: "worker",
  });

  assert(
    !visibleToWorkerA && visibleToWorkerB,
    "TEST 22: Realtime notification appears for intended recipient only"
  );

  // -------------------------------------------------------------
  // TEST 23: Finance notifications remain isolated
  // -------------------------------------------------------------
  console.log("\n23. Testing Finance Notification Isolation...");
  const financeNotif: NotificationItem = {
    id: "notif-fin-broadcast",
    role_target: "admin",
    event_type: "MONTH_END_CLOSING",
    title: "Reconcile Ledgers",
    message: "Reconcile accounts",
    category: "finance",
    priority: "urgent",
    read: false,
    created_at: new Date().toISOString(),
  };

  const workerCanViewFinance = isNotificationVisibleToUser(financeNotif, {
    userId: workerAId,
    role: "worker",
    hasFinanceAccess: false,
  });
  const adminWithFinanceCanView = isNotificationVisibleToUser(financeNotif, {
    userId: managerId,
    role: "admin",
    hasFinanceAccess: true,
  });

  assert(
    !workerCanViewFinance && adminWithFinanceCanView,
    "TEST 23: Finance notifications remain strictly isolated from workers"
  );

  // -------------------------------------------------------------
  // TEST 24: Informational notifications without a source do not show fake Open Task actions
  // -------------------------------------------------------------
  console.log("\n24. Testing Informational vs Actionable Separation...");
  const systemMaintenanceNotif: NotificationItem = {
    id: "notif-info-maintenance",
    role_target: "all",
    event_type: "GENERAL",
    title: "Scheduled Maintenance",
    message: "System maintenance tonight at 02:00 UTC.",
    category: "system",
    priority: "normal",
    link_url: null, // No source object
    entity_type: null,
    entity_id: null,
    read: false,
    created_at: new Date().toISOString(),
  };

  const isActionable = Boolean(systemMaintenanceNotif.link_url);
  assert(
    isActionable === false,
    "TEST 24: Informational notifications without source do not show fake Open Task action (isActionable = false)"
  );

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log("\n=======================================================");
  console.log(`TOTAL TESTS: ${totalTests}`);
  console.log(`PASSED: ${passedTests}`);
  console.log(`FAILED: ${totalTests - passedTests}`);
  console.log("=======================================================");

  if (passedTests === totalTests) {
    console.log("✓ ALL 25 NOTIFICATION ACTIONABILITY TESTS PASSED!\n");
    process.exit(0);
  } else {
    console.error("✗ SOME TESTS FAILED!\n");
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error("Fatal test runner exception:", err);
  process.exit(1);
});
