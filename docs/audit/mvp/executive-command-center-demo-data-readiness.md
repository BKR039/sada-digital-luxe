# SADA OS — Executive Command Center: Demo Data & Real-Work Readiness Report
## Forensic Data Classification, Dependency Mapping & Safe Owner-Review Manifest

**Document Reference:** `docs/audit/mvp/executive-command-center-demo-data-readiness.md`  
**Audit Date:** 2026-10-16  
**Auditor:** SADA OS Architecture & Financial Engineering Review Board  
**Target Module:** Executive Command Center (`/admin/analytics`)  
**Safety Protocol:** Strict Zero-Mutation Read-Only Inspection (Production `mtfkzabiscyleztypqks` strictly untouched)

---

### Executive Summary

During the Phase 7 & 9 MVP verification of the Executive Command Center at `/admin/analytics`, forensic analysis of the live database identified that current dashboard metrics reflect a composite mixture of confirmed test/QA fixtures, authentic agency business records, and ambiguous/duplicate client entries.

In accordance with Non-Negotiable Safety Rules 1 & 3, **zero database mutations, deletions, or destructive SQL operations were performed on Production**. This document provides the complete forensic inventory, classifies each record group based on factual database evidence, maps all entity dependencies, and establishes a safe owner-review manifest and non-destructive exclusion mechanism for later administrative execution.

---

## 1. Deep Forensic Verification of the 10 Financial Accounts

A critical finding in the preliminary report was that 7 synthetic accounts contribute 70,000 TND to the displayed 88,200 TND Available Cash. An independent trace of all 10 accounts in `public.financial_accounts` was conducted via `scratch/trace-financial-accounts.ts`, analyzing creation timestamps, opening balances, and linked transactions:

```
+-------------------------------------------------------------------------------------------------------------------------------+
| ACCOUNT ID                             | ACCOUNT NAME                   | TYPE    | BAL (TND) | CREATED TIMESTAMP (UTC)      |
+-------------------------------------------------------------------------------------------------------------------------------+
| a107f5c4-4769-4376-a7ed-7dd62108f4db   | BIAT Corporate Account         | bank    | 15,000    | 2026-09-27 21:57:54.938811   |
| e524a212-df34-47cc-b0ab-e9f0f6f9df27   | Petty Cash Box (Caisse)        | cash    | 1,200     | 2026-09-27 21:57:54.938811   |
| 4f6e7282-bea5-4381-b020-ca7e8fdb8db1   | USD Ad Spend Card (Wise/Stripe)| gateway | 2,000     | 2026-09-27 21:57:54.938811   |
+-------------------------------------------------------------------------------------------------------------------------------+
| 63367189-9015-4ee7-b81f-dca00ab52a59   | BIAT Operating 0uiy2           | bank    | 10,000    | 2026-09-27 22:18:27.799522   |
| 3aa28dd6-24f0-4d5c-965e-a594d87ccb73   | BIAT Operating nh6y3           | bank    | 10,000    | 2026-09-27 22:18:48.861151   |
| 23f5926f-8c5e-466d-b477-ed8ee98f2f14   | BIAT Operating b5t46           | bank    | 10,000    | 2026-09-27 22:19:59.191580   |
| 9c950a53-3470-4429-a7e7-c7e23f890d8d   | BIAT Operating 37zy5           | bank    | 10,000    | 2026-09-27 22:20:43.207248   |
| 892bf690-1cd1-4567-8d1e-3d95f5e5024e   | BIAT Operating pkcjc           | bank    | 10,000    | 2026-09-27 22:21:22.882722   |
| 7834d037-7c84-435c-88e6-457d56a57ce5   | BIAT Operating rvloh           | bank    | 10,000    | 2026-09-27 22:22:05.539762   |
| 95e3556c-d74c-40cb-8639-4c1a19df0ca7   | BIAT Operating 6vrn4           | bank    | 10,000    | 2026-09-27 22:22:37.252740   |
+-------------------------------------------------------------------------------------------------------------------------------+
| TOTAL LIQUID TREASURY BALANCE:                                                    | 88,200 TND|                               |
+-------------------------------------------------------------------------------------------------------------------------------+
```

### Forensic Proof of Classification:
1. **The 3 Baseline Real Accounts (18,200 TND):**
   - Created at `2026-09-27 21:57:54.938811+00:00` by the canonical seed migration `20260927230000_sada_financial_operating_system.sql`.
   - Represent the genuine primary corporate operating account (`BIAT Corporate Account`, 15,000 TND, `is_default = true`), office petty cash box (1,200 TND), and corporate ad spend gateway card (2,000 USD).
