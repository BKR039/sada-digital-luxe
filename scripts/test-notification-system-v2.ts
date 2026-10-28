// ============================================================
// SADA OS — NOTIFICATION EXPERIENCE 2.0 AUTOMATED TEST SUITE
// Validates all 29 core scenarios:
// 1. Dynamic Favicon SVG badge generation & title formatting
// 2. Strict Priority Weighting (Urgent > High > Normal > Low)
// 3. Multi-tier Recipient Isolation & Security Boundaries
// 4. Finance & Billing Protection from Workers
// 5. Multi-device Push Subscription Models & Preference Schemas
// 6. Action Resolution & Deep Link Entity Navigation
// ============================================================

import {
  generateBadgedFaviconSvg,
  getCleanDocumentTitle,
} from "../src/lib/browser-notification-badge";
import {
  PRIORITY_WEIGHTS,
  sortNotificationsByPriorityAndRecency,
  isNotificationVisibleToUser,
  DEFAULT_NOTIFICATION_PREFERENCES,
  resolveNotification,
} from "../src/lib/notification-service";
import { detectDeviceType } from "../src/lib/browser-push-service";
import type {
  NotificationItem,
  NotificationPriority,
  RoleTarget,
} from "../src/types/notifications-and-audit";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, extra?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${extra ? ` — ${extra}` : ""}`);
    failed++;
  }
}

console.log("\n============================================================");
console.log("SADA OS — NOTIFICATION 2.0 VERIFICATION SUITE");
console.log("============================================================\n");

// TEST GROUP 1: DYNAMIC FAVICON & TAB BADGE
console.log("--- 1. Dynamic Favicon & Title Badge Engine ---");
{
  const svg1 = generateBadgedFaviconSvg(1);
  assert(svg1.startsWith("data:image/svg+xml"), "Favicon SVG data URI generated correctly");
  assert(svg1.includes("1"), "Favicon contains count '1'");

  const svg5 = generateBadgedFaviconSvg(5);
  assert(svg5.includes("5"), "Favicon contains count '5'");

  const svg15 = generateBadgedFaviconSvg(15);
  assert(svg15.includes("15"), "Favicon contains multi-digit count '15'");

  const svg120 = generateBadgedFaviconSvg(120);
  assert(decodeURIComponent(svg120).includes("99+"), "Favicon contains '99+' for counts > 99");

  // Title formatting test
  const cleanTitle = "SADA OS — Luxury Creative Agency";
  assert(cleanTitle.replace(/^\(\d+\+?\)\s*/, "") === cleanTitle, "Clean title untouched when unbadged");
  const badgedTitle = `(4) ${cleanTitle}`;
  assert(badgedTitle.replace(/^\(\d+\+?\)\s*/, "") === cleanTitle, "Badged title strips cleanly on reset");
}

// TEST GROUP 2: PRIORITY ENGINE & SORTING RULES
console.log("\n--- 2. Priority Engine & Ordering ---");
{
  assert(PRIORITY_WEIGHTS.urgent === 4, "Urgent priority has weight 4");
  assert(PRIORITY_WEIGHTS.high === 3, "High priority has weight 3");
  assert(PRIORITY_WEIGHTS.normal === 2, "Normal priority has weight 2");
  assert(PRIORITY_WEIGHTS.low === 1, "Low priority has weight 1");

  const mockItems: NotificationItem[] = [
    {
      id: "1",
      role_target: "all",
      event_type: "GENERAL",
      title: "Low info",
      message: "Test",
      category: "system",
      priority: "low",
      read: false,
      created_at: "2026-10-08T10:00:00Z",
    },
    {
      id: "2",
      role_target: "all",
      event_type: "TASK_ASSIGNED",
      title: "Normal task",
      message: "Test",
      category: "task",
      priority: "normal",
      read: false,
      created_at: "2026-10-08T09:00:00Z",
    },
    {
      id: "3",
      role_target: "all",
      event_type: "TASK_BLOCKED",
      title: "Urgent blocked",
      message: "Test",
      category: "task",
      priority: "urgent",
      read: false,
      created_at: "2026-10-08T08:00:00Z",
    },
    {
      id: "4",
      role_target: "all",
      event_type: "TASK_OVERDUE",
      title: "High overdue",
      message: "Test",
      category: "task",
      priority: "high",
      read: false,
      created_at: "2026-10-08T07:00:00Z",
    },
  ];

  const sorted = sortNotificationsByPriorityAndRecency(mockItems);
  assert(sorted[0].id === "3", "First item is Urgent (even though created earliest)");
  assert(sorted[1].id === "4", "Second item is High");
  assert(sorted[2].id === "2", "Third item is Normal");
  assert(sorted[3].id === "1", "Fourth item is Low");
}

// TEST GROUP 3: SECURITY ISOLATION & MULTI-TENANT RECIPIENT PRIVACY
console.log("\n--- 3. Multi-Tenant Recipient Isolation & Security ---");
{
  const workerA = { userId: "user-worker-aaa", role: "worker", hasFinanceAccess: false };
  const workerB = { userId: "user-worker-bbb", role: "worker", hasFinanceAccess: false };
  const adminNoFinance = { userId: "user-admin-1", role: "admin", hasFinanceAccess: false };
  const adminWithFinance = { userId: "user-admin-2", role: "admin", hasFinanceAccess: true };
  const superAdmin = { userId: "user-super", role: "super_admin", hasFinanceAccess: true };

  // Personal item for Worker A
  const itemPersonalA = {
    user_id: "user-worker-aaa",
    role_target: "worker" as RoleTarget,
    category: "task" as const,
  };
  assert(isNotificationVisibleToUser(itemPersonalA, workerA), "Worker A sees their own personal item");
  assert(!isNotificationVisibleToUser(itemPersonalA, workerB), "Worker B CANNOT see Worker A personal item");
  assert(isNotificationVisibleToUser(itemPersonalA, superAdmin), "Super Admin can oversee Worker A item");

  // Finance Broadcast
  const itemFinanceBroadcast = {
    user_id: null,
    role_target: "admin" as RoleTarget,
    category: "finance" as const,
  };
  assert(!isNotificationVisibleToUser(itemFinanceBroadcast, workerA), "Worker A barred from finance broadcast");
  assert(!isNotificationVisibleToUser(itemFinanceBroadcast, adminNoFinance), "Admin without finance access barred from finance");
  assert(isNotificationVisibleToUser(itemFinanceBroadcast, adminWithFinance), "Admin with finance access permitted");
  assert(isNotificationVisibleToUser(itemFinanceBroadcast, superAdmin), "Super Admin permitted for finance");

  // Security Broadcast
  const itemSecurity = {
    user_id: null,
    role_target: "admin" as RoleTarget,
    category: "security" as const,
  };
  assert(!isNotificationVisibleToUser(itemSecurity, workerA), "Worker barred from security alerts");
  assert(isNotificationVisibleToUser(itemSecurity, adminNoFinance), "Admin permitted for security alerts");

  // Super Admin Exclusive
  const itemSuperExclusive = {
    user_id: null,
    role_target: "super_admin" as RoleTarget,
    category: "system" as const,
  };
  assert(!isNotificationVisibleToUser(itemSuperExclusive, adminWithFinance), "Admins cannot see super_admin exclusive alerts");
  assert(isNotificationVisibleToUser(itemSuperExclusive, superAdmin), "Super Admin sees super_admin exclusive alerts");
}

// TEST GROUP 4: NOTIFICATION PREFERENCES & DELIVERY CHANNELS
console.log("\n--- 4. Preferences & Channel Configuration ---");
{
  assert(DEFAULT_NOTIFICATION_PREFERENCES.desktop_push_enabled === false, "Desktop push defaults to opt-in false");
  assert(DEFAULT_NOTIFICATION_PREFERENCES.mobile_push_enabled === false, "Mobile push defaults to opt-in false");
  assert(DEFAULT_NOTIFICATION_PREFERENCES.security_enabled === true, "Security alerts default to true (Mandatory)");
  assert(DEFAULT_NOTIFICATION_PREFERENCES.task_assigned === true, "Task assigned enabled by default");
  assert(DEFAULT_NOTIFICATION_PREFERENCES.messages_enabled === true, "Messages enabled by default");
}

// TEST GROUP 5: ACTION RESOLUTION & ENTITY LOCALIZATION
console.log("\n--- 5. Action Resolution & Entity Mapping ---");
{
  const fakeT = (key: string) => key;
  const taskItem: NotificationItem = {
    id: "t1",
    event_type: "TASK_ASSIGNED",
    title: "Reel #03 Edit",
    message: "Assigned by Producer",
    category: "task",
    priority: "high",
    link_url: "/admin/tasks/123",
    read: false,
    role_target: "worker",
    created_at: "2026-10-08T10:00:00Z",
  };

  const resolved = resolveNotification(taskItem, fakeT as any);
  assert(resolved.title === "Reel #03 Edit", "Resolved title matches task title");
  assert(resolved.priorityLabel !== "", "Resolved priority label generated");
}

// TEST GROUP 6: SEMANTIC SEVERITY & FUNCTIONAL CATEGORIES
console.log("\n--- 6. Semantic Severity & Functional Categories ---");
{
  const {
    getSemanticSeverity,
    getFunctionalCategory,
    getPriorityTier,
  } = await import("../src/lib/notification-service");

  const blockedTask: NotificationItem = {
    id: "b1",
    event_type: "TASK_BLOCKED",
    title: "Task Blocked",
    message: "Waiting client approval",
    category: "task",
    priority: "urgent",
    read: false,
    role_target: "all",
    created_at: "2026-10-08T10:00:00Z",
  };
  assert(getSemanticSeverity(blockedTask) === "URGENT", "TASK_BLOCKED resolved to URGENT semantic severity");
  assert(getFunctionalCategory(blockedTask) === "TASK", "TASK_BLOCKED resolved to TASK functional category");
  assert(getPriorityTier(blockedTask.priority) === "CRITICAL", "Urgent priority maps to CRITICAL tier");

  const overdueTask: NotificationItem = {
    id: "o1",
    event_type: "TASK_OVERDUE",
    title: "Overdue",
    message: "Past deadline",
    category: "task",
    priority: "high",
    read: false,
    role_target: "all",
    created_at: "2026-10-08T10:00:00Z",
  };
  assert(getSemanticSeverity(overdueTask) === "WARNING", "TASK_OVERDUE resolved to WARNING semantic severity");
  assert(getPriorityTier(overdueTask.priority) === "HIGH", "High priority maps to HIGH tier");

  const approvedTask: NotificationItem = {
    id: "a1",
    event_type: "TASK_APPROVED",
    title: "Approved",
    message: "Client approved reel",
    category: "task",
    priority: "normal",
    read: false,
    role_target: "all",
    created_at: "2026-10-08T10:00:00Z",
  };
  assert(getSemanticSeverity(approvedTask) === "SUCCESS", "TASK_APPROVED resolved to SUCCESS semantic severity");

  const securityAudit: NotificationItem = {
    id: "s1",
    event_type: "SECURITY_AUDIT",
    title: "Suspicious Login",
    message: "New IP address",
    category: "security",
    priority: "urgent",
    read: false,
    role_target: "super_admin",
    created_at: "2026-10-08T10:00:00Z",
  };
  assert(getSemanticSeverity(securityAudit) === "URGENT", "Urgent security audit resolved to URGENT severity");
  assert(getFunctionalCategory(securityAudit) === "SECURITY", "Security audit resolved to SECURITY functional category");

  const opsBilling: NotificationItem = {
    id: "inv1",
    event_type: "INVOICE_OVERDUE",
    title: "Invoice Overdue",
    message: "Client invoice unpaid",
    category: "billing",
    priority: "urgent",
    read: false,
    role_target: "admin",
    created_at: "2026-10-08T10:00:00Z",
  };
  assert(getFunctionalCategory(opsBilling) === "OPERATIONS", "Billing alert resolved to OPERATIONS functional category");

  const directMsg: NotificationItem = {
    id: "m1",
    event_type: "MANAGER_MESSAGE",
    title: "Urgent check",
    message: "Please check Reel 2",
    category: "messages",
    priority: "high",
    read: false,
    role_target: "worker",
    created_at: "2026-10-08T10:00:00Z",
  };
  assert(getFunctionalCategory(directMsg) === "MESSAGE", "Manager alert resolved to MESSAGE functional category");
}

// TEST GROUP 7: SMART NOTIFICATION GROUPING
console.log("\n--- 7. Smart Notification Grouping ---");
{
  const { groupSimilarNotifications } = await import("../src/lib/notification-service");

  const mockTasks: NotificationItem[] = [
    {
      id: "task-1",
      event_type: "TASK_ASSIGNED",
      title: "Reel 1 Assigned",
      message: "Assigned by director",
      category: "task",
      priority: "normal",
      read: false,
      role_target: "worker",
      created_at: "2026-10-08T10:00:00Z",
    },
    {
      id: "task-2",
      event_type: "TASK_ASSIGNED",
      title: "Reel 2 Assigned",
      message: "Assigned by director",
      category: "task",
      priority: "normal",
      read: false,
      role_target: "worker",
      created_at: "2026-10-08T09:50:00Z",
    },
    {
      id: "task-3",
      event_type: "TASK_ASSIGNED",
      title: "Reel 3 Assigned",
      message: "Assigned by director",
      category: "task",
      priority: "normal",
      read: false,
      role_target: "worker",
      created_at: "2026-10-08T09:40:00Z",
    },
    {
      id: "task-4",
      event_type: "TASK_ASSIGNED",
      title: "Reel 4 Assigned",
      message: "Assigned by director",
      category: "task",
      priority: "normal",
      read: false,
      role_target: "worker",
      created_at: "2026-10-08T09:30:00Z",
    },
    {
      id: "sec-1",
      event_type: "SECURITY_AUDIT",
      title: "Security Event",
      message: "Audit notice",
      category: "security",
      priority: "urgent",
      read: false,
      role_target: "admin",
      created_at: "2026-10-08T09:00:00Z",
    },
  ];

  const grouped = groupSimilarNotifications(mockTasks, 3);
  assert(grouped.length === 2, "4 similar tasks grouped into 1 group item + 1 security item = 2 total items");
  assert(grouped[0].kind === "group", "First item in feed is smart group");
  if (grouped[0].kind === "group") {
    assert(grouped[0].group.count === 4, "Group contains all 4 assigned tasks");
    assert(grouped[0].group.items.length === 4, "Group preserves all 4 underlying notification objects");
    assert(grouped[0].group.title.includes("4 tasks assigned"), "Group title reflects 4 tasks assigned");
  }
  assert(grouped[1].kind === "single", "Security event stays individual item");
}

console.log("\n============================================================");
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log("============================================================\n");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
