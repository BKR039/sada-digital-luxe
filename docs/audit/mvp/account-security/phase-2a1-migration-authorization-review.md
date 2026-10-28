# SADA OS — Unified Account & Security Operations Center
# Phase 2A.1 Audit Report: Migration & Authorization Review

**Document ID:** `SADA-SEC-PHASE2A1-REVIEW`  
**Date:** 2026-10-17  
**Author:** Principal Security Engineer & Verification Team  
**Scope:** Independent End-to-End Review of Account Deletion Remediation (`admin_delete_account`, `admin_analyze_account_dependencies`, Migration `20261017163000`, FKs, Triggers, & Authorization Matrix)  
**Target Environment:** Isolated Native Local PostgreSQL 16 (`sada_local_test` at `127.0.0.1:5432`) + Static Schema AST  
**Shared Production Database Status:** **ZERO MUTATIONS (STRICTLY READ-ONLY VERIFIED)**  
**Final Phase 2A.1 Review Verdict:** **CONDITIONALLY ACCEPTED**

---

## 1. Executive Summary & Review Scope

This independent review evaluates Phase 2A's account deletion remediation against rigorous enterprise security, referential integrity, and PostgreSQL/Supabase lifecycle standards.

### Review Objectives:
1. **End-to-End Function Inspection:** Audit `public.admin_delete_account(UUID)` and `public.admin_analyze_account_dependencies(UUID)` line-by-line across both Branch A (Soft-Archive / Retention) and Branch B (Hard Purge).
2. **Deep Authorization Verification:** Prove authorization is enforced inside the database RPC transaction itself, independent of frontend routing or SQL `EXECUTE` grants.
3. **Comprehensive Referential Dependency Inventory:** Enumerate every foreign key referencing `auth.users`, `public.profiles`, `public.team_members`, and `public.user_sessions`, cross-referencing delete rules and active triggers.
4. **Dependency Completeness Audit:** Determine whether `admin_analyze_account_dependencies` catches all business, financial, and security dependencies before permitting Branch B hard purge.
5. **Runtime Reality & Supabase Auth Separation:** Clearly distinguish proven local PostgreSQL 16 runtime behavior from remote Supabase GoTrue Auth service assumptions.

---

## 2. Comprehensive Dependency Inventory

The following authoritative inventory traces all foreign key relationships, delete rules, and active triggers across the SADA Work OS schema:

### 2.1 Foreign Keys Referencing `auth.users(id)`

