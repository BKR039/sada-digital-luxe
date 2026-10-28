import fs from "fs";
import path from "path";

// 1. Initialize Environment
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let val = (match[2] || "").trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      process.env[match[1]] = val;
    }
  }
}

import { supabase } from "../src/integrations/supabase/client";
import {
  SADA_MODULES,
  ROLE_DEFAULT_MODULE_PERMISSIONS,
  getEffectiveModulePermission,
  getEffectiveActionPermission,
  hasPermission,
  type UserModulePermissions,
  type SadaModule,
} from "../src/types/permissions";
import {
  evaluateRouteAccess,
  resolveAuthoritativeSecurityContext,
  type AuthoritativeSecurityContext,
} from "../src/lib/security-isolation-service";
import {
  fetchUserModulePermissions,
  updateAccountPermissions,
} from "../src/lib/account-service";
import { fetchManagementAnalytics } from "../src/lib/analytics-service";
import { fetchCompanyFinance, getPresetPeriod } from "../src/lib/finance-service";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

// Emulate admin.tsx ALL_NAV_ITEMS and navItems filter
const ALL_NAV_ITEMS = [
  { to: "/admin", workerVisible: true, module: "dashboard", section: "operations" },
  { to: "/admin/my-work", workerVisible: true, module: "tasks", section: "operations" },
  { to: "/admin/client-workspaces", workerVisible: true, module: "clients", section: "operations" },
  { to: "/admin/sales", workerVisible: true, module: "sales", section: "operations" },
  { to: "/admin/calendar", workerVisible: true, module: "calendar", section: "operations" },
  { to: "/admin/team-workload", workerVisible: false, module: "team", section: "operations" },
  { to: "/admin/packages", workerVisible: false, module: "packages", section: "operations" },
  { to: "/admin/analytics", workerVisible: false, module: "analytics", section: "operations" },
  { to: "/admin/accounts", superAdminOnly: true, module: "accounts", section: "operations" },
  { to: "/admin/finance", workerVisible: false, module: "finance", section: "finance" },
  { to: "/admin/my-salary", workerVisible: true, workerOnly: true, module: "compensation", section: "finance" },
];

function filterNavItems(
  role: "super_admin" | "admin" | "worker",
  overrides?: UserModulePermissions | null
) {
  const isSuperAdmin = role === "super_admin";
  const isWorker = role === "worker";
  const canAccessModule = (mod: SadaModule) => getEffectiveModulePermission(mod, role, overrides);

  return ALL_NAV_ITEMS.filter((item) => {
    if (item.module && !canAccessModule(item.module as SadaModule)) return false;
    if (item.superAdminOnly && !isSuperAdmin) return false;
    if (item.workerOnly && isSuperAdmin) return false;
    // Updated line from admin.tsx:
    if (isWorker && !item.workerVisible && (!item.module || !canAccessModule(item.module as SadaModule))) return false;
    return true;
  });
}

