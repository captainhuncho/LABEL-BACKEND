-- Finance and Marketing see every artist unless an Admin or Legal restricts
-- them. A restriction is a list of artist ids on their team record
-- (`artistIds`; empty or missing = all artists). Restricted members read and
-- save artist sections through the same scoped path as Product Managers
-- (pm_read / pm_save), limited to those artists. Only Admin and Legal write the
-- team list ('Only Admin and Legal change the team list'), so nobody can lift
-- their own restriction.
-- Royalty sections (revenue, money received, payouts, statements) stay
-- label-wide: every artist's banking-charge share comes from the label's
-- monthly totals. Company expenses with no artist stay visible to them too.
-- Holding a queue in the invoice workflow still means seeing every invoice.

create or replace function private.pm_scope()
returns jsonb language sql stable security definer set search_path = '' as $$
  with me as (select private.me() m),
  kind as (
    select case
      when coalesce(m->>'role', '') = 'Product Manager' then 'pm'
      when coalesce(m->>'role', '') in ('Finance', 'Marketing')
           and jsonb_typeof(m->'artistIds') = 'array' and jsonb_array_length(m->'artistIds') > 0 then 'restricted'
    end k from me),
  mine as (
    select coalesce(array_agg(r->>'id'), '{}') ids, coalesce(array_agg(r->>'name'), '{}') names
      from me, kind, public.app_data d, jsonb_array_elements(d.value) r
     where d.key = 'roster' and jsonb_typeof(d.value) = 'array' and jsonb_typeof(r) = 'object'
       and ((kind.k = 'pm' and coalesce(m->>'name', '') <> ''
             and lower(trim(coalesce(r->>'productManager', ''))) = lower(trim(m->>'name')))
         or (kind.k = 'restricted' and m->'artistIds' ? coalesce(r->>'id', ''))))
  select case when (select k from kind) is not null then
    jsonb_build_object(
      'kind', (select k from kind),
      'me', (select m from me),
      'ids', to_jsonb((select ids from mine)),
      'names', to_jsonb((select names from mine)),
      'releases', coalesce((select jsonb_agg(c->>'id') from public.app_data d, jsonb_array_elements(d.value) c
                             where d.key = 'catalog' and jsonb_typeof(d.value) = 'array'
                               and exists (select 1 from mine where c->>'artistId' = any(mine.ids))), '[]'::jsonb),
      -- holding a queue in the invoice workflow means seeing every invoice, as in the app
      'workflow', exists (select 1 from me, public.app_data d, jsonb_each(coalesce(d.value->'invoiceWorkflow', '{}'::jsonb)) w
                           where d.key = 'labelSettings' and jsonb_typeof(w.value) = 'array' and w.value ? (m->>'id')))
  end;
$$;
revoke all on function private.pm_scope() from public, anon, authenticated;

-- Is this item one of the scoped artists'? Restricted members also keep the
-- label's own expenses and overheads (no artist); PMs don't.
create or replace function private.pm_mine(k text, item jsonb, scope jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(item) = 'object' and case
    when k in ('roster', 'rosterPublic') then scope->'ids' ? coalesce(item->>'id', '')
    when k in ('catalog', 'artistRequests', 'profileRequests', 'releaseSubmissions', 'invoices') then scope->'ids' ? coalesce(item->>'artistId', '')
    when k = 'overheads' then (coalesce(item->>'kind', '') = 'artist' and scope->'ids' ? coalesce(item->>'artistId', ''))
                           or (scope->>'kind' = 'restricted' and coalesce(item->>'kind', '') <> 'artist')
    when k = 'ledger' then scope->'names' ? coalesce(item->>'artist', '')
                        or (scope->>'kind' = 'restricted' and coalesce(item->>'artist', '') = '')
    when k = 'streams' then scope->'releases' ? coalesce(item->>'releaseId', '')
    else false end;
$$;
revoke all on function private.pm_mine(text, jsonb, jsonb) from public, anon, authenticated;
