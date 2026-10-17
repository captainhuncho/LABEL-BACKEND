-- An artist's sign-in email is set only by the team. Profile change requests
-- from artists have any email change removed before they're saved.
do $$
declare d text := pg_get_functiondef('public.artist_add'::regproc);
        old text := 'when ''profileRequests'' then item ||';
begin
  if position(old in d) = 0 then raise exception 'artist_add: profileRequests branch not found'; end if;
  execute replace(d, old, 'when ''profileRequests'' then jsonb_set(item, ''{changes}'', coalesce(item->''changes'', ''{}''::jsonb) - ''email'') ||');
end $$;
