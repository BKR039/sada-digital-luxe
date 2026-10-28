# SADA Design System

Source of truth for tokens: `src/styles.css` (Tailwind v4, CSS-first `@theme inline` + `:root`/`.dark` CSS variables, `oklch()` color space). shadcn/ui config: `components.json` (style `"new-york"`, base color `slate`, CSS variables on, no prefix, RSC off, RTL off).

## Principles

Hierarchy before decoration. Strong whitespace. Editorial composition. Premium simplicity. Responsive by design. Accessibility.

## SADA Gradient

Tokens: `--gradient-primary`, `--gradient-soft`, `--gradient-text`, `--gradient-hero` (see `src/styles.css` lines ~67–71, ~100–103). Utility classes: `.bg-gradient-primary`, `.bg-gradient-soft`, `.text-gradient`.

Use for: brand moments (CTAs, active nav pills, admin sidebar active state), hero atmosphere (`--gradient-hero` as a fixed full-bleed `body::before` radial glow, not a component background), accents, selected CTAs, social graphics.

Not every component is gradient — most cards/buttons use solid `--card`/`--primary` and only escalate to gradient for primary actions or emphasis.

## Liquid Glass

Classes: `.glass`, `.glass-strong` (`src/styles.css` lines ~146–167).

- **Light mode:** solid white `--card` background + `--border` + `--shadow-card`/`--shadow-elevated`. No blur — reads as a clean solid card.
- **Dark mode:** actual `backdrop-filter: blur(10–14px) saturate(140–150%)` glass over a translucent navy fill.

Use for: navigation (`Header.tsx` uses `bg-background/40` + `backdrop-blur-md`, intensifying on scroll), the `/auth` card (`.glass-strong` + `.cyan-glow`), admin "access required" panel, selected premium moments.

Maintain solid / transparent / glass surface hierarchy — do not make every surface glass. Most content cards (`FeaturedProjects`, `CrudPage` list rows, case study sections) use plain `bg-card` + `border-border` + `.soft-shadow`/`.elevated-shadow`, reserving `.glass` for chrome and standout moments.

## Light Mode

Near-white background (`oklch(0.99 0.005 250)`), dark navy foreground, electric-blue primary, cyan accent, soft shadows, no blur on `.glass`.

## Dark Mode

Background drops to navy (`oklch(0.13 0.04 260)`, close to SADA Ink), `.glass` gains real blur, shadows deepen (`--shadow-elevated`, `--shadow-glow`), glow effects intensify (`.neon-glow`, `.cyan-glow`).

## Typography

- **English / Latin:** Sora (display, headings), Manrope (body, UI), Inter (fallback).
- **Arabic UI / Canonical Brand Typeface:** **Thmanyah Serif Text** (`/fonts/thmanyahseriftext-*.otf`) across all 5 weights: Light (300), Regular (400), Medium (500), Bold (700), Black (900). Automatically active on `html[dir="rtl"]`, `html[lang="ar"]`, and `.font-arabic` / `.font-thmanyah`.
- **Mixed Content:** Arabic script renders cleanly in Thmanyah Serif Text, while Latin numbers, technical tags, and English text preserve Manrope/Sora metrics.
- See `docs/SADA_BRAND_GUIDELINES.md` for extended brand typography guidance.

## Components

- **Primitives:** `src/components/ui/*` — full shadcn/ui set (accordion, alert-dialog, avatar, badge, button, calendar, card, carousel, chart, checkbox, command, dialog, drawer, dropdown-menu, form, input, label, menubar, navigation-menu, pagination, popover, progress, radio-group, select, separator, sheet, sidebar, skeleton, slider, sonner/toast, switch, table, tabs, textarea, toggle, tooltip).
- **Site sections:** `src/components/site/*` — `Header`, `Footer`, `SiteLayout`, `Hero`, `Stats`, `Services`, `FeaturedProjects`, `About`, `Testimonials`, `TrustedBy`, `CTA`, `Logo`, `ThemeToggle`, `AIAssistant` (lazy-loaded chat widget).
- **Homepage hero:** `Hero.tsx` is the one component in the repo styled by plain CSS classes rather than Tailwind utilities — a transplanted design whose styles live in the `.sada-hero` block at the end of `src/styles.css`. That block declares its own `--sh-*` tokens on `.sada-hero` and prefixes every selector with it, so the hero is dark in both site themes and no global rule is involved. Edit the hero there, keep new selectors inside the block and inside the `.sada-hero` prefix, and do not move its palette onto `:root`.
  - The hero owns its own header clearance (`min-height: calc(100svh - 6rem)`, matching the `pt-24` on `<main>` that clears the fixed `Header`). The site header is NOT part of the hero.
  - Card visuals are CSS gradients (`.card-visual-one` … `-four`), each on a `.sada-card-visual` layer that already has `background-size: cover` and a scrim — swapping in photography is a one-line `background-image` per card.
