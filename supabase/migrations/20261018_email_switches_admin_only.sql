-- Email On/Off switches (labelSettings.emailSwitches) change only through an Admin.
do $$
declare d text := pg_get_functiondef('private.app_data_write_rules()'::regprocedure);
  a text := 'old_v->''invoiceWorkflow'' is distinct from new.value->''invoiceWorkflow''';
begin
  if position(a in d) = 0 then raise exception 'app_data_write_rules: anchor not found'; end if;
  if position('emailSwitches' in d) > 0 then return; end if;
  d := replace(d, a, a || E'\n       or old_v->''emailSwitches'' is distinct from new.value->''emailSwitches''');
  execute d;
end $$;
