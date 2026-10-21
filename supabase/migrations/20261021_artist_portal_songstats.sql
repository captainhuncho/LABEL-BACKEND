-- Live platform stats (Songstats) in the artist portal. An artist gets only songs
-- that are theirs: the stats row's artist is the signed-in artist AND the song is
-- in their own catalog (cat). A song linked to no artist account, or to someone
-- else, is never sent; featured guests don't see the main artist's songs.
-- Only the fields the portal shows (no Songstats label or internal ids).
-- Patched in place (pg_get_functiondef) so the rest of artist_portal is unchanged.
do $$
declare d text := pg_get_functiondef('public.artist_portal()'::regprocedure);
  a text := '    ''payouts'', (select coalesce(jsonb_agg(p), ''[]'') from jsonb_array_elements(public.section(''payouts'')) p';
  b text := '    ''songStats'', (select coalesce(jsonb_agg(jsonb_build_object(''isrc'', s->>''isrc'', ''releaseId'', s->>''releaseId'', ''title'', s->>''title'','
         || ' ''fetchedAt'', s->>''fetchedAt'', ''songstatsUrl'', s->>''songstatsUrl'', ''sources'', s->''sources'')), ''[]'')' || chr(10)
         || '      from jsonb_array_elements(public.section(''songStats'')) s' || chr(10)
         || '      where s->>''artistId'' = aid and s->>''releaseId'' in (select c->>''id'' from jsonb_array_elements(cat) c) and jsonb_typeof(s->''sources'') = ''array''),' || chr(10);
begin
  if position('''songStats''' in d) > 0 then return; end if;
  if (length(d) - length(replace(d, a, ''))) / length(a) <> 1 then raise exception 'artist_portal: anchor not found once'; end if;
  execute replace(d, a, b || a);
end $$;
