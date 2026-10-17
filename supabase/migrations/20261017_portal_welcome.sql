-- Admin sends an artist the portal welcome email (links to artist.imssrecords.com).
-- The email itself goes out from the notify function; this checks Admin, logs it
-- in the audit log (the Portal access box reads the last send from there) and calls it.
create or replace function public.send_portal_welcome(artist_id text)
returns text language plpgsql security definer set search_path = '' as $$
declare a jsonb;
begin
  if not private.is_admin() then raise exception 'Admin only'; end if;
  select s into a from public.app_data d, jsonb_array_elements(d.value) s
   where d.key = 'roster' and jsonb_typeof(d.value) = 'array' and s->>'id' = artist_id;
  if a is null then raise exception 'No such artist'; end if;
  if coalesce(a->>'status', '') = 'Archived' then raise exception 'Artist is archived'; end if;
  if coalesce(a->>'email', '') !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'No sign-in email'; end if;
  insert into public.audit_log (actor_email, actor_name, actor_kind, action, detail, artist_id)
  values (auth.jwt()->>'email', auth.jwt()->>'email', 'team', 'sent portal welcome', 'to ' || lower(a->>'email'), artist_id);
  perform net.http_post(
    url := (select value from private.config where key = 'notify_url'),
    body := jsonb_build_object('action', 'welcome', 'artistId', artist_id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', (select value from private.config where key = 'notify_secret')),
    timeout_milliseconds := 30000);
  return lower(a->>'email');
end $$;
revoke all on function public.send_portal_welcome(text) from public, anon;
grant execute on function public.send_portal_welcome(text) to authenticated;
