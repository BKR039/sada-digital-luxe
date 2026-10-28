# SADA OS — Unified Account & Security Operations Center
## Phase 0: System Architecture & Implementation Inventory

**Document ID:** `SADA-SEC-PHASE0-INVENTORY`  
**Date:** 2026-10-17  
**Status:** COMPLETE (READ-ONLY BASELINE DISCOVERY)  
**Classification:** Internal Security & Architecture Audit  
**Author:** Principal Application Security Engineer, Senior QA Automation Engineer  

---

## 1. Executive Overview

The **Unified Account & Security Operations Center** (`/admin/accounts`) is SADA OS's central command station for identity lifecycle management, role-based access control (RBAC), granular module permissions, active session tracking, cryptographic session revocation, real-time security alerting, and immutable audit logging.

This document establishes the exhaustive, code-verified inventory of all routes, components, hooks, services, server functions, database RPCs, migrations, RLS policies, realtime subscriptions, and existing automated test suites governing this subsystem.

---

## 2. Full Architecture & Component Call Graph

```
                                      [User Browser]
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       │                                           │
           [Route Guard / Layout]                         [Global Auth Context]
             src/routes/admin.tsx                           src/lib/auth.tsx
       (superAdminOnly, isSuperAdmin)                 (Session, Role, Realtime)
                       │                                           │
                       └─────────────────────┬─────────────────────┘
                                             │
                               [Unified Operations Center]
                              src/routes/admin.accounts.tsx
                                             │
      ┌──────────────────────┬───────────────┴───────────────┬──────────────────────┐
      │                      │                               │                      │
[Section 1: Overview]  [Section 2: Accounts]           [Section 3: Sessions]  [Section 4: Activity]
 SecurityOverviewTab    AccountsDirectory               LiveSessionsTab        UserActivityTab
 AccountsKPICards       AccountsTable                   SessionDetailDrawer    AccountActivityTimeline
                        CreateAccountModal (Wizard)     EmergencyActionModals
                        AccountDetailsDrawer
                        ├─ Identity & Profile Tab
                        ├─ Permissions Panel
                        ├─ Sessions Tab
                        ├─ Security Tab
                        └─ Danger Zone (Suspend/Reactivate/Delete)
                                             │
                               [Section 5: Security & Audit]
                                SecurityAndAuditTab
                                ├─ SecurityAlertsTab
                                └─ AuditHistoryTab (JSON/CSV Export)
                                             │
 ════════════════════════════════════════════╪════════════════════════════════════════════
                             APPLICATION SERVICE & MUTATION GATE
 ════════════════════════════════════════════╪════════════════════════════════════════════
                                             │
             ┌───────────────────────────────┼───────────────────────────────┐
             │                               │                               │
    [Account Service]             [Security Center Service]        [Security Isolation Layer]
  src/lib/account-service.ts     src/lib/security-center-service.ts  src/lib/security-isolation-service.ts
  - fetchAccounts()               - fetchSecurityKPIs()           - assertAuthorizedMutation()
  - createAccount()               - fetchUserSessions()           - resolveAuthoritativeSecurityContext()
  - updateAccount()               - revokeSession()               - authorizeModuleAction()
  - suspendAccount()              - revokeAllUserSessions()       - authorizeDataScope()
  - reactivateAccount()           - suspendAccountWithSessions()  - assertRateLimit()
  - updateAccountPermissions()    - reactivateAccountSecurity()   - verifySessionAndAccount()
  - resetAccountPassword()        - fetchSecurityAlerts()
  - deleteAccount()               - resolveSecurityAlert()
                                  - fetchUserActivityTimeline()
                                             │
 ════════════════════════════════════════════╪════════════════════════════════════════════
                              DATABASE / POSTGREST BOUNDARY
 ════════════════════════════════════════════╪════════════════════════════════════════════
                                             │
        ┌────────────────────────────────────┼────────────────────────────────────┐
        │                                    │                                    │
 [PostgreSQL Tables]              [Security Definer RPCs]               [Immutability Triggers]
 - auth.users                     - public.admin_list_accounts          - trg_prevent_delete_user_sessions
 - public.profiles                - public.admin_provision_account     - trg_prevent_delete_system_audit
 - public.user_roles              - public.admin_update_account         - trg_prevent_update_system_audit
 - public.user_module_permissions - public.admin_update_account_perms   - trg_prevent_delete_account_audit
 - public.team_members            - public.admin_suspend_account_with_s - trg_prevent_update_account_audit
 - public.user_sessions           - public.admin_reactivate_account_sec
 - public.security_alerts         - public.admin_revoke_session
 - public.system_audit_logs       - public.admin_revoke_all_sessions
 - public.account_audit_logs      - public.verify_session_and_account
 - public.rate_limit_buckets      - public.admin_get_security_kpis
                                  - public.admin_list_user_sessions
```

