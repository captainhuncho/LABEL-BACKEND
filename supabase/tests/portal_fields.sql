-- Checks for 20261027_portal_field_allow_lists.sql (rule 2: send only the
-- fields each portal shows).
-- Run as the postgres user in the Supabase SQL editor, in one transaction that
-- is rolled back. If the migration is not live yet, paste it right after
-- "begin;" (after 20261022_artist_portal_match_by_id.sql is live) so it is
-- tried and undone with the test.
-- Synthetic rows (ids "iso-…") carrying every internal field are added for
-- the first confirmed roster artist (A) and for an artist of the first
-- confirmed Label Rep (R). The portal answers must then hold exactly the
-- allowed keys, and no row of any section may carry a key outside its list.
-- Expected: every row says "ok".
begin;

create function pg_temp.as_user(email text, sub text) returns void language sql as $f$
  select set_config('request.jwt.claims', json_build_object('email', email, 'sub', sub, 'role', 'authenticated', 'aal', 'aal2',
           'amr', json_build_array(json_build_object('method', 'totp', 'timestamp', extract(epoch from now())::bigint)))::text, true),
         set_config('role', 'authenticated', true);
$f$;
create function pg_temp.add(k text, rows jsonb) returns void language plpgsql as $f$
begin
  update public.app_data set value = coalesce(value, '[]'::jsonb) || rows where key = k;
  if not found then insert into public.app_data (key, value) values (k, rows); end if;
end $f$;
-- 'ok' when every object in `arr` has only `allowed` keys; else the extra keys.
create function pg_temp.only(arr jsonb, allowed text[]) returns text language sql as $f$
  select coalesce('EXTRA KEYS: ' || string_agg(distinct k, ', '), 'ok')
    from jsonb_array_elements(coalesce(arr, '[]')) x, jsonb_object_keys(case when jsonb_typeof(x) = 'object' then x else '{}' end) k
   where not k = any(allowed);
$f$;
-- 'ok' when object `o` has exactly `expected` keys.
create function pg_temp.exact(o jsonb, expected text[]) returns text language sql as $f$
  select case when o is null then 'MISSING ROW'
    when (select array_agg(k order by k) from jsonb_object_keys(o) k) = (select array_agg(k order by k) from unnest(expected) k) then 'ok'
    else 'KEYS: ' || (select string_agg(k, ', ' order by k) from jsonb_object_keys(o) k) end;
$f$;
create function pg_temp.row_of(arr jsonb, id text) returns jsonb language sql as $f$
  select x from jsonb_array_elements(coalesce(arr, '[]')) x where x->>'id' = id limit 1;
$f$;

create temp table chk (n text, check_name text, result text);
create temp table got (who text, portal jsonb);
grant insert, select on chk, got to authenticated;

-- Every internal field the team screens write, on purpose, so a leak shows.
create temp table internal as select jsonb_build_object(
  'enteredBy', 'iso-staff', 'approvedBy', 'iso-staff', 'approvedAt', '2026-06-02', 'approvalStatus', 'Approved',
  'notes', 'internal', 'tasks', '[]'::jsonb, 'distributionDocs', '[{"id":"d","attached":true}]'::jsonb, 'createdBy', 'iso-staff',
  'recoupable', true, 'overheadId', 'iso-o', 'licenseExpiration', '2030-01-01', 'markets', '["GH"]'::jsonb,
  'repConfirmedBy', 'iso-staff', 'statementFileId', 'iso-f', 'publishedAt', '2026-06-03', 'reviewedBy', 'iso-staff') j;

-- A: the first roster artist with a confirmed account. R: the first Label Rep with one.
create temp table art as
  select a, u.id::text uid from public.app_data d, jsonb_array_elements(d.value) a, auth.users u
   where d.key = 'roster' and coalesce(a->>'email', '') <> '' and coalesce(a->>'status', '') <> 'Archived'
     and lower(u.email) = lower(a->>'email') and u.email_confirmed_at is not null
   order by a->>'id' limit 1;
create temp table rep as
  select s, u.id::text uid from public.app_data d, jsonb_array_elements(d.value) s, auth.users u
   where d.key = 'staff' and s->>'role' = 'Label Rep' and coalesce(s->>'status', '') not in ('Archived', 'Inactive')
     and lower(u.email) = lower(s->>'email') and u.email_confirmed_at is not null
   order by s->>'id' limit 1;
insert into chk select '00', 'confirmed artist A found', case when count(*) = 1 then 'ok' else 'NO ARTIST: artist checks cannot run' end from art;
insert into chk select '01', 'confirmed Label Rep R found', case when count(*) = 1 then 'ok' else 'NO REP: rep checks cannot run' end from rep;

