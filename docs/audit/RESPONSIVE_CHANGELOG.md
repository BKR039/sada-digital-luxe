# SADA OS — Responsive UX Changelog

**Release:** SADA OS 2.5 Universal Responsive Release  
**Date:** 2026-10-11  
**Verification:** Automated Browser QA Suite (`scripts/capture-mobile-refined-qa.ts`), TypeScript (`tsc --noEmit`), Vite + Nitro Production Build (`npm run build`)  

---

## 1. Summary of Changes

This release completes the universal responsive UX refinement across SADA OS, establishing clean information hierarchy, touch-friendly interactions, adaptive table presentations, and progressive disclosure dialogs across all supported viewports (320px–1440px+).

---

## 2. Modified Components & Detailed Diff Summary

### `src/lib/analytics-service.ts`
- **Query Column Fix:** Removed non-existent `category` column from `client_projects` query on line 72, eliminating HTTP 400 Bad Request error that previously caused the Executive Command Center to stall in a permanent skeleton state.

### `src/lib/notification-service.ts`
- **PostgREST Enum Filter Fix:** Fixed line 813 from `.not("status", "in", "('done','delivered','approved')")` to `.not("status", "in", "(done,delivered,approved)")`, eliminating Postgres `22P02: invalid input value for enum` error.
- **Deliverable Columns Fix:** Fixed line 939 from non-existent `deliverable_name` to canonical `deliverable_type, title`.

### `src/i18n/locales/modules/admin-tasks.ts`
- **Executive Subtitle Translation:** Updated `executiveDesc` in English (`"Agency pulse: financial health, operations, clients, performance and risks."`) and Arabic (`"نبض الوكالة: الصحة المالية، العمليات، العملاء، الأداء والمخاطر."`) to ensure compact, professional copy matching the design specification.

### `src/routes/admin.index.tsx`
- **Scope Switcher:** Maintained a single-strip 3-segment switcher (`⭐ Command`, `👤 My Execution`, `🏢 Agency`) for viewports < 640px.
- **Quick Action Dock:** Added mobile 3-tile grid (`+ New Task` blue +, `📁 Workspaces` folder, `📞 Follow-up` phone) matching exact SADA design specifications.
- **Header Fluidity:** Cleaned up date badge and tenant title to prevent text wrapping on narrow screens.

### `src/components/admin/ExecutiveCommandCenter.tsx`
- **Level 1 Overview:** Implemented 2×2 metric grid (`Collected Revenue`, `Operating Spent`, `Active Projects`, `Pending Client Items`) with embedded period badge (`This Month ▾`).
- **Quick Insights:** Added priority alert card for projects requiring client attention, with direct actionable navigation link (`View all →`).
- **Tab Integration:** Preserved all deep executive tabs, financial analytics, and operational metrics behind clean responsive switches.

### `src/components/admin/TaskDetailModal.tsx`
- **Single-Scroll Architecture (P0 Fix):** Restructured the modal DOM so that the dialog contains a compact header (`shrink-0 flex-none`), a single continuous primary scroll container `#task-detail-scroll-container` (`flex-1 min-h-0 overflow-y-auto overscroll-y-contain flex flex-col`), and an anchored footer (`shrink-0 pb-safe`).
- **Elimination of Nested Scroll Traps:** Relocated Title/Metadata summary, Current Stage brief, and Action Button bar into the primary scroll container, allowing them to scroll naturally out of the way on mobile swiping gestures. Removed nested `overflow-y-auto` from inner accordion body and changed backdrop from `overflow-y-auto` to `overflow-hidden`.
- **Header Restructure:** Replaced overloaded header with a clean top bar (`SUBTASK` badge, bulleted client chip `MAISON CARTHAGE LUXURY`, `✕` close button).
- **Stage Numbering Sanitization:** Added regex sanitization `activeStage.title.replace(/^\d+[\.\-\s]+/, "")` before formatting the stage number, preventing duplicate numbering (`1. 1. Creative Brief` -> `1. Creative Brief`).
- **Metadata Hierarchy:** Added 2 clean metadata rows: Lead assignee with avatar initials (`Lead: BKR039 [BK]`), priority pill (`● High`), due date, and status pill (`● To Do`).
- **Context Card:** Added dedicated Parent Task card with direct `View →` link.
- **Execution Cockpit:** Prominent primary action (`▶ Start Task`), 2-column secondary action row (`Postpone`, `Mark Blocked`), and tertiary link (`Send Alert`).
- **Task Ownership Card Responsiveness:** Set detailed task ownership card to `hidden sm:block`, keeping the mobile `Task Details` accordion strictly to the compact 6-item KPI summary grid (Status, Priority, Deadline, Assignee, Progress, Subtasks) so that all 3 accordions fit comfortably on mobile.
- **Footer:** Touch-friendly full-width `Close` button.

### `src/components/admin/packages/PackageEditorDrawer.tsx`
- **Header & Mode Switcher:** Made package title truncate gracefully on screens ≤ 390px, paired with compact `Config` / `Preview` pill buttons.
- **Quota Counters:** Enabled responsive single-column stacking for stepper inputs on narrow phones.
- **Footer Layout:** Built fluid stacking footer ensuring margin calculations and action buttons never collide or wrap awkwardly (`Price: 1 090 TND · Margin: 55.0%`).

### `src/components/admin/NotificationCenter.tsx`
- **Mobile Drawer Polish (DEF-B):** Set `showCloseButton={false}` on `SADADrawer` to eliminate duplicate floating close button. Compacted unread and priority pills, ensured `shrink-0` to avoid clipping, and added `pb-8` scroll clearance above footer telemetry.

