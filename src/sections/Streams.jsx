import { Download, FileText, Pencil, Plus, Radio, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PLATFORMS, computePlatformLeaderboard, formatDate, formatNumber, monthKey, monthLabel, todayStr, trackOptionLabel, uid } from '../constants.js';
import { C, MONO_FONT } from '../theme.js';
import { Badge, Btn, ConfirmInline, EmptyState, Field, Input, KPICard, SectionHeader, Select, Td, Th } from '../ui.jsx';

export function StreamsSection({ streams, update, catalog, releaseMap, artistMap, canEdit = true }) {
  const empty = { date: todayStr(), platform: 'Spotify', releaseId: catalog[0] ? catalog[0].id : '', count: '' };
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [confirmId, setConfirmId] = useState(null);
  const [filters, setFilters] = useState({ startDate: '', endDate: '', product: 'all', search: '' });
  const [view, setView] = useState('leaderboard');
  const allMonths = useMemo(() => Array.from(new Set(streams.map(s => monthKey(s.date)))).sort(), [streams]);
  const [leaderboardMonth, setLeaderboardMonth] = useState('');

  function openAdd() { setForm({ ...empty, releaseId: catalog[0] ? catalog[0].id : '' }); setEditing(null); setShowForm(true); }
  function openEdit(s) { setForm({ ...s, count: String(s.count) }); setEditing(s.id); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); }
  function save(e) {
    e.preventDefault();
    const cnt = Number(form.count);
    if (!cnt || cnt < 0 || !form.releaseId) return;
    const payload = { ...form, count: cnt };
    if (editing) update(streams.map(s => s.id === editing ? { ...payload, id: editing } : s));
    else update([...streams, { ...payload, id: uid() }]);
    closeForm();
  }
  function remove(id) { update(streams.filter(s => s.id !== id)); setConfirmId(null); }
  // Date range applies on Generate; product and search stay live.
  const [appliedRange, setAppliedRange] = useState({ startDate: '', endDate: '' });
  const [rangeError, setRangeError] = useState('');
  function resetFilters() { setFilters({ startDate: '', endDate: '', product: 'all', search: '' }); setAppliedRange({ startDate: '', endDate: '' }); setRangeError(''); }
  function applyRange() {
    if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
      setRangeError('The "from" date has to come before the "to" date.');
      return;
    }
    setRangeError('');
    setAppliedRange({ startDate: filters.startDate, endDate: filters.endDate });
  }

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return streams.filter(s => {
      if (appliedRange.startDate && s.date < appliedRange.startDate) return false;
      if (appliedRange.endDate && s.date > appliedRange.endDate) return false;
      if (filters.product !== 'all' && s.releaseId !== filters.product) return false;
      if (!q) return true;
      const rel = releaseMap[s.releaseId];
      if (!rel) return false;
      const artist = artistMap[rel.artistId];
      return (
        (rel.title && rel.title.toLowerCase().includes(q)) ||
        (rel.upc && rel.upc.toLowerCase().includes(q)) ||
        (rel.isrc && rel.isrc.toLowerCase().includes(q)) ||
        (artist && artist.name.toLowerCase().includes(q))
      );
    });
  }, [streams, filters, appliedRange, releaseMap, artistMap]);

  function exportCsv() {
    const rows = [['Date', 'Platform', 'Product', 'Artist', 'UPC', 'ISRC', 'Streams']];
    [...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || '')).forEach(s => {
      const rel = releaseMap[s.releaseId];
      const artist = rel && artistMap[rel.artistId] ? artistMap[rel.artistId].name : '';
      rows.push([s.date, s.platform, rel ? rel.title : '', artist, rel ? (rel.upc || '') : '', rel ? (rel.isrc || '') : '', String(s.count)]);
    });
    const csv = rows.map(r => r.map(v => (/[",\n]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : v)).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'streams-export.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const sorted = [...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const totalsByPlatform = useMemo(() => {
    const map = {};
    filtered.forEach(s => { map[s.platform] = (map[s.platform] || 0) + s.count; });
    return PLATFORMS.map(p => ({ platform: p, value: map[p] || 0 })).filter(x => x.value > 0);
  }, [filtered]);
  const trend = useMemo(() => {
    const map = {};
    filtered.forEach(s => { const k = monthKey(s.date); map[k] = (map[k] || 0) + s.count; });
    return Object.keys(map).sort().map(k => ({ month: monthLabel(k), value: map[k] }));
  }, [filtered]);
  const total = filtered.reduce((s, r) => s + r.count, 0);
  const filtersActive = !!(appliedRange.startDate || appliedRange.endDate || filters.product !== 'all' || filters.search);

  const currentMonth = leaderboardMonth || allMonths[allMonths.length - 1] || '';
  const currentMonthIdx = allMonths.indexOf(currentMonth);
  const previousMonth = currentMonthIdx > 0 ? allMonths[currentMonthIdx - 1] : '';
  const leaderboard = useMemo(() => computePlatformLeaderboard(streams, releaseMap, artistMap, currentMonth, previousMonth, 5), [streams, releaseMap, artistMap, currentMonth, previousMonth]);
  const grandTotal = leaderboard.reduce((s, p) => s + p.totalCurrent, 0);

  const VIEWS = [
    { id: 'leaderboard', label: 'Platform leaderboard' },
    { id: 'trend', label: 'Trend' },
    { id: 'log', label: 'Entry log', count: sorted.length },
  ];

  return (
    <div>
      <SectionHeader title="Streams" description="Track stream counts by platform and product over time." action={canEdit && <Btn variant="primary" onClick={openAdd}><Plus size={14} /> Log streams</Btn>} />

      <div className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
        <div className="imss-form-grid gap-3 mb-3">
          <Field label="Start date"><Input type="date" value={filters.startDate} onChange={e => { setFilters({ ...filters, startDate: e.target.value }); setRangeError(''); }} /></Field>
          <Field label="End date"><Input type="date" value={filters.endDate} onChange={e => { setFilters({ ...filters, endDate: e.target.value }); setRangeError(''); }} /></Field>
          <Field label="Product">
            <Select value={filters.product} onChange={e => setFilters({ ...filters, product: e.target.value })}>
              <option value="all">All products</option>
              {[...catalog].sort((a, b) => a.title.localeCompare(b.title)).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </Select>
          </Field>
          <Field label="Search" full><Input value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} placeholder="Product, UPC, ISRC, or artist" /></Field>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Btn variant="primary" onClick={applyRange}><FileText size={14} /> Generate</Btn>
          <Btn variant="ghost" onClick={exportCsv}><Download size={14} /> Export to CSV</Btn>
          <Btn variant="ghost" onClick={resetFilters}>Reset</Btn>
        </div>
        {filtersActive && <div className="text-xs mt-2" style={{ color: C.textFaint }}>Showing {filtered.length} of {streams.length} entries</div>}
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <KPICard icon={Radio} label="Total streams" value={formatNumber(total)} tone="teal" />
        {totalsByPlatform.slice(0, 3).map(t => (<KPICard key={t.platform} icon={Radio} label={t.platform} value={formatNumber(t.value)} />))}
      </div>

      {showForm && (
        <form onSubmit={save} className="rounded border p-4 mb-6 imss-form-grid gap-3" style={{ background: C.panel, borderColor: C.borderLight }}>
          <Field label="Date"><Input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Platform">
            <Select value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })}>
              {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
            </Select>
          </Field>
          <Field label="Product" full>
            <Select value={form.releaseId} onChange={e => setForm({ ...form, releaseId: e.target.value })}>
              {catalog.map(r => <option key={r.id} value={r.id}>{trackOptionLabel(r, true, artistMap[r.artistId] ? artistMap[r.artistId].name : null)}</option>)}
            </Select>
          </Field>
          <Field label="Stream count"><Input type="number" min="0" required value={form.count} onChange={e => setForm({ ...form, count: e.target.value })} /></Field>
          <div className="imss-span-2 flex gap-2 mt-1">
            <Btn variant="primary" type="submit">{editing ? 'Save changes' : 'Log streams'}</Btn>
            <Btn variant="ghost" onClick={closeForm}>Cancel</Btn>
          </div>
        </form>
      )}

      {catalog.length === 0 && <div className="text-sm mb-4" style={{ color: C.textDim }}>Add a release to the catalog before logging streams.</div>}

      <div className="flex gap-1 mb-4 flex-wrap border-b" style={{ borderColor: C.border }}>
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => setView(v.id)}
            className="text-sm px-3 py-2 inline-flex items-center gap-1.5"
            style={{
              color: view === v.id ? C.amber : C.textDim,
              fontWeight: view === v.id ? 600 : 500,
              borderBottom: '2px solid ' + (view === v.id ? C.amber : 'transparent'),
              marginBottom: -1,
            }}>
            {v.label}
            {v.count !== undefined && <span className="text-xs" style={{ color: C.textFaint, fontFamily: MONO_FONT }}>{v.count}</span>}
          </button>
        ))}
      </div>

      {view === 'leaderboard' && (
        allMonths.length === 0 ? (
          <EmptyState icon={Radio} title="No stream data yet" description="Log platform stream counts to see the leaderboard." />
        ) : (
          <div>
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <div style={{ maxWidth: 220 }}>
                <Select value={currentMonth} onChange={e => setLeaderboardMonth(e.target.value)}>
                  {allMonths.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
                </Select>
              </div>
              <div className="text-sm" style={{ color: C.textDim }}>
                <span style={{ fontFamily: MONO_FONT, color: C.text, fontWeight: 600 }}>{formatNumber(grandTotal)}</span> total streams this period
                {!previousMonth && <span style={{ color: C.textFaint }}> · no prior month to compare against</span>}
              </div>
            </div>
            <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
              <table className="w-full" style={{ minWidth: 900 }}>
                <thead>
                  <tr>
                    <Th>Rank</Th>
                    {leaderboard.map(p => <Th key={p.platform}>{p.platform}</Th>)}
                  </tr>
                  <tr>
                    <Th align="right">Total</Th>
                    {leaderboard.map(p => (
                      <Th key={p.platform}>
                        {!p.hasData ? <span style={{ color: C.red, fontWeight: 500 }}>Missing reports</span> : (
                          <span style={{ fontFamily: MONO_FONT, fontWeight: 600, color: C.text }}>
                            {formatNumber(p.totalCurrent)}
                            {p.totalPctChange !== null && (
                              <span style={{ color: p.totalPctChange >= 0 ? C.teal : C.red, marginLeft: 6, fontWeight: 500 }}>
                                {p.totalPctChange >= 0 ? '+' : ''}{p.totalPctChange.toFixed(1)}%
                              </span>
                            )}
                          </span>
                        )}
                      </Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[0, 1, 2, 3, 4].map(rankIdx => (
                    <tr key={rankIdx}>
                      <Td mono align="right">{rankIdx + 1}</Td>
                      {leaderboard.map(p => {
                        const row = p.rows[rankIdx];
                        return (
                          <Td key={p.platform}>
                            {!row ? <span style={{ color: C.textFaint }}>—</span> : (
                              <div style={{ lineHeight: 1.5 }}>
                                <div style={{ fontWeight: 500 }}>{row.title}</div>
                                <div className="text-xs" style={{ color: C.textFaint }}>{row.artistName}</div>
                                <div className="text-xs" style={{ fontFamily: MONO_FONT }}>
                                  {formatNumber(row.count)} streams
                                  {row.pctChange !== null && (
                                    <span style={{ color: row.pctChange >= 0 ? C.teal : C.red, marginLeft: 6 }}>
                                      {row.pctChange >= 0 ? '+' : ''}{row.pctChange.toFixed(1)}%
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs" style={{ color: C.textFaint }}>Previous: {row.prevRank ? '#' + row.prevRank : 'N/A'}</div>
                              </div>
                            )}
                          </Td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {view === 'trend' && (
        trend.length === 0 ? (
          <EmptyState icon={Radio} title={filtersActive ? 'No matching streams' : 'No stream data yet'} description={filtersActive ? 'Try widening the date range or clearing the search.' : 'Log platform stream counts to see trends over time.'} />
        ) : (
          <div className="rounded p-4 border" style={{ background: C.panel, borderColor: C.border }}>
            <div className="text-xs mb-3" style={{ color: C.textFaint }}>Streams by month</div>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: C.textFaint, fontSize: 11 }} axisLine={{ stroke: C.border }} tickLine={false} />
                  <YAxis tick={{ fill: C.textFaint, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? Math.round(v / 1000) + 'k' : v} />
                  <Tooltip contentStyle={{ background: C.panel2, border: '1px solid ' + C.border, borderRadius: 12, fontSize: 13, color: C.text }} formatter={(v) => formatNumber(v)} />
                  <Line type="monotone" dataKey="value" stroke={C.teal} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )
      )}

      {view === 'log' && (
        sorted.length === 0 ? (
          <EmptyState icon={Radio} title={filtersActive ? 'No matching streams' : 'No stream data yet'} description={filtersActive ? 'Try widening the date range or clearing the search.' : 'Log platform stream counts to see them here.'} />
        ) : (
          <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
            <table className="w-full" style={{ minWidth: 640 }}>
              <thead><tr><Th>Date</Th><Th>Platform</Th><Th>Product</Th><Th>Artist</Th><Th align="right">Streams</Th><Th align="right">Actions</Th></tr></thead>
              <tbody>
                {sorted.map(s => {
                  const rel = releaseMap[s.releaseId];
                  return (
                    <tr key={s.id}>
                      <Td mono>{formatDate(s.date)}</Td>
                      <Td><Badge tone="teal">{s.platform}</Badge></Td>
                      <Td>{rel ? rel.title : 'Unknown'}</Td>
                      <Td>{rel && artistMap[rel.artistId] ? artistMap[rel.artistId].name : '—'}</Td>
                      <Td align="right" mono>{formatNumber(s.count)}</Td>
                      <Td align="right">
                        {s.imported ? <span className="text-xs" style={{ color: C.textDim }}>From EMPIRE</span> : confirmId === s.id ? <ConfirmInline onConfirm={() => remove(s.id)} onCancel={() => setConfirmId(null)} /> : canEdit ? (
                          <span className="inline-flex gap-3 justify-end">
                            <button onClick={() => openEdit(s)} style={{ color: C.textDim }}><Pencil size={14} /></button>
                            <button onClick={() => setConfirmId(s.id)} style={{ color: C.textDim }}><Trash2 size={14} /></button>
                          </span>
                        ) : <span style={{ color: C.textFaint }}>—</span>}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
