-- Applied to production 20261016120757 (artist_deal_change_notices) before migrations were kept in the repo.
-- Recovered verbatim from supabase_migrations.schema_migrations on 2026-10-19.

create or replace function public.artist_portal()
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare
  a jsonb := public.my_artist();
  aid text; aslug text; aname text;
  rev jsonb; cat jsonb; last_pub text;
begin
  if a is null then return null; end if;
  aid := a->>'id'; aname := a->>'name'; aslug := public.js_slug(aname);

  select coalesce(jsonb_agg(r), '[]') into rev from jsonb_array_elements(public.section('publishedRevenue')) r
    where r->>'artistSlug' = aslug;
  select max(r->>'month') into last_pub from jsonb_array_elements(rev) r;
  select coalesce(jsonb_agg(c), '[]') into cat from jsonb_array_elements(public.section('catalog')) c
    where c->>'artistId' = aid;

  return jsonb_build_object(
    'artist', a,
    'catalog', cat,
    'revenue', rev,
    'masterGross', (
      select coalesce(jsonb_agg(jsonb_build_object('month', m, 'totalGross', 0, 'swiftFee', fee)), '[]')
      from (select r->>'month' m, sum(coalesce((r->>'swiftShare')::numeric, 0)) fee from jsonb_array_elements(rev) r group by 1) x),
    'streams', (select coalesce(jsonb_agg(s), '[]') from jsonb_array_elements(public.section('streams')) s
      where s->>'releaseId' in (select c->>'id' from jsonb_array_elements(cat) c)),
    'payouts', (select coalesce(jsonb_agg(p), '[]') from jsonb_array_elements(public.section('payouts')) p
      where p->>'artistSlug' = aslug and coalesce(p->>'sentAt', '') <> ''),
    'ledger', (select coalesce(jsonb_agg(l), '[]') from jsonb_array_elements(public.section('ledger')) l
      where l->>'artist' = aname and l->>'type' = 'expense' and coalesce(l->>'approvalStatus', 'Approved') = 'Approved'
        and last_pub is not null and left(coalesce(l->>'date', ''), 7) <= last_pub),
    'notices', public.section('notices'),
    'labelSettings', (select value from public.app_data where key = 'labelSettings'),
    'profileRequests', (select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(public.section('profileRequests')) x where x->>'artistId' = aid),
    'artistRequests', (select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(public.section('artistRequests')) x where x->>'artistId' = aid),
    'releaseSubmissions', (select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(public.section('releaseSubmissions')) x where x->>'artistId' = aid),
    'invoices', (select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(public.section('invoices')) x where x->>'artistId' = aid),
    'statementFiles', (select coalesce(jsonb_agg(x - 'dataUrl'), '[]') from jsonb_array_elements(public.section('statementFiles')) x
      where x->>'artistId' = aid
        and not exists (select 1 from jsonb_array_elements_text(coalesce(x->'months', '[]')) fm
                        where not exists (select 1 from jsonb_array_elements(rev) r where r->>'month' = fm))),
    -- Approved deal changes only, without internal notes' attachments or who recorded them.
    'dealChanges', (select coalesce(jsonb_agg(jsonb_build_object('id', x->>'id', 'from', x->>'from', 'artistPct', x->'artistPct',
        'fundingTier', x->>'fundingTier', 'dealType', x->>'dealType', 'was', x->'was', 'approvedAt', x->>'approvedAt')), '[]')
      from jsonb_array_elements(public.section('dealChanges')) x where x->>'artistId' = aid and x->>'status' = 'Approved')
  );
end;
$function$;

create or replace function private.app_data_events()
 returns trigger language plpgsql security definer set search_path to '' as $function$
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

  -- A deal change that reached Approved: tell the artist.
  if new.key = 'dealChanges' then
    select events || coalesce(jsonb_agg(jsonb_build_object('type', 'deal', 'key', 'dealChanges', 'id', n->>'id')), '[]')
    into events
    from jsonb_array_elements(new.value) n
    left join jsonb_array_elements(old_v) o on o->>'id' = n->>'id'
    where n->>'status' = 'Approved' and coalesce(o->>'status', '') <> 'Approved';
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
