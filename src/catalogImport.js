// Catalog import from a distributor's catalog export (EMPIRE's product/track
// list). Reads columns by their header names, matches each track to the Catalog
// (ISRC first, then artist + title) and works out, without saving anything:
//   fills      - empty Catalog fields the file can fill (never replaces a value)
//   adds       - tracks not in the Catalog whose main artist is on the Roster
//   clashes    - fields where the Catalog and the file disagree (left as they are)
//   unknown    - tracks whose artist isn't on the Roster (skipped)
// Same rule as the statement imports: imports fill missing details, never overwrite.
import { normalizeStr } from './constants.js';

// Header names seen in distributor exports, lower-case; first match wins.
const COLUMNS = {
  upc: ['upc', 'ean', 'upc/ean', 'barcode', 'product upc', 'release upc'],
  isrc: ['isrc', 'track isrc', 'asset isrc'],
  title: ['track title', 'track name', 'song title', 'track', 'title'],
  album: ['product title', 'release title', 'album title', 'album', 'release name', 'product name', 'product'],
  artist: ['track artist', 'track artists', 'artist', 'artists', 'artist name', 'primary artist', 'product artist', 'display artist'],
  releaseDate: ['release date', 'rd', 'street date', 'original release date', 'digital release date'],
  genre: ['genre', 'primary genre'],
  subGenre: ['sub-genre', 'subgenre', 'sub genre', 'secondary genre'],
  trackNumber: ['track number', 'track #', 'track no', 'track no.', 'position', 'track position'],
  duration: ['duration', 'length', 'track duration', 'time'],
  explicit: ['explicit', 'parental advisory', 'explicit lyrics'],
  productType: ['product type', 'release type', 'format', 'configuration'],
  productId: ['product id', 'product id#', 'product #', 'release id'],
  label: ['label', 'label name', 'imprint'],
};

export function mapColumns(header) {
  const h = header.map(x => String(x || '').trim().toLowerCase());
  const out = {};
  for (const [field, names] of Object.entries(COLUMNS)) {
    const i = names.map(n => h.indexOf(n)).find(i => i >= 0);
    if (i !== undefined) out[field] = i;
  }
  return out;
}

const code = v => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const ISRC = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/;

// "A, B & C" / "A feat. B" / "A x B" → ['A', 'B', 'C']
export function splitArtists(value) {
  return String(value || '')
    // '&' only between spaces, so names like "Moh&DaLee" stay whole
    .split(/\s*(?:,|;|\s&\s|\bfeat\.?\s|\bft\.?\s|\bfeaturing\s|\swith\s|\sx\s|\sand\s)\s*/i)
    .map(s => s.trim()).filter(Boolean);
}

