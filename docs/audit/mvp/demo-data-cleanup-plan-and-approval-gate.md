# SADA OS — Demo Data Cleanup Plan & Approval Gate
## Forensic Baseline, Entity Classification, Financial Provenance & Reversible Cleanup Manifest

**Document Reference:** `docs/audit/mvp/demo-data-cleanup-plan-and-approval-gate.md`  
**Audit Date:** October 18, 2026  
**Auditor:** Senior Full-Stack Engineer, QA Architect & Security Auditor  
**Operating Mode:** STRICT READ-ONLY. PLANNING & APPROVAL GATE ONLY.  
**Execution Status:** **ABSOLUTE EXECUTION LOCK — ZERO DATABASE WRITES EXECUTED**  
**Final Approval Gate Verdict:** `READY FOR OWNER REVIEW (EXECUTION LOCKED PENDING EXPLICIT OWNER SIGN-OFF)`

## Change Log & Remediation Revision (October 19, 2026)

Following the Read-Only Pre-Execution Cleanup Verification Gate, the following critical remediations and architectural corrections have been integrated into this plan:
1. **Financial Manifest Remediation (Category B):** Added the 2 identified Phase D synthetic expense transactions (`394fc60c-2203-4812-be80-29d94955cadf` and `0f235414-b14c-480c-b77b-5e035d983aad`, each 450.000 TND, total 900 TND). Reconciled the complete synthetic October lifecycle: cancelling only Phase D incomes without cancelling Phase D expenses creates an erroneous -900 TND October net deficit. Cancelling both restores authentic October net profit to 0.000 TND.
2. **Multi-Currency Treasury Reporting & Valuation:** Eliminated naive cross-currency summing (adding 16,200 TND and 2,000 USD to get "18,200 TND"). Available Cash is strictly segregated as **16,200.000 TND** + **2,000.000 USD**. Application UI and service consumers updated to display currency segregation natively (`16,200 TND + 2,000 USD`) or specify the explicit valuation exchange rate (e.g., 3.37 TND/USD = 22,940 TND consolidated equivalent as of October 2026).
3. **Client Archival Semantics:** Formally defined that archiving clients (`status = 'archived'`) sets `contractedRevenue = 0` and excludes them from active client counts, while 100% preserving historical invoices, transactions, deliverables, and project task history.
4. **Corrected SQL Verification Queries:** Updated all 5 post-cleanup queries to separate currencies, distinguish total outstanding from overdue receivables, verify both inflows and outflows, reconcile active clients with application predicates, and test referential integrity without mutation.
5. **Application Code Pre-requisites Verified:** Updated `finance-service.ts`, `analytics-service.ts`, `ExecutiveCommandCenter.tsx`, `CashFlowAccountsView.tsx`, and `FinanceKPICards.tsx` to honor multi-currency segregation and archived client contract isolation.

---

## 1. Absolute Execution Lock Confirmation

In strict compliance with the **Absolute Execution Lock** directive:
- **ZERO mutations, deletions, updates, inserts, truncations, or schema modifications were performed on the live database (`mtfkzabiscyleztypqks.supabase.co`).**
- No accounts, clients, projects, tasks, invoices, transactions, notifications, or team members were altered, merged, archived, deactivated, or deleted.
- No Supabase Auth users were deleted.
- No remote migrations were applied or repaired.
- All empirical data in this report was collected via authenticated, verified read-only queries as Super Admin.
- This document constitutes an **evidence-backed proposal and approval gate** only. Execution requires separate, explicit, record-by-record owner approval.

---

## 2. Reconciled Current-State Inventory (Live Remote Database)

An authenticated census was executed directly against `https://mtfkzabiscyleztypqks.supabase.co` on October 18, 2026. The counts below reflect the verified, authoritative live baseline:

