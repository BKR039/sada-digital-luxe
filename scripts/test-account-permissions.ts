import {
  SADA_MODULES,
  ROLE_DEFAULT_MODULE_PERMISSIONS,
  getEffectiveModulePermission,
  canPerformModuleAction,
  resolveModuleFromPath,
  type SadaModule,
  type SadaRole,
  type SadaAction,
  type UserModulePermissions,
} from "../src/types/permissions";
import { canAccessModule } from "../src/lib/permissions";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

console.log("============================================================");
console.log("SADA OS — ACCOUNT MEMBER MANAGEMENT & PERMISSIONS SUITE");
console.log("============================================================\n");

// 1. Role Baseline Defaults
console.log("--- 1. Role Baseline Defaults ---");
assert(
  getEffectiveModulePermission("dashboard", "super_admin") === true,
  "Super Admin has default access to dashboard"
);
assert(
  getEffectiveModulePermission("finance", "super_admin") === true,
  "Super Admin has default access to finance"
);
assert(
  getEffectiveModulePermission("accounts", "super_admin") === true,
  "Super Admin has default access to accounts"
);

// Admin Defaults
assert(
  getEffectiveModulePermission("dashboard", "admin") === true,
  "Admin has default access to dashboard"
);
assert(
  getEffectiveModulePermission("clients", "admin") === true,
  "Admin has default access to clients"
);
assert(
  getEffectiveModulePermission("sales", "admin") === true,
  "Admin has default access to sales"
);
assert(
  getEffectiveModulePermission("finance", "admin") === false,
  "Admin is locked out of finance by default (Super Admin grant required)"
);
assert(
  getEffectiveModulePermission("accounts", "admin") === false,
  "Admin is locked out of accounts management"
);

// Worker Defaults
assert(
  getEffectiveModulePermission("dashboard", "worker") === true,
  "Worker has default access to dashboard"
);
assert(
  getEffectiveModulePermission("tasks", "worker") === true,
  "Worker has default access to tasks"
);
assert(
  getEffectiveModulePermission("calendar", "worker") === true,
  "Worker has default access to calendar"
);
assert(
  getEffectiveModulePermission("finance", "worker") === false,
  "Worker is locked out of finance by default"
);
assert(
  getEffectiveModulePermission("sales", "worker") === false,
  "Worker is locked out of sales by default"
);
assert(
  getEffectiveModulePermission("accounts", "worker") === false,
  "Worker is locked out of accounts management"
);

// 2. Exact User Prompt Example Scenario
console.log("\n--- 2. Prompt Scenario: Worker Custom Module Overrides ---");
// Example from user prompt:
// "Dashboard ON; Clients ON; Tasks ON; Calendar ON; Finance OFF; Accounting OFF; Sales OFF"
const promptWorkerPermissions: UserModulePermissions = {
  dashboard: true,
  clients: true,
  tasks: true,
  calendar: true,
  finance: false,
  sales: false,
  compensation: true,
};

assert(
  getEffectiveModulePermission("dashboard", "worker", promptWorkerPermissions) === true,
  "Prompt Scenario: Dashboard is ON"
);
assert(
  getEffectiveModulePermission("clients", "worker", promptWorkerPermissions) === true,
  "Prompt Scenario: Clients is ON"
);
assert(
  getEffectiveModulePermission("tasks", "worker", promptWorkerPermissions) === true,
  "Prompt Scenario: Tasks is ON"
);
assert(
  getEffectiveModulePermission("calendar", "worker", promptWorkerPermissions) === true,
  "Prompt Scenario: Calendar is ON"
);
assert(
  getEffectiveModulePermission("finance", "worker", promptWorkerPermissions) === false,
  "Prompt Scenario: Finance is OFF"
);
assert(
  getEffectiveModulePermission("sales", "worker", promptWorkerPermissions) === false,
  "Prompt Scenario: Sales is OFF"
);

// Explicit Grant on Worker
const workerWithSalesGranted: UserModulePermissions = {
  ...promptWorkerPermissions,
  sales: true,
};
assert(
  getEffectiveModulePermission("sales", "worker", workerWithSalesGranted) === true,
  "Worker with explicit Sales grant can access sales"
);

