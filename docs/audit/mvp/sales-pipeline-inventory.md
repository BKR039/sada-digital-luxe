# SADA OS — Sales Pipeline Component & Feature Inventory

## 1. Executive Summary

This document establishes the authoritative inventory of components, routes, data models, and features for the **SADA OS Sales Pipeline MVP** (`/admin/sales`), certified following production-grade remediation for real agency sales operations.

---

## 2. Route Architecture & Entry Points

| Route Path | File Target | Guard / Protection | Redirects | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `/admin/sales` | `src/routes/admin.sales.tsx` | `ModuleAccessShield` (`sales.view`) | N/A | Primary workspace view for leads, horizontal Kanban, commission ledger, and team performance |
| `/admin/deals` | `src/routes/admin.deals.tsx` | Route-level redirect | Redirects to `/admin/sales?tab=pipeline` | Legacy alias maintained for backwards compatibility |
| `/admin/commissions` | `src/routes/admin.commissions.tsx` | Route-level redirect | Redirects to `/admin/sales?tab=commissions` | Legacy alias maintained for backwards compatibility |

---

## 3. Component Hierarchy

```
src/routes/admin.sales.tsx
└── SalesWorkspaceView.tsx (Canonical Single-Page Modular Workspace)
    ├── Page Header & Realtime Metric Cards (4 Cards)
    │   ├── Card 1: Active Pipeline Value (TND)
    │   ├── Card 2: Closed Won Revenue (TND)
    │   ├── Card 3: Win Rate (%)
    │   └── Card 4: Disbursed / Paid Commissions (TND)
    │
    ├── Primary Navigation Tabs
    │   ├── Tab 1: Sales Pipeline & Leads (visibleDeals)
    │   ├── Tab 2: Commission Management & Rules (visibleCommissions)
    │   └── Tab 3: Commercial Team Performance Matrix (Admin Only)
    │
    ├── Pipeline Toolbar & Search Controls
    │   ├── SADASearch (Title, Company, Contact, Client)
    │   ├── SADASelect: Stage Filter (All Stages + 8 Canonical Stages)
    │   ├── SADASelect: Sales Rep Filter (Admin only)
    │   └── View Mode Toggle (Kanban vs Table)
    │
    ├── View Mode: Kanban
    │   ├── Horizontal Stage Quick-Jump Navigator (8 Pills with deal counts & active sync)
    │   ├── Horizontal Scroll Navigation Controls (ChevronLeft / ChevronRight with boundary disabling)
    │   └── Single-Row Horizontal Kanban Track (.kanban-horizontal-track)
    │       └── 8 Fixed-Width Columns (w-[290px] sm:w-[310px] md:w-[320px])
    │           ├── Stage 1: Lead (عميل محتمل)
    │           ├── Stage 2: Contacted (تم التواصل)
    │           ├── Stage 3: Qualified (مؤهل)
    │           ├── Stage 4: Meeting (اجتماع)
    │           ├── Stage 5: Proposal (تقديم العرض)
    │           ├── Stage 6: Negotiation (تفاوض)
    │           ├── Stage 7: Won (صفقة ناجحة)
    │           └── Stage 8: Lost (صفقة خاسرة)
    │               └── Deal Cards (Draggable, Touch & Keyboard Accessible)
    │                   ├── Drag Handle (GripVertical)
    │                   ├── Company & Title Display
    │                   ├── Deal Value & Sponsoring Breakdown
    │                   ├── Accessible "Move to Stage" Dropdown
    │                   ├── Convert to Sale Action (Non-won stages)
    │                   └── Deal Details / Inspect Action
    │
    ├── View Mode: Table
    │   ├── Mobile Responsive Card List (< md)
    │   └── Desktop Comprehensive Table (>= md)
    │
    ├── Tab 2: Commission Management & Ledger
    │   ├── Configurable Rules Summary (Initial 15%, Renewal 5%, Upsell 5%, Duration 6m)
    │   ├── Commission Ledger Table (Deal, Client, Rep, Sale, Sponsoring, Rate, Commission, Status)
    │   └── Lifecycle Action Controls (Approve, Mark Paid / Disburse)
    │
    ├── Tab 3: Commercial Team Performance Matrix (Admin Only)
    │   ├── Search & Filter Toolbar (Search by name/email/role, "Active Reps Only" toggle)
    │   ├── Mobile Card View (< md)
    │   └── Desktop Matrix Table (Rep, Role, Leads, Won, Win Rate, Pipeline Value, Won Revenue, Commissions)
    │
    └── Modal & Dialog Layer
        ├── Create Lead Modal (SADADialog)
        ├── Convert Lead to Sale Modal (SADADialog)
        ├── Deal Details & Edit Deal Modal (SADADialog with Stage Selector & Stage Change Banner)
        └── Confirm Deal Permanent Deletion (SADAConfirmDialog - Super Admin Only)
```