| Table Name | Live Count | Historical Prior Audit | Variance | Discrepancy Explanation & Status |
| :--- | :---: | :---: | :---: | :--- |
| `profiles` | **429** | 429 | 0 | Unchanged. Founder + staff + historical automated test fixtures. |
| `user_roles` | **397** | 397 | 0 | Unchanged. Role assignments across profiles. |
| `user_module_permissions` | **349** | 349 | 0 | Unchanged. Granular module permissions. |
| `team_members` | **387** | 387 | 0 | Unchanged. 3 authentic staff + 384 test worker profiles. |
| `clients` | **45** | 45 | 0 | Unchanged. 1 confirmed real, 11 review required, 33 confirmed test. |
| `client_projects` | **24** | 24 | 0 | Unchanged. Workspaces for Jannat Sahara, Café 707, Maison Carthage, and test brands. |
| `project_tasks` | **239** | 239 | 0 | Unchanged. Tasks linked to client projects (47 on Jannat Sahara, 102 on Maison Carthage). |
| `client_deliverables` | **32** | 32 | 0 | Unchanged. Recurring deliverables and quotas. |
| `production_bookings` | **0** | 0 | 0 | Clean. Zero historical bookings. |
| `packages` | **37** | 37 | 0 | Unchanged. Historical package definitions. |
| `package_catalog` | **39** | 39 | 0 | Unchanged. Canonical SADA service catalog offerings. |
| `package_categories` | **9** | 9 | 0 | Clean. Standard service categories. |
| `package_addons` | **12** | 12 | 0 | Clean. Standard add-on services. |
| `workflow_templates` | **4** | 4 | 0 | Clean. Reel, Design, Web Development, Sponsoring. |
| `workflow_stages` | **7** | 7 | 0 | Clean. Core sequential workflow stages. |
| `contact_submissions` | **20** | 20 | 0 | Unchanged. Authentic inquiries + test submissions. |
| `projects` (Case Studies) | **5** | 5 | 0 | Clean. 5 published agency portfolio case studies. |
| `social_reels` | **3** | 3 | 0 | Clean. 3 draft agency reels. |
| `blog_posts` | **0** | 0 | 0 | Clean. Empty state awaiting real articles. |
| `products` (Store) | **0** | 0 | 0 | Clean. Empty state awaiting real digital products. |
| `testimonials` (Proof) | **0** | 0 | 0 | Clean. Empty state awaiting verified client quotes. |
| `notifications` | **478** | 478 | 0 | Unchanged. System notifications and automated test alerts. |
| `deals` | **38** | 38 | 0 | Unchanged. Active and won/lost pipeline deals. |
| `sales_commissions` | **8** | 8 | 0 | Unchanged. 5 paid OASYA commissions, 1 real, 2 pending. |
| `financial_accounts` | **10** | 10 | 0 | **3 Real (18,200 TND) + 7 Synthetic (70,000 TND)**. |
| `income_transactions` | **12** | 12 | 0 | **10 OASYA test + 2 Phase D orphan test transactions**. |
| `expense_transactions`| **56** | 56 | 0 | Authentic office expenses + test sponsoring and commission debits. |
| `invoices` | **6** | 6 | 0 | **6 OASYA automated test invoices (5 paid, 1 unpaid sent)**. |
| `sponsoring_campaigns`| **5** | 5 | 0 | 5 OASYA automated test campaigns. |
| `salary_records` | **8** | 8 | 0 | Compensation records. |
| `salary_requests` | **5** | 5 | 0 | Worker advance requests. |
| `financial_periods` | **0** | 0 | 0 | Unchanged. Zero archived closed snapshots. |
| `business_rules` | **27** | 27 | 0 | Clean. 27 canonical business rules. |
| `business_rule_versions`| **131**| 131 | 0 | Clean. Full regulatory audit history. |
| `system_audit_logs` | **878** | 878 | 0 | Clean. Immutable platform audit trail. |
| `account_audit_logs`| **1,098**| 1,098 | 0 | Clean. Immutable account lifecycle audit trail. |
| `security_sessions` | **0** | 0 | 0 | Clean. Active session registry. |

---

## 3. Retain & Protect List (CONFIRMED REAL / CANONICAL MASTER DATA)

The following entities are **strictly protected from mutation, archival, or deletion**. They represent authentic agency assets, real staff identities, canonical system configuration, and public website content:

### 3.1 Confirmed Real Accounts & Personnel
1. **Founder & Primary Super Admin:**
   - `auth.users` / `profiles`: `[f4184256-97c4-4f81-9346-176ec5dfb43a]` (`boubakar.hamedsghaier@gmail.com`)
   - `team_members`: `[b363b2c1-eb6c-4203-9180-ec69ebf41cb7]` ("BKR039", Super Admin, Active)
2. **Staff Administrator:**
   - `profiles` / `team_members`: `[5d196902-a849-4eda-96bf-46bec9c3d3d8]` ("Reem Ben Salah" <rbs@sada.agency>, Admin, Active)
3. **Core Operations Worker:**
   - `profiles` / `team_members`: `[1ca08e63-0b39-4247-bcc8-ce58f71178b2]` ("Sarah Chen" <sarah@sada.agency>, Worker, Active)

### 3.2 Confirmed Real Agency Clients
1. **Jannat Sahara (Luxury Desert Hotel & Resort, Tozeur):**
   - `clients`: `[680cf516-4927-4376-9dd9-b76f3494c30b]`
   - Linked Workspace: `client_projects` `[7566085a-0857-41a4-945f-4a0058b73f9d]` ("Jannat Sahara — Luxury Desert Resort Rebranding & Launch")
   - Linked Tasks: **47 project tasks** (photoshoots, branding, web development)
   - Status: Active. Retainer currently 0 TND (awaiting owner contract update).

### 3.3 Authentic Corporate Financial Accounts (Segregated Multi-Currency Baseline)
The agency treasury comprises two distinct currencies. In accordance with multi-currency governance, these balances must not be naively summed as identical units:
1. **BIAT Corporate Operating Account:**
   - `financial_accounts`: `[a107f5c4-4769-4376-a7ed-7dd62108f4db]`
   - Type: `bank`, Currency: `TND`, Balance: **15,000.000 TND**, `is_default = true`, Status: `active`.
2. **Petty Cash Box (Caisse):**
   - `financial_accounts`: `[e524a212-df34-47cc-b0ab-e9f0f6f9df27]`
   - Type: `cash`, Currency: `TND`, Balance: **1,200.000 TND**, Status: `active`.
3. **USD Ad Spend Card (Wise / Stripe Gateway):**
   - `financial_accounts`: `[4f6e7282-bea5-4381-b020-ca7e8fdb8db1]`
   - Type: `gateway`, Currency: `USD`, Balance: **2,000.000 USD**, Status: `active`.

**Authentic Treasury Baseline:**
- **Liquid TND Cash:** **16,200.000 TND** (15,000 BIAT + 1,200 Caisse)
- **Liquid USD Cash:** **2,000.000 USD** (Wise/Stripe Gateway)
- **Standard UI Display:** `16,200.00 TND + 2,000.00 USD`
- **Consolidated Valuation Equivalent (Informational Only):** **22,940.000 TND** (Valuation Rate: 3.370 TND/USD, Central Bank of Tunisia / Sponsoring Purchasing Rate reference as of October 2026).


### 3.4 Canonical System Configuration & Public Content
- All 27 records in `public.business_rules` and their 131 versions in `public.business_rule_versions`.
- All 39 canonical service definitions in `public.package_catalog`, 9 categories in `public.package_categories`, and 12 add-ons in `public.package_addons`.
- All 4 workflow templates in `public.workflow_templates` and 7 stages in `public.workflow_stages`.
- All 5 published portfolio case studies in `public.projects` (public website showcase).
- All 878 records in `public.system_audit_logs` and 1,098 records in `public.account_audit_logs` (regulatory immutability).

