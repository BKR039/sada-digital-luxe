# SADA OS — Client Workspaces & Client 360 Baseline Audit

**Document ID:** `SADA-AUDIT-CW-BASE-001`  
**Module:** Client Workspaces (`/admin/client-workspaces`) & Client 360 (`/admin/client-workspaces/:id`)  
**Audit Standard:** Forensic Read-Only Inspection · Zero Production Mutation · Live Database State  
**Audit Date:** October 14, 2026  
**Target Environment:** Connected Remote Supabase (`mtfkzabiscyleztypqks.supabase.co`)  
**Status:** **PHASE 0 BASELINE ESTABLISHED**  

---

## 1. Executive Summary

This baseline audit records the exact state of the connected database before making code modifications or performing verification. It establishes verified record counts, relationship integrity, commercial configurations, financial totals, and identifies existing data discrepancies and test fixtures.

### Key Invariant Findings
1. **Zero Orphaned Workspaces:** All 24 `client_projects` workspace containers possess valid `client_id` references pointing to existing records in `public.clients` (0 orphaned projects).
2. **Clean Status Partitioning:** 31 clients are marked `active` and 5 are marked `archived`. Zero clients have corrupt or invalid status enum values.
3. **Engagement Type Balance:** Exactly 18 clients are configured as `monthly` (retainers) and 18 are configured as `one_off`.
4. **Test Fixture Legacy:** 24 out of 36 client records originate from historical automated testing runs (Phase D, Phase 2, Route 16, and QA audit suites). Per strict safety rules, these records are documented, categorized, and preserved without modification.
5. **Code Defect Identified (Hardcoded Fallbacks):** In `admin.client-workspaces.$id.tsx` (lines 613, 616, 1620, 1623), missing `monthly_package_price` and `default_sponsoring_budget` fell back to hardcoded demo constants `|| 1500` and `|| 500`. Furthermore, when `totalTopline <= 0`, margin percent fell back to `50`%. These violations of SSOT principles have been documented in the defect register for remediation.

---

## 2. Quantitative Baseline Ledger

| Entity / Dimension | Live Database Count | Verified Detail / Breakdown | Integrity Status |
| :--- | :---: | :--- | :---: |
| **Total Clients (`public.clients`)** | **36** | `active`: 31 \| `archived`: 5 \| `prospect`: 0 | ✅ Clean |
| **- Monthly Retainers** | **18** | Regular recurring service clients | ✅ Clean |
| **- One-Off Engagements** | **18** | Fixed-scope deliverable clients | ✅ Clean |
| **- Legitimate Business Clients** | **12** | Maison Carthage, Café 707, TOTTA Restaurant, Sidi Bou Said, etc. | ✅ Preserved |
| **- QA / Historical Test Fixtures** | **24** | Created by historical automated QA test runs | ⚠️ Documented |
| **Workspace Containers (`client_projects`)** | **24** | All 24 linked to valid `client_id` | ✅ Zero Orphans |
| **Service Commitments (`service_commitments`)** | **17** | `is_active = false`: 17 (test fixtures) | ⚠️ Inactive |
| **Project Tasks (`project_tasks`)** | **239** | Linked by `project_id`: 239 \| Explicit `client_id`: 130 | ✅ Relational |
| **Invoices (`public.invoices`)** | **6** | `paid`: 5 \| `sent`: 1 \| `draft`: 0 \| `cancelled`: 0 | ✅ Invariant |
| **- Total Invoiced Amount** | **13,800.000 TND** | Total face value of issued invoices | ✅ Verified |
| **- Total Invoice Collections** | **11,500.000 TND** | Total recorded in `paid_amount` | ✅ Verified |
| **- Outstanding Receivables** | **2,300.000 TND** | Derived from single unpaid invoice (`status = 'sent'`) | ✅ Reconciled |
| **Cash Inflows (`income_transactions`)** | **12** | Total amount: 14,500.000 TND (10 linked to clients) | ✅ Verified |
| **Cash Outflows (`expense_transactions`)** | **56** | Total: 20,088.000 TND (9 client-attributed: 4,870.000 TND) | ✅ Verified |
| **Sponsoring Campaigns (`sponsoring_campaigns`)** | **5** | Sponsoring ad campaigns tracked in Financial OS | ✅ Verified |
| **Reconciliation Logs (`reconciliation_audit_logs`)** | **30** | Immutable package work reconciliation events | ✅ Immutable |
| **Project Activity Logs (`project_activity`)** | **207** | Task state and assignment audit events | ✅ Immutable |
| **System Audit Logs (`system_audit_logs`)** | **857** | Administrative security and system events | ✅ Immutable |

