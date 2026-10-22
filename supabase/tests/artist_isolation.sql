-- Two-user isolation check: artist A signed in cannot read, change or delete
-- another artist's (B's) data through any table, RPC or storage folder; an
-- unconfirmed account with A's email gets nothing; a signed-out visitor (anon)
-- gets nothing. Owner rule "Each person sees only their own data".
-- Run against a database where the migrations are applied, as the postgres user,
-- e.g. in the Supabase SQL editor. Everything runs in one transaction and is
-- rolled back (queued emails included).
-- A is the first roster artist with a confirmed sign-in account (the session
-- carries its auth id as 'sub', as access needs private.email_confirmed(), and
-- a fresh TOTP step, as some artist actions need private.second_factor_recent()).
-- B is synthetic ('iso-artist-b'): items are added for it and rolled back.
-- Positive controls (rows 1, 9, 12) prove A really has access, so the other
-- rows can't pass just because A got nothing.
-- Expected: every row says "ok". Anything else is a leak or a broken test.
begin;
create temp table iso_ab as
  select a, u.id::text uid
    from public.app_data d, jsonb_array_elements(d.value) a, auth.users u
   where d.key = 'roster' and coalesce(a->>'email', '') <> '' and coalesce(a->>'status', '') <> 'Archived'
     and lower(u.email) = lower(a->>'email') and u.email_confirmed_at is not null
   order by a->>'id' limit 1;
grant select on iso_ab to authenticated, anon;

-- Items for B and for A, added as postgres.
update public.app_data set value = coalesce(value, '[]'::jsonb) || jsonb_build_array(
  jsonb_build_object('id', 'iso-inv-b', 'artistId', 'iso-artist-b', 'kind', 'expense', 'amount', 10, 'status', 'Submitted', 'messages', '[]'::jsonb),
  jsonb_build_object('id', 'iso-inv-a', 'artistId', (select a->>'id' from iso_ab), 'kind', 'expense', 'amount', 10, 'status', 'Submitted', 'messages', '[]'::jsonb))
 where key = 'invoices';
update public.app_data set value = coalesce(value, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
  'id', 'iso-sub-b', 'artistId', 'iso-artist-b', 'status', 'Pending', 'thread', '[]'::jsonb))
 where key = 'releaseSubmissions';
create temp table iso_before as
  select key, value from public.app_data where key in ('invoices', 'releaseSubmissions');

create function pg_temp.as_user(email text, sub text) returns void language sql as $f$
  select set_config('request.jwt.claims', json_build_object('email', email, 'sub', sub, 'role', 'authenticated', 'aal', 'aal2',
           'amr', json_build_array(json_build_object('method', 'totp', 'timestamp', extract(epoch from now())::bigint)))::text, true),
         set_config('role', 'authenticated', true);
$f$;
create function pg_temp.item(k text, id text) returns jsonb language sql as $f$
  select e from public.app_data d, jsonb_array_elements(d.value) e where d.key = k and e->>'id' = id;
$f$;
create function pg_temp.was(k text, id text) returns jsonb language sql as $f$
  select e from iso_before b, jsonb_array_elements(b.value) e where b.key = k and e->>'id' = id;
$f$;
create function pg_temp.try(sql text) returns text language plpgsql as $f$
begin execute sql; return 'ran';
exception when others then return 'refused: ' || sqlerrm; end $f$;
create temp table iso_result (n int, check_name text, result text);
grant insert, select on iso_result to authenticated, anon;
insert into iso_result select 0, 'confirmed artist A found', case when count(*) = 1 then 'ok' else 'NO ARTIST WITH A CONFIRMED ACCOUNT: test cannot run' end from iso_ab;

-- Artist A, confirmed account.
select pg_temp.as_user((select a->>'email' from iso_ab), (select uid from iso_ab));
insert into iso_result select 1, 'A is recognised (positive control)',
  case when public.my_artist_id() = (select a->>'id' from iso_ab) and public.artist_portal() is not null then 'ok' else 'A GETS NO ACCESS: other rows mean nothing' end;
