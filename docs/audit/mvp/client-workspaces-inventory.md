# SADA OS — Client Workspaces & Client 360 Inventory

**Document ID:** `SADA-AUDIT-CW-INV-001`  
**Module:** Client Workspaces (`/admin/client-workspaces`) & Client 360 (`/admin/client-workspaces/:id`)  
**Scope:** Complete Codebase, UI Component, Modal, Drawer, Tab, and Action Inventory  
**Audit Date:** October 14, 2026  
**Status:** **PHASE 0 COMPLETED**  

---

## 1. Executive Overview

The **Client Workspaces** and **Client 360** module serves as the commercial, operational, and financial nexus of SADA OS. It manages the entire client lifecycle from commercial onboarding, contractual package definition, service commitment quotas, recurring task generation, operational delivery tracking, team work attribution, client memory/directives, and complete Financial OS operations (invoices, income, expenses, sponsoring campaigns, and profitability analysis).

This inventory enumerates every file, route, component, modal, tab, control, query, and mutation service comprising this module.

---

## 2. Route & Architecture Inventory

| Route | File Path | Type | Role Permissions | Description |
| :--- | :--- | :--- | :--- | :--- |
| `/admin/client-workspaces` | `src/routes/admin.client-workspaces.index.tsx` | Route Component | `super_admin`, `admin`, `worker` | **Client Directory**: Search, filters (monthly vs one-off, status), KPI counters, Table/Card views, Add Client modal. |
| `/admin/client-workspaces/:id` | `src/routes/admin.client-workspaces.$id.tsx` | Route Component | `super_admin`, `admin`, `worker` (finance tabs gated) | **Client 360 Console**: 7-tab command center with live delivery calendar, financials, package management, and client memory. |
| `/admin/clients` | `src/routes/admin.clients.index.tsx` | Redirect Bridge | All authenticated | Canonical redirect `beforeLoad` $\rightarrow$ `/admin/client-workspaces` (`replace: true`). |
| `/admin/clients/:id` | `src/routes/admin.clients.$id.tsx` | Redirect Bridge | All authenticated | Canonical redirect `beforeLoad` $\rightarrow$ `/admin/client-workspaces/:id` (`replace: true`). |
| `/admin/client-projects` | `src/routes/admin.client-projects.index.tsx` | Redirect Bridge | All authenticated | Canonical redirect `beforeLoad` $\rightarrow$ `/admin/client-workspaces` (`replace: true`). |
| `/admin/client-projects/:id` | `src/routes/admin.client-projects.$id.tsx` | Resolution Bridge | All authenticated | Resolves `client_projects.client_id` and redirects $\rightarrow$ `/admin/client-workspaces/:client_id`. |

---

## 3. Client 360 Workspace Tabs Inventory

In `src/routes/admin.client-workspaces.$id.tsx`, the workspace is structured into 7 primary operational tabs (with backward-compatible legacy tab aliases normalized via `normalizeTab`):

