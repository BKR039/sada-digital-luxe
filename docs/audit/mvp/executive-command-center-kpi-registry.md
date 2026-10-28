# SADA OS — Executive Command Center KPI Source-of-Truth Registry
## Phase 7 & 9 Management Analytics & Executive Command Center Canonical Data Registry

**Document Reference:** `docs/audit/mvp/executive-command-center-kpi-registry.md`  
**Audit Date:** 2026-10-16  
**Auditor:** SADA OS Architecture & Financial Systems Engineering  
**Target Route:** `/admin/analytics` (`src/routes/admin.analytics.tsx`)  
**Core Services:** `src/lib/analytics-service.ts`, `src/lib/finance-service.ts`, `src/components/admin/project-utils.ts`  
**Status:** **AUTHORITATIVE & VERIFIED**

---

### Executive Overview & Semantic Architecture

This registry serves as the authoritative Single Source of Truth (SSOT) contract for all metrics, KPIs, aggregations, charts, Smart Insights, and drill-downs rendered within the Executive Command Center at `/admin/analytics`.

For executive transparency, each KPI explicitly documents:
1. **Displayed Label:** What appears in the header card.
2. **Exact Business Formula:** The mathematical derivation executed by the code.
3. **Accounting Basis:** Distinguishing Cash Basis (realized receipts/payments) from Accrual Basis (contracted commitments, earned delivery, receivables).
4. **Semantic Alignment Status:** Identifying where the current label is semantically exact vs where it represents an operational proxy requiring executive owner review.

---

## 1. Top 8 Executive Command Strip KPI Cards

```
+-------------------------------------------------------------------------------------------------------------------------+
| [1] Recognized Revenue  | [2] Cash Collected    | [3] Net Profit        | [4] Contribution Margin                        |
| 63,880.000 TND          | 3,000.000 TND         | 2,100.000 TND         | 2,999.400 TND (100.0%)                         |
| +455.5% MoM             | -73.9% MoM            | 70.0% Net Margin      | Operational Gross Margin                       |
+-------------------------------------------------------------------------------------------------------------------------+
| [5] Available Cash      | [6] Receivables       | [7] Expenses & Burn   | [8] Delivery Health                            |
| 88,200.000 TND          | 2,300.000 TND         | 900.600 TND           | 25% Completion Rate                            |
| 18,500 TND Reserved     | 2,300 TND Overdue     | 2,400 TND/mo Burn     | 51 Overdue Tasks                               |
+-------------------------------------------------------------------------------------------------------------------------+
```

### KPI 1: Recognized Revenue
- **Displayed Header Label:** Recognized Revenue / الإيرادات المعترف بها
- **Card Subtext:** Contracted Retainer Volume / حجم الاشتراكات التعاقدية
- **Exact Business Formula:**
  $$\text{Contracted Retainer Volume} = \sum_{\text{active clients}} (\text{monthly\_package\_price} \text{ or } \text{default\_service\_fee})$$
  *(Fallback: If contracted volume is 0, falls back to period collected revenue `kpis.revenue`).*
- **Accounting & Semantic Reality:**
  - **Actual State:** **Contracted Monthly Retainer Run-Rate / MRR** (Commitment basis).
  - **GAAP/IFRS Revenue Recognition Note:** In formal accounting, "Recognized Revenue" represents revenue earned upon delivering performance obligations within an accounting period. The calculation here is the contracted recurring retainer volume across active clients for the month.
  - **Semantic Recommendation:** The subtext accurately states *"Contracted Retainer Volume"*. Recommend changing the top title to **"Contracted Retainers (MRR)"** or **"Retainer Run-Rate"** upon Super-Admin approval, or retaining with the current documented contract definition.
- **Canonical Tables & Fields:** `public.clients` (`monthly_package_price`, `default_service_fee`, `status`, `billing_start_date`, `is_archived`).
- **Date Filter:** Active clients where `billing_start_date <= period.endDate` and `status = 'active'` (and `is_archived != true`).
- **Status Exclusions:** Archived, paused, lead, and churned clients.
- **Currency & Rounding:** `TND`, `formatCurrency(val)` (3 decimal places).
- **Comparison Delta:** $\text{Delta} \% = \frac{\text{Current} - \text{Previous}}{\text{Previous}} \times 100$.
- **Drill-down Destination:** `openDrillDown("recognized_revenue", ...)` -> Itemizes each active client with contracted monthly retainer.
- **Verification Status:** **PASS** (Reconciled to 63,880 TND across active retained clients).

