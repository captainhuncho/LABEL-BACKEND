# Database

Supabase project `cdyjxhtmsugxemfcllhh` (Postgres). How the data is laid out,
who can reach it, and the rules for changing it. Security detail is in
SECURITY.md; money rules are in AGENTS.md ("The finance model").

## Layout

Almost everything is one table, `public.app_data`: one row per **section**
(`key`), the whole section as `value` (jsonb, usually an array of objects).
The app reads and saves a whole section at a time through `window.storage`
(`src/storage.js`). A save only succeeds if `updated_at` still matches what the
tab loaded, so an old tab can't overwrite newer work; the server sets
`updated_at` on every change (`private.app_data_touch`).

| Section | What it holds | Notes |
|---|---|---|
| `roster` | Artists: name, email (their sign-in), `artistPct`, deal terms, `productManager` (a staff **name**), `labelRep` (a staff **id**), status | Deal terms change only through an Admin |
| `staff` | Team members and label reps: name, email, role, `permissions`, status | Role, access, email and status: Admin only |
| `catalog` | Songs and releases, by `artistId` | |
| `revenue` | Live royalty rows, one per track per month (`${slug(artist)}_${slug(title)}_${month}`) | Team books; artists never see these |
| `masterGross` | One row per month: `totalGross`, `swiftFee` | |
| `publishedRevenue` | Snapshot of revenue rows artists can see, with `swiftShare` fixed | Written by Publish only |
| `revenuePublish` | Publish requests and their approvals or schedules | |
| `payouts` | Statements | |
| `ledger` | Non-royalty income and expenses (`overheadId`, `categoryId` for budgets) | |
| `overheads` | Budgets (artist or label), categories, status | |
| `invoices` | Artist expense claims and service invoices, with `history` and `messages` | Artists add through `artist_add` |
| `releaseSubmissions`, `artistRequests`, `profileRequests` | Things artists send in | Artists add through `artist_add` |
| `dealChanges` | Deal and license changes, proposals and approvals | |
| `statementFiles` | Statement PDFs, stored in the `statements` bucket | |
| `notices`, `tasks`, `streams`, `labelBudgets`, `accessRequests`, `activityLog`, `labelSettings`, `dataVersion` | Smaller sections | `labelSettings` is an object |

Other tables:

- `public.audit_log`: append-only activity log (`log_activity()`); Admin and Legal read it.
- `public.notifications`: bell notifications; each person reads their own.
- `private.app_data_archive`: backups (daily `auto-YYYY-MM-DD` at 02:30 UTC, kept 30 days, plus named snapshots taken before risky changes).
- `private.client_errors`: browser errors (`log_client_error()`), kept 30 days; Admin sees them on Backup & Restore.
- `private.blocked_signins`, `private.signin_watch`, `private.signin_notice_last`, `private.artist_actions` (rate limits), `private.config` (notify URL and secret).

Storage buckets (private): `documents` and `statements`, foldered by artist id.

## Who reaches what

| Who | How | Sees |
|---|---|---|
| Team (on `staff`, not a Label Rep, second step done) | `app_data` directly, under row-level security plus the write rules trigger | Sections their permissions allow |
| Artist (email on a roster entry) | `artist_portal()`, `artist_add()`, `artist_resubmit_invoice()`, `artist_reply_*()`, `artist_update_profile()` | Only their own rows, published money only |
| Label rep (`role = 'Label Rep'`) | `rep_portal()`, `rep_mark_sent()` | Only their artists' releases and invoices sent to them |
| `notify` edge function | Service role | Everything; sends email and bell notifications |
| Cron | `auto-backup`, `send-due-statements`, cleanups | |

`my_access()` decides team, rep or artist at sign-in. Internal helpers
(`section()`, `my_artist()`, `js_slug()`, everything in `private`) have no API
access.

## Events

A trigger on `app_data` (`private.app_data_events`) compares old and new
values and posts small event descriptors to the `notify` function: new
submissions, invoice stage changes, published earnings, sent statements, deal
changes, notices, budgets sent, rep releases and invoices.

## Rules for changes

- Shape changes need a migration of `app_data`; bumping `DATA_VERSION` no
  longer reseeds a live database.
- New functions: `security definer`, `set search_path = ''`, then grant
  `execute` to `authenticated` only if the app calls it.
- A function that writes a protected section as a signed-in user needs its own
  exemption in `private.app_data_write_rules`.
- Patch existing functions in place (`pg_get_functiondef` + `replace` with an
  anchor check) and dry-run in a rolled-back transaction with
  `set_config('request.jwt.claims', …)` for each role before applying.
- Migrations live in `supabase/migrations/`, named by date.