- **Media:** `src/components/media/*` — `SmartMedia` (unified image/video renderer used everywhere media is shown), `MediaUpload`/`MediaUploadMulti` (admin upload to Supabase Storage), `MediaGallery`.
- **Admin:** `src/components/admin/CrudPage.tsx` — one generic, field-schema-driven CRUD UI reused for Projects, Blog, Products, Testimonials. New admin sections should extend this pattern (define a `FieldDef[]`), not hand-roll new CRUD screens.

Buttons/CTAs follow a consistent pattern across the site: `bg-gradient-primary text-white ... rounded-xl font-semibold neon-glow hover:scale-[1.03]` for primary actions; bordered `bg-card`/`border-border` for secondary.

## Responsive

No custom breakpoints were found in `styles.css` or a Tailwind config file (Tailwind v4 here is configured via `@theme inline` only, no `tailwind.config.js`). The project uses Tailwind's default breakpoints (`sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px, `2xl` 1536px), applied directly via utility prefixes throughout routes/components (e.g. `sm:grid-cols-2 lg:grid-cols-3`). Do not invent different breakpoints.

### Mobile UI/UX Standards (Main Public Website)
- **Typography Clamping**: Section titles must scale fluidly: use `text-2xl sm:text-4xl md:text-5xl lg:text-6xl` with `tracking-tight text-balance`. Hero headlines clamp to `clamp(27px, 8vw, 38px)` to prevent text overcrowding on screens <400px.
- **Card Proportions**: Cards use responsive padding (`p-4 sm:p-6 md:p-7` or `p-3.5 sm:p-5`) and radii (`rounded-2xl sm:rounded-3xl`). Inner cards in 2-column or 4-quadrant grids must use `min-w-0` and responsive titles (`text-sm sm:text-lg md:text-xl truncate`) to avoid word overflow on mobile viewports.
- **Mobile Navigation Drawer**: High-contrast text (`text-slate-800 dark:text-slate-200`), frosted opaque backdrop (`bg-white/98 dark:bg-slate-950/98 backdrop-blur-2xl shadow-2xl`) preventing underlying hero bleeding, and auto-closing `onClick` on all navigation items.
- **Floating Controls Clearance**: Floating triggers (e.g. `AIAssistant`) use RTL-safe positioning (`bottom-4 end-4 sm:bottom-6 sm:end-6`), compact mobile dimensions (`size-12 sm:size-14`), and responsive dialogs (`inset-x-3 bottom-3 sm:inset-x-auto`) to avoid obscuring primary CTA buttons.

## Motion

Fluid, soft, fast, purposeful. Avoid excessive animation.

- CSS keyframes: `float`, `pulse-glow`, `fade-up`, `orbit-spin`, `orbit-counter`, `aura-breathe` (`src/styles.css`).
- Component-level: `framer-motion` (`whileInView` fade+translateY reveals, staggered by index, `viewport={{ once: true }}`) used consistently across `case-studies.$slug.tsx`, `case-studies.tsx`, and site sections.
- `@media (prefers-reduced-motion: reduce)` globally collapses animation/transition durations to near-zero — preserve this.

## Accessibility

WCAG AA target. Keyboard access. Visible focus (`:focus-visible` outline defined globally). Reduced motion (see above). Contrast (oklch tokens tuned per-mode). Semantic markup — preserve existing heading structure and landmark elements when editing.

## SADA Control System

Canonical, reusable input and selector system designed to replace all browser-native `<select>`, `<input type="date">`, and `<input type="datetime-local">` controls across SADA OS and public interactive surfaces.

