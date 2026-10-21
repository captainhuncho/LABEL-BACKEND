// Live platform stats from Songstats (app_data 'songStats', pulled by the
// songstats edge function). Shown apart from EMPIRE streams: these are public,
// near-live counts, not what the label is paid on, so they're never added in.
import { useMemo, useState } from 'react';
import { ExternalLink, Music2, PlaySquare, Radio, Video } from 'lucide-react';
import { formatDate, formatNumber } from '../constants.js';
import { C } from '../theme.js';
import { KPICard, Td, Th } from '../ui.jsx';

const pick = (row, source, field) => {
  const s = (row.sources || []).find(x => x.source === source);
  return s && typeof s[field] === 'number' ? s[field] : null;
};
const num = v => (v === null ? '—' : formatNumber(v));
const SHOWN = 15;

export function SongStatsPanel({ songStats = [], artistMap = {}, visibleArtistIds = null }) {
  const [showAll, setShowAll] = useState(false);
  const rows = useMemo(() => songStats
    .filter(r => Array.isArray(r.sources) && r.sources.length)
    .filter(r => !visibleArtistIds || visibleArtistIds.has(r.artistId))
    .map(r => ({
      ...r,
      spotify: pick(r, 'spotify', 'streams_total'),
      popularity: pick(r, 'spotify', 'popularity_current'),
      playlists: pick(r, 'spotify', 'playlists_current'),
      tiktok: pick(r, 'tiktok', 'views_total'),
      youtube: pick(r, 'youtube', 'video_views_total'),
      shazam: pick(r, 'shazam', 'shazams_total'),
    }))
    .sort((a, b) => (b.spotify || 0) - (a.spotify || 0)), [songStats, visibleArtistIds]);
  if (!rows.length) return null;
  const total = f => rows.reduce((t, r) => t + (r[f] || 0), 0);
  const updated = rows.map(r => r.fetchedAt).filter(Boolean).sort().pop();

  return (
    <section aria-labelledby="songstats-h" className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
      <div className="flex items-baseline justify-between gap-2 flex-wrap mb-1">
        <h2 id="songstats-h" style={{ fontWeight: 600, fontSize: 15 }}>Live platform stats</h2>
        <span className="text-xs" style={{ color: C.textFaint }}>From Songstats{updated ? ' · updated ' + formatDate(updated.slice(0, 10)) : ''}</span>
      </div>
      <p className="text-xs mb-4" style={{ color: C.textDim, maxWidth: '70ch' }}>
        Public, all-time counts per song. Kept apart from the EMPIRE streams on this page: those are what the label is paid on, these are a near-live picture, so they're never added together. TikTok counts views of every video using the sound.
      </p>
      <div className="imss-bento mb-4">
        <div className="imss-bento-span-1"><KPICard icon={Radio} label="Spotify streams" value={formatNumber(total('spotify'))} sub={rows.length + ' songs'} tone="teal" /></div>
        <div className="imss-bento-span-1"><KPICard icon={Video} label="TikTok views" value={formatNumber(total('tiktok'))} /></div>
        <div className="imss-bento-span-1"><KPICard icon={PlaySquare} label="YouTube views" value={formatNumber(total('youtube'))} /></div>
        <div className="imss-bento-span-1"><KPICard icon={Music2} label="Shazams" value={formatNumber(total('shazam'))} /></div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr><Th>Song</Th><Th align="right">Spotify streams</Th><Th align="right">Popularity</Th><Th align="right">Playlists now</Th><Th align="right">TikTok views</Th><Th align="right">YouTube views</Th><Th align="right">Shazams</Th></tr></thead>
          <tbody>
            {(showAll ? rows : rows.slice(0, SHOWN)).map(r => (
              <tr key={r.isrc}>
                <Td>
                  <div style={{ fontWeight: 500 }}>{r.title}</div>
                  <div className="text-xs" style={{ color: C.textFaint }}>
                    {artistMap[r.artistId] ? artistMap[r.artistId].name : ''}
                    {r.songstatsUrl && <> · <a href={r.songstatsUrl} target="_blank" rel="noopener noreferrer" style={{ color: C.textDim }}>Songstats <ExternalLink size={11} style={{ display: 'inline', verticalAlign: '-1px' }} aria-hidden="true" /></a></>}
                    {r.lastError && <span style={{ color: C.amber }}> · last update failed, showing earlier numbers</span>}
                  </div>
                </Td>
                <Td align="right" mono>{num(r.spotify)}</Td>
                <Td align="right" mono>{num(r.popularity)}</Td>
                <Td align="right" mono>{num(r.playlists)}</Td>
                <Td align="right" mono>{num(r.tiktok)}</Td>
                <Td align="right" mono>{num(r.youtube)}</Td>
                <Td align="right" mono>{num(r.shazam)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > SHOWN && (
        <button type="button" onClick={() => setShowAll(v => !v)} className="text-sm mt-3" style={{ color: C.amber, minHeight: 44 }}>
          {showAll ? 'Show top ' + SHOWN : 'Show all ' + rows.length + ' songs'}
        </button>
      )}
    </section>
  );
}
