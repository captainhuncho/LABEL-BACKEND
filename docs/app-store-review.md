# App Store Review check — IMSS Records dashboard

Checked 31 Oct 2026 against Apple's App Store Review Guidelines (page last
updated 16 Oct 2026): https://developer.apple.com/app-store/review/guidelines/

IMSS is a Vite web app (ops.imssrecords.com for the team,
artist.imssrecords.com for Artists Access). There is no native iOS shell yet,
so this review treats it as if it were wrapped for iOS. Status: **meets**,
**gap** (not built or not enough), **n/a** (does not apply), **owner** (an
Apple account, App Store Connect or legal step only the owner can take).

## Does it belong on the App Store?

Probably not as a public listing. Sign-in is invite only: only emails on the Team list
or a Roster entry can sign in (`src/AuthGate.jsx:104`, database trigger in
`supabase/migrations/20261016_remove_uninvited_accounts.sql`). A public listing
would show the world an app nobody can open, and a plain web wrapper risks 4.2.
Options, best first:

1. **Stay on the web** (add to Home Screen). No review, works today.
2. **Custom app through Apple Business Manager**, or an unlisted App Store
   link, for staff and signed artists only. App Review still applies, so the
   gaps below still matter. Check Apple's Apple Business Manager docs before
   choosing (the guidelines page does not cover private distribution).
3. **Public App Store listing**: only after the 4.2 and 2.1 gaps are closed.

## Guideline by guideline

| Section | Rule in short | Status | Evidence |
|---|---|---|---|
| 1.2 User-generated content | Filter, report, block, contact info for UGC | n/a (likely) | Artists upload invoices and split sheets (`src/storage.js:215`, `src/sections/ArtistPortal.jsx:221`, `:337`); files go only to the label, never to other users. Nothing is published between users. State this in review notes. |
| 2.1 App completeness: demo account | Reviewer needs a working sign-in and live backend | **gap + owner** | Invite only (`src/AuthGate.jsx:104`). A reviewer needs an invited demo email. Today the only database holds **real artist money**, so a demo account would see real data. Needs a demo workspace with fake data (a separate Supabase project or a seeded demo role) before any submission. |
| 2.1 Completeness: no placeholders | Final build, working URLs | gap | No iOS build exists. |
| 2.5.6 Web browsing | Web content uses WebKit | meets if wrapped | Any wrapper (WKWebView / Capacitor) uses WebKit. Nothing built yet. |
| 3.1.1 / 3.1.3 In-app purchase | Digital goods need IAP | n/a | Nothing is sold. The app tracks royalties and payouts paid outside it. No Restore Purchases needed. |
| 4.2 Minimum functionality | More than a repackaged website | **gap** | Today the app would be the same web app in a shell. It would need native value (push notifications for statements and invoices, passkeys through iOS, offline statements, share sheet for uploads) or it risks rejection. |
| 4.8 Login services | A third-party login needs an equal private option | meets (check) | Google (`src/AuthGate.jsx:118`), email one-time code (`:132`) and passkey (`:181`). Email code and passkey are equivalents that don't use a social account. The enterprise exception (org accounts) may also apply. Sign in with Apple is not required on this reading; confirm at review. |
| 5.1.1 Privacy policy | Linked in App Store Connect and inside the app | meets in app + owner | Privacy Policy page (`src/Legal.jsx:12`); the footer is on team and artist screens (`src/App.jsx:15`, `src/sections/ArtistPortal.jsx:8`). The App Store Connect link is an owner step. The wording is Legal's and was not reviewed or changed here. |
| 5.1.1 Account deletion | Apps with account creation offer deletion in the app | **gap (check)** | People can't create accounts themselves; an Admin invites them. Removing someone from Team/Roster deletes their sign-in (`supabase/migrations/20261016_remove_uninvited_accounts.sql`), but nobody can ask for deletion from inside the app. Apple may still expect a "Delete my account" or "Request deletion" button. Its effect on financial records kept for the law is a legal question for the owner. |
| 5.1.1 Login required | Login only when core to the app | meets | Every screen shows private label or artist money, so a login is core. |
| 5.1.1 Revoke social login | Users can disconnect social credentials in-app | gap (check) | No in-app screen to unlink Google. Sign-out exists (`src/AuthGate.jsx:102`). |
| 5.1.2 Tracking | ATT prompt before any tracking | n/a | No analytics, ads or tracking SDK. CSP allows connections only to this site and Supabase (`vercel.json`, `Content-Security-Policy`). No ATT prompt needed. |
| 5.1.2 Data sharing | Disclose third parties | meets in policy (owner check) | Processors (Supabase, Vercel, Resend) belong in the Privacy Policy. That is Legal's wording, not checked here. |

## Top gaps

1. **Demo account for review (2.1).** The reviewer must not see real artist
   money. A demo workspace with fake data has to be built first.
2. **Minimum functionality (4.2).** A plain wrapper of the web app is likely to
   be rejected. It needs native features, or the app stays on the web or goes
   out as a custom app.
3. **Account deletion in the app (5.1.1).** There is no self-serve delete or
   request button, and the legal side of keeping financial records needs a
   decision.

## Owner steps

- Apple Developer Program (organization) enrollment, and App Store Connect setup.
- Choose the distribution route (web, custom app, unlisted or public).
- Privacy Policy URL in App Store Connect; App Privacy "nutrition label" answers.
- Legal wording for account deletion and for keeping records. This file does not edit legal pages.
- A demo account email on the Team list, but only once a demo workspace exists.
