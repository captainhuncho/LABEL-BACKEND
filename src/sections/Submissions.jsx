import { CheckCircle2, Disc3, Mail, MessageSquare } from 'lucide-react';
import React, { useState } from 'react';
import { SPLIT_REQUIRED_ROLES, formatDate, missingRequiredDocs } from '../constants.js';
import { C, MONO_FONT } from '../theme.js';
import { Badge, Btn, EmptyState, Field, SectionHeader, Td, TextArea, Th, DocLink } from '../ui.jsx';
import { releasesOn } from './Catalog.jsx';

// What a release submission needs before it can go to Catalog.
export function submissionChecks(sub) {
  const collabs = sub.collaborators || [];
  const total = collabs.reduce((t, c) => t + (Number(c.splitPercent) || 0), 0);
  const credits = sub.credits || {};
  return [
    { label: 'Title and type', ok: !!(sub.title && sub.type) },
    { label: 'Proposed release date', ok: !!sub.proposedDate },
    { label: 'Artwork attached', ok: !!sub.artworkUrl },
    { label: 'Splits add up to 100% or less', ok: total <= 100 },
    { label: 'Every feature, producer and songwriter has a split %', ok: collabs.filter(c => SPLIT_REQUIRED_ROLES.includes(c.role)).every(c => c.splitPercent !== '' && c.splitPercent !== null && c.splitPercent !== undefined) },
    { label: 'Signed split sheet uploaded', ok: !!sub.splitSheet },
    { label: 'Artist confirmed everyone signed', ok: !!sub.splitsConfirmed },
    { label: 'Written by and produced by credited', ok: !!(credits.writtenBy && credits.producedBy) },
    { label: 'Duration', ok: !!sub.duration },
    { label: 'Explicit / clean set', ok: !!sub.explicit && sub.explicit !== 'Not Set' },
    { label: sub.instrumental ? 'Lyrics (instrumental, none needed)' : 'Lyrics', ok: !!sub.instrumental || !!(sub.lyrics || '').trim() },
    { label: 'About the song', ok: !!(sub.about || '').trim() },
    { label: 'Marketing and rollout plan', ok: !!((sub.rollout || {}).plan || '').trim() },
    { label: 'Required distribution docs ready', ok: missingRequiredDocs(sub.distributionDocs) === 0 },
  ];
}
export const SUBMISSION_LABELS = { Pending: 'Waiting review', 'Needs info': 'Needs info', Approved: 'Accepted', Rejected: 'Rejected' };
export const SUBMISSION_TONES = { Pending: 'amber', 'Needs info': 'amber', Approved: 'teal', Rejected: 'red' };

