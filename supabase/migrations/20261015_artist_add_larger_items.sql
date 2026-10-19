-- Applied to production 20261015213725 (artist_add_larger_items) before migrations were kept in the repo.
-- Recovered verbatim from supabase_migrations.schema_migrations on 2026-10-19.

-- Release submissions now carry a signed split sheet (up to 2 MB) plus artwork.
create or replace function public.artist_add(section_key text, item jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  a jsonb := public.my_artist();
  fresh jsonb;
begin
  if a is null then raise exception 'not an artist'; end if;
  if jsonb_typeof(item) <> 'object' or pg_column_size(item) > 6000000 then raise exception 'invalid item'; end if;
  if section_key = 'invoices' then
    if coalesce(item->>'kind', '') not in ('expense', 'service') then raise exception 'invalid invoice kind'; end if;
    if jsonb_typeof(item->'amount') <> 'number' or (item->>'amount')::numeric <= 0 then raise exception 'invalid amount'; end if;
  end if;
  if section_key = 'releaseSubmissions' and coalesce(item->>'splitSheet', '') = '' then
    raise exception 'split sheet required';
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
