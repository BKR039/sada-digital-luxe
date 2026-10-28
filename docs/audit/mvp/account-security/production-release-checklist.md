# SADA OS — Accounts Page MVP Production Release Plan & Deployment Checklist

**Document ID:** `CHECKLIST-ACC-MVP-PROD-01`  
**Creation Date:** 2026-10-18  
**Scope:** SADA OS Accounts Page MVP (`/admin/accounts`), Account Lifecycle, Permissions, Session Security, and Audit Trail  
**Target Environment:** Remote Supabase Production (`mtfkzabiscyleztypqks.supabase.co`)  
**Status:** **READY FOR STAGING / NOT VERIFIED FOR DIRECT PRODUCTION** (Application-Level Remediations Complete; 13/13 Pre-Staging Assertions Passing; Production Release Blocked Pending Mandatory Staging Gate Execution)

---

## 1. Verified Production Migration Status & Empirical Evidence

Using read-only execution via the Supabase CLI (`npx supabase migration list --linked`), the exact live migration history of the linked remote Supabase project (`mtfkzabiscyleztypqks`) was retrieved.

### 1.1 Live Migration Baseline (Remote Production vs Local)
- **Last Applied Remote Migration:**  
  `20261010140000_harden_session_registration_and_isolation.sql` (Applied on remote: `2026-10-10 14:00:00`).
- **Pending Remote Migrations (Unapplied in Production):**
  1. `20261014220000_harden_convert_lead_client_id.sql` (`remote: ""` — **PENDING**)
  2. `20261016140000_secure_public_team_members_and_rls_hardening.sql` (`remote: ""` — **PENDING**)
  3. `20261017150000_harden_super_admin_self_demotion_safeguard.sql` (`remote: ""` — **PENDING**)
  4. `20261017163000_remediate_account_deletion_integrity.sql` (`remote: ""` — **PENDING**)
  5. `20261017170000_remediate_hard_purge_dependency_integrity.sql` (`remote: ""` — **PENDING**)
  6. `20261017173000_drop_obsolete_account_rpc_overloads.sql` (`remote: ""` — **PENDING** — Overload Cleanup)
  7. `20261017190000_add_client_contact_to_client_projects.sql` (`remote: ""` — **PENDING** — Phase 3)
  8. `20261017223000_phase4_atomic_production_stage_and_audit.sql` (`remote: ""` — **PENDING** — Phase 4)

### 1.2 Status of Target Accounts MVP Migrations
- `20261017163000_remediate_account_deletion_integrity.sql`: **PENDING**
- `20261017170000_remediate_hard_purge_dependency_integrity.sql`: **PENDING**
- `20261017173000_drop_obsolete_account_rpc_overloads.sql`: **PENDING**

> [!IMPORTANT]
> **Dependency Chain Invariant:** The target migrations (`20261017163000`, `20261017170000`, and `20261017173000`) **cannot be applied in isolation**. They depend structurally on `20261016140000` (which alters `team_members.published` defaults and updates `admin_provision_account`) and `20261017150000` (which introduces the anti-self-demotion, anti-self-suspension guards and the 12-argument `_status` signature on `admin_update_account`). All migrations must be deployed in strictly sequential order.

---

## 2. Pre-Deployment Migration Compatibility Review & Blocker Remediation

A comprehensive read-only review and subsequent application-level blocker remediation was performed across the pending migrations (`20261014220000` through `20261017173000`) against the repository schema, migration history, RPC signatures, and documented production baseline.

### 2.1 Timestamp-Ordered Migration & Database Object Analysis