insert into iso_result select 2, 'portal shows only A''s items',
  case when count(*) filter (where v #>> '{}' <> (select a->>'id' from iso_ab)) = 0 then 'ok'
       else 'LEAK: ' || count(*) filter (where v #>> '{}' <> (select a->>'id' from iso_ab)) || ' items of other artists' end
  from jsonb_path_query(public.artist_portal(), 'strict $.**.artistId') v;
insert into iso_result select 3, 'A reads app_data directly', case when count(*) = 0 then 'ok' else 'LEAK: ' || count(*) || ' sections' end from public.app_data;
-- Direct writes: 0 rows or refused; row 10 checks B's invoice is intact.
insert into iso_result select 4, 'A updates app_data directly', 'ok (' || pg_temp.try($$update public.app_data set value = '[]'::jsonb where key = 'invoices'$$) || ')';
insert into iso_result select 5, 'A deletes app_data directly', 'ok (' || pg_temp.try($$delete from public.app_data where key = 'invoices'$$) || ')';
-- RPCs aimed at B's items, and one at A's own (positive control).
select pg_temp.try($$select public.artist_reply_invoice('iso-inv-b', 'from A')$$);
select pg_temp.try($$select public.artist_resubmit_invoice('iso-inv-b', '{"amount": 999}'::jsonb)$$);
select pg_temp.try($$select public.artist_reply_submission('iso-sub-b', 'from A')$$);
select pg_temp.try($$select public.artist_reply_invoice('iso-inv-a', 'from A')$$);
-- An item A adds claiming to be B's.
select pg_temp.try($$select public.artist_add('artistRequests', '{"id": "iso-req", "artistId": "iso-artist-b", "title": "iso test"}'::jsonb)$$);
insert into iso_result select 6, 'A lists other artists'' statement/document files', case when count(*) = 0 then 'ok' else 'LEAK: ' || count(*) || ' files' end
  from storage.objects where bucket_id in ('statements', 'documents') and coalesce((storage.foldername(name))[1], '') <> (select a->>'id' from iso_ab);
insert into iso_result select 7, 'A reads others'' notifications', case when count(*) = 0 then 'ok' else 'LEAK: ' || count(*) end
  from public.notifications where lower(recipient_email) <> lower((select a->>'email' from iso_ab));
insert into iso_result select 8, 'A reads the audit log', case when count(*) = 0 then 'ok' else 'LEAK: ' || count(*) end from public.audit_log;

-- Back as postgres: compare with the saved copies.
select set_config('role', 'postgres', true);
insert into iso_result select 9, 'A''s reply reached A''s own invoice (positive control)',
  case when pg_temp.item('invoices', 'iso-inv-a') is distinct from pg_temp.was('invoices', 'iso-inv-a') then 'ok' else 'A''S OWN REPLY DID NOTHING: rows 10-11 mean nothing' end;
insert into iso_result select 10, 'B''s invoice unchanged by A''s RPCs and writes',
  case when pg_temp.item('invoices', 'iso-inv-b') = pg_temp.was('invoices', 'iso-inv-b') then 'ok' else 'CHANGED' end;
insert into iso_result select 11, 'B''s submission unchanged by A''s RPCs',
  case when pg_temp.item('releaseSubmissions', 'iso-sub-b') = pg_temp.was('releaseSubmissions', 'iso-sub-b') then 'ok' else 'CHANGED' end;
insert into iso_result select 12, 'A''s add stored, stamped with A''s id (positive control)',
  case when exists (select 1 from public.app_data d, jsonb_array_elements(d.value) e where d.key = 'artistRequests' and e->>'title' = 'iso test' and e->>'artistId' = (select a->>'id' from iso_ab))
        and not exists (select 1 from public.app_data d, jsonb_array_elements(d.value) e where d.key = 'artistRequests' and e->>'title' = 'iso test' and e->>'artistId' <> (select a->>'id' from iso_ab))
       then 'ok' else 'NOT STORED AS A''S' end;

-- An account with A's email but not A's confirmed account gets nothing.
select pg_temp.as_user((select a->>'email' from iso_ab), gen_random_uuid()::text);
insert into iso_result select 13, 'unconfirmed account with A''s email', case when public.my_artist_id() is null then 'ok' else 'LEAK: treated as A' end;
insert into iso_result select 14, 'unconfirmed account calls artist_portal',
  case when r like 'refused%' then 'ok' when public.artist_portal() is null then 'ok' else 'LEAK' end from pg_temp.try('select public.artist_portal()') r;
select set_config('role', 'postgres', true);

-- Signed-out visitor (anon) gets nothing.
select set_config('request.jwt.claims', '{"role":"anon"}', true), set_config('role', 'anon', true);
insert into iso_result select 15, 'anon reads app_data', case when r like 'refused%' then 'ok' else 'LEAK' end from pg_temp.try('select count(*) from public.app_data') r;
insert into iso_result select 16, 'anon calls artist_portal', case when r like 'refused%' then 'ok' else 'LEAK' end from pg_temp.try('select public.artist_portal()') r;
insert into iso_result select 17, 'anon calls rep_portal', case when r like 'refused%' then 'ok' else 'LEAK' end from pg_temp.try('select public.rep_portal()') r;
insert into iso_result select 18, 'anon reads notifications', case when r like 'refused%' then 'ok' else 'LEAK' end from pg_temp.try('select count(*) from public.notifications') r;
insert into iso_result select 19, 'anon lists storage files', case when count(*) = 0 then 'ok' else 'LEAK: ' || count(*) end from storage.objects where bucket_id in ('statements', 'documents');
select set_config('role', 'postgres', true);

select n, check_name, result from iso_result order by n;
rollback;
