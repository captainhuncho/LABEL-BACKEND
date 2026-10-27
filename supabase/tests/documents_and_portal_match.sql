-- Checks for 20261022_documents_by_section.sql and
-- 20261022_artist_portal_match_by_id.sql.
-- Run as the postgres user in the Supabase SQL editor, in one transaction that
-- is rolled back. If the two migrations are not live yet, paste both of them
-- right after "begin;" so they are tried and undone with the test.
-- Expected: every row says "ok". "NOT PROVEN" means the data couldn't show
-- both an allowed and a refused case, so add a staff role and run again.
begin;

create function pg_temp.as_user(email text, sub text) returns void language sql as $f$
  select set_config('request.jwt.claims', json_build_object('email', email, 'sub', sub, 'role', 'authenticated', 'aal', 'aal2',
           'amr', json_build_array(json_build_object('method', 'totp', 'timestamp', extract(epoch from now())::bigint)))::text, true),
         set_config('role', 'authenticated', true);
$f$;
create temp table chk (n text, check_name text, result text);
grant insert, select on chk to authenticated;

-- A: the first roster artist with a confirmed account.
create temp table art as
  select a, u.id::text uid from public.app_data d, jsonb_array_elements(d.value) a, auth.users u
   where d.key = 'roster' and coalesce(a->>'email', '') <> '' and coalesce(a->>'status', '') <> 'Archived'
     and lower(u.email) = lower(a->>'email') and u.email_confirmed_at is not null
   order by a->>'id' limit 1;
grant select on art to authenticated;
insert into chk select '0', 'confirmed artist A found', case when count(*) = 1 then 'ok' else 'NO ARTIST: test cannot run' end from art;

-- ---------------------------------------------------------------- documents
-- Synthetic files: an invoice file in a folder no Product Manager has, a label
-- PDF, one in A's folder and one in another artist's folder.
insert into storage.objects (bucket_id, name) values
  ('documents', 'iso-folder/inv.pdf'), ('documents', 'iso-folder/label/stmt.pdf'),
  ('documents', (select a->>'id' from art) || '/mine.pdf'), ('documents', 'iso-other-artist/theirs.pdf');
update public.app_data set value = coalesce(value, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
  'id', 'iso-doc-inv', 'artistId', 'iso-folder', 'kind', 'expense', 'amount', 1, 'status', 'Submitted', 'attachment', 'doc:iso-folder/inv.pdf'))
 where key = 'invoices';

-- Every active staff member with a confirmed account: what they see (as
-- authenticated) must equal the section rule for that file (worked out as
-- postgres with the same session claims, as the private helpers aren't
-- callable by authenticated).
create temp table staff_seen (who text, role text, inv_seen boolean, inv_rule boolean, pdf_seen boolean, pdf_rule boolean, add_ok boolean, add_rule boolean);
do $$
declare s record; inv boolean; pdf boolean; addok boolean;
begin
  for s in select st->>'email' email, st->>'role' role, u.id::text uid
             from public.app_data d, jsonb_array_elements(d.value) st, auth.users u
            where d.key = 'staff' and coalesce(st->>'status', '') not in ('Archived', 'Inactive')
              and coalesce(st->>'role', '') <> 'Label Rep'
              and lower(u.email) = lower(st->>'email') and u.email_confirmed_at is not null loop
    perform pg_temp.as_user(s.email, s.uid);
    inv := exists (select 1 from storage.objects where bucket_id = 'documents' and name = 'iso-folder/inv.pdf');
    pdf := exists (select 1 from storage.objects where bucket_id = 'documents' and name = 'iso-folder/label/stmt.pdf');
    addok := public.team_can_add_document('iso-folder/new.pdf');
    perform set_config('role', 'postgres', true);
    insert into staff_seen values (s.email, s.role,
      inv, private.base_can_read('invoices') and private.pm_scope() is null,
      pdf, private.base_can_read('statementFiles') and private.pm_scope() is null,
      addok, (private.can_read_invoices() or private.can_see_deals()) and private.pm_scope() is null);
  end loop;
end $$;
insert into chk select 'D1 ' || who, role || ': invoice file follows the invoices rule',
  case when inv_seen = inv_rule then 'ok' else 'MISMATCH: sees=' || inv_seen || ' rule=' || inv_rule end from staff_seen;
insert into chk select 'D2 ' || who, role || ': label PDF follows the statementFiles rule',
  case when pdf_seen = pdf_rule then 'ok' else 'MISMATCH: sees=' || pdf_seen || ' rule=' || pdf_rule end from staff_seen;
insert into chk select 'D3 ' || who, role || ': adding follows invoices/deals access',
  case when add_ok = add_rule then 'ok' else 'MISMATCH: may add=' || add_ok || ' rule=' || add_rule end from staff_seen;
insert into chk select 'D4', 'some staff refused a file and some allowed it',
  case when bool_or(not inv_seen or not pdf_seen) and bool_or(inv_seen or pdf_seen) then 'ok' else 'NOT PROVEN' end from staff_seen;

-- Artist A: their own folder yes; another artist's folder and the label PDF no.
select pg_temp.as_user((select a->>'email' from art), (select uid from art));
insert into chk select 'D5', 'A sees their own document (positive control)',
  case when exists (select 1 from storage.objects where bucket_id = 'documents' and name = (select a->>'id' from art) || '/mine.pdf') then 'ok' else 'A SEES NOTHING: D6 means nothing' end;
