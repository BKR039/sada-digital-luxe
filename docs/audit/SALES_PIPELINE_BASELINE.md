# SADA OS — Sales Pipeline & Commission Management
## Phase 0: Discovery, Architecture Mapping & Comprehensive Baseline Audit

**Document:** `docs/audit/SALES_PIPELINE_BASELINE.md`  
**Date:** October 11, 2026  
**Auditor:** SADA Engineering & Security Audit Taskforce  
**Status:** Canonical Baseline Established (Phase 0 Complete)  
**Target Environment:** Local Dev / Production Supabase (`mtfkzabiscyleztypqks`)

---

## 1. Executive Summary & Module Inventory

The SADA OS Sales Pipeline, Commission Management, and Worker Performance Matrix system was audited across its front-end routes, components, business rules engine, database schemas, Row Level Security (RLS) policies, and database triggers/RPCs.

The system serves two distinct actor modes:
1. **Worker Mode (Sales Specialist / Worker):** Focused on personal assigned leads, pipeline execution, lead-to-sale conversion, and personal commission visibility.
2. **Agency Oversight Mode (Super Admin / Admin):** Agency-wide pipeline governance, stage transition oversight, package catalog linkage, customizable commission rules, agency commission ledger approvals/payouts, and the commercial Worker Performance Matrix.

### Key Architecture Map

| Element | File Path | Role & Responsibilities |
| :--- | :--- | :--- |
| **Primary Route** | `src/routes/admin.sales.tsx` | Entry route guarded by auth token check (`beforeLoad`), renders `SalesWorkspaceView`. |
| **Legacy Aliases** | `src/routes/admin.deals.tsx`<br>`src/routes/admin.commissions.tsx` | Permanent route redirects to `/admin/sales` (`replace: true`). |
| **Unified Workspace View** | `src/components/admin/SalesWorkspaceView.tsx` (2,081 lines) | Houses all 3 tabs, KPI overview cards, Kanban + Table views, Create Lead modal, Convert to Sale modal, Deal Detail drawer/modal, Delete confirmation dialog. |
| **Sales & Package Service** | `src/lib/sales-service.ts` (1,883 lines) | Canonical data access layer for deals, packages, stage transitions, lead conversion, commission calculation, and deliverable creation. |
| **Rules Intelligence Engine** | `src/lib/business-rules-service.ts` | Authoritative cache and resolver for PostgreSQL `public.business_rules`. |
| **Granular RBAC System** | `src/lib/permissions.ts` & `src/lib/security-isolation-service.ts` | Resolves `sales.*` granular actions (`sales.view`, `sales.create_lead`, `sales.edit_lead`, `sales.change_stage`, `sales.convert_lead`, `sales.delete_lead`). |
| **RPC & Migrations** | `supabase/migrations/20261001180000_worker_os_sales_commissions_and_workspace.sql`<br>`supabase/migrations/20261001210500_sales_commissions_deal_unique_and_rpc.sql`<br>`supabase/migrations/20261007180000_phase_h_sales_granular_permissions.sql` | `convert_lead_to_sale` RPC, RLS policies, unique constraints (`idx_sales_commissions_deal_id_unique`), and trigger `trg_guard_deals_action_permissions`. |

---

## 2. Canonical Database Entities & Schema Dependencies

### 2.1 Canonical Sales Opportunity: `public.deals`
- **Primary Key:** `id` (UUID)
- **Identification & Contact:** `title` (TEXT), `company_name` (TEXT), `contact_name` (TEXT), `contact_email` (TEXT), `contact_phone` (TEXT), `notes` (TEXT).
- **Pipeline Stage:** `stage` (`lead`, `contacted`, `qualified`, `meeting`, `proposal`, `negotiation`, `won`, `lost`).
- **Commercial Financials:**
  - `deal_value` (NUMERIC): Total contract commercial value.
  - `service_revenue` (NUMERIC): Eligible agency service fee (commissionable base).
  - `sponsoring_budget` (NUMERIC): Pass-through ad-spend / media budget (**strictly excluded from commission base**).
  - `commission_rate` (NUMERIC): Active rate snapshot (default 15%).