---

## 3. Detailed UI Subsystem & Route Mapping

The module is exposed at `/admin/accounts` with sub-tab query synchronization (`?section=overview|accounts|sessions|activity|audit` and `?account=<user_id>`).

| Section Key | Route / State | Primary Components | Features & Capabilities |
| :--- | :--- | :--- | :--- |
| **Overview** | `/admin/accounts?section=overview` | `SecurityOverviewTab.tsx`, `AccountsKPICards.tsx` | 7 telemetry cards (Active sessions [LIVE], unique active users [LIVE], total accounts [DATABASE], suspended accounts [DATABASE], revoked sessions [HISTORICAL], open alerts [LIVE], privileged actions [HISTORICAL]); quick deep-links to sections. |
| **Accounts Directory** | `/admin/accounts?section=accounts` | `AccountsTable.tsx`, `AccountsHeader.tsx`, `CreateAccountModal.tsx`, `AccountDetailsDrawer.tsx` | Paginated/filtered roster of all system accounts (search by name/email/role/status/division); sorting by newest, oldest, last login, name, role; row click opens `AccountDetailsDrawer`. |
| **Account Provisioning** | Modal via "Create Account" | `CreateAccountModal.tsx` | 4-step wizard: (1) Identity & Profile, (2) Granular Module Permissions with role presets, (3) Cryptographic credential generation, (4) One-time credential reveal and clipboard copy. |
| **Account Details Drawer** | `/admin/accounts?account=<uid>` | `AccountDetailsDrawer.tsx` | 6 tabbed panels: Identity/Profile, Granular Permissions (`AccountPermissionsPanel.tsx`), User Sessions, Activity Timeline (`AccountActivityTimeline.tsx`), Security Health, Danger Zone (`AccountDangerZone.tsx`). |
| **Live Sessions** | `/admin/accounts?section=sessions` | `LiveSessionsTab.tsx`, `SessionDetailDrawer.tsx`, `EmergencyActionModals.tsx` | Real-time session inventory (device type, browser, OS, IP, sign-in timestamp, last activity, status); individual session revocation; sign-out everywhere. |
| **User Activity** | `/admin/accounts?section=activity` | `UserActivityTab.tsx` | Chronological multi-source activity timeline combining `system_audit_logs` and `account_audit_logs`; payload inspection drawer; category and user filters. |
| **Security & Audit** | `/admin/accounts?section=audit` | `SecurityAndAuditTab.tsx`, `SecurityAlertsTab.tsx`, `AuditHistoryTab.tsx` | Sub-tab 1: Security alert queue (Open, Acknowledged, Resolved, Dismissed) with severity filtering; Sub-tab 2: Complete system audit trail with structured payload expansion and JSON/CSV export. |

---

## 4. Frontend Component & Hook Inventory

