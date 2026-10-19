-- Applied to production 20261015210832 (artist_invoices) before migrations were kept in the repo.
-- Recovered verbatim from supabase_migrations.schema_migrations on 2026-10-19.

-- Artists can see and submit their own invoices (expense claims and service fees).
create or replace function public.artist_portal()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  a jsonb := public.my_artist();
  aid text; aslug text; aname text;
  rev jsonb; cat jsonb;
begin
  if a is null then return null; end if;
  aid := a->>'id'; aname := a->>'name'; aslug := public.js_slug(aname);

  select coalesce(jsonb_agg(r), '[]') into rev from jsonb_array_elements(public.section('revenue')) r
    where r->>'artistSlug' = aslug and coalesce(r->>'approvalStatus', 'Approved') = 'Approved';
  select coalesce(jsonb_agg(c), '[]') into cat from jsonb_array_elements(public.section('catalog')) c
    where c->>'artistId' = aid;

  return jsonb_build_object(
    'artist', a,
    'catalog', cat,
    'revenue', rev,
    -- Each month's swift fee already split to this artist's share, so the
    -- label's monthly totals never leave the database.
    'masterGross', (
      select coalesce(jsonb_agg(jsonb_build_object('month', g->>'month', 'totalGross', 0,
        'swiftFee', (g->>'swiftFee')::numeric * mine.amt / tot.amt)), '[]')
      from jsonb_array_elements(public.section('masterGross')) g
      join (select r->>'month' m, sum((r->>'earning')::numeric) amt from jsonb_array_elements(rev) r group by 1) mine on mine.m = g->>'month'
      join (select r->>'month' m, sum((r->>'earning')::numeric) amt from jsonb_array_elements(public.section('revenue')) r
            where coalesce(r->>'approvalStatus', 'Approved') = 'Approved' group by 1) tot on tot.m = g->>'month'
      where tot.amt > 0),
    'streams', (select coalesce(jsonb_agg(s), '[]') from jsonb_array_elements(public.section('streams')) s
      where s->>'releaseId' in (select c->>'id' from jsonb_array_elements(cat) c)),
    'payouts', (select coalesce(jsonb_agg(p), '[]') from jsonb_array_elements(public.section('payouts')) p where p->>'artistSlug' = aslug),
    'ledger', (select coalesce(jsonb_agg(l), '[]') from jsonb_array_elements(public.section('ledger')) l
      where l->>'artist' = aname and l->>'type' = 'expense' and coalesce(l->>'approvalStatus', 'Approved') = 'Approved'),
    'notices', public.section('notices'),
    'labelSettings', (select value from public.app_data where key = 'labelSettings'),
    'profileRequests', (select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(public.section('profileRequests')) x where x->>'artistId' = aid),
    'artistRequests', (select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(public.section('artistRequests')) x where x->>'artistId' = aid),
    'releaseSubmissions', (select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(public.section('releaseSubmissions')) x where x->>'artistId' = aid),
    'invoices', (select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(public.section('invoices')) x where x->>'artistId' = aid)
  );
end;
$$;

create or replace function public.artist_add(section_key text, item jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  a jsonb := public.my_artist();
  fresh jsonb;
begin
  if a is null then raise exception 'not an artist'; end if;
  if jsonb_typeof(item) <> 'object' or pg_column_size(item) > 3000000 then raise exception 'invalid item'; end if;
  if section_key = 'invoices' then
    if coalesce(item->>'kind', '') not in ('expense', 'service') then raise exception 'invalid invoice kind'; end if;
    if jsonb_typeof(item->'amount') <> 'number' or (item->>'amount')::numeric <= 0 then raise exception 'invalid amount'; end if;
  end if;
  fresh := case section_key
    when 'profileRequests' then item || jsonb_build_object('status', 'Pending', 'reviewedBy', '', 'reviewedAt', '')
    when 'artistRequests' then item || jsonb_build_object('status', 'Open', 'respondedBy', '', 'response', '', 'resolvedAt', '')
    when 'releaseSubmissions' then item || jsonb_build_object('status', 'Pending', 'reviewedBy', '', 'reviewedAt', '')
    when 'invoices' then item || jsonb_build_object('status', 'Pending', 'reviewedBy', '', 'reviewedAt', '', 'reviewNote', '', 'paidAt', '')
  end;
  if fresh is null then raise exception 'section not allowed'; end if;
  fresh := fresh || jsonb_build_object('artistId', a->>'id', 'submittedAt', now());

  insert into public.app_data(key, value) values (section_key, jsonb_build_array(fresh))
  on conflict (key) do update set value = jsonb_build_array(fresh) || public.section(section_key), updated_at = now();
end;
$$;
