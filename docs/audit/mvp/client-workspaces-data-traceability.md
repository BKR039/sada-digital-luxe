# SADA OS — Client Workspaces & Client 360: Data Traceability Report

## 1. Executive Summary

This report establishes end-to-end data traceability for the **Client Workspaces & Client 360** module across the Client Directory Hub (`/admin/client-workspaces`) and the Client 360 Console (`/admin/client-workspaces/:id`).

Every user-facing metric, table row, badge, and operational widget is traced from UI presentation back to its canonical database table, primary key, read query, mutation service, validation rule, and synchronization mechanism.

---

## 2. Traceability Matrix: Core Commercial & Operational Fields

| UI Element / Field | UI Route & Line | Canonical Table & Column | Primary Key | Canonical Read Service / Query | Authorized Write Service / Mutation | Validation & Constraints |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Client Name** | `$id.tsx:1889`<br>`index.tsx:830` | `clients.name` | `clients.id` | `supabase.from("clients").select("*").eq("id", id)` | `handleSaveEditClient`<br>`handleCreateClient` | Non-empty string; trimmed; duplicate name warned |
| **Client Status** | `$id.tsx:1868`<br>`index.tsx:820` | `clients.status` | `clients.id` | `supabase.from("clients").select("status")` | `supabase.from("clients").update({ status })` | `active`, `archived`, `prospect` enum |
| **Engagement Type** | `$id.tsx:1862`<br>`index.tsx:812` | `clients.client_type` | `clients.id` | `supabase.from("clients").select("client_type")` | `supabase.from("clients").insert/update` | `monthly` vs `one_off` |
| **Account Manager** | `$id.tsx:1942`<br>`index.tsx:850` | `clients.account_manager_id`<br>`clients.relationship_owner_id` | `clients.id` | Resolved via `profiles.display_name` + `team_members` | `supabase.from("clients").update({ account_manager_id })` | Must resolve to valid profile ID or displays "Unassigned" |
| **Sales Owner** | `$id.tsx:1951`<br>`index.tsx:855` | `clients.sales_owner_id`<br>`clients.commission_recipient_id` | `clients.id` | Resolved via `team_members.display_name` + `profiles` | `supabase.from("clients").update({ sales_owner_id })` | Must resolve to active team member or displays "Unassigned" |
| **Package Selection** | `$id.tsx:1957`<br>`index.tsx:860` | `clients.package_id`<br>`clients.package_name` | `clients.id` | `resolveAuthoritativePackageConfig(client, linkedPackage)` | `reconcileClientPackageWork` | Foreign key to `package_catalog.id` or custom package |
| **Monthly Rate** | `$id.tsx:1960`<br>`index.tsx:865` | `clients.monthly_package_price`<br>`clients.default_service_fee` | `clients.id` | Dynamic fallback hierarchy: `price || fee || 0` | `supabase.from("clients").update({ monthly_package_price })` | Decimal non-negative; 0 when unset (no hardcoded 1500) |
| **Sponsoring Budget** | `$id.tsx:1969`<br>`index.tsx:870` | `clients.default_sponsoring_budget` | `clients.id` | `client.default_sponsoring_budget \|\| 0` | `supabase.from("clients").update({ default_sponsoring_budget })` | Decimal non-negative; 0 when unset (no hardcoded 500) |
| **Monthly Quotas** | `$id.tsx:1615-1617`<br>`index.tsx:258` | `clients.package_config` (JSONB) | `clients.id` | `client.package_config.reels_quota`, `posts_quota`, etc. | `reconcileClientPackageWork` | Integer >= 0; preserved on quota changes |
| **Service Commitments** | `$id.tsx:625`<br>`$id.tsx:2050` | `service_commitments.*` | `service_commitments.id` | `fetchClientCommitments(clientId)` | `saveServiceCommitment` | FK `client_id`; schedule rules (weekly, monthly) |
| **Operational Tasks** | `$id.tsx:545`<br>`$id.tsx:2200` | `project_tasks.*` | `project_tasks.id` | `supabase.from("project_tasks").select("*").eq("client_id", id)` | `package-reconciliation-service`<br>`TaskDetailModal` | FK `client_id`, FK `project_id`; status lifecycle |

---

## 3. Financial SSOT & Derivation Traceability

