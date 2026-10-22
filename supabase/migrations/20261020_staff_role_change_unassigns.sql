-- A role change is a fresh start. When a team member's role changes (same
-- record), they stop being Product Manager or A&R on every artist that named
-- them: what came with those artists (PM-only reads, PM approval of invoices,
-- budgets and requests) ends with the old role. Only Product Managers hold
-- artists: if the new role is Product Manager, an Admin assigns artists again
-- on the Roster. Their access fields already reset to the new role's defaults
-- in the Team screen.
create or replace function private.staff_role_change_unassigns()
returns trigger language plpgsql security definer set search_path = '' as $$
declare gone text[]; roster jsonb;
begin
  -- old and new names, so a rename in the same save is covered too
  select coalesce(array_agg(distinct lower(trim(x))), '{}') into gone
    from jsonb_array_elements(case when jsonb_typeof(old.value) = 'array' then old.value else '[]'::jsonb end) o
    join jsonb_array_elements(case when jsonb_typeof(new.value) = 'array' then new.value else '[]'::jsonb end) n
      on n->>'id' = o->>'id'
    cross join lateral unnest(array[o->>'name', n->>'name']) x
   where coalesce(o->>'role', '') <> coalesce(n->>'role', '') and coalesce(trim(x), '') <> '';
  if cardinality(gone) = 0 then return null; end if;

  select jsonb_agg(case when jsonb_typeof(a) <> 'object' then a else a
           || case when lower(trim(coalesce(a->>'productManager', ''))) = any(gone) then '{"productManager": ""}'::jsonb else '{}'::jsonb end
           || case when lower(trim(coalesce(a->>'anr', ''))) = any(gone) then '{"anr": ""}'::jsonb else '{}'::jsonb end
         end order by ord)
    into roster
    from public.app_data d, jsonb_array_elements(d.value) with ordinality t(a, ord)
   where d.key = 'roster' and jsonb_typeof(d.value) = 'array';
  if roster is null then return null; end if;

  update public.app_data set value = roster where key = 'roster' and value is distinct from roster;
  -- the roster sync skips nested writes, so refresh the public copy here
  update public.app_data set value = private.roster_public(roster) where key = 'rosterPublic';
  return null;
end $$;
revoke all on function private.staff_role_change_unassigns() from public, anon, authenticated;

-- fires after staff_rename_follows (alphabetical), so renamed entries are already carried over
drop trigger if exists staff_role_change_unassigns on public.app_data;
create trigger staff_role_change_unassigns after update on public.app_data
  for each row when (new.key = 'staff' and old.value is distinct from new.value)
  execute function private.staff_role_change_unassigns();

-- Backstop: PM approval needs the Product Manager role as well as the name.
create or replace function private.is_pm_of(artist_id text, me jsonb)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(me->>'role', '') = 'Product Manager' and exists (select 1 from public.app_data d, jsonb_array_elements(d.value) a
    where d.key = 'roster' and a->>'id' = artist_id
      and lower(trim(coalesce(a->>'productManager', ''))) <> ''
      and lower(trim(a->>'productManager')) = lower(trim(me->>'name')));
$$;
revoke all on function private.is_pm_of(text, jsonb) from public, anon, authenticated;
