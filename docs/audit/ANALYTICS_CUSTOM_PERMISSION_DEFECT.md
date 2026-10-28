# P1 Defect Audit: Custom Module Permission Does Not Grant Analytics Route Access

**Defect ID:** P1-PERM-ANALYTICS-ACCESS  
**Module:** SADA OS Permissions & SADA Intelligence (`/admin/analytics`)  
**Target Account:** `BKR039` (`boubakarhamedsgail@gmail.com`, User ID: `560fd7c4-c38b-4562-8f9d-95729dfb2bab`, Role: `worker`)  
**Status:** **RESOLVED & VERIFIED** (Database, Service, Route, UI, Browser UX, Regression 10/10 PASS)  
**Date:** 2026-10-11  

---

## 1. Executive Summary & Defect Lifecycle Trace

### Context
A Super Admin navigated to `/admin/accounts`, selected target account `BKR039` (role: `worker`), opened the Module Permissions panel, toggled the **Analytics & KPIs** module (`/admin/analytics`) to enabled, toggled its `analytics.view` action override to enabled, and saved changes. The database and UI reported success. However, when logging in as `BKR039`, the Analytics & KPIs page did not appear in the sidebar, direct navigation redirected to `/admin/my-work`, and underlying analytics data access was blocked.

### Complete Permission Lifecycle Trace

| Lifecycle Stage | Expected Behavior | Pre-Fix Status | Root Cause & Resolution |
|---|---|---|---|
| **1. Permission Editor (`AccountPermissionsPanel.tsx`)** | Renders module toggle and `analytics.view` action switch | ✅ Functional | Form correctly tracked `{ analytics: { enabled: true, actions: { view: true } } }`. |
| **2. Save Handler (`account-service.ts`)** | Invokes `admin_update_account_permissions` RPC | ✅ Functional | RPC received parameters and committed row to `public.user_module_permissions`. |
| **3. Authorization Service (`security-isolation-service.ts`)** | Verifies Super Admin authority | ✅ Functional | Super Admin authority verified; unauthorized worker mutations strictly blocked. |
| **4. Database Persistence** | Stores in `user_module_permissions` & projections | ✅ Functional | Canonical row `module = 'analytics'`, `enabled = true`, `actions = { view: true }` persisted; `profiles.module_permissions` projection synchronized. |
| **5. Effective Permission Resolver (`permissions.ts`)** | Resolves `getEffectiveModulePermission("analytics", "worker", overrides)` | ✅ Functional | Resolver correctly computed `true` via override. |
| **6. Cache & Session Refresh (`auth.tsx`)** | Loads `customModulePermissions` into context | ✅ Functional | Auth provider loaded custom permissions on session initialization and refresh. |
| **7. Sidebar Navigation Filter (`admin.tsx`)** | Shows `/admin/analytics` in navigation rail | ❌ **FAIL (Layer 1)** | `admin.tsx` had a hardcoded filter `if (isWorker && !item.workerVisible) return false;` which dropped items with `workerVisible: false` regardless of whether the worker held an explicit custom permission override! |
| **8. Route Guard (`admin.analytics.tsx`)** | Allows authorized worker into route | ❌ **FAIL (Layer 2)** | Route had unconditional guard `if (!authLoading && isWorker) nav({ to: "/admin/my-work" });` which redirected workers to `/admin/my-work`. |
| **9. Page Shield (`admin.analytics.tsx`)** | Renders analytics command center | ❌ **FAIL (Layer 3)** | Component contained a hardcoded role guard `if (isWorker || (!isSuperAdmin && !isAdmin))` rendering a static `"Restricted Executive Analytics"` block. |
| **10. Data Layer Access (`analytics-service.ts` / `finance-service.ts`)** | Loads executive KPIs & profitability data | ❌ **FAIL (Layer 4)** | `fetchManagementAnalytics()` called `fetchCompanyFinance()` which required `finance.view`. A user granted `analytics` but not `finance` failed with `Unauthorized: Access to module 'finance' is disabled`. |

---

## 2. Root Cause Analysis Across Architectural Layers

The investigation revealed that the defect was **not** caused by database persistence failures or permission resolver logic, but rather by **layered hardcoded role assumptions** that bypassed the granular permission architecture:

### Layer 1: Sidebar Navigation Item Suppression (`src/routes/admin.tsx`)
In `src/routes/admin.tsx`, navigation items were filtered using:
```typescript
// PRE-FIX:
if (isWorker && !item.workerVisible) return false;
```
Because `/admin/analytics` defines `workerVisible: false` in `ALL_NAV_ITEMS`, this check unconditionally stripped the Analytics link from all workers, completely disregarding the user's `canAccessModule(item.module)` override.