async function runRegressionSuite() {
  console.log("============================================================");
  console.log("P1 BUG REGRESSION SUITE: ANALYTICS CUSTOM MODULE PERMISSION");
  console.log("============================================================\n");

  const workerEmail = "qa.worker@sada.agency";
  const workerPassword = "WorkerPassword123!";
  const saEmail = "qa.superadmin@sada.agency";
  const saPassword = "SuperAdminPassword123!";

  // Authenticate SA and resolve accounts
  console.log("--- 0. Setup & Identity Verification ---");
  const { data: saLogin, error: saErr } = await supabase.auth.signInWithPassword({
    email: saEmail,
    password: saPassword,
  });
  assert(!saErr && !!saLogin.user, "Super Admin authenticated successfully");

  const { data: accounts } = await (supabase as any).rpc("admin_list_accounts");
  const qaWorker = (accounts || []).find((a: any) => a.email === workerEmail);
  assert(!!qaWorker, `Located QA Worker account: ${qaWorker?.user_id} (${qaWorker?.role})`);

  const bkrAccount = (accounts || []).find((a: any) => a.display_name === "BKR039" || a.email === "boubakarhamedsgail@gmail.com");
  assert(!!bkrAccount, `Located target user BKR039: ${bkrAccount?.user_id} (${bkrAccount?.role})`);

  // TEST 1: Worker without Analytics permission cannot access /admin/analytics
  console.log("\n--- TEST 1: Worker without Analytics Permission ---");
  const emptyOverrides: UserModulePermissions = {};
  assert(
    getEffectiveModulePermission("analytics", "worker", emptyOverrides) === false,
    "Worker default has no access to analytics module"
  );
  assert(
    hasPermission("analytics.view", "worker", emptyOverrides) === false,
    "Worker default has no analytics.view action permission"
  );

  const secCtxNoPerm: AuthoritativeSecurityContext = {
    authenticated: true,
    userId: qaWorker.user_id,
    email: workerEmail,
    role: "worker",
    status: "active",
    effectivePermissions: {
      analytics: false,
      dashboard: true,
      tasks: true,
    } as any,
    customOverrides: emptyOverrides,
  };
  const evalBlocked = evaluateRouteAccess("/admin/analytics", secCtxNoPerm);
  assert(evalBlocked.allowed === false, "evaluateRouteAccess blocks unauthorized worker from /admin/analytics");
  assert(evalBlocked.code === "UNAUTHORIZED_ROUTE", "Returns UNAUTHORIZED_ROUTE error code");

  const navNoPerm = filterNavItems("worker", emptyOverrides);
  assert(!navNoPerm.some((n) => n.to === "/admin/analytics"), "Analytics nav item is NOT present for worker without grant");

  // TEST 2 & 3: Worker with explicit analytics.view grant sees nav item and can access route
  console.log("\n--- TEST 2 & 3: Worker with Explicit analytics.view Grant ---");
  const analyticsGrantedOverrides: UserModulePermissions = {
    analytics: {
      enabled: true,
      actions: { view: true },
    },
  };
  assert(
    getEffectiveModulePermission("analytics", "worker", analyticsGrantedOverrides) === true,
    "Worker with grant resolves effectiveModulePermission('analytics') === true"
  );
  assert(
    hasPermission("analytics.view", "worker", analyticsGrantedOverrides) === true,
    "Worker with grant resolves hasPermission('analytics.view') === true"
  );

  const navWithPerm = filterNavItems("worker", analyticsGrantedOverrides);
  assert(navWithPerm.some((n) => n.to === "/admin/analytics"), "Analytics nav item APPEARS in sidebar for authorized worker");
  const analyticsNavItem = navWithPerm.find((n) => n.to === "/admin/analytics");
  assert(analyticsNavItem?.section === "operations", "Analytics nav item resides in operations section");

  const secCtxGranted: AuthoritativeSecurityContext = {
    authenticated: true,
    userId: qaWorker.user_id,
    email: workerEmail,
    role: "worker",
    status: "active",
    effectivePermissions: {
      analytics: true,
      dashboard: true,
      tasks: true,
    } as any,
    customOverrides: analyticsGrantedOverrides,
  };
  const evalAllowed = evaluateRouteAccess("/admin/analytics", secCtxGranted);
  assert(evalAllowed.allowed === true, "evaluateRouteAccess ALLOWS authorized worker to access /admin/analytics");
  assert(evalAllowed.module === "analytics", "Route evaluator correctly resolves canonical module 'analytics'");

  // TEST 4 & 6: Super Admin grants permission via RPC and database persists
  console.log("\n--- TEST 4 & 6: Super Admin Save & Persistence Verification ---");
  await updateAccountPermissions(
    qaWorker.user_id,
    analyticsGrantedOverrides,
    supabase,
    undefined,
    { reason: "QA regression: granting analytics to test persistence" }
  );
  console.log("Saved permissions via updateAccountPermissions RPC.");

  // Fresh database read directly from public.user_module_permissions
  const { data: umpRows, error: umpErr } = await (supabase as any)
    .from("user_module_permissions")
    .select("module, enabled, actions")
    .eq("user_id", qaWorker.user_id)
    .eq("module", "analytics");
  assert(!umpErr && umpRows?.length === 1, "public.user_module_permissions row written for analytics");
  assert(umpRows![0].enabled === true, "Persisted row has enabled === true");
  assert(umpRows![0].actions?.view === true, "Persisted row has actions.view === true");

  // Re-read via fetchUserModulePermissions
  const fetched = await fetchUserModulePermissions(qaWorker.user_id, supabase);
  assert(Boolean(fetched?.analytics), "fetchUserModulePermissions returns analytics grant");
  assert(getEffectiveModulePermission("analytics", "worker", fetched) === true, "Re-read permissions compute effective access as true");

  // TEST 5: Revoking the grant removes navigation and denies direct route access
  console.log("\n--- TEST 5: Revocation Removes Access ---");
  await updateAccountPermissions(
    qaWorker.user_id,
    { analytics: false },
    supabase,
    undefined,
    { reason: "QA regression: revoking analytics" }
  );
  console.log("Revoked permissions via updateAccountPermissions RPC.");

  const postRevokePerms = await fetchUserModulePermissions(qaWorker.user_id, supabase);
  assert(
    getEffectiveModulePermission("analytics", "worker", postRevokePerms) === false,
    "Effective permission resolves to false immediately after revocation"
  );
  const navPostRevoke = filterNavItems("worker", postRevokePerms);
  assert(!navPostRevoke.some((n) => n.to === "/admin/analytics"), "Analytics navigation item REMOVED from sidebar after revocation");

  const secCtxRevoked: AuthoritativeSecurityContext = {
    authenticated: true,
    userId: qaWorker.user_id,
    email: workerEmail,
    role: "worker",
    status: "active",
    effectivePermissions: {
      analytics: false,
    } as any,
    customOverrides: postRevokePerms,
  };
  const evalRevoked = evaluateRouteAccess("/admin/analytics", secCtxRevoked);
  assert(evalRevoked.allowed === false, "Direct route access DENIED after revocation");

  // TEST 7: Unauthorized users cannot modify permissions
  console.log("\n--- TEST 7: Privilege Escalation Defense ---");
  // Sign in as worker and attempt to invoke updateAccountPermissions
  const { data: wLogin } = await supabase.auth.signInWithPassword({
    email: workerEmail,
    password: workerPassword,
  });
  assert(!!wLogin.user, "Worker authenticated for mutation test");

  try {
    await updateAccountPermissions(
      qaWorker.user_id,
      { analytics: true },
      supabase
    );
    console.error("❌ FAILED: Worker was able to modify account permissions!");
    process.exit(1);
  } catch (err: any) {
    console.log("✅ PASSED: Worker blocked from modifying permissions:", err.message);
  }

  // TEST 8: Granting Analytics does NOT grant Finance, Accounts, or Business Rules
  console.log("\n--- TEST 8: Module Isolation & Boundary Defense ---");
  assert(
    getEffectiveModulePermission("finance", "worker", analyticsGrantedOverrides) === false,
    "Granting analytics does NOT grant finance"
  );
  assert(
    getEffectiveModulePermission("accounts", "worker", analyticsGrantedOverrides) === false,
    "Granting analytics does NOT grant accounts"
  );
  assert(
    getEffectiveModulePermission("business_rules", "worker", analyticsGrantedOverrides) === false,
    "Granting analytics does NOT grant business_rules"
  );
  assert(
    getEffectiveModulePermission("workflows", "worker", analyticsGrantedOverrides) === false,
    "Granting analytics does NOT grant workflows"
  );

  const evalFinance = evaluateRouteAccess("/admin/finance", secCtxGranted);
  assert(evalFinance.allowed === false, "Direct access to /admin/finance is PROHIBITED for analytics-only worker");

  const evalAccounts = evaluateRouteAccess("/admin/accounts", secCtxGranted);
  assert(evalAccounts.allowed === false, "Direct access to /admin/accounts is PROHIBITED for analytics-only worker");

  // Re-grant analytics to QA Worker for data layer test
  await supabase.auth.signInWithPassword({
    email: saEmail,
    password: saPassword,
  });
  await updateAccountPermissions(qaWorker.user_id, analyticsGrantedOverrides, supabase);

  // Authenticate as QA Worker
  await supabase.auth.signInWithPassword({
    email: workerEmail,
    password: workerPassword,
  });

  // Direct fetchCompanyFinance MUST FAIL
  try {
    await fetchCompanyFinance(getPresetPeriod("this_month"));
    console.error("❌ FAILED: Direct fetchCompanyFinance did NOT throw for analytics-only worker!");
    process.exit(1);
  } catch (err: any) {
    console.log("✅ PASSED: Direct fetchCompanyFinance strictly blocked for analytics-only worker:", err.message);
  }

  // TEST 9 & 10: Analytics Data Loader and Server-Side Authorization
  console.log("\n--- TEST 9 & 10: Analytics Data Loader Execution & Audit ---");
  const analyticsData = await fetchManagementAnalytics({ periodType: "this_month" });
  assert(!!analyticsData, "fetchManagementAnalytics executed successfully for authorized worker");
  assert(!!analyticsData.executiveKPIs, "Loaded executive KPIs structure");
  assert(!!analyticsData.clientProfitability, "Loaded client profitability data");
  assert(!!analyticsData.revenueTrends, "Loaded revenue trends");

  // Verify target user BKR039 state in database (re-authenticate as Super Admin)
  console.log("\n--- BKR039 Target Account Final Verification ---");
  await supabase.auth.signInWithPassword({
    email: saEmail,
    password: saPassword,
  });
  const bkrPerms = await fetchUserModulePermissions(bkrAccount.user_id, supabase);
  const bkrEffectiveMod = getEffectiveModulePermission("analytics", bkrAccount.role, bkrPerms);
  const bkrHasView = hasPermission("analytics.view", bkrAccount.role, bkrPerms);
  assert(bkrEffectiveMod === true, "BKR039 target account has effective analytics module permission === true");
  assert(bkrHasView === true, "BKR039 target account has analytics.view permission === true");

  const bkrNav = filterNavItems("worker", bkrPerms);
  assert(bkrNav.some((n) => n.to === "/admin/analytics"), "BKR039 sidebar navigation CONTAINS Analytics & KPIs");

  const bkrSecCtx: AuthoritativeSecurityContext = {
    authenticated: true,
    userId: bkrAccount.user_id,
    email: bkrAccount.email,
    role: bkrAccount.role,
    status: bkrAccount.status,
    effectivePermissions: {
      analytics: true,
    } as any,
    customOverrides: bkrPerms,
  };
  const bkrRoute = evaluateRouteAccess("/admin/analytics", bkrSecCtx);
  assert(bkrRoute.allowed === true, "BKR039 direct route access to /admin/analytics is ALLOWED");

  // Cleanup QA Worker permissions
  await supabase.auth.signInWithPassword({
    email: saEmail,
    password: saPassword,
  });
  await updateAccountPermissions(qaWorker.user_id, {}, supabase);

  console.log("\n============================================================");
  console.log("🎉 ALL 10 REGRESSION & SECURITY INVARIANT TESTS PASSED!");
  console.log("============================================================\n");
}

runRegressionSuite().catch((err) => {
  console.error("FATAL ERROR in regression suite:", err);
  process.exit(1);
});