-- A full release, as the Catalog screen saves it, plus rep fields.
create temp table rel as select (jsonb_build_object(
  'title', 'Iso Song', 'type', 'Single', 'album', 'Iso LP', 'epAlbum', 'Iso EP', 'releaseDate', '2026-06-01', 'status', 'Released',
  'isrc', 'GHA000000001', 'upc', '000000000001', 'label', 'IMSS Records', 'genre', 'Afrobeats', 'explicit', 'Clean', 'duration', '3:00',
  'primaryArtists', '["Iso Two"]'::jsonb, 'dolbyAtmos', false, 'lyrics', 'la', 'hasVideo', true, 'primaryMarket', 'GH', 'secondaryMarket', 'NG',
  'artworkUrl', 'https://example.invalid/a.png', 'availableFrom', '2026-06-01', 'licenseYears', 5,
  'licenseOverride', '{"endDate":"2031-01-01","by":"iso-staff","reason":"internal"}'::jsonb,
  'credits', '{"writtenBy":"W","producedBy":"P","recordingEngineer":"R","mixingEngineer":"M","masteringEngineer":"MA","dolbyEngineer":"D","internalNote":"x"}'::jsonb,
  'collaborators', '[{"name":"F","role":"Feature","splitPercent":10,"email":"f@example.invalid","phone":"1"}]'::jsonb,
  'checklist', '[{"text":"Mastering complete","done":true,"assignee":"iso-staff"},{"text":"Artwork","done":false}]'::jsonb,
  'repConfirmedAt', '2026-06-01T10:00:00Z', 'repFirstConfirmedAt', '2026-06-01T10:00:00Z', 'repSeenAt', '', 'repSentOutAt', '', 'repSentOutNote', '')
  || (select j from internal)) r;

update public.app_data set value = value || (select jsonb_build_array(jsonb_build_object('id', 'iso-rep-artist', 'name', 'Iso Rep Artist', 'status', 'Active', 'labelRep', s->>'id')) from rep)
 where key = 'roster';
select pg_temp.add('catalog', (select jsonb_build_array(
    (select r from rel) || jsonb_build_object('id', 'iso-cat-a', 'artistId', a->>'id'),
    (select r from rel) || jsonb_build_object('id', 'iso-cat-rep', 'artistId', 'iso-rep-artist')) from art));
select pg_temp.add('publishedRevenue', (select jsonb_build_array(jsonb_build_object(
    'id', 'iso-rev-a', 'artistId', a->>'id', 'artist', a->>'name', 'artistSlug', public.js_slug(a->>'name'), 'title', 'Iso Song', 'month', '2026-06',
    'earning', 10, 'quantity', 100, 'isrc', 'GHA000000001', 'upc', '000000000001', 'type', 'Single', 'releaseDate', '2026-06-01',
    'stores', '{"Spotify":10}'::jsonb, 'countries', '{"GH":10}'::jsonb, 'types', '{}'::jsonb, 'typeQty', '{}'::jsonb, 'storeStreams', '{}'::jsonb,
    'models', '{}'::jsonb, 'salesMonths', '{}'::jsonb, 'source', 'EMPIRE', 'swiftShare', 0, 'artistPct', 0.5, 'artistShare', 5, 'final', true)
    || (select j from internal)) from art));
select pg_temp.add('streams', jsonb_build_array(jsonb_build_object('id', 'iso-str', 'date', '2026-06-01', 'platform', 'Spotify', 'releaseId', 'iso-cat-a', 'count', 5)
    || (select j from internal)));
select pg_temp.add('payouts', (select jsonb_build_array(jsonb_build_object(
    'id', 'iso-pay', 'artistId', a->>'id', 'artist', a->>'name', 'artistSlug', public.js_slug(a->>'name'), 'periodStart', '2026-06', 'periodEnd', '2026-06',
    'status', 'paid', 'artistShare', 5, 'createdAt', 1, 'sentAt', '2026-07-01', 'scheduledFor', '', 'grossEarning', 10, 'swiftShare', 0, 'netAfterSwift', 10,
    'labelShare', 5, 'artistPct', 0.5, 'carriedIn', 0, 'carriedOut', 0, 'totalDue', 5, 'belowThreshold', false, 'threshold', 0)
    || (select j from internal)) from art));
