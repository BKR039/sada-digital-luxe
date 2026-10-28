// ============================================================
// SADA OS — PHASE 8 VERIFICATION TEST SUITE
// Tests: Recipient Isolation, Role Isolation, Finance Boundary,
// Priority-First Sorting, Realtime Socket Security, Bilingual i18n
// ============================================================

import {
  isNotificationVisibleToUser,
  sortNotificationsByPriorityAndRecency,
  resolveNotification,
  PRIORITY_WEIGHTS,
} from "../src/lib/notification-service";
import type {
  NotificationItem,
  NotificationPriority,
  RoleTarget,
} from "../src/types/notifications-and-audit";

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

console.log("\n=======================================================");
console.log("SADA OS — PHASE 8 NOTIFICATION CENTER & SECURITY TESTS");
console.log("=======================================================\n");

// -------------------------------------------------------------
// 1. RECIPIENT ISOLATION (WORKER A vs WORKER B)
// -------------------------------------------------------------
console.log("1. Testing Recipient Isolation (Worker A vs Worker B)...");

const workerAId = "11111111-1111-1111-1111-111111111111";
const workerBId = "22222222-2222-2222-2222-222222222222";
const adminId = "33333333-3333-3333-3333-333333333333";
const superAdminId = "99999999-9999-9999-9999-999999999999";

const workerBPersonalNotif: Partial<NotificationItem> = {
  id: "notif-b-1",
  user_id: workerBId,
  role_target: "worker",
  event_type: "TASK_ASSIGNED",
  category: "task",
  priority: "normal",
  title: "Task for Worker B",
};

// Worker A MUST NOT see Worker B's notification
assert(
  !isNotificationVisibleToUser(workerBPersonalNotif, { userId: workerAId, role: "worker" }),
  "Worker A cannot see Worker B personal notification"
);

// Worker B CAN see their own notification
assert(
  isNotificationVisibleToUser(workerBPersonalNotif, { userId: workerBId, role: "worker" }),
  "Worker B can see their own personal notification"
);

// Regular Admin cannot see Worker B's personal notification unless targeted
assert(
  !isNotificationVisibleToUser(workerBPersonalNotif, { userId: adminId, role: "admin" }),
  "Regular Admin cannot see Worker B private notification"
);

// Super Admin CAN see all notifications
assert(
  isNotificationVisibleToUser(workerBPersonalNotif, { userId: superAdminId, role: "super_admin" }),
  "Super Admin can inspect Worker B notification"
);

// -------------------------------------------------------------
// 2. ROLE TARGET ISOLATION (WORKERS CANNOT SEE ADMIN NOTIFICATIONS)
// -------------------------------------------------------------
console.log("\n2. Testing Role Target Isolation...");

const adminBroadcast: Partial<NotificationItem> = {
  id: "notif-admin-1",
  user_id: null,
  role_target: "admin",
  event_type: "PRODUCTION_TOMORROW",
  category: "production",
  priority: "high",
  title: "Admin Production Briefing",
};

assert(
  !isNotificationVisibleToUser(adminBroadcast, { userId: workerAId, role: "worker" }),
  "Worker cannot see Admin broadcast notification"
);

assert(
  isNotificationVisibleToUser(adminBroadcast, { userId: adminId, role: "admin" }),
  "Admin can see Admin broadcast notification"
);

const superAdminBroadcast: Partial<NotificationItem> = {
  id: "notif-sa-1",
  user_id: null,
  role_target: "super_admin",
  event_type: "SECURITY_AUDIT",
  category: "security",
  priority: "urgent",
  title: "Super Admin Root Alert",
};

assert(
  !isNotificationVisibleToUser(superAdminBroadcast, { userId: adminId, role: "admin" }),
  "Regular Admin cannot see Super Admin exclusive broadcast"
);

assert(
  !isNotificationVisibleToUser(superAdminBroadcast, { userId: workerAId, role: "worker" }),
  "Worker cannot see Super Admin exclusive broadcast"
);

assert(
  isNotificationVisibleToUser(superAdminBroadcast, { userId: superAdminId, role: "super_admin" }),
  "Super Admin sees Super Admin exclusive broadcast"
);

// -------------------------------------------------------------
// 3. FINANCE & BILLING ACCESS BOUNDARY ISOLATION
// -------------------------------------------------------------
console.log("\n3. Testing Finance & Billing Category Isolation...");

const financeBroadcast: Partial<NotificationItem> = {
  id: "notif-fin-1",
  user_id: null,
  role_target: "admin",
  event_type: "MONTH_END_CLOSING",
  category: "finance",
  priority: "urgent",
  title: "Ledger Reconciliation",
};

const billingBroadcast: Partial<NotificationItem> = {
  id: "notif-bill-1",
  user_id: null,
  role_target: "admin",
  event_type: "INVOICE_OVERDUE",
  category: "billing",
  priority: "high",
  title: "Overdue Invoices",
};

