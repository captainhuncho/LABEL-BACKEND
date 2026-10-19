-- Applied to production 20261016131308 (artist_portal_cash_repayments) before migrations were kept in the repo.
-- Recovered verbatim from supabase_migrations.schema_migrations on 2026-10-19.

do $do$
declare def text := pg_get_functiondef('public.artist_portal'::regproc);
begin
  def := replace(def,
    $a$l->>'artist' = aname and l->>'type' = 'expense' and coalesce$a$,
    $b$l->>'artist' = aname and (l->>'type' = 'expense' or (l->>'type' = 'income' and l->>'category' = 'Cash repayment')) and coalesce$b$);
  if position('Cash repayment' in def) = 0 then raise exception 'anchor not found'; end if;
  execute def;
end $do$;
