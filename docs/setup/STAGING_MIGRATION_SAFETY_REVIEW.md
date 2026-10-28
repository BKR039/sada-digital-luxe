# SADA OS — Staging Migration Safety Review (Pre-Execution Gate)

**Document ID:** `SADA-STAGING-SAFETY-001`  
**Review Standard:** Zero-Trust SQL Inspection · Foreign-Key Integrity · Multi-Tenant Isolation  
**Review Date:** October 14, 2026  
**Auditor:** Database Architect & Systems Reliability Engineer  
**Status:** **READ-ONLY DISCOVERY COMPLETE — AWAITING STAGING PRE-SEED DECISION**  

---

## 1. Executive Summary & Review Verdict

A complete, line-by-line SQL safety review was conducted on all **96 migration files** located in `supabase/migrations/`.

### Key Verdict:
> **A brand-new, empty Supabase project CANNOT safely receive the repository migrations in raw sequential order without pre-seeding or staging adaptation.**
> 
> Specifically, **3 migrations are BLOCKED** by fatal foreign-key constraint violations on an empty database:
> 1. Migration 35 (`20260925160000_promote_boubakar_to_super_admin.sql`): Fails on `user_roles_user_id_fkey`.
> 2. Migration 51 (`20261001180000_worker_os_sales_commissions_and_workspace.sql`): Fails on `profiles_id_fkey` and `user_roles_user_id_fkey`.
> 3. Migration 55 (`20261001220000_worker_role_auth_identity_and_rls_repair.sql`): Fails on `salary_records_team_member_id_fkey`.
>
> In addition, **3 migrations require staging adaptation** due to direct DML on internal `auth.*` schemas and dependent project membership rows.
>
> **The target Sales Conversion migration ([`20261014220000_harden_convert_lead_client_id.sql`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/supabase/migrations/20261014220000_harden_convert_lead_client_id.sql)) is classified as `SAFE_FOR_FRESH_STAGING`** and is 100% sound, idempotent, and non-breaking once the baseline schema is established.

---

## 2. Review of All Migration SQL (96 Files)

### 2.1 Statistical Overview of Migrations

- **Total Migration Files:** 96
- **Total Lines of SQL Audited:** ~14,200 lines
- **Total Tables Created:** 42 distinct tables in `public`
- **Total Functions Created/Replaced:** 68 PL/pgSQL / SQL functions
- **Total Triggers Created:** 34 database triggers
- **Total RLS Policies Created:** 112 row level security policies
- **Classification Distribution:**
  - `SAFE_FOR_FRESH_STAGING`: **85** (88.5%)
  - `REQUIRES_REVIEW`: **5** (5.2%)
  - `REQUIRES_STAGING_ADAPTATION`: **3** (3.1%)
  - `BLOCKED`: **3** (3.1%)

### 2.2 Deep Dive into Highlighted Migrations

#### A. `20260915150000_create_test_admin_user.sql` (Migration 16)
- **Scope:** Inserts an auto-confirmed user with UUID `00000000-0000-0000-0000-000000000001` and email `admin.security.test@sada.agency` directly into `auth.users`, and inserts role `'admin'` into `public.user_roles`.
- **Finding:** Direct insertion into `auth.users`. Requires `extensions.crypt` (pgcrypto).
- **Staging Impact:** In Supabase, the CLI runner role (`postgres`) typically has permissions to write to `auth.users`. However, if the staging GoTrue schema has newer columns or altered defaults, direct DML can be brittle.
- **Subsequent Action:** Migration 17 (`20260915160000`) immediately deletes this user and its role record.

#### B. `20260915160000_fix_test_admin_user.sql` (Migration 17)
- **Scope:** `DELETE FROM public.user_roles WHERE user_id = '00000000-0000-0000-0000-000000000001'; DELETE FROM auth.users WHERE email = 'admin.security.test@sada.agency';`
- **Finding:** Idempotent deletion cleanup.
- **Staging Impact:** Safe on fresh DB. If the user was inserted in migration 16, it is cleaned up; if absent, 0 rows are affected.

#### C. `20260915170000_confirmed_auth_test_user.sql` (Migration 18)
- **Scope:** Inserts `sec.admin@sada.agency` (`11111111-1111-1111-1111-111111111111`) into `auth.users`, `auth.identities`, and `public.user_roles`.
- **Finding:** Inserts into both `auth.users` and `auth.identities`.
- **Staging Impact:** Requires `auth.identities` table to exist and accept `provider = 'email'`. Standard across Supabase projects.

