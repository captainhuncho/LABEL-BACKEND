-- Applied to production 20261015215014 (artist_reply_submission) before migrations were kept in the repo.
-- Recovered verbatim from supabase_migrations.schema_migrations on 2026-10-19.

-- An artist answers the label's "needs more info" on their own release submission:
-- appends their message to its thread and puts it back in the review queue.
create or replace function public.artist_reply_submission(submission_id text, message text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  a jsonb := public.my_artist();
  updated jsonb;
begin
  if a is null then raise exception 'not an artist'; end if;
  if coalesce(trim(message), '') = '' or length(message) > 5000 then raise exception 'invalid message'; end if;

  select jsonb_agg(case
    when s->>'id' = submission_id and s->>'artistId' = a->>'id' and s->>'status' in ('Pending', 'Needs info') then
      s || jsonb_build_object(
        'status', 'Pending',
        'messages', coalesce(s->'messages', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('from', 'artist', 'by', a->>'name', 'at', now(), 'text', trim(message))))
    else s end order by ord)
  into updated
  from jsonb_array_elements(public.section('releaseSubmissions')) with ordinality t(s, ord);

  if updated is null or updated = public.section('releaseSubmissions') then raise exception 'submission not found'; end if;
  update public.app_data set value = updated, updated_at = now() where key = 'releaseSubmissions';
end;
$$;
grant execute on function public.artist_reply_submission(text, text) to authenticated;
