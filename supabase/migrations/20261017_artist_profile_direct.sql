-- Artists save their own photo, bio, streaming and social links straight away
-- (no review). Only these fields; email and everything else stay the label's.
-- Links must be https; photos are small images; logged in the audit log.
create or replace function public.artist_update_profile(changes jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  a jsonb := public.my_artist();
  allowed text[] := array['photoUrl','bio','spotify','appleMusic','audiomack','boomplay','youtube','soundcloud','instagram','tiktok','x','facebook','website'];
  k text; v jsonb; clean jsonb := '{}'::jsonb;
begin
  if a is null then raise exception 'not an artist'; end if;
  if jsonb_typeof(changes) <> 'object' then raise exception 'invalid changes'; end if;
  perform private.rate_limit(a->>'id', 'profile', 30);
  for k, v in select * from jsonb_each(changes) loop
    if not k = any(allowed) then raise exception 'field not allowed: %', k; end if;
    if jsonb_typeof(v) <> 'string' then raise exception 'invalid value for %', k; end if;
    if k = 'photoUrl' then
      if v #>> '{}' <> '' and (v #>> '{}' !~ '^(data:image/(jpeg|png|webp);base64,|https://)' or length(v #>> '{}') > 400000) then raise exception 'invalid photo'; end if;
    elsif k = 'bio' then
      if length(v #>> '{}') > 2000 then raise exception 'bio too long'; end if;
    elsif v #>> '{}' <> '' and (v #>> '{}' !~ '^https://[^\s<>"]+$' or length(v #>> '{}') > 500) then raise exception 'invalid link for %', k;
    end if;
    clean := clean || jsonb_build_object(k, v);
  end loop;
  if clean = '{}'::jsonb then return; end if;
  update public.app_data d set value = (
      select jsonb_agg(case when s->>'id' = a->>'id' then s || clean else s end order by ord)
      from jsonb_array_elements(d.value) with ordinality t(s, ord)),
    updated_at = now()
  where d.key = 'roster';
  insert into public.audit_log (actor_email, actor_name, actor_kind, action, detail, artist_id)
  values (auth.jwt()->>'email', a->>'name', 'artist', 'updated their profile', (select string_agg(x, ', ') from jsonb_object_keys(clean) x), a->>'id');
end $$;
revoke all on function public.artist_update_profile(jsonb) from public, anon;
grant execute on function public.artist_update_profile(jsonb) to authenticated;