// Security Invariant: Worker NEVER granted Accounts root access even with override
const workerWithMaliciousAccountsAttempt: UserModulePermissions = {
  accounts: true,
};
assert(
  getEffectiveModulePermission("accounts", "worker", workerWithMaliciousAccountsAttempt) === false,
  "CRITICAL: Non-super admin cannot be granted root accounts access"
);
assert(
  getEffectiveModulePermission("accounts", "admin", { accounts: true }) === false,
  "CRITICAL: Admin cannot be granted root accounts access via override"
);

// 3. Admin Custom Overrides
console.log("\n--- 3. Admin Custom Overrides ---");
const adminWithFinanceGranted: UserModulePermissions = {
  finance: true,
};
assert(
  getEffectiveModulePermission("finance", "admin", adminWithFinanceGranted) === true,
  "Admin with explicit Finance override can access Finance"
);

const adminWithSalesRevoked: UserModulePermissions = {
  sales: false,
};
assert(
  getEffectiveModulePermission("sales", "admin", adminWithSalesRevoked) === false,
  "Admin with explicit Sales revoke cannot access Sales"
);

// 4. URL Route Resolution
console.log("\n--- 4. Route Path Resolution (resolveModuleFromPath) ---");
assert(resolveModuleFromPath("/admin") === "dashboard", "Resolves /admin to dashboard");
assert(resolveModuleFromPath("/admin/clients") === "clients", "Resolves /admin/clients to clients");
assert(resolveModuleFromPath("/admin/clients/abc-123") === "clients", "Resolves /admin/clients/:id to clients");
assert(resolveModuleFromPath("/admin/my-work") === "tasks", "Resolves /admin/my-work to tasks");
assert(resolveModuleFromPath("/admin/calendar") === "calendar", "Resolves /admin/calendar to calendar");
assert(resolveModuleFromPath("/admin/sales") === "sales", "Resolves /admin/sales to sales");
assert(resolveModuleFromPath("/admin/deals") === "sales", "Resolves /admin/deals to sales");
assert(resolveModuleFromPath("/admin/finance") === "finance", "Resolves /admin/finance to finance");
assert(resolveModuleFromPath("/admin/my-salary") === "compensation", "Resolves /admin/my-salary to compensation");
assert(resolveModuleFromPath("/admin/client-projects") === "workspaces", "Resolves /admin/client-projects to workspaces");
assert(resolveModuleFromPath("/admin/team-workload") === "team", "Resolves /admin/team-workload to team");
assert(resolveModuleFromPath("/admin/packages") === "packages", "Resolves /admin/packages to packages");
assert(resolveModuleFromPath("/admin/analytics") === "analytics", "Resolves /admin/analytics to analytics");
assert(resolveModuleFromPath("/admin/contact") === "inquiries", "Resolves /admin/contact to inquiries");
assert(resolveModuleFromPath("/admin/projects") === "content_cms", "Resolves /admin/projects to content_cms");
assert(resolveModuleFromPath("/admin/reels") === "content_cms", "Resolves /admin/reels to content_cms");
assert(resolveModuleFromPath("/admin/blog") === "content_cms", "Resolves /admin/blog to content_cms");
assert(resolveModuleFromPath("/admin/workflow-templates") === "workflows", "Resolves /admin/workflow-templates to workflows");
assert(resolveModuleFromPath("/admin/business-rules") === "business_rules", "Resolves /admin/business-rules to business_rules");
assert(resolveModuleFromPath("/admin/accounts") === "accounts", "Resolves /admin/accounts to accounts");

// 5. Navigation Hiding Simulation
console.log("\n--- 5. Navigation Hiding Simulation ---");
const testNavCatalog = [
  { to: "/admin", module: "dashboard" as SadaModule },
  { to: "/admin/my-work", module: "tasks" as SadaModule },
  { to: "/admin/clients", module: "clients" as SadaModule },
  { to: "/admin/calendar", module: "calendar" as SadaModule },
  { to: "/admin/sales", module: "sales" as SadaModule },
  { to: "/admin/finance", module: "finance" as SadaModule },
  { to: "/admin/accounts", module: "accounts" as SadaModule },
];

const visibleItemsForPromptWorker = testNavCatalog.filter((item) =>
  canAccessModule({ role: "worker", customPermissions: promptWorkerPermissions }, item.module)
);

