# SADA Known Issues

Every discovered problem, recorded and never hidden. Update Status as issues are worked; don't delete resolved ones — mark them Resolved with the date/decision that fixed them.

---

**Feature:** SADA OS — User Accounts & Security: Credentials Vault, Password Visibility & Single Source of Truth
**Issue:** `DEF-ACCOUNT-AUTH-01` (Password Visibility & Secondary Device Login Failure):
- **Direct Cause**: Account `boubakarhamedsgail@gmailcom` was created with a typographical error (missing `.com`). When attempting to sign in on another device with `...@gmail.com`, Supabase GoTrue Auth failed with `Invalid login credentials`. Furthermore, `AccountDetailsDrawer.tsx` locked the email input as read-only, preventing administrators from correcting typos.
- **Secondary Factor**: `AccountSecurityPanel.tsx` lacked any mechanism to display or retrieve the current active password once set, and duplicate roles in `user_roles` caused accounts to appear multiple times in the account table.
**Priority:** P0 (Authentication, Credential Visibility & Single Source of Truth)
**Status:** Resolved (2026-10-21) — Forward migration `20261021140000_account_credentials_vault_and_single_source_of_truth.sql` applied to Supabase database. Created RLS-isolated `public.account_credentials` vault, updated `admin_reset_account_password` and `admin_list_accounts`, added `admin_update_account_email`, enforced `UNIQUE(user_id)` on `user_roles`, and added dedicated **Authoritative Current Password** display with Eye/Copy controls in `AccountSecurityPanel.tsx` alongside an editable, synchronized Email field in `AccountDetailsDrawer.tsx`. Certified in `scripts/test-password-vault-and-sync.ts`.

---

**Feature:** SADA OS — User Accounts & Security: Permanent Account Deletion Blocked by Historical Session Immutability
**Issue:** `DEF-ACCOUNT-DEL-02` (Permanent Account Deletion Blocked by Session Immutability Trigger): In Admin → User Accounts & Security → Emergency & Danger, attempting to permanently delete an account that has session history failed with error banner: `'Historical session records are immutable and cannot be deleted.'`
- **Direct Cause**: When Super Admin initiated `deleteAccount(userId)`, the database function `admin_delete_account(UUID)` executed `DELETE FROM public.user_sessions WHERE user_id = _user_id;`. The trigger `trg_prevent_delete_user_sessions` fired before delete and invoked `prevent_delete_user_sessions()`, which unconditionally threw `RAISE EXCEPTION 'Historical session records are immutable and cannot be deleted.'` with zero exception for administrative account purges.
- **Secondary Factor**: Even without direct session deletion, `public.user_sessions.user_id` has constraint `REFERENCES auth.users(id) ON DELETE CASCADE`. When `DELETE FROM auth.users WHERE id = _user_id;` executed, the cascade fired the same trigger and threw the same exception. Additionally, `prevent_delete_user_sessions()` lacked `SECURITY DEFINER`, causing cascading checks on `auth.users` to fail with permission errors for authenticated callers.
**Priority:** P0 (Administrative Lifecycle & Security Defect)
**Status:** Resolved (2026-10-21) — Forward migrations `20261021120000_fix_session_immutability_account_deletion.sql`, `20261021124500_harden_guard_profiles_and_reactivate.sql`, and `20261021130000_make_prevent_delete_user_sessions_security_definer.sql` applied to remote Supabase database. `prevent_delete_user_sessions()` updated to `SECURITY DEFINER` and permits deletion during administrative account purges (`sada.in_account_deletion = 'true'`), by Super Admins (`is_super_admin(auth.uid())`), by `service_role`, or when the parent auth user no longer exists. Direct `DELETE` attempts by non-super-admins remain strictly rejected by the trigger. `admin_delete_account` sets transaction-local deletion flag and cleans up all dependent records without cascade deadlock. Tested and certified.

---

**Feature:** SADA OS — Master Package Catalog: 5-Role Security Audit & RLS Permissive Combining Bypass
**Issue:** `DEF-PACKAGE-SEC-01` (PostgreSQL RLS Permissive Policy Combining Loopholes in Package Deletion):
1. **Root Cause**: During the 5-role security audit, it was discovered that PostgreSQL evaluates multiple permissive policies for the same role using boolean `OR`. The table had a policy `Package catalog manageable by admins` with `cmd = ALL` for `is_admin(auth.uid()) OR is_super_admin(auth.uid())`, alongside a targeted `Package catalog deletable by super_admin only` policy with `cmd = DELETE` for `is_super_admin(auth.uid())`. Because the `ALL` policy covered `DELETE` and was permissive, ordinary `admin` users were able to execute `DELETE` statements, bypassing the Super Admin restriction.
2. **Resolution**: Executed DDL dropping the redundant `Package catalog manageable by admins` policy (`DROP POLICY IF EXISTS "Package catalog manageable by admins" ON package_catalog`). Table permissions for admins are now governed by explicit granular policies: `Packages insertable by admins` (`WITH CHECK (is_admin OR is_super_admin)`), `Packages updatable by admins` (`USING/CHECK (is_admin OR is_super_admin)`), and `Package catalog deletable by super_admin only` (`USING (is_super_admin)`).
3. **Verification**: Executed 5-role test suite `scripts/test-all-5-roles-security.ts`. Ordinary Admin is now strictly blocked from deleting packages (`[PASS] Admin is BLOCKED from deleting packages (Super Admin only)`), while Super Admin retains delete authority.
**Priority:** P1 (Role Privilege Separation & Data Deletion Safety)
**Status:** Resolved (2026-10-20) — Policy dropped; verified across 28/28 assertions in `scripts/test-all-5-roles-security.ts`.

---

**Feature:** SADA OS — Master Package Catalog: Data Integrity Post-Implementation Audit & RLS Isolation
**Issue:** `DEF-PACKAGE-AUDIT-01` (Production Packages Posts Mismatch & RLS SELECT Policy Hardening):
1. **Field Mismatch**: In production/shooting packages (`PR-01`, `PR-02`, `PR-03`, `PR-04`, `PUB-OD-01`, `PUB-OD-02`, `PUB-OD-03`), `monthly_posts` was populated as 15, 20, 25, 35 because the initial migration author mapped photo deliverables into the posts column. Pure production packages explicitly exclude Social Media Management and Publishing (0 posts).
2. **RLS Policy Looseness**: The initial SELECT policy `Public packages viewable` contained `OR (auth.role() = 'authenticated'::text)`, allowing any authenticated non-admin user (e.g. client accounts) to query internal packages and unapproved proposals. Furthermore, calling `is_super_admin` in the shared public policy raised permission exceptions for anonymous callers who lacked EXECUTE privileges on admin functions.
3. **Smart Matcher Projection**: `PUBLIC_PACKAGE_SELECT` omitted `approval_status`, causing client-side memory filters in `smart-match-service.ts` to reject approved public packages when tested.
**Priority:** P1 (Catalog Data Fidelity & Multi-Tenant Security)
**Status:** Resolved (2026-10-20) — Migration `20261020150000_reconcile_package_catalog_integrity.sql` applied. `monthly_posts` reset to 0 for pure production sessions. RLS SELECT policy split into role-specific policies: `Public packages viewable by anon` strictly limits anonymous queries to approved, published public packages without invoking admin helpers; `Packages viewable by authenticated` restricts internal/draft access to verified admins. Write permissions revoked from `anon`. `PUBLIC_PACKAGE_SELECT` updated. Certified across 67/67 assertions in `certify-package-catalog-suite.ts` and 19/19 assertions in `test-comprehensive-security.ts`.

---

**Feature:** SADA OS — User Accounts & Security: Permanent Account Deletion & Audit Immutability Trigger Conflict
**Issue:** `DEF-ACCOUNT-DEL-01` (Permanent Deletion Blocked by Audit Immutability Trigger): In Admin → User Accounts & Security → Emergency & Danger, attempting to permanently delete test account `test.client.schema.1792416191404@sada.agency` failed with error: `Audit records are immutable and cannot be modified.`
- **Direct Cause**: When deleting the account from `auth.users`, the foreign keys on `public.system_audit_logs.actor_id` and `public.account_audit_logs.actor_id` cascaded via `ON DELETE SET NULL`. Statement-level `BEFORE UPDATE` triggers `trg_prevent_update_system_audit` and `trg_prevent_update_account_audit` fired unconditionally and called `prevent_audit_log_update()`, which threw the immutable-audit exception even though the schema explicitly defines `ON DELETE SET NULL`.
- **Secondary Factor**: Migration drift on the remote Supabase database (migrations from `20261014220000` to `20261019140000` were pending), and `admin_analyze_account_dependencies` was treating actor audit history as a blocking operational dependency instead of non-blocking telemetry.
**Priority:** P0 (Administrative Lifecycle & Security Defect)
**Status:** Resolved (2026-10-20) — Forward migration `20261020120000_fix_account_deletion_audit_immutability.sql` pushed to remote database. Triggers converted to `FOR EACH ROW`. `prevent_audit_log_update()` updated to permit exclusively the schema-defined `ON DELETE SET NULL` referential action (`OLD.actor_id IS NOT NULL AND NEW.actor_id IS NULL`) while asserting all audit content remains identical. Direct `UPDATE` and `DELETE` on audit tables remain strictly blocked. `admin_analyze_account_dependencies` and `admin_delete_account` refactored to isolate financial/business dependencies from audit telemetry. Target test account successfully purged from `auth.users`, profiles, and user_roles, while audit history remains intact with `actor_id = NULL`.
**Resolution:**
1. Applied migration `20261020120000_fix_account_deletion_audit_immutability.sql` and pushed pending migrations to remote Supabase database.
2. In `prevent_audit_log_update()`, added conditional check: if `OLD.actor_id IS NOT NULL AND NEW.actor_id IS NULL` AND all other columns (`action`, `created_at`, `entity_type`, `entity_id`, `actor_name`, `actor_email`, `metadata`, `old_values`, `new_values`) are strictly identical, allow the operation. Otherwise, raise `Audit records are immutable and cannot be modified.`
3. Converted update triggers to `FOR EACH ROW`.
4. Hardened `admin_analyze_account_dependencies` and `admin_delete_account` to distinguish protected financial dependencies (`salary_records`, `salary_payments`, `salary_requests`, `sales_commissions`) from audit telemetry.
5. Updated `src/lib/account-service.ts` and `src/components/admin/accounts/AccountDangerZone.tsx` to handle financial blocking states and show sales commissions in dependency audits.
6. Target test account `test.client.schema.1792416191404@sada.agency` was completely purged from `auth.users`. Its 3 historical system audit records remain intact with `actor_id = NULL`.
7. Full certification test suite `scripts/certify-account-deletion-suite.ts` passed 14/14 tests.
8. `npx tsc --noEmit` and `npm run build` passed with zero errors.

---

**Feature:** SADA OS — Client Lifecycle Management: Table Actions Overflow & Test Fixtures Residual
**Issue:** Two defects were identified post-implementation in Admin → Client Workspaces:
1. `DEF-CLIENT-UI-01` (Action Controls Clipping in Table View): In the Client Workspaces table, action controls were clipped near the right edge of each row. The amber archive button was partially or fully pushed off-screen. Cause: 3 separate buttons (`Archive`/`Restore`, `Delete Permanently`, `Open Client`) were packed horizontally into an 11% table column with `overflow-hidden`.
2. `DEF-CLIENT-DATA-01` (Residual Test Clients in Production Directory): The directory displayed leftover test fixtures (`SEC_TEST_*`, `OP_CLIENT_*`, `FIN_CLIENT_*`, `QA Test Client*`) and a duplicate `Janat Sahara` record. Cause: (a) test scripts `test-client-lifecycle-management.ts` and `test-client-creation-schema-fix.ts` lacked global `try/finally` blocks and terminated prematurely on uncaught assertion errors before executing teardown; (b) direct Supabase REST DELETE was blocked by relational foreign-key and RLS policies on `clients`.
**Priority:** P1 (UI Accessibility, Responsive Layout & Directory Cleanliness)
**Status:** Resolved (2026-10-19) — Actions UI redesigned with SADA `DropdownMenu` pattern (`MoreVertical`), table column widths expanded (`w-[13%]` desktop, `w-[15%]` tablet), 11 test/duplicate fixtures audited and permanently purged via `admin_delete_client_permanently`, authentic `Janat Sahara` preserved, and test suites hardened with `try/finally` fixture trackers.
**Resolution:**
1. In `src/routes/admin.client-workspaces.index.tsx`, kept `Open Client` as the primary visible action button; grouped secondary actions (`Archive`/`Restore`, and `Delete Client Permanently` for Super Admin) into a clean SADA `DropdownMenu` with `<MoreVertical className="size-3.5" />` trigger, matching `AccountsTable.tsx`. Added `aria-label` and `title` to all icon buttons.
2. Audited all 12 database records: confirmed 10 test fixtures and 1 duplicate `Janat Sahara` retry (created 26s after authentic record `bba95f6e-305f-4caf-bd4b-e03b50e6943a` with 0 dependencies). All 11 fixtures verified to have 0 financial dependencies via `admin_analyze_client_lifecycle` and purged via `admin_delete_client_permanently`.
3. Updated test scripts `test-client-lifecycle-management.ts` and `test-client-creation-schema-fix.ts` with `try/finally` blocks to track and guarantee permanent deletion of any created fixture even upon test failure.
4. Database verified clean: exactly 1 authentic active client remains (`Janat Sahara`, `bba95f6e-305f-4caf-bd4b-e03b50e6943a`).
5. All test suites verified: `npx tsc --noEmit` (0 errors), `scripts/test-client-lifecycle-management.ts` (100% pass), `scripts/test-client-creation-schema-fix.ts` (22/22 pass), `scripts/test-package-work-reconciliation-hardening.ts` (80/80 pass), `scripts/test-recurring-scheduling-hardening.ts` (54/54 pass), and `npm run build` (success).

---

