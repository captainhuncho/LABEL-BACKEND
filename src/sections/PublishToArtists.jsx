// Publish revenue to artists. The team's books stay internal; artists only see
// the snapshot published here. Finance picks what to publish and sends it to an
// Admin, unless an Admin has let Finance publish directly.
import { useMemo, useState } from 'react';
import { CheckCircle2, Send, ShieldCheck } from 'lucide-react';
import { applyPublish, pctAt, publishChecks, publishDiff, revenueRowSplit, slug } from '../finance.js';
import { formatCents, formatDate, monthLabel, uid } from '../constants.js';
import { C, MONO_FONT } from '../theme.js';
import { isStale } from '../UpdateBanner.jsx';
import { logActivity } from '../audit.js';
import { Badge, Btn, EmptyState, Field, Input, SectionHeader, Select, Td, TextArea, Th } from '../ui.jsx';

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
  const [publishAt, setPublishAt] = useState('');
  const [error, setError] = useState('');

  const pending = log.filter(e => e.status === 'Awaiting approval');
  const scheduled = log.filter(e => e.status === 'Scheduled').sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  const requestedKeys = new Set([...pending, ...scheduled].flatMap(e => (e.items || []).map(i => i.key)));
  const scheduledFor = key => (scheduled.find(e => (e.items || []).some(i => i.key === key)) || {}).scheduledFor;
  const diff = useMemo(() => publishDiff(approvedRevenue, published, masterGross, roster).filter(d => d.state !== 'Published'), [approvedRevenue, published, masterGross, roster]);
  const shown = diff.filter(d => !artistFilter || d.artistSlug === artistFilter);
  const artistsInDiff = [...new Map(diff.map(d => [d.artistSlug, d.artist])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  // What the artist actually gets: gross less their Inbound Banking Charge share, times their %.
  const pctOf = (s, month) => { const a = roster.find(x => slug(x.name) === s); return a ? pctAt(a, month) : 0; };
  const liveShare = d => d.liveRows.reduce((t, r) => t + revenueRowSplit(r, approvedRevenue, masterGross, pctOf(d.artistSlug, d.month)).artistShare, 0);
  // What the artist sees now is exactly what was published (stored earnings), never recomputed.
  const publishedShare = d => published.filter(r => r.artistSlug === d.artistSlug && r.month === d.month).reduce((t, r) => t + (r.final ? r.artistShare : (r.earning - (Number(r.swiftShare) || 0)) * pctOf(d.artistSlug, d.month)), 0);
  const artistIdOf = s => (roster.find(a => slug(a.name) === s) || {}).id || null;

  const toggle = key => setSelected(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const allShownSelected = shown.length > 0 && shown.every(d => selected.has(d.key));
  const toggleAll = () => setSelected(prev => { const n = new Set(prev); shown.forEach(d => allShownSelected ? n.delete(d.key) : n.add(d.key)); return n; });

  const itemsFor = keys => diff.filter(d => keys.includes(d.key)).map(d => ({ key: d.key, artistSlug: d.artistSlug, artistId: artistIdOf(d.artistSlug), artist: d.artist, month: d.month, gross: d.liveGross, state: d.state }));
  const stamp = () => new Date().toISOString();

  const fmtWhen = iso => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  // A future publish keeps the rows as they are now; a timed job swaps them in at that time.
  const snapshotRows = keys => applyPublish([], keys, approvedRevenue, masterGross, roster);
  function release(keys, items, extra) {
    const when = extra.scheduledFor;
    if (when && Date.parse(when) > Date.now()) return { ...extra, status: 'Scheduled', rows: snapshotRows(keys) };
    updatePublished(applyPublish(published, keys, approvedRevenue, masterGross, roster));
    return { ...extra, status: 'Published', scheduledFor: '' };
  }
  function scheduleTime() {
    if (!publishAt) return '';
    const t = Date.parse(publishAt);
    if (isNaN(t) || t <= Date.now()) { setError('Pick a publish time in the future, or clear it to publish now.'); return null; }
    return new Date(t).toISOString();
  }
  function publishNow(keys, scope) {
    const items = itemsFor(keys).filter(i => !requestedKeys.has(i.key));
    if (!items.length) return;
    const when = scheduleTime(); if (when === null) return;
    const entry = release(items.map(i => i.key), items, { id: uid(), scope, items, note: note.trim(), requestedBy: session.name, requestedAt: stamp(), approvedBy: session.name, approvedAt: stamp(), scheduledFor: when });
    updateLog([entry, ...log]);
    logActivity(entry.status === 'Scheduled' ? 'scheduled publish to artists' : 'published to artists', items.map(i => i.artist + ' ' + i.month).join(', ') + (when ? ' at ' + when : ''));
    finish(items, entry.status === 'Scheduled' ? 'Scheduled for ' + fmtWhen(when) : 'Published');
  }
  function requestApproval(keys, scope) {
    const items = itemsFor(keys).filter(i => !requestedKeys.has(i.key));
    if (!items.length) return;
    const when = scheduleTime(); if (when === null) return;
    updateLog([{ id: uid(), status: 'Awaiting approval', scope, items, note: note.trim(), requestedBy: session.name, requestedAt: stamp(), scheduledFor: when }, ...log]);
    logActivity('requested publish approval', items.map(i => i.artist + ' ' + i.month).join(', '));
    finish(items, 'Sent to an Admin for approval' + (when ? ', to publish ' + fmtWhen(when) : ''));
  }
  function cancelScheduled(entry) { updateLog(log.map(e => e.id !== entry.id ? e : { ...e, status: 'Cancelled', cancelledBy: session.name, cancelledAt: stamp() })); }
  function publishScheduledNow(entry) {
    const keys = new Set((entry.items || []).map(i => i.key));
    updatePublished([...published.filter(r => !keys.has(r.artistSlug + '|' + r.month)), ...(entry.rows || []).map(r => ({ ...r, publishedAt: stamp() }))]);
    updateLog(log.map(e => e.id !== entry.id ? e : { ...e, status: 'Published', publishedEarlyBy: session.name, approvedAt: stamp(), rows: undefined }));
  }
  function finish(items, what) {
    const artists = new Set(items.map(i => i.artistSlug)).size;
    setDone(what + ': ' + items.length + ' artist-month' + (items.length === 1 ? '' : 's') + ' across ' + artists + ' artist' + (artists === 1 ? '' : 's') + '.');
    setSelected(new Set()); setNote(''); setPublishAt(''); setError('');
  }
  // Every publish, request and approval is re-checked; any error stops it.
  const blocked = keys => { if (isStale()) { setError('A new version of IMSS Records is out. Reload the page before publishing.'); return true; } const c = publishChecks(keys, approvedRevenue, masterGross, roster, published); if (c.errors.length) { setError('Not published. Fix these first: ' + c.errors.join('; ') + '.'); return true; } return false; };
  function go(keys, scope) { if (blocked(keys)) return; (direct ? publishNow : requestApproval)(keys, scope); }

  function approve(entry) {
    const keys = (entry.items || []).map(i => i.key);
    if (blocked(keys)) return;
    const next = release(keys, entry.items, { ...entry, approvedBy: session.name, approvedAt: stamp() });
    updateLog(log.map(e => e.id !== entry.id ? e : next));
    logActivity('approved publish to artists', (entry.items || []).map(i => i.artist + ' ' + i.month).join(', '));
  }
  function decline(entry) {
    const text = (declineNote[entry.id] || '').trim();
    if (!text) { setDeclineNote(d => ({ ...d, ['err_' + entry.id]: 'Say why, so Finance knows what to fix.' })); return; }
    logActivity('declined publish request', text);
    updateLog(log.map(e => e.id !== entry.id ? e : { ...e, status: 'Declined', approvedBy: session.name, approvedAt: stamp(), declineNote: text }));
  }

  const liveGrossOf = key => (diff.find(d => d.key === key) || {}).liveGross;
  const selectedKeys = [...selected].filter(k => diff.some(d => d.key === k));
  const checkKeys = selectedKeys.length ? selectedKeys : diff.filter(d => !requestedKeys.has(d.key)).map(d => d.key);
  const checks = useMemo(() => publishChecks(checkKeys, approvedRevenue, masterGross, roster, published), [checkKeys.join(','), approvedRevenue, masterGross, roster, published]);

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
                {e.scheduledFor && <div className="text-xs mt-1" style={{ color: C.textDim }}>Requested for {fmtWhen(e.scheduledFor)}{Date.parse(e.scheduledFor) <= Date.now() ? ' (that time has passed, so approving publishes now)' : ''}</div>}
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

      {scheduled.length > 0 && (
        <section aria-labelledby="pub-sched-h" className="rounded border mb-6" style={{ borderColor: C.border, background: C.panel }}>
          <h2 id="pub-sched-h" className="px-4 pt-4 pb-2" style={{ fontWeight: 600, fontSize: 15 }}>Scheduled</h2>
          {scheduled.map(e => (
            <div key={e.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap" style={{ borderTop: '1px solid ' + C.border }}>
              <div className="text-sm"><b>{fmtWhen(e.scheduledFor)}</b> · {e.items.length} artist-month{e.items.length === 1 ? '' : 's'} · <span style={{ color: C.textDim }}>{[...new Set(e.items.map(i => i.artist))].join(', ')}</span>
                <div className="text-xs" style={{ color: C.textDim }}>Publishes the figures as they were when scheduled. Changes since then need another publish.</div></div>
              {canEdit && (isAdmin || e.requestedBy === session.name) && (
                <div className="flex gap-2">
                  <Btn variant="ghost" onClick={() => publishScheduledNow(e)}>Publish now</Btn>
                  <Btn variant="danger" onClick={() => cancelScheduled(e)}>Cancel</Btn>
                </div>
              )}
            </div>
          ))}
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
                <Th>Artist</Th><Th>Month</Th><Th>What changed</Th><Th align="right">Artist sees now</Th><Th align="right">After publishing</Th>
              </tr></thead>
              <tbody>
                {shown.map(d => {
                  const waiting = requestedKeys.has(d.key);
                  return (
                    <tr key={d.key}>
                      <Td><input type="checkbox" checked={selected.has(d.key)} onChange={() => toggle(d.key)} aria-label={'Select ' + d.artist + ' ' + monthLabel(d.month)} style={{ accentColor: C.amber }} /></Td>
                      <Td>{d.artist}</Td>
                      <Td mono>{monthLabel(d.month)}</Td>
                      <Td><Badge tone={waiting ? 'default' : STATE_TONE[d.state]}>{scheduledFor(d.key) ? 'Scheduled ' + fmtWhen(scheduledFor(d.key)) : waiting ? 'Awaiting approval' : d.chargeChanged ? 'Charge or % changed since publish' : STATE_LABEL[d.state]}</Badge></Td>
                      <Td align="right" mono>{d.state === 'New' ? <span className="text-xs" style={{ color: C.textDim, fontFamily: 'inherit' }}>Nothing yet</span> : formatCents(publishedShare(d))}</Td>
                      <Td align="right" mono>{d.state === 'Removed' ? <span className="text-xs" style={{ color: C.textDim, fontFamily: 'inherit' }}>Removed</span> : formatCents(liveShare(d))}<div className="text-xs" style={{ color: C.textDim }}>of {formatCents(d.liveGross)} gross</div></Td>
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
              <div className="mt-3" style={{ maxWidth: 280 }}>
                <Field label="Publish at (optional, leave empty for now)">
                  <Input type="datetime-local" value={publishAt} onChange={e => { setPublishAt(e.target.value); setError(''); }}  />
                </Field>
              </div>
              <div className="mt-4 rounded border p-3 text-sm" role="status" style={{ borderColor: checks.errors.length ? C.red : checks.warnings.length ? C.amber : C.border }}>
                <div style={{ fontWeight: 600 }}>Checks on {selectedKeys.length ? 'the selected rows' : 'everything listed'}</div>
                {checks.errors.length === 0 && checks.warnings.length === 0 && <div className="mt-1 flex items-center gap-2" style={{ color: C.teal }}><CheckCircle2 size={14} /> Every charge recomputed and matches; artists’ shares are set.</div>}
                {checks.errors.map((e, i) => <div key={'e' + i} className="mt-1" style={{ color: C.red }}>Blocks publishing: {e}</div>)}
                {checks.warnings.map((w, i) => <div key={'w' + i} className="mt-1" style={{ color: C.amber }}>Check: {w}</div>)}
              </div>
              {error && <div className="text-sm mt-2" role="alert" style={{ color: C.red }}>{error}</div>}
              <div className="flex gap-2 flex-wrap mt-3">
                <Btn variant="primary" onClick={() => go(selectedKeys, 'selected')} disabled={!selectedKeys.length}><Send size={14} /> {direct ? (publishAt ? 'Schedule selected' : 'Publish selected') : 'Send selected for approval'}{selectedKeys.length ? ' (' + selectedKeys.length + ')' : ''}</Btn>
                <Btn variant="ghost" onClick={() => go(diff.map(d => d.key), 'all')}><Send size={14} /> {direct ? (publishAt ? 'Schedule all' : 'Publish all') : 'Send all for approval'} ({diff.length})</Btn>
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
                    <Td><Badge tone={e.status === 'Published' ? 'teal' : e.status === 'Declined' || e.status === 'Cancelled' ? 'red' : 'amber'}>{e.status}</Badge></Td>
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
