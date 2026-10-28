# SADA OS — Unified Account & Security Operations Center
## Single Source of Truth (SSOT) & Telemetry Provenance Registry

**Document ID:** `SADA-SEC-PHASE0-SSOT`  
**Date:** 2026-10-17  
**Status:** COMPLETE (READ-ONLY BASELINE DISCOVERY)  
**Classification:** Canonical Source-of-Truth & Data Dictionary  

---

## 1. Executive Definition & Entity Disambiguation

A foundational principle of SADA OS security is that **entities must never be confused or used interchangeably**:

| Entity Name | Canonical Database Table | Authoritative Boundary | Description & Distinctions |
| :--- | :--- | :--- | :--- |
| **Authentication Identity** (`auth.users`) | `auth.users` | Supabase GoTrue Auth | The authenticatable credential and login principal (`id`, `email`, encrypted password, `banned_until`, `last_sign_in_at`). Counts of "Total Accounts" refer **exclusively** to this entity. |
| **User Profile** (`public.profiles`) | `public.profiles` | PostgreSQL Table with RLS | Operational account lifecycle record (`id` $\rightarrow$ `auth.users.id`, `status`: `active`/`suspended`/`pending`/`disabled`/`deleted`, `phone`, `display_name`). `profiles.role` does not exist in schema (migrated to `user_roles`). |
| **Team Member** (`public.team_members`) | `public.team_members` | PostgreSQL Table with RLS | Operational roster entry representing a human specialist in workflow/project assignments (`id`, `name`, `division`, `position`, `published`, `is_active`, `profile_id`, `user_id`). Not all auth users are team members; team members may exist prior to auth account provisioning. |
| **User Role** (`public.user_roles`) | `public.user_roles` | PostgreSQL Table with RLS | **Single authoritative source of user roles** (`user_id`, `role`: `super_admin`, `admin`, `worker`). |
| **Module Override** (`user_module_permissions`) | `public.user_module_permissions` | PostgreSQL Table with RLS | **Single canonical source of granular per-user overrides** (`user_id`, `module`, `enabled`, `actions` JSONB). |
| **Permissions Cache** (`profiles.module_permissions`) | `public.profiles` (`module_permissions`) | Database JSONB Column | **Read-through cache / projection only**. Synchronized atomically by `admin_provision_account` and `admin_update_account_permissions`. Never an independent authoritative source. |
| **User Session** (`public.user_sessions`) | `public.user_sessions` | PostgreSQL Table with RLS | Comprehensive stateful device inventory (`session_id`, `user_id`, `status`: `active`, `idle`, `expired`, `revoked`, `jwt_session_id`). |
| **Security Alert** (`public.security_alerts`) | `public.security_alerts` | PostgreSQL Table with RLS | Rule-generated anomaly and threat tracking (`rule_id`, `severity`, `status`: `open`, `acknowledged`, `resolved`, `dismissed`). |
| **System Audit Log** (`public.system_audit_logs`) | `public.system_audit_logs` | Immutable PostgreSQL Table | System-wide administrative, financial, and authentication audit trail. |
| **Account Audit Log** (`public.account_audit_logs`) | `public.account_audit_logs` | Immutable PostgreSQL Table | Account-specific provisioning, role modification, and lifecycle history. |

---

## 2. Telemetry Metric Provenance & Exact Formulas

