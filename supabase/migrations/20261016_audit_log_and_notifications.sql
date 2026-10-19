-- Applied to production 20261016122215 (audit_log_and_notifications) before migrations were kept in the repo.
-- Recovered verbatim from supabase_migrations.schema_migrations on 2026-10-19.

-- Activity audit: append-only. Written only through log_activity() (or the
-- service role); readable only by Admin and Legal staff. No update or delete for anyone.
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_email text not null,
  actor_name text not null,
  actor_kind text not null check (actor_kind in ('team', 'artist', 'system')),
  action text not null check (length(action) between 1 and 80),
  detail text not null default '' check (length(detail) <= 500),
  artist_id text,
  meta jsonb not null default '{}'::jsonb
);
create index if not exists audit_log_at_idx on public.audit_log (at desc);
create index if not exists audit_log_artist_idx on public.audit_log (artist_id, at desc);
alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;

create or replace function private.is_audit_reader() returns boolean
language sql stable security definer set search_path to '' as $$
  select exists (select 1 from jsonb_array_elements(public.section('staff')) s
    where lower(s->>'email') = lower(auth.jwt()->>'email') and s->>'role' in ('Admin', 'Legal')
      and coalesce(s->>'status', 'Active') <> 'Inactive');
$$;
grant usage on schema private to authenticated;
grant execute on function private.is_audit_reader() to authenticated;
grant select on public.audit_log to authenticated;
create policy audit_read on public.audit_log for select to authenticated using (private.is_audit_reader());

-- Who is signed in: a team member or an artist; the log records it from the
-- session, never from what the browser claims.
create or replace function public.log_activity(action text, detail text default '', artist_id text default null, meta jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path to '' as $$
declare
  em text := lower(auth.jwt()->>'email');
  member jsonb; a jsonb;
begin
  if em is null then raise exception 'not signed in'; end if;
  select s into member from jsonb_array_elements(public.section('staff')) s where lower(s->>'email') = em limit 1;
  if member is not null then
    perform private.rate_limit(em, 'audit', 600);
    insert into public.audit_log (actor_email, actor_name, actor_kind, action, detail, artist_id, meta)
    values (em, coalesce(member->>'name', em), 'team', left(action, 80), left(coalesce(detail, ''), 500), artist_id, coalesce(meta, '{}'::jsonb));
    return;
  end if;
  a := public.my_artist();
  if a is null then raise exception 'not on the team or roster'; end if;
  perform private.rate_limit(a->>'id', 'audit', 300);
  -- An artist's entries are always about themselves.
  insert into public.audit_log (actor_email, actor_name, actor_kind, action, detail, artist_id, meta)
  values (em, a->>'name', 'artist', left(action, 80), left(coalesce(detail, ''), 500), a->>'id', coalesce(meta, '{}'::jsonb));
end;
$$;
revoke all on function public.log_activity(text, text, text, jsonb) from public, anon;
grant execute on function public.log_activity(text, text, text, jsonb) to authenticated;

-- Notifications: one row per recipient. Written by the notify function (service
-- role); each signed-in person reads and marks only their own.
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  recipient_email text not null,
  title text not null,
  body text not null default '',
  tab text not null default '',
  read_at timestamptz
);
create index if not exists notifications_recipient_idx on public.notifications (lower(recipient_email), at desc);
alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
create policy notifications_own on public.notifications for select to authenticated
  using (lower(recipient_email) = lower(auth.jwt()->>'email'));

create or replace function public.mark_notifications_read(ids bigint[] default null)
returns void language sql security definer set search_path to '' as $$
  update public.notifications set read_at = now()
  where lower(recipient_email) = lower(auth.jwt()->>'email') and read_at is null
    and (ids is null or id = any(ids));
$$;
revoke all on function public.mark_notifications_read(bigint[]) from public, anon;
grant execute on function public.mark_notifications_read(bigint[]) to authenticated;
