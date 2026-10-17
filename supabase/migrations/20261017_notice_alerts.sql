-- A new noticeboard post alerts its audience: a bell notification and an email
-- (sent one by one by the notify function). Edits don't re-send.
do $$
declare d text := pg_get_functiondef('private.app_data_events()'::regprocedure);
  k_old text := '''revenuePublish'', ''dealChanges'') or jsonb_typeof';
  tail text := '  if jsonb_array_length(events) > 0 then';
begin
  if position(k_old in d) = 0 or position(tail in d) = 0 then raise exception 'app_data_events: anchors not found'; end if;
  d := replace(d, k_old, '''revenuePublish'', ''dealChanges'', ''notices'') or jsonb_typeof');
  d := replace(d, tail, E'  if new.key = ''notices'' then\n    select events || coalesce(jsonb_agg(jsonb_build_object(''type'', ''notice'', ''key'', ''notices'', ''id'', n->>''id'')), ''[]'')\n    into events\n    from jsonb_array_elements(new.value) n\n    where not exists (select 1 from jsonb_array_elements(old_v) o where o->>''id'' = n->>''id'');\n  end if;\n\n' || tail);
  execute d;
end $$;
