-- Role rules for team writes, enforced in the database (they used to live only
-- in the app, so any team member could change any section through the API).
-- Applies to writes made as the signed-in API role (the session's role setting
-- is 'authenticated'); the notify function (service_role), cron jobs and
-- migrations are not affected. Security-definer RPCs called by a signed-in user
-- are checked too, so an RPC that must write one of these sections needs its
-- own exemption here.

-- The signed-in team member's permission, mirroring permissionsFor() in
-- src/constants.js: Admin has everything; otherwise saved permissions (legacy
-- `finance` key read as royalties/spend), else the role's defaults.
create or replace function private.my_perm(perm text)
returns boolean language sql stable security definer set search_path = '' as $$
  with me as (
    select s from public.app_data d, jsonb_array_elements(d.value) s
     where d.key = 'staff' and jsonb_typeof(d.value) = 'array'
       and lower(s->>'email') = lower(auth.jwt()->>'email')
       and coalesce(s->>'status', '') <> 'Archived' and coalesce(s->>'role', '') <> 'Label Rep'
     limit 1)
  select private.second_factor_ok() and coalesce((
    select case
      when s->>'role' = 'Admin' then true
      when jsonb_typeof(s->'permissions') = 'object' then
        case when perm in ('royalties', 'spend') and not (s->'permissions' ? 'royalties') and s->'permissions' ? 'finance'
             then (s->'permissions'->>'finance')::boolean or (perm = 'spend' and coalesce((s->'permissions'->>'budgets')::boolean, false))
             else coalesce((s->'permissions'->>perm)::boolean, false) end
      when s->>'role' = 'Legal' then true
      when s->>'role' = 'Finance' then perm in ('royalties', 'spend', 'analytics', 'edits')
      when s->>'role' = 'Product Manager' then perm in ('spend', 'analytics', 'roster', 'catalog', 'edits')
      when s->>'role' in ('A&R', 'Label Manager') then perm in ('analytics', 'roster', 'catalog', 'edits')
      when s->>'role' = 'Marketing' then perm in ('analytics', 'catalog', 'notices')
      when s->>'role' = 'Label Rep' then false
      else perm = 'analytics' end
    from me), false);
$$;
revoke all on function private.my_perm(text) from public, anon, authenticated;

-- A section's rows with one field removed from each (to compare everything else).
create or replace function private.strip_field(v jsonb, field text)
returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(case when jsonb_typeof(e) = 'object' then e - field else e end order by ord), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(v) = 'array' then v else '[]'::jsonb end) with ordinality t(e, ord);
$$;
revoke all on function private.strip_field(jsonb, text) from public, anon, authenticated;

create or replace function private.app_data_write_rules()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  old_v jsonb := case when tg_op = 'UPDATE' then old.value else null end;
  money boolean;
begin
  if coalesce(current_setting('role', true), '') <> 'authenticated' then return new; end if;
  if old_v is not distinct from new.value then return new; end if;
  money := private.is_admin() or (private.my_perm('royalties') and private.my_perm('edits'));

  -- (1) Team list: who is on it, their role, access, sign-in email and whether
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

  -- (2) What artists see and get paid.
  if new.key = 'publishedRevenue' and not (
       private.is_admin()
       or (money and coalesce((select (value->>'financePublishDirect')::boolean from public.app_data where key = 'labelSettings'), false))
       -- the EMPIRE import only refreshes per-store streams on published rows
       or (private.my_perm('edits') and private.strip_field(old_v, 'storeStreams') = private.strip_field(new.value, 'storeStreams'))) then
    raise exception 'Only an Admin can publish earnings to artists (or Finance when an Admin allows direct publishing)' using errcode = '42501';
  end if;
  if new.key in ('revenuePublish', 'payouts') and not money then
    raise exception 'Changing % needs the Artist earnings and Can edit permissions', new.key using errcode = '42501';
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
  for each row when (new.key in ('staff', 'publishedRevenue', 'revenuePublish', 'payouts', 'labelSettings'))
  execute function private.app_data_write_rules();

-- (3) The activity log is for Admin and Legal who passed their second step.
create or replace function public.is_audit_reader()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.second_factor_ok() and exists (select 1 from jsonb_array_elements(public.section('staff')) s
    where lower(s->>'email') = lower(auth.jwt()->>'email') and s->>'role' in ('Admin', 'Legal')
      and coalesce(s->>'status', 'Active') not in ('Inactive', 'Archived'));
$$;
