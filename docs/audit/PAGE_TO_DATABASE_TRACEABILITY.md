# SADA OS — Page-to-Database Traceability Matrix

**Audit Date:** 2026-10-10  
**Total Routes Analyzed:** 60  
**Classification Guide:**
- `VERIFIED_CANONICAL_SOURCE`: Directly consumes authoritative PostgreSQL tables and RPCs via verified services.
- `VERIFIED_DERIVED_PROJECTION`: Directly derives metrics or redirects to canonical endpoints.
- `HARDCODED_OR_MOCKED`: Static marketing copy or in-memory presentation.
- `DUPLICATE_OR_COMPETING_SOURCE`: Queries legacy or competing tables.

---

## Complete Route Traceability Table

| Route Path | File Path | Status | Authoritative Tables Read | Authoritative Tables Written | Database Functions / RPCs | Business Rules Evaluated |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `/about` | `about.tsx` | `VERIFIED_CANONICAL_SOURCE` | `team_members` | — | — | — |
| `/admin/accounts` | `admin.accounts.tsx` | `VERIFIED_CANONICAL_SOURCE` | `profiles`, `user_module_permissions`, `system_audit_logs`, `team_members`, `user_roles`, `security_alerts`, `account_audit_logs` | `system_audit_logs`, `user_sessions`, `security_alerts` | `admin_list_accounts`, `admin_get_auth_user_id_by_email`, `admin_reset_account_password`, `admin_provision_account`, `admin_delete_account`, `admin_update_account`, `admin_suspend_account_with_sessions`, `admin_reactivate_account_with_security`, `admin_analyze_account_dependencies`, `admin_list_account_audit_logs`, `admin_update_account_permissions`, `resolve_and_link_current_team_member`, `get_team_member_id`, `register_user_session`, `record_session_heartbeat`, `verify_session_and_account`, `admin_get_security_kpis`, `admin_list_user_sessions`, `admin_revoke_session`, `admin_revoke_all_user_sessions`, `record_failed_sign_in_attempt` | — |
| `/admin/analytics` | `admin.analytics.tsx` | `VERIFIED_CANONICAL_SOURCE` | `package_catalog`, `project_tasks`, `work_sessions`, `team_members`, `deals`, `production_bookings`, `client_deliverables`, `client_projects`, `system_audit_logs`, `profiles`, `user_roles` | `system_audit_logs`, `user_sessions` | `resolve_and_link_current_team_member`, `get_team_member_id` | — |
| `/admin/blog/:id` | `admin.blog.$id.tsx` | `VERIFIED_CANONICAL_SOURCE` | `team_members`, `profiles`, `user_roles`, `blog_posts` | `user_sessions`, `blog_posts` | `resolve_and_link_current_team_member`, `get_team_member_id` | — |
| `/admin/blog` | `admin.blog.index.tsx` | `VERIFIED_CANONICAL_SOURCE` | `team_members`, `profiles`, `user_roles`, `site_settings`, `blog_posts` | `user_sessions`, `site_settings`, `blog_posts` | `resolve_and_link_current_team_member`, `get_team_member_id` | — |
| `/admin/blog` | `admin.blog.tsx` | `HARDCODED_OR_MOCKED` | — | — | — | — |
| `/admin/business-rules` | `admin.business-rules.tsx` | `VERIFIED_CANONICAL_SOURCE` | `team_members`, `profiles`, `user_roles`, `project_tasks`, `business_rule_versions`, `salary_requests`, `deals`, `business_rules` | `user_sessions`, `business_rules` | `resolve_and_link_current_team_member`, `get_team_member_id`, `reset_business_rule_to_default` | `sponsoring_purchase_rate`, `sponsoring_client_rate`, `low_profit_client_margin_percent`, `client_medium_profit_margin_percent`, `client_high_profit_margin_percent`, `client_high_profit_amount_tnd`, `client_medium_profit_amount_tnd`, `task_due_soon_days` |
| `/admin/calendar` | `admin.calendar.tsx` | `VERIFIED_CANONICAL_SOURCE` | `team_members`, `profiles`, `user_roles`, `project_tasks`, `project_activity`, `client_projects`, `task_handoffs` | `user_sessions`, `project_activity`, `project_tasks` | `resolve_and_link_current_team_member`, `get_team_member_id` | — |
| `/admin/client-projects/:id` | `admin.client-projects.$id.tsx` | `VERIFIED_CANONICAL_SOURCE` | `client_projects` | — | — | — |
| `/admin/client-projects` | `admin.client-projects.index.tsx` | `VERIFIED_DERIVED_PROJECTION` | — | — | — | — |
| `/admin/client-projects` | `admin.client-projects.tsx` | `VERIFIED_DERIVED_PROJECTION` | — | — | — | — |
| `/admin/client-workspaces/:id` | `admin.client-workspaces.$id.tsx` | `VERIFIED_CANONICAL_SOURCE` | `team_members`, `profiles`, `user_roles`, `business_rules`, `business_rule_versions`, `clients`, `project_tasks`, `client_projects`, `client_deliverables`, `service_commitments`, `package_catalog`, `deals`, `sales_commissions`, `production_bookings`, `invoices`, `sponsoring_campaigns`, `income_transactions`, `expense_transactions`, `financial_accounts`, `expense_categories` | `user_sessions`, `business_rules`, `clients`, `client_deliverables`, `project_tasks`, `reconciliation_audit_logs`, `service_commitments`, `deals`, `invoices`, `sales_commissions`, `client_projects`, `production_bookings` | `resolve_and_link_current_team_member`, `get_team_member_id`, `reset_business_rule_to_default`, `convert_lead_to_sale` | `initial_commission_rate`, `initial_commission_duration_months`, `renewal_commission_rate`, `upsell_commission_rate` |
| `/admin/client-workspaces` | `admin.client-workspaces.index.tsx` | `VERIFIED_CANONICAL_SOURCE` | `team_members`, `profiles`, `user_roles`, `business_rules`, `business_rule_versions`, `clients`, `project_tasks`, `client_projects`, `client_deliverables`, `package_categories`, `package_catalog`, `package_addons`, `invoices`, `sponsoring_campaigns` | `user_sessions`, `business_rules`, `clients`, `client_deliverables`, `project_tasks`, `reconciliation_audit_logs`, `package_catalog`, `package_addons`, `package_categories`, `client_projects` | `resolve_and_link_current_team_member`, `get_team_member_id`, `reset_business_rule_to_default` | — |
| `/admin/client-workspaces` | `admin.client-workspaces.tsx` | `HARDCODED_OR_MOCKED` | — | — | — | — |
| `/admin/clients/:id` | `admin.clients.$id.tsx` | `HARDCODED_OR_MOCKED` | — | — | — | — |
| `/admin/clients` | `admin.clients.index.tsx` | `HARDCODED_OR_MOCKED` | — | — | — | — |
| `/admin/clients` | `admin.clients.tsx` | `HARDCODED_OR_MOCKED` | — | — | — | — |
| `/admin/commissions` | `admin.commissions.tsx` | `VERIFIED_DERIVED_PROJECTION` | — | — | — | — |
| `/admin/contact` | `admin.contact.tsx` | `VERIFIED_CANONICAL_SOURCE` | `team_members`, `profiles`, `user_roles`, `contact_submissions` | `user_sessions`, `contact_submissions` | `resolve_and_link_current_team_member`, `get_team_member_id` | — |
| `/admin/deals` | `admin.deals.tsx` | `VERIFIED_DERIVED_PROJECTION` | — | — | — | — |
| `/admin/finance` | `admin.finance.tsx` | `VERIFIED_CANONICAL_SOURCE` | `team_members`, `profiles`, `user_roles`, `income_transactions`, `expense_transactions`, `expense_categories`, `subscriptions`, `salary_records`, `salary_payments`, `salary_requests`, `invoices`, `sponsoring_campaigns`, `sales_commissions`, `financial_accounts`, `financial_closing_periods`, `clients`, `financial_audit_logs`, `work_sessions`, `client_projects` | `user_sessions`, `financial_audit_logs`, `income_transactions`, `financial_accounts`, `expense_transactions`, `salary_records`, `salary_payments`, `salary_requests`, `sponsoring_campaigns`, `invoices`, `sales_commissions`, `financial_closing_periods`, `subscriptions` | `resolve_and_link_current_team_member`, `get_team_member_id` | `sponsoring_purchase_rate`, `sponsoring_client_rate`, `initial_commission_rate`, `client_high_profit_amount_tnd`, `client_high_profit_margin_percent`, `low_profit_client_margin_percent`, `minimum_net_margin_for_sponsoring_efficiency`, `high_commission_amount`, `high_fixed_burn_revenue_percent`, `max_salary_advance_percent` |
| `/admin` | `admin.index.tsx` | `VERIFIED_CANONICAL_SOURCE` | `package_catalog`, `project_tasks`, `work_sessions`, `team_members`, `deals`, `production_bookings`, `client_deliverables`, `client_projects`, `profiles`, `user_roles`, `clients`, `sales_commissions` | `user_sessions`, `project_tasks`, `project_activity` | `resolve_and_link_current_team_member`, `get_team_member_id` | — |
| `/admin/my-salary` | `admin.my-salary.tsx` | `VERIFIED_CANONICAL_SOURCE` | `team_members`, `profiles`, `user_roles`, `business_rules`, `business_rule_versions`, `income_transactions`, `expense_transactions`, `expense_categories`, `subscriptions`, `salary_records`, `salary_payments`, `salary_requests`, `invoices`, `sponsoring_campaigns`, `sales_commissions`, `financial_accounts`, `financial_closing_periods`, `clients`, `financial_audit_logs`, `work_sessions` | `user_sessions`, `business_rules`, `financial_audit_logs`, `income_transactions`, `financial_accounts`, `expense_transactions`, `salary_records`, `salary_payments`, `salary_requests`, `sponsoring_campaigns`, `invoices`, `sales_commissions`, `financial_closing_periods`, `subscriptions` | `resolve_and_link_current_team_member`, `get_team_member_id`, `reset_business_rule_to_default` | `sponsoring_purchase_rate`, `sponsoring_client_rate`, `initial_commission_rate`, `client_high_profit_amount_tnd`, `client_high_profit_margin_percent`, `low_profit_client_margin_percent`, `minimum_net_margin_for_sponsoring_efficiency`, `high_commission_amount`, `high_fixed_burn_revenue_percent`, `max_salary_advance_percent` |
| `/admin/my-work` | `admin.my-work.tsx` | `VERIFIED_CANONICAL_SOURCE` | `team_members`, `profiles`, `user_roles`, `project_tasks`, `project_activity`, `business_rules`, `workflow_templates`, `clients`, `client_projects` | `user_sessions`, `project_activity`, `project_tasks`, `business_rules`, `workflow_templates` | `resolve_and_link_current_team_member`, `get_team_member_id` | — |
| `/admin/packages` | `admin.packages.tsx` | `VERIFIED_CANONICAL_SOURCE` | `team_members`, `profiles`, `user_roles`, `package_categories`, `package_catalog`, `package_addons` | `user_sessions`, `package_catalog`, `package_addons`, `package_categories` | `resolve_and_link_current_team_member`, `get_team_member_id` | — |
| `/admin/products/:id` | `admin.products.$id.tsx` | `VERIFIED_CANONICAL_SOURCE` | `team_members`, `profiles`, `user_roles`, `products` | `user_sessions`, `products` | `resolve_and_link_current_team_member`, `get_team_member_id` | — |
| `/admin/products` | `admin.products.index.tsx` | `VERIFIED_CANONICAL_SOURCE` | `team_members`, `profiles`, `user_roles`, `products` | `user_sessions`, `products` | `resolve_and_link_current_team_member`, `get_team_member_id` | — |
| `/admin/products` | `admin.products.tsx` | `HARDCODED_OR_MOCKED` | — | — | — | — |
| `/admin/projects/:id` | `admin.projects.$id.tsx` | `VERIFIED_CANONICAL_SOURCE` | `team_members`, `profiles`, `user_roles`, `testimonials`, `projects` | `user_sessions`, `projects`, `testimonials` | `resolve_and_link_current_team_member`, `get_team_member_id` | — |
| `/admin/projects` | `admin.projects.index.tsx` | `VERIFIED_CANONICAL_SOURCE` | `team_members`, `profiles`, `user_roles`, `projects` | `user_sessions`, `projects` | `resolve_and_link_current_team_member`, `get_team_member_id` | — |
| `/admin/projects` | `admin.projects.tsx` | `HARDCODED_OR_MOCKED` | — | — | — | — |
| `/admin/reels` | `admin.reels.tsx` | `VERIFIED_CANONICAL_SOURCE` | `team_members`, `profiles`, `user_roles`, `social_reels` | `user_sessions`, `social_reels` | `resolve_and_link_current_team_member`, `get_team_member_id` | — |
| `/admin/salary` | `admin.salary.tsx` | `VERIFIED_DERIVED_PROJECTION` | — | — | — | — |
| `/admin/sales` | `admin.sales.tsx` | `HARDCODED_OR_MOCKED` | — | — | — | — |
| `/admin/settings/business-rules` | `admin.settings.business-rules.tsx` | `HARDCODED_OR_MOCKED` | — | — | — | — |
| `/admin/team-workload` | `admin.team-workload.tsx` | `VERIFIED_CANONICAL_SOURCE` | `team_members`, `profiles`, `user_roles`, `project_tasks`, `client_projects` | `user_sessions`, `project_tasks` | `resolve_and_link_current_team_member`, `get_team_member_id` | — |
| `/admin/testimonials/:id` | `admin.testimonials.$id.tsx` | `VERIFIED_CANONICAL_SOURCE` | `team_members`, `profiles`, `user_roles`, `clients`, `projects`, `testimonials` | `user_sessions`, `testimonials` | `resolve_and_link_current_team_member`, `get_team_member_id` | — |
| `/admin/testimonials` | `admin.testimonials.index.tsx` | `VERIFIED_CANONICAL_SOURCE` | `team_members`, `profiles`, `user_roles`, `testimonials`, `projects` | `user_sessions`, `testimonials` | `resolve_and_link_current_team_member`, `get_team_member_id` | — |
| `/admin/testimonials` | `admin.testimonials.tsx` | `HARDCODED_OR_MOCKED` | — | — | — | — |
| `/admin` | `admin.tsx` | `VERIFIED_CANONICAL_SOURCE` | `team_members`, `profiles`, `user_roles` | `user_sessions` | `resolve_and_link_current_team_member`, `get_team_member_id` | — |
| `/admin/workflow-templates` | `admin.workflow-templates.tsx` | `VERIFIED_CANONICAL_SOURCE` | `team_members`, `profiles`, `user_roles`, `business_rules`, `workflow_templates`, `project_tasks` | `user_sessions`, `business_rules`, `workflow_templates`, `project_tasks`, `project_activity` | `resolve_and_link_current_team_member`, `get_team_member_id` | — |
| `/auth` | `auth.tsx` | `VERIFIED_CANONICAL_SOURCE` | `team_members`, `profiles`, `user_roles` | `user_sessions` | `resolve_and_link_current_team_member`, `get_team_member_id` | — |
| `/blog/:slug` | `blog.$slug.tsx` | `VERIFIED_CANONICAL_SOURCE` | `site_settings`, `blog_posts` | — | — | — |
| `/blog` | `blog.tsx` | `VERIFIED_CANONICAL_SOURCE` | `site_settings`, `blog_posts` | — | — | — |
| `/case-studies/:slug` | `case-studies.$slug.tsx` | `VERIFIED_CANONICAL_SOURCE` | `team_members`, `profiles`, `user_roles`, `projects`, `testimonials` | `user_sessions` | `resolve_and_link_current_team_member`, `get_team_member_id` | — |
| `/case-studies` | `case-studies.index.tsx` | `VERIFIED_CANONICAL_SOURCE` | `projects` | — | — | — |
| `/case-studies` | `case-studies.tsx` | `HARDCODED_OR_MOCKED` | — | — | — | — |
| `/contact` | `contact.tsx` | `HARDCODED_OR_MOCKED` | — | — | — | — |
| `/` | `index.tsx` | `HARDCODED_OR_MOCKED` | — | — | — | — |
| `/portfolio/:slug` | `portfolio.$slug.tsx` | `VERIFIED_DERIVED_PROJECTION` | — | — | — | — |
| `/portfolio` | `portfolio.tsx` | `VERIFIED_DERIVED_PROJECTION` | — | — | — | — |
| `/pricing` | `pricing.tsx` | `VERIFIED_CANONICAL_SOURCE` | `package_categories`, `package_catalog`, `package_addons` | `package_catalog`, `package_addons`, `package_categories` | — | — |
| `/products/:id` | `products.$id.tsx` | `HARDCODED_OR_MOCKED` | — | — | — | — |
| `/products` | `products.tsx` | `HARDCODED_OR_MOCKED` | — | — | — | — |
| `/reset-password` | `reset-password.tsx` | `VERIFIED_CANONICAL_SOURCE` | `team_members`, `profiles`, `user_roles` | `user_sessions` | `resolve_and_link_current_team_member`, `get_team_member_id` | — |
| `/sada-os` | `sada-os.tsx` | `VERIFIED_CANONICAL_SOURCE` | `team_members`, `profiles`, `user_roles` | `user_sessions` | `resolve_and_link_current_team_member`, `get_team_member_id` | — |
| `/services` | `services.tsx` | `VERIFIED_CANONICAL_SOURCE` | `projects` | — | — | — |
| `/store/:id` | `store.$id.tsx` | `VERIFIED_CANONICAL_SOURCE` | `products` | — | — | — |
| `/store` | `store.tsx` | `VERIFIED_CANONICAL_SOURCE` | `products` | — | — | — |
| `/__root` | `__root.tsx` | `VERIFIED_CANONICAL_SOURCE` | `team_members`, `profiles`, `user_roles` | `user_sessions` | `resolve_and_link_current_team_member`, `get_team_member_id` | — |

