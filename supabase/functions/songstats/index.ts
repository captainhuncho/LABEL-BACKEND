// Song stats from Songstats (Enterprise API), pulled server-side so the API key
// (secret SONGSTATS_API_KEY) never reaches a browser. Called only with the
// internal x-notify-secret (cron or an Admin tool), like `notify`.
//   { action: 'probe', isrc, labelId? }  one song, returns what Songstats sent; stores nothing
//   { action: 'labels', q }     search Songstats labels (to find our songstats_label_id)
//   { action: 'sync', offset?, limit? }  catalog songs with an ISRC → app_data 'songStats' (merged by ISRC, so it can run in batches)
// Stats are kept apart from earnings: royalties only ever come from statements.
import { createClient } from 'npm:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const KEY = Deno.env.get('SONGSTATS_API_KEY') ?? '';
const BASE = 'https://api.songstats.com/enterprise/v1';
const MAX_SONGS = 500; // per run; the plan's monthly allowance is shared, so stay well inside it
const ISRC = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/;
// A label-based key must name the label on every track request (Songstats openapi: "entity-based API keys").
// IMSS RECORDS, then the partner imprints Songstats lists as their own labels (from /labels/search, 2026-10-21).
const IMSS_LABEL = Deno.env.get('SONGSTATS_LABEL_ID') || 'x6wult4n';
const IMPRINTS: [RegExp, string[]][] = [
  [/frzngh/i, ['mkit0u6f']],
  [/\btsd\b/i, ['fn74xvya']],
  [/kwamzy/i, ['37qprjis']],
  [/inshadow/i, ['1ep3zhdv']],
  [/via\s*seri/i, ['sbwo821a']],
  [/falyn/i, ['0jz1idye']],
  [/q17/i, ['762azq1r', 'xpzqs89v', 'nedxcw7u']],
];
const LABEL_ID = IMSS_LABEL;
const withLabel = (params: Record<string, string>, labelId = LABEL_ID) => (labelId ? { ...params, songstats_label_id: labelId } : params);
// Labels to try for a song, best first: the one that worked last time, IMSS, then its imprint.
const labelsFor = (song: Item, last = '') => [...new Set([last, IMSS_LABEL, ...IMPRINTS.filter(([re]) => re.test(String(song.label || ''))).flatMap(([, ids]) => ids)].filter(Boolean))];

type Item = Record<string, unknown>;

async function songstats(path: string, params: Record<string, string>) {
  const res = await fetch(`${BASE}${path}?${new URLSearchParams(params)}`, { headers: { apikey: KEY, Accept: 'application/json' } });
  const text = await res.text();
  let body: unknown = null;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 500); }
  return { status: res.status, body };
}

// Keep only plain numbers and short strings per source, whatever the exact field names are.
function flat(o: unknown): Item {
  const out: Item = {};
  if (!o || typeof o !== 'object') return out;
  for (const [k, v] of Object.entries(o as Item)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (typeof v === 'string' && v.length <= 200) out[k] = v;
  }
  return out;
}

// Songstats lists stats per platform: [{ source, data: {...} }] (or the fields inline).
function bySource(body: unknown): Item[] {
  const list = body && typeof body === 'object' ? (body as Item).stats : null;
  if (!Array.isArray(list)) return [];
  return list.filter(s => s && typeof s === 'object').map(s => {
    const it = s as Item;
    return { source: String(it.source || ''), ...flat(it.data ?? it) };
  }).filter(s => s.source);
}

async function section(key: string): Promise<Item[]> {
  const { data, error } = await db.from('app_data').select('value').eq('key', key).maybeSingle();
  if (error) throw error;
  return Array.isArray(data?.value) ? data!.value as Item[] : [];
}

async function fetchSong(c: Item, prev: Item | undefined): Promise<Item | null> {
  const isrc = String(c.isrc).trim().toUpperCase();
  let lastStatus = 0;
  for (const labelId of labelsFor(c, String(prev?.labelId || ''))) {
    const r = await songstats('/tracks/stats', withLabel({ isrc, with_links: 'true' }, labelId));
    lastStatus = r.status;
    const sources = r.status === 200 ? bySource(r.body) : [];
    if (!sources.length) continue;
    const info = ((r.body as Item).track_info || {}) as Item;
    return { id: isrc, isrc, releaseId: c.id, artistId: c.artistId, title: c.title, labelId, songstatsTrackId: info.songstats_track_id || '', songstatsUrl: info.site_url || '', fetchedAt: new Date().toISOString(), sources };
  }
  // keep the last good numbers rather than blanking a song on a bad day
  return prev ? { ...prev, releaseId: c.id, artistId: c.artistId, title: c.title, lastError: `HTTP ${lastStatus}`, lastTriedAt: new Date().toISOString() } : null;
}

async function sync(offset: number, limit: number) {
  const songs = (await section('catalog')).filter(c => typeof c.isrc === 'string' && ISRC.test(String(c.isrc).trim().toUpperCase()));
  const prev = new Map((await section('songStats')).map(s => [String(s.isrc), s]));
  const batch = songs.slice(offset, offset + limit);
  const results: (Item | null)[] = [];
  for (let i = 0; i < batch.length; i += 4) { // a few at a time, well inside the function's time limit
    results.push(...await Promise.all(batch.slice(i, i + 4).map(c => fetchSong(c, prev.get(String(c.isrc).trim().toUpperCase())))));
  }
  const merged = new Map(prev);
  results.forEach(r => { if (r) merged.set(String(r.isrc), r); });
  const live = new Set(songs.map(c => String(c.isrc).trim().toUpperCase()));
  const value = [...merged.values()].filter(s => live.has(String(s.isrc)));
  const { error } = await db.from('app_data').upsert({ key: 'songStats', value, updated_at: new Date().toISOString() });
  if (error) throw error;
  const fetched = results.filter(r => r && !r.lastError);
  return { songs: songs.length, offset, batch: batch.length, fetched: fetched.length, notFound: batch.filter((c, i) => !results[i] || results[i]!.lastError).map(c => c.title), stored: value.length, next: offset + limit < songs.length ? offset + limit : null };
}

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('ok');
  try {
    const { data: allowed } = await db.rpc('notify_secret_ok', { candidate: req.headers.get('x-notify-secret') || '' });
    if (!allowed) return new Response('forbidden', { status: 403 });
    if (!KEY) return Response.json({ error: 'SONGSTATS_API_KEY is not set' }, { status: 500 });
    const body = JSON.parse((await req.text()) || '{}') as Item;
    if (body.action === 'probe') {
      const isrc = String(body.isrc || '').trim().toUpperCase();
      if (!ISRC.test(isrc)) return Response.json({ error: 'Give one valid ISRC' }, { status: 400 });
      const labelId = String(body.labelId || LABEL_ID);
      const info = await songstats('/tracks/info', withLabel({ isrc }, labelId));
      const stats = await songstats('/tracks/stats', withLabel({ isrc }, labelId));
      return Response.json({ info, stats, parsed: bySource(stats.body) });
    }
    if (body.action === 'labels') return Response.json(await songstats('/labels/search', { q: String(body.q || '').slice(0, 100), limit: '10' }));
    if (body.action === 'sync') return Response.json(await sync(Math.max(0, Number(body.offset) || 0), Math.min(Number(body.limit) || 30, MAX_SONGS)));
    return Response.json({ error: 'unknown action' }, { status: 400 });
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
});
