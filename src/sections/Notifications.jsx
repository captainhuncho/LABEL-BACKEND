// Notification centre (the bell) and the activity audit screen.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CheckCheck, History } from 'lucide-react';
import { markNotificationsRead, readAudit, readNotifications } from '../audit.js';
import { C } from '../theme.js';
import { Badge, EmptyState, ExportBar, Field, Input, SectionHeader, Select, Td, Th } from '../ui.jsx';

const ago = iso => {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
};

// The bell. `routes` maps a notification topic to the screen to open on this side.
export function NotificationBell({ routes = {}, onOpen }) {
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
        <div role="dialog" aria-label="Notifications" className="rounded" style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 'min(360px, calc(100vw - 32px))', maxHeight: 440, overflowY: 'auto', background: C.panel, boxShadow: 'var(--shadow)', border: '1px solid ' + C.border, zIndex: 30 }}>
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

// Activity audit: who did what, when. Admin and Legal only (enforced by the database).
export function AuditSection({ roster = [] }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [artistId, setArtistId] = useState('');
  useEffect(() => { readAudit({ limit: 2000 }).then(setRows, e => { setRows([]); setError('Could not load the activity log: ' + (e.message || e)); }); }, []);
  const name = id => (roster.find(a => a.id === id) || {}).name || '';
  const shown = useMemo(() => (rows || []).filter(r =>
    (kind === 'all' || r.actor_kind === kind) && (!artistId || r.artist_id === artistId) &&
    (!q.trim() || [r.actor_name, r.action, r.detail, name(r.artist_id)].join(' ').toLowerCase().includes(q.trim().toLowerCase()))), [rows, kind, artistId, q]);
  const when = iso => new Date(iso).toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  return (
    <div>
      <SectionHeader title="Activity" description="Everything people do on the platform and in the artist portal: sign-ins, exports, downloads, submissions, approvals, publishing and changes. Entries can’t be edited or deleted." />
      <div className="rounded p-4 mb-4 imss-form-grid gap-3" style={{ background: C.panel }}>
        <Field label="Search"><Input value={q} onChange={e => setQ(e.target.value)} placeholder="Person, action or detail" /></Field>
        <Field label="Who">
          <Select value={kind} onChange={e => setKind(e.target.value)}>
            <option value="all">Everyone</option><option value="team">Team</option><option value="artist">Artists</option><option value="system">Scheduler</option>
          </Select>
        </Field>
        <Field label="About artist">
          <Select value={artistId} onChange={e => setArtistId(e.target.value)}>
            <option value="">Any artist</option>
            {roster.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>
      </div>
      {error && <div className="mb-3" role="alert" style={{ color: C.red, fontSize: 14 }}>{error}</div>}
      {rows === null ? <div style={{ color: C.textDim }}>Loading…</div> : shown.length === 0 ? (
        <EmptyState icon={History} title="No activity matches" description="Sign-ins, exports and changes appear here as people use the platform." />
      ) : (
        <>
          <ExportBar filename="imss-activity" headers={['When', 'Who', 'Type', 'Action', 'Detail', 'Artist']} rows={shown.map(r => [r.at, r.actor_name, r.actor_kind, r.action, r.detail, name(r.artist_id)])} />
          <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
            <table className="w-full" style={{ minWidth: 760 }}>
              <thead><tr><Th>When</Th><Th>Who</Th><Th>Action</Th><Th>Detail</Th></tr></thead>
              <tbody>
                {shown.slice(0, 500).map(r => (
                  <tr key={r.id}>
                    <Td mono><span style={{ whiteSpace: 'nowrap' }}>{when(r.at)}</span></Td>
                    <Td>{r.actor_name} <Badge tone={r.actor_kind === 'artist' ? 'teal' : r.actor_kind === 'system' ? 'default' : 'amber'}>{r.actor_kind === 'system' ? 'Scheduler' : r.actor_kind === 'artist' ? 'Artist' : 'Team'}</Badge></Td>
                    <Td>{r.action}{r.artist_id && r.actor_kind !== 'artist' && name(r.artist_id) ? <span style={{ color: C.textDim }}> · {name(r.artist_id)}</span> : null}</Td>
                    <Td><span style={{ color: C.textDim }}>{r.detail || '—'}</span></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {shown.length > 500 && <div className="mt-2" style={{ color: C.textDim, fontSize: 13 }}>Showing the latest 500 of {shown.length}. Export to see them all.</div>}
        </>
      )}
    </div>
  );
}
