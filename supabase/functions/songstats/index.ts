// Song stats from Songstats (Enterprise API), pulled server-side so the API key
// (secret SONGSTATS_API_KEY) never reaches a browser. Called only with the
// internal x-notify-secret (cron or an Admin tool), like `notify`.
//   { action: 'probe', isrc }   one song, returns what Songstats sent; stores nothing
//   { action: 'sync', limit? }  every catalog song with an ISRC → app_data 'songStats'
// Stats are kept apart from earnings: royalties only ever come from statements.
import { createClient } from 'npm:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const KEY = Deno.env.get('SONGSTATS_API_KEY') ?? '';
const BASE = 'https://api.songstats.com/enterprise/v1';
const MAX_SONGS = 500; // per run; the plan's monthly allowance is shared, so stay well inside it
const ISRC = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/;

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

async function sync(limit: number) {
  const songs = (await section('catalog')).filter(c => typeof c.isrc === 'string' && ISRC.test(String(c.isrc).trim().toUpperCase()));
  const prev = new Map((await section('songStats')).map(s => [String(s.isrc), s]));
  const out: Item[] = [];
  let ok = 0, failed = 0;
  for (const c of songs.slice(0, limit)) {
    const isrc = String(c.isrc).trim().toUpperCase();
    const r = await songstats('/tracks/stats', { isrc });
    const sources = r.status === 200 ? bySource(r.body) : [];
    if (sources.length) {
      ok++;
      out.push({ id: isrc, isrc, releaseId: c.id, artistId: c.artistId, title: c.title, fetchedAt: new Date().toISOString(), sources });
    } else {
      failed++;
      // keep the last good numbers rather than blanking a song on a bad day
      const old = prev.get(isrc);
      if (old) out.push({ ...old, releaseId: c.id, artistId: c.artistId, title: c.title, lastError: `HTTP ${r.status}` });
    }
  }
  const { error } = await db.from('app_data').upsert({ key: 'songStats', value: out, updated_at: new Date().toISOString() });
  if (error) throw error;
  return { songs: songs.length, fetched: ok, failed, stored: out.length };
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
      const info = await songstats('/tracks/info', { isrc });
      const stats = await songstats('/tracks/stats', { isrc });
      return Response.json({ info, stats, parsed: bySource(stats.body) });
    }
    if (body.action === 'sync') return Response.json(await sync(Math.min(Number(body.limit) || MAX_SONGS, MAX_SONGS)));
    return Response.json({ error: 'unknown action' }, { status: 400 });
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
});
