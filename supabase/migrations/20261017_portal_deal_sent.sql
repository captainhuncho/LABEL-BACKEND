-- The artist portal needs to know which deal/license entries were sent to the
-- artist (sentToArtistAt) and what kind they are, or sent items never appear.
-- Adds those fields (plus the dates and songs a rights return or license notice
-- needs); still no internal notes, attachments or who recorded them.
do $$
declare d text := pg_get_functiondef('public.artist_portal'::regproc);
        old text := '''approvedAt'', x->>''approvedAt'')), ''[]'')';
begin
  if position(old in d) = 0 then raise exception 'artist_portal: dealChanges shape not found'; end if;
  execute replace(d, old,
    '''approvedAt'', x->>''approvedAt'', ''kind'', x->>''kind'', ''sentToArtistAt'', x->>''sentToArtistAt'', ''date'', x->>''date'', ''releaseIds'', x->''releaseIds'', ''releaseId'', x->>''releaseId'', ''end'', x->>''end'')), ''[]'')');
end $$;
