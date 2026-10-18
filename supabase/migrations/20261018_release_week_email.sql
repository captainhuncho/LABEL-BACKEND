-- Every Monday 08:00 UTC: email artists (and their PM) whose release is out
-- that week, to check everything is ready (notify action "releaseWeek").
select cron.schedule('release-week', '0 8 * * 1', $$
  select net.http_post(
    url := (select value from private.config where key = 'notify_url'),
    body := '{"action":"releaseWeek"}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', (select value from private.config where key = 'notify_secret')),
    timeout_milliseconds := 30000
  );
$$);
