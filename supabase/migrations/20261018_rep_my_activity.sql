-- "My activity" for a label rep: everything they did, newest first. Only their
-- own entries (by signed-in email); the full audit log stays Admin and Legal only.
create or replace function public.rep_my_activity()
returns table(at timestamptz, action text, detail text)
language sql stable security definer set search_path = '' as $$
  select a.at, a.action, a.detail from public.audit_log a
   where private.my_rep() is not null and lower(a.actor_email) = lower(auth.jwt()->>'email')
   order by a.at desc limit 300;
$$;
revoke all on function public.rep_my_activity() from public, anon;
grant execute on function public.rep_my_activity() to authenticated;

-- Reps' own entries are recorded as "rep", not "team".
do $$
declare d text := pg_get_functiondef('public.log_activity(text,text,text,jsonb)'::regprocedure);
  a text := 'values (em, coalesce(member->>''name'', em), ''team'',';
begin
  if position(a in d) = 0 then raise exception 'log_activity: anchor not found'; end if;
  d := replace(d, a, 'values (em, coalesce(member->>''name'', em), case when member->>''role'' = ''Label Rep'' then ''rep'' else ''team'' end,');
  execute d;
end $$;