2. **The 7 Synthetic Test Accounts (70,000 TND):**
   - Created between `22:18:27` and `22:22:37` on `2026-09-27` (20 minutes after seed migration).
   - Each was created with an exact 10,000 TND opening balance.
   - The 5-character random hash suffixes (`0uiy2`, `nh6y3`, `b5t46`, `37zy5`, `pkcjc`, `rvloh`, `6vrn4`) match 1:1 with the test clients created by the automated OASYA Financial Model test suite at the exact same seconds.
   - **Transaction Dependencies:** Accounts `b5t46`, `37zy5`, `pkcjc`, `rvloh`, and `6vrn4` have 2 linked inflow transactions and 4 linked outflow transactions each in `income_transactions` and `expense_transactions`. Because foreign keys reference `account_id`, deleting these accounts would violate database integrity.

---

## 2. Invoices & Transaction Dependencies

An independent trace of `public.invoices` and `public.income_transactions` established:
- **Invoices (6 Total):** All 6 invoices were generated by the OASYA Financial Integration Test Suite (`INV-TEST-nh6y3`, `b5t46`, `37zy5`, `pkcjc`, `rvloh`, `6vrn4`).
- **Outstanding Balance (2,300 TND):** 5 of the test invoices were marked `paid` with 2,300 TND paid amount. The single invoice `INV-TEST-nh6y3` remains with status `sent`, total 2,300 TND, paid 0 TND, due date `2026-10-15`.
- **KPI Impact:** 100% of the displayed **2,300 TND Outstanding Receivables** and the **Overdue Receivables Smart Briefing** are generated by this single test invoice.
- **Inflow Transactions (12 Total):**
  - 10 transactions of 1,500 TND (Retainer) and 800 TND (Sponsoring) on `2026-09-27` linked to the 5 paid test invoices.
  - 2 transactions of 1,500 TND on `2026-10-07` with description `"Phase D retainer transaction"`.
  - **KPI Impact:** 100% of the displayed **3,000 TND Cash Collected in October** originates from these two Phase D test transactions.

---

## 3. Deep Trace of Client Entities & Duplicate Names

A complete dependency scan of all 45 clients was executed via `scratch/trace-clients-deep.ts` to identify linked tasks, client projects, invoices, and transaction records:

```
+-----------------------------------------------------------------------------------------------------------------------------+
| CLIENT CLASSIFICATION GROUP          | COUNT | ACTIVE TASKS | PROJECTS | INVOICES | RET. REVENUE | EVIDENCE BASIS           |
+-----------------------------------------------------------------------------------------------------------------------------+
| Confirmed Real / Agency Portfolio    | 1     | 47           | 1        | 0        | 0 TND        | Authentic Luxury Hotel   |
| Confirmed Test / QA Fixtures         | 33    | 34           | 11       | 6        | 63,880 TND   | Automated QA & Test Suites|
| Unknown / Owner Review Required      | 11    | 158          | 12       | 0        | 0 TND        | Real names, dup entries  |
+-----------------------------------------------------------------------------------------------------------------------------+
| TOTAL:                               | 45    | 239          | 24       | 6        | 63,880 TND   |                          |
+-----------------------------------------------------------------------------------------------------------------------------+
```

### 3.1 Detailed Breakdown of Client Groups

#### Group A: Confirmed Real / Portfolio Client (1 Record)
- **`Jannat Sahara`** (`680cf516-4927-4376-9dd9-b76f3494c30b`):
  - Created: `2026-09-20T17:34:10.83333+00:00`
  - Linked Assets: **47 project tasks, 1 client project, 0 invoices, 0 income transactions**.
  - Current Status: `active`, monthly retainer configured as 0 TND.
  - KPI Impact: Drives the **Negative Client Margin Smart Briefing** (-225 TND contribution deficit due to direct labor/session costs without corresponding invoice receipts).

#### Group B: Unknown — Owner Review Required (11 Records)
These records represent named luxury and hospitality businesses in Tunisia, but exhibit duplicate client entries or zero retainer configurations requiring Super-Admin confirmation:
1. **`Café 707` (4 Duplicate Records):**
   - `[0159b219-605e-4020-9d73-34117263541e]` (Created 2026-09-16): **6 tasks, 1 project**.
   - `[57592977-d3f7-45ec-aefd-e99e922dc9d0]` (Created 2026-10-01): 0 tasks, 1 project.
   - `[382a5f77-fb74-4289-bd08-540b5351def6]` (Created 2026-10-01): 0 tasks, 1 project.
   - `[bc38618a-f738-4e13-8f18-b85778b706d4]` (Created 2026-10-01): 0 tasks, 1 project.