### Layer 2: Client Route Guard Redirection (`src/routes/admin.analytics.tsx`)
In `src/routes/admin.analytics.tsx`, the route component mounted an unconditional redirect:
```typescript
// PRE-FIX:
useEffect(() => {
  if (!authLoading && isWorker) {
    nav({ to: "/admin/my-work" });
  }
}, [authLoading, isWorker, nav]);
```
Workers navigating directly to `/admin/analytics` were bounced back to `/admin/my-work` before any permission check could be evaluated.

### Layer 3: Component Guard & Missing Shield Component (`src/routes/admin.analytics.tsx`)
Even if the redirect were bypassed, the page component had a second hardcoded role check:
```typescript
// PRE-FIX:
if (isWorker || (!isSuperAdmin && !isAdmin)) {
  return (
    <div className="min-h-screen p-8 text-center">
      <h2>Restricted Executive Analytics</h2>
      <p>This command deck is restricted to agency leadership.</p>
    </div>
  );
}
```
This hardcoded block did not use the canonical `<ModuleAccessShield module="analytics" />` component and failed to consult `canAccessModule("analytics")` or `hasPermission("analytics.view")`.

### Layer 4: Data Layer Isolation Conflict (`src/lib/finance-service.ts` & `src/lib/analytics-service.ts`)
The Analytics command center relies on financial aggregates computed via `fetchCompanyFinance(period)`.
However, `fetchCompanyFinance` called `resolveFinanceCallerContext()`, which asserted that the user possessed the `finance.view` action permission:
```typescript
// PRE-FIX:
assertAuthorizedMutation(supabase, "finance", "finance.view", { ctx, actorId: user.id });
```
When an account like `BKR039` was granted `analytics` without being granted full access to the `finance` module (e.g. general ledger, cash transactions, treasury balances), `fetchCompanyFinance` threw `Unauthorized: Access to module 'finance' is disabled for this account`.

### Layer 5: Global Search & Executive Overview Inconsistencies
- `src/components/admin/GlobalSearchModal.tsx`: Hardcoded `canAccessFinancials = isSuperAdmin || isAdmin;` rather than checking `canAccessModule("analytics")`.
- `src/routes/admin.index.tsx`: Restricted executive KPI toggle on the Overview page to `isSuperAdmin || isAdmin`.

---

## 3. Architecture-Preserving Code Remediations

### 1. Sidebar Item Filter (`src/routes/admin.tsx`)
Updated the navigation item filter so that `workerVisible: false` only applies if the worker has **not** been granted access to that module:
```typescript
// POST-FIX:
if (isWorker && !item.workerVisible && (!item.module || !canAccessModule(item.module))) return false;
```

### 2. Route Guard & Component Authorization (`src/routes/admin.analytics.tsx`)
- Imported `hasPermission` from `@/types/permissions` and `ModuleAccessShield` from `@/components/admin/ModuleAccessShield`.
- Defined canonical effective check:
  ```typescript
  const canAccessAnalytics =
    isSuperAdmin ||
    (canAccessModule("analytics") &&
      hasPermission("analytics.view", role || "worker", customModulePermissions));
  ```
- Replaced the hardcoded worker redirect with:
  ```typescript
  useEffect(() => {
    if (!authLoading && !canAccessAnalytics) {
      nav({ to: "/admin/my-work" });
    }
  }, [authLoading, canAccessAnalytics, nav]);
  ```
- Replaced the hardcoded shield with canonical SADA Design System shield:
  ```typescript
  if (!canAccessAnalytics) {
    return <ModuleAccessShield module="analytics" />;
  }
  ```

### 3. Server Authorization Context Pass-Through (`src/lib/finance-service.ts`)
Updated `resolveFinanceCallerContext()` and `fetchCompanyFinance()` to accept an optional parameter `options?: { allowAnalyticsRead?: boolean }`.
- Direct invocations from the `/admin/finance` route continue to strictly assert `finance.view`.
- Aggregation queries originating from `fetchManagementAnalytics` pass `{ allowAnalyticsRead: true }`.
- If `allowAnalyticsRead` is true and the caller lacks `finance.view`, the gateway explicitly asserts:
  ```typescript
  await assertAuthorizedMutation(supabase, "analytics", "analytics.view", { ctx, actorId: user.id });
  ```
- This ensures workers granted `analytics` can read executive metrics while preserving complete multi-tenant isolation, database RLS, and strict prevention of direct finance module access.

### 4. Search Modal & Overview Dashboard (`GlobalSearchModal.tsx`, `admin.index.tsx`)
- Updated `GlobalSearchModal.tsx` to check `canAccessModule("analytics")` and `canAccessModule("finance")` for quick links.
- Updated `admin.index.tsx` to allow executive metrics switching for users with `canAccessModule("analytics")`.