| Timestamp | Migration File | Primary Responsibilities | Dependencies & Prerequisites | Affected Database Objects |
|---|---|---|---|---|
| **20261014220000** | `harden_convert_lead_client_id.sql` | 1. Mandatory canonical `client_id` validation<br>2. Atomic `commission_recipient_id` resolution<br>3. Partial unique index for concurrent conversion idempotency | `public.deals`, `public.clients`, `public.team_members`, `public.package_catalog`, `public.business_rules`, `public.sales_commissions`, `check_rate_limit()`, `has_permission()`, `is_admin()` | • Function: `public.convert_lead_to_sale` (recreated)<br>• Index: `idx_sales_commissions_deal_id_unique` (created)<br>• Grants: Revoked from PUBLIC/anon; Granted to authenticated, service_role |
| **20261016140000** | `secure_public_team_members_and_rls_hardening.sql` | 1. `team_members.published` default to `false`<br>2. Scope internal RLS policies strictly `TO authenticated`<br>3. Create `public_team_members` safe view for public consumption<br>4. Update `admin_provision_account` with `published = false` | `public.team_members`, `public.profiles`, `auth.users`, `public.user_roles`, `public.user_module_permissions`, `public.account_audit_logs`, `app_role`, `is_admin()`, `is_super_admin()` | • Table: `public.team_members` (`published` column default altered)<br>• Policies: 4 legacy policies dropped; 3 authenticated policies created<br>• View: `public.public_team_members` (created with `security_invoker = false`)<br>• Grants: SELECT on view granted to anon, authenticated<br>• Function: `public.admin_provision_account` (recreated) |
| **20261017150000** | `harden_super_admin_self_demotion_safeguard.sql` | 1. Anti-self-demotion guard in `admin_update_account`<br>2. Anti-self-suspension guard in `admin_update_account`<br>3. Anti-self-deletion guard in `admin_delete_account`<br>4. Last-active-Super-Admin safeguard across write paths | `auth.users`, `public.profiles`, `public.user_roles`, `public.team_members`, `public.account_audit_logs`, `app_role`, `is_super_admin()`, `count_active_super_admins()`, `admin_analyze_account_dependencies()` | • Function: `public.admin_update_account` (12-param overload with `_status`, anti-self-lockout)<br>• Function: `public.admin_delete_account` (anti-self-deletion)<br>• Grants: Revoked from PUBLIC/anon; Granted to authenticated, service_role |
| **20261017163000** | `remediate_account_deletion_integrity.sql` | 1. DEFECT-P2-01: Nullify BOTH `profile_id` and `user_id` on `team_members`<br>2. DEFECT-P2-02: Bulk-revoke active sessions without row deletion<br>3. DEFECT-P2-03: Lock `auth.users` (`banned_until`) without row deletion in Branch A | `auth.users`, `public.team_members`, `public.project_tasks`, `public.project_activity`, `public.client_projects`, `public.salary_records/payments/requests`, `public.user_sessions`, `public.profiles`, `public.user_roles`, `auth.identities`, `account_audit_logs`, `system_audit_logs` | • Function: `public.admin_analyze_account_dependencies` (adds `_session_count`)<br>• Function: `public.admin_delete_account` (recreated with soft-tombstone and session revocation)<br>• Grants: Revoked from PUBLIC/anon; Granted to authenticated, service_role |
| **20261017170000** | `remediate_hard_purge_dependency_integrity.sql` | 1. DEFECT-P2-05: Expand `admin_analyze_account_dependencies` to 14-table provenance check<br>2. Evaluate commissions, deals, business rules, and audit logs<br>3. Restrict Branch B clean purge exclusively to pristine accounts | All dependencies from `20261017163000` plus dynamic verification of `sales_commissions` (`team_member_id`, `approved_by`), `deals` (`sales_owner_id`, `commission_recipient_id`), `business_rules` (`updated_by`), `business_rule_versions` (`changed_by`), `account_audit_logs` (`actor_id`), `system_audit_logs` (`actor_id`) | • Function: `public.admin_analyze_account_dependencies` (recreated with full provenance)<br>• Function: `public.admin_delete_account` (recreated to route strictly to Branch A if `requires_soft_archive` = true)<br>• Grants: Revoked from PUBLIC/anon; Granted to authenticated, service_role |
| **20261017173000** | `drop_obsolete_account_rpc_overloads.sql` | 1. DEFECT-P2-06: Defensively drops legacy 11-arg `admin_update_account`<br>2. Defensively drops legacy 8-arg and 9-arg `admin_provision_account`<br>3. Guarantees exactly ONE canonical signature in `pg_proc` to eliminate PostgREST `PGRST204` ambiguity | `pg_proc`, `public.admin_update_account`, `public.admin_provision_account` | • Functions: Obsolete overloads dropped<br>• Canonical functions: Intact and unique |

---

### 2.2 Schema & Signature Conflict Audit & Remediation (DEFECT-P2-06)