**Feature:** SADA OS — Client Proof CMS & Attribution Verification MVP Audit & Runtime Certification
**Issue:** During the comprehensive MVP audit of `/admin/testimonials` (Admin Client Proof List), `/admin/testimonials/:id` (Editor), and the public website (`Testimonials.tsx` on `/` and `/case-studies/:slug`), 6 defects were identified and remediated:
1. `DEF-PROOF-01` (Service Boundary Bypass): Both `admin.testimonials.index.tsx` and `admin.testimonials.$id.tsx` performed raw Supabase mutations directly, bypassing centralized RBAC authorization, security isolation, and system audit logging.
2. `DEF-PROOF-02` (Catalog Table Quick-Publish Readiness Bypass): Clicking "Publish" directly in the catalog table row toggled `published = true` without validating the 4/4 readiness checklist, allowing unverified or incomplete drafts to be published.
3. `DEF-PROOF-03` (Design System Violations): `admin.testimonials.$id.tsx` contained 5 unstyled browser-native `<input>` and `<textarea>` controls, violating the SADA Design System.
4. `DEF-PROOF-04` (Untyped Database Queries): `testimonials` queries were un-typed or cast to `(supabase as any)` across routes.
5. `DEF-PROOF-05` (Dangerous Draft Default `published DEFAULT true`): The initial database schema defaulted `published` to `true`, risking accidental publication of unfinished records if the published flag was omitted.
6. `DEF-PROOF-06` (Arabic RTL Text Alignment): Arabic quotes in the storefront and catalog lacked explicit `dir="rtl"` attributes, causing quotation marks and punctuation to render with incorrect alignment.
**Priority:** P0 (Attribution Integrity, Public Trust & Design System Compliance)
**Status:** Resolved Locally (2026-10-18) — Remediated via forward migration `20261018230000_client_proof_cms_draft_default_and_hardening.sql`, centralized in `src/lib/content-service.ts`, SADA UI components integrated. Certified across 91/91 passing assertions in `scripts/certify-client-proof-cms.ts`. Verified PASS — LOCAL MVP VERIFIED.
**Resolution:**
1. Implemented complete testimonial service in `src/lib/content-service.ts` (`createTestimonial`, `updateTestimonial`, `publishTestimonial`, `setFeaturedTestimonial`, `deleteTestimonial`, `validateTestimonialReadiness`) with Super Admin exclusive deletion (`FORBIDDEN_DELETE`) and audit logging via `logSystemAudit`.
2. Hardened `handleTogglePublish` in `admin.testimonials.index.tsx` to run `validateTestimonialReadiness(t)` before flipping `published = true`.
3. Replaced all 5 native inputs and textareas in `admin.testimonials.$id.tsx` with `<SADAInput>` and `<SADATextarea>` from `@/components/ui/sada-input`.
4. Synchronized typings across `types.ts`, `content-service.ts`, and editor components.
5. Applied migration `20261018230000_client_proof_cms_draft_default_and_hardening.sql` altering `published` default to `false`.
6. Added `dir={t.language === 'ar' ? 'rtl' : 'ltr'}` to figure, blockquote, and editor textarea elements.
7. Verified with zero mutations on remote production database; certified on local PostgreSQL 16 test database (91/91 assertions passing, 100%).

---

**Feature:** SADA OS — Digital Products CMS & Gumroad Checkout Flow MVP Audit & Runtime Certification
**Issue:** During the comprehensive MVP audit of `/admin/products` (Admin Catalog), `/admin/products/:id` (Product Editor), and `/store` / `/store/:slug` (Public Storefront), 6 defects were identified and remediated:
1. `DEF-PROD-01` (Missing Multilingual Columns in Schema): `public.products` lacked 11 Arabic and presentation columns (`category_ar`, `target_audience_ar`, `cta_label_ar`, `seo_title_ar`, `seo_description_ar`, `name_ar`, etc.) in base migrations, risking database write failures when saving Arabic offers.
2. `DEF-PROD-02` (Unscoped Admin Products RLS Policies): Policies on `public.products` (`"Admins read all products"`, `"Admins insert products"`, `"Admins update products"`, `"Super admins delete products"`) lacked `TO authenticated`, causing Postgres to evaluate admin functions for unauthenticated visitors on `/store`.
3. `DEF-PROD-03` (Product CMS Service Layer Bypass): Both `admin.products.index.tsx` and `admin.products.$id.tsx` performed direct Supabase queries/mutations, bypassing `content-service.ts`, actor authorization checks, readiness validation, and audit logging.
4. `DEF-PROD-04` (SADA Design System Violations): `admin.products.$id.tsx` contained 13 unstyled browser-native `<input>` and `<textarea>` controls and `store.tsx` contained a raw search `<input>`, violating design system requirements.
5. `DEF-PROD-05` (Admin Products Arabic Search Omission): Catalog search filter only checked English `title`, `description`, `category`, and `slug`. Products with Arabic names (`title_ar`) could not be searched.
6. `DEF-PROD-06` (External Checkout URL Protocol Injection Hazard): `store.$id.tsx` rendered `gumroad_url` in `<a href={product.gumroad_url}>` without validating safe protocols (`http://` / `https://`), risking script or data scheme injection.
**Priority:** P0 (E-Commerce Catalog Integrity, Multilingual Parity & External Link Security)
**Status:** Resolved Locally (2026-10-18) — Remediated via forward migration `20261018220000_digital_products_cms_multilingual_and_rls_hardening.sql`, centralized in `src/lib/content-service.ts`, SADA UI components integrated. Certified across 100/100 passing assertions in `scripts/certify-digital-products-cms.ts`. Verified conditional pass pending remote migration gate.
**Resolution:**
1. Created forward-only migration `supabase/migrations/20261018220000_digital_products_cms_multilingual_and_rls_hardening.sql` with idempotent `ADD COLUMN IF NOT EXISTS` for all 11 missing columns, updated TypeScript types in `src/integrations/supabase/types.ts`.
2. Scoped admin policies on `public.products` to `TO authenticated` and verified table privileges (`GRANT SELECT ON public.products TO anon, authenticated;`).
3. Enhanced `src/lib/content-service.ts` with `createDigitalProduct`, `updateDigitalProduct`, `publishDigitalProduct`, `setFeaturedDigitalProduct`, `duplicateDigitalProduct`, `deleteDigitalProduct`, `validateGumroadUrl`, and `validateProductReadiness`. Re-routed all UI mutations through the service layer with audit logging.
4. Replaced all 13 native inputs/textareas in `admin.products.$id.tsx` and search input in `store.tsx` with `<SADAInput>` and `<SADATextarea>`.
5. Added `title_ar` and `description_ar` to `ProductRow` interface and search filter in `admin.products.index.tsx`, along with Arabic indicator badge (`عربي`) and secondary Arabic title preview.
6. Enforced strict protocol validation (`http://` or `https://` only) in `validateGumroadUrl` and added `rel="noopener noreferrer"` to checkout links in `store.$id.tsx`.
7. Verified with zero mutations on remote production database; certified on local PostgreSQL 16 test database (100/100 assertions passing, 100%).

---

---

**Feature:** SADA OS — Blog CMS & Publishing Engine MVP Audit & Runtime Certification
**Issue:** During the comprehensive MVP audit of `/admin/blog` (Admin Blog) and `/blog` (Public Blog), 6 defects were identified and remediated:
1. `DEF-BLOG-01` (Missing `category_ar` Column in Schema): `public.blog_posts` lacked `category_ar` in initial migrations, while `/blog/$slug` queries it for Arabic breadcrumbs and related articles, causing crashes on un-migrated databases.
2. `DEF-BLOG-02` (Unscoped Admin Blog RLS Policy): Admin/Super Admin RLS policies on `public.blog_posts` and `public.site_settings` lacked `TO authenticated`, evaluating `is_admin(auth.uid())` for anonymous visitors on `/blog` and causing `ERROR 42501` function evaluation failures.
3. `DEF-BLOG-03` (Blog CMS Service Layer Bypass): `admin.blog.index.tsx` and `admin.blog.$id.tsx` performed direct Supabase queries and mutations, bypassing `content-service.ts`, actor authorization, slug validation, and audit logging.
4. `DEF-BLOG-04` (Admin Blog Arabic Search Omission): `/admin/blog` listing search searched only English `title` and `excerpt`, failing to find articles queried by Arabic titles or summaries.
5. `DEF-BLOG-05` (SADA Design System Violation): Browser-native unstyled `<input>` and `<textarea>` controls were used in `admin.blog.$id.tsx` and `ContentShell.tsx` instead of SADA UI primitives.
6. `DEF-BLOG-06` (Scheduled Articles Leaking on Public Routes During Admin Sessions): Public loaders on `/blog` and `/blog/$slug` lacked strict client-side publication timestamp gates, allowing future-scheduled articles to be viewed during authenticated admin sessions without `?preview=true`.
**Priority:** P0 (Publishing Integrity, Multilingual Parity & RLS Security)
**Status:** Resolved Locally (2026-10-18) — Remediated via forward migration `20261018210000_blog_cms_multilingual_and_rls_hardening.sql`, centralized in `src/lib/content-service.ts`, SADA UI components integrated. Certified across 70/70 passing assertions in `scripts/certify-blog-cms-publishing.ts`. Verified conditional pass pending remote migration gate.
**Resolution:**
1. Created forward-only migration `supabase/migrations/20261018210000_blog_cms_multilingual_and_rls_hardening.sql` with idempotent `ADD COLUMN IF NOT EXISTS category_ar TEXT;`, updated TypeScript types in `src/integrations/supabase/types.ts`, and added defensive fallback queries in `src/routes/blog.tsx` and `src/routes/blog.$slug.tsx`.
2. Scoped admin policies on `public.blog_posts` and `public.site_settings` to `TO authenticated` and added table grants (`GRANT SELECT ON public.blog_posts TO anon, authenticated;`).
3. Centralized all mutations in `src/lib/content-service.ts` (`createBlogPost`, `updateBlogPost`, `publishBlogPost`, `setFeaturedBlogPost`, `deleteBlogPost`, `toggleBlogVisibility`) with slug validation and RBAC enforcement.
4. Added `title_ar` and `excerpt_ar` to `BlogRow` interface and search filter in `admin.blog.index.tsx`, along with Arabic indicator badge (`عربي`) and secondary Arabic title preview.
5. Replaced native inputs with `<SADAInput>`, `<SADATextarea>`, and `<SADASearch>` in `src/routes/admin.blog.$id.tsx` and `src/components/admin/content/ContentShell.tsx`.
6. Hardened `/blog` and `/blog/$slug` with strict publication timestamp checks (`published_at <= now()`), ensuring future-scheduled articles are strictly blocked unless accessed via `?preview=true`.
7. Verified with zero mutations on remote production database; certified on local PostgreSQL 16 test database (70/70 assertions passing, 100%).

---

**Feature:** SADA OS — Case Studies & Reels CMS MVP Audit & Runtime Certification
**Issue:** During the comprehensive MVP audit of `/admin/projects` (Case Studies) and `/admin/reels` (Reels CMS), 5 defects were identified and remediated:
1. `DEF-CMS-01` (Missing Project Arabic Columns & Schema Drift): `public.projects` lacked Arabic columns (`client_ar`, `industry_ar`, `category_ar`, `objective_ar`, `strategy_ar`, `process_ar`, `results_ar`) in earlier migrations, causing query failures when fetching multilingual project rows.
2. `DEF-CMS-02` (Unscoped Testimonials RLS Policy): Policy `"Admins read all testimonials"` on `public.testimonials` lacked `TO authenticated`, evaluating `is_admin(auth.uid())` for anonymous visitors on `/case-studies/$slug` and risking auth errors.
3. `DEF-CMS-03` (Reels CMS Service Layer Bypass & RBAC Evasion): `admin.reels.tsx` performed direct Supabase queries/mutations bypassing `content-service.ts`, audit logging, and `security-isolation-service.ts`.
4. `DEF-CMS-04` (Design System Violations / Native Controls): Unstyled browser-native `<input>` and `<textarea>` controls were used in `admin.reels.tsx` and `admin.projects.index.tsx` instead of SADA UI primitives.
5. `DEF-CMS-05` (Reels CMS Multilingual Omission): Reels CMS lacked inputs for `title_ar` and `description_ar` in the creation/edit modal and table view.
**Priority:** P0 (Database Stability, Access Control & Multi-tenant CMS Integrity)
**Status:** Resolved Locally (2026-10-18) — Remediated via forward migration `20261018200000_cms_multilingual_and_testimonials_rls_repair.sql`, centralized in `src/lib/content-service.ts` and `src/lib/security-isolation-service.ts`, SADA UI components integrated. Certified across 48/48 passing assertions in `scripts/certify-case-studies-reels-cms.ts`. Verified conditional pass pending remote migration gate.
**Resolution:**
1. Created forward-only migration `supabase/migrations/20261018200000_cms_multilingual_and_testimonials_rls_repair.sql` with idempotent `ADD COLUMN IF NOT EXISTS` for all 7 Arabic project columns, updated TypeScript types in `src/integrations/supabase/types.ts`, and added defensive fallback queries in `src/routes/case-studies.index.tsx`.
2. Scoped `"Admins read all testimonials"` policy `TO authenticated` in `20261018200000_cms_multilingual_and_testimonials_rls_repair.sql` and wrapped testimonial fetching in `case-studies.$slug.tsx` with defensive try/catch error handling.
3. Added `"social_reel"` to `SecurityResourceType` in `src/lib/security-isolation-service.ts` and created canonical methods (`createSocialReel`, `updateSocialReel`, `publishSocialReel`, `setFeaturedSocialReel`, `reorderSocialReels`, `deleteSocialReel`, `parseInstagramReelUrl`) in `src/lib/content-service.ts`. Re-routed all UI mutations through the service layer with actor authorization and audit logging.
4. Replaced native inputs with `<SADAInput>`, `<SADATextarea>`, and `<SADASearch>` in `src/routes/admin.reels.tsx` and `src/routes/admin.projects.index.tsx`.
5. Added Arabic Title and Arabic Caption fields with RTL badges in `src/routes/admin.reels.tsx`.
6. Verified with zero mutations on remote production database; certified on local PostgreSQL 16 test database (48/48 assertions passing, 100%).


**Feature:** SADA OS — Financial Command Center & Central Ledger Reconciliation & Remediation
**Issue:** During the comprehensive financial audit and runtime certification of `/admin/finance`, 8 defects were identified:
1. `DEFECT-FIN-01` (Internal Transfer Revenue/Expense Contamination): Internal transfers between accounts were not explicitly isolated in KPI aggregations, potentially distorting company revenue and expense totals.
2. `DEFECT-FIN-02` (Outstanding Receivables Understatement): `outstandingPayments` in `fetchCompanyFinance` subtracted global collections from uncollected invoices instead of evaluating unpaid balances ($\sum \text{totalAmount} - \text{paidAmount}$) on individual recognized invoices.
3. `DEFECT-FIN-03` (Sponsoring Media Purchase Non-Idempotency): `executeSponsoringPurchase` did not verify whether a campaign was already executed or if an expense record already existed, risking duplicate cash debits.
4. `DEFECT-FIN-04` (Invoice Payment Status & Residuals): `recordInvoicePayment` failed silently if `createIncome` encountered errors, and did not handle residual income allocation for invoice tax/service differences.
5. `DEFECT-FIN-05` (Commission & Salary Advance Double-Spend): `payCommission` and `approveSalaryRequest` lacked idempotency guards against concurrent duplicate payouts.
6. `DEFECT-FIN-06` (Local DB Client Propagation in Services): `fetchCompanyFinance` and period closure methods did not propagate test DB client overrides, failing on cloud credential checks during offline/local testing.
7. `DEFECT-FIN-07` (CSV Export Injection & Route Param Wiring): CSV transaction export concatenated strings directly without sanitizing formula injection characters (`=`, `+`, `-`, `@`) or passing ledger transactions from `admin.finance.tsx`.
8. `DEFECT-FIN-08` (Synthetic Demo Account Contamination): 70,000 TND in synthetic cash existed across 7 test accounts created by un-isolated test scripts on production.
**Priority:** P0 (Financial Integrity & Calculation Correctness)
**Status:** Resolved Locally (2026-10-18) — Certified across all 68 assertions in `scripts/certify-financial-command-center.ts`.
**Resolution:**
1. Unified transfer handling in `transferBetweenAccounts` with explicit `transaction_type = 'TRANSFER'` and `allocation = 'transfer'`, debiting source and crediting destination while preserving cash balance and excluding transfers from revenue/expense metrics.
2. Corrected `outstandingPayments` calculation to sum unpaid balances ($\sum \text{totalAmount} - \text{paidAmount}$) across non-cancelled, non-draft invoices.
3. Added idempotency guards on `campaign.executionStatus === 'completed'` and existing expense checks in `executeSponsoringPurchase`.
4. Hardened `recordInvoicePayment` to assert success on `createIncome`, generate residual income for fee/tax differences, and prevent duplicate payments.
5. Added status guards (`status === 'paid'`) and existing payment/expense verification in `payCommission` and `approveSalaryRequest`.
6. Propagated `options.clientOverride` through `resolveFinanceCallerContext` across all financial service methods.
7. Integrated `serializeCsv` from `@/lib/csv-utils` with formula injection escaping, UTF-8 BOM, and wired ledger rows from `admin.finance.tsx:228`.
8. Hardened `isDemoFinancialRecord` regex and `is_demo` flag to quarantine 70,000 TND synthetic demo cash without touching real client business records.

