-- Artists need a second step too (passkey or authenticator code), enforced here:
-- my_artist() only finds the artist once the session has it, so the portal,
-- requests and their documents all stay closed until then. my_access() still
-- says 'artist' first, so the app can ask for the passkey or code.
-- Invoices and profile changes (payout details) also need that step within the
-- last 10 minutes.
create or replace function private.roster_artist()
returns jsonb language sql stable security definer set search_path = '' as $$
  select a from jsonb_array_elements(public.section('roster')) a
  where coalesce(a->>'email', '') <> '' and lower(a->>'email') = lower(auth.jwt()->>'email')
    and coalesce(a->>'status', '') <> 'Archived'
  limit 1;
$$;
create or replace function private.second_factor_recent()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr', '[]'::jsonb)) m
    where (m->>'method' ilike '%webauthn%' or m->>'method' ilike '%passkey%' or m->>'method' = 'totp')
      and coalesce((m->>'timestamp')::bigint, 0) > extract(epoch from now()) - 600);
$$;
revoke all on function private.roster_artist() from public, anon, authenticated;
revoke all on function private.second_factor_recent() from public, anon, authenticated;

create or replace function public.my_artist()
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when private.second_factor_ok() then private.roster_artist() end;
$$;
revoke all on function public.my_artist() from public, anon, authenticated;

create or replace function public.my_access()
returns text language sql stable security definer set search_path = '' as $$
  select case when private.on_staff_list() then 'team' when private.roster_artist() is not null then 'artist' end;
$$;

do $$
declare d text := pg_get_functiondef('public.artist_add(text,jsonb)'::regprocedure);
  anchor text := 'if a is null then raise exception ''not an artist''; end if;';
begin
  if position(anchor in d) = 0 then raise exception 'artist_add: anchor not found'; end if;
  execute overlay(d placing anchor || E'\n  if section_key in (''invoices'', ''profileRequests'') and not private.second_factor_recent() then raise exception ''confirm_identity''; end if;'
    from position(anchor in d) for length(anchor));
end $$;
