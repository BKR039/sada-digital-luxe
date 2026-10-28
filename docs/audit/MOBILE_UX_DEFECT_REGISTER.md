# SADA OS — Mobile UX Defect Register & Baseline Audit

## Document Context
- **System:** SADA OS (Bousala / Luxury Creative Agency Operating System)
- **Scope:** Complete Mobile Experience Redesign across 320px, 360px, 375px, 390px, 430px, 600px, 768px, 1024px+
- **Status:** REMEDIATED & VERIFIED
- **Last Updated:** 2026-10-13

---

## Executive Defect Register

| Defect ID | Component / View | Target Viewport | Root Cause | Severity | Remediation Applied |
|:---|:---|:---|:---|:---|:---|
| **MOB-001** | `/admin/analytics` — Client Profitability Matrix | 320px–430px | 6 dense desktop table columns compressed into narrow phone width; labels collided into `...` and values overflowed | **P0 Critical** | Replaced mobile table with structured 2-column labeled metric blocks + full-width client drill-down action |
| **MOB-002** | `/admin/analytics` — Financial Trends Chart | 320px–390px | Standalone flex-wrap series toggle buttons wrapped unpredictably; X-axis month names collided; fractional Y ticks collided into duplicate integers | **P0 Critical** | Converted series toggles to 3-column compact segmented toggle; formatted X-axis to 3-letter month abbreviations; calibrated Y-axis tick intervals |
| **MOB-003** | `/admin/analytics` — Expense Ranking | 320px–360px | Horizontal tabs caused horizontal drift; vendor names overflowed progress bars; amount and rank collided | **P1 High** | Implemented 3-column segmented category selector; converted list items into clean 2-row layout with rank, name, count, amount, and progress |
| **MOB-004** | `/admin/analytics` — Executive Command Strip | 320px–360px | Fixed typography `text-lg` caused multi-thousand TND currency strings to truncate or wrap awkwardly | **P1 High** | Responsive font scaling (`text-xs min-[360px]:text-sm sm:text-lg`), tabular nums, and break-words |
| **MOB-005** | `/admin` — Executive Command Center | 320px–430px | Duplicate 2x2 Overview cards duplicated lower KPI cards; 3 quick action cards occupied 220px+ of vertical space | **P1 High** | Hidden redundant Overview cards on mobile (`hidden md:grid`); replaced oversized quick actions with a compact native 3-way action strip |
| **MOB-006** | `/admin/finance` — Inflows & Outflows Tables | 320px–430px | Filter selects had fixed widths (`w-44`, `w-36`, `w-32`) causing awkward stacking; card titles lacked shrink boundaries | **P1 High** | Converted filter selects into responsive grid containers (`grid-cols-2 min-[480px]:grid-cols-3`); added `min-w-0 flex-1` to titles |
| **MOB-007** | `/admin/sales` — Sales Pipeline & Commissions | 320px–430px | Table mode rendered 8–11 desktop columns with no mobile card representation; filter controls exceeded screen width | **P1 High** | Implemented mobile structured record cards for Pipeline, Commissions, and Performance Matrix; responsive filter grid |
| **MOB-008** | `/admin/packages` — Package Editor Drawer | 320px–390px | Hardcoded `p-6 rounded-3xl` consumed 48px of inner width on phones, cramping forms and number steppers | **P2 Medium** | Adjusted padding to `p-4 sm:p-6 rounded-2xl sm:rounded-3xl` across all 7 configuration sections |
| **MOB-009** | Task Detail Modal | 320px–360px | Modal content lacked explicit inner scroll container targeting, causing trapped scrolls on narrow screens | **P1 High** | Dedicated scroll architecture with flex column header, scrollable body, and sticky action bar verified |
| **MOB-010** | Bilingual / RTL Orientation | 320px–430px | LTR-specific margins caused badge and metric misalignment in Arabic mode | **P2 Medium** | Implemented logical CSS tokens (`ms-`, `me-`, `text-start`, `text-end`, `<bdi>`) across all revamped cards |
| **MOB-011** | `/admin` — Executive Section Headings | 320px–430px | Financial Command & Operations Command headings crammed title, description, and action into one horizontal row | **P1 High** | Redesigned into responsive white cards with circular colored icons, hierarchical typography, and right-aligned link affordance |
| **MOB-012** | `/admin` — Q5 Unpaid Client Receivables | 320px–430px | 7-column desktop invoice table squeezed into narrow card; dates, badges, and amounts collided | **P0 Critical** | Built dedicated mobile record card with amber accent bar, drill-down pill button, file icon, client name, invoice ID, due date, SENT badge, and prominent currency with "View →" |
| **MOB-013** | `/admin` — Available Cash Breakdown | 320px–430px | Displayed oversized empty container when accounts lacked secondary breakdown | **P2 Medium** | Replaced with compact card featuring circular green wallet icon, authoritative treasury balance, and drill-down link |
| **MOB-014** | Shared — Source Drill-Down Modal & Drawer | 320px–430px | Centered desktop dialog on mobile caused header truncation, unscrollable body, and fixed footer obscuring records | **P0 Critical** | Re-architected into mobile bottom sheet (`rounded-t-[28px]`, drag handle, single-scroll owner, aggregated value card, 2-column stats, and sticky footer with close pill) |
| **MOB-015** | Shared — Drill-Down Scroll Ownership | 320px–430px | Nested scroll containers caused trapped scrolling where header remained frozen and footer covered records | **P1 High** | Unified scroll architecture with a single `overflow-y-auto min-h-0` body between fixed header and sticky footer |

---

## Detailed Root Cause Analysis & Fix Details

