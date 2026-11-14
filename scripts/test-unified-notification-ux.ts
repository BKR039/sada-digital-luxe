// ============================================================
// SADA OS — UNIFIED NOTIFICATION UX VERIFICATION SUITE
// Automated Tests for Canonical Visual Tokens, Action Verbs,
// Semantic Accents, Layout Integrity, and Dismissal Mechanics
// ============================================================

import { getNotificationVisualTokens } from "../src/lib/notification-ui-tokens";
import type { NotificationItem } from "../src/types/notifications-and-audit";

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function assert(condition: boolean, desc: string, detail?: any) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ✅ PASS: ${desc}`);
  } else {
    failedChecks++;
    console.error(`  ❌ FAIL: ${desc}`);
    if (detail !== undefined) {
      console.error("     Detail:", detail);
    }
  }
}

console.log("\n============================================================");
console.log("   SADA OS — UNIFIED NOTIFICATION UX VERIFICATION SUITE   ");
console.log("============================================================\n");

// ------------------------------------------------------------
// TEST 1: Canonical Contextual Action Verbs (Prompt Section 3)
// ------------------------------------------------------------
console.log("--- TEST GROUP 1: Canonical Contextual Action Verbs ---");

const testCategories = [
  {
    event: "TASK_ASSIGNED",
    category: "task",
    priority: "normal",
    title: "New Task Assigned",
    expectedAction: "Open Task",
    expectedArabic: "فتح المهمة",
  },
  {
    event: "TASK_DUE_SOON",
    category: "task",
    priority: "high",
    title: "Deadline Approaching",
    expectedAction: "View Task",
    expectedArabic: "عرض المهمة",
  },
  {
    event: "TASK_OVERDUE",
    category: "task",
    priority: "urgent",
    title: "Task Overdue",
    expectedAction: "Resolve Task",
    expectedArabic: "معالجة المهمة",
  },
  {
    event: "TASK_REVISION_REQUESTED",
    category: "task",
    priority: "high",
    title: "Revision Requested",
    expectedAction: "Review Changes",
    expectedArabic: "مراجعة التعديلات",
  },
  {
    event: "USER_MENTIONED",
    category: "messages",
    priority: "normal",
    title: "New Comment",
    expectedAction: "View Comment",
    expectedArabic: "عرض التعليق",
  },
  {
    event: "CLIENT_APPROVAL_REQUIRED",
    category: "operations",
    priority: "high",
    title: "Client Response Needed",
    expectedAction: "View Request",
    expectedArabic: "عرض الطلب",
  },
  {
    event: "TASK_REVIEW_REQUESTED",
    category: "task",
    priority: "normal",
    title: "Submission Ready",
    expectedAction: "Review Task",
    expectedArabic: "مراجعة المهمة",
  },
  {
    event: "INVOICE_OVERDUE",
    category: "billing",
    priority: "urgent",
    title: "Payment Received",
    expectedAction: "View Transaction",
    expectedArabic: "عرض المعاملة",
  },
  {
    event: "PRODUCTION_TOMORROW",
    category: "production",
    priority: "normal",
    title: "Upcoming Production",
    expectedAction: "View Schedule",
    expectedArabic: "عرض الجدول",
  },
  {
    event: "SECURITY_AUDIT",
    category: "security",
    priority: "urgent",
    title: "Account Security Alert",
    expectedAction: "Review Security",
    expectedArabic: "فحص الأمان",
  },
];

for (const t of testCategories) {
  const mockItem: NotificationItem = {
    id: `notif_${t.event}`,
    role_target: "all",
    event_type: t.event as any,
    title: t.title,
    message: "Operational details for test verification.",
    category: t.category as any,
    priority: t.priority as any,
    link_url: "/admin/tasks/test",
    read: false,
    created_at: new Date().toISOString(),
  };

  const tokensEn = getNotificationVisualTokens(mockItem, { isRTL: false });
  assert(
    tokensEn.actionText === t.expectedAction,
    `[${t.event}] Action text matches '${t.expectedAction}' (actual: '${tokensEn.actionText}')`
  );

  const tokensAr = getNotificationVisualTokens(mockItem, { isRTL: true });
  assert(
    tokensAr.actionText === t.expectedArabic,
    `[${t.event}] RTL Arabic action text matches '${t.expectedArabic}' (actual: '${tokensAr.actionText}')`
  );
}

// ------------------------------------------------------------
// TEST 2: Semantic Color Accents (Rule: Not Every Notification Is Blue)
// ------------------------------------------------------------
console.log("\n--- TEST GROUP 2: Semantic Accents & Color Adaptation ---");

// 2.1 Overdue & Urgent & Security -> Red (#DC2626)
const overdueItem: NotificationItem = {
  id: "n_overdue",
  role_target: "all",
  event_type: "TASK_OVERDUE",
  title: "Overdue Deliverable",
  message: "Passed target delivery window.",
  category: "task",
  priority: "urgent",
  link_url: "/admin/tasks/1",
  read: false,
  created_at: new Date().toISOString(),
};
const overdueTokens = getNotificationVisualTokens(overdueItem);
assert(overdueTokens.isUrgent === true, "Overdue task correctly flagged as isUrgent=true");
assert(
  overdueTokens.iconContainerClasses.includes("text-[#DC2626]") ||
    overdueTokens.iconContainerClasses.includes("bg-red-50"),
  "Overdue task uses danger/red semantic container"
);
assert(
  overdueTokens.cardBorderClasses.includes("border-red-200") ||
    overdueTokens.cardBorderClasses.includes("border-red-500"),
  "Overdue task card border uses semantic red border token"
);

// 2.2 Warning / Revisions -> Amber (#D97706)
const revisionItem: NotificationItem = {
  id: "n_revision",
  role_target: "all",
  event_type: "TASK_REVISION_REQUESTED",
  title: "Revision Requested",
  message: "Adjust kerning and lighting pass.",
  category: "task",
  priority: "high",
  link_url: "/admin/tasks/2",
  read: false,
  created_at: new Date().toISOString(),
};
const revisionTokens = getNotificationVisualTokens(revisionItem);
assert(
  revisionTokens.iconContainerClasses.includes("text-[#D97706]") ||
    revisionTokens.iconContainerClasses.includes("bg-amber-50"),
  "Revision request uses warning/amber semantic container"
);
assert(
  revisionTokens.cardBorderClasses.includes("border-amber-200") ||
    revisionTokens.cardBorderClasses.includes("border-amber-500"),
  "Revision request uses warning amber border token"
);

// 2.3 Success / Payments -> Emerald (#059669)
const paymentItem: NotificationItem = {
  id: "n_payment",
  role_target: "all",
  event_type: "PAYMENT_RECEIVED",
  title: "Payment Received",
  message: "Invoice INV-0042 settled in full.",
  category: "billing",
  priority: "normal",
  link_url: "/admin/finance",
  read: false,
  created_at: new Date().toISOString(),
};
const paymentTokens = getNotificationVisualTokens(paymentItem);
assert(
  paymentTokens.iconContainerClasses.includes("text-[#059669]") ||
    paymentTokens.iconContainerClasses.includes("bg-emerald-50"),
  "Payment received uses emerald/success semantic container"
);

// 2.4 Informational / Task Assigned -> SADA Blue (#0878E8) & #BFDBFE
const taskItem: NotificationItem = {
  id: "n_task",
  role_target: "all",
  event_type: "TASK_ASSIGNED",
  title: "New Task Assigned",
  message: "4K Color grading deliverable assigned.",
  category: "task",
  priority: "normal",
  link_url: "/admin/tasks/3",
  read: false,
  created_at: new Date().toISOString(),
};
const taskTokens = getNotificationVisualTokens(taskItem);
assert(
  taskTokens.iconContainerClasses.includes("text-[#0878E8]") ||
    taskTokens.iconContainerClasses.includes("bg-blue-50"),
  "Task assignment uses canonical SADA Blue (#0878E8) circular container"
);
assert(
  taskTokens.cardBorderClasses.includes("border-[#BFDBFE]") ||
    taskTokens.cardBorderClasses.includes("border-primary"),
  "Unread task card applies subtle blue border (#BFDBFE)"
);

// ------------------------------------------------------------
// TEST 3: Read vs Unread State Distinction
// ------------------------------------------------------------
console.log("\n--- TEST GROUP 3: Read vs Unread State Styling ---");

const unreadState = getNotificationVisualTokens(taskItem, { isRead: false });
const readState = getNotificationVisualTokens(taskItem, { isRead: true });

assert(unreadState.cardBgClasses.includes("bg-white"), "Unread notification card uses pure white surface (bg-white)");
assert(readState.cardBgClasses.includes("bg-[#F8FAFC]") || readState.cardBgClasses.includes("dark:bg-card/40"), "Read notification uses subtle settled background (#F8FAFC)");

// ------------------------------------------------------------
// TEST 4: Secondary Action & Dismissal Tokens
// ------------------------------------------------------------
console.log("\n--- TEST GROUP 4: Secondary Action & Dismissal ---");

assert(taskTokens.secondaryText === "Maybe Later", "Default secondary action label is 'Maybe Later'");
const arTokens = getNotificationVisualTokens(taskItem, { isRTL: true });
assert(arTokens.secondaryText === "لاحقاً", "RTL secondary action label is 'لاحقاً'");

console.log("\n============================================================");
console.log(`RESULTS: ${passedChecks}/${totalChecks} CHECKS PASSED (${failedChecks} FAILED)`);
console.log("============================================================\n");

if (failedChecks > 0) {
  process.exit(1);
}
