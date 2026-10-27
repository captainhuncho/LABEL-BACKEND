-- Send only the fields each portal shows (owner rule 2, 27 Oct: send only the
-- fields needed).
--
-- MERGE FIRST: branch `claude/frosty-lamarr-8551e9` (or `security-md-sections`),
-- which carries 20261022_artist_portal_match_by_id.sql. That migration created
-- private.portal_row_mine() and private.slug_unique(), which are live and are
-- used below. This file was built from the LIVE definitions of
-- public.artist_portal() and public.rep_portal() read on 27 Oct 2026
-- (pg_get_functiondef, read-only), so applying it does not undo that work.
--
-- What changes (same signatures, same top-level keys, so the current app keeps
-- working):
-- * rep_portal 'releases' sent whole catalog rows minus notes/checklist/tasks,
--   so a Label Rep (an outside partner) also got enteredBy, licenseExpiration,
--   distributionDocs, markets, licence overrides and any key added later. Now
--   each release is an allow-list of what src/RepApp.jsx and the release sheet
--   (src/releaseSheet.js) show. The sheet deliberately lists credits, splits,
--   lyrics and markets, so those stay, narrowed to the sub-fields it prints.
-- * artist_portal sent whole rows for catalog, revenue, streams, payouts,
--   ledger, notices, profileRequests, artistRequests and releaseSubmissions.
--   Each is now an allow-list traced from src/sections/ArtistPortal.jsx, its
--   tabs (src/sections/portal/), ArtistStatement.jsx, StatementFiles.jsx,
--   src/finance.js, src/licenses.js and src/streams.js. Internal fields such as
--   enteredBy, approvedBy, approvalStatus, recoupable, overheadId, notes,
--   createdBy, distributionDocs and checklist task names no longer leave the
--   database. The catalog checklist is reduced to [{done}] (the portal shows
--   only "x/y production tasks").
-- * Sections already built field by field (artist, masterGross, songStats,
--   labelSettings, invoices, statementFiles, budgets, dealChanges) are copied
--   unchanged from the live definition.
-- Filtering still uses the full rows inside the function; only the output is
-- narrowed.

-- Keep only `wanted` of a JSON object; anything that isn't an object gives null.
create or replace function private.pick(o jsonb, wanted text[])
returns jsonb language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(o) = 'object'
    then coalesce((select jsonb_object_agg(k, o->k) from unnest(wanted) k where o ? k), '{}'::jsonb) end;
$$;
revoke all on function private.pick(jsonb, text[]) from public, anon, authenticated;

-- private.pick() on every object in a JSON array, order kept. Plain values
-- (an old collaborator stored as a name string) pass through as they are, so
-- the screens never get a null where they expect an item. Not an array gives null.
create or replace function private.pick_each(a jsonb, wanted text[])
returns jsonb language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(a) = 'array'
    then coalesce((select jsonb_agg(case when jsonb_typeof(e) = 'object' then private.pick(e, wanted) else e end order by n)
                     from jsonb_array_elements(a) with ordinality t(e, n)), '[]'::jsonb) end;
$$;
revoke all on function private.pick_each(jsonb, text[]) from public, anon, authenticated;

-- One catalog release with only `wanted`. Nested fields, when listed, keep only
-- the sub-fields the portals read.
create or replace function private.release_view(c jsonb, wanted text[])
returns jsonb language sql immutable set search_path = '' as $$
  select private.pick(c, wanted)
    || case when 'credits' = any(wanted) and c ? 'credits' then jsonb_build_object('credits', private.pick(c->'credits',
         array['writtenBy', 'producedBy', 'recordingEngineer', 'mixingEngineer', 'masteringEngineer', 'dolbyEngineer'])) else '{}'::jsonb end
    || case when 'collaborators' = any(wanted) and c ? 'collaborators' then jsonb_build_object('collaborators', private.pick_each(c->'collaborators',
         array['name', 'role', 'splitPercent'])) else '{}'::jsonb end
    || case when 'checklist' = any(wanted) and c ? 'checklist' then jsonb_build_object('checklist', private.pick_each(c->'checklist', array['done'])) else '{}'::jsonb end
    || case when 'licenseOverride' = any(wanted) and c ? 'licenseOverride' then jsonb_build_object('licenseOverride', private.pick(c->'licenseOverride', array['endDate'])) else '{}'::jsonb end;
$$;
revoke all on function private.release_view(jsonb, text[]) from public, anon, authenticated;

