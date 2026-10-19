-- Tightening after the advisor review (2026-10-19).

-- 1) Stored documents (invoice files, contracts) are evidence: the app only
-- uploads new files (upsert: false) and reads them, so the team can't delete or
-- overwrite one. Artists and reps keep their own narrower policies.
drop policy if exists "team manages documents" on storage.objects;
drop policy if exists "team reads documents" on storage.objects;
drop policy if exists "team adds documents" on storage.objects;
create policy "team reads documents" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (select public.is_team_member()));
create policy "team adds documents" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (select public.is_team_member()));

-- 2) Welcome emails: at most 20 an hour per Admin, so a stuck button or a
-- script can't mail the roster over and over.
do $$
declare f text; d text;
  a text := 'if not private.is_admin() then raise exception ''Admin only''; end if;';
begin
  foreach f in array array['public.send_portal_welcome(text)', 'public.send_team_welcome(text)'] loop
    d := pg_get_functiondef(f::regprocedure);
    if position('rate_limit' in d) > 0 then continue; end if;
    if position(a in d) = 0 then raise exception '%: anchor not found', f; end if;
    d := replace(d, a, a || ' perform private.rate_limit(lower(auth.jwt()->>''email''), ''welcome-email'', 20);');
    execute d;
  end loop;
end $$;

-- 3) Bell notifications: evaluate the signed-in email once per query, not per row.
drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications for select to authenticated
  using (lower(recipient_email) = lower((select auth.jwt() ->> 'email')));

-- 4) The rate-limit log gets a primary key.
alter table private.artist_actions add column if not exists id bigint generated always as identity;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'private.artist_actions'::regclass and contype = 'p') then
    alter table private.artist_actions add primary key (id);
  end if;
end $$;

-- 5) Monday's release-week emails go through the delivery queue too (the
-- notify function records the batch), so failed ones are retried.
create or replace function public.delivery_create(events jsonb)
returns bigint language sql volatile security definer set search_path = '' as $$
  select private.new_delivery(events);
$$;
revoke all on function public.delivery_create(jsonb) from public, anon, authenticated;
grant execute on function public.delivery_create(jsonb) to service_role;