Central tokens and styles are defined in `src/components/ui/sada-controls.ts`.

### 1. `SADASelect` (`src/components/ui/sada-select.tsx`)
- **When to use:** Small-to-medium fixed option sets (e.g. status dropdowns, priority, timeframes, filter pills, categories).
- **When NOT to use:** Dynamic or long searchable lists (>15 items), team members, clients, or projects.
- **Visual Rules:** Uses `sadaControlSizes` (`compact` 32px, `default` 40px, `lg` 48px), rounded-xl (`rounded-lg` in compact), `border-border/80`, `bg-card`, subtle hover transitions, clear cyan/primary focus rings, and portal z-index `z-[100]`.
- **Accessibility:** Built on Radix Select. Full keyboard arrow navigation, Enter/Space to select, Esc to close, `aria-expanded`, and screen reader labels.
- **Empty value safety:** Handles Radix empty string restriction via internal `__sada_empty_val__` sentinel mapping so `value=""` is completely safe.

### 2. `SADACombobox` (`src/components/ui/sada-combobox.tsx`)
- **When to use:** Large or searchable entities (team members, clients, projects, tasks, services).
- **When NOT to use:** Simple 2–4 item toggles or fixed statuses.
- **Visual Rules:** Matches `SADASelect` trigger height and border radius. Popover houses a sticky search input, option list with optional avatar/initials badge, subtitles, status indicators, checkmark, and optional "All" selection action.
- **Accessibility:** Built on Radix Popover + `cmdk`. Search filtering, arrow key navigation, Esc to close, focus trapping.

### 3. `SADADatePicker` (`src/components/ui/sada-date-picker.tsx`)
- **When to use:** Date selection (deadlines, delivery dates, start dates, birth dates, filters). Replaces `<input type="date">`.
- **When NOT to use:** Combined date and time picker.
- **Visual Rules:** Trigger displays formatted human date (e.g., `21 Sep 2026`) with calendar icon. Popover contains month/year navigation, interactive day grid (`react-day-picker` v9), "Today" quick jump, and optional "Clear" button.
- **Data Safety:** Accepts and emits standard ISO date string (`YYYY-MM-DD`). Preserves backend database schema without timezone distortion.

### 4. `SADADateDateTimePicker` (`src/components/ui/sada-date-time-picker.tsx`)
- **When to use:** Timestamp selection (calendar appointments, scheduled follow-ups, exact deadlines). Replaces `<input type="datetime-local">`.
- **When NOT to use:** Pure date fields without a time component.
- **Visual Rules:** Month/day calendar above a custom SADA time stepper section. 100% custom hour/minute up/down stepper buttons and AM/PM toggle. Zero native browser time pickers.
- **Data Safety:** Accepts and emits ISO 8601 strings (`YYYY-MM-DDTHH:mm:ss` or `YYYY-MM-DDTHH:mm`).

### 5. `SADATimePicker` (`src/components/ui/sada-time-picker.tsx`)
- **When to use:** Standalone time selection (e.g. daily standup time, work hour boundaries). Replaces `<input type="time">`.
- **When NOT to use:** Combined date/time workflows.
- **Visual Rules:** Clean SADA trigger showing formatted time (e.g., `10:30 AM`), popover with stepper controls.

### 6. `SADAButton` (`src/components/ui/sada-button.tsx`)
- **When to use:** All clickable triggers, actions, and CTAs across admin and app surfaces.
- **Variants:** `primary` (gradient SADA cyan-blue), `secondary`, `outline`, `ghost`, `destructive`, `luxury`, `link`.
- **Features:** Built-in `isLoading` with spinner, `leftIcon`, `rightIcon`, full keyboard navigation, active scaling.

### 7. `SADAInput` & `SADATextarea` (`src/components/ui/sada-input.tsx`)
- **When to use:** All text entries, search fields, monetary inputs, and multiline textareas.
- **Features:** Built-in `leftIcon`, `rightIcon`, clearable option, error rings, consistent font and padding.

### 8. `SADABadge` (`src/components/ui/sada-badge.tsx`)
- **When to use:** Statuses, tags, categories, priority indicators.
- **Variants:** `default`, `secondary`, `outline`, `success`, `warning`, `danger`, `cyan`, `luxury`. Supports optional dot indicator and remove action.