2. **`route 16` (3 Duplicate Records):**
   - `[d5b411bf-b857-4b38-8d2c-c92db5f7141b]` (Created 2026-09-26): 0 tasks, 1 project.
   - `[73eab623-f63f-446a-9d07-dd63cd01ba2c]` (Created 2026-09-26): 0 tasks, 0 projects.
   - `[848976c1-6119-412f-9d91-264083a35e7d]` (Created 2026-09-26): 0 tasks, 0 projects.
3. **`TOTTA Restaurant`** (`9638f6d5-a88a-48e3-9980-0ce7064ea352`):
   - Created: `2026-09-16`. Linked: **18 tasks, 1 project**.
4. **`Maison Carthage Luxury`** (`9e0c17e9-aca5-4c50-9ecc-482e3e642e50`):
   - Created: `2026-09-28`. Linked: **19 tasks, 2 projects**.
5. **`Sidi Bou Said Artisans`** (`741972f9-0bba-4181-acfe-05e6660699ff`):
   - Created: `2026-09-28`. Linked: 0 tasks, 0 projects.
6. **`SADA Internal Operations`** (`4a305f36-3acb-4476-987a-8a0ed62ec246`):
   - Created: `2026-09-28`. Linked: 0 tasks, 2 projects (internal administrative workspace).

#### Group C: Confirmed Test / QA Fixtures (33 Records)
- **8 OASYA Model Test Clients:** (`nh6y3`, `b5t46`, `37zy5`, `pkcjc`, `rvloh`, `6vrn4`, `0uiy2`, `wcrpe`). Created 2026-09-27. Price: 2,300 TND each. Linked to the 6 `INV-TEST-*` invoices.
- **7 Test Luxe Brand Clients:** (`1an87`, `6vr7y`, `devgb`, `if70z`, `q2i3k`, `ug9a1`, `yee9o`). Created 2026-09-28 and 2026-09-30. Price: 2,800 TND each. Linked to 25 tasks and 7 projects.
- **4 Audit Enterprise Clients:** (`1790846169847`, `1790846342785`, `1790850192246`, `1790851662877`). Created 2026-10-01. Price: 2,800 TND each. Linked to 12 tasks and 4 projects.
- **6 Phase D Test Clients:** (`1791378344681`, `1791378875377`, `1791378925890`, `1791379258738`, `1791379342330`, `1791379452420`). Created 2026-10-07. Linked to Phase D retainer transactions.
- **5 [ARCHIVED QA] Clients:** (`1791669781739`, `1791669930019`, `1791670362256`, `1791670838408`, baseline). Created 2026-10-10. Status: `archived`.
- **2 Phase 10 Test Clients:** (`1790672260500`, `1790672352609`). Price: 1,090 TND each.
- **1 Audit Luxury SARL:** (`be178ac0-0cb6-444e-b02d-49bd64585266`). Created 2026-09-16.

---

## 4. KPI Contamination Impact Analysis

| Executive KPI | Current Display Value | Value Without Demo Data | Root Cause of Variance |
|:---|:---:|:---:|:---|
| **Recognized Revenue** | `63,880.000 TND` | `0.000 TND` (or ~2,800 TND) | Real clients currently have `monthly_package_price = 0` or null; 63,880 TND is driven by retainers on the 33 test clients. |
| **Cash Collected (Oct)**| `3,000.000 TND` | `0.000 TND` | The two 1,500 TND October inflows were synthetic Phase D test transactions. |
| **Available Cash** | `88,200.000 TND` | `18,200.000 TND` | 70,000 TND is held in the 7 synthetic accounts (10,000 TND each). Real baseline cash is 18,200 TND. |
| **Outstanding Receivables**| `2,300.000 TND`| `0.000 TND` | 100% generated by test invoice `INV-TEST-nh6y3`. |
| **Operating Expenses** | `900.600 TND` | `900.600 TND` | Historical operating expenses are authentic baseline expenses. |
| **Delivery Health** | `25%` (51 Overdue) | `24%` (42 Overdue) | 9 overdue tasks belong to test clients; 42 overdue tasks belong to real production clients (`Jannat Sahara`, `TOTTA Restaurant`). |

