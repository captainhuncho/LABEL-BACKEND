-- Sign-in alerts: when a watched email signs in (a new auth session), every
-- Admin gets a bell notification and an email. Watching ends at `until`.
create table if not exists private.signin_watch (
  email text primary key,
  label text not null,
  until timestamptz not null
);
revoke all on private.signin_watch from public, anon, authenticated;

create or replace function private.signin_alert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare e text; w record;
begin
  select lower(u.email) into e from auth.users u where u.id = new.user_id;
  select * into w from private.signin_watch s where s.email = e and s.until > now();
  if w is null then return new; end if;
  -- The notify function emails each Admin and adds the bell notification.
  insert into public.audit_log (actor_email, actor_name, actor_kind, action, detail)
  values ('system', 'Scheduler', 'system', 'watched sign-in', w.label || ' signed in');
  perform net.http_post(
    url := (select value from private.config where key = 'notify_url'),
    body := jsonb_build_object('action', 'signinAlert', 'label', w.label),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', (select value from private.config where key = 'notify_secret')),
    timeout_milliseconds := 30000);
  return new;
exception when others then return new; -- an alert must never block a sign-in
end $$;
revoke all on function private.signin_alert() from public, anon, authenticated;

drop trigger if exists signin_alert on auth.sessions;
create trigger signin_alert after insert on auth.sessions for each row execute function private.signin_alert();

insert into private.signin_watch (email, label, until)
values ('bcantopher@gmail.com', 'Ben Cantopher (walkthrough)', '2026-10-25 00:00:00+00')
on conflict (email) do update set label = excluded.label, until = excluded.until;