---

**Feature:** SADA OS — Pre-Deployment Compatibility: PostgREST RPC Function Overload Ambiguity Hazard
**Issue:** `DEFECT-P2-06`: In local `pg_proc` catalog, `admin_update_account` had both an 11-argument overload and a 12-argument overload (`_status TEXT DEFAULT NULL`), and `admin_provision_account` had both an 8-argument overload and a 10-argument overload. In PostgREST, multiple overloads with default parameters can trigger `PGRST204: Could not choose a best candidate function` or PostgreSQL `42725: function is not unique` when clients invoke the RPC.
**Priority:** P1 (Pre-Deployment Staging Blocker)
**Status:** Resolved Locally (2026-10-18) — Remediated via forward-only migration `20261017173000_drop_obsolete_account_rpc_overloads.sql`. Verified locally: exactly 1 canonical overload remains per function in `pg_proc`. Certified via `scripts/verify-pre-staging-remediations.ts`. Pending Staging verification (BLK-02 / BLK-04).
**Resolution:**
1. Created `supabase/migrations/20261017173000_drop_obsolete_account_rpc_overloads.sql` dropping obsolete 11-argument `admin_update_account` and 8-argument / 9-argument `admin_provision_account`.
2. Traced all application call sites (`src/lib/account-service.ts:445` and `358`) and confirmed all active callers pass the canonical signatures. Zero callers break.
3. Verified in local PostgreSQL catalog that exactly ONE signature exists for each function.

---

**Feature:** SADA OS — Team Member Visibility: Anonymous Public Case Study Team Attribution
**Issue:** `DEFECT-P2-07`: Migration `20261016140000` scopes RLS policies on `public.team_members` strictly `TO authenticated` and routes public consumption to the `public_team_members` view. While `src/routes/about.tsx` was updated to query `public_team_members`, `src/routes/case-studies.$slug.tsx:101` continued to execute `supabase.from("team_members").select(...).eq("published", true)`. As a result, unauthenticated anonymous visitors visiting case study pages received an empty array (`[]`) for team attribution, leaving team member credits blank.
**Priority:** P2 (Visual Defect for Unauthenticated Public Visitors)
**Status:** Resolved Locally (2026-10-18) — Updated `src/routes/case-studies.$slug.tsx` to query exclusively the canonical `public_team_members` view (redundant fallback to base table removed after architectural review). Verified anonymous access and zero private column leaks via `scripts/verify-pre-staging-remediations.ts`. Pending Staging push (BLK-06).
**Resolution:**
1. Updated `fetchTeamMembers()` in `src/routes/case-studies.$slug.tsx` to query `public_team_members` view directly. Removed direct fallback to `team_members` because anonymous queries fail-closed on the base table under RLS, and `public_team_members` is the sole canonical supported source.
2. Preserved the exact display fields and SADA Design System without leaking private operational columns (`email`, `phone`, `role`, `hourly_cost`, etc.).
3. Verified via automated test `scripts/verify-pre-staging-remediations.ts` (13/13 passing) that anonymous queries on `public_team_members` succeed, private columns remain absent, and direct table access returns 0 rows.

---

**Feature:** SADA OS — Client Workspaces & Client 360 Final Financial Evidence Gate Defects
**Issue:** An independent forensic audit of the live database (`mtfkzabiscyleztypqks.supabase.co`) and the Client 360 implementation in `admin.client-workspaces.$id.tsx` uncovered 5 critical financial defects and data discrepancies:
1. `DEFECT-FIN-01` (P0): Sponsoring ad spend double-deduction in `admin.client-workspaces.$id.tsx`. `clientExpenses` naively sums all rows from `expense_transactions` including `allocation = 'sponsoring_purchase'`. Both `clientExpenses` AND `sponsoringAdSpend` are subtracted from cash and profits, deducting media purchases twice.
2. `DEFECT-FIN-02` (P1): Cancelled and draft invoices are not excluded from `totalInvoiced`, `totalOutstanding`, and `paymentStatus` calculations, causing voided invoices to leak into outstanding receivables.
3. `DEFECT-FIN-03` (P2): Zero-revenue clients evaluate to `"LOW PROFIT"` with warning badges instead of `"NO DATA"` / `"INDETERMINATE"`, falsely branding unstarted clients as financial failures.
4. `DEFECT-FIN-04` (P2): `hasOverdue` checks `inv.status === 'overdue'` without checking remaining unpaid balance (`paid_amount < total_amount`), falsely marking fully settled accounts as overdue.
5. `DEFECT-FIN-05` (P2): Data reconciliation discrepancies: Prior report claimed 4,870 TND client expenses (actual DB is 4,270 TND), 4,400 TND ad spend (actual is 3,370 TND), 2,100 TND margin (actual is 630 TND), and reported 3,000 TND direct income under clients when it has `client_id = null`. Test suite claim of 159 assertions only had 14 direct in-memory tests and 0 live DB queries.
**Priority:** P0 (Release Blocking Financial Inconsistency)
**Status:** Resolved (2026-10-14) — Remediated via canonical engine; release decision remains NOT ACCEPTED until independent verification gate passes.
**Resolution:**
1. Unified all client financial calculations into canonical `calculateClientFinancials()` in `src/lib/finance-service.ts`.
2. `DEFECT-FIN-01`: Strictly filtered `sponsoring_purchase` and `commission`/`sales_commission` allocations from direct operating costs. In cash flow and net profit formulas, direct expenses, sponsoring media ad spend, and sales commission are now deducted exactly once.
3. `DEFECT-FIN-02`: Excluded `draft` and `cancelled` invoices from recognized `totalInvoiced`, `outstandingReceivables`, and `paymentStatus`.
4. `DEFECT-FIN-03`: Introduced `"NO DATA"` / `"INDETERMINATE"` health status with neutral styling for zero-revenue clients without loss across Client 360, Directory Hub, and ClientProfitabilityView.
5. `DEFECT-FIN-04`: Implemented `isInvoiceOverdue(inv, refDate)` with unpaid balance check (`paid_amount < total_amount`) and timezone-safe `parseISO` + `endOfDay` boundary check.
6. `DEFECT-FIN-05`: Created `scripts/test-client-financial-remediation.ts` with 40 assertions decomposed into 5 explicit categories. Safety guard blocked mutation tests against shared database; live DB read-only queries executed with 0 mutations.
7. TypeScript (`npx tsc --noEmit`) and production build (`npm run build`) pass cleanly.

---

**Feature:** SADA OS — Client Workspaces & Client 360 Financial Integrity & History Certification
**Issue:** During comprehensive read-only audit and baseline inspection across 36 clients, 4 defects were discovered: (1) `DEFECT-CW-01`: Hardcoded `|| 1500` and `|| 500` fallbacks across `admin.client-workspaces.$id.tsx` and `admin.client-workspaces.index.tsx` injecting uncontracted 1500 TND rates and 500 TND sponsoring budgets for unconfigured clients; (2) `DEFECT-CW-02`: Ternary expression defaulted to 50% margin and `"HIGH PROFIT"` health when total topline revenue was 0; (3) `DEFECT-CW-03`: Inconsistent `paymentStatus` resolution between Directory Hub and Client 360 (Directory falsely marked 0-invoice clients as `"PAID"` with zero money collected); (4) `DEFECT-CW-04`: Floating point precision in margin percentages.
**Priority:** P1 (Financial Integrity & Cross-Page Discrepancy)
**Status:** Resolved (2026-10-14)
**Resolution:**
1. Replaced all hardcoded `|| 1500` and `|| 500` fallbacks with `|| 0` across `$id.tsx` and `index.tsx`, ensuring unset commercial parameters evaluate strictly to 0 TND.
2. Updated margin formula to set `marginPercent = 0` and health to `"LOW PROFIT"` whenever `totalTopline <= 0`.
3. Aligned `paymentStatus` logic in `index.tsx` with `$id.tsx` to require `totalPaid > 0` before marking 0-invoice clients as `"PAID"`.
4. Fixed floating-point precision with explicit display rounding.
5. All 14 unit tests in `scripts/test-client-workspaces-mvp.ts` PASSED; total system suite passed 159/159 assertions. Complete 13-document audit suite authored in `docs/audit/mvp/`.

---

**Feature:** SADA OS — Executive Command Center (ECC) Phase 1 Forensic Audit
**Issue:** A comprehensive read-only audit of `/admin/` and `ExecutiveCommandCenter.tsx` uncovered 10 concrete defects: (1) Available Liquid Cash displays 0.000 TND instead of 88,200.000 TND due to `current_balance` vs `currentBalance` property name mismatch; (2) Treasury accounts breakdown in Financial Command renders "Account: undefined" and 0.000 TND due to `acc.account_name`; (3) False Critical Runway alert triggered due to 0 calculated cash, displaying 0 Months instead of 36.7 Months; (4) "All Exceptions: 114" displays naive non-distinct sum duplicating 30 overdue+unassigned tasks and 2 blocked+unassigned tasks (true distinct count is 78 unique tasks, 82 total items); (5) "All" feed renders duplicate task cards for overlapping tasks; (6) Overview Card MoM comparisons are hardcoded strings `+0% vs last month` and `+0% مقارنة بالشهر السابق` ignoring live database deltas (-73.9% revenue, -95.3% expense); (7) Overview Pending Client Items and Quick Insights banner have hardcoded `|| 4` fallbacks masking legitimate zero states; (8) Outstanding Receivables sums `totalAmount` without subtracting `paidAmount`; (9) Fragile string concatenation in `isTaskOverdue` yields `NaN` on ISO strings; (10) Redundant duplicate queries on initial page load (4 tables queried twice by page and analytics service).
**Priority:** P0 (Critical Financial Integrity & Operational Discrepancy)
**Status:** Open — Documented in `docs/audit/mvp/` suite (Phase 1 Read-Only Audit Complete; awaiting approval for Phase 2 implementation)
**Resolution:**
1. Author full audit documentation suite in `docs/audit/mvp/`:
   - `docs/audit/mvp/executive-command-center-verification.md`
   - `docs/audit/mvp/executive-command-center-data-traceability.md`
   - `docs/audit/mvp/executive-command-center-interaction-matrix.md`
   - `docs/audit/mvp/executive-command-center-performance.md`
   - `docs/audit/mvp/executive-command-center-responsive-qa.md`
   - `docs/audit/mvp/executive-command-center-defect-register.md`
2. Remediation sequence planned in Phase 2:
   - Fix `DEF-ECC-01` (`currentBalance`), `DEF-ECC-02` (`acc.name`), `DEF-ECC-03` (cascaded runway).
   - Fix `DEF-ECC-04` and `DEF-ECC-05` (deduplicate task exception math and feed cards).
   - Fix `DEF-ECC-06` and `DEF-ECC-07` (wire live deltas, remove `|| 4` demo fallbacks).
   - Fix `DEF-ECC-08` (subtract partial payments in receivables formula).
   - Fix `DEF-ECC-09` (`isTaskOverdue` ISO date handling).
   - Fix `DEF-ECC-10` (consolidate pre-fetched data into analytics service).

---

**Feature:** SADA OS — Post-Implementation Visual Acceptance Audit & Geometry Verification
**Issue:** During strict automated geometry tracing across 5 viewports (320×640, 360×800, 390×844, 430×932, 1440×900) under Dark/Light and English/Arabic, 6 defects were reproduced: (1) Offscreen closed `.admin-sidebar` hanging at x=390px to 670px in Arabic RTL inflating scrollWidth; (2) Filter button container uncontained width (829px) in `/admin/my-work`; (3) Desktop `<table>` blowout (1231px) when toggling table view in `/admin/packages` on mobile; (4) Header category and status badge collision in `BusinessRuleCard.tsx` on narrow viewports; (5) MonthView Day 27 cell header uncontained text on 320px screens in `CalendarGrid.tsx`; (6) Net profit uppercase label uncontained in 2-column mobile grid on 320px screen in `FinanceKPICards.tsx`.
**Priority:** P1 (Mobile Geometry & Cross-Device Defect)
**Status:** Resolved (2026-10-13)
**Resolution:**
1. Added `@media (max-width: 767.98px) { .admin-sidebar:not(.is-open) { display: none !important; } .admin-sidebar.is-open { display: flex !important; } }` in `src/styles.css`.
2. Added `p-3.5 sm:p-4 rounded-2xl min-w-0 max-w-full overflow-hidden` to outer filter card and `min-w-0` to flex container in `src/routes/admin.my-work.tsx`.
3. Reconstructed `viewMode === "table"` in `src/routes/admin.packages.tsx` into adaptive dual-view (`block md:hidden` mobile record cards vs `hidden md:block` desktop `<table>`).
4. Added `flex-wrap min-w-0 gap-2` to card header, `min-w-0 flex-1 truncate` to category title, `p-4 sm:p-5 min-w-0 max-w-full overflow-hidden` to outer card, and `truncate max-w-[130px]` to status badge in `BusinessRuleCard.tsx`.
5. Scaled day circle to `size-5 sm:size-6.5 text-[10.5px] sm:text-xs` and event count pill padding in `CalendarGrid.tsx`.
6. Added responsive label `<span className="sm:hidden">Net Profit</span><span className="hidden sm:inline">Net Profit [Calculated]</span>` with `truncate min-w-0 flex-1` and `p-3.5 sm:p-4 min-w-0 max-w-full` across all 8 KPI cards in `FinanceKPICards.tsx`.
7. Full 144 scenario matrix re-run via `scripts/post-impl-visual-acceptance-audit.ts`: 144 / 144 PASSED (100%).
8. Quality gates verified: `npx tsc --noEmit` (0 errors) and `npm run build` (0 errors in 14.69s).

---

**Feature:** SADA OS — Mobile-First Visual Reconstruction & Executive Density
**Issue:** Prior responsive fixes left cards oversized, typography uncalibrated to mobile viewports, buttons colliding in narrow grids, skeletons mismatched with loaded content (producing 384px overflowing table views during load), and text escaping card boundaries despite reporting 0px document overflow (internal clipping).
**Priority:** P1 (Mobile Visual & Interaction Architecture Defect)
**Status:** Resolved (2026-10-13)
**Resolution:**
1. Reconstructed UI skeletons (`sada-skeleton.tsx`, `sada-page-skeletons.tsx`) into responsive dual-views (mobile cards on `block md:hidden` and 2x2 KPI grids) with `max-w-full`.
2. Fixed card typography, padding, and action buttons in `BusinessRuleCard.tsx`, `BusinessRulesSmartInsightsPanel.tsx`, `ExecutiveBriefingSection.tsx`, `admin.index.tsx`, `admin.my-work.tsx`, `admin.team-workload.tsx`, `admin.packages.tsx`, and `PublicPackageCard.tsx`.
3. Verified zero document overflow across all 20 canonical routes in 8 viewports (160 tests total via `scripts/audit-all-routes-responsive.ts`).
4. Authored full deliverable suite in `docs/audit/` (`MOBILE_ROOT_CAUSE_REPORT.md`, `MOBILE_VISUAL_ACCEPTANCE_MATRIX.md`, `MOBILE_DEFECT_REGISTER.md`, `MOBILE_BEFORE_AFTER_EVIDENCE.md`, `MOBILE_RELEASE_REPORT.md`).
5. Verified clean build and type safety (`npx tsc --noEmit` and `npm run build`).