### 9. `SADACard` (`src/components/ui/sada-card.tsx`)
- **When to use:** Surfaces, metric cards, Kanban cards, list items, entity containers.
- **Variants:** `default`, `elevated`, `glass`, `subtle`, `bordered`, `interactive`.

### 10. `SADADialog` & `SADADrawer` (`src/components/ui/sada-dialog.tsx`, `src/components/ui/sada-drawer.tsx`)
- **When to use:**
  - `SADADialog`: Focused confirmation, short action forms, destructive prompts.
  - `SADADrawer`: Detailed contextual editing (client workspace, package details, deal inspect, task work) without losing page context.
- **Features:** Accessible Radix primitives, auto-focus trapping, Escape to close, responsive sizing, backdrop blur.

### 11. `SADAEmptyState`, `SADASkeleton`, `SADAErrorState` (`sada-empty-state.tsx`, `sada-skeleton.tsx`, `sada-error-state.tsx`)
- **When to use:**
  - `SADAEmptyState`: Never display raw "Empty" text or vast blank spaces. Displays thematic icon, title, description, and primary CTA.
  - `SADASkeleton`: Loading states for cards, tables, Kanban boards, and forms.
  - `SADAErrorState`: Safe error recovery with retry trigger, masking raw Postgres/Supabase database errors from end-users.

### 12. `SADAFilterBar` (`src/components/ui/sada-filter-bar.tsx`)
- **When to use:** Standardized search, category filtering, status pills, date ranges, and clear actions across all data tables and lists.

### 13. `SADANumberStepper` & `SADACounter` (`src/components/ui/sada-counter.tsx`)
- **When to use:** All numeric quantities, deliverable quota steppers (reels, posts, stories, shoot sessions, shoot hours), financial allocations (employee cost, freelancer cost, transport, commission), and display orders. Replaces `<input type="number">` and unstyled spinners.
- **4-Zone Layout:**
  ```
  ┌─────┬────────────┬─────────┬─────┐
  │  −  │    4       │  reels  │  +  │
  └─────┴────────────┴─────────┴─────┘
  OR
  ┌─────┬──────────┬─────┬─────┐
  │  −  │   200    │ TND │  +  │
  └─────┴──────────┴─────┴─────┘
  ```
- **Independent Buttons:** Fixed-width 32–40px visual button targets with 44px effective touch targets (`after:absolute after:-inset-1.5`). Centered Lucide `Minus` and `Plus` icons (no text). Clear hover, active (`scale-90`), and disabled states.
- **Visually Centered Value:** The value is dynamically sized based on character length (`ch`), centered in the middle area, and capable of both direct keyboard typing and step increment/decrement via buttons or ArrowUp/ArrowDown keys.
- **Non-Overlapping Unit:** Units (`unit="reels"`, `unit="TND"`, `unit="hrs"`, `unit="shoots"`) are visually secondary (`text-xs font-medium text-muted-foreground/80`) and placed next to the value without ever overlapping or touching the buttons.
- **RTL Support:** Full Arabic RTL parity (`4 ريلز`, `200 د.ت`) preserving natural reading order, correct icon position, and spacing.
- **Aliases:** Both `SadaNumberStepper`, `SADANumberStepper`, `SadaCounter`, and `SADACounter` are canonically exported from `@/components/ui/sada-ui` and `@/components/sada-ui`.

### 14. `SADACheckbox` (`src/components/ui/sada-checkbox.tsx`)
- **When to use:** Multi-selection lists, task completion, checklist rows, permission selection.
- **Visual Rules:** Built on Radix Checkbox. Rounded corners, SADA blue/cyan accent, check icon, clickable label and description wrapper, hover and focus-visible states. Replaces native `<input type="checkbox">`.

### 15. `SADASwitch` & `SadaSwitch` (`src/components/ui/sada-switch.tsx`)
- **When to use:** Binary toggle settings that immediately turn a feature on/off (e.g. Published publicly, Active for contracts, Featured package, Meta Ads, Website Included).
- **High-Contrast Visual States:**
  - **OFF State:** Neutral track (`bg-slate-200 dark:bg-slate-700/80`), visible border (`border-border/80`), with a solid gray/slate thumb (`bg-slate-400 dark:bg-slate-400`) clearly distinguishable from the background and immediately recognizable as OFF.
  - **ON State:** Vivid saturated SADA primary blue/cyan gradient track (`from-blue-600 to-cyan-500`) with a pure solid white thumb (`bg-white`) and subtle shadow, providing instant high-contrast visual confirmation even without reading the label.
