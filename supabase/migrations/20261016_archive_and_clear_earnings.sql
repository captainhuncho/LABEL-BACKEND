-- Applied to production 20261016004238 (archive_and_clear_earnings) before migrations were kept in the repo.
-- Recovered verbatim from supabase_migrations.schema_migrations on 2026-10-19.

-- Private archive of app_data sections; not reachable through the API.
create table if not exists private.app_data_archive (
  archive_id text not null,
  key text not null,
  value jsonb not null,
  archived_at timestamptz not null default now(),
  note text,
  primary key (archive_id, key)
);
revoke all on private.app_data_archive from public, anon, authenticated;

insert into private.app_data_archive (archive_id, key, value, note)
select 'before-real-csv-2026-10-16', key, value, 'Seed earnings cleared to test a real EMPIRE CSV'
from public.app_data
where key in ('revenue', 'publishedRevenue', 'masterGross', 'payouts', 'statementFiles', 'revenuePublish');

update public.app_data set value = '[]'::jsonb, updated_at = now()
where key in ('revenue', 'publishedRevenue', 'masterGross', 'payouts', 'statementFiles', 'revenuePublish');