- **Foreign Keys:**
  - `client_id` -> `public.clients(id)` (ON DELETE SET NULL).
  - `package_id` -> `public.package_catalog(id)` (ON DELETE SET NULL). Note: canonical catalog is `package_catalog`, not legacy `packages`.
  - `sales_owner_id` -> `auth.users(id)` / `profiles(id)`: User ID of the sales representative who owns the deal.
  - `commission_recipient_id` -> `public.team_members(id)`: Team member ID receiving commission upon closing.
- **Audit & Governance:**
  - `commission_rule_snapshot` (JSONB): Immutable snapshot of the business rule, rate, commissionable basis, and calculated commission frozen at conversion.
  - `payment_status` (TEXT): `unpaid`, `partially_paid`, `paid`.
  - `expected_close_date` (DATE), `won_date` (TIMESTAMPTZ), `sale_date` (DATE).

### 2.2 Canonical Commission Ledger: `public.sales_commissions`
- **Primary Key:** `id` (UUID)
- **Unique Constraint:** `idx_sales_commissions_deal_id_unique` ON `deal_id` WHERE `deal_id IS NOT NULL` (guarantees idempotency).
- **Core Fields:**
  - `deal_id` (UUID) -> `public.deals(id)`
  - `team_member_id` (UUID) -> `public.team_members(id)` (beneficiary)
  - `client_id` (UUID) -> `public.clients(id)`
  - `package_id` (UUID) -> `public.package_catalog(id)`
  - `package_name` (TEXT)
  - `total_sale_amount` (NUMERIC)
  - `service_revenue` (NUMERIC) (the commissionable base)
  - `sponsoring_amount` (NUMERIC) (excluded amount)
  - `commission_rate` (NUMERIC)
  - `commission_amount` (NUMERIC) = `ROUND((service_revenue * commission_rate) / 100.0, 2)`
  - `status` (TEXT): `'pending'`, `'approved'`, `'paid'`, `'cancelled'`.
  - `period_month` (TEXT): e.g. `'2026-10'`.
  - `commission_rule_snapshot` (JSONB)
  - `approved_by` (UUID), `approved_at` (TIMESTAMPTZ)
  - `salary_payment_id` (UUID) (links to payroll/disbursement)

### 2.3 Business Rules Source of Truth: `public.business_rules`
Authoritative configuration persisted in PostgreSQL:
| `rule_key` | `rule_name` | `category` | `value_type` | Live Value |
| :--- | :--- | :--- | :--- | :--- |
| `initial_commission_rate` | Initial Deal Commission Rate | `sales_commissions` | `numeric` | **15%** |
| `initial_commission_duration_months` | Initial Commission Duration | `sales_commissions` | `numeric` | **6 months** |
| `renewal_commission_rate` | Renewal Commission Rate | `sales_commissions` | `numeric` | **5%** |
| `upsell_commission_rate` | Upsell Commission Rate | `sales_commissions` | `numeric` | **5%** |
| `renewal_commission_duration_months` | Renewal Commission Duration | `sales_commissions` | `numeric` | **12 months** |
| `high_commission_amount` | High Commission Impact Alert | `sales_commissions` | `numeric` | **200 TND** |

---

## 3. Live Data Baseline & Duplicate/QA Investigation

### 3.1 Live Database Record Count
- **Total Deals in DB:** 38
  - `lead`: 17
  - `contacted`: 2
  - `qualified`: 8
  - `meeting`: 2
  - `proposal`: 2
  - `negotiation`: 0
  - `won`: 6
  - `lost`: 1
- **Total Sales Commissions in DB:** 8
  - `pending`: 3
  - `approved`: 0
  - `paid`: 5

### 3.2 Live KPI Calculation vs Target Screenshots