---

**Feature:** SADA OS — Visual Acceptance & Mobile UX Polish Defect Closure
**Issue:** During a strict second-pass visual acceptance audit, multiple UX defects were detected across mobile viewports (320px–430px): (1) QA automation false positives on skeleton screens due to checking `.animate-pulse` instead of `.sada-skeleton-base`; (2) Scope switcher and Executive Command Center strings missing Arabic translations and flipped LTR in Arabic mode; (3) Attention Management mobile drawer displaying duplicate floating close buttons; (4) Technical workflow serialization `[WORKFLOW_STAGE:...]` tags leaking into task brief instructions and bidirectional numbers flipping in Arabic titles; (5) Financial Command Center 4 KPI cards causing single-column sprawl on mobile; (6) Sales Workspace tab bar cutting off "Commission Management & Rules".
**Priority:** P1 (Visual Polish & Usability Defect)
**Status:** Resolved (2026-10-11)
**Resolution:**
1. Updated `scripts/capture-mobile-refined-qa.ts` to wait for both `.sada-skeleton-base` and `.animate-pulse` with 1200ms stabilization.
2. Localized Scope Switcher and Executive Command Center Level 1 metrics, trend copies, and insight banners in `admin-tasks.ts`, `admin.index.tsx`, and `ExecutiveCommandCenter.tsx`.
3. Set `showCloseButton={false}` on `NotificationCenter.tsx` to eliminate redundant floating drawer close buttons and added `pb-8` bottom clearance.
4. Implemented `cleanUserFacingNotes()` in `TaskDetailModal.tsx` to strip `[WORKFLOW_STAGE:uuid]` from user-facing instructions without altering database SSOT; wrapped titles in `<bdi dir="auto">`.
5. Refactored `FinanceKPICards.tsx` into an adaptive 2-column mobile grid (`grid-cols-2`) and stacked header controls.
6. Added `overflow-x-auto no-scrollbar` and `shrink-0 whitespace-nowrap` to `SalesWorkspaceView.tsx` tab strip.
7. Verified 15/15 real phone interactions pass via `scripts/test-mobile-interactions-qa.ts` and 0 horizontal overflow across 36 scenarios.
8. Documented in `docs/audit/POST_RESPONSIVE_VISUAL_ACCEPTANCE.md`.

---

**Feature:** SADA OS — Task Detail Modal Scroll Architecture & Momentum Lock on Mobile Viewports
**Issue:** On mobile viewports (320px–430px), workers and administrators opening the Task Detail modal on `/admin/my-work` encountered an unscrollable modal when touching the header, title, metadata, parent task card, active stage description, or action buttons. Over 510px of fixed vertical height squeezed the body into a tiny nested ~130–250px container with its own `overflow-y-auto`, while the outer backdrop also had `overflow-y-auto`, causing gesture competition and locking.
**Priority:** P0 (Core Task Execution Defect)
**Status:** Resolved (2026-10-11)
**Resolution:**
1. Restructured `src/components/admin/TaskDetailModal.tsx` into three distinct regions: pinned compact header (`shrink-0 flex-none`), single continuous primary scroll container `#task-detail-scroll-container` (`flex-1 min-h-0 overflow-y-auto overscroll-y-contain flex flex-col [webkit-overflow-scrolling:touch]`), and pinned compact footer (`shrink-0 pb-safe`).
2. Moved Title, Key Metadata, Parent Task Card, Active Stage Brief, and Action Buttons inside the primary scroll container so they naturally scroll out of the way on mobile.
3. Removed nested `overflow-y-auto` from the lower accordion workspace and changed outer backdrop from `overflow-y-auto` to `overflow-hidden`.
4. Verified across 8 headless Chromium test scenarios in 4 mobile viewports (320x640, 360x800, 390x844, 430x932) in English LTR and Arabic RTL via `scripts/test-task-modal-scroll-architecture.ts` (100% PASS, 0 horizontal overflow, full clearance of all 5 accordions above footer).
5. Documented in `docs/audit/TASK_DETAIL_SCROLL_ARCHITECTURE_FIX.md`.

---

**Feature:** SADA OS — Sales Pipeline & Commission Management Production Readiness & Lifecycle Vulnerabilities
**Issue:** Production audit of `/admin/sales` identified 4 critical gaps: (1) Direct unmanaged client update for commission approvals omitting `approved_by` and `approved_at` audit persistence; (2) Lack of self-approval prevention allowing sales representatives to approve their own commissions; (3) Missing multi-table joins on `sales_commissions` omitting the Sales Representative identity from admin ledger; (4) Omission of sales representative assignment dropdown in Create Lead and Edit Deal modals.
**Priority:** P1 (Financial Governance & Workflow Defect)
**Status:** Resolved (2026-10-11)
**Resolution:**
1. Implemented `approveCommission` and `payoutCommission` in `src/lib/sales-service.ts` with strict role validation, self-approval restriction (`PRIVILEGE_ESCALATION_BLOCKED`), timestamp persistence (`approved_at`, `approved_by`), and immutable audit logging (`COMMISSION_APPROVED`, `COMMISSION_PAID`).
2. Implemented `fetchSalesCommissions` with complete joins across `client:clients`, `deal:deals`, and `team_member:team_members`, and added the "Sales Representative" column to the Commission Ledger table for administrators.
3. Added sales representative assignment selector (`SADASelect`) in Create Lead and Edit Deal modals for authorized administrators.
4. Hardened Worker Performance Matrix attribution to check both `profile_id` and `team_member_id`.
5. Verified 8/8 automated test scenarios in `scripts/test-sales-pipeline-production-suite.ts` and 10 responsive/bilingual screenshots in `scripts/verify-sales-browser-matrix.ts`.
6. Documented in `docs/audit/SALES_PIPELINE_BASELINE.md` and `docs/audit/SALES_PIPELINE_PRODUCTION_READINESS.md`.

---

**Feature:** SADA OS — Custom Module Permission Does Not Grant Analytics Route Access
**Issue:** Super Admin granted `analytics` module and `analytics.view` action override to target account `BKR039` (`worker`) via `/admin/accounts`. Despite database persistence succeeding, the Analytics & KPIs link did not appear in the sidebar, direct navigation redirected to `/admin/my-work`, and data queries threw unauthorized exceptions due to four layers of hardcoded role checks in `admin.tsx`, `admin.analytics.tsx`, and `finance-service.ts`.
**Priority:** P1 (Permission Bypass & Custom Access Defect)
**Status:** Resolved (2026-10-11)
**Resolution:**
1. Updated `admin.tsx` sidebar filter: `if (isWorker && !item.workerVisible && (!item.module || !canAccessModule(item.module))) return false;`.
2. Replaced hardcoded worker redirect and static block in `admin.analytics.tsx` with canonical `canAccessAnalytics` check and `<ModuleAccessShield module="analytics" />`.
3. Extended `resolveFinanceCallerContext()` and `fetchCompanyFinance()` with `allowAnalyticsRead` option asserted via `analytics.view` when called through `fetchManagementAnalytics()`. Direct finance module access remains strictly gated by `finance.view`.
4. Updated `GlobalSearchModal.tsx` and `admin.index.tsx` to consult `canAccessModule("analytics")`.
5. Verified 10/10 regression tests in `scripts/test-analytics-custom-permission-regression.ts` and headless Chromium browser lifecycle in `scripts/verify-browser-analytics-permission.ts`.
6. Documented in `docs/audit/ANALYTICS_CUSTOM_PERMISSION_DEFECT.md`.

---

**Feature:** SADA OS — Account Details Drawer Session Reference Mismatch on `/admin/accounts`
**Issue:** Super Admin opening the Account Details Drawer for target account `BKR039` and executing mutations encountered `"Session Tampering Blocked: Session reference does not match authenticated user."`. Unscoped localStorage session tracking retained stale foreign worker session reference across logins, while `assertAuthorizedMutation` promoted ambient storage into an explicit `sessionId` assertion, causing DB `verify_session_and_account` to detect `SESSION_USER_MISMATCH`.
**Priority:** P0 (Critical Production-Blocking Defect)
**Status:** Resolved (2026-10-10)
**Resolution:**
1. Hardened database RPC `register_user_session` in `20261010140000_harden_session_registration_and_isolation.sql` to detect `v_existing_session.user_id <> v_user_id` and generate a fresh distinct session instead of colliding.
2. User-scoped client session storage in `src/lib/security-center-service.ts` (`sada_session_ref_${userId}`).
3. Added session purge on logout in `src/lib/auth.tsx`.
4. Decoupled ambient localStorage from `assertAuthorizedMutation` options in `src/lib/security-isolation-service.ts`, while maintaining strict rejection of explicit foreign session tampering (`PRIVILEGE_ESCALATION_BLOCKED`).
5. Verified via 8/8 automated vectors in `scripts/test-p0-session-mismatch-regression.ts` and live browser automation in `scripts/verify-p0-fix-in-browser.ts`.

---

**Feature:** SADA OS — Account Management & Security Workspace Authorization Failure (`assertAuthorizedMutation` Context Inversion)
**Issue:** Super Admin opening the Account Details Drawer or updating accounts encountered `Unauthorized: Account management is strictly Super Admin exclusive`. Furthermore, `resolveAuthoritativeSecurityContext` failed with PostgreSQL 42703 because it selected `profiles.email` and `profiles.role` (which exist only in `auth.users`/`team_members` and `user_roles`).
**Priority:** P0 (Critical Production Defect)
**Status:** Resolved (2026-10-10)
**Resolution:**
1. Decoupled authenticated actor context from target resource validation in `assertAuthorizedMutation` (`src/lib/security-isolation-service.ts`). Privileged module action checks now evaluate the acting Super Admin's context, not the target account's context.
2. Removed nonexistent `email` and `role` columns from `profiles` query; queries `public.user_roles` directly.
3. Handled multiple rows in `user_roles` without PGRST116 single-object failure, prioritizing highest privilege.
4. Restricted `verify_session_and_account` caller session checks to self context resolution to prevent `SESSION_USER_MISMATCH`.
5. Added administrative self-lockout protections to prevent Super Admin self-demotion, self-suspension, or self bulk session revocation.
6. Verified with 42/42 assertions passing in `scripts/test-account-management-e2e.ts`.

---

**Feature:** SADA OS — PostgREST Direct Session State Manipulation & Un-Revocation
**Issue:** `public.user_sessions` permitted users to update rows where `auth.uid() = user_id`. An attacker with a revoked session token could send a direct PostgREST `PATCH /rest/v1/user_sessions?id=eq.<id>` with body `{"status": "active", "revoked_at": null}` or attempt to reassign `user_id` to another user.
**Priority:** Critical / P0 (Adversarial Session Security)
**Status:** Resolved (2026-10-10)
**Resolution:** Deployed PostgreSQL trigger `trg_guard_user_sessions_update` in `20261010120000_adversarial_security_hardening.sql`. The trigger strictly rejects:
1. Changing `status` from `'revoked'` back to `'active'` (`P0001: Revoked sessions cannot be reactivated`).
2. Mutating `revoked_at` from a non-null timestamp to `null`.
3. Mutating `user_id`, `created_at`, or `session_token_hash`.
4. Updating any session row if the associated user account is suspended (`P0001: Suspended accounts cannot update session records`).
5. Direct non-privileged updates to `status` or `revoked_at` without invoking the authoritative SECURITY DEFINER RPCs (`revoke_user_session`, `admin_sign_out_all_user_sessions`, `admin_suspend_account`).

---

**Feature:** SADA OS — Statement-Level Audit Log Immutability Defense (UPDATE & DELETE)
**Issue:** `system_audit_logs` and `account_audit_logs` had row-level `BEFORE DELETE` triggers, but lacked `BEFORE UPDATE` triggers. Furthermore, under PostgreSQL RLS, if an RLS policy prevents row qualification (`USING (false)`), row-level triggers do not fire, returning status 200/204 with 0 rows affected instead of raising an explicit PostgreSQL exception.
**Priority:** High / P1 (Audit Trail Integrity)
**Status:** Resolved (2026-10-10)
**Resolution:** Deployed statement-level triggers `trg_prevent_update_system_audit` and `trg_prevent_update_account_audit` along with statement-level delete triggers in `20261010123000_audit_immutability_and_session_defense.sql`. Any `UPDATE` or `DELETE` statement executed against either audit table immediately raises PostgreSQL exception `P0001: Audit records are strictly immutable and cannot be updated` / `Audit records are strictly immutable and cannot be deleted`, preventing modification across all roles and interfaces.

---

**Feature:** SADA OS — Cross-User Session ID Spoofing in verify_session_and_account
**Issue:** `verify_session_and_account` checked whether `user_sessions.id` was active and not revoked, but did not strictly verify that `user_sessions.user_id = auth.uid()` when called by an authenticated user. An authenticated attacker who obtained another user's active session UUID could pass it to verify calls or application mutations.
**Priority:** High / P1 (Session Authority Isolation)
**Status:** Resolved (2026-10-10)
**Resolution:** Hardened `verify_session_and_account` in `20261010120000_adversarial_security_hardening.sql`. The function now checks `IF v_session.user_id <> auth.uid() THEN RETURN jsonb_build_object('valid', false, 'reason', 'SESSION_USER_MISMATCH');`. This prevents any caller from claiming or validating a session ID belonging to another user.

---

**Feature:** SADA OS — Supabase Auth JWT Expiry & In-Flight Token Invalidation Propagation
**Issue:** Standard Supabase Auth access JWTs are stateless and cryptographically signed with a fixed expiration period (typically 1 to 2 hours). In standard client-to-Supabase PostgREST architectures, revoking a session or suspending an account in the database does not instantly invalidate an already-issued, in-flight JWT until the client requests a token refresh or the database explicitly checks session state on each query.
**Priority:** High / P1 (Identity Security Boundary & Immediate Revocation Guarantee)
**Status:** Resolved (2026-10-10)
**Resolution:** Implemented authoritative three-tier database & application enforcement:
1. **Database-Level Cryptographic Session Binding & PostgREST RLS Defense**: In `supabase/migrations/20261010130000_final_session_revocation_enforcement_closure.sql`, `public.user_sessions` was extended with `jwt_session_id UUID`. Function `public.is_session_active()` was introduced as `SECURITY DEFINER STABLE`. It extracts `v_jwt_session_id := (auth.jwt() ->> 'session_id')::UUID` directly from the cryptographically verified JWT claims (tamper-proof by GoTrue HMAC/RSA signature). It verifies that:
   - The user account is active (`profiles.status = 'active'`).
   - The specific session is active and not revoked (`user_sessions.status = 'active' AND user_sessions.revoked_at IS NULL`).
   - The session was not invalidated by a subsequent "Sign Out Everywhere" / global sign-out (`user_sessions.created_at >= profiles.all_sessions_revoked_at`).
   - Service-role callers (`auth.role() = 'service_role'`) bypass user session checks, preventing background workers/crons from being blocked.
   - Canonical RBAC helper functions (`has_sada_access`, `is_admin`, `is_super_admin`, `has_permission`) and sensitive table RLS policies embed `public.is_session_active()`. Direct PostgREST queries using a revoked JWT immediately return 0 rows for reads and 403 Forbidden for writes.
