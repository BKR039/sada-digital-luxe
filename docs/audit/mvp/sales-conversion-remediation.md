# SADA OS — Sales Lead Conversion Failure: Remediation Specification & Architecture

## 1. Executive Summary

This specification documents the multi-layered remediation implemented to resolve defect `DEF-SALES-008` (Sales lead conversion failure due to NULL `sales_commissions.client_id`).

The remediation establishes:
1. Mandatory canonical client validation across presentation, service, and database boundaries.
2. An auto-match heuristic assisting operators without bypassing explicit selection requirements.
3. Elimination of non-atomic out-of-band pre-mutations.
4. An atomic database transaction boundary inside `convert_lead_to_sale` RPC.
5. Strict adherence to sponsoring ad spend deduction rules.
6. Horizontal Kanban first-column zero-clipping guarantee.

---

## 2. Remediation Architecture & Layered Safeguards

```
[Layer 1: UI Presentation (SalesWorkspaceView.tsx)]
  - Radix SADASelect provisioned with `name="clientId"`
  - SADASelect linked to `error={saleClientError}` with visual pulse alert
  - `openConvertToSaleModal` performs auto-match heuristic against loaded clients
  - `handleConvertToSale` validates `saleClientId` before invoking conversion service

[Layer 2: Service Layer (sales-service.ts)]
  - `convertLeadToSale` accepts mandatory `clientId: string`
  - Validates dealId and clientId UUID formatting via standard regex
  - Executes read query on `public.clients` to verify entity exists before mutation
  - Removed out-of-band `deals.update({ commission_recipient_id })`
  - Idempotency guard: detects already won deals and returns safe cached response

[Layer 3: Database RPC (20261014220000_harden_convert_lead_client_id.sql)]
  - `convert_lead_to_sale` checks `v_resolved_client_id IS NOT NULL`
  - Asserts client exists in `public.clients` (foreign key satisfaction)
  - Resolves `commission_recipient_id` atomically within the transaction
  - Updates `deals` and inserts `sales_commissions` in a single ACID transaction
```

---

## 3. Files Modified & Changes Implemented

### 3.1 `src/components/admin/SalesWorkspaceView.tsx`
- **State Addition:** Added `saleClientError` boolean state for modal input validation feedback.
- **Auto-Match Heuristic (`openConvertToSaleModal`):**
  When a deal without an existing `client_id` is selected for conversion, the modal attempts an exact case-insensitive match against `clients` by company name or contact email. If a match is found, it pre-populates `saleClientId`; otherwise it leaves it empty.
- **Client Selection Guard (`handleConvertToSale`):**
  Blocks dispatch if `!saleClientId || !saleClientId.trim()`, triggering visual error styling, inline feedback, and an actionable Arabic/English toast message:
  ```text
  "Please select a valid SADA Client to finalize sale and calculate commission."
  "يرجى اختيار عميل صدى صالح لإتمام البيع واحتساب العمولة."
  ```
- **Modal Input Hardening:**
  Added `name="clientId"`, `id="sale-client-select"`, `error={saleClientError}`, and descriptive helper text to `<SADASelect>`.
- **Kanban First-Column Clearance:**
  Updated `scrollToStage` so that jumping to `STAGE_ORDER[0]` (`lead`) executes `track.scrollTo({ left: 0, behavior: "smooth" })`, and added `scroll-px-2` to the container. This prevents the first column from being clipped by `scrollIntoView` margins in both LTR and RTL directions.

### 3.2 `src/lib/sales-service.ts`
- **Signature Hardening:** Made `clientId: string` mandatory in `convertLeadToSale`.
- **Input Validation:** Enforced standard UUID validation on `dealId` and `clientId`.
- **Foreign-Key Pre-Verification:** Before any mutation or RPC invocation, queries `public.clients` to ensure the selected client exists and is accessible under active authorization scope.
- **Eliminated Non-Atomic Mutation:** Removed the unrolled `UPDATE public.deals SET commission_recipient_id = tm.id` query that previously committed prior to calling the RPC.
- **Idempotency Protection:** Added detection for deals already in `stage === "won"` that have an existing commission record, returning the existing commission without duplicating database records.

### 3.3 `supabase/migrations/20261014220000_harden_convert_lead_client_id.sql`
- **SQL RPC Hardening:**
  - Added `v_resolved_client_id := COALESCE(p_client_id, v_deal.client_id)`.
  - Added `IF v_resolved_client_id IS NULL THEN RAISE EXCEPTION ... USING ERRCODE = '23502'; END IF;`
  - Added existence verification: `IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = v_resolved_client_id) THEN RAISE EXCEPTION ... USING ERRCODE = '23503'; END IF;`
  - Added atomic resolution of `v_comm_recipient_id` within the function body, updating `deals.commission_recipient_id` inside the same transaction.
  - Sponsoring deduction invariant preserved: `v_comm_basis := GREATEST(0, p_sale_amount - COALESCE(p_sponsoring_amount, 0))`.
  - Re-declared unique partial index: `CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_commissions_deal_id_unique ON public.sales_commissions(deal_id) WHERE deal_id IS NOT NULL;` to guarantee concurrency idempotency at storage engine level.
  - Added explicit execute grants: `GRANT EXECUTE ON FUNCTION public.convert_lead_to_sale(...) TO authenticated, service_role;`.
- **Deployment Status Note:**
  This migration file exists in the codebase repository ready for deployment. In strict compliance with Section 6 (Production Database Safety), this migration has **NOT been pushed to the shared production database** (`mtfkzabiscyleztypqks.supabase.co`). Deployed production RPC currently remains the Phase I definition, but is protected from null failures by the client service and UI validation layers.

---

## 4. Commission Integrity & Sponsoring Deduction Model

The source of truth for commercial commissions is preserved:
- **Sale Amount:** `p_sale_amount` (e.g. 5,000 TND)
- **Sponsoring Budget:** `p_sponsoring_amount` (e.g. 800 TND)
- **Commissionable Base:**
  $$\text{Service Revenue} = \max(0, \text{Sale Amount} - \text{Sponsoring})$$
  $$5,000 - 800 = 4,200\text{ TND}$$
- **Commission Amount:**
  $$\text{Commission} = \text{ROUND}\left(\frac{\text{Service Revenue} \times \text{Rate}}{100}, 2\right)$$
  $$\frac{4,200 \times 15\%}{100} = 630.00\text{ TND}$$

---

## 5. Rollback & Idempotency Safeguards

1. **Transaction Boundary:** All database modifications (deal stage change, deal values, and commission insertion) execute inside a single PostgreSQL function (`convert_lead_to_sale`). Any failure during commission insertion automatically rolls back the deal update.
2. **Double-Click & Retry Protection:**
   - UI disables submit button and displays a loading spinner during conversion (`isLoading={converting}`).
   - Service layer verifies if the deal is already won with a commission.
   - Database RPC verifies `v_comm_id IS NULL` before inserting into `sales_commissions`.
3. **Foreign Key Integrity:** Both `deals.client_id` and `sales_commissions.client_id` point directly to canonical `public.clients(id)`. No temporary or synthetic UUIDs are substituted.
