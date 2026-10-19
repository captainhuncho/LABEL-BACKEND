-- Applied to production 20261015222446 (artist_rate_limits_and_file_checks) before migrations were kept in the repo.
-- Recovered verbatim from supabase_migrations.schema_migrations on 2026-10-19.

-- Rate limits and file checks on everything an artist can send.

create table if not exists private.artist_actions (
  artist_id text not null,
  action text not null,
  at timestamptz not null default now()
);
create index if not exists artist_actions_lookup on private.artist_actions (artist_id, action, at);
revoke all on private.artist_actions from public, anon, authenticated;

-- Raises if this artist did `action` `max_per_hour` times in the last hour; otherwise records it.
create or replace function private.rate_limit(artist_id text, action text, max_per_hour int)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from private.artist_actions a
      where a.artist_id = rate_limit.artist_id and a.action = rate_limit.action and a.at > now() - interval '1 hour') >= max_per_hour then
    raise exception 'Too many % in the last hour. Try again later.', action using errcode = 'P0001';
  end if;
  insert into private.artist_actions(artist_id, action) values (rate_limit.artist_id, rate_limit.action);
  delete from private.artist_actions where at < now() - interval '1 day';
end;
$$;

-- Attachments must be PDFs or common image types, sent as data URLs.
create or replace function private.valid_attachment(v text)
returns boolean language sql immutable set search_path = '' as $$
  select v is null or v = '' or v ~ '^data:(application/pdf|image/(png|jpeg|jpg|webp|gif|heic|heif));base64,[A-Za-z0-9+/=]+$';
$$;

do $$
declare def text;
begin
  def := pg_get_functiondef('public.artist_add(text,jsonb)'::regprocedure);
  def := replace(def,
    $q$  if section_key = 'invoices' then$q$,
    $q$  perform private.rate_limit(a->>'id', section_key, case section_key when 'invoices' then 10 when 'releaseSubmissions' then 10 else 20 end);
  if not (private.valid_attachment(item->>'splitSheet') and private.valid_attachment(item->>'attachment') and private.valid_attachment(item->>'artworkUrl') and private.valid_attachment(item->>'photoUrl')) then
    raise exception 'attachments must be a PDF or an image';
  end if;
  if section_key = 'invoices' then$q$);
  execute def;

  def := pg_get_functiondef('public.artist_reply_submission(text,text)'::regprocedure);
  def := replace(def,
    $q$  if coalesce(trim(message), '') = ''$q$,
    $q$  perform private.rate_limit(a->>'id', 'reply', 30);
  if coalesce(trim(message), '') = ''$q$);
  execute def;
end $$;
