-- Invoices (amounts, payees, files) are readable only by the people who work on
-- them: Admin, Legal, Finance, Product Managers, anyone with Budgets & expenses,
-- and anyone assigned a queue in the invoice workflow. Everyone else's app loads
-- the section as empty. Artists and label reps still get their own invoices
-- through artist_portal() and rep_portal().

create or replace function private.can_read_invoices()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.me()->>'role', '') in ('Admin', 'Legal', 'Finance', 'Product Manager')
      or private.my_perm('spend')
      or exists (select 1 from public.app_data d, jsonb_each(coalesce(d.value->'invoiceWorkflow', '{}'::jsonb)) w
                  where d.key = 'labelSettings' and jsonb_typeof(w.value) = 'array' and w.value ? (private.me()->>'id'));
$$;
revoke all on function private.can_read_invoices() from public, anon, authenticated;

create or replace function public.can_read_section(k text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when k in ('revenue', 'masterGross', 'payouts', 'publishedRevenue', 'revenuePublish', 'statementFiles') then private.my_perm('royalties')
    when k in ('ledger', 'overheads', 'labelBudgets') then private.my_perm('spend')
    when k in ('roster', 'dealChanges') then private.can_see_deals()
    when k = 'invoices' then private.can_read_invoices()
    else true end;
$$;
