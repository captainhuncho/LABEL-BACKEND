-- Two-factor for the team, enforced by the database: a team member's session
-- only reaches data after the 6-digit authenticator code (aal2) or a passkey
-- sign-in. my_access() still recognises them before that, so the app can ask
-- for the code (or set it up). Artists are optional and not enforced here.
create or replace function private.on_staff_list()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.app_data d, jsonb_array_elements(d.value) s
    where d.key = 'staff' and jsonb_typeof(d.value) = 'array'
      and lower(s->>'email') = lower(auth.jwt()->>'email')
      and coalesce(s->>'status', '') <> 'Archived');
$$;
create or replace function private.second_factor_ok()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt()->>'aal', '') = 'aal2'
    or exists (select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr', '[]'::jsonb)) m
               where m->>'method' ilike '%webauthn%' or m->>'method' ilike '%passkey%');
$$;
revoke all on function private.on_staff_list() from public, anon, authenticated;
revoke all on function private.second_factor_ok() from public, anon, authenticated;

create or replace function public.is_team_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.on_staff_list() and private.second_factor_ok();
$$;

create or replace function public.my_access()
returns text language sql stable security definer set search_path = '' as $$
  select case when private.on_staff_list() then 'team' when public.my_artist() is not null then 'artist' end;
$$;

-- Admin-only server features (backups, blocked sign-ins) need the second factor too.
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.second_factor_ok() and exists (select 1 from public.app_data d, jsonb_array_elements(d.value) s
    where d.key = 'staff' and jsonb_typeof(d.value) = 'array'
      and lower(s->>'email') = lower(auth.jwt()->>'email')
      and s->>'role' = 'Admin' and coalesce(s->>'status', '') <> 'Archived');
$$;
