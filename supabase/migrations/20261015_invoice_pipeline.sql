-- Applied to production 20261015223900 (invoice_pipeline) before migrations were kept in the repo.
-- Recovered verbatim from supabase_migrations.schema_migrations on 2026-10-19.

do $$
declare def text;
begin
  -- New artist invoices start in PM Approval with an empty history.
  def := replace(pg_get_functiondef('public.artist_add(text,jsonb)'::regprocedure),
    $q$when 'invoices' then item || jsonb_build_object('status', 'Pending', 'reviewedBy', '', 'reviewedAt', '', 'reviewNote', '', 'paidAt', '')$q$,
    $q$when 'invoices' then item || jsonb_build_object('status', 'PM Approval', 'history', '[]'::jsonb, 'reviewedBy', '', 'reviewedAt', '', 'reviewNote', '', 'paidAt', '')$q$);
  execute def;

  -- Invoice stage changes become 'stage' events.
  def := replace(pg_get_functiondef('private.app_data_events()'::regprocedure),
    $q$  -- A statement sent to an artist.$q$,
    $q$  if new.key = 'invoices' then
    select events || coalesce(jsonb_agg(jsonb_build_object('type', 'stage', 'key', 'invoices', 'id', n->>'id')), '[]')
    into events
    from jsonb_array_elements(new.value) n
    join jsonb_array_elements(old_v) o on o->>'id' = n->>'id'
    where coalesce(n->>'status', '') is distinct from coalesce(o->>'status', '');
  end if;

  -- A statement sent to an artist.$q$);
  execute def;
end $$;
select position('PM Approval' in pg_get_functiondef('public.artist_add(text,jsonb)'::regprocedure)) > 0 as add_ok,
       position('''stage''' in pg_get_functiondef('private.app_data_events()'::regprocedure)) > 0 as trigger_ok;