---

## 4. Database Persistence Verification for Target User BKR039

Target user resolution and fresh database query executed via `scripts/diagnose-analytics-defect.ts`:

```json
{
  "user_id": "560fd7c4-c38b-4562-8f9d-95729dfb2bab",
  "email": "boubakarhamedsgail@gmail.com",
  "display_name": "BKR039",
  "role": "worker",
  "status": "active"
}
```

### Direct Table State in `public.user_module_permissions`:
```json
[
  {
    "id": "2b293d9c-6b37-4d13-96d1-16a72783fe1f",
    "user_id": "560fd7c4-c38b-4562-8f9d-95729dfb2bab",
    "module": "analytics",
    "enabled": true,
    "actions": {
      "view": true,
      "edit": true,
      "create": true
    },
    "created_at": "2026-10-11T08:22:48.366359+00:00",
    "updated_at": "2026-10-11T08:22:48.366359+00:00"
  }
]
```

### Projection Cache in `public.profiles.module_permissions`:
```json
{
  "analytics": {
    "enabled": true,
    "actions": {
      "view": true,
      "edit": true,
      "create": true
    }
  }
}
```

### Effective Permission Computation:
- `getEffectiveModulePermission("analytics", "worker", overrides)` $\rightarrow$ `true`
- `getEffectiveActionPermission("analytics", "view", "worker", overrides)` $\rightarrow$ `{ enabled: true, source: "override", isOverride: true }`
- `hasPermission("analytics.view", "worker", overrides)` $\rightarrow$ `true`
- `evaluateRouteAccess("/admin/analytics", context)` $\rightarrow$ `{ allowed: true, module: "analytics" }`

---

## 5. Live Browser Automation & Visual Evidence

Real headless Chromium session executed via `scripts/verify-browser-analytics-permission.ts` against the live SADA OS dev server (`http://localhost:3000`):

1. **Step 1: Super Admin Grants Permission via Database RPC**
   - Successfully called `admin_update_account_permissions` for worker.
2. **Step 2: Worker Logs In via `/auth`**
   - Filled email and password, submitted form, redirected to `/sada-os`.
3. **Step 3: Sidebar Inspection at `/admin`**
   - Sidebar evaluated `hasAnalytics: true`.
   - Link text: `"Analytics & Executive KPIs"`, `href: "/admin/analytics"`.
   - Screenshot captured: `scripts/screenshots/worker_sidebar_analytics_visible.png`.
4. **Step 4: Direct Navigation to `/admin/analytics`**
   - Successfully navigated to `/admin/analytics`.
   - Page rendered full executive command center without error banners or redirects.
   - Evaluated `hasAnalyticsContent: true` (`"Executive Command Center"`, `"Recognized Revenue"`, `"Net Profit"`).
   - Screenshot captured: `scripts/screenshots/worker_analytics_page_loaded.png`.
5. **Step 5: Super Admin Revocation Enforcement**
   - Super Admin revoked `analytics` module in DB (`analytics: false`).
   - Browser reloaded `/admin/analytics`.
   - Evaluated `isShieldDisplayed: true`, `isBlocked: true`.
   - Displayed `<ModuleAccessShield module="analytics" />` with `"ACCESS PROHIBITED - Analytics & KPIs is Restricted"`.
   - Screenshot captured: `scripts/screenshots/worker_analytics_revocation_denied.png`.

---

## 6. Comprehensive Regression & Invariant Test Suite Results

Test script `scripts/test-analytics-custom-permission-regression.ts` executed and verified all 10 core invariants:

