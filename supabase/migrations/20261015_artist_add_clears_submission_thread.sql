-- Applied to production 20261015215030 (artist_add_clears_submission_thread) before migrations were kept in the repo.
-- Recovered verbatim from supabase_migrations.schema_migrations on 2026-10-19.

-- New submissions start with an empty message thread (artists can't seed label messages).
do $$
declare def text;
begin
  def := replace(pg_get_functiondef('public.artist_add(text,jsonb)'::regprocedure),
    $q$when 'releaseSubmissions' then item || jsonb_build_object('status', 'Pending', 'reviewedBy', '', 'reviewedAt', '')$q$,
    $q$when 'releaseSubmissions' then item || jsonb_build_object('status', 'Pending', 'reviewedBy', '', 'reviewedAt', '', 'messages', '[]'::jsonb)$q$);
  execute def;
end $$;
