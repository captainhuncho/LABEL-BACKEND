-- Every publish to artists is approved by an Admin: the "Finance can publish
-- directly" switch is gone. Finance requests (revenuePublish), an Admin approves.
do $$
declare d text := pg_get_functiondef('private.app_data_write_rules()'::regprocedure);
  a1 text := E'       or (money and coalesce((select (value->>''financePublishDirect'')::boolean from public.app_data where key = ''labelSettings''), false))\n';
  a2 text := 'Only an Admin can publish earnings to artists (or Finance when an Admin allows direct publishing)';
begin
  if position(a1 in d) = 0 or position(a2 in d) = 0 then raise exception 'app_data_write_rules: anchors not found'; end if;
  d := replace(d, a1, '');
  d := replace(d, a2, 'Only an Admin can publish earnings to artists');
  execute d;
end $$;
update public.app_data set value = value - 'financePublishDirect' where key = 'labelSettings' and value ? 'financePublishDirect';