```
============================================================
P1 BUG REGRESSION SUITE: ANALYTICS CUSTOM MODULE PERMISSION
============================================================

--- 0. Setup & Identity Verification ---
✅ PASSED: Super Admin authenticated successfully
✅ PASSED: Located QA Worker account: 77f7a3d3-82c1-4744-8f01-0a1fd5f44bba (worker)
✅ PASSED: Located target user BKR039: 560fd7c4-c38b-4562-8f9d-95729dfb2bab (worker)

--- TEST 1: Worker without Analytics Permission ---
✅ PASSED: Worker default has no access to analytics module
✅ PASSED: Worker default has no analytics.view action permission
✅ PASSED: evaluateRouteAccess blocks unauthorized worker from /admin/analytics
✅ PASSED: Returns UNAUTHORIZED_ROUTE error code
✅ PASSED: Analytics nav item is NOT present for worker without grant

--- TEST 2 & 3: Worker with Explicit analytics.view Grant ---
✅ PASSED: Worker with grant resolves effectiveModulePermission('analytics') === true
✅ PASSED: Worker with grant resolves hasPermission('analytics.view') === true
✅ PASSED: Analytics nav item APPEARS in sidebar for authorized worker
✅ PASSED: Analytics nav item resides in operations section
✅ PASSED: evaluateRouteAccess ALLOWS authorized worker to access /admin/analytics
✅ PASSED: Route evaluator correctly resolves canonical module 'analytics'

--- TEST 4 & 6: Super Admin Save & Persistence Verification ---
Saved permissions via updateAccountPermissions RPC.
✅ PASSED: public.user_module_permissions row written for analytics
✅ PASSED: Persisted row has enabled === true
✅ PASSED: Persisted row has actions.view === true
✅ PASSED: fetchUserModulePermissions returns analytics grant
✅ PASSED: Re-read permissions compute effective access as true

--- TEST 5: Revocation Removes Access ---
Revoked permissions via updateAccountPermissions RPC.
✅ PASSED: Effective permission resolves to false immediately after revocation
✅ PASSED: Analytics navigation item REMOVED from sidebar after revocation
✅ PASSED: Direct route access DENIED after revocation

--- TEST 7: Privilege Escalation Defense ---
✅ PASSED: Worker authenticated for mutation test
✅ PASSED: Worker blocked from modifying permissions: Unauthorized: Account management is strictly Super Admin exclusive.

--- TEST 8: Module Isolation & Boundary Defense ---
✅ PASSED: Granting analytics does NOT grant finance
✅ PASSED: Granting analytics does NOT grant accounts
✅ PASSED: Granting analytics does NOT grant business_rules
✅ PASSED: Granting analytics does NOT grant workflows
✅ PASSED: Direct access to /admin/finance is PROHIBITED for analytics-only worker
✅ PASSED: Direct access to /admin/accounts is PROHIBITED for analytics-only worker
✅ PASSED: Direct fetchCompanyFinance strictly blocked for analytics-only worker: Unauthorized: Access to module 'finance' is disabled for this account.

--- TEST 9 & 10: Analytics Data Loader Execution & Audit ---
✅ PASSED: fetchManagementAnalytics executed successfully for authorized worker
✅ PASSED: Loaded executive KPIs structure
✅ PASSED: Loaded client profitability data
✅ PASSED: Loaded revenue trends

--- BKR039 Target Account Final Verification ---
✅ PASSED: BKR039 target account has effective analytics module permission === true
✅ PASSED: BKR039 target account has analytics.view permission === true
✅ PASSED: BKR039 sidebar navigation CONTAINS Analytics & KPIs
✅ PASSED: BKR039 direct route access to /admin/analytics is ALLOWED

============================================================
🎉 ALL 10 REGRESSION & SECURITY INVARIANT TESTS PASSED!
============================================================
```

---

## 7. Verification Cleanliness Gates

- `npx tsc --noEmit`: **0 errors** (Clean exit code 0)
- `npm run build`: **0 errors** (Vite v7.3.6 client bundle + Nitro SSR production build completed cleanly in 13.83s)
- **Role Isolation Preserved**: Target account `BKR039` retained the `worker` role; no accounts were elevated to Admin/Super Admin to bypass checks.
- **Data Boundary Preserved**: Workers granted `analytics` can only read executive aggregate KPIs through `fetchManagementAnalytics`; direct mutations or route access to `/admin/finance` or `/admin/accounts` remain strictly blocked.

---

## 8. Summary of Affected Files

1. `src/routes/admin.tsx`: Fixed sidebar item filter to consider `canAccessModule(item.module)`.
2. `src/routes/admin.analytics.tsx`: Removed unconditional worker redirect; added canonical `canAccessAnalytics` check and `<ModuleAccessShield module="analytics" />`.
3. `src/lib/finance-service.ts`: Added `allowAnalyticsRead` authorization context option for read-only aggregation by analytics service while keeping direct finance access gated by `finance.view`.
4. `src/lib/analytics-service.ts`: Added entry mutation check `assertAuthorizedMutation(supabase, "analytics", "analytics.view")` and passed `{ allowAnalyticsRead: true }` to `fetchCompanyFinance()`.
5. `src/components/admin/GlobalSearchModal.tsx`: Updated quick link visibility checks to use `canAccessModule("analytics")`.
6. `src/routes/admin.index.tsx`: Updated executive switcher to use `canAccessModule("analytics")`.
7. `scripts/test-analytics-custom-permission-regression.ts`: Created 10-test regression suite.
8. `scripts/verify-browser-analytics-permission.ts`: Created end-to-end browser verification script.
9. `docs/audit/ANALYTICS_CUSTOM_PERMISSION_DEFECT.md`: Audit report and verification proof.
