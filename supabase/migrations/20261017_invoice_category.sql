-- A resubmitted invoice keeps its "What it's for" category (budgetCategory, category).
do $$
declare d text := pg_get_functiondef('public.artist_resubmit_invoice(text,jsonb)'::regprocedure);
  old text := 'array[''title'', ''invoiceDate''';
begin
  if position(old in d) = 0 then raise exception 'artist_resubmit_invoice: field list not found'; end if;
  execute replace(d, old, 'array[''budgetCategory'', ''category'', ''title'', ''invoiceDate''');
end $$;