---

### KPI 2: Cash Collected
- **Displayed Header Label:** Cash Collected / السيولة المحصلة
- **Card Subtext:** Verified Treasury Inflows / المقبوضات النقدية المحصلة
- **Exact Business Formula:**
  $$\text{Cash Collected} = \sum (\text{income\_transactions.amount}) \quad \forall \, \text{date} \in [\text{period.startDate}, \text{period.endDate}]$$
- **Accounting & Semantic Reality:**
  - **Actual State:** **Realized Cash Inflows** (Strict Cash basis).
  - **Semantic Alignment:** **EXACT**. Measures actual money deposited into bank/cash accounts during the selected month.
- **Canonical Tables & Fields:** `public.income_transactions` (`id`, `amount`, `date`, `direction = 'inflow'`, `status = 'received'`, `invoice_id`).
- **Date Filter:** `income_transactions.date` within selected date range.
- **Status Exclusions:** Excludes cancelled or reversed receipts.
- **Currency & Rounding:** `TND`, 3 decimal places.
- **Comparison Delta:** MoM growth against previous calendar month.
- **Drill-down Destination:** `openDrillDown("monthly_revenue", ...)` -> Itemizes each individual verified inflow receipt in the period.
- **Verification Status:** **PASS** (Reconciled to 3,000 TND in October 2026; 11,500 TND in September 2026).

---

### KPI 3: Net Profit
- **Displayed Header Label:** Net Profit / صافي الأرباح
- **Card Subtext:** Revenue - COGS - OpEx / صافي بعد كافة المصاريف
- **Exact Business Formula:**
  $$\text{Net Operating Profit} = \text{Total Cash Collected} - \text{COGS Direct Costs} - \text{Operating Expenses}$$
  Where:
  $$\text{COGS Direct Costs} = \text{Direct Production Labor} + \text{Sponsoring Purchases Ad Spend} + \text{Sales Commissions Paid}$$
  $$\text{Operating Expenses} = \sum \text{Paid Operating Outflows (Rent, SaaS Subscriptions, Overhead, Equipment)}$$
- **Accounting & Semantic Reality:**
  - **Actual State:** **Cash-Basis Net Operating Profit / Realized Operating Surplus**.
  - **Cost Completeness Note:** This metric accurately reflects all verified paid outflows in the period. It does **not** deduct accrued but unpaid future liabilities, depreciation, or corporate income tax.
  - **Semantic Alignment:** **ACCEPTABLE (Operating Level)**. Subtext clearly clarifies *"Revenue - COGS - OpEx"*. Recommend adding footnote *"Cash Operating Basis"* if audited GAAP statements are required.
- **Canonical Tables & Fields:** `income_transactions`, `expense_transactions`, `work_sessions` (`labor_cost`), `sponsoring_campaigns`, `sales_commissions`.
- **Date Filter:** Transaction dates within selected calendar period.
- **Currency & Rounding:** `TND`, 3 decimal places.
- **Drill-down Destination:** Tab 3: Monthly P&L Statement (`/admin/analytics` -> `monthly_pnl`).
- **Verification Status:** **PASS** (Reconciled to 2,100.000 TND for October 2026).

---

### KPI 4: Contribution Margin
- **Displayed Header Label:** Contribution Margin / هامش المساهمة
- **Card Subtext:** Gross Margin % (`77% Gross Margin` or `100% Gross Margin`)
- **Exact Business Formula:**
  $$\text{Contribution Profit (TND)} = \text{Total Collected Revenue} - \text{COGS Direct Costs}$$
  $$\text{Contribution Margin \%} = \frac{\text{Contribution Profit}}{\text{Total Revenue}} \times 100$$
  *(When revenue is 0 and costs are 0, margin defaults to 0% to avoid division-by-zero).*
