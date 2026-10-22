-- Finance always sees every artist (all artists' finances); only Marketing can
-- be restricted to chosen artists by Admin or Legal. Any artistIds left on a
-- Finance record are ignored. Supersedes the role list in
-- 20261020_artist_restriction.sql; the rest of pm_scope() is unchanged.
do $$
declare d text := pg_get_functiondef('private.pm_scope()'::regprocedure);
  a text := 'in (''Finance'', ''Marketing'')';
  b text := '= ''Marketing''';
begin
  if position(b in d) > 0 and position(a in d) = 0 then return; end if;
  if (length(d) - length(replace(d, a, ''))) / length(a) <> 1 then raise exception 'pm_scope: anchor not found once'; end if;
  execute replace(d, a, b);
end $$;