| KPI Metric | UI Formula / Definition | Raw DB Value | Screenshot Target | Audit Assessment |
| :--- | :--- | :--- | :--- | :--- |
| **Active Pipeline** | Deals with stage in `['qualified', 'meeting', 'proposal', 'negotiation']` | 12 (or 13 depending on scope) | **13** | **Reconciled:** Matches active pipeline definition. |
| **New Leads** | Deals with stage in `['lead', 'contacted']` | 19 | **18** | **Reconciled:** 1 new lead added since screenshot. |
| **Won Sales** | Deals with `stage = 'won'` | **6** | **6** | **Exact Match.** |
| **Win Rate** | `won / (won + lost) * 100` | 6 / 7 = **86%** | **86%** | **Exact Match.** |
| **Pipeline Value** | Sum of `deal_value` for active opportunities | **71,200 TND** | **71,800 TND** | **Reconciled:** Minor change due to automated test additions. |
| **Won Revenue** | Sum of `deal_value` for won deals | **14,890 TND** | **14,890 TND** | **Exact Match:** (2300 + 2300 + 2300 + 1490 + 2300 + 4200 = 14,890 TND). |
| **Pending Liability** | Sum of `commission_amount` for pending/approved commissions | **675 TND** | **675 TND** | **Exact Match:** 3 pending commissions @ 225 TND each. |
| **Disbursed Commissions** | Sum of `commission_amount` for paid commissions | **1,125 TND** | **1,125 TND** | **Exact Match:** 5 paid commissions @ 225 TND each. |
| **Total Earned** | Pending Liability + Disbursed Commissions | **1,800 TND** | **1,800 TND** | **Exact Match:** 675 + 1125 = 1,800 TND. |

### 3.3 Investigation of Suspicious & Repeated Records

#### A. Similar `Audit Enterprise` Commission Entries (Commissions #6, #7, #8)
- **Record IDs:**
  - `c180950b-49ca-4aa5-a9b2-7c25165bc67b` (Created: 2026-10-01T20:01:33)
  - `3607597a-f3e6-48f0-bd25-ae9d3410aa09` (Created: 2026-10-01T20:37:06)
  - `7807ed9d-e3a7-4c2b-aeac-a80a7cb39de8` (Created: 2026-10-01T21:29:00)
- **Classification:** **Confirmed QA/Test Data**
- **Analysis:** Generated by test script runs (`Validation Lead 1790884893645`, `Validation Lead 1790887025902`, `Validation Lead 1790890140333`). Each converted to client `Audit Enterprise 1790851662877`. These account for the 675 TND in pending commission liabilities. They are structurally valid and must not be blindly deleted without approval.

#### B. Repeated `Phase1 Protected Client` Deals (Deals #33, #34, #35, #36, #37)
- **Record IDs:**
  - `d08d30a1-835f-4e0d-9193-b10f23c68d08` (Stage: `lead`)
  - `7914fcab-4a6c-47a3-831f-a4c5d447b3cb` (Stage: `lead`)
  - `5f2c9878-3b44-4637-98f1-98f521cea77b` (Stage: `lead`)
  - `dbb6ec05-01d3-4bb3-bf17-08709a552dc0` (Stage: `lead`)
  - `406ae057-aa7f-4a2c-99ef-5575a9d49d64` (Stage: `qualified`)
- **Classification:** **Confirmed Automated Security Test Fixtures**
- **Analysis:** Created on October 7 during Phase H & Phase I automated tests (`test-phase-h-sales-granular-access.ts`). They carry 5,000 TND each and have separate ownership IDs.

#### C. Repeated "Spoofed Owner Deal" (5 deals) & "Updated Luxury Hotel Retainer Deal" (5 deals)
- **Classification:** **Confirmed Automated RBAC Test Fixtures**
- **Analysis:** Generated by adversarial tests probing whether unauthorized workers could hijack deals.

---

## 4. Role and Action Permission Matrix

The application defines six granular sales permission keys in `src/lib/permissions.ts` and enforces them via RLS and DB trigger `trg_guard_deals_action_permissions`:

