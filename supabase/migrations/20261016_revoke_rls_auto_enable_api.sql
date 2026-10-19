-- Applied to production 20261016122244 (revoke_rls_auto_enable_api) before migrations were kept in the repo.
-- Recovered verbatim from supabase_migrations.schema_migrations on 2026-10-19.

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
