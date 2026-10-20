-- Legal can't change an Admin's team record at all (profile fields included).
-- Admin can edit Legal. Everyone else can't change the team list (existing rules).
create or replace function private.staff_legal_rule()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(current_setting('role', true), '') <> 'authenticated' then return new; end if;
  if coalesce(private.me()->>'role', '') <> 'Legal' then return new; end if;
  if exists (
       select 1
         from jsonb_array_elements(case when tg_op = 'UPDATE' and jsonb_typeof(old.value) = 'array' then old.value else '[]'::jsonb end) o
         full join jsonb_array_elements(case when jsonb_typeof(new.value) = 'array' then new.value else '[]'::jsonb end) n on n->>'id' = o->>'id'
        where o is distinct from n and (coalesce(o->>'role', '') = 'Admin' or coalesce(n->>'role', '') = 'Admin')) then
    raise exception 'Legal can''t change an Admin''s record' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.staff_legal_rule() from public, anon, authenticated;

drop trigger if exists staff_legal_rule on public.app_data;
create trigger staff_legal_rule before update on public.app_data
  for each row when (new.key = 'staff') execute function private.staff_legal_rule();
