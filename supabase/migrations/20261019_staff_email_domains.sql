-- Team sign-in addresses by role, enforced in the database (same rule as
-- isStaffEmailAllowed() in src/constants.js): label reps use @empi.re, everyone
-- else a label address (@imullar.com or @imssrecords.com). Checked for a new
-- entry, or when an entry's email or role changes, for everyone including
-- Admins. Existing entries that don't change keep working.

create or replace function private.staff_email_ok(email text, role text)
returns boolean language sql immutable set search_path = '' as $$
  select split_part(lower(trim(coalesce(email, ''))), '@', 2) = any(
    case when role = 'Label Rep' then array['empi.re'] else array['imullar.com', 'imssrecords.com'] end);
$$;
revoke all on function private.staff_email_ok(text, text) from public, anon, authenticated;

do $$
declare d text := pg_get_functiondef('private.check_section_write(text,jsonb,jsonb)'::regprocedure);
  a text := '  if k = ''dataVersion'' and not admin then';
  b text := $b$  -- Sign-in addresses by role, for new entries and changed emails or roles.
  if k = 'staff' and exists (
       select 1 from jsonb_array_elements(case when jsonb_typeof(new_v) = 'array' then new_v else '[]'::jsonb end) sn
        where not private.staff_email_ok(sn->>'email', sn->>'role')
          and not exists (select 1 from jsonb_array_elements(case when jsonb_typeof(old_v) = 'array' then old_v else '[]'::jsonb end) so
                           where so->>'id' = sn->>'id'
                             and lower(coalesce(so->>'email', '')) = lower(coalesce(sn->>'email', ''))
                             and coalesce(so->>'role', '') = coalesce(sn->>'role', ''))) then
    raise exception 'Label reps sign in with an @empi.re email; everyone else with @imullar.com or @imssrecords.com' using errcode = '42501';
  end if;
$b$;
begin
  if position('staff_email_ok' in d) > 0 then return; end if;
  if position(a in d) = 0 then raise exception 'check_section_write: anchor not found'; end if;
  d := replace(d, a, b || a);
  execute d;
end $$;
