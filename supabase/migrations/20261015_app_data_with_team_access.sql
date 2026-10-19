-- Applied to production 20261015175115 (app_data_with_team_access) before migrations were kept in the repo.
-- Recovered verbatim from supabase_migrations.schema_migrations on 2026-10-19.

-- One row per dashboard section (roster, revenue, staff, ...), mirroring the app's key/value storage.
create table public.app_data (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_data enable row level security;

-- A signed-in user is a team member if their email is on the staff list.
create or replace function public.is_team_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_data d, jsonb_array_elements(d.value) s
    where d.key = 'staff'
      and jsonb_typeof(d.value) = 'array'
      and lower(s->>'email') = lower(auth.jwt()->>'email')
  );
$$;

revoke all on function public.is_team_member() from public, anon;
grant execute on function public.is_team_member() to authenticated;

create policy "team can read" on public.app_data
  for select to authenticated using ((select public.is_team_member()));
create policy "team can insert" on public.app_data
  for insert to authenticated with check ((select public.is_team_member()));
create policy "team can update" on public.app_data
  for update to authenticated using ((select public.is_team_member())) with check ((select public.is_team_member()));