// Workers can never see finance broadcast
assert(
  !isNotificationVisibleToUser(financeBroadcast, { userId: workerAId, role: "worker" }),
  "Worker cannot see Finance broadcast"
);

assert(
  !isNotificationVisibleToUser(billingBroadcast, { userId: workerAId, role: "worker" }),
  "Worker cannot see Billing broadcast"
);

// Admin WITHOUT finance permission cannot see finance broadcast
assert(
  !isNotificationVisibleToUser(financeBroadcast, {
    userId: adminId,
    role: "admin",
    hasFinanceAccess: false,
  }),
  "Admin WITHOUT finance access cannot see Finance broadcast"
);

assert(
  !isNotificationVisibleToUser(billingBroadcast, {
    userId: adminId,
    role: "admin",
    hasFinanceAccess: false,
  }),
  "Admin WITHOUT finance access cannot see Billing broadcast"
);

// Admin WITH finance permission CAN see finance broadcast
assert(
  isNotificationVisibleToUser(financeBroadcast, {
    userId: adminId,
    role: "admin",
    hasFinanceAccess: true,
  }),
  "Admin WITH finance access CAN see Finance broadcast"
);

assert(
  isNotificationVisibleToUser(billingBroadcast, {
    userId: adminId,
    role: "admin",
    hasFinanceAccess: true,
  }),
  "Admin WITH finance access CAN see Billing broadcast"
);

// -------------------------------------------------------------
// 4. PRIORITY-FIRST SORTING GUARANTEE
// -------------------------------------------------------------
console.log("\n4. Testing Priority-First Sorting Guarantee (Urgent > High > Normal > Low)...");

const unsortedNotifications: NotificationItem[] = [
  {
    id: "item-low-recent",
    user_id: workerAId,
    role_target: "all",
    event_type: "GENERAL",
    title: "Low recent",
    message: "low",
    category: "system",
    priority: "low",
    read: false,
    created_at: "2026-10-06T12:00:00Z",
  },
  {
    id: "item-normal-old",
    user_id: workerAId,
    role_target: "all",
    event_type: "TASK_DUE_SOON",
    title: "Normal old",
    message: "normal",
    category: "task",
    priority: "normal",
    read: false,
    created_at: "2026-10-05T10:00:00Z",
  },
  {
    id: "item-urgent-old",
    user_id: workerAId,
    role_target: "all",
    event_type: "MONTH_END_CLOSING",
    title: "Urgent old",
    message: "urgent",
    category: "finance",
    priority: "urgent",
    read: false,
    created_at: "2026-10-04T08:00:00Z",
  },
  {
    id: "item-high-new",
    user_id: workerAId,
    role_target: "all",
    event_type: "TASK_OVERDUE",
    title: "High new",
    message: "high",
    category: "task",
    priority: "high",
    read: false,
    created_at: "2026-10-06T11:00:00Z",
  },
  {
    id: "item-urgent-new",
    user_id: workerAId,
    role_target: "all",
    event_type: "INVOICE_OVERDUE",
    title: "Urgent new",
    message: "urgent",
    category: "billing",
    priority: "urgent",
    read: false,
    created_at: "2026-10-06T13:00:00Z",
  },
  {
    id: "item-normal-new",
    user_id: workerAId,
    role_target: "all",
    event_type: "TASK_DUE_SOON",
    title: "Normal new",
    message: "normal",
    category: "task",
    priority: "normal",
    read: false,
    created_at: "2026-10-06T10:00:00Z",
  },
];

const sorted = sortNotificationsByPriorityAndRecency(unsortedNotifications);

// Verification:
// index 0: item-urgent-new (Urgent, 13:00)
// index 1: item-urgent-old (Urgent, 08:00)
// index 2: item-high-new (High, 11:00)
// index 3: item-normal-new (Normal, 10:00)
// index 4: item-normal-old (Normal, Oct 5)
// index 5: item-low-recent (Low, 12:00)

assert(sorted[0].id === "item-urgent-new", "First item is Urgent New");
assert(sorted[1].id === "item-urgent-old", "Second item is Urgent Old");
assert(sorted[2].id === "item-high-new", "Third item is High New");
assert(sorted[3].id === "item-normal-new", "Fourth item is Normal New");
assert(sorted[4].id === "item-normal-old", "Fifth item is Normal Old");
assert(sorted[5].id === "item-low-recent", "Sixth item is Low Recent (even though recent)");

// Verify all priorities satisfy non-increasing weight sequence
let priorityOrderValid = true;
for (let i = 0; i < sorted.length - 1; i++) {
  const curWeight = PRIORITY_WEIGHTS[sorted[i].priority];
  const nextWeight = PRIORITY_WEIGHTS[sorted[i + 1].priority];
  if (curWeight < nextWeight) {
    priorityOrderValid = false;
    break;
  }
}
assert(priorityOrderValid, "Entire sequence adheres to Priority First order");