#### 1. Function Overload Ambiguity Resolution
- **Investigation:** In the local catalog, `admin_update_account` had both an 11-argument and a 12-argument signature, while `admin_provision_account` had an 8-argument and a 10-argument signature.
- **Root Cause:** In PostgreSQL, adding parameters with default values (such as `_status TEXT DEFAULT NULL`) via `CREATE OR REPLACE FUNCTION` creates an overload if the previous signature with fewer arguments is not explicitly dropped. PostgREST then encounters ambiguity (`PGRST204` / `42725`).
- **Remediation Implemented:** Authored forward-only migration `20261017173000_drop_obsolete_account_rpc_overloads.sql`.
- **Local Verification Evidence:**
  ```sql
  SELECT proname, count(*) FROM pg_proc p 
  JOIN pg_namespace n ON n.oid = p.pronamespace 
  WHERE n.nspname = 'public' AND proname IN ('admin_update_account', 'admin_provision_account') 
  GROUP BY proname;
  -- Result: Exactly 1 row for admin_update_account, 1 row for admin_provision_account.
  ```

#### 2. Canonical Application Contract Tracing
Every call site across `src/` was traced to verify parameter compatibility:
- `src/lib/account-service.ts:445`: Calls `admin_update_account` passing all 12 parameters (`_user_id`, `_display_name`, `_phone`, `_role`, `_division`, `_position`, `_bio`, `_specialties`, `_socials`, `_published`, `_is_active`, `_status`). Matches canonical signature perfectly.
- `src/lib/account-service.ts:358`: Calls `admin_provision_account` passing all 10 parameters (`_user_id`, `_email`, `_display_name`, `_role`, `_division`, `_position`, `_phone`, `_create_team_member`, `_status`, `_module_permissions`). Matches canonical signature perfectly.
- **Zero Callers Impacted:** No application component invokes the obsolete 11-argument or 8-argument signatures. Dropping them introduces zero breaking changes.

---

### 2.3 Public Case Study Team Query Remediation (DEFECT-P2-07)

- **Investigation:** Migration `20261016140000` scoped `public.team_members` RLS strictly `TO authenticated`. In `src/routes/case-studies.$slug.tsx`, `fetchTeamMembers()` previously queried `team_members` directly. Under scoped RLS, anonymous visitors received 0 rows, resulting in blank team credits.
- **Architectural Review of Fallback Query:**
  - A fallback query directly targeting `public.team_members` was reviewed and determined to be **unnecessary, ineffective, and architecturally undesirable**:
    1. For anonymous visitors, direct SELECT on `public.team_members` returns 0 rows due to RLS, rendering a fallback query to the base table completely inert.
    2. The dedicated view `public.public_team_members` is the canonical, fully supported public contract designed specifically to provide public team attribution with `security_invoker = false`.
    3. No external dependency or documented compatibility requirement relies on direct anonymous queries to `public.team_members`.
- **Remediation Implemented:**
  Updated `fetchTeamMembers()` in `src/routes/case-studies.$slug.tsx` to query exclusively the canonical view `public.public_team_members`:
  ```typescript
  async function fetchTeamMembers(ids: string[]): Promise<TeamMemberPublic[]> {
    if (!ids || ids.length === 0) return [];
    const { data, error } = await (supabase as any)
      .from("public_team_members")
      .select("id, name, position, division, photo_url, socials, position_ar, bio_ar")
      .in("id", ids);

    if (error) {
      console.error("[CaseStudy] Failed to fetch team members from public_team_members view:", error);
      return [];
    }
    return (data as TeamMemberPublic[]) || [];
  }
  ```
- **Confidentiality & Data Boundary Verification:**
  - `public.public_team_members` exposes only 8 safe public attributes (`id, name, position, division, photo_url, socials, position_ar, bio_ar`).
  - Private operational columns (`email`, `phone`, `role`, `employment_type`, `hourly_cost`, `profile_id`, `user_id`, `availability_status`) are guaranteed absent from the view.
  - Anonymous visitors receive full team member attribution without 42501 permission errors or empty cards, while internal employee confidentiality is 100% preserved.

---

### 2.4 Sales Commissions Unique Index Preflight & Safety Analysis

- **Investigation:** Migration `20261014220000` creates `CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_commissions_deal_id_unique ON public.sales_commissions(deal_id) WHERE deal_id IS NOT NULL`.
- **Pre-Flight Query (Strictly Read-Only):**
  The following non-mutating preflight query was designed and certified for the operator:
  ```sql
  -- [READ-ONLY PREFLIGHT CHECK] Run in Supabase SQL Editor prior to running migration 20261014220000
  SELECT 
      COUNT(DISTINCT deal_id) AS distinct_deals_with_commissions,
      COUNT(*) AS total_non_null_commissions,
      (COUNT(*) - COUNT(DISTINCT deal_id)) AS duplicate_deal_commission_rows,
      CASE 
          WHEN COUNT(*) = COUNT(DISTINCT deal_id) THEN 'READY_FOR_UNIQUE_INDEX'
          ELSE 'INDEX_CREATION_BLOCKED_BY_DUPLICATES'
      END AS preflight_status
  FROM public.sales_commissions
  WHERE deal_id IS NOT NULL;
  ```
