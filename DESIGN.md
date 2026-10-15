---
name: IMSS Records — Label Operations
description: The label's dark, exact back room for its roster, catalog and money, plus each artist's portal.
colors:
  tape-amber: "#E7A23D"
  tape-amber-deep: "#C77F1F"
  tape-amber-soft: "rgba(231,162,61,0.2)"
  console-teal: "#5FA593"
  console-teal-soft: "rgba(95,165,147,0.2)"
  oxide-red: "#C1584A"
  oxide-red-soft: "rgba(193,88,74,0.2)"
  vault-black: "#14171A"
  vault-panel: "rgba(20,23,26,0.92)"
  vault-panel-raised: "rgba(28,32,37,0.95)"
  hairline: "rgba(255,255,255,0.14)"
  hairline-strong: "rgba(255,255,255,0.26)"
  ivory-ink: "#EEEAE2"
  ash-ink: "#9BA1A1"
  smoke-ink: "#686E6E"
  amber-ink: "#1A1500"
typography:
  display:
    fontFamily: "'IBM Plex Mono', monospace"
    fontSize: "clamp(40px, 7vw, 64px)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "'Space Grotesk', sans-serif"
    fontSize: "26px"
    fontWeight: 600
    letterSpacing: "-0.02em"
  title:
    fontFamily: "'Space Grotesk', sans-serif"
    fontSize: "17px"
    fontWeight: 600
  body:
    fontFamily: "'Space Grotesk', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Space Grotesk', sans-serif"
    fontSize: "12px"
    fontWeight: 500
  figure:
    fontFamily: "'IBM Plex Mono', monospace"
    fontSize: "15px"
    fontWeight: 500
    fontFeature: "tnum"
  kpi-figure:
    fontFamily: "'IBM Plex Mono', monospace"
    fontSize: "22px"
    fontWeight: 600
rounded:
  input: "10px"
  surface: "14px"
  pill: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.tape-amber}"
    textColor: "{colors.amber-ink}"
    rounded: "{rounded.surface}"
    padding: "8px 14px"
  button-ghost:
    backgroundColor: "rgba(255,255,255,0.04)"
    textColor: "{colors.ivory-ink}"
    rounded: "{rounded.surface}"
    padding: "8px 14px"
  button-danger:
    backgroundColor: "rgba(193,88,74,0.1)"
    textColor: "{colors.oxide-red}"
    rounded: "{rounded.surface}"
    padding: "8px 14px"
  input:
    backgroundColor: "rgba(20,23,26,0.85)"
    textColor: "{colors.ivory-ink}"
    rounded: "{rounded.input}"
    padding: "7px 9px"
  card:
    backgroundColor: "{colors.vault-panel}"
    textColor: "{colors.ivory-ink}"
    rounded: "{rounded.surface}"
    padding: "16px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.ash-ink}"
    rounded: "{rounded.surface}"
    padding: "8px 12px"
  nav-item-active:
    backgroundColor: "{colors.tape-amber-soft}"
    textColor: "{colors.tape-amber}"
  badge-amber:
    backgroundColor: "{colors.tape-amber-soft}"
    textColor: "{colors.tape-amber}"
    rounded: "{rounded.surface}"
    padding: "2px 8px"
  badge-teal:
    backgroundColor: "{colors.console-teal-soft}"
    textColor: "{colors.console-teal}"
    rounded: "{rounded.surface}"
    padding: "2px 8px"
---

# Design System: IMSS Records — Label Operations

## Overview

**Creative North Star: "The Masters Vault"**

IMSS Records keeps its catalog and its money in one dark, secure room. The dashboard should feel like that vault: a near-black field with a faint warm-and-cool glow at the edges, quiet panels laid on top, and figures that read as exact. Nothing in it is loud. The two lights in the room, Tape Amber and Console Teal, each do one job: amber marks money owed and the place you are, teal marks money earned and things confirmed.

It's a working tool used daily by label staff, and by artists checking what they're owed, often on a phone. Density is moderate. Tables carry the real information and sit in a full hairline grid. Money is always set in mono with tabular numerals, so columns line up and amounts can't be misread. Prose stays short and plain.

The same world serves both doors. The team side and the artist portal share the canvas, the panels, the sidebar and the type; the portal simply leads with the artist's balance and their releases.

**Key Characteristics:**
- Near-black vault ground with a diagonal amber → black → green → violet glow and soft blurred colour blobs behind everything.
- Translucent dark panels with 1px hairline borders and generous 14px corners.
- Two accents with fixed meanings: amber = owed / active / primary action, teal = earned / confirmed.
- Every amount in IBM Plex Mono with tabular figures.
- Sidebar navigation on desktop that collapses to a swipeable strip on phones.

## Colors

A restrained palette: tinted near-blacks and ivory ink, two working accents, and one warning red.

