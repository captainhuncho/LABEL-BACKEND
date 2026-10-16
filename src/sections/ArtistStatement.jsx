import { ClipboardList, DollarSign, Download, FileText, Printer, TrendingUp, Wallet } from 'lucide-react';
import { logActivity } from '../audit.js';
import { useMemo, useState } from 'react';
import { dealLabel, formatCents, monthLabel } from '../constants.js';
import { artistLifetime, recoupmentForArtist, revenueRowSplit, dealTermsOf, pctAt, slug } from '../finance.js';
import { statementFileUrl } from '../storage.js';
import { C } from '../theme.js';
import { Badge, Btn, EmptyState, Input, KPICard, Td, Th, exportRowsToCsv } from '../ui.jsx';
import { ARTIST_DETAILED_EXPORTS, statementLines, csvDetailed } from './StatementFiles.jsx';

// `requireGenerate` gates the statement behind an explicit Generate click —
// used by the artist portal, where an artist picks the period they want a
// statement for. The team-side view leaves it off and stays live.
// When earnings cross a deal change, say so: each month is paid at the deal in
// force that month. Optional "View by deal" buttons narrow the view to one deal.
export const prevMonth = m => { const [y, mo] = m.split('-').map(Number); const d = new Date(Date.UTC(y, mo - 2, 1)); return d.toISOString().slice(0, 7); };
export function dealPeriodsOf(artist) {
  const list = dealTermsOf(artist);
  return list.map((t, i) => ({ from: t.from || '', to: list[i + 1] ? prevMonth(list[i + 1].from) : '', pct: Number(t.artistPct), deal: dealLabel(t) }));
}
export const pctTxt = p => Math.round(Number(p) * 10000) / 100 + '%';
export const periodTxt = p => p.from && p.to ? monthLabel(p.from) + ' – ' + monthLabel(p.to) : p.from ? 'From ' + monthLabel(p.from) : p.to ? 'Up to ' + monthLabel(p.to) : 'All months';
export function DealSpanNote({ artist, rows = [], onPick, active = null }) {
  const periods = dealPeriodsOf(artist);
  if (periods.length < 2) return null;
  const rateOf = r => Math.round((r.final ? r.artistPct : pctAt(artist, r.month)) * 10000);
  const months = rows.map(r => r.month).sort();
  const lo = months[0], hi = months[months.length - 1];
  const touched = months.length ? periods.filter(p => (!p.to || p.to >= lo) && (!p.from || p.from <= hi)) : [];
  const mixed = new Set(rows.map(rateOf)).size > 1;
  return (
    <section aria-label="Deals in this period" className="rounded mb-5" style={{ background: mixed ? C.amberSoft : C.panel, padding: '16px 18px' }}>
      {mixed && (
        <>
          <div style={{ fontWeight: 600, fontSize: 16, letterSpacing: '-0.02em' }}>These earnings cover more than one deal</div>
          <p className="mt-1" style={{ fontSize: 14, lineHeight: 1.5 }}>Your share isn’t the same every month: each month is paid at the deal in force that month.</p>
          <ul className="mt-2 mb-1" style={{ fontSize: 14, lineHeight: 1.6 }}>
            {touched.map((p, i) => <li key={i}><b>{periodTxt(p)}</b>: {pctTxt(p.pct)} to you · {p.deal}</li>)}
          </ul>
        </>
      )}
      {onPick && (
        <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: mixed ? 10 : 0 }}>
          <span style={{ color: C.textDim, fontSize: 13 }}>View by deal:</span>
          {periods.map((p, i) => (
            <button key={i} onClick={() => onPick(p)} className={'imss-dash-preset' + (active && active.from === p.from && active.to === p.to ? ' is-on' : '')}>{periodTxt(p)} · {pctTxt(p.pct)}</button>
          ))}
        </div>
      )}
    </section>
  );
}