2. **Application-Layer Real-Time Interception**: In `src/lib/security-isolation-service.ts`, `resolveAuthoritativeSecurityContext()` and `assertAuthorizedMutation()` execute `verify_session_and_account` on PostgreSQL before committing any sensitive data mutation. If the session has been revoked or the user account suspended, the mutation is immediately halted with `SecurityAuthorizationError` (`SESSION_REVOKED` or `ACCOUNT_SUSPENDED`).
3. **Open Browser Realtime Termination (<200ms)**: Supabase Realtime channel (`postgres_changes` on `user_sessions`) detects session status updates and terminates local storage/session state in active browser tabs within 200ms.
4. **Remaining Nuance / Architectural Note**: If a JWT is constructed without a `session_id` claim (e.g. legacy JWTs or synthetic testing tokens generated outside GoTrue without `session_id`), `public.is_session_active()` falls back to checking `profiles.status = 'active'` and `all_sessions_revoked_at` (account suspension and global sign-out are still 100% enforced). For standard Supabase Auth sessions, GoTrue v2/v3 always injects `session_id`.

---

**Feature:** PostgreSQL RLS & Delete Trigger Interception on Immutable Tables
**Issue:** Under PostgreSQL Row-Level Security, if a table has RLS enabled with `SELECT`, `INSERT`, and `UPDATE` policies but NO `FOR DELETE` policy, a client running `DELETE FROM public.user_sessions` receives a success response with 0 rows affected (status 204) because no rows qualify under RLS. Crucially, PostgreSQL does not invoke `BEFORE DELETE FOR EACH ROW` triggers on rows that fail RLS qualification. Consequently, attempts to delete records did not hit the `trg_prevent_delete_user_sessions` immutability trigger.
**Priority:** High / P1 (Database Immutability Guarantees)
**Status:** Resolved (2026-10-10)
**Resolution:** Created explicit `FOR DELETE` RLS policy in `supabase/migrations/20261010103000_fix_security_session_schema_and_delete_policy.sql`:
`CREATE POLICY "Delete blocked on user_sessions" ON public.user_sessions FOR DELETE TO authenticated, service_role USING (true);`
This ensures all rows qualify for deletion under RLS, allowing `trg_prevent_delete_user_sessions` to execute for each row and raise PostgreSQL exception `P0001: 'Historical session records are immutable and cannot be deleted.'`, strictly enforcing immutable append-only records across all client and service-role roles.

---

**Feature:** SADA OS — Global Shell, Notification Popover Position, Category Tab Merging & Browser Favicon Defect
**Issue:** Three confirmed visual defects were discovered in the global application shell:
1. **Notification Category Tabs Merging**: In `NotificationCenter.tsx`, category tabs visually ran together without clear boundaries (`AllNeeds AttentionTasksOperationsFinanceMessages`) due to low contrast, faint borders (`border-border/40`), and insufficient horizontal padding.
2. **Notification Popover Obscuring SADA Logo and Identity**: In `admin.tsx`, the notification bell trigger was positioned directly next to the logo on the leading edge of the sidebar. Combined with Popper anchoring inside the 280px sidebar, opening notifications overlapped the SADA Logo, User Identity box (`qa.superadmin`), and Quick Search bar.
3. **Browser Tab Missing Official SADA Logo**: The document head and PWA manifest referenced placeholder rectangular SVG icons instead of the official circular dark cyan-glowing emblem.
**Priority:** High / P1 (Global Shell Visual Ergonomics & Official Branding Integrity)
**Status:** Resolved (2026-10-09)
**Resolution:**
1. **High-Density Segmented Pill Bar**: Re-engineered notification category navigation in `NotificationCenter.tsx` with dedicated card boundaries (`bg-card dark:bg-card/85`, `border-border/80`, `shadow-2xs`), high-contrast active state (`bg-primary text-primary-foreground font-bold`), distinct unread pill badges, touch targets (`min-h-[30px]`), and isolated horizontal scrolling (`overscroll-contain`, `.sada-scrollbar`).
2. **Correct Trigger Placement & Collision-Aware Anchor**: Repositioned the sidebar bell trigger to the trailing edge of the sidebar header in `admin.tsx`, removed ghost desktop triggers from the mobile header (`displayMode="drawer"`), and updated Popper positioning in `NotificationCenter.tsx` to anchor into the primary content canvas (`side={isRTL ? "left" : "right"}`, `align="start"`, `sideOffset={24}`, `collisionPadding={16}`). Bounding box inspection verified 0px overlap with Logo and User Identity.
3. **Authoritative Official Branding Assets**: Ingested the official 1024x1024 master emblem PNG and generated canonical production assets (`favicon.ico` 16/32/48, PNGs 16/32/48, `apple-touch-icon.png` 180, PWA icons 192/512/maskable, and high-fidelity SVG). Updated `src/routes/__root.tsx`, `public/manifest.webmanifest`, `public/offline.html`, and bumped service worker cache in `public/sw.js` to `sada-os-pwa-v2`.
4. **Verification**: All regression test suites passed (49/49 notification system, 25/25 actionability, 21/21 realtime lifecycle, 32/32 phase 8 security, automated bounding box and HTTP verification). `npx tsc --noEmit` passed with 0 errors. `npm run build` passed with 0 errors. Visual verification confirmed across 8 browser captures in 7 viewports in Light/Dark, English LTR, and Arabic RTL.

---

**Feature:** PostgREST Schema Cache Reload & Notification Column Insertion (PGRST204)
**Issue:** When inserting notifications after database migrations add new columns (e.g., `context_title`, `source_module`, `i18n_key`, `i18n_params` added in `20261006200000_notification_security_recipient_isolation.sql`), PostgREST can return error `PGRST204: "Could not find the 'context_title' column of 'notifications' in the schema cache"` if the PostgREST daemon has not yet received a `NOTIFY pgrst, 'reload schema'` signal or is in a delayed reload window.
**Priority:** Medium / P2 (Operational Resilience)
**Status:** Resolved (2026-10-06)
**Resolution:** Hardened `emitNotification()` in `src/lib/notification-service.ts`. If an initial insert returns PGRST204 or references missing schema cache columns, the function intercepts the error and automatically executes a clean fallback insert with core baseline columns (`title`, `message`, `type`, `target_role`, `recipient_id`, `client_id`, `created_at`), while preserving the rich parameters in memory/client callbacks. This ensures zero runtime failure or unhandled exceptions across all operational and workflow notification triggers.


---

**Feature:** SADA OS — Business Rules Console Horizontal Overflow & Edit Modal Incomplete Updates
**Issue:** Two distinct issues affected the Business Rules / Governance & Financial Engine page (`admin.business-rules.tsx`):
1. **Horizontal Category Bar Crowding**: The category navigation row (containing 9 category chips and search input) overflowed at desktop resolutions between 1280px and 1440px, compressing the search input, clipping category labels, creating partial awkward buttons, and pushing controls off-screen due to missing `min-w-0` on the flex container.
2. **Rule Edit Mutation Incomplete Updates**: In the Edit Rule modal, editing decimal rules (such as Benchmark USD Purchase Rate `3.44`, `3.50`) was blocked by HTML5 step validation mismatch (`stepMismatch` on `<input type="number">` without `step="any"`). Keyboards entering comma separators (`3,44`) had input wiped to empty string. Action buttons were placed inside the modal scroll body rather than the pinned dialog footer, causing them to scroll out of view. The database trigger `archive_business_rule_version()` requires distinct values to increment version, which caused identical values to leave the version unchanged without informing the user.
**Priority:** High / P1 (Governance & Financial Configuration Integrity)
**Status:** Resolved (2026-10-02)
**Resolution:**
1. **Dedicated Responsive Navigation Bar**: Enclosed category navigation and search in a dedicated container (`p-2.5 rounded-2xl bg-card border border-border/80 shadow-xs`). Added `relative flex-1 min-w-0` to the scrollable category track with smooth scrolling and dynamic navigation chevrons (`ChevronLeft` / `ChevronRight`). Added `w-full lg:w-72 shrink-0` to `SADASearch` so search is never compressed. Enforced SADA Design System active/inactive states with count badges and added active filter feedback with 1-click filter reset.
2. **Edit Modal & Service Hardening**:
   - Added `step="any"`, `min`, and `max` constraints on `SADAInput`.
   - Added international comma normalization (`val.replace(",", ".")`).
   - Moved action buttons to the pinned `footer` prop of `SADADialog`.
   - Added inline error messaging, target version indicator, and range limits.
   - Wired `subscribeToBusinessRules` for non-destructive real-time updates.
   - Hardened `updateBusinessRule` with authenticated user fallback (`supabase.auth.getUser()`), numeric sanitization, and user-friendly permission error messages.
3. **Verification**:
   - Automated test suite `scripts/test-business-rules-complete-flow.ts`: 27/27 tests passed (Super Admin authentication, boundary validation, empty reason rejection, valid mutation, version increment, database persistence, immutable version history archiving, system audit trail logging, comma normalization, factory default reset, and RLS gate blocking unauthorized worker modifications).
   - `npx tsc --noEmit`: 0 TypeScript compiler errors.
   - `npm run build`: Production bundle built cleanly in 14.28s.

---

**Feature:** SADA OS — Unexpected Refresh / Revalidation When Returning to Browser Tab
**Issue:** When a user was working in SADA OS in one browser tab, switched to another tab, and returned, the application reloaded/flashed, reset open modals, cleared form inputs, and lost scroll position. Investigation revealed that:
1. Supabase GoTrueClient (`node_modules/@supabase/auth-js/src/GoTrueClient.ts`) attaches an internal `visibilitychange` listener to `window`. When switching back to the tab (`document.visibilityState === 'visible'`), GoTrue executes `_recoverAndRefresh()`, emitting `SIGNED_IN` or `TOKEN_REFRESHED` through `onAuthStateChange`.
2. In `src/lib/auth.tsx`, `onAuthStateChange` was executing database queries (`resolveRole` and `resolveCurrentTeamMember`) on every tab return, replacing `user`, `role`, and `teamMember` with newly allocated object references.
3. This updated the `AuthContext` value reference, triggering re-render cascades across all consumer components.
4. In route components (e.g. `src/routes/admin.my-salary.tsx`), `loadData` had `[user, teamMember]` in its dependency array. The reference change re-triggered `useEffect`, which called `setLoading(true)`.
5. Because route components used unconditional skeleton guards (`if (loading) return <MySalarySkeleton />`), the entire active UI tree unmounted, wiping all active component state (e.g. `isRequestModalOpen`, typed inputs, scroll position) before remounting 200ms later.
**Priority:** Critical / P0 (UX Integrity & Workflow Continuity)
**Status:** Resolved (2026-10-02)
**Resolution:**
1. **AuthProvider Stabilization (`src/lib/auth.tsx`)**: Added `useRef` tracking for `currentUserRef`, `currentSessionRef`, `roleRef`, `teamMemberRef`, and `isInitializedRef`. On `SIGNED_IN` or `TOKEN_REFRESHED`, if `s.user.id === currentUserRef.current?.id`, the user object reference is kept stable, network queries for role/team member are bypassed, and only `session.access_token` is updated silently if changed.
2. **Global QueryClient & Router Standard (`src/router.tsx`)**: Configured `QueryClient` with `refetchOnWindowFocus: false`, `refetchOnReconnect: true`, `staleTime: 60_000`, `gcTime: 300_000`, and `defaultPreloadStaleTime: 30_000`.
3. **Non-Destructive In-Place Revalidation**: Updated skeleton guards across all admin views (`admin.my-salary.tsx`, `admin.index.tsx`, `admin.clients.index.tsx`, `admin.my-work.tsx`, `admin.calendar.tsx`, `admin.accounts.tsx`, `admin.reels.tsx`, `admin.testimonials.index.tsx`, `admin.projects.index.tsx`, `admin.business-rules.tsx`) to only show skeletons during initial empty load (`loading && data.length === 0`). Background refetches update data seamlessly in-place without unmounting active views, modals, or forms.
4. **Verification**:
   - `scripts/test-tab-return-stability.ts`: All 4 test suites passed (0 duplicate network requests on tab return, stable session references, non-destructive skeleton guards).
   - `scripts/test-logged-in-worker.ts`: Worker authentication, salary access, and Super Admin privileges verified.
   - `npx tsc --noEmit`: 0 TypeScript compiler errors.
   - `npm run build`: Production bundle built cleanly in 13.13s.

---

**Feature:** SADA OS — Salary Advance / Early Salary Request Configuration & Compensation Flow Defect
**Issue:** When a worker opened `Finance → My Salary → Request Early Salary / Advance`, the modal showed: *"Your team profile is not configured correctly. Please contact an administrator."* Investigation revealed that: (1) `admin_provision_account` and `admin_update_account` set `team_members.profile_id` but left `team_members.user_id` as `NULL`. For workers with `published = false`, worker RLS policies checking `user_id = auth.uid()` failed to match; (2) `public.get_team_member_id` attempted an `UPDATE` statement while declared `STABLE`, triggering Postgres error 25006 ("cannot execute UPDATE in a read-only transaction") during SELECT queries; (3) Legacy RLS policies from `20260925143000_financial_command_center.sql` invoked `get_team_member_id` which had restrictive permissions; (4) Client-side self-healing in `fetchWorkerSalaryData` attempted `UPDATE team_members` which workers lack RLS permission to perform; (5) The Admin Account Management UI (`AccountDetailsDrawer.tsx` and `CreateAccountModal.tsx`) had no interactive compensation configuration, forcing manual SQL for base salary records.
**Priority:** High / P1 (Compensation Integrity & Worker Self-Service)
**Status:** Resolved (2026-10-02)
**Resolution:**
1. Applied migration `20261002080000_fix_worker_salary_advance_resolution_and_rls.sql`:
   - Converted `public.get_team_member_id` into a pure `STABLE SECURITY DEFINER` read-only function, eliminating Postgres error 25006.
   - Added PostgreSQL database triggers (`trg_team_members_auto_link` and `trg_profiles_auto_link_team`) to automatically bind `user_id` and `profile_id` on email match with `auth.users` with elevated trigger permissions.
   - Hardened `admin_provision_account` and `admin_update_account` RPCs to set both `profile_id = _user_id` and `user_id = _user_id`.
   - Re-created RLS policies on `team_members`, `salary_records`, `salary_requests`, and `salary_payments` supporting `profile_id = auth.uid() OR user_id = auth.uid() OR LOWER(email) = LOWER(auth.jwt()->>'email')`.
