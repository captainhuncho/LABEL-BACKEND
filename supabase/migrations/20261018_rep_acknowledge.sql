-- A label rep confirms they've seen, then sent out (on their side), an invoice
-- or a release the label shared with them. It never changes the invoice's
-- status; it's a record for the team. Re-sending a release asks again.
create or replace function public.rep_acknowledge(kind text, item_id text, step text, note text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare r jsonb := private.my_rep(); k text; item jsonb; ok boolean; now_t text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
begin
  if r is null then raise exception 'not a label rep'; end if;
  if kind not in ('invoice', 'release') or step not in ('seen', 'sent') then raise exception 'invalid request'; end if;
  if length(coalesce(note, '')) > 300 then raise exception 'note too long'; end if;
  perform private.rate_limit(r->>'id', 'rep-ack', 120);
  k := case kind when 'invoice' then 'invoices' else 'catalog' end;
  select i into item from jsonb_array_elements(public.section(k)) i where i->>'id' = item_id;
  select exists (select 1 from jsonb_array_elements(public.section('roster')) a where a->>'id' = item->>'artistId' and a->>'labelRep' = r->>'id') into ok;
  if item is null or not ok or coalesce(item->>(case kind when 'invoice' then 'sentToRepAt' else 'repConfirmedAt' end), '') = '' then raise exception 'not found'; end if;
  update public.app_data d set value = (
      select jsonb_agg(case when i->>'id' = item_id then
          i || jsonb_build_object('repSeenAt', coalesce(nullif(i->>'repSeenAt', ''), now_t), 'repSeenBy', coalesce(nullif(i->>'repSeenBy', ''), r->>'name'))
            || case when step = 'sent' then jsonb_build_object('repSentOutAt', now_t, 'repSentOutBy', r->>'name', 'repSentOutNote', coalesce(note, '')) else '{}'::jsonb end
        else i end order by ord)
      from jsonb_array_elements(d.value) with ordinality t(i, ord)),
    updated_at = now()
  where d.key = k;
  insert into public.audit_log (actor_email, actor_name, actor_kind, action, detail, artist_id)
  values (auth.jwt()->>'email', r->>'name', 'rep', case step when 'seen' then 'confirmed seeing the ' else 'confirmed sending out the ' end || kind,
          (item->>'title') || case when coalesce(note, '') <> '' then ' · ' || note else '' end, item->>'artistId');
end $$;
revoke all on function public.rep_acknowledge(text, text, text, text) from public, anon;
grant execute on function public.rep_acknowledge(text, text, text, text) to authenticated;

-- rep_portal returns the confirmations on invoices too (releases already carry every field).
do $$
declare d text := pg_get_functiondef('public.rep_portal()'::regprocedure);
  a text := '''sentToPartnerAt'', i->>''sentToPartnerAt'')';
begin
  if position(a in d) = 0 then raise exception 'rep_portal: anchor not found'; end if;
  if position('repSentOutAt' in d) > 0 then return; end if;
  d := replace(d, a, '''sentToPartnerAt'', i->>''sentToPartnerAt'', ''repSeenAt'', i->>''repSeenAt'', ''repSentOutAt'', i->>''repSentOutAt'', ''repSentOutNote'', i->>''repSentOutNote'')');
  execute d;
end $$;
