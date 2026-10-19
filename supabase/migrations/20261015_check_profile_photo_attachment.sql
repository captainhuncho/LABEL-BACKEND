-- Applied to production 20261015222508 (check_profile_photo_attachment) before migrations were kept in the repo.
-- Recovered verbatim from supabase_migrations.schema_migrations on 2026-10-19.

do $$
declare def text;
begin
  def := replace(pg_get_functiondef('public.artist_add(text,jsonb)'::regprocedure),
    $q$private.valid_attachment(item->>'photoUrl'))$q$,
    $q$private.valid_attachment(item->>'photoUrl') and private.valid_attachment(item->'changes'->>'photoUrl'))$q$);
  execute def;
end $$;
