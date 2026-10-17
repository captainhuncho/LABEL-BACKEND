-- Artists see their own budgets once an Admin or Legal presses "Send to
-- artist's dashboard" (sentToArtistAt): each overhead's total, categories and
-- the approved spend attached to it. Never label overheads, other artists,
-- notes, history or who approved what.
do $$
declare d text := pg_get_functiondef('public.artist_portal()'::regprocedure);
  anchor text := '    ''dealChanges'', (';
begin
  if position(anchor in d) = 0 then raise exception 'artist_portal: anchor not found'; end if;
  d := replace(d, anchor, $add$    'budgets', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', o->>'id', 'title', o->>'title', 'status', o->>'status', 'total', o->'total', 'releaseIds', coalesce(o->'releaseIds', '[]'),
        'parentId', o->>'parentId', 'closedAt', o->>'closedAt', 'sentToArtistAt', o->>'sentToArtistAt',
        'categories', (select coalesce(jsonb_agg(jsonb_build_object('id', c->>'id', 'category', c->>'category', 'allocated', c->'allocated')), '[]')
                       from jsonb_array_elements(coalesce(o->'categories', '[]')) c),
        'items', (select coalesce(jsonb_agg(x), '[]') from (
            select jsonb_build_object('id', l->>'id', 'categoryId', coalesce(l->>'categoryId', ''), 'date', l->>'date',
                     'text', coalesce(nullif(l->>'description', ''), l->>'category'), 'amount', l->'amount') x
              from jsonb_array_elements(public.section('ledger')) l
             where l->>'type' = 'expense' and l->>'overheadId' = o->>'id' and coalesce(l->>'approvalStatus', 'Approved') = 'Approved'
            union all
            select jsonb_build_object('id', i->>'id', 'categoryId', coalesce(i->>'categoryId', ''), 'date', left(coalesce(i->>'submittedAt', ''), 10),
                     'text', 'Expense claim: ' || coalesce(i->>'title', ''), 'amount', i->'amount')
              from jsonb_array_elements(public.section('invoices')) i
             where i->>'kind' = 'expense' and i->>'overheadId' = o->>'id' and i->>'status' in ('Pay Approved', 'Paid')) q)
      )), '[]')
      from jsonb_array_elements(coalesce(public.section('overheads'), '[]')) o
      where o->>'kind' = 'artist' and o->>'artistId' = aid and coalesce(o->>'sentToArtistAt', '') <> '' and o->>'status' in ('Active', 'Closed')),
$add$ || anchor);
  execute d;
end $$;

-- A budget sent to the artist's dashboard: a bell notification for them (no email).
do $$
declare d text := pg_get_functiondef('private.app_data_events()'::regprocedure);
  k_old text := '''notices'', ''catalog'') or jsonb_typeof';
  tail text := '  if jsonb_array_length(events) > 0 then';
begin
  if position(k_old in d) = 0 or position(tail in d) = 0 then raise exception 'app_data_events: anchors not found'; end if;
  d := replace(d, k_old, '''notices'', ''catalog'', ''overheads'') or jsonb_typeof');
  d := replace(d, tail, E'  if new.key = ''overheads'' then\n    select events || coalesce(jsonb_agg(jsonb_build_object(''type'', ''budgetSent'', ''key'', ''overheads'', ''id'', n->>''id'')), ''[]'')\n    into events\n    from jsonb_array_elements(new.value) n\n    left join jsonb_array_elements(old_v) o on o->>''id'' = n->>''id''\n    where coalesce(n->>''sentToArtistAt'', '''') <> '''' and coalesce(o->>''sentToArtistAt'', '''') = '''';\n  end if;\n\n' || tail);
  execute d;
end $$;
