-- Budget sub-categories carry their type (Advance / Marketing Advance) to the artist portal.
do $$
declare d text := pg_get_functiondef('public.artist_portal()'::regprocedure);
  old text := 'jsonb_build_object(''id'', c->>''id'', ''category'', c->>''category'', ''allocated'', c->''allocated'')';
begin
  if position(old in d) = 0 then raise exception 'artist_portal: budget categories not found'; end if;
  execute replace(d, old, 'jsonb_build_object(''id'', c->>''id'', ''type'', coalesce(c->>''type'', ''''), ''category'', c->>''category'', ''allocated'', c->''allocated'')');
end $$;
