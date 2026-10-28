# SADA OS — Client Workspaces & Client 360: Interaction Matrix

## 1. Executive Summary

This document verifies the interactive controls, forms, modals, drawers, filters, and state mutations across the **Client Directory Hub** (`/admin/client-workspaces`) and the **Client 360 Console** (`/admin/client-workspaces/:id`).

All interactive controls have been audited for:
- Expected vs actual behavior
- Data source (read/write)
- Validation & error handling
- Role-based authorization
- Persistence verification
- Test evidence status

---

## 2. Client Directory Hub (`/admin/client-workspaces`)

| Control / Interaction | UI Component | Action & Behavior | Role Authorization | Validation & Guards | Persistence Mechanism | Test Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Search Input** | `SADAInput` | Filters clients in real-time by name, contact name, email, phone | All roles | None (safe client-side filter) | Transient state (`searchTerm`) | **PASS** |
| **Status Filter** | `SADASelect` / Tabs | Filters by `all`, `active`, `archived`, `prospect` | All roles | Valid enum value | Transient state (`statusFilter`) | **PASS** |
| **Engagement Type Filter** | Segmented Buttons | Filters by `all`, `monthly` (retainers), `one_off` | All roles | Valid type value | Transient state (`typeFilter`) | **PASS** |
| **View Mode Toggle** | Icon Buttons | Switches between Table view and Card view | All roles | Defaults to cards on `< 768px` | `localStorage` + state (`viewMode`) | **PASS** |
| **Add Client Button** | `SADAButton` | Opens 2-step Add Client Modal | Admin / Super Admin | Permission check: `canManageClients` | Modal state (`showAddModal`) | **PASS** |
| **Add Client: Step 1 Form** | `SADADialog` | Captures name, industry, contact name, email, phone, channel | Admin / Super Admin | Business name required; email format check | Form state | **PASS** |
| **Add Client: Step 2 Form (Monthly)** | `SADADialog` | Captures package, monthly rate, sponsoring budget, quotas | Admin / Super Admin | Rate >= 0, budget >= 0; quotas non-negative integers | `clients.insert` + `client_projects.insert` | **PASS** |
| **Add Client: Step 2 Form (One-Off)** | `SADADialog` | Captures service name, subtasks, target date, assigned staff | Admin / Super Admin | Service name required; target date valid ISO | `clients.insert` + `client_projects.insert` + tasks | **PASS** |
| **Row / Card Click** | Click Handler | Navigates to `/admin/client-workspaces/:id` | All roles | Valid UUID `id` parameter | TanStack Router navigation | **PASS** |

---

## 3. Client 360 Console (`/admin/client-workspaces/:id`)

### A. Navigation & Cockpit Controls

| Control / Interaction | Component | Action & Behavior | Role Authorization | Validation & Guards | Persistence Mechanism | Test Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Sticky Section Navigation** | Sticky Bar | Smoothly scrolls to section (`#overview-section`, `#services-section`, `#delivery-section`, etc.) | All roles | Section headings never obscured (`scroll-mt-36`) | DOM scroll behavior | **PASS** |
| **Tab Switching** | Subnav Tabs | Switches between Overview, Services, Delivery, Team, Financial, Memory, History | Financial tabs restricted | Worker cannot access financial tabs | State (`activeTab`) | **PASS** |
| **Period Selector** | `SADASelect` | Switches active delivery month (`YYYY-MM`) for quotas and tasks | All roles | Valid ISO month string | State (`selectedPeriod`) | **PASS** |
| **Quick Call Button** | `<a>` link | Opens `tel:` URI with sanitized phone number | All roles | Only visible if client has phone | Native telephony handler | **PASS** |
| **WhatsApp Chat Button** | `<a>` link | Opens WhatsApp Web/App via `https://wa.me/<sanitized_phone>` | All roles | Sanitizes non-digit characters | External WhatsApp URL | **PASS** |
| **Email Button** | `<a>` link | Opens `mailto:` URI with client email address | All roles | Only visible if client has email | Native mail client | **PASS** |

