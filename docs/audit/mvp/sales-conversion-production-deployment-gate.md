# SADA OS — Sales Lead Conversion Hardening: Production Deployment Gate

## 1. Executive Summary & Verdict

### Final Pre-Deployment Verdict: `BLOCKED — PENDING OPERATOR DEPLOYMENT OF MIGRATION 96`
### Local Integration Test Status: `8/8 PASSED (NATIVE LOCAL POSTGRESQL 16)`
### Remote Production Database Status: `READ-ONLY AUDITED — CODE CORRECTION COMMITTED TO REPOSITORY`
### Audit Timestamp: `2026-10-15T14:24:00+01:00`
### Target Supabase Project Identity: `mtfkzabiscyleztypqks` (`mtfkzabiscyleztypqks.supabase.co`)

> **Safety Gate Protocol Declaration:**  
> This production deployment gate review incorporates live evidence collected from the Supabase Dashboard for project `mtfkzabiscyleztypqks` and confirms the code-level resolution of the excessive privilege defect.  
> 
> **Current Status & Blocker Resolution:**  
> 1. **Code Correction Applied (`VERIFIED IN REPOSITORY`):** In response to the live finding that `PUBLIC` and `anon` held `EXECUTE` privileges, [`supabase/migrations/20261014220000_harden_convert_lead_client_id.sql`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/supabase/migrations/20261014220000_harden_convert_lead_client_id.sql) has been updated with an explicit:  
>    `REVOKE EXECUTE ON FUNCTION public.convert_lead_to_sale(...) FROM PUBLIC, anon;`  
>    before the required `GRANT EXECUTE ... TO authenticated, service_role;`.
> 2. **Index Relation Verified:** Live dashboard evidence confirms relation `idx_sales_commissions_deal_id_unique` exists. The local repository DDL defines `UNIQUE INDEX ... (deal_id) WHERE deal_id IS NOT NULL`, matching historical predecessor `20261001210500`.
> 3. **Ledger Status:** Latest visible version in production is confirmed as `20261010140000` (migration 95 of 96). Total migration count across migrations 1–94 remains `UNVERIFIED` until operator supplies `SELECT count(*)`.
> 4. **Deployment Boundary:** In accordance with the Mandatory Safety Rules, this migration has **NOT been applied to Production** by the automated agent. Deployment remains gated on authorized operator execution.

---

## 2. Artifact Identification & Cryptographic Checksum

| Attribute | Authoritative Value | Evidence |
| :--- | :--- | :--- |
| **Migration Filename** | `20261014220000_harden_convert_lead_client_id.sql` | `VERIFIED IN REPOSITORY` |
| **Filesystem Path** | `supabase/migrations/20261014220000_harden_convert_lead_client_id.sql` | `VERIFIED IN REPOSITORY` |
| **File Size** | `8,477 bytes` (229 lines) | `VERIFIED IN REPOSITORY` |
| **Cryptographic Hash (SHA-256)** | `14F6884A50AE3C82A6C7E0E71B329AAB389307E0B71A4DA0097F11EA5F5BDB7D` | `VERIFIED IN REPOSITORY` |
| **Target Function** | `public.convert_lead_to_sale(UUID, UUID, UUID, NUMERIC, NUMERIC, TEXT, DATE, TEXT)` | `VERIFIED IN REPOSITORY` |
| **Target Return Type** | `JSONB` | `VERIFIED IN REPOSITORY` |
| **Target Index** | `idx_sales_commissions_deal_id_unique` ON `public.sales_commissions(deal_id) WHERE deal_id IS NOT NULL` | `VERIFIED IN REPOSITORY` |
| **Privilege Contract** | Explicit `REVOKE ... FROM PUBLIC, anon` + `GRANT ... TO authenticated, service_role` | `VERIFIED IN REPOSITORY` |

---

## 3. Privilege Analysis & Completed Code Remediation

