-- Applied to production 20261016122228 (audit_reader_public) before migrations were kept in the repo.
-- Recovered verbatim from supabase_migrations.schema_migrations on 2026-10-19.

drop policy if exists audit_read on public.audit_log;
create or replace function public.is_audit_reader() returns boolean
language sql stable security definer set search_path to '' as $$
  select exists (select 1 from jsonb_array_elements(public.section('staff')) s
    where lower(s->>'email') = lower(auth.jwt()->>'email') and s->>'role' in ('Admin', 'Legal')
      and coalesce(s->>'status', 'Active') <> 'Inactive');
$$;
revoke all on function public.is_audit_reader() from public, anon;
grant execute on function public.is_audit_reader() to authenticated;
create policy audit_read on public.audit_log for select to authenticated using (public.is_audit_reader());
drop function if exists private.is_audit_reader();
revoke usage on schema private from authenticated;