export function SubmissionsSection({ releaseSubmissions, update, roster, catalog = [], pmScope = null, canEdit = true, sessionName = '', onAccept }) {
  const [status, setStatus] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const artistOf = id => roster.find(a => a.id === id) || {};
  const scoped = releaseSubmissions.filter(sub => !pmScope || artistOf(sub.artistId).productManager === pmScope);
  const shown = scoped.filter(sub => status === 'all' || sub.status === status).sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
  const count = st => scoped.filter(sub => sub.status === st).length;

  function setSub(sub, patch) { update(releaseSubmissions.map(x => x.id === sub.id ? { ...x, ...patch } : x)); }
  function addMessage(sub, nextStatus) {
    const text = message.trim();
    if (!text) { setError(nextStatus === 'Rejected' ? 'Say why it’s being rejected so the artist knows what to fix.' : 'Write what you need from the artist.'); return; }
    const stamp = new Date().toISOString();
    setSub(sub, { status: nextStatus, reviewedBy: sessionName, reviewedAt: stamp, messages: [...(sub.messages || []), { from: 'label', by: sessionName, at: stamp, text }] });
    setMessage(''); setError('');
  }
  function mailto(sub) {
    const a = artistOf(sub.artistId);
    const last = [...(sub.messages || [])].reverse().find(m => m.from === 'label');
    const body = 'Hi ' + (a.name || '') + ',\n\nAbout your release submission “' + sub.title + '”:\n\n' + (message.trim() || (last ? last.text : '')) + '\n\nYou can reply in your IMSS Records portal under Releases.\n\n' + sessionName;
    return 'mailto:' + encodeURIComponent(a.email || '') + '?subject=' + encodeURIComponent('IMSS Records: more info needed for “' + sub.title + '”') + '&body=' + encodeURIComponent(body);
  }

  return (
    <div>
      <SectionHeader title="Release submissions" description="New releases artists have sent in. Check each one is complete, ask for anything missing, then accept it into Catalog to add the UPC, ISRCs and the rest." />
      <div className="flex gap-1 mb-4 flex-wrap" role="tablist" aria-label="Filter by status">
        {[['all', 'All'], ['Pending', 'Waiting review'], ['Needs info', 'Needs info'], ['Approved', 'Accepted'], ['Rejected', 'Rejected']].map(([st, label]) => (
          <button key={st} role="tab" aria-selected={status === st} onClick={() => { setStatus(st); setOpenId(null); }} className="text-sm px-3 py-1.5 rounded inline-flex items-center gap-1.5"
            style={{ background: status === st ? C.amberSoft : 'transparent', color: status === st ? C.amber : C.textDim, border: '1px solid ' + (status === st ? 'transparent' : C.border), fontWeight: status === st ? 600 : 500 }}>
            {label}{(st === 'all' ? scoped.length : count(st)) > 0 && <span style={{ fontFamily: MONO_FONT, fontSize: 12 }}>{st === 'all' ? scoped.length : count(st)}</span>}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={Disc3} title={status === 'Pending' ? 'Nothing waiting for review' : 'Nothing here'} description="When an artist submits a release from their portal, it arrives here for review." />
      ) : (
        <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
          <table className="w-full" style={{ minWidth: 820 }}>
            <thead><tr><Th>Submitted</Th><Th>Artist</Th><Th>Release</Th><Th>Proposed date</Th><Th>Complete</Th><Th>Status</Th><Th align="right"></Th></tr></thead>
            <tbody>
              {shown.map(sub => {
                const checks = submissionChecks(sub), passed = checks.filter(c => c.ok).length, a = artistOf(sub.artistId), isOpen = openId === sub.id;
                const collabs = sub.collaborators || [], artistPct = Math.max(0, 100 - collabs.reduce((t, c) => t + (Number(c.splitPercent) || 0), 0));
                return (
                  <React.Fragment key={sub.id}>
                    <tr data-focus={sub.id}>
                      <Td mono>{formatDate((sub.submittedAt || '').slice(0, 10))}</Td>
                      <Td>{a.name || 'Unknown artist'}</Td>
                      <Td><span style={{ fontWeight: 600 }}>{sub.title}</span><div className="text-xs" style={{ color: C.textDim }}>{sub.type}{sub.genre ? ' · ' + sub.genre : ''}</div></Td>
                      <Td mono>{sub.proposedDate ? formatDate(sub.proposedDate) : '—'}{sub.proposedDate && releasesOn(catalog, sub.proposedDate).length > 0 && <div className="text-xs" style={{ color: C.amber, fontWeight: 600, fontFamily: 'inherit' }}>Date clash: {releasesOn(catalog, sub.proposedDate).length} already out</div>}</Td>
                      <Td><span style={{ fontFamily: MONO_FONT, color: passed === checks.length ? C.teal : C.amber, fontWeight: 600 }}>{passed}/{checks.length}</span></Td>
                      <Td><Badge tone={SUBMISSION_TONES[sub.status]}>{SUBMISSION_LABELS[sub.status] || sub.status}</Badge></Td>
                      <Td align="right"><button onClick={() => { setOpenId(isOpen ? null : sub.id); setMessage(''); setError(''); }} style={{ color: C.amber, fontWeight: 600, fontSize: 13 }}>{isOpen ? 'Close' : 'Review'}</button></Td>
                    </tr>
                    {isOpen && (
                      <tr><td colSpan={7} style={{ padding: 0, borderBottom: '1px solid ' + C.border }}>
                        <div className="imss-sub-review">
                          <section>
                            <h3 className="imss-sub-h">Completeness check · {passed} of {checks.length}</h3>
                            <ul className="imss-checks">
                              {checks.map(c => (
                                <li key={c.label} className={c.ok ? 'is-ok' : 'is-miss'}>{c.ok ? <CheckCircle2 size={15} aria-hidden="true" /> : <span className="imss-check-miss" aria-hidden="true" />}<span>{c.label}</span><span className="sr-only">{c.ok ? ' — done' : ' — missing'}</span></li>
                              ))}
                            </ul>
                          </section>
                          <section>
                            <h3 className="imss-sub-h">Splits</h3>
                            <table className="w-full" style={{ tableLayout: 'fixed' }}>
                              <colgroup><col /><col style={{ width: '34%' }} /><col style={{ width: 72 }} /></colgroup>
                              <tbody>
                                {collabs.map((c, i) => <tr key={i}><Td>{c.name}</Td><Td>{c.role}</Td><Td align="right" mono>{c.splitPercent}%</Td></tr>)}
                                <tr><Td><span style={{ fontWeight: 600 }}>{a.name || 'Artist'}</span></Td><Td>Primary artist</Td><Td align="right" mono><span style={{ color: C.teal, fontWeight: 600 }}>{artistPct}%</span></Td></tr>
                              </tbody>
                            </table>
                            <div className="text-sm mt-3">{sub.splitSheet ? <DocLink value={sub.splitSheet} name={sub.splitSheetName || 'split-sheet'}>Download signed split sheet{sub.splitSheetName ? ' (' + sub.splitSheetName + ')' : ''}</DocLink> : <span style={{ color: C.red }}>No split sheet uploaded</span>}</div>
                            <h3 className="imss-sub-h mt-5">Credits</h3>
                            <dl className="imss-sub-dl">
                              {[['Performed by', 'performedBy'], ['Written by', 'writtenBy'], ['Produced by', 'producedBy'], ['Recording', 'recordingEngineer'], ['Mixing', 'mixingEngineer'], ['Mastering', 'masteringEngineer'], ['Dolby', 'dolbyEngineer']].map(([l, k]) => (
                                <React.Fragment key={k}><dt>{l}</dt><dd>{(sub.credits || {})[k] || '—'}</dd></React.Fragment>
                              ))}
                              <dt>Primary artists</dt><dd>{[a.name, ...(sub.primaryArtists || [])].filter(Boolean).join(', ')}</dd>
                              <dt>Duration</dt><dd>{sub.duration || '—'}</dd>
                              <dt>Explicit</dt><dd>{sub.explicit || '—'}</dd>
                              <dt>Lyrics</dt><dd>{sub.instrumental ? 'Instrumental' : (sub.lyrics ? <span style={{ whiteSpace: 'pre-wrap' }}>{sub.lyrics}</span> : '—')}</dd>
                              <dt>About</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{sub.about || '—'}</dd>
                              <dt>Rollout plan</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{(sub.rollout || {}).plan || '—'}</dd>
                              <dt>Content</dt><dd>{(sub.rollout || {}).content || '—'}</dd>
                              <dt>Shows / events</dt><dd>{(sub.rollout || {}).events || '—'}</dd>
                              <dt>Socials</dt><dd>{(sub.rollout || {}).socials || '—'}</dd>
                              <dt>Notes</dt><dd>{sub.notes || '—'}</dd>
                            </dl>
                          </section>
                          <section className="imss-sub-wide">
                            <h3 className="imss-sub-h">Messages with the artist</h3>
                            {(sub.messages || []).length === 0 ? <div className="text-sm" style={{ color: C.textDim }}>No messages yet.</div> : (
                              <ol className="imss-thread">
                                {sub.messages.map((m, i) => (
                                  <li key={i} className={m.from === 'artist' ? 'is-artist' : 'is-label'}>
                                    <div className="imss-thread-meta">{m.from === 'artist' ? (m.by || a.name) : (m.by || 'Label')} · {formatDate(String(m.at || '').slice(0, 10))}{m.via === 'email' ? ' · by email' : ''}</div>
                                    <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                                  </li>
                                ))}
                              </ol>
                            )}
                            {canEdit && (sub.status === 'Pending' || sub.status === 'Needs info') && (
                              <div className="mt-4">
                                <Field label="Message to the artist">
                                  <TextArea rows={3} value={message} onChange={e => { setMessage(e.target.value); setError(''); }} placeholder={'e.g. The split sheet is missing ' + ((collabs[0] || {}).name || 'a collaborator') + '’s signature. Please upload a signed copy.'} />
                                </Field>
                                {error && <div className="text-sm mt-2" role="alert" style={{ color: C.red }}>{error}</div>}
                                <div className="flex gap-2 flex-wrap mt-3">
                                  <Btn variant="primary" onClick={() => onAccept(sub)}><CheckCircle2 size={14} /> Accept to catalog</Btn>
                                  <Btn variant="ghost" onClick={() => addMessage(sub, 'Needs info')}><MessageSquare size={14} /> Request more info</Btn>
                                  <a href={mailto(sub)} className="imss-btn is-ghost inline-flex items-center gap-1.5" style={{ background: 'var(--fill)', color: C.text, border: '1px solid rgba(255,255,255,0.12)', fontWeight: 500 }}><Mail size={14} /> Email artist</a>
                                  <Btn variant="danger" onClick={() => addMessage(sub, 'Rejected')}>Reject</Btn>
                                </div>
                                {passed < checks.length && <div className="text-xs mt-2" style={{ color: C.amber }}>{checks.length - passed} check{checks.length - passed === 1 ? '' : 's'} not passing. You can still accept, or ask the artist first.</div>}
                                {!a.email && <div className="text-xs mt-1" style={{ color: C.textDim }}>This artist has no email on the Roster yet, so Email artist opens a blank message.</div>}
                              </div>
                            )}
                          </section>
                        </div>
                      </td></tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