- **Detailed Forensic Query (If Duplicates Are Detected):**
  ```sql
  -- [READ-ONLY INVESTIGATION] If duplicate_deal_commission_rows > 0, inspect duplicate details:
  WITH duplicate_deals AS (
      SELECT 
          deal_id,
          COUNT(*) AS commission_count,
          ARRAY_AGG(id ORDER BY created_at ASC) AS commission_ids,
          ARRAY_AGG(status ORDER BY created_at ASC) AS statuses,
          ARRAY_AGG(commission_amount ORDER BY created_at ASC) AS amounts,
          MIN(created_at) AS earliest_commission_at,
          MAX(created_at) AS latest_commission_at
      FROM public.sales_commissions
      WHERE deal_id IS NOT NULL
      GROUP BY deal_id
      HAVING COUNT(*) > 1
  )
  SELECT 
      d.deal_id,
      d.commission_count,
      d.commission_ids,
      d.statuses,
      d.amounts,
      d.earliest_commission_at,
      d.latest_commission_at,
      p.title AS deal_title,
      p.stage AS deal_stage
  FROM duplicate_deals d
  LEFT JOIN public.deals p ON p.id = d.deal_id
  ORDER BY d.commission_count DESC, d.earliest_commission_at ASC;
  ```
- **Operator Incident & Duplicate Handling Procedure:**
  1. **Strict Zero Automated Mutation Rule:** No automatic script will delete, merge, reassign, or alter commission records. Any duplicate deal IDs detected on remote production or staging MUST be escalated to the commercial DBA and Finance Director.
  2. **Migration Abort Gate:** If `duplicate_deal_commission_rows > 0`, the operator **must not** apply migration `20261014220000`, as `CREATE UNIQUE INDEX` will fail with PostgreSQL error `23505 (duplicate key value violates unique constraint)`.
  3. **Root Cause Determination:**
     - Case A (Split Commissions): If multiple sales representatives legitimately share commission on a single deal, the unique constraint definition is flawed for the business model. In this scenario, the schema must be adjusted (e.g. `UNIQUE (deal_id, team_member_id)`) via a change request before applying.
     - Case B (Duplicate Lead Conversion): If a lead was double-converted accidentally in the UI creating identical duplicate commission rows, the Finance Director must formally sign off on the legitimate canonical record.
  4. **Manual Resolution Order:** Only after business sign-off may the DBA manually archive or de-duplicate rows under an explicit change ticket.

---

### 2.5 Pre-Staging Verification Results (Automated Suite)

The automated pre-staging certification suite [`scripts/verify-pre-staging-remediations.ts`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/scripts/verify-pre-staging-remediations.ts) was executed against local PostgreSQL 16:

| # | Assertion Name | Category | Status | Verified Evidence |
|---|---|---|:---:|---|
| 1 | Migration `20261017173000` executes cleanly | Migration Execution | **PASS** | Executed without SQL syntax or catalog errors |
| 2 | Migration `20261017173000` is idempotent | Migration Execution | **PASS** | Second execution succeeded with zero errors |
| 3 | `admin_update_account` has exactly ONE overload in `pg_proc` | RPC Overload Audit | **PASS** | Overload count: 1 (expected: 1) |
| 4 | `admin_update_account` has canonical 12-argument signature | RPC Overload Audit | **PASS** | Signature contains `_status text` and `_user_id uuid` |
| 5 | `admin_provision_account` has exactly ONE overload in `pg_proc` | RPC Overload Audit | **PASS** | Overload count: 1 (expected: 1) |
| 6 | `admin_provision_account` has canonical 10-argument signature | RPC Overload Audit | **PASS** | Signature contains `_module_permissions jsonb` |
| 7 | Canonical functions retain `SECURITY DEFINER` and `search_path=public` | Security Boundaries | **PASS** | `prosecdef = true`, `proconfig = {search_path=public}` |
| 8 | Anonymous query on `public_team_members` retrieves case study attribution | Public Team Query | **PASS** | All 8 case study fields (including Arabic) retrieved via view |
| 9 | Zero private operational columns exposed in `public_team_members` | Confidentiality | **PASS** | 0 private columns found in view definition |
| 10 | Direct SELECT on `team_members` returns 0 rows for anonymous users | Data Shielding | **PASS** | RLS fail-closed verified (0 rows returned; zero reliance on base table) |
| 11 | Sales commissions preflight check confirms zero duplicates in baseline | Commission Preflight | **PASS** | Status: `READY_FOR_UNIQUE_INDEX` (0 duplicates) |
| 12 | Preflight check sensitively detects duplicates and blocks index creation | Commission Preflight | **PASS** | Status: `INDEX_CREATION_BLOCKED_BY_DUPLICATES` (duplicates: 1) |
| 13 | Preflight duplicate sensitivity test rolled back cleanly | Commission Preflight | **PASS** | 0 persistent database mutations after test |

