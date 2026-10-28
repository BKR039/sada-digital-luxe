# SADA OS — Unified Account & Security Operations Center
## Database Relationship Map, Foreign Key Cascades & Immutability Invariants

**Document ID:** `SADA-SEC-PHASE0-DB-MAP`  
**Date:** 2026-10-17  
**Status:** COMPLETE (READ-ONLY BASELINE DISCOVERY)  
**Classification:** Database Architecture & Integrity Specifications  

---

## 1. Relational Entity Dependency Diagram

```
                              ┌────────────────────────┐
                              │       auth.users       │
                              │ (GoTrue Authentication)│
                              └───────────┬────────────┘
                                          │
                 ┌────────────────────────┼────────────────────────┐
                 │ 1:1                    │ 1:Many                 │ 1:Many
                 ▼                        ▼                        ▼
        ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
        │ public.profiles │      │public.user_roles│      │user_module_perms│
        │(Account Status) │      │  (App Roles)    │      │(Module Overrides)│
        └────────┬────────┘      └─────────────────┘      └─────────────────┘
                 │
                 │ 1:1 (optional link)
                 ▼
        ┌─────────────────────┐
        │ public.team_members │
        │ (Operational Roster)│
        └──────────┬──────────┘
                   │
    ┌──────────────┼──────────────────────────────┬──────────────────────────────┐
    │ 1:Many       │ 1:Many                       │ 1:Many                       │ 1:Many
    ▼              ▼                              ▼                              ▼
┌────────┐ ┌────────────────┐           ┌───────────────────┐          ┌───────────────────┐
│ tasks  │ │client_projects │           │  salary_records   │          │    sales_deals    │
│(Assign)│ │(Project Leads) │           │(Compensation SSOT)│          │ (Commission Recip)│
└────────┘ └────────────────┘           └─────────┬─────────┘          └───────────────────┘
                                                  │
                                                  │ 1:Many
                                                  ▼
                                        ┌───────────────────┐
                                        │  salary_payments  │
                                        │(Treasury Outflows)│
                                        └───────────────────┘

 ═════════════════════════════════════════════════════════════════════════════════════════
                            IMMUTABLE SECURITY & AUDIT STREAMS
 ═════════════════════════════════════════════════════════════════════════════════════════

        ┌─────────────────────┐      ┌─────────────────────┐      ┌─────────────────────┐
        │public.user_sessions │      │public.system_audit  │      │public.account_audit │
        │ (Session Inventory) │      │      _logs          │      │      _logs          │
        │ [DELETE BLOCKED]    │      │ [DELETE/UPDATE BLK] │      │ [DELETE/UPDATE BLK] │
        └─────────────────────┘      └─────────────────────┘      └─────────────────────┘
                   │
                   │ 1:Many (optional FK)
                   ▼
        ┌─────────────────────┐
        │public.security_alert│
        │  (Anomaly Tracking) │
        └─────────────────────┘
```

---

## 2. Table-by-Table Foreign Key & Constraint Matrix

| Table Name | Primary Key | Foreign Key Columns | Referenced Table & Column | On Delete Action | Check Constraints & Invariants |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`public.profiles`** | `id` | `id` | `auth.users(id)` | `CASCADE` | `status IN ('active', 'suspended', 'pending', 'disabled', 'deleted')` |
| **`public.user_roles`** | `id` | `user_id` | `auth.users(id)` | `CASCADE` | `UNIQUE(user_id, role)`, `role IN ('super_admin', 'admin', 'worker')` |
| **`public.user_module_permissions`** | `id` | `user_id` | `auth.users(id)` | `CASCADE` | `UNIQUE(user_id, module)`, `enabled BOOLEAN`, `actions JSONB` |
| **`public.team_members`** | `id` | `profile_id`<br>`user_id` | `public.profiles(id)`<br>`auth.users(id)` | `SET NULL`<br>`SET NULL` | `role IN ('super_admin', 'admin', 'worker')`, `division TEXT` |
| **`public.user_sessions`** | `id` | `user_id`<br>`revoked_by` | `auth.users(id)`<br>`auth.users(id)` | `CASCADE`<br>`SET NULL` | `status IN ('active', 'idle', 'expired', 'revoked')`, `session_id UNIQUE` |
| **`public.security_alerts`** | `id` | `user_id`<br>`session_id`<br>`resolved_by` | `auth.users(id)`<br>`public.user_sessions(id)`<br>`auth.users(id)` | `SET NULL`<br>`SET NULL`<br>`SET NULL` | `severity IN ('critical', 'high', 'medium', 'low')`, `status IN ('open', 'acknowledged', 'resolved', 'dismissed')` |
| **`public.system_audit_logs`** | `id` | `actor_id` | `auth.users(id)` | `SET NULL` | Immutable: No deletes or updates allowed |
| **`public.account_audit_logs`**| `id` | `actor_id` | `auth.users(id)` | `SET NULL` | Immutable: No deletes or updates allowed |
| **`public.rate_limit_buckets`**| `key, window_start` | None | N/A | N/A | Sliding window counter for Layer 7 anti-abuse |

---

## 3. Account Lifecycle Invariants: Suspension vs Deletion