### B. Workspace Modals & Drawers

| Modal / Drawer | Trigger Button | Actions Available | Role Authorization | Validation & Error Handling | Persistence Mechanism | Test Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Edit Client Profile** | "Edit Client" Button | Updates name, industry, email, phone, status, AM, sales owner, rate, sponsoring | Admin / Super Admin | Name required; rate & budget >= 0 (no 1500/500 defaults) | `supabase.from("clients").update(...)` | **PASS** |
| **Edit Package & Quotas** | "Edit Package" Button | Changes canonical package or custom quotas; invokes reconciliation | Admin / Super Admin | Quotas >= 0; previews creates & prunes | `reconcileClientPackageWork` + audit log | **PASS** |
| **Reconcile Work On-Demand** | "Reconcile Work" Button | Reconciles commitments against task delivery state | Admin / Super Admin | Idempotent; preserves completed historical work | `reconcileClientPackageWork` | **PASS** |
| **Add Service Commitment** | "Add Service" Button | Configures new recurring or one-off deliverable commitment | Admin / Super Admin | Service name, frequency, quantity required | `saveServiceCommitment` | **PASS** |
| **Create Task** | "New Task" Button | Generates operational deliverable task linked to client & project | Admin / Super Admin / Worker | Title, deadline, stage required | `supabase.from("project_tasks").insert(...)` | **PASS** |
| **Task Detail Modal** | Task Row Click / "View Task" | Opens complete task cockpit, workflow stages, editing, handoff | All roles (workers restricted to assigned) | Stage prerequisites enforced; Drive URL validated | `project_tasks.update` + `project_activity` | **PASS** |
| **Record Income Modal** | "Record Income" Button | Records cash inflow, payment method, date, invoice allocation | Admin / Super Admin | Amount > 0; payment method required; prevents double-count | `income_transactions.insert` + invoice sync | **PASS** |
| **Record Expense Modal** | "Record Expense" Button | Records operational expense attributed to client/project | Admin / Super Admin | Amount > 0; category required | `expense_transactions.insert` | **PASS** |
| **New Invoice Modal** | "New Invoice" Button | Issues invoice with invoice lines, due date, client linkage | Admin / Super Admin | Total amount > 0; due date required | `invoices.insert` + `invoice_lines.insert` | **PASS** |
| **Sponsoring Campaign Modal**| "New Campaign" Button | Launches campaign with budget, purchase cost, client charge | Admin / Super Admin | Budget >= 0; platform selection | `sponsoring_campaigns.insert` | **PASS** |
| **Client Memory Editor** | "Save Notes" Button | Updates client directives, brand guidelines, and preferences | Admin / Super Admin / AM | Character limit check; sanitized string | `clients.update({ notes })` | **PASS** |

---

## 4. Cross-Page Consistency Matrix

| Action in Client 360 | Immediate Client 360 Update | Client Directory Hub Reflection | Financial OS Reflection | My Work / Calendar Reflection |
| :--- | :--- | :--- | :--- | :--- |
| **Package Quota Increase** | Quota strip updates; new tasks appear in Delivery Center | Client card shows increased deliverables count | Monthly rate updates if package changed | Generated tasks appear on assigned dates in My Work & Calendar |
| **Task Completed** | Progress bar advances; task shows "Done" | Monthly progress percentage increments | Cost actuals update if task logged hours | Task marked completed in worker's My Work console |
| **Payment Recorded** | Total collected increments; outstanding balance decrements | Client card payment status updates (PENDING $\rightarrow$ PAID) | Cash account balance increments; revenue dashboard reflects payment | Invoice shows partial/full payment in Financial OS |
| **Expense Recorded** | Client expenses increment; net margin % updates | Margin % recalculates dynamically | Expense ledger includes transaction under category | Unchanged (expenses do not pollute operational tasks) |
| **Sponsoring Created** | Sponsoring budget, ad spend, and margin update | Sponsoring budget badge updates | Sponsoring ledger includes campaign | Unchanged |
