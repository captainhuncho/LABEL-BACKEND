-- Deal and license updates reach an artist only when Admin or Legal presses
-- "Send to artist's dashboard" (sentToArtistAt). Approval still tells Legal.
-- Deal changes approved before this were already emailed to the artist: mark them
-- sent. Runs before the trigger changes, so it sends nothing new.
update public.app_data
set value = (select jsonb_agg(case when c->>'status' = 'Approved' and c->>'kind' is null and c->>'sentToArtistAt' is null
                               then c || jsonb_build_object('sentToArtistAt', c->>'approvedAt', 'sentToArtistBy', 'already emailed') else c end
                          order by ord)
             from jsonb_array_elements(value) with ordinality as t(c, ord))
where key = 'dealChanges' and jsonb_typeof(value) = 'array' and jsonb_array_length(value) > 0;

create or replace function private.app_data_events()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  old_v jsonb := case when tg_op = 'UPDATE' then old.value else '[]'::jsonb end;
  events jsonb := '[]'::jsonb;
begin
  if new.key not in ('artistRequests', 'releaseSubmissions', 'invoices', 'payouts', 'revenuePublish', 'dealChanges') or jsonb_typeof(new.value) <> 'array' then
    return new;
  end if;
  if jsonb_typeof(old_v) <> 'array' then old_v := '[]'::jsonb; end if;

  if new.key in ('artistRequests', 'releaseSubmissions', 'invoices') then
    select events || coalesce(jsonb_agg(jsonb_build_object('type', 'new', 'key', new.key, 'id', n->>'id')), '[]')
    into events
    from jsonb_array_elements(new.value) n
    where not exists (select 1 from jsonb_array_elements(old_v) o where o->>'id' = n->>'id');
  end if;

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

  if new.key = 'revenuePublish' then
    select events || coalesce(jsonb_agg(jsonb_build_object('type', 'earnings', 'key', 'revenuePublish', 'id', n->>'id')), '[]')
    into events
    from jsonb_array_elements(new.value) n
    left join jsonb_array_elements(old_v) o on o->>'id' = n->>'id'
    where n->>'status' = 'Published' and coalesce(o->>'status', '') <> 'Published' and coalesce((n->>'silent')::boolean, false) = false;
  end if;

  if new.key = 'dealChanges' then
    -- Approved: Legal's record.
    select events || coalesce(jsonb_agg(jsonb_build_object('type', 'deal', 'key', 'dealChanges', 'id', n->>'id')), '[]')
    into events
    from jsonb_array_elements(new.value) n
    left join jsonb_array_elements(old_v) o on o->>'id' = n->>'id'
    where n->>'status' = 'Approved' and coalesce(o->>'status', '') <> 'Approved';
    -- Sent to the artist's dashboard by Admin or Legal.
    select events || coalesce(jsonb_agg(jsonb_build_object('type', 'dealSent', 'key', 'dealChanges', 'id', n->>'id')), '[]')
    into events
    from jsonb_array_elements(new.value) n
    left join jsonb_array_elements(old_v) o on o->>'id' = n->>'id'
    where coalesce(n->>'sentToArtistAt', '') <> '' and coalesce(o->>'sentToArtistAt', '') = '';
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