| Metric | UI Location | Authoritative SSOT Calculation | Data Sources |
| :--- | :--- | :--- | :--- |
| **Total Invoiced** | `$id.tsx:711`<br>`$id.tsx:3580` | `invoices.reduce((sum, inv) => sum + (Number(inv.total_amount) \|\| 0), 0)` | `invoices` table filtered by `client_id` |
| **Total Paid (Collected)** | `$id.tsx:712`<br>`$id.tsx:3590` | `invoicePaidTotal + unlinkedIncomeTotal`<br>where `invoicePaidTotal = sum(inv.paid_amount)` and `unlinkedIncomeTotal = sum(income where invoice_id is null)` | `invoices.paid_amount` + `income_transactions` (unlinked) |
| **Outstanding Balance** | `$id.tsx:713`<br>`$id.tsx:3600` | `Math.max(0, totalInvoiced - invoicePaidTotal)` | `invoices` table |
| **Payment Status** | `$id.tsx:714`<br>`index.tsx:233` | `hasOverdue ? "OVERDUE" : (invoices.length > 0 && totalPaid >= totalInvoiced) \|\| (invoices.length === 0 && totalPaid > 0) ? "PAID" : "PENDING"` | `invoices.status`, `totalInvoiced`, `totalPaid` |
| **Sponsoring Ad Spend** | `$id.tsx:715`<br>`$id.tsx:3610` | `sponsoring.reduce((sum, sc) => sum + (Number(sc.purchase_cost_tnd) \|\| 0), 0)` | `sponsoring_campaigns.purchase_cost_tnd` |
| **Sponsoring Client Charge** | `$id.tsx:716`<br>`$id.tsx:3615` | `sponsoring.reduce((sum, sc) => sum + (Number(sc.client_charge_tnd) \|\| 0), 0)` | `sponsoring_campaigns.client_charge_tnd` |
| **Sponsoring Margin** | `$id.tsx:717`<br>`$id.tsx:3620` | `sponsoring.reduce((sum, sc) => sum + (Number(sc.margin_tnd) \|\| 0), 0)` | `sponsoring_campaigns.margin_tnd` |
| **Client Operational Expenses** | `$id.tsx:718`<br>`$id.tsx:3625` | `expenses.reduce((sum, exp) => sum + (Number(exp.amount) \|\| 0), 0)` | `expense_transactions` table filtered by `client_id` |
| **Net Cash Position** | `$id.tsx:719`<br>`$id.tsx:3630` | `totalCollected - clientExpenses - sponsoringAdSpend` | Derived from cash inflows minus all outflows |
| **Net Profit & Margin %** | `$id.tsx:723-724`<br>`$id.tsx:3636` | `netProfit = monthlyRevenue + sponsoringMargin - (clientExpenses > 0 ? clientExpenses : estimatedDirectCost) - estimatedCommission`<br>`marginPercent = totalTopline > 0 ? (netProfit / totalTopline) * 100 : 0` | Strict formula; 0% when revenue is 0 |
| **Financial Health Badge** | `$id.tsx:725`<br>`index.tsx:249` | `totalTopline <= 0 ? "LOW PROFIT" : marginPercent >= 50 ? "HIGH PROFIT" : marginPercent >= 25 ? "MEDIUM" : "LOW PROFIT"` | Threshold-based; never defaults to "HIGH PROFIT" on 0 revenue |

---

## 4. Work History & Audit Traceability

| Event Type | Authoritative Source Table | Actor Attribution | Historical Immutability |
| :--- | :--- | :--- | :--- |
| **Package Quota Reconciliation** | `reconciliation_audit_logs` | `actor_id`, `actor_email` | Append-only; records `mutation_type`, `old_state`, `new_state`, `reason` |
| **Deliverable Stage Transitions** | `project_activity` | `user_id`, `user_display_name` | Append-only activity log with timestamps |
| **Task Creation & Updates** | `project_tasks.created_at`, `updated_at` | `created_by`, `assigned_to` | Task history preserved; unstarted tasks pruned only on explicit quota decrease |
| **Publishing Handoffs** | `publishing_workflow_service` / `project_activity` | `editor_id`, `publisher_id` | Logs drive link, scheduled date, live URL, platform |
| **Financial Transactions** | `income_transactions`, `expense_transactions` | `created_by`, `reference` | Atomic records with date, method, category, and client linkage |