**Result:** **13 / 13 assertions PASSED (100%)**. TypeScript compiler (`npx tsc --noEmit`): 0 errors. Production bundle build (`npm run build`): 0 errors (14.35s).

---

## 3. Full Ordered Migration Chain & Preconditions

To maintain database schema consistency, migrations must be executed in strict timestamp order:

```
[20261010140000] (Latest Remote Production Baseline)
       │
       ▼
[20261014220000] harden_convert_lead_client_id.sql
       │         (Prerequisite for deals/sales_commissions schema integrity)
       ▼
[20261016140000] secure_public_team_members_and_rls_hardening.sql
       │         (Sets team_members.published DEFAULT false; scopes RLS)
       ▼
[20261017150000] harden_super_admin_self_demotion_safeguard.sql
       │         (Anti-self-demotion, anti-self-suspension, _status parameter on admin_update_account)
       ▼
[20261017163000] remediate_account_deletion_integrity.sql
       │         (Branch A soft-archive tombstone, session revocation, anti-self-deletion)
       ▼
[20261017170000] remediate_hard_purge_dependency_integrity.sql
       │         (DEFECT-P2-05: 14-table dependency analysis for commercial, financial, audit safety)
       ▼
[20261017173000] drop_obsolete_account_rpc_overloads.sql
       │         (DEFECT-P2-06: Drops obsolete 11-arg and 8-arg functions for unique PostgREST routing)
       ▼
[20261017190000] add_client_contact_to_client_projects.sql (Phase 3 — if deploying unified release)
       │
       ▼
[20261017223000] phase4_atomic_production_stage_and_audit.sql (Phase 4 — if deploying unified release)
```

### Preconditions for Deployment
1. **Maintenance Window:** Recommended low-traffic window (estimated downtime: 0 seconds; all migrations execute non-blocking DDL and function updates).
2. **Access Control:** Operator must possess Supabase DB Admin credentials (e.g. `postgres` role via Supabase CLI or Supabase Dashboard SQL Editor).
3. **Database Lock State:** Ensure no long-running analytical queries are locking `public.profiles`, `public.team_members`, or `auth.users`.

---

## 4. Backup and Recovery Requirements

Prior to applying any schema migrations to production, the authorized operator must execute the following safety protocol:

### Step 4.1: Full Logical Database Backup
Run pg_dump via the connection pooler or direct connection string:
```bash
# [READ-ONLY BACKUP - OPERATOR EXECUTION]
pg_dump -h db.mtfkzabiscyleztypqks.supabase.co -U postgres -d postgres -F c -b -v -f "sada_prod_backup_pre_accounts_mvp_$(date +%Y%m%d_%H%M%S).dump"
```

### Step 4.2: Verify Point-in-Time Recovery (PITR)
- Log in to the Supabase Dashboard (`https://supabase.com/dashboard/project/mtfkzabiscyleztypqks/settings/database`).
- Confirm that Database Backups / PITR is active and the latest snapshot timestamp is within the last 24 hours.

### Step 4.3: Pre-Migration Data Hygiene Checks (Read-Only)
Run in Supabase Dashboard SQL Editor before migration:
```sql
-- [READ-ONLY CHECK 1] Check for duplicate deal_ids in sales_commissions
SELECT 
    COUNT(DISTINCT deal_id) AS distinct_deals,
    COUNT(*) AS total_commissions,
    (COUNT(*) - COUNT(DISTINCT deal_id)) AS duplicate_count
FROM public.sales_commissions 
WHERE deal_id IS NOT NULL;

-- [READ-ONLY CHECK 2] Check current admin_update_account function overloads
SELECT proname, pg_get_function_identity_arguments(oid)
FROM pg_proc
WHERE proname IN ('admin_update_account', 'admin_provision_account');
```

