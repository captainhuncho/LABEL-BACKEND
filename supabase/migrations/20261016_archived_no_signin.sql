-- Archived artists and team members keep all their records but have no
-- sign-in: they don't count as invited (so their account is removed and can't
-- be recreated) and they get no access even with a still-valid session.
create or replace function private.is_invited(addr text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(addr, '') <> '' and (
    exists (select 1 from public.app_data d, jsonb_array_elements(d.value) s
            where d.key = 'staff' and jsonb_typeof(d.value) = 'array' and lower(s->>'email') = lower(addr)
              and coalesce(s->>'status', '') <> 'Archived')
    or exists (select 1 from public.app_data d, jsonb_array_elements(d.value) a
               where d.key = 'roster' and jsonb_typeof(d.value) = 'array' and lower(a->>'email') = lower(addr)
                 and coalesce(a->>'status', '') <> 'Archived'));
$$;

create or replace function public.is_team_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.app_data d, jsonb_array_elements(d.value) s
    where d.key = 'staff' and jsonb_typeof(d.value) = 'array'
      and lower(s->>'email') = lower(auth.jwt()->>'email')
      and coalesce(s->>'status', '') <> 'Archived'
  );
$$;

create or replace function public.my_artist()
returns jsonb language sql stable security definer set search_path = '' as $$
  select a from jsonb_array_elements(public.section('roster')) a
  where coalesce(a->>'email', '') <> '' and lower(a->>'email') = lower(auth.jwt()->>'email')
    and coalesce(a->>'status', '') <> 'Archived'
  limit 1;
$$;