| Table & Column | FK Constraint Name | On Delete Action | Active Triggers on Referencing Table | Impact on Branch A (Soft-Archive) | Impact on Branch B (Hard Purge) |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `public.profiles.id` | `profiles_id_fkey` | `CASCADE` | `trg_guard_profiles_security_fields` | **Safe**: `auth.users` row is locked, NOT deleted; profile is tombstoned to `[Deleted Account]`. | **Purged**: Cascade deletes profile row. |
| `public.user_roles.user_id` | `user_roles_user_id_fkey` | `CASCADE` | None | **Safe**: Explicitly purged via `DELETE FROM user_roles` in Step A4. | **Purged**: Explicitly purged before `auth.users` delete. |
| `public.user_module_permissions.user_id` | `user_module_permissions_user_id_fkey` | `CASCADE` | None | **Safe**: Explicitly purged via `DELETE FROM user_module_permissions` in Step A4. | **Purged**: Explicitly purged before `auth.users` delete. |
| `public.team_members.profile_id` | `team_members_profile_id_fkey` | `NO ACTION` (Local) / `SET NULL` (Mig 99) | `team_updated` | **Safe**: Explicitly nullified in Step A1 (`profile_id = NULL`). | **Safe**: Explicitly deleted in Step B1. |
| `public.team_members.user_id` | `team_members_user_id_fkey` | `NO ACTION` (Local) / `SET NULL` (Mig 99) | `team_updated` | **Safe**: Explicitly nullified in Step A1 (`user_id = NULL`), resolving `DEFECT-P2-01`. | **Safe**: Explicitly deleted in Step B1. |
| `public.user_sessions.user_id` | `user_sessions_user_id_fkey` | `CASCADE` | `trg_prevent_delete_user_sessions`, `trg_guard_user_sessions_update` | **Safe**: Sessions are updated (`status = 'revoked'`), never deleted, resolving `DEFECT-P2-02`. | **Fails if sessions exist**: CASCADE delete would trigger `trg_prevent_delete_user_sessions`. Gated by `session_count = 0`. |
| `public.user_sessions.revoked_by` | `user_sessions_revoked_by_fkey` | `SET NULL` | `trg_guard_user_sessions_update` | **Safe**: `auth.users` row preserved. | **Safe**: Foreign sessions reference set to NULL. |
| `public.security_alerts.user_id` | `security_alerts_user_id_fkey` | `SET NULL` | None | **Safe**: `auth.users` row preserved. | **Nullified**: `user_id` becomes NULL. |
| `public.security_alerts.resolved_by` | `security_alerts_resolved_by_fkey` | `SET NULL` | None | **Safe**: `auth.users` row preserved. | **Nullified**: `resolved_by` becomes NULL. |
| `public.push_subscriptions.user_id` | `push_subscriptions_user_id_fkey` | `CASCADE` | None | **Safe**: `auth.users` row preserved. | **Purged**: Subscriptions cascade-deleted. |
| `public.notifications.user_id` | `notifications_user_id_fkey` | `CASCADE` | None | **Safe**: `auth.users` row preserved. | **Purged**: Notifications cascade-deleted. |
| `public.notification_preferences.user_id` | `notification_preferences_user_id_fkey` | `CASCADE` | None | **Safe**: `auth.users` row preserved. | **Purged**: Preferences cascade-deleted. |
| `public.business_rules.updated_by` | `business_rules_updated_by_fkey` | `NO ACTION` (RESTRICT) | `trg_archive_business_rule_version` | **Safe**: `auth.users` row preserved. | ⚠️ **POTENTIAL CRASH**: If user updated a rule, `DELETE FROM auth.users` will fail with FK constraint violation! |
| `public.business_rule_versions.changed_by` | `business_rule_versions_changed_by_fkey` | `NO ACTION` (RESTRICT) | `trg_prevent_rule_version_deletion` | **Safe**: `auth.users` row preserved. | ⚠️ **POTENTIAL CRASH**: If user changed a rule version, `DELETE FROM auth.users` will fail with FK constraint violation! |
| `public.account_audit_logs.actor_id` | `account_audit_logs_actor_id_fkey` | `SET NULL` | `trg_prevent_update_account_audit`, `trg_prevent_delete_account_audit` | **Safe**: `auth.users` row preserved. | ⚠️ **POTENTIAL CRASH**: `ON DELETE SET NULL` triggers `UPDATE`, which fires `trg_prevent_update_account_audit`! |
| `public.system_audit_logs.actor_id` | `system_audit_logs_actor_id_fkey` | `SET NULL` | `trg_prevent_update_system_audit`, `trg_prevent_delete_system_audit` | **Safe**: `auth.users` row preserved. | ⚠️ **POTENTIAL CRASH**: `ON DELETE SET NULL` triggers `UPDATE`, which fires `trg_prevent_update_system_audit`! |
| `public.client_workspaces.account_manager_id` | `client_workspaces_account_manager_id_fkey` | `SET NULL` | None | **Safe**: `auth.users` row preserved. | **Nullified**: `account_manager_id` becomes NULL. |
| `public.client_workspaces.sales_owner_id` | `client_workspaces_sales_owner_id_fkey` | `SET NULL` | None | **Safe**: `auth.users` row preserved. | **Nullified**: `sales_owner_id` becomes NULL. |
| `auth.identities.user_id` | `identities_user_id_fkey` | `CASCADE` | None | **Safe**: Explicitly purged via `DELETE FROM auth.identities` in Step A4. | **Purged**: Explicitly purged before `auth.users` delete. |

