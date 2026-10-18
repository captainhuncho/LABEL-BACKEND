-- Label reps are from the partner: they view and download, they don't move
-- invoices. "Send to partner" is the team's (PM, Finance, Legal, Admin) in ops.

-- 0) The activity log accepts label rep entries (it only allowed team, artist, system).
alter table public.audit_log drop constraint if exists audit_log_actor_kind_check;
alter table public.audit_log add constraint audit_log_actor_kind_check check (actor_kind in ('team', 'artist', 'system', 'rep'));

-- 1) Reps no longer mark invoices sent.
revoke execute on function public.rep_mark_sent(text, text) from authenticated;

-- 2) rep_portal: the invoice file (to view and download) and when it went to the partner.
do $$
declare d text := pg_get_functiondef('public.rep_portal()'::regprocedure);
  a text := '''payee'', i->>''payTo'', ''lines'', i->''lines'')';
begin
  if position(a in d) = 0 then raise exception 'rep_portal: anchor not found'; end if;
  if position('attachmentName' in d) > 0 then return; end if;
  d := replace(d, a, '''payee'', i->>''payTo'', ''lines'', i->''lines'', ''attachment'', i->>''attachment'', ''attachmentName'', i->>''attachmentName'', ''sentToPartnerAt'', i->>''sentToPartnerAt'')');
  execute d;
end $$;

-- 3) A rep may open an invoice file in the documents bucket only when that
-- invoice was sent to the partner for one of their artists.
create or replace function public.rep_can_read_document(object_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from jsonb_array_elements(public.section('invoices')) i
     where i->>'attachment' = 'doc:' || object_name and coalesce(i->>'sentToRepAt', '') <> ''
       and exists (select 1 from jsonb_array_elements(public.section('roster')) a
                    where a->>'id' = i->>'artistId' and a->>'labelRep' = (private.my_rep()->>'id')));
$$;
revoke all on function public.rep_can_read_document(text) from public, anon;
grant execute on function public.rep_can_read_document(text) to authenticated;
drop policy if exists "reps read invoice files sent to them" on storage.objects;
create policy "reps read invoice files sent to them" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.rep_can_read_document(name));

-- 4) Email release sheets to the rep's own address (nobody else's).
create or replace function public.rep_email_releases(release_ids text[])
returns int language plpgsql security definer set search_path = '' as $$
declare r jsonb := private.my_rep(); ok text[];
begin
  if r is null then raise exception 'not a label rep'; end if;
  if coalesce(array_length(release_ids, 1), 0) = 0 or array_length(release_ids, 1) > 200 then raise exception 'pick between 1 and 200 releases'; end if;
  perform private.rate_limit(r->>'id', 'rep-email', 10);
  select coalesce(array_agg(c->>'id'), '{}') into ok from jsonb_array_elements(public.section('catalog')) c
   where c->>'id' = any(release_ids) and coalesce(c->>'repConfirmedAt', '') <> ''
     and exists (select 1 from jsonb_array_elements(public.section('roster')) a where a->>'id' = c->>'artistId' and a->>'labelRep' = r->>'id');
  if coalesce(array_length(ok, 1), 0) = 0 then raise exception 'no releases found'; end if;
  insert into public.audit_log (actor_email, actor_name, actor_kind, action, detail)
  values (auth.jwt()->>'email', r->>'name', 'rep', 'emailed release sheets to self', array_length(ok, 1) || ' release(s)');
  perform net.http_post(
    url := (select value from private.config where key = 'notify_url'),
    body := jsonb_build_object('action', 'repReleaseSheet', 'repId', r->>'id', 'ids', to_jsonb(ok)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', (select value from private.config where key = 'notify_secret')),
    timeout_milliseconds := 30000);
  return array_length(ok, 1);
end $$;
revoke all on function public.rep_email_releases(text[]) from public, anon;
grant execute on function public.rep_email_releases(text[]) to authenticated;
