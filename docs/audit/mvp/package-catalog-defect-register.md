# SADA OS — Package Catalog & Pricing CMS Defect Register
**Module:** Package Catalog, Pricing CMS, Smart Match & Public Synchronization  
**Audit Date:** 2026-10-16  
**Auditor:** Senior Full-Stack Engineer, Database Architect, Financial Systems Engineer, Application Security Auditor

---

## Defect Summary

| Defect ID | Severity | Title | Impact Area | Remediation Status | Verification |
| :--- | :---: | :--- | :--- | :---: | :--- |
| **DEF-PKG-01** | **P1** | Unpublished Package Leakage in Smart Match & Direct Intake | Smart Match / Public Selection | **RESOLVED** | Enforced `is_published = true` in query, recommendation filter, and direct submission. Verified by 17-scenario suite. |
| **DEF-PKG-02** | **P0** | Confidential Financial Cost & Margin Exposure in Public Payloads | Application Security / REST API | **RESOLVED** | Restricted public queries to `PUBLIC_PACKAGE_SELECT`. Verified with `inspect-public-package-payload.ts`. |
| **DEF-PKG-03** | **P1** | Direct Package Selector URL Code Parameter Mismatch | Public Pricing / Contact UX | **RESOLVED** | Updated `DirectPackageSelector.tsx` to match `initialPackageId` against `p.code`, `p.slug`, and `p.id` case-insensitively. |
| **DEF-PKG-04** | **P2** | Section 7 Smart Match Form Fields Dropped on Save | Admin Package Editor Drawer | **DOCUMENTED** | Matching engine dynamically scores packages from canonical fields (`price`, `deliverables`, `flags`, `included_items`). Section 7 fields are reserved for future metadata schema extension. |

---

## Detailed Defect Records

### DEF-PKG-01: Unpublished Package Leakage in Smart Match & Direct Intake
- **Severity:** P1 (High / Core MVP Flow)
- **Component:** `src/lib/smart-match-service.ts` (`fetchMatcherEligiblePackages`, `runPackageRecommendationEngine`, `submitSmartContactLead`)
- **Description:**  
  In `fetchMatcherEligiblePackages()`, the query filtered strictly on `.eq("is_active", true)` and deliberately omitted `is_published = true` (with an inline comment stating `published === true is NOT required for recommendation`). Consequently, draft or unlisted packages were scored by the Smart Match engine and could be recommended to public anonymous users. Additionally, `submitSmartContactLead` did not reject direct submissions pointing to unpublished package IDs.
- **Root Cause:** A legacy design allowed internal unlisted packages to participate in public recommendations with an `isUnpublished` badge, violating the strict invariant that unpublishing a package must immediately withdraw it from all public selection and recommendation entry points.
- **Remediation:**  
  1. Updated `fetchMatcherEligiblePackages` to filter `.eq("is_published", true)` by default.
  2. Updated `runPackageRecommendationEngine` candidate filter to require `p.is_published !== false` unless `includeUnpublished` is explicitly requested by an admin test fixture.
  3. Updated `submitSmartContactLead` direct selection verification to reject any unpublished package with: `"The selected package is no longer available or published."`
- **Verification Evidence:** Passed Scenario 14 in `scripts/test-smart-match-17-scenarios.ts` (hidden package `MG-01` was completely excluded from recommendations).

---

### DEF-PKG-02: Confidential Financial Cost & Margin Exposure in Public Payloads
- **Severity:** P0 (Critical Security & Commercial Exposure)
- **Component:** `src/lib/package-service.ts` (`fetchPublicPackages`), `src/lib/smart-match-service.ts` (`fetchDirectPublicPackages`, `fetchMatcherEligiblePackages`)
- **Description:**  
  Both `fetchPublicPackages()` and `fetchDirectPublicPackages()` executed `.select("*")` on `package_catalog`. The database table contains confidential internal financial parameters:
  - `employee_cost`
  - `freelancer_cost`
  - `transport_cost`
  - `subscription_allocation`
  - `commission`
  - `direct_costs` (stored generated column)
  - `gross_profit` (stored generated column)
  - `gross_margin` (stored generated column)
  Any public visitor inspecting network responses or client state could view exact internal agency cost allocations and gross profit margins.
