// Publish revenue to artists. The team's books stay internal; artists only see
// the snapshot published here. Finance picks what to publish and sends it to an
// Admin, unless an Admin has let Finance publish directly.
import { useMemo, useState } from 'react';
import { CheckCircle2, Send, ShieldCheck } from 'lucide-react';
import { applyPublish, publishDiff, slug } from '../finance.js';
import { formatCents, formatDate, monthLabel, uid } from '../constants.js';
import { C, MONO_FONT } from '../theme.js';
import { Badge, Btn, EmptyState, Field, SectionHeader, Select, Td, TextArea, Th } from '../ui.jsx';

const STATE_TONE = { New: 'amber', Changed: 'amber', Removed: 'red', 'Awaiting approval': 'default' };
const STATE_LABEL = { New: 'Not published yet', Changed: 'Changed since publish', Removed: 'Removed from the books' };

export default function PublishToArtists({ roster, approvedRevenue, masterGross, published, updatePublished, log, updateLog, labelSettings = {}, updateLabelSettings, session = {}, canEdit = true }) {
  const isAdmin = session.role === 'Admin';
  const direct = isAdmin || !!labelSettings.financePublishDirect;
  const [selected, setSelected] = useState(() => new Set());
  const [artistFilter, setArtistFilter] = useState('');
  const [note, setNote] = useState('');
  const [declineNote, setDeclineNote] = useState({});
  const [done, setDone] = useState('');

  const pending = log.filter(e => e.status === 'Awaiting approval');
  const requestedKeys = new Set(pending.flatMap(e => (e.items || []).map(i => i.key)));
  const diff = useMemo(() => publishDiff(approvedRevenue, published).filter(d => d.state !== 'Published'), [approvedRevenue, published]);
  const shown = diff.filter(d => !artistFilter || d.artistSlug === artistFilter);
  const artistsInDiff = [...new Map(diff.map(d => [d.artistSlug, d.artist])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const artistIdOf = s => (roster.find(a => slug(a.name) === s) || {}).id || null;

  const toggle = key => setSelected(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const allShownSelected = shown.length > 0 && shown.every(d => selected.has(d.key));
  const toggleAll = () => setSelected(prev => { const n = new Set(prev); shown.forEach(d => allShownSelected ? n.delete(d.key) : n.add(d.key)); return n; });

  const itemsFor = keys => diff.filter(d => keys.includes(d.key)).map(d => ({ key: d.key, artistSlug: d.artistSlug, artistId: artistIdOf(d.artistSlug), artist: d.artist, month: d.month, gross: d.liveGross, state: d.state }));
  const stamp = () => new Date().toISOString();

  function publishNow(keys, scope) {
    const items = itemsFor(keys);
    if (!items.length) return;
    updatePublished(applyPublish(published, keys, approvedRevenue, masterGross));
    updateLog([{ id: uid(), status: 'Published', scope, items, note: note.trim(), requestedBy: session.name, requestedAt: stamp(), approvedBy: session.name, approvedAt: stamp() }, ...log]);
    finish(items, 'Published');
  }
  function requestApproval(keys, scope) {
    const items = itemsFor(keys).filter(i => !requestedKeys.has(i.key));
    if (!items.length) return;
    updateLog([{ id: uid(), status: 'Awaiting approval', scope, items, note: note.trim(), requestedBy: session.name, requestedAt: stamp() }, ...log]);
    finish(items, 'Sent to an Admin for approval');
  }
  function finish(items, what) {
    const artists = new Set(items.map(i => i.artistSlug)).size;
    setDone(what + ': ' + items.length + ' artist-month' + (items.length === 1 ? '' : 's') + ' across ' + artists + ' artist' + (artists === 1 ? '' : 's') + '.');
    setSelected(new Set()); setNote('');
  }
  function go(keys, scope) { (direct ? publishNow : requestApproval)(keys, scope); }

  function approve(entry) {
    const keys = (entry.items || []).map(i => i.key);
    updatePublished(applyPublish(published, keys, approvedRevenue, masterGross));
    updateLog(log.map(e => e.id !== entry.id ? e : { ...e, status: 'Published', approvedBy: session.name, approvedAt: stamp() }));
  }
  function decline(entry) {
    const text = (declineNote[entry.id] || '').trim();
    if (!text) { setDeclineNote(d => ({ ...d, ['err_' + entry.id]: 'Say why, so Finance knows what to fix.' })); return; }
    updateLog(log.map(e => e.id !== entry.id ? e : { ...e, status: 'Declined', approvedBy: session.name, approvedAt: stamp(), declineNote: text }));
  }

  const liveGrossOf = key => (diff.find(d => d.key === key) || {}).liveGross;
  const selectedKeys = [...selected].filter(k => diff.some(d => d.key === k));

  return (
    <div>
      <SectionHeader title="Publish to artists" artistNote="exactly what was last published here: revenue, breakdowns, their Inbound Banking Charge share and statement files. Nothing else changes their earnings view." description="Revenue you import or edit stays inside the label until it’s published here. Artists see exactly what was published, and get an email when it is." />

      {isAdmin && (
        <label className="flex items-start gap-2 text-sm rounded border p-3 mb-6" style={{ borderColor: C.border, background: C.panel, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!labelSettings.financePublishDirect} onChange={e => updateLabelSettings({ ...labelSettings, financePublishDirect: e.target.checked })} style={{ accentColor: C.amber, marginTop: 3 }} />
          <span><b>Let Finance publish without Admin approval</b><span className="block text-xs mt-0.5" style={{ color: C.textDim }}>Off: Finance sends publishes to an Admin to approve. On: anyone with royalties access publishes straight to artists.</span></span>
        </label>
      )}

      {pending.length > 0 && (
        <section aria-labelledby="pub-pending-h" className="rounded border mb-6" style={{ borderColor: C.amber, background: C.panel }}>
          <h2 id="pub-pending-h" className="px-4 pt-4 pb-2" style={{ fontWeight: 600, fontSize: 15 }}>Waiting for Admin approval</h2>
          {pending.map(e => {
            const gross = (e.items || []).reduce((t, i) => t + (i.gross || 0), 0);
            const drift = (e.items || []).filter(i => liveGrossOf(i.key) !== undefined && Math.abs(liveGrossOf(i.key) - i.gross) >= 0.01);
            return (
              <div key={e.id} className="px-4 py-3" style={{ borderTop: '1px solid ' + C.border }}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-sm"><b>{e.requestedBy}</b> wants to publish {e.items.length} artist-month{e.items.length === 1 ? '' : 's'} · <span style={{ fontFamily: MONO_FONT }}>{formatCents(gross)}</span> gross <span style={{ color: C.textDim }}>· {formatDate(String(e.requestedAt).slice(0, 10))}</span></div>
                </div>
                <div className="text-xs mt-1" style={{ color: C.textDim }}>{e.items.map(i => i.artist + ' ' + monthLabel(i.month)).join(' · ')}</div>
                {e.note && <div className="text-sm mt-1" style={{ color: C.textDim }}>“{e.note}”</div>}
                {drift.length > 0 && <div className="text-xs mt-1" style={{ color: C.amber }}>{drift.length} of these changed after it was requested. Approving publishes the books as they are now.</div>}
                {isAdmin && canEdit && (
                  <div className="flex gap-2 flex-wrap items-end mt-3">
                    <Btn variant="primary" onClick={() => approve(e)}><CheckCircle2 size={14} /> Approve and publish</Btn>
                    <div style={{ minWidth: 240, flex: 1 }}>
                      <TextArea rows={1} value={declineNote[e.id] || ''} onChange={ev => setDeclineNote(d => ({ ...d, [e.id]: ev.target.value, ['err_' + e.id]: '' }))} placeholder="Reason, if declining" aria-label="Reason for declining" />
                    </div>
                    <Btn variant="danger" onClick={() => decline(e)}>Decline</Btn>
                  </div>
                )}
                {declineNote['err_' + e.id] && <div className="text-xs mt-1" role="alert" style={{ color: C.red }}>{declineNote['err_' + e.id]}</div>}
              </div>
            );
          })}
        </section>
      )}

      <div className="flex items-end justify-between gap-3 flex-wrap mb-3">
        <h2 style={{ fontWeight: 600, fontSize: 17 }}>Not yet visible to artists</h2>
        {artistsInDiff.length > 1 && (
          <Field label="Artist">
            <Select value={artistFilter} onChange={e => setArtistFilter(e.target.value)} style={{ minWidth: 200 }}>
              <option value="">All artists</option>
              {artistsInDiff.map(([s, name]) => <option key={s} value={s}>{name}</option>)}
            </Select>
          </Field>
        )}
      </div>

      {done && <div className="text-sm mb-3" role="status" style={{ color: C.teal }}>{done}</div>}

      {diff.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Artists are up to date" description="Everything in the books matches what artists can see. New imports and edits will show up here to publish." />
      ) : (
        <>
          <div className="rounded border overflow-x-auto mb-4" style={{ borderColor: C.border, background: C.panel }}>
            <table className="w-full" style={{ minWidth: 720 }}>
              <thead><tr>
                <Th><input type="checkbox" checked={allShownSelected} onChange={toggleAll} aria-label="Select all shown" style={{ accentColor: C.amber }} /></Th>
                <Th>Artist</Th><Th>Month</Th><Th>What changed</Th><Th align="right">Artists see now</Th><Th align="right">After publishing</Th>
              </tr></thead>
              <tbody>
                {shown.map(d => {
                  const waiting = requestedKeys.has(d.key);
                  return (
                    <tr key={d.key}>
                      <Td><input type="checkbox" checked={selected.has(d.key)} onChange={() => toggle(d.key)} aria-label={'Select ' + d.artist + ' ' + monthLabel(d.month)} style={{ accentColor: C.amber }} /></Td>
                      <Td>{d.artist}</Td>
                      <Td mono>{monthLabel(d.month)}</Td>
                      <Td><Badge tone={waiting ? 'default' : STATE_TONE[d.state]}>{waiting ? 'Awaiting approval' : STATE_LABEL[d.state]}</Badge></Td>
                      <Td align="right" mono>{d.state === 'New' ? '—' : formatCents(d.publishedGross)}</Td>
                      <Td align="right" mono>{d.state === 'Removed' ? '—' : formatCents(d.liveGross)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {canEdit && (
            <div className="rounded border p-4" style={{ borderColor: C.border, background: C.panel }}>
              <Field label="Note (optional, shown in the history)">
                <TextArea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. October EMPIRE statement" />
              </Field>
              <div className="flex gap-2 flex-wrap mt-3">
                <Btn variant="primary" onClick={() => go(selectedKeys, 'selected')} disabled={!selectedKeys.length}><Send size={14} /> {direct ? 'Publish selected' : 'Send selected for approval'}{selectedKeys.length ? ' (' + selectedKeys.length + ')' : ''}</Btn>
                <Btn variant="ghost" onClick={() => go(diff.map(d => d.key), 'all')}><Send size={14} /> {direct ? 'Publish all' : 'Send all for approval'} ({diff.length})</Btn>
              </div>
              <div className="text-xs mt-2" style={{ color: C.textDim }}>{direct ? 'Artists see it straight away and get an email.' : 'An Admin approves it before artists see it. Artists get an email once it’s published.'}</div>
            </div>
          )}
        </>
      )}

      {log.length > 0 && (
        <section aria-labelledby="pub-hist-h" className="mt-8">
          <h2 id="pub-hist-h" className="mb-3" style={{ fontWeight: 600, fontSize: 17 }}>History</h2>
          <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
            <table className="w-full" style={{ minWidth: 720 }}>
              <thead><tr><Th>Date</Th><Th>Status</Th><Th>What</Th><Th>Requested by</Th><Th>Approved by</Th></tr></thead>
              <tbody>
                {log.slice(0, 50).map(e => (
                  <tr key={e.id}>
                    <Td mono>{formatDate(String(e.approvedAt || e.requestedAt).slice(0, 10))}</Td>
                    <Td><Badge tone={e.status === 'Published' ? 'teal' : e.status === 'Declined' ? 'red' : 'amber'}>{e.status}</Badge></Td>
                    <Td>{e.items && e.items.length ? e.items.length + ' artist-month' + (e.items.length === 1 ? '' : 's') + ' · ' + [...new Set(e.items.map(i => i.artist))].slice(0, 3).join(', ') + (new Set(e.items.map(i => i.artist)).size > 3 ? '…' : '') : (e.note || '—')}{e.declineNote && <div className="text-xs" style={{ color: C.red }}>Declined: {e.declineNote}</div>}{e.note && e.items && e.items.length > 0 && <div className="text-xs" style={{ color: C.textDim }}>{e.note}</div>}</Td>
                    <Td>{e.requestedBy}</Td>
                    <Td>{e.approvedBy || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
