-- "My activity" for an artist: everything they did in the portal, newest first.
-- Only their own entries (by signed-in email); the full audit log stays Admin and Legal only.
create or replace function public.artist_my_activity()
returns table(at timestamptz, action text, detail text)
language sql stable security definer set search_path = '' as $$
  select a.at, a.action, a.detail from public.audit_log a
   where public.my_artist() is not null and lower(a.actor_email) = lower(auth.jwt()->>'email')
   order by a.at desc limit 300;
$$;
revoke all on function public.artist_my_activity() from public, anon;
grant execute on function public.artist_my_activity() to authenticated;
