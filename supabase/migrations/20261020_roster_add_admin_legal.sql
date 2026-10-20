-- Only Admin and Legal add artists to the roster. Covers saves of the real
-- roster and of the public copy (whose merge writes the real roster).
-- Editing or archiving existing artists follows the other rules.
create or replace function private.roster_add_rule()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(current_setting('role', true), '') <> 'authenticated' then return new; end if;
  if private.is_admin() then return new; end if;
  if private.second_factor_ok() and exists (
       select 1 from public.app_data d, jsonb_array_elements(d.value) s
        where d.key = 'staff' and lower(s->>'email') = lower(auth.jwt()->>'email')
          and s->>'role' = 'Legal' and coalesce(s->>'status', '') not in ('Archived', 'Inactive')) then
    return new;
  end if;
  if exists (
       select 1 from jsonb_array_elements(case when jsonb_typeof(new.value) = 'array' then new.value else '[]'::jsonb end) n
        where not exists (select 1 from jsonb_array_elements(case when tg_op = 'UPDATE' and jsonb_typeof(old.value) = 'array' then old.value else '[]'::jsonb end) o
                           where o->>'id' = n->>'id')) then
    raise exception 'Only an Admin or Legal can add artists to the roster' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.roster_add_rule() from public, anon, authenticated;

drop trigger if exists roster_add_rule on public.app_data;
create trigger roster_add_rule before insert or update on public.app_data
  for each row when (new.key = 'roster') execute function private.roster_add_rule();
