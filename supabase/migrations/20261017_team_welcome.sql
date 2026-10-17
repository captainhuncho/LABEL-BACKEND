-- Admin sends a team member or label rep their welcome email: where to sign in
-- (ops.imssrecords.com) and how. Same pattern as send_portal_welcome for artists.
create or replace function public.send_team_welcome(staff_id text)
returns text language plpgsql security definer set search_path = '' as $$
declare m jsonb;
begin
  if not private.is_admin() then raise exception 'Admin only'; end if;
  select s into m from public.app_data d, jsonb_array_elements(d.value) s
   where d.key = 'staff' and jsonb_typeof(d.value) = 'array' and s->>'id' = staff_id;
  if m is null then raise exception 'No such team member'; end if;
  if coalesce(m->>'status', '') = 'Archived' then raise exception 'Archived'; end if;
  if coalesce(m->>'email', '') !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'No sign-in email'; end if;
  insert into public.audit_log (actor_email, actor_name, actor_kind, action, detail)
  values (auth.jwt()->>'email', auth.jwt()->>'email', 'team', 'sent team welcome', (m->>'name') || ' · ' || coalesce(m->>'role', ''));
  perform net.http_post(
    url := (select value from private.config where key = 'notify_url'),
    body := jsonb_build_object('action', 'teamWelcome', 'staffId', staff_id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', (select value from private.config where key = 'notify_secret')),
    timeout_milliseconds := 30000);
  return lower(m->>'email');
end $$;
revoke all on function public.send_team_welcome(text) from public, anon;
grant execute on function public.send_team_welcome(text) to authenticated;