### `src/components/admin/finance/FinanceKPICards.tsx`
- **Header & Grid Modernization (DEF-D):** Stacked title and time-range controls on mobile (`flex-col sm:flex-row`). Transformed 4 primary KPI cards from single-column vertical sprawl into a responsive 2-column mobile grid (`grid-cols-2 sm:grid-cols-2 lg:grid-cols-4`).

### `src/components/admin/SalesWorkspaceView.tsx`
- **Tab Bar Reflow (DEF-E):** Added `overflow-x-auto no-scrollbar` and `shrink-0 whitespace-nowrap` to tab navigation strip, eliminating truncation of "Commission Management & Rules".

### `src/components/admin/ExecutiveCommandCenter.tsx`
- **Bilingual RTL Integrity (DEF-G):** Replaced hardcoded English fallbacks in Level 1 Overview metrics, trend copies, and insight banners with localized Arabic equivalents.

### `src/routes/admin.my-salary.tsx`
- **Dual-View Mobile Record Cards:** Transformed 3 data tables (Payouts History, Sales Commissions, Work Sessions) into `hidden md:block` desktop tables and `block md:hidden` structured mobile cards with isolated monetary typography (`dir="ltr" font-mono tabular-nums`) and clean badge layouts.

### `src/components/admin/finance/InvoicesRevenueView.tsx`
- **Fluid Search & Mobile Invoice Cards:** Converted 9-column invoice table on phones to structured cards displaying invoice number, client tag, date, gross/fee/net amounts, status pill, and direct payment action. Made search and status filter bar wrap fluidly.

### `src/components/admin/finance/CanonicalLedgerView.tsx`
- **Double-Entry Mobile Ledger Cards:** Transformed 7-column canonical ledger into mobile record cards displaying transaction inflow/outflow with color-coded directional signs, allocation tags, and counterparty badges. Converted filter controls to fluid grid.

### `src/components/admin/finance/SalariesView.tsx` & `SalaryRequestsView.tsx`
- **Salary Payout & Request Mobile Cards:** Added dual-view mobile record cards for processed salary payouts and approved employee salary draw requests, keeping all amounts, approval dates, payment methods, and notes fully accessible.

### `src/components/admin/finance/SponsoringEngineView.tsx` & `CommissionsView.tsx`
- **Campaign & Sales Commission Record Cards:** Replaced 9-column sponsoring campaigns table and 7-column sales commissions table with responsive mobile cards showing spend arbitrage, profit margins, client tags, and action buttons.

### `src/routes/admin.team-workload.tsx`
- **Workload Card Unbreakable Email Fix & Fluid Tabs:** Added `min-w-0` and `truncate` to member email containers, preventing 481px unbreakable string expansion on mobile; added `overflow-x-auto scrollbar-none` to tabs container; fluidly wrapped bulk assignment controls.

### `src/routes/admin.calendar.tsx` & `src/components/admin/CalendarGrid.tsx`
- **Fluid Selectors & Follow-up Bounds:** Made member switcher and filter selectors fluid on mobile (`w-full sm:w-auto`); added `overflow-hidden` and `min-w-0 flex-wrap` to `FollowupPill` in calendar month cells, preventing label overflow across cell borders.

### `src/components/admin/TaskModal.tsx`, `CompleteEditingModal.tsx`, `PublishContentModal.tsx`
- **Sticky Footer Action Stacking:** Converted side-by-side action buttons on mobile to responsive stacked layouts (`flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5`) with full-width primary/secondary actions, preventing button collisions in Arabic RTL.

### `src/routes/pricing.tsx`
- **Hero Glow Containment & Responsive Typography:** Enclosed the 1000px decorative radial glow inside an `overflow-hidden` container, eliminating 695px horizontal document overflow; made page title responsive (`text-2xl sm:text-4xl md:text-5xl lg:text-6xl`).

### `src/components/site/AIAssistant.tsx`
- **Launcher Pulse Indicator Containment:** Positioned pulse dot inside button perimeter (`top-0.5 end-0.5 size-2.5`), eliminating 4px button bounding box expansion.

### `src/routes/admin.index.tsx`
- **Tablet Header Responsiveness:** Adjusted header layout to `flex-col xl:flex-row` and scope switcher container to `w-full sm:w-auto shrink-0`, preventing button squeezing on 768px tablet viewports.

---

## 3. Quality & Regression Verification

- `npx tsc --noEmit`: Exited with code 0 (0 type errors).
- `npm run build`: Exited with code 0 (clean Vite + Nitro SSR production build in 17.33s).
- Universal Automated Viewport Suite (`scripts/audit-all-routes-responsive.ts`):
  - **160 route-viewport combinations audited** across 8 viewports (`320x640`, `360x800 en/ar`, `390x844 en/ar`, `430x932`, `768x1024`, `1280x800`).
  - **0 document overflows detected across all 160 checks** (`docOverflow = 0px` for 100% of tested routes and viewports).
- Automated Real Interaction Suite (`scripts/test-mobile-interactions-qa.ts`): 15 of 15 automated real phone interactions passed (100% success rate).
- Backend SSOT Guarantee: Zero database schema changes, zero RLS policy modifications, zero formula alterations.
- Audit Documentation: `docs/audit/UNIVERSAL_RESPONSIVE_UX_AUDIT.md`, `docs/audit/RESPONSIVE_DEFECT_REGISTER.md`, `docs/audit/UNIVERSAL_PAGE_ACCEPTANCE_MATRIX.md`.

