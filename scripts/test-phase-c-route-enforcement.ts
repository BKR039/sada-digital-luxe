import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import {
  type SadaRole,
  type SadaModule,
  getEffectiveModulePermission,
  hasPermission,
  resolveModuleFromPath,
} from "../src/types/permissions";
import {
  evaluateRouteAccess,
  assertRouteAccess,
  resolveAuthoritativeSecurityContext,
  invalidateSecurityContextCache,
  type AuthoritativeSecurityContext,
  type SecurityErrorCode,
} from "../src/lib/security-isolation-service";
import {
  CANONICAL_ROUTE_REGISTRY,
  lookupRouteRegistry,
  evaluateRegistryRouteAccess,
  getAllProtectedRoutes,
  getRoutesForModule,
} from "../src/lib/route-permission-registry";
import { createAccount, deleteAccount, updateAccountPermissions } from "../src/lib/account-service";

let totalAssertions = 0;

function assert(condition: boolean, message: string) {
  totalAssertions++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  ✅ PASS: ${message}`);
}

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

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !anonKey) {
  console.error("Missing SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}

const superClient = createClient(supabaseUrl, anonKey);

async function runPhaseCRouteEnforcementSuite() {
  console.log("=======================================================================");
  console.log("SADA OS — PHASE C: REAL ROUTE & PAGE ENFORCEMENT TEST SUITE");
  console.log("=======================================================================\n");

  // 1. Authenticate Harness as Super Admin
  const { data: saLogin, error: saLoginErr } = await superClient.auth.signInWithPassword({
    email: "qa.superadmin@sada.agency",
    password: "SuperAdminPassword123!",
  });
  assert(!saLoginErr && Boolean(saLogin?.user), "Harness authenticated as Super Admin (qa.superadmin@sada.agency)");
  const superAdminUserId = saLogin!.user!.id;

  // 2. Ephemeral Test Users Setup
  // a) Plain Worker
  const workerEmail = `phasec.worker.${Date.now()}@sada.agency`;
  const provWorker = await createAccount(
    {
      email: workerEmail,
      password: "WorkerPassword123!",
      displayName: "PhaseC Test Worker",
      role: "worker",
      division: "Production",
      position: "Content Specialist",
      status: "active",
    },
    superClient
  );
  const workerUserId = provWorker.user_id;

  // b) Plain Admin
  const adminEmail = `phasec.admin.${Date.now()}@sada.agency`;
  const provAdmin = await createAccount(
    {
      email: adminEmail,
      password: "AdminPassword123!",
      displayName: "PhaseC Test Admin",
      role: "admin",
      division: "Operations",
      position: "Operations Lead",
      status: "active",
    },
    superClient
  );
  const adminUserId = provAdmin.user_id;

  // c) Finance-authorized Admin
  const finAdminEmail = `phasec.finadmin.${Date.now()}@sada.agency`;
  const provFinAdmin = await createAccount(
    {
      email: finAdminEmail,
      password: "AdminPassword123!",
      displayName: "PhaseC Finance Admin",
      role: "admin",
      division: "Finance",
      position: "Comptroller",
      status: "active",
      modulePermissions: { finance: { enabled: true } },
    },
    superClient
  );
  const finAdminUserId = provFinAdmin.user_id;

  try {
    // =====================================================================
    // GROUP 1: Canonical Route-to-Permission Registry
    // =====================================================================
    console.log("\n--- GROUP 1: Canonical Route-to-Permission Registry ---");

    const allRoutes = getAllProtectedRoutes();
    assert(allRoutes.length >= 25, `Canonical route registry populated with ${allRoutes.length} protected routes`);

    // Registry structure & mapping
    const launcherEntry = lookupRouteRegistry("/sada-os");
    assert(launcherEntry?.module === "dashboard", "/sada-os mapped to dashboard launcher");

    const overviewEntry = lookupRouteRegistry("/admin");
    assert(overviewEntry?.module === "dashboard", "/admin mapped to dashboard overview");

    const tasksEntry = lookupRouteRegistry("/admin/my-work");
    assert(tasksEntry?.module === "tasks" && tasksEntry.requiredPermission === "tasks.view", "/admin/my-work mapped to tasks.view");

    const financeEntry = lookupRouteRegistry("/admin/finance");
    assert(financeEntry?.module === "finance" && financeEntry.requiredPermission === "finance.view", "/admin/finance mapped to finance.view");

    const accountsEntry = lookupRouteRegistry("/admin/accounts");
    assert(accountsEntry?.superAdminOnly === true, "/admin/accounts marked superAdminOnly");

    const rulesEntry = lookupRouteRegistry("/admin/business-rules");
    assert(rulesEntry?.superAdminOnly === true, "/admin/business-rules marked superAdminOnly");

    const workflowsEntry = lookupRouteRegistry("/admin/workflow-templates");
    assert(workflowsEntry?.superAdminOnly === true, "/admin/workflow-templates marked superAdminOnly");

    // Deep link matching
    const clientDeepLink = lookupRouteRegistry("/admin/clients/client-abc-123");
    assert(clientDeepLink?.id === "admin-clients-detail" && clientDeepLink.classification === "deep_link", "/admin/clients/:id parameterized deep link resolved");

    const workspaceDeepLink = lookupRouteRegistry("/admin/client-projects/proj-xyz-789");
    assert(workspaceDeepLink?.id === "admin-workspaces-detail" && workspaceDeepLink.classification === "deep_link", "/admin/client-projects/:id parameterized deep link resolved");

    const cmsDeepLink = lookupRouteRegistry("/admin/projects/case-study-luxury");
    assert(cmsDeepLink?.id === "admin-cms-projects-detail", "/admin/projects/:id parameterized deep link resolved");

    // Legacy Aliases
    const dealsAlias = lookupRouteRegistry("/admin/deals");
    assert(dealsAlias?.classification === "alias" && dealsAlias.redirectTo === "/admin/sales", "/admin/deals recognized as alias to /admin/sales");

    const commissionsAlias = lookupRouteRegistry("/admin/commissions");
    assert(commissionsAlias?.classification === "alias" && commissionsAlias.redirectTo === "/admin/sales", "/admin/commissions recognized as alias to /admin/sales");

    const salaryAlias = lookupRouteRegistry("/admin/salary");
    assert(salaryAlias?.classification === "alias" && salaryAlias.redirectTo === "/admin/my-salary", "/admin/salary recognized as alias to /admin/my-salary");

    const rulesAlias = lookupRouteRegistry("/admin/settings/business-rules");
    assert(rulesAlias?.classification === "alias" && rulesAlias.redirectTo === "/admin/business-rules", "/admin/settings/business-rules recognized as alias to /admin/business-rules");

    // =====================================================================
    // GROUP 2: Anonymous / Unauthenticated Direct Navigation (Negative)
    // =====================================================================
    console.log("\n--- GROUP 2: Anonymous / Unauthenticated Direct URL Access ---");

    const anonContext: AuthoritativeSecurityContext = {
      authenticated: false,
      userId: "",
      email: "",
      role: "worker",
      status: "active",
      effectivePermissions: {} as any,
    };

    const anonAdmin = evaluateRouteAccess("/admin", anonContext);
    assert(!anonAdmin.allowed && anonAdmin.code === "UNAUTHENTICATED", "Anonymous -> /admin direct URL is DENIED (UNAUTHENTICATED)");

    const anonFinance = evaluateRouteAccess("/admin/finance", anonContext);
    assert(!anonFinance.allowed && anonFinance.code === "UNAUTHENTICATED", "Anonymous -> /admin/finance direct URL is DENIED (UNAUTHENTICATED)");

    const anonSales = evaluateRouteAccess("/admin/sales", anonContext);
    assert(!anonSales.allowed && anonSales.code === "UNAUTHENTICATED", "Anonymous -> /admin/sales direct URL is DENIED (UNAUTHENTICATED)");

    const anonLauncher = evaluateRouteAccess("/sada-os", anonContext);
    assert(!anonLauncher.allowed && anonLauncher.code === "UNAUTHENTICATED", "Anonymous -> /sada-os direct URL is DENIED (UNAUTHENTICATED)");

    const anonDeepLink = evaluateRouteAccess("/admin/client-projects/proj-secret", anonContext);
    assert(!anonDeepLink.allowed && anonDeepLink.code === "UNAUTHENTICATED", "Anonymous -> deep link /admin/client-projects/:id is DENIED (UNAUTHENTICATED)");

    let threwForAnon = false;
    try {
      assertRouteAccess("/admin/finance", anonContext);
    } catch (err: any) {
      threwForAnon = err.code === "UNAUTHENTICATED";
    }
    assert(threwForAnon, "assertRouteAccess throws SecurityAuthorizationError(UNAUTHENTICATED) for anonymous user");

    // =====================================================================
    // GROUP 3: Worker Without Permission Direct URL & Deep Link (Negative)
    // =====================================================================
    console.log("\n--- GROUP 3: Worker Without Permission Direct URL & Deep Link ---");

    const workerContext = await resolveAuthoritativeSecurityContext(superClient, workerUserId);

    const wrkSales = evaluateRouteAccess("/admin/sales", workerContext);
    assert(!wrkSales.allowed && wrkSales.code === "UNAUTHORIZED_ROUTE", "Worker without sales -> direct URL /admin/sales is DENIED");

    const wrkFinance = evaluateRouteAccess("/admin/finance", workerContext);
    assert(!wrkFinance.allowed && wrkFinance.code === "UNAUTHORIZED_ROUTE", "Worker without finance -> direct URL /admin/finance is DENIED");

    const wrkAccounts = evaluateRouteAccess("/admin/accounts", workerContext);
    assert(!wrkAccounts.allowed && wrkAccounts.code === "FORBIDDEN_ADMIN_ACTION", "Worker -> direct URL /admin/accounts is DENIED (FORBIDDEN_ADMIN_ACTION)");

    const wrkRules = evaluateRouteAccess("/admin/business-rules", workerContext);
    assert(!wrkRules.allowed && wrkRules.code === "FORBIDDEN_ADMIN_ACTION", "Worker -> direct URL /admin/business-rules is DENIED (FORBIDDEN_ADMIN_ACTION)");

    const wrkWorkflows = evaluateRouteAccess("/admin/workflow-templates", workerContext);
    assert(!wrkWorkflows.allowed && wrkWorkflows.code === "FORBIDDEN_ADMIN_ACTION", "Worker -> direct URL /admin/workflow-templates is DENIED (FORBIDDEN_ADMIN_ACTION)");

    const wrkWorkspaceDeepLink = evaluateRouteAccess("/admin/client-projects/proj-restricted-01", workerContext);
    assert(!wrkWorkspaceDeepLink.allowed && wrkWorkspaceDeepLink.code === "UNAUTHORIZED_ROUTE", "Worker without workspaces -> deep link /admin/client-projects/:id is DENIED");

    const wrkCmsDeepLink = evaluateRouteAccess("/admin/projects/case-study-vip", workerContext);
    assert(!wrkCmsDeepLink.allowed && wrkCmsDeepLink.code === "UNAUTHORIZED_ROUTE", "Worker without content CMS -> deep link /admin/projects/:id is DENIED");

    const wrkDealsAlias = evaluateRouteAccess("/admin/deals", workerContext);
    assert(!wrkDealsAlias.allowed && wrkDealsAlias.code === "UNAUTHORIZED_ROUTE", "Worker without sales -> legacy route /admin/deals is DENIED");

    const wrkCommissionsAlias = evaluateRouteAccess("/admin/commissions", workerContext);
    assert(!wrkCommissionsAlias.allowed && wrkCommissionsAlias.code === "UNAUTHORIZED_ROUTE", "Worker without sales -> legacy route /admin/commissions is DENIED");

    // =====================================================================
    // GROUP 4: Admin Without Permission Direct URL (Negative)
    // =====================================================================
    console.log("\n--- GROUP 4: Admin Without Permission Direct URL ---");

    const adminContext = await resolveAuthoritativeSecurityContext(superClient, adminUserId);

    const admFinance = evaluateRouteAccess("/admin/finance", adminContext);
    assert(!admFinance.allowed && admFinance.code === "UNAUTHORIZED_ROUTE", "Admin without finance grant -> /admin/finance is DENIED");

    const admAccounts = evaluateRouteAccess("/admin/accounts", adminContext);
    assert(!admAccounts.allowed && admAccounts.code === "FORBIDDEN_ADMIN_ACTION", "Admin -> /admin/accounts is DENIED (FORBIDDEN_ADMIN_ACTION)");

    const admRules = evaluateRouteAccess("/admin/business-rules", adminContext);
    assert(!admRules.allowed && admRules.code === "FORBIDDEN_ADMIN_ACTION", "Admin -> /admin/business-rules is DENIED (FORBIDDEN_ADMIN_ACTION)");

    const admRulesAlias = evaluateRouteAccess("/admin/settings/business-rules", adminContext);
    assert(!admRulesAlias.allowed && admRulesAlias.code === "FORBIDDEN_ADMIN_ACTION", "Admin -> /admin/settings/business-rules alias is DENIED (FORBIDDEN_ADMIN_ACTION)");

    // Revoke sales from Admin
    await updateAccountPermissions(adminUserId, {
      sales: { enabled: false },
    }, superClient);
    invalidateSecurityContextCache(adminUserId);

    const adminSalesRevoked = await resolveAuthoritativeSecurityContext(superClient, adminUserId);
    const admSalesRevokedCheck = evaluateRouteAccess("/admin/sales", adminSalesRevoked);
    assert(!admSalesRevokedCheck.allowed && admSalesRevokedCheck.code === "UNAUTHORIZED_ROUTE", "Admin with sales revoked -> /admin/sales is DENIED");

    const admDealsRevoked = evaluateRouteAccess("/admin/deals", adminSalesRevoked);
    assert(!admDealsRevoked.allowed && admDealsRevoked.code === "UNAUTHORIZED_ROUTE", "Admin with sales revoked -> legacy /admin/deals is DENIED");

    // =====================================================================
    // GROUP 5: Authorized Worker & Admin Navigation (Positive)
    // =====================================================================
    console.log("\n--- GROUP 5: Authorized Worker & Admin Navigation ---");

    const wrkTasks = evaluateRouteAccess("/admin/my-work", workerContext);
    assert(wrkTasks.allowed === true, "Authorized Worker -> /admin/my-work is ALLOWED");

    const wrkCalendar = evaluateRouteAccess("/admin/calendar", workerContext);
    assert(wrkCalendar.allowed === true, "Authorized Worker -> /admin/calendar is ALLOWED");

    const wrkClients = evaluateRouteAccess("/admin/clients", workerContext);
    assert(wrkClients.allowed === true, "Authorized Worker -> /admin/clients is ALLOWED");

    const wrkClientsDeepLink = evaluateRouteAccess("/admin/clients/client-legit-456", workerContext);
    assert(wrkClientsDeepLink.allowed === true, "Authorized Worker -> /admin/clients/:id is ALLOWED");

    const wrkSalary = evaluateRouteAccess("/admin/my-salary", workerContext);
    assert(wrkSalary.allowed === true, "Authorized Worker -> /admin/my-salary is ALLOWED");

    // Grant Worker Sales permission explicitly
    await updateAccountPermissions(workerUserId, {
      sales: { enabled: true, actions: { view: true, create_lead: true } },
    }, superClient);
    invalidateSecurityContextCache(workerUserId);

    const workerSalesGranted = await resolveAuthoritativeSecurityContext(superClient, workerUserId);
    const wrkSalesGrantedCheck = evaluateRouteAccess("/admin/sales", workerSalesGranted);
    assert(wrkSalesGrantedCheck.allowed === true, "Worker with explicit sales grant -> /admin/sales is ALLOWED");

    const wrkDealsGrantedCheck = evaluateRouteAccess("/admin/deals", workerSalesGranted);
    assert(wrkDealsGrantedCheck.allowed === true, "Worker with explicit sales grant -> legacy /admin/deals is ALLOWED");

    // Finance-Authorized Admin
    const finAdminContext = await resolveAuthoritativeSecurityContext(superClient, finAdminUserId);
    const finAdmFinance = evaluateRouteAccess("/admin/finance", finAdminContext);
    assert(finAdmFinance.allowed === true, "Finance-Authorized Admin -> /admin/finance is ALLOWED");

    const finAdmWorkspaces = evaluateRouteAccess("/admin/client-projects/proj-101", finAdminContext);
    assert(finAdmWorkspaces.allowed === true, "Authorized Admin -> /admin/client-projects/:id deep link is ALLOWED");

    // =====================================================================
    // GROUP 6: Super Admin Full Root Navigation (Positive Invariant)
    // =====================================================================
    console.log("\n--- GROUP 6: Super Admin Full Root Navigation ---");

    const saContext = await resolveAuthoritativeSecurityContext(superClient, superAdminUserId);

    const saLauncher = evaluateRouteAccess("/sada-os", saContext);
    assert(saLauncher.allowed === true, "Super Admin -> /sada-os is ALLOWED");

    const saOverview = evaluateRouteAccess("/admin", saContext);
    assert(saOverview.allowed === true, "Super Admin -> /admin is ALLOWED");

    const saAccounts = evaluateRouteAccess("/admin/accounts", saContext);
    assert(saAccounts.allowed === true, "Super Admin -> /admin/accounts is ALLOWED");

    const saRules = evaluateRouteAccess("/admin/business-rules", saContext);
    assert(saRules.allowed === true, "Super Admin -> /admin/business-rules is ALLOWED");

    const saWorkflows = evaluateRouteAccess("/admin/workflow-templates", saContext);
    assert(saWorkflows.allowed === true, "Super Admin -> /admin/workflow-templates is ALLOWED");

    const saFinance = evaluateRouteAccess("/admin/finance", saContext);
    assert(saFinance.allowed === true, "Super Admin -> /admin/finance is ALLOWED");

    const saDeepLink = evaluateRouteAccess("/admin/client-projects/super-secret-workspace", saContext);
    assert(saDeepLink.allowed === true, "Super Admin -> deep link /admin/client-projects/:id is ALLOWED");

    // =====================================================================
    // GROUP 7: Refresh & Session Protection Simulation
    // =====================================================================
    console.log("\n--- GROUP 7: Refresh & Session Protection Simulation ---");

    // Fresh resolution simulates page reload/refresh
    invalidateSecurityContextCache(workerUserId);
    const refreshedWorker = await resolveAuthoritativeSecurityContext(superClient, workerUserId);
    const refreshedFinanceDenied = evaluateRouteAccess("/admin/finance", refreshedWorker);
    assert(!refreshedFinanceDenied.allowed, "Page refresh on /admin/finance for worker remains strictly DENIED");

    invalidateSecurityContextCache(finAdminUserId);
    const refreshedFinAdmin = await resolveAuthoritativeSecurityContext(superClient, finAdminUserId);
    const refreshedFinanceAllowed = evaluateRouteAccess("/admin/finance", refreshedFinAdmin);
    assert(refreshedFinanceAllowed.allowed, "Page refresh on /admin/finance for Finance Admin remains ALLOWED");

    // Suspended Account Refresh
    const suspendedContext: AuthoritativeSecurityContext = {
      authenticated: true,
      userId: workerUserId,
      email: workerEmail,
      role: "worker",
      status: "suspended",
      effectivePermissions: { tasks: true } as any,
    };
    const suspendedRefresh = evaluateRouteAccess("/admin/my-work", suspendedContext);
    assert(!suspendedRefresh.allowed && suspendedRefresh.code === "ACCOUNT_SUSPENDED", "Page refresh on /admin/my-work for suspended user is DENIED (ACCOUNT_SUSPENDED)");

    // =====================================================================
    // GROUP 8: Performance & Access-Context Caching
    // =====================================================================
    console.log("\n--- GROUP 8: Performance & Access-Context Caching ---");

    const t0 = performance.now();
    const ctx1 = await resolveAuthoritativeSecurityContext(superClient, workerUserId);
    const initialElapsed = performance.now() - t0;

    const t1 = performance.now();
    const ctx2 = await resolveAuthoritativeSecurityContext(superClient, workerUserId);
    const cachedElapsed = performance.now() - t1;

    assert(cachedElapsed <= 5, `In-memory cached context resolution executed in ${cachedElapsed.toFixed(2)}ms (<= 5ms target)`);
    assert(cachedElapsed <= initialElapsed, `Cached lookup (${cachedElapsed.toFixed(2)}ms) was faster than fresh query (${initialElapsed.toFixed(2)}ms)`);
    assert(ctx1.userId === ctx2.userId, "Cached context identity matches fresh context");

  } finally {
    console.log("\nCleaning up ephemeral test accounts...");
    await deleteAccount(workerUserId, superClient).catch(() => {});
    await deleteAccount(adminUserId, superClient).catch(() => {});
    await deleteAccount(finAdminUserId, superClient).catch(() => {});
    console.log("Cleanup completed.");
  }

  console.log("\n=======================================================================");
  console.log(`TOTAL PHASE C ASSERTIONS: ${totalAssertions} | ALL PASSED (100% SUCCESS)`);
  console.log("=======================================================================\n");
}

runPhaseCRouteEnforcementSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