insert into chk select 'D6', 'A sees no other artist''s documents',
  case when count(*) = 0 then 'ok' else 'LEAK: ' || count(*) end
  from storage.objects where bucket_id = 'documents' and name in ('iso-other-artist/theirs.pdf', 'iso-folder/inv.pdf', 'iso-folder/label/stmt.pdf');
select set_config('role', 'postgres', true);

-- ------------------------------------------------------------- portal match
-- B is a synthetic roster artist whose name slugs the same as A's.
update public.app_data set value = value || jsonb_build_array(jsonb_build_object(
  'id', 'iso-twin', 'name', upper((select a->>'name' from art)) || '.', 'status', 'Active'))
 where key = 'roster';
insert into chk select 'P0', 'B''s name slugs the same as A''s',
  case when public.js_slug(upper((select a->>'name' from art)) || '.') = public.js_slug((select a->>'name' from art)) then 'ok' else 'TEST SETUP: slugs differ' end;
update public.app_data set value = coalesce(value, '[]'::jsonb) || (
  select jsonb_build_array(
    jsonb_build_object('id', 'iso-rev-a', 'artistId', a->>'id', 'artistSlug', public.js_slug(a->>'name'), 'artist', a->>'name', 'month', '2026-06', 'earning', 10, 'swiftShare', 0),
    jsonb_build_object('id', 'iso-rev-b', 'artistId', 'iso-twin', 'artistSlug', public.js_slug(a->>'name'), 'artist', a->>'name', 'month', '2026-06', 'earning', 20, 'swiftShare', 0),
    jsonb_build_object('id', 'iso-rev-old', 'artistSlug', public.js_slug(a->>'name'), 'artist', a->>'name', 'month', '2026-06', 'earning', 30, 'swiftShare', 0))
  from art)
 where key = 'publishedRevenue';
update public.app_data set value = coalesce(value, '[]'::jsonb) || (
  select jsonb_build_array(jsonb_build_object('id', 'iso-pay-b', 'artistId', 'iso-twin', 'artistSlug', public.js_slug(a->>'name'), 'sentAt', '2026-07-01'))
  from art)
 where key = 'payouts';
update public.app_data set value = coalesce(value, '[]'::jsonb) || (
  select jsonb_build_array(jsonb_build_object('id', 'iso-led-b', 'artistId', 'iso-twin', 'artist', a->>'name', 'type', 'expense', 'amount', 5, 'date', '2026-06-01', 'approvalStatus', 'Approved'))
  from art)
 where key = 'ledger';

create function pg_temp.portal_ids(k text) returns text[] language sql as $f$
  select coalesce(array_agg(x->>'id'), '{}') from jsonb_array_elements(coalesce(public.artist_portal()->k, '[]')) x where x->>'id' like 'iso-%';
$f$;
create temp table seen (step text, rev text[], pay text[], led text[]);
grant insert, select on seen to authenticated;

select pg_temp.as_user((select a->>'email' from art), (select uid from art));
insert into seen select 'twins', pg_temp.portal_ids('revenue'), pg_temp.portal_ids('payouts'), pg_temp.portal_ids('ledger');
select set_config('role', 'postgres', true);
-- B leaves the roster: A's old name-only row is unambiguous again.
update public.app_data set value = (select jsonb_agg(x) from jsonb_array_elements(value) x where x->>'id' <> 'iso-twin') where key = 'roster';
select pg_temp.as_user((select a->>'email' from art), (select uid from art));
insert into seen select 'alone', pg_temp.portal_ids('revenue'), pg_temp.portal_ids('payouts'), pg_temp.portal_ids('ledger');
select set_config('role', 'postgres', true);
-- A is renamed: rows stamped with A's id still reach A.
update public.app_data set value = (select jsonb_agg(case when x->>'id' = (select a->>'id' from art) then x || '{"name": "Iso Renamed"}' else x end) from jsonb_array_elements(value) x) where key = 'roster';
select pg_temp.as_user((select a->>'email' from art), (select uid from art));
insert into seen select 'renamed', pg_temp.portal_ids('revenue'), pg_temp.portal_ids('payouts'), pg_temp.portal_ids('ledger');
select set_config('role', 'postgres', true);

insert into chk select 'P1', 'same-slug twin: A sees own id-stamped revenue (positive control)', case when 'iso-rev-a' = any(rev) then 'ok' else 'MISSING' end from seen where step = 'twins';
insert into chk select 'P2', 'same-slug twin: A doesn''t see B''s revenue', case when not 'iso-rev-b' = any(rev) then 'ok' else 'LEAK' end from seen where step = 'twins';
insert into chk select 'P3', 'same-slug twin: old name-only row held back', case when not 'iso-rev-old' = any(rev) then 'ok' else 'LEAK' end from seen where step = 'twins';
insert into chk select 'P4', 'same-slug twin: A doesn''t see B''s payout', case when not 'iso-pay-b' = any(pay) then 'ok' else 'LEAK' end from seen where step = 'twins';
insert into chk select 'P5', 'same-slug twin: A doesn''t see B''s ledger line', case when not 'iso-led-b' = any(led) then 'ok' else 'LEAK' end from seen where step = 'twins';
insert into chk select 'P6', 'no twin: old name-only row falls back to A', case when 'iso-rev-old' = any(rev) and not 'iso-rev-b' = any(rev) then 'ok' else 'WRONG: ' || rev::text end from seen where step = 'alone';
insert into chk select 'P7', 'renamed A still sees id-stamped revenue', case when 'iso-rev-a' = any(rev) and not 'iso-rev-b' = any(rev) then 'ok' else 'WRONG: ' || rev::text end from seen where step = 'renamed';

select n, check_name, result from chk order by n;
rollback;
