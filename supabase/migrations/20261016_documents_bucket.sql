-- Private bucket for documents: invoice attachments, split sheets, signed
-- agreements (under <artistId>/) and the label's PDF statements (under
-- <artistId>/label/, team only). Files open through 2-minute signed links.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "team manages documents" on storage.objects for all to authenticated
  using (bucket_id = 'documents' and (select public.is_team_member()))
  with check (bucket_id = 'documents' and (select public.is_team_member()));

-- Artists read and add files in their own folder, never the label's PDF statements.
create policy "artists read their documents" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select public.my_artist_id())
         and coalesce((storage.foldername(name))[2], '') <> 'label');
create policy "artists add their documents" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select public.my_artist_id())
              and coalesce((storage.foldername(name))[2], '') <> 'label');

-- The artist portal leaves the label's PDF statements out.
do $$
declare d text := pg_get_functiondef('public.artist_portal'::regproc);
begin
  if (length(d) - length(replace(d, 'public.section(''statementFiles'')', ''))) / length('public.section(''statementFiles'')') <> 1 then
    raise exception 'artist_portal: expected one statementFiles reference';
  end if;
  execute replace(d, 'public.section(''statementFiles'')',
    '(select coalesce(jsonb_agg(y), ''[]''::jsonb) from jsonb_array_elements(public.section(''statementFiles'')) y where coalesce(y->>''kind'', '''') <> ''pdf'')');
end $$;
