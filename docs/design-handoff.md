# Handoff Spec: IMSS Records Dashboard

**Source file:** `imss-records-dashboard.jsx` · **Data version:** `v24-primary-artists` · **Theme:** Smooth (current)

This spec documents the design system as it's actually implemented in the shipped build — every value below is pulled from the code, not estimated. Use it as the reference for building new screens/components that stay consistent with the existing app, or for porting this UI to a different stack.

## Overview

Record-label operations app: admin/staff dashboard (roster, catalog, finance, budgets, releases) plus a separate artist-facing portal. Single-page, client-rendered, dark theme throughout. No light-mode variant exists.

## Design Tokens

### Color

| Token | Value | Usage |
|---|---|---|
| `bg` | `#14171A` | App background |
| `panel` | `rgba(20,23,26,0.92)` | Cards, KPI tiles |
| `panel2` | `rgba(28,32,37,0.95)` | Nested/secondary panels, chart tooltips |
| `border` | `rgba(255,255,255,0.14)` | Default hairline borders |
| `borderLight` | `rgba(255,255,255,0.26)` | Emphasized borders (active tab, selected row) |
| `text` | `#EEEAE2` | Primary text |
| `textDim` | `#9BA1A1` | Secondary text, labels |
| `textFaint` | `#686E6E` | Tertiary text, placeholder-level |
| `amber` | `#E7A23D` | Primary accent — CTAs, active states, "amber" status tone |
| `amberSoft` | `rgba(231,162,61,0.2)` | Amber badge/tile backgrounds |
| `teal` | `#5FA593` | Positive/"active"/"approved" tone |
| `tealSoft` | `rgba(95,165,147,0.2)` | Teal badge/tile backgrounds |
| `red` | `#C1584A` | Negative/error/"expiring" tone |
| `redSoft` | `rgba(193,88,74,0.2)` | Red badge/tile backgrounds |

Background canvas gradient (behind the shell): `linear-gradient(135deg, #2E1D0E 0%, #14171A 32%, #0D2620 68%, #1B1330 100%)`, plus four blurred radial accent blobs (amber/teal/red, 70px blur, 28–55% opacity) fixed at the corners for ambient color — decorative only, `pointer-events: none`.

### Typography

| Token | Value | Usage |
|---|---|---|
| `HEADING_FONT` | `'Space Grotesk', sans-serif` | All UI text, including body — this app does not split heading/body fonts |
| `MONO_FONT` | `'IBM Plex Mono', monospace` | Numeric/data cells (`<Td mono>`), IDs |
| Headings (`h1,h2,h3`) | weight 600, no letter-spacing override | — |
| Body/labels | weight 400–500 default, 600 for emphasized labels | — |
| Small label size | 10–13px | Badges, table headers, field labels |

### Spacing & Shape

| Token | Value |
|---|---|
| Content padding | 16px mobile → 32px desktop (`.imss-content`) |
| Card/panel radius | 14px (`.rounded`) |
| Input/select/textarea radius | 10px |
| Pill radius (badges, avatar dots, count bubbles) | 9999 (full) |
| Default border width | 1px |
| Tab active-indicator border | 2px solid bottom, accent color |

### Shadow & Elevation

| Token | Value | Usage |
|---|---|---|
| Card shadow | `0 1px 2px rgba(0,0,0,0.25), 0 6px 16px rgba(0,0,0,0.22)` | Any `.rounded.border` panel |
| Card shadow (hover) | `0 4px 10px rgba(0,0,0,0.25), 0 10px 24px rgba(0,0,0,0.28)` + `translateY(-2px)` | Interactive cards/buttons with that class |
| Card shadow (active/pressed) | `0 1px 2px rgba(0,0,0,0.25)` + `translateY(0)` | — |
| Input focus ring | `0 0 0 3px rgba(231,162,61,0.2)` + border → `rgba(231,162,61,0.75)` | All form fields |

### Breakpoints

| Breakpoint | Value |
|---|---|
| `sm` | 640px |
| `md` | 768px |
| `lg` | 1024px |

## Layout System

- **Shell:** column flex on mobile (top nav bar), row flex ≥768px (left sidebar, 224px fixed width).
- **Bento grid** (dashboard KPI/summary layout): 1 column on mobile → 6-column grid ≥768px, with `span-1` and `span-3` helper classes for tile width.
- **Form grid:** 1 column on mobile → 2 columns ≥640px (`.imss-span-2` lets a field break out to full width).
- **Two-pane grid** (e.g. list + detail): 1 column on mobile → 2 columns ≥1024px.

All grid/flex direction switches are handled by dedicated CSS classes (`.imss-shell`, `.imss-bento`, `.imss-form-grid`, `.imss-grid-2`) rather than per-component responsive utility classes — extend those classes rather than adding new breakpoint logic inline.

## Components

