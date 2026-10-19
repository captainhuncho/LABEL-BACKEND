import { ReportingLagNote } from '../ui.jsx';
// Publish revenue to artists. The team's books stay internal; artists only see
// the snapshot published here. Finance picks what to publish and sends it to an
// Admin to approve; only an Admin publishes directly.
import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Eye, Send, ShieldCheck } from 'lucide-react';
import { applyPublish, pctAt, publishChecks, publishDiff, revenueRowSplit, slug } from '../finance.js';
import { formatCents, formatDate, monthLabel, uid } from '../constants.js';
import { C, MONO_FONT } from '../theme.js';
import { isStale } from '../UpdateBanner.jsx';
import { logActivity } from '../audit.js';
import { Badge, Btn, EmptyState, Field, Input, SectionHeader, Select, Td, TextArea, Th } from '../ui.jsx';

const STATE_TONE = { New: 'amber', Changed: 'amber', Removed: 'red', 'Awaiting approval': 'default' };
const STATE_LABEL = { New: 'Not published yet', Changed: 'Changed since publish', Removed: 'Removed from the books' };

export default function PublishToArtists({ renderPreview = null, roster, approvedRevenue, masterGross, published, updatePublished, log, updateLog, commitArtistPublish, commitArtistPublishLog, labelSettings = {}, updateLabelSettings, session = {}, canEdit = true }) {
  const isAdmin = session.role === 'Admin';
  // Only an Admin publishes directly; Finance always sends it to an Admin to approve.
  const direct = isAdmin;
  const [selected, setSelected] = useState(() => new Set());
  const [artistFilter, setArtistFilter] = useState('');
  // Preview one artist's portal: as it is now, or after publishing what's listed for them.
  const [preview, setPreview] = useState(null); // { artistSlug, after }
  const [note, setNote] = useState('');
  const [declineNote, setDeclineNote] = useState({});
  const [done, setDone] = useState('');
  const [publishAt, setPublishAt] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);

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
    if (when && Date.parse(when) > Date.now()) return { entry: { ...extra, status: 'Scheduled', rows: snapshotRows(keys) }, nextPublished: null };
    return { entry: { ...extra, status: 'Published', scheduledFor: '' }, nextPublished: applyPublish(published, keys, approvedRevenue, masterGross, roster) };
  }
  async function save(nextLog, nextPublished = null) {
    if (saving.current) return false;
    saving.current = true;
    setBusy(true); setError(''); setDone('');
    try {
      if (nextPublished) await commitArtistPublish(nextPublished, nextLog);
      else await commitArtistPublishLog(nextLog);
      return true;
    } catch (e) {
      setError('Could not confirm the save. The latest data was reloaded; check what artists can see before retrying. ' + (e.message || e));
      return false;
    } finally { saving.current = false; setBusy(false); }
  }
  function scheduleTime() {
    if (!publishAt) return '';
    const t = Date.parse(publishAt);
    if (isNaN(t) || t <= Date.now()) { setError('Pick a publish time in the future, or clear it to publish now.'); return null; }
    return new Date(t).toISOString();
  }
  async function publishNow(keys, scope) {
    const items = itemsFor(keys).filter(i => !requestedKeys.has(i.key));
    if (!items.length) return;
    const when = scheduleTime(); if (when === null) return;
    const { entry, nextPublished } = release(items.map(i => i.key), items, { id: uid(), scope, items, note: note.trim(), requestedBy: session.name, requestedAt: stamp(), approvedBy: session.name, approvedAt: stamp(), scheduledFor: when });
    if (!await save([entry, ...log], nextPublished)) return;
    logActivity(entry.status === 'Scheduled' ? 'scheduled publish to artists' : 'published to artists', items.map(i => i.artist + ' ' + i.month).join(', ') + (when ? ' at ' + when : ''));
    finish(items, entry.status === 'Scheduled' ? 'Scheduled for ' + fmtWhen(when) : 'Published');
  }
  async function requestApproval(keys, scope) {
    const items = itemsFor(keys).filter(i => !requestedKeys.has(i.key));
    if (!items.length) return;
    const when = scheduleTime(); if (when === null) return;
    if (!await save([{ id: uid(), status: 'Awaiting approval', scope, items, note: note.trim(), requestedBy: session.name, requestedAt: stamp(), scheduledFor: when }, ...log])) return;
    logActivity('requested publish approval', items.map(i => i.artist + ' ' + i.month).join(', '));
    finish(items, 'Sent to an Admin for approval' + (when ? ', to publish ' + fmtWhen(when) : ''));
  }
  async function cancelScheduled(entry) {
    await save(log.map(e => e.id !== entry.id ? e : { ...e, status: 'Cancelled', cancelledBy: session.name, cancelledAt: stamp() }));
  }
  async function publishScheduledNow(entry) {
    const keys = new Set((entry.items || []).map(i => i.key));
    await save(log.map(e => e.id !== entry.id ? e : { ...e, status: 'Published', publishedEarlyBy: session.name, approvedAt: stamp(), rows: undefined }),
      [...published.filter(r => !keys.has(r.artistSlug + '|' + r.month)), ...(entry.rows || []).map(r => ({ ...r, publishedAt: stamp() }))]);
  }
  function finish(items, what) {
    const artists = new Set(items.map(i => i.artistSlug)).size;
    setDone(what + ': ' + items.length + ' artist-month' + (items.length === 1 ? '' : 's') + ' across ' + artists + ' artist' + (artists === 1 ? '' : 's') + '.');
    setSelected(new Set()); setNote(''); setPublishAt(''); setError('');
  }
  // Every publish, request and approval is re-checked; any error stops it.
  const blocked = keys => { if (isStale()) { setError('A new version of IMSS Records is out. Reload the page before publishing.'); return true; } const c = publishChecks(keys, approvedRevenue, masterGross, roster, published); if (c.errors.length) { setError('Not published. Fix these first: ' + c.errors.join('; ') + '.'); return true; } return false; };
  function go(keys, scope) { if (busy || blocked(keys)) return; (direct ? publishNow : requestApproval)(keys, scope); }

  async function approve(entry) {
    const keys = (entry.items || []).map(i => i.key);
    if (busy || blocked(keys)) return;
    const { entry: next, nextPublished } = release(keys, entry.items, { ...entry, approvedBy: session.name, approvedAt: stamp() });
    if (!await save(log.map(e => e.id !== entry.id ? e : next), nextPublished)) return;
    logActivity('approved publish to artists', (entry.items || []).map(i => i.artist + ' ' + i.month).join(', '));
  }
  async function decline(entry) {
    const text = (declineNote[entry.id] || '').trim();
    if (!text) { setDeclineNote(d => ({ ...d, ['err_' + entry.id]: 'Say why, so Finance knows what to fix.' })); return; }
    logActivity('declined publish request', text);
    await save(log.map(e => e.id !== entry.id ? e : { ...e, status: 'Declined', approvedBy: session.name, approvedAt: stamp(), declineNote: text }));
  }

  const liveGrossOf = key => (diff.find(d => d.key === key) || {}).liveGross;
  const selectedKeys = [...selected].filter(k => diff.some(d => d.key === k));
  const checkKeys = selectedKeys.length ? selectedKeys : diff.filter(d => !requestedKeys.has(d.key)).map(d => d.key);
  const checks = useMemo(() => publishChecks(checkKeys, approvedRevenue, masterGross, roster, published), [checkKeys.join(','), approvedRevenue, masterGross, roster, published]);

  return (
    <div>
      <SectionHeader title="Publish to artists" artistNote="exactly what was last published here: revenue, breakdowns, their Inbound Banking Charge share and statement files. Nothing else changes their earnings view." description="Revenue you import or edit stays inside the label until it’s published here. Artists see exactly what was published, and get an email when it is." />
      {error && <div className="text-sm mb-3" role="alert" style={{ color: C.red }}>{error}</div>}
      <ReportingLagNote className="mb-4" />

      {pending.length > 0 && (
        <section aria-labelledby="pub-pending-h" className="rounded border mb-6" style={{ borderColor: C.amber, background: C.panel }}>
          <h2 id="pub-pending-h" className="px-4 pt-4 pb-2" style={{ fontWeight: 600, fontSize: 15 }}>Waiting for Admin approval</h2>
          {pending.map(e => {
            const gross = (e.items || []).reduce((t, i) => t + (i.gross || 0), 0);
            const drift = (e.items || []).filter(i => liveGrossOf(i.key) !== undefined && Math.abs(liveGrossOf(i.key) - i.gross) >= 0.01);
            return (
              <div key={e.id} data-focus={e.id} className="px-4 py-3" style={{ borderTop: '1px solid ' + C.border }}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-sm"><b>{e.requestedBy}</b> wants to publish {e.items.length} artist-month{e.items.length === 1 ? '' : 's'} · <span style={{ fontFamily: MONO_FONT }}>{formatCents(gross)}</span> gross <span style={{ color: C.textDim }}>· {formatDate(String(e.requestedAt).slice(0, 10))}</span></div>
                </div>
                <div className="text-xs mt-1" style={{ color: C.textDim }}>{e.items.map(i => i.artist + ' ' + monthLabel(i.month)).join(' · ')}</div>
                {e.note && <div className="text-sm mt-1" style={{ color: C.textDim }}>“{e.note}”</div>}
                {e.scheduledFor && <div className="text-xs mt-1" style={{ color: C.textDim }}>Requested for {fmtWhen(e.scheduledFor)}{Date.parse(e.scheduledFor) <= Date.now() ? ' (that time has passed, so approving publishes now)' : ''}</div>}
                {drift.length > 0 && <div className="text-xs mt-1" style={{ color: C.amber }}>{drift.length} of these changed after it was requested. Approving publishes the books as they are now.</div>}
                {isAdmin && canEdit && (
                  <div className="flex gap-2 flex-wrap items-end mt-3">
                    <Btn variant="primary" disabled={busy} onClick={() => approve(e)}><CheckCircle2 size={14} /> Approve and publish</Btn>
                    <div style={{ minWidth: 240, flex: 1 }}>
                      <TextArea rows={1} value={declineNote[e.id] || ''} onChange={ev => setDeclineNote(d => ({ ...d, [e.id]: ev.target.value, ['err_' + e.id]: '' }))} placeholder="Reason, if declining" aria-label="Reason for declining" />
                    </div>
                    <Btn variant="danger" disabled={busy} onClick={() => decline(e)}>Decline</Btn>
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
                  <Btn variant="ghost" disabled={busy} onClick={() => publishScheduledNow(e)}>Publish now</Btn>
                  <Btn variant="danger" disabled={busy} onClick={() => cancelScheduled(e)}>Cancel</Btn>
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
        {renderPreview && artistsInDiff.length > 0 && (
          <Btn variant="ghost" onClick={() => setPreview({ artistSlug: artistFilter || artistsInDiff[0][0], after: true })}><Eye size={14} /> Preview what the artist sees</Btn>
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
              <div className="flex gap-2 flex-wrap mt-3">
                <Btn variant="primary" onClick={() => go(selectedKeys, 'selected')} disabled={busy || !selectedKeys.length}><Send size={14} /> {direct ? (publishAt ? 'Schedule selected' : 'Publish selected') : 'Send selected for approval'}{selectedKeys.length ? ' (' + selectedKeys.length + ')' : ''}</Btn>
                <Btn variant="ghost" disabled={busy} onClick={() => go(diff.map(d => d.key), 'all')}><Send size={14} /> {direct ? (publishAt ? 'Schedule all' : 'Publish all') : 'Send all for approval'} ({diff.length})</Btn>
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
      {preview && renderPreview && (() => {
        // After: this artist's listed months as they'd publish (ticked ones only, if any are ticked).
        const theirs = diff.filter(d => d.artistSlug === preview.artistSlug).map(d => d.key);
        const picked = theirs.filter(k => selected.has(k));
        const rows = preview.after ? applyPublish(published, picked.length ? picked : theirs, approvedRevenue, masterGross, roster) : published;
        const name = (artistsInDiff.find(([s]) => s === preview.artistSlug) || [])[1] || '';
        // Rendered at page level so it covers the whole window, not just this panel.
        return createPortal(
          <div role="dialog" aria-modal="true" aria-label={'Preview of ' + name + "'s portal"} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--bg, #f5f5f7)', display: 'flex', flexDirection: 'column' }}>
            <div className="flex items-center gap-3 flex-wrap" style={{ padding: '10px 16px', background: C.amberSoft, borderBottom: '1px solid ' + C.amber, color: C.text }}>
              <Eye size={16} aria-hidden="true" />
              <b>Preview: what {name} sees</b>
              <Select value={preview.artistSlug} onChange={e => setPreview(p => ({ ...p, artistSlug: e.target.value }))} aria-label="Artist" style={{ minWidth: 160 }}>
                {artistsInDiff.map(([s, n]) => <option key={s} value={s}>{n}</option>)}
              </Select>
              <span className="inline-flex rounded border overflow-hidden" style={{ borderColor: C.border }}>
                {[[false, 'Now'], [true, picked.length ? 'After publishing ticked' : 'After publishing']].map(([v, l]) => (
                  <button key={l} onClick={() => setPreview(p => ({ ...p, after: v }))} aria-pressed={preview.after === v} style={{ padding: '6px 12px', minHeight: 36, background: preview.after === v ? C.amber : 'transparent', color: preview.after === v ? 'var(--on-amber, #1d1d1f)' : C.text, fontWeight: 600, fontSize: 13 }}>{l}</button>
                ))}
              </span>
              <span className="text-xs" style={{ color: C.textDim }}>Nothing here is sent or saved.</span>
              <span style={{ flex: 1 }} />
              <Btn variant="primary" onClick={() => setPreview(null)}>Close preview</Btn>
            </div>
            <div key={preview.artistSlug + preview.after} style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
              {renderPreview(preview.artistSlug, rows, () => setPreview(null))}
            </div>
          </div>, document.body);
      })()}
    </div>
  );
}
