# SADA OS — Unified Account & Security Operations Center
## Permission Architecture & Multi-Tier Enforcement Matrix

**Document ID:** `SADA-SEC-PHASE0-PERM-MATRIX`  
**Date:** 2026-10-17  
**Status:** COMPLETE (READ-ONLY BASELINE DISCOVERY)  
**Classification:** Authorization Architecture & Enforcement Analysis  

---

## 1. Executive Summary & Core Architectural Invariants

In SADA OS, permissions follow a strict defense-in-depth model:

1. **`public.user_module_permissions` is the Single Canonical Source of Truth** for granular, per-user module and action overrides.
2. **`public.profiles.module_permissions` is exclusively a Read-Through Cache / Projection**. It exists to allow fast retrieval without relational joins, but the authoritative state resides in `user_module_permissions`.
3. **No Frontend UI Toggle Confers Authority**: Hiding a button, hiding a menu item, or redirecting in TanStack Router is purely a presentation convenience. True authorization is enforced at:
   - Route and loader guards (`beforeLoad`, `evaluateRouteAccess`)
   - The universal server mutation gate (`assertAuthorizedMutation`)
   - Layer 7 rate limits (`assertRateLimit`)
   - PostgreSQL `SECURITY DEFINER` RPC validation
   - PostgreSQL Row Level Security (RLS) policies and immutability triggers calling `public.is_session_active()` and `public.has_permission()`.
4. **Root Invariants Cannot Be Overridden**:
   - `accounts` module management cannot be delegated to non-Super-Admins.
   - Deletion of records across any operational module cannot be delegated to non-Super-Admins (`has_permission()` explicitly returns `false` for `_action = 'delete'`).
   - Super Admins cannot demote themselves or revoke their own access to `accounts` (Administrative self-lockout protection).
   - The last active Super Admin cannot be suspended or deleted.

---

## 2. Multi-Tier Permission Evaluation Model

```
                    [Client Request / Action]
                               │
 ┌─────────────────────────────▼─────────────────────────────┐
 │  TIER 1: UI / Presentation Layer                          │
 │  - canAccessModule(module)                                │
 │  - hasPermission(permission, role, customOverrides)       │
 │  - UI state reflects effective computed permissions       │
 └─────────────────────────────┬─────────────────────────────┘
                               │
 ┌─────────────────────────────▼─────────────────────────────┐
 │  TIER 2: Route Navigation Guard (TanStack Router)         │
 │  - beforeLoad hook checks active session                  │
 │  - evaluateRouteAccess(path, secCtx) validates module     │
 │  - Unauthorized renders ModuleAccessShield                │
 └─────────────────────────────┬─────────────────────────────┘
                               │
 ┌─────────────────────────────▼─────────────────────────────┐
 │  TIER 3: Server Mutation Gate (Application Service Tier)  │
 │  - assertAuthorizedMutation(client, module, action, params)│
 │  - Verifies actor identity (rejects spoofed payloads)     │
 │  - Re-evaluates database authority (user_roles, status)  │
 │  - Verifies session validity (verify_session_and_account) │
 │  - Layer 7 rate limit enforcement (rate_limit_buckets)    │
 └─────────────────────────────┬─────────────────────────────┘
                               │
 ┌─────────────────────────────▼─────────────────────────────┐
 │  TIER 4: PostgreSQL Security Definer RPC Layer            │
 │  - Direct is_super_admin(auth.uid()) verification         │
 │  - In-database anti-lockout & anti-tampering guards       │
 │  - Atomic multi-table updates (roles + perms + audit)     │
 └─────────────────────────────┬─────────────────────────────┘
                               │
 ┌─────────────────────────────▼─────────────────────────────┐
 │  TIER 5: PostgreSQL Row Level Security (RLS) & Triggers   │
 │  - is_session_active() checks revoked/expired sessions    │
 │  - has_permission(auth.uid(), permission) checks policies │
 │  - Immutability triggers reject direct DELETE / UPDATE    │
 └───────────────────────────────────────────────────────────┘
```

---

## 3. Canonical Role Defaults Baseline vs Custom Overrides

SADA OS defines three native roles (`super_admin`, `admin`, `worker`) across 16 canonical modules:

| Module Key | Friendly Module Name | Worker Default | Admin Default | Super Admin Default | Delegable via Overrides? | Permanent Deletion Delegable? |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **`dashboard`** | Executive / Team Overview | **ON** | **ON** | **ON** | Yes | No (N/A) |
| **`clients`** | Client CRM & Workspaces | **ON** | **ON** | **ON** | Yes | **NO (Super Admin Only)** |
| **`tasks`** | Task & Workflow Execution | **ON** | **ON** | **ON** | Yes | **NO (Super Admin Only)** |
| **`calendar`** | Production & Handoffs Calendar | **ON** | **ON** | **ON** | Yes | **NO (Super Admin Only)** |
| **`compensation`**| My Salary & Earnings | **ON** (Self) | **ON** (Self) | **ON** (All in Finance) | Yes | **NO (Super Admin Only)** |
| **`sales`** | Sales Pipeline & Deals | OFF | **ON** | **ON** | Yes (Can enable for Worker) | **NO (Super Admin Only)** |
| **`workspaces`** | Client Service Hubs | OFF | **ON** | **ON** | Yes (Can enable for Worker) | **NO (Super Admin Only)** |
| **`team`** | Team Directory & Workload | OFF | **ON** | **ON** | Yes (Can enable for Worker) | **NO (Super Admin Only)** |
| **`packages`** | Package Catalog & Pricing | OFF | **ON** | **ON** | Yes (Can enable for Worker) | **NO (Super Admin Only)** |
| **`analytics`** | Executive KPIs & Analytics | OFF | **ON** | **ON** | Yes (Can enable for Worker) | No (N/A) |
| **`inquiries`** | Contact Leads & Inquiries | OFF | **ON** | **ON** | Yes (Can enable for Worker) | **NO (Super Admin Only)** |
| **`content_cms`** | Case Studies, Reels, Blog | OFF | **ON** | **ON** | Yes (Can enable for Worker) | **NO (Super Admin Only)** |
| **`finance`** | Treasury, Invoices, Payroll | OFF | OFF | **ON** | Yes (Can enable for Admin) | **NO (Super Admin Only)** |
| **`workflows`** | Workflow Templates Engine | OFF | OFF | **ON** | **NO (Root-Exclusive)** | **NO (Super Admin Only)** |
| **`business_rules`**| Central Business Rules Engine| OFF | OFF | **ON** | **NO (Root-Exclusive)** | **NO (Super Admin Only)** |
| **`accounts`** | Unified Security Operations | OFF | OFF | **ON** | **STRICTLY FORBIDDEN** | **NO (Super Admin Only)** |

