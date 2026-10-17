// Notification centre (the bell) and the activity audit screen.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CheckCheck, History } from 'lucide-react';
import { markNotificationsRead, readAudit, readNotifications } from '../audit.js';
import { C } from '../theme.js';
import { EmptyState, ExportBar, Input, SectionHeader, Select, Td, Th } from '../ui.jsx';

const ago = iso => {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
};

// The bell. `routes` maps a notification topic to the screen to open on this side.
export function NotificationBell({ routes = {}, onOpen, openLeft = false }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  async function load() { try { setItems(await readNotifications()); } catch (e) { /* offline: keep what we have */ } }
  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    window.addEventListener('focus', load);
    return () => { clearInterval(t); window.removeEventListener('focus', load); };
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = e => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  const unread = items.filter(n => !n.read_at).length;
  async function go(n) {
    setItems(list => list.map(x => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x));
    markNotificationsRead([n.id]);
    setOpen(false);
    if (routes[n.tab] && onOpen) onOpen(routes[n.tab]);
  }
  async function readAll() {
    setItems(list => list.map(x => ({ ...x, read_at: x.read_at || new Date().toISOString() })));
    markNotificationsRead(null);
  }
  return (
    <div ref={box} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} aria-label={'Notifications' + (unread ? ', ' + unread + ' unread' : '')} aria-expanded={open}
        className="inline-flex items-center gap-1.5" style={{ background: C.fill, color: C.text, borderRadius: 980, padding: '8px 12px', fontSize: 14, position: 'relative' }}>
        <Bell size={15} />
        {unread > 0 && <span style={{ background: C.amberFill, color: C.onAmber, borderRadius: 9999, fontSize: 11, fontWeight: 700, minWidth: 18, height: 18, padding: '0 5px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{unread}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label="Notifications" className="rounded imss-pop" style={{ position: 'absolute', ...(openLeft ? { left: 0 } : { right: 0 }), top: 'calc(100% + 8px)', width: 'min(360px, calc(100vw - 32px))', maxHeight: 440, overflowY: 'auto', background: C.panel, boxShadow: 'var(--shadow)', border: '1px solid ' + C.border, zIndex: 30 }}>
          <div className="flex items-center justify-between" style={{ padding: '14px 16px 10px' }}>
            <div style={{ fontWeight: 600, fontSize: 17, letterSpacing: '-0.02em' }}>Notifications</div>
            {unread > 0 && <button onClick={readAll} className="inline-flex items-center gap-1" style={{ color: C.amber, fontSize: 13 }}><CheckCheck size={14} /> Mark all read</button>}
          </div>
          {items.length === 0 ? (
            <div style={{ padding: '8px 16px 18px', color: C.textDim, fontSize: 14 }}>Nothing yet. Emails we send you also land here.</div>
          ) : (
            <ul>
              {items.map(n => (
                <li key={n.id} style={{ borderTop: '1px solid ' + C.border }}>
                  <button onClick={() => go(n)} className="w-full text-left flex gap-3" style={{ padding: '12px 16px', background: n.read_at ? 'transparent' : C.amberSoft }}>
                    <span aria-hidden="true" style={{ width: 8, height: 8, marginTop: 6, borderRadius: 9999, flexShrink: 0, background: n.read_at ? 'transparent' : C.amberFill }} />
                    <span>
                      <span className="block" style={{ fontSize: 14, fontWeight: n.read_at ? 400 : 600, lineHeight: 1.35 }}>{n.title}</span>
                      <span className="block" style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>{ago(n.at)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// Activity audit, in two tabs: Team and Artists, each grouped by person.
// Admin and Legal only (enforced by the database).
export function AuditSection({ roster = [] }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [side, setSide] = useState('team');
  const [q, setQ] = useState('');
  const [artistId, setArtistId] = useState('');
  const [open, setOpen] = useState({});
  useEffect(() => { readAudit({ limit: 2000 }).then(setRows, e => { setRows([]); setError('Could not load the activity log: ' + (e.message || e)); }); }, []);
  const name = id => (roster.find(a => a.id === id) || {}).name || '';
  const when = iso => new Date(iso).toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  // The Team tab includes the scheduler's automatic jobs.
  const onSide = r => side === 'artist' ? r.actor_kind === 'artist' : r.actor_kind !== 'artist';
  const shown = useMemo(() => (rows || []).filter(r => onSide(r) && (!artistId || r.artist_id === artistId) &&
    (!q.trim() || [r.actor_name, r.action, r.detail, name(r.artist_id)].join(' ').toLowerCase().includes(q.trim().toLowerCase()))), [rows, side, artistId, q]);
  const groups = useMemo(() => {
    const m = new Map();
    shown.forEach(r => { const k = r.actor_kind === 'system' ? 'Scheduler' : r.actor_name; if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
    return [...m.entries()];
  }, [shown]);
  const counts = { team: (rows || []).filter(r => r.actor_kind !== 'artist').length, artist: (rows || []).filter(r => r.actor_kind === 'artist').length };
  return (
    <div>
      <SectionHeader title="Activity" description="What people do on the platform and in the artist portal: sign-ins, exports, downloads, submissions, approvals, publishing and changes. Entries can’t be edited or deleted." />
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="imss-seg" role="tablist" aria-label="Whose activity">
          <button role="tab" aria-selected={side === 'team'} className={side === 'team' ? 'is-on' : ''} onClick={() => { setSide('team'); setOpen({}); }}>Team{counts.team ? ' · ' + counts.team : ''}</button>
          <button role="tab" aria-selected={side === 'artist'} className={side === 'artist' ? 'is-on' : ''} onClick={() => { setSide('artist'); setOpen({}); }}>Artists{counts.artist ? ' · ' + counts.artist : ''}</button>
        </div>
        <div className="flex gap-3 flex-wrap" style={{ flex: '1 1 420px', justifyContent: 'flex-end' }}>
          <div style={{ minWidth: 220, flex: '1 1 220px', maxWidth: 320 }}><Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search actions or details" aria-label="Search activity" /></div>
          <div style={{ minWidth: 180 }}>
            <Select value={artistId} onChange={e => setArtistId(e.target.value)} aria-label={side === 'artist' ? 'Artist' : 'About artist'}>
              <option value="">{side === 'artist' ? 'All artists' : 'About any artist'}</option>
              {roster.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </div>
        </div>
      </div>
      {error && <div className="mb-3" role="alert" style={{ color: C.red, fontSize: 14 }}>{error}</div>}
      {rows === null ? <div style={{ color: C.textDim }}>Loading…</div> : groups.length === 0 ? (
        <EmptyState icon={History} title={side === 'artist' ? 'No artist activity yet' : 'No team activity yet'} description={side === 'artist' ? 'Artist sign-ins, exports, downloads and submissions appear here.' : 'Team sign-ins, exports, approvals, publishing and edits appear here.'} />
      ) : (
        <>
          <ExportBar filename={'imss-activity-' + (side === 'artist' ? 'artists' : 'team')} headers={['When', 'Who', 'Action', 'Detail', 'Artist']} rows={shown.map(r => [r.at, r.actor_kind === 'system' ? 'Scheduler' : r.actor_name, r.action, r.detail, name(r.artist_id)])} />
          <div className="flex flex-col gap-3">
            {groups.map(([who, list]) => {
              const isOpen = open[who] ?? groups.length <= 3;
              return (
                <section key={who} className="rounded" style={{ background: C.panel }}>
                  <button onClick={() => setOpen(o => ({ ...o, [who]: !isOpen }))} aria-expanded={isOpen} className="w-full flex items-center justify-between gap-3 text-left" style={{ padding: '14px 18px' }}>
                    <span>
                      <span style={{ fontWeight: 600, fontSize: 17, letterSpacing: '-0.02em' }}>{who}</span>
                      <span style={{ color: C.textDim, fontSize: 13, marginLeft: 10 }}>{list.length} {list.length === 1 ? 'action' : 'actions'} · last {when(list[0].at)}</span>
                    </span>
                    <span style={{ color: C.textDim, fontSize: 13 }}>{isOpen ? 'Hide' : 'Show'}</span>
                  </button>
                  {isOpen && (
                    <div className="overflow-x-auto" style={{ borderTop: '1px solid ' + C.border }}>
                      <table className="w-full" style={{ minWidth: 620 }}>
                        <thead><tr><Th>When</Th><Th>Action</Th><Th>Detail</Th></tr></thead>
                        <tbody>
                          {list.slice(0, 200).map(r => (
                            <tr key={r.id}>
                              <Td mono><span style={{ whiteSpace: 'nowrap' }}>{when(r.at)}</span></Td>
                              <Td>{r.action}{side === 'team' && r.artist_id && name(r.artist_id) ? <span style={{ color: C.textDim }}> · {name(r.artist_id)}</span> : null}</Td>
                              <Td><span style={{ color: C.textDim }}>{r.detail || '—'}</span></Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {list.length > 200 && <div style={{ color: C.textDim, fontSize: 13, padding: '8px 18px' }}>Showing the latest 200 of {list.length}. Export to see them all.</div>}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
