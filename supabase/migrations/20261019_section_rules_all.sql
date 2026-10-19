-- Every app_data section now has database rules for direct team writes, matching
-- the screens that write it (src/App.jsx NAV and each section's canEdit/canAct).
-- Extends 20261017_section_read_write_rules.sql, which still guards the money,
-- staff access, roster deal terms, deal changes and label settings.
--
-- Only direct API writes are checked (current_user = 'authenticated'). Artist and
-- rep actions go through SECURITY DEFINER functions (artist_add, rep_acknowledge,
-- ...), where current_user is the function owner, so they are unaffected.
-- Unknown section names are refused, so nobody can create junk sections.

-- The signed-in team member's staff entry (null for artists, reps, signed out).
create or replace function private.me()
returns jsonb language sql stable security definer set search_path = '' as $$
  select s from public.app_data d, jsonb_array_elements(d.value) s
   where d.key = 'staff' and jsonb_typeof(d.value) = 'array'
     and lower(s->>'email') = lower(auth.jwt()->>'email')
     and coalesce(s->>'status', '') <> 'Archived' and coalesce(s->>'role', '') <> 'Label Rep'
     and private.second_factor_ok()
   limit 1;
$$;
revoke all on function private.me() from public, anon, authenticated;

-- Is this team member the artist's PM (roster productManager holds the name)?
create or replace function private.is_pm_of(artist_id text, me jsonb)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_data d, jsonb_array_elements(d.value) a
    where d.key = 'roster' and a->>'id' = artist_id
      and lower(trim(coalesce(a->>'productManager', ''))) <> ''
      and lower(trim(a->>'productManager')) = lower(trim(me->>'name')));
$$;
revoke all on function private.is_pm_of(text, jsonb) from public, anon, authenticated;

-- Who may move an invoice on from its current stage (mirrors invoiceReviewers()
-- in src/sections/Invoices.jsx): the artist's PM at PM Approval, otherwise the
-- people assigned to that queue in labelSettings.invoiceWorkflow.
create or replace function private.invoice_reviewer(inv jsonb, me jsonb)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when inv->>'status' in ('PM Approval', 'Pending') then private.is_pm_of(inv->>'artistId', me)
    else coalesce((
      select (d.value->'invoiceWorkflow'->(case inv->>'status'
                when 'Finance Queue' then 'finance' when 'LH Queue' then 'lh'
                when 'DP Queue' then 'dp' when 'Pay Approved' then 'pay' when 'Approved' then 'pay' end)) ? (me->>'id')
        from public.app_data d where d.key = 'labelSettings'), false)
  end;
$$;
revoke all on function private.invoice_reviewer(jsonb, jsonb) from public, anon, authenticated;

-- Raises when the signed-in team member may not make this change.
create or replace function private.check_section_write(k text, old_v jsonb, new_v jsonb)
returns void language plpgsql stable security definer set search_path = '' as $$
declare
  me jsonb := private.me();
  admin boolean := private.is_admin();
  privileged boolean := coalesce(me->>'role', '') in ('Admin', 'Legal');
  edits boolean := private.my_perm('edits');
  o jsonb; n jsonb;
