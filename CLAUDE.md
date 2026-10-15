# IMSS Records — Label Operations Dashboard

Internal dashboard for running the label: roster, catalog, royalties, payouts,
expenses, and team access. React + Vite, with Supabase for shared data and
email-link sign-in.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # finance baseline
```

## Deploying

Vercel project `label-backend` is linked to the GitHub repo: every push to
`main` builds and goes live at https://ops.imssrecords.com. Supabase env vars
are set in Vercel. `vercel.json` sets security and cache headers; Vercel
handles HTTPS.

## Backend (Supabase)

- `.env.local` holds `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
  (both public). Without them the app runs on localStorage as before.
- Data: one table `app_data` (`key` = section name, `value` = jsonb), behind
  `window.storage` in `src/storage.js`.
- Access: row-level security lets a signed-in user read/write only if their
  email is on the `staff` list (`is_team_member()`). Role permissions are still
  enforced in the app, not the database.
- Sign-in: `src/AuthGate.jsx` (email link). The signed-in email picks the staff
  record; there is no name picker in Supabase mode.
- With Supabase, a `DATA_VERSION` bump does **not** reseed; only an empty
  database gets seed data. Shape changes need a migration of `app_data`.
- Production builds leave the real roster/catalog/revenue/master gross out of
  the JS bundle (`OMIT_REAL_DATA` in `seed.js`).

## Where things live

| File | What's in it | Size |
|---|---|---|
| `src/App.jsx` | Every screen component + the root `RecordLabelDashboard` | ~5.9k lines |
| `src/finance.js` | The finance engine — all money math | ~120 lines |
| `src/seed.js` | Seed data (real roster, catalog, revenue, master gross) | ~820 lines |
| `src/constants.js` | Domain constants, roles/permissions, formatters | ~425 lines |
| `src/ui.jsx` | Shared primitives: `Btn`, `Field`, `Input`, `Th`/`Td`, `KPICard`, `ExportBar` | ~190 lines |
| `src/theme.js` | Colour tokens (`C`), fonts, `GLOBAL_STYLES` | ~125 lines |
| `src/storage.js` | `window.storage` adapter: Supabase or localStorage | ~45 lines |
| `src/AuthGate.jsx` | Email-link sign-in screen | ~70 lines |

`App.jsx` is still large. When you touch a screen, consider lifting that one
component into `src/sections/` rather than refactoring the whole file at once.

## The finance model

`src/finance.js` is the single source of truth for every figure on screen. It
implements a written spec — five collections, computed on read, never stored:

- **`artists`** — roster, each with `artistPct` (their share of net royalties)
- **`revenue`** — one row per track per month, id `${slug(artist)}_${slug(title)}_${month}`
- **`masterGross`** — one row per calendar month: `totalGross` received, `swiftFee` charged
- **`ledger`** — non-royalty income/expense, with `recoupable` + `artist` for advances
- **`payouts`** — generated statements

The one non-obvious rule: **the swift fee is split proportionally**, not evenly.

```
swiftShare(artist, month) = swiftFee[month] × revByArtistMonth[artist][month] / revByMonth[month]
```

Then `net = gross − swift`, `artistShare = net × artistPct`, `labelShare = net × (1 − artistPct)`.

`untrackedGap = totalGross − trackedGross` is a **reconciliation flag, not an
error** — it's money the distributor paid that has no matching revenue row yet.
Don't "fix" it by adjusting figures.

Money math stays in floating dollars throughout; round only at display time.

### Verified baseline

Against the current seed data these must hold. If a change moves them, the
change is wrong unless you meant it:

| Figure | Value |
|---|---|
| Total gross (33 months) | $13,256.50 |
| Total swift fees | $840.00 |
| Tracked gross | $9,812.20 |
| Artist earnings | $6,627.13 |
| Label earnings | $2,345.07 |
| Untracked gap | $3,444.30 |

## Access control

Two axes: **role** and **per-person permissions** (`src/constants.js`).

- `permissionsFor(staff)` is the only correct way to read someone's access.
  Never read `staff.permissions` directly — it misses the Admin override and
  the legacy-key migration.
- **Admin** is the top role: `isTopRole()`. Its access is fixed at full and
  cannot be edited by anyone, including itself.
- **Legal** has Admin-level reach but its access changes are *proposals*. They
  queue in `accessRequests` and only apply when an Admin approves. Legal cannot
  edit an Admin at all.
- `royalties` (what artists earn) and `spend` (budgets/expenses) are separate
  permissions. A Product Manager gets `spend` but not `royalties`, and their
  Ledger is scoped to their own artists via `pmScope`.

If you add a screen that shows money, gate it on the right one of those two.

## Conventions that matter

- **Styling is inline `style={{}}` plus Tailwind utility classes.** Layout
  classes prefixed `imss-` are defined in `GLOBAL_STYLES` in `theme.js`, not
  Tailwind. Responsive variants (`md:`, `sm:`, `lg:`) are deliberately unused —
  breakpoints live in `GLOBAL_STYLES` media queries instead.
- **The app shell fills the viewport** (`100dvh`) and scrolls in exactly one
  place: `.imss-content`. Don't add a second scroll container.
- **`DATA_VERSION`** in `seed.js` gates reseeding. Bump it when the data shape
  changes; leave it alone for pure UI edits, or you'll wipe saved data.
- **Period filters require an explicit Generate click.** In the artist portal
  nothing renders until then; on team screens the period applies on Generate
  while search stays live.

## Data

Seed data is the real roster — 14 artists, 87 tracks, 596 revenue rows,
33 months of master gross, pulled from the Ledger & Royalties source. `ledger`
and `payouts` are intentionally empty; nothing was recorded there.

Artists have no `productManager` assigned yet, so PM scoping shows an empty
roster until you set one on each artist.
