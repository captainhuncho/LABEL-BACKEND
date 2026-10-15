# IMSS Records — Label Operations Dashboard

Internal dashboard for running the label: artist roster, catalog, royalty
accounting, payout statements, expenses and recoupment, and team access
control. React + Vite. No backend — data persists in the browser.

## Quick start

```bash
npm install
npm run dev
```

Opens at http://localhost:5173.

On first load you pick who you're signing in as:

- **Team member** → choose a name from the staff list. What you can see depends
  on that person's role and permissions.
- **Artist** → the artist-facing portal: their own revenue, payouts and
  statements, nothing else.

This is a soft access split for a clean artist view, not authentication —
anyone with the link can pick either.

## What's in it

**Analytics** — label overview and stream performance.

**Artists & catalog** — roster with per-artist detail, the release catalog,
a release calendar, and CSV import for distributor statements.

**Finance** — revenue (one row per track per month), master gross (what the
distributor actually paid each month), the ledger for non-royalty income and
expenses, budgets, payout statements, and per-artist statements.

**Team** — staff, roles and permissions, plus an access-request queue where
changes proposed by Legal wait for Admin approval.

## Roles

| Role | Sees |
|---|---|
| Admin | Everything. Top of the tree — access is fixed at full and can't be edited. |
| Legal | Same reach as Admin, but access changes it makes need Admin approval. Can't edit an Admin. |
| Finance | All money screens; no roster or catalog. |
| Product Manager | Their artists' budgets and expenses — **not** what artists earn. |
| A&R / Label Manager | Roster and catalog, no money. |
| Marketing | Catalog and noticeboard. |

Admins set permissions per person in **Team**, so one PM can be trusted with
earnings and another not.

## Data

Seed data is the real roster: 14 artists, 87 tracks, 596 monthly revenue rows
and 33 months of master gross. The ledger and payouts start empty.

Everything persists to `localStorage` through `window.storage`
(`src/storage.js`). To move it server-side, replace that one adapter — nothing
else in the app touches storage directly.

**Backup & Restore** (Admin only) exports and reimports the whole dataset as
JSON. **Reset to sample data** in the sidebar restores the seed.

## Building

```bash
npm run build     # -> dist/
npm run preview   # serve the production build
```

## Notes for developers

See `CLAUDE.md` for architecture, the finance model and its verified baseline
figures, the access-control rules, and the conventions worth not breaking.