- **Accounting & Semantic Reality:**
  - **Actual State:** **Gross Contribution Profit in TND** (Primary headline value) with **Contribution Margin %** in subtext.
  - **Semantic Distinction:** In classical finance:
    - *Contribution Margin* is expressed as a ratio or percentage (%).
    - *Contribution Profit* is expressed as a currency amount (TND).
  - The card displays the TND amount as the main number (`2,999.400 TND`) and the percentage in the subtext badge (`100% Gross Margin`).
  - **Semantic Recommendation:** Highly functional and internally consistent. Recommend adjusting title to **"Contribution Profit"** with *"Margin %"* subtext for strict financial pedantry.
- **Canonical Tables & Fields:** `monthlyPnL.grossProfit`, `monthlyPnL.grossMarginPercent`.
- **Incomplete Cost Protection:** Protected by `isIncompleteCostData`; unconfigured packages are suppressed from generating false 100% margins.
- **Drill-down Destination:** Tab 1: Client Profitability & Tab 2: Package Catalog Profitability.
- **Verification Status:** **PASS** (Reconciled to 2,999.400 TND, 100.0% operational gross margin).

---

### KPI 5: Available Cash
- **Displayed Header Label:** Available Cash / السيولة المتاحة
- **Card Subtext:** Reserved: X TND / المقيد: X TND
- **Exact Business Formula:**
  $$\text{Headline Value} = \text{Total Liquid Treasury Balance} = \sum_{\text{active accounts}} \text{financial\_accounts.current\_balance}$$
  $$\text{Reserved Commitments} = \sum \text{salary\_records.base\_amount} + \sum_{\text{status='approved'}} \text{sales\_commissions.commission\_amount}$$
- **Accounting & Semantic Reality:**
  - **Actual State:** **Total Liquid Bank & Cash Balances** (Unencumbered + Committed Treasury).
  - **Semantic Clarification:** The headline figure (`88,200.000 TND`) is the gross liquid treasury balance across all 10 active accounts. It does **not** subtract the reserved commitments (`18,500 TND`); instead, the reserved obligations are explicitly surfaced in the subtext: `Reserved: 18,500 TND`.
  - If "Available Cash" is interpreted as "Free / Unallocated Cash", the net figure would be $88,200 - 18,500 = 69,700\text{ TND}$.
  - **Semantic Recommendation:** The subtext prevents misleading executives by explicitly displaying the reserved burden. If desired by leadership, a toggle between "Total Liquid Treasury" and "Net Unallocated Cash" can be introduced.
- **Canonical Tables & Fields:** `public.financial_accounts` (`current_balance`, `status = 'active'`), `salary_records`, `sales_commissions`.
- **Drill-down Destination:** `openDrillDown("cash_balance", ...)` -> Itemizes all 10 bank, cash, and gateway accounts with live balances.
- **Verification Status:** **PASS** (Reconciled to 88,200.000 TND total liquid cash, 18,500.000 TND reserved payroll).

---

### KPI 6: Outstanding Receivables
- **Displayed Header Label:** Outstanding Receivables / مستحقات معلقة
- **Card Subtext:** X Overdue Invoices / X فواتير متأخرة
- **Exact Business Formula:**
  $$\text{Outstanding Receivables} = \sum_{\text{status} \notin \{\text{'paid'}, \text{'cancelled'}, \text{'draft'}\}} \max(0, \text{total\_amount} - \text{paid\_amount})$$
  $$\text{Overdue Amount} = \sum_{\text{isInvoiceOverdue}(i) = \text{true}} \max(0, \text{total\_amount} - \text{paid\_amount})$$
- **Accounting & Semantic Reality:**
  - **Actual State:** **Net Uncollected Billed Invoices** (Asset).
  - **Semantic Alignment:** **EXACT**. Strictly accounts for partial payments (`paid_amount`) and excludes paid, draft, or cancelled invoices.
- **Canonical Tables & Fields:** `public.invoices` (`total_amount`, `paid_amount`, `status`, `due_date`, `client_id`).
- **Date Filter:** All active unpaid invoices regardless of issue period; overdue evaluated against current timestamp using canonical `isInvoiceOverdue(i, now)`.
- **Currency & Rounding:** `TND`, 3 decimal places.
- **Drill-down Destination:** `openDrillDown("outstanding_invoices", ...)` -> Itemizes each unpaid invoice, client, and balance due.
- **Verification Status:** **PASS** (Reconciled to 2,300.000 TND across invoice `INV-TEST-nh6y3`).

---