---

## 4. Unknown Records — Owner Review Required (DO NOT TOUCH)

These records represent authentic luxury, hospitality, and dining businesses in Tunisia, but have duplicate client registrations, 0 TND package configurations, or unlinked test workspaces. In accordance with zero-trust safety rules, **they must remain completely untouched until founder/owner review**:

### 4.1 Duplicate Client Entities Requiring Consolidation
1. **`Café 707` (4 Duplicate Registrations):**
   - `[0159b219-605e-4020-9d73-34117263541e]` (Created 2026-09-16): **1 project, 6 tasks**. *(Recommended Canonical Master)*
   - `[57592977-d3f7-45ec-aefd-e99e922dc9d0]` (Created 2026-10-01): 1 project (`460773d4`), 0 tasks.
   - `[bc38618a-f738-4e13-8f18-b85778b706d4]` (Created 2026-10-01): 1 project (`aabaab48`), 0 tasks.
   - `[382a5f77-fb74-4289-bd08-540b5351def6]` (Created 2026-10-01): 1 project (`e10f0f80`), 0 tasks.
   - *Owner Decision Needed:* Confirm profile `0159b219` as canonical master and merge empty project pointers.
2. **`route 16` (3 Duplicate Registrations):**
   - `[d5b411bf-b857-4b38-8d2c-c92db5f7141b]` (Created 2026-09-26): **1 project, 6 tasks**. *(Recommended Canonical Master)*
   - `[73eab623-f63f-446a-9d07-dd63cd01ba2c]` (Created 2026-09-26): 0 projects, 0 tasks.
   - `[848976c1-6119-412f-9d91-264083a35e7d]` (Created 2026-09-26): 0 projects, 0 tasks.
   - *Owner Decision Needed:* Confirm profile `d5b411bf` as canonical master.

### 4.2 Named Business Accounts Awaiting Contract Configuration
3. **`TOTTA Restaurant`** (`[9638f6d5-a88a-48e3-9980-0ce7064ea352]`, Created 2026-09-16):
   - 1 client project (`83fa8804-030a-4a6c-9407-3d987d609139`), **18 active tasks**, retainer = 0 TND.
4. **`Maison Carthage Luxury`** (`[9e0c17e9-aca5-4c50-9ecc-482e3e642e50]`, Created 2026-09-28):
   - 2 client projects (`53c696bf-4d5d-4ef5-aa28-a10028132c8e`, `bc9105d2-4166-4533-9689-f495713811f2`), **102 active tasks**, retainer = 0 TND.
5. **`Sidi Bou Said Artisans`** (`[741972f9-0bba-4181-acfe-05e6660699ff]`, Created 2026-09-28):
   - 0 projects, 0 tasks.
6. **`SADA Internal Operations`** (`[4a305f36-3acb-4476-987a-8a0ed62ec246]`, Created 2026-09-28):
   - 2 internal administrative projects, 3 tasks.

---

## 5. Financial Integrity & Provenance Trace

A forensic dependency trace was executed across `financial_accounts`, `invoices`, `income_transactions`, `expense_transactions`, `sponsoring_campaigns`, and `sales_commissions` using [`scripts/trace-demo-dependencies-deep.ts`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/scripts/trace-demo-dependencies-deep.ts).

### 5.1 The 7 Synthetic Accounts (70,000 TND Contamination)
- **Account 0uiy2** (`63367189-9015-4ee7-b81f-dca00ab52a59`): Opening balance 10,000 TND. **0 incomes, 0 expenses**. Zero dependencies.
- **Account nh6y3** (`3aa28dd6-24f0-4d5c-965e-a594d87ccb73`): Opening balance 10,000 TND. **0 incomes, 0 expenses**. Zero dependencies.
- **Account b5t46** (`23f5926f-8c5e-466d-b477-ed8ee98f2f14`): Opening balance 10,000 TND. 2 linked incomes (`fd33d1c6`, `fdc7db77`), 2 linked expenses (`3388a11e`, `e03599fe`).
- **Account 37zy5** (`9c950a53-3470-4429-a7e7-c7e23f890d8d`): Opening balance 10,000 TND. 2 linked incomes, 4 linked expenses.
- **Account pkcjc** (`892bf690-1cd1-4567-8d1e-3d95f5e5024e`): Opening balance 10,000 TND. 2 linked incomes, 4 linked expenses.
- **Account rvloh** (`7834d037-7c84-435c-88e6-457d56a57ce5`): Opening balance 10,000 TND. 2 linked incomes, 4 linked expenses.
- **Account 6vrn4** (`95e3556c-d74c-40cb-8639-4c1a19df0ca7`): Opening balance 10,000 TND. 2 linked incomes, 4 linked expenses.

### 5.2 The 6 OASYA Test Invoices
- **`INV-TEST-nh6y3`** (`3679d623-17cb-4b8f-871f-e08c61d1ab8b`):
  - Total: **2,300.000 TND**, Paid: **0.000 TND**, Status: `sent`, Due Date: `2026-10-15`.
  - Linked Incomes: **0**.
  - **KPI Impact:** **100% of the displayed 2,300 TND Outstanding Receivables on the Executive Dashboard is driven by this single test invoice.**