2. Hardened `fetchWorkerSalaryData` in `src/lib/finance-service.ts` with case-insensitive email matching, `get_team_member_id` RPC fallback, and `.order("created_at", { ascending: false }).limit(1)` on `salary_records` to prevent PGRST116 errors.
3. Hardened `src/routes/admin.my-salary.tsx` with upfront validation: displays distinct alerts ("Team Profile Misconfigured" vs "Compensation Profile Incomplete") with disabled submit button. Enforces dynamic 50% max advance calculation with real-time inline warning and button disabling if the requested amount exceeds 50% of base salary.
4. Added interactive compensation configuration to Account Management:
   - Added Base Monthly Salary (TND) field on Step 1 of `src/components/admin/accounts/CreateAccountModal.tsx`.
   - Added interactive "Worker Compensation & Salary Structure" card in `src/components/admin/accounts/AccountDetailsDrawer.tsx` allowing admins to view and edit Base Salary, standard hours, payment frequency, and disbursement method using canonical SADA UI components.
5. Added `SECTION 4: COMPENSATION & SALARY STRUCTURE (AUTHORITATIVE)` to `src/components/admin/TeamMemberModal.tsx` for Team Management.
6. Verified with automated test suite `scripts/test-salary-advance-flow.ts` covering Cases A, B, C, D, and E (18/18 tests pass). Verified CRM foundation tests (39/39 pass). Clean TypeScript check (`npx tsc --noEmit`) and successful production build (`npm run build`).

---

**Feature:** SADA OS — Sales UI Component Fragmentation & Duplicated Commissions Route
**Issue:** Two systemic problems were identified across the Sales & Commissions module: (1) SADA UI components were not enforced in `SalesWorkspaceView.tsx`, leading to developer fallback onto native browser HTML controls (7 native `<select>` dropdowns, 2 native `<input type="date">` pickers, raw `<button>` elements, custom card wrappers, and raw `font-mono` financial numbers); (2) Duplicated routing and navigation where `/admin/sales` and `/admin/commissions` existed as two separate pages and both `Sales` and `admin.myCommissions` were exposed in the sidebar, fragmenting the sales workflow.
**Priority:** High / P1 (UI Enforcement & Architecture Consolidation)
**Status:** Resolved (2026-10-01)
**Resolution:**
1. Locked and enforced the centralized SADA UI component system (`@/components/ui/sada-ui`) across `SalesWorkspaceView.tsx`: eradicated 100% of native `<select>` (replaced with `SADASelect`), native `<input type="date">` (replaced with `SADADatePicker`), native `<button>` (replaced with `SADAButton`), and manual search inputs (replaced with `SADASearch`).
2. Standardized visual containers and status pills to canonical `SADACard` and `SADABadge`.
3. Standardized numerical typography to `<SADANumber>` across KPI cards, table rows, and Kanban column summaries.
4. Consolidated routes: configured `/admin/commissions` and `/admin/deals` to permanently redirect to `/admin/sales`.
5. Cleaned sidebar navigation: removed `admin.myCommissions` from `ALL_NAV_ITEMS`, maintaining single canonical `Sales` link.
6. Embedded both "My Leads & Pipeline" and "My Commissions" as unified tabs inside the canonical `/admin/sales` page.
7. Automated verification: passed 15/15 tests in `scripts/verify-sales-ui-consolidation.ts`, passed `npx tsc --noEmit` (0 errors), and passed `npm run build`.

---

**Feature:** Worker Role Authorization, Identity Resolution & Data Access Defect
**Issue:** The authenticated WORKER role (`qa.worker@sada.agency`) faced multiple system barriers and visibility bugs: (1) Clocking in on `/admin/my-work` failed with PostgreSQL foreign key constraint violation on `work_sessions_team_member_id_fkey` due to invalid fallback using auth user UUID instead of `team_members.id`; (2) `/admin/my-salary` displayed "No active team member profile linked to your user" caused by a PostgREST query syntax error (`email.eq.` without argument) and missing salary records for QA Worker Lead; (3) `/admin/team-workload` exposed all company workers' tasks, compensation, and schedules to normal workers due to an open RLS policy (`Anyone manage team_members`) and incorrect sidebar visibility; (4) `/admin/client-projects` exposed "New Workspace" and "Create Project" CTAs that failed with RLS errors on submit; (5) Emitting notifications or audit logs from worker actions failed PostgREST RLS checks when querying `.select("id")` on records targeted to Super Admin.
**Priority:** Critical / P0 (Role Authorization & Data Integrity)
**Status:** Resolved (2026-10-01)
**Resolution:**
1. Applied migration `20261001220000_worker_role_auth_identity_and_rls_repair.sql`: added `user_id` to `team_members`, linked `qa.worker@sada.agency` (`77f7a3d3-82c1-4744-8f01-0a1fd5f44bba`) to `9c0937f7-4617-4803-b718-a3d9a5175dd9`, seeded active salary (1,400 TND, 8.75 TND/hr, 160h) and previous payment.
2. Dropped insecure open policy on `team_members`; replaced with strict RLS policies on `team_members`, `salary_records`, `salary_payments`, `salary_requests`, `work_sessions`, and `client_projects`.
3. Exported canonical `CurrentTeamMember` resolver and context state in `src/lib/auth.tsx`.
4. Hardened `clockIn` in `src/lib/team-cost-service.ts` to strictly resolve canonical `team_members.id`, prevent invalid foreign key insertions, and calculate hourly rates reliably.
5. Fixed `fetchWorkerSalaryData` in `src/lib/finance-service.ts` and hardened `submitWorkerSalaryRequest` with advance limit verification.
6. Shielded `/admin/team-workload` with route-level access guard and removed it from worker sidebar navigation (`workerVisible: false`).
7. Hid project/workspace creation CTAs from workers in `src/routes/admin.client-projects.index.tsx` and calendar deliverable creation in `CalendarGrid.tsx`.
8. Removed `.select("id").single()` from `emitNotification` and `logSystemAudit` to enable non-admin workers to write audit logs and send alerts without triggering SELECT policy rejections.
9. Built dedicated route `/admin/commissions` rendering `SalesWorkspaceView` with commissions tab active.
10. Automated tests passed 100% (`scripts/verify-worker-experience.ts`, `scripts/verify-worker-post-migration.ts`, `scripts/test-worker-clockin-salary.ts`), 0 type errors on `npx tsc --noEmit`, clean production build (`npm run build`).

---

**Feature:** Supabase Auth — Password Recovery Email Delivery & Missing Reset Flow
**Issue:** The Password Recovery UI displayed "Recovery Link Dispatched" unconditionally even if Supabase Auth rejected the request. When testing recovery, emails failed to arrive in the user's inbox because: (1) Supabase project `mtfkzabiscyleztypqks` uses Supabase's default shared email relay (`noreply@mail.app.supabase.io`) which throttles requests at 3–4 emails/hour (`over_email_send_rate_limit`, status 429); (2) Test internal email handles (`@sada.agency`) have an RFC 7505 Null MX record preventing inbox delivery; (3) The recovery link redirect was pointing to `/auth` which immediately forwarded users to `/admin` via an auto-login hook; (4) No `/reset-password` page existed in the project to allow the user to set a new password via `supabase.auth.updateUser({ password })`.
**Priority:** Critical / P0 (Auth & Account Access)
**Status:** Resolved (2026-10-01) — Codebase architecture complete; custom SMTP and domain MX setup required in Supabase Dashboard for unlimited external inbox delivery.
**Resolution:**
1. Built `src/lib/auth-recovery-service.ts`: normalizeEmail, RFC format validation, rate-limit capture, generic message preventing account enumeration, canonical redirect URL computation, and `updateUserPassword`.
2. Created dedicated `/reset-password` route (`src/routes/reset-password.tsx`) handling Supabase recovery session tokens, password validation checklist, and clean session termination.
3. Updated `src/routes/auth.tsx` with semantic states (`IDLE`, `LOADING`, `SUCCESS`, `ERROR`), inline error alerts, and recovery token interception forwarding to `/reset-password`.
4. Automated verification: `scripts/test-password-recovery-flow.ts` (6/6 tests passed), `npx tsc --noEmit` (0 errors), and `npm run build` (clean exit 0).

---

**Feature:** Supabase Realtime Notifications — Subscription Lifecycle Crash (`cannot add 'postgres_changes' callbacks after subscribe()`)
**Issue:** The `/admin` page crashed with `Error: cannot add 'postgres_changes' callbacks for realtime:realtime:notifications:... after subscribe()` pointing to `src/components/admin/NotificationCenter.tsx`. Caused by concurrent mounting of `NotificationCenter` (mobile top bar at line 157 and desktop sidebar at line 205 of `src/routes/admin.tsx`) and React StrictMode double-mounting. When multiple instances called `supabase.channel(channelName).on('postgres_changes', ...).subscribe()`, `@supabase/realtime-js`'s client returned the existing channel from its cache. Calling `.on()` on a channel in `joining`/`joined` state threw an unhandled exception.
**Priority:** Critical / P0 (Admin Shell Crash)
**Status:** Resolved (2026-10-01)
**Resolution:** Re-architected realtime notification lifecycle into a centralized, ref-counted multi-subscriber singleton manager in `src/lib/notification-service.ts`:
1. Strict Supabase Realtime lifecycle order enforced: `CREATE CHANNEL -> REGISTER ALL LISTENERS -> SUBSCRIBE`.
2. Ref-counted session per user: multiple components (top bar, sidebar, analytics) attach callbacks to a single underlying `RealtimeChannel`.
3. React StrictMode tolerance: 150ms debounce grace period when subscriber count drops to 0 ensures rapid unmount/remount in development preserves the channel instead of thrashing socket connections.
4. Strict auth guards: channels are never initiated for `null`, `undefined`, or `anon` user states.
5. Deduplicated notification toast alerts in `NotificationCenter.tsx` via `id: "notif-" + newItem.id`.
6. Verified with `scripts/test-realtime-notification-lifecycle.ts` (21/21 passed), headless Chrome browser audit `scripts/verify-admin-realtime-browser.ts` (0 errors), `npx tsc --noEmit` (0 errors), and clean production build (`npm run build`).

---

**Feature:** SADA OS Business Logic & Financial Formulas — Hardcoded Thresholds & Decentralized Policies
**Issue:** Financial, commission, margin, runway, FX, and notification deduplication rules were scattered and hardcoded across various frontend components and service files (e.g. 15% commission rate, 6mo duration, 5% renewal rate, 20% low margin threshold, 3-month critical runway, 40% fixed burn ratio, 3.37/4.00 sponsoring FX rates, 24-hour notification deduplication). Admins or developers previously had to edit code directly to adjust business policy.
**Priority:** Critical / P1
**Status:** Resolved (2026-10-01)
**Resolution:** Designed and implemented the Centralized Configurable Business Rules Engine:
1. Created `public.business_rules` in PostgreSQL with 21 canonical seeded rules across 8 categories (`sales_commissions`, `sponsoring_advertising`, `profitability`, `cash_treasury`, `fixed_burn`, `smart_insights`, `notifications_alerts`, `operations`).
2. Implemented `public.business_rule_versions` table with automated PostgreSQL trigger `trg_archive_business_rule_version` archiving previous versions on update, and trigger `trg_prevent_rule_version_deletion` enforcing version immutability.
3. Locked rule mutations to `public.is_super_admin(auth.uid())` at the PostgreSQL RLS level; Worker and Admin mutations are strictly rejected by the database engine.
4. Centralized rule consumption through `src/lib/business-rules-service.ts` with 60-second in-memory caching and live Supabase Realtime channel invalidation.
5. Replaced hardcoded constants across `sales-service.ts`, `finance-service.ts`, `notification-service.ts`, `team-cost-service.ts`, `ExecutiveCommandCenter.tsx`, `admin.deals.tsx`, `admin.clients.index.tsx`, and `admin.clients.$id.tsx`.
6. Created executive Super Admin Business Rules Console at `/admin/business-rules` with bounds validation, mandatory audit reason, and historical impact confirmation warning.
7. Verified with `scripts/test-business-rules-engine.ts` (12/12 passed), `scripts/test-business-logic-verification.ts` (13/13 passed), `npx tsc --noEmit` (0 errors), and production build.

---

**Feature:** Sales Pipeline — Legacy Package FK (`deals.package_id -> public.packages(id)`)
**Issue:** `deals.package_id` originally referenced legacy `public.packages(id)` table instead of canonical `public.package_catalog(id)`, requiring an application-level fallback lookup in `src/lib/sales-service.ts`.
**Priority:** High / P1
**Status:** Resolved (2026-10-01)
**Resolution:** Migrated `deals.package_id` foreign key constraint directly to `public.package_catalog(id)`. Verified zero orphan package references across all production tables (`deals`, `clients`, `client_deliverables`, `project_tasks`, `production_bookings`). Tested with `scripts/test-package-catalog-fk-migration.ts` (8/8 passed) and `scripts/verify-phase8-canonical-package-integrity.ts` (7/7 passed).

---

**Feature:** Global Window Presentation System — Modal Jumping, Backdrop Blur Lag & Inconsistent Window Shells
**Issue:** Modals, dialogs, and drawers exhibited noticeable jumping and layout shift upon opening due to CSS transform collisions between Radix centering (`translate(-50%, -50%)`) and Tailwind entry transitions (`zoom-in-95` / `slide-in-from-top-[48%]`). Modals used heavy backdrop blurs (`backdrop-blur-md/xl`) and overly dark overlays (`bg-foreground/40`, `bg-background/80`, `bg-black/90`), causing visual flashes and GPU strain on lower-end devices. Multi-step workflows and large forms were trapped in giant 90vh centered modals with double scrollbars, arbitrary `z-index` stacking (`z-60`), and nested modal containers (e.g. Calendar opening a modal with an inner `TaskModal` overlay). Several modules also invoked blocking browser-native `window.confirm()` dialogs.
**Priority:** High / P1 (UX Command Center Standard)
**Status:** Resolved (2026-09-30)
**Resolution:** Standardized the Global Window Presentation System with canonical primitives:
1. Replaced transform collisions with dedicated GPU-accelerated CSS keyframes in `src/styles.css` (`@keyframes sada-dialog-in`, `sada-drawer-in-right`, `sada-drawer-in-bottom`) that animate subtle 6px translate and 0.988 scale around the `translate(-50%, -50%)` anchor in 160ms ease-out (110ms ease-in close), with `@media (prefers-reduced-motion)` instant fallbacks.
2. Replaced heavy blur and dark overlays with a lightweight composite backdrop: `bg-black/35 dark:bg-black/55 backdrop-blur-[2px]` with pure opacity transition (`@keyframes sada-overlay-in`).
3. Standardized `SADAWindow`, `SADAWindowHeader`, `SADAWindowBody`, `SADAWindowFooter`, and `SADADialog` with predictable size tiers (`compact` 520px, `standard` 640px, `wide` 820px, `large` 820px, `xl` 960px, `full`), strict vertical bounding `max-h-[min(720px,calc(100dvh-48px))]`, fixed header, sleek 6px custom scrollbar (`.sada-scrollbar`), and sticky action footer using HTML5 `form="form-id"` submission.
4. Symmetrically refactored Finance Inflow (`RecordIncomeModal`) and Outflow (`RecordExpenseModal`) to use identical `size="large"` / `wide` geometry, flat section dividers instead of nested card boxes, and persistent sticky action footers.
5. Standardized `SADADrawer` (`sm`, `default`, `lg`, `xl`, `2xl`, `full`) for complex workflows like Package Editor (`admin.packages.tsx`) with progressive disclosure.
6. Standardized `SADAConfirmDialog` and eradicated 100% of native `confirm()` calls across `src/`.
7. Decoupled nested modal structures in Calendar (`admin.calendar.tsx`) and eliminated `z-60` arbitrary stacking in Account Management (`AccountDetailsDrawer.tsx`).
8. Verified with automated test suite `scripts/test-sada-window-system.ts` (61/61 passed), TypeScript (`npx tsc --noEmit` 0 errors), and clean production build.