---

## 4. Write Path & Read Path Verification: `user_module_permissions` vs `profiles.module_permissions`

### 4.1 Write Path Analysis
When Super Admin modifies permissions in `AccountPermissionsPanel.tsx`:
1. Client calls `updateAccountPermissions(targetUserId, modulePermissions)` in `src/lib/account-service.ts`.
2. Service executes `assertAuthorizedMutation("accounts", "accounts.manage")` to verify actor authority.
3. Service calls PostgreSQL RPC: `public.admin_update_account_permissions(_target_user_id, _permissions, _reason, _request_metadata)`.
4. Inside PostgreSQL transaction:
   ```sql
   -- 1. Updates cache column on profiles
   UPDATE public.profiles
   SET module_permissions = COALESCE(_permissions, '{}'::jsonb),
       updated_at = now()
   WHERE id = _target_user_id;

   -- 2. Purges stale canonical rows
   DELETE FROM public.user_module_permissions WHERE user_id = _target_user_id;

   -- 3. Inserts fresh canonical records into user_module_permissions
   INSERT INTO public.user_module_permissions (user_id, module, enabled, actions, updated_at)
   VALUES (_target_user_id, _mod_key, _is_enabled, _actions_obj, now());

   -- 4. Writes dual audit records into account_audit_logs and system_audit_logs
   ```
5. Client invalidates local in-memory context cache: `invalidateSecurityContextCache(targetUserId)`.

### 4.2 Read Path Analysis
When resolving effective permissions for a user:
1. `fetchUserModulePermissions(userId)` in `src/lib/account-service.ts`:
   - First queries canonical `user_module_permissions` table:
     `SELECT module, enabled, actions FROM user_module_permissions WHERE user_id = userId;`
   - If rows exist, constructs `UserModulePermissions` and returns immediately.
   - If zero rows exist, queries `profiles.module_permissions` cache as fallback.
2. `resolveAuthoritativeSecurityContext` in `src/lib/security-isolation-service.ts`:
   - First queries `user_module_permissions` table.
   - If empty, falls back to `profiles.module_permissions`.
   - If still empty, invokes RPC `get_effective_user_permissions`.
3. In-database function `has_permission(_user_id, _permission)`:
   - Queries `user_module_permissions` directly:
     ```sql
     SELECT enabled, actions INTO _override_enabled, _override_actions
     FROM public.user_module_permissions
     WHERE user_id = _user_id AND module = _module
     LIMIT 1;
     ```
   - Evaluates overrides against baseline.

**Verification Result:** The architecture adheres to SSOT. `user_module_permissions` is the authoritative relational source for database enforcement and queries, while `profiles.module_permissions` operates as an optimized cache.

---

## 5. Frontend vs Backend Disagreement Analysis

| Potential Point of Disagreement | Root Cause Mechanism | Architectural Defense Implemented | Residual Risk Level |
| :--- | :--- | :--- | :--- |
| **Stale In-Memory Context in Long-Running Tab** | A user whose permissions were revoked leaves their browser tab open without refreshing. | `contextCache` in `security-isolation-service.ts` has a strict **10-second TTL** (`CACHE_TTL_MS = 10_000`). Stale memory cannot persist beyond 10s for mutations. | **LOW** |
| **Direct PostgREST API Calls Bypassing UI** | A revoked worker uses cURL or Postman to submit PostgREST requests with a previously acquired JWT. | Database RLS calls `public.has_permission()` and `public.is_session_active()` on every row-level operation. PostgREST rejects unauthorized reads/writes directly in PostgreSQL. | **NONE (Enforced in DB)** |
| **Realtime Channel Latency** | WebSocket disconnection delays realtime session revocation message. | Periodic 120-second heartbeat fallback (`heartbeatCurrentSession`) verifies session status against `user_sessions` and triggers sign-out if revoked. | **LOW** |
| **Client-Side Role Forgery** | Attacker modifies `user_metadata` or localStorage to inject `role: "super_admin"`. | `assertAuthorizedMutation` and `resolveAuthoritativeSecurityContext` disregard client metadata and re-query `public.user_roles` directly. Forged roles throw `PRIVILEGE_ESCALATION_BLOCKED`. | **NONE (Enforced on Server)** |
| **Ambient Session ID Bleed** | Shared browser machine or automated tests retain foreign session ID in localStorage. | Fixed via `P0-AUTH-SESSION-MISMATCH` remediation: user-scoped localStorage indexing (`sada_session_ref_${userId}`) and self-healing session re-registration. | **NONE (Verified Fixed)** |