begin
  if old_v is not distinct from new_v then return; end if;
  if me is null then raise exception 'Team only' using errcode = '42501'; end if;
  if k not in ('roster', 'rosterPublic', 'catalog', 'revenue', 'streams', 'payouts', 'masterGross', 'labelSettings',
               'staff', 'tasks', 'ledger', 'notices', 'labelBudgets', 'overheads', 'profileRequests', 'accessRequests',
               'artistRequests', 'invoices', 'statementFiles', 'publishedRevenue', 'revenuePublish', 'dealChanges',
               'releaseSubmissions', 'activityLog', 'dataVersion') then
    raise exception 'Unknown section %', k using errcode = '42501';
  end if;

  if k = 'dataVersion' and not admin then
    raise exception 'Only an Admin can change the data version' using errcode = '42501';
  end if;
  -- Team and Access requests screens are Admin and Legal only.
  if k in ('staff', 'accessRequests') and not privileged then
    raise exception 'Only Admin and Legal change the team list' using errcode = '42501';
  end if;
  -- Catalog is written from Catalog, Roster, Import and Deal changes.
  if k = 'catalog' and not (privileged or (edits and (private.my_perm('catalog') or private.my_perm('roster') or private.my_perm('royalties')))) then
    raise exception 'Changing the catalog needs Catalog (or Roster) and Can edit' using errcode = '42501';
  end if;
  if k = 'releaseSubmissions' and not (privileged or (edits and private.my_perm('catalog'))) then
    raise exception 'Release submissions need Catalog and Can edit' using errcode = '42501';
  end if;
  if k in ('artistRequests', 'profileRequests') and not (privileged or (edits and private.my_perm('roster'))) then
    raise exception 'Artist requests need Roster and Can edit' using errcode = '42501';
  end if;
  if k = 'notices' and not (privileged or private.my_perm('notices')) then
    raise exception 'Posting notices needs the Noticeboard permission' using errcode = '42501';
  end if;
  if k = 'streams' and not (privileged or (edits and (private.my_perm('royalties') or private.my_perm('analytics')))) then
    raise exception 'Changing streams needs Can edit' using errcode = '42501';
  end if;
  -- The activity log only gains entries; the app keeps the newest 200, so the
  -- oldest may drop off once it is full.
  if k = 'activityLog'
     and jsonb_array_length(case when jsonb_typeof(new_v) = 'array' then new_v else '[]'::jsonb end) < 200
     and exists (
       select 1 from jsonb_array_elements(case when jsonb_typeof(old_v) = 'array' then old_v else '[]'::jsonb end) x
        where not exists (select 1 from jsonb_array_elements(case when jsonb_typeof(new_v) = 'array' then new_v else '[]'::jsonb end) y
                           where y->>'id' = x->>'id')) then
    raise exception 'Activity log entries cannot be removed' using errcode = '42501';
  end if;

  if k = 'invoices' and not admin then
    if not (privileged or private.my_perm('spend') or coalesce(me->>'role', '') in ('Finance', 'Product Manager')
            or exists (select 1 from public.app_data d, jsonb_each(coalesce(d.value->'invoiceWorkflow', '{}'::jsonb)) w
                        where d.key = 'labelSettings' and jsonb_typeof(w.value) = 'array' and w.value ? (me->>'id'))) then
      raise exception 'Invoices need Budgets & expenses or a place in the invoice workflow' using errcode = '42501';
    end if;
    for o, n in
      select x, y
        from jsonb_array_elements(case when jsonb_typeof(old_v) = 'array' then old_v else '[]'::jsonb end) x
        full join jsonb_array_elements(case when jsonb_typeof(new_v) = 'array' then new_v else '[]'::jsonb end) y on y->>'id' = x->>'id'
       where x is distinct from y
    loop
      if n is null then raise exception 'Only an Admin can delete an invoice' using errcode = '42501'; end if;
      if o is null then
        if not (privileged or (edits and private.my_perm('spend'))) then
          raise exception 'Adding an invoice needs Budgets & expenses and Can edit' using errcode = '42501';
        end if;
        continue;
      end if;
      -- Moving it on, back or out: the reviewer at its current stage, the
      -- artist's PM returning it, or "Send to partner" (Finance, Legal, the PM) to DP Queue.
      if o->'status' is distinct from n->'status' and not (
           private.invoice_reviewer(o, me)
           or (n->>'status' = 'Needs changes' and private.is_pm_of(o->>'artistId', me) and coalesce(o->>'status', '') not in ('Pay Approved', 'Paid', 'Rejected'))
           or (n->>'status' = 'DP Queue' and coalesce(o->>'sentToPartnerAt', '') = '' and coalesce(n->>'sentToPartnerAt', '') <> ''
               and coalesce(o->>'status', '') not in ('DP Queue', 'Pay Approved', 'Paid', 'Rejected')
               and (coalesce(me->>'role', '') in ('Finance', 'Legal') or private.is_pm_of(o->>'artistId', me)))) then
        raise exception 'Only the reviewer at this stage can move this invoice' using errcode = '42501';
      end if;
      -- What is paid and to whom: the artist's PM before Pay Approved, or the reviewer now.
      if (o->'amount' is distinct from n->'amount' or o->'payTo' is distinct from n->'payTo' or o->'artistId' is distinct from n->'artistId')
         and not (private.invoice_reviewer(o, me)
                  or (private.is_pm_of(o->>'artistId', me) and coalesce(o->>'status', '') not in ('Pay Approved', 'Paid', 'Rejected', 'Needs changes'))) then
        raise exception 'Only the artist''s PM or the current reviewer can correct an invoice' using errcode = '42501';
      end if;
    end loop;
  end if;
end $$;
revoke all on function private.check_section_write(text, jsonb, jsonb) from public, anon, authenticated;

-- The trigger runs as the writer (SECURITY INVOKER), so current_user tells a
-- direct API write from one made inside an artist or rep function. The checks
-- themselves run through this one function, which only says yes (or raises).
create or replace function public.app_data_check_write(k text, old_v jsonb, new_v jsonb)
returns void language sql stable security definer set search_path = '' as $$
  select private.check_section_write(k, old_v, new_v);
$$;
revoke all on function public.app_data_check_write(text, jsonb, jsonb) from public, anon;
grant execute on function public.app_data_check_write(text, jsonb, jsonb) to authenticated;

create or replace function public.app_data_section_rules()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user = 'authenticated' then
    perform public.app_data_check_write(new.key, case when tg_op = 'UPDATE' then old.value end, new.value);
  end if;
  return new;
end $$;
revoke all on function public.app_data_section_rules() from public, anon, authenticated;

drop trigger if exists app_data_section_rules on public.app_data;
create trigger app_data_section_rules before insert or update on public.app_data
  for each row execute function public.app_data_section_rules();

-- Royalty statement files follow Artist earnings, like the revenue they back up.
drop policy if exists "team manages statement files" on storage.objects;
create policy "team manages statement files" on storage.objects for all to authenticated
  using (bucket_id = 'statements' and (select public.is_team_member()) and (select public.can_read_section('statementFiles')))
  with check (bucket_id = 'statements' and (select public.is_team_member()) and (select public.can_read_section('statementFiles')));

-- Nothing in the app truncates the table, and signed-out visitors never touch it.
revoke truncate, references, trigger on public.app_data from anon, authenticated;
revoke all on public.app_data from anon;
