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
  positive numeric amount. Attachments are stored inline (limit ~2 MB).
- Internal helpers (`section()`, `my_artist()`, `js_slug()`) are not callable
  from the API. Default privileges in `public` grant no API access to new
  functions; every function exposed to the API is granted explicitly.
- A team member can't remove their own email from the staff list (the update
  check would lock them out, so the database refuses it).

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