Every metric displayed in the Unified Operations Center has a mathematically strict, database-proven provenance:

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   SADA OS METRICS PROVENANCE                                 │
├───────────────────────────────┬──────────────────────┬─────────────┬─────────────────────────┤
│ Displayed Metric              │ Authoritative Source │ Type Badge  │ Precise SQL / Formula   │
├───────────────────────────────┼──────────────────────┼─────────────┼─────────────────────────┤
│ Active Sessions Now           │ public.user_sessions │ LIVE        │ status = 'active' AND   │
│                               │                      │             │ last_activity > 24h ago │
│ Unique Active Users           │ public.user_sessions │ LIVE        │ COUNT(DISTINCT user_id) │
│                               │                      │             │ where session active    │
│ Total Registered Accounts     │ auth.users           │ DATABASE    │ admin_list_accounts()   │
│                               │ + public.profiles    │             │ (status != 'deleted')   │
│ Suspended Accounts            │ public.profiles      │ DATABASE    │ status = 'suspended'    │
│                               │                      │             │ (banned_until IS NOT NULL)
│ Revoked Sessions (30 Days)    │ public.user_sessions │ HISTORICAL  │ status = 'revoked' AND  │
│                               │                      │             │ revoked_at > 30d ago    │
│ Open Security Alerts          │ public.security_alerts│ LIVE       │ status = 'open'         │
│ Privileged Actions (7 Days)   │ public.system_audit_ │ HISTORICAL  │ action IN ('SUSPEND',   │
│                               │ logs                 │             │ 'REVOKE', 'ROLE_CHANGE',│
│                               │                      │             │ 'PERMS') AND age <= 7d  │
└───────────────────────────────┴──────────────────────┴─────────────┴─────────────────────────┘
```

### 2.1 Metric Specifications

#### 1. Active Sessions Now (`kpis.active_sessions_count`)
- **UI Location:** `SecurityOverviewTab.tsx`, `AccountsKPICards.tsx`, `SecurityControlCenterNav.tsx`
- **Type Badge:** `LIVE` (Green pulse indicator)
- **Authoritative Source:** `public.user_sessions`
- **Provenance Formula:**
  ```sql
  SELECT COUNT(*)
  FROM public.user_sessions
  WHERE status = 'active'
    AND last_activity_at > (now() - INTERVAL '24 hours');
  ```
- **Definition:** The exact number of sessions with state `active` that have recorded user activity within the trailing 24 hours. Does not include idle, expired, or revoked sessions.

#### 2. Unique Active Users (`kpis.unique_active_users_count`)
- **UI Location:** `SecurityOverviewTab.tsx`
- **Type Badge:** `LIVE`
- **Authoritative Source:** `public.user_sessions`
- **Provenance Formula:**
  ```sql
  SELECT COUNT(DISTINCT user_id)
  FROM public.user_sessions
  WHERE status = 'active'
    AND last_activity_at > (now() - INTERVAL '24 hours');
  ```
- **Definition:** Distinct individual authenticatable accounts currently operating at least one active session. Distinguishes multi-device logins for a single identity from distinct human operators.

#### 3. Total Registered Accounts (`totalAccounts`)
- **UI Location:** `SecurityOverviewTab.tsx`, `AccountsKPICards.tsx`, `SecurityControlCenterNav.tsx`
- **Type Badge:** `DATABASE`
- **Authoritative Source:** `auth.users` joined with `public.profiles` via `public.admin_list_accounts()`
- **Provenance Formula:**
  ```sql
  SELECT COUNT(*)
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE COALESCE(p.status, 'active') != 'deleted';
  ```
- **Definition:** The total population of authenticatable identities provisioned in Supabase GoTrue that have not undergone soft deletion.

#### 4. Suspended Accounts (`kpis.suspended_accounts_count`)
- **UI Location:** `SecurityOverviewTab.tsx`, `AccountsKPICards.tsx`
- **Type Badge:** `DATABASE`
- **Authoritative Source:** `public.profiles` (synchronized with `auth.users.banned_until`)
- **Provenance Formula:**
  ```sql
  SELECT COUNT(*)
  FROM public.profiles
  WHERE status = 'suspended';
  ```
- **Definition:** Accounts whose platform access is blocked by an administrator.

#### 5. Revoked Sessions in Last 30 Days (`kpis.revoked_sessions_count`)
- **UI Location:** `SecurityOverviewTab.tsx`
- **Type Badge:** `HISTORICAL`
- **Authoritative Source:** `public.user_sessions`
- **Provenance Formula:**
  ```sql
  SELECT COUNT(*)
  FROM public.user_sessions
  WHERE status = 'revoked'
    AND revoked_at > (now() - INTERVAL '30 days');
  ```
- **Definition:** Sessions that were terminated prior to natural expiration. Preserved in database due to table-level delete prevention (`trg_prevent_delete_user_sessions`).

#### 6. Open Security Alerts (`kpis.open_security_alerts_count`)
- **UI Location:** `SecurityOverviewTab.tsx`, `SecurityControlCenterNav.tsx`
- **Type Badge:** `LIVE`
- **Authoritative Source:** `public.security_alerts`
- **Provenance Formula:**
  ```sql
  SELECT COUNT(*)
  FROM public.security_alerts
  WHERE status = 'open';
  ```
- **Definition:** Unresolved security incidents requiring Super Admin review.

#### 7. Privileged Administrative Actions in Last 7 Days (`kpis.high_risk_actions_count`)
- **UI Location:** `SecurityOverviewTab.tsx`
- **Type Badge:** `HISTORICAL`
- **Authoritative Source:** `public.system_audit_logs`
- **Provenance Formula:**
  ```sql
  SELECT COUNT(*)
  FROM public.system_audit_logs
  WHERE action IN (
    'ACCOUNT_SUSPENDED',
    'SESSION_REVOKED',
    'GLOBAL_SIGN_OUT',
    'ROLE_CHANGE',
    'PERMISSIONS_UPDATED'
  )
  AND created_at > (now() - INTERVAL '7 days');
  ```
- **Definition:** High-impact administrative operations committed within the trailing 7 days.

---

## 3. Comprehensive UI Control to Database SSOT Matrix

| UI Component & Location | Invoked Service Method | Authoritative Database Table / Provider | Authoritative Write RPC | Foreign Keys & Dependent Records | RLS & Server Authorization | Realtime / Invalidation | Verification Query / RPC |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Accounts Table** (`/admin/accounts?section=accounts`) | `fetchAccounts()` | `auth.users` + `public.profiles` + `public.user_roles` + `public.team_members` | Read-only | `profiles.id` $\rightarrow$ `auth.users.id`, `user_roles.user_id` $\rightarrow$ `auth.users.id` | Super Admin required (`is_super_admin(auth.uid())`) | Manual refresh; cache invalidation on mutation | `SELECT * FROM public.admin_list_accounts();` |
| **"Create Account" Modal** (`CreateAccountModal.tsx`) | `createAccount()` | 1. `auth.users`<br>2. `public.profiles`<br>3. `public.user_roles`<br>4. `public.team_members`<br>5. `public.user_module_permissions`<br>6. `public.account_audit_logs` | `public.admin_provision_account` | `user_roles.user_id`, `profiles.id`, `team_members.user_id` / `profile_id` | `assertAuthorizedMutation("accounts", "accounts.manage")`; `public.is_super_admin()` in RPC | Invalidate security context cache | `SELECT * FROM auth.users WHERE email = ...;` `SELECT * FROM user_roles WHERE user_id = ...;` |
| **Edit Profile & Role** (`AccountDetailsDrawer.tsx` Identity Tab) | `updateAccount()` | `public.profiles`, `public.user_roles`, `public.team_members`, `public.account_audit_logs` | `public.admin_update_account` | `team_members.profile_id`, `user_roles.user_id` | Super Admin required; anti-self-demotion checked | `invalidateSecurityContextCache(userId)` | `SELECT role FROM user_roles WHERE user_id = ...;` `SELECT status FROM profiles WHERE id = ...;` |
| **Permission Toggles** (`AccountPermissionsPanel.tsx`) | `updateAccountPermissions()` | `public.user_module_permissions` (Canonical), `public.profiles.module_permissions` (Cache), `public.account_audit_logs`, `public.system_audit_logs` | `public.admin_update_account_permissions` | `user_module_permissions.user_id` $\rightarrow$ `auth.users.id` | Super Admin required; anti-self-lockout for `accounts` module | `invalidateSecurityContextCache(userId)` | `SELECT * FROM user_module_permissions WHERE user_id = ...;` |
| **Revoke Single Session** (`LiveSessionsTab.tsx` / Drawer) | `revokeSession()` | `public.user_sessions`, `public.system_audit_logs`, `public.account_audit_logs` | `public.admin_revoke_session` | `user_sessions.user_id` $\rightarrow$ `auth.users.id` | Super Admin required; cannot revoke own active session | Realtime channel `sada-user-session-revocation` broadcast; client `signOut()` | `SELECT status, revoked_at FROM user_sessions WHERE session_id = ...;` |
| **Sign Out Everywhere** (`AccountDangerZone.tsx` / `EmergencyActionModals.tsx`) | `revokeAllUserSessions()` | `public.user_sessions`, `public.system_audit_logs`, `public.account_audit_logs` | `public.admin_revoke_all_user_sessions` | `user_sessions.user_id` $\rightarrow$ `auth.users.id` | Super Admin required; cannot revoke own user account | Realtime channel broadcast | `SELECT COUNT(*) FROM user_sessions WHERE user_id = ... AND status = 'active';` (must be 0) |
| **Suspend Account** (`AccountDangerZone.tsx` / `EmergencyActionModals.tsx`) | `suspendAccountWithSessions()` | `public.profiles` (`status='suspended'`), `auth.users` (`banned_until='3000-01-01'`), `public.team_members` (`is_active=false`), `public.user_sessions` (all active set to `revoked`), audit logs | `public.admin_suspend_account_with_sessions` | All records linked to `user_id` | Super Admin required; last Super Admin protection; self-suspension blocked | Realtime session revocation channel; cache invalidated | `SELECT status FROM profiles WHERE id = ...;` `SELECT banned_until FROM auth.users WHERE id = ...;` |
| **Reactivate Account** (`AccountDangerZone.tsx` / `EmergencyActionModals.tsx`) | `reactivateAccountSecurity()` | `public.profiles` (`status='active'`), `auth.users` (`banned_until=NULL`), `public.team_members` (`is_active=true`), audit logs | `public.admin_reactivate_account_with_security` | Linked `user_id` | Super Admin required | Cache invalidated; revoked sessions remain revoked | `SELECT status FROM profiles WHERE id = ...;` `SELECT banned_until FROM auth.users WHERE id = ...;` |
| **Password Reset** (`AccountSecurityPanel.tsx`) | `resetAccountPassword()` | `auth.users` (password hash updated) | `public.admin_reset_account_password` | `auth.users.id` | Super Admin required | Password changed in GoTrue; old JWTs reject if invalidated | Authenticate with new password via isolated client |
| **Security Alerts Triage** (`SecurityAlertsTab.tsx`) | `resolveSecurityAlert()` | `public.security_alerts` (`status`: `acknowledged`/`resolved`/`dismissed`) | Direct PostgreSQL Update | `security_alerts.user_id` | Super Admin RLS policy | KPI refresh on update | `SELECT status, resolved_at FROM security_alerts WHERE id = ...;` |
| **System Audit Logs** (`AuditHistoryTab.tsx`) | `fetchSystemAuditLogs()` | `public.system_audit_logs` | Read-only | Immutable (triggers prevent UPDATE and DELETE) | `is_admin(auth.uid())` OR `is_super_admin(auth.uid())` | Manual refresh | `SELECT * FROM system_audit_logs ORDER BY created_at DESC;` |
| **Audit Trail Export** (`AuditHistoryTab.tsx`) | `logSystemAudit()` + Client export | `public.system_audit_logs` (exports records and logs export action) | `INSERT INTO system_audit_logs` | None | Super Admin only; action `AUDIT_LOGS_EXPORTED` recorded | Event emitted to audit trail | Verify export audit row created in `system_audit_logs` |