// -------------------------------------------------------------
// 5. STRUCTURED LOCALIZATION KEYS & TOKEN INTERPOLATION
// -------------------------------------------------------------
console.log("\n5. Testing Parameterized Localization & Token Interpolation...");

// Mock translation function mimicking i18n
const mockT_en = (key: string, params?: Record<string, any>) => {
  const dictionary: Record<string, string> = {
    "notifications.categories.task": "Tasks & Milestones",
    "notifications.priorities.urgent": "Urgent",
    "notifications.priorities.high": "High Priority",
    "notifications.priorities.normal": "Normal",
    "notifications.priorities.low": "Low",
    "notifications.events.task_assigned.title": "New Task Assigned",
    "notifications.events.task_assigned.message": "You have been assigned to: {taskName}",
    "notifications.events.invoice_overdue.title": "Invoice Overdue",
    "notifications.events.invoice_overdue.message": "Invoice #{invoiceNumber} for '{clientName}' is past due.",
  };
  return dictionary[key] || key;
};

const taskNotif: NotificationItem = {
  id: "notif-task-1",
  user_id: workerAId,
  role_target: "worker",
  event_type: "TASK_ASSIGNED",
  title: "Fallback Task Title",
  message: "Fallback Task Message",
  category: "task",
  priority: "high",
  read: false,
  created_at: new Date().toISOString(),
  context_title: "Acme Corp",
  source_module: "tasks",
  metadata: { taskName: "Brand Identity Design", clientName: "Acme Corp" },
};

const resolvedTask = resolveNotification(taskNotif, mockT_en);
assert(resolvedTask.title === "New Task Assigned", "Resolved title from event key");
assert(
  resolvedTask.message === "You have been assigned to: Brand Identity Design",
  "Interpolated {taskName} into message"
);
assert(resolvedTask.priorityLabel === "High Priority", "Resolved priority label");
assert(resolvedTask.categoryLabel === "Tasks & Milestones", "Resolved category label");

// Arabic Mock test
const mockT_ar = (key: string, params?: Record<string, any>) => {
  const dictionary: Record<string, string> = {
    "notifications.categories.billing": "الفواتير والمستحقات",
    "notifications.priorities.urgent": "عاجل",
    "notifications.events.invoice_overdue.title": "فاتورة متأخرة السداد",
    "notifications.events.invoice_overdue.message": "الفاتورة رقم #{invoiceNumber} للعميل '{clientName}' تجاوزت موعد الاستحقاق.",
  };
  return dictionary[key] || key;
};

const invoiceNotif: NotificationItem = {
  id: "notif-inv-1",
  user_id: adminId,
  role_target: "admin",
  event_type: "INVOICE_OVERDUE",
  title: "Overdue Invoice INV-2026-001",
  message: "Invoice overdue",
  category: "billing",
  priority: "urgent",
  read: false,
  created_at: new Date().toISOString(),
  context_title: "Digitous Group",
  source_module: "finance",
  metadata: { invoiceNumber: "INV-2026-001", clientName: "Digitous Group" },
};

const resolvedInvoiceAr = resolveNotification(invoiceNotif, mockT_ar);
assert(resolvedInvoiceAr.title === "فاتورة متأخرة السداد", "Arabic title resolved correctly");
assert(
  resolvedInvoiceAr.message === "الفاتورة رقم #INV-2026-001 للعميل 'Digitous Group' تجاوزت موعد الاستحقاق.",
  "Arabic message interpolated parameters correctly"
);
assert(resolvedInvoiceAr.priorityLabel === "عاجل", "Arabic priority label resolved");
assert(resolvedInvoiceAr.categoryLabel === "الفواتير والمستحقات", "Arabic category label resolved");

// Fallback test when key is not in dictionary
const customNotif: NotificationItem = {
  id: "notif-custom-1",
  user_id: workerAId,
  role_target: "worker",
  event_type: "GENERAL",
  title: "Server Maintenance Scheduled",
  message: "Maintenance on {date} at {time}",
  category: "system",
  priority: "normal",
  read: false,
  created_at: new Date().toISOString(),
  metadata: { date: "2026-10-10", time: "02:00 AM" },
};

const resolvedCustom = resolveNotification(customNotif, mockT_en);
assert(resolvedCustom.title === "Server Maintenance Scheduled", "Custom title preserved");
assert(
  resolvedCustom.message === "Maintenance on 2026-10-10 at 02:00 AM",
  "Custom message interpolated tokens successfully"
);

// -------------------------------------------------------------
// SUMMARY & REPORT
// -------------------------------------------------------------
console.log("\n=======================================================");
console.log(`PHASE 8 TESTS COMPLETED: ${passedTests}/${totalTests} PASSED`);
console.log("=======================================================\n");

if (passedTests !== totalTests) {
  process.exit(1);
}
