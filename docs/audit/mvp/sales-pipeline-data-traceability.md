# SADA OS — Sales Pipeline Data Traceability & Ground Truth Matrix

## 1. Executive Summary

This matrix establishes the complete end-to-end data traceability from every visual KPI, metric card, stage column, commission row, and performance metric on the **Sales Pipeline** (`/admin/sales`) to its authoritative PostgreSQL table, column, aggregation logic, and cross-module reconciliation path.

---

## 2. KPI Cards & Metric Traceability

| UI Metric Display | Visual Label | Authoritative Source Table & Column | Filter & Aggregation Logic | Reconciliation Target |
| :--- | :--- | :--- | :--- | :--- |
| **KPI 1: Pipeline Value** | Active Pipeline Value | `public.deals.deal_value` | `SUM(deal_value)` WHERE `stage NOT IN ('won', 'lost')`<br>Scoped to `sales_owner_id = user.id` for workers | Reconciles with sum of 6 active Kanban columns (`lead` through `negotiation`) |
| **KPI 2: Won Revenue** | Closed Won Revenue | `public.deals.deal_value` | `SUM(deal_value)` WHERE `stage = 'won'`<br>Scoped to `sales_owner_id = user.id` for workers | Reconciles with Financial OS won sales & Client 360 lifetime value |
| **KPI 3: Win Rate** | Conversion Rate (%) | `public.deals.stage` | `(COUNT(won) / (COUNT(won) + COUNT(lost))) * 100`<br>Returns 0% if no finalized deals | Reconciles with Worker Performance Matrix win rates |
| **KPI 4: Disbursed Comms** | Paid Commissions | `public.sales_commissions.commission_amount` | `SUM(commission_amount)` WHERE `status = 'paid'`<br>Scoped to `team_member_id = myMember.id` for workers | Reconciles with Agency Commission Ledger paid entries and Financial OS expense disbursements |
| **Total Commissions Earned** | Total Earned | `public.sales_commissions.commission_amount` | `SUM(commission_amount)` WHERE `status IN ('paid', 'approved', 'pending')` | Reconciles with Worker Commission totals |

---

## 3. Kanban Columns & Stage Traceability

| Stage Key | Order | Live Count | Total Value (TND) | Authoritative DB Query / Logic |
| :--- | :--- | :--- | :--- | :--- |
| `lead` | 1 | 17 | 81,700 TND | `public.deals` WHERE `stage = 'lead'` |
| `contacted` | 2 | 1 | 2,300 TND | `public.deals` WHERE `stage = 'contacted'` |
| `qualified` | 3 | 9 | 33,000 TND | `public.deals` WHERE `stage = 'qualified'` |
| `meeting` | 4 | 1 | 5,000 TND | `public.deals` WHERE `stage = 'meeting'` |
| `proposal` | 5 | 3 | 7,000 TND | `public.deals` WHERE `stage = 'proposal'` |
| `negotiation` | 6 | 0 | 0 TND | `public.deals` WHERE `stage = 'negotiation'` |
| `won` | 7 | 6 | 20,090 TND | `public.deals` WHERE `stage = 'won'` |
| `lost` | 8 | 1 | 0 TND | `public.deals` WHERE `stage = 'lost'` |
| **TOTAL** | — | **38** | **149,090 TND** | `SELECT COUNT(*), SUM(deal_value) FROM public.deals` |

---

## 4. Commission Rules & Ledger Traceability

### 4.1 Configurable Business Rules
- **Initial Sales Commission Rate:** `15%` (`public.business_rules.numeric_value` where `rule_key = 'initial_commission_rate'`)
- **Initial Duration Months:** `6 months` (`public.business_rules.numeric_value` where `rule_key = 'initial_commission_duration_months'`)
- **Renewal Commission Rate:** `5%` (`public.business_rules.numeric_value` where `rule_key = 'renewal_commission_rate'`)
- **Upsell Commission Rate:** `5%` (`public.business_rules.numeric_value` where `rule_key = 'upsell_commission_rate'`)
- **Sponsoring Exclusion:** Ad spend / sponsoring budget is strictly excluded from commission calculation (`commission_base = Math.max(0, total_amount - sponsoring_amount)`).

### 4.2 Commission Ledger Ground Truth
- Total Records in `public.sales_commissions`: **8 entries**
- Status Breakdown:
  - `paid`: **6 records**, totaling **1,350 TND**
  - `pending`: **2 records**, totaling **450 TND**
  - `approved`: **0 records**
- Total Ledger Value: **1,800 TND**

---

## 5. Commercial Team Performance Matrix Traceability

Every row in the Commercial Team Performance Matrix derives from authoritative joins:
- **Total Leads:** `COUNT(public.deals)` WHERE `sales_owner_id = member.profile_id OR commission_recipient_id = member.id`
- **Won Sales:** `COUNT(public.deals)` WHERE `stage = 'won'` AND `(sales_owner_id = member.profile_id OR commission_recipient_id = member.id)`
- **Win Rate:** `(Won / Total Leads) * 100`
- **Pipeline Value:** `SUM(deal_value)` WHERE `stage NOT IN ('won', 'lost')` (covers `lead`, `contacted`, `qualified`, `meeting`, `proposal`, `negotiation`)
- **Won Revenue:** `SUM(deal_value)` WHERE `stage = 'won'`
- **Commissions Claimed:** `SUM(commission_amount)` FROM `public.sales_commissions` WHERE `team_member_id = member.id`

---

## 6. Demonstration Data Isolation Assessment

| Data Category | Record Count | Identified Pattern | Isolation Strategy | Safe Deletion Status |
| :--- | :--- | :--- | :--- | :--- |
| Real / Historical Deals | 38 records | Varied brands (Dar Ben Gacem, Hotel Carlton, Tunisia Tech, Digitous) | Retained as operational history | **PRESERVED** (No deletion) |
| Synthetic Commissions | 8 records | Exact commission amounts linked to existing deals | Retained in ledger for financial audit | **PRESERVED** (No deletion) |
| Inactive Team Members | ~380 members | Created during load/e2e tests | Filterable via "Active Reps Only" toggle without modifying DB | **ISOLATED** in UI view |
| Hardcoded Fallbacks | 0 instances | Replaced with live Supabase subscriptions & `SADAEmptyState` | Certified: No mock arrays substitute for live DB records | **ELIMINATED** |
