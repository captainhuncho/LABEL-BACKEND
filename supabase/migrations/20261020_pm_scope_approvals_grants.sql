-- 1) Function grants (SECURITY DEFINER audit, 2026-10-20). Every API-callable
--    privileged function was checked: all pin search_path, are owned by postgres
--    and check the caller. Hygiene fixes:
--    * private helpers had the default PUBLIC execute grant (not reachable through
--      the API: API roles have no USAGE on schema private, and pg_graphql isn't
--      installed), revoked anyway, and new functions no longer get it by default;
--    * public.app_data_check_write only answers inside the app_data save trigger
--      (a direct API call could otherwise use it to probe the write rules).
revoke all on function private.rate_limit(text, text, integer) from public, anon, authenticated;
revoke all on function private.app_data_events() from public, anon, authenticated;
do $$ declare f regprocedure; begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'private' and p.proname = 'valid_attachment' loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;
alter default privileges for role postgres in schema private revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from public;

create or replace function public.app_data_check_write(k text, old_v jsonb, new_v jsonb)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if pg_trigger_depth() = 0 then raise exception 'Internal function' using errcode = '42501'; end if;
  perform private.check_section_write(k, old_v, new_v);
end $$;

-- 2) Product Manager per-artist write scope, and approval steps.
--    A Product Manager (not Admin/Legal) may only add, change or remove items of
--    artists whose roster productManager is their name: catalog, artist and
--    profile requests, release submissions, the ledger (by artist name) and
--    invoices (unless they hold a queue in the invoice workflow, as in the app);
--    on the roster, only entries that are, and stay, theirs.
--    Ledger and revenue: only an Admin approves or rejects; anyone else's new or
--    edited ledger entry, and new manual revenue row, must wait as Pending.
--    EMPIRE-imported revenue rows are booked directly, as before.
create or replace function private.pm_item_ok(k text, item jsonb, ids text[], names text[], me jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select item is null or case
    when k in ('catalog', 'artistRequests', 'profileRequests', 'releaseSubmissions', 'invoices') then coalesce(item->>'artistId', '') = any(ids)
    when k = 'ledger' then coalesce(item->>'artist', '') = any(names)
    when k in ('roster', 'rosterPublic') then lower(trim(coalesce(item->>'productManager', ''))) = lower(trim(coalesce(me->>'name', '')))
    else true end;
$$;
revoke all on function private.pm_item_ok(text, jsonb, text[], text[], jsonb) from public, anon, authenticated;

do $$
declare d text := pg_get_functiondef('private.check_section_write(text,jsonb,jsonb)'::regprocedure);
  a text := '  if k = ''dataVersion'' and not admin then';
  b text := $b$  -- Product Manager: only their own artists' items (see 20261020_pm_scope_approvals_grants.sql).
  if coalesce(me->>'role', '') = 'Product Manager' and not privileged
     and k in ('catalog', 'artistRequests', 'profileRequests', 'releaseSubmissions', 'ledger', 'roster', 'rosterPublic', 'invoices')
     and not (k = 'invoices' and exists (select 1 from public.app_data d, jsonb_each(coalesce(d.value->'invoiceWorkflow', '{}'::jsonb)) w
                                          where d.key = 'labelSettings' and jsonb_typeof(w.value) = 'array' and w.value ? (me->>'id'))) then
    declare
      my_ids text[] := array(select r->>'id' from public.app_data d, jsonb_array_elements(d.value) r
                               where d.key = 'roster' and lower(trim(coalesce(r->>'productManager', ''))) = lower(trim(coalesce(me->>'name', ''))) and coalesce(me->>'name', '') <> '');
      my_names text[] := array(select r->>'name' from public.app_data d, jsonb_array_elements(d.value) r
                               where d.key = 'roster' and lower(trim(coalesce(r->>'productManager', ''))) = lower(trim(coalesce(me->>'name', ''))) and coalesce(me->>'name', '') <> '');
    begin
      if exists (
        select 1
          from jsonb_array_elements(case when jsonb_typeof(old_v) = 'array' then old_v else '[]'::jsonb end) x
          full join jsonb_array_elements(case when jsonb_typeof(new_v) = 'array' then new_v else '[]'::jsonb end) y on y->>'id' = x->>'id'
         where x is distinct from y
           and not (private.pm_item_ok(k, x, my_ids, my_names, me) and private.pm_item_ok(k, y, my_ids, my_names, me))) then
        raise exception 'Product Managers can only change their own artists'' items' using errcode = '42501';
      end if;
    end;
  end if;
  -- Approvals: only an Admin approves or rejects ledger and revenue entries.
  if k in ('ledger', 'revenue') and not admin and exists (
       select 1
         from jsonb_array_elements(case when jsonb_typeof(new_v) = 'array' then new_v else '[]'::jsonb end) y
         left join jsonb_array_elements(case when jsonb_typeof(old_v) = 'array' then old_v else '[]'::jsonb end) x on x->>'id' = y->>'id'
        where x is distinct from y
          and (
            -- flipping to Approved/Rejected
            (x is not null and coalesce(y->>'approvalStatus', 'Approved') <> coalesce(x->>'approvalStatus', 'Approved')
               and coalesce(y->>'approvalStatus', 'Approved') in ('Approved', 'Rejected'))
            -- new ledger entries, or edited ones, must wait
            or (k = 'ledger' and coalesce(y->>'approvalStatus', 'Approved') <> 'Pending'
                and (x is null or (x - array['approvalStatus', 'approvedBy', 'approvedAt']) is distinct from (y - array['approvalStatus', 'approvedBy', 'approvedAt'])))
            -- new manual revenue rows must wait (EMPIRE imports are booked directly)
            or (k = 'revenue' and x is null and coalesce(y->>'source', '') <> 'EMPIRE' and coalesce(y->>'approvalStatus', 'Approved') <> 'Pending'))) then
    raise exception 'Only an Admin approves entries; yours is saved as pending' using errcode = '42501';
  end if;
$b$;
begin
  if position('pm_item_ok' in d) > 0 then return; end if;
  if position(a in d) = 0 then raise exception 'check_section_write: anchor not found'; end if;
  d := replace(d, a, b || a);
  execute d;
end $$;
