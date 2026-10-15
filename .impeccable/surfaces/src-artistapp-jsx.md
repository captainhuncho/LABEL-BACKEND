---
version: 1
slug: "src-artistapp-jsx"
primary_target: "src/ArtistApp.jsx"
related_targets: ["src/App.jsx"]
---

# Artist portal

Scope: the signed-in artist's portal (ArtistPortalShell in src/App.jsx, entered via src/ArtistApp.jsx). Mode: operate.
Audience: signed artists checking what they are owed, on phone as often as desktop. Job: know the balance, see which releases earned it, then statements, payouts, requests, profile. Constraint: keep every existing feature and figure; finance math stays in finance.js; same IMSS world (dark ground, amber/teal, Space Grotesk, mono numerals).

## Direction contract
THESIS: The portal opens on what the artist is owed and which releases earned it; it refuses the team-dashboard default of KPI tiles over a gross chart behind a tab strip.
OWN-WORLD: Existing IMSS world: #14171A ground with the amber/teal canvas glow, panel #14171AEB, amber for money owed and the active place, teal for the artist's earnings, mono tabular numerals, hairline grid tables.
STORY: The artist reads one sentence of arithmetic ending in their balance, scans releases ranked by what each earned them, opens one to see its months, then moves to statements, payouts or requests from the sidebar.
FIRST VIEWPORT: Left sidebar (logo, artist identity, Money group: Earnings, Revenue detail, Statements, Payouts, Budget; Music & you: Releases, Requests with count, Profile; Sign out pinned). Main: the owed statement line at full width, notices as one quiet strip, then the release ledger: rows with artwork, title, type and date, a proportional earnings bar, and the artist's earnings.
FORM: Earnings by release, dealt lead (position 6 of 7), seed key 0e2bd22f; sidebar navigation pinned by the user.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
