-- artist_portal() returns only what the signed-in artist may see. Before this,
-- the browser filtered some of it after the full response had arrived:
--  * notices: only those addressed to all artists or to this artist (was: every notice);
--  * deal changes: only approved ones an Admin or Legal has sent to the artist
--    (was: approved, sent or not);
--  * the artist's own record: an explicit allowlist of the fields the portal
--    uses (was: the whole roster entry, including internal notes and links);
--  * label settings: nothing (the portal doesn't use them);
--  * invoices: the fields the artist's Invoices tab uses, without the internal
--    review history, partner/rep tracking or budget links.
-- Patched in place (pg_get_functiondef) so the rest of the function is unchanged.

do $$
declare d text := pg_get_functiondef('public.artist_portal()'::regprocedure);
  pairs text[][] := array[
    array[$a$    'artist', a,$a$,
          $b$    'artist', (select coalesce(jsonb_object_agg(k, a->k), '{}'::jsonb) from unnest(array[
      'id', 'name', 'email', 'photoUrl', 'bio', 'genre', 'subGenre', 'status',
      'spotify', 'appleMusic', 'audiomack', 'boomplay', 'youtube', 'soundcloud', 'instagram', 'tiktok', 'x', 'facebook', 'website',
      'artistPct', 'royaltyRate', 'fundingTier', 'dealType', 'dealTerms', 'contractType', 'licenseYears', 'effectiveDate',
      'reportingPeriod', 'payoutThreshold', 'noExtension', 'deliveryDays', 'annualBudget',
      'recoupConfirmations', 'rightsReturned', 'terminations', 'productManager', 'anr']) k where a ? k),$b$],
    array[$a$    'notices', public.section('notices'),$a$,
          $b$    'notices', (select coalesce(jsonb_agg(n), '[]') from jsonb_array_elements(public.section('notices')) n
      where n->>'audience' = 'all' or n->>'audience' = aid),$b$],
    array[$a$    'labelSettings', (select value from public.app_data where key = 'labelSettings'),$a$,
          $b$    'labelSettings', '{}'::jsonb,$b$],
    array[$a$    'invoices', (select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(public.section('invoices')) x where x->>'artistId' = aid),$a$,
          $b$    'invoices', (select coalesce(jsonb_agg((select coalesce(jsonb_object_agg(k, x->k), '{}'::jsonb) from unnest(array[
      'id', 'artistId', 'kind', 'title', 'amount', 'status', 'category', 'categoryId', 'budgetCategory', 'invoiceDate', 'invoiceNumber',
      'payTo', 'details', 'attachment', 'attachmentName', 'messages', 'reviewNote', 'correctedNote', 'submittedAt', 'paidAt']) k where x ? k)), '[]')
      from jsonb_array_elements(public.section('invoices')) x where x->>'artistId' = aid),$b$],
    array[$a$where x->>'artistId' = aid and x->>'status' = 'Approved')$a$,
          $b$where x->>'artistId' = aid and x->>'status' = 'Approved' and coalesce(x->>'sentToArtistAt', '') <> '')$b$]
  ];
  i int;
begin
  if position('n->>''audience'' = aid' in d) > 0 then return; end if;
  for i in 1 .. array_length(pairs, 1) loop
    if position(pairs[i][1] in d) = 0 then raise exception 'artist_portal: anchor % not found', i; end if;
    d := replace(d, pairs[i][1], pairs[i][2]);
  end loop;
  execute d;
end $$;