- **Accessible Interaction:** Full clickable control target with 44×44px minimum touch target wrapper, visible focus rings, keyboard accessible (Space / Enter), and RTL-aware sliding direction.

### 16. `SADARadioGroup` & `SADARadioItem` (`src/components/ui/sada-radio.tsx`)
- **When to use:** Single-selection amongst 2–5 exclusive options.
- **Variants:** Standard radio circle or interactive cards (`variant="cards"`). Replaces native `<input type="radio">`.

### 17. `SADAMultiSelect` (`src/components/ui/sada-multi-select.tsx`)
- **When to use:** Multi-value selections with badge chips and searchable popover menu.

### 18. `SADASearch` (`src/components/ui/sada-search.tsx`)
- **When to use:** Instant search filters across tables, lists, and drawers. Features clear button, keyboard shortcut badge, and RTL support.

### 19. `SADAConfirmDialog` (`src/components/ui/sada-confirm-dialog.tsx`)
- **When to use:** Standardized confirmation modals with danger, warning, info, or success states, sticky action buttons, and loading feedback.

### Canonical Path Aliases & TitleCase Support
Both `@/components/ui/sada-ui` and `@/components/sada-ui` are supported and export both UPPERCASE (`SADASelect`, `SADACounter`) and TitleCase (`SadaSelect`, `SadaCounter`) aliases:
```tsx
import {
  SadaButton,
  SadaInput,
  SadaTextarea,
  SadaSelect,
  SadaMultiSelect,
  SadaCheckbox,
  SadaRadio,
  SadaRadioGroup,
  SadaSwitch,
  SadaCounter,
  SadaDatePicker,
  SadaTimePicker,
  SadaCombobox,
  SadaSearch,
  SadaTabs,
  SadaBadge,
  SadaModal,
  SadaDrawer,
  SadaTooltip,
  SadaPopover,
  SadaToast,
  SadaProgress,
  SadaEmptyState,
  SadaConfirmDialog,
} from "@/components/sada-ui"; // or "@/components/ui/sada-ui"
```

## Canonical Global Window Presentation System (Post-Phase 10 UX Refinement)

The SADA OS Global Window Presentation System provides a standardized, lightweight, and flicker-free presentation architecture for all modals, dialogs, drawers, and confirmation flows across the platform.

### Design Principles
- **Fast & Calm:** Entry transitions are 150–180ms, exits are 100–120ms. Movement is minimal (6px translate, 0.985 scale), giving the feel of instant appearance without visual shock.
- **Zero Collision / Zero Jump:** Solves the classic Radix transform collision where Tailwind entry animations overwrite `translate(-50%, -50%)`. Custom CSS keyframes preserve the center origin at all times.
- **Lightweight Backdrop:** Subtle composited `bg-black/45 dark:bg-black/65` without heavy multi-layer backdrop blurs that trigger expensive GPU repaints.
- **No "Page Inside a Modal":** Large complex workflows (e.g. Package Catalog Editor, Account Details) use responsive right-side Drawers with progressive disclosure rather than giant centered modals.
- **Independent Scroll & Sticky Footers:** Fixed header, single scrollable body container (`overflow-y-auto min-h-0 flex-1`), and sticky action footer leveraging HTML5 `form="form-id"` for decoupled validation.
- **Zero Nested Modals:** No modal-inside-modal overlays. Secondary selections use popovers, inline edits, or dedicated drawer steps.
- **Zero Native Confirms:** 100% eradication of `window.confirm()`; all destructive or irreversible actions use `SADAConfirmDialog`.