### 4.1 Route & Shell Guards
- **`src/routes/admin.accounts.tsx`**: Route definition, query parameter parsing (`validateSearch`), data loading orchestration (`loadAllSecurityData`), Super Admin access shield (`isSuperAdmin`), emergency modal triggers.
- **`src/routes/admin.tsx`**: Admin layout shell, navigation bar filter (`ALL_NAV_ITEMS` with `superAdminOnly: true` on `/admin/accounts`), route guard evaluation (`evaluateRouteAccess`).
- **`src/components/admin/ModuleAccessShield.tsx`**: Fallback shield rendering access-denied UI when non-authorized roles navigate directly to forbidden modules.

### 4.2 Account Directory Components
- **`src/components/admin/accounts/AccountsHeader.tsx`**: Header title, search input, status/role filter controls, "Create Account" trigger.
- **`src/components/admin/accounts/AccountsKPICards.tsx`**: Top-level account metric cards (Total, Active, Suspended, Super Admin, Admin, Worker).
- **`src/components/admin/accounts/AccountsTable.tsx`**: Table view of accounts with status badges, role indicators, last sign-in timestamps, and action buttons.
- **`src/components/admin/accounts/CreateAccountModal.tsx`**: Multi-step wizard enforcing role-appropriate defaults, password complexity, and atomic provisioning.
- **`src/components/admin/accounts/AccountDetailsDrawer.tsx`**: Multi-tab sliding drawer for managing an individual account's lifecycle.
- **`src/components/admin/accounts/AccountPermissionsPanel.tsx`**: Interactive grid for managing 16 SADA modules and granular per-action overrides.
- **`src/components/admin/accounts/AccountSecurityPanel.tsx`**: Account-specific security score, active session summary, password reset trigger, and alert history.
- **`src/components/admin/accounts/AccountDangerZone.tsx`**: High-risk operations (Suspend, Reactivate, Permanent Account Deletion) with confirmation dialogs.
- **`src/components/admin/accounts/AccountActivityTimeline.tsx`**: Per-user audit event list rendered inside the account drawer.

### 4.3 Security & Audit Operations Components
- **`src/components/admin/security/SecurityControlCenterNav.tsx`**: Top navigation bar switching between the 5 canonical sections with live alert badges.
- **`src/components/admin/security/SecurityOverviewTab.tsx`**: System-wide telemetry dashboard with verified provenance indicators.
- **`src/components/admin/security/LiveSessionsTab.tsx`**: Filterable table of all active and historical user sessions.
- **`src/components/admin/security/SessionDetailDrawer.tsx`**: Deep inspection of user-agent, IP, TLS/Auth method, and session metadata.
- **`src/components/admin/security/UserActivityTab.tsx`**: Global activity investigator with category filtering (auth, admin, navigation, business, security).
- **`src/components/admin/security/SecurityAlertsTab.tsx`**: Detection alert manager with triage states (Open $\rightarrow$ Acknowledged $\rightarrow$ Resolved/Dismissed).
- **`src/components/admin/security/AuditHistoryTab.tsx`**: Immutable audit event log with JSON/CSV export actions.
- **`src/components/admin/security/EmergencyActionModals.tsx`**: Confirmation modals for Revoke Session, Sign Out Everywhere, Suspend Account, and Reactivate Account.

---

## 5. Application Services & Server Mutation Boundary

