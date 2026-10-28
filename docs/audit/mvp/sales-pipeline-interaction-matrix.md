# SADA OS — Sales Pipeline Interaction & Workflow Matrix

## 1. Executive Summary

This document details the user interaction states, event handling, optimistic concurrency control (OCC), rollback behaviors, and accessibility mechanisms for every interactive feature of the **SADA OS Sales Pipeline MVP**.

---

## 2. Horizontal Kanban Navigation & Scrolling Interactions

| Control / Input | Trigger Event | Mechanism / Implementation | Edge Handling & Boundary Constraints |
| :--- | :--- | :--- | :--- |
| **Left Scroll Button** | `onClick` | Calls `scrollKanban("left")` (or `"right"` in RTL). Scrolls `kanbanTrackRef` by 336px smoothly. | Disabled when `scrollLeft <= 5` (at start). `aria-label` provided. |
| **Right Scroll Button** | `onClick` | Calls `scrollKanban("right")` (or `"left"` in RTL). Scrolls `kanbanTrackRef` by 336px smoothly. | Disabled when `scrollLeft >= maxScroll - 5` (at end). `aria-label` provided. |
| **Stage Quick-Jump Pills** | `onClick` | Calls `scrollToStage(stageKey)`. Targets `stageColumnRefs[stageKey].scrollIntoView({ behavior: 'smooth', inline: 'start' })`. | Active pill highlighted with brand accent based on visible viewport center calculation. |
| **Trackpad / Shift + Wheel** | `onWheel` | Native browser horizontal scrolling on `.kanban-horizontal-track`. | Does not trigger page vertical scroll or accidental card click. |
| **Container Scroll Listener** | `onScroll` | Updates `canScrollLeft`, `canScrollRight`, and `activeVisibleStage` dynamically. | Debounced / optimized calculation using column bounding rects. |

---

## 3. Drag-and-Drop Lifecycle & Edge Auto-Scroll

```
[User initiates Drag]
   │
   ├──> onDragStart: checks `canChangeStage` && `!isMutatingStageMap[dealId]`
   │    ├── Sets `draggedDealId`, `dataTransfer.setData("text/plain", dealId)`
   │    └── Sets `wasDraggedRef = true` (prevents card inspection modal click)
   │
[User drags card across Kanban Track]
   │
   ├──> onDragOver: sets `dropEffect = "move"`
   │    └── Edge Auto-Scroll: if mouse within 65px of left/right container edge,
   │        smoothly adjusts `kanbanTrackRef.scrollLeft` (+/- 14px per tick)
   │
   ├──> onDragEnter: sets `dragOverColumnKey = stageKey`
   │    └── Target column renders pulsing drop target banner
   │
   ├──> onDragLeave: clears `dragOverColumnKey` if leaving column boundaries
   │
[User drops card into Target Column]
   │
   ├──> onDrop: retrieves `dealId`, clears drag indicators
   │    │
   │    ├── Target === Current Stage? -> NO-OP (no mutation)
   │    │
   │    ├── Target === "won"?
   │    │   └── Intercepts drop -> Opens Convert to Sale Modal (Financial Safety)
   │    │
   │    └── Target !== Current Stage?
   │        ├── Sets `isMutatingStageMap[dealId] = true` (Prevents duplicate drop)
   │        ├── Optimistic Update: card moves immediately in UI
   │        ├── Calls `updateLeadStage(...)` via canonical sales-service
   │        │
   │        ├── SUCCESS: Shows success toast, silent background refresh
   │        │
   │        └── ERROR: Rollback to previous stage, displays error notification
```

---

## 4. Keyboard & Non-Drag Accessibility Alternatives

To ensure full compliance for keyboard-only and assistive technology users:
1. **Card "Move to Stage" Dropdown:** Every deal card includes an accessible `DropdownMenu` triggered by an `ArrowRightLeft` button with an explicit `aria-label` (e.g. `aria-label="Move {deal.title} to stage"`). Selecting any stage invokes `executeStageTransition` directly without requiring drag gestures.
2. **View Deal Details Stage Changer:** Opening the Deal Details modal displays the current stage with an interactive stage changer dropdown.
3. **Edit Deal Modal Stage Selector:** The Edit Deal form incorporates a full `Pipeline Stage` dropdown (`SADASelect`), enabling immediate stage updates upon saving.

---

## 5. Modal Interaction & Submission Workflows

| Modal | Form Inputs & Controls | Validation Rules | Persistence & Feedback |
| :--- | :--- | :--- | :--- |
| **New Lead** | Title, Company, Contact Name, Email, Phone, Package, Value, Stage, Sales Rep, Close Date, Notes | Title and Company required. Deal value >= 0. | Calls `createDeal`. Shows loading spinner on submit button. Clears form and reloads data upon success. |
| **Edit Deal** | Title, Company, Contact, Package, Stage, Value, Sponsoring, Rep, Close Date, Notes | Title and Company required. Value and sponsoring valid numbers. | Calls `updateDeal` and `updateLeadStage` if stage changed. OCC checks prevent stale overwrites. |
| **Convert to Sale** | Client, Package, Sale Amount, Sponsoring Amount, Payment Status, Date, Notes | Sale amount required. Validates sponsoring deduction. | Calls `convert_lead_to_sale` RPC. Idempotent: rejects duplicate conversions. |
| **Delete Deal** | Danger confirmation dialog | Super Admin authorization required. | Calls `deleteDeal`. Verifies foreign key dependencies. Shows toast feedback. |

---

## 6. Commission Lifecycle Interactions

1. **Rule Configuration:**
   - Displayed in Commission Management tab.
   - Rates: 15% initial (first 6 months), 5% renewal, 5% upsell.
   - Sponsoring deduction is immutable and strictly enforced.
2. **Approve Commission (`approveCommission`):**
   - Visible only to Admin / Super Admin for `pending` commissions.
   - Self-approval blocked for non-superadmin users.
   - Updates status to `approved`.
3. **Disburse / Pay Commission (`payoutCommission`):**
   - Visible for `approved` commissions.
   - Transitions commission to `paid` status and records payment timestamp.
