-- App errors from people's browsers, so the team hears about breakages.
-- Anyone signed in can report (rate-limited, trimmed); only Admin can read.
-- Kept 30 days.
create table if not exists private.client_errors (
  id bigserial primary key,
  at timestamptz not null default now(),
  email text, site text, url text, message text, stack text
);
create or replace function public.log_client_error(message text, stack text default '', url text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare em text := lower(auth.jwt()->>'email');
begin
  if em is null then return; end if;
  perform private.rate_limit(em, 'client-error', 30);
  insert into private.client_errors (email, site, url, message, stack)
  values (em, split_part(split_part(coalesce(url, ''), '//', 2), '/', 1), left(coalesce(url, ''), 300), left(coalesce(message, ''), 500), left(coalesce(stack, ''), 2000));
exception when others then return; -- never let error reporting raise
end $$;
create or replace function public.client_errors_list()
returns table(at timestamptz, email text, site text, url text, message text)
language sql stable security definer set search_path = '' as $$
  select e.at, e.email, e.site, e.url, e.message from private.client_errors e
  where private.is_admin() order by e.at desc limit 50;
$$;
revoke all on function public.log_client_error(text, text, text) from public, anon;
revoke all on function public.client_errors_list() from public, anon;
grant execute on function public.log_client_error(text, text, text) to authenticated;
grant execute on function public.client_errors_list() to authenticated;
select cron.schedule('client-errors-cleanup', '23 3 * * *', $$delete from private.client_errors where at < now() - interval '30 days'$$);