### 5.1 `src/lib/account-service.ts`
- **`fetchAccounts()`**: Invokes `admin_list_accounts` RPC; hydrates `AccountRecord[]` with profiles and module permissions.
- **`createAccount(input, clientOverride, ctx)`**: Enforces `assertAuthorizedMutation("accounts", "accounts.manage")`; creates auth user via isolated client; calls `admin_provision_account` RPC; handles compensating rollback on partial failure.
- **`updateAccount(input, ctxOrClient, clientOverride)`**: Enforces `assertAuthorizedMutation`; checks anti-self-demotion; calls `admin_update_account` RPC; synchronizes `team_members` and `user_module_permissions`; invalidates security context cache.
- **`suspendAccount(userId, reason, ctx, clientOverride)`**: Enforces `assertAuthorizedMutation`; prevents self-suspension; calls `admin_suspend_account_with_sessions` RPC.
- **`reactivateAccount(userId, ctx, clientOverride)`**: Enforces `assertAuthorizedMutation`; calls `admin_reactivate_account_with_security` RPC.
- **`resetAccountPassword(userId, newPassword, ctx)`**: Enforces `assertCanManageAccounts(ctx)`; calls `admin_reset_account_password` RPC.
- **`deleteAccount(userId, ctx, clientOverride)`**: Enforces `assertAuthorizedMutation("accounts", "accounts.delete")`; calls `admin_delete_account` RPC.
- **`analyzeAccountDependencies(userId)`**: Calls `admin_analyze_account_dependencies` RPC before destructive actions.
- **`fetchUserModulePermissions(userId)`**: Queries canonical `user_module_permissions` table with fallback to `profiles.module_permissions` cache.
- **`updateAccountPermissions(userId, modulePermissions, clientOverride, ctx, options)`**: Calls `admin_update_account_permissions` RPC; invalidates cache.

### 5.2 `src/lib/security-center-service.ts`
- **`getCurrentSessionId(userId?)` / `setCurrentSessionId(sid, userId?)` / `clearCurrentSessionId(userId?)`**: Manages user-scoped session identifiers in client storage (`sada_session_ref_${userId}`) to prevent cross-user token bleed.
- **`registerCurrentSession(clientOverride?)`**: Invokes `register_user_session` RPC upon sign-in.
- **`heartbeatCurrentSession(clientOverride?, force?)`**: Throttled (60s) keep-alive calling `record_session_heartbeat` RPC.
- **`verifySessionAndAccount(sessionId?, clientOverride?)`**: Fast validity check calling `verify_session_and_account` RPC.
- **`fetchSecurityKPIs(clientOverride?)`**: Calls `admin_get_security_kpis` RPC.
- **`fetchUserSessions(params, clientOverride?)`**: Calls `admin_list_user_sessions` RPC.
- **`revokeSession(sessionId, reason, clientOverride?)`**: Enforces self-lockout check; calls `admin_revoke_session` RPC.
- **`revokeAllUserSessions(targetUserId, reason, clientOverride?)`**: Calls `admin_revoke_all_user_sessions` RPC.
- **`suspendAccountWithSessions(targetUserId, reason, clientOverride?)`**: Calls `admin_suspend_account_with_sessions` RPC.
- **`reactivateAccountSecurity(targetUserId, reason?, clientOverride?)`**: Calls `admin_reactivate_account_with_security` RPC.
- **`fetchSecurityAlerts(statusFilter?, clientOverride?)`**: Queries `public.security_alerts`.
- **`resolveSecurityAlert(alertId, status, notes?, clientOverride?)`**: Updates `public.security_alerts` record.
- **`fetchUserActivityTimeline(params, clientOverride?)`**: Merges events from `system_audit_logs` and `account_audit_logs`.
- **`recordAuthFailure(email, reason?, clientOverride?)`**: Calls `record_failed_sign_in_attempt` RPC.

### 5.3 `src/lib/security-isolation-service.ts`
- **`assertAuthorizedMutation(client, module, action, params)`**: The universal server authorization boundary gate. Verifies:
  1. Authenticated session identity (`auth.getUser()`).
  2. Banned/suspended status detection.
  3. Identity spoofing prevention.
  4. Layer 7 rate limiting (`assertRateLimit`).
  5. Authoritative context evaluation from PostgreSQL (`resolveAuthoritativeSecurityContext`).
  6. Forged Super Admin role rejection (`normClaim === "super_admin" && secCtx.role !== "super_admin"`).
  7. Module & granular action authorization (`authorizeModuleAction`).
  8. Data scope and ownership isolation (`authorizeDataScope`).
- **`resolveAuthoritativeSecurityContext(client, overrideUserId, options)`**: Resolves database authority (roles from `user_roles`, status from `profiles`, active sessions from `user_sessions` via `verify_session_and_account`, permissions from `user_module_permissions`).
- **`evaluateRouteAccess(path, ctx)`**: Verifies whether an authenticated principal can view a requested URL route.

