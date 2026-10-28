# SADA OS — Package Catalog Data Traceability & SSOT Map
**Phase B: Single Source of Truth & Field Traceability**

**Audit Date:** October 16, 2026  
**Auditor:** SADA OS Quality & Systems Security Gate  
**Authoritative Table:** `public.package_catalog`  
**Secondary Tables:** `public.package_categories`, `public.package_addons`  
**Deprecated Table:** `public.packages`  

---

## 1. Field-by-Field SSOT Traceability Matrix

Every field in the package domain is mapped from its canonical database location to its authoritative write path and all active downstream read paths:

| Field Group | Database Column | Authoritative Write Path | Active Read Paths | Consumer Context |
| :--- | :--- | :--- | :--- | :--- |
| **Package Code** | `package_catalog.code` | Admin Editor (`updatePackage`, `createPackage`) | `/pricing`, `/admin/packages`, `/contact`, `deals`, `clients` | Natural identifier; URL search param (`/contact?package=CODE`) |
| **Name (EN/AR)** | `package_catalog.name`, `name_ar` | Admin Editor | `/pricing`, `/contact`, `/admin/packages`, Client 360, Deal Header | Bilingual display title |
| **Slug** | `package_catalog.slug` | Admin Editor (auto-slugified) | Route loader, Direct Package Selector | URL-friendly identifier |
| **Category** | `package_catalog.category_id` | Admin Editor (Select dropdown) | `/pricing` (grouping), `/admin/packages` (filter), Direct Selector | Taxonomy grouping |
| **Selling Price** | `package_catalog.price` | Admin Editor (`price >= 0`) | `/pricing`, `/contact`, Smart Match budget scoring, Client setup | Commercial retail rate (TND) |
| **Billing Model** | `package_catalog.billing_type` | Admin Editor (`monthly`, `one_time`, `starting_from`, `custom`) | `/pricing`, Public Card badge, Client contract billing | Recurring retainer vs project billing |
| **Custom Scope** | `package_catalog.custom_pricing` | Admin Editor (Switch toggle) | Public Card CTA ("Request Custom Scope"), Lead intake | Bypasses standard fixed price |
| **Cost: Employee** | `package_catalog.employee_cost` | Admin Editor (Number input) | Admin Drawer KPI, ECC Profitability | Internal labor cost allocation |
| **Cost: Freelancer**| `package_catalog.freelancer_cost` | Admin Editor (Number input) | Admin Drawer KPI, ECC Profitability | External creative contractor cost |
| **Cost: Transport** | `package_catalog.transport_cost` | Admin Editor (Number input) | Admin Drawer KPI, ECC Profitability | On-site shoot travel expense |
| **Cost: Software**  | `package_catalog.subscription_allocation` | Admin Editor (Number input) | Admin Drawer KPI, ECC Profitability | Tooling & SaaS seat allocation |
| **Cost: Commission**| `package_catalog.commission` | Admin Editor (Number input) | Admin Drawer KPI, ECC Profitability | Sales rep commission allocation |
| **Direct Costs**    | `package_catalog.direct_costs` | **PostgreSQL Generated Column** | Admin Drawer, CMS Table KPI | Stored formula: sum of 5 cost inputs |
| **Gross Profit**    | `package_catalog.gross_profit` | **PostgreSQL Generated Column** | Admin Drawer, CMS Table KPI | Stored formula: `price - direct_costs` |
| **Gross Margin %**  | `package_catalog.gross_margin` | **PostgreSQL Generated Column** | Admin Drawer, CMS Table KPI | Stored formula: `(gross_profit / price) * 100` |
| **Reels Quota**     | `package_catalog.monthly_reels` | Admin Editor (Number stepper) | `/pricing`, Smart Matcher, `package-reconciliation-service` | Generates recurring tasks |
| **Posts Quota**     | `package_catalog.monthly_posts` | Admin Editor (Number stepper) | `/pricing`, Smart Matcher, `package-reconciliation-service` | Generates recurring tasks |
| **Stories Quota**   | `package_catalog.monthly_stories` | Admin Editor (Text / Stepper) | `/pricing`, Smart Matcher, `package-reconciliation-service` | Daily or weekly coverage quota |
| **Shooting Hours**  | `package_catalog.production_hours` | Admin Editor (Number stepper) | `/pricing`, Operations, Production Booking | Camera time allocation |
| **Shooting Sessions**| `package_catalog.production_sessions` | Admin Editor (Number stepper) | `/pricing`, Operations, Production Booking | On-site visit sessions |
| **Inclusions**      | `package_catalog.included_items` | Admin Editor (JSON array) | `/pricing`, `/contact` modal, Public Card, Client 360 | Granular feature checklist |
| **Exclusions**      | `package_catalog.excluded_items` | Admin Editor (JSON array) | `/pricing`, Public Card, Client 360 | Out-of-scope transparency |
| **Ads Scope**       | `package_catalog.has_ads_management` | Admin Editor (Switch toggle) | `/pricing`, Smart Matcher, Client 360 | Triggers Meta Ads campaigns |
| **Web Scope**       | `package_catalog.has_website` | Admin Editor (Switch toggle) | `/pricing`, Smart Matcher, Client 360 | Triggers Web deliverables |
| **Strategy Scope**  | `package_catalog.has_strategy` | Admin Editor (Switch toggle) | `/pricing`, Smart Matcher, Client 360 | Monthly strategic roadmap |
| **Community Scope** | `package_catalog.has_community_management` | Admin Editor (Switch toggle) | `/pricing`, Smart Matcher, Client 360 | Triggers DM & comment moderation |
| **Publication**     | `package_catalog.is_published` | Admin CMS (`publishPackage`, `hidePackage`) | `/pricing` (loader), `/contact` (selector) | Controls public web availability |
| **Active Status**   | `package_catalog.is_active` | Admin CMS (`archivePackage`, `deletePackage`) | All read paths (must be true) | Soft-delete / Archive flag |
| **Display Order**   | `package_catalog.display_order` | Admin CMS (`reorderPackages`) | `/pricing`, `/admin/packages`, Matcher | Controls sorting across all views |

