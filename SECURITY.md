# Security

How the IMSS Records dashboard protects the label's and artists' data, what it
does not protect yet, and how to report a problem.

## Reporting a problem

Email **maxwelladjavon@gmail.com** with what you found and how to reproduce it.
Please don't open a public issue or share details elsewhere until it's fixed.

## Where things run

| Piece | Service | Notes |
|---|---|---|
| Web app | Vercel, project `label-backend` | Static build; deploys on every push to `main` |
| Domain | `ops.imssrecords.com` | DNS at hosting.com, CNAME to Vercel; HTTPS by Vercel |
| Data and sign-in | Supabase project `LABEL-BACKEND` (`cdyjxhtmsugxemfcllhh`, eu-west-1) | One table, `public.app_data` |
| Sign-in email | Resend, sender `noreply@imssrecords.com` | Supabase sends through Resend SMTP |
| Code | GitHub `captainhuncho/LABEL-BACKEND` | **Private** — it contains real roster and revenue data |

## Sign-in

- No passwords. People sign in with Google or a one-time code emailed to them
  (Supabase Auth, sent through Resend).
- Invite only, enforced in the database: an account can only be created for an
  email on the Team list or an artist's Roster entry (`private.is_invited`, the
  Before User Created hook). Removing or archiving someone deletes their
  sign-in account.
- Second step: team members must pass a passkey or authenticator app
  (`private.second_factor_ok()`, AAL2) before the database lets them read or
  write anything; artists need it for the portal and confirm again before
  invoices and profile changes.
- Redirects return only to URLs on Supabase's Redirect URL allow-list
  (`https://ops.imssrecords.com`, `https://artist.imssrecords.com`,
  `https://label-backend.vercel.app`, `http://localhost:5173`). Add new hosts
  there, never a wildcard.
- Every new sign-in sends the person a "New sign-in" email. Admin or the
  artist's Product Manager can end all of an artist's sessions ("Sign out
  everywhere"); Admin can for team members. Open tabs notice within a minute.

## Data access (enforced in the database)

- `app_data` has row-level security on. Signed-out visitors can't read or write
  anything.
- **Team:** a signed-in user whose email is on the `staff` list and who
  passed the second step (`is_team_member()`) can read and write sections
  according to the same permissions as the app's screens (`private.my_perm`
  mirrors `permissionsFor()`):
  - Reading: revenue, money received (`masterGross`), payouts, published
    earnings, publish requests and statement files need **Artist earnings**;
    the ledger, budgets (`overheads`) and label budgets need **Budgets &
    expenses** (`can_read_section()` in the read policy). Hidden sections load
    as empty in the app.
  - Writing (`private.app_data_write_rules` trigger): the same sections also
    need **Can edit**. `publishedRevenue` (what artists see) is Admin only, or
    Artist earnings + Can edit when an Admin has turned on direct publishing
    (refreshing per-store streams is allowed with Artist earnings + Can edit).
    `labelSettings` needs Artist earnings + Can edit; its invoice workflow and
    direct-publishing switch are Admin only. `dealChanges` is written by Admin
    and Legal only.
  - `staff`: only an Admin can add or remove members or change anyone's role,
    access, `canApproveBudgets`, sign-in email or Archived/Inactive status.
    Others can edit profile fields. Legal's access changes go through
    `accessRequests` for an Admin to approve.
  - Deal privacy: the real `roster` and `dealChanges` are readable only by
    Admin, Finance, Legal and anyone with Artist earnings
    (`private.can_see_deals()`). Everyone else reads `rosterPublic`, the roster
    without deal fields (`private.deal_fields()`), kept in step by a trigger;
    when they save it, the database merges it back and keeps every existing
    artist's deal fields as they were.
  - `roster`: an existing artist's deal terms (share, funding tier and type,
    contract type, license years, effective date, reporting period, payout
    threshold, no-extension) change only through an Admin, i.e. an approved
    Deal change. A new artist can be added with starting terms.
  The notify function, cron jobs and migrations are not affected; a
  security-definer RPC called by a signed-in user is.
- **Artists** never read `app_data` directly. `artist_portal()` returns only
  their own catalog, revenue, payouts, expenses and requests, with each month's
  Inbound Banking Charge pre-split to their share, so label-wide totals never
  reach their browser. `artist_add()` lets them add a profile change, request, release submission
  or invoice only; it forces the item's `artistId` to theirs and resets any
  status or review fields. Invoices must be an `expense` or `service` with a
  positive numeric amount. Release submissions must include a split sheet and
  start with an empty message thread. Attachments are stored inline (items up
  to ~6 MB). `artist_reply_submission()` lets an artist add a reply only to
  their own submission while it's Waiting review or Needs info, and puts it
  back to Waiting review.
- **Statement files** live in the private Storage bucket `statements` under
  `<artistId>/`. The team can manage every file; an artist can only read files
  in their own folder. Downloads use short-lived (2 min) signed URLs.
- `artist_reply_invoice()` lets an artist add a message only to their own
  invoice, and not once it's Paid. Email replies to an invoice land on the same
  thread via the notify function.
- **Artists see published revenue only.** `artist_portal()` reads
  `publishedRevenue` (a snapshot taken on Publish), never the live `revenue`
  books, and its Inbound Banking Charge comes from the `swiftShare` fixed on
  each snapshot row. Statement files show once every month they cover is
  published. Only an Admin publishes; Finance sends a publish to an Admin to approve.
  The database refuses any other write to `publishedRevenue`.
