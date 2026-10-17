-- Sign someone out on every device (ends all their sessions; they sign in
-- again with a new emailed code). Artists: Admin or that artist's Product
-- Manager. Team members and label reps: Admin. Logged in the audit log.
create or replace function public.sign_out_everywhere(kind text, target_id text)
returns int language plpgsql security definer set search_path = '' as $$
declare t jsonb; me jsonb; n int;
begin
  if not (private.on_staff_list() and private.second_factor_ok()) then raise exception 'Team only'; end if;
  select s into me from public.app_data d, jsonb_array_elements(d.value) s
   where d.key = 'staff' and lower(s->>'email') = lower(auth.jwt()->>'email') limit 1;
  select s into t from public.app_data d, jsonb_array_elements(d.value) s
   where d.key = case kind when 'artist' then 'roster' when 'staff' then 'staff' end and s->>'id' = target_id;
  if t is null then raise exception 'Not found'; end if;
  if not (private.is_admin() or (kind = 'artist' and coalesce(t->>'productManager', '') <> '' and t->>'productManager' = me->>'name')) then
    raise exception 'Admin or the artist''s Product Manager only';
  end if;
  delete from auth.sessions where user_id in (select id from auth.users where lower(email) = lower(t->>'email'));
  get diagnostics n = row_count;
  insert into public.audit_log (actor_email, actor_name, actor_kind, action, detail, artist_id)
  values (auth.jwt()->>'email', coalesce(me->>'name', auth.jwt()->>'email'), 'team', 'signed out everywhere',
          (t->>'name') || ' · ' || n || ' session(s)', case when kind = 'artist' then target_id end);
  return n;
end $$;
revoke all on function public.sign_out_everywhere(text, text) from public, anon;
grant execute on function public.sign_out_everywhere(text, text) to authenticated;
