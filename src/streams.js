// Stream counts from EMPIRE statements. Each imported revenue row carries
// `storeStreams` (streams per platform, from "Audio Stream"/"Video Stream" lines);
// rows imported before that only have `typeQty`, so their streams show as
// "Not broken down" until the statement files are re-read.
// Computed on read, never stored, and merged with any manual stream entries.
import { normalizeIsrc } from './constants.js';
import { slug } from './finance.js';

export const isStreamType = t => /stream/i.test(String(t || ''));
const lower = s => String(s || '').trim().toLowerCase();

export function streamsFromRevenue(revenue, catalog, roster) {
  const out = [];
  revenue.forEach(r => {
    if (r.source !== 'EMPIRE') return;
    const artist = roster.find(a => slug(a.name) === r.artistSlug);
    const release = (r.isrc && catalog.find(c => c.isrc && normalizeIsrc(c.isrc) === normalizeIsrc(r.isrc)))
      || (artist && catalog.find(c => c.artistId === artist.id && lower(c.title) === lower(r.title)));
    if (!release) return;
    const byStore = r.storeStreams && Object.keys(r.storeStreams).length ? r.storeStreams
      : { 'Not broken down': Object.entries(r.typeQty || {}).filter(([t]) => isStreamType(t)).reduce((t, [, q]) => t + q, 0) };
    Object.entries(byStore).forEach(([platform, count]) => {
      if (count > 0) out.push({ id: 'empire_' + r.id + '_' + platform, date: r.month + '-01', platform, releaseId: release.id, count, imported: true });
    });
  });
  return out;
}