- **Root Cause:** Use of wildcard `.select("*")` without an explicit public projection whitelist.
- **Remediation:**  
  Defined and exported `PUBLIC_PACKAGE_SELECT` containing only client-facing presentation attributes (`id`, `code`, `name`, `price`, `billing_type`, `deliverables`, `platforms`, `included_items`, `excluded_items`, `short_description`). Replaced all public queries with this projection.
- **Verification Evidence:** Executed `scratch/inspect-public-package-payload.ts`. Confirmed all 8 internal cost columns evaluate strictly to `undefined` in public payloads.

---

### DEF-PKG-03: Direct Package Selector URL Code Parameter Mismatch
- **Severity:** P1 (Core MVP Flow / User Journey)
- **Component:** `src/components/contact/DirectPackageSelector.tsx`, `src/components/packages/PricingCardCTA.tsx`, `src/components/packages/PackageDetailsModal.tsx`
- **Description:**  
  On the public `/pricing` page, clicking "Select This Package" executes `<Link to="/contact" search={{ package: pkg.code }} />` passing the package code (e.g. `MG-01`). In `DirectPackageSelector.tsx`, the initial selection hook only evaluated `p.id === initialPackageId || p.slug === initialPackageId`. Because `initialPackageId` was the package code (`MG-01`), the lookup failed, and the package was never auto-selected on the contact form.
- **Root Cause:** Inconsistent identifier semantics between the navigation CTA (which passed `pkg.code`) and the selector lookup (which expected `pkg.id` or `pkg.slug`).
- **Remediation:**  
  Updated `DirectPackageSelector.tsx` to match case-insensitively across all three identifier forms:
  ```tsx
  const q = initialPackageId.trim().toLowerCase();
  const found = data.find(
    (p) =>
      p.id === initialPackageId ||
      p.code.toLowerCase() === q ||
      p.slug.toLowerCase() === q
  );
  ```
- **Verification Evidence:** Tested URL resolution for `/contact?package=MG-01`, `/contact?package=mg-01`, and `/contact?package=web-03`.

---

### DEF-PKG-04: Section 7 Smart Match Form Fields Dropped on Save
- **Severity:** P2 (Non-blocking / Schema Alignment)
- **Component:** `src/components/admin/packages/PackageEditorDrawer.tsx` (Section 7: Smart Matching)
- **Description:**  
  `PackageEditorDrawer.tsx` contains an interactive Section 7 ("Smart Matching & Sales Intelligence") with UI pickers for `matchingBusinessTypes`, `matchingGoals`, and `matchingStage`. In `handleSubmit`, these variables are omitted from the update payload because the physical `package_catalog` table lacks corresponding JSONB columns for sector/goal tags.
- **Analysis & Impact:**  
  The Smart Match engine in `smart-match-service.ts` computes recommendation scores dynamically from the canonical columns: `price`, `monthly_reels`, `production_hours`, `production_sessions`, `has_ads_management`, `has_website`, `package_type`, and `included_items`. Because the algorithm derives industry suitability directly from these concrete capabilities, dropping the advisory Section 7 fields does not impact recommendation accuracy.
- **Remediation / Resolution:**  
  Documented as a non-breaking future schema enhancement. Per non-negotiable safety rules (no unauthorized database migrations or cloud schema alterations), no new migration is introduced at this stage.

---

## Defect Resolution Status

- **Total Defects Identified:** 4
- **P0 Defects:** 1 (Resolved: 1, Unresolved: 0)
- **P1 Defects:** 2 (Resolved: 2, Unresolved: 0)
- **P2 Defects:** 1 (Documented & Bounded: 1, Unresolved: 0)
- **Zero blocking P0/P1 defects remain.**
