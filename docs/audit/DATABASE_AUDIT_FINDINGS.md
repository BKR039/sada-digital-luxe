# SADA OS — Database Audit Findings & Source-of-Truth Discrepancies

**Audit Date:** 2026-10-10  
**Phase:** Phase 0 (Pre-MVP Testing Discovery & Baseline)  
**Status:** Read-Only Audit Complete. Zero code or schema modifications were made.

---

## Executive Priority Summary

| Risk ID | Severity | Category | Discovered Condition | Impact on MVP | Recommended Resolution |
| :--- | :---: | :--- | :--- | :--- | :--- |
| **RISK-01** | **HIGH** | Schema Drift | `src/integrations/supabase/types.ts` contains only 35 tables, while the live database contains 53 verified tables. | TypeScript code interacting with newer tables (`business_rules`, `business_rule_versions`, `financial_audit_logs`, `rate_limit_buckets`, etc.) must use explicit type assertions or raw queries. | Run `supabase gen types typescript` to regenerate `types.ts` against the live database before Phase 1 testing. |
| **RISK-02** | **MEDIUM** | Competing Tables | `public.packages` (37 rows) exists alongside canonical `public.package_catalog` (39 rows). | Risk of queries accidentally reading outdated packages instead of master catalog. | Verified that all core foreign keys point to `package_catalog`. Maintain `packages` strictly as a read-only compatibility snapshot. |
| **RISK-03** | **MEDIUM** | Dual Identity | `public.profiles` (410 rows) and `public.team_members` (370 rows) both hold user display names and email addresses. | If a worker updates their profile name, `team_members` could drift unless synced. | Canonical worker operations must continue resolving worker identity via `profiles.id $\rightarrow$ team_members.profile_id`. |
| **RISK-04** | **LOW** | Empty Tables | 8 tables have 0 rows in the live database: `blog_posts`, `products`, `testimonials`, `production_bookings`, `client_communication_logs`, `push_subscriptions`, `reconciliation_audit_logs`, `task_handoffs`. | Corresponding UI pages will render empty states or require seeding during workflow testing. | Documented as expected for fresh/pruned production instances; verified that empty state UX handles 0 rows cleanly. |
| **RISK-05** | **LOW** | Entity Separation | `public.projects` (5 rows) vs `public.client_projects` (24 rows). | Ambiguity in naming between public case studies portfolio and private client workspaces. | Clarified: `public.projects` is strictly Public Portfolio CMS; `public.client_projects` is strictly Internal Operational Workspaces. |

---

## Detailed Forensic Analysis of Discrepancies

### Finding 1: Schema Drift in `types.ts` (35 vs 53 Tables)
- **Evidence:**
  - In `src/integrations/supabase/types.ts`: exactly 35 tables are defined under `Database['public']['Tables']`.
  - In PostgreSQL catalog / live PostgREST queries: exactly 53 tables exist and respond with data.
  - The 18 unrepresented tables are:
    1. `business_rules`
    2. `business_rule_versions`
    3. `financial_audit_logs`
    4. `rate_limit_buckets`
    5. `user_sessions`
    6. `security_alerts`
    7. `push_subscriptions`
    8. `service_commitments`
    9. `package_catalog`
    10. `package_categories`
    11. `package_addons`
    12. `workflow_templates`
    13. `workflow_stages`
    14. `reconciliation_audit_logs`
    15. `task_handoffs`
    16. `site_settings`
    17. `social_reels`
    18. `financial_closing_periods`
- **Impact:** Application services define manual TypeScript interfaces (e.g. `BusinessRuleRecord`, `UserSessionRecord`) to bridge this gap, which work perfectly at runtime but create a drift surface between generated types and live schema.

### Finding 2: Package Catalog Hierarchy vs Legacy Packages
- **Evidence:**
  - Migration `20261001103000_migrate_packages_foreign_keys_to_package_catalog.sql` migrated all foreign keys from `packages` to `package_catalog`.
  - In the live database: `package_catalog` contains 39 canonical rows, while `packages` contains 37 historical rows.
  - Public Pricing and Deals correctly query `package_catalog`.
- **Verdict:** `package_catalog` is confirmed as the sole canonical source of truth.

### Finding 3: Financial Cash Ledger vs Invoicing
- **Evidence:**
  - `public.income_transactions` contains 12 cash receipts (3,000 TND in October 2026).
  - `public.invoices` contains 6 issued invoices (e.g. `INV-TEST-nh6y3` for 2,300 TND pending).
- **Verdict:** This is a mathematically valid separation between Cash-Basis Accounting (`income_transactions`) and Accrual Invoicing (`invoices`). There is zero double-counting in Financial OS KPIs.