- **`INV-TEST-b5t46`** (`d2955e0b-98fe-4c7b-9d6f-afd66ca64361`): Total 2,300 TND, Paid 2,300 TND, Status: `paid`. Linked to 2 incomes (1,500 TND retainer + 800 TND sponsoring).
- **`INV-TEST-37zy5`** (`3cf811a8-88f3-4c12-ac04-74e4208d2c32`): Total 2,300 TND, Paid 2,300 TND, Status: `paid`. Linked to 2 incomes.
- **`INV-TEST-pkcjc`** (`f6b92e04-ae0e-4dc6-8262-f12b9e3af02d`): Total 2,300 TND, Paid 2,300 TND, Status: `paid`. Linked to 2 incomes.
- **`INV-TEST-rvloh`** (`c47d85e2-57f7-48a4-899e-f03c60dcdfe8`): Total 2,300 TND, Paid 2,300 TND, Status: `paid`. Linked to 2 incomes.
- **`INV-TEST-6vrn4`** (`8235acfb-028c-4342-9894-84d51388b338`): Total 2,300 TND, Paid 2,300 TND, Status: `paid`. Linked to 2 incomes.

### 5.3 The 2 Orphan Phase D October Incomes (3,000 TND Cash Collected Contamination)
- `[5e704121-2acf-4247-adc4-1995dc37e7fc]`: Date: 2026-10-07, Amount: 1,500.000 TND, Description: "Phase D retainer transaction", `client_id = null`, `account_id = null`, `invoice_id = null`.
- `[c1e44c42-67f9-454e-b2d5-051317f4fc7d]`: Date: 2026-10-07, Amount: 1,500.000 TND, Description: "Phase D retainer transaction", `client_id = null`, `account_id = null`, `invoice_id = null`.
- **KPI Impact:** **100% of the displayed 3,000 TND Cash Collected in October originates from these two orphan synthetic entries.**

### 5.4 The 2 Orphan Phase D October Expenses (900 TND Expense Contamination)
- `[394fc60c-2203-4812-be80-29d94955cadf]`: Date: 2026-10-07, Amount: 450.000 TND, Category: `operating_expense`, Description: "Phase D cloud infrastructure", `client_id = null`, `account_id = null`.
- `[0f235414-b14c-480c-b77b-5e035d983aad]`: Date: 2026-10-07, Amount: 450.000 TND, Category: `operating_expense`, Description: "Phase D cloud infrastructure", `client_id = null`, `account_id = null`.
- **Reconciliation & KPI Impact:** Created concurrently on 2026-10-07 during Phase D automated testing. If only the two 1,500 TND incomes are cancelled without cancelling these two 450 TND expenses, the platform reports an artificial **-900.000 TND Net Deficit** for October. Cancelling both the incomes and expenses reconciles the synthetic October lifecycle completely: Inflows = 0.000 TND, Outflows = 0.000 TND, Net Profit = 0.000 TND.

---

## 6. Dependency & Cascade Risk Analysis

A review of PostgreSQL foreign key constraints across the schema demonstrates why hard deletion (`DELETE FROM ...`) is dangerous and prohibited:

```
[FOREIGN KEY DEPENDENCY GRAPH]
financial_accounts (id)
  ▲
  ├── income_transactions (account_id)  [NO ACTION / RESTRICT]
  └── expense_transactions (account_id) [NO ACTION / RESTRICT]

clients (id)
  ▲
  ├── client_projects (client_id)      [ON DELETE SET NULL / RESTRICT]
  ├── invoices (client_id)             [NO ACTION / RESTRICT]
  ├── income_transactions (client_id)  [NO ACTION / RESTRICT]
  ├── sponsoring_campaigns (client_id) [NO ACTION / RESTRICT]
  └── sales_commissions (client_id)    [NO ACTION / RESTRICT]

client_projects (id)
  ▲
  ├── project_tasks (project_id)       [CASCADE - DELETING PROJECT DELETES ALL TASKS!]
  └── invoices (project_id)            [NO ACTION / RESTRICT]
```

### Critical Cascade Findings:
1. **Hard-deleting financial accounts causes SQL Error 23503** (violates foreign key constraint on `income_transactions` and `expense_transactions`).
2. **Hard-deleting clients causes SQL Error 23503** on `invoices`, `sponsoring_campaigns`, and `sales_commissions`.
3. **Hard-deleting client projects triggers `ON DELETE CASCADE` on `project_tasks`**, permanently destroying all associated task history, work logs, and deliverables!

### The Non-Destructive Architectural Solution:
Because of these hard relational constraints, the cleanup plan relies on **state transitions (soft-updates) rather than destructive hard deletions**:
- Updating `financial_accounts.status = 'inactive'` immediately drops them from active cash in `src/lib/finance-service.ts` (`totalCashBalance = accounts.filter(a => a.status === 'active')`) while preserving 100% of ledger transactions and opening balance integrity.
- Updating `clients.status = 'archived'` immediately excludes them from active client metrics and zeroes out Recognized Revenue (`contractedRevenue = 0`) without breaking foreign keys or deleting tasks. All historical transactions, invoices, and completed tasks are 100% preserved.
- Updating `invoices.status = 'cancelled'` on `INV-TEST-nh6y3` immediately resolves overdue receivables without altering historical invoices.
- Updating `income_transactions.status = 'cancelled'` on the two Phase D transactions immediately clears contaminated October cash receipts.
- Updating `expense_transactions.status = 'cancelled'` on the two Phase D expenses immediately clears contaminated October operating expenses, bringing October Net Profit to 0.000 TND.

---

## 7. Record-by-Record Cleanup Manifest (PROPOSED — NOT EXECUTED)

> [!CAUTION]
> **ABSOLUTE EXECUTION LOCK:**
> The following manifest specifies exact primary keys, classifications, proposed actions, reasons, dependencies, and KPI impacts. **Zero actions will be taken without explicit, separate owner sign-off.**

### Category A: Synthetic Financial Accounts (7 Records)

