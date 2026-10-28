# SADA OS — Supabase Staging Environment Provisioning Guide

## 1. Overview & Objective

The **Sales Lead Conversion Remediation** is currently in status:
```text
CODE VERIFIED — PERSISTENCE BLOCKED
```
All client, service, and SQL migration logic has been verified and tested via non-mutating regression suites. However, because the repository is configured against the **shared production Supabase project (`mtfkzabiscyleztypqks.supabase.co`)** where synthetic conversions, DDL migrations, and concurrency stress tests are strictly prohibited, live database persistence certification is gated.

This guide provides the complete, safe procedure for the project owner to provision an **isolated Supabase staging database**, verify its identity independently, apply migrations safely, and resume persistence certification without risking production data.

---

## 2. Production vs. Staging Architectural Matrix

| Dimension | Canonical Production Environment | Isolated Staging Environment |
| :--- | :--- | :--- |
| **Project Reference** | `mtfkzabiscyleztypqks` | *`<your-isolated-staging-ref>`* (Unique) |
| **Host Domain** | `https://mtfkzabiscyleztypqks.supabase.co` | `https://<your-isolated-staging-ref>.supabase.co` |
| **Config File** | `.env` & `supabase/config.toml` | `.env.staging` (Gitignored) |
| **Data Nature** | 38 live deals, 8 commissions, 10 clients, financial ledger | Purely synthetic test records, ephemeral |
| **Mutation Policy** | **READ-ONLY FOR QA / REGRESSION TESTS** | **MUTATIONS & ROLLBACK TESTS PERMITTED** |
| **Guard Enforcement** | `scripts/test-db-guard.ts` **UNCONDITIONALLY BLOCKS** | Permitted only when host !== production AND `TEST_DB_ISOLATED=true` |
| **Persistence Status** | `PERSISTENCE BLOCKED` | Target for `STAGING VERIFIED` |

---

## 3. Owner Action: Step-by-Step Staging Setup Instructions

Creating a cloud Supabase project requires authenticated organization access. Follow these exact steps:

### Step 1: Create a Dedicated Staging Project on Supabase
1. Navigate to the [Supabase Dashboard](https://supabase.com/dashboard).
2. Click **New project** within your organization.
3. Configure project details:
   - **Name:** `sada-os-staging` (or `sada-digital-luxe-staging`).
   - **Database Password:** Generate a secure password and store it in your password manager.
   - **Region:** Select the same region as production (e.g. `eu-central-1` / Frankfurt).
   - **Pricing Plan:** **Free Tier** is 100% sufficient for staging and persistence certification.
4. Click **Create new project** and allow ~2 minutes for PostgreSQL provisioning.

### Step 2: Retrieve Staging API Credentials
1. In the Supabase Dashboard for your new staging project, go to **Project Settings** (gear icon) -> **API**.
2. Locate and copy:
   - **Project URL:** `https://<your-staging-ref>.supabase.co`
   - **Project Reference ID:** `<your-staging-ref>` (the 20-character identifier in the URL)
   - **`anon` `public` key:** The public JWT token for client access.
   - **`service_role` `secret` key:** The elevated key for administrative migrations and test fixture cleanup (treat this as strictly confidential).

### Step 3: Configure Local `.env.staging`
1. Copy the safe template:
   ```bash
   # On Windows PowerShell:
   Copy-Item .env.staging.example .env.staging

   # On Linux/macOS/Bash:
   cp .env.staging.example .env.staging
   ```
2. Open `.env.staging` in your editor and replace the placeholder values with your staging credentials:
   ```bash
   SUPABASE_PROJECT_ID="<your-staging-ref>"
   SUPABASE_URL="https://<your-staging-ref>.supabase.co"

   VITE_SUPABASE_PROJECT_ID="<your-staging-ref>"
   VITE_SUPABASE_URL="https://<your-staging-ref>.supabase.co"
   VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOi..."
   VITE_SUPABASE_ANON_KEY="eyJhbGciOi..."

   SUPABASE_PUBLISHABLE_KEY="eyJhbGciOi..."
   SUPABASE_ANON_KEY="eyJhbGciOi..."

   SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOi..."

   TEST_DB_ISOLATED="true"
   SADA_ENVIRONMENT="staging"
   ```
3. **DO NOT MODIFY `.env`:** The existing `.env` file must remain untouched to preserve production configuration.
4. **CONFIRM GITIGNORING:** Ensure `.env.staging` is never committed:
   ```bash
   git status
   # Confirm that .env.staging does NOT appear in untracked files
   ```

---

## 4. Staging Preflight Verification Checklist

Before applying any migration or running any test, run through this verification checklist:

| # | Verification Check | Command / Procedure | Expected Result | Pass Criteria |
| :-: | :--- | :--- | :--- | :---: |
| **1** | Production Exclusion | Check `SUPABASE_PROJECT_ID` in `.env.staging` | Value != `mtfkzabiscyleztypqks` | **MANDATORY** |
| **2** | Hostname Exclusion | Check `SUPABASE_URL` in `.env.staging` | URL != `https://mtfkzabiscyleztypqks.supabase.co` | **MANDATORY** |
| **3** | Isolation Flag | Check `TEST_DB_ISOLATED` in `.env.staging` | Exactly `"true"` | **MANDATORY** |
| **4** | Git Isolation | `git status -s .env.staging` | Empty output (file is gitignored) | **MANDATORY** |
| **5** | Automated Preflight | `npx tsx scripts/verify-staging-db.ts` | **Exit code 0** (Non-production verified) | **MANDATORY** |

---

## 5. Applying Migrations to Staging

Once `npx tsx scripts/verify-staging-db.ts` passes with exit code 0, apply repository migrations to staging using **one** of the two authorized methods:

### Method A: Supabase CLI (Recommended)
```bash
# 1. Log into your Supabase account CLI
npx supabase login

# 2. Link specifically to the STAGING project
# WARNING: NEVER link to mtfkzabiscyleztypqks!
npx supabase link --project-ref <your-staging-ref>

# 3. Push repository migrations to the staging database
npx supabase db push
```

### Method B: Supabase Dashboard SQL Editor
If using the web interface:
1. Open the **SQL Editor** in your staging project dashboard.
2. Execute the required schema migrations in order from `supabase/migrations/`.
3. Ensure [`20261014220000_harden_convert_lead_client_id.sql`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/supabase/migrations/20261014220000_harden_convert_lead_client_id.sql) is executed.
4. Verify the deployed routine definition:
   ```sql
   SELECT proname, prosrc 
   FROM pg_proc 
   WHERE proname = 'convert_lead_to_sale';
   ```
5. Verify the unique partial index:
   ```sql
   SELECT indexname, indexdef 
   FROM pg_indexes 
   WHERE tablename = 'sales_commissions' 
     AND indexname = 'idx_sales_commissions_deal_id_unique';
   ```

---

## 6. How to Resume Sales Conversion Persistence Certification

Once migrations are applied to staging, execute the following workflow to complete certification:

```bash
# Step 1: Preflight verification of the staging target
npx tsx scripts/verify-staging-db.ts

# Step 2: Run the automated regression suite targeting staging
# (Points to .env.staging with TEST_DB_ISOLATED=true)
npx tsx scratch/test-sales-conversion-remediation.ts

# Step 3: Run the 10 live persistence test cases:
# - Case 1: Valid client conversion
# - Case 2: Missing client ID
# - Case 3: Malformed client UUID
# - Case 4: Non-existent client
# - Case 5: Unauthorized caller / direct RPC
# - Case 6: Sponsoring >= Sale Amount
# - Case 7: Normal commission & immutable snapshot
# - Case 8: Repeated conversion idempotency
# - Case 9: Genuinely concurrent requests
# - Case 10: Forced commission failure & rollback

# Step 4: Verify complete cleanup of synthetic staging records
# Confirming zero orphaned test fixtures remain in staging
```

Upon successful completion of all 10 live persistence cases against the verified staging database:
1. Update [`docs/audit/mvp/sales-conversion-final-acceptance.md`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/docs/audit/mvp/sales-conversion-final-acceptance.md) verdict to:
   ```text
   STAGING VERIFIED
   ```
2. Update [`docs/audit/mvp/sales-conversion-regression-results.md`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/docs/audit/mvp/sales-conversion-regression-results.md) with before/after database snapshots and concurrency test logs.
3. Submit the certified migration artifact for scheduled production deployment.