### 5.4 `src/lib/auth.tsx`
- **`AuthProvider`**: Manages auth lifecycle, token changes, user session registration, and role resolution.
- **Realtime Channel `sada-user-session-revocation`**: Subscribes to `UPDATE` on `public.user_sessions`. If the active session is revoked or the account suspended, immediately terminates the client session via `signOut()`.
- **Heartbeat Interval**: 120-second fallback poll ensuring stale sessions are purged even if WebSocket is disconnected.

---

## 6. Database Schema, RPCs & Security Policies

### 6.1 Database Migrations Lineage
The security subsystem is built from the following cumulative migrations:
1. `20260925180000_super_admin_account_management.sql`: Initial `account_audit_logs`, `admin_list_accounts`, `count_active_super_admins`, `admin_create_account`, `admin_update_account`, `admin_delete_account`.
2. `20260925183000_admin_provision_account.sql`: Dedicated atomic provisioning RPC.
3. `20260928200000_account_lifecycle_and_crm_integrity.sql`: Synchronized team members, client project foreign keys, and account status integrity.
4. `20260929150000_phase7_and_phase8_notifications_and_audit.sql`: `public.system_audit_logs` creation and `trg_prevent_delete_system_audit`.
5. `20261002080000_fix_worker_salary_advance_resolution_and_rls.sql`: Hardened `admin_update_account` to link both `profile_id` and `user_id`.
6. `20261006140000_account_module_permissions.sql`: `public.user_module_permissions` table creation and `admin_update_account_permissions` RPC.
7. `20261007200000_phase_i_layered_security_and_abuse_protection.sql`: `public.rate_limit_buckets` table and `check_rate_limit` RPC.
8. `20261007210000_phase_j_permission_administration_and_audit.sql`: Comprehensive audit logging for permission administration in both audit tables.
9. `20261007220000_phase_j_fix_rate_limit_call.sql`: Rate limit invocation hardening.
10. `20261010100000_sada_security_and_session_control_center.sql`: Unified `user_sessions`, `security_alerts`, `register_user_session`, `record_session_heartbeat`, `verify_session_and_account`, `admin_revoke_session`, `admin_revoke_all_user_sessions`, `admin_suspend_account_with_sessions`, `admin_reactivate_account_with_security`, `admin_list_user_sessions`, `admin_get_security_kpis`, `record_failed_sign_in_attempt`.
11. `20261010123000_audit_immutability_and_session_defense.sql`: Explicit statement and row triggers preventing DELETE or UPDATE on `system_audit_logs`, `account_audit_logs`, and `user_sessions`.
12. `20261010130000_final_session_revocation_enforcement_closure.sql`: Added `jwt_session_id` column; created `public.is_session_active()`; integrated session validation into canonical RBAC functions (`has_sada_access`, `is_admin`, `is_super_admin`, `has_permission`).
13. `20261010140000_harden_session_registration_and_isolation.sql`: User-bound session registration fix preventing cross-user session theft/collision (`v_existing_session.user_id <> v_user_id`).
14. `20261016140000_secure_public_team_members_and_rls_hardening.sql`: Hardened `admin_provision_account` to default internal team member accounts to `published = false`.