---

## 3. Client Roster & Relationship Integrity Analysis

### 3.1 Legitimate Business Clients (12 Records)

| Client ID | Name | Type | Status | Rate (TND) | Sponsoring (TND) | Relationship Lead / Owner | Notes |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| `9e0c17e9-aca5-4c50-9ecc-482e3e642e50` | **Maison Carthage Luxury** | `one_off` | `active` | 0.000 | 0.000 | Unassigned | Flagship luxury partner |
| `0159b219-605e-4020-9d73-34117263541e` | **Café 707** | `one_off` | `active` | 0.000 | 0.000 | `24d88d6a-...` (Demo Admin) | Commercial F&B account |
| `9638f6d5-a88a-48e3-9980-0ce7064ea352` | **TOTTA Restaurant** | `one_off` | `active` | 0.000 | 0.000 | `24d88d6a-...` (Demo Admin) | Commercial hospitality account |
| `741972f9-0bba-4181-acfe-05e6660699ff` | **Sidi Bou Said Artisans** | `one_off` | `active` | 0.000 | 0.000 | `24d88d6a-...` (Demo Admin) | Cultural artisan collective |
| `4a305f36-3acb-4476-987a-8a0ed62ec246` | **SADA Internal Operations** | `one_off` | `active` | 0.000 | 0.000 | `24d88d6a-...` (Demo Admin) | Internal agency holding |
| `be178ac0-0cb6-444e-b02d-49bd64585266` | **Audit Luxury SARL** | `one_off` | `active` | 0.000 | 0.000 | Unassigned | Verification account |
| `6eaa6f51-38cd-4fce-aa83-b8b2dcbc1eda` | **Test Client 6vrn4 (OASYA)** | `monthly` | `active` | 0.000 | 0.000 | Unassigned | Retainer client |
| `d4c8782a-9518-4f74-9b58-a6109eb2ca4d` | **Test Client wcrpe (OASYA)** | `monthly` | `active` | 0.000 | 0.000 | Unassigned | Retainer client |
| `3088fdff-3d2c-4d31-b9e7-327f44e76d58` | **Test Client 0uiy2 (OASYA)** | `monthly` | `active` | 0.000 | 0.000 | Unassigned | Retainer client |
| `73ea9e96-730a-430e-9936-ee6610dbb23c` | **Test Client nh6y3 (OASYA)** | `monthly` | `active` | 0.000 | 0.000 | Unassigned | Retainer client |
| `127ab74f-937e-4d0d-bee5-961efcdaaee8` | **Test Client b5t46 (OASYA)** | `monthly` | `active` | 0.000 | 0.000 | Unassigned | Retainer client |
| `f975ab01-9aaa-49ae-9d4b-5f0cb65fe761` | **Test Client 37zy5 (OASYA)** | `monthly` | `active` | 0.000 | 0.000 | Unassigned | Retainer client |

### 3.2 Automated Test-Generated Fixtures (24 Records)

