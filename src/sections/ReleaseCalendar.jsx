import { Calendar, ChevronLeft, ChevronRight, Disc3, Video } from 'lucide-react';
import { useMemo, useState } from 'react';
import { RELEASE_STATUSES, expirationStatus, formatDate, monthKey, releaseStatusTone, todayStr } from '../constants.js';
import { C, MONO_FONT } from '../theme.js';
import { ArtworkThumb, Badge, EmptyState, Field, KPICard, SectionHeader, Select, Td, Th } from '../ui.jsx';

export function ReleaseCalendarSection({ catalog, roster, artistMap, tasks = [] }) {
  const today = todayStr();
  const [calMonth, setCalMonth] = useState(todayStr().slice(0, 7));
  const [filterArtist, setFilterArtist] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedId, setSelectedId] = useState(null);

  function shiftMonth(delta) {
    const [y, m] = calMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setCalMonth(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
  }
  function goToday() { setCalMonth(todayStr().slice(0, 7)); }

  const filtered = catalog.filter(c => {
    if (filterArtist !== 'all' && c.artistId !== filterArtist) return false;
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    return true;
  });

  const [year, monthNum] = calMonth.split('-').map(Number);
  const firstOfMonth = new Date(year, monthNum - 1, 1);
  const startWeekday = firstOfMonth.getDay();
  const totalDays = new Date(year, monthNum, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const releasesByDay = useMemo(() => {
    const map = {};
    filtered.forEach(r => {
      if (!r.releaseDate || monthKey(r.releaseDate) !== calMonth) return;
      const day = parseInt(r.releaseDate.slice(8, 10), 10);
      map[day] = map[day] || [];
      map[day].push(r);
    });
    return map;
  }, [filtered, calMonth]);

  const otherEventsByDay = useMemo(() => {
    const map = {};
    function add(dateStr, tone) {
      if (!dateStr || monthKey(dateStr) !== calMonth) return;
      const day = parseInt(dateStr.slice(8, 10), 10);
      map[day] = map[day] || [];
      map[day].push(tone);
    }
    tasks.forEach(t => { if (t.status === 'Open') add(t.dueDate, 'task'); });
    roster.forEach(a => { if (a.contractExpiration) add(a.contractExpiration, 'contract'); });
    catalog.forEach(c => { if (c.licenseExpiration) add(c.licenseExpiration, 'license'); });
    return map;
  }, [tasks, roster, catalog, calMonth]);

  const alsoComingUp = useMemo(() => {
    const items = [];
    tasks.forEach(t => {
      if (t.status !== 'Open' || !t.dueDate || t.dueDate < today) return;
      items.push({ id: 'task-' + t.id, type: 'Task', tone: 'amber', label: t.title, sub: t.assignee, date: t.dueDate });
    });
    roster.forEach(a => {
      if (!a.contractExpiration || a.contractExpiration < today) return;
      const st = expirationStatus(a.contractExpiration);
      if (st.label === 'Active') return;
      items.push({ id: 'contract-' + a.id, type: 'Contract', tone: st.tone, label: a.name + "'s contract", sub: st.label, date: a.contractExpiration });
    });
    catalog.forEach(c => {
      if (!c.licenseExpiration || c.licenseExpiration < today) return;
      const st = c.license;
      if (st.label === 'Active') return;
      items.push({ id: 'license-' + c.id, type: 'License', tone: st.tone, label: c.title + ' license', sub: st.label, date: c.licenseExpiration });
    });
    return items.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
  }, [tasks, roster, catalog, today]);

  const upcoming = useMemo(() => {
    return filtered.filter(r => r.releaseDate && r.releaseDate >= today).sort((a, b) => a.releaseDate.localeCompare(b.releaseDate)).slice(0, 8);
  }, [filtered, today]);

  const selected = selectedId ? catalog.find(r => r.id === selectedId) || null : null;

  const monthLabelText = firstOfMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const releasesThisMonth = filtered.filter(r => r.releaseDate && monthKey(r.releaseDate) === calMonth).length;
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div>
      <SectionHeader title="Release Calendar" description="Every release plotted on the calendar, plus what's coming up next — your release radar. Click any release to see the full details." />

      <div className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
        <div className="imss-form-grid gap-3">
          <Field label="Artist">
            <Select value={filterArtist} onChange={e => setFilterArtist(e.target.value)}>
              <option value="all">All artists</option>
              {roster.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All statuses</option>
              {RELEASE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <KPICard icon={Disc3} label="Releases this month" value={releasesThisMonth} />
        <KPICard icon={Calendar} label="Upcoming releases" value={upcoming.length} tone="amber" />
      </div>

      {selected && (
        <div className="rounded border p-4 mb-6 flex items-start gap-4 flex-wrap" style={{ background: C.panel, borderColor: C.amber }}>
          <ArtworkThumb release={selected} size={72} radius={8} />
          <div style={{ minWidth: 200, flex: 1 }}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div style={{ fontWeight: 600, fontSize: 16 }}>{selected.title}</div>
              <button onClick={() => setSelectedId(null)} className="text-xs" style={{ color: C.textFaint }}>Close</button>
            </div>
            <div className="text-sm mb-2" style={{ color: C.textDim }}>{artistMap[selected.artistId] ? artistMap[selected.artistId].name : 'Unknown artist'}</div>
            <div className="flex items-center gap-1.5 flex-wrap mb-3">
              <Badge>{selected.type}</Badge>
              <Badge tone={releaseStatusTone(selected.status)}>{selected.status}</Badge>
              {selected.hasVideo && <Badge tone="default"><Video size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />Video</Badge>}
              {selected.licenseExpiration && <Badge tone={selected.license.tone}>License {selected.license.label.toLowerCase()}</Badge>}
            </div>
            <div className="text-xs" style={{ color: C.textFaint, lineHeight: 1.7 }}>
              <div>Release date: <span style={{ color: C.text, fontFamily: MONO_FONT }}>{formatDate(selected.releaseDate)}</span></div>
              {selected.upc && <div>UPC: <span style={{ color: C.text, fontFamily: MONO_FONT }}>{selected.upc}</span></div>}
              {selected.isrc && <div>ISRC: <span style={{ color: C.text, fontFamily: MONO_FONT }}>{selected.isrc}</span></div>}
              {selected.licenseExpiration && <div>License expires: <span style={{ color: C.text, fontFamily: MONO_FONT }}>{formatDate(selected.licenseExpiration)}</span></div>}
              <div>Entered by: <span style={{ color: C.text }}>{selected.enteredBy || 'Unknown'}</span></div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => shiftMonth(-1)} style={{ color: C.textDim }}><ChevronLeft size={18} /></button>
          <div className="flex items-center gap-3">
            <div style={{ fontWeight: 600 }}>{monthLabelText}</div>
            <button onClick={goToday} className="text-xs px-2 py-1 rounded" style={{ border: '1px solid ' + C.border, color: C.textFaint }}>Today</button>
          </div>
          <button onClick={() => shiftMonth(1)} style={{ color: C.textDim }}><ChevronRight size={18} /></button>
        </div>
        <div className="flex items-center gap-3 mb-3 text-xs" style={{ color: C.textFaint }}>
          <span className="flex items-center gap-1"><span style={{ width: 5, height: 5, borderRadius: 9999, background: C.amber, display: 'inline-block' }}></span> Task due</span>
          <span className="flex items-center gap-1"><span style={{ width: 5, height: 5, borderRadius: 9999, background: C.red, display: 'inline-block' }}></span> Contract or license expiring</span>
        </div>
        <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {WEEKDAYS.map(w => <div key={w} className="text-center text-xs" style={{ color: C.textFaint, padding: '4px 0' }}>{w}</div>)}
        </div>
        <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {cells.map((day, i) => {
            const dateStr = day ? calMonth + '-' + String(day).padStart(2, '0') : null;
            const isToday = dateStr === today;
            const dayReleases = day ? (releasesByDay[day] || []) : [];
            const dayEvents = day ? (otherEventsByDay[day] || []) : [];
            return (
              <div key={i} className="rounded" style={{ minHeight: 84, background: day ? C.bg : 'transparent', border: '1px solid ' + (day ? (isToday ? C.amber : C.border) : 'transparent'), padding: 5 }}>
                {day && <div className="text-xs mb-1" style={{ color: isToday ? C.amber : C.textFaint, fontWeight: isToday ? 700 : 500 }}>{day}</div>}
                {dayReleases.slice(0, 2).map(r => (
                  <button key={r.id} onClick={() => setSelectedId(r.id)} className="flex items-center gap-1 mb-1 text-left w-full" style={{ background: selectedId === r.id ? C.amberSoft : 'transparent', borderRadius: 3, padding: '1px 2px' }}>
                    <ArtworkThumb release={r} size={14} radius={3} />
                    <span style={{ minWidth: 0, lineHeight: 1.25 }}>
                      <span style={{ display: 'block', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: r.status === 'Released' ? C.teal : r.status === 'Processing' ? C.textFaint : C.amber }}>{r.title}</span>
                      <span style={{ display: 'block', fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.textFaint }}>{artistMap[r.artistId] ? artistMap[r.artistId].name : ''}</span>
                    </span>
                  </button>
                ))}
                {dayReleases.length > 2 && <div className="text-xs" style={{ color: C.textFaint }}>+{dayReleases.length - 2} more</div>}
                {dayEvents.length > 0 && (
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {dayEvents.slice(0, 4).map((tone, di) => (
                      <span key={di} style={{ width: 5, height: 5, borderRadius: 9999, background: tone === 'task' ? C.amber : C.red, flexShrink: 0 }}></span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-xs mb-3" style={{ color: C.textFaint }}>Up next</div>
      {upcoming.length === 0 ? (
        <EmptyState icon={Disc3} title="Nothing scheduled" description="Releases with a future date will show up here." />
      ) : (
        <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
          <table className="w-full" style={{ minWidth: 560 }}>
            <thead><tr><Th></Th><Th>Product</Th><Th>Artist</Th><Th>Date</Th><Th align="right">Days away</Th><Th>Status</Th></tr></thead>
            <tbody>
              {upcoming.map(r => {
                const daysAway = Math.round((new Date(r.releaseDate) - new Date(today)) / 86400000);
                return (
                  <tr key={r.id} onClick={() => setSelectedId(r.id)} style={{ cursor: 'pointer', background: selectedId === r.id ? C.amberSoft : 'transparent' }}>
                    <Td><ArtworkThumb release={r} size={32} /></Td>
                    <Td>{r.title}</Td>
                    <Td>{artistMap[r.artistId] ? artistMap[r.artistId].name : 'Unknown'}</Td>
                    <Td mono>{formatDate(r.releaseDate)}</Td>
                    <Td align="right" mono>{daysAway === 0 ? 'Today' : daysAway + 'd'}</Td>
                    <Td><Badge tone={releaseStatusTone(r.status)}>{r.status}</Badge></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs mb-3 mt-6" style={{ color: C.textFaint }}>Also coming up</div>
      {alsoComingUp.length === 0 ? (
        <div className="text-sm" style={{ color: C.textDim }}>No open task due dates or expirations in the near term.</div>
      ) : (
        <div className="rounded border" style={{ borderColor: C.border, background: C.panel }}>
          {alsoComingUp.map(item => (
            <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5" style={{ borderBottom: '1px solid ' + C.border }}>
              <div className="flex items-center gap-2">
                <span style={{ width: 6, height: 6, borderRadius: 9999, background: item.tone === 'red' ? C.red : C.amber, flexShrink: 0 }}></span>
                <div>
                  <div className="text-sm">{item.label}</div>
                  <div className="text-xs" style={{ color: C.textFaint }}>{item.type} · {item.sub}</div>
                </div>
              </div>
              <div className="text-xs" style={{ color: C.textFaint, fontFamily: MONO_FONT }}>{formatDate(item.date)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
