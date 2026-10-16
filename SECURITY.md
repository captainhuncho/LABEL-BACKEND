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

- Email link only (Supabase magic link). No passwords are stored.
- Links return only to URLs on Supabase's Redirect URL allow-list
  (`https://ops.imssrecords.com`, `https://label-backend.vercel.app`,
  `http://localhost:5173`). Add new hosts there, never a wildcard.
- Sign-in links expire after 10 minutes (Supabase Auth → Email → Email OTP
  Expiration = 600 s) and work once; requesting a new link voids the old one.
- Anyone can request a link and get an account. An account on its own sees
  nothing: access comes only from the email being on the Team list or on an
  artist's Roster entry (`my_access()`).

## Data access (enforced in the database)

- `app_data` has row-level security on. Signed-out visitors can't read or write
  anything.
- **Team:** a signed-in user whose email is on the `staff` list
  (`is_team_member()`) can read and write every section.
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

1. **Role permissions are enforced in the app, not the database.** Any signed-in
   team member can technically read or change every section through the API,
   including staff roles. Admin-only rules in the database would close this.
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
