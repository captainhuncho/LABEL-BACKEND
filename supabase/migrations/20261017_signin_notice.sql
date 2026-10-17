-- Every sign-in emails the person who signed in ("New sign-in ... wasn't you?"),
-- at most once per 10 minutes each (Google + passkey confirm is two sessions).
-- Watched accounts (private.signin_watch) still alert the Admins as well.
create table if not exists private.signin_notice_last (email text primary key, at timestamptz not null);
revoke all on private.signin_notice_last from public, anon, authenticated;

create or replace function private.signin_alert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare e text; w record; last timestamptz;
begin
  select lower(u.email) into e from auth.users u where u.id = new.user_id;
  if e is null then return new; end if;

  select at into last from private.signin_notice_last where email = e;
  if last is null or last < now() - interval '10 minutes' then
    insert into private.signin_notice_last (email, at) values (e, now())
      on conflict (email) do update set at = excluded.at;
    perform net.http_post(
      url := (select value from private.config where key = 'notify_url'),
      body := jsonb_build_object('action', 'signinNotice', 'email', e, 'device', left(coalesce(new.user_agent, ''), 300)),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', (select value from private.config where key = 'notify_secret')),
      timeout_milliseconds := 30000);
  end if;

  select * into w from private.signin_watch s where s.email = e and s.until > now();
  if w is not null then
    insert into public.audit_log (actor_email, actor_name, actor_kind, action, detail)
    values ('system', 'Scheduler', 'system', 'watched sign-in', w.label || ' signed in');
    perform net.http_post(
      url := (select value from private.config where key = 'notify_url'),
      body := jsonb_build_object('action', 'signinAlert', 'label', w.label),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', (select value from private.config where key = 'notify_secret')),
      timeout_milliseconds := 30000);
  end if;
  return new;
exception when others then return new; -- an email must never block a sign-in
end $$;