create or replace function public.rep_portal()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare r jsonb := private.my_rep(); ids text[];
begin
  if r is null then return null; end if;
  select coalesce(array_agg(a->>'id'), '{}') into ids from jsonb_array_elements(public.section('roster')) a
    where a->>'labelRep' = r->>'id' and coalesce(a->>'status', '') <> 'Archived';
  return jsonb_build_object(
    'rep', jsonb_build_object('id', r->>'id', 'name', r->>'name', 'company', r->>'company'),
    'artists', (select coalesce(jsonb_agg(jsonb_build_object('id', a->>'id', 'name', a->>'name')), '[]') from jsonb_array_elements(public.section('roster')) a where a->>'id' = any(ids)),
    -- What RepApp.jsx (cards, countdown, Seen / Sent out) and the release sheet show.
    'releases', (select coalesce(jsonb_agg(private.release_view(c, array[
        'id', 'artistId', 'title', 'type', 'releaseDate', 'status', 'isrc', 'upc', 'label', 'genre', 'explicit', 'duration',
        'primaryArtists', 'collaborators', 'credits', 'dolbyAtmos', 'lyrics', 'hasVideo', 'primaryMarket', 'secondaryMarket',
        'repConfirmedAt', 'repFirstConfirmedAt', 'repSeenAt', 'repSentOutAt', 'repSentOutNote'])), '[]')
      from jsonb_array_elements(public.section('catalog')) c
      where c->>'artistId' = any(ids) and coalesce(c->>'repConfirmedAt', '') <> ''),
    'invoices', (select coalesce(jsonb_agg(jsonb_build_object('id', i->>'id', 'artistId', i->>'artistId', 'title', i->>'title', 'kind', i->>'kind', 'amount', i->'amount',
        'currency', i->>'currency', 'details', i->>'details', 'status', i->>'status', 'submittedAt', i->>'submittedAt', 'sentToRepAt', i->>'sentToRepAt',
        'repSentAt', i->>'repSentAt', 'repRef', i->>'repRef', 'paidAt', i->>'paidAt', 'invoiceNumber', i->>'invoiceNumber', 'payee', i->>'payTo', 'lines', i->'lines', 'attachment', i->>'attachment', 'attachmentName', i->>'attachmentName', 'sentToPartnerAt', i->>'sentToPartnerAt', 'repSeenAt', i->>'repSeenAt', 'repSentOutAt', i->>'repSentOutAt', 'repSentOutNote', i->>'repSentOutNote')), '[]')
      from jsonb_array_elements(public.section('invoices')) i
      where i->>'artistId' = any(ids) and coalesce(i->>'sentToRepAt', '') <> '')
  );
end $function$;

create or replace function public.artist_portal()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare
  a jsonb := public.my_artist();
  aid text; aslug text; aname text;
  rev jsonb; cat jsonb; last_pub text;
  thread text[] := array['from', 'by', 'at', 'text', 'via'];
