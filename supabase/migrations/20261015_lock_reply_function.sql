-- Applied to production 20261015220810 (lock_reply_function) before migrations were kept in the repo.
-- Recovered verbatim from supabase_migrations.schema_migrations on 2026-10-19.

revoke execute on function public.artist_reply_submission(text, text) from public, anon;
grant execute on function public.artist_reply_submission(text, text) to authenticated;
revoke execute on function public.notify_secret_ok(text) from public, anon, authenticated;
