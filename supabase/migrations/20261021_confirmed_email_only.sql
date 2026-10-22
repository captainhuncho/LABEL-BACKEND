-- Access needs a confirmed email (2026-10-21). Identity checks matched the email
-- on the sign-in token but never asked whether that email was verified, so an
-- unconfirmed sign-up (e.g. a password sign-up with someone else's address)
-- could pass as an invited person. Now every identity check also requires the
-- signed-in account's own email to be confirmed in Supabase Auth and to be the
-- email on the token. Email links/codes and Google confirm the email on use,
-- so real sign-ins are unaffected.

create or replace function private.email_confirmed()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users u
                  where u.id = auth.uid() and u.email_confirmed_at is not null
                    and lower(u.email) = lower(auth.jwt()->>'email'));
$$;
revoke all on function private.email_confirmed() from public, anon, authenticated;

-- Team and artist access (me, my_perm, is_admin, my_artist, audit reader, …) all go through this.
create or replace function private.second_factor_ok()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.email_confirmed() and (
    coalesce(auth.jwt()->>'aal', '') = 'aal2'
    or exists (select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr', '[]'::jsonb)) m
               where m->>'method' ilike '%webauthn%' or m->>'method' ilike '%passkey%'));
$$;

create or replace function private.on_staff_list()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.email_confirmed() and exists (
    select 1 from public.app_data d, jsonb_array_elements(d.value) s
    where d.key = 'staff' and jsonb_typeof(d.value) = 'array'
      and lower(s->>'email') = lower(auth.jwt()->>'email')
      and coalesce(s->>'status', '') <> 'Archived'
      and coalesce(s->>'role', '') <> 'Label Rep');
$$;

create or replace function private.rep_on_list()
returns jsonb language sql stable security definer set search_path = '' as $$
  select s from public.app_data d, jsonb_array_elements(d.value) s
  where private.email_confirmed()
    and d.key = 'staff' and jsonb_typeof(d.value) = 'array'
    and lower(s->>'email') = lower(auth.jwt()->>'email')
    and coalesce(s->>'status', '') <> 'Archived' and s->>'role' = 'Label Rep'
  limit 1;
$$;

create or replace function private.roster_artist()
returns jsonb language sql stable security definer set search_path = '' as $$
  select a from jsonb_array_elements(public.section('roster')) a
  where private.email_confirmed()
    and coalesce(a->>'email', '') <> '' and lower(a->>'email') = lower(auth.jwt()->>'email')
    and coalesce(a->>'status', '') <> 'Archived'
  limit 1;
$$;

-- Notifications are addressed by email: same rule. Row policies run as the
-- signed-in user, who can't reach the private schema, so a public wrapper that
-- only answers "is my own email confirmed".
create or replace function public.my_email_confirmed()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.email_confirmed();
$$;
revoke all on function public.my_email_confirmed() from public, anon;
grant execute on function public.my_email_confirmed() to authenticated;
alter policy notifications_own on public.notifications
  using (lower(recipient_email) = lower((select auth.jwt()->>'email')) and (select public.my_email_confirmed()));
create or replace function public.mark_notifications_read(ids bigint[] default null)
returns void language sql security definer set search_path = '' as $$
  update public.notifications set read_at = now()
   where private.email_confirmed() and lower(recipient_email) = lower(auth.jwt()->>'email')
     and read_at is null and (ids is null or id = any(ids));
$$;

-- Row-level security on every table (the 2026-10-21 RLS review; safe to run twice).
do $$
declare t text;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'private' and c.relkind = 'r' and not c.relrowsecurity loop
    execute format('alter table private.%I enable row level security', t);
  end loop;
end $$;
alter policy "team can update" on public.app_data
  using ((select public.is_team_member()) and public.can_read_section(key))
  with check ((select public.is_team_member()) and public.can_read_section(key));
