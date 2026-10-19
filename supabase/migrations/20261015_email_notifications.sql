-- Applied to production 20261015220414 (email_notifications) before migrations were kept in the repo.
-- Recovered verbatim from supabase_migrations.schema_migrations on 2026-10-19.

-- Email notifications: a trigger spots new items, replies and sent statements in
-- app_data and posts small event descriptors to the `notify` Edge Function.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.config (key text primary key, value text not null);
revoke all on private.config from public, anon, authenticated;
insert into private.config(key, value) values
  ('notify_url', 'https://cdyjxhtmsugxemfcllhh.supabase.co/functions/v1/notify'),
  ('notify_secret', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (key) do nothing;

-- The Edge Function (service role) checks the shared secret it was called with.
create or replace function public.notify_secret_ok(candidate text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.config where key = 'notify_secret' and value = candidate);
$$;
revoke execute on function public.notify_secret_ok(text) from public, anon, authenticated;
grant execute on function public.notify_secret_ok(text) to service_role;

create or replace function private.app_data_events()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  old_v jsonb := case when tg_op = 'UPDATE' then old.value else '[]'::jsonb end;
  events jsonb := '[]'::jsonb;
begin
  if new.key not in ('artistRequests', 'releaseSubmissions', 'invoices', 'payouts') or jsonb_typeof(new.value) <> 'array' then
    return new;
  end if;
  if jsonb_typeof(old_v) <> 'array' then old_v := '[]'::jsonb; end if;

  -- New items (requests, submissions, invoices).
  if new.key in ('artistRequests', 'releaseSubmissions', 'invoices') then
    select events || coalesce(jsonb_agg(jsonb_build_object('type', 'new', 'key', new.key, 'id', n->>'id')), '[]')
    into events
    from jsonb_array_elements(new.value) n
    where not exists (select 1 from jsonb_array_elements(old_v) o where o->>'id' = n->>'id');
  end if;

  -- A new message on a thread, or a request's response changing.
  if new.key in ('artistRequests', 'releaseSubmissions') then
    select events || coalesce(jsonb_agg(jsonb_build_object('type', 'message', 'key', new.key, 'id', n->>'id')), '[]')
    into events
    from jsonb_array_elements(new.value) n
    join jsonb_array_elements(old_v) o on o->>'id' = n->>'id'
    where coalesce(jsonb_array_length(n->'messages'), 0) > coalesce(jsonb_array_length(o->'messages'), 0)
       or (new.key = 'artistRequests' and coalesce(n->>'response', '') <> '' and coalesce(n->>'response', '') is distinct from coalesce(o->>'response', ''));
  end if;

  -- A statement sent to an artist.
  if new.key = 'payouts' then
    select events || coalesce(jsonb_agg(jsonb_build_object('type', 'statement', 'key', 'payouts', 'id', n->>'id')), '[]')
    into events
    from jsonb_array_elements(new.value) n
    left join jsonb_array_elements(old_v) o on o->>'id' = n->>'id'
    where coalesce(n->>'sentAt', '') <> '' and coalesce(o->>'sentAt', '') = '';
  end if;

  if jsonb_array_length(events) > 0 then
    perform net.http_post(
      url := (select value from private.config where key = 'notify_url'),
      body := jsonb_build_object('action', 'events', 'events', events),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', (select value from private.config where key = 'notify_secret'))
    );
  end if;
  return new;
end;
$$;

drop trigger if exists app_data_events on public.app_data;
create trigger app_data_events after insert or update on public.app_data
  for each row execute function private.app_data_events();

-- Every 10 minutes: send statements whose scheduled time has passed.
select cron.schedule('send-due-statements', '*/10 * * * *', $c$
  select net.http_post(
    url := (select value from private.config where key = 'notify_url'),
    body := '{"action":"due"}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', (select value from private.config where key = 'notify_secret'))
  );
$c$);

-- Artists only see statements the label has sent (or paid).
create or replace function public.artist_portal()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  a jsonb := public.my_artist();
  aid text; aslug text; aname text;
  rev jsonb; cat jsonb;
begin
  if a is null then return null; end if;
  aid := a->>'id'; aname := a->>'name'; aslug := public.js_slug(aname);

  select coalesce(jsonb_agg(r), '[]') into rev from jsonb_array_elements(public.section('revenue')) r
    where r->>'artistSlug' = aslug and coalesce(r->>'approvalStatus', 'Approved') = 'Approved';
  select coalesce(jsonb_agg(c), '[]') into cat from jsonb_array_elements(public.section('catalog')) c
    where c->>'artistId' = aid;

  return jsonb_build_object(
    'artist', a,
    'catalog', cat,
    'revenue', rev,
    'masterGross', (
      select coalesce(jsonb_agg(jsonb_build_object('month', g->>'month', 'totalGross', 0,
        'swiftFee', (g->>'swiftFee')::numeric * mine.amt / tot.amt)), '[]')
      from jsonb_array_elements(public.section('masterGross')) g
      join (select r->>'month' m, sum((r->>'earning')::numeric) amt from jsonb_array_elements(rev) r group by 1) mine on mine.m = g->>'month'
      join (select r->>'month' m, sum((r->>'earning')::numeric) amt from jsonb_array_elements(public.section('revenue')) r
            where coalesce(r->>'approvalStatus', 'Approved') = 'Approved' group by 1) tot on tot.m = g->>'month'
      where tot.amt > 0),
    'streams', (select coalesce(jsonb_agg(s), '[]') from jsonb_array_elements(public.section('streams')) s
      where s->>'releaseId' in (select c->>'id' from jsonb_array_elements(cat) c)),
    'payouts', (select coalesce(jsonb_agg(p), '[]') from jsonb_array_elements(public.section('payouts')) p
      where p->>'artistSlug' = aslug and (coalesce(p->>'sentAt', '') <> '' or p->>'status' = 'paid')),
    'ledger', (select coalesce(jsonb_agg(l), '[]') from jsonb_array_elements(public.section('ledger')) l
      where l->>'artist' = aname and l->>'type' = 'expense' and coalesce(l->>'approvalStatus', 'Approved') = 'Approved'),
    'notices', public.section('notices'),
    'labelSettings', (select value from public.app_data where key = 'labelSettings'),
    'profileRequests', (select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(public.section('profileRequests')) x where x->>'artistId' = aid),
    'artistRequests', (select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(public.section('artistRequests')) x where x->>'artistId' = aid),
    'releaseSubmissions', (select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(public.section('releaseSubmissions')) x where x->>'artistId' = aid),
    'invoices', (select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(public.section('invoices')) x where x->>'artistId' = aid)
  );
end;
$$;