- **Activity audit** (`audit_log` table): append-only. Rows are written only by
  `log_activity()`, which takes the actor from the signed-in session (team
  member from the staff list, or the artist from the roster; an artist's
  entries are always about themselves) and is rate-limited, or by the notify
  function (service role) for scheduled jobs. Only Admin and Legal who passed the second step
  can read it (`is_audit_reader()`). Nobody can update, delete or insert directly, Admins
  included.
- **Notifications** (`notifications` table): written only by the notify
  function alongside each email; each person reads only rows addressed to
  their own email and marks them read through `mark_notifications_read()`.
- Internal helpers (`section()`, `my_artist()`, `js_slug()`) are not callable
  from the API. Default privileges in `public` grant no API access to new
  functions; every function exposed to the API is granted explicitly.
- A team member can't remove their own email from the staff list (the update
  check would lock them out, so the database refuses it).

## Email

- Supabase Edge Function `notify` (`supabase/functions/notify/index.ts`) sends
  and receives email through Resend. It runs with the service role, so it can
  read and write `app_data`.
- A trigger on `app_data` (`private.app_data_events`) posts small event
  descriptors to it via `pg_net`; a `pg_cron` job (`send-due-statements`) calls
  it every 10 minutes for scheduled statements. Both send a shared secret kept
  in `private.config` (schema not exposed to the API); the function checks it
  with `notify_secret_ok()`, callable only by the service role.
- Resend's inbound webhook is verified with its signing secret (Svix HMAC,
  5-minute window). A reply is only added to a thread if it comes from that
  artist's email or a staff member's email.
- Secrets live in Supabase → Edge Functions → Secrets: `RESEND_API_KEY`,
  `RESEND_WEBHOOK_SECRET`, `RECEIVE_DOMAIN`. Never in the repo.
- Receiving uses Resend's `entuurboou.resend.app` address, so the main
  `imssrecords.com` MX records (your normal email) are untouched.

## Page and transport standard (same as FloorTest)

Every response from Vercel carries (`vercel.json`):
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` (HTTPS only)
- `Content-Security-Policy`: scripts only from this site; styles from this site
  and Google Fonts; connections only to this site and the Supabase project;
  no framing (`frame-ancestors 'none'`), no plugins, `base-uri`/`form-action`
  locked to self, insecure requests upgraded
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`: camera, microphone, geolocation, payment, USB off
- `X-Robots-Tag: noindex, nofollow`, plus `robots.txt` (`Disallow: /`) and a
  noindex meta tag: nothing in this private dashboard is indexed
- Unknown paths serve the app instead of a bare 404; a favicon and page
  metadata are set in `index.html`

When adding a new external service (fonts, analytics, an API), add its origin
to the CSP or it will be blocked.

## Abuse limits

- Artists: at most 10 release submissions, 10 invoices and 20 other items
  (requests, profile changes) per hour, and 30 replies per hour
  (`private.rate_limit`, enforced inside `artist_add()` /
  `artist_reply_submission()`). This also caps the notification emails an
  artist can trigger.
- Attachments (split sheets, receipts, invoice files, artwork, profile photos)
  must be PDFs or PNG/JPEG/WebP/GIF/HEIC images (`private.valid_attachment`);
  anything else is refused by the database, not just the form.
- Sign-in emails are limited by Supabase Auth (Authentication → Rate Limits).

## Dependencies

`npm audit --omit=dev` reports 0 vulnerabilities for what ships. Vite is on v8.
The remaining dev-only findings are in Tailwind 3's file-watching chain
(braces, postcss-selector-parser): build-time slowdowns only. They clear with a
Tailwind 4 migration.

## Known limitations

These are real and accepted for now. Don't treat them as protected.

1. **Some data is still readable by the whole team.** Invoices (with amounts)
   and the team list are readable by every team member, because several
   screens need them. Budgets keep a snapshot of the artist's deal at creation
   (`overheads.dealTerm`), readable by anyone with Budgets & expenses. Rows inside a
   section are not scoped per artist (a Product Manager's view of their own
   artists is enforced in the app). Approval steps inside a section (who may
   approve a revenue row, a budget overspend or an invoice stage) are app rules.
2. **Supabase's own advisor** flags `public.rls_auto_enable()` (created by
   Supabase, not this project) as callable by anyone. Review it in the Supabase
   dashboard.
3. **Backups are manual.** Use Backup & Restore in the app, or Supabase's
   backups on a paid plan. The free plan also pauses after a week without use.
4. **Real data is in the repository** (`src/seed.js`, `data/`). Production
   builds leave it out of the public JavaScript (`OMIT_REAL_DATA`), but anyone
   with repo access can read it. Keep the repository private.
5. **Version bumps:** with Supabase, changing `DATA_VERSION` no longer reseeds
   (which used to wipe shared data). Shape changes need a deliberate migration.

## Rules for changes

- Never commit secrets: no Supabase `service_role`/secret key, no Resend API
  key, no `.env` files. The only keys in the app are the Supabase URL and
  publishable key, which are public by design. `.env*` and `*.local` are
  git-ignored.
- After any database change, run Supabase's security advisor and fix new
  findings before shipping.
- New database functions: `security definer` with `set search_path = ''`,
  then grant `execute` to `authenticated` only if the app calls it.
- Anything an artist can trigger must go through a function that checks
  `my_artist()` and forces ownership, never a direct table write.
- Keep the HTTPS-only domain list and the Redirect URL list in step.
