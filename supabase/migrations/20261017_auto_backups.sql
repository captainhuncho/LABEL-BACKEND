-- Automatic backups: every day at 02:30 UTC a full copy of app_data (every
-- section) goes into private.app_data_archive as 'auto-YYYY-MM-DD'; copies
-- older than 30 days are deleted. Admins can list and download them.
create or replace function private.take_auto_backup()
returns void language plpgsql security definer set search_path = '' as $$
declare aid text := 'auto-' || to_char(now() at time zone 'utc', 'YYYY-MM-DD');
begin
  delete from private.app_data_archive where archive_id = aid;
  insert into private.app_data_archive (archive_id, key, value, archived_at, note)
    select aid, d.key, d.value, now(), 'Automatic daily backup' from public.app_data d;
  delete from private.app_data_archive
    where archive_id like 'auto-%' and archived_at < now() - interval '30 days';
end;
$$;
revoke all on function private.take_auto_backup() from public, anon, authenticated;

select cron.unschedule('auto-backup') where exists (select 1 from cron.job where jobname = 'auto-backup');
select cron.schedule('auto-backup', '30 2 * * *', $$select private.take_auto_backup()$$);

create or replace function public.backups_list()
returns table (archive_id text, taken_at timestamptz, sections int, note text)
language sql stable security definer set search_path = '' as $$
  select a.archive_id, max(a.archived_at), count(*)::int, max(a.note) from private.app_data_archive a
  where private.is_admin() group by a.archive_id order by max(a.archived_at) desc;
$$;
create or replace function public.backup_download(aid text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_object_agg(a.key, a.value) from private.app_data_archive a
  where private.is_admin() and a.archive_id = aid;
$$;
revoke all on function public.backups_list() from public, anon;
revoke all on function public.backup_download(text) from public, anon;
grant execute on function public.backups_list() to authenticated;
grant execute on function public.backup_download(text) to authenticated;

-- First copy straight away.
select private.take_auto_backup();
