# IMSS Records — Label Operations Dashboard
## Product Specification

Build a single-page web app for running an independent record label: artist
roster, release catalog, royalty accounting, payout statements, expense and
recoupment tracking, and team access control.

**Stack:** React 18 + Vite, hosted on Vercel at https://ops.imssrecords.com.
Data and sign-in live in Supabase. All state goes through one async key/value
adapter (`window.storage`): the Supabase `app_data` table when configured,
the browser's localStorage otherwise (local development only).

**Dependencies:** `react`, `react-dom`, `@supabase/supabase-js` (data and
sign-in), `recharts` (charts), `lucide-react` (icons), `papaparse` (CSV
import), `xlsx` (Excel export, SheetJS CDN build), `tailwindcss`.

**Email** goes through Resend from `noreply@imssrecords.com`:
- An artist's PM, A&R and every Admin are emailed when that artist sends a
  request, release submission or invoice, or replies on a thread.
- Artists are emailed when the label replies to their request or submission,
  and when a royalty statement is sent to them.
- Replies to those emails land in the matching thread in the app (marked
  "by email"); a submission goes back to Waiting review when the artist
  replies.
- Payouts: each statement has **Send to artist** (now) or **Schedule** (a date
  and time; sent within 10 minutes of it). Artists only see statements that
  were sent or paid.

---

## 1. Who uses it

Everyone signs in with an emailed link; there are no passwords. The email
decides which door opens:

- an email on the **Team** list opens the team side, with that staff record's
  role and permissions;
- an email on an artist's **Roster** entry opens that artist's portal;
- any other email sees a "not set up yet" message and nothing else.

An Admin can send anyone their sign-in link from the Team or Roster screen.

**Team side** — label staff. What they see depends on their role and
permissions.

**Artist portal** — an artist sees only their own revenue, payouts, statements,
releases, and profile.

---

## 2. Access model

Access has two axes: a **role**, and a set of **per-person permissions** an
Admin ticks.

### Permissions

| Key | Label | Grants |
|---|---|---|
| `analytics` | Analytics | Overview, Streams, Release Calendar |
| `roster` | Roster | Artist roster |
| `catalog` | Catalog | Catalog and CSV import |
| `royalties` | Artist earnings | Revenue, Master Gross, Payouts, Statements — **what artists earn** |
| `spend` | Budgets & expenses | Budgets, Ledger, per-artist spend |
| `notices` | Noticeboard | Post announcements to artist dashboards |
| `edits` | Can edit | Add/edit/delete within whatever they can see |

`royalties` and `spend` **must be separate**. The whole point is that a Product
Manager can see what an artist *costs* without seeing what they *earn*.

### Roles and their defaults

| Role | royalties | spend | analytics | roster | catalog | notices | edits |
|---|---|---|---|---|---|---|---|
| **Admin** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Legal** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Finance** | ✓ | ✓ | ✓ | — | — | — | ✓ |
| **Product Manager** | — | ✓ | ✓ | ✓ | ✓ | — | ✓ |
| **A&R / Label Manager** | — | — | ✓ | ✓ | ✓ | — | ✓ |
| **Marketing** | — | — | ✓ | — | ✓ | ✓ | — |
| **Other** | — | — | ✓ | — | — | — | — |

### Rank rules

- **Admin is the highest role.** Its access is fixed at full and cannot be
  edited by anyone, including another Admin. (Prevents lockout.)
- **Legal** has Admin-level reach — same screens, same data — but when Legal
  changes anyone's role or permissions, the change **does not apply**. It
  queues as a proposal for an Admin to approve.
- **Legal cannot edit an Admin at all.** The permission checkboxes are disabled
  with a note explaining why, and the save path refuses it too (don't rely on
  the disabled UI alone).
- An Admin editing Legal works normally and applies immediately. Legal's
  permissions are real stored data, not a hard-coded constant.

Provide a single function `permissionsFor(staff)` as the **only** way to read
someone's access. It applies the Admin override and falls back to role
defaults. Nothing should read `staff.permissions` directly.

### Product Manager scoping

A PM manages specific artists (`artist.productManager` matches their name).
When a PM is signed in:

- Roster shows only their artists.
- The Ledger shows only entries tied to their artists — no company overhead,
  no other PM's roster.
