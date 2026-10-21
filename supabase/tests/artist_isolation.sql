-- Two-user isolation check: artist A signed in cannot read, change or delete
-- artist B's data through any table, RPC or storage folder, and a signed-out
-- visitor (anon) gets nothing. Owner rule "Each person sees only their own data".
-- Run against a database where the migrations are applied, as the postgres user,
-- e.g. in the Supabase SQL editor. Everything runs in one transaction and is
-- rolled back (queued emails included). Uses the first two roster artists with
-- an email; adds a synthetic invoice and submission for B (rolled back).
-- Expected: every row says "ok". Anything else is a leak.
begin;
create temp table iso_ab as
  select (array_agg(a order by a->>'id'))[1] a, (array_agg(a order by a->>'id'))[2] b
    from public.app_data d, jsonb_array_elements(d.value) a
   where d.key = 'roster' and coalesce(a->>'email', '') <> '' and coalesce(a->>'status', '') <> 'Archived';
grant select on iso_ab to authenticated, anon;

-- B's own items, added as postgres so A has something to try to reach.
update public.app_data set value = coalesce(value, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
  'id', 'iso-inv-b', 'artistId', (select b->>'id' from iso_ab), 'kind', 'expense', 'amount', 10, 'status', 'Submitted', 'messages', '[]'::jsonb))
 where key = 'invoices';
update public.app_data set value = coalesce(value, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
  'id', 'iso-sub-b', 'artistId', (select b->>'id' from iso_ab), 'status', 'Pending', 'thread', '[]'::jsonb))
 where key = 'releaseSubmissions';
create temp table iso_before as
  select key, value from public.app_data where key in ('invoices', 'releaseSubmissions');

create function pg_temp.as_artist(who jsonb) returns void language sql as $f$
  select set_config('request.jwt.claims', json_build_object('email', who->>'email', 'role', 'authenticated', 'aal', 'aal2')::text, true),
         set_config('role', 'authenticated', true);
$f$;
create function pg_temp.item(k text, id text) returns jsonb language sql as $f$
  select e from public.app_data d, jsonb_array_elements(d.value) e where d.key = k and e->>'id' = id;
$f$;
create function pg_temp.try(sql text) returns text language plpgsql as $f$
begin execute sql; return 'ran';
exception when others then return 'refused: ' || sqlerrm; end $f$;
create temp table iso_result (n int, check_name text, result text);
grant insert, select on iso_result to authenticated, anon;

-- 1. Artist A: the portal holds only A's rows.
select pg_temp.as_artist((select a from iso_ab));
insert into iso_result select 1, 'portal shows only A''s items',
  case when count(*) filter (where v #>> '{}' <> (select a->>'id' from iso_ab)) = 0 then 'ok' else 'LEAK: ' || count(*) || ' items of other artists' end
  from jsonb_path_query(public.artist_portal(), 'strict $.**.artistId') v;
-- 2. A reads no app_data rows directly.
insert into iso_result select 2, 'A reads app_data directly', case when count(*) = 0 then 'ok' else 'LEAK: ' || count(*) || ' sections' end from public.app_data;
-- 3. A changes and deletes nothing directly (0 rows or refused; checked again below).
insert into iso_result select 3, 'A updates app_data directly', 'ok (' || pg_temp.try($$update public.app_data set value = value where key = 'invoices'$$) || ')';
insert into iso_result select 4, 'A deletes app_data directly', 'ok (' || pg_temp.try($$delete from public.app_data where key = 'invoices'$$) || ')';
-- 4. A's RPCs aimed at B's items do nothing to them.
select pg_temp.try($$select public.artist_reply_invoice('iso-inv-b', 'from A')$$);
select pg_temp.try($$select public.artist_resubmit_invoice('iso-inv-b', '{"amount": 999}'::jsonb)$$);
select pg_temp.try($$select public.artist_reply_submission('iso-sub-b', 'from A')$$);
-- 5. An item A adds is stamped as A's, whatever artistId it claims.
select pg_temp.try(format($$select public.artist_add('artistRequests', %L::jsonb)$$,
  jsonb_build_object('id', 'iso-req', 'artistId', (select b->>'id' from iso_ab), 'title', 'iso test')));
-- 6. A sees no storage objects in B's folders.
insert into iso_result select 5, 'A lists B''s statement/document files', case when count(*) = 0 then 'ok' else 'LEAK: ' || count(*) || ' files' end
  from storage.objects where bucket_id in ('statements', 'documents') and (storage.foldername(name))[1] = (select b->>'id' from iso_ab);
-- 7. A's notifications are all addressed to A.
insert into iso_result select 6, 'A reads others'' notifications', case when count(*) = 0 then 'ok' else 'LEAK: ' || count(*) end
  from public.notifications where lower(recipient_email) <> lower((select a->>'email' from iso_ab));
-- 8. A reads no audit log rows.
insert into iso_result select 7, 'A reads the audit log', case when count(*) = 0 then 'ok' else 'LEAK: ' || count(*) end from public.audit_log;

-- Back as postgres: B's items must be exactly as before, invoices still there,
-- and A's add must be A's.
select set_config('role', 'postgres', true);
insert into iso_result select 8, 'B''s invoice unchanged by A''s RPCs and writes',
  case when pg_temp.item('invoices', 'iso-inv-b') = (select e from iso_before, jsonb_array_elements(value) e where key = 'invoices' and e->>'id' = 'iso-inv-b') then 'ok' else 'CHANGED' end;
insert into iso_result select 9, 'B''s submission unchanged by A''s RPCs',
  case when pg_temp.item('releaseSubmissions', 'iso-sub-b') = (select e from iso_before, jsonb_array_elements(value) e where key = 'releaseSubmissions' and e->>'id' = 'iso-sub-b') then 'ok' else 'CHANGED' end;
insert into iso_result select 10, 'A''s add stamped with A''s id',
  case when not exists (select 1 from public.app_data d, jsonb_array_elements(d.value) e where d.key = 'artistRequests' and e->>'title' = 'iso test' and e->>'artistId' <> (select a->>'id' from iso_ab)) then 'ok' else 'LEAK: stored as another artist' end;

-- 9. Signed-out visitor (anon) gets nothing.
select set_config('request.jwt.claims', '{"role":"anon"}', true), set_config('role', 'anon', true);
insert into iso_result select 11, 'anon reads app_data', case when r like 'refused%' then 'ok' else 'LEAK' end from pg_temp.try('select count(*) from public.app_data') r;
insert into iso_result select 12, 'anon calls artist_portal', case when r like 'refused%' then 'ok' else 'LEAK' end from pg_temp.try('select public.artist_portal()') r;
insert into iso_result select 13, 'anon calls rep_portal', case when r like 'refused%' then 'ok' else 'LEAK' end from pg_temp.try('select public.rep_portal()') r;
insert into iso_result select 14, 'anon reads notifications', case when r like 'refused%' then 'ok' else 'LEAK' end from pg_temp.try('select count(*) from public.notifications') r;
insert into iso_result select 15, 'anon lists storage files', case when count(*) = 0 then 'ok' else 'LEAK: ' || count(*) end from storage.objects where bucket_id in ('statements', 'documents');
select set_config('role', 'postgres', true);

select n, check_name, result from iso_result order by n;
rollback;