### 1. Defect MOB-001: Client Profitability Mobile Matrix
- **Problem:** On phones 320px wide, the profitability table forced 6 dense columns into 290px of usable width. Revenue, Direct Costs, Contribution Profit, and Margin overlapped and truncated into unreadable dots.
- **Remediation:**
  - Built an explicit mobile representation (`block md:hidden`).
  - Followed the mandatory 6-row conceptual separation:
    1. Client / Venue Title + Status Badge.
    2. Revenue (labeled cell).
    3. Direct Costs (labeled cell).
    4. Contribution Profit (labeled cell).
    5. Contribution Margin (labeled cell).
    6. Relationship Status & Full-width drill-down action.
  - Implemented in both `src/routes/admin.analytics.tsx` and `src/components/admin/finance/ClientProfitabilityView.tsx`.

### 2. Defect MOB-002: Financial Trends Chart Series & Axis
- **Problem:** The chart series toggle buttons ("Revenue", "Expenses", "Net Profit") wrapped across 2 lines awkwardly. Recharts X-axis displayed full month names ("October 2026") that collided. Y-axis generated duplicate labels (`2k`, `2k`).
- **Remediation:**
  - Converted the buttons into a compact, unified 3-column segmented toggle (`grid grid-cols-3 gap-1 p-1 bg-muted/40 rounded-xl`).
  - Formatted X-axis ticks to 3-letter abbreviations (`May`, `Jun`, `Jul`, `Aug`, `Sep`, `Oct`).
  - Added single decimal formatting for fractional thousands (`1.5k`, `2.3k`) and expanded Y-axis width.

### 3. Defect MOB-003: Expense Ranking List & Selectors
- **Problem:** Category/Vendor/Attribution selector buttons caused horizontal overflow. Ranking items placed vendor name, transaction count, percentage, and amount on a single line, causing severe collisions.
- **Remediation:**
  - Replaced standalone buttons with a compact 3-way segmented control (`grid grid-cols-3`).
  - Restructured each mobile ranking item into a 2-line layout:
    - Line 1: Rank Badge + Name (truncated with ellipsis if needed) + Percentage badge.
    - Line 2: Transaction count (left) + bold monetary amount (right).
    - Line 3: Progress bar.

### 4. Defect MOB-004: Executive Command Strip Formatting
- **Problem:** MoM profit growth generated floating-point artifacts like `+127.31529656607701%`. Currency amounts wrapped mid-number on 320px screens.
- **Remediation:**
  - Formatted `momProfitGrowthPercent` to 1 decimal place (`Number(mom.toFixed(1))`).
  - Updated Command Strip value typography to responsive classes with `tabular-nums` and `break-words`.

### 5. Defect MOB-005: Executive Command Center Overview
- **Problem:** Mobile screens under 430px rendered redundant Overview cards that duplicated the main KPI cards right below them, wasting 250px of vertical scrolling. 3 quick action tiles were oversized.
- **Remediation:**
  - Hidden Level 1 redundant cards on mobile (`hidden md:grid`).
  - Replaced oversized action cards with a compact native-feeling quick action strip (`grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-card border`).

### 6. Defect MOB-007: Sales Workspace Pipeline & Commissions Tables
- **Problem:** When switching to Table mode in `/admin/sales`, an 8-column table rendered without mobile cards. Commissions and Performance matrix had 11 and 8 columns respectively.
- **Remediation:**
  - Added structured mobile record cards for Pipeline deals, Sales commissions, and Worker performance matrix.
  - Preserved all authorized actions (`Convert to Sale`, `Approve Commission`, `Mark Paid`) and financial data.

### 7. Defect MOB-011 & MOB-012: Executive Financial Command & Receivables
- **Problem:** Financial Command and Operations Command section titles were squeezed horizontally against descriptions and links. The Q5 Unpaid Receivables section rendered an unreadable compressed table on mobile.
- **Remediation:**
  - Matched visual language from mobile reference design (`media_1791886416651.png`):
    - White rounded card with soft circular icon (`$`) and right-aligned blue link ("Finance & Accounting >").
    - "Q5 Answer: Unpaid Client Receivables" card with vertical amber accent bar, subtitle (`1 invoice`), and `Drill down ↗` pill button.
    - Inner invoice row: soft blue document icon, bold client name + invoice ID, calendar icon + due date, outline `SENT` badge, prominent `2,300 TND`, and `View →` link.
  - Added compact "Available Cash Breakdown" card with circular green wallet icon and blue drill-down link.

### 8. Defect MOB-014 & MOB-015: Source Drill-Down Drawer Redesign & Scroll Architecture
- **Problem:** The previous drill-down modal was a desktop-centric centered dialog. On phones, the header collided, content truncated, and fixed footers obscured bottom records.
- **Remediation:**
  - Complete re-architecture into a responsive bottom-sheet drawer (`rounded-t-[28px]`, max-height 90dvh):
    1. Top drag handle bar.
    2. Header with soft blue Layers icon, bold "Source Drill-Down" title, entity subtitle (e.g., `Client: [ARCHIVED QA] QA Audit Client Phase`), and accessible close button.
    3. Aggregated Value card with prominent bold blue amount (`text-3xl`), `Export CSV` pill button, and formula explanation info banner.
    4. 2-column Authoritative Source Records & Real-time DB Facts stats row.
    5. Dashed document empty state component when records = 0, or structured mobile record cards when records exist.
    6. Single vertical scroll owner (`flex-1 overflow-y-auto min-h-0`) preventing any trapped scroll.
    7. Sticky bottom footer with `BookOpen` attribution and `Close` pill button.
  - Desktop centered modal behavior fully preserved on `sm:` breakpoint.