- The label-wide Budget screen is hidden entirely (it's company-level).
- **Overview must contain no money at all.** The hero card shows Total streams
  instead of Total revenue, and the revenue chart, top-artists-by-revenue,
  top-songs, label finance snapshot, and genre/market revenue panels are all
  hidden. This is easy to get wrong — `analytics` grants Overview, so the
  money panels need gating on `royalties` specifically.

---

## 3. Finance model

This is the heart of the product. Five collections. **Everything is computed on
read — never stored.** All money is floating dollars; round only at display.

### Collections

**`artists`** — keyed by slug of name
| field | type | notes |
|---|---|---|
| name | string | display name |
| artistPct | number | artist's share of net royalties, e.g. `0.75` |
| distroLabel | string | usually "IMSS Records" |
| notes | string | |

Label's share = `1 - artistPct`.

**`revenue`** — one row per track per month. Id = `${slug(artist)}_${slug(title)}_${month}`
| field | type |
|---|---|
| artist, artistSlug, title | string |
| month | `"YYYY-MM"` |
| earning | number — gross royalty for that track that month |
| type | string, e.g. "Single", "EP Track", "Album Track" |
| epAlbum | string \| null — parent release |
| releaseDate | `"YYYY-MM-DD"` \| null |

**`masterGross`** — one row per calendar month, company-wide. Id = month
| field | type |
|---|---|
| month | `"YYYY-MM"` |
| totalGross | number — what the label actually received from the distributor, across **all** artists, tracked or not |
| swiftFee | number — the distributor's fee for that month |

**`ledger`** — non-royalty income/expense and recoupment
| field | type |
|---|---|
| date | `"YYYY-MM-DD"` |
| type | `"income"` \| `"expense"` |
| category | string, e.g. Advance, Marketing, Studio |
| description | string |
| amount | number, always positive |
| artist | string \| null |
| recoupable | boolean |

**`payouts`** — saved statements: artist, artistSlug, periodStart, periodEnd,
grossEarning, swiftShare, netAfterSwift, artistPct, artistShare, labelShare,
status (`"draft"` \| `"paid"`), createdAt, notes.

### Slug convention

```
slug(s) = lowercase(s).trim() → runs of non-alphanumeric → "-" → strip leading/trailing "-"
```

Months are `"YYYY-MM"` strings that compare correctly with plain `<` and `>`.

### The formulas

**Monthly aggregates**
```
revByMonth[month]                = sum of revenue.earning for that month, all artists
revByArtistMonth[artist][month]  = sum of revenue.earning for that artist that month
```

**Swift fee — split proportionally, not evenly.** This is the one rule that's
easy to get wrong:
```
swiftShare(artist, month) =
    masterGross[month].swiftFee × revByArtistMonth[artist][month] / max(masterGross[month].totalGross, revByMonth[month])

= 0 if there's no masterGross row for that month, or the base is 0.
  The base is the money received, so an artist imported before the others
  never carries the whole charge; the charge on unmatched money stays with the label.
```

**Artist lifetime** (over every month that artist has revenue)
```
gross       = Σ revByArtistMonth[artist][m]
swift       = Σ swiftShare(artist, m)
net         = gross - swift
artistShare = net × artistPct
labelShare  = net × (1 - artistPct)
```

**Company-wide**
```
totalGross   = Σ masterGross[*].totalGross
totalSwift   = Σ masterGross[*].swiftFee
totalNet     = totalGross - totalSwift
trackedGross = Σ artistLifetime(a).gross  over all artists
artistEarn   = Σ artistLifetime(a).artistShare
labelEarn    = Σ artistLifetime(a).labelShare
untrackedGap = totalGross - trackedGross
```

`untrackedGap` is **a reconciliation flag, not an error**. It's money the
distributor paid that has no matching revenue row yet. Surface it; never
auto-correct it.

**Ledger totals**
```
income  = Σ amount where type = 'income'
expense = Σ amount where type = 'expense'
net     = income - expense
```

**Recoupment, per artist**
```
spent    = Σ ledger.amount where type='expense' AND recoupable AND artist = name
earned   = artistLifetime(artist).artistShare
recouped = min(spent, earned)
balance  = spent - earned        // > 0 → still unrecouped; <= 0 → due the difference
```
Recoupment applies **only** when the entry is an expense, is marked recoupable,
and names an artist. A general company expense must never reduce an artist's
balance.

**Payout statement for an arbitrary period** — same as lifetime, but over every
month from `periodStart` to `periodEnd` inclusive.

**Label P&L (all-time)**
```
netProfit = labelEarn + ledger.income - ledger.expense
```

### Approval gate

Revenue and ledger entries submitted by non-Admins get
`approvalStatus: 'Pending'`; Admins' entries are auto-approved.

**Every aggregate figure must compute from approved-only data.** The management
screens (Revenue, Ledger) show pending rows so they can be approved, but
Overview, Master Gross reconciliation, Payouts, Statements, the roster detail
panel and the artist portal all consume the approved subset. Mixing these
produces numbers that disagree between screens.

---

## 4. Screens

### Sign-in gate
One field: email, then "Email me a sign-in link". The link returns to the app
already signed in. Without Supabase configured (local development) the old
name picker appears instead, labelled as a view split, not real auth.

### Team side

Sidebar nav, grouped. Items appear only if the person's permissions allow.

**Analytics**
- **Overview** — date-range filter with a Generate button (see §5); KPI row;
  revenue-by-month bar chart; streams-by-platform donut; top artists by revenue
  and by streams; top songs; label finance snapshot (distributor gross, swift
  fees, artist share, label share, untracked gap); top genres and markets.
  All money panels gate on `royalties`.
- **Streams** — stream counts by platform and release, with a leaderboard.

**Artists & Catalog**
- **Roster** — grid/table of artists with filters. Clicking one opens a detail
  panel: contacts and dates, alerts (contract/licence expiry, unrecouped
  balance), team notes, revenue-by-month chart, releases, annual budget,
  recent expenses, payout history. Earnings panels gate on `royalties`,
  spend panels on `spend`.
- **Artist Requests** — requests artists raised from the portal, with responses.
- **Submissions** — artist release submissions for anyone with `catalog`
  (PMs see only their artists). Tabs: Waiting review, Needs info, Accepted,
  Rejected. Each row shows how complete it is (12 checks: date, artwork,
  splits ≤100%, split % for features/producers/songwriters, signed split
  sheet, confirmation, written/produced credits, duration, explicit, lyrics,
  required docs). Review shows the checks, splits, split sheet, credits and the
  message thread. Actions: **Accept to catalog** (opens the Catalog release
  form pre-filled for the PM to add UPC, ISRCs and the rest; the submission
  only becomes Accepted when that release is saved), **Request more info**
  (message to the artist, status Needs info), **Email artist** (opens the
  reviewer's email with the message pre-written), **Reject** (with a reason).
- **Catalog** — releases with artwork, type, dates, ISRC/UPC, status, licence
  expiry, a production checklist and distribution-doc checklist. Grid, table
  and pipeline views. A banner links to Submissions when any are waiting.
- **Release Calendar** — month grid with releases, task due dates, expiries.
- **Import** — CSV import of distributor statements (§6).

**Finance**
- **Revenue** — one row per track per month. CRUD, filters (month range with
  Generate, artist, search), approve/reject pending rows, CSV export.
- **Money received** (the `masterGross` collection, shown as "Money received")
  — one row per month: money that actually landed in the bank, swift fee, net,
  and tracked revenue with the variance. KPI row showing total gross, total
  swift, tracked gross and untracked gap. Default swift fee setting.
- **Ledger** — non-royalty income and expenses. Filters by type and artist.
  Recoupment-status table per artist (spent / earned / balance). PM-scoped.
- **Budget** — label-wide category allocations vs actual spend. Hidden for PMs.
- **Invoices** — artists' expense claims and service invoices move through an
  approval pipeline: **Submitted → PM Approval → Finance Queue → LH Queue → DP
  Queue → Pay Approved → Paid**. PM Approval goes to the artist's Product
  Manager (from the Roster); an Admin assigns one or more people to Finance,
  LH, DP and Pay Approved in the **Workflow** panel (stored in
  `labelSettings.invoiceWorkflow`). At each stage the assigned reviewer (or any
  Admin) can **Approve** (next stage), **Send back** to the previous stage, or
  **Reject**; send back and reject need a note. Pay Approved's action is
  **Mark paid**. Tabs: My queue, each stage, Paid, Rejected, All. Every step is
  recorded in the invoice's history, and the people for the next stage are
  emailed. Anyone assigned to a queue sees Invoices even without the `spend`
  permission. Artists see "In review · step N of 7", "Approved for payment",
  "Paid" or "Rejected" with the reason, and are emailed when it's paid or
  rejected.
- **Payouts** — pick artist + period → generates a statement live from the
  formulas; save as draft or mark paid. Label P&L KPIs. Recoupment table.
- **Statements** — pick an artist, choose a period, Generate → month-by-month
  statement with per-track breakdown, CSV export and print/PDF.

**Team**
- **Team** — staff profiles, roles, the permission checkboxes, onboarding
  checklists. Admin/Legal only.
  Staff work emails must end in **@imullar.com** (or **@imssrecords.com**, for
  the planned move); an existing address that isn't changed keeps working.
- **Access Requests** — queue of permission changes Legal proposed, each
  showing a from → to diff per changed field. Admin approves or rejects;
  approving is what applies the change. Legal sees status only.
- **Tasks**, **Noticeboard**, **Activity Log**.

**System**
- **Backup & Restore** — export the whole dataset as JSON, reimport it.

### Artist portal

Built around what the artist is owed. Sidebar navigation (a swipeable strip on
phones) in two groups — **Money:** Dashboard, Royalties, Earnings, Expenses,
Invoices, Statements, Payouts, Budget (funded artists only); **Music & you:**
Releases, Requests (with an open count), Profile — and Sign out.

- **Dashboard** (home, where artists land) — "You're owed" balance with the
  arithmetic beside it (always all time: gross − Inbound Banking Charge − label
  share = their earnings − recouped − paid = owed), approved invoices waiting to
  be paid, and notices. Then a **date selection** (From / To month and Update,
  plus Last 3 months, Last 6 months, This year, All time; default last 6
  months of their data) that scopes everything below it: songs released (with
  a breakdown by type), top earning retailer, best month, **top songs by
  revenue** (top 5 with gross and their earnings, each with the artist, any
  extra primary artists and "feat." names from the release's collaborators;
  tap one to open it in Royalties), and **top earning retailers**. Streams by
  platform appears when there is stream data.
- **Royalties** — song by song: period + type + product filters, **Generate** → their
  rows with gross, Inbound Banking Charge, label share and their earnings per
  row and in total; groupable flat / by type / by product, with export.
- **Earnings** — what they made in total each month: gross, Inbound Banking
  Charge, label share, their earnings and a running total, with a chart and
  export.
- **Expenses** — money spent on their career in both directions: **paid by the
  label** (ledger expenses, marked recoupable or label cost) and **paid by
  them** (their expense-claim invoices and whether each was paid back).
- **Invoices** — submit an invoice (expense claim or services / fee) with
  description, amount in USD, date, number, pay-to name, details and a receipt
  or invoice file (PDF or photo, up to 2 MB); see each one's status (Pending,
  Approved, Paid, Rejected) and the label's note. Approved invoices are owed
  separately from royalties; they don't change the royalty balance.
- **Statements** — period chooser, **Generate** → the statement.
- **Payouts** — earnings accrued, unrecouped balance, paid to date, balance
  due, and payout history.
- **Releases** — their catalog, plus a form to submit a new release (title,
  type, splits, track metadata, credits, lyrics or "Instrumental", an "about
  the song or project" note of up to 700 characters, a marketing and rollout
  plan, a distribution-doc checklist)
  which goes to their PM for review. **Splits are required:** every featured
  artist, producer, songwriter and co-writer taking a share is listed with
  their split %, the artist keeps the remainder (total can't exceed 100%), a
  **signed split sheet** (PDF or photo, up to 2 MB) must be uploaded, and the
  artist confirms everyone listed signed it. The team sees the splits and can
  download the split sheet in the Catalog review queue; both carry over onto
  the release. Their submissions list shows each status and the message thread
  with the label; when the label asks for more info they reply there, which
  sends it back to Waiting review.
- **Requests** — raise a request by category; see responses.
- **Profile** — request changes to photo, bio, email; goes to PM for approval.

Artists only ever receive their own data from the database, with each month's
Inbound Banking Charge already cut to their share, so label-wide totals never
reach an artist's browser.

---

## 5. Behaviors that matter

**Generate gates.** Anywhere a period is chosen, there is a Generate button.

- In the **artist portal**, nothing renders until they press it — Revenue and
  Statements both open on a prompt ("Pick a period, then generate"). The
  artist asks a question; the app answers it.
- On **team screens**, the period applies on Generate while other filters
  (search, artist, product) stay live. These default to all-time so an admin
  never lands on a blank dashboard.
- Validate the range and refuse a backwards one with a clear message. Bound
  month inputs to the artist's actual earning window. After the first run the
  button reads "Regenerate", with a Clear beside it.
- Statement totals must be **summed from the rows displayed**, so the headline
  figures always reconcile against the breakdown beneath them.

**Approval workflows.** Three of them, all the same shape — submit → pending →
reviewer approves/rejects:
1. Revenue and ledger entries from non-Admins.
2. Artist profile-change requests → their PM or an Admin.
3. Legal's access changes → an Admin.

Surface pending counts in the top-bar notification bell.

**Data versioning.** A `DATA_VERSION` constant gates reseeding. On load, if the
stored version differs, reseed from the seed data and write the new version.
Bump it when the data shape changes; leave it alone for UI-only edits, or
you'll wipe saved data.

**Export.** CSV and Excel export on the data-heavy tables, and a print/PDF path
for statements that hides the chrome.

---

## 6. CSV import

Imported revenue rows also record how much each retailer paid (`stores`, e.g.
`{ "Spotify": 12.30 }`); the artist Dashboard's retailer figures come from
this. Revenue recorded before this was added has no retailer split.


Three modes:

0. **EMPIRE detailed royalty report** (`src/empire.js`,
   `src/sections/EmpireImport.jsx`). Figures are the artist's **gross**, not
   money received. Revenue is booked under the **Statement Date** (when IMSS
   received it) using unrounded "Net (Raw)"; the Approx. Sales Date (when EMPIRE
   collected it) is kept as `salesMonths` detail. Each song-month also keeps
   `stores`, `countries`, `types`, `typeQty`, `models`, `isrc`, `upc`. The
   preview checks the file's Totals row and each month against Money received;
   re-importing a month replaces it. The original file is saved on each
   artist's profile (`statementFiles`) and downloadable from the team artist
   panel and the portal Statements tab. Artists see Royalties grouped by song,
   release type, platform, country, format, model or month earned; rows without
   detail show last as "Not broken down (older statements)".
1. **Per-product detail report** — each row is one product's earnings
   (DistroKid/CD Baby/TuneCore style). Auto-detect column meanings from header
   aliases, let the user correct the mapping, match rows to existing artists and
   releases by ISRC → UPC → title, and let them resolve unmatched ones (pick an
   existing release, create a new one, or skip).
2. **Store breakdown for one product** — each row is one store's total for a
   single track (EMPIRE style). Extract the pivot table, confirm the artist,
   title and period.

Both commit into `revenue` **aggregated to one row per track per month** —
multiple store rows for the same track and month sum into a single entry,
keyed by the standard id. Carry `type` and `releaseDate` over from the
existing catalog entry.

---

## 6b. Publishing to artists

Imports and edits stay internal. **Publish to artists** (Finance) lists every
artist-month where the books differ from what artists see (not published yet,
changed since publish, removed). Publish selected artist-months or all of them.
Finance's publishes go to an Admin to approve unless an Admin has ticked "Let
Finance publish without Admin approval"; Admins publish directly. Publishing
copies the live rows into `publishedRevenue` and logs it in `revenuePublish`;
artists get an email naming their months. Existing data was published as-is
when this was introduced.

A publish can be scheduled ("Publish at"): it saves the rows as they are then,
and the 10-minute job in the notify function swaps them in at that time and
emails the artists. Scheduled publishes can be published early or cancelled.
Finance can request a time; the Admin's approval keeps it.

All money is worked out on the team side. Publishing saves each row's final
figures (`swiftShare` charge, `artistPct`, `artistShare`, `final: true`); the
artist portal and its downloads show those as stored and never recompute them
(`isFinal` in `finance.js`). A changed charge or % shows as "changed since
publish" until it's republished.

Before any publish, request approval or Admin approval, `publishChecks`
recomputes every artist-month's charge from the raw figures. It **blocks** on
a charge that doesn't match, a charge above the gross, a month's charges
exceeding its fee, or a missing/invalid artist %; it **warns** when a month
has no Money received or imported revenue exceeds money received.

Artists see only published or sent accounting: revenue and statement files
from the published snapshot, payout statements once sent (paid or not), and
approved expenses dated up to their latest published month.

## 6c. Reporting schedule and payout threshold

Each Roster entry has `reportingPeriod` (monthly, quarterly, half-yearly;
default quarterly), `deliveryDays` (statement due this many days after the
cutoff; default 30 monthly, 90 otherwise) and `payoutThreshold` (USD).
Cutoffs are calendar month ends: quarterly 31 Mar / 30 Jun / 30 Sep / 31 Dec.
Payouts lists each artist's last closed period, its due date and status, with
Prepare to fill the form. A statement under the threshold is still generated
and sent, marked "carried forward"; its balance (`carriedOut`) is added to the
artist's next statement (`carriedIn`). Artists see their schedule and threshold
on their Statements tab. Logic: `reportingTerms`, `lastClosedPeriod`,
`applyThreshold` in `finance.js`.

## 6d. Carried-forward payments

EMPIRE pays only once a balance reaches $300; smaller months are carried
forward and paid together. A Money received entry can cover several statement
months (`periodStart` to `month`), entered once as on the remittance sheet. For
all money math the app spreads that payment and its single Inbound Banking
Charge across the covered months by what each earned (`expandRemittances` in
`finance.js`); the Money received screen keeps the entry as typed.

## 6e. Deal changes

An artist keeps one account. Their split (artist % / label %), funding tier and
deal are a dated history (`dealTerms`), changed only through **Deal changes**
(Royalties menu, and the Deal section on each artist's profile): the month it
starts, the new split, funding and deal, a required note and an optional signed
agreement. Admin or Legal records a change; it applies when an Admin approves
(an Admin's own entry applies at once). It must start after the last month
already published to that artist and not before their latest terms. Every
money calculation uses the terms in force for that revenue month (`termsAt` /
`pctAt` in `finance.js`). The Roster edit form shows split, funding and deal
read-only; reporting period and payout threshold stay ordinary profile settings.

## 6f. Notifications and activity

**Notifications:** every email the platform sends also lands in the recipient's
bell (team top bar; artist sidebar and phone header), with unread count, mark
as read, and a click through to the right screen. "Needs your attention" stays
as the live to-do list.

**Activity** (Team → Activity, Admin and Legal): a permanent log of sign-ins,
CSV/Excel exports, statement and partner-copy downloads, artist submissions,
requests, invoices and replies, publishing, deal changes, imports, invoice
decisions, payouts and every team edit, plus scheduled jobs as "Scheduler".
Filter by person, type and artist; export to CSV.

## 6g. Recoupment

Everything spent on an artist is recouped from their earnings before payouts:
every label expense recorded against them, and their own expense claims once
approved for payment (Pay Approved or Paid). Service/fee invoices are payment
for work and are not recouped. Label costs with no artist are not recouped.

## 7. Look and layout

Dark, warm, exact — not a generic admin template. The full visual system
(colours, type, components, rules) lives in **DESIGN.md**; this section keeps
only the product-level commitments:

- Every amount in a mono face with aligned digits; artists see cents.
- The app shell fills the viewport and scrolls in exactly one place.
- Whenever an artist sees a total, the arithmetic behind it is shown.
- On screen, the distributor's swift fee is always called the
  **Inbound Banking Charge** (the code and data keep `swiftFee`).
- Empty states everywhere, with a sentence saying what will fill them.

---

## 8. Seed data

Ship with real-shaped seed data so the app is explorable on first run: a roster
of ~14 artists with varying splits (0.70 / 0.75 / 0.80), a catalog derived from
the revenue history (one release per distinct track, carrying its own type and
release date), ~600 monthly revenue rows spanning ~2.5 years, and ~33 months of
master gross with varying swift fees.

The real data already carries a large `untrackedGap` ($3,444.30 of $13,256.50
gross), so reconciliation is visible on first run without inventing anything.
Every revenue month in it *does* have a master gross row, so the
`swiftShare = 0` branch (no `masterGross` row for a month) is never exercised by
the seed — cover it with a unit test rather than by adding a fake month, which
would move the totals the acceptance check below pins.

Leave `ledger` and `payouts` empty unless there's real data for them — don't
invent expenses.

### Acceptance check

Build a small script that computes the company totals straight from the
formulas in §3 and compares them to what the app displays. They must match to
the cent. That one test catches most of the ways this can go wrong.

---

## 9. Build order

1. Theme, layout shell, UI primitives (buttons, fields, tables, cards).
2. Data model, storage adapter, seeding and `DATA_VERSION`.
3. **The finance engine as pure functions, with the acceptance check from §8
   passing, before any finance UI exists.** Everything downstream depends on it.
4. Roster, catalog, revenue, master gross.
5. Ledger, budgets, payouts, statements.
6. Permissions and roles; then the Legal → Admin approval queue.
7. Artist portal.
8. CSV import.
9. Export, backup/restore, print.
