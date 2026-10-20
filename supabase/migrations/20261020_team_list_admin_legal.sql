-- The team list is for Admin and Legal only. Everyone else on the team reads
-- just their own record (staff_self), which the app needs to know who they are
-- and what they can do; they can't see, add or edit anyone else.
-- Admin and Legal add members; Legal can't add an Admin, and changes to an
-- existing member's role, access, email or status stay Admin-only.

create or replace function private.base_can_read(k text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when k in ('revenue', 'masterGross', 'payouts', 'publishedRevenue', 'revenuePublish', 'statementFiles') then private.my_perm('royalties')
    when k in ('ledger', 'overheads', 'labelBudgets') then private.my_perm('spend')
    when k in ('roster', 'dealChanges') then private.can_see_deals()
    when k = 'invoices' then private.can_read_invoices()
    when k in ('staff', 'accessRequests') then coalesce(private.me()->>'role', '') in ('Admin', 'Legal')
    else true end;
$$;
revoke all on function private.base_can_read(text) from public, anon, authenticated;

-- A team member's own record, as a one-item team list.
create or replace function public.staff_self()
returns table (value jsonb, updated_at timestamptz) language sql stable security definer set search_path = '' as $$
  select jsonb_build_array(private.me()), d.updated_at
    from public.app_data d
   where d.key = 'staff' and public.is_team_member() and private.me() is not null;
$$;
revoke all on function public.staff_self() from public, anon;
grant execute on function public.staff_self() to authenticated;

-- Legal may add members (not Admins): their new non-Admin members are left out
-- of the Admin-only comparison. Everything else in the staff rule is unchanged.
do $$
declare d text := pg_get_functiondef('private.app_data_write_rules()'::regprocedure);
  a text := 'jsonb_array_elements(case when jsonb_typeof(new.value) = ''array'' then new.value else ''[]''::jsonb end) s) n';
  b text := 'jsonb_array_elements(case when jsonb_typeof(new.value) = ''array'' then new.value else ''[]''::jsonb end) s'
         || ' where not (coalesce(private.me()->>''role'', '''') = ''Legal'' and coalesce(s->>''role'', '''') <> ''Admin'''
         || ' and not exists (select 1 from jsonb_array_elements(coalesce(old_v, ''[]''::jsonb)) x where x->>''id'' = s->>''id''))) n';
begin
  if (length(d) - length(replace(d, a, ''))) / length(a) <> 1 then raise exception 'app_data_write_rules: anchor not found once'; end if;
  execute replace(d, a, b);
end $$;