---

## 2. Legacy Fallbacks & Deprecated Sources

### 2.1 Static Fallback Array: `src/data/pricing.ts`
- **Contents:** Hardcoded array `PLANS` (`starter` @ 699 TND, `growth` @ 1090 TND, `premium` @ 2490 TND).
- **Status:** **DEPRECATED**.
- **Audit Finding:** [`src/data/pricing.ts`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/src/data/pricing.ts) is imported only in [`src/components/site/PackageConversionFlow.tsx`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/src/components/site/PackageConversionFlow.tsx) for its TypeScript interface types (`PricingPlan`, `PackageId`).
- **Runtime Precedence:** `PackageConversionFlow` actively queries `fetchPublicPackages()` and dynamically maps canonical database items via `mapCatalogItemToPlan()`. The hardcoded array is never rendered when database records exist.

### 2.2 Legacy Table: `public.packages`
- **History:** Legacy table from original schema (`20260508145232_plain_mode_schema.sql`).
- **Status:** **DEPRECATED**.
- **Audit Finding:** In migration [`20261001103000_migrate_packages_foreign_keys_to_package_catalog.sql`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/supabase/migrations/20261001103000_migrate_packages_foreign_keys_to_package_catalog.sql), all foreign keys on `deals`, `clients`, `client_deliverables`, `project_tasks`, and `production_bookings` were moved to `public.package_catalog`. The dual-write sync trigger was dropped. Zero operational code queries `public.packages`.

---

## 3. Data Integrity & Traceability Gaps Identified

During code-level inspection, three distinct data flow gaps were identified:

1. **Gap 1: Public Payload Exposure of Internal Costs (DEF-PKG-02):**
   `fetchPublicPackages()` and `fetchDirectPublicPackages()` execute `.select("*")` on `package_catalog`. Because RLS policies filter rows rather than columns, PostgREST returns all 8 internal financial cost columns (`employee_cost`, `freelancer_cost`, `transport_cost`, `subscription_allocation`, `commission`, `direct_costs`, `gross_profit`, `gross_margin`) to unauthenticated browser callers.
2. **Gap 2: Direct Selector URL Parameter Mismatch (DEF-PKG-03):**
   When public cards navigate to `/contact?package=CODE` (e.g. `package=MG-01`), [`DirectPackageSelector.tsx`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/src/components/contact/DirectPackageSelector.tsx#L43) matches only `p.id === initialPackageId || p.slug === initialPackageId`. It fails to check `p.code`, leaving the package unselected on the contact intake page.
3. **Gap 3: Smart Matcher Unpublished Filtering (DEF-PKG-01):**
   [`fetchMatcherEligiblePackages()`](file:///b:/Work/DIGITOUS/SADA/SADA%20Website/sada-digital-luxe/src/lib/smart-match-service.ts#L31) filters only by `is_active === true`, failing to filter by `is_published === true`. Unpublished draft packages could be recommended to public intake users if queries run in an authenticated context.
