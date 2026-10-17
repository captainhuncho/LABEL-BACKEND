-- Label Rep: an outside partner on the Team list with role 'Label Rep'.
-- They sign in to ops like the team (invite only, second step required) but are
-- NOT team members to the database: is_team_member() is false for them, so they
-- can't read app_data. rep_portal() hands them only their artists' releases a
-- PM confirmed (repConfirmedAt) and invoices pushed to them (sentToRepAt).
-- rep_mark_sent() lets them move a pushed invoice to DP Queue.

create or replace function private.on_staff_list()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.app_data d, jsonb_array_elements(d.value) s
    where d.key = 'staff' and jsonb_typeof(d.value) = 'array'
      and lower(s->>'email') = lower(auth.jwt()->>'email')
      and coalesce(s->>'status', '') <> 'Archived'
      and coalesce(s->>'role', '') <> 'Label Rep');
$$;

create or replace function private.rep_on_list()
returns jsonb language sql stable security definer set search_path = '' as $$
  select s from public.app_data d, jsonb_array_elements(d.value) s
  where d.key = 'staff' and jsonb_typeof(d.value) = 'array'
    and lower(s->>'email') = lower(auth.jwt()->>'email')
    and coalesce(s->>'status', '') <> 'Archived' and s->>'role' = 'Label Rep'
  limit 1;
$$;
create or replace function private.my_rep()
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when private.second_factor_ok() then private.rep_on_list() end;
$$;
revoke all on function private.rep_on_list() from public, anon, authenticated;
revoke all on function private.my_rep() from public, anon, authenticated;

create or replace function public.my_access()
returns text language sql stable security definer set search_path = '' as $$
  select case when private.on_staff_list() then 'team'
              when private.rep_on_list() is not null then 'rep'
              when private.roster_artist() is not null then 'artist' end;
$$;

create or replace function public.rep_portal()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r jsonb := private.my_rep(); ids text[];
begin
  if r is null then return null; end if;
  select coalesce(array_agg(a->>'id'), '{}') into ids from jsonb_array_elements(public.section('roster')) a
    where a->>'labelRep' = r->>'id' and coalesce(a->>'status', '') <> 'Archived';
  return jsonb_build_object(
    'rep', jsonb_build_object('id', r->>'id', 'name', r->>'name', 'company', r->>'company'),
    'artists', (select coalesce(jsonb_agg(jsonb_build_object('id', a->>'id', 'name', a->>'name')), '[]') from jsonb_array_elements(public.section('roster')) a where a->>'id' = any(ids)),
    'releases', (select coalesce(jsonb_agg(c - 'notes' - 'checklist' - 'tasks'), '[]') from jsonb_array_elements(public.section('catalog')) c
      where c->>'artistId' = any(ids) and coalesce(c->>'repConfirmedAt', '') <> ''),
    'invoices', (select coalesce(jsonb_agg(jsonb_build_object('id', i->>'id', 'artistId', i->>'artistId', 'title', i->>'title', 'kind', i->>'kind', 'amount', i->'amount',
        'currency', i->>'currency', 'details', i->>'details', 'status', i->>'status', 'submittedAt', i->>'submittedAt', 'sentToRepAt', i->>'sentToRepAt',
        'repSentAt', i->>'repSentAt', 'repRef', i->>'repRef', 'paidAt', i->>'paidAt', 'invoiceNumber', i->>'invoiceNumber', 'payee', i->>'payee', 'lines', i->'lines')), '[]')
      from jsonb_array_elements(public.section('invoices')) i
      where i->>'artistId' = any(ids) and coalesce(i->>'sentToRepAt', '') <> '')
  );
end $$;
revoke all on function public.rep_portal() from public, anon;
grant execute on function public.rep_portal() to authenticated;

create or replace function public.rep_mark_sent(invoice_id text, ref text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare r jsonb := private.my_rep(); inv jsonb; ok boolean;
begin
  if r is null then raise exception 'not a label rep'; end if;
  if length(coalesce(ref, '')) > 300 then raise exception 'reference too long'; end if;
  perform private.rate_limit(r->>'id', 'rep-sent', 60);
  select i into inv from jsonb_array_elements(public.section('invoices')) i where i->>'id' = invoice_id;
  select exists (select 1 from jsonb_array_elements(public.section('roster')) a where a->>'id' = inv->>'artistId' and a->>'labelRep' = r->>'id') into ok;
  if inv is null or not ok or coalesce(inv->>'sentToRepAt', '') = '' then raise exception 'invoice not found'; end if;
  if inv->>'status' in ('DP Queue', 'Pay Approved', 'Paid', 'Rejected') then raise exception 'already past the partner'; end if;
  update public.app_data d set value = (
      select jsonb_agg(case when i->>'id' = invoice_id then i || jsonb_build_object(
          'status', 'DP Queue', 'repSentAt', now(), 'repRef', coalesce(ref, ''),
          'history', coalesce(i->'history', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('at', now(), 'by', r->>'name', 'action', 'sent to partner', 'from', i->>'status', 'to', 'DP Queue', 'note', coalesce(ref, ''))))
        else i end order by ord)
      from jsonb_array_elements(d.value) with ordinality t(i, ord)),
    updated_at = now()
  where d.key = 'invoices';
  insert into public.audit_log (actor_email, actor_name, actor_kind, action, detail, artist_id)
  values (auth.jwt()->>'email', r->>'name', 'rep', 'sent an invoice to the partner', (inv->>'title') || coalesce(' · ref ' || nullif(ref, ''), ''), inv->>'artistId');
end $$;
revoke all on function public.rep_mark_sent(text, text) from public, anon;
grant execute on function public.rep_mark_sent(text, text) to authenticated;

-- Emails to the rep: a release confirmed for them, an invoice pushed to them.
do $$
declare d text := pg_get_functiondef('private.app_data_events()'::regprocedure);
  k_old text := '''dealChanges'', ''notices'') or jsonb_typeof';
  tail text := '  if jsonb_array_length(events) > 0 then';
begin
  if position(k_old in d) = 0 or position(tail in d) = 0 then raise exception 'app_data_events: anchors not found'; end if;
  d := replace(d, k_old, '''dealChanges'', ''notices'', ''catalog'') or jsonb_typeof');
  d := replace(d, tail, E'  if new.key in (''catalog'', ''invoices'') then\n    select events || coalesce(jsonb_agg(jsonb_build_object(''type'', case when new.key = ''catalog'' then ''repRelease'' else ''repInvoice'' end, ''key'', new.key, ''id'', n->>''id'')), ''[]'')\n    into events\n    from jsonb_array_elements(new.value) n\n    left join jsonb_array_elements(old_v) o on o->>''id'' = n->>''id''\n    where coalesce(n->>case when new.key = ''catalog'' then ''repConfirmedAt'' else ''sentToRepAt'' end, '''') <> ''''\n      and coalesce(o->>case when new.key = ''catalog'' then ''repConfirmedAt'' else ''sentToRepAt'' end, '''') is distinct from coalesce(n->>case when new.key = ''catalog'' then ''repConfirmedAt'' else ''sentToRepAt'' end, '''');\n  end if;\n\n' || tail);
  execute d;
end $$;
