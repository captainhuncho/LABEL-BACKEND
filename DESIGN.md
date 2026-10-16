---
name: IMSS Records — Label Operations
description: Quiet, Apple-website surfaces for the label's roster, catalog and money, and each artist's portal; follows the device's light or dark setting.
colors:
  ground-light: "#f5f5f7"
  panel-light: "#ffffff"
  panel-2-light: "#fbfbfd"
  text-light: "#1d1d1f"
  text-2-light: "#6e6e73"
  text-3-light: "#86868b"
  amber-text-light: "#9E5D00"
  teal-light: "#1F7A64"
  red-light: "#C42B1C"
  ground-dark: "#000000"
  panel-dark: "#1c1c1e"
  panel-2-dark: "#232325"
  text-dark: "#f5f5f7"
  text-2-dark: "#a1a1a6"
  text-3-dark: "#86868b"
  amber-text-dark: "#F0B04F"
  teal-dark: "#6CC4AC"
  red-dark: "#FF6B5E"
  amber-fill: "#E7A23D"
  on-amber: "#1d1d1f"
typography:
  large-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"SF Pro Display\", system-ui, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "clamp(28px, 4vw, 40px)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  owed-figure:
    fontFamily: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"SF Pro Display\", system-ui, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif"
    fontSize: "clamp(44px, 7vw, 72px)"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  kpi-figure:
    fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    letterSpacing: "-0.025em"
  heading:
    fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    letterSpacing: "-0.02em"
  body-large:
    fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "-0.01em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    letterSpacing: "-0.01em"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
rounded:
  pill: "980px"
  full: "9999px"
  panel: "18px"
  quote: "14px"
  field: "12px"
  nav-item: "10px"
  artwork: "6px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  content-x-desktop: "48px"
  content-x-phone: "16px"
components:
  button-primary:
    backgroundColor: "{colors.amber-fill}"
    textColor: "{colors.on-amber}"
    rounded: "{rounded.pill}"
    padding: "9px 18px"
    typography: "{typography.body}"
  button-ghost:
    backgroundColor: "rgba(0,0,0,0.05)"
    textColor: "{colors.text-light}"
    rounded: "{rounded.pill}"
    padding: "9px 18px"
  button-danger:
    backgroundColor: "rgba(196,43,28,0.09)"
    textColor: "{colors.red-light}"
    rounded: "{rounded.pill}"
    padding: "9px 18px"
  input:
    backgroundColor: "{colors.panel-light}"
    textColor: "{colors.text-light}"
    rounded: "{rounded.field}"
    padding: "9px 12px"
    height: "40px"
  panel:
    backgroundColor: "{colors.panel-light}"
    rounded: "{rounded.panel}"
  kpi-card:
    backgroundColor: "{colors.panel-light}"
    rounded: "{rounded.panel}"
    padding: "18px 20px"
    typography: "{typography.kpi-figure}"
  badge-amber:
    backgroundColor: "rgba(231,162,61,0.16)"
    textColor: "{colors.amber-text-light}"
    rounded: "{rounded.full}"
    padding: "3px 10px"
    typography: "{typography.caption}"
  badge-teal:
    backgroundColor: "rgba(31,122,100,0.11)"
    textColor: "{colors.teal-light}"
    rounded: "{rounded.full}"
    padding: "3px 10px"
  nav-item-active:
    backgroundColor: "rgba(231,162,61,0.16)"
    textColor: "{colors.amber-text-light}"
    rounded: "{rounded.nav-item}"
  preset-chip-on:
    backgroundColor: "{colors.amber-fill}"
    textColor: "{colors.on-amber}"
    rounded: "{rounded.pill}"
    height: "40px"
---

# Design System: IMSS Records — Label Operations

## Overview

**North star: the label's own Apple-style site.** Every screen (sign-in, team dashboard, artist portal, legal pages, notification emails) reads like an Apple product page: a soft grey ground, white panels, one large confident title, the one figure that matters, and pill controls. Content comes first; chrome recedes into a translucent sidebar.

The platform follows the device's light/dark setting through CSS variables on `:root` (light) and `@media (prefers-color-scheme: dark)` (dark) in `src/theme.js`. The `C` object exposes them as `var(--…)`, so components never hold literal colours.