---

## 4. Canonical Stage Inventory

| Stage Key | Order | English Label | Arabic Label | Color Accent | Terminal? | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `lead` | 1 | Lead | عميل محتمل | Neutral / Blue | No | Initial prospect or contact entry |
| `contacted` | 2 | Contacted | تم التواصل | Sky / Indigo | No | Initial outreach initiated |
| `qualified` | 3 | Qualified | مؤهل | Primary / Purple | No | Needs, budget, and timeline validated |
| `meeting` | 4 | Meeting | اجتماع | Warning / Amber | No | Presentation or discovery scheduled |
| `proposal` | 5 | Proposal | تقديم العرض | Purple / Orange | No | Commercial offer / quote submitted |
| `negotiation` | 6 | Negotiation | تفاوض | Primary / Blue | No | Terms and pricing revision |
| `won` | 7 | Won | صفقة ناجحة | Success / Emerald | Yes (Special) | Requires explicit Convert to Sale |
| `lost` | 8 | Lost | صفقة خاسرة | Danger / Red | Yes | Closed without contract |

---

## 5. SADA Design System Reusable Component Usage

| SADA Component | Implementation Context in Sales Pipeline |
| :--- | :--- |
| `SADAButton` | View toggles, navigation pills, form submission, modal actions, commission approvals |
| `SADAInput` | Deal titles, contact details, financial numbers, sponsoring budget |
| `SADATextarea` | Deal follow-up notes, conversion notes |
| `SADASelect` | Package selection, client selection, stage selector, worker filter, payment status |
| `SADADatePicker` | Expected close date picker, sale date picker |
| `SADACard` | KPI cards, toolbar containers, deal cards, table card containers |
| `SADABadge` | Stage indicators, status badges, view counts, role indicators |
| `SADANumber` | Currency formatting (TND), win rates (%), KPI counts |
| `SADADialog` | Create lead modal, edit deal modal, convert to sale modal |
| `SADAConfirmDialog` | Permanent deal deletion confirmation with danger variant |
| `SADAEmptyState` | Empty search results, zero deals, zero commissions |
| `SADASearch` | Instant debounced search for leads and commercial team matrix |
| `SalesPipelineSkeleton` | Initial loading state skeleton adhering to brand typography |

---

## 6. Authoritative Database Tables & Dependencies

| Table Name | Primary Keys | Key Foreign Keys | Purpose in Sales Module |
| :--- | :--- | :--- | :--- |
| `public.deals` | `id` (UUID) | `client_id` -> `clients.id`<br>`package_id` -> `package_catalog.id`<br>`sales_owner_id` -> `profiles.id`<br>`commission_recipient_id` -> `team_members.id` | SSOT for opportunities, pipeline stages, and deal values |
| `public.sales_commissions` | `id` (UUID) | `deal_id` -> `deals.id`<br>`team_member_id` -> `team_members.id`<br>`client_id` -> `clients.id`<br>`invoice_id` -> `invoices.id` | SSOT for salesperson commission ledger and payout status |
| `public.business_rules` | `id` (UUID) | `updated_by` -> `auth.users.id` | SSOT for configurable initial, renewal, and upsell commission rates |
| `public.team_members` | `id` (UUID) | `profile_id` -> `profiles.id` | Commercial representative identity, roles, and attribution |
| `public.clients` | `id` (UUID) | N/A | Linked client records upon conversion |
| `public.package_catalog` | `id` (UUID) | `category_id` -> `package_categories.id` | Pricing templates, target deliverables, and service scopes |