const visiblePaths = visibleItemsForPromptWorker.map((i) => i.to);
assert(visiblePaths.includes("/admin"), "Dashboard is visible in navigation");
assert(visiblePaths.includes("/admin/my-work"), "Tasks is visible in navigation");
assert(visiblePaths.includes("/admin/clients"), "Clients is visible in navigation");
assert(visiblePaths.includes("/admin/calendar"), "Calendar is visible in navigation");
assert(!visiblePaths.includes("/admin/sales"), "Sales is HIDDEN from navigation");
assert(!visiblePaths.includes("/admin/finance"), "Finance is HIDDEN from navigation");
assert(!visiblePaths.includes("/admin/accounts"), "Accounts is HIDDEN from navigation");

// 6. Direct URL Rejection Simulation
console.log("\n--- 6. Direct URL Route Interception Simulation ---");
function simulateRouteCheck(path: string, role: SadaRole, perms?: UserModulePermissions) {
  const mod = resolveModuleFromPath(path);
  if (!mod) return { allowed: true };
  const allowed = getEffectiveModulePermission(mod, role, perms);
  return { allowed, module: mod };
}

assert(
  simulateRouteCheck("/admin/finance", "worker", promptWorkerPermissions).allowed === false,
  "Direct URL /admin/finance is BLOCKED for Worker"
);
assert(
  simulateRouteCheck("/admin/sales", "worker", promptWorkerPermissions).allowed === false,
  "Direct URL /admin/sales is BLOCKED for Worker"
);
assert(
  simulateRouteCheck("/admin/accounts", "admin").allowed === false,
  "Direct URL /admin/accounts is BLOCKED for Admin"
);
assert(
  simulateRouteCheck("/admin/clients", "worker", promptWorkerPermissions).allowed === true,
  "Direct URL /admin/clients is ALLOWED for Worker"
);
assert(
  simulateRouteCheck("/admin/finance", "super_admin").allowed === true,
  "Direct URL /admin/finance is ALLOWED for Super Admin"
);

// 7. Extensible Action Permissions Model
console.log("\n--- 7. Extensible Actions (View, Create, Edit, Delete, Approve) ---");
// Super Admin can perform all
assert(canPerformModuleAction("finance", "view", "super_admin") === true, "Super Admin can view finance");
assert(canPerformModuleAction("finance", "create", "super_admin") === true, "Super Admin can create finance");
assert(canPerformModuleAction("finance", "edit", "super_admin") === true, "Super Admin can edit finance");
assert(canPerformModuleAction("finance", "delete", "super_admin") === true, "Super Admin can delete finance");
assert(canPerformModuleAction("finance", "approve", "super_admin") === true, "Super Admin can approve finance");

// Worker cannot perform actions on disabled module
assert(
  canPerformModuleAction("finance", "view", "worker", promptWorkerPermissions) === false,
  "Worker cannot view disabled finance"
);
assert(
  canPerformModuleAction("sales", "view", "worker", promptWorkerPermissions) === false,
  "Worker cannot view disabled sales"
);

// Worker on enabled module can view and change execution status, but cannot edit task definition or delete
assert(
  canPerformModuleAction("tasks", "view", "worker", promptWorkerPermissions) === true,
  "Worker can view enabled tasks"
);
assert(
  canPerformModuleAction("tasks", "change_status", "worker", promptWorkerPermissions) === true,
  "Worker can update status on enabled tasks"
);
assert(
  canPerformModuleAction("tasks", "edit", "worker", promptWorkerPermissions) === false,
  "Worker CANNOT edit task definitions (Admin/Super Admin only)"
);
assert(
  canPerformModuleAction("tasks", "delete", "worker", promptWorkerPermissions) === false,
  "CRITICAL: Worker CANNOT permanently delete tasks"
);
assert(
  canPerformModuleAction("clients", "delete", "admin") === false,
  "CRITICAL: Admin CANNOT permanently delete clients (Delete is Super Admin exclusive)"
);

// Granular custom action overrides
const workerWithCustomActions: UserModulePermissions = {
  tasks: {
    enabled: true,
    actions: {
      approve: true,
      create: false,
    },
  },
};
assert(
  canPerformModuleAction("tasks", "approve", "worker", workerWithCustomActions) === true,
  "Worker with explicit approve grant can approve"
);
assert(
  canPerformModuleAction("tasks", "create", "worker", workerWithCustomActions) === false,
  "Worker with explicit create revoke cannot create"
);
assert(
  canPerformModuleAction("tasks", "delete", "worker", workerWithCustomActions) === false,
  "Worker cannot delete even if configured in custom actions"
);

console.log("\n============================================================");
console.log("🎉 ALL PERMISSION & ACCOUNT MANAGEMENT TESTS PASSED (100%)");
console.log("============================================================\n");