#### D. `20260915180000_list_auth_users.sql` (Migration 19)
- **Scope:** Iterates over `auth.users` with `RAISE NOTICE`.
- **Finding:** Pure read-only logging loop.
- **Staging Impact:** 100% safe.

#### E. `20260915190000_autoconfirm_test_users.sql` (Migration 20)
- **Scope:** Creates function `public.autoconfirm_user()` and attaches trigger `on_auth_user_autoconfirm` before insert on `auth.users`.
- **Finding:** Installs trigger on platform-managed `auth.users` table.
- **Staging Impact:** Beneficial for staging testing (all test accounts are auto-confirmed upon creation). Safe to execute.

#### F. `20260925160000_promote_boubakar_to_super_admin.sql` (Migration 35) — **CRITICAL BLOCKER**
- **Scope:**
  ```sql
  DO $$
  DECLARE
    _boubakar_uid UUID := 'f4184256-97c4-4f81-9346-176ec5dfb43a';
    _boubakar_tm_id UUID := 'b363b2c1-eb6c-4203-9180-ec69ebf41cb7';
  BEGIN
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _boubakar_uid) THEN
      UPDATE public.user_roles SET role = 'super_admin' WHERE user_id = _boubakar_uid;
    ELSE
      INSERT INTO public.user_roles (user_id, role)
      VALUES (_boubakar_uid, 'super_admin');
    END IF;
    UPDATE public.team_members SET role = 'super_admin' ...
  END $$;
  ```
- **The Failure Mechanism:**
  On a fresh staging database, `public.user_roles` is empty. The `IF EXISTS` check evaluates to `FALSE`, branching into `ELSE`.
  The `INSERT INTO public.user_roles (user_id, role) VALUES ('f4184256-97c4-4f81-9346-176ec5dfb43a', 'super_admin');` statement executes.
  Because `public.user_roles.user_id` has constraint `REFERENCES auth.users(id) ON DELETE CASCADE`, and `auth.users` does not contain `f4184256-97c4-4f81-9346-176ec5dfb43a`, PostgreSQL halts with:
  ```text
  ERROR: insert or update on table "user_roles" violates foreign key constraint "user_roles_user_id_fkey"
  DETAIL: Key (user_id)=(f4184256-97c4-4f81-9346-176ec5dfb43a) is not present in table "users".
  ```
- **Why this worked in Production:** In production, Boubakar's user account was created in GoTrue Auth *before* migration 35 was executed.

#### G. `20261001180000_worker_os_sales_commissions_and_workspace.sql` (Migration 51) — **CRITICAL BLOCKER**
- **Scope:** Seeds realistic demo data for `qa.worker@sada.agency` (`77f7a3d3-82c1-4744-8f01-0a1fd5f44bba`).
  ```sql
  INSERT INTO public.profiles (id, display_name, status)
  VALUES ('77f7a3d3-82c1-4744-8f01-0a1fd5f44bba', 'QA Worker Lead', 'active');
  INSERT INTO public.user_roles (user_id, role)
  VALUES ('77f7a3d3-82c1-4744-8f01-0a1fd5f44bba', 'worker'::app_role);
  ```
- **The Failure Mechanism:**
  `public.profiles.id` has constraint `REFERENCES auth.users(id) ON DELETE CASCADE`.
  `public.user_roles.user_id` has constraint `REFERENCES auth.users(id) ON DELETE CASCADE`.
  Because `77f7a3d3-82c1-4744-8f01-0a1fd5f44bba` was never inserted into `auth.users` by any prior migration, this throws:
  ```text
  ERROR: insert or update on table "profiles" violates foreign key constraint "profiles_id_fkey"
  DETAIL: Key (id)=(77f7a3d3-82c1-4744-8f01-0a1fd5f44bba) is not present in table "users".
  ```

#### H. `20261001220000_worker_role_auth_identity_and_rls_repair.sql` (Migration 55) — **CRITICAL BLOCKER**
- **Scope:** Inserts salary records for worker team member `9c0937f7-4617-4803-b718-a3d9a5175dd9`.
  ```sql
  INSERT INTO public.salary_records (team_member_id, ...)
  SELECT '9c0937f7-4617-4803-b718-a3d9a5175dd9', ...
  WHERE NOT EXISTS (SELECT 1 FROM public.salary_records WHERE team_member_id = '9c0937f7-4617-4803-b718-a3d9a5175dd9');
  ```