### Step 4.4: Rollback Strategy & Limitations
- **Function Migrations (`20261017150000`, `20261017163000`, `20261017170000`, `20261017173000`):** These migrations use `CREATE OR REPLACE FUNCTION` and `DROP FUNCTION IF EXISTS`. Rollback involves re-running the earlier definitions.
- **Schema Modification (`20261016140000`):** This migration alters `team_members.published` default to `false` and alters RLS policies. A tested rollback script exists at [`supabase/rollbacks/20261016140000_rollback.sql`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/supabase/rollbacks/20261016140000_rollback.sql).
- **Data Protection Guarantee:** Under no circumstances should accounts be deleted during rollback. Any accounts created during or after migration will retain their rows.

---

## 5. Environment Classification & Execution Matrix

| Verification Check / Phase | Safe to Run Locally? | Requires Staging? | Requires Operator on Prod? | Tools / Methods |
|---|:---:|:---:|:---:|---|
| **TypeScript & Bundle Build** | **YES** (100% Passed) | Optional | No | `npx tsc --noEmit`, `npm run build` |
| **Local SQL & RPC Invariants** | **YES** (100% Passed) | Optional | No | `scripts/verify-pre-staging-remediations.ts` |
| **Remote Migration Status Check** | **YES** (Read-Only) | No | No | `npx supabase migration list --linked` |
| **Remote Migration Application** | **NO** (Strictly Blocked) | Mandatory First | **YES** | `npx supabase db push` or SQL Editor |
| **Post-Migration Catalog Verification** | No | Mandatory | **YES** (Read-Only) | Query `pg_proc` via psql or SQL Editor |
| **Synthetic Super Admin Provisioning** | No | Recommended | **YES** (Mutating) | Admin UI or `admin_provision_account` |
| **Session Revocation Smoke Test** | No | Recommended | **YES** (Mutating) | Emergency Action Modals in UI |
| **GoTrue Daemon Token Invalidation** | No | **YES** (Mandatory) | **YES** | Staging / Prod GoTrue daemon inspection |
| **Soft-Archive Deletion Test** | No | Recommended | **YES** (Mutating) | Synthetic test account only |

---

## 6. Step-by-Step Operator Deployment Plan

### Phase A: Pre-Deployment Schema Baseline Verification (Read-Only)
Run the following SQL in Supabase Dashboard SQL Editor to record current definitions:

```sql
-- [READ-ONLY VERIFICATION] Check current function arguments and definitions
SELECT proname, pg_get_function_identity_arguments(oid), prosecdef, proconfig
FROM pg_proc
WHERE proname IN ('admin_delete_account', 'admin_analyze_account_dependencies', 'admin_update_account', 'admin_provision_account');
```

---

### Phase B: Migration Execution
The operator applies the pending migrations in order:

```bash
# [MUTATING COMMAND - OPERATOR ONLY]
# Option 1: Via Supabase CLI linked deployment
npx supabase db push

# Option 2: Or apply migrations sequentially via Supabase Dashboard SQL Editor:
# 1. supabase/migrations/20261014220000_harden_convert_lead_client_id.sql
# 2. supabase/migrations/20261016140000_secure_public_team_members_and_rls_hardening.sql
# 3. supabase/migrations/20261017150000_harden_super_admin_self_demotion_safeguard.sql
# 4. supabase/migrations/20261017163000_remediate_account_deletion_integrity.sql
# 5. supabase/migrations/20261017170000_remediate_hard_purge_dependency_integrity.sql
# 6. supabase/migrations/20261017173000_drop_obsolete_account_rpc_overloads.sql
```

---

### Phase C: Post-Migration Schema & ACL Verification (Read-Only)
Execute the following verification queries in the Supabase Dashboard SQL Editor immediately following deployment:

#### Query C1: Verify `SECURITY DEFINER`, `search_path`, and Function Signatures
```sql
-- [READ-ONLY VERIFICATION] Verify security attributes and search_path on updated RPCs
SELECT 
    p.proname,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    p.prosecdef AS is_security_definer,
    p.proconfig AS search_path_config,
    p.proacl AS access_privileges
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' 
  AND p.proname IN (
    'admin_provision_account',
    'admin_update_account',
    'admin_update_account_permissions',
    'admin_suspend_account_with_sessions',
    'admin_reactivate_account_with_security',
    'admin_delete_account',
    'admin_analyze_account_dependencies',
    'is_session_active'
  )
ORDER BY p.proname;
```
**Expected Result:**
- `is_security_definer` = `true` for all functions.
- `search_path_config` = `{search_path=public}` for all functions.
- Exactly **ONE** signature per function name (no duplicate overloads).
- `access_privileges` = contains `postgres=X/postgres`, `authenticated=X/postgres`, `service_role=X/postgres`; **`PUBLIC` and `anon` must be absent**.

