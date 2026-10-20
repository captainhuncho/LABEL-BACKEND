# Graph Report - imss-records-dashboard  (2026-10-20)

## Corpus Check
- 189 files · ~190,526 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: (none) 1, .css 1, .csv 1)

## Summary
- 1302 nodes · 4192 edges · 101 communities (37 shown, 64 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 57 edges (avg confidence: 0.85)
- Token cost: 244,393 input · 0 output

## Community Hubs (Navigation)
- App Shell & Libraries
- Finance Engine
- Artist Portal Data
- Notify Email Function
- Domain Constants & Roles
- Tests & Scripts
- Security & Integration Docs
- Agent Guide & Data Model
- Appearance & Error Reporting
- Backup & Restore UI
- Dashboard Root & Imports
- Sign-in & Idle Sign-out
- Package Dependencies
- Song Licenses & Rights
- Seed Data & Sidebar
- Budgets & Expenses
- Catalog & Releases
- Team Identity & Email Domains
- Artist Portal Shell
- Demo Data
- Artist Detail Panel
- Deal Changes
- Roster Screen
- DB: Roster Deal Privacy
- DB: Email Deliveries Retry
- DB: Audit Log & Notifications
- DB: Blocked Sign-ins
- DB: Section Write Rules
- DB: Artist Portal RPCs
- DB: Label Rep Portal
- DB: Email Triggers
- DB: Section Read/Write
- DB: Sign-in Alerts
- DB: Team Two-Factor
- DB: Team Write Rules
- DB: Auto Backups
- DB: Invite-only Signups
- DB: Remove Uninvited
- Team Attention Helpers
- DB: Artist Rate Limits
- 20261016_archived_no_signin.sql
- 20261017_signin_notice.sql
- 20261019_idle_sessions.sql
- section_rules.sql
- 2. DESIGN.md
- 20261015_artist_invoices.sql
- 20261016_artist_deal_change_notices.sql
- 20261016_publish_revenue_to_artists.sql
- 20261017_app_data_versioning.sql
- 20261017_client_errors.sql
- 20261018_rep_view_only.sql
- 20261019_invoice_read_scope.sql
- vercel.json
- ord
- 20261015_app_data_with_team_access.sql
- 20261016_artist_portal_published_only.sq
- 20261018_artist_my_activity.sql
- 20261018_rep_my_activity.sql
- 20261019_atomic_section_pair.sql
- index.html
- 20261016_archive_and_clear_earnings.sql
- 12. MCP Connection.md

## God Nodes (most connected - your core abstractions)
1. `RecordLabelDashboard()` - 90 edges
2. `Btn()` - 87 edges
3. `logActivity()` - 78 edges
4. `formatDate()` - 74 edges
5. `ArtistPortalShell()` - 74 edges
6. `Td()` - 69 edges
7. `Badge()` - 68 edges
8. `Th()` - 67 edges
9. `EmptyState()` - 65 edges
10. `uid()` - 63 edges

## Surprising Connections (you probably didn't know these)
- `robots.txt disallow all` --semantically_similar_to--> `index.html entry`  [INFERRED] [semantically similar]
  public/robots.txt → index.html
- `Design handoff spec` --references--> `DESIGN.md The Masters Vault`  [INFERRED]
  docs/design-handoff.md → DESIGN.md
- `Whole platform surface direction` --conceptually_related_to--> `DESIGN.md The Masters Vault`  [INFERRED]
  .impeccable/surfaces/src-app-jsx.md → DESIGN.md
- `start()` --calls--> `startIdleSignOut()`  [EXTRACTED]
  test/idle.test.js → src/idleSignOut.js
- `Back up Storage objects` --conceptually_related_to--> `offsite-backup workflow`  [INFERRED]
  CLAUDE_REVIEW_ATOMIC_FINANCE.md → .github/workflows/offsite-backup.yml

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Artist data boundary** — agents_artist_portal_rpc, agents_artist_add_rpc, agents_my_access, claude_review_p0_artist_exposure [INFERRED 0.85]
- **Invite-only sign-in** — agents_is_invited, agents_before_user_created, agents_two_sites, agents_my_access [EXTRACTED 1.00]
- **Invite-only sign-in enforcement** — docs_1__prd_invite_only, docs_11__authentication___security_is_invited, docs_5__api_before_user_created, docs_5__api_my_access [INFERRED 0.85]
- **Financial integrity plan steps** — docs_8__project_implementation_import_idempotency, docs_8__project_implementation_reconciliation_states, docs_8__project_implementation_integer_cents, docs_8__project_implementation_financial_integrity_plan [EXTRACTED 1.00]

## Communities (101 total, 64 thin omitted)

### Community 0 - "App Shell & Libraries"
Cohesion: 0.06
Nodes (119): lucide-react, react, recharts, SENSITIVE, WHAT, readAudit(), artworkColor(), artworkInitials() (+111 more)

### Community 1 - "Finance Engine"
Cohesion: 0.06
Nodes (71): portalFor(), addMonths(), applyPublish(), applyThreshold(), artistLifetime(), artistMonthsWithRevenue(), artistPublishedView(), artistSpend() (+63 more)

### Community 2 - "Artist Portal Data"
Cohesion: 0.06
Nodes (74): ArtistApp(), load(), logActivity(), logSignIn(), markNotificationsRead(), readNotifications(), formatCurrency(), LoadingScreen() (+66 more)

### Community 3 - "Notify Email Function"
Cohesion: 0.07
Nodes (60): addressOf(), ARTIST_EMAIL_TOPICS, audit(), b64(), changeSection(), CODE_KEY, db, Delivery (+52 more)

### Community 4 - "Domain Constants & Roles"
Cohesion: 0.06
Nodes (48): ALL_PERMISSIONS, ARTIST_STATUSES, ARTWORK_PALETTE, buildImportGroups(), CASH_REPAYMENT, classifySource(), computePlatformLeaderboard(), DEAL_FIELDS (+40 more)

### Community 5 - "Tests & Scripts"
Cohesion: 0.07
Nodes (40): papaparse, @supabase/supabase-js, db, listAll(), manifest, [outDir = 'out/storage'], add(), aggregateEmpire() (+32 more)

### Community 6 - "Security & Integration Docs"
Cohesion: 0.05
Nodes (40): 10. Feature Development, src/licenses.js licence rules, 11. Authentication & Security, private.is_invited, Team second factor (passkey/authenticator), 13. Integrations, Resend email, 14. Testing & QA (+32 more)

### Community 7 - "Agent Guide & Data Model"
Cohesion: 0.05
Nodes (32): AGENTS.md project guide, app_data table, artist_add() RPC, artist_portal() RPC, before_user_created hook / blocked_signins, DATA_VERSION reseed gate, Deal changes approval flow, Licenses and rights rules (licenses.js) (+24 more)

### Community 8 - "Appearance & Error Reporting"
Cohesion: 0.07
Nodes (31): AppearancePicker(), APPEARANCES, applyAppearance(), getAppearance(), setAppearance(), installErrorReport(), LEGAL_PAGES, LEGAL_PATHS (+23 more)

### Community 9 - "Backup & Restore UI"
Cohesion: 0.07
Nodes (29): xlsx, todayStr(), BackupSection(), applyRestore(), current(), downloadAuto(), downloadBackup(), downloadWorkbook() (+21 more)

### Community 10 - "Dashboard Root & Imports"
Cohesion: 0.17
Nodes (38): RecordLabelDashboard(), clearAll(), commitArtistPublish(), commitArtistPublishLog(), commitEmpireImport(), commitStoreStreams(), load(), logChange() (+30 more)

### Community 11 - "Sign-in & Idle Sign-out"
Cohesion: 0.07
Nodes (27): AuthGate(), signInWithPasskey(), isArtistSite(), ACTIVITY_EVENTS, IDLE_KEY, IDLE_LIMIT_MS, IDLE_OUT_KEY, read() (+19 more)

### Community 12 - "Package Dependencies"
Cohesion: 0.06
Nodes (30): dependencies, lucide-react, papaparse, react, react-dom, recharts, @supabase/supabase-js, xlsx (+22 more)

### Community 13 - "Song Licenses & Rights"
Cohesion: 0.13
Nodes (24): addDays(), addMonths(), addYears(), balanceAt(), CONTRACT_TYPES, daysBetween(), isDate(), licenseFlags() (+16 more)

### Community 14 - "Seed Data & Sidebar"
Cohesion: 0.13
Nodes (24): Sidebar(), DATA_VERSION, REQUEST_STATUSES, SEED_ACCESS_REQUESTS, SEED_ACTIVITY_LOG, SEED_ARTIST_REQUESTS, SEED_CATALOG, SEED_INVOICES (+16 more)

### Community 15 - "Budgets & Expenses"
Cohesion: 0.18
Nodes (21): ArtistBudgets(), artistBudgetsFor(), AttachedItems(), BudgetSection(), close(), decide(), formProblem(), reopen() (+13 more)

### Community 16 - "Catalog & Releases"
Cohesion: 0.12
Nodes (12): emptyCredits(), makeDistributionDocs(), makeReleaseChecklist(), CatalogSection(), closeForm(), confirmForRep(), generateMetadataSheet(), openAdd() (+4 more)

### Community 17 - "Team Identity & Email Domains"
Cohesion: 0.15
Nodes (18): IdentityGate(), continueAsBootstrapAdmin(), continueAsTeam(), defaultPermissionsForRole(), emailDomainsFor(), isPrivilegedRole(), isStaffEmailAllowed(), isTopRole() (+10 more)

### Community 18 - "Artist Portal Shell"
Cohesion: 0.10
Nodes (6): ArtistPortalShell(), handleInvoiceFile(), handleSplitSheet(), revPeriodLabel(), onFile(), uploadDocument()

### Community 19 - "Demo Data"
Cohesion: 0.10
Nodes (17): ONBOARDING_TASKS_TEMPLATE, ARTISTS, asked, corrected, DEMO_CATALOG, DEMO_INVOICES, DEMO_MASTER_GROSS, DEMO_NOTICES (+9 more)

### Community 20 - "Artist Detail Panel"
Cohesion: 0.17
Nodes (12): artistStatusTone(), uid(), ArtistDetailPanel(), addComment(), PdfStatementUpload(), onFile(), submitArtistRequest(), submitInvoice() (+4 more)

### Community 21 - "Deal Changes"
Cohesion: 0.25
Nodes (13): DealChanges(), apply(), applyKind(), approve(), decline(), problem(), recordKind(), sendToArtist() (+5 more)

### Community 22 - "Roster Screen"
Cohesion: 0.20
Nodes (8): handleSubmitArtwork(), handleArtworkUpload(), RosterSection(), closeForm(), handlePhotoUpload(), save(), handlePhotoUpload(), resizeImageFile()

### Community 23 - "DB: Roster Deal Privacy"
Cohesion: 0.29
Nodes (5): private.can_see_deals(), private.roster_public_save(), private.roster_public_sync(), roster_public_save, roster_public_sync

### Community 24 - "DB: Email Deliveries Retry"
Cohesion: 0.27
Nodes (4): email_deliveries_open, private.email_deliveries, private.retry_email_deliveries(), public.email_failures()

### Community 25 - "DB: Audit Log & Notifications"
Cohesion: 0.31
Nodes (5): audit_log_artist_idx, audit_log_at_idx, notifications_recipient_idx, public.audit_log, public.notifications

### Community 26 - "DB: Blocked Sign-ins"
Cohesion: 0.31
Nodes (5): clear_allowed_blocks, private.blocked_signins, private.clear_allowed_blocks(), private.is_admin(), public.before_user_created()

### Community 27 - "DB: Section Write Rules"
Cohesion: 0.36
Nodes (6): app_data_section_rules, private.check_section_write(), private.invoice_reviewer(), private.is_pm_of(), private.me(), public.app_data_section_rules()

### Community 30 - "DB: Email Triggers"
Cohesion: 0.43
Nodes (5): app_data_events, private.app_data_events(), private.config, public.artist_portal(), public.notify_secret_ok()

### Community 32 - "DB: Sign-in Alerts"
Cohesion: 0.38
Nodes (3): private.signin_alert(), private.signin_watch, signin_alert

### Community 34 - "DB: Team Write Rules"
Cohesion: 0.43
Nodes (3): app_data_write_rules, private.app_data_write_rules(), private.my_perm()

### Community 35 - "DB: Auto Backups"
Cohesion: 0.40
Nodes (3): private.take_auto_backup(), public.backup_download(), public.backups_list()

### Community 36 - "DB: Invite-only Signups"
Cohesion: 0.40
Nodes (3): invite_only_signups, private.block_uninvited_signup(), private.is_invited()

### Community 38 - "Team Attention Helpers"
Cohesion: 0.50
Nodes (5): teamAttention(), expirationStatus(), onboardingProgress(), invoiceReviewers(), invoiceStage()

### Community 39 - "DB: Artist Rate Limits"
Cohesion: 0.60
Nodes (3): artist_actions_lookup, private.artist_actions, private.rate_limit()

### Community 45 - "2. DESIGN.md"
Cohesion: 0.50
Nodes (3): 2. DESIGN, Inbound Banking Charge (swift fee), src/theme.js tokens (C, GLOBAL_STYLES)

### Community 53 - "vercel.json"
Cohesion: 0.50
Nodes (3): headers, redirects, rewrites

## Knowledge Gaps
- **28 isolated node(s):** `autoprefixer`, `postcss`, `tailwindcss`, `Design handoff spec`, `index.html entry` (+23 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 409 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **64 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `RecordLabelDashboard()` connect `Dashboard Root & Imports` to `App Shell & Libraries`, `Finance Engine`, `Artist Portal Data`, `Domain Constants & Roles`, `Tests & Scripts`, `Team Attention Helpers`, `Appearance & Error Reporting`, `Backup & Restore UI`, `Sign-in & Idle Sign-out`, `Song Licenses & Rights`, `Seed Data & Sidebar`, `Budgets & Expenses`, `Catalog & Releases`, `Team Identity & Email Domains`, `Artist Detail Panel`, `Deal Changes`, `Roster Screen`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Are the 13 inferred relationships involving `RecordLabelDashboard()` (e.g. with `refresh()` and `updateAccessRequests()`) actually correct?**
  _`RecordLabelDashboard()` has 13 INFERRED edges - model-reasoned connections that need verification._
- **What connects `autoprefixer`, `postcss`, `tailwindcss` to the rest of the system?**
  _28 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App Shell & Libraries` be split into smaller, more focused modules?**
  _Cohesion score 0.06270404142744568 - nodes in this community are weakly interconnected._
- **Why does `15. Debugging` connect `Security & Integration Docs` to `Appearance & Error Reporting`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Should `Finance Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.05708548479632817 - nodes in this community are weakly interconnected._
- **Should `Artist Portal Data` be split into smaller, more focused modules?**
  _Cohesion score 0.05569620253164557 - nodes in this community are weakly interconnected._