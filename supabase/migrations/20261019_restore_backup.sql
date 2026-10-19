-- Restore a backup file in one database transaction, Admin only.
-- Before writing, every current section is copied to private.app_data_archive
-- (archive_id 'pre-restore-<time>'), so the restore can be undone from the
-- server, not just from a file in the Admin's browser. The file is checked
-- first: known section names only, lists where lists belong, the core sections
-- present, and an active Admin left on the team. Restored items don't re-send
-- emails (they were sent when they first happened). Taking people off Team or
-- Roster still removes their sign-in, as on any save (more than 2 at once removes none).
-- rosterPublic is skipped: it is rebuilt from roster.

do $$
declare d text := pg_get_functiondef('private.app_data_events()'::regprocedure);
  a text := '  if new.key not in (''artistRequests''';
begin
  if position('imss.restoring' in d) > 0 then return; end if;
  if position(a in d) = 0 then raise exception 'app_data_events: anchor not found'; end if;
  d := replace(d, a, '  if coalesce(current_setting(''imss.restoring'', true), '''') = ''on'' then return new; end if;' || chr(10) || a);
  execute d;
end $$;

create or replace function public.restore_backup(sections jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  k text; v jsonb; snap text; n int := 0;
  skip text[] := array['exportedAt', 'source', 'backupOf', 'dataVersion', 'rosterPublic'];
  allowed text[] := array['roster', 'catalog', 'revenue', 'streams', 'payouts', 'masterGross', 'labelSettings',
    'staff', 'tasks', 'ledger', 'notices', 'labelBudgets', 'overheads', 'profileRequests', 'accessRequests',
    'artistRequests', 'invoices', 'statementFiles', 'publishedRevenue', 'revenuePublish', 'dealChanges',
    'releaseSubmissions', 'activityLog'];
begin
  if not private.is_admin() then raise exception 'Only an Admin can restore a backup' using errcode = '42501'; end if;
  if jsonb_typeof(sections) <> 'object' then raise exception 'Not a backup file' using errcode = '22023'; end if;
  if not (sections ? 'roster' and sections ? 'catalog' and sections ? 'staff') then
    raise exception 'That file isn''t a complete backup (roster, catalog and staff are required)' using errcode = '22023';
  end if;
  for k, v in select key, value from jsonb_each(sections) loop
    if k = any(skip) then continue; end if;
    if not (k = any(allowed)) then raise exception 'Unknown section in file: %', k using errcode = '22023'; end if;
    if k = 'labelSettings' then
      if jsonb_typeof(v) <> 'object' then raise exception 'labelSettings must be an object' using errcode = '22023'; end if;
    elsif jsonb_typeof(v) <> 'array' then
      raise exception '% must be a list', k using errcode = '22023';
    end if;
  end loop;
  -- The restored team list must still have an Admin who can sign in.
  if not exists (select 1 from jsonb_array_elements(sections->'staff') s
                  where s->>'role' = 'Admin' and coalesce(s->>'status', '') not in ('Archived', 'Inactive') and coalesce(s->>'email', '') like '%@%') then
    raise exception 'The file''s team list has no active Admin; restoring it would lock everyone out' using errcode = '22023';
  end if;

  snap := 'pre-restore-' || to_char(clock_timestamp() at time zone 'utc', 'YYYY-MM-DD"T"HH24MISS');
  insert into private.app_data_archive (archive_id, key, value, archived_at, note)
    select snap, key, value, now(), 'Before restoring a backup (by ' || coalesce(auth.jwt()->>'email', 'unknown') || ')' from public.app_data;

  perform set_config('imss.restoring', 'on', true);
  for k, v in select key, value from jsonb_each(sections) loop
    if k = any(skip) then continue; end if;
    update public.app_data set value = v where key = k;
    if not found then insert into public.app_data (key, value) values (k, v); end if;
    n := n + 1;
  end loop;
  perform set_config('imss.restoring', '', true);

  insert into public.audit_log (actor_email, actor_name, actor_kind, action, detail)
  values (auth.jwt()->>'email', coalesce(private.me()->>'name', auth.jwt()->>'email'), 'team', 'restored a backup',
          coalesce(sections->>'backupOf', sections->>'exportedAt', 'file') || ' · ' || n || ' sections · undo copy ' || snap);
  return jsonb_build_object('sections', n, 'snapshot', snap);
end $$;
revoke all on function public.restore_backup(jsonb) from public, anon;
grant execute on function public.restore_backup(jsonb) to authenticated;