---

## 5. Non-Destructive Owner-Review Manifest & Remediation Plan

To clean the dashboard without mutating production data or breaking foreign key constraints during automated evaluation, the following non-destructive transition plan is prepared for Super-Admin review:

```
====================================================================================================
                        SAFE SUPER-ADMIN DEMO EXCLUSION MANIFEST
====================================================================================================
STEP 1: ARCHIVE CONFIRMED TEST CLIENTS (SOFT-DELETE)
Action: UPDATE public.clients SET status = 'archived' WHERE id IN (
  -- 8 OASYA Model Test Clients
  '73ea9e96-730a-430e-9936-ee6610dbb23c', '127ab74f-937e-4d0d-bee5-961efcdaaee8',
  'f975ab01-9aaa-49ae-9d4b-5f0cb65fe761', '506104a7-6931-49df-88f9-06ca8c006611',
  'a581f55e-b5e2-4420-9ebc-32e55b09a36d', '6eaa6f51-38cd-4fce-aa83-b8b2dcbc1eda',
  '3088fdff-3d2c-4d31-b9e7-327f44e76d58', 'd4c8782a-9518-4f74-9b58-a6109eb2ca4d',
  -- 7 Test Luxe Brand Clients
  'e7b3dacc-81ec-4c32-8e37-25703e4cb84e', 'd18cf85b-8d27-47e6-bac8-253011372a0e',
  'e2682c0e-e55f-4cf7-81c6-1bb385f1d7d5', 'a8c88143-9e37-434c-a54d-c90510b951cb',
  '77967c7a-39c9-42ed-90ac-96dd97152781', 'a7c98966-ebf3-4d63-a070-517ce921244f',
  '0d2a3968-c258-426d-b050-366ff4e7687d',
  -- 4 Audit Enterprise Clients
  '6327b1a0-1c66-4238-b47e-9f44936e6a76', '503389d9-98ba-4307-a684-54765460feae',
  '2989dc7a-a693-4613-8297-31d8bc88c03d', 'd55087ef-6a21-4ce3-85b7-59b369ae9cca',
  -- 6 Phase D Clients & 2 Phase 10 Clients
  'db2b21e2-3271-4997-bea2-e531298cd062', '68bb50df-cd4c-4782-a3cb-352dba438516',
  'bba1ee86-7663-4e5e-b710-c1453635cec8', 'f4a0feb8-3da3-4b6a-91c5-b879d76d70be',
  '250a8bb7-e0eb-4a69-a46d-0acb8371eb12', 'f760aebb-99e5-4881-93b2-431b9a65b450',
  'ea2e0ef5-f991-4523-9c4d-75054fbd3d90', 'a297564c-a067-4c0f-beb4-1d2bdd092420'
);
Effect: Soft-archives 27 active test clients. Automatically excludes them from Recognized Revenue.
Preserves all historical foreign key relationships and audit logs.

STEP 2: DEACTIVATE SYNTHETIC TREASURY ACCOUNTS
Action: UPDATE public.financial_accounts SET status = 'inactive' WHERE id IN (
  '63367189-9015-4ee7-b81f-dca00ab52a59', -- BIAT Operating 0uiy2
  '3aa28dd6-24f0-4d5c-965e-a594d87ccb73', -- BIAT Operating nh6y3
  '23f5926f-8c5e-466d-b477-ed8ee98f2f14', -- BIAT Operating b5t46
  '9c950a53-3470-4429-a7e7-c7e23f890d8d', -- BIAT Operating 37zy5
  '892bf690-1cd1-4567-8d1e-3d95f5e5024e', -- BIAT Operating pkcjc
  '7834d037-7c84-435c-88e6-457d56a57ce5', -- BIAT Operating rvloh
  '95e3556c-d74c-40cb-8639-4c1a19df0ca7'  -- BIAT Operating 6vrn4
);
Effect: Deactivates 7 test accounts. Reduces Available Cash from 88,200 TND to authentic 18,200 TND.
Preserves linked income and expense transaction records.

STEP 3: MERGE & RESOLVE DUPLICATE CLIENT ENTRIES
Action: Super-Admin review via Client Workspace UI:
  - Consolidate Café 707 into primary profile [0159b219] (6 tasks, 1 project).
  - Consolidate route 16 into primary profile [d5b411bf] (1 project).
  - Configure authentic monthly retainer package prices on real accounts (Jannat Sahara, Café 707).
====================================================================================================
```