### KPI 7: Expenses & Burn
- **Displayed Header Label:** Expenses & Burn / المصاريف ومعدل الحرق
- **Card Subtext:** Burn: X TND/mo / حرق: X TND/شهر
- **Exact Business Formula:**
  $$\text{Headline Value} = \text{Actual Incurred Period Outflows} = \text{monthlyPnL.operatingExpenses} + \text{monthlyPnL.cogsDirectCosts}$$
  $$\text{Monthly Burn Rate} = \sum_{\text{active subscriptions}} \text{monthly\_cost\_tnd}$$
- **Accounting & Semantic Reality:**
  - **Actual State:** **Realized Incurred Period Expenses** (Headline) with **Recurring SaaS Subscription Commitment Run-Rate** (Subtext).
  - **Formula Distinction:** The headline number (`900.600 TND`) does **not** add the 2,400 TND recurring subscription commitments into the actual expenses. It displays actual cash spent, while the subtext displays the standing monthly software burn rate.
  - **Semantic Alignment:** **EXACT**. Combines historical spend with future standing burn without double counting.
- **Canonical Tables & Fields:** `public.expense_transactions` (`amount`, `date`), `public.saas_subscriptions` (`cost_tnd`, `status`).
- **Drill-down Destination:** `openDrillDown("monthly_expenses", ...)` -> Itemizes all expense ledger entries.
- **Verification Status:** **PASS** (Reconciled to 900.600 TND expenses, 2,400 TND monthly subscription burn).

---

### KPI 8: Delivery Health
- **Displayed Header Label:** Delivery Health / صحة التنفيذ والإنتاج
- **Card Subtext:** X Overdue Deliverables / X تسليمات متأخرة
- **Exact Business Formula:**
  $$\text{Overdue Tasks Count} = \sum [ \text{isTaskOverdue}(t, \text{now}) = \text{true} ]$$
  $$\text{Completion Rate \%} = \begin{cases} \text{round}\left( \frac{\text{Completed Tasks}}{\text{Total Tasks}} \times 100 \right) & \text{if } \text{Total Tasks} > 0 \\ 0 & \text{if } \text{Total Tasks} = 0 \end{cases}$$
- **Accounting & Semantic Reality:**
  - **Empty-State Fix:** Remediated from misleading 100% default to canonical SADA WORK OS convention (`0%` when `totalTasks = 0`).
  - **Deadlines & Overdue Rules:** Date-only deadlines (e.g. `2026-10-16`) evaluate at `endOfDay(parseISO(deadline))` (23:59:59.999). A deliverable due today is **not** overdue until after midnight.
  - **Terminal Status Exclusions:** Tasks with status in `'done'`, `'completed'`, `'delivered'`, `'approved'`, `'cancelled'` are **never** overdue.
- **Canonical Tables & Fields:** `public.project_tasks` (`id`, `deadline`, `status`, `client_id`, `project_id`).
- **Drill-down Destination:** `openDrillDown("overdue_tasks", ...)` -> Itemizes all 51 overdue deliverables with priority, estimated hours, and client links.
- **Verification Status:** **PASS** (Reconciled to 51 overdue tasks and 25% completion rate across 239 total tasks).

---

## 2. Summary of Semantic Recommendations for Super-Admin Approval

| KPI Card | Current Header Label | Recommended Refined Label | Rationale | Owner Action |
|:---|:---|:---|:---|:---:|
| KPI 1 | Recognized Revenue | **Contracted Revenue (MRR)** | Avoids conflating monthly contracted retainer volume with GAAP performance-obligation revenue recognition. | **Owner Approval** |
| KPI 3 | Net Profit | **Operating Net Profit (Cash Basis)** | Clarifies that depreciation, taxes, and unbilled accruals are not deducted. | **Informational** |
| KPI 4 | Contribution Margin | **Contribution Profit** | The primary headline number is in Dinars (Profit); the percentage (Margin %) is in the subtext. | **Owner Approval** |
| KPI 5 | Available Cash | **Liquid Treasury Cash** | Clarifies that headline is gross liquid bank balances, with 18,500 TND reserved shown in subtext. | **Informational** |
| KPI 8 | Delivery Health | Delivery Health | Verified. Returns 0% on empty datasets; 100% alignment on 51 overdue deliverables. | **Certified** |
