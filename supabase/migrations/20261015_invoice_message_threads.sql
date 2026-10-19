-- Applied to production 20261015233154 (invoice_message_threads) before migrations were kept in the repo.
-- Recovered verbatim from supabase_migrations.schema_migrations on 2026-10-19.

create or replace function public.artist_reply_invoice(invoice_id text, message text)
returns void language plpgsql security definer set search_path to '' as $$
declare
  a jsonb := public.my_artist();
  updated jsonb;
begin
  if a is null then raise exception 'not an artist'; end if;
  perform private.rate_limit(a->>'id', 'reply', 30);
  if coalesce(trim(message), '') = '' or length(message) > 5000 then raise exception 'invalid message'; end if;
  select jsonb_agg(case
    when s->>'id' = invoice_id and s->>'artistId' = a->>'id' and coalesce(s->>'status','') <> 'Paid' then
      s || jsonb_build_object('messages', coalesce(s->'messages', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('from', 'artist', 'by', a->>'name', 'at', now(), 'text', trim(message))))
    else s end order by ord)
  into updated
  from jsonb_array_elements(public.section('invoices')) with ordinality t(s, ord);
  if updated is null or updated = public.section('invoices') then raise exception 'invoice not found'; end if;
  update public.app_data set value = updated, updated_at = now() where key = 'invoices';
end;
$$;
revoke all on function public.artist_reply_invoice(text, text) from public, anon;
grant execute on function public.artist_reply_invoice(text, text) to authenticated;

create or replace function private.app_data_events()
 returns trigger language plpgsql security definer set search_path to '' as $function$
declare
  old_v jsonb := case when tg_op = 'UPDATE' then old.value else '[]'::jsonb end;
  events jsonb := '[]'::jsonb;
begin
  if new.key not in ('artistRequests', 'releaseSubmissions', 'invoices', 'payouts') or jsonb_typeof(new.value) <> 'array' then
    return new;
  end if;
  if jsonb_typeof(old_v) <> 'array' then old_v := '[]'::jsonb; end if;

  if new.key in ('artistRequests', 'releaseSubmissions', 'invoices') then
    select events || coalesce(jsonb_agg(jsonb_build_object('type', 'new', 'key', new.key, 'id', n->>'id')), '[]')
    into events
    from jsonb_array_elements(new.value) n
    where not exists (select 1 from jsonb_array_elements(old_v) o where o->>'id' = n->>'id');
  end if;

  -- A new message on a thread, or a request's response changing.
  if new.key in ('artistRequests', 'releaseSubmissions', 'invoices') then
    select events || coalesce(jsonb_agg(jsonb_build_object('type', 'message', 'key', new.key, 'id', n->>'id')), '[]')
    into events
    from jsonb_array_elements(new.value) n
    join jsonb_array_elements(old_v) o on o->>'id' = n->>'id'
    where coalesce(jsonb_array_length(n->'messages'), 0) > coalesce(jsonb_array_length(o->'messages'), 0)
       or (new.key = 'artistRequests' and coalesce(n->>'response', '') <> '' and coalesce(n->>'response', '') is distinct from coalesce(o->>'response', ''));
  end if;

  if new.key = 'invoices' then
    select events || coalesce(jsonb_agg(jsonb_build_object('type', 'stage', 'key', 'invoices', 'id', n->>'id')), '[]')
    into events
    from jsonb_array_elements(new.value) n
    join jsonb_array_elements(old_v) o on o->>'id' = n->>'id'
    where coalesce(n->>'status', '') is distinct from coalesce(o->>'status', '');
  end if;

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
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', (select value from private.config where key = 'notify_secret')),
      timeout_milliseconds := 30000
    );
  end if;
  return new;
end;
$function$;
