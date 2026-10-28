# SADA OS — Mobile Information Architecture & Hierarchy Framework

## Overview & Philosophy
The SADA OS mobile information architecture ensures that executive leaders, financial controllers, and operational team members have immediate, unhindered access to critical financial, operational, and commercial data on any mobile phone from 320px width upward.

Desktop-first layouts compressed blindly onto phones create vertical fatigue, horizontal overflow, and unreadable data collisions. SADA OS mobile architecture enforces strict conceptual hierarchies, progressive disclosure, and content-driven card containers.

---

## 1. Page-Level Information Hierarchy

### A. Executive Command Center (`/admin`)
```
[Header Bar: Agency Badge · Date & Period Selector · Live Refresh]
         ↓
[Executive KPI Stack: 5 Core Health Indicators (Revenue, Margin, Cash, Pending Inflows, Outflows)]
         ↓
[Immediate Action Strip: Compact 3-Way Operations Quick Bar]
         ↓
[Immediate Risks & Items Requiring Attention: Critical Alerts & Blocked Items]
         ↓
[Operational Workload & Active Retainers: High-Priority Client Commitments]
         ↓
[Recent Activity Log: Audit Trail of Recent Transactions]
```
- **Mobile Optimizations:**
  - Redundant "Overview 2x2" summary tiles hidden on mobile (`hidden md:grid`) to prevent duplication.
  - Large quick-action tiles replaced by an ultra-compact native action strip (`grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-card border`), saving 80px of vertical space.
  - KPI numbers scaled dynamically with `tabular-nums` to prevent awkward wrapping.

---

### B. SADA Intelligence & Analytics (`/admin/analytics`)
```
[Executive Command Strip: Real-time Revenue · MoM Growth · Direct Margin · Net Income]
         ↓
[Section Tabs: Financial Dynamics · Client Profitability · Treasury · Commercial Breakdown]
         ↓
[Tab 1: Financial Dynamics]
  ├── [Financial Trends Chart: 3-Way Segmented Series Toggle · Clean 6-Month X-Axis · Y-Axis K Ticks]
  └── [Expense Ranking: 3-Way Segmented Mode · 2-Line Ranking Items · Progress Fill]
         ↓
[Tab 2: Client Profitability Matrix]
  ├── [Search & Filter Controls: Responsive Width Stacks]
  └── [Client Profitability Records: Structured 6-Row Mobile Cards]
```
- **Mobile Optimizations:**
  - Standalone series buttons converted to unified 3-column segmented controls (`grid grid-cols-3`).
  - X-Axis month labels formatted to short 3-letter strings (`May`, `Jun`, `Jul`, `Aug`, `Sep`, `Oct`) avoiding text collisions on 320px screens.
  - Y-Axis intervals calibrated to avoid duplicate whole-number labels (`1.5k`, `2.3k`).
  - Client profitability table completely converted to structured record cards below `md:` breakpoint.

---

### C. Finance & Inflow/Outflow Management (`/admin/finance`)
```
[Header & Period Selector]
         ↓
[Finance Quick Actions: Record Inflow · Record Outflow]
         ↓
[Inflow / Outflow Filter Bar: Responsive Search · 2-Column Select Grid]
         ↓
[Mobile Transaction Cards (< md)]
  ├── Header: Description (Bold) + Date + Client/Project tags
  ├── Right: Amount (+Inflow / -Outflow in monospace bold) + Status Badge
  └── Footer: Category Tag + Payment Method + Receipt Action + Edit/Delete
         ↓
[Desktop Dense Financial Ledger (>= md)]
```

---

### D. Sales Workspace & Pipeline (`/admin/sales`)
```
[Header: Role Badge · Commercial Metrics Summary]
         ↓
[Commercial Overview KPIs: 1-col on < 440px, 2-col on >= 440px, 4-col on lg]
         ↓
[Navigation Tabs: Pipeline & Leads · Commissions & Rules · Performance Matrix]
         ↓
[Pipeline Mode (Kanban vs Table)]
  ├── Kanban: 1 Column with touch-friendly swipeable cards & Move-to-Stage menus
  └── Table: Mobile structured cards (< md) with Labeled Metric Grids (Deal Value, Sponsoring, Commissionable, Est. Commission)
         ↓
[Commissions Mode]
  └── Mobile structured cards (< md) with Total Sale, Net Revenue, Rate, and Approved/Paid Badges
```

---

## 2. Component Design Principles on Mobile

### Principles Checklist
1. **Zero Text Collisions:** Every financial label and its associated value must have explicit spacing. Long labels must wrap naturally or sit on separate rows rather than compressing into neighboring cells.
2. **Predictable Heights:** Avoid arbitrary fixed container heights that clip content on longer translations (e.g., Arabic) or smaller screen heights.
3. **Responsive Grid Strategy:**
   - 1 Column for complex financial entities (Profitability cards, deal breakdowns).
   - 2 Columns for short, independent metric pairs where each cell has at least 135px width.
   - 3 Columns only for ultra-compact segmented toggle controls with 1–2 words per option.
4. **Touch Targets & Overflow Control:**
   - Interactive buttons must have minimum 36px–40px touch targets.
   - All horizontal scrolling must be restricted to intentional sub-components (such as chart containers or navigation tab strips). The page container must never drift horizontally.
5. **Bidirectional Typography (RTL/LTR):**
   - Mixed-language identifiers (e.g. client names in English, Arabic UI) must be isolated with `<bdi dir="auto">`.
   - Use CSS logical properties (`margin-inline`, `padding-inline`, `text-start`, `text-end`) throughout.