---

**Feature:** Admin Shell — Desktop Sidebar Invisibility & Layout Expansion Regression
**Issue:** The Admin sidebar disappeared on desktop viewports, causing main content to stretch across 100% of the screen. Caused by two interacting CSS issues: (1) `ltr:-translate-x-full` and `rtl:translate-x-full` were applied unconditionally when `!sidebarOpen` and in Tailwind v4 source order overrode `md:translate-x-0`, translating the desktop sidebar off-screen; (2) `<aside>` used `fixed md:static` where `md:static` was not generated by Tailwind v4, keeping the sidebar `position: fixed` and removed from flex document flow so `<main className="flex-1">` expanded to full width.
**Priority:** Critical / P1
**Status:** Resolved (2026-09-28)
**Resolution:** Hardened architecture with canonical classes `.admin-shell`, `.admin-sidebar`, and `.admin-main` in `src/styles.css` and updated `src/routes/admin.tsx`. Fixed desktop sidebar at `width: 280px !important; flex-shrink: 0 !important; position: relative !important; transform: none !important; visibility: visible !important;` and main content at `flex: 1 1 0% !important; min-width: 0 !important;`. Mobile maintains responsive drawer overlay with logical `inset-inline-start: 0` and `translateX(-100%)` (LTR) / `translateX(100%)` (RTL) sliding in on toggle. Verified via automated test suite `scripts/verify-admin-shell-restoration.ts` (31/31 passed) and clean production build.

---

**Feature:** Testing & Browser Automation — Playwright Driver CDN 404
**Issue:** The environment's Playwright manager failed to download/install browser driver (`playwright-1.57.0-win32_x64.zip` returned HTTP 404 from Microsoft Azure CDN endpoints `playwright.azureedge.net`, `playwright-akamai.azureedge.net`, `playwright-verizon.azureedge.net`), preventing automated headless browser launches during local testing.
**Priority:** P3
**Status:** Open / Environment CDN Limitation (discovered 2026-09-24)
**Resolution:** Replaced with Node-based HTTP SSR verification (`verify_routes_ssr.mjs`), unit/integration test suites (`test-social-reels-cms.ts`, `test-case-studies.ts`, `test-content-cms.ts`, `test-rbac-system.ts`), and TypeScript + production build compilation. Manual or alternate browser testing can be run locally or once CDN connectivity is restored.

---

**Feature:** Work OS — BUG-001 Completed Task Timestamp Integrity
**Issue:** 3 legacy rows in `public.project_tasks` had `status = 'done'` with `completed_at IS NULL` (`505a050d-de40-4ada-b87b-4a214b6a78ec`, `db79958d-93cd-4a6c-87f2-450019b8c6c8`, `85f7a355-b3fb-424a-9a31-5cbf703520fa`).
**Priority:** P2
**Status:** Resolved (2026-09-24)
**Resolution:** Backfilled `completed_at = updated_at` across all affected rows in migration `20260924090000_fix_task_completed_at_integrity.sql`. Created database-level trigger `trg_project_tasks_completed_at` executing `public.handle_project_task_completed_at()` to strictly enforce lifecycle invariants at the PostgreSQL engine level (`todo/in_progress -> done` automatically populates `completed_at = NOW()`; non-done states clear `completed_at = NULL`; `done -> done` preserves existing timestamp). Zero rows remain with `status = 'done' AND completed_at IS NULL`. Verified via automated test suite `scripts/test-trigger-completed-at.ts` (7/7 scenarios passed).

---

**Feature:** Work OS — Super Admin Profile Identity Linkage
**Issue:** `public.team_members` row `d73918fc-c2f9-4c6b-8b94-fc133d780814` ("Super Admin") references synthetic profile ID `11111111-1111-1111-1111-111111111111`.
**Priority:** P3
**Status:** Open / Blocked by Missing Identity Information (audited 2026-09-24)
**Resolution:** Investigated database. ID `11111111-1111-1111-1111-111111111111` maps to seeded automated test identity `sec.admin@sada.agency` with valid DB foreign key linkage (`team_members.profile_id -> profiles.id -> auth.users.id`). The only other human account in the database is `boubakar.hamedsghaier@gmail.com`, who is already mapped to his own team member row ("Boubakar Hamed", role "admin"). No real human Super Admin auth identity exists in `auth.users`. Per explicit instructions to avoid guessing the correct user, the row is safely left untouched until the real business owner / primary Super Admin personal identity is created in Supabase Auth.

---

**Feature:** Work OS — Centralized Project Progress Source of Truth
**Issue:** Project progress `Math.round((done / total) * 100)` was duplicated across multiple components.
**Priority:** P3
**Status:** Resolved (2026-09-24)
**Resolution:** Established canonical `computeProjectProgress(tasks: TaskRow[]): number` in `src/components/admin/project-utils.ts`. Integrated canonical helper into `computeProgress()` and `src/routes/admin.client-projects.$id.tsx` (phase progress calculation). Guaranteed single source of truth across Project Workspace, Client Projects list, Overview, and Client detail pages.

---

**Feature:** Homepage hero photographs
**Issue:** `src/assets/hero-image1-4.webp` (and the PNG masters beside them) are no longer referenced by any component. The transplanted hero draws its four cards with CSS gradient textures instead of photographs, so the assets sit in the repo unused.
**Priority:** Low
**Status:** Open (found 2026-09-16)
**Resolution:** Either drop the photos back in — `.sada-hero .card-visual-one .sada-card-visual { background-image: url(...) }` already has `background-size: cover` and a scrim, so it is one line per card — or delete the assets. Unreferenced assets are not bundled, so this costs repo size, not page weight.

---

**Feature:** Homepage hero statistics
**Issue:** The rebuilt hero (`src/components/site/Hero.tsx`) shows `50+ Happy Clients / 200+ Projects Delivered / 3x Average Growth`, taken verbatim from the client's hero brief. The `Stats` section directly below it on the same page (`src/components/site/Stats.tsx`) shows `120+ Projects shipped / 38M Views generated / 96% Client retention / 24h Avg. response time`. "200+ projects" and "120+ projects" contradict each other on one screen, and none of the seven numbers has a verified source on file.
**Priority:** High
**Status:** Open (found 2026-09-16)
**Resolution:** Get the real figures from the business, then make the hero and `Stats.tsx` agree. Until then neither set should be treated as verified. Noted rather than silently "fixed" — picking a number would be inventing a metric.

---

**Feature:** Homepage hero card photography
**Issue:** The hero deck's card 04 ("Paid Campaigns") used `hero-image4.webp`, a photo of a signed proposal and a handshake. It read as a closed deal rather than as a campaign, so the photo-to-label pairing was the weakest of the four.
**Priority:** Low
**Status:** Resolved (2026-09-16)
**Resolution:** The client confirmed the four photographs carry a fixed meaning — Script Writing, Video Production, Video Editing, Client Agreement — and that the deck is storytelling, not a view of the services data. Labels now describe what each photograph actually shows, so the mismatch is gone. Card labels must not be re-derived from `src/data/services.ts`.

---

**Feature:** Work OS — RBAC RLS Permanent Deletion Isolation
**Issue:** Worker and Admin roles were capable of executing direct SQL `DELETE` operations on `public.team_members` due to legacy policy `"Anyone manage team_members"` (`cmd: ALL USING (true)`), and Admin was capable of executing `DELETE` operations on `public.contact_submissions` due to legacy policy `"Admins delete contact"` (`USING (is_admin)`).
**Priority:** Critical
**Status:** Resolved (2026-09-16)
**Resolution:** Applied migration `20260916160000_fix_rbac_delete_policies.sql` to drop conflicting legacy policies (`"Anyone manage team_members"`, `"Admins manage team"`, and `"Admins delete contact"`). Added `"Sada access read team_members"` to preserve Worker read access for internal workload context. Verified 100% database-level enforcement via automated test suite across all 3 roles: Worker and Admin DELETE attempts are strictly rejected (0 rows affected), while Super Admin DELETE remains permitted.


**Feature:** Work OS — Admin Dashboard Oversight
**Issue:** Delegating leaders saw mostly their own assigned work. If a manager/project lead had few or zero personal tasks, the dashboard appeared "clear" even when the agency had overdue, blocked, unassigned, or client-action-required work.
**Priority:** P1
**Status:** Resolved (2026-09-15)
**Resolution:** Phase 2 implementation added dual operational modes via a compact, mobile-friendly scope switcher (`MY EXECUTION` vs `AGENCY OVERSIGHT`). Agency Oversight prioritizes actionable operational exceptions across SADA: overdue tasks, blocked work, unassigned tasks, client-action items, and at-risk projects with explicit Project Lead context and direct action triggers (`Open Task`, `Inspect & Unblock`, `Assign Owner`, `Log Contact`).

---

**Feature:** Work OS — Team Pulse Source of Truth
**Issue:** Team Pulse previously iterated directly over `profiles` instead of `team_members`, causing inconsistency and potential duplicate/ghost identities.
**Priority:** P2
**Status:** Resolved (2026-09-15)
**Resolution:** Updated `getTeamPulse()` to use active `team_members` as the single source of truth, bridging `profile_id` for task assignments, calculating deterministic capacity status badges (*Under Capacity*, *Balanced*, *Heavy Load*, *Overloaded*), and rendering member photos.

---

**Feature:** Work OS — Client Projects & Inquiry Conversion
**Issue:** Client projects had no explicit Project Lead / Project Owner field (lead was previously inferred from task assignees), and converting an inquiry into a project generated starter tasks without assignees or deadlines.
**Priority:** P1
**Status:** Resolved (2026-09-15)
**Resolution:** Phase 1 implementation added explicit `lead_id UUID REFERENCES public.profiles(id)` via migration `20260915210000_add_client_projects_lead_id.sql`. `ConvertToProjectModal` now allows selecting Project Lead, inputs start & target delivery dates, and previews/persists starter tasks with deterministic specialist assignments and relative milestone deadlines (`assignStarterTasksIntelligently`). Project Workspace prominently displays the Project Lead decoupled from task assignees, with direct access to member workspace.

---

**Feature:** Content Integrity
**Issue:** `projects`, `team_members`, `testimonials` tables contain fabricated demo data (fake clients, metrics, team bios, quotes, stock photography) seeded by migration `20260512231409`.
**Priority:** Critical
**Status:** Open
**Possible Solution:** Replace with real SADA clients/team/testimonials, or explicitly mark as non-production placeholder data if the site isn't live yet. See `.memory/06_clients.md`.

---

**Feature:** Projects CMS
**Issue:** Schema has both `results` (base schema) and `results_summary` (added later, migration `20260606183754`) — app code only reads/writes `results`.
**Priority:** Medium
**Status:** Resolved (2026-07-31)
**Resolution:** `results` is the authoritative qualitative-results field across all app code (`admin.projects.tsx`, `case-studies.$slug.tsx`); quantitative results now live in the separate `metrics` jsonb column (value/label/source/period). `results_summary` is confirmed dead — no code reads or writes it. Left in place (empty table, harmless) rather than dropped in this pass; safe to drop in a future migration if desired.

---

**Feature:** Projects CMS — Gallery
**Issue:** Gallery items are bare media URLs — no alt text, no captions, no explicit per-item order field.
**Priority:** Medium
**Status:** Open
**Possible Solution:** Move `gallery` from `text[]`/URL-array to a structured `jsonb` array of `{ url, alt, caption, order }`, update `MediaGallery`/`MediaUpload`.

---

**Feature:** Projects CMS
**Issue:** No Draft/Preview/Archive states — only a `published` boolean, so there's no way to preview a project before it goes live or soft-archive an old one.
**Priority:** Medium
**Status:** Open
**Possible Solution:** Add a `status` enum (`draft`/`preview`/`published`/`archived`) and, for preview, either an admin-only route guard or a signed preview link.

---

**Feature:** Data architecture
**Issue:** `team_members` table (with `featured`/`socials`) and static `src/data/team.ts` both described what looked like the same three people — unclear which (if either) was the live source for any "Team" UI.
**Priority:** Low–Medium
**Status:** Resolved (2026-07-31)
**Resolution:** Team was consolidated into the About page using static `src/data/team.ts` as the single source (real names/roles, role-based icons instead of stock photos, no invented profile links beyond what already existed). The standalone `/team` public route and `/admin/team` CRUD page were removed. The `team_members` Supabase table itself was left in place (schema only, RLS intact) but nothing in the app reads or writes it anymore — safe to drop in a future migration if desired.

---

**Feature:** Brand / Typography
**Issue:** Project brand guidance assumes "uploaded/custom SADA fonts already implemented"; actual implementation loads Sora + Manrope from Google Fonts CDN, and the declared accent font (Orbitron) isn't loaded at all.
**Priority:** Low
**Status:** Open
**Possible Solution:** Either source and add real custom font files, or update brand guidance to reflect Google Fonts as the accepted approach.

---

**Feature:** Security / Config
**Issue:** `.env` is present in the repo and not listed in `.gitignore`.
**Priority:** Medium
**Status:** Resolved (2026-07-31)
**Resolution:** Added `.env`/`.env.*` to `.gitignore` and ran `git rm --cached .env` to stop future tracking (file stays on disk, existing commits are untouched). Verified `.env` today only ever held public `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY`/`VITE_*` values — anon/publishable keys are meant to be public and are protected by RLS, so this was a hygiene fix, not an active secret leak. Also confirmed `SUPABASE_SERVICE_ROLE_KEY` (used by the auto-generated, unused `client.server.ts`) is not set anywhere and that file is never imported client-side.

---

**Feature:** Footer
**Issue:** "Privacy Policy" and "Terms of Service" links both point to `/` (home) — placeholders, not real legal pages.
**Priority:** Medium
**Status:** Open
**Possible Solution:** Draft and publish real legal pages before launch.

---

**Feature:** Tooling
**Issue:** Both `bun.lock` and `package-lock.json` exist in the repo — unclear which package manager is authoritative.
**Priority:** Low
**Status:** Resolved (2026-07-31)
**Resolution:** `package-lock.json`/npm confirmed as the tooling actually in use (all `package.json` scripts and every build/lint/typecheck run this session used npm). Removed `bun.lock`.

---