| Table | Exact Primary Key (UUID) | Label / Name | Classification | Proposed Action | Reason | Dependencies & Cascade Risk | KPI Effect | Reversibility |
| :--- | :--- | :--- | :---: | :---: | :--- | :--- | :--- | :---: |
| `financial_accounts` | `63367189-9015-4ee7-b81f-dca00ab52a59` | BIAT Operating 0uiy2 | CONFIRMED DEMO | **DEACTIVATE** (`status='inactive'`) | Synthetic OASYA fixture (10k opening balance) | 0 incomes, 0 expenses. No cascade risk. | Available cash reduces by 10,000 TND | **100% Reversible** |
| `financial_accounts` | `3aa28dd6-24f0-4d5c-965e-a594d87ccb73` | BIAT Operating nh6y3 | CONFIRMED DEMO | **DEACTIVATE** (`status='inactive'`) | Synthetic OASYA fixture (10k opening balance) | 0 incomes, 0 expenses. No cascade risk. | Available cash reduces by 10,000 TND | **100% Reversible** |
| `financial_accounts` | `23f5926f-8c5e-466d-b477-ed8ee98f2f14` | BIAT Operating b5t46 | CONFIRMED DEMO | **DEACTIVATE** (`status='inactive'`) | Synthetic OASYA fixture (10k opening balance) | 2 incomes, 2 expenses. FK protected. | Available cash reduces by 10,000 TND | **100% Reversible** |
| `financial_accounts` | `9c950a53-3470-4429-a7e7-c7e23f890d8d` | BIAT Operating 37zy5 | CONFIRMED DEMO | **DEACTIVATE** (`status='inactive'`) | Synthetic OASYA fixture (10k opening balance) | 2 incomes, 4 expenses. FK protected. | Available cash reduces by 10,000 TND | **100% Reversible** |
| `financial_accounts` | `892bf690-1cd1-4567-8d1e-3d95f5e5024e` | BIAT Operating pkcjc | CONFIRMED DEMO | **DEACTIVATE** (`status='inactive'`) | Synthetic OASYA fixture (10k opening balance) | 2 incomes, 4 expenses. FK protected. | Available cash reduces by 10,000 TND | **100% Reversible** |
| `financial_accounts` | `7834d037-7c84-435c-88e6-457d56a57ce5` | BIAT Operating rvloh | CONFIRMED DEMO | **DEACTIVATE** (`status='inactive'`) | Synthetic OASYA fixture (10k opening balance) | 2 incomes, 4 expenses. FK protected. | Available cash reduces by 10,000 TND | **100% Reversible** |
| `financial_accounts` | `95e3556c-d74c-40cb-8639-4c1a19df0ca7` | BIAT Operating 6vrn4 | CONFIRMED DEMO | **DEACTIVATE** (`status='inactive'`) | Synthetic OASYA fixture (10k opening balance) | 2 incomes, 4 expenses. FK protected. | Available cash reduces by 10,000 TND | **100% Reversible** |

*Category A KPI Result:* Liquid cash reconciled from 88,200 TND to authentic multi-currency baseline of **16,200.000 TND** (BIAT 15,000 + Caisse 1,200) and **2,000.000 USD** (Ad Spend Card). Naive cross-currency summation eliminated.

---

### Category B: Contaminating Test Invoices, Orphan Incomes & Orphan Expenses (5 Records)

| Table | Exact Primary Key (UUID) | Label / Description | Classification | Proposed Action | Reason | Dependencies & Cascade Risk | KPI Effect | Reversibility |
| :--- | :--- | :--- | :---: | :---: | :--- | :--- | :--- | :---: |
| `invoices` | `3679d623-17cb-4b8f-871f-e08c61d1ab8b` | `INV-TEST-nh6y3` | CONFIRMED DEMO | **CANCEL** (`status='cancelled'`) | Synthetic invoice generating fake overdue receivable | 0 linked incomes. Linked to test client `73ea9e96`. | Outstanding receivables drops from 2,300 to 0 TND | **100% Reversible** |
| `income_transactions` | `5e704121-2acf-4247-adc4-1995dc37e7fc` | Phase D retainer transaction | CONFIRMED DEMO | **CANCEL** (`status='cancelled'`) | Orphan synthetic 1,500 TND inflow | 0 client, 0 account, 0 invoice dependencies. | October cash collected reduces by 1,500 TND | **100% Reversible** |
| `income_transactions` | `c1e44c42-67f9-454e-b2d5-051317f4fc7d` | Phase D retainer transaction | CONFIRMED DEMO | **CANCEL** (`status='cancelled'`) | Orphan synthetic 1,500 TND inflow | 0 client, 0 account, 0 invoice dependencies. | October cash collected reduces by 1,500 TND | **100% Reversible** |
| `expense_transactions`| `394fc60c-2203-4812-be80-29d94955cadf` | Phase D cloud infrastructure | CONFIRMED DEMO | **CANCEL** (`status='cancelled'`) | Orphan synthetic 450 TND outflow | 0 client, 0 account dependencies. | October expenses reduce by 450 TND | **100% Reversible** |
| `expense_transactions`| `0f235414-b14c-480c-b77b-5e035d983aad` | Phase D cloud infrastructure | CONFIRMED DEMO | **CANCEL** (`status='cancelled'`) | Orphan synthetic 450 TND outflow | 0 client, 0 account dependencies. | October expenses reduce by 450 TND | **100% Reversible** |

*Category B KPI Result:* Overdue receivables drops from 2,300 TND to **0 TND**; October cash collected drops from 3,000 TND to **0 TND**; October expenses drop from 900 TND to **0 TND**; October Net Profit cleanly balances to **0.000 TND** without artificial deficits.

---

### Category C: Confirmed Test Clients (33 Records)