### 3.1 Live Evidence & Vulnerability Assessment
- **Live State:** `information_schema.routine_privileges` showed `EXECUTE` for `anon` and `PUBLIC`.
- **Root Cause:** PostgreSQL default privileges assign `EXECUTE` to `PUBLIC`. `GRANT` statements are additive and do not revoke pre-existing grants.
- **Remediation Applied in Migration:** Lines 219–228 now explicitly execute:
  ```sql
  -- Strip excessive execution privileges from public pseudo-role and anonymous callers
  REVOKE EXECUTE ON FUNCTION public.convert_lead_to_sale(
      UUID, UUID, UUID, NUMERIC, NUMERIC, TEXT, DATE, TEXT
  ) FROM PUBLIC, anon;

  -- Ensure explicit execute grants for authenticated users and service_role
  GRANT EXECUTE ON FUNCTION public.convert_lead_to_sale(
      UUID, UUID, UUID, NUMERIC, NUMERIC, TEXT, DATE, TEXT
  ) TO authenticated, service_role;
  ```
- **Defense-in-Depth:**
  - **Layer 1 (API/PostgreSQL Engine):** PostgREST checks `routine_privileges`. With `anon`/`PUBLIC` revoked, unauthenticated calls are rejected with `HTTP 403 Forbidden` without invoking PL/pgSQL.
  - **Layer 2 (Procedural Logic):** Line 43 asserts `auth.uid() IS NOT NULL`, followed by `has_permission` and deal ownership checks.

---

## 4. Index Definition & Ledger Invariants

### 4.1 Index Verification Status
- **Local Definition (`VERIFIED IN REPOSITORY`):**
  ```sql
  CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_commissions_deal_id_unique
      ON public.sales_commissions(deal_id)
      WHERE deal_id IS NOT NULL;
  ```
- **Historical Parity (`VERIFIED IN HISTORICAL INVENTORY`):** Matches migration `20261001210500_sales_commissions_deal_unique_and_rpc.sql` and `database_complete_inventory_dump.json:L4396`.
- **Live State:** Operator confirmed relation `idx_sales_commissions_deal_id_unique` exists. Full predicate verification in `pg_indexes` remains `PARTIALLY VERIFIED (NAME CONFIRMED)`.

### 4.2 Migration Ledger Contiguity
- **Latest Applied Version:** `20261010140000` (`VERIFIED LIVE READ-ONLY`).
- **Pending Sequential Migration:** `20261014220000_harden_convert_lead_client_id.sql` (Migration 96).
- **Contiguity Check:** Total applied migration count remains `UNVERIFIED` pending operator confirmation of `SELECT count(*) FROM supabase_migrations.schema_migrations;` (expected: 95).

---

## 5. Deployment Script for Authorized Operator Execution

When the operator decides to deploy the hardened migration, execute the following SQL in the **Supabase Dashboard SQL Editor**:

