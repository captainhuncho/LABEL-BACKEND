---
version: 1
slug: "src-app-jsx"
primary_target: "src/App.jsx"
related_targets: ["src/ArtistApp.jsx","src/AuthGate.jsx","src/Legal.jsx"]
---

# Whole platform (Apple-site world)

Scope: every screen: sign-in, team dashboard (App.jsx), artist portal, legal pages, notification emails. Mode: operate.
Audience: label staff at desks and artists on phones, in daylight and at night. Job unchanged: finance, catalog, portal. Constraint: every feature, figure and flow stays; finance math untouched; amber = owed/active, teal = earned stay (user-pinned); light/dark follows the device (user-pinned).

## Direction contract
THESIS: The platform reads like an Apple website: quiet surfaces, one large confident title per screen, pill controls, content first. It refuses the dark glow dashboard (gradient canvas, blurred colour blobs, card shadows everywhere) it had before.
OWN-WORLD: Light: #f5f5f7 ground, white panels, #1d1d1f text, #6e6e73 secondary, hairlines rgba(0,0,0,.1). Dark: #000 ground, #1c1c1e panels, #f5f5f7 text. System SF Pro stack (Inter fallback), tabular numerals, no monospace. Accent amber (deepened for text on white), teal for earnings. Pill buttons (980px radius), 12px inputs, 18px panels, Apple ease cubic-bezier(.28,.11,.32,1).
STORY: Staff and artists land on a calm screen, read the large title and the one figure that matters, act through pill buttons, and move by a translucent sidebar.
FIRST VIEWPORT: Left translucent sidebar (logo, identity, plain nav list, active item as a filled pill); main: large bold title (34–40px, -0.03em) with right-aligned status, then content panels on the soft ground; primary action as an amber pill.
FORM: Apple website design language, user-pinned (no seed roll); signature move: frosted translucent navigation over content plus large-title hierarchy.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