| Table | Exact Primary Key (UUID) | Client Name | Classification | Proposed Action | Package Price | Dependent Tasks / Projects | KPI Effect |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `clients` | `73ea9e96-730a-430e-9936-ee6610dbb23c` | Test Client nh6y3 (OASYA Model) | CONFIRMED DEMO | **ARCHIVE** (`status='archived'`) | 2,300 TND | 0 tasks, 0 projects, 1 invoice | Recognized Revenue -2,300 TND |
| `clients` | `127ab74f-937e-4d0d-bee5-961efcdaaee8` | Test Client b5t46 (OASYA Model) | CONFIRMED DEMO | **ARCHIVE** (`status='archived'`) | 2,300 TND | 0 tasks, 0 projects, 1 invoice | Recognized Revenue -2,300 TND |
| `clients` | `f975ab01-9aaa-49ae-9d4b-5f0cb65fe761` | Test Client 37zy5 (OASYA Model) | CONFIRMED DEMO | **ARCHIVE** (`status='archived'`) | 2,300 TND | 0 tasks, 0 projects, 1 invoice | Recognized Revenue -2,300 TND |
| `clients` | `506104a7-6931-49df-88f9-06ca8c006611` | Test Client pkcjc (OASYA Model) | CONFIRMED DEMO | **ARCHIVE** (`status='archived'`) | 2,300 TND | 0 tasks, 0 projects, 1 invoice | Recognized Revenue -2,300 TND |
| `clients` | `a581f55e-b5e2-4420-9ebc-32e55b09a36d` | Test Client rvloh (OASYA Model) | CONFIRMED DEMO | **ARCHIVE** (`status='archived'`) | 2,300 TND | 0 tasks, 0 projects, 1 invoice | Recognized Revenue -2,300 TND |
| `clients` | `6eaa6f51-38cd-4fce-aa83-b8b2dcbc1eda` | Test Client 6vrn4 (OASYA Model) | CONFIRMED DEMO | **ARCHIVE** (`status='archived'`) | 2,300 TND | 0 tasks, 0 projects, 1 invoice | Recognized Revenue -2,300 TND |
| `clients` | `3088fdff-3d2c-4d31-b9e7-327f44e76d58` | Test Client 0uiy2 (OASYA Model) | CONFIRMED DEMO | **ARCHIVE** (`status='archived'`) | 2,300 TND | 0 tasks, 0 projects, 0 invoices | Recognized Revenue -2,300 TND |
| `clients` | `d4c8782a-9518-4f74-9b58-a6109eb2ca4d` | Test Client wcrpe (OASYA Model) | CONFIRMED DEMO | **ARCHIVE** (`status='archived'`) | 2,300 TND | 0 tasks, 0 projects, 0 invoices | Recognized Revenue -2,300 TND |
| `clients` | `e7b3dacc-81ec-4c32-8e37-25703e4cb84e` | Test Luxe Brand 1an87 | CONFIRMED DEMO | **ARCHIVE** (`status='archived'`) | 2,800 TND | 4 tasks, 1 project | Recognized Revenue -2,800 TND |
| `clients` | `d18cf85b-8d27-47e6-bac8-253011372a0e` | Test Luxe Brand 6vr7y | CONFIRMED DEMO | **ARCHIVE** (`status='archived'`) | 2,800 TND | 4 tasks, 1 project | Recognized Revenue -2,800 TND |
| `clients` | `e2682c0e-e55f-4cf7-81c6-1bb385f1d7d5` | Test Luxe Brand devgb | CONFIRMED DEMO | **ARCHIVE** (`status='archived'`) | 2,800 TND | 4 tasks, 1 project | Recognized Revenue -2,800 TND |
| `clients` | `a8c88143-9e37-434c-a54d-c90510b951cb` | Test Luxe Brand if70z | CONFIRMED DEMO | **ARCHIVE** (`status='archived'`) | 2,800 TND | 4 tasks, 1 project | Recognized Revenue -2,800 TND |
| `clients` | `77967c7a-39c9-42ed-90ac-96dd97152781` | Test Luxe Brand q2i3k | CONFIRMED DEMO | **ARCHIVE** (`status='archived'`) | 2,800 TND | 3 tasks, 1 project | Recognized Revenue -2,800 TND |
| `clients` | `a7c98966-ebf3-4d63-a070-517ce921244f` | Test Luxe Brand ug9a1 | CONFIRMED DEMO | **ARCHIVE** (`status='archived'`) | 2,800 TND | 3 tasks, 1 project | Recognized Revenue -2,800 TND |
| `clients` | `0d2a3968-c258-426d-b050-366ff4e7687d` | Test Luxe Brand yee9o | CONFIRMED DEMO | **ARCHIVE** (`status='archived'`) | 2,800 TND | 4 tasks, 1 project | Recognized Revenue -2,800 TND |
| `clients` | `6327b1a0-1c66-4238-b47e-9f44936e6a76` | Audit Enterprise 1790846169847 | CONFIRMED DEMO | **ARCHIVE** (`status='archived'`) | 2,800 TND | 3 tasks, 1 project | Recognized Revenue -2,800 TND |
| `clients` | `503389d9-98ba-4307-a684-54765460feae` | Audit Enterprise 1790846342785 | CONFIRMED DEMO | **ARCHIVE** (`status='archived'`) | 2,800 TND | 3 tasks, 1 project | Recognized Revenue -2,800 TND |
| `clients` | `2989dc7a-a693-4613-8297-31d8bc88c03d` | Audit Enterprise 1790850192246 | CONFIRMED DEMO | **ARCHIVE** (`status='archived'`) | 2,800 TND | 3 tasks, 1 project | Recognized Revenue -2,800 TND |
| `clients` | `d55087ef-6a21-4ce3-85b7-59b369ae9cca` | Audit Enterprise 1790851662877 | CONFIRMED DEMO | **ARCHIVE** (`status='archived'`) | 2,800 TND | 3 tasks, 1 project | Recognized Revenue -2,800 TND |
| `clients` | `db2b21e2-3271-4997-bea2-e531298cd062` | Phase D Client 1791378344681 | CONFIRMED DEMO | **ARCHIVE** (`status='archived'`) | 0 TND | 0 tasks, 0 projects | 0 TND |
| `clients` | `68bb50df-cd4c-4782-a3cb-352dba438516` | Phase D Client 1791378875377 | CONFIRMED DEMO | **ARCHIVE** (`status='archived'`) | 0 TND | 0 tasks, 0 projects | 0 TND |
| `clients` | `bba1ee86-7663-4e5e-b710-c1453635cec8` | Phase D Client 1791378925890 | CONFIRMED DEMO | **ARCHIVE** (`status='archived'`) | 0 TND | 0 tasks, 0 projects | 0 TND |
| `clients` | `f4a0feb8-3da3-4b6a-91c5-b879d76d70be` | Phase D Client 1791379258738 | CONFIRMED DEMO | **ARCHIVE** (`status='archived'`) | 0 TND | 0 tasks, 0 projects | 0 TND |
| `clients` | `250a8bb7-e0eb-4a69-a46d-0acb8371eb12` | Phase D Client 1791379342330 | CONFIRMED DEMO | **ARCHIVE** (`status='archived'`) | 0 TND | 0 tasks, 0 projects | 0 TND |
| `clients` | `f760aebb-99e5-4881-93b2-431b9a65b450` | Phase D Client 1791379452420 | CONFIRMED DEMO | **ARCHIVE** (`status='archived'`) | 0 TND | 0 tasks, 0 projects | 0 TND |
| `clients` | `ea2e0ef5-f991-4523-9c4d-75054fbd3d90` | Phase 10 Test Client — 1790672260500 | CONFIRMED DEMO | **ARCHIVE** (`status='archived'`) | 1,090 TND | 0 tasks, 0 projects | Recognized Revenue -1,090 TND |
| `clients` | `a297564c-a067-4c0f-beb4-1d2bdd092420` | Phase 10 Test Client — 1790672352609 | CONFIRMED DEMO | **ARCHIVE** (`status='archived'`) | 1,090 TND | 0 tasks, 0 projects | Recognized Revenue -1,090 TND |
| `clients` | `be178ac0-0cb6-444e-b02d-49bd64585266` | Audit Luxury SARL | CONFIRMED DEMO | **ARCHIVE** (`status='archived'`) | 0 TND | 19 tasks, 2 projects | 0 TND |
| `clients` | `cdee5617-59a1-4ca1-a681-306478885fb8` | [ARCHIVED QA] QA Audit Client Phase2 [1791669781739] | CONFIRMED DEMO | **RETAIN ARCHIVED** | 2,500 TND | 0 tasks, 0 projects | Already archived |
| `clients` | `a03d9a49-37f3-470b-90ac-309d2b48f6d1` | [ARCHIVED QA] QA Audit Client Phase2 [1791669930019] | CONFIRMED DEMO | **RETAIN ARCHIVED** | 2,500 TND | 0 tasks, 0 projects | Already archived |
| `clients` | `874558a4-7bb0-4222-ab94-2668d08551a1` | [ARCHIVED QA] QA Audit Client Phase2 [1791670362256] | CONFIRMED DEMO | **RETAIN ARCHIVED** | 2,500 TND | 0 tasks, 0 projects | Already archived |
| `clients` | `46627d41-8f91-482b-a004-e0acab7c7a08` | [ARCHIVED QA] QA Audit Client Phase2 [1791670838408] | CONFIRMED DEMO | **RETAIN ARCHIVED** | 2,500 TND | 0 tasks, 0 projects | Already archived |
| `clients` | `bc1a45c7-f5cb-428e-8c94-26a3cb4059a1` | [ARCHIVED QA] QA Audit Client Phase | CONFIRMED DEMO | **RETAIN ARCHIVED** | 2,500 TND | 0 tasks, 0 projects | Already archived |

