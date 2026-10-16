import { Download } from 'lucide-react';
import Papa from 'papaparse';
import { parseEmpireDetailed } from '../empire.js';
import { logActivity } from '../audit.js';
import { useState } from 'react';
import { formatCents, formatDate, monthLabel } from '../constants.js';
import { slug } from '../finance.js';
import { statementFileUrl } from '../storage.js';
import { C } from '../theme.js';
import { Td, Th, exportRowsToCsv } from '../ui.jsx';

// Royalty breakdowns (EMPIRE detail on each revenue row).
export const BREAKDOWN_FIELDS = { stores: 'Platform', countries: 'Country', types: 'Format', models: 'Model', salesMonths: 'Month earned' };
export const regionNames = (() => { try { return new Intl.DisplayNames(['en'], { type: 'region' }); } catch (e) { return null; } })();
export function breakdownLabel(format, key) {
  if (key === 'Not broken down') return 'Not broken down (older statements)';
  if (format === 'countries' && /^[A-Z]{2}$/.test(key) && regionNames) { try { return regionNames.of(key); } catch (e) { return key; } }
  if (format === 'salesMonths') return monthLabel(key);
  return key;
}
export function RevenueBreakdownTable({ parts, label, format }) {
  const total = parts.reduce((t, p) => t + p.gross, 0) || 1;
  const top = parts.length ? parts[0].gross || 1 : 1;
  const yoursTotal = parts.reduce((t, p) => t + p.yours, 0);
  return (
    <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
      <table className="w-full" style={{ minWidth: 620, tableLayout: 'fixed' }}>
        <colgroup><col style={{ width: '30%' }} /><col /><col style={{ width: 120 }} /><col style={{ width: 80 }} /><col style={{ width: 130 }} /></colgroup>
        <thead><tr><Th>{label}</Th><Th>{''}</Th><Th align="right">Gross</Th><Th align="right">Share</Th><Th align="right">Your earnings</Th></tr></thead>
        <tbody>
          {parts.map(p => (
            <tr key={p.key}>
              <Td><span style={{ overflowWrap: 'anywhere' }}>{breakdownLabel(format, p.key)}</span></Td>
              <Td><span className="imss-ledger-bar" aria-hidden="true" style={{ display: 'block' }}><span style={{ width: Math.max(2, p.gross / top * 100) + '%' }}></span></span></Td>
              <Td align="right" mono>{formatCents(p.gross)}</Td>
              <Td align="right" mono>{Math.round(p.gross / total * 1000) / 10}%</Td>
              <Td align="right" mono><span style={{ color: C.teal, fontWeight: 600 }}>{formatCents(p.yours)}</span></Td>
            </tr>
          ))}
          <tr>
            <Td><span style={{ fontWeight: 600 }}>Total</span></Td><Td>{''}</Td>
            <Td align="right" mono><span style={{ fontWeight: 600 }}>{formatCents(total === 1 && !parts.length ? 0 : total)}</span></Td><Td>{''}</Td>
            <Td align="right" mono><span style={{ color: C.teal, fontWeight: 700 }}>{formatCents(yoursTotal)}</span></Td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// Original royalty statement files kept on an artist's profile.
// Artists' Detailed CSV and Label Partner Copy downloads. Off for now; the team always has them.
export const ARTIST_DETAILED_EXPORTS = false;

// Statement exports in IMSS Records format, built from the uploaded statement
// files' lines. Each line belongs to the artist's row for that track and month
// and gets that row's charge and earnings pro rata (stored figures once published).
export const codeOf = v => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
export async function statementLines(files, rows, splitOf, months) {
  const out = [];
  for (const f of files) {
    const text = await (await fetch(await statementFileUrl(f))).text();
    const { lines } = parseEmpireDetailed(Papa.parse(text, { skipEmptyLines: false }).data);
    lines.forEach(l => {
      if (!months.includes(l.statementMonth)) return;
      const r = rows.find(r => r.month === l.statementMonth && ((l.isrc && codeOf(r.isrc) === codeOf(l.isrc)) || slug(r.title) === slug(l.trackTitle || l.productTitle)));
      if (!r || !r.earning) return;
      const x = splitOf(r), k = l.gross / r.earning;
      out.push({ ...l, track: r.title, charge: x.charge * k, earnings: x.artistShare * k });
    });
  }
  return out;
}
export const sumOf = (list, key) => list.reduce((t, l) => t + l[key], 0);
export function csvDetailed(name, lines) {
  exportRowsToCsv(name, ['Statement month', 'Sales month', 'Platform', 'Service', 'Country', 'Type', 'Commercial model', 'Usage', 'Track', 'ISRC', 'Quantity', 'Gross (USD)', 'Inbound Banking Charge (USD)', 'Your earnings (USD)'],
    [...lines.map(l => [l.statementMonth, l.salesMonth, l.serviceGroup, l.service, l.country, l.type, l.model, l.usage, l.track, l.isrc, l.quantity, l.gross.toFixed(4), l.charge.toFixed(4), l.earnings.toFixed(4)]),
     ['Total', '', '', '', '', '', '', '', '', '', '', sumOf(lines, 'gross').toFixed(2), sumOf(lines, 'charge').toFixed(2), sumOf(lines, 'earnings').toFixed(2)]]);
}
export function csvByTrack(name, lines) {
  const groups = {};
  lines.forEach(l => { const k = l.statementMonth + '|' + l.track; const g = groups[k] || (groups[k] = { month: l.statementMonth, track: l.track, isrc: l.isrc, quantity: 0, gross: 0, charge: 0, earnings: 0 }); g.quantity += l.quantity; g.gross += l.gross; g.charge += l.charge; g.earnings += l.earnings; });
  const list = Object.values(groups).sort((a, b) => a.month.localeCompare(b.month) || a.track.localeCompare(b.track));
  exportRowsToCsv(name, ['Statement month', 'Track', 'ISRC', 'Streams / sales', 'Gross (USD)', 'Inbound Banking Charge (USD)', 'Your earnings (USD)'],
    [...list.map(g => [g.month, g.track, g.isrc, g.quantity, g.gross.toFixed(2), g.charge.toFixed(2), g.earnings.toFixed(2)]),
     ['Total', '', '', '', sumOf(lines, 'gross').toFixed(2), sumOf(lines, 'charge').toFixed(2), sumOf(lines, 'earnings').toFixed(2)]]);
}

// Statement files on an artist. Two IMSS-branded downloads built from the
// artist's own rows: Detailed (every line, like the uploaded report) and By
// track (one row per track per month), plus EMPIRE's original as the Label Partner Copy.
// `rows` are this artist's revenue rows; `splitOf(row)` gives charge and earnings.
export function StatementFilesList({ files = [], title = 'Statement files', empty = 'Royalty statement files uploaded by the label are kept here.', sourceLabel = '', rows = [], splitOf = null, artistName = '' }) {
  const [error, setError] = useState('');
  const sorted = [...files].sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''));
  const fileName = (f, kind) => ((artistName || 'artist') + ' ' + (f.months || []).join(' ') + ' ' + kind).trim().replace(/[^A-Za-z0-9]+/g, '-').toLowerCase();
  async function original(f) {
    setError('');
    try {
      const url = await statementFileUrl(f);
      const a = document.createElement('a'); a.href = url; a.download = f.name || 'statement.csv'; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      logActivity('downloaded Label Partner Copy', (f.months || []).join(', ') + ' · ' + (f.name || ''), f.artistId);
    } catch (err) { setError('Could not download that file. Try again in a moment.'); }
  }
  async function download(f, kind) {
    setError('');
    try {
      const lines = await statementLines([f], rows, splitOf, f.months || []);
      if (!lines.length) { setError('No lines in that file match this artist’s earnings.'); return; }
      (kind === 'detailed' ? csvDetailed : csvByTrack)(fileName(f, kind === 'detailed' ? 'detailed' : 'by-track'), lines);
    } catch (err) { setError('Could not build that statement. Try again in a moment.'); }
  }
  // The release a file is for: EMPIRE names files "<Release> royalties_detailed_<stamp>.csv".
  const releaseOf = f => String(f.name || '').replace(/\.csv$/i, '').replace(/\s*royalties_detailed.*$/i, '').trim() || (f.songs || [])[0] || 'Statement';
  const songsLine = f => { const list = f.songs || []; if (!list.length) return ''; const shown = list.slice(0, 3).join(', '); return list.length + (list.length === 1 ? ' song' : ' songs') + ': ' + shown + (list.length > 3 ? ' and ' + (list.length - 3) + ' more' : ''); };
  const isArtist = !!sourceLabel;
  const pill = { background: C.fill, color: C.text, borderRadius: 980, padding: '7px 14px', fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' };
  return (
    <section aria-label={title} className="rounded" style={{ background: C.panel }}>
      <div className="imss-dash-ph"><h2>{title}</h2><span style={{ color: C.textDim, fontSize: 13 }}>{files.length} {files.length === 1 ? 'file' : 'files'}</span></div>
      {sorted.length === 0 ? <div className="px-4 pb-4" style={{ color: C.textDim, fontSize: 15 }}>{empty}</div> : (
        <ul style={{ borderTop: '1px solid ' + C.border }}>
          {sorted.map((f, i) => (
            <li key={f.id} className="flex items-center justify-between gap-4 flex-wrap" style={{ padding: '14px 18px', borderTop: i ? '1px solid ' + C.border : 'none' }}>
              <div style={{ minWidth: 0, flex: '1 1 320px' }}>
                <div style={{ fontWeight: 600, fontSize: 16, letterSpacing: '-0.01em' }}>{releaseOf(f)}</div>
                <div style={{ color: C.textDim, fontSize: 13, marginTop: 2 }}>
                  {(f.months || []).map(monthLabel).join(' – ') || '—'}{songsLine(f) ? ' · ' + songsLine(f) : ''}
                </div>
                <div style={{ color: C.textDim, fontSize: 12, marginTop: 2 }}>{isArtist ? 'Added ' : 'Uploaded '}{formatDate(String(f.uploadedAt || '').slice(0, 10))}{!isArtist && f.uploadedBy ? ' by ' + f.uploadedBy : ''}{!isArtist && f.source ? ' · ' + f.source : ''}</div>
              </div>
              <div className="flex items-center gap-3 flex-wrap justify-end">
                <div style={{ textAlign: 'right', minWidth: 90 }}>
                  <div style={{ fontWeight: 600, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{formatCents(f.gross)}</div>
                  <div style={{ color: C.textDim, fontSize: 12 }}>gross</div>
                </div>
                {splitOf && <button onClick={() => download(f, 'track')} className="inline-flex items-center gap-1.5" style={pill}><Download size={14} aria-hidden="true" /> By track</button>}
                {splitOf && (!isArtist || ARTIST_DETAILED_EXPORTS) && <button onClick={() => download(f, 'detailed')} className="inline-flex items-center gap-1.5" style={pill}><Download size={14} aria-hidden="true" /> Detailed</button>}
                {(!isArtist || ARTIST_DETAILED_EXPORTS) && <button onClick={() => original(f)} className="inline-flex items-center gap-1.5" style={pill}><Download size={14} aria-hidden="true" /> Partner copy</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && <div className="px-4 py-3" role="alert" style={{ color: C.red, fontSize: 14 }}>{error}</div>}
    </section>
  );
}