### 9 Canonical Presentation Types
1. **Micro Dialog** (`SADADialog size="micro"`, max-w ~420px): Simple single-input actions, PIN prompts, quick status toggles.
2. **Compact Dialog** (`SADADialog size="compact"`, max-w ~520px): Simple 2–4 field forms, add-on editors, duplicate package prompts, project pickers.
3. **Standard Dialog** (`SADADialog size="default"`, max-w ~640px): Standard entity creation, account provisioning, lead follow-ups.
4. **Large Dialog** (`SADADialog size="large"`, max-w ~820px): Multi-section structured forms such as Finance Inflow (`RecordIncomeModal`), Finance Outflow (`RecordExpenseModal`), Project conversion, and CRUD entities.
5. **XL Dialog** (`SADADialog size="xl"`, max-w ~960px): Data-dense comparative tables or multi-column ledger reviews.
6. **Drawer** (`SADADrawer width="2xl"` or `"lg"`): Complex workspace inspectors, Package Editor (`admin.packages.tsx`), and Account Details (`AccountDetailsDrawer.tsx`).
7. **Full-Screen Mobile Sheet**: Mobile adaptation using responsive `100dvh` sheets with safe-area padding.
8. **Confirmation Dialog** (`SADAConfirmDialog`): Standardized destructive, warning, info, and default action verification with loading states.
9. **Popover / Inline Edit**: Contextual menus, comboboxes, and in-place field updates that never spawn dialog overlays.

### Component Primitives
All primitives are exported from `@/components/ui/sada-dialog`, `@/components/ui/sada-drawer`, and re-exported via `@/components/sada-ui`:
```tsx
import {
  SADADialog,
  SADADialogHeader,
  SADADialogBody,
  SADADialogFooter,
  SADADrawer,
  SADAConfirmDialog,
} from "@/components/sada-ui";

// Standard Form Dialog Pattern:
<SADADialog open={isOpen} onOpenChange={setIsOpen} size="large">
  <SADADialogHeader title="Record Income Transaction" subtitle="Classify financial inflow" />
  <SADADialogBody>
    <form id="income-form" onSubmit={handleSubmit}>
      {/* Form Fields */}
    </form>
  </SADADialogBody>
  <SADADialogFooter>
    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
    <Button type="submit" form="income-form">Save Transaction</Button>
  </SADADialogFooter>
</SADADialog>
```

### GPU Motion Keyframes
Configured in `src/styles.css`:
- Dialog Entry: `@keyframes sada-dialog-in` (160ms cubic-bezier(0.16, 1, 0.3, 1))
- Overlay Fade: `@keyframes sada-overlay-in` (150ms ease-out)
- Drawer Entry: `@keyframes sada-drawer-in-right` (180ms cubic-bezier(0.16, 1, 0.3, 1))
- Reduced Motion: `@media (prefers-reduced-motion: reduce)` globally disables all translate/scale transforms and applies instant 0.01ms transitions.

## SADA Numerical Typography System

The **Financial Command Center** (`/admin/finance`) serves as the authoritative Single Source of Truth for all numeric figures, financial amounts, metrics, KPIs, margins, percentages, and table columns across SADA OS.

### 1. Canonical Font & Feature Settings
- **Font Family:** `font-display` (Sora, geometric display sans-serif).
- **Tabular Numerals (MANDATORY):** `font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1;` (`.tabular-nums`). Guarantees uniform character width across digits (0–9) so stacked rows, financial tables, ledgers, and counters align with zero vertical jitter.
- **Rendering:** `-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility;`.

### 2. Hierarchy & Tokens
| Level | CSS Class / Utilities | Description | Canonical Example |
| :--- | :--- | :--- | :--- |
| **Headline KPI** | `.sada-num-kpi` (`text-xl sm:text-2xl font-bold font-display tracking-tight tabular-nums`) | Primary financial and operational scorecards | `11,500 TND`, `+88,200 TND`, `42` |
| **Metric / Row** | `.sada-num-metric` (`font-display font-semibold tabular-nums`) | Sub-metrics, waterfall rows, package prices | `7,500 TND`, `2,800 TND` |
| **Table Column** | `.sada-num-table` (`font-display tabular-nums text-right`) | Ledger rows, client list metrics, deals table | `1,250 TND`, `350 TND` |
| **Percentage** | `.sada-num-percent` (`font-display font-semibold tabular-nums`) | Margins, deltas, ROI percentages | `37.75%`, `+12.4%`, `-66.9%` |
| **Monospace (Exception Only)** | `.sada-num-mono` (`font-mono tabular-nums`) | Strictly reserved for cryptographic hashes, raw invoice IDs (`#INV-2026-001`), database IDs, code slugs | `REC-2026-09-001` |