```sql
-- =====================================================================
-- SADA OS TARGETED DDL DEPLOYMENT: CONVERT LEAD TO SALE HARDENING
-- Source: supabase/migrations/20261014220000_harden_convert_lead_client_id.sql
-- Checksum: 14F6884A50AE3C82A6C7E0E71B329AAB389307E0B71A4DA0097F11EA5F5BDB7D
-- =====================================================================

BEGIN;

-- 1. Replace convert_lead_to_sale RPC with canonical client resolution
CREATE OR REPLACE FUNCTION public.convert_lead_to_sale(
    p_deal_id UUID,
    p_client_id UUID DEFAULT NULL,
    p_package_id UUID DEFAULT NULL,
    p_sale_amount NUMERIC DEFAULT 0,
    p_sponsoring_amount NUMERIC DEFAULT 0,
    p_payment_status TEXT DEFAULT 'paid',
    p_sale_date DATE DEFAULT CURRENT_DATE,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_team_member_id UUID;
    v_comm_recipient_id UUID;
    v_resolved_client_id UUID;
    v_pkg_name TEXT := 'Custom Package';
    v_comm_rate NUMERIC := 15;
    v_comm_basis NUMERIC;
    v_comm_amount NUMERIC;
    v_deal RECORD;
    v_comm_id UUID;
    v_snapshot JSONB;
    v_rate_check JSONB;
BEGIN
    -- 1. Verify authentication
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated'
            USING ERRCODE = '28000';
    END IF;

    -- 2. Abuse protection: rate limit conversions to max 30 per minute per user
    v_rate_check := public.check_rate_limit('convert_lead:' || v_user_id::text, 'entity_creation', 30, 60);
    IF (v_rate_check->>'allowed')::boolean = false THEN
        RAISE EXCEPTION 'Rate limit exceeded: Too many conversion requests. Please wait % seconds before retrying.', (v_rate_check->>'retry_after')
            USING ERRCODE = '42501';
    END IF;

    -- 3. Enforce sales.convert_lead granular permission
    IF NOT public.has_permission(v_user_id, 'sales.convert_lead') THEN
        RAISE EXCEPTION 'Unauthorized: Account lacks sales.convert_lead permission'
            USING ERRCODE = '42501';
    END IF;

    -- 4. Fetch existing deal
    SELECT * INTO v_deal
    FROM public.deals
    WHERE id = p_deal_id;

    IF v_deal.id IS NULL THEN
        RAISE EXCEPTION 'Deal % not found', p_deal_id
            USING ERRCODE = 'P0002';
    END IF;

    -- 5. Authorization check: worker can only convert their own deal unless admin
    IF NOT public.is_admin(v_user_id) AND v_deal.sales_owner_id != v_user_id THEN
        RAISE EXCEPTION 'Unauthorized: Worker may only convert their own assigned deal'
            USING ERRCODE = '42501';
    END IF;

    -- 6. Canonical client resolution and validation
    v_resolved_client_id := COALESCE(p_client_id, v_deal.client_id);
    IF v_resolved_client_id IS NULL THEN
        RAISE EXCEPTION 'A valid SADA Client ID is required to convert a lead and record sales commission.'
            USING ERRCODE = '23502';
    END IF;

    -- 7. Validate that canonical client exists in public.clients to satisfy foreign key constraint
    IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = v_resolved_client_id) THEN
        RAISE EXCEPTION 'Selected client % does not exist in public.clients.', v_resolved_client_id
            USING ERRCODE = '23503';
    END IF;

    -- 8. Resolve commission beneficiary team member ID atomically within the transaction
    v_comm_recipient_id := v_deal.commission_recipient_id;
    IF v_comm_recipient_id IS NULL THEN
        SELECT id INTO v_comm_recipient_id
        FROM public.team_members
        WHERE profile_id = COALESCE(v_deal.sales_owner_id, v_user_id)
        LIMIT 1;

        IF v_comm_recipient_id IS NULL THEN
            SELECT id INTO v_comm_recipient_id
            FROM public.team_members
            WHERE profile_id = v_user_id
            LIMIT 1;
        END IF;
    END IF;

    -- 9. Read package name if package_id provided
    IF p_package_id IS NOT NULL THEN
        SELECT name INTO v_pkg_name
        FROM public.package_catalog
        WHERE id = p_package_id;
    END IF;

    -- 10. Read active commission rate from business_rules (fallback 15) using canonical column numeric_value
    SELECT COALESCE(numeric_value, 15)
    INTO v_comm_rate
    FROM public.business_rules
    WHERE rule_key = 'initial_commission_rate' AND is_active = true
    LIMIT 1;

    IF v_comm_rate IS NULL THEN
        v_comm_rate := 15;
    END IF;

    -- 11. Commissionable amount calculation: Sale amount - Sponsoring (Strict Sponsoring Deduction)
    v_comm_basis := GREATEST(0, p_sale_amount - COALESCE(p_sponsoring_amount, 0));
    v_comm_amount := ROUND((v_comm_basis * v_comm_rate) / 100.0, 2);

    -- 12. Build immutable rule snapshot
    v_snapshot := jsonb_build_object(
        'rule_key', 'initial_commission_rate',
        'rule_name', 'Initial Sales Commission Rate',
        'rate_percent', v_comm_rate,
        'deal_type', 'initial',
        'total_amount', p_sale_amount,
        'sponsoring_deducted', COALESCE(p_sponsoring_amount, 0),
        'commissionable_amount', v_comm_basis,
        'calculated_commission', v_comm_amount,
        'client_id', v_resolved_client_id,
        'snapshot_date', now()
    );

    -- 13. Update deal to won atomically
    UPDATE public.deals
    SET stage = 'won',
        client_id = v_resolved_client_id,
        package_id = p_package_id,
        deal_value = p_sale_amount,
        service_revenue = v_comm_basis,
        sponsoring_budget = COALESCE(p_sponsoring_amount, 0),
        payment_status = p_payment_status,
        commission_rate = v_comm_rate,
        commission_recipient_id = COALESCE(v_comm_recipient_id, v_deal.commission_recipient_id),
        commission_rule_snapshot = v_snapshot,
        won_date = p_sale_date,
        notes = COALESCE(p_notes, v_deal.notes),
        updated_at = now()
    WHERE id = p_deal_id;

    -- 14. Idempotency: check if commission already recorded for this deal
    SELECT id INTO v_comm_id
    FROM public.sales_commissions
    WHERE deal_id = p_deal_id
    LIMIT 1;

    IF v_comm_id IS NULL AND v_comm_recipient_id IS NOT NULL THEN
        INSERT INTO public.sales_commissions (
            deal_id,
            team_member_id,
            client_id,
            package_id,
            package_name,
            total_sale_amount,
            service_revenue,
            sponsoring_amount,
            commission_rate,
            commission_amount,
            commission_rule_snapshot,
            period_month,
            status,
            notes
        ) VALUES (
            p_deal_id,
            v_comm_recipient_id,
            v_resolved_client_id,
            p_package_id,
            v_pkg_name,
            p_sale_amount,
            v_comm_basis,
            COALESCE(p_sponsoring_amount, 0),
            v_comm_rate,
            v_comm_amount,
            v_snapshot,
            to_char(p_sale_date, 'YYYY-MM'),
            CASE WHEN p_payment_status = 'paid' THEN 'paid' ELSE 'pending' END,
            'Generated via convert_lead_to_sale RPC'
        )
        RETURNING id INTO v_comm_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'deal_id', p_deal_id,
        'client_id', v_resolved_client_id,
        'commission_id', v_comm_id,
        'commission_amount', v_comm_amount,
        'commission_rate', v_comm_rate,
        'commissionable_basis', v_comm_basis
    );
END;
$$;

-- 2. Physical unique index on sales_commissions(deal_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_commissions_deal_id_unique
    ON public.sales_commissions(deal_id)
    WHERE deal_id IS NOT NULL;

-- 3. Strip excessive privileges from public and anon
REVOKE EXECUTE ON FUNCTION public.convert_lead_to_sale(
    UUID, UUID, UUID, NUMERIC, NUMERIC, TEXT, DATE, TEXT
) FROM PUBLIC, anon;

-- 4. Grant execute strictly to authenticated users and service_role
GRANT EXECUTE ON FUNCTION public.convert_lead_to_sale(
    UUID, UUID, UUID, NUMERIC, NUMERIC, TEXT, DATE, TEXT
) TO authenticated, service_role;

COMMIT;

-- 5. Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
```

---

## 6. Final Gate Verdict

```
========================================================================================
  FINAL GATE VERDICT: BLOCKED — PENDING OPERATOR DEPLOYMENT OF MIGRATION 96
  Code correction (REVOKE FROM PUBLIC, anon) verified in repository.
  Deployment gated on authorized human execution via Supabase Dashboard.
========================================================================================
```