### 2.2 Foreign Keys Referencing `public.profiles(id)`

| Table & Column | FK Constraint Name | On Delete Action | Active Triggers | Branch A (Soft-Archive) Behavior | Branch B (Hard Purge) Behavior |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `public.project_tasks.assignee_id` | `project_tasks_assignee_id_fkey` | `SET NULL` | `project_tasks_updated`, `trg_project_tasks_completed_at` | **Preserved**: Points to `profiles` tombstone `[Deleted Account]`. | **Nullified**: Set to NULL if 0 tasks (gated). |
| `public.project_tasks.assigned_by_id` | `project_tasks_assigned_by_id_fkey` | `SET NULL` | `project_tasks_updated` | **Preserved**: Points to tombstone. | **Nullified**: Gated by `_created_tasks = 0`. |
| `public.project_activity.actor_id` | `project_activity_actor_id_fkey` | `SET NULL` | None | **Preserved**: Points to tombstone. | **Nullified**: Gated by `_activity_count = 0`. |
| `public.client_projects.lead_id` | `client_projects_lead_id_fkey` | `SET NULL` | `client_projects_updated` | **Preserved**: Points to tombstone. | **Nullified**: Gated by `_lead_projects_count = 0`. |
| `public.deals.sales_owner_id` | `deals_sales_owner_id_fkey` | `SET NULL` | None | **Preserved**: Points to tombstone. | ⚠️ **UNCHECKED**: Not checked in `admin_analyze_account_dependencies`. |
| `public.sales_commissions.approved_by`| `sales_commissions_approved_by_fkey` | `SET NULL` | None | **Preserved**: Points to tombstone. | ⚠️ **UNCHECKED**: Not checked in `admin_analyze_account_dependencies`. |
| `public.project_members.profile_id` | `project_members_profile_id_fkey` | `CASCADE` | None | **Preserved**: Points to tombstone. | ⚠️ **CASCADE DELETED**: Drops project membership without check. |
| `public.task_handoff_requests.*` | `task_handoff_requests_*_fkey` | `CASCADE` | None | **Preserved**: Points to tombstone. | ⚠️ **CASCADE DELETED**: Drops handoff audit rows. |

### 2.3 Foreign Keys Referencing `public.team_members(id)`

| Table & Column | FK Constraint Name | On Delete Action | Active Triggers | Branch A (Soft-Archive) Behavior | Branch B (Hard Purge) Behavior |
| :--- | :--- | :---: | :--- | :--- | :--- |
| `public.salary_records.team_member_id` | `salary_records_team_member_id_fkey` | `CASCADE` | None | **Preserved**: `team_members` row preserved (`profile_id = NULL, user_id = NULL`). | **Gated**: `_salary_records_count = 0`. |
| `public.salary_payments.team_member_id`| `salary_payments_team_member_id_fkey` | `RESTRICT` | None | **Preserved**: `team_members` row preserved; no RESTRICT abort. | **Gated**: `_salary_payments_count = 0`. |
| `public.salary_requests.team_member_id`| `salary_requests_team_member_id_fkey` | `CASCADE` | None | **Preserved**: `team_members` row preserved. | **Gated**: `_salary_requests_count = 0`. |
| `public.sales_commissions.team_member_id`| `sales_commissions_team_member_id_fkey` | `CASCADE` | None | **Preserved**: `team_members` row preserved. | ⚠️ **UNCHECKED CASCADE**: If account has commissions but no salary/tasks, Branch B CASCADE deletes commissions! |
| `public.deals.commission_recipient_id` | `deals_commission_recipient_id_fkey` | `SET NULL` | None | **Preserved**: `team_members` row preserved. | **Nullified**: `commission_recipient_id` becomes NULL. |
| `public.project_members.team_member_id` | `project_members_team_member_id_fkey` | `CASCADE` | None | **Preserved**: `team_members` row preserved. | **Cascade Deleted**: Workspace membership purged. |

---

## 3. Comprehensive Authorization Matrix

