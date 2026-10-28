# SADA OS — Phase 1: Accounts & Security Source-of-Truth Traceability Matrix
## Complete UI Element → Service → RPC/Database → Audit → Downstream Impact

---

### 1. Architectural Trace Overview

This matrix establishes end-to-end traceability for every user-facing control, modal, drawer, and action within the Accounts & Security module (`/admin/accounts`). In accordance with Phase 0 baseline findings, mutations must strictly target canonical tables and verified RPCs, and must never rely solely on UI hiding for security enforcement.

---

### 2. Comprehensive Traceability Table

| UI Element & Location | React Component | Invoked Service Function | Authoritative Database Table / RPC | Mutation Type | Emitted Audit Event | Downstream System Impact |
|---|---|---|---|---|---|---|
| **Account Row Click**<br>`/admin/accounts?section=accounts` | `src/components/admin/accounts/AccountsDirectory.tsx` | `setSelectedAccount(record)` | `public.admin_list_accounts` (reads `profiles`, `user_roles`, `team_members`) | Read | None (Read action) | Opens `AccountDetailsDrawer` populated with complete identity, roles, and status metadata. |
| **Search Bar & Role/Status Filters**<br>`/admin/accounts?section=accounts` | `src/components/admin/accounts/AccountsDirectory.tsx` | Client filter & `fetchAccounts()` | `public.admin_list_accounts` RPC | Read | None (Read action) | Filters 414 records in-memory with debounce; updates visible table rows without unnecessary server queries. |
| **"Create Account" Button & Wizard**<br>`/admin/accounts` Header | `src/components/admin/accounts/CreateAccountModal.tsx` | `createAccount()` (`src/lib/account-service.ts`) | 1. Supabase Auth (`auth.users`)<br>2. `public.admin_provision_account` RPC<br>3. `public.profiles`<br>4. `public.user_roles`<br>5. `public.team_members` | Insert / Upsert | `account_created`<br>in `account_audit_logs` | Creates authenticatable credentials, initializes operational team member, applies default or custom module permissions. |
| **Role Selector Dropdown**<br>Drawer: Identity Tab | `src/components/admin/accounts/AccountDetailsDrawer.tsx` | `updateAccount()` (`src/lib/account-service.ts`) | `public.admin_update_account` RPC<br>Canonical: `public.user_roles` | Update | `account_updated` / `role_changed`<br>in `account_audit_logs` | Reassigns user role in `user_roles`; updates effective permissions baseline across all OS routes. |
| **Profile Fields (Name, Phone, Division, Position)**<br>Drawer: Identity Tab | `src/components/admin/accounts/AccountDetailsDrawer.tsx` | `updateAccount()` (`src/lib/account-service.ts`) | `public.admin_update_account` RPC<br>Targets: `profiles` + `team_members` | Update | `account_updated`<br>in `account_audit_logs` | Synchronizes operational title and contact info across CRM, project assignments, and team directories. |
| **Module Permission Toggles**<br>Drawer: Permissions Tab | `src/components/admin/accounts/AccountPermissionsPanel.tsx` | `updateAccountPermissions()` (`src/lib/account-service.ts`) | Canonical: `public.user_module_permissions`<br>Cache: `profiles.module_permissions` | Upsert / Delete | `permissions_updated`<br>in `system_audit_logs` | Grants or revokes granular access to specific modules (e.g. Finance, Sales); evaluated on next navigation. |
| **Worker Operational Preset Button**<br>Drawer: Permissions Tab | `src/components/admin/accounts/AccountPermissionsPanel.tsx` | `handleApplyWorkerPreset()` + `updateAccountPermissions()` | Canonical: `public.user_module_permissions` | Batch Upsert | `permissions_updated`<br>in `system_audit_logs` | Sets standard worker baseline: Dashboard, Clients, Tasks, Calendar, Compensation enabled; others disabled. |
| **Reset to Role Default Button**<br>Drawer: Permissions Tab | `src/components/admin/accounts/AccountPermissionsPanel.tsx` | `handleResetToRole()` + `updateAccountPermissions()` | Deletes rows in `user_module_permissions` | Delete | `permissions_reset`<br>in `system_audit_logs` | Removes all individual custom overrides; user inherits standard role defaults. |
| **Revoke Single Session Button**<br>Drawer: Sessions Tab & Sessions Overview | `src/components/admin/security/SessionDeviceControlCard.tsx` | `revokeSession()` (`src/lib/security-center-service.ts`) | Canonical: `public.user_sessions`<br>RPC: `public.admin_revoke_session` | Update (`status = 'revoked'`) | `session_revoked`<br>in `system_audit_logs` | Marks session revoked; halts subsequent mutations via `assertAuthorizedMutation`; updates live session counter. |
| **Sign Out Everywhere Button**<br>Drawer: Danger Zone Tab | `src/components/admin/accounts/AccountDetailsDrawer.tsx` | `revokeAllUserSessions()` (`src/lib/security-center-service.ts`) | Canonical: `public.user_sessions`<br>Filters by `user_id` | Batch Update (`status = 'revoked'`) | `all_sessions_revoked`<br>in `system_audit_logs` | Revokes all active session tokens for the target user across all browsers, mobile devices, and locations. |
| **Suspend Account Button**<br>Drawer: Danger Zone Tab | `src/components/admin/accounts/AccountDetailsDrawer.tsx` | `suspendAccount()` (`src/lib/account-service.ts`) | Canonical: `public.profiles.status`<br>Auth: `auth.users.banned_until` | Update (`status = 'suspended'`) | `account_suspended`<br>in `account_audit_logs` | Bans auth user globally (`banned_until = 3000-01-01`); security context throws `ACCOUNT_SUSPENDED`. |
| **Reactivate Account Button**<br>Drawer: Danger Zone Tab | `src/components/admin/accounts/AccountDetailsDrawer.tsx` | `reactivateAccount()` (`src/lib/account-service.ts`) | Canonical: `public.profiles.status`<br>Auth: `auth.users.banned_until = null` | Update (`status = 'active'`) | `account_reactivated`<br>in `account_audit_logs` | Restores account status to `active`; unbans user in Supabase Auth; re-enables login and platform access. |
| **Acknowledge Security Alert**<br>Overview & Audit Tabs | `src/components/admin/security/SecurityAnomalyCard.tsx` | `acknowledgeSecurityAlert()` (`src/lib/security-center-service.ts`) | Canonical: `public.security_alerts` | Update (`status = 'acknowledged'`) | `alert_acknowledged`<br>in `system_audit_logs` | Updates alert state; decrements open alert badge in executive overview header. |
| **Audit Logs Search & Pagination**<br>`/admin/accounts?section=audit` | `src/components/admin/security/SystemAuditViewer.tsx` | `fetchSystemAuditLogs()` (`src/lib/security-center-service.ts`) | Canonical: `public.system_audit_logs` | Read | None (Read action) | Loads chronologically ordered immutable audit records with actor email, action, and target details. |

---

### 3. Canonical Sources of Truth Summary for Phase 1

1. **User Identity & Password Authentication**: `auth.users` (managed by Supabase GoTrue).
2. **Operational User Profile & Account Lifecycle**: `public.profiles` (`status` is the authoritative lifecycle state).
3. **Role-Based Access Control (RBAC)**: `public.user_roles` (`role` is the single authoritative source; `profiles.role` is legacy/derived).
4. **Granular Module Permissions**: `public.user_module_permissions` (`module` + `enabled` overrides role baseline; `profiles.module_permissions` is cached projection).
5. **Team Roster & Work Assignments**: `public.team_members` (`profile_id` / `user_id` links to `profiles.id`).
6. **Session & Device Telemetry**: `public.user_sessions` (`status`, `revoked_at`, `revocation_reason`).
7. **Security Threats & Anomaly Alerts**: `public.security_alerts` (`severity`, `status`, `incident_type`).
8. **Audit Trail & Non-Repudiation**:
   - `public.system_audit_logs` (system-wide administrative and security mutations).
   - `public.account_audit_logs` (lifecycle, provisioning, and role mutations for specific user accounts).
