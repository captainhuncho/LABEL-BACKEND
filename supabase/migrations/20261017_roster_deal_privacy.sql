-- Deal terms and deal changes are visible only to Admin, Finance, Legal and
-- anyone with the Artist earnings permission ("deal viewers").
-- Everyone else on the team reads `rosterPublic`: the roster with the deal
-- fields removed, kept in step by a trigger. When they save it, the database
-- puts the hidden fields back from the real roster, so their saves (bio,
-- photo, status...) never wipe or change deal terms.

create or replace function private.can_see_deals()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.my_perm('royalties') or (private.second_factor_ok() and exists (
    select 1 from public.app_data d, jsonb_array_elements(d.value) s
     where d.key = 'staff' and lower(s->>'email') = lower(auth.jwt()->>'email')
       and coalesce(s->>'status', '') <> 'Archived' and s->>'role' in ('Admin', 'Finance', 'Legal')));
$$;
revoke all on function private.can_see_deals() from public, anon, authenticated;

create or replace function private.deal_fields()
returns text[] language sql immutable set search_path = '' as $$
  select array['artistPct', 'royaltyRate', 'fundingTier', 'dealType', 'dealTerms', 'contractType', 'licenseYears',
               'effectiveDate', 'reportingPeriod', 'payoutThreshold', 'annualBudget', 'noExtension'];
$$;
revoke all on function private.deal_fields() from public, anon, authenticated;

create or replace function private.roster_public(v jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(case when jsonb_typeof(a) = 'object' then a - private.deal_fields() else a end order by ord), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(v) = 'array' then v else '[]'::jsonb end) with ordinality t(a, ord);
$$;
revoke all on function private.roster_public(jsonb) from public, anon, authenticated;

-- Roster changed (by anyone, any route): refresh the public copy.
create or replace function private.roster_public_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if pg_trigger_depth() > 1 then return null; end if;  -- a rosterPublic save already set its own copy
  insert into public.app_data (key, value) values ('rosterPublic', private.roster_public(new.value))
    on conflict (key) do update set value = excluded.value
    where public.app_data.value is distinct from excluded.value;
  return null;
end $$;
revoke all on function private.roster_public_sync() from public, anon, authenticated;

drop trigger if exists roster_public_sync on public.app_data;
create trigger roster_public_sync after insert or update on public.app_data
  for each row when (new.key = 'roster') execute function private.roster_public_sync();

-- A team member without deal access saved the public copy: merge it into the
-- real roster, keeping each existing artist's deal fields as they were.
create or replace function private.roster_public_save()
returns trigger language plpgsql security definer set search_path = '' as $$
declare merged jsonb;
begin
  if coalesce(current_setting('role', true), '') <> 'authenticated' then return new; end if;
  if pg_trigger_depth() > 1 then return new; end if;  -- the roster sync writing this copy
  if tg_op = 'UPDATE' and old.value is not distinct from new.value then return new; end if;
  if not public.is_team_member() then raise exception 'Team only' using errcode = '42501'; end if;
  select coalesce(jsonb_agg(case
           when o.a is null or jsonb_typeof(n) <> 'object' then n
           else (n - private.deal_fields()) || (select coalesce(jsonb_object_agg(f, o.a->f), '{}'::jsonb)
                                                  from unnest(private.deal_fields()) f where o.a ? f)
         end order by ord), '[]'::jsonb)
    into merged
    from jsonb_array_elements(case when jsonb_typeof(new.value) = 'array' then new.value else '[]'::jsonb end) with ordinality t(n, ord)
    left join lateral (select r as a from public.app_data d, jsonb_array_elements(d.value) r
                        where d.key = 'roster' and r->>'id' = n->>'id' limit 1) o on true;
  update public.app_data set value = merged where key = 'roster';
  new.value := private.roster_public(merged);
  return new;
end $$;
revoke all on function private.roster_public_save() from public, anon, authenticated;

drop trigger if exists roster_public_save on public.app_data;
create trigger roster_public_save before insert or update on public.app_data
  for each row when (new.key = 'rosterPublic') execute function private.roster_public_save();

-- Read rules: the real roster and deal changes for deal viewers; the public
-- copy for the whole team.
create or replace function public.can_read_section(k text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when k in ('revenue', 'masterGross', 'payouts', 'publishedRevenue', 'revenuePublish', 'statementFiles') then private.my_perm('royalties')
    when k in ('ledger', 'overheads', 'labelBudgets') then private.my_perm('spend')
    when k in ('roster', 'dealChanges') then private.can_see_deals()
    else true end;
$$;

-- Create the public copy now.
insert into public.app_data (key, value)
  select 'rosterPublic', private.roster_public(value) from public.app_data where key = 'roster'
  on conflict (key) do update set value = excluded.value;