The table below examines all caller scenarios and verifies that authorization is strictly enforced at the database level inside `public.admin_delete_account(UUID)` and `public.admin_analyze_account_dependencies(UUID)`:

| Caller Scenario | `auth.uid()` State | Role in `public.user_roles` | Profile `status` | Target Account | Expected Result | Enforced Mechanism Inside RPC |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **Anonymous** | `NULL` | None | None | Any | ❌ **REJECTED** | `is_super_admin(NULL)` returns `false` -> `RAISE EXCEPTION 'Unauthorized: Only Super Admin can delete accounts.'` (Also SQL `REVOKE EXECUTE ... FROM PUBLIC, anon`). |
| **Worker** | `UUID` | `'worker'` | `'active'` | Any | ❌ **REJECTED** | `is_super_admin(_actor_id)` checks `ur.role = 'super_admin'` -> returns `false` -> `RAISE EXCEPTION 'Unauthorized: Only Super Admin can delete accounts.'`. |
| **Admin** | `UUID` | `'admin'` | `'active'` | Any | ❌ **REJECTED** | `is_super_admin(_actor_id)` requires exact `'super_admin'` string -> returns `false` -> `RAISE EXCEPTION 'Unauthorized: Only Super Admin can delete accounts.'`. |
| **Authorized Super Admin** | `UUID` | `'super_admin'` | `'active'` | Distinct User (Active SA > 1) | ✅ **AUTHORIZED** | All guards pass; executes Branch A or Branch B atomically based on dependency analysis. |
| **Super Admin: Self-Deletion** | `UUID` | `'super_admin'` | `'active'` | Same as Caller (`_actor_id = _user_id`) | ❌ **REJECTED** | Line 124: `IF _actor_id = _user_id THEN RAISE EXCEPTION 'Cannot delete own account (administrative self-lockout protection).'` |
| **Super Admin: Last Active SA** | `UUID` | `'super_admin'` | `'active'` | Other Super Admin (`count_active_super_admins() <= 1`) | ❌ **REJECTED** | Line 138: `IF public.count_active_super_admins() <= 1 THEN RAISE EXCEPTION 'At least one active Super Admin is required.'` |
| **Super Admin: Nonexistent Target**| `UUID` | `'super_admin'` | `'active'` | Unregistered UUID | ❌ **REJECTED** | Line 131: `IF _target_email IS NULL THEN RAISE EXCEPTION 'Account not found.'` |
| **Suspended Super Admin** | `UUID` | `'super_admin'` | `'suspended'` | Any | ❌ **REJECTED** | `public.is_super_admin(_user_id)` line 172 checks `p.status = 'active'`. A suspended user evaluates to `false` -> throws Unauthorized. |
| **Revoked Session Super Admin** | `UUID` | `'super_admin'` | `'active'` | Any | ❌ **REJECTED** | `public.is_super_admin(_user_id)` line 163 checks `public.is_session_active()`. Revoked/expired session evaluates to `false` -> throws Unauthorized. |

---

## 4. Line-by-Line Review of Deletion Branches

### 4.1 Branch A: Safe Soft-Archive Deactivation (`IF _requires_soft_archive THEN`)
- **Lines 154–160 (A1: Team Member De-linking):**
  ```sql
  UPDATE public.team_members
  SET profile_id = NULL,
      user_id = NULL,
      is_active = false,
      updated_at = now()
  WHERE profile_id = _user_id OR user_id = _user_id OR LOWER(email) = LOWER(_target_email);
  ```
  *Analysis:* Correctly sets both `profile_id` and `user_id` to `NULL`. This completely eliminates the `team_members_user_id_fkey` constraint violation (`DEFECT-P2-01`). The `team_members` row is retained (`is_active = false`), preserving referential integrity for `public.salary_payments` (`ON DELETE RESTRICT`) and `public.sales_commissions`.
