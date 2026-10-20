-- Artists name their Product Manager and A&R by the team member's name. When a
-- team member is renamed (same record, same email), carry the new name onto
-- every artist that named them, so they stay that artist's PM / A&R. Backs up
-- the same step in the Team screen, whatever route the rename takes.
create or replace function private.staff_rename_follows()
returns trigger language plpgsql security definer set search_path = '' as $$
declare renames jsonb; roster jsonb;
begin
  select coalesce(jsonb_object_agg(o->>'name', n->>'name'), '{}'::jsonb) into renames
    from jsonb_array_elements(case when jsonb_typeof(old.value) = 'array' then old.value else '[]'::jsonb end) o
    join jsonb_array_elements(case when jsonb_typeof(new.value) = 'array' then new.value else '[]'::jsonb end) n
      on n->>'id' = o->>'id' and lower(coalesce(n->>'email', '')) = lower(coalesce(o->>'email', ''))
   where coalesce(o->>'name', '') <> '' and coalesce(n->>'name', '') <> '' and o->>'name' <> n->>'name';
  if renames = '{}'::jsonb then return null; end if;

  select jsonb_agg(case when jsonb_typeof(a) <> 'object' then a else a
           || case when renames ? coalesce(a->>'productManager', '') then jsonb_build_object('productManager', renames->>(a->>'productManager')) else '{}'::jsonb end
           || case when renames ? coalesce(a->>'anr', '') then jsonb_build_object('anr', renames->>(a->>'anr')) else '{}'::jsonb end
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
revoke all on function private.staff_rename_follows() from public, anon, authenticated;

drop trigger if exists staff_rename_follows on public.app_data;
create trigger staff_rename_follows after update on public.app_data
  for each row when (new.key = 'staff' and old.value is distinct from new.value)
  execute function private.staff_rename_follows();
