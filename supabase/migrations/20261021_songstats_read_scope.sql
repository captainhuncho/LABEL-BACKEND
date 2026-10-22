-- Song stats from Songstats (app_data 'songStats', written only by the songstats
-- edge function with the service role; team saves are refused as an unknown
-- section). Readable with the analytics permission (the one that opens Streams);
-- Product Managers and restricted Marketing read only their artists' songs,
-- through the same scoped path as Streams (pm_read).
-- Patched in place with anchor checks, so the rest of each function is unchanged.
do $$
declare d text; a text; b text;
begin
  -- who may read it at all
  d := pg_get_functiondef('private.base_can_read(text)'::regprocedure);
  if position('''songStats''' in d) = 0 then
    a := 'when k = ''invoices'' then private.can_read_invoices()';
    b := 'when k = ''songStats'' then private.my_perm(''analytics'')' || chr(10) || '    ' || a;
    if (length(d) - length(replace(d, a, ''))) / length(a) <> 1 then raise exception 'base_can_read: anchor not found once'; end if;
    execute replace(d, a, b);
  end if;

  -- scoped for PMs and restricted members
  d := pg_get_functiondef('private.pm_scoped_key(text,jsonb)'::regprocedure);
  if position('''songStats''' in d) = 0 then
    a := '''ledger'', ''overheads'')';
    if (length(d) - length(replace(d, a, ''))) / length(a) <> 1 then raise exception 'pm_scoped_key: anchor not found once'; end if;
    execute replace(d, a, '''ledger'', ''overheads'', ''songStats'')');
  end if;

  -- which items are theirs: by the song's artist
  d := pg_get_functiondef('private.pm_mine(text,jsonb,jsonb)'::regprocedure);
  if position('''songStats''' in d) = 0 then
    a := 'when k = ''streams'' then';
    b := 'when k = ''songStats'' then scope->''ids'' ? coalesce(item->>''artistId'', '''')' || chr(10) || '    ' || a;
    if (length(d) - length(replace(d, a, ''))) / length(a) <> 1 then raise exception 'pm_mine: anchor not found once'; end if;
    execute replace(d, a, b);
  end if;
end $$;