begin
  if a is null then return null; end if;
  aid := a->>'id'; aname := a->>'name'; aslug := public.js_slug(aname);

  select coalesce(jsonb_agg(r), '[]') into rev from jsonb_array_elements(public.section('publishedRevenue')) r
    where private.portal_row_mine(r, aid, aslug);
  select max(r->>'month') into last_pub from jsonb_array_elements(rev) r;
  select coalesce(jsonb_agg(c), '[]') into cat from jsonb_array_elements(public.section('catalog')) c
    where c->>'artistId' = aid;

  return jsonb_build_object(
    'artist', (select coalesce(jsonb_object_agg(k, a->k), '{}'::jsonb) from unnest(array[
      'id', 'name', 'email', 'photoUrl', 'bio', 'genre', 'subGenre', 'status',
      'spotify', 'appleMusic', 'audiomack', 'boomplay', 'youtube', 'soundcloud', 'instagram', 'tiktok', 'x', 'facebook', 'website',
      'artistPct', 'royaltyRate', 'fundingTier', 'dealType', 'dealTerms', 'contractType', 'licenseYears', 'effectiveDate',
      'reportingPeriod', 'payoutThreshold', 'noExtension', 'deliveryDays', 'annualBudget',
      'recoupConfirmations', 'rightsReturned', 'terminations', 'productManager', 'anr']) k where a ? k),
    -- Release cards, the transfer/publishing export and licence lines (src/licenses.js).
    'catalog', (select coalesce(jsonb_agg(private.release_view(c, array[
        'id', 'artistId', 'title', 'type', 'releaseDate', 'status', 'isrc', 'upc', 'label', 'genre', 'explicit', 'duration',
        'primaryArtists', 'collaborators', 'credits', 'dolbyAtmos', 'lyrics', 'hasVideo', 'primaryMarket', 'secondaryMarket',
        'artworkUrl', 'checklist', 'availableFrom', 'licenseYears', 'licenseOverride'])), '[]')
      from jsonb_array_elements(cat) c),
    -- Royalties, earnings, statements, streams from statements (src/finance.js, src/streams.js, StatementFiles.jsx).
    'revenue', (select coalesce(jsonb_agg(private.pick(r, array[
        'id', 'artist', 'artistSlug', 'artistId', 'title', 'month', 'earning', 'quantity', 'isrc', 'upc', 'type', 'releaseDate',
        'stores', 'countries', 'types', 'typeQty', 'storeStreams', 'models', 'salesMonths', 'source',
        'swiftShare', 'artistPct', 'artistShare', 'final'])), '[]')
      from jsonb_array_elements(rev) r),
    'masterGross', (
      select coalesce(jsonb_agg(jsonb_build_object('month', m, 'totalGross', 0, 'swiftFee', fee)), '[]')
      from (select r->>'month' m, sum(coalesce((r->>'swiftShare')::numeric, 0)) fee from jsonb_array_elements(rev) r group by 1) x),
    'streams', (select coalesce(jsonb_agg(private.pick(s, array['id', 'date', 'platform', 'releaseId', 'count'])), '[]') from jsonb_array_elements(public.section('streams')) s
      where s->>'releaseId' in (select c->>'id' from jsonb_array_elements(cat) c)),
    'songStats', (select coalesce(jsonb_agg(jsonb_build_object('isrc', s->>'isrc', 'releaseId', s->>'releaseId', 'title', s->>'title', 'fetchedAt', s->>'fetchedAt', 'songstatsUrl', s->>'songstatsUrl', 'sources', s->'sources')), '[]')
      from jsonb_array_elements(public.section('songStats')) s
      where s->>'artistId' = aid and s->>'releaseId' in (select c->>'id' from jsonb_array_elements(cat) c) and jsonb_typeof(s->'sources') = 'array'),
    -- Payouts tab and statement history: period, status, the artist's share.
    'payouts', (select coalesce(jsonb_agg(private.pick(p, array['id', 'artistId', 'artistSlug', 'periodStart', 'periodEnd', 'status', 'artistShare', 'createdAt'])), '[]') from jsonb_array_elements(public.section('payouts')) p
      where private.portal_row_mine(p, aid, aslug) and coalesce(p->>'sentAt', '') <> ''),
    -- Expenses, budget, recoupment and licence balances (src/finance.js artistSpend, src/licenses.js balanceAt).
    'ledger', (select coalesce(jsonb_agg(private.pick(l, array['id', 'type', 'artist', 'artistId', 'category', 'description', 'amount', 'date'])), '[]') from jsonb_array_elements(public.section('ledger')) l
      where (case when coalesce(l->>'artistId', '') <> '' then l->>'artistId' = aid else l->>'artist' = aname and private.slug_unique(aslug) end) and (l->>'type' = 'expense' or (l->>'type' = 'income' and l->>'category' = 'Cash repayment')) and coalesce(l->>'approvalStatus', 'Approved') = 'Approved'
        and last_pub is not null and left(coalesce(l->>'date', ''), 7) <= last_pub),
    'notices', (select coalesce(jsonb_agg(private.pick(n, array['id', 'title', 'message', 'audience', 'createdAt'])), '[]') from jsonb_array_elements(public.section('notices')) n
      where n->>'audience' = 'all' or n->>'audience' = aid),
    'labelSettings', '{}'::jsonb,
    'profileRequests', (select coalesce(jsonb_agg(private.pick(x, array['id', 'artistId', 'changes', 'status', 'submittedAt'])), '[]') from jsonb_array_elements(public.section('profileRequests')) x where x->>'artistId' = aid),
    'artistRequests', (select coalesce(jsonb_agg(private.pick(x, array['id', 'artistId', 'category', 'title', 'message', 'status', 'submittedAt', 'respondedBy', 'response'])
        || case when x ? 'messages' then jsonb_build_object('messages', private.pick_each(x->'messages', thread)) else '{}'::jsonb end), '[]')
      from jsonb_array_elements(public.section('artistRequests')) x where x->>'artistId' = aid),
    'releaseSubmissions', (select coalesce(jsonb_agg(private.pick(x, array['id', 'artistId', 'title', 'type', 'proposedDate', 'sentTo', 'status', 'submittedAt'])
        || case when x ? 'messages' then jsonb_build_object('messages', private.pick_each(x->'messages', thread)) else '{}'::jsonb end), '[]')
      from jsonb_array_elements(public.section('releaseSubmissions')) x where x->>'artistId' = aid),
    'invoices', (select coalesce(jsonb_agg((select coalesce(jsonb_object_agg(k, x->k), '{}'::jsonb) from unnest(array[
      'id', 'artistId', 'kind', 'title', 'amount', 'status', 'category', 'categoryId', 'budgetCategory', 'invoiceDate', 'invoiceNumber',
      'payTo', 'details', 'attachment', 'attachmentName', 'messages', 'reviewNote', 'correctedNote', 'submittedAt', 'paidAt']) k where x ? k)), '[]')
      from jsonb_array_elements(public.section('invoices')) x where x->>'artistId' = aid),
    'statementFiles', (select coalesce(jsonb_agg(x - 'dataUrl'), '[]') from jsonb_array_elements((select coalesce(jsonb_agg(y), '[]'::jsonb) from jsonb_array_elements(public.section('statementFiles')) y where coalesce(y->>'kind', '') <> 'pdf')) x
      where x->>'artistId' = aid
        and not exists (select 1 from jsonb_array_elements_text(coalesce(x->'months', '[]')) fm
                        where not exists (select 1 from jsonb_array_elements(rev) r where r->>'month' = fm))),
    -- Approved deal changes only, without internal notes' attachments or who recorded them.
    'budgets', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', o->>'id', 'title', o->>'title', 'status', o->>'status', 'types', coalesce(o->'types', '[]'), 'total', o->'total', 'releaseIds', coalesce(o->'releaseIds', '[]'),
        'parentId', o->>'parentId', 'closedAt', o->>'closedAt', 'sentToArtistAt', o->>'sentToArtistAt',
        'categories', (select coalesce(jsonb_agg(jsonb_build_object('id', c->>'id', 'type', coalesce(c->>'type', ''), 'category', c->>'category', 'allocated', c->'allocated')), '[]')
                       from jsonb_array_elements(coalesce(o->'categories', '[]')) c),
        'items', (select coalesce(jsonb_agg(x), '[]') from (
            select jsonb_build_object('id', l->>'id', 'categoryId', coalesce(l->>'categoryId', ''), 'date', l->>'date',
                     'text', coalesce(nullif(l->>'description', ''), l->>'category'), 'amount', l->'amount') x
              from jsonb_array_elements(public.section('ledger')) l
             where l->>'type' = 'expense' and l->>'overheadId' = o->>'id' and coalesce(l->>'approvalStatus', 'Approved') = 'Approved'
            union all
            select jsonb_build_object('id', i->>'id', 'categoryId', coalesce(i->>'categoryId', ''), 'date', left(coalesce(i->>'submittedAt', ''), 10),
                     'text', 'Expense claim: ' || coalesce(i->>'title', ''), 'amount', i->'amount')
              from jsonb_array_elements(public.section('invoices')) i
             where i->>'kind' = 'expense' and i->>'overheadId' = o->>'id' and i->>'status' in ('Pay Approved', 'Paid')) q)
      )), '[]')
      from jsonb_array_elements(coalesce(public.section('overheads'), '[]')) o
      where o->>'kind' = 'artist' and o->>'artistId' = aid and coalesce(o->>'sentToArtistAt', '') <> '' and o->>'status' in ('Active', 'Closed')),
    'dealChanges', (select coalesce(jsonb_agg(jsonb_build_object('id', x->>'id', 'from', x->>'from', 'artistPct', x->'artistPct',
        'fundingTier', x->>'fundingTier', 'dealType', x->>'dealType', 'was', x->'was', 'approvedAt', x->>'approvedAt', 'kind', x->>'kind', 'sentToArtistAt', x->>'sentToArtistAt', 'date', x->>'date', 'releaseIds', x->'releaseIds', 'releaseId', x->>'releaseId', 'end', x->>'end')), '[]')
      from jsonb_array_elements(public.section('dealChanges')) x where x->>'artistId' = aid and x->>'status' = 'Approved' and coalesce(x->>'sentToArtistAt', '') <> '')
  );
end;
$function$;
