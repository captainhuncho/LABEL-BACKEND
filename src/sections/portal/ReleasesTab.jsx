import { Disc3, Globe, MessageSquare, Plus, Trash2, Video } from 'lucide-react';
import { COLLABORATOR_ROLES, EXPLICIT_OPTIONS, SPLIT_REQUIRED_ROLES, RELEASE_TYPES, checklistProgress, formatDate, missingRequiredDocs, releaseStatusTone } from '../../constants.js';
import { C } from '../../theme.js';
import { ArtworkThumb, Badge, Btn, EmptyState, ExportBar, Field, Input, PeopleInput, Select, Td, TextArea, Th } from '../../ui.jsx';
import { SUBMISSION_LABELS, SUBMISSION_TONES } from '../Submissions.jsx';
import { licenseFor, rightsLine } from '../../licenses.js';

// The artist portal's releases tab (state lives in ArtistPortalShell).
export function ReleasesTab({ addSubmitCollaborator, addSubmitPrimaryArtist, artist, artistAddError, artistCatalog, artistCategory, collabError, featuredPct, handleSplitSheet, handleSubmitArtwork, licenseCtx, mySubmissions, newSubmitCollab, newSubmitPrimaryArtist, pickedReleases, removeSubmitCollaborator, removeSubmitPrimaryArtist, replyDrafts, replyError, rightsArtist, sendSubmissionReply, sendsTo, setArtistAddError, setArtistCategory, setCollabError, setFeaturedPct, setNewSubmitCollab, setNewSubmitPrimaryArtist, setPickedReleases, setReplyDrafts, setShowSubmitForm, setSubmitDocNote, setSubmitError, setSubmitForm, showSubmitForm, splitSheetRef, splitsTotal, submitArtworkRef, submitError, submitForm, submitReleaseSubmission, toggleSubmitDoc }) {
  return (
          <div>
            <div className="flex justify-end mb-4">
              <Btn variant="primary" onClick={() => setShowSubmitForm(!showSubmitForm)}><Plus size={14} /> Submit new release</Btn>
            </div>

            {showSubmitForm && (
              <form onSubmit={e => { e.preventDefault(); submitReleaseSubmission(); }} className="rounded border p-4 mb-6 imss-form-grid gap-3" style={{ background: C.panel, borderColor: C.borderLight }}>
                <Field label="Title" full><Input required value={submitForm.title} onChange={e => setSubmitForm({ ...submitForm, title: e.target.value })} placeholder="Working title" /></Field>
                <fieldset className="imss-span-2">
                  <legend className="text-xs mb-2" style={{ color: C.textDim }}>Artists on this song</legend>
                  <div className="flex items-center gap-1.5 flex-wrap mb-3">
                    <span className="imss-chip is-primary">{artist.name} <small>primary · you</small></span>
                    {(submitForm.primaryArtists || []).map((name, i) => (
                      <span key={'p' + i} className="imss-chip is-primary">{name} <small>primary</small><button type="button" onClick={() => removeSubmitPrimaryArtist(i)} aria-label={'Remove ' + name}><Trash2 size={12} /></button></span>
                    ))}
                    {submitForm.collaborators.map((c, i) => c.role === 'Feature' && (
                      <span key={'f' + i} className="imss-chip is-featured">{c.name} <small>featured · {c.splitPercent}%</small><button type="button" onClick={() => removeSubmitCollaborator(i)} aria-label={'Remove ' + c.name}><Trash2 size={12} /></button></span>
                    ))}
                  </div>
                  <div className={'imss-artist-add' + (artistCategory === 'Featured' ? ' is-featured' : '')}>
                    <div className="imss-seg" role="radiogroup" aria-label="Category">
                      {['Primary', 'Featured'].map(c => (
                        <button key={c} type="button" role="radio" aria-checked={artistCategory === c} onClick={() => { setArtistCategory(c); setArtistAddError(''); }} className={artistCategory === c ? 'is-on' : ''}>{c}</button>
                      ))}
                    </div>
                    <Input aria-label="Artist name" value={newSubmitPrimaryArtist} onChange={e => { setNewSubmitPrimaryArtist(e.target.value); setArtistAddError(''); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubmitPrimaryArtist(); } }} placeholder={artistCategory === 'Primary' ? 'Co-primary artist name' : 'Featured artist name'} />
                    {artistCategory === 'Featured' && (
                      <Input aria-label="Featured artist split %" type="number" min="0" max="100" step="0.01" value={featuredPct} onChange={e => { setFeaturedPct(e.target.value); setArtistAddError(''); }} placeholder="Split %" />
                    )}
                    <Btn variant="ghost" type="button" onClick={addSubmitPrimaryArtist}><Plus size={14} /> Add</Btn>
                  </div>
                  <div className="text-xs mt-2" style={{ color: C.textDim }}>{artistCategory === 'Primary' ? 'Primary artists share the headline credit on a joint release.' : 'Featured artists are credited as “feat.” and added to the splits below with their %.'}</div>
                  {artistAddError && <div className="text-sm mt-2" role="alert" style={{ color: C.red }}>{artistAddError}</div>}
                </fieldset>
                <Field label="Type">
                  <Select value={submitForm.type} onChange={e => setSubmitForm({ ...submitForm, type: e.target.value })}>
                    {RELEASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </Field>
                <Field label="Genre"><Input value={submitForm.genre} onChange={e => setSubmitForm({ ...submitForm, genre: e.target.value })} placeholder="e.g. Alt-Pop" /></Field>
                <Field label="Proposed release date"><Input type="date" value={submitForm.proposedDate} onChange={e => setSubmitForm({ ...submitForm, proposedDate: e.target.value })} /></Field>
                <Field label="Artwork (optional)" full>
                  <input ref={submitArtworkRef} type="file" accept="image/*" onChange={handleSubmitArtwork} className="text-xs" style={{ color: C.textDim }} />
                </Field>

                <section className="imss-span-2" aria-labelledby="splits-h">
                  <h3 id="splits-h" style={{ fontWeight: 600, fontSize: 15 }}>Splits <span style={{ color: C.red }} aria-hidden="true">*</span></h3>
                  <p className="text-xs mt-1 mb-3" style={{ color: C.textDim, maxWidth: '70ch' }}>List everyone taking a share of this song. Featured artists, producers and songwriters must have their split % entered, and it has to match the signed split sheet.</p>
                  <div className="rounded border overflow-hidden" style={{ borderColor: C.border, background: C.bg }}>
                    <table className="w-full" style={{ tableLayout: 'fixed' }}>
                      <colgroup><col /><col style={{ width: '28%' }} /><col style={{ width: 96 }} /><col style={{ width: 44 }} /></colgroup>
                      <thead><tr><Th>Name</Th><Th>Role</Th><Th align="right">Split</Th><Th align="right"></Th></tr></thead>
                      <tbody>
                        {submitForm.collaborators.map((c, i) => (
                          <tr key={i}>
                            <Td><span style={{ overflowWrap: 'anywhere' }}>{c.name}</span></Td>
                            <Td>{c.role}</Td>
                            <Td align="right" mono>{c.splitPercent}%</Td>
                            <Td align="right"><button type="button" onClick={() => removeSubmitCollaborator(i)} aria-label={'Remove ' + c.name} style={{ color: C.textDim }}><Trash2 size={14} /></button></Td>
                          </tr>
                        ))}
                        <tr>
                          <Td><span style={{ fontWeight: 600 }}>{artist.name}</span> <span className="text-xs" style={{ color: C.textDim }}>(you, remainder)</span></Td>
                          <Td>Primary artist</Td>
                          <Td align="right" mono><span style={{ color: splitsTotal > 100 ? C.red : C.teal, fontWeight: 600 }}>{Math.max(0, 100 - splitsTotal)}%</span></Td>
                          <Td>{''}</Td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="imss-split-add" style={{ borderTop: '1px solid ' + C.border }}>
                      <Input aria-label="Name" value={newSubmitCollab.name} onChange={e => { setNewSubmitCollab({ ...newSubmitCollab, name: e.target.value }); setCollabError(''); }} placeholder="Name" />
                      <Select aria-label="Role" value={newSubmitCollab.role} onChange={e => { setNewSubmitCollab({ ...newSubmitCollab, role: e.target.value }); setCollabError(''); }}>
                        {COLLABORATOR_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </Select>
                      <Input aria-label="Split %" type="number" min="0" max="100" step="0.01" value={newSubmitCollab.splitPercent} onChange={e => { setNewSubmitCollab({ ...newSubmitCollab, splitPercent: e.target.value }); setCollabError(''); }} placeholder={SPLIT_REQUIRED_ROLES.includes(newSubmitCollab.role) ? 'Split % (required)' : 'Split %'} />
                      <Btn variant="ghost" type="button" onClick={addSubmitCollaborator}><Plus size={14} /> Add</Btn>
                    </div>
                  </div>
                  {collabError && <div className="text-sm mt-2" role="alert" style={{ color: C.red }}>{collabError}</div>}

                  <div className="imss-form-grid gap-3 mt-4">
                    <Field label="Signed split sheet (PDF or photo, up to 10 MB) *" full>
                      <input ref={splitSheetRef} type="file" accept="application/pdf,image/*" onChange={handleSplitSheet} className="text-sm" style={{ color: C.textDim }} />
                      {submitForm.splitSheetName && <span className="text-xs" style={{ color: C.teal }}>Attached: {submitForm.splitSheetName}</span>}
                    </Field>
                  </div>
                  <label className="flex items-start gap-2 text-sm mt-3" style={{ color: C.text, cursor: 'pointer' }}>
                    <input type="checkbox" checked={submitForm.splitsConfirmed} onChange={e => { setSubmitForm({ ...submitForm, splitsConfirmed: e.target.checked }); setSubmitError(''); }} style={{ marginTop: 3, accentColor: C.amber }} />
                    Everyone listed above has signed the split sheet, and the percentages match it.
                  </label>
                </section>

                <div className="imss-span-2">
                  <div className="text-xs mb-2" style={{ color: C.textFaint }}>Track metadata (for the distributor sheet)</div>
                  <div className="rounded border p-3 imss-form-grid gap-3" style={{ borderColor: C.border, background: C.bg }}>
                    <Field label="Duration"><Input value={submitForm.duration} onChange={e => setSubmitForm({ ...submitForm, duration: e.target.value })} placeholder="mm:ss" /></Field>
                    <Field label="Explicit / Clean">
                      <Select value={submitForm.explicit} onChange={e => setSubmitForm({ ...submitForm, explicit: e.target.value })}>
                        {EXPLICIT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </Select>
                    </Field>
                    <Field label="Dolby Atmos">
                      <label className="flex items-center gap-2 text-sm" style={{ paddingTop: 8 }}>
                        <input type="checkbox" checked={submitForm.dolbyAtmos} onChange={e => setSubmitForm({ ...submitForm, dolbyAtmos: e.target.checked })} /> Dolby Atmos mix available
                      </label>
                    </Field>
                    <Field label="Performed by" full><PeopleInput label="Performed by" value={submitForm.credits.performedBy} onChange={v => setSubmitForm(f => ({ ...f, credits: { ...f.credits, performedBy: v } }))} placeholder="Artist name, then Enter" /></Field>
                    <Field label="Written by"><PeopleInput label="Written by" value={submitForm.credits.writtenBy} onChange={v => setSubmitForm(f => ({ ...f, credits: { ...f.credits, writtenBy: v } }))} placeholder="Type a name, then Enter" /></Field>
                    <Field label="Produced by"><PeopleInput label="Produced by" value={submitForm.credits.producedBy} onChange={v => setSubmitForm(f => ({ ...f, credits: { ...f.credits, producedBy: v } }))} placeholder="Type a name, then Enter" /></Field>
                    <Field label="Recording engineer"><PeopleInput label="Recording engineer" value={submitForm.credits.recordingEngineer} onChange={v => setSubmitForm(f => ({ ...f, credits: { ...f.credits, recordingEngineer: v } }))} placeholder="Type a name, then Enter" /></Field>
                    <Field label="Mixing engineer"><PeopleInput label="Mixing engineer" value={submitForm.credits.mixingEngineer} onChange={v => setSubmitForm(f => ({ ...f, credits: { ...f.credits, mixingEngineer: v } }))} placeholder="Type a name, then Enter" /></Field>
                    <Field label="Mastering engineer"><PeopleInput label="Mastering engineer" value={submitForm.credits.masteringEngineer} onChange={v => setSubmitForm(f => ({ ...f, credits: { ...f.credits, masteringEngineer: v } }))} placeholder="Type a name, then Enter" /></Field>
                    <Field label="Dolby engineer"><PeopleInput label="Dolby engineer" value={submitForm.credits.dolbyEngineer} onChange={v => setSubmitForm(f => ({ ...f, credits: { ...f.credits, dolbyEngineer: v } }))} placeholder="Type a name, then Enter" /></Field>
                    <fieldset className="imss-span-2">
                      <legend className="text-xs mb-2" style={{ color: C.textDim }}>Does this song have lyrics?</legend>
                      <div className="imss-seg" role="radiogroup" aria-label="Lyrics or instrumental">
                        {[['lyrics', 'Has lyrics'], ['instrumental', 'Instrumental']].map(([k, label]) => (
                          <button key={k} type="button" role="radio" aria-checked={(k === 'instrumental') === !!submitForm.instrumental} className={(k === 'instrumental') === !!submitForm.instrumental ? 'is-on' : ''}
                            onClick={() => setSubmitForm(f => ({ ...f, instrumental: k === 'instrumental', lyrics: k === 'instrumental' ? '' : f.lyrics }))}>{label}</button>
                        ))}
                      </div>
                    </fieldset>
                    {!submitForm.instrumental && <Field label="Lyrics" full><TextArea rows={4} value={submitForm.lyrics} onChange={e => setSubmitForm({ ...submitForm, lyrics: e.target.value })} placeholder="Paste the full lyrics, or note where they’re stored" /></Field>}
                    <Field label={'About the song or project · ' + (submitForm.about || '').length + ' / 700'} full>
                      <TextArea rows={4} maxLength={700} value={submitForm.about || ''} onChange={e => setSubmitForm({ ...submitForm, about: e.target.value.slice(0, 700) })} placeholder="The story behind it, the sound, who it’s for. This helps the label pitch it to playlists and press." />
                    </Field>
                  </div>
                </div>

                <section className="imss-span-2" aria-labelledby="rollout-h">
                  <h3 id="rollout-h" style={{ fontWeight: 600, fontSize: 15 }}>Marketing and rollout</h3>
                  <p className="text-xs mt-1 mb-3" style={{ color: C.textDim, maxWidth: '70ch' }}>What you’re planning to promote this release, so the label can line up with it.</p>
                  <div className="imss-form-grid gap-3">
                    <Field label="Rollout plan" full><TextArea rows={4} value={(submitForm.rollout || {}).plan || ''} onChange={e => setSubmitForm(f => ({ ...f, rollout: { ...(f.rollout || {}), plan: e.target.value } }))} placeholder="e.g. Teasers two weeks out, pre-save link, release-week live session, TikTok challenge" /></Field>
                    <Field label="Content you’ll make"><Input value={(submitForm.rollout || {}).content || ''} onChange={e => setSubmitForm(f => ({ ...f, rollout: { ...(f.rollout || {}), content: e.target.value } }))} placeholder="Music video, visualiser, behind the scenes" /></Field>
                    <Field label="Shows or events"><Input value={(submitForm.rollout || {}).events || ''} onChange={e => setSubmitForm(f => ({ ...f, rollout: { ...(f.rollout || {}), events: e.target.value } }))} placeholder="Launch party, radio tour, festival slot" /></Field>
                    <Field label="Social handles to tag"><Input value={(submitForm.rollout || {}).socials || ''} onChange={e => setSubmitForm(f => ({ ...f, rollout: { ...(f.rollout || {}), socials: e.target.value } }))} placeholder="@yourname on Instagram, TikTok, X" /></Field>
                  </div>
                </section>

                <Field label="Notes for the label" full><TextArea rows={3} value={submitForm.notes} onChange={e => setSubmitForm({ ...submitForm, notes: e.target.value })} placeholder="Anything else your PM should know?" /></Field>

                <div className="imss-span-2">
                  <div className="text-xs mb-2" style={{ color: C.textFaint }}>
                    Distribution package{missingRequiredDocs(submitForm.distributionDocs) > 0 && <span style={{ color: C.amber }}> — {missingRequiredDocs(submitForm.distributionDocs)} required item{missingRequiredDocs(submitForm.distributionDocs) === 1 ? '' : 's'} not marked ready yet</span>}
                  </div>
                  <div className="rounded border p-3" style={{ borderColor: C.border, background: C.bg }}>
                    <div className="flex flex-col gap-2">
                      {submitForm.distributionDocs.map(d => (
                        <div key={d.id} className="flex items-center gap-2 flex-wrap">
                          <label className="flex items-center gap-2 text-sm" style={{ minWidth: 160, color: d.attached ? C.textFaint : C.text, textDecoration: d.attached ? 'line-through' : 'none' }}>
                            <input type="checkbox" checked={d.attached} onChange={() => toggleSubmitDoc(d.id)} />
                            {d.label}
                          </label>
                          {!d.attached && (d.required ? <Badge tone="amber">Not ready</Badge> : <Badge>Optional</Badge>)}
                          <Input value={d.note} onChange={e => setSubmitDocNote(d.id, e.target.value)} placeholder="Where is it? (e.g. in my Drive folder)" style={{ flex: 1, minWidth: 160 }} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {submitError && <div className="imss-span-2 text-sm" role="alert" style={{ color: C.red }}>{submitError}</div>}
                <div className="imss-span-2 flex items-center gap-3 mt-1 flex-wrap">
                  <Btn variant="primary" type="submit">Send package to {sendsTo}</Btn>
                  <Btn variant="ghost" onClick={() => setShowSubmitForm(false)}>Cancel</Btn>
                  <div className="text-xs" style={{ color: C.textFaint }}>Your {artist.productManager ? 'PM' : 'label rep'} will review it before it becomes an official release.</div>
                </div>
              </form>
            )}

            {mySubmissions.length > 0 && (
              <section aria-labelledby="my-subs-h" className="rounded border mb-6 overflow-hidden" style={{ background: C.panel, borderColor: C.border }}>
                <div className="imss-dash-ph"><h2 id="my-subs-h">Your submissions</h2></div>
                <ul className="imss-my-subs">
                  {mySubmissions.map(sub => {
                    const msgs = sub.messages || [], needs = sub.status === 'Needs info';
                    return (
                      <li key={sub.id}>
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <div style={{ fontWeight: 600 }}>{sub.title}</div>
                            <div className="text-xs mt-0.5" style={{ color: C.textDim }}>{sub.type}{sub.proposedDate ? ' · ' + formatDate(sub.proposedDate) : ''}{sub.sentTo ? ' · sent to ' + sub.sentTo : ''}</div>
                          </div>
                          <Badge tone={SUBMISSION_TONES[sub.status]}>{SUBMISSION_LABELS[sub.status] || sub.status}</Badge>
                        </div>
                        {msgs.length > 0 && (
                          <ol className="imss-thread mt-3">
                            {msgs.map((m, i) => (
                              <li key={i} className={m.from === 'artist' ? 'is-artist' : 'is-label'}>
                                <div className="imss-thread-meta">{m.from === 'artist' ? 'You' : (m.by || 'IMSS Records')} · {formatDate(String(m.at || '').slice(0, 10))}</div>
                                <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                              </li>
                            ))}
                          </ol>
                        )}
                        {needs && (
                          <form className="mt-3" onSubmit={e => { e.preventDefault(); sendSubmissionReply(sub); }}>
                            <Field label="Your reply">
                              <TextArea rows={3} value={replyDrafts[sub.id] || ''} onChange={e => setReplyDrafts(d => ({ ...d, [sub.id]: e.target.value }))} placeholder="Answer the label’s question. If they need a new file, say where it is or email it to your PM." />
                            </Field>
                            {replyError[sub.id] && <div className="text-sm mt-2" role="alert" style={{ color: C.red }}>{replyError[sub.id]}</div>}
                            <div className="mt-2"><Btn variant="primary" type="submit"><MessageSquare size={14} /> Send reply</Btn></div>
                          </form>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <ExportBar filename={(artist.name || 'artist').replace(/\s+/g, '-').toLowerCase() + '-releases'} headers={['Song Title', 'Primary Artist(s)', 'Featured Artist(s)', 'Release Type', 'Release Date', 'ISRC', 'UPC', 'Label', '℗ Line', 'Genre', 'Explicit/Clean', 'Duration', 'Written By (Songwriters)', 'Produced By', 'Splits', 'Recording Engineer', 'Mixing Engineer', 'Mastering Engineer', 'Dolby Atmos', 'Dolby Engineer', 'Lyrics', 'Music Video', 'Status', 'Primary Market', 'Secondary Market', 'IMSS Records rights']} rows={artistCatalog.filter(r => !pickedReleases.length || pickedReleases.includes(r.id)).map(r => {
              // Track transfer / publishing template: everything a new distributor or publisher asks for.
              const cr = r.credits || {};
              const collabs = r.collaborators || [];
              const label = r.label || 'IMSS Records';
              return [
                r.title,
                [artist.name, ...(r.primaryArtists || [])].filter(Boolean).join(' & '),
                collabs.filter(c => c.role === 'Feature').map(c => c.name).join(', '),
                r.type,
                r.releaseDate || '',
                r.isrc || '',
                r.upc || '',
                label,
                r.releaseDate ? '℗ ' + r.releaseDate.slice(0, 4) + ' ' + label : '',
                r.genre || artist.genre || '',
                r.explicit && r.explicit !== 'Not Set' ? r.explicit : '',
                r.duration || '',
                cr.writtenBy || '',
                cr.producedBy || collabs.filter(c => c.role === 'Producer').map(c => c.name).join(', '),
                collabs.map(c => c.name + ' (' + c.role + ', ' + c.splitPercent + '%)').join('; '),
                cr.recordingEngineer || '',
                cr.mixingEngineer || '',
                cr.masteringEngineer || '',
                r.dolbyAtmos ? 'Yes' : 'No',
                cr.dolbyEngineer || '',
                r.lyrics || '',
                r.hasVideo ? 'Yes' : 'No',
                r.status,
                r.primaryMarket || '',
                r.secondaryMarket || '',
                rightsLine(licenseFor(r, rightsArtist, licenseCtx)),
              ];
            })} />
            {artistCatalog.length > 0 && (
              <div className="text-sm mb-3 flex items-center gap-3 flex-wrap" style={{ color: C.textDim }}>
                <span>{pickedReleases.length ? 'Exporting ' + pickedReleases.length + ' of ' + artistCatalog.length + ' selected' : 'Exporting all ' + artistCatalog.length + '. Tick releases to export only those.'}</span>
                {pickedReleases.length > 0 && <button onClick={() => setPickedReleases([])} style={{ color: C.amber }}>Clear selection</button>}
              </div>
            )}

            {artistCatalog.length === 0 ? (
              <EmptyState icon={Disc3} title="No releases yet" description="Releases the label adds for you will show up here." />
            ) : (
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
                {artistCatalog.map(r => {
                  const prog = checklistProgress(r.checklist);
                  return (
                    <div key={r.id} className="rounded border overflow-hidden" style={{ background: C.panel, borderColor: C.border }}>
                      <div style={{ width: '100%', aspectRatio: '1 / 1', position: 'relative' }}>
                        <ArtworkThumb release={r} size="100%" radius={0} />
                        <label style={{ position: 'absolute', top: 8, right: 8, background: C.panel, borderRadius: 8, padding: '4px 6px', display: 'flex', boxShadow: 'var(--shadow)' }}>
                          <input type="checkbox" aria-label={'Select ' + r.title + ' for export'} checked={pickedReleases.includes(r.id)} onChange={e => setPickedReleases(l => e.target.checked ? [...l, r.id] : l.filter(x => x !== r.id))} />
                        </label>
                        {r.status !== 'Released' && prog.total > 0 && (
                          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 3, background: 'var(--fill)' }}>
                            <div style={{ height: 3, width: prog.pct + '%', background: C.amber }} />
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <div className="text-xs" style={{ color: C.textFaint }}>{formatDate(r.releaseDate)}</div>
                        <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3, marginTop: 2 }}>{r.title}</div>
                        {r.primaryArtists && r.primaryArtists.length > 0 && (
                          <div style={{ fontStyle: 'italic', fontSize: 13, color: C.textDim, marginTop: 1 }}>with {r.primaryArtists.join(' & ')}</div>
                        )}
                        {r.collaborators && r.collaborators.length > 0 && (
                          <div style={{ fontStyle: 'italic', fontSize: 13, color: C.textDim, marginTop: 1 }}>feat. {r.collaborators.map(c => c.name).join(', ')}</div>
                        )}
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <Badge tone={releaseStatusTone(r.status)}>{r.status}</Badge>
                          <Badge>{r.type}</Badge>
                          {r.hasVideo && <Badge><Video size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />Video</Badge>}
                        </div>
                        {(r.primaryMarket || r.secondaryMarket) && (
                          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                            {r.primaryMarket && <Badge tone="teal"><Globe size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />{r.primaryMarket}</Badge>}
                            {r.secondaryMarket && <Badge>+ {r.secondaryMarket}</Badge>}
                          </div>
                        )}
                        {r.status !== 'Released' && prog.total > 0 && (
                          <div className="text-xs mt-1.5" style={{ color: C.textFaint }}>{prog.done}/{prog.total} production tasks</div>
                        )}
                        {r.status === 'Released' && <div className="text-xs mt-1.5" style={{ color: C.textDim, lineHeight: 1.4 }}>{rightsLine(licenseFor(r, rightsArtist, licenseCtx))}</div>}
                        {(r.isrc || r.upc) && (
                          <div className="text-xs mt-2" style={{ color: C.textFaint, lineHeight: 1.5 }}>
                            {r.isrc && <div>ISRC {r.isrc}</div>}
                            {r.upc && <div>UPC {r.upc}</div>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
  );
}
