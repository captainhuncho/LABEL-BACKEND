import { CheckCircle2, ChevronRight, Disc3, DollarSign, FileText, Globe, Radio, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PLATFORM_COLORS, formatCurrency, formatDate, formatNumber, monthLabel } from '../constants.js';
import { companyFinanceTotals, slug } from '../finance.js';
import { C, MONO_FONT } from '../theme.js';
import { Badge, Btn, Field, Input, KPICard, SectionHeader, Td, Th } from '../ui.jsx';

export function Overview({ roster, catalog, revenue, masterGross = [], streams, artistMap, releaseMap, notices = [], staff = [], sessionName = '', canViewRoyalties = true, attention = [], onOpen }) {
  const [filters, setFilters] = useState({ startDate: '', endDate: '' });
  // The range only takes effect on Generate — until then the dashboard shows
  // all time, so landing here is never a blank screen.
  const [applied, setApplied] = useState({ startDate: '', endDate: '' });
  const [rangeError, setRangeError] = useState('');

  const filteredRevenue = revenue.filter(r => (!applied.startDate || (r.month + '-01') >= applied.startDate) && (!applied.endDate || (r.month + '-01') <= applied.endDate));
  const filteredStreams = streams.filter(s => (!applied.startDate || s.date >= applied.startDate) && (!applied.endDate || s.date <= applied.endDate));
  const filtersActive = !!(applied.startDate || applied.endDate);
  function resetFilters() { setFilters({ startDate: '', endDate: '' }); setApplied({ startDate: '', endDate: '' }); setRangeError(''); }
  function applyRange() {
    if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
      setRangeError('The "from" date has to come before the "to" date.');
      return;
    }
    setRangeError('');
    setApplied({ ...filters });
  }

  const totalRevenue = filteredRevenue.reduce((s, r) => s + r.earning, 0);
  const totalStreams = filteredStreams.reduce((s, r) => s + r.count, 0);
  const activeArtists = roster.filter(a => a.status === 'Active').length;
  const myStaffRecord = staff.find(s => s.name === sessionName);
  const myTeamNotices = useMemo(() => {
    return [...notices.filter(n => n.audience === 'all-team' || (myStaffRecord && n.audience === myStaffRecord.id))].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [notices, myStaffRecord]);

  const finance = useMemo(() => companyFinanceTotals(roster, filteredRevenue, masterGross), [roster, filteredRevenue, masterGross]);

  const monthlyRevenue = useMemo(() => {
    const map = {};
    filteredRevenue.forEach(r => { map[r.month] = (map[r.month] || 0) + r.earning; });
    return Object.keys(map).sort().map(k => ({ month: monthLabel(k), value: map[k] }));
  }, [filteredRevenue]);

  const platformTotals = useMemo(() => {
    const map = {};
    filteredStreams.forEach(s => { map[s.platform] = (map[s.platform] || 0) + s.count; });
    return Object.keys(map).map(k => ({ name: k, value: map[k] }));
  }, [filteredStreams]);

  const topSongs = useMemo(() => {
    const map = {};
    filteredRevenue.forEach(r => {
      const key = r.artistSlug + '|' + r.title;
      if (!map[key]) map[key] = { id: key, title: r.title, type: r.type, artist: r.artist, value: 0 };
      map[key].value += r.earning;
    });
    return Object.values(map).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [filteredRevenue]);

  const topGenres = useMemo(() => {
    const map = {};
    filteredRevenue.forEach(r => {
      const artist = roster.find(a => slug(a.name) === r.artistSlug);
      const genre = artist && artist.genre ? artist.genre : 'Unspecified';
      map[genre] = (map[genre] || 0) + r.earning;
    });
    return Object.entries(map).map(([genre, value]) => ({ genre, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [filteredRevenue, roster]);

  const topMarkets = useMemo(() => {
    const map = {};
    filteredRevenue.forEach(r => {
      const artist = roster.find(a => slug(a.name) === r.artistSlug);
      const market = artist && artist.primaryMarket ? artist.primaryMarket : 'Unspecified';
      map[market] = (map[market] || 0) + r.earning;
    });
    return Object.entries(map).map(([market, value]) => ({ market, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [filteredRevenue, roster]);

  const topArtistsByRevenue = useMemo(() => {
    const map = {};
    filteredRevenue.forEach(r => { map[r.artistSlug] = (map[r.artistSlug] || 0) + r.earning; });
    return roster.map(a => ({ artist: a, value: map[slug(a.name)] || 0 })).filter(x => x.value > 0).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [filteredRevenue, roster]);

  const topArtistsByStreams = useMemo(() => {
    const map = {};
    filteredStreams.forEach(s => { const rel = releaseMap[s.releaseId]; if (rel) map[rel.artistId] = (map[rel.artistId] || 0) + s.count; });
    return roster.map(a => ({ artist: a, value: map[a.id] || 0 })).filter(x => x.value > 0).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [filteredStreams, releaseMap, roster]);

  return (
    <div>
      <SectionHeader title="Overview" description="Label performance at a glance — roster health, release activity, revenue, and stream volume." />

      <section aria-labelledby="attn-h" className="rounded border mb-6" style={{ background: C.panel, borderColor: attention.length ? C.amber : C.border }}>
        <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
          <h2 id="attn-h" style={{ fontWeight: 600, fontSize: 15 }}>Needs your attention</h2>
          {attention.length > 0 && <Badge tone="amber">{attention.length}</Badge>}
        </div>
        {attention.length === 0 ? (
          <div className="flex items-center gap-2 px-4 pb-4 text-sm" style={{ color: C.textDim }}><CheckCircle2 size={15} color={C.teal} /> You’re all caught up. Nothing is waiting on you.</div>
        ) : (
          <ul>
            {attention.map(n => (
              <li key={n.id} style={{ borderTop: '1px solid ' + C.border }}>
                <button onClick={() => onOpen && onOpen(n.tab)} className="flex items-center gap-3 w-full text-left px-4 py-3 text-sm hover:bg-white/5">
                  <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, flexShrink: 0, background: n.tone === 'red' ? C.red : C.amber }} />
                  <span className="flex-1">{n.text}</span>
                  <ChevronRight size={15} color={C.textDim} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {myTeamNotices.length > 0 && (
        <section aria-label="Notices" className="rounded mb-6" style={{ background: C.amberSoft }}>
          {myTeamNotices.map((n, i) => (
            <div key={n.id} style={{ padding: '16px 20px', borderTop: i ? '1px solid ' + C.border : 'none' }}>
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <div style={{ fontWeight: 600, fontSize: 17, letterSpacing: '-0.02em' }}>{n.title}</div>
                <div style={{ color: C.textDim, fontSize: 13 }}>{formatDate(n.createdAt)}</div>
              </div>
              <div className="mt-1" style={{ color: C.text, fontSize: 15, lineHeight: 1.45 }}>{n.message}</div>
            </div>
          ))}
        </section>
      )}

      <div className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
        <div className="imss-form-grid gap-3">
          <Field label="From"><Input type="date" value={filters.startDate} onChange={e => { setFilters({ ...filters, startDate: e.target.value }); setRangeError(''); }} /></Field>
          <Field label="To"><Input type="date" value={filters.endDate} onChange={e => { setFilters({ ...filters, endDate: e.target.value }); setRangeError(''); }} /></Field>
        </div>
        {rangeError && (
          <div className="rounded px-3 py-2 text-xs mt-3" style={{ background: C.redSoft, color: C.red, border: '1px solid ' + C.red }}>{rangeError}</div>
        )}
        <div className="flex items-center gap-2 flex-wrap mt-4">
          <Btn variant="primary" onClick={applyRange}><FileText size={14} /> Generate</Btn>
          {filtersActive && <Btn variant="ghost" onClick={resetFilters}>Reset to all-time</Btn>}
          {filtersActive && <span className="text-xs" style={{ color: C.textFaint }}>Showing {formatDate(applied.startDate) || 'the start'} – {formatDate(applied.endDate) || 'today'}</span>}
        </div>
      </div>

      <div className="imss-bento mb-6">
        <div className="imss-bento-span-3 rounded p-6 border flex flex-col justify-center" style={{ background: C.panel, borderColor: C.border, minHeight: 160 }}>
          <div className="flex items-center gap-2 mb-2" style={{ color: C.textFaint }}>
            {canViewRoyalties ? <DollarSign size={16} /> : <Radio size={16} />}
            <span className="text-sm">{canViewRoyalties ? 'Total revenue' : 'Total streams'}</span>
          </div>
          <div style={{ fontFamily: MONO_FONT, fontSize: 40, fontWeight: 700, color: C.teal, lineHeight: 1 }}>
            {canViewRoyalties ? formatCurrency(totalRevenue) : formatNumber(totalStreams)}
          </div>
          <div className="text-xs mt-2" style={{ color: C.textFaint }}>{filtersActive ? 'Selected date range' : 'All-time'}</div>
        </div>
        <div className="imss-bento-span-1"><KPICard icon={Users} label="Active artists" value={activeArtists} sub={roster.length + ' total on roster'} tone="amber" /></div>
        <div className="imss-bento-span-1"><KPICard icon={Disc3} label="Catalog size" value={catalog.length} sub={catalog.filter(c => c.status === 'Released').length + ' released'} /></div>
        <div className="imss-bento-span-1"><KPICard icon={Radio} label="Total streams" value={formatNumber(totalStreams)} /></div>

        {canViewRoyalties && <div className="imss-bento-span-3 rounded p-4 border" style={{ background: C.panel, borderColor: C.border }}>
          <div className="text-xs mb-3" style={{ color: C.textFaint }}>Revenue by month</div>
          <div style={{ height: 220 }}>
            {monthlyRevenue.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm" style={{ color: C.textFaint }}>No revenue yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: C.textFaint, fontSize: 11 }} axisLine={{ stroke: C.border }} tickLine={false} />
                  <YAxis tick={{ fill: C.textFaint, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? '$' + Math.round(v / 1000) + 'k' : '$' + Math.round(v)} />
                  <Tooltip contentStyle={{ background: C.panel2, border: '1px solid ' + C.border, borderRadius: 12, fontSize: 13, color: C.text }} labelStyle={{ color: C.text }} formatter={(v) => formatCurrency(v)} />
                  <Bar dataKey="value" fill={C.amber} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>}
        <div className="imss-bento-span-3 rounded p-4 border" style={{ background: C.panel, borderColor: C.border }}>
          <div className="text-xs mb-3" style={{ color: C.textFaint }}>Streams by platform</div>
          <div style={{ height: 220 }}>
            {platformTotals.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm" style={{ color: C.textFaint }}>No stream data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={platformTotals} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {platformTotals.map((p) => (<Cell key={p.name} fill={PLATFORM_COLORS[p.name] || C.textFaint} />))}
                  </Pie>
                  <Tooltip contentStyle={{ background: C.panel2, border: '1px solid ' + C.border, borderRadius: 12, fontSize: 13, color: C.text }} formatter={(v) => formatNumber(v)} />
                  <Legend wrapperStyle={{ fontSize: 11, color: C.textDim }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="imss-grid-2 gap-4 mb-6">
        {canViewRoyalties && <div className="rounded border" style={{ background: C.panel, borderColor: C.border }}>
          <div className="text-xs px-4 pt-4 pb-2" style={{ color: C.textFaint }}>Top artists by revenue</div>
          {topArtistsByRevenue.length === 0 ? (
            <div className="p-4 text-sm" style={{ color: C.textDim }}>No revenue recorded yet.</div>
          ) : (
            <table className="w-full">
              <tbody>
                {topArtistsByRevenue.map(({ artist, value }, i) => (
                  <tr key={artist.id}>
                    <Td mono>{i + 1}</Td>
                    <Td>{artist.name}</Td>
                    <Td align="right" mono>{formatCurrency(value)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>}
        <div className="rounded border" style={{ background: C.panel, borderColor: C.border }}>
          <div className="text-xs px-4 pt-4 pb-2" style={{ color: C.textFaint }}>Top artists by streams</div>
          {topArtistsByStreams.length === 0 ? (
            <div className="p-4 text-sm" style={{ color: C.textDim }}>No stream data yet.</div>
          ) : (
            <table className="w-full">
              <tbody>
                {topArtistsByStreams.map(({ artist, value }, i) => (
                  <tr key={artist.id}>
                    <Td mono>{i + 1}</Td>
                    <Td>{artist.name}</Td>
                    <Td align="right" mono>{formatNumber(value)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {canViewRoyalties && <div className="imss-grid-2 gap-4 mb-6">
        <div className="rounded border" style={{ background: C.panel, borderColor: C.border }}>
          <div className="text-xs px-3 pt-4 pb-2" style={{ color: C.textFaint }}>Top songs by revenue</div>
          {topSongs.length === 0 ? (
            <div className="p-4 text-sm" style={{ color: C.textDim }}>No revenue recorded yet.</div>
          ) : (
            <table className="w-full">
              <thead><tr><Th>Song</Th><Th>Type</Th><Th align="right">Amount</Th></tr></thead>
              <tbody>
                {topSongs.map(r => (
                  <tr key={r.id}>
                    <Td>{r.title}<div className="text-xs" style={{ color: C.textFaint }}>{r.artist}</div></Td>
                    <Td>{r.type}</Td>
                    <Td align="right" mono>{formatCurrency(r.value)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="rounded border p-4" style={{ background: C.panel, borderColor: C.border }}>
          <div className="text-xs mb-3" style={{ color: C.textFaint }}>Label finance snapshot</div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm"><span style={{ color: C.textDim }}>Money received (all-time)</span><span style={{ fontFamily: MONO_FONT }}>{formatCurrency(finance.totalGross)}</span></div>
            <div className="flex items-center justify-between text-sm"><span style={{ color: C.textDim }}>Inbound Banking Charges (all-time)</span><span style={{ fontFamily: MONO_FONT }}>{formatCurrency(finance.totalSwift)}</span></div>
            <div className="flex items-center justify-between text-sm"><span style={{ color: C.textDim }}>Artist share</span><span style={{ fontFamily: MONO_FONT }}>{formatCurrency(finance.artistEarn)}</span></div>
            <div className="flex items-center justify-between text-sm"><span style={{ color: C.textDim }}>Label share</span><span style={{ fontFamily: MONO_FONT, color: C.teal }}>{formatCurrency(finance.labelEarn)}</span></div>
            {Math.abs(finance.untrackedGap) > 0.01 && (
              <div className="flex items-center justify-between text-sm mt-1 pt-2" style={{ borderTop: '1px solid ' + C.borderLight, color: C.amber }}><span>Untracked gap</span><span style={{ fontFamily: MONO_FONT }}>{formatCurrency(finance.untrackedGap)}</span></div>
            )}
          </div>
        </div>
      </div>}

      {canViewRoyalties && <div className="imss-grid-2 gap-4 mb-6">
        <div className="rounded border" style={{ background: C.panel, borderColor: C.border }}>
          <div className="text-xs px-4 pt-4 pb-2" style={{ color: C.textFaint }}>Top genres by revenue</div>
          {topGenres.length === 0 ? (
            <div className="p-4 text-sm" style={{ color: C.textDim }}>No revenue recorded yet.</div>
          ) : (
            <table className="w-full">
              <tbody>
                {topGenres.map((g, i) => (
                  <tr key={g.genre}>
                    <Td mono>{i + 1}</Td>
                    <Td>{g.genre}</Td>
                    <Td align="right" mono>{formatCurrency(g.value)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="rounded border" style={{ background: C.panel, borderColor: C.border }}>
          <div className="text-xs px-4 pt-4 pb-2" style={{ color: C.textFaint }}>Top markets by revenue</div>
          {topMarkets.length === 0 ? (
            <div className="p-4 text-sm" style={{ color: C.textDim }}>No revenue recorded yet.</div>
          ) : (
            <table className="w-full">
              <tbody>
                {topMarkets.map((m, i) => (
                  <tr key={m.market}>
                    <Td mono>{i + 1}</Td>
                    <Td><Globe size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6, color: C.textFaint }} />{m.market}</Td>
                    <Td align="right" mono>{formatCurrency(m.value)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>}

    </div>
  );
}