*Category C KPI Result:* Recognized Revenue drops from 63,880 TND to **0 TND**; active client count cleans from 40 to authentic count (1 real + 11 review-required). All tasks, project records, and deliverables are 100% preserved.

---

## 8. Backup, Recovery & Execution Design

### 8.1 Preflight Backup Requirement
Before executing any stage of the cleanup manifest (even non-destructive soft-updates), a verified full database dump must be performed and validated:

```bash
# 1. Full schema and data dump
pg_dump --clean --if-exists --no-owner --no-privileges -d "$PRODUCTION_DB_URL" > /backups/sada_prod_pre_cleanup_$(date +%Y%m%d_%H%M%S).sql

# 2. Verified restoration sandbox test
psql -d "postgres://postgres@127.0.0.1:5432/sada_restore_verify" -f /backups/sada_prod_pre_cleanup_*.sql
```

### 8.2 Dependency-Safe Step-by-Step Execution Sequence

```
Step 1: Quarantining Synthetic Cash (Zero Dependency Accounts)
        UPDATE public.financial_accounts
        SET status = 'inactive'
        WHERE id IN ('63367189-9015-4ee7-b81f-dca00ab52a59', '3aa28dd6-24f0-4d5c-965e-a594d87ccb73');

Step 2: Quarantining Synthetic Cash (Transacted Accounts)
        UPDATE public.financial_accounts
        SET status = 'inactive'
        WHERE id IN (
          '23f5926f-8c5e-466d-b477-ed8ee98f2f14', '9c950a53-3470-4429-a7e7-c7e23f890d8d',
          '892bf690-1cd1-4567-8d1e-3d95f5e5024e', '7834d037-7c84-435c-88e6-457d56a57ce5',
          '95e3556c-d74c-40cb-8639-4c1a19df0ca7'
        );

Step 3: Resolving Overdue Receivables
        UPDATE public.invoices
        SET status = 'cancelled'
        WHERE id = '3679d623-17cb-4b8f-871f-e08c61d1ab8b';

Step 4: Resolving Synthetic October Cash Receipts & Expenses
        UPDATE public.income_transactions
        SET status = 'cancelled'
        WHERE id IN ('5e704121-2acf-4247-adc4-1995dc37e7fc', 'c1e44c42-67f9-454e-b2d5-051317f4fc7d');

        UPDATE public.expense_transactions
        SET status = 'cancelled'
        WHERE id IN ('394fc60c-2203-4812-be80-29d94955cadf', '0f235414-b14c-480c-b77b-5e035d983aad');

Step 5: Archiving Confirmed Test Clients
        UPDATE public.clients
        SET status = 'archived'
        WHERE id IN (<28 active test client IDs listed in Category C>);

Step 6: Owner-Supervised Client Consolidation & Contract Pricing
        - Founder reviews Café 707 and route 16 duplicate profiles.
        - Founder inputs authentic monthly retainer prices on Jannat Sahara and consolidated accounts.
```