| Tab Key | Label (EN / AR) | Access Control | Primary Capabilities & Contained Controls |
| :--- | :--- | :--- | :--- |
| `overview` | **Overview / نظرة عامة** | All Roles | - Executive Client Header (Logo, Industry, Status, Type, Health badge)<br>- Quick Action buttons (Edit Client, Edit Package, Add Service, New Task)<br>- Financial Summary Strip (Monthly Retainer, Sponsoring Budget, Invoiced, Paid, Outstanding)<br>- Delivery Progress Bar & Deliverable Counters<br>- Next Action & Urgent Task Radar<br>- Account Manager & Relationship Owner Cards |
| `services` | **Services & Package / الخدمات والباقة** | All Roles (Editing gated) | - Canonical Package Badge & Description<br>- Contractual Rate & Addons breakdown<br>- Sponsoring Budget Configuration<br>- Monthly Service Quota Grid (Reels, Posts, Stories, Custom Services)<br>- "Edit Package & Quotas" Modal launcher<br>- "Add Service Commitment" Modal launcher |
| `delivery` | **Delivery Center / مركز التسليم** | All Roles | - Interactive Monthly Period Picker (`yyyy-MM`) with historical navigation<br>- Delivery Progress Meter (Done / Total Quota %)<br>- Delivery Views: Task Kanban, Task Grid, and Calendar Grid<br>- Stage Workflow Stepper for deliverables<br>- Task Detail Drawer / Modal trigger<br>- Task Status toggles (`todo` $\leftrightarrow$ `in_progress` $\leftrightarrow$ `done`) |
| `team` | **Team & Work / فريق العمل** | All Roles | - Dedicated Account Manager & Relationship Lead card<br>- Team Specialists & Assigned Workers roster<br>- Logged Work Sessions & Hourly Effort Breakdown<br>- Role allocation and handoff tracking |
| `financial` | **Financial & Ads / المالية والإعلانات** | `super_admin`, `admin` only | - Financial Health & Margin KPI cards<br>- Unified Financial Ledger (Incomes, Expenses, Invoices, Sponsoring)<br>- Tabbed ledger filter (`all`, `income`, `expense`, `invoice`, `sponsoring`)<br>- Search & date sorting<br>- Action buttons: "Record Income", "Record Expense", "New Invoice", "Create Sponsoring"<br>- Invoice Pay Modal launcher |
| `notes` | **Client Memory / ذاكرة العميل** | All Roles | - Operational Directives & Brand Guidelines<br>- Structured Categories (Approval Process, Restrictions, Visual Identity, Brand Tone)<br>- Markdown editor & real-time preview<br>- Save Directives button |
| `history` | **Work History / سجل العمل** | All Roles | - Chronological Activity Timeline (from `project_activity`, `reconciliation_audit_logs`)<br>- Event filtering by date and action type<br>- Actor attribution and timestamp audit |

---

## 4. Component & Modal Inventory

### 4.1 Modals & Drawers Mounted in Client Workspaces

| Modal / Drawer Component | Source File | Trigger Location | Purpose & Key Form Controls |
| :--- | :--- | :--- | :--- |
| **Add Client Modal** | `admin.client-workspaces.index.tsx` | Header "+ Add Client" | 2-step onboarding dialog:<br>- Step 1: Identity (Name, Industry, Contact, Email, Phone, Preferred Channel, Account Manager, Sales Owner)<br>- Step 2: Commercial Model (Monthly Retainer vs One-Off, Package selection, Quotas, Pricing) |
| **Edit Client Details Modal** | `admin.client-workspaces.$id.tsx` | Overview & Header "Edit Client" | Edits client name, contact name, email, phone, website, industry, relationship owner, and account manager. |
| **Edit Package Modal** | `admin.client-workspaces.$id.tsx` | Services & Overview "Edit Package" | Package catalog picker, monthly rate, sponsoring budget, custom quotas (reels, posts, stories), and live reconciliation preview. |
| **Task Modal** | `src/components/admin/TaskModal.tsx` | Delivery Center & Quick Actions | Canonical task creator/editor: Title, description, assignee, priority, deadline, status, category, service, workflow template selector. |
| **Task Detail Modal** | `src/components/admin/TaskDetailModal.tsx` | Clicking any task card/row | Task detail inspection, subtask progression, delivery link attachment, handoff requests, and "Edit task definition" launcher. |
| **Service Commitment Modal** | `src/components/admin/ServiceCommitmentModal.tsx` | Services tab "+ Add Commitment" | Configures recurring service quotas, frequency, assignees, and scheduling rules. |
| **Record Income Modal** | `src/components/admin/finance/RecordIncomeModal.tsx` | Financial Tab "+ Record Income" | Client-attributed cash inflow: Amount, currency, bank account, payment method, date, reference, invoice link. |
| **Record Expense Modal** | `src/components/admin/finance/RecordExpenseModal.tsx` | Financial Tab "+ Record Expense" | Client-attributed operational cost: Category, vendor, amount, bank account, date, description, receipt upload. |
| **Create Invoice Modal** | `src/components/admin/finance/CreateInvoiceModal.tsx` | Financial Tab "+ New Invoice" | Official billing invoice: Invoice number, client, issue date, due date, service fee, sponsoring amount, line items. |
| **Record Invoice Payment Modal** | `src/components/admin/finance/RecordInvoicePaymentModal.tsx` | Invoice row "Record Payment" | Records full or partial settlement against an outstanding invoice. |
| **Create Sponsoring Modal** | `src/components/admin/finance/CreateSponsoringModal.tsx` | Financial Tab "+ Sponsoring" | Sponsoring campaign: Campaign name, platform, TND budget, USD equivalent, exchange rate, client fee. |