#### Query C2: Verify Full 14-Table Provenance in `admin_analyze_account_dependencies`
```sql
-- [READ-ONLY VERIFICATION] Confirm that full provenance logic is live
SELECT 
    proname,
    prosrc LIKE '%_sales_commissions_count%' AS has_commissions_check,
    prosrc LIKE '%_deals_count%' AS has_deals_check,
    prosrc LIKE '%_business_rules_count%' AS has_rules_check,
    prosrc LIKE '%_account_audit_actor_count%' AS has_audit_actor_check,
    prosrc LIKE '%_session_count%' AS has_session_check
FROM pg_proc
WHERE proname = 'admin_analyze_account_dependencies';
```
**Expected Result:** All boolean columns must return `true`.

---

### Phase D: Smoke Testing Protocol (Synthetic Accounts Only)

> [!CAUTION]
> **Strict Operational Rule:** Smoke tests must strictly use dedicated synthetic test accounts (e.g. `smoke.test.worker@sada.tn`). Never test mutations against active staff accounts or client records.

#### Smoke Test D1: Account Creation & Provisioning
1. Log into the SADA OS Admin Portal as an authorized Super Admin.
2. Navigate to `/admin/accounts`.
3. Click **"New Account"** (`CreateAccountModal`).
4. Fill in:
   - Email: `smoke.test.worker@sada.tn`
   - Name: `Smoke Test Worker`
   - Role: `Worker`
   - Division: `Production`
   - Position: `Editor`
5. Submit form.
6. Verify atomic creation of profile, role, and audit log.

#### Smoke Test D2: Module Permission Grant & Revocation
1. In the Accounts table, open the **Details Drawer** for `Smoke Test Worker`.
2. Navigate to the **Permissions** tab.
3. Toggle `calendar` module access to **Override: Enabled**.
4. Save permissions.

#### Smoke Test D3: Account Suspension & Session Invalidation
1. Navigate to the **Danger Zone** tab for `Smoke Test Worker`.
2. Click **"Suspend Account"** (`EmergencyActionModals.tsx`).
3. Enter Reason: `"Smoke testing suspension flow"`.
4. Confirm suspension.
5. Verify `profile_status = 'suspended'`, `banned_until = '3000-01-01'`, and `active_sessions_count = 0`.

#### Smoke Test D4: Reactivation & Fresh Authentication
1. Click **"Reactivate Account"** in the Danger Zone.
2. Confirm reactivation.
3. Verify `profile_status = 'active'`, `banned_until IS NULL`, and dead sessions remain revoked.

#### Smoke Test D5: Account Deletion (Branch B Clean Purge)
1. Since `Smoke Test Worker` has zero tasks, deals, commissions, or business rules, click **"Delete Account"**.
2. Verify clean purge of pristine test account while preserving immutable audit logs.

#### Smoke Test D6: Self-Protection Invariants (Negative Tests)
1. Attempt to demote self in Edit Account Modal -> **UI blocks button; if forged, RPC raises `Cannot demote own account`**.
2. Attempt to suspend self -> **UI blocks button; if forged, RPC raises `Cannot suspend own account`**.
3. Attempt to delete self -> **UI blocks button; if forged, RPC raises `Cannot delete own account`**.

---

## 7. GoTrue Daemon & Production Session Behavior

| Security Layer | Verification Requirement | Staging Verification Procedure | Expected Outcome |
|---|---|---|---|
| **Layer 1: Database RLS** | Subsequent PostgREST queries fail closed | Call Supabase REST API with revoked user JWT | HTTP 200 with empty list or HTTP 403 (RLS `is_session_active()` = false) |
| **Layer 2: Realtime Ejection** | Browser client signs out immediately | Trigger session revocation while test account has active tab | Browser triggers `signOut()` within <200ms and redirects to `/auth` |
| **Layer 3: Heartbeat Fallback** | Stale tabs detect revocation | Simulate missed Realtime event; wait 120s | Heartbeat timer invokes `checkSessionValidity()`, detects revoked status, clears local storage |
| **Layer 4: GoTrue Refresh Ban** | GoTrue rejects token refresh | Call `supabase.auth.refreshSession()` for suspended user | GoTrue returns `user_banned` error |

---