### 3. Currency Formatting Rules
- **Rule:** Never concatenate unformatted strings like `${val} TND` or `11 500 TND`.
- **Canonical Utility:** `formatCurrency(val, { currency?: string, showDecimals?: boolean })` from `@/lib/utils`.
- **Format Standard:** Comma thousands separator, space delimiter before currency code (e.g. `11,500 TND`, `2,800 TND`, `-7,688 TND`).

### 4. Canonical UI Component: `<SADANumber>`
Exported from `@/components/ui/sada-number` and re-exported via `@/components/ui/sada-ui`:
```tsx
import { SADANumber } from "@/components/ui/sada-ui";

// Large headline KPI
<SADANumber value={11500} format="currency" variant="kpi" />

// Metric with sign
<SADANumber value={-7688} format="currency" variant="metric" showSign />

// Percentage
<SADANumber value={37.75} format="percent" variant="percent" decimals={1} />

// Table financial cell
<SADANumber value={row.amount} format="currency" variant="table" />
```

## Anti-patterns


## Button Invariant (Strict Rule)

All buttons, action links, and interactive CTAs across the entire application must keep icons, arrows, and labels on **ONE SINGLE HORIZONTAL LINE**.
- `display: inline-flex` (or `flex`)
- `flex-direction: row`
- `flex-wrap: nowrap`
- `align-items: center`
- `justify-content: center`
- `white-space: nowrap`
- Icons must have `flex-shrink: 0` (`[&_svg]:shrink-0`)
- Text must NEVER wrap or drop the arrow below the label.

## Package Design System (Canonical Architecture)

The same package catalog data model powers two specialized presentations:
1. **Public Website (`PublicPackageCard.tsx`, `/pricing`):**
   - 3-column desktop layout (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8`).
   - 6 structured information zones: Header, Price (`1 490 TND`), Core Deliverables chips (Reels, Posts, Stories, Shoots, Ads, Web), Included Services (2-column balanced grid with "+N more"), Not Included exclusions, and Primary single-line CTA.
   - Secondary "View full package details" modal dialog (`PackageDetailsModal.tsx`) for deep dives without vertical card bloat.
2. **Admin Package Editor (`PackageEditorDrawer.tsx`, `/admin/packages`):**
   - Structured 8-section drawer with sticky header, section navigation pills, scrollable form, and sticky footer.
   - Live Public Card Preview tab with real-time reactive editing for 100% visual parity before publishing.

## Notification Toast Presentation & Stacking System

The SADA OS Notification Toast Presentation System standardizes the visual appearance and stacking mechanics for in-app alert cards:

### 1. Three-Zone Luxury Card Architecture (`NotificationToastCard.tsx`)
- **Zone A (Leading Icon):** Tinted circular background with glowing severity icon (`URGENT` / rose, `WARNING` / amber, `SECURITY` / purple, `SUCCESS` / emerald, `MESSAGE` / sky, `INFO` / primary).
- **Zone B (Rich Content):**
  - Header: Accessible textual severity pill (ensuring severity is never communicated by color alone), secondary client/context entity with truncation, subtle relative timestamp, and dismiss button (`X`).
  - Title: High-contrast `line-clamp-2` font-bold text.
  - Description: Concise `line-clamp-2` text, gracefully omitted if absent.
- **Zone C (Action Link):** Compact clickable text link with directional chevron arrow (`rtl:rotate-180`) preserving deep link navigation.

### 2. Stacking Mechanics (`src/components/ui/sonner.tsx` + `styles.css`)
- **Expanded Flow (`expand={true}`):** Prevents Sonner collapsed deck collisions by placing subsequent cards `gap={10}` (10px) below the active card.
- **Queue Bounds (`visibleToasts={3}`):** Limits visible stack to maximum 3 cards without obscuring dashboard navigation.
- **Responsive Containment:** Width is 380px on desktop (anchored top-right in LTR, top-left in RTL); constrained to full viewport minus 12px safe margins on mobile screens `<= 640px` and down to 320px.
- **Accessibility:** Full keyboard focus indicators, `role="alert"`, and `prefers-reduced-motion` animation suppression.