### 3.1 Account Suspension Invariants (`admin_suspend_account_with_sessions`)
When an account is suspended:
1. **Target Account Banning:** `auth.users.banned_until` is set to `'3000-01-01 00:00:00+00'::timestamptz`. This immediately prevents GoTrue from issuing new tokens or refreshing existing ones.
2. **Profile Status Update:** `public.profiles.status` transitions to `'suspended'`.
3. **Session Invalidation:** All active or idle sessions in `public.user_sessions` belonging to the user are immediately updated to `status = 'revoked'` with `revocation_reason = 'Account suspended: ...'`.
4. **Team Member Status:** Linked `public.team_members.is_active` is set to `false`.
5. **Immediate In-Database Access Cutoff:** `public.is_session_active()` evaluates to `false` for any PostgREST calls using the user's unexpired JWT token.
6. **Self-Lockout & Root Protection:**
   - Attempting to suspend one's own account raises `Cannot suspend own account (administrative self-lockout protection)`.
   - Attempting to suspend the last active Super Admin raises `At least one active Super Admin is required`.
7. **Audit Trail:** Inscribed in both `public.system_audit_logs` (`ACCOUNT_SUSPENDED`) and `public.account_audit_logs` (`account_suspended`).

### 3.2 Account Reactivation Invariants (`admin_reactivate_account_with_security`)
When an account is reactivated:
1. **Profile Status Restored:** `public.profiles.status` transitions to `'active'`.
2. **Auth Ban Removed:** `auth.users.banned_until` is cleared to `NULL`.
3. **Team Member Reactivated:** `public.team_members.is_active` is restored to `true`.
4. **Non-Restoration of Revoked Sessions (Security Invariant):** Previously revoked sessions **remain revoked**. The user is strictly required to perform a fresh authentication handshake.
5. **Audit Trail:** Inscribed in both `public.system_audit_logs` and `public.account_audit_logs`.

### 3.3 Account Deletion Invariants (`admin_delete_account`)
Account deletion is treated as a highest-risk administrative operation:
1. **Dependency Analysis First:** Before performing deletion, `admin_analyze_account_dependencies(_user_id)` inspects:
   - `tasks` assigned or created by the user
   - `client_projects` led by the user
   - `salary_records`, `salary_requests`, and `salary_payments`
   - `sales_deals` where the user is sales owner or commission recipient
2. **Branch A: Historical Dependencies Exist (Preservation Mode):**
   - Historical task, project, and financial ledger integrity **must not be corrupted or broken**.
   - `team_members.profile_id` is unlinked (`SET NULL`) and `is_active = false`.
   - `public.profiles.status` transitions to `'deleted'` and `display_name` is scrubbed to `'[Deleted Account]'`.
   - User role is deleted from `public.user_roles`.
   - Credentials and identities are deleted from `auth.identities` and `auth.users`.
   - Historical salary ledgers and task records remain intact with non-null foreign keys.
3. **Branch B: No Historical Dependencies (Clean Purge Mode):**
   - Safe complete deletion across `team_members`, `user_roles`, `profiles`, `auth.identities`, and `auth.users`.
4. **Last Super Admin Safeguard:** If target is `super_admin`, checks `count_active_super_admins() > 1`.
5. **Audit Trail:** Inscribed in `public.account_audit_logs` with complete metadata detailing dependency preservation.

---

## 4. Database-Enforced Immutability Guarantees

In accordance with strict compliance and non-repudiation requirements, audit history and session records cannot be erased or modified through standard SQL commands or API operations:

### 4.1 `public.user_sessions`
- **Trigger:** `trg_prevent_delete_user_sessions`
- **Definition:**
  ```sql
  CREATE OR REPLACE FUNCTION public.prevent_delete_user_sessions()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
  BEGIN
      RAISE EXCEPTION 'Historical session records are immutable and cannot be deleted.';
  END;
  $$;
  ```
- **Effect:** Any `DELETE FROM public.user_sessions` is rejected at the database engine level.

### 4.2 `public.system_audit_logs`
- **Trigger 1:** `trg_prevent_delete_system_audit` (`BEFORE DELETE`) $\rightarrow$ Raises `'Audit records are immutable and cannot be deleted.'`
- **Trigger 2:** `trg_prevent_update_system_audit` (`BEFORE UPDATE`) $\rightarrow$ Raises `'Audit records are immutable and cannot be modified.'`
- **RLS Policy:** `CREATE POLICY "Disallow DELETE on system_audit_logs" ON public.system_audit_logs FOR DELETE USING (false);`

### 4.3 `public.account_audit_logs`
- **Trigger 1:** `trg_prevent_delete_account_audit` (`BEFORE DELETE`) $\rightarrow$ Raises `'Account audit logs are immutable and cannot be deleted.'`
- **Trigger 2:** `trg_prevent_update_account_audit` (`BEFORE UPDATE`) $\rightarrow$ Raises `'Account audit logs are immutable and cannot be modified.'`
- **RLS Policy:** `CREATE POLICY "Disallow DELETE on account_audit_logs" ON public.account_audit_logs FOR DELETE USING (false);`