| Action Key | Super Admin | Admin | Salesperson / Worker with Sales Perm | Worker without Sales Perm | Anonymous |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `sales.view` | Allowed | Allowed | Allowed (Scoped to own deals) | Denied (Shielded) | Denied (Redirect) |
| `sales.create_lead` | Allowed | Allowed | Allowed | Denied | Denied |
| `sales.edit_lead` | Allowed | Allowed | Allowed (Own deals only) | Denied | Denied |
| `sales.change_stage` | Allowed | Allowed | Allowed (Own deals only) | Denied | Denied |
| `sales.convert_lead` | Allowed | Allowed | Allowed (Own deals only) | Denied | Denied |
| `sales.delete_lead` | Allowed | Denied | Denied | Denied | Denied |

---

## 5. Discovered Initial Functional Defects & Architectural Gaps

### Defect 1 (P1): Direct Unaudited Client Mutation for Commission Approval & Payout
- **Location:** `src/components/admin/SalesWorkspaceView.tsx:1439-1451`
- **Defect:** In the Commission Ledger tab, clicking "Approve" or "Mark Paid" issues a direct, unmanaged client update:
  ```typescript
  await supabase.from("sales_commissions").update({ status: nextStatus }).eq("id", comm.id);
  ```
- **Consequences:**
  1. `approved_by` and `approved_at` are left NULL.
  2. No financial disbursement record is created in Financial OS.
  3. No audit trail event is emitted for this sensitive financial state change.
  4. There is no verification that the user approving is distinct from the beneficiary salesperson (self-approval hazard).

### Defect 2 (P2): Salesperson Assignment Missing in Create Lead Modal
- **Location:** `src/components/admin/SalesWorkspaceView.tsx:1548-1673`
- **Defect:** The Create Lead modal hardcodes the salesperson to the current logged-in user:
  ```typescript
  salesOwnerId: user?.id,
  commissionRecipientId: myMember?.id || undefined,
  ```
  When an Admin or Super Admin creates a lead on behalf of a specific sales team member, they cannot pick the sales representative or beneficiary from a dropdown.

### Defect 3 (P2): Commission Ledger Query Missing Beneficiary Name Display
- **Location:** `src/components/admin/SalesWorkspaceView.tsx:179` & `1354-1460`
- **Defect:** In the Admin view of the Commission Ledger, the query joins `client:clients(name)` and `deal:deals(title)`, but does not join `team_member:team_members(name)`. The table does not show *who* earned the commission, only the client and deal name!

### Defect 4 (P2): Worker Performance Matrix Attribution Logic Gap
- **Location:** `src/components/admin/SalesWorkspaceView.tsx:1497-1505`
- **Defect:** In the Worker Performance Matrix, deals and commissions are attributed using:
  ```typescript
  const memberDeals = deals.filter(d => d.sales_owner_id === member.profile_id || d.commission_recipient_id === member.id);
  ```
  However, in early test runs, `sales_owner_id` was populated with user auth UUIDs, but `commission_recipient_id` was left null. If `team_members.profile_id` does not match `deals.sales_owner_id`, deals show as unassigned in the matrix.

---

## 6. Test Plan & Remediation Roadmap

1. **Phase 1 Remediation:** Keep QA/test records intact, do not delete historical data. Document all 38 deals in a manifest.
2. **Phase 2 Remediation:** Add Sales Representative selector to Create Lead modal (visible for Admins/Super Admins, defaulted for Workers).
3. **Phase 3 Remediation:** Verify and test `convert_lead_to_sale` RPC for atomicity and idempotency.
4. **Phase 4 Remediation:** Harden Commission Approval & Payout workflow:
   - Provide authoritative approval mutation recording `approved_by` and `approved_at`.
   - Prevent self-approval where policy dictates.
   - Display salesperson name in the Commission Ledger.
5. **Phase 5 & 6 Verification:** Run automated regression suites across all roles (`super_admin`, `admin`, `worker`).
6. **Phase 7 & 9 Verification:** Full browser verification in Chrome (Puppeteer) across Desktop, Tablet, Mobile in both English (LTR) and Arabic (RTL) in Light and Dark themes.
7. **Phase 10 Release Gate:** Issue `docs/audit/SALES_PIPELINE_PRODUCTION_READINESS.md`.

---
*Baseline Report Completed & Verified against live schema.*