**Feature:** Homepage / Media
**Issue:** `FeaturedProjects.tsx`'s use of `projects.featured` and `SmartMedia.tsx`'s responsive image (`srcset`/`sizes`) handling have not been directly verified by reading those files in full.
**Priority:** Low
**Status:** Partially resolved (2026-07-31)
**Resolution:** `FeaturedProjects.tsx` confirmed correct — filters `.eq("featured", true).eq("published", true)`, matches `projects_featured_idx (featured, sort_order)`. `SmartMedia.tsx` confirmed to have **no** `srcset`/`sizes` — it renders a single `<img src>`/`<video src>` with lazy-loading via `IntersectionObserver`, no responsive-image variants. Not fixed in this pass (would need an image transform pipeline Supabase Storage doesn't provide natively) — tracked in `.memory/10_todo.md`.

---

**Feature:** Product detail page — content integrity (found during 2026-07-31 production readiness audit)
**Issue:** `store.$id.tsx` hardcoded a fake "Trusted by 500+ brands" star-rating line and two fabricated client testimonials ("Layla R., Founder", "Omar T., Creative Director") shown on **every** product regardless of real data — a direct violation of the content-integrity rule.
**Priority:** Critical
**Status:** Resolved (2026-07-31)
**Resolution:** Both blocks removed. `DEFAULT_FEATURES`/`DEFAULT_FAQ` (generic policy copy — refund window, license terms, update policy) were kept since they don't assert unverifiable facts about named people/brands, but the business owner should confirm these policies are actually true for every product before launch.

---

**Feature:** Products CMS
**Issue:** `products` table has no `slug` column — the public product page routes on raw UUID (`/store/$id`), unlike `blog_posts` and `projects` which both use readable slugs. Less SEO-friendly URLs.
**Priority:** Low–Medium
**Status:** Open
**Possible Solution:** Add a `slug` column (+ index), rename the route to `/store/$slug`, update `admin.products.tsx`, `store.tsx`, and `store.$id.tsx` links. Deliberately not done in this pass — it's a routing/schema change, not a pure audit fix, and the `products` table is currently empty so there's no migration risk in doing it later.

---

**Feature:** SEO — sitemap
**Issue:** No `sitemap.xml` existed. `robots.txt` also didn't exist.
**Priority:** Medium
**Status:** Partially resolved (2026-07-31)
**Resolution:** Added `public/robots.txt` (allows all crawling, disallows `/admin` and `/auth`). Did **not** generate `sitemap.xml` — the project has no confirmed production domain yet (`wrangler.jsonc` has no custom route/domain bound), and a sitemap requires absolute URLs; inventing a placeholder domain would itself be fake content. Generate it once the real domain is known — ideally a dynamic route reading published slugs from `blog_posts`/`projects`/`products`, not a static file, so it stays correct as content is added.

---

**Feature:** Financial Command Center — `/admin/finance` Runtime Crash & Error Boundary Fallback
**Issue:** Navigating to `/admin/finance` caused the global root error boundary to catch an unhandled exception, displaying raw untranslated translation keys (`error.title`, `error.subtitle`, `error.tryAgain`, `error.goHome`) instead of the Financial Command Center.
**Priority:** Critical
**Status:** Resolved (2026-09-25)
**Resolution:**
1. **TDZ & Hoisting Remediation in `IncomeTable.tsx`:** Identified fatal `ReferenceError: Cannot access 'handleOpenCreate' before initialization` caused by an anti-pattern `useState(() => { if (openCreateModal) handleOpenCreate(); })` declared prior to `const handleOpenCreate = ...`. Replaced with `useCallback` for `handleOpenCreate` followed by an explicit `useEffect([openCreateModal, handleOpenCreate])`. Applied corresponding modal synchronization in `ExpenseTable.tsx`.
2. **Translation & Error Boundary Architecture in `__root.tsx`:** TanStack Router mounts `ErrorComponent` and `NotFoundComponent` outside `RootComponent` where `I18nProvider` is mounted. When unhandled exceptions bubbled to the root, `useTranslation()` defaulted to `(k) => k`, causing raw untranslated keys (`error.title`). Wrapped `ErrorComponent` and `NotFoundComponent` in `<I18nProvider>`, properly translating all keys in English and Arabic while preserving full developer diagnostics (error name, message, and formatted stack trace).
3. **Date Parsing Resilience:** Hardened date parsing across all finance views (`FinanceOverviewChart.tsx`, `AuditTrailView.tsx`, `SalaryRequestsView.tsx`, `IncomeTable.tsx`, `ExpenseTable.tsx`) with safe date parsing helpers so malformed or null values never throw `RangeError: Invalid time value`. Added an executive Retry button to `AdminFinancePage`'s query error banner.
4. **Automated Verification:** Verified 100% success across all regression suites: `verify-boubakar-super-admin.ts` (25/25), `test-rbac-system.ts` (45/45), `test-finance-system.ts` (35/35), headless browser CDP tab & modal verification (7/7 tabs + inflow/outflow modals), and `npm run build` production client + Nitro SSR bundle.

---

**Feature:** SADA OS Deals & CRM — Legacy Package Foreign Key (`deals.package_id -> public.packages`)
**Issue:** `deals.package_id` and four related tables held legacy foreign keys pointing to `public.packages(id)` instead of canonical `public.package_catalog(id)`. This required an application-level fallback bridge in `sales-service.ts` and dual-write triggers on `package_catalog`.
**Priority:** High
**Status:** Resolved (2026-10-01)
**Resolution:**
1. Applied migration `20261001103000_migrate_packages_foreign_keys_to_package_catalog.sql` replacing legacy foreign keys across all 5 tables (`deals`, `clients`, `client_deliverables`, `project_tasks`, `production_bookings`) to point directly to `public.package_catalog(id) ON DELETE SET NULL`.
2. Removed application fallback bridge and mirror inserts from `sales-service.ts` and `package-service.ts`.
3. Updated PostgREST joins to `.select("*, package:package_catalog(*)")`.
4. Dropped dual-write trigger `trg_sync_package_catalog_to_packages`.
5. Marked `public.packages` table as DEPRECATED.
6. 100% verified across 5 automated test suites: `test-package-catalog-fk-migration.ts` (8/8), `verify-phase8-canonical-package-integrity.ts` (7/7), `test-business-logic-verification.ts` (13/13), `test-phase7-and-phase8.ts` (21/21), `test-realtime-notifications-kpis.ts` (11/11), `tsc` (0 errors), and `npm run build` (0 errors).



---

**Feature:** SADA OS Work & Task Execution — Task Details Dialog Lifecycle & Close Reopen Defect
**Issue:** On /admin/my-work?task=e88e3c9f-2920-4943-b0af-c14fbd46757d, clicking Close failed to permanently close the dialog (either reopened immediately or failed to close), and earlier attempts with closedTaskIdRef prevented browser Forward history navigation and notification deep-link reopening.
**Priority:** Critical
**Status:** Resolved (2026-10-09)
**Resolution:**
1. **Single Source of Truth & Clean Cleanup:** Synchronized handleCloseTask to immediately purge both 	ask and 	askId search parameters while preserving unrelated filters and query state.
2. **Lifecycle Guard Clearing:** Reset closedTaskIdRef.current = null as soon as !targetTaskId is reached, preventing race conditions during asynchronous route state transitions while allowing legitimate Forward navigation and subsequent deep-link openings.
3. **Four Close Pathways Tested & Verified:** Verified Footer Close button, Header X button, Backdrop click, and Escape key all close the modal and update the URL synchronously.
4. **Automated Verification:** Verified 22/22 tests passed in scripts/test-task-modal-and-selection-controls.ts (including >2.5s delay persistence, resize/rerender stability, Back/Forward browser history, and notification ?taskId= deep link).

---

**Feature:** SADA OS UI System — Selection Controls (Checkbox & Radio) Accessibility & High-Contrast Visual Repair
**Issue:** Checkboxes and radio buttons displayed virtually identical visual styles between checked and unchecked states across light and dark themes. In task subtasks, completed deliverables did not communicate clear visual completion, violating accessibility and SADA Design System specifications.
**Priority:** High
**Status:** Resolved (2026-10-09)
**Resolution:**
1. **Canonical Checkbox Controls (SADACheckbox, Checkbox):**
   - Unchecked: High-contrast border outline (order-slate-400/80 dark:border-slate-500/80), neutral interior, no checkmark.
   - Checked: Solid SADA primary blue background (g-primary), high-contrast centered white checkmark (stroke-[3]).
   - Indeterminate: Solid primary background with centered white horizontal minus dash.
   - Shapes: Square (forms, tables) and Circular (tasks, subtasks).
2. **Canonical Radio Controls (SADARadioGroup, RadioGroup):**
   - Unselected: Crisp outer ring outline.
   - Selected: Solid primary border with centered solid primary dot (size-2.5 rounded-full bg-primary).
   - Cards: Interactive container with active primary border, tinted background, and centered dot.
3. **Visual QA & Screenshots:** Captured full visual inspection matrix in scripts/inspect-selection-controls-visual.ts across light and dark modes (controls_matrix_dark.png, controls_matrix_light.png, subtask_checkbox_checked_dark.png, subtask_checkbox_unchecked_dark.png).

---

**Feature:** SADA OS Sales Pipeline — Production Sales Conversion RPC & Migration 96 Deployment Blocker
**Issue:** 
1. Live production RPC `public.convert_lead_to_sale` currently runs the Phase I definition (`20261007200000`). If `p_client_id` is omitted during lead conversion, it fails with a `23502` NOT NULL constraint violation on `sales_commissions.client_id`.
2. Production RPC privileges currently grant `EXECUTE` to `PUBLIC` and `anon`.
**Priority:** High (Operational Blocker for Sales Conversion Persistence)
**Status:** Remediated in repository / Pending Operator Deployment (2026-10-15)
**Resolution:**
1. Target migration `supabase/migrations/20261014220000_harden_convert_lead_client_id.sql` resolves both issues: implements `COALESCE(p_client_id, v_deal.client_id)` server-side fallback and adds explicit `REVOKE EXECUTE ... FROM PUBLIC, anon;` followed by `GRANT EXECUTE ... TO authenticated, service_role;`.
2. Verified 8/8 tests passing in native local PostgreSQL 16 suite (`sada_local_test`).
3. Production migration ledger is clean and ready (latest version is `20261010140000`). Pending operator deployment via Supabase Dashboard SQL Editor under zero-mutation rules.

---

**Feature:** SADA OS Account Operations Center — Account Deletion Database Constraints (`DEFECT-P2-01`, `DEFECT-P2-02`, `DEFECT-P2-03`)
**Issue:** 
1. `admin_delete_account` Branch A omits updating `team_members.user_id = NULL`, triggering `team_members_user_id_fkey` foreign key violation on `auth.users` delete (`DEFECT-P2-01`).
2. `public.user_sessions` foreign key `user_id REFERENCES auth.users(id) ON DELETE CASCADE` conflicts with `trg_prevent_delete_user_sessions` immutability trigger, preventing deletion of any account with historical sessions (`DEFECT-P2-02`).
3. `public.profiles.id REFERENCES auth.users(id) ON DELETE CASCADE` automatically destroys the soft-archived tombstone profile (`status = 'deleted', display_name = '[Deleted Account]'`) when `auth.users` is deleted in Branch A (`DEFECT-P2-03`).
**Priority:** High (Account Deletion & Data Retention Integrity)
**Status:** Resolved (2026-10-17) — Forward-Only Migration `20261017163000_remediate_account_deletion_integrity.sql` Certified in Local PostgreSQL 16 Suite (`scripts/certify-phase2a-deletion-integrity.ts`)
**Resolution:**
1. **DEFECT-P2-01**: Updated `admin_delete_account` Branch A to nullify both `profile_id = NULL` and `user_id = NULL`, and set `is_active = false` on `public.team_members`, avoiding foreign key violations while preserving project task attribution.
2. **DEFECT-P2-02**: Updated `admin_analyze_account_dependencies` to count `user_sessions` and flag `has_business_dependencies = true` whenever sessions exist. In `admin_delete_account` Branch A, active sessions are bulk revoked (`status = 'revoked', revocation_reason = 'account_deleted'`) while leaving historical session rows intact. The `trg_prevent_delete_user_sessions` trigger is never violated or bypassed. Branch B hard-purge is restricted to accounts with zero dependencies and zero historical sessions.
3. **DEFECT-P2-03**: In Branch A, `auth.users` is permanently locked (`banned_until = '3000-01-01'::timestamptz`, `encrypted_password = NULL`, metadata tagged `deleted = true`), operational roles and permissions are purged, and the `public.profiles` tombstone row (`status = 'deleted', display_name = '[Deleted Account]'`) is permanently preserved without FK cascade annihilation. `admin_list_accounts` excludes tombstoned accounts (`WHERE COALESCE(p.status, 'active') != 'deleted'`).
4. **Verification**: 10/10 assertions certified in `scripts/certify-phase2a-deletion-integrity.ts`. Phase 1A local runtime suite (14/14), Phase 1A CSV suite (42/42), `tsc` (0 errors), and `npm run build` (0 errors) all pass cleanly. Zero mutations against shared production database.

---

**Feature:** SADA OS Account Operations Center — `admin_analyze_account_dependencies` Branch B Blind Spots (`DEFECT-P2-05`)
**Issue:** 
During Phase 2A.1 migration and authorization review, static analysis of `public.admin_analyze_account_dependencies(UUID)` uncovered that it queries `project_tasks`, `project_activity`, `client_projects`, `salary_records/payments/requests`, and `user_sessions`, but omits checking:
1. `public.sales_commissions` (`team_member_id`) — Branch B deletion of `team_members` would CASCADE DELETE commission records!
2. `public.deals` (`sales_owner_id`, `commission_recipient_id`)
3. `public.business_rules` (`updated_by`) & `public.business_rule_versions` (`changed_by`) — RESTRICT foreign keys causing `DELETE FROM auth.users` in Branch B to fail!
4. `public.account_audit_logs` & `system_audit_logs` (`actor_id`) — `ON DELETE SET NULL` triggers immutable audit update triggers, causing Branch B to abort!
**Priority:** Medium (Affects Branch B Hard Purge for accounts with non-task operational references)
**Status:** Resolved (2026-10-17) — Forward-Only Migration `20261017170000_remediate_hard_purge_dependency_integrity.sql` Certified in Local PostgreSQL 16 Suite (`scripts/certify-phase2a2-hard-purge-remediation.ts`)
**Resolution:**
1. Hardened `public.admin_analyze_account_dependencies(UUID)` with dynamic schema inspection (`to_regclass` and `information_schema.columns`) to count references in:
   - `public.sales_commissions` (`team_member_id` and `approved_by`)
   - `public.deals` (`sales_owner_id` and `commission_recipient_id`)
   - `public.business_rules` (`updated_by`)
   - `public.business_rule_versions` (`changed_by`)
   - `public.account_audit_logs` (`actor_id`)
   - `public.system_audit_logs` (`actor_id`)
2. Evaluates `has_business_dependencies := true` and `requires_soft_archive := true` whenever any reference exists across operational, commercial, financial, governance, or audit logs.
3. Hardened `public.admin_delete_account(UUID)` so Branch B hard purge strictly executes ONLY when `requires_soft_archive = false` (pristine account with zero dependencies across all tables).
4. Accounts with any commercial, financial, governance, or audit records are safely routed to Branch A (soft-archive deactivation: credentials wiped, account permanently locked, roles/permissions revoked, team members de-linked, profile tombstoned, historical foreign keys preserved).
5. **Verification**: 16/16 assertions certified in `scripts/certify-phase2a2-hard-purge-remediation.ts` (including sales commissions, deals, business rules, immutable audit logs, pristine clean purge, RBAC bounds, and atomic rollback under forced failure). Phase 2A suite (10/10), Phase 1A runtime suite (14/14), Phase 1A CSV suite (42/42), `tsc` (0 errors), and `npm run build` (0 errors) all pass cleanly. Zero mutations against shared production database.

