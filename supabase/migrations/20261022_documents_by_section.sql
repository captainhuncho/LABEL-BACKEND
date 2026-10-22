-- Documents bucket: team access follows the section a file belongs to, not
-- just "is on the team". Before this every staff role could read and add every
-- artist's invoice files, split sheets, signed agreements and label PDFs.
-- Read: a team member may open a file when
--   - it is a label PDF statement (<artistId>/label/...) and they can read
--     statementFiles (Artist earnings), or
--   - a section they can read refers to it ("doc:<path>": invoices, release
--     submissions, deal changes, ...), using the same rules as app_data reads
--     (private.base_can_read), or
--   - they uploaded it themselves (so a file can be checked before the form
--     that refers to it is saved).
--   Product Managers and restricted Marketing (private.pm_scope()) also need the
--   file's artist folder to be one of their artists, as with pm_read.
-- Add: label PDFs need statementFiles; anything else needs invoices or deal
--   access (the team screens that upload: invoices, deal agreements); scoped
--   people only into their own artists' folders.
-- Unchanged: "artists read/add their documents", "reps read invoice files
-- sent to them". Nobody on the team updates or deletes documents.
-- The two checks live in public (like rep_can_read_document) so the storage
-- policies can call them; they only answer yes/no about the caller.

create or replace function private.doc_in_scope(object_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.pm_scope() is null
      or coalesce(private.pm_scope()->'ids' ? (storage.foldername(object_name))[1], false);
$$;
revoke all on function private.doc_in_scope(text) from public, anon, authenticated;

create or replace function public.team_can_read_document(object_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_team_member() and private.doc_in_scope(object_name) and (
    case when coalesce((storage.foldername(object_name))[2], '') = 'label'
         then private.base_can_read('statementFiles')
         else exists (select 1 from public.app_data d
                       where private.base_can_read(d.key)
                         and position(('"doc:' || object_name || '"') in d.value::text) > 0) end);
$$;
revoke all on function public.team_can_read_document(text) from public, anon;
grant execute on function public.team_can_read_document(text) to authenticated;

create or replace function public.team_can_add_document(object_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_team_member() and private.doc_in_scope(object_name) and (
    case when coalesce((storage.foldername(object_name))[2], '') = 'label'
         then private.base_can_read('statementFiles')
         else private.can_read_invoices() or private.can_see_deals() end);
$$;
revoke all on function public.team_can_add_document(text) from public, anon;
grant execute on function public.team_can_add_document(text) to authenticated;

drop policy if exists "team manages documents" on storage.objects;
drop policy if exists "team reads documents" on storage.objects;
drop policy if exists "team adds documents" on storage.objects;

create policy "team reads documents" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (
    (select public.team_can_read_document(name))
    or (owner = (select auth.uid()) and (select public.is_team_member()))));
create policy "team adds documents" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (select public.team_can_add_document(name)));
