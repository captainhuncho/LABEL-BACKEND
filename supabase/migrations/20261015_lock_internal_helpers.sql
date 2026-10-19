-- Applied to production 20261015191857 (lock_internal_helpers) before migrations were kept in the repo.
-- Recovered verbatim from supabase_migrations.schema_migrations on 2026-10-19.

-- Internal helpers: only callable from the definer functions, never via the API.
revoke execute on function public.section(text), public.my_artist(), public.js_slug(text) from public, anon, authenticated;
-- Stop new functions being callable by API roles unless granted explicitly.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
