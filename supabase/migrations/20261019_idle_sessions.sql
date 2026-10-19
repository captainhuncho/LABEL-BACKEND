-- Sign-out after 3 hours without real activity, enforced on the server too.
-- Supabase's own "inactivity timeout" (Pro plan; this project is on Free)
-- counts token refreshes, which an open tab keeps doing by itself. Instead the
-- app reports real interaction (touch_session, at most every 5 minutes while the
-- person is active; src/idleSignOut.js signs the tab out at exactly 3 hours), and
-- every 10 minutes private.end_idle_sessions() ends any session with no reported
-- activity for 3 h 10 min (the extra 10 minutes cover the 5-minute report gap).
-- Ending a session deletes it from auth.sessions, as "Sign out everywhere" does:
-- its refresh token stops working, so the tab is signed out within the hour that
-- its current access token still lasts, and the app's own check sees it sooner.

create table if not exists private.session_activity (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  last_active timestamptz not null default now()
);
revoke all on private.session_activity from public, anon, authenticated;
-- Sessions already open when this ships start their clock now, so nobody is
-- signed out by the deploy itself.
insert into private.session_activity (session_id, last_active)
  select id, now() from auth.sessions on conflict (session_id) do nothing;

create or replace function public.touch_session()
returns void language plpgsql security definer set search_path = '' as $$
declare sid uuid := nullif(auth.jwt()->>'session_id', '')::uuid;
begin
  if sid is null or not exists (select 1 from auth.sessions s where s.id = sid and s.user_id = auth.uid()) then return; end if;
  insert into private.session_activity (session_id, last_active) values (sid, now())
  on conflict (session_id) do update set last_active = now();
end $$;
revoke all on function public.touch_session() from public, anon;
grant execute on function public.touch_session() to authenticated;

create or replace function private.end_idle_sessions()
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  with idle as (
    select s.id from auth.sessions s
      left join private.session_activity a on a.session_id = s.id
     where coalesce(a.last_active, s.created_at) < now() - interval '3 hours 10 minutes')
  delete from auth.sessions s using idle where s.id = idle.id;
  get diagnostics n = row_count;
  if n > 0 then
    insert into public.audit_log (actor_email, actor_name, actor_kind, action, detail)
    values ('system', 'Scheduler', 'system', 'signed out idle sessions', n || ' session' || case when n = 1 then '' else 's' end || ' with no activity for 3 hours');
  end if;
  return n;
end $$;
revoke all on function private.end_idle_sessions() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'end-idle-sessions';
select cron.schedule('end-idle-sessions', '*/10 * * * *', 'select private.end_idle_sessions()');