### Primary
- **Tape Amber** (tape-amber): money owed to someone, the primary action, the current page in navigation, focus rings and the input focus glow. Warm like analog tape and VU lights. The primary button runs a gradient from Tape Amber to **Tape Amber Deep** (tape-amber-deep) with **Amber Ink** (amber-ink) text.
- **Tape Amber Soft** (tape-amber-soft): the active nav item's fill, amber badges, notices that need attention.

### Secondary
- **Console Teal** (console-teal): what an artist has earned, revenue totals, confirmed and "all good" states, earnings bars and charts.
- **Console Teal Soft** (console-teal-soft): the highlighted "Your earnings" row, teal badges.

### Tertiary
- **Oxide Red** (oxide-red): destructive actions, negative balances, overspent budgets and errors only. **Oxide Red Soft** (oxide-red-soft) is its badge and danger-button fill.

### Neutral
- **Vault Black** (vault-black): the base page colour under the canvas gradient.
- **Vault Panel** (vault-panel): every card, table container, sidebar and form surface.
- **Vault Panel Raised** (vault-panel-raised): tooltips and anything sitting above a panel.
- **Hairline** (hairline): borders, table grid lines and dividers. **Hairline Strong** (hairline-strong) is used where a border has to read on a busier background, such as the sign-in cards.
- **Ivory Ink** (ivory-ink): headings, body text and figures.
- **Ash Ink** (ash-ink): secondary text, labels, inactive nav, captions. The lowest tone allowed for readable text.
- **Smoke Ink** (smoke-ink): placeholder text, decorative icons, and chevrons only.

### Named Rules
**The Two Lights Rule.** Amber means owed, active or act-now; teal means earned or confirmed. Never swap them, and never use either as decoration.

**The Readable Ink Rule.** Text a person must read is Ivory Ink or Ash Ink. Smoke Ink is for icons and placeholders, never for words that carry information.

## Typography

**Display Font:** IBM Plex Mono (for money), with monospace fallback
**Body Font:** Space Grotesk, with sans-serif fallback
**Label/Mono Font:** IBM Plex Mono for every figure, amount and date in a table

**Character:** Space Grotesk gives the interface a slightly mechanical, studio-gear warmth. Plex Mono makes every amount look like it came off a statement.

### Hierarchy
- **Display** (600, clamp(40px, 7vw, 64px), 1.05, mono): one figure per screen at most, such as the artist's "You're owed" balance.
- **Headline** (600, 26px; 22px on phones): page titles ("Earnings", "Statements").
- **Title** (600, 17px): section headings inside a page.
- **Body** (400, 14px, 1.5): descriptions and notices, kept to about 70ch.
- **Label** (500, 12px): field labels, table headers, card captions, nav group names.
- **Figure** (500–600, 15px, mono, tabular): amounts in tables, ledgers and the balance breakdown. KPI figures run larger (600, 22px).

### Named Rules
**The Statement Figures Rule.** Every amount of money is set in IBM Plex Mono with tabular numerals and right-aligned in its column. Whole dollars on team overviews; cents wherever an artist reads a breakdown.

## Layout

The app shell fills the window (100dvh) and scrolls in exactly one place, the content pane. On desktop (768px and up) a 224px sidebar sits on the left; on phones it becomes a horizontal strip across the top that scrolls sideways. Content has 32px padding on desktop and 16px on phones. The team side is capped at 1440px and the artist portal at 1120px.

Spacing follows a 4px base, mostly 8 / 12 / 16 / 24 / 32px: tight 8–12px inside groups, 24px between sections, more space above a heading than below it. Two-column grids collapse to one column below 1024px; form grids go to two columns from 640px and three from 1280px. Breakpoints live in the global stylesheet as media queries (640 / 768 / 900 / 1024 / 1280px), not as Tailwind responsive prefixes.

### Named Rules
**The One Scroll Rule.** Only the content pane scrolls. Never add a second scroll container inside a page; wide tables scroll sideways inside their own bordered box.

## Elevation & Depth

Depth comes from tonal layering first: the glowing canvas, then translucent panels, then raised panels for tooltips. Bordered cards add a soft two-layer shadow so they sit just above the canvas. Cards never move: a clickable card answers hover with a deeper shadow and an amber border. Only buttons lift, by 1px.

### Shadow Vocabulary
- **Panel rest** (`box-shadow: 0 1px 2px rgba(0,0,0,0.25), 0 6px 16px rgba(0,0,0,0.22)`): every bordered card at rest.
- **Panel lifted** (`box-shadow: 0 4px 10px rgba(0,0,0,0.25), 0 10px 24px rgba(0,0,0,0.28)`): clickable cards on hover, without moving.
- **Button lift** (`box-shadow: 0 6px 16px rgba(0,0,0,0.22)`): buttons on hover, with translateY(-1px).
- **Focus glow** (`box-shadow: 0 0 0 3px rgba(231,162,61,0.2)`): focused inputs, with an amber border.