### 6.2 Canonical PostgreSQL Tables
1. **`auth.users`**: Managed by Supabase GoTrue; root authentication records, email, encrypted password hash, `banned_until`, `last_sign_in_at`.
2. **`public.profiles`**: Identity lifecycle state (`status`: `active`, `suspended`, `pending`, `disabled`, `deleted`), phone, display name, and cached module permissions JSONB (`module_permissions`).
3. **`public.user_roles`**: Single source of truth for administrative role (`super_admin`, `admin`, `worker`).
4. **`public.user_module_permissions`**: Canonical per-user, per-module permission overrides (`module`, `enabled`, `actions` JSONB).
5. **`public.team_members`**: Operational directory profiles, job titles, divisions, public publishing flags, links to `profiles.id` / `auth.users.id`.
6. **`public.user_sessions`**: Session inventory, device telemetry, user-agent parsing, IP, `status` (`active`, `idle`, `expired`, `revoked`), `jwt_session_id`.
7. **`public.security_alerts`**: Deterministic detection alert records (`rule_id`, `severity`, `status`: `open`, `acknowledged`, `resolved`, `dismissed`).
8. **`public.system_audit_logs`**: System-wide administrative, security, and financial mutations.
9. **`public.account_audit_logs`**: User lifecycle, provisioning, role change, and permission mutation logs.
10. **`public.rate_limit_buckets`**: Sliding window counters for anti-abuse and rate limiting.

### 6.3 Security Definer Database RPCs
- `public.admin_list_accounts()`: Secure projection joining `auth.users`, `profiles`, `user_roles`, `team_members`.
- `public.admin_provision_account(...)`: Atomic multi-table provisioning.
- `public.admin_update_account(...)`: Atomic identity and role update.
- `public.admin_update_account_permissions(...)`: Atomic permission overwrite and dual audit logging.
- `public.admin_suspend_account_with_sessions(...)`: Banning in `auth.users`, profile suspension, session invalidation, and audit logging.
- `public.admin_reactivate_account_with_security(...)`: Profile activation, unbanning in `auth.users`, requires fresh login.
- `public.admin_revoke_session(...)`: Immediate session revocation and audit logging.
- `public.admin_revoke_all_user_sessions(...)`: Global sign-out for target user.
- `public.verify_session_and_account(...)`: Server-side check for caller session validity.
- `public.is_session_active()`: Canonical RLS enforcement function.
- `public.admin_get_security_kpis()`: Authoritative calculation of operational security telemetry.
- `public.admin_list_user_sessions(...)`: Super Admin session query.
- `public.record_failed_sign_in_attempt(...)`: Audit logging of failed logins and automated threshold alert generation.

---

## 7. Existing Automated Tests & Test Scripts

| Script Name | Path | Focus Area | Environment Type |
| :--- | :--- | :--- | :--- |
| **`test-adversarial-security-suite.ts`** | `scripts/test-adversarial-security-suite.ts` | 12 adversarial security vectors (session tampering, privilege escalation, immutability, self-lockout). | Node/TS integration against Supabase |
| **`test-account-management.ts`** | `scripts/test-account-management.ts` | Account lifecycle, provisioning, role changes, module permissions, suspension. | Node/TS integration against Supabase |
| **`test-account-management-e2e.ts`** | `scripts/test-account-management-e2e.ts` | Complete end-to-end account lifecycle flow. | Node/TS integration against Supabase |
| **`test-security-session-control.ts`** | `scripts/test-security-session-control.ts` | Live session revocation, sign-out everywhere, suspension invalidation. | Node/TS integration against Supabase |
| **`verify-unified-account-security-center.ts`**| `scripts/verify-unified-account-security-center.ts`| Browser Puppeteer verification of all 5 UI tabs, metrics, and modals. | Puppeteer Browser E2E |
| **`verify-security-center-browser.ts`** | `scripts/verify-security-center-browser.ts` | Browser interaction testing of security control center. | Puppeteer Browser E2E |
| **`test-db-guard.ts`** | `scripts/test-db-guard.ts` | **Zero-trust database isolation guard** preventing tests against shared production database. | Environment Security Guard |

---

## 8. Summary Baseline Verdict

The Unified Account & Security Operations Center has a consolidated architecture:
1. **Single Entry Route:** `/admin/accounts` with clean 5-section navigation.
2. **Unified Backend Gate:** `assertAuthorizedMutation` defending every write operation.
3. **Database Invariants:** Immutability triggers on audit tables and session tables; `is_session_active()` integrated into canonical RBAC functions.
4. **Environment Isolation Guard:** `scripts/test-db-guard.ts` is strictly present and active.
