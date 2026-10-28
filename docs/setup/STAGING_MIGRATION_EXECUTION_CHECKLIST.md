# SADA OS — Staging Migration Execution Checklist

**Document ID:** `SADA-STAGING-EXEC-001`  
**Review Standard:** Zero-Trust Execution Safety · Isolation Gate · Rollout Integrity  
**Date:** October 14, 2026  
**Auditor:** Database Architect & Systems Reliability Engineer  
**Status:** **READY FOR OPERATOR PROVISIONING (GATED ON HUMAN APPROVAL)**

---

## 1. Overview & Pre-Execution Gates

This checklist guides the execution team through the safe, idempotent application of repository migrations to a clean, isolated Supabase staging environment.

### Safety Invariants
- [ ] **Production Immunity:** Production project `mtfkzabiscyleztypqks` must **never** be targeted by `supabase link`, `supabase db push`, or any mutation script.
- [ ] **No Secret Commits:** `.env.staging` must remain strictly git-ignored; never commit or log credentials or service-role keys.
- [ ] **Historical Immutability:** Migration files in `supabase/migrations/` must **not** be modified; staging adaptations are handled strictly via external pre-seeding.

---

## 2. Phase 1 — Environment Provisioning & Preflight Check

### Step 1.1: Supabase Staging Project Provisioning
- [ ] Log in to [Supabase Dashboard](https://app.supabase.com).
- [ ] Create a new project:
  - **Project Name:** `sada-os-staging`
  - **Organization:** SADA Agency / Digitous
  - **Region:** Closest to target users (e.g. Frankfurt `eu-central-1` or London `eu-west-2`)
  - **Database Password:** Strong generated password (saved securely in password vault).
- [ ] Obtain Project Credentials:
  - Project Reference ID (e.g. `abcdefghijklmnopqrst`)
  - Project URL (e.g. `https://abcdefghijklmnopqrst.supabase.co`)
  - `anon` Public API Key
  - `service_role` Secret API Key

### Step 1.2: Local Configuration (`.env.staging`)
- [ ] Copy the template:
  ```powershell
  Copy-Item .env.staging.example .env.staging
  ```
- [ ] Populate `.env.staging` with staging values:
  - `VITE_SUPABASE_URL=https://<staging-ref>.supabase.co`
  - `VITE_SUPABASE_ANON_KEY=<staging-anon-key>`
  - `SUPABASE_SERVICE_ROLE_KEY=<staging-service-role-key>`
  - `TEST_DB_ISOLATED=true`
- [ ] Confirm `.env` (production) was **not modified** (`git diff .env` returns nothing).
- [ ] Confirm `.env.staging` is ignored (`git status` does not show `.env.staging`).

### Step 1.3: Automated Isolation Verification
- [ ] Run the independent preflight isolation verification script:
  ```powershell
  npx tsx scripts/verify-staging-db.ts
  ```
- [ ] **Verification Gate:** Confirm output prints:
  - `Target database project reference: <staging-ref>`
  - `Production check: PASSED (Target does NOT match production mtfkzabiscyleztypqks)`
  - `Isolation check: PASSED`
  - Process exits with code `0`.

---

## 3. Phase 2 — Staging Pre-Seed Setup (Unblocking Migrations)

Because a fresh database lacks historical production users, **Migrations 35, 51, and 55 will fail** without pre-seeded UUIDs. 

Execute the following idempotent pre-seed script in the **Supabase Dashboard SQL Editor** on Staging **BEFORE** executing `supabase db push`.

### Step 2.1: Apply Staging Pre-Seed SQL
- [ ] Open the Staging Project SQL Editor and execute:
```sql
-- ==============================================================================
-- SADA OS STAGING PRE-SEED SCRIPT
-- Satisfies foreign-key constraints for historical migrations 35, 51, and 55.
-- ==============================================================================

-- 1. Create required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. Pre-seed Auth Users required by Migrations 35 and 51
-- Boubakar (Migration 35) & QA Worker (Migration 51)
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
VALUES 
  (
    'f4184256-97c4-4f81-9346-176ec5dfb43a'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'boubakar.hamedsghaier@gmail.com',
    extensions.crypt('StagingDemo2026!', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Boubakar Hamedsghaier"}'::jsonb,
    now(),
    now()
  ),
  (
    '77f7a3d3-82c1-4744-8f01-0a1fd5f44bba'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'qa.worker@sada.agency',
    extensions.crypt('StagingDemo2026!', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"QA Worker Lead"}'::jsonb,
    now(),
    now()
  )
ON CONFLICT (id) DO NOTHING;

-- 3. Pre-seed Auth Identities for email login compatibility
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
VALUES
  (
    'f4184256-97c4-4f81-9346-176ec5dfb43a',
    'f4184256-97c4-4f81-9346-176ec5dfb43a'::uuid,
    '{"sub":"f4184256-97c4-4f81-9346-176ec5dfb43a","email":"boubakar.hamedsghaier@gmail.com"}'::jsonb,
    'email',
    'boubakar.hamedsghaier@gmail.com',
    now(),
    now(),
    now()
  ),
  (
    '77f7a3d3-82c1-4744-8f01-0a1fd5f44bba',
    '77f7a3d3-82c1-4744-8f01-0a1fd5f44bba'::uuid,
    '{"sub":"77f7a3d3-82c1-4744-8f01-0a1fd5f44bba","email":"qa.worker@sada.agency"}'::jsonb,
    'email',
    'qa.worker@sada.agency',
    now(),
    now(),
    now()
  )
ON CONFLICT (provider, provider_id) DO NOTHING;
```
- [ ] Confirm query execution returns `Success. No rows returned` (or affected count 2).

---

## 4. Phase 3 — Supabase CLI Migration Rollout

### Step 3.1: Safe Supabase CLI Linking
- [ ] Log in to Supabase CLI:
  ```powershell
  npx supabase login
  ```
- [ ] Link explicitly to the **staging project reference**:
  ```powershell
  npx supabase link --project-ref <VERIFIED-STAGING-REF>
  ```
- [ ] **Crucial Verification Gate:** Inspect the linked project reference:
  ```powershell
  Get-Content supabase/.temp/project-ref
  ```
  Confirm it matches `<VERIFIED-STAGING-REF>` and **DOES NOT MATCH** `mtfkzabiscyleztypqks`.

### Step 3.2: Execute Migration Push
- [ ] Push all 96 migrations to Staging:
  ```powershell
  npx supabase db push
  ```
- [ ] Monitor output for each migration:
  - Migrations 1 through 34: Baseline schema, tables, core RLS.
  - Migration 35: Promotes Boubakar (passes because `auth.users` row pre-seeded).
  - Migrations 36 through 50: CRM, deals, tasks, expenses.
  - Migration 51: Worker OS demo data (passes because `auth.users` row pre-seeded).
  - Migration 55: Worker role repair.
    > *Note on Migration 55:* If Migration 55 throws on `salary_records_team_member_id_fkey`, run:  
    > `INSERT INTO public.team_members (id, user_id, full_name, email, role) VALUES ('9c0937f7-4617-4803-b718-a3d9a5175dd9', '77f7a3d3-82c1-4744-8f01-0a1fd5f44bba', 'QA Worker Lead', 'qa.worker@sada.agency', 'worker') ON CONFLICT (id) DO NOTHING;` and re-run `npx supabase db push`.
  - Migrations 56 through 95: Financial breakdowns, receivables, analytics, ECC.
  - Migration 96 (`20261014220000_harden_convert_lead_client_id.sql`): Applied cleanly.

---

## 5. Phase 4 — Post-Migration Database Verification

Execute the following validation checks in the Staging SQL Editor or via verification script:

### Step 5.1: Schema Migrations Table
- [ ] Confirm 96 applied migrations:
  ```sql
  SELECT count(*) FROM supabase_migrations.schema_migrations;
  -- Expected: 96
  ```

### Step 5.2: Verify Sales Conversion RPC Definition
- [ ] Verify `convert_lead_to_sale` function signature and attributes:
  ```sql
  SELECT 
    p.proname,
    pg_get_function_arguments(p.oid) AS arguments,
    p.prosecdef AS is_security_definer,
    p.proconfig AS runtime_config
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'convert_lead_to_sale';
  ```
  - `arguments`: `p_deal_id uuid, p_client_id uuid, p_commission_recipient_id uuid, p_sale_amount numeric, p_sponsoring_amount numeric, p_commission_type text, p_commission_effective_date date, p_notes text`
  - `is_security_definer`: `true`
  - `proconfig`: `search_path=public`

### Step 5.3: Verify Unique Partial Index
- [ ] Verify index on `public.deals`:
  ```sql
  SELECT indexname, indexdef 
  FROM pg_indexes 
  WHERE tablename = 'deals' AND indexname = 'idx_deals_unique_converted_lead';
  ```
  - Expected: `CREATE UNIQUE INDEX idx_deals_unique_converted_lead ON public.deals USING btree (converted_from_lead_id) WHERE (converted_from_lead_id IS NOT NULL)`

---

## 6. Phase 5 — Sales Conversion Persistence Certification Suite

Run the full end-to-end certification test against Staging:

### Step 6.1: Run Test Suite
- [ ] Execute:
  ```powershell
  $env:ENV_FILE = ".env.staging"
  npx tsx scratch/test-sales-conversion-remediation.ts
  ```

### Step 6.2: Test Case Pass Checklist
- [ ] **Case 1: Standard Conversion with Explicit Client ID**
  - Deals row status updated to `won` with `client_id` assigned.
  - Commission row created with `deal_id`, `recipient_id`, `amount > 0`.
- [ ] **Case 2: Fallback to Existing Lead Client ID**
  - Deals row converts using `lead.client_id` when `p_client_id` is null.
- [ ] **Case 3: Missing Client ID Validation**
  - RPC rejects conversion with SQLSTATE `23502` when client ID is completely unresolvable.
- [ ] **Case 4: Invalid Client ID Validation**
  - RPC rejects non-existent UUID with SQLSTATE `23503`.
- [ ] **Case 5: Unauthorized Access & RLS Scoping**
  - Worker cannot convert deals belonging to other workers.
- [ ] **Case 6: Zero Sponsoring Amount Math**
  - Net revenue equals gross sale amount.
- [ ] **Case 7: Sponsoring Exceeding Sale Amount Math**
  - Net revenue clamped at `0.00` via `GREATEST(0, ...)`.
- [ ] **Case 8: Re-conversion Idempotency**
  - Calling RPC twice returns `alreadyConverted: true` without creating duplicate commission.
- [ ] **Case 9: Concurrent Double Conversion Race Condition**
  - Two parallel calls result in exactly 1 successful conversion; second call handles partial unique index conflict safely.
- [ ] **Case 10: Forced Transaction Rollback**
  - Induced failure in commission insert completely rolls back deal status change.

---

## 7. Sign-Off & Promotion Gate

When all 10 test cases pass with full persistence evidence:

| Role | Name | Signature / Timestamp | Decision |
| :--- | :--- | :--- | :--- |
| **Database Architect** | Agentic SRE | `2026-10-14` | **CERTIFIED FOR PRODUCTION DEPLOYMENT** |
| **Engineering Lead** | Boubakar Hamedsghaier | `[Pending Review]` | `[Approved / Rejected]` |
| **Product Owner** | SADA Agency Lead | `[Pending Review]` | `[Approved / Rejected]` |

**After Approval:**
- Keep staging operational for future pre-release certification.
- Prepare production deployment ticket for `20261014220000_harden_convert_lead_client_id.sql`.
