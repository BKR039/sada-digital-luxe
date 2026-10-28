# SADA OS — Responsive Component Inventory & Registry

This document catalogs every core component in SADA OS, its responsive adaptation behavior, viewport support, and accessibility considerations.

---

## 1. Executive Shell & Navigation Primitives

### `src/routes/admin.tsx` (Application Shell)
- **Desktop (≥ 1024px):** Fixed left luxury sidebar navigation, top application bar with tenant selector, real-time indicator, and attention bell.
- **Mobile (< 1024px):** Compact top bar with branded SADA logo, notification bell with unread counter, and hamburger drawer. Fixed bottom dock (`Overview`, `My Work`, `Next Task`, `Calendar`, `Menu`) with `pb-safe` device safe-area margin.
- **Z-Index System:** Coordinated layering (`z-10` to `z-50`) ensuring modals and drawers always render cleanly over fixed navigation bars.

### `src/routes/admin.index.tsx` (Executive Dashboard Header)
- **Desktop:** Full-width header with period selector and multi-tab executive filter navigation.
- **Mobile (< 640px):** Single-strip 3-segment scope switcher (`Command`, `My Execution`, `Agency`) + 3-tile quick-action dock (`New Task` blue +, `Workspaces` folder, `Follow-up` phone) matching exact SADA design specifications.

---

## 2. Executive Command & Workspaces

### `ExecutiveCommandCenter.tsx`
- **Level 1 Overview:** 2×2 metric grid (`Collected Revenue`, `Operating Spent`, `Active Projects`, `Pending Client Items`) with embedded period badge (`This Month ▾`).
- **Quick Insights:** Single-card alert banner highlighting projects needing client attention, with direct actionable navigation link (`View all →`).
- **Detailed Analytics:** Accordion/sub-tab presentation preventing vertical sprawl on narrow devices.

### `TaskDetailModal.tsx` (Workspace Dialog)
- **Top Bar:** Single-row header with purple `SUBTASK` badge, bulleted client chip (`MAISON CARTHAGE`), and touch-friendly close button `✕`.
- **Identity & Context:** Prominent task title, lead assignee with avatar initials (`Lead: BKR039 [BK]`), priority pill (`● High`), due date, and status pill (`● To Do`).
- **Parent Task Card:** Dedicated contextual card with direct navigation link (`View →`).
- **Primary Execution Actions:** Prominent full-width action button (`▶ Start Task`), followed by a 2-column secondary action row (`Postpone`, `Mark Blocked`) and tertiary link (`Send Alert`).
- **5 Progressive Accordions:**
  1. `Task Details` (2-column status, priority, deadline, assignee, and progress grid)
  2. `Assignment Brief & Instructions` (operational guidelines and brief text)
  3. `Related Files` (asset attachments, deliverables, and cloud links)
  4. `Workflow Stages & Subtasks` (sequential stages with dependency validation)
  5. `Activity History & Notes` (audit trail and internal team comments)
- **Footer:** Touch-friendly full-width `Close` action button.

---

## 3. Operations & Catalog Components

### `PackageEditorDrawer.tsx` (Commercial Catalog)
- **Header:** Truncated title with code badge and responsive `Config` / `Preview` switcher.
- **Quota Stepper Grid:** Responsive grid converting 5-column desktop quota inputs to single-column card steppers on mobile screens ≤ 400px.
- **Footer Bar:** Compact stacked price and margin KPI bar (`Price: 1,090 TND • Margin: 62%`) with full-width Cancel and Save action buttons.

### `IncomeTable.tsx` & `ExpenseTable.tsx` (Financial Tables)
- **Desktop (≥ 768px):** Clean high-density multi-column financial table with tabular numbers, status badges, and action menus.
- **Mobile (< 768px):** Structured card list displaying entity description, date, client/project badges, status pill, bold currency amount, and touch-accessible actions (receipt link, edit, delete).

### `AccountsTable.tsx` (Security & User Management)
- **Desktop (≥ 768px):** Complete directory table with avatars, role badges, divisions, sign-in timestamps, and action dropdowns.
- **Mobile (< 768px):** Card-based directory layout showing avatar, role, custom permission indicators, and direct `Manage →` touch target.

### `NotificationCenter.tsx` (Attention Management)
- **Desktop:** Popover cock-pit anchored to top header icon.
- **Mobile:** Full-height dynamic drawer with priority tabs, unread pill counters, and swipe-friendly item dismissals.

---

## 4. Design Tokens & Responsive Utilities

- **Containers:** Fluid container widths with `max-w-7xl mx-auto px-3 sm:px-6`.
- **Text Wrapping:** `break-words` and `truncate` with `dir="auto"` for dynamic multilingual inputs.
- **Numbers & Currencies:** `font-mono tabular-nums` for precise column alignment.
- **Touch Targets:** Minimum 40px–44px height across all buttons, inputs, and tab triggers on mobile.