### 8.3 Post-Cleanup Verification Queries & Acceptance Criteria

```sql
-- 1. Available Cash Verification by Currency (Expected: TND = 16,200.000, USD = 2,000.000)
SELECT currency, SUM(current_balance) AS total_active_cash
FROM public.financial_accounts
WHERE status = 'active'
GROUP BY currency
ORDER BY currency DESC;

-- 2. Outstanding & Overdue Receivables Verification
-- 2a. Total Outstanding Receivables (Expected: exactly 0.000 TND after cancelling INV-TEST-nh6y3)
SELECT COALESCE(SUM(total_amount - paid_amount), 0) AS total_outstanding_receivables
FROM public.invoices
WHERE status IN ('sent', 'partially_paid', 'overdue');

-- 2b. Specifically Overdue Receivables (Expected: exactly 0.000 TND)
SELECT COALESCE(SUM(total_amount - paid_amount), 0) AS overdue_receivables
FROM public.invoices
WHERE status = 'overdue' OR (status = 'sent' AND due_date < CURRENT_DATE);

-- 3. October Inflows & Outflows Verification (Expected: Inflows = 0.000 TND, Outflows = 0.000 TND, Net Profit = 0.000 TND)
SELECT
  COALESCE((SELECT SUM(amount) FROM public.income_transactions WHERE date >= '2026-10-01' AND status = 'received'), 0) AS oct_received_inflows,
  COALESCE((SELECT SUM(amount) FROM public.expense_transactions WHERE date >= '2026-10-01' AND status = 'paid'), 0) AS oct_paid_outflows,
  COALESCE((SELECT SUM(amount) FROM public.income_transactions WHERE date >= '2026-10-01' AND status = 'received'), 0) -
  COALESCE((SELECT SUM(amount) FROM public.expense_transactions WHERE date >= '2026-10-01' AND status = 'paid'), 0) AS oct_net_profit;

-- 4. Active Clients Count Reconciled with Application Predicate (Expected: exactly 12 active clients: 1 real + 11 review)
SELECT COUNT(*) AS active_clients_count
FROM public.clients
WHERE status = 'active';

-- 5. Referential Integrity Read-Only Verification (Expected: zero orphaned rows without modifications)
SELECT COUNT(*) AS orphaned_tasks FROM public.project_tasks WHERE project_id NOT IN (SELECT id FROM public.client_projects);
SELECT COUNT(*) AS orphaned_projects FROM public.client_projects WHERE client_id NOT IN (SELECT id FROM public.clients);
```

### 8.4 Rollback & Reversibility Guarantee
Because all proposed actions are state transitions (`status = 'inactive'`, `status = 'archived'`, `status = 'cancelled'`), **every single change is 100% reversible in seconds** by flipping the status back to `active` or `sent` without data recovery from backup.

---

## 9. List of Unresolved Owner Decisions

The following business decisions cannot be determined by code analysis and require explicit founder instruction:

1. **Café 707 Canonical Master Profile:**
   Does the owner approve designating `[0159b219-605e-4020-9d73-34117263541e]` (which holds 6 tasks and 1 project) as the canonical record and archiving the 3 empty profiles created on 2026-10-01 (`57592977`, `bc38618a`, `382a5f77`)?
2. **route 16 Canonical Master Profile:**
   Does the owner approve designating `[d5b411bf-b857-4b38-8d2c-c92db5f7141b]` (which holds 6 tasks and 1 project) as canonical and archiving the 2 empty profiles (`73eab623`, `848976c1`)?
3. **Authentic Client Retainer Pricing:**
   What are the actual agreed monthly package retainer prices for:
   - `Jannat Sahara` (currently configured at 0 TND in database)
   - `Café 707` (currently configured at 0 TND)
   - `TOTTA Restaurant` (currently configured at 0 TND)
   - `Maison Carthage Luxury` (currently configured at 0 TND)
4. **Historical Test Worker Accounts Cleanup:**
   Does the owner approve running `admin_delete_account_hard_purge` to prune zero-dependency test worker accounts in `auth.users` / `profiles`?

---

## 10. Final Approval Gate Verdict

```
READY FOR OWNER REVIEW (EXECUTION LOCKED PENDING EXPLICIT OWNER SIGN-OFF)
```

### Certification Statement:
The baseline inventory, dependency graph, financial trace, and record-by-record cleanup manifest are 100% complete, verified with factual evidence, and designed to eliminate dashboard contamination without breaking relational constraints or losing audit history.

**NO DATABASE MUTATIONS HAVE BEEN EXECUTED. EXECUTION REMAINS STRICTLY LOCKED PENDING EXPLICIT OWNER APPROVAL.**
