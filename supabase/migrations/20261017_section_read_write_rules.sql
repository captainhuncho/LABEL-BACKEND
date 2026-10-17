-- Money sections follow the same permissions as the app's screens, for reading
-- as well as writing (extends 20261017_team_write_rules.sql).
--   Artist earnings: revenue, masterGross, payouts, publishedRevenue,
--                    revenuePublish, statementFiles
--   Budgets & expenses: ledger, overheads, labelBudgets
--   Deal changes: written by Admin and Legal only
--   Roster deal terms (share, funding, contract terms, payout threshold): an
--   existing artist's terms change only through an Admin (Deal changes).
-- Artist and rep RPCs read through public.section() as the owner, so the
-- portals are unaffected.

-- Can the signed-in team member read this section? (Used by the read policy;
-- returns only a yes/no.)
create or replace function public.can_read_section(k text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when k in ('revenue', 'masterGross', 'payouts', 'publishedRevenue', 'revenuePublish', 'statementFiles') then private.my_perm('royalties')
    when k in ('ledger', 'overheads', 'labelBudgets') then private.my_perm('spend')
    else true end;
$$;
revoke all on function public.can_read_section(text) from public, anon;
grant execute on function public.can_read_section(text) to authenticated;

drop policy if exists "team can read" on public.app_data;
create policy "team can read" on public.app_data for select to authenticated
  using ((select public.is_team_member()) and public.can_read_section(key));

-- Numbers saved as text or number compare as equal; a missing threshold is 0
-- (the roster form saves Number(x) || 0).
create or replace function private.num(t text)
returns numeric language sql immutable set search_path = '' as $$
  select case when t ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$' then t::numeric end;
$$;
revoke all on function private.num(text) from public, anon, authenticated;

create or replace function private.deal_terms(a jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'artistPct', coalesce(to_jsonb(private.num(a->>'artistPct')), a->'artistPct'),
    'royaltyRate', coalesce(to_jsonb(private.num(a->>'royaltyRate')), a->'royaltyRate'),
    'fundingTier', a->'fundingTier', 'dealType', a->'dealType', 'dealTerms', a->'dealTerms',
    'contractType', a->'contractType', 'licenseYears', coalesce(to_jsonb(private.num(a->>'licenseYears')), a->'licenseYears'),
    'effectiveDate', a->'effectiveDate', 'reportingPeriod', a->'reportingPeriod',
    'payoutThreshold', coalesce(to_jsonb(private.num(a->>'payoutThreshold')), nullif(a->'payoutThreshold', '""'::jsonb), '0'::jsonb),
    'noExtension', a->'noExtension');
$$;
revoke all on function private.deal_terms(jsonb) from public, anon, authenticated;

create or replace function private.app_data_write_rules()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  old_v jsonb := case when tg_op = 'UPDATE' then old.value else null end;
  money boolean;
  spend boolean;
begin
  if coalesce(current_setting('role', true), '') <> 'authenticated' then return new; end if;
  if old_v is not distinct from new.value then return new; end if;
  money := private.is_admin() or (private.my_perm('royalties') and private.my_perm('edits'));
  spend := private.is_admin() or (private.my_perm('spend') and private.my_perm('edits'));

  -- Team list: who is on it, their role, access, sign-in email and whether
  -- they can sign in at all are Admin-only. Legal proposes through accessRequests.
  -- Profile fields (bio, phone, photo, onboarding checklist) stay editable.
  if new.key = 'staff' and not private.is_admin() then
    if exists (
      select 1
        from (select s->>'id' id, s from jsonb_array_elements(coalesce(old_v, '[]'::jsonb)) s) o
        full join (select s->>'id' id, s from jsonb_array_elements(case when jsonb_typeof(new.value) = 'array' then new.value else '[]'::jsonb end) s) n
          on n.id = o.id
       where o.id is null or n.id is null
          or o.s->'role' is distinct from n.s->'role'
          or o.s->'permissions' is distinct from n.s->'permissions'
          or o.s->'canApproveBudgets' is distinct from n.s->'canApproveBudgets'
          or lower(coalesce(o.s->>'email', '')) <> lower(coalesce(n.s->>'email', ''))
          or ((coalesce(o.s->>'status', '') in ('Archived', 'Inactive') or coalesce(n.s->>'status', '') in ('Archived', 'Inactive'))
              and o.s->'status' is distinct from n.s->'status')) then
      raise exception 'Only an Admin can add or remove team members or change their role, access, email or status' using errcode = '42501';
    end if;
  end if;

  -- Roster: an existing artist's deal terms change only through an Admin.
  -- New artists start with whatever terms they are added with.
  if new.key = 'roster' and not private.is_admin() then
    if exists (
      select 1
        from jsonb_array_elements(coalesce(old_v, '[]'::jsonb)) o
        join jsonb_array_elements(case when jsonb_typeof(new.value) = 'array' then new.value else '[]'::jsonb end) n
          on n->>'id' = o->>'id'
       where private.deal_terms(o) is distinct from private.deal_terms(n)) then
      raise exception 'Deal terms change through Deal changes, approved by an Admin' using errcode = '42501';
    end if;
  end if;

  -- What artists see and get paid.
  if new.key = 'publishedRevenue' and not (
       private.is_admin()
       or (money and coalesce((select (value->>'financePublishDirect')::boolean from public.app_data where key = 'labelSettings'), false))
       -- the EMPIRE import only refreshes per-store streams on published rows
       or (money and private.strip_field(old_v, 'storeStreams') = private.strip_field(new.value, 'storeStreams'))) then
    raise exception 'Only an Admin can publish earnings to artists (or Finance when an Admin allows direct publishing)' using errcode = '42501';
  end if;
  if new.key in ('revenuePublish', 'payouts', 'revenue', 'masterGross', 'statementFiles') and not money then
    raise exception 'Changing % needs the Artist earnings and Can edit permissions', new.key using errcode = '42501';
  end if;
  if new.key in ('ledger', 'overheads', 'labelBudgets') and not spend then
    raise exception 'Changing % needs the Budgets & expenses and Can edit permissions', new.key using errcode = '42501';
  end if;
  if new.key = 'dealChanges' and not (private.is_admin() or (private.my_perm('edits') and exists (
       select 1 from public.app_data d, jsonb_array_elements(d.value) s
        where d.key = 'staff' and lower(s->>'email') = lower(auth.jwt()->>'email') and s->>'role' = 'Legal'))) then
    raise exception 'Only Admin and Legal record deal changes' using errcode = '42501';
  end if;
  if new.key = 'labelSettings' and not private.is_admin() then
    if not money
       or old_v->'invoiceWorkflow' is distinct from new.value->'invoiceWorkflow'
       or old_v->'financePublishDirect' is distinct from new.value->'financePublishDirect' then
      raise exception 'Only an Admin can change these label settings' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
revoke all on function private.app_data_write_rules() from public, anon, authenticated;

drop trigger if exists app_data_write_rules on public.app_data;
create trigger app_data_write_rules before insert or update on public.app_data
  for each row when (new.key in ('staff', 'roster', 'publishedRevenue', 'revenuePublish', 'payouts', 'labelSettings',
                                 'revenue', 'masterGross', 'statementFiles', 'ledger', 'overheads', 'labelBudgets', 'dealChanges'))
  execute function private.app_data_write_rules();
