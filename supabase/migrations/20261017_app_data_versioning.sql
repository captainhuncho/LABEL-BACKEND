-- Stale-tab protection for app_data.
-- The app saves a section only if its updated_at still matches the one it
-- loaded (update ... where key = $1 and updated_at = $2), so an older tab's
-- save is refused instead of silently dropping rows added since.
-- This trigger makes updated_at move on EVERY change, including direct SQL
-- edits and RPCs that forget to set it, and stamps it with the server clock
-- (never the browser's).
create or replace function private.app_data_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;
revoke all on function private.app_data_touch() from public, anon, authenticated;

drop trigger if exists app_data_touch on public.app_data;
create trigger app_data_touch before insert or update on public.app_data
  for each row execute function private.app_data_touch();

-- Open tabs hear about changes and reload that section (RLS still applies:
-- only team members receive events).
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_data') then
    alter publication supabase_realtime add table public.app_data;
  end if;
end $$;
