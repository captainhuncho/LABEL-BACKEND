-- Applied to production 20261016013737 (artist_portal_published_only) before migrations were kept in the repo.
-- Recovered verbatim from supabase_migrations.schema_migrations on 2026-10-19.

create or replace function public.artist_portal()
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare
  a jsonb := public.my_artist();
  aid text; aslug text; aname text;
  rev jsonb; cat jsonb; last_pub text;
begin
  if a is null then return null; end if;
  aid := a->>'id'; aname := a->>'name'; aslug := public.js_slug(aname);

  -- Only what the label has published to this artist.
  select coalesce(jsonb_agg(r), '[]') into rev from jsonb_array_elements(public.section('publishedRevenue')) r
    where r->>'artistSlug' = aslug;
  select max(r->>'month') into last_pub from jsonb_array_elements(rev) r;
  select coalesce(jsonb_agg(c), '[]') into cat from jsonb_array_elements(public.section('catalog')) c
    where c->>'artistId' = aid;

  return jsonb_build_object(
    'artist', a,
    'catalog', cat,
    'revenue', rev,
    'masterGross', (
      select coalesce(jsonb_agg(jsonb_build_object('month', m, 'totalGross', 0, 'swiftFee', fee)), '[]')
      from (select r->>'month' m, sum(coalesce((r->>'swiftShare')::numeric, 0)) fee from jsonb_array_elements(rev) r group by 1) x),
    'streams', (select coalesce(jsonb_agg(s), '[]') from jsonb_array_elements(public.section('streams')) s
      where s->>'releaseId' in (select c->>'id' from jsonb_array_elements(cat) c)),
    -- Statements only once sent (now or on schedule), whatever their paid status.
    'payouts', (select coalesce(jsonb_agg(p), '[]') from jsonb_array_elements(public.section('payouts')) p
      where p->>'artistSlug' = aslug and coalesce(p->>'sentAt', '') <> ''),
    -- Expenses only up to the latest month published to this artist.
    'ledger', (select coalesce(jsonb_agg(l), '[]') from jsonb_array_elements(public.section('ledger')) l
      where l->>'artist' = aname and l->>'type' = 'expense' and coalesce(l->>'approvalStatus', 'Approved') = 'Approved'
        and last_pub is not null and left(coalesce(l->>'date', ''), 7) <= last_pub),
    'notices', public.section('notices'),
    'labelSettings', (select value from public.app_data where key = 'labelSettings'),
    'profileRequests', (select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(public.section('profileRequests')) x where x->>'artistId' = aid),
    'artistRequests', (select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(public.section('artistRequests')) x where x->>'artistId' = aid),
    'releaseSubmissions', (select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(public.section('releaseSubmissions')) x where x->>'artistId' = aid),
    'invoices', (select coalesce(jsonb_agg(x), '[]') from jsonb_array_elements(public.section('invoices')) x where x->>'artistId' = aid),
    'statementFiles', (select coalesce(jsonb_agg(x - 'dataUrl'), '[]') from jsonb_array_elements(public.section('statementFiles')) x
      where x->>'artistId' = aid
        and not exists (select 1 from jsonb_array_elements_text(coalesce(x->'months', '[]')) fm
                        where not exists (select 1 from jsonb_array_elements(rev) r where r->>'month' = fm)))
  );
end;
$function$;
