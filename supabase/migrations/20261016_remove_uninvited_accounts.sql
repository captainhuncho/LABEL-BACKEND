-- Taking someone off the Team list or an artist's Roster entry (or changing
-- that email) deletes their sign-in account straight away: their devices are
-- signed out and no sign-in email can reach the old address.
-- Guard: a save that would remove more than 2 accounts at once (a bad or empty
-- save) removes none and logs a warning instead, so the team can't be wiped.
create or replace function private.remove_uninvited_accounts()
returns trigger language plpgsql security definer set search_path = '' as $$
declare removed int; candidates int;
begin
  if jsonb_typeof(new.value) <> 'array' or jsonb_array_length(new.value) = 0 then
    return new;
  end if;
  select count(*) into candidates from auth.users u where not private.is_invited(u.email);
  if candidates > 2 then
    insert into public.audit_log (actor_email, actor_name, actor_kind, action, detail)
    values ('system', 'Scheduler', 'system', 'skipped sign-in cleanup', candidates || ' accounts would lose access in one save; nothing removed. Check the Team list and Roster.');
    return new;
  end if;
  with gone as (
    delete from auth.users u where not private.is_invited(u.email) returning 1
  ) select count(*) into removed from gone;
  if removed > 0 then
    insert into public.audit_log (actor_email, actor_name, actor_kind, action, detail)
    values ('system', 'Scheduler', 'system', 'removed sign-in access', removed || ' account' || case when removed = 1 then '' else 's' end || ' no longer on the Team list or Roster');
  end if;
  return new;
end;
$$;
revoke all on function private.remove_uninvited_accounts() from public, anon, authenticated;

drop trigger if exists remove_uninvited_accounts on public.app_data;
create trigger remove_uninvited_accounts after update on public.app_data
  for each row when (new.key in ('staff', 'roster') and old.value is distinct from new.value)
  execute function private.remove_uninvited_accounts();