| Component | Variants / Props | Notes |
|---|---|---|
| `Btn` | `variant`: `primary` (amber gradient fill, dark text), `ghost` (default, subtle white-on-transparent), `danger` (red-tinted outline) · `disabled` | Disabled state: 50% opacity, `cursor: not-allowed`, click handler suppressed |
| `Badge` | `tone`: `default`, `amber`, `teal`, `red` | Uppercase, 10.5px, letter-spacing 0.02em, soft-tint background + tone-colored border |
| `Input` / `Select` / `TextArea` | — | Share one `inputStyle` object; TextArea adds vertical resize |
| `Field` | `label`, `full` (spans 2 grid columns) | Label + control wrapper, 12px dim label above control |
| `KPICard` | `icon`, `label`, `value`, `sub`, `tone` | Has a one-shot animated sheen (see Animation) |
| `SegmentedToggle` | `options[]`, `value`, `onChange` | Pill-style tab group; active segment gets amber-soft fill |
| `Avatar` | `name`, `photoUrl`, `size` | Falls back to initials on transparent tinted circle if no photo |
| `Th` / `Td` | `align`, `mono` (Td only) | Table primitives; `mono` switches to `MONO_FONT` for numeric columns |
| `EmptyState` | `icon`, `title`, `description` | Dashed border, centered, used for zero-data states |
| `ExportBar` | `filename`, `headers`, `rows` | Renders CSV / Excel / Print buttons together; hidden on print |
| `ConfirmInline` | `label`, `onConfirm`, `onCancel` | Inline "Yes / Cancel" text prompt, replaces window.confirm |

## States & Interactions

| Element | State | Behavior |
|---|---|---|
| `Btn` (any variant) | Hover | `translateY(-1px)`, soft shadow, `brightness(1.06)` |
| `Btn` | Active/pressed | `translateY(0)`, shadow removed, `brightness(0.98)` |
| `Btn` | Disabled | 50% opacity, no pointer events, no hover/active effects |
| Card/panel with `.rounded.border` | Hover (if interactive) | Lift + shadow deepen, border tints toward amber at 60% |
| Nav button | Active/pressed | `scale(0.98)` |
| Input/Select/TextArea | Focus | Border → amber @ 75%, 3px soft amber glow ring, no browser default outline |
| Tab (SegmentedToggle or underline-style) | Selected | Amber text/fill + persistent indicator (no separate "hover while selected" state defined) |
| Approval-gated record (earnings, expenses, profile edits, release submissions) | Pending / Approved / Rejected | Tone-mapped to amber / teal / red via `Badge`; pending records are excluded from all downstream totals (Payouts, Statements, Overview) until approved |
| Permission-gated nav/section | No permission | Section is omitted from the UI entirely, not shown-disabled |

All transitions use consistent easing: `0.18s ease` for buttons/cards/inputs/nav, `0.12s ease` for the tiny nav-button press scale.

## Responsive Behavior

| Breakpoint | Changes |
|---|---|
| Desktop (≥1024px) | Sidebar nav (224px, vertical), 32px content padding, two-pane views split into columns, full 6-col bento grid |
| Tablet (768–1023px) | Same sidebar layout as desktop, but two-pane views (`.imss-grid-2`) stack to a single column |
| Mobile (<768px) | Top horizontal scrolling nav bar instead of sidebar, 16px content padding, all grids (bento, form, two-pane) collapse to 1 column |

## Edge Cases

- **Empty state:** `EmptyState` component — icon, title, optional description, dashed border. Used consistently rather than ad hoc "no data" text.
- **Long text:** No explicit truncation/ellipsis rules found in the table/list components — long artist names, release titles, etc. will wrap rather than truncate. Flag this if fixed-height rows are needed later.
- **Loading:** No loading/skeleton state exists anywhere — the app is fully client-side/synchronous against `window.storage`, so there's currently no async boundary that needs one. Will need to be designed if a real backend is added.
- **Error state:** No dedicated error-state UI pattern exists yet beyond disabled buttons and inline validation. Form errors are not currently styled as a distinct state.
- **Zero/large datasets:** KPI tiles and charts don't have documented min/max guards — very large numbers will rely on the existing `formatCurrency`/`formatNumber` helpers rather than a truncation rule.

## Animation / Motion

| Element | Trigger | Animation | Duration | Easing |
|---|---|---|---|---|
| `KPICard` | On mount, looping | Diagonal light sheen sweep across the card | 6s loop | ease-in-out |
| Buttons, cards, nav items | Hover/press | Lift (`translateY`) + shadow/brightness change | 0.18s (0.12s for nav press) | ease |
| Inputs | Focus | Border color + glow ring fade in | 0.18s | ease |

No page-transition, route-change, or reveal-on-scroll animation exists — navigation between sections is instant with no motion.

## Accessibility Notes

This is the area with the most real gaps — documenting honestly rather than asserting compliance:

- **No ARIA attributes, roles, or `tabIndex` overrides exist anywhere in the codebase.** Interactive elements rely entirely on native semantics (`<button>`, `<input>`, `<select>`), which gives baseline keyboard operability but no landmark/labeling for screen readers beyond visible text.
- **Focus order** follows DOM order (no custom focus management) — this is fine as long as visual layout order matches DOM order, which it currently does.
- **Focus visibility:** custom focus ring exists only for form fields (amber glow); buttons and nav items have no visible focus indicator distinct from hover, so keyboard-only users can't easily tell what's focused on those elements.
- **Color contrast:** `textFaint` (`#686E6E`) on `bg`/`panel` backgrounds is likely below WCAG AA for small text — worth auditing before any accessibility push.
- **Recommendation if accessibility work is scoped:** start with (1) visible focus rings on `Btn`/nav items, (2) `aria-label`s on icon-only buttons, (3) `role="status"` on pending/approval badges so state changes are announced.

## Known Gaps / Not Yet Built

Called out here so engineering doesn't assume these exist elsewhere in the codebase:

- No real backend or authentication — all data lives in `window.storage`, deliberately deferred
- Contracts are tracked by expiry date only, not as attached documents
- No unified calendar/timeline overlaying releases, tasks, and expirations
- No bulk actions (everything is single-record)
- No recurring/template tasks
- Activity log is section-level, not field-level (no before/after value tracking)
- No trend/year-over-year comparison views
