-- Daily Songstats pull (songstats edge function, action 'sync'). Runs in batches
-- of 30 songs, 5 minutes apart: each batch merges into app_data 'songStats' by
-- ISRC, and batches running at the same time could overwrite each other.
-- Five batches cover up to 150 catalog songs (121 with an ISRC today); add a
-- batch here when the catalog grows past that. About one Songstats request per
-- song a day (more for songs not found, which try their imprint label too).
create or replace function private.songstats_sync(batch_offset int)
returns void language sql security definer set search_path = '' as $$
  select net.http_post(
    url := replace((select value from private.config where key = 'notify_url'), '/notify', '/songstats'),
    body := jsonb_build_object('action', 'sync', 'offset', batch_offset, 'limit', 30),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', (select value from private.config where key = 'notify_secret')),
    timeout_milliseconds := 140000);
$$;
revoke all on function private.songstats_sync(int) from public, anon, authenticated;

-- 04:00–04:20 UTC, before the team's day
select cron.schedule('songstats-sync-0', '0 4 * * *', 'select private.songstats_sync(0)');
select cron.schedule('songstats-sync-30', '5 4 * * *', 'select private.songstats_sync(30)');
select cron.schedule('songstats-sync-60', '10 4 * * *', 'select private.songstats_sync(60)');
select cron.schedule('songstats-sync-90', '15 4 * * *', 'select private.songstats_sync(90)');
select cron.schedule('songstats-sync-120', '20 4 * * *', 'select private.songstats_sync(120)');
