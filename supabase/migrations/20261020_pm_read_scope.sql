-- Product Managers see only the artists assigned to them (roster
-- productManager = their name). For them, artist sections are not readable
-- directly; pm_read() returns only their artists' items, and pm_save() merges
-- their items back into the full section, leaving everyone else's untouched.
-- Taking a PM off an artist removes it from their next read: it is as if they
-- never had access. Admin and Legal always see every artist.

-- The signed-in PM's scope, or null for anyone else.
create or replace function private.pm_scope()
returns jsonb language sql stable security definer set search_path = '' as $$
  with me as (select private.me() m),
  mine as (
    select coalesce(array_agg(r->>'id'), '{}') ids, coalesce(array_agg(r->>'name'), '{}') names
      from me, public.app_data d, jsonb_array_elements(d.value) r
     where d.key = 'roster' and jsonb_typeof(d.value) = 'array' and coalesce(m->>'name', '') <> ''
       and lower(trim(coalesce(r->>'productManager', ''))) = lower(trim(m->>'name')))
  select case when coalesce((select m->>'role' from me), '') = 'Product Manager' then
    jsonb_build_object(
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

-- Sections a PM reads through pm_read() instead of directly.
create or replace function private.pm_scoped_key(k text, scope jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select scope is not null and (
    k in ('roster', 'rosterPublic', 'catalog', 'streams', 'artistRequests', 'profileRequests', 'releaseSubmissions', 'ledger', 'overheads')
    or (k = 'invoices' and not coalesce((scope->>'workflow')::boolean, false)));
$$;
revoke all on function private.pm_scoped_key(text, jsonb) from public, anon, authenticated;

-- Is this item one of the PM's artists'?
create or replace function private.pm_mine(k text, item jsonb, scope jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(item) = 'object' and case
    when k in ('roster', 'rosterPublic') then scope->'ids' ? coalesce(item->>'id', '')
    when k in ('catalog', 'artistRequests', 'profileRequests', 'releaseSubmissions', 'invoices') then scope->'ids' ? coalesce(item->>'artistId', '')
    when k = 'overheads' then coalesce(item->>'kind', '') = 'artist' and scope->'ids' ? coalesce(item->>'artistId', '')
    when k = 'ledger' then scope->'names' ? coalesce(item->>'artist', '')
    when k = 'streams' then scope->'releases' ? coalesce(item->>'releaseId', '')
    else false end;
$$;
revoke all on function private.pm_mine(text, jsonb, jsonb) from public, anon, authenticated;

-- What a team member may read before PM scoping (the previous can_read_section).
create or replace function private.base_can_read(k text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when k in ('revenue', 'masterGross', 'payouts', 'publishedRevenue', 'revenuePublish', 'statementFiles') then private.my_perm('royalties')
    when k in ('ledger', 'overheads', 'labelBudgets') then private.my_perm('spend')
    when k in ('roster', 'dealChanges') then private.can_see_deals()
    when k = 'invoices' then private.can_read_invoices()
    else true end;
$$;
revoke all on function private.base_can_read(text) from public, anon, authenticated;

create or replace function public.can_read_section(k text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.base_can_read(k) and not private.pm_scoped_key(k, private.pm_scope());
$$;

-- A PM's view of a section: only their artists' items.
create or replace function public.pm_read(k text)
returns table (value jsonb, updated_at timestamptz) language plpgsql stable security definer set search_path = '' as $$
declare scope jsonb := private.pm_scope();
begin
  if not public.is_team_member() or not private.pm_scoped_key(k, scope) or not private.base_can_read(k) then
    return;
  end if;
  return query
    select coalesce((select jsonb_agg(e order by ord) from jsonb_array_elements(case when jsonb_typeof(d.value) = 'array' then d.value else '[]'::jsonb end) with ordinality t(e, ord)
                      where private.pm_mine(k, e, scope)), '[]'::jsonb), d.updated_at
      from public.app_data d where d.key = k;
end $$;
revoke all on function public.pm_read(text) from public, anon;
grant execute on function public.pm_read(text) to authenticated;

-- Save a PM's view: their items replace their artists' items; everyone else's stay.
-- Returns the new version, or null when the section changed since they loaded it.
create or replace function public.pm_save(k text, v jsonb, expected timestamptz)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare scope jsonb := private.pm_scope(); cur jsonb; ver timestamptz; merged jsonb; out_ver timestamptz;
begin
  if not public.is_team_member() or not private.pm_scoped_key(k, scope) or not private.base_can_read(k) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(v) <> 'array' then raise exception 'Expected a list' using errcode = '22023'; end if;
  select d.value, d.updated_at into cur, ver from public.app_data d where d.key = k for update;
  if not found then raise exception 'Not found' using errcode = 'P0002'; end if;
  if ver is distinct from expected then return null; end if;
  if exists (select 1 from jsonb_array_elements(v) e where not private.pm_mine(k, e, scope)) then
    raise exception 'Product Managers can only change their own artists'' items' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(e order by ord), '[]'::jsonb) into merged from (
    -- everyone else's items stay; theirs are replaced (or dropped if they removed them)
    select coalesce(s.e, c.e) e, c.ord
      from jsonb_array_elements(case when jsonb_typeof(cur) = 'array' then cur else '[]'::jsonb end) with ordinality c(e, ord)
      left join lateral (select x e from jsonb_array_elements(v) x where x->>'id' = c.e->>'id' limit 1) s on true
     where not private.pm_mine(k, c.e, scope) or s.e is not null
    union all
    -- new items they added
    select s.e, 1000000000 + s.ord
      from jsonb_array_elements(v) with ordinality s(e, ord)
     where not exists (select 1 from jsonb_array_elements(case when jsonb_typeof(cur) = 'array' then cur else '[]'::jsonb end) c where c->>'id' = s.e->>'id')
  ) q;
  -- the same save rules as a direct save (approvals, permissions, PM scope)
  perform private.check_section_write(k, cur, merged);
  update public.app_data d set value = merged where d.key = k returning d.updated_at into out_ver;
  return out_ver;
end $$;
revoke all on function public.pm_save(text, jsonb, timestamptz) from public, anon;
grant execute on function public.pm_save(text, jsonb, timestamptz) to authenticated;