// Dates as YYYY-MM-DD; accepts ISO, "2026-10-01 00:00", and DD/MM/YYYY or MM/DD/YYYY when unambiguous.
export function toIsoDate(value) {
  const s = String(value || '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    const [d, mo] = a > 12 ? [a, b] : b > 12 ? [b, a] : [null, null];
    if (d) return `${m[3]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return '';
}

function toDuration(value) {
  const s = String(value || '').trim();
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(s)) return s.replace(/^0(\d:)/, '$1');
  if (/^\d+$/.test(s)) { const n = Number(s); const sec = n > 3600 ? Math.round(n / 1000) : n; return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
  return '';
}

function trackType(productType, trackCount) {
  const t = String(productType || '').toLowerCase();
  if (t.includes('single')) return 'Single';
  if (/\bep\b/.test(t)) return 'EP Track';
  if (t.includes('album') || /\blp\b/.test(t)) return 'Album Track';
  return trackCount <= 1 ? 'Single' : trackCount <= 6 ? 'EP Track' : 'Album Track';
}

// Rows → tracks. Product-level columns (UPC, title, date…) may only be on the first row of each product.
export function readCatalogRows(rows) {
  const header = rows[0] || [];
  const col = mapColumns(header);
  if (col.isrc === undefined && col.upc === undefined) return { error: 'No ISRC or UPC column found. Is this the catalog export?', tracks: [] };
  if (col.title === undefined) return { error: 'No track title column found.', tracks: [] };
  const get = (r, f) => (col[f] === undefined ? '' : String(r[col[f]] ?? '').trim());
  const tracks = [];
  let product = {};
  for (const r of rows.slice(1)) {
    if (!r || r.every(c => !String(c || '').trim())) continue;
    const upc = code(get(r, 'upc'));
    if (upc && upc !== product.upc) product = { upc };
    for (const f of ['album', 'releaseDate', 'genre', 'subGenre', 'explicit', 'productType', 'productId', 'label']) if (get(r, f)) product[f] = get(r, f);
    const title = get(r, 'title');
    if (!title) continue;
    const flag = get(r, 'explicit') || product.explicit || '';
    tracks.push({
      isrc: ISRC.test(code(get(r, 'isrc'))) ? code(get(r, 'isrc')) : '',
      upc: product.upc || '',
      title, artists: splitArtists(get(r, 'artist')),
      album: product.album || '',
      releaseDate: toIsoDate(product.releaseDate),
      genre: [product.genre, product.subGenre].filter(Boolean).join(' / '),
      trackNumber: Number(get(r, 'trackNumber')) || null,
      duration: toDuration(get(r, 'duration')),
      explicit: /^(y|yes|true|1|explicit)$/i.test(flag) ? 'Explicit' : /^(n|no|false|0|clean|not explicit)$/i.test(flag) ? 'Clean' : '',
      productType: product.productType || '', productId: product.productId || '', label: product.label || '',
    });
  }
  // Track type from the product: a one-track product is a single.
  const perUpc = {};
  tracks.forEach(t => { if (t.upc) perUpc[t.upc] = (perUpc[t.upc] || 0) + 1; });
  return { tracks: tracks.map(t => ({ ...t, type: trackType(t.productType, perUpc[t.upc] || 1) })), columns: Object.keys(col) };
}

const FILLABLE = ['isrc', 'upc', 'releaseDate', 'genre', 'duration', 'explicit', 'album', 'trackNumber', 'label'];
const isEmpty = v => v === undefined || v === null || v === '' || v === 'Not Set';
const same = (field, a, b) => (field === 'isrc' || field === 'upc' ? code(a) === code(b) : normalizeStr(a) === normalizeStr(b));
const emptyCredits = () => ({ performedBy: '', writtenBy: '', producedBy: '', recordingEngineer: '', mixingEngineer: '', masteringEngineer: '', dolbyEngineer: '' });

// Compare tracks with the Catalog. Returns the plan and the next catalog (unsaved).
// One song per ISRC: a song on a single and an EP/album takes the single's details
// (its own date and UPC); among several, the single named after the song, then the
// earliest release. The other EPs/albums it's on are noted as `alsoOn`.
const rank = t => [t.type === 'Single' ? 0 : 1, normalizeStr(t.album) === normalizeStr(t.title) ? 0 : 1, t.releaseDate || '9999'];
const before = (a, b) => { const [x, y] = [rank(a), rank(b)]; for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i]; return false; };
export function onePerIsrc(tracks) {
  const groups = new Map(), out = [];
  for (const t of tracks) {
    if (!t.isrc) { out.push(t); continue; }
    if (!groups.has(t.isrc)) { groups.set(t.isrc, []); out.push(t.isrc); }
    groups.get(t.isrc).push(t);
  }
  return out.map(x => {
    if (typeof x !== 'string') return x;
    const all = groups.get(x);
    const keep = all.reduce((k, t) => (before(t, k) ? t : k));
    const alsoOn = [...new Set(all.filter(t => t !== keep && t.type !== 'Single' && t.album).map(t => t.album))];
    return { ...keep, alsoOn };
  });
}

// Small spelling differences ("Wave" / "Waves", "2121.0" / "2121") aren't treated as new songs.
function nearlySame(a, b) {
  const [x, y] = [normalizeStr(a).replace(/\s/g, ''), normalizeStr(b).replace(/\s/g, '')];
  if (!x || !y || x === y) return x === y;
  if ((x.startsWith(y) || y.startsWith(x)) && Math.min(x.length, y.length) >= 4 && Math.abs(x.length - y.length) <= 5) return true;
  if (Math.abs(x.length - y.length) > 2 || Math.min(x.length, y.length) < 5) return false;
  const d = Array.from({ length: x.length + 1 }, (_, i) => [i, ...Array(y.length).fill(0)]);
  for (let j = 1; j <= y.length; j++) d[0][j] = j;
  for (let i = 1; i <= x.length; i++) for (let j = 1; j <= y.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
  return d[x.length][y.length] <= 2;
}

export function planCatalogImport(rawTracks, catalog, roster, makeId, today = new Date().toISOString().slice(0, 10)) {
  const tracks = onePerIsrc(rawTracks);
  const byName = name => roster.find(a => normalizeStr(a.name) === normalizeStr(name));
  const fills = [], adds = [], clashes = [], unknown = [], maybe = [];
  let unchanged = 0;
  const patches = {};
  const used = new Set();
  for (const t of tracks) {
    const main = t.artists.map(byName).find(Boolean);
    const existing = (t.isrc && catalog.find(c => code(c.isrc) === t.isrc))
      || (main && catalog.find(c => c.artistId === main.id && !used.has(c.id) && !code(c.isrc) && normalizeStr(c.title) === normalizeStr(t.title)));
    const feats = t.artists.filter(n => !main || normalizeStr(n) !== normalizeStr(main.name));
    if (existing) {
      used.add(existing.id);
      const patch = {};
      for (const f of FILLABLE) {
        if (t[f] === '' || t[f] === null || t[f] === undefined) continue;
        if (f === 'album' && t.type === 'Single') continue;
        // A single that's also on an EP/album keeps its own UPC: a different UPC isn't a clash.
        if (f === 'upc' && !isEmpty(existing.upc) && existing.type === 'Single' && t.type !== 'Single') continue;
        if (isEmpty(existing[f])) patch[f] = t[f];
        else if (!same(f, existing[f], t[f])) clashes.push({ id: existing.id, title: existing.title, field: f, catalog: String(existing[f]), file: String(t[f]) });
      }
      if (feats.length && !(existing.collaborators || []).length) patch.collaborators = feats.map(name => ({ name, role: 'Feature', splitPercent: '' }));
      if (Object.keys(patch).length) {
        patches[existing.id] = { ...(patches[existing.id] || {}), ...patch };
        fills.push({ id: existing.id, title: existing.title, fields: Object.keys(patch) });
      } else unchanged++;
    } else if (main && catalog.some(c => c.artistId === main.id && !used.has(c.id) && !code(c.isrc) && nearlySame(c.title, t.title))) {
      const c = catalog.find(c => c.artistId === main.id && !used.has(c.id) && !code(c.isrc) && nearlySame(c.title, t.title));
      maybe.push({ id: c.id, title: c.title, fileTitle: t.title, isrc: t.isrc });
    } else if (main) {
      adds.push({
        id: makeId(), artistId: main.id, title: t.title, type: t.type, album: t.type === 'Single' ? '' : t.album,
        trackNumber: t.trackNumber, genre: t.genre, releaseDate: t.releaseDate,
        status: t.releaseDate && t.releaseDate > today ? 'Upcoming' : 'Released',
        isrc: t.isrc, upc: t.upc, label: t.label || 'IMSS Records', alsoOn: t.alsoOn || [], duration: t.duration, explicit: t.explicit || 'Not Set', hasVideo: false,
        primaryArtists: [], collaborators: feats.map(name => ({ name, role: 'Feature', splitPercent: '' })),
        credits: emptyCredits(), enteredBy: 'EMPIRE catalog export' + (t.productId ? ' (' + t.productId + ')' : ''),
      });
    } else {
      unknown.push({ title: t.title, artists: t.artists.join(', ') });
    }
  }
  const next = [...catalog.map(c => (patches[c.id] ? { ...c, ...patches[c.id] } : c)), ...adds];
  return { next, fills, adds, clashes, unknown, maybe, unchanged };
}