### Named Rules
**The Soft Lift Rule.** Shadows are always offset and blurred, and only buttons lift (by 1px). Cards stay still: no hover jumps, no looping shimmer or sheen. No hard-edged block shadows, no coloured glows.

## Shapes

Soft and assured. Surfaces, buttons and badges share one generous 14px corner; inputs are slightly tighter at 10px; bars, counters and avatars are full pills or circles. Borders are 1px hairlines everywhere. Tables are a full grid: hairline rules between rows and between columns, a faintly shaded header row, and no line under the last row where the card border sits.

## Components

### Buttons
Soft and assured: rounded, compact, never shouting.
- **Shape:** 14px corners, 8px × 14px padding, 14px Space Grotesk at weight 500, icon and label 6px apart.
- **Primary:** Tape Amber → Tape Amber Deep gradient, Amber Ink text, amber border. One per view, for the main action.
- **Ghost:** 4% white fill, Ivory Ink text, 12% white border. The default for secondary actions and export bars (CSV · Excel · Print / PDF).
- **Danger:** Oxide Red Soft fill and Oxide Red text and border, for destructive actions. Deletes confirm inline ("Delete? Yes / Cancel") rather than in a modal.
- **Hover / Focus:** lift 1px, add the button shadow, brighten 6%; pressed returns flat. Disabled is 50% opacity.

### Cards / Containers
- **Corner Style:** 14px.
- **Background:** Vault Panel, with a Hairline border and the panel-rest shadow.
- **Internal Padding:** 16px; 20–24px for the primary card on a screen.
- **KPI cards:** small icon and label in Ash Ink, figure in 22px mono, tinted by meaning. Use sparingly, for figures someone acts on.

### Inputs / Fields
- **Style:** dark fill (rgba(20,23,26,0.85)), 18% white border, 10px corners, 13px text, label above in 12px Ash Ink.
- **Focus:** amber border plus the soft amber focus glow; no browser outline.
- **Period filters:** filters apply only when someone clicks Generate, so a table answers the question that was asked.

### Chips / Badges
- **Style:** 10.5px uppercase, weight 600, slightly tracked, 1px border in the tone colour over its soft fill (amber, teal, red) or transparent with a Hairline border by default. Used for status and release type ("EP TRACK", "RELEASED").

### Navigation
- **Sidebar:** logo at the top, then items grouped under small Ash Ink group names, then account and sign-out pinned at the bottom.
- **Items:** 16px icon plus 14px label. Inactive items use Ash Ink; hover adds a 5% white fill; the current page uses a Tape Amber Soft fill with Tape Amber text at weight 600. Counters are amber pills.
- **Phones:** the same items in one horizontal, swipeable row at the top of the screen.

### Tables
Full hairline grid, header row in 12px Ash Ink on a 4% white band, figures right-aligned in mono, wrapped in a bordered card that scrolls sideways when narrow. Export buttons sit above the table they export.

### Release Ledger (signature component)
The artist portal's ranked list of releases. Each row has 44px artwork (or a coloured initials tile), title and type · date, a slim pill bar showing that release's share of the artist's top earner in Console Teal, and the artist's earnings in mono with the latest month under it. The whole row is one button that opens that release's revenue; hovering brightens the bar. On phones the bar drops away.

### Balance Breakdown (signature component)
A statement in miniature: the owed figure in Display mono beside a receipt-style list (Gross, Inbound Banking Charge, Label share, Your earnings, Recouped, Paid, You're owed), each line label left and amount right, with the "Your earnings" line on Console Teal Soft and the total ruled off above.

## Do's and Don'ts

### Do:
- **Do** set every amount in IBM Plex Mono with tabular numerals, right-aligned.
- **Do** keep amber for owed / active / primary and teal for earned / confirmed (The Two Lights Rule).
- **Do** use 14px corners on surfaces and buttons and 10px on inputs, with 1px Hairline borders.
- **Do** put tables in a full hairline grid with a shaded header row.
- **Do** show the arithmetic whenever you show an artist a total: gross, Inbound Banking Charge, label share, then their earnings.
- **Do** call the swift fee "Inbound Banking Charge" everywhere a person can read it.
- **Do** put responsive changes in the global stylesheet's media queries.

### Don't:
- **Don't** use Smoke Ink (#686E6E) for text people need to read; it fails contrast on the vault ground.
- **Don't** add a second scrolling area inside a page.
- **Don't** use hard offset shadows, coloured glows or gradient text.
- **Don't** use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`); breakpoints live in the stylesheet.
- **Don't** show an artist gross figures without the breakdown beside them.
- **Don't** open a modal for a delete; confirm inline.
