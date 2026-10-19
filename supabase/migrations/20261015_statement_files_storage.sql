-- Applied to production 20261015225744 (statement_files_storage) before migrations were kept in the repo.
-- Recovered verbatim from supabase_migrations.schema_migrations on 2026-10-19.

-- Original royalty statement files, one folder per artist: statements/<artistId>/<file>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('statements', 'statements', false, 10485760, array['text/csv', 'application/vnd.ms-excel', 'text/plain', 'application/octet-stream'])
on conflict (id) do nothing;

-- The signed-in artist's own id (nothing else), for storage policies.
create or replace function public.my_artist_id()
returns text language sql stable security definer set search_path = '' as $$
  select public.my_artist()->>'id';
$$;
revoke execute on function public.my_artist_id() from public, anon;
grant execute on function public.my_artist_id() to authenticated;

drop policy if exists "team manages statement files" on storage.objects;
create policy "team manages statement files" on storage.objects for all to authenticated
  using (bucket_id = 'statements' and (select public.is_team_member()))
  with check (bucket_id = 'statements' and (select public.is_team_member()));

drop policy if exists "artists read their statement files" on storage.objects;
create policy "artists read their statement files" on storage.objects for select to authenticated
  using (bucket_id = 'statements' and (storage.foldername(name))[1] = (select public.my_artist_id()));

-- The artist portal also returns the artist's statement file records.
do $$
declare def text;
begin
  def := replace(pg_get_functiondef('public.artist_portal()'::regprocedure),
    $q$'invoices', (select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(public.section('invoices')) x where x->>'artistId' = aid)$q$,
    $q$'invoices', (select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(public.section('invoices')) x where x->>'artistId' = aid),
    'statementFiles', (select coalesce(jsonb_agg(x - 'dataUrl'), '[]') from jsonb_array_elements(public.section('statementFiles')) x where x->>'artistId' = aid)$q$);
  execute def;
end $$;