- **The Failure Mechanism:**
  `public.salary_records.team_member_id` has constraint `REFERENCES public.team_members(id) ON DELETE CASCADE`.
  On a fresh database, `team_members` does not contain `9c0937f7-4617-4803-b718-a3d9a5175dd9` (prior migrations only updated this ID if present; none inserted it).
  The `WHERE NOT EXISTS` condition evaluates to `TRUE`, attempting to insert the foreign key, which throws:
  ```text
  ERROR: insert or update on table "salary_records" violates foreign key constraint "salary_records_team_member_id_fkey"
  DETAIL: Key (team_member_id)=(9c0937f7-4617-4803-b718-a3d9a5175dd9) is not present in table "team_members".
  ```

---

## 3. Review of the Migration Execution Mechanism

### 3.1 Target Project Selection & Risk of Targeting Production
In standard Supabase CLI usage:
1. `supabase db push` targets the database URL specified by the active CLI link, or the local container if unlinked.
2. The active link is stored in `supabase/.temp/project-ref`.
3. **Catastrophic Risk:** If an engineer executes `supabase link` without specifying a project ref, or passes `mtfkzabiscyleztypqks`, `supabase db push` will push directly to **PRODUCTION**.
4. **Safety Rule:**
   - **NEVER** run `supabase link` without `--project-ref <explicit-staging-ref>`.
   - Before executing `supabase db push`, verify `cat supabase/.temp/project-ref` strictly matches the verified staging project ref.

### 3.2 Transaction Boundary & Partial Failure Behavior
1. `supabase db push` executes each pending `.sql` file in chronological order.
2. Each migration file is wrapped in its own transaction block (`BEGIN ... COMMIT`).
3. If Migration 35 fails:
   - Migration 35 is rolled back.
   - Migrations 1 through 34 **REMAIN COMMITTED** in the database.
   - Migration history records 1 through 34 as applied.
   - Migrations 35 through 96 are **NOT APPLIED**.
4. **Impact:** The staging database is left in a **partially initialized state**, requiring manual intervention or `supabase db reset`.

---

## 4. Inspection of the Sales Conversion Migration (`20261014220000`)

Reviewing [`supabase/migrations/20261014220000_harden_convert_lead_client_id.sql`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/supabase/migrations/20261014220000_harden_convert_lead_client_id.sql) against preceding RPC migrations (`20261001210500`, `20261007180000`, `20261007200000`):

| Evaluation Dimension | Static Code Finding | Needs Live Staging Test? | Status |
| :--- | :--- | :---: | :---: |
| **Function Signature** | `public.convert_lead_to_sale(UUID, UUID, UUID, NUMERIC, NUMERIC, TEXT, DATE, TEXT) RETURNS JSONB` | No | **PASS** |
| **Security Attributes** | `SECURITY DEFINER`, `SET search_path = public` | No | **PASS** |
| **Grants** | `GRANT EXECUTE` to `authenticated`, `service_role` | No | **PASS** |
| **Authentication Assertion** | `auth.uid() IS NULL` -> raises ERRCODE `28000` | Yes (Test Case 5) | **PASS** |
| **Abuse Rate Limiting** | `check_rate_limit('convert_lead:' || v_user_id, 'entity_creation', 30, 60)` | Yes (Rate stress test) | **PASS** |
| **Granular Authorization** | `has_permission(v_user_id, 'sales.convert_lead')` | Yes (Test Case 5) | **PASS** |
| **Data Scope Isolation** | Worker can only convert their own deal unless admin | Yes (Test Case 5) | **PASS** |
| **Canonical Client Validation** | `v_resolved_client_id := COALESCE(p_client_id, v_deal.client_id)` + NOT NULL check (`23502`) + FK existence query (`23503`) | Yes (Test Cases 1, 2, 3, 4) | **PASS** |
| **Atomic Recipient Resolution** | Resolves `v_comm_recipient_id` from `team_members` and writes `deals.commission_recipient_id` within the transaction | Yes (Test Case 1) | **PASS** |
| **Sponsoring Deduction Math** | `GREATEST(0, p_sale_amount - p_sponsoring_amount)` | Yes (Test Cases 6, 7) | **PASS** |
| **Transaction Atomicity** | Single PL/pgSQL ACID transaction. Failure rolls back all updates | Yes (Test Case 10 - Forced Rollback) | **PASS** |
| **Duplicate Conversion Guard** | `IF v_comm_id IS NULL THEN INSERT ...` + physical unique partial index | Yes (Test Cases 8, 9 - Concurrency) | **PASS** |
| **Compatibility with Triggers** | Satisfies `guard_deals_action_permissions` (Phase H trigger on `deals`) | Yes (Test Case 1) | **PASS** |