This replaces "The Masters Vault" (dark #14171A ground, amber/teal glow canvas, Space Grotesk + IBM Plex Mono). Nothing from that world carries over except the two brand accents and their meanings.

## Colors

Two complete sets, switched by the device. Variable names are shared; values change.

| Variable | Light | Dark | Role |
|---|---|---|---|
| `--bg` | #f5f5f7 | #000000 | Page ground |
| `--panel` | #ffffff | #1c1c1e | Panels, cards, fields |
| `--panel-2` | #fbfbfd | #232325 | Table header band, inset review areas |
| `--chrome` | rgba(251,251,253,0.82) | rgba(22,22,23,0.8) | Frosted sidebar / phone tab bar |
| `--text` | #1d1d1f | #f5f5f7 | Primary text |
| `--text-2` | #6e6e73 | #a1a1a6 | Secondary text, labels, descriptions |
| `--text-3` | #86868b | #86868b | Placeholders, table headers only |
| `--hairline` / `--hairline-strong` | rgba(0,0,0,.09) / .16 | rgba(255,255,255,.11) / .2 | Borders, dividers |
| `--fill` / `--hover` | rgba(0,0,0,.05) / .04 | rgba(255,255,255,.08) / .06 | Ghost buttons, chips / hover rows |
| `--amber` | #9E5D00 | #F0B04F | Amber as text (deepened on white for contrast) |
| `--amber-fill` | #E7A23D | #E7A23D | Primary button and active-chip fill |
| `--on-amber` | #1d1d1f | #1d1d1f | Text on amber fill |
| `--amber-soft` / `--amber-line` | rgba(231,162,61,.16) / rgba(180,112,14,.45) | .18 / rgba(231,162,61,.5) | Active nav, badges / focus ring |
| `--teal` / `--teal-soft` | #1F7A64 / rgba(31,122,100,.11) | #6CC4AC / rgba(95,165,147,.18) | Earnings |
| `--red` / `--red-soft` | #C42B1C / rgba(196,43,28,.09) | #FF6B5E / rgba(255,107,94,.14) | Danger, errors |

### Primary
**IMSS amber** (`amber-fill` #E7A23D; text form `amber-text-*`): what is owed, what is active, the primary action.

### Secondary
**Teal** (`teal-*`): money earned or confirmed. Nothing else.

### Neutral
Apple greys: #f5f5f7 / #ffffff / #1d1d1f / #6e6e73 in light; #000 / #1c1c1e / #f5f5f7 / #a1a1a6 in dark.

### Named Rules
- **The Meaning Rule.** Amber = owed, active, primary action. Teal = earnings only. Red = danger. Neither accent is ever decoration.
- **The Device Rule.** Never hard-code a colour in a component; use `C.*` so light and dark both hold.
- **The Readable Grey Rule.** Readable copy uses `--text` or `--text-2`; `--text-3` is for placeholders and table header labels.

## Typography

One family: the system stack (SF Pro on Apple devices, each platform's UI face elsewhere). No monospace: `MONO_FONT` is an alias of the system stack; figures use tabular numerals (`font-feature-settings: "tnum"` globally, `font-variant-numeric: tabular-nums` on cells and KPIs). Base tracking -0.01em, antialiased.

### Hierarchy
- **Large title** (`.imss-title`, `.imss-portal-title`): clamp(28px, 4vw, 40px), 700, -0.03em, 1.08. One per screen.
- **Owed figure** (`.imss-owed`): clamp(44px, 7vw, 72px), 700, -0.035em. The one number that matters.
- **KPI figure**: 28px, 700, -0.025em, tabular.
- **Headings** h1–h3: 600, -0.02em; empty-state title 19px.
- **Body large**: 17px / 1.45 for section descriptions, legal body (17px / 1.6, max 68ch), emails.
- **Body**: 15px for controls, inputs, rows.
- **Labels**: 13–14px in `--text-2`. **Captions/badges**: 12px.

### Named Rules
- **Sentence case everywhere.** No uppercase eyebrow labels, no tracked-out caps.

## Layout

The shell fills the viewport (`100dvh`) and scrolls only in `.imss-content`. Desktop (≥768px): 240px sidebar left, content padded 40px 48px, inner max-width 1280px. Phone: sidebar becomes a top tab bar; content padded 20px 16px. Grids (`imss-grid-2`, `imss-form-grid`, `imss-bento` 6-col) switch at 640 / 768 / 1024 / 1280px via `GLOBAL_STYLES` media queries, never Tailwind responsive prefixes.

## Elevation & Depth

Flat by default: panels separate from the ground by tone, not shadow. No glow, no blurred colour blobs, no gradients.

### Shadow Vocabulary
- `--shadow`: light `0 2px 6px rgba(0,0,0,.04), 0 10px 30px rgba(0,0,0,.06)`; dark `0 2px 6px rgba(0,0,0,.3), 0 10px 30px rgba(0,0,0,.35)`. Applied **only on hover** of clickable bordered panels (`button.rounded.border:hover`).
- Focus: 4px `--amber-soft` ring with `--amber-line` border on fields; 3px `--amber-line` outline for `:focus-visible`.

### Translucency
The sidebar / phone tab bar is the one material: `--chrome` with `backdrop-filter: saturate(180%) blur(20px)`.

## Shapes

Pills (980px) for buttons and preset chips; 9999px for badges, people chips, progress bars; 18px panels and message bubbles; 14px email quote blocks; 12px fields; 10px nav items; 6px artwork thumbs.

## Components

### Buttons
`Btn` (`.imss-btn`): pill, 9px 18px, 15px/500, no border. Variants: **primary** amber fill with #1d1d1f text; **ghost** `--fill` (hover `--hairline`); **danger** `--red-soft` / `--red`. Hover brightness(1.06); active scale(0.97); disabled opacity 0.45, not-allowed cursor.

### Chips
`Badge`: 12px/600, 3px 10px, full radius; tones default / amber / teal / red use the soft fill with the strong text. Dashboard period presets: 40px pills, `--fill`, on-state amber fill. People chips: 28px, `--fill`.

### Cards / Containers
`.rounded` panels: 18px, `--panel`, hairline border if any. `KPICard`: 18px 20px, 13px label, 28px tabular figure, accent by tone. `EmptyState`: centred panel, 28px icon, 19px title, 15px description. Never nest a card inside a card; inner grouping uses hairline dividers or `--panel-2`.

### Inputs / Fields
`inputStyle`: `--field` background, 1px `--field-line`, 12px radius, 9px 12px, 15px, min-height 40px. `Field` label 13px `--text-2` above. Focus: amber line + 4px amber-soft ring. Placeholder `--text-3`.

### Navigation
Desktop: translucent 240px sidebar; nav items 10px radius, hover `--hover`, active `--amber-soft` with `--amber` text, press scale(0.98). Bottom of nav list fades via mask.

### Frosted phone tab bar
Below 768px the sidebar becomes a horizontal, scrollable bar absolutely positioned over the content (53px tall, frosted `--chrome` + blur), with content padded 69px on top so it scrolls underneath.

### Tables
Hairline grid, `--panel-2` header band, 12px `--text-3` header labels, tabular numerals, no bottom border on the last row.

### Notification email
`page()` in `supabase/functions/notify/index.ts` mirrors the app: #f5f5f7 ground, white 18px card, 28px/700 title, 17px body in #424245, 14px-radius quote on #f5f5f7, amber pill CTA (#E7A23D, #1d1d1f text, 12px 22px, 17px/600), and a dark-scheme override (#000 / #1c1c1e / #f5f5f7 / #a1a1a6).

## Motion

Apple ease `cubic-bezier(0.28, 0.11, 0.32, 1)` everywhere. State changes (colour, border, ring) 200ms; panel hover 240ms; press 120ms. Content entrance `imss-enter` 420ms: opacity in, 6px rise. `prefers-reduced-motion: reduce` removes the entrance and zeroes transitions.

## Do's and Don'ts

### Do:
- Do use one large title per screen and let the owed figure be the largest thing on it.
- Do use `C.*` / CSS variables so both colour sets work.
- Do write in sentence case; call the swift fee "Inbound Banking Charge" on screen.
- Do show amounts in the system face with tabular numerals.
- Do keep pills for actions and 18px panels for content.

### Don't:
- Don't use uppercase eyebrow labels or kickers above titles.
- Don't nest cards inside cards.
- Don't use gradients, glows, coloured blobs or resting shadows; `--shadow` is hover only.
- Don't use amber or teal as decoration; teal is for earnings only.
- Don't use a monospace face for figures.
- Don't add a second scroll container.