---

## Detailed Page Deep Dives (Primary Operational Modules)

### 1. Unified Accounts & Security Workspace (`/admin/accounts`)
- **Route File:** `src/routes/admin.accounts.tsx`
- **Components:** `AccountDetailsDrawer`, `AccountPermissionsPanel`, `AccountSessionsPanel`, `AccountActivityTimeline`, `SecurityControlCenterNav`
- **Services:** `account-service.ts`, `security-center-service.ts`, `security-isolation-service.ts`
- **Tables Read:** `profiles`, `user_roles`, `user_module_permissions`, `user_sessions`, `security_alerts`, `system_audit_logs`, `account_audit_logs`
- **Tables Written:** `profiles`, `user_roles`, `user_module_permissions`, `user_sessions`, `system_audit_logs`, `account_audit_logs`
- **RPCs:** `admin_list_accounts`, `admin_update_account`, `admin_update_account_permissions`, `admin_revoke_session`, `admin_revoke_all_user_sessions`, `admin_suspend_account_with_sessions`, `admin_reactivate_account_security`
- **Status:** `VERIFIED_CANONICAL_SOURCE`

### 2. SADA Intelligence Executive Command Center (`/admin/analytics`)
- **Route File:** `src/routes/admin.analytics.tsx`
- **Components:** `ExecutiveCommandStrip`, `FinancialDynamicsChart`, `OperationsPipelineSection`, `ClientProfitabilityMatrix`, `ExecutiveBriefingCard`
- **Services:** `analytics-service.ts`, `finance-service.ts`, `client-service.ts`, `business-rules-intelligence-service.ts`
- **Tables Read:** `income_transactions`, `expense_transactions`, `financial_accounts`, `clients`, `client_projects`, `project_tasks`, `team_members`, `business_rules`
- **Tables Written:** None (strictly read-only analytical aggregation)
- **Status:** `VERIFIED_CANONICAL_SOURCE`