- **Lines 162–168 (A2: Session Revocation):**
  ```sql
  UPDATE public.user_sessions
  SET status = 'revoked',
      revoked_at = now(),
      revoked_by = _actor_id,
      revocation_reason = 'account_deleted',
      updated_at = now()
  WHERE user_id = _user_id AND status IN ('active', 'idle');
  ```
  *Analysis:* Updates active and idle sessions to `'revoked'`. Does NOT issue a `DELETE` statement against `public.user_sessions`, ensuring the trigger `trg_prevent_delete_user_sessions` is never invoked (`DEFECT-P2-02`). Historical telemetry and session audit records remain 100% immutable and intact.
- **Lines 170–176 (A3: Profile Tombstone):**
  ```sql
  UPDATE public.profiles
  SET status = 'deleted',
      display_name = '[Deleted Account]',
      module_permissions = '{}'::jsonb,
      updated_at = now()
  WHERE id = _user_id;
  ```
  *Analysis:* Writes the tombstone marker. Because `auth.users` row is not deleted, the `profiles.id REFERENCES auth.users(id) ON DELETE CASCADE` constraint does not fire, preserving the tombstone permanently (`DEFECT-P2-03`). Downstream queries and historical task joins referencing `profiles.id` resolve cleanly to `'[Deleted Account]'`.
- **Lines 178–181 (A4: Operational Identity Eradication):**
  ```sql
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  DELETE FROM public.user_module_permissions WHERE user_id = _user_id;
  DELETE FROM auth.identities WHERE user_id = _user_id;
  ```
  *Analysis:* Completely purges operational roles and permissions, eliminating authorization capability across all modules. Eradicates external OAuth/identities.
- **Lines 183–194 (A5: Identity Lockout in `auth.users`):**
  ```sql
  UPDATE auth.users
  SET banned_until = '3000-01-01 00:00:00+00'::timestamptz,
      encrypted_password = NULL,
      raw_user_meta_data = jsonb_build_object(
        'deleted', true,
        'deleted_at', now(),
        'deleted_by', _actor_id,
        'original_email', _target_email
      )
  WHERE id = _user_id;
  ```
  *Analysis:* Permanently disables authentication in `auth.users`. Scrambles/nullifies the bcrypt password hash. Stores deletion provenance in `raw_user_meta_data`. By keeping the primary key row alive, all cascading FKs are neutralized.

### 4.2 Branch B: Hard Purge (`ELSE`)
- **Lines 200–207:**
  ```sql
  DELETE FROM public.team_members WHERE profile_id = _user_id OR user_id = _user_id OR LOWER(email) = LOWER(_target_email);
  DELETE FROM public.user_module_permissions WHERE user_id = _user_id;
  DELETE FROM public.user_roles WHERE user_id = _user_id;
  DELETE FROM public.profiles WHERE id = _user_id;
  DELETE FROM auth.identities WHERE user_id = _user_id;
  DELETE FROM auth.users WHERE id = _user_id;
  ```
  *Analysis:* Deletes records in reverse dependency order: `team_members` -> permissions -> roles -> profiles -> identities -> users.
  *Findings & Vulnerabilities in Branch B:*
  1. **Blind Spot in Dependency Check:** `admin_analyze_account_dependencies` checks tasks, activities, led projects, salary records, and user sessions. It **omits** querying `sales_commissions`, `deals`, `business_rules`, and audit logs.
  2. If an account has `sales_commissions` but zero tasks/salary/sessions, executing `DELETE FROM public.team_members` will **CASCADE DELETE all sales commissions**, destroying commission ledger history!
  3. If an account was `updated_by` on `public.business_rules`, executing `DELETE FROM auth.users` will fail with an unhandled `business_rules_updated_by_fkey` constraint violation.
  4. If an account was `actor_id` on `public.account_audit_logs`, `DELETE FROM auth.users` triggers `ON DELETE SET NULL`, which triggers `trg_prevent_update_account_audit`, aborting the deletion with an immutable audit exception!

---

## 5. Untested Assumptions & Residual Defects

