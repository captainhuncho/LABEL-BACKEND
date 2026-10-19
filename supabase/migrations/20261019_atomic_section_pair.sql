-- Save the two sections that make up an import or artist publish in one
-- transaction. Existing RLS and write triggers still run for the caller.
-- Pairs: an EMPIRE import (revenue + statementFiles), a publish to artists
-- (publishedRevenue + revenuePublish), and re-read stream counts, which refresh
-- per-store streams on both the books and what artists see (revenue + publishedRevenue).
create or replace function public.save_app_data_pair(
  first_key text, first_value jsonb, first_version timestamptz,
  second_key text, second_value jsonb, second_version timestamptz)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare first_at timestamptz; second_at timestamptz;
begin
  if first_key = second_key or not (
    (first_key = 'revenue' and second_key = 'statementFiles') or
    (first_key = 'revenue' and second_key = 'publishedRevenue') or
    (first_key = 'publishedRevenue' and second_key = 'revenuePublish')) then
    raise exception 'invalid section pair' using errcode = '22023';
  end if;
  if jsonb_typeof(first_value) <> 'array' or jsonb_typeof(second_value) <> 'array' then
    raise exception 'section values must be arrays' using errcode = '22023';
  end if;
  update public.app_data set value = first_value
    where key = first_key and updated_at = first_version
    returning updated_at into first_at;
  if first_at is null then
    if not exists (select 1 from public.app_data where key = first_key) then
      raise exception 'section missing: %', first_key using errcode = 'P0002';
    end if;
    raise exception 'section changed: %', first_key using errcode = '40001';
  end if;
  update public.app_data set value = second_value
    where key = second_key and updated_at = second_version
    returning updated_at into second_at;
  if second_at is null then
    if not exists (select 1 from public.app_data where key = second_key) then
      raise exception 'section missing: %', second_key using errcode = 'P0002';
    end if;
    raise exception 'section changed: %', second_key using errcode = '40001';
  end if;
  return jsonb_build_object(first_key, first_at, second_key, second_at);
end $$;
revoke all on function public.save_app_data_pair(text, jsonb, timestamptz, text, jsonb, timestamptz) from public, anon;
grant execute on function public.save_app_data_pair(text, jsonb, timestamptz, text, jsonb, timestamptz) to authenticated, service_role;