These 24 clients were created by automated test suites during previous development cycles:
- **`[ARCHIVED QA]` Clients (5 rows):** `bc1a45c7-...`, `874558a4-...`, `cdee5617-...`, `a03d9a49-...`, `46627d41-...` (Created by Phase 2 Client 360 automated test runs; properly isolated and archived).
- **`Phase D Client` (5 rows):** `bba1ee86-...`, `f4a0feb8-...`, `db2b21e2-...`, `250a8bb7-...`, `f760aebb-...` (Created during server-side authorization test runs).
- **`route 16` (3 rows):** `848976c1-...`, `73eab623-...`, `d5b411bf-...` (Created during task detail testing).
- **`Test Luxe Brand` (7 rows):** `a7c98966-...`, `0d2a3968-...`, `e7b3dacc-...`, `e2682c0e-...`, `d18cf85b-...`, `a8c88143-...`, etc.
- **`Audit Enterprise` (2 rows):** `6327b1a0-...`, `2989dc7a-...`
- **`Phase 10 Test Client` (1 row):** `a297564c-...`
- **`Test Client pkcjc / rvloh` (2 rows):** `506104a7-...`, `a581f55e-...`

Per the project safety guidelines, no test data will be deleted or altered without explicit user authorization. All reconciliation tests will run against isolated fixtures.

---

## 4. Financial OS Reconciliation Baseline

### Invoices Breakdown (`public.invoices`)
- **Total Billed:** `13,800.000 TND` across 6 invoices.
- **Total Paid:** `11,500.000 TND`.
- **Outstanding Balance:** `2,300.000 TND`.
  - Unpaid Invoice: `#INV-2026-004` (Amount: 2,300.000 TND, Paid: 0.000 TND, Status: `sent`, Due: 2026-10-31).
  - Fully Settled Invoices (5 rows): All have `status = 'paid'` and `paid_amount = total_amount`.

### Income Breakdown (`public.income_transactions`)
- **Total Income Received:** `14,500.000 TND` across 12 transactions.
- **Invoice Settlements:** 11,500.000 TND across 5 payments linked directly to invoices via `invoice_id`.
- **Unlinked Client Receipts:** 3,000.000 TND across 5 transactions without `invoice_id`.
- **Double-Counting Protection:** Client 360 formula `totalCollected = invoicePaidTotal + unlinkedIncomeTotal` correctly calculates `11,500 + 3,000 = 14,500 TND`, completely preventing invoice double-counting.

### Sponsoring Ad Campaigns (`public.sponsoring_campaigns`)
- **Total Campaigns:** 5 campaigns.
- **Column Schema:** Authoritative budget is `budget_tnd`, ad spend is `purchase_cost_tnd`, client charge is `client_charge_tnd`, and agency fee/margin is `margin_tnd`.
- **Expense Attribution:** Ad spend purchases are recorded in `public.expense_transactions` with descriptions like `"USD Ad Spend Purchase: Meta Ads (200$)"` (amount: 674.000 TND at 3.37 TND/USD).
- **Agency Margin:** Computed as `client_charge_tnd - purchase_cost_tnd` (4.00 TND/USD client rate vs ~3.37 purchase rate).

---

## 5. Identified Baseline Deficiencies & Risks

1. **Hardcoded Financial Fallbacks:**
   - In `admin.client-workspaces.$id.tsx` (lines 613, 1620, 1623): `Number(currentClient.monthly_package_price || currentClient.default_service_fee || 1500)`. When price is unset or 0, fallback to 1500 TND obscures data reality.
   - Line 616: `Number(currentClient.default_sponsoring_budget || 500)`. Fallback to 500 TND obscures unconfigured budgets.
   - Line 701 & `admin.client-workspaces.index.tsx` line 245: `const marginPercent = totalTopline > 0 ? (netProfit / totalTopline) * 100 : 50;`. Conceals zero-revenue clients by reporting an arbitrary 50% profit margin.
2. **Missing Client Relationship Owners:** 14 client records have `null` for both `relationship_owner_id` and `account_manager_id`.
3. **Missing Contact Emails:** 18 client records have `null` contact email.
4. **Column Mapping Inconsistencies:** In scripts and queries, confusing `monthly_retainer` (deprecated concept) with `monthly_package_price` or `default_service_fee`.