1. **Branch B Dependency Blind Spots (P2 — Medium):**
   - **Finding:** `admin_analyze_account_dependencies` does not count references in:
     - `public.sales_commissions` (`team_member_id`)
     - `public.deals` (`sales_owner_id`, `commission_recipient_id`)
     - `public.business_rules` (`updated_by`) and `public.business_rule_versions` (`changed_by`)
     - `public.account_audit_logs` (`actor_id`) and `public.system_audit_logs` (`actor_id`)
   - **Remediation Required for Phase 2B/Deployment:** Add counts for `sales_commissions`, `deals`, `business_rules`, and audit logs into `admin_analyze_account_dependencies`. If ANY of these exist, force `has_business_dependencies = true`, routing the deletion safely to Branch A.

2. **Email Re-Registration Collision on Soft-Archived Accounts (P3 — Low / Operational Characteristic):**
   - **Finding:** When Branch A soft-archives an account, `auth.users` row is kept with `banned_until = '3000-01-01'`. The email remains in `auth.users.email`.
   - **Effect:** If an administrator attempts to create a new user with that exact same email via Supabase Auth API (`auth.admin.createUser`), GoTrue will reject with `"User already registered"`.
   - **Operational Standard:** The email is permanently reserved. If re-registration is needed, the soft-archived account must either be reactivated via `admin_reactivate_account_with_security`, or its email in `auth.users` must be updated (e.g. `deleted_${timestamp}_${email}`).

3. **Supabase Auth Daemon (GoTrue) vs Native PostgreSQL Runtime Boundary (Safety Invariant):**
   - **Status:** **PROVEN ON LOCAL POSTGRESQL 16 RUNTIME; RUNTIME UNVERIFIED ON REMOTE GOTRUE DAEMON.**
   - **Explanation:** In local PostgreSQL, `auth.users` is a standard schema table. On a remote Supabase production project, `auth.users` is managed by GoTrue. While direct SQL mutations (`UPDATE auth.users SET banned_until = ...`) execute with superuser privileges, GoTrue's internal JWT token revocation caches or session states can only be verified against a live GoTrue service. Per project safety rules, remote production mutations were strictly prohibited.

---

## 6. Execution Commands & Test Evidence

### Local Test Execution Evidence
- **Environment:** Native PostgreSQL 16.15 (`sada_local_test` on `127.0.0.1:5432`)
- **Remote Production Database:** `mtfkzabiscyleztypqks.supabase.co` (0 connections, 0 mutations, verified by `scripts/test-db-guard.ts`)
- **Commands Executed:**
  ```powershell
  npx tsx scripts/certify-phase2a-deletion-integrity.ts
  npx tsx scripts/certify-phase1a-local-runtime.ts
  npx tsx scripts/test-phase1a-remediation-suite.ts
  npx tsc --noEmit
  npm run build
  ```
- **Results:**
  - `certify-phase2a-deletion-integrity.ts`: **10 / 10 assertions PASSED (100%)**
  - `certify-phase1a-local-runtime.ts`: **14 / 14 assertions PASSED (100%)**
  - `test-phase1a-remediation-suite.ts`: **42 / 42 assertions PASSED (100%)**
  - TypeScript compiler (`npx tsc --noEmit`): **0 errors**
  - Production build (`npm run build`): **0 errors**

---

## 7. Final Phase 2A.1 Review Verdict

**FINAL VERDICT: CONDITIONALLY ACCEPTED**

### Conditions for Production Deployment:
1. **Condition 1 (Dependency Completeness in RPC):** Before deploying migration `20261017163000` to production, update `admin_analyze_account_dependencies` to explicitly count `sales_commissions`, `deals`, `business_rules`, and audit logs, ensuring accounts bearing commercial, financial, or governance provenance are guaranteed to execute Branch A.
2. **Condition 2 (Supabase GoTrue Runtime Certification):** Acknowledge that remote GoTrue session cache invalidation is classified as **UNVERIFIED** until tested against an isolated staging Supabase instance with a running GoTrue container.
3. **Condition 3 (Zero Production Mutations Honored):** The shared production database remains untouched.

**Stop Condition Met:** Phase 2A.1 review complete. Phase 3 has not been started.