select pg_temp.add('ledger', (select jsonb_build_array(jsonb_build_object(
    'id', 'iso-led', 'artistId', a->>'id', 'artist', a->>'name', 'type', 'expense', 'category', 'Marketing', 'description', 'Ads', 'amount', 5,
    'date', '2026-06-01', 'categoryId', 'iso-c') || (select j from internal)) from art));
select pg_temp.add('notices', (select jsonb_build_array(jsonb_build_object('id', 'iso-not', 'title', 'Hi', 'message', 'News', 'audience', a->>'id', 'createdAt', '2026-06-01')
    || (select j from internal)) from art));
select pg_temp.add('profileRequests', (select jsonb_build_array(jsonb_build_object('id', 'iso-pr', 'artistId', a->>'id', 'changes', '{"bio":"x"}'::jsonb,
    'status', 'Pending', 'submittedAt', '2026-06-01', 'reviewedAt', '') || (select j from internal)) from art));
select pg_temp.add('artistRequests', (select jsonb_build_array(jsonb_build_object('id', 'iso-ar', 'artistId', a->>'id', 'category', 'Other', 'title', 'T',
    'message', 'M', 'status', 'Open', 'submittedAt', '2026-06-01', 'respondedBy', 'PM', 'response', 'R', 'resolvedAt', '',
    'messages', '[{"from":"label","by":"PM","at":"2026-06-02","text":"t","via":"email","internal":"x"}]'::jsonb) || (select j from internal)) from art));
select pg_temp.add('releaseSubmissions', (select jsonb_build_array(jsonb_build_object('id', 'iso-rs', 'artistId', a->>'id', 'title', 'T', 'type', 'Single',
    'proposedDate', '2026-07-01', 'sentTo', 'PM', 'status', 'Needs info', 'submittedAt', '2026-06-01', 'splitSheet', 'doc:x', 'reviewedAt', '',
    'messages', '[{"from":"label","by":"PM","at":"2026-06-02","text":"t","internal":"x"}]'::jsonb) || (select j from internal)) from art));

select pg_temp.as_user((select a->>'email' from art), (select uid from art));
insert into got select 'artist', public.artist_portal();
select set_config('role', 'postgres', true);
select pg_temp.as_user((select s->>'email' from rep), (select uid from rep));
insert into got select 'rep', public.rep_portal();
select set_config('role', 'postgres', true);

create temp table want (sec text, keys text[]);
insert into want values
  ('catalog', array['id', 'artistId', 'title', 'type', 'releaseDate', 'status', 'isrc', 'upc', 'label', 'genre', 'explicit', 'duration',
     'primaryArtists', 'collaborators', 'credits', 'dolbyAtmos', 'lyrics', 'hasVideo', 'primaryMarket', 'secondaryMarket',
     'artworkUrl', 'checklist', 'availableFrom', 'licenseYears', 'licenseOverride']),
  ('revenue', array['id', 'artist', 'artistSlug', 'artistId', 'title', 'month', 'earning', 'quantity', 'isrc', 'upc', 'type', 'releaseDate',
     'stores', 'countries', 'types', 'typeQty', 'storeStreams', 'models', 'salesMonths', 'source', 'swiftShare', 'artistPct', 'artistShare', 'final']),
  ('streams', array['id', 'date', 'platform', 'releaseId', 'count']),
  ('payouts', array['id', 'artistId', 'artistSlug', 'periodStart', 'periodEnd', 'status', 'artistShare', 'createdAt']),
  ('ledger', array['id', 'type', 'artist', 'artistId', 'category', 'description', 'amount', 'date']),
  ('notices', array['id', 'title', 'message', 'audience', 'createdAt']),
  ('profileRequests', array['id', 'artistId', 'changes', 'status', 'submittedAt']),
  ('artistRequests', array['id', 'artistId', 'category', 'title', 'message', 'status', 'submittedAt', 'respondedBy', 'response', 'messages']),
  ('releaseSubmissions', array['id', 'artistId', 'title', 'type', 'proposedDate', 'sentTo', 'status', 'submittedAt', 'messages']),
  ('rep releases', array['id', 'artistId', 'title', 'type', 'releaseDate', 'status', 'isrc', 'upc', 'label', 'genre', 'explicit', 'duration',
     'primaryArtists', 'collaborators', 'credits', 'dolbyAtmos', 'lyrics', 'hasVideo', 'primaryMarket', 'secondaryMarket',
     'repConfirmedAt', 'repFirstConfirmedAt', 'repSeenAt', 'repSentOutAt', 'repSentOutNote']);
