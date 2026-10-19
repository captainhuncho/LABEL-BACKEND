-- Email delivery you can count on. Every batch of events the app_data trigger
-- sends to the notify function is first recorded here, in the same transaction
-- as the change (so a rolled-back save sends nothing). The function claims the
-- batch, marks each event done as it succeeds, and a failed email is retried
-- every 10 minutes, at most 5 attempts in all. An event that half-succeeded may
-- send its email twice on retry; nothing is silently lost.

create table if not exists private.email_deliveries (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  events jsonb not null,
  done int[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'sending', 'retry', 'done', 'failed')),
  attempts int not null default 0,
  claimed_at timestamptz,
  last_error text
);
revoke all on private.email_deliveries from public, anon, authenticated;
create index if not exists email_deliveries_open on private.email_deliveries (status, created_at) where status not in ('done', 'failed');

create or replace function private.new_delivery(events jsonb)
returns bigint language sql volatile security definer set search_path = '' as $$
  insert into private.email_deliveries (events) values (events) returning id;
$$;
revoke all on function private.new_delivery(jsonb) from public, anon, authenticated;

-- The trigger records the batch and passes its id along.
do $$
declare d text := pg_get_functiondef('private.app_data_events()'::regprocedure);
  a text := 'body := jsonb_build_object(''action'', ''events'', ''events'', events)';
begin
  if position('new_delivery' in d) > 0 then return; end if;
  if position(a in d) = 0 then raise exception 'app_data_events: anchor not found'; end if;
  d := replace(d, a, 'body := jsonb_build_object(''action'', ''events'', ''events'', events, ''delivery'', private.new_delivery(events))');
  execute d;
end $$;

-- Called by the notify function (service role) only.
create or replace function public.delivery_claim(delivery_id bigint)
returns jsonb language sql volatile security definer set search_path = '' as $$
  update private.email_deliveries
     set status = 'sending', attempts = attempts + 1, claimed_at = now()
   where id = delivery_id and status in ('pending', 'retry')
  returning jsonb_build_object('events', events, 'done', to_jsonb(done), 'attempts', attempts);
$$;
create or replace function public.delivery_event_done(delivery_id bigint, idx int)
returns void language sql volatile security definer set search_path = '' as $$
  update private.email_deliveries set done = array_append(done, idx) where id = delivery_id and not (idx = any(done));
$$;
create or replace function public.delivery_finish(delivery_id bigint, err text)
returns text language sql volatile security definer set search_path = '' as $$
  update private.email_deliveries
     set status = case when cardinality(done) >= jsonb_array_length(events) then 'done'
                       when attempts >= 5 then 'failed' else 'retry' end,
         last_error = err
   where id = delivery_id
  returning status;
$$;
revoke all on function public.delivery_claim(bigint), public.delivery_event_done(bigint, int), public.delivery_finish(bigint, text) from public, anon, authenticated;
grant execute on function public.delivery_claim(bigint), public.delivery_event_done(bigint, int), public.delivery_finish(bigint, text) to service_role;

-- Retry what failed, and what got stuck mid-send (the function timed out or crashed).
create or replace function private.retry_email_deliveries()
returns int language plpgsql security definer set search_path = '' as $$
declare r record; n int := 0;
begin
  update private.email_deliveries set status = 'retry'
   where status = 'sending' and claimed_at < now() - interval '10 minutes';
  update private.email_deliveries set status = 'failed', last_error = coalesce(last_error, 'gave up after 5 attempts')
   where status = 'retry' and attempts >= 5;
  for r in select id, events from private.email_deliveries
            where status = 'retry' or (status = 'pending' and created_at < now() - interval '10 minutes')
            order by id limit 50 loop
    perform net.http_post(
      url := (select value from private.config where key = 'notify_url'),
      body := jsonb_build_object('action', 'events', 'events', r.events, 'delivery', r.id),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', (select value from private.config where key = 'notify_secret')),
      timeout_milliseconds := 30000);
    n := n + 1;
  end loop;
  -- Keep a month of history.
  delete from private.email_deliveries where status in ('done', 'failed') and created_at < now() - interval '30 days';
  return n;
end $$;
revoke all on function private.retry_email_deliveries() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'email-retry';
select cron.schedule('email-retry', '*/10 * * * *', 'select private.retry_email_deliveries()');

-- Admins see deliveries that gave up (Email notifications page).
create or replace function public.email_failures()
returns table(id bigint, created_at timestamptz, events jsonb, attempts int, last_error text)
language sql stable security definer set search_path = '' as $$
  select d.id, d.created_at, d.events, d.attempts, d.last_error from private.email_deliveries d
   where private.is_admin() and d.status = 'failed' order by d.id desc limit 50;
$$;
revoke all on function public.email_failures() from public, anon;
grant execute on function public.email_failures() to authenticated;