export function ArtistStatementView({ invoices = [], artist, revenue, masterGross, ledger, payouts, requireGenerate = false, statementFiles = [], forTeam = false }) {
  const fullExports = forTeam || ARTIST_DETAILED_EXPORTS;
  const [exportError, setExportError] = useState('');
  const [periodMode, setPeriodMode] = useState('all');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [generated, setGenerated] = useState(null);
  const [rangeError, setRangeError] = useState('');

  const artistSlug = slug(artist.name);
  const artistRevenue = useMemo(() => revenue.filter(r => r.artistSlug === artistSlug), [revenue, artistSlug]);
  const availableMonths = useMemo(() => Array.from(new Set(artistRevenue.map(r => r.month))).sort().reverse(), [artistRevenue]);
  const earliestMonth = availableMonths.length ? availableMonths[availableMonths.length - 1] : '';
  const latestMonth = availableMonths.length ? availableMonths[0] : '';

  // The period actually on screen. Gated: whatever was last generated.
  // Ungated: follows the controls live, as before.
  const shown = requireGenerate ? generated : { mode: periodMode, start: rangeStart, end: rangeEnd };

  const monthsToShow = !shown ? []
    : shown.mode === 'all'
      ? availableMonths
      : availableMonths.filter(m => (!shown.start || m >= shown.start) && (!shown.end || m <= shown.end));

  const monthRows = monthsToShow.map(month => {
    const tracks = artistRevenue.filter(r => r.month === month);
    const gross = tracks.reduce((s, r) => s + r.earning, 0);
    const splits = tracks.map(r => revenueRowSplit(r, revenue, masterGross, pctAt(artist, r.month)));
    const swift = splits.reduce((t, x) => t + x.charge, 0);
    const net = gross - swift;
    const artistShare = splits.reduce((t, x) => t + x.artistShare, 0);
    return { month, tracks, gross, swift, net, artistShare };
  });

  // Totals for the statement are summed from the rows on screen, so the
  // headline figures always reconcile against the breakdown below them.
  const periodTotals = monthRows.reduce((a, m) => ({
    gross: a.gross + m.gross, swift: a.swift + m.swift, net: a.net + m.net, artistShare: a.artistShare + m.artistShare,
  }), { gross: 0, swift: 0, net: 0, artistShare: 0 });

  const lifetime = artistLifetime(artist, revenue, masterGross);
  const recoupment = recoupmentForArtist(artist, ledger, revenue, masterGross, invoices);
  const artistPayouts = (payouts || []).filter(p => p.artistSlug === artistSlug).sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));

  function periodLabel() {
    if (!shown) return '';
    if (shown.mode === 'all' || (!shown.start && !shown.end)) return 'All periods';
    return (shown.start ? monthLabel(shown.start) : '…') + ' – ' + (shown.end ? monthLabel(shown.end) : '…');
  }
  function startCustomRange() {
    setPeriodMode('range');
    setRangeError('');
    if (!rangeStart && !rangeEnd && availableMonths.length) { setRangeStart(earliestMonth); setRangeEnd(latestMonth); }
  }
  function generate() {
    if (periodMode === 'range') {
      if (!rangeStart || !rangeEnd) { setRangeError('Pick both a start and an end month.'); return; }
      if (rangeStart > rangeEnd) { setRangeError('The start month has to come before the end month.'); return; }
    }
    setRangeError('');
    setGenerated({ mode: periodMode, start: rangeStart, end: rangeEnd });
  }
  const exportName = kind => ['imss-records', artist.name, periodLabel(), kind].join(' ').replace(/[^A-Za-z0-9]+/g, '-').toLowerCase();
  const splitOfRow = r => revenueRowSplit(r, revenue, masterGross, pctAt(artist, r.month));
  // Simple: one row per track per month, from the figures on screen.
  function exportSimple() {
    const list = monthRows.flatMap(m => m.tracks.map(t => ({ t, x: splitOfRow(t) }))).sort((a, b) => a.t.month.localeCompare(b.t.month) || a.t.title.localeCompare(b.t.title));
    const tot = list.reduce((a, { x }) => ({ g: a.g + x.gross, c: a.c + x.charge, e: a.e + x.artistShare }), { g: 0, c: 0, e: 0 });
    exportRowsToCsv(exportName('simple'), ['Statement month', 'Track', 'ISRC', 'Streams / sales', 'Gross (USD)', 'Inbound Banking Charge (USD)', 'Your earnings (USD)'],
      [...list.map(({ t, x }) => [t.month, t.title, t.isrc || '', t.quantity || '', x.gross.toFixed(2), x.charge.toFixed(2), x.artistShare.toFixed(2)]), ['Total', '', '', '', tot.g.toFixed(2), tot.c.toFixed(2), tot.e.toFixed(2)]]);
  }
  // Label Partner Copy: EMPIRE's original files for these months, unchanged.
  async function exportPartnerCopy() {
    setExportError('');
    const months = monthRows.map(m => m.month);
    const files = statementFiles.filter(f => f.artistId === artist.id && (f.months || []).some(m => months.includes(m)));
    if (!files.length) { setExportError('There’s no Label Partner Copy for this period.'); return; }
    try {
      logActivity('downloaded Label Partner Copy', periodLabel(), artist.id);
      for (const f of files) {
        const a = document.createElement('a'); a.href = await statementFileUrl(f); a.download = f.name || 'statement.csv'; a.rel = 'noopener';
        document.body.appendChild(a); a.click(); a.remove();
      }
    } catch (e) { setExportError('Could not download the Label Partner Copy. Try again in a moment.'); }
  }
  // Detailed: every line from the uploaded statements for these months.
  async function exportDetailed() {
    setExportError('');
    const months = monthRows.map(m => m.month);
    const files = statementFiles.filter(f => f.artistId === artist.id && (f.months || []).some(m => months.includes(m)));
    if (!files.length) { setExportError('There are no uploaded statement lines for this period, so only the simple version is available.'); return; }
    try {
      const lines = await statementLines(files, artistRevenue, splitOfRow, months);
      if (!lines.length) { setExportError('No statement lines match this period.'); return; }
      csvDetailed(exportName('detailed'), lines);
    } catch (e) { setExportError('Could not build the detailed statement. Try again in a moment.'); }
  }

  return (
    <div>
      <div className="imss-print-hide rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
        <div className="mb-4">
          <div className="text-xs mb-2" style={{ color: C.textFaint }}>Period</div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => { setPeriodMode('all'); setRangeError(''); }} className="text-sm px-3 py-1.5 rounded"
              style={{ background: periodMode === 'all' ? C.amberSoft : 'transparent', color: periodMode === 'all' ? C.amber : C.textDim, border: '1px solid ' + (periodMode === 'all' ? 'transparent' : C.border), fontWeight: periodMode === 'all' ? 600 : 500 }}>
              All periods
            </button>
            <button onClick={startCustomRange} className="text-sm px-3 py-1.5 rounded"
              style={{ background: periodMode === 'range' ? C.amberSoft : 'transparent', color: periodMode === 'range' ? C.amber : C.textDim, border: '1px solid ' + (periodMode === 'range' ? 'transparent' : C.border), fontWeight: periodMode === 'range' ? 600 : 500 }}>
              Custom range
            </button>
            {periodMode === 'range' && (
              <>
                <Input type="month" value={rangeStart} min={earliestMonth || undefined} max={latestMonth || undefined} onChange={e => { setRangeStart(e.target.value); setRangeError(''); }} style={{ maxWidth: 150 }} />
                <span className="text-sm" style={{ color: C.textFaint }}>to</span>
                <Input type="month" value={rangeEnd} min={earliestMonth || undefined} max={latestMonth || undefined} onChange={e => { setRangeEnd(e.target.value); setRangeError(''); }} style={{ maxWidth: 150 }} />
              </>
            )}
          </div>
          {periodMode === 'range' && availableMonths.length > 0 && (
            <div className="text-xs mt-2" style={{ color: C.textFaint }}>
              You have earnings from {monthLabel(earliestMonth)} to {monthLabel(latestMonth)}.
            </div>
          )}
          {rangeError && (
            <div className="rounded px-3 py-2 text-xs mt-3" style={{ background: C.redSoft, color: C.red, border: '1px solid ' + C.red }}>{rangeError}</div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {requireGenerate && (
            <Btn variant="primary" onClick={generate}>
              <FileText size={14} /> {generated ? 'Regenerate statement' : 'Generate statement'}
            </Btn>
          )}
          {shown && <Btn variant="ghost" onClick={exportSimple}><Download size={14} /> Simple CSV</Btn>}
          {shown && fullExports && <Btn variant="ghost" onClick={exportDetailed}><Download size={14} /> Detailed CSV</Btn>}
          {shown && fullExports && <Btn variant="ghost" onClick={exportPartnerCopy}><Download size={14} /> Label Partner Copy</Btn>}
          {exportError && <div className="w-full text-sm" role="alert" style={{ color: C.amber }}>{exportError}</div>}
          {shown && <Btn variant="ghost" onClick={() => window.print()}><Printer size={14} /> Print / save as PDF</Btn>}
        </div>
      </div>

      {!shown ? (
        <EmptyState icon={FileText} title="Choose a period to generate your statement"
          description="Pick all periods or a custom month range above, then hit Generate statement." />
      ) : (
        <>
          <div className="flex flex-wrap gap-3 mb-6">
            <KPICard icon={DollarSign} label="Gross earnings" value={formatCents(periodTotals.gross)} />
            <KPICard icon={Wallet} label="Inbound Banking Charge" value={formatCents(periodTotals.swift)} />
            {(() => {
              // The rate(s) actually used for the months on screen, not today's deal.
              const rates = [...new Set(monthRows.flatMap(m => m.tracks).map(r => Math.round((r.final ? r.artistPct : pctAt(artist, r.month)) * 10000)))];
              return <KPICard icon={TrendingUp} label="Your share" value={formatCents(periodTotals.artistShare)} tone="teal" sub={rates.length === 1 ? rates[0] / 100 + '% of net' : rates.length > 1 ? 'at your deal rates' : ''} />;
            })()}
            {recoupment.spent > 0 && (
              <KPICard icon={ClipboardList} label={recoupment.balance > 0 ? 'Still to recoup' : 'Advances recouped'} value={formatCents(recoupment.balance > 0 ? recoupment.unrecouped : recoupment.spent)} tone={recoupment.balance > 0 ? 'red' : 'teal'} sub={recoupment.balance > 0 ? 'All time: advances not yet covered by your earnings' : 'All time: fully repaid from your earnings'} />
            )}
          </div>

          <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
            <div style={{ fontWeight: 600 }}>{periodLabel()}</div>
            <div className="text-xs" style={{ color: C.textFaint }}>
              {monthRows.length} {monthRows.length === 1 ? 'month' : 'months'} with earnings
              {shown.mode !== 'all' && <> · lifetime to date {formatCents(lifetime.artistShare)}</>}
            </div>
          </div>

          <DealSpanNote artist={artist} rows={monthRows.flatMap(m => m.tracks)} active={shown.mode === 'range' ? { from: shown.dealFrom, to: shown.dealTo } : null}
            onPick={p => { const start = p.from || earliestMonth, end = p.to || latestMonth; setPeriodMode('range'); setRangeStart(start); setRangeEnd(end); setRangeError(''); setGenerated({ mode: 'range', start, end, dealFrom: p.from, dealTo: p.to }); }} />

          {monthRows.length === 0 ? (
            <EmptyState icon={DollarSign} title="No earnings in that period"
              description="Nothing was logged for the months you picked. Try a wider range, or choose all periods." />
          ) : (
            monthRows.map(({ month, tracks }) => (
              <div key={month} className="rounded border p-4 mb-5" style={{ background: C.panel, borderColor: C.border }}>
                <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                  <div style={{ fontWeight: 600 }}>{monthLabel(month)}</div>
                  {dealPeriodsOf(artist).length > 1 && <span style={{ color: C.textDim, fontSize: 13 }}>Your share: {pctTxt(tracks[0] && tracks[0].final ? tracks[0].artistPct : pctAt(artist, month))} of net</span>}
                </div>
                <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.bg }}>
                  <table className="w-full" style={{ minWidth: 320 }}>
                    <thead><tr><Th>Track</Th><Th align="right">Gross earning</Th></tr></thead>
                    <tbody>
                      {tracks.map(t => (
                        <tr key={t.id}>
                          <Td>{t.title}</Td>
                          <Td align="right" mono>{formatCents(t.earning)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}

          {artistPayouts.length > 0 && (
            <div className="mt-2">
              <div className="text-sm mb-2" style={{ fontWeight: 600 }}>Payout history</div>
              <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
                <table className="w-full" style={{ minWidth: 500 }}>
                  <thead><tr><Th>Period</Th><Th align="right">Your share</Th><Th>Status</Th></tr></thead>
                  <tbody>
                    {artistPayouts.map(p => (
                      <tr key={p.id}>
                        <Td mono>{p.periodStart} – {p.periodEnd}</Td>
                        <Td align="right" mono>{formatCents(p.artistShare)}</Td>
                        <Td><Badge tone={p.status === 'paid' ? 'teal' : 'amber'}>{p.status}</Badge></Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