create temp table synth (sec text, id text);
insert into synth values ('catalog', 'iso-cat-a'), ('revenue', 'iso-rev-a'), ('streams', 'iso-str'), ('payouts', 'iso-pay'), ('ledger', 'iso-led'),
  ('notices', 'iso-not'), ('profileRequests', 'iso-pr'), ('artistRequests', 'iso-ar'), ('releaseSubmissions', 'iso-rs'), ('rep releases', 'iso-cat-rep');

create temp table sec_rows as
  select w.sec, w.keys, s.id,
         case when w.sec = 'rep releases' then (select portal->'releases' from got where who = 'rep') else (select portal->w.sec from got where who = 'artist') end arr
    from want w join synth s using (sec);

-- F1: the synthetic row is there with exactly its allowed keys (internal ones gone).
insert into chk select 'F1 ' || sec, sec || ': synthetic row has exactly the allowed keys', pg_temp.exact(pg_temp.row_of(arr, id), keys) from sec_rows;
-- F2: no row in the section, real or synthetic, carries a key outside the list.
insert into chk select 'F2 ' || sec, sec || ': every row has only allowed keys', pg_temp.only(arr, keys) from sec_rows;
-- F3: nested fields keep only what the screens print.
insert into chk select 'F3 ' || sec || ' credits', sec || ': credits keep the six credit lines only',
  pg_temp.only((select jsonb_agg(x->'credits') from jsonb_array_elements(coalesce(arr, '[]')) x where jsonb_typeof(x->'credits') = 'object'),
    array['writtenBy', 'producedBy', 'recordingEngineer', 'mixingEngineer', 'masteringEngineer', 'dolbyEngineer'])
  from sec_rows where sec in ('catalog', 'rep releases');
insert into chk select 'F3 ' || sec || ' collaborators', sec || ': collaborators keep name, role, split only',
  pg_temp.only((select jsonb_agg(c) from jsonb_array_elements(coalesce(arr, '[]')) x, jsonb_array_elements(case when jsonb_typeof(x->'collaborators') = 'array' then x->'collaborators' else '[]' end) c),
    array['name', 'role', 'splitPercent'])
  from sec_rows where sec in ('catalog', 'rep releases');
insert into chk select 'F3 catalog checklist', 'catalog: checklist items keep "done" only (task names stay internal)',
  pg_temp.only((select jsonb_agg(c) from jsonb_array_elements(coalesce(arr, '[]')) x, jsonb_array_elements(case when jsonb_typeof(x->'checklist') = 'array' then x->'checklist' else '[]' end) c), array['done'])
  from sec_rows where sec = 'catalog';
insert into chk select 'F3 catalog checklist count', 'catalog: synthetic checklist still counts 1 of 2 done (positive control)',
  case when jsonb_array_length(pg_temp.row_of(arr, id)->'checklist') = 2 and (pg_temp.row_of(arr, id)->'checklist'->0->>'done')::boolean then 'ok' else 'WRONG: ' || coalesce((pg_temp.row_of(arr, id)->'checklist')::text, 'null') end
  from sec_rows where sec = 'catalog';
insert into chk select 'F3 catalog licenseOverride', 'catalog: licence override keeps endDate only',
  pg_temp.only((select jsonb_agg(x->'licenseOverride') from jsonb_array_elements(coalesce(arr, '[]')) x where jsonb_typeof(x->'licenseOverride') = 'object'), array['endDate'])
  from sec_rows where sec = 'catalog';
insert into chk select 'F3 ' || sec || ' messages', sec || ': thread messages keep from, by, at, text, via only',
  pg_temp.only((select jsonb_agg(m) from jsonb_array_elements(coalesce(arr, '[]')) x, jsonb_array_elements(case when jsonb_typeof(x->'messages') = 'array' then x->'messages' else '[]' end) m),
    array['from', 'by', 'at', 'text', 'via'])
  from sec_rows where sec in ('artistRequests', 'releaseSubmissions');
-- F4: the top-level shape is unchanged, so the current app keeps working.
insert into chk select 'F4 artist', 'artist_portal keeps its top-level keys',
  pg_temp.exact((select portal from got where who = 'artist'), array['artist', 'catalog', 'revenue', 'masterGross', 'streams', 'songStats', 'payouts', 'ledger',
    'notices', 'labelSettings', 'profileRequests', 'artistRequests', 'releaseSubmissions', 'invoices', 'statementFiles', 'budgets', 'dealChanges']);
insert into chk select 'F4 rep', 'rep_portal keeps its top-level keys',
  pg_temp.exact((select portal from got where who = 'rep'), array['rep', 'artists', 'releases', 'invoices']);

select n, check_name, result from chk order by n;
rollback;
