# SADA OS — Canonical Source-of-Truth Registry

**Document Purpose:** Baseline data-source reference establishing the single authoritative source of truth (SSOT) for every business entity in SADA OS prior to MVP testing.  
**Classification Rules:**
- **VERIFIED_CANONICAL_SOURCE:** Authoritative master table with full database constraints and live mutations.
- **VERIFIED_DERIVED_PROJECTION:** Mathematically derived or aggregated view/read model.
- **VERIFIED_HISTORICAL_SNAPSHOT:** Immutable historical audit snapshot (must never be overwritten).
- **DUPLICATE_OR_COMPETING_SOURCE:** Secondary table with overlapping records requiring explicit synchronization or deprecation.
- **HARDCODED_OR_MOCKED:** In-memory fallback or mock array bypassing the database.

---

## 1. Core Business Entities & Canonical Registries

| Business Entity | Canonical Table / SSOT | Primary Key | Key Foreign Keys | Write Path / Authoritative Service | Legitimate Projections / Snapshots | Potential Competing Source / Risk |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. User Accounts & Identity** | `auth.users` + `public.profiles` | `id` (UUID) | None | GoTrue Auth + `account-service.ts` | `team_members.profile_id` | `team_members` maintains duplicate `email`, `name`, `role` |
| **2. User Roles** | `public.user_roles` | `id` (UUID) | `user_id $\rightarrow$ auth.users(id)` | `admin_update_account` RPC | `team_members.role` (projection) | `team_members.role` can drift if updated independently |
| **3. Module Permissions** | `public.user_module_permissions` | `id` (UUID) | `user_id $\rightarrow$ auth.users(id)` | `admin_update_account_permissions` RPC | `profiles.module_permissions` (JSON cache) | Cached JSON in `profiles` can become stale without RPC write-through |
| **4. Clients & CRM** | `public.clients` | `id` (UUID) | `relationship_owner_id $\rightarrow$ team_members` | `client-service.ts` | `client_projects.client_name` | Denormalized client names in projects/tasks |
| **5. Client Workspaces** | `public.client_projects` | `id` (UUID) | `client_id $\rightarrow$ clients(id)` | `client-service.ts` | Client 360 Workspace Deck | Legacy `public.projects` (portfolio CMS) |
| **6. Package Master Catalog** | `public.package_catalog` | `id` (UUID) | `category_id $\rightarrow$ package_categories(id)` | `package-service.ts` | Pricing page, Deal packages | Legacy `public.packages` (37 legacy rows) |
| **7. Package Addons** | `public.package_addons` | `id` (UUID) | None | `package-service.ts` | Deals / Invoices | None |
| **8. Service Quotas & Commitments** | `public.service_commitments` | `id` (UUID) | `client_id $\rightarrow$ clients(id)` | `recurring-scheduling-service.ts` | Generated recurring tasks | Deliverable notes parsing (deprecated) |
| **9. Client Deliverables** | `public.client_deliverables` | `id` (UUID) | `client_id $\rightarrow$ clients(id)` | `client-service.ts` | Task deliverable badge | Hardcoded deliverable counts |
| **10. Project Tasks & Subtasks** | `public.project_tasks` | `id` (UUID) | `project_id $\rightarrow$ client_projects(id)`, `assignee_id $\rightarrow$ team_members(id)`, `parent_task_id $\rightarrow$ project_tasks(id)` | `task-execution-service.ts` | Calendar, My Work, Team Workload | Legacy tasks in external notes |
| **11. Workflow Stages** | `public.workflow_stages` | `id` (UUID) | `template_id $\rightarrow$ workflow_templates(id)` | `workflow-service.ts` | Visual Stepper | Hardcoded stage arrays |
| **12. Work Sessions & Hourly Cost** | `public.work_sessions` | `id` (UUID) | `worker_id $\rightarrow$ team_members(id)`, `task_id $\rightarrow$ project_tasks(id)` | `team-cost-service.ts` | Stopwatch, Task Cost | Self-reported manual timesheet text |
| **13. Sales Leads & Pipeline** | `public.deals` | `id` (UUID) | `package_id $\rightarrow$ package_catalog(id)`, `sales_owner_id $\rightarrow$ auth.users(id)` | `sales-service.ts` | Pipeline Kanban, Forecast | Direct contact submissions before triage |
| **14. Sales Commissions** | `public.sales_commissions` | `id` (UUID) | `deal_id $\rightarrow$ deals(id)`, `recipient_id $\rightarrow$ team_members(id)` | `convert_lead_to_sale` RPC | My Salary, Financial Command | Dynamic recalculated commissions |
| **15. Financial Accounts (Treasury)** | `public.financial_accounts` | `id` (UUID) | None | `finance-service.ts` | Cash Reserves KPI | Mocked cash balances |
| **16. Cash Inflows (Collected Revenue)** | `public.income_transactions` | `id` (UUID) | `client_id $\rightarrow$ clients(id)`, `account_id $\rightarrow$ financial_accounts(id)` | `finance-service.ts` | Financial Overview, Cash Ledger | Unpaid Invoices (accrual vs cash) |
| **17. Cash Outflows (Overhead & Costs)** | `public.expense_transactions` | `id` (UUID) | `category_id $\rightarrow$ expense_categories(id)`, `account_id $\rightarrow$ financial_accounts(id)` | `finance-service.ts` | Expense Breakdown, Burn Rate | Unrecorded vendor bills |
| **18. Fixed Monthly Subscriptions** | `public.subscriptions` | `id` (UUID) | `account_id $\rightarrow$ financial_accounts(id)` | `finance-service.ts` | Fixed Monthly Burn KPI | Fixed burn rule parameter |
| **19. Client Invoices (Billing)** | `public.invoices` | `id` (UUID) | `client_id $\rightarrow$ clients(id)` | `finance-service.ts` | Client Workspace Invoices | `income_transactions` (different lifecycle) |
| **20. Worker Salaries & Base Pay** | `public.salary_records` | `id` (UUID) | `worker_id $\rightarrow$ team_members(id)` | `finance-service.ts` | My Salary, Payroll Due | Unlinked team_members text notes |
| **21. Salary Advances & Payouts** | `public.salary_requests` & `public.salary_payments` | `id` (UUID) | `worker_id $\rightarrow$ team_members(id)` | `finance-service.ts` | Advance Requests Queue | Untracked cash disbursements |
| **22. Centralized Business Rules** | `public.business_rules` | `key` (TEXT) | None | `business-rules-service.ts` | 27 Rule Evaluators | Hardcoded numbers in components |
| **23. Immutable Rule Versions** | `public.business_rule_versions` | `id` (UUID) | `rule_key $\rightarrow$ business_rules(key)` | `business-rules-service.ts` | Rule Audit History | None |
| **24. Active User Sessions** | `public.user_sessions` | `id` (UUID) | `user_id $\rightarrow$ auth.users(id)` | `record_session_heartbeat` RPC | Live Sessions Tab, Realtime revoke | Client `localStorage` token |
| **25. Notifications & Alerts** | `public.notifications` | `id` (UUID) | `recipient_id $\rightarrow$ auth.users(id)` | `notification-service.ts` | Notification Bell, Drawer | Browser-only state |
| **26. Immutable System Audit Logs** | `public.system_audit_logs` | `id` (UUID) | None | Append-only triggers + services | Audit Trail Inspector | None |
| **27. Public Portfolio CMS** | `public.projects` | `id` (UUID) | None | `content-service.ts` | `/case-studies`, `/portfolio` | `client_projects` (internal operational) |
| **28. Social Reels CMS** | `public.social_reels` | `id` (UUID) | None | `content-service.ts` | `/admin/reels`, Public Hero | External Instagram embed cache |
| **29. Public Contact Inquiries** | `public.contact_submissions` | `id` (UUID) | `package_id $\rightarrow$ package_catalog(id)` | `smart-match-service.ts` | `/admin/contact` triage queue | Unrouted email notifications |

---

## 2. Invariant Guidelines for Verification

1. **Revenue Reality**: `public.income_transactions` (where `status = 'received'`) is the SOLE canonical source of actual cash inflows. Contracted retainers in `clients` or pending `invoices` represent commitments, not collected money.
2. **Package Hierarchy**: `public.package_catalog` is the SOLE canonical package definition. Legacy `public.packages` is deprecated and retained strictly for historical relational integrity.
3. **Task & Deliverable Lifecycle**: Task completion (`project_tasks.status = 'done'`) is determined solely by verified assignment and deliverable submission, never by child subtask counts or client status.