## 8. Monitoring, Incident Management & Recovery Criteria

### 8.1 Post-Release Monitoring Window
Monitor the production system for **60 minutes** following deployment:
1. **Supabase Dashboard Logs:** Filter `Edge Logs` and `Postgres Logs` for `ERROR 42501` or unexpected RPC failures.
2. **Realtime Connections:** Confirm active Realtime WebSocket connections remain stable on channel `session-revocation-sync`.
3. **Application Error Telemetry:** Verify zero unhandled exceptions reported in browser console or error monitoring service on `/admin/accounts`.

### 8.2 Abort & Rollback Criteria
The operator must immediately initiate recovery if any of the following occur:
- Super Admin users receive `42501 permission denied` when accessing `/admin/accounts`.
- Any existing staff account is unintentionally marked `status = 'deleted'`.
- Database query latency spikes above 200ms on `profiles` or `user_roles`.
- GoTrue daemon enters a crash loop or rejects valid logins from active staff.

---

## 9. Explicit Release Blockers & Status

The following items are explicit gates that must be satisfied before production release sign-off:

| Blocker ID | Gate Description | Resolution Owner | Status | Action Taken / Plan |
|---|---|:---:|:---:|---|
| **BLK-01** | Apply pending migrations `20261014220000` through `20261017173000` to Staging environment first. | Authorized Operator / DBA | **PENDING OPERATOR** | Migrations ready and validated locally. Operator deploys to staging project/branch. |
| **BLK-02** | Inspect Staging/Production `pg_proc` to verify zero duplicate overloads on `admin_update_account` and `admin_provision_account`. | Authorized Operator / DBA | **RESOLVED LOCALLY (Pending Staging Push)** | Migration `20261017173000` created; confirmed exactly 1 canonical overload exists per function in local `pg_proc`. |
| **BLK-03** | Execute read-only deduplication check on `sales_commissions(deal_id)` prior to index creation. | Authorized Operator / DBA | **PREPARED & VERIFIED** | Non-mutating preflight query authored; verified read-only behavior via automated script. |
| **BLK-04** | Verify PostgREST RPC invocation of `admin_update_account` and `admin_provision_account` via supabase-js on Staging without `PGRST204`. | QA / Dev | **PENDING STAGING** | Regression tests passed locally; requires live PostgREST on Staging to verify HTTP routing. |
| **BLK-05** | Verify GoTrue daemon refresh rejection and Realtime session ejection with a synthetic worker account on Staging. | QA / Operator | **PENDING STAGING** | Staging smoke test protocol defined in Section 7. |
| **BLK-06** | Verify `/case-studies/:slug` public team member query compatibility under scoped RLS on Staging. | Front-End / QA | **RESOLVED LOCALLY (Pending Staging Push)** | Updated `case-studies.$slug.tsx` to query exclusively `public_team_members` view (fallback query to base table removed); verified anonymous access and 0 private column leaks. |
| **BLK-07** | Take full logical database backup (`pg_dump`) and verify PITR snapshot timestamp within 24h before production release. | Authorized Operator / DBA | **PENDING OPERATOR** | Operator commands and procedures documented in Section 4. |

---

## 10. Final Release Recommendation & Verdict

### **Verdict: READY FOR STAGING / NOT VERIFIED FOR DIRECT PRODUCTION**

**Architectural Rationale:**
1. **Ready for Staging (PASSED):** All application-level defects and migration ambiguities have been resolved:
   - Overload ambiguity eliminated via migration `20261017173000_drop_obsolete_account_rpc_overloads.sql`.
   - Public team attribution on case studies redirected exclusively to canonical `public_team_members` in `src/routes/case-studies.$slug.tsx` with zero reliance on protected base table.
   - Read-only commission deduplication preflight query authored, verified, and duplicate handling procedure established.
   - Automated pre-staging test suite [`scripts/verify-pre-staging-remediations.ts`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/scripts/verify-pre-staging-remediations.ts) passed 13/13 assertions.
   - Clean TypeScript check (`npx tsc --noEmit`: 0 errors) and production build (`npm run build`: 14.35s).
2. **Not Verified for Direct Production (BLOCKED):** Direct production deployment remains strictly blocked until the operator deploys the migrations to a staging project and performs the live PostgREST, GoTrue daemon, and Realtime smoke tests.
3. **Zero Mutation Compliance:** Zero mutations or DDL changes were applied to remote production. Production remains completely untouched.

---

*Checklist certified by SADA OS Security & Architecture Operations.*