---

## 5. Services & Logic Engines Inventory

| Service Module | File Path | Consumed Tables | Primary Functions / Responsibilities |
| :--- | :--- | :--- | :--- |
| **Client Service** | `src/lib/client-service.ts` | `clients`, `client_projects` | Client CRUD, profile normalization, validation, contact channel resolution. |
| **Package Reconciliation Service** | `src/lib/package-reconciliation-service.ts` | `package_catalog`, `clients`, `project_tasks`, `reconciliation_audit_logs` | Authoritative package configuration resolution (`resolveAuthoritativePackageConfig`), preview reconciliation (`previewPackageReconciliation`), and live idempotent reconciliation (`reconcileClientPackageWork`). |
| **Recurring Scheduling Service** | `src/lib/recurring-scheduling-service.ts` | `service_commitments`, `project_tasks`, `clients` | Commitment CRUD, recurring task generation for monthly delivery periods, commitment lifecycle. |
| **Finance Service** | `src/lib/finance-service.ts` | `financial_accounts`, `invoices`, `income_transactions`, `expense_transactions`, `sponsoring_campaigns` | Authoritative Financial OS operations, double-counting protection, receivable aging, treasury balances. |
| **Task Execution Service** | `src/lib/task-execution-service.ts` | `project_tasks`, `project_activity` | Task transitions (`startTask`, `pauseTask`, `completeTask`, `approveAndCompleteTask`), execution tiers, blockers. |
| **Workflow Engine** | `src/lib/workflow-service.ts` | `workflow_templates`, `project_tasks` | Ordered stage dependencies (`checkStageActionability`), stage actionability locks, template instantiation. |
| **Permissions Service** | `src/lib/permissions.ts` | `user_roles`, `user_module_permissions` | RBAC evaluation (`canEditClient`, `canDeleteClient`, `canAccessFinance`, `canEditTaskDefinition`). |
| **Business Rules Service** | `src/lib/business-rules-service.ts` | `business_rules`, `business_rule_versions` | Dynamic margin thresholds (`client_high_profit_margin_percent`, `client_medium_profit_margin_percent`, `initial_commission_rate`). |

---

## 6. SADA Design System & UI Primitive Components Used

- `SADAButton` (`src/components/ui/sada-button.tsx`): Primary, secondary, danger, and ghost buttons with loading spinners.
- `SADAInput` (`src/components/ui/sada-input.tsx`): Text, email, phone, and number inputs with clear labels.
- `SADASelect` (`src/components/ui/sada-select.tsx`): Radix-based select controls with keyboard navigation.
- `SADACombobox` (`src/components/ui/sada-combobox.tsx`): Searchable dropdowns for team members, clients, and packages.
- `SADADatePicker` (`src/components/ui/sada-date-picker.tsx`): Calendar popover date selectors.
- `SADACounter` (`src/components/ui/sada-ui.tsx`): Number stepper for quota configuration.
- `SADADialog` (`src/components/ui/sada-dialog.tsx`): Accessible modals with focus traps and sticky footers.
- `SADAEmptyState` (`src/components/ui/sada-empty-state.tsx`): Clean zero-data states with contextual action buttons.
- `ClientDirectorySkeleton` / `ClientWorkspaceSkeleton`: Smooth shimmer loading states preventing layout shifts.
