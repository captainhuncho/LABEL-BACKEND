-- Role-by-section checks for app_data write rules (20261019_section_rules_all.sql).
-- Run against a database where the migrations are applied, as the postgres user,
-- e.g. in the Supabase SQL editor. Everything runs in one transaction and is
-- rolled back. Uses the first active staff member of each role, so the staff list
-- needs an Admin, a Product Manager and (optionally) other roles.
-- Expected: PM denied for notices, junk sections, staff, data version, wiping the
-- activity log, moving/correcting/deleting an invoice; allowed for catalog, tasks,
-- appending to the activity log, adding an invoice. Admin allowed except junk
-- sections. The write through a SECURITY DEFINER function is allowed.
begin;
create function pg_temp.as_role(who text, label text, k text, newv jsonb) returns text language plpgsql as $f$
declare res text;
begin
  perform set_config('request.jwt.claims', json_build_object('email', (select s->>'email' from public.app_data d, jsonb_array_elements(d.value) s where d.key='staff' and s->>'role'=who and coalesce(s->>'status','') not in ('Archived','Inactive') limit 1), 'role','authenticated','aal','aal2')::text, true);
  perform set_config('role', 'authenticated', true);
  begin
    update public.app_data set value = newv where key = k; if not found then insert into public.app_data(key, value) values (k, newv); end if;
    res := 'allowed'; raise exception 'undo';
  exception when others then if res is null then res := 'denied: ' || sqlerrm; end if; end;
  perform set_config('role', 'postgres', true);
  return who || ' / ' || label || ' -> ' || res;
end $f$;
create function pg_temp.definer_write(k text, newv jsonb) returns void language plpgsql security definer as $f$
begin update public.app_data set value = newv where key = k; end $f$;
grant execute on function pg_temp.definer_write(text, jsonb) to authenticated;
create function pg_temp.via_definer(who text) returns text language plpgsql as $f$
declare res text;
begin
  perform set_config('request.jwt.claims', json_build_object('email', (select s->>'email' from public.app_data d, jsonb_array_elements(d.value) s where d.key='staff' and s->>'role'=who limit 1), 'role','authenticated','aal','aal2')::text, true);
  perform set_config('role', 'authenticated', true);
  begin perform pg_temp.definer_write('notices', (select value from public.app_data where key='notices') || '[{"id":"zz"}]'); res := 'allowed'; raise exception 'undo';
  exception when others then if res is null then res := 'denied: ' || sqlerrm; end if; end;
  perform set_config('role', 'postgres', true);
  return who || ' / notice via artist-style function -> ' || res;
end $f$;
-- a synthetic invoice to move (rolled back)
update public.app_data set value = '[{"id":"tinv","artistId":"x","status":"Finance Queue","amount":10}]' where key='invoices';
select r from (values
 (pg_temp.as_role('Product Manager','add notice','notices', (select value from public.app_data where key='notices') || '[{"id":"zz"}]')),
 (pg_temp.as_role('Admin','add notice','notices', (select value from public.app_data where key='notices') || '[{"id":"zz"}]')),
 (pg_temp.via_definer('Product Manager')),
 (pg_temp.as_role('Product Manager','junk section','probeJunk','[]'::jsonb)),
 (pg_temp.as_role('Admin','junk section','probeJunk','[]'::jsonb)),
 (pg_temp.as_role('Product Manager','edit staff','staff', (select jsonb_set(value,'{0,bio}','"x"') from public.app_data where key='staff'))),
 (pg_temp.as_role('Product Manager','data version','dataVersion','"x"'::jsonb)),
 (pg_temp.as_role('Product Manager','catalog edit','catalog', (select value || '[{"id":"zz"}]' from public.app_data where key='catalog'))),
 (pg_temp.as_role('Product Manager','task add','tasks', (select value || '[{"id":"zz"}]' from public.app_data where key='tasks'))),
 (pg_temp.as_role('Product Manager','activity append','activityLog', (select '[{"id":"zz"}]'::jsonb || value from public.app_data where key='activityLog'))),
 (pg_temp.as_role('Product Manager','activity wipe','activityLog','[]'::jsonb)),
 (pg_temp.as_role('Product Manager','invoice to Paid','invoices','[{"id":"tinv","artistId":"x","status":"Paid","amount":10}]'::jsonb)),
 (pg_temp.as_role('Product Manager','invoice amount','invoices','[{"id":"tinv","artistId":"x","status":"Finance Queue","amount":999}]'::jsonb)),
 (pg_temp.as_role('Product Manager','invoice delete','invoices','[]'::jsonb)),
 (pg_temp.as_role('Product Manager','invoice add','invoices','[{"id":"tinv","artistId":"x","status":"Finance Queue","amount":10},{"id":"new1","artistId":"x","status":"Submitted","amount":5}]'::jsonb)),
 (pg_temp.as_role('Admin','invoice to Paid','invoices','[{"id":"tinv","artistId":"x","status":"Paid","amount":10}]'::jsonb)),
 (pg_temp.as_role('Other','add notice','notices', (select value from public.app_data where key='notices') || '[{"id":"zz"}]')),
 (pg_temp.as_role('Product Manager','revenue (existing rule)','revenue', (select value || '[{"id":"zz"}]' from public.app_data where key='revenue')))
) t(r);
rollback;
