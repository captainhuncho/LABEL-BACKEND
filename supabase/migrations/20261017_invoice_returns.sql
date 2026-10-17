-- Artist invoices: only the artist's own fields are kept (internal markers like
-- "sent to label rep" can't be pre-filled), a budget line is kept only if it is
-- one of the artist's own active budgets sent to their dashboard, and a returned
-- invoice ("Needs changes") can be fixed and resubmitted to PM Approval.

create or replace function private.artist_budget_line(aid text, oh text, cat text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when exists (select 1 from jsonb_array_elements(coalesce(public.section('overheads'), '[]')) o
                            where o->>'id' = oh and o->>'kind' = 'artist' and o->>'artistId' = aid
                              and o->>'status' = 'Active' and coalesce(o->>'sentToArtistAt', '') <> '')
              then jsonb_build_object('overheadId', oh, 'categoryId', left(coalesce(cat, ''), 200))
              else jsonb_build_object('overheadId', '', 'categoryId', '') end;
$$;
revoke all on function private.artist_budget_line(text, text, text) from public, anon, authenticated;

do $$
declare d text := pg_get_functiondef('public.artist_add(text,jsonb)'::regprocedure);
  old text := 'when ''invoices'' then item || jsonb_build_object(''status'', ''PM Approval''';
begin
  if position(old in d) = 0 then raise exception 'artist_add: invoices branch not found'; end if;
  execute replace(d, old, 'when ''invoices'' then (item - ''sentToRepAt'' - ''sentToRepBy'' - ''repSentAt'' - ''repRef'' - ''overBudget'' - ''correctedNote'' - ''messages'')'
    || ' || private.artist_budget_line(a->>''id'', item->>''overheadId'', item->>''categoryId'') || jsonb_build_object(''messages'', ''[]''::jsonb, ''status'', ''PM Approval''');
end $$;

create or replace function public.artist_resubmit_invoice(invoice_id text, changes jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare a jsonb := public.my_artist(); inv jsonb; clean jsonb := '{}'::jsonb; k text;
begin
  if a is null then raise exception 'not an artist'; end if;
  if not private.second_factor_recent() then raise exception 'confirm_identity'; end if;
  if jsonb_typeof(changes) <> 'object' then raise exception 'invalid changes'; end if;
  perform private.rate_limit(a->>'id', 'invoices', 10);
  select i into inv from jsonb_array_elements(public.section('invoices')) i where i->>'id' = invoice_id and i->>'artistId' = a->>'id';
  if inv is null then raise exception 'invoice not found'; end if;
  if inv->>'status' <> 'Needs changes' then raise exception 'only returned invoices can be resubmitted'; end if;
  foreach k in array array['title', 'invoiceDate', 'invoiceNumber', 'payTo', 'details', 'attachment', 'attachmentName'] loop
    if changes ? k then clean := clean || jsonb_build_object(k, left(coalesce(changes->>k, ''), 5000)); end if;
  end loop;
  if not private.valid_attachment(clean->>'attachment') then raise exception 'attachments must be a PDF or an image'; end if;
  if jsonb_typeof(changes->'amount') <> 'number' or (changes->>'amount')::numeric <= 0 then raise exception 'invalid amount'; end if;
  if coalesce(trim(clean->>'title'), '') = '' then raise exception 'description required'; end if;
  clean := clean || jsonb_build_object('amount', changes->'amount') || private.artist_budget_line(a->>'id', changes->>'overheadId', changes->>'categoryId');
  update public.app_data d set value = (
      select jsonb_agg(case when i->>'id' = invoice_id then i || clean || jsonb_build_object('status', 'PM Approval', 'reviewNote', '', 'resubmittedAt', now(),
          'history', coalesce(i->'history', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('at', now(), 'by', a->>'name', 'action', 'resubmitted', 'from', 'Needs changes', 'to', 'PM Approval', 'note', '')))
        else i end order by ord)
      from jsonb_array_elements(d.value) with ordinality t(i, ord)),
    updated_at = now()
  where d.key = 'invoices';
end $$;
revoke all on function public.artist_resubmit_invoice(text, jsonb) from public, anon;
grant execute on function public.artist_resubmit_invoice(text, jsonb) to authenticated;

-- The artist's budget dropdown lists every sub-category of the budget's types.
do $$
declare d text := pg_get_functiondef('public.artist_portal()'::regprocedure);
  old text := '''id'', o->>''id'', ''title'', o->>''title'', ''status'', o->>''status'',';
begin
  if position(old in d) = 0 then raise exception 'artist_portal: budgets not found'; end if;
  execute replace(d, old, old || ' ''types'', coalesce(o->''types'', ''[]''),');
end $$;

-- Label reps: the pay-to name is stored as payTo.
do $$
declare d text := pg_get_functiondef('public.rep_portal()'::regprocedure);
begin
  if position('''payee'', i->>''payee''' in d) = 0 then raise exception 'rep_portal: payee not found'; end if;
  execute replace(d, '''payee'', i->>''payee''', '''payee'', i->>''payTo''');
end $$;
