-- Artist portal: published revenue, payouts and ledger lines are matched to the
-- signed-in artist by id, not by name. Before this, rows matched on
-- js_slug(name) (revenue, payouts) or the exact name (ledger), so two Roster
-- artists whose names slug the same ("A.J." and "AJ") would see each other's
-- money.
-- Rows carrying an artistId match only that artist. Older rows without one
-- fall back to the name match only while no other Roster entry (archived ones
-- included) has the same slug; otherwise they're left out (fail closed) until
-- they are republished with an id. The app stamps artistId on publish
-- (src/finance.js publishSnapshot) and refuses to publish an ambiguous name.

create or replace function private.slug_unique(s text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(s, '') <> '' and (
    select count(*) from jsonb_array_elements(public.section('roster')) a
     where jsonb_typeof(a) = 'object' and public.js_slug(coalesce(a->>'name', '')) = s) = 1;
$$;
revoke all on function private.slug_unique(text) from public, anon, authenticated;

create or replace function private.portal_row_mine(r jsonb, aid text, aslug text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case when coalesce(r->>'artistId', '') <> '' then r->>'artistId' = aid
              else r->>'artistSlug' = aslug and private.slug_unique(aslug) end;
$$;
revoke all on function private.portal_row_mine(jsonb, text, text) from public, anon, authenticated;

do $$
declare
  d text := pg_get_functiondef('public.artist_portal'::regproc);
  swaps text[][] := array[
    array['where r->>''artistSlug'' = aslug;', 'where private.portal_row_mine(r, aid, aslug);'],
    array['where p->>''artistSlug'' = aslug and', 'where private.portal_row_mine(p, aid, aslug) and'],
    array['where l->>''artist'' = aname and',
          'where (case when coalesce(l->>''artistId'', '''') <> '''' then l->>''artistId'' = aid else l->>''artist'' = aname and private.slug_unique(aslug) end) and']];
  i int;
begin
  for i in 1 .. array_length(swaps, 1) loop
    if (length(d) - length(replace(d, swaps[i][1], ''))) / length(swaps[i][1]) <> 1 then
      raise exception 'artist_portal: expected exactly one "%"', swaps[i][1];
    end if;
    d := replace(d, swaps[i][1], swaps[i][2]);
  end loop;
  execute d;
end $$;
