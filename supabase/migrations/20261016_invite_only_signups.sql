-- Invite only: a sign-in account can only be created for an email on the Team
-- list or an artist's Roster entry. Anything else is refused before the account
-- exists, so no email is stored and no sign-in or confirmation email is sent.
create or replace function private.is_invited(addr text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(addr, '') <> '' and (
    exists (select 1 from public.app_data d, jsonb_array_elements(d.value) s
            where d.key = 'staff' and jsonb_typeof(d.value) = 'array' and lower(s->>'email') = lower(addr))
    or exists (select 1 from public.app_data d, jsonb_array_elements(d.value) a
               where d.key = 'roster' and jsonb_typeof(d.value) = 'array' and lower(a->>'email') = lower(addr)));
$$;
revoke all on function private.is_invited(text) from public, anon, authenticated;

create or replace function private.block_uninvited_signup()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_invited(new.email) then
    raise exception 'invite_only';
  end if;
  return new;
end;
$$;
revoke all on function private.block_uninvited_signup() from public, anon, authenticated;

drop trigger if exists invite_only_signups on auth.users;
create trigger invite_only_signups before insert on auth.users
  for each row execute function private.block_uninvited_signup();