### 3. Business Rules Intelligence & Governance (`/admin/business-rules`)
- **Route File:** `src/routes/admin.business-rules.tsx`
- **Components:** `RuleCard`, `AdvancedRuleEditorModal`, `RuleContradictionBanner`, `RiskDistributionBar`
- **Services:** `business-rules-service.ts`, `business-rules-intelligence-service.ts`
- **Tables Read:** `business_rules`, `business_rule_versions`, `income_transactions`, `subscriptions`, `financial_accounts`, `project_tasks`
- **Tables Written:** `business_rules`, `business_rule_versions`
- **Status:** `VERIFIED_CANONICAL_SOURCE`

### 4. Client 360 & Client Workspaces (`/admin/client-workspaces/$id`)
- **Route File:** `src/routes/admin.client-workspaces.$id.tsx`
- **Components:** `Client360NavWrapper`, `ClientOverviewTab`, `ClientDeliverablesTab`, `ClientFinancialLedgerTab`, `ClientTasksTab`
- **Services:** `client-service.ts`, `finance-service.ts`, `task-execution-service.ts`, `package-reconciliation-service.ts`
- **Tables Read:** `clients`, `client_projects`, `client_deliverables`, `project_tasks`, `service_commitments`, `invoices`, `income_transactions`, `expense_transactions`, `sponsoring_campaigns`
- **Tables Written:** `clients`, `client_projects`, `client_deliverables`, `project_tasks`, `invoices`, `income_transactions`
- **Status:** `VERIFIED_CANONICAL_SOURCE`

### 5. Sales Pipeline Command Center (`/admin/sales`)
- **Route File:** `src/routes/admin.sales.tsx`
- **Components:** `SalesPipelineBoard`, `DealCard`, `ConvertToSaleModal`, `CreateLeadModal`
- **Services:** `sales-service.ts`, `package-service.ts`
- **Tables Read:** `deals`, `package_catalog`, `clients`, `team_members`, `sales_commissions`
- **Tables Written:** `deals`, `sales_commissions`, `clients`
- **RPCs:** `convert_lead_to_sale`
- **Status:** `VERIFIED_CANONICAL_SOURCE`
