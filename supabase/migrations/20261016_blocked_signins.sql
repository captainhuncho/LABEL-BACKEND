-- Blocked sign-ins: uninvited attempts are refused by Supabase's "Before User
-- Created" hook, which keeps just the email, method and times in a private
-- table so an Admin can allow a mistaken block. Entries are deleted after 30
-- days; repeats update one row; the list is capped at 500. Nothing is emailed.
-- The auth.users trigger (invite_only_signups) stays as a backstop.

create table if not exists private.blocked_signins (
  email text primary key,
  method text not null default 'email',
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  attempts int not null default 1
);
revoke all on private.blocked_signins from public, anon, authenticated;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_data d, jsonb_array_elements(d.value) s
    where d.key = 'staff' and jsonb_typeof(d.value) = 'array'
      and lower(s->>'email') = lower(auth.jwt()->>'email')
      and s->>'role' = 'Admin' and coalesce(s->>'status', '') <> 'Archived');
$$;
revoke all on function private.is_admin() from public, anon, authenticated;

-- The hook: allow invited emails, refuse and log everyone else.
create or replace function public.before_user_created(event jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare addr text := lower(trim(event->'user'->>'email'));
        how text := coalesce(event->'user'->'app_metadata'->>'provider', 'email');
begin
  if private.is_invited(addr) then return '{}'::jsonb; end if;
  if coalesce(addr, '') <> '' then
    insert into private.blocked_signins (email, method) values (left(addr, 320), left(how, 20))
    on conflict (email) do update set last_at = now(), attempts = private.blocked_signins.attempts + 1, method = excluded.method;
    delete from private.blocked_signins where email in (
      select email from private.blocked_signins order by last_at desc offset 500);
  end if;
  return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'invite_only'));
end;
$$;
revoke all on function public.before_user_created(jsonb) from public, anon, authenticated;
grant usage on schema private to supabase_auth_admin;
grant execute on function public.before_user_created(jsonb) to supabase_auth_admin;
grant execute on function private.is_invited(text) to supabase_auth_admin;
grant select, insert, update, delete on private.blocked_signins to supabase_auth_admin;

-- Admin-only reading and dismissing.
create or replace function public.blocked_signins_list()
returns table (email text, method text, first_at timestamptz, last_at timestamptz, attempts int)
language sql stable security definer set search_path = '' as $$
  select b.email, b.method, b.first_at, b.last_at, b.attempts from private.blocked_signins b
  where private.is_admin() order by b.last_at desc;
$$;
create or replace function public.blocked_signin_dismiss(addr text)
returns void language sql security definer set search_path = '' as $$
  delete from private.blocked_signins where private.is_admin() and email = lower(trim(addr));
$$;
revoke all on function public.blocked_signins_list() from public, anon;
revoke all on function public.blocked_signin_dismiss(text) from public, anon;
grant execute on function public.blocked_signins_list() to authenticated;
grant execute on function public.blocked_signin_dismiss(text) to authenticated;

-- An allowed email leaves the list as soon as it's on the Team list or Roster.
create or replace function private.clear_allowed_blocks()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from private.blocked_signins b where private.is_invited(b.email);
  return new;
end;
$$;
revoke all on function private.clear_allowed_blocks() from public, anon, authenticated;
drop trigger if exists clear_allowed_blocks on public.app_data;
create trigger clear_allowed_blocks after update on public.app_data
  for each row when (new.key in ('staff', 'roster') and old.value is distinct from new.value)
  execute function private.clear_allowed_blocks();

-- 30-day clean-up, daily.
select cron.unschedule('blocked-signins-cleanup') where exists (select 1 from cron.job where jobname = 'blocked-signins-cleanup');
select cron.schedule('blocked-signins-cleanup', '17 3 * * *', $$delete from private.blocked_signins where last_at < now() - interval '30 days'$$);