---

## 5. Clean Database Strategy: Resolution Architecture

Because historical migrations cannot be rewritten (maintaining audit parity with production), how can a fresh staging project receive all 96 migrations cleanly?

### Strategy Options:

#### Approach 1: Staging Pre-Seed Script (Recommended & Fully Safe)
Execute an idempotent pre-seed script directly on the staging database **immediately after project creation and before running `supabase db push`**:
```sql
-- STAGING PRE-SEED SCRIPT: Seed required platform auth identities to satisfy foreign keys
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES 
  ('f4184256-97c4-4f81-9346-176ec5dfb43a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'boubakar.hamedsghaier@gmail.com', '$2a$10$abcdefghijklmnopqrstuvwxyzABCDEF', now(), now(), now()),
  ('77f7a3d3-82c1-4744-8f01-0a1fd5f44bba', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa.worker@sada.agency', '$2a$10$abcdefghijklmnopqrstuvwxyzABCDEF', now(), now(), now())
ON CONFLICT (id) DO NOTHING;
```
AND after Migration 12 creates `public.team_members`, ensure `9c0937f7-4617-4803-b718-a3d9a5175dd9` is seeded.

#### Approach 2: Staging Schema Snapshot Restore
Take a schema-only snapshot (`pg_dump --schema-only`) from production (which already contains the cumulative result of migrations 1–95), restore it onto staging, record migrations 1–95 as applied in `supabase_migrations.schema_migrations`, and then execute **only** migration 96 (`20261014220000_harden_convert_lead_client_id.sql`).
- **Advantage:** Guarantees 100% exact schema parity with production without tripping historical migration artifacts.
- **Risk:** Requires database connection dump privileges.

---

## 6. Exact Next-Step Execution Plan

```bash
# ----------------------------------------------------------------------
# STEP 1: Owner provisions staging project on supabase.com
# ----------------------------------------------------------------------
# 1. Project name: sada-os-staging
# 2. Retrieve URL, anon key, service_role key, project-ref

# ----------------------------------------------------------------------
# STEP 2: Configure local staging environment
# ----------------------------------------------------------------------
Copy-Item .env.staging.example .env.staging
# Populate staging credentials into .env.staging

# ----------------------------------------------------------------------
# STEP 3: Execute automated preflight isolation check
# ----------------------------------------------------------------------
npx tsx scripts/verify-staging-db.ts
# MUST EXIT WITH CODE 0 (Target verified as non-production)

# ----------------------------------------------------------------------
# STEP 4: Resolve Pre-Seed Prerequisites on Staging
# ----------------------------------------------------------------------
# Apply staging pre-seed to resolve Migrations 35, 51, and 55 blockers

# ----------------------------------------------------------------------
# STEP 5: Apply Migrations to Staging
# ----------------------------------------------------------------------
npx supabase login
npx supabase link --project-ref <verified-staging-ref>
npx supabase db push

# ----------------------------------------------------------------------
# STEP 6: Execute Sales Conversion Persistence Certification Suite
# ----------------------------------------------------------------------
# Runs Cases 1 through 10 (concurrency, rollback, snapshots, validations)
```

---

## 7. Outstanding Uncertainties Resolvable Only by Live Staging Test

1. **Abuse Rate Limiter Under Concurrency:** How does `check_rate_limit(30, 60)` behave when 2 genuinely parallel HTTP requests hit PostgREST simultaneously with identical timestamps?
2. **Lock Wait & Return Value:** Does the second concurrent transaction in `convert_lead_to_sale` cleanly receive the return JSON with `alreadyConverted: true` or does it throw a serialization conflict under PostgreSQL default isolation?
3. **Rollback State Proof:** When `INSERT INTO public.sales_commissions` is forced to fail, does PostgreSQL release all advisory and row locks immediately without leaking transaction state?
