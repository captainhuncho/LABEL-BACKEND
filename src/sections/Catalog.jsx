import { ChevronRight, Disc3, FileSpreadsheet, Globe, ImagePlus, Pencil, Plus, Send, Trash2, Video } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { COLLABORATOR_ROLES, EXPLICIT_OPTIONS, MARKETS, RELEASE_STATUSES, RELEASE_TYPES, checklistProgress, emptyCredits, formatDate, makeDistributionDocs, makeReleaseChecklist, missingRequiredDocs, releaseStatusTone, todayStr, uid } from '../constants.js';
import { C, MONO_FONT } from '../theme.js';
import { ArtworkThumb, Badge, Btn, ConfirmInline, EmptyState, ExportBar, Field, Input, PeopleInput, SectionHeader, SegmentedToggle, Select, Td, TextArea, Th, exportRowsToExcel, resizeImageFile, DocLink } from '../ui.jsx';

export function CatalogSection({ focus = null, catalog, update, roster, artistMap, canEdit = true, pmScope = null, releaseSubmissions = [], updateReleaseSubmissions, sessionName = '', incomingSubmission = null, clearIncoming, onOpenSubmissions }) {
  const visibleRoster = pmScope ? roster.filter(a => a.productManager === pmScope) : roster;
  const visibleArtistIds = new Set(visibleRoster.map(a => a.id));
  const visibleCatalog = pmScope ? catalog.filter(c => visibleArtistIds.has(c.artistId)) : catalog;
  const visibleSubmissions = (pmScope ? releaseSubmissions.filter(s => visibleArtistIds.has(s.artistId)) : releaseSubmissions).filter(s => s.status === 'Pending');

  const empty = { artistId: visibleRoster[0] ? visibleRoster[0].id : '', title: '', type: 'Single', genre: '', releaseDate: todayStr(), isrc: '', upc: '', status: 'Processing', artworkUrl: '', enteredBy: '', hasVideo: false, licenseExpiration: '', collaborators: [], primaryArtists: [], primaryMarket: '', secondaryMarket: '', checklist: makeReleaseChecklist(), distributionDocs: makeDistributionDocs(), label: '', explicit: 'Not Set', dolbyAtmos: false, lyrics: '', duration: '', credits: emptyCredits() };
  const [distributorEmail, setDistributorEmail] = useState('');
  const [fromSubmissionId, setFromSubmissionId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [filterArtist, setFilterArtist] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterLicense, setFilterLicense] = useState('all');
  const [filterMarket, setFilterMarket] = useState('all');
  const [search, setSearch] = useState('');
  const [view, setView] = useState('grid');
  const [confirmId, setConfirmId] = useState(null);
  const [newCollab, setNewCollab] = useState({ name: '', role: 'Feature', splitPercent: '' });
  const [newPrimaryArtist, setNewPrimaryArtist] = useState('');
  const [newChecklistLabel, setNewChecklistLabel] = useState('');
  const artworkInputRef = useRef(null);
  const lastEnteredBy = catalog.length ? (catalog[catalog.length - 1].enteredBy || '') : '';

  function openAdd() { setFromSubmissionId(null); setForm({ ...empty, artistId: visibleRoster[0] ? visibleRoster[0].id : '', enteredBy: lastEnteredBy, checklist: makeReleaseChecklist(), distributionDocs: makeDistributionDocs() }); setEditing(null); setNewCollab({ name: '', role: 'Feature', splitPercent: '' }); setDistributorEmail(''); setShowForm(true); }
  function openFromSubmission(sub) {
    setForm({ ...empty, artistId: sub.artistId, title: sub.title, type: sub.type, genre: sub.genre || '', releaseDate: sub.proposedDate || todayStr(), artworkUrl: sub.artworkUrl || '', collaborators: sub.collaborators || [], primaryArtists: sub.primaryArtists || [], enteredBy: sessionName, checklist: makeReleaseChecklist(), distributionDocs: sub.distributionDocs && sub.distributionDocs.length ? sub.distributionDocs : makeDistributionDocs(), explicit: sub.explicit || 'Not Set', dolbyAtmos: !!sub.dolbyAtmos, lyrics: sub.lyrics || '', duration: sub.duration || '', credits: sub.credits ? { ...emptyCredits(), ...sub.credits } : emptyCredits(), splitSheet: sub.splitSheet || '', splitSheetName: sub.splitSheetName || '', instrumental: !!sub.instrumental, about: sub.about || '', rollout: sub.rollout || null });
    setEditing(null);
    setNewCollab({ name: '', role: 'Feature', splitPercent: '' });
    setDistributorEmail('');
    setShowForm(true);
    setFromSubmissionId(sub.id); // marked Accepted only when this release is saved
  }
  // Accepted from the Submissions screen: open the release form pre-filled once.
  useEffect(() => {
    if (incomingSubmission) { openFromSubmission(incomingSubmission); if (clearIncoming) clearIncoming(); }
    // eslint-disable-next-line
  }, [incomingSubmission]);
  function rejectSubmission(sub) {
    if (updateReleaseSubmissions) updateReleaseSubmissions(releaseSubmissions.map(s => s.id === sub.id ? { ...s, status: 'Rejected', reviewedBy: sessionName, reviewedAt: new Date().toISOString() } : s));
  }
  function openEdit(r) { setFromSubmissionId(null); setForm({ ...empty, ...r, collaborators: r.collaborators || [], primaryArtists: r.primaryArtists || [], checklist: r.checklist && r.checklist.length ? r.checklist : makeReleaseChecklist(), distributionDocs: r.distributionDocs && r.distributionDocs.length ? r.distributionDocs : makeDistributionDocs(), credits: r.credits ? { ...emptyCredits(), ...r.credits } : emptyCredits() }); setEditing(r.id); setNewCollab({ name: '', role: 'Feature', splitPercent: '' }); setDistributorEmail(''); setShowForm(true); }
  useEffect(() => { const r = focus && focus.openId && catalog.find(c => c.id === focus.openId); if (r) openEdit(r); }, [focus]);
  function closeForm() { setShowForm(false); setEditing(null); setNewChecklistLabel(''); if (artworkInputRef.current) artworkInputRef.current.value = ''; }
  function addCollaborator() {
    if (!newCollab.name.trim()) return;
    setForm(f => ({ ...f, collaborators: [...f.collaborators, { ...newCollab, splitPercent: Number(newCollab.splitPercent) || 0 }] }));
    setNewCollab({ name: '', role: 'Feature', splitPercent: '' });
  }
  function addPrimaryArtist() {
    if (!newPrimaryArtist.trim()) return;
    setForm(f => ({ ...f, primaryArtists: [...(f.primaryArtists || []), newPrimaryArtist.trim()] }));
    setNewPrimaryArtist('');
  }
  function removePrimaryArtist(idx) { setForm(f => ({ ...f, primaryArtists: f.primaryArtists.filter((_, i) => i !== idx) })); }
  function removeCollaborator(idx) { setForm(f => ({ ...f, collaborators: f.collaborators.filter((_, i) => i !== idx) })); }
  function toggleChecklistItem(itemId) { setForm(f => ({ ...f, checklist: f.checklist.map(t => t.id === itemId ? { ...t, done: !t.done } : t) })); }
  function addChecklistItem() {
    if (!newChecklistLabel.trim()) return;
    setForm(f => ({ ...f, checklist: [...f.checklist, { id: uid(), label: newChecklistLabel.trim(), done: false }] }));
    setNewChecklistLabel('');
  }
  function removeChecklistItem(itemId) { setForm(f => ({ ...f, checklist: f.checklist.filter(t => t.id !== itemId) })); }
  function toggleDistDoc(docId) { setForm(f => ({ ...f, distributionDocs: f.distributionDocs.map(d => d.id === docId ? { ...d, attached: !d.attached } : d) })); }
  function setDistDocNote(docId, note) { setForm(f => ({ ...f, distributionDocs: f.distributionDocs.map(d => d.id === docId ? { ...d, note } : d) })); }
  function openDriveFolder() {
    const artist = roster.find(a => a.id === form.artistId);
    if (artist && artist.driveFolder) window.open(artist.driveFolder, '_blank', 'noopener,noreferrer');
  }
  function generateMetadataSheet() {
    const artist = roster.find(a => a.id === form.artistId);
    const allPrimary = [artist ? artist.name : '', ...(form.primaryArtists || [])].filter(Boolean).join(' & ');
    const performedBy = form.credits.performedBy || allPrimary + ((form.collaborators || []).length ? ' feat. ' + form.collaborators.map(c => c.name).join(', ') : '');
    const rows = [[
      form.genre || (artist ? artist.genre || '' : ''),
      form.label || '',
      form.explicit === 'Not Set' ? '' : form.explicit,
      form.dolbyAtmos ? 'Yes' : 'No',
      form.lyrics || '',
      form.title,
      performedBy,
      form.credits.writtenBy || '',
      form.credits.producedBy || (form.collaborators || []).filter(c => c.role === 'Producer').map(c => c.name).join(', '),
      form.credits.recordingEngineer || '',
      form.credits.mixingEngineer || '',
      form.credits.masteringEngineer || '',
      form.credits.dolbyEngineer || '',
      artist ? artist.productManager || '' : '',
      form.duration || '',
      form.upc || '',
      form.isrc || '',
    ]];
    const headers = ['Genre', 'Label', 'Explicit/Clean', 'Dolby', 'Lyrics', 'Song Title', 'Performed by', 'Written by', 'Produced By', 'Recording Engineer', 'Mixing Engineer', 'Mastering Engineer', 'Dolby Engineer', 'Product Manager', 'Duration', 'UPC', 'ISRC'];
    exportRowsToExcel((form.title || 'release').replace(/\s+/g, '-').toLowerCase() + '-metadata', headers, rows);
  }
  function sendPackageToDistributor() {
    if (!distributorEmail.trim()) return;
    const artist = roster.find(a => a.id === form.artistId);
    const missing = missingRequiredDocs(form.distributionDocs);
    const subject = encodeURIComponent((artist ? artist.name + ' — ' : '') + form.title + ' — Distribution Package');
    const bodyLines = [
      'Release: ' + form.title,
      'Artist: ' + (artist ? artist.name : ''),
      'Type: ' + form.type,
      'Release date: ' + (form.releaseDate || 'TBD'),
      form.isrc ? 'ISRC: ' + form.isrc : null,
      form.upc ? 'UPC: ' + form.upc : null,
      '',
      artist && artist.driveFolder ? 'Files and documents: ' + artist.driveFolder : 'Files and documents: (no Drive/Dropbox folder on file for this artist yet)',
      '',
      missing > 0 ? missing + ' required document(s) still outstanding — see checklist.' : 'All required documents attached.',
    ].filter(Boolean);
    const body = encodeURIComponent(bodyLines.join('\n'));
    window.open('mailto:' + distributorEmail.trim() + '?subject=' + subject + '&body=' + body, '_blank');
  }
  // The PM confirms the release details for the artist's label rep: the rep sees
  // it (and gets an email). Saving again after edits re-sends it as Updated.
  function confirmForRep() {
    if (!form.title.trim()) return;
    const at = new Date().toISOString();
    update(catalog.map(r => r.id === editing ? { ...form, id: editing, repConfirmedAt: at, repFirstConfirmedAt: form.repFirstConfirmedAt || at, repConfirmedBy: sessionName, repSeenAt: null, repSeenBy: null, repSentOutAt: null, repSentOutBy: null, repSentOutNote: null } : r));
    closeForm();
  }
  function save(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    if (editing) update(catalog.map(r => r.id === editing ? { ...form, id: editing } : r));
    else update([...catalog, { ...form, id: uid() }]);
    if (fromSubmissionId && updateReleaseSubmissions) {
      updateReleaseSubmissions(releaseSubmissions.map(x => x.id === fromSubmissionId ? { ...x, status: 'Approved', reviewedBy: sessionName, reviewedAt: new Date().toISOString() } : x));
    }
    setFromSubmissionId(null);
    closeForm();
  }
  function remove(id) { update(catalog.filter(r => r.id !== id)); setConfirmId(null); }
  function handleArtworkUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    resizeImageFile(file, 400, dataUrl => setForm(f => ({ ...f, artworkUrl: dataUrl })));
  }
  function moveStatus(release, newStatus) { update(catalog.map(c => c.id === release.id ? { ...c, status: newStatus } : c)); }

  const marketsInUse = Array.from(new Set(visibleCatalog.flatMap(c => [c.primaryMarket, c.secondaryMarket]).filter(Boolean))).sort();

  const filtered = visibleCatalog.filter(c => {
    if (filterArtist !== 'all' && c.artistId !== filterArtist) return false;
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (filterMarket !== 'all' && c.primaryMarket !== filterMarket && c.secondaryMarket !== filterMarket) return false;
    if (filterLicense !== 'all') {
      const lic = c.license;
      if (filterLicense === 'none' && lic) return false;
      if (filterLicense !== 'none' && (!lic || lic.label !== filterLicense)) return false;
    }
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.title.toLowerCase().includes(q) ||
      (c.isrc && c.isrc.toLowerCase().includes(q)) ||
      (c.upc && c.upc.toLowerCase().includes(q))
    );
  });
  const sorted = [...filtered].sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || ''));
  const filtersActive = filterArtist !== 'all' || filterStatus !== 'all' || filterLicense !== 'all' || filterMarket !== 'all' || !!search;

  return (
    <div>
      <SectionHeader title="Catalog" description="Every release across the roster — singles, EPs, and albums." action={canEdit && <Btn variant="primary" onClick={openAdd}><Plus size={14} /> Add release</Btn>} />

      {canEdit && visibleSubmissions.length > 0 && onOpenSubmissions && (
        <button onClick={onOpenSubmissions} className="w-full text-left rounded border px-4 py-3 mb-6 text-sm" style={{ background: C.amberSoft, borderColor: C.amber, color: C.text }}>
          <span style={{ color: C.amber, fontWeight: 600 }}>{visibleSubmissions.length} release submission{visibleSubmissions.length === 1 ? '' : 's'} waiting for review</span> · open Submissions
        </button>
      )}

      <div className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
        <div className="imss-form-grid gap-3">
          <Field label="Artist">
            <Select value={filterArtist} onChange={e => setFilterArtist(e.target.value)}>
              <option value="all">All artists</option>
              {visibleRoster.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All statuses</option>
              {RELEASE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="License">
            <Select value={filterLicense} onChange={e => setFilterLicense(e.target.value)}>
              <option value="all">All licenses</option>
              <option value="Active">Active</option>
              <option value="Expiring soon">Expiring soon</option>
              <option value="Held until recouped">Held until recouped</option>
              <option value="Ended: confirm return">Ended: confirm return</option>
              <option value="Past license period: Legal to decide">Past license period</option>
              <option value="Terminated: Legal to decide">Terminated</option>
              <option value="Rights returned">Rights returned</option>
              <option value="License details missing">License details missing</option>
              <option value="Release date missing">Release date missing</option>
              <option value="Contract type missing">Contract type missing</option>
            </Select>
          </Field>
          <Field label="Market">
            <Select value={filterMarket} onChange={e => setFilterMarket(e.target.value)}>
              <option value="all">All markets</option>
              {marketsInUse.map(m => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Search" full><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Title, ISRC, or UPC" /></Field>
        </div>
        {filtersActive && <div className="text-xs mt-3" style={{ color: C.textFaint }}>Showing {filtered.length} of {visibleCatalog.length} releases</div>}
      </div>

      {pmScope && (
        <div className="rounded px-3 py-2 text-xs mb-6" style={{ background: C.amberSoft, color: C.amber, border: '1px solid ' + C.amber }}>
          Showing only releases for artists assigned to you as Product Manager ({visibleCatalog.length} of {catalog.length} total).
        </div>
      )}

      {showForm && (
        <form onSubmit={save} className="rounded border p-4 mb-6 imss-form-grid gap-3" style={{ background: C.panel, borderColor: C.borderLight }}>
          <div className="imss-span-2 flex items-center gap-3">
            <ArtworkThumb release={form} size={64} radius={8} />
            <div className="flex flex-col gap-1">
              <input ref={artworkInputRef} type="file" accept="image/*" onChange={handleArtworkUpload} className="text-xs" style={{ color: C.textDim, maxWidth: 220 }} />
              {form.artworkUrl && <button type="button" onClick={() => setForm({ ...form, artworkUrl: '' })} className="text-xs text-left" style={{ color: C.textFaint }}>Remove artwork</button>}
            </div>
          </div>
          <Field label="Product name"><Input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Artist">
            <Select value={form.artistId} onChange={e => setForm({ ...form, artistId: e.target.value })}>
              {visibleRoster.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
          <Field label="Additional primary artists" full>
            <div className="flex items-center gap-1.5 flex-wrap mb-2">
              {(form.primaryArtists || []).map((name, i) => (
                <Badge key={i}>{name} <button type="button" onClick={() => removePrimaryArtist(i)} style={{ marginLeft: 4, color: C.textFaint }}>×</button></Badge>
              ))}
              {(!form.primaryArtists || form.primaryArtists.length === 0) && <span className="text-xs" style={{ color: C.textFaint }}>Just {visibleRoster.find(a => a.id === form.artistId) ? visibleRoster.find(a => a.id === form.artistId).name : 'the selected artist'} — add others for a joint release (e.g. "Artist A &amp; Artist B")</span>}
            </div>
            <div className="flex gap-2">
              <Input value={newPrimaryArtist} onChange={e => setNewPrimaryArtist(e.target.value)} placeholder="Name of co-primary artist" style={{ flex: 1 }} list="primary-artist-suggestions" />
              <datalist id="primary-artist-suggestions">
                {roster.map(a => <option key={a.id} value={a.name} />)}
              </datalist>
              <Btn variant="ghost" type="button" onClick={addPrimaryArtist}>Add</Btn>
            </div>
          </Field>
          <Field label="Type">
            <Select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              {RELEASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Genre"><Input value={form.genre} onChange={e => setForm({ ...form, genre: e.target.value })} placeholder={(roster.find(a => a.id === form.artistId) || {}).genre || 'e.g. Alt-Pop'} /></Field>
          <Field label="Release date">
            <Input type="date" value={form.releaseDate} onChange={e => setForm({ ...form, releaseDate: e.target.value })} />
            <DateClash catalog={catalog} date={form.releaseDate} exceptId={editing} artistMap={artistMap} />
          </Field>
          <Field label="ISRC (recording code)"><Input value={form.isrc} onChange={e => setForm({ ...form, isrc: e.target.value })} placeholder="US-XXX-YY-NNNNN" /></Field>
          <Field label="UPC (release code)"><Input value={form.upc} onChange={e => setForm({ ...form, upc: e.target.value })} placeholder="e.g. 198004512367" /></Field>
          <Field label="Entered by"><Input value={form.enteredBy} onChange={e => setForm({ ...form, enteredBy: e.target.value })} placeholder="Your name" /></Field>
          <Field label="License (set by Legal or Admin on the artist’s page)"><Input value={form.availableFrom && form.licenseYears ? form.licenseYears + ' yr from ' + form.availableFrom : 'Not set yet'} disabled /></Field>
          <Field label="Primary market">
            <Select value={form.primaryMarket} onChange={e => setForm({ ...form, primaryMarket: e.target.value })}>
              <option value="">— none —</option>
              {MARKETS.map(m => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Secondary market">
            <Select value={form.secondaryMarket} onChange={e => setForm({ ...form, secondaryMarket: e.target.value })}>
              <option value="">— none —</option>
              {MARKETS.filter(m => m !== form.primaryMarket).map(m => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Video">
            <label className="flex items-center gap-2 text-sm" style={{ color: C.text, paddingTop: 7 }}>
              <input type="checkbox" checked={form.hasVideo} onChange={e => setForm({ ...form, hasVideo: e.target.checked })} />
              Has a music video
            </label>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              {RELEASE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <div className="imss-span-2">
            <div className="text-xs mb-2" style={{ color: C.textFaint }}>Collaborators &amp; splits — {roster.find(a => a.id === form.artistId) ? roster.find(a => a.id === form.artistId).name : 'Primary artist'} keeps the remainder ({Math.max(0, 100 - form.collaborators.reduce((s, c) => s + c.splitPercent, 0))}%)</div>
            {form.splitSheet && <div className="text-xs mb-2"><DocLink value={form.splitSheet} name={form.splitSheetName || 'split-sheet'}>Download signed split sheet{form.splitSheetName ? ' (' + form.splitSheetName + ')' : ''}</DocLink></div>}
            <div className="rounded border p-3 mb-1" style={{ borderColor: C.border, background: C.bg }}>
              {form.collaborators.length > 0 && (
                <div className="flex flex-col gap-2 mb-3">
                  {form.collaborators.map((c, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-sm">
                      <span>{c.name} <span style={{ color: C.textFaint }}>· {c.role} · {c.splitPercent}%</span></span>
                      <button aria-label="Delete" title="Delete" type="button" onClick={() => removeCollaborator(i)} style={{ color: C.textFaint }}><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                <Input value={newCollab.name} onChange={e => setNewCollab({ ...newCollab, name: e.target.value })} placeholder="Name" style={{ flex: 2, minWidth: 120 }} />
                <Select value={newCollab.role} onChange={e => setNewCollab({ ...newCollab, role: e.target.value })} style={{ flex: 1, minWidth: 110 }}>
                  {COLLABORATOR_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </Select>
                <Input type="number" min="0" max="100" value={newCollab.splitPercent} onChange={e => setNewCollab({ ...newCollab, splitPercent: e.target.value })} placeholder="Split %" style={{ flex: 1, minWidth: 90 }} />
                <Btn variant="ghost" type="button" onClick={addCollaborator}>Add</Btn>
              </div>
            </div>
          </div>

          <div className="imss-span-2">
            <div className="text-xs mb-2" style={{ color: C.textFaint }}>Credits &amp; metadata sheet fields</div>
            <div className="rounded border p-3 mb-1 imss-form-grid gap-3" style={{ borderColor: C.border, background: C.bg }}>
              <Field label="Label / imprint"><Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="e.g. IMSS Records" /></Field>
              <Field label="Duration"><Input value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} placeholder="mm:ss" /></Field>
              <Field label="Explicit / Clean">
                <Select value={form.explicit} onChange={e => setForm({ ...form, explicit: e.target.value })}>
                  {EXPLICIT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </Select>
              </Field>
              <Field label="Dolby Atmos">
                <label className="flex items-center gap-2 text-sm" style={{ paddingTop: 8 }}>
                  <input type="checkbox" checked={form.dolbyAtmos} onChange={e => setForm({ ...form, dolbyAtmos: e.target.checked })} /> Dolby Atmos mix available
                </label>
              </Field>
              <Field label="Performed by" full><PeopleInput label="Performed by" value={form.credits.performedBy} onChange={v => setForm(f => ({ ...f, credits: { ...f.credits, performedBy: v } }))} placeholder="Artist name, then Enter" /></Field>
              <Field label="Written by"><PeopleInput label="Written by" value={form.credits.writtenBy} onChange={v => setForm(f => ({ ...f, credits: { ...f.credits, writtenBy: v } }))} placeholder="Type a name, then Enter" /></Field>
              <Field label="Produced by"><PeopleInput label="Produced by" value={form.credits.producedBy} onChange={v => setForm(f => ({ ...f, credits: { ...f.credits, producedBy: v } }))} placeholder="Type a name, then Enter" /></Field>
              <Field label="Recording engineer"><PeopleInput label="Recording engineer" value={form.credits.recordingEngineer} onChange={v => setForm(f => ({ ...f, credits: { ...f.credits, recordingEngineer: v } }))} placeholder="Type a name, then Enter" /></Field>
              <Field label="Mixing engineer"><PeopleInput label="Mixing engineer" value={form.credits.mixingEngineer} onChange={v => setForm(f => ({ ...f, credits: { ...f.credits, mixingEngineer: v } }))} placeholder="Type a name, then Enter" /></Field>
              <Field label="Mastering engineer"><PeopleInput label="Mastering engineer" value={form.credits.masteringEngineer} onChange={v => setForm(f => ({ ...f, credits: { ...f.credits, masteringEngineer: v } }))} placeholder="Type a name, then Enter" /></Field>
              <Field label="Dolby engineer"><PeopleInput label="Dolby engineer" value={form.credits.dolbyEngineer} onChange={v => setForm(f => ({ ...f, credits: { ...f.credits, dolbyEngineer: v } }))} placeholder="Type a name, then Enter" /></Field>
              <Field label="Lyrics" full><TextArea rows={3} value={form.lyrics} onChange={e => setForm({ ...form, lyrics: e.target.value })} placeholder="Paste lyrics, or note where they're stored" /></Field>
            </div>
          </div>

          <div className="imss-span-2">
            <div className="text-xs mb-2" style={{ color: C.textFaint }}>Production checklist — {checklistProgress(form.checklist).done}/{checklistProgress(form.checklist).total} complete</div>
            <div className="rounded border p-3 mb-1" style={{ borderColor: C.border, background: C.bg }}>
              <div className="flex flex-col gap-2 mb-3">
                {form.checklist.map(t => (
                  <div key={t.id} className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-sm" style={{ color: t.done ? C.textFaint : C.text, textDecoration: t.done ? 'line-through' : 'none' }}>
                      <input type="checkbox" checked={t.done} onChange={() => toggleChecklistItem(t.id)} />
                      {t.label}
                    </label>
                    <button aria-label="Delete" title="Delete" type="button" onClick={() => removeChecklistItem(t.id)} style={{ color: C.textFaint }}><Trash2 size={12} /></button>
                  </div>
                ))}
                {form.checklist.length === 0 && <div className="text-xs" style={{ color: C.textFaint }}>No tasks yet.</div>}
              </div>
              <div className="flex gap-2">
                <Input value={newChecklistLabel} onChange={e => setNewChecklistLabel(e.target.value)} placeholder="Add a custom task" />
                <Btn variant="ghost" type="button" onClick={addChecklistItem}>Add</Btn>
              </div>
            </div>
          </div>

          <div className="imss-span-2">
            <div className="text-xs mb-2" style={{ color: C.textFaint }}>
              Distribution package{missingRequiredDocs(form.distributionDocs) > 0 && <span style={{ color: C.red }}> — {missingRequiredDocs(form.distributionDocs)} required document{missingRequiredDocs(form.distributionDocs) === 1 ? '' : 's'} missing</span>}
            </div>
            <div className="rounded border p-3 mb-3" style={{ borderColor: C.border, background: C.bg }}>
              <div className="flex flex-col gap-2">
                {form.distributionDocs.map(d => (
                  <div key={d.id} className="flex items-center gap-2 flex-wrap">
                    <label className="flex items-center gap-2 text-sm" style={{ minWidth: 160, color: d.attached ? C.textFaint : C.text, textDecoration: d.attached ? 'line-through' : 'none' }}>
                      <input type="checkbox" checked={d.attached} onChange={() => toggleDistDoc(d.id)} />
                      {d.label}
                    </label>
                    {!d.attached && (d.required ? <Badge tone="red">Missing</Badge> : <Badge>Optional</Badge>)}
                    <Input value={d.note} onChange={e => setDistDocNote(d.id, e.target.value)} placeholder="Note (e.g. uploaded to Drive 9/6)" style={{ flex: 1, minWidth: 160 }} />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded border p-3 mb-1" style={{ borderColor: C.border, background: C.bg }}>
              <div className="flex flex-wrap gap-2 mb-3">
                <Btn variant="ghost" type="button" onClick={openDriveFolder} disabled={!roster.find(a => a.id === form.artistId) || !roster.find(a => a.id === form.artistId).driveFolder}>Open Drive folder</Btn>
                <Btn variant="ghost" type="button" onClick={generateMetadataSheet}><FileSpreadsheet size={14} /> Generate metadata sheet</Btn>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Input type="email" value={distributorEmail} onChange={e => setDistributorEmail(e.target.value)} placeholder="distributor@label.com" style={{ flex: 1, minWidth: 200 }} />
                <Btn variant="primary" type="button" onClick={sendPackageToDistributor}>Send package</Btn>
              </div>
              <div className="text-xs mt-2" style={{ color: C.textFaint }}>Opens your email client with the release details and the artist's Drive/Dropbox link pre-filled — attach the actual files there before sending.</div>
            </div>
          </div>

          <div className="imss-span-2 flex gap-2 mt-1">
            <Btn variant="primary" type="submit">{editing ? 'Save changes' : 'Add release'}</Btn>
            <Btn variant="ghost" onClick={closeForm}>Cancel</Btn>
            {editing && canEdit && (roster.find(a => a.id === form.artistId) || {}).labelRep && (
              <span className="inline-flex items-center gap-2 flex-wrap">
                <Btn variant="ghost" onClick={confirmForRep}><Send size={14} /> {form.repConfirmedAt ? 'Save and re-send to label rep' : 'Save and confirm for label rep'}</Btn>
                {form.repConfirmedAt && <span className="text-xs" style={{ color: C.textDim }}>Confirmed {String(form.repConfirmedAt).slice(0, 10)}{form.repConfirmedBy ? ' by ' + form.repConfirmedBy : ''}</span>}
                {form.repConfirmedAt && <span className="text-xs" style={{ color: form.repSentOutAt ? C.teal : C.textDim }}>{form.repSentOutAt ? 'Label rep sent it out ' + String(form.repSentOutAt).slice(0, 10) + (form.repSentOutNote ? ' (' + form.repSentOutNote + ')' : '') : form.repSeenAt ? 'Label rep has seen it (' + String(form.repSeenAt).slice(0, 10) + '), not sent out yet' : 'Label rep hasn’t seen it yet'}</span>}
              </span>
            )}
          </div>
        </form>
      )}

      {roster.length === 0 && <div className="text-sm mb-4" style={{ color: C.textDim }}>Add an artist to the roster before creating a release.</div>}

      <ExportBar filename="imss-catalog" headers={['Title', 'Artist', 'Type', 'Release Date', 'ISRC', 'UPC', 'Status', 'Primary Market', 'Secondary Market', 'License Expiration', 'Has Video', 'Collaborators', 'Entered By']} rows={sorted.map(r => [
        r.title,
        artistMap[r.artistId] ? artistMap[r.artistId].name : 'Unknown',
        r.type,
        r.releaseDate,
        r.isrc || '',
        r.upc || '',
        r.status,
        r.primaryMarket || '',
        r.secondaryMarket || '',
        r.licenseExpiration || '',
        r.hasVideo ? 'Yes' : 'No',
        (r.collaborators || []).map(c => c.name + ' (' + c.role + ', ' + c.splitPercent + '%)').join('; '),
        r.enteredBy || '',
      ])} />

      <div className="flex justify-end gap-1 mb-4">
        <SegmentedToggle options={[{ id: 'grid', label: 'Grid' }, { id: 'table', label: 'Table' }, { id: 'pipeline', label: 'Pipeline' }]} value={view} onChange={setView} />
      </div>

      {view === 'pipeline' && (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, minmax(220px, 1fr))', overflowX: 'auto' }}>
          {RELEASE_STATUSES.map(status => {
            const inStage = sorted.filter(r => r.status === status);
            return (
              <div key={status} className="rounded border p-3" style={{ background: C.panel, borderColor: C.border, minWidth: 220 }}>
                <div className="flex items-center justify-between mb-3">
                  <div style={{ color: C.textDim, fontWeight: 600, fontSize: 13 }}>{status}</div>
                  <Badge>{inStage.length}</Badge>
                </div>
                <div className="flex flex-col gap-2">
                  {inStage.length === 0 ? (
                    <div className="text-xs" style={{ color: C.textFaint }}>Nothing here</div>
                  ) : inStage.map(r => {
                    const prog = checklistProgress(r.checklist);
                    const artist = artistMap[r.artistId];
                    const nextIdx = RELEASE_STATUSES.indexOf(status) + 1;
                    const nextStatus = RELEASE_STATUSES[nextIdx];
                    return (
                      <div key={r.id} className="rounded border p-2" style={{ background: C.bg, borderColor: C.border }}>
                        <div className="flex items-center gap-2">
                          <ArtworkThumb release={r} size={28} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                            <div className="text-xs" style={{ color: C.textFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artist ? artist.name : 'Unknown'}</div>
                          </div>
                        </div>
                        {prog.total > 0 && (
                          <div className="mt-2">
                            <div className="rounded-full overflow-hidden" style={{ height: 3, background: C.panel2 }}>
                              <div style={{ height: 3, width: prog.pct + '%', background: C.amber }} />
                            </div>
                          </div>
                        )}
                        {missingRequiredDocs(r.distributionDocs) > 0 && (
                          <div className="text-xs mt-1.5" style={{ color: C.red }}>{missingRequiredDocs(r.distributionDocs)} doc{missingRequiredDocs(r.distributionDocs) === 1 ? '' : 's'} missing</div>
                        )}
                        {canEdit && nextStatus && (
                          <button onClick={() => {
                            const missing = missingRequiredDocs(r.distributionDocs);
                            if (missing > 0 && (nextStatus === 'Upcoming' || nextStatus === 'Released') && !window.confirm(r.title + ' still has ' + missing + ' required distribution document(s) missing. Move to ' + nextStatus + ' anyway?')) return;
                            moveStatus(r, nextStatus);
                          }} className="text-xs mt-2 inline-flex items-center gap-1" style={{ color: C.amber }}>
                            Move to {nextStatus} <ChevronRight size={11} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view !== 'pipeline' && (sorted.length === 0 ? (
        <EmptyState icon={Disc3} title={filtersActive ? 'No matching releases' : 'No releases yet'} description={filtersActive ? 'Try a different filter or search term.' : 'Add a single, EP, or album to start building the catalog.'} />
      ) : view === 'grid' ? (
        <div className="grid gap-4 imss-card-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
          {sorted.map(r => {
            const lic = r.licenseExpiration ? r.license : null;
            const prog = checklistProgress(r.checklist);
            return (
              <div key={r.id} data-focus={r.id} onClick={() => canEdit && openEdit(r)} className="text-left rounded border overflow-hidden" style={{ background: C.panel, borderColor: C.border, cursor: canEdit ? 'pointer' : 'default' }}>
                <div style={{ width: '100%', aspectRatio: '1 / 1', position: 'relative' }}>
                  <ArtworkThumb release={r} size="100%" radius={0} />
                  {canEdit && (
                    // Cover art straight from the card: pick an image, it's resized and saved.
                    <label onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1" style={{ position: 'absolute', right: 8, bottom: 8, background: 'rgba(0,0,0,0.55)', color: '#fff', borderRadius: 980, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
                      <ImagePlus size={13} aria-hidden="true" /> {r.artworkUrl ? 'Change' : 'Add cover art'}
                      <input type="file" accept="image/*" aria-label={(r.artworkUrl ? 'Change' : 'Add') + ' cover art for ' + r.title} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
                        onChange={e => { const f = e.target.files && e.target.files[0]; if (f) resizeImageFile(f, 600, url => update(catalog.map(c => c.id === r.id ? { ...c, artworkUrl: url } : c))); e.target.value = ''; }} />
                    </label>
                  )}
                  {r.status !== 'Released' && prog.total > 0 && (
                    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 3, background: 'var(--fill)' }}>
                      <div style={{ height: 3, width: prog.pct + '%', background: C.amber }} />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="text-xs" style={{ color: C.textFaint }}>{formatDate(r.releaseDate)}</div>
                  <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3, marginTop: 2 }}>{canEdit ? <button onClick={e => { e.stopPropagation(); openEdit(r); }} style={{ font: 'inherit', textAlign: 'left' }}>{r.title}</button> : r.title}</div>
                  <div style={{ fontStyle: 'italic', fontSize: 13, color: C.textDim, marginTop: 1 }}>
                    {[artistMap[r.artistId] ? artistMap[r.artistId].name : 'Unknown', ...(r.primaryArtists || [])].join(' & ')}
                    {r.collaborators && r.collaborators.length > 0 && ' feat. ' + r.collaborators.map(c => c.name).join(', ')}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <Badge tone={releaseStatusTone(r.status)}>{r.status}</Badge>
                    <Badge>{r.type}</Badge>
                    {r.hasVideo && <Badge><Video size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />Video</Badge>}
                    {lic && lic.label !== 'Active' && <Badge tone={lic.tone}>License {lic.label.toLowerCase()}</Badge>}
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
                  {r.status !== 'Released' && missingRequiredDocs(r.distributionDocs) > 0 && (
                    <div className="text-xs mt-1.5" style={{ color: C.red }}>{missingRequiredDocs(r.distributionDocs)} required doc{missingRequiredDocs(r.distributionDocs) === 1 ? '' : 's'} missing</div>
                  )}
                  {r.enteredBy && <div className="text-xs mt-1.5" style={{ color: C.textFaint }}>Entered by {r.enteredBy}</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
          <table className="w-full" style={{ minWidth: 820 }}>
            <thead><tr><Th></Th><Th>Product</Th><Th>Artist</Th><Th>Type</Th><Th>Market</Th><Th>Release date</Th><Th>Codes</Th><Th>Status</Th><Th>License</Th><Th align="right">Actions</Th></tr></thead>
            <tbody>
              {sorted.map(r => (
                <tr key={r.id} data-focus={r.id}>
                  <Td><ArtworkThumb release={r} size={36} /></Td>
                  <Td>{r.title}{r.collaborators && r.collaborators.length > 0 && <div className="text-xs" style={{ color: C.textFaint }}>feat. {r.collaborators.map(c => c.name).join(', ')}</div>}</Td>
                  <Td>{artistMap[r.artistId] ? artistMap[r.artistId].name : 'Unknown'}</Td>
                  <Td>{r.type}{r.hasVideo && <Video size={12} style={{ display: 'inline', marginLeft: 5, verticalAlign: 'middle', color: C.textFaint }} />}</Td>
                  <Td>{r.primaryMarket || '—'}{r.secondaryMarket && <div className="text-xs" style={{ color: C.textFaint }}>+ {r.secondaryMarket}</div>}</Td>
                  <Td mono>{formatDate(r.releaseDate)}</Td>
                  <Td mono>
                    {!r.isrc && !r.upc ? '—' : (
                      <div style={{ lineHeight: 1.5 }}>
                        {r.isrc && <div>{r.isrc}</div>}
                        {r.upc && <div style={{ color: C.textFaint }}>{r.upc}</div>}
                      </div>
                    )}
                  </Td>
                  <Td><Badge tone={releaseStatusTone(r.status)}>{r.status}</Badge></Td>
                  <Td>
                    {!r.licenseExpiration ? <span style={{ color: C.textFaint }}>—</span> : (
                      <div style={{ lineHeight: 1.5 }}>
                        <div style={{ fontFamily: MONO_FONT, fontSize: 12 }}>{formatDate(r.licenseExpiration)}</div>
                        <Badge tone={r.license.tone}>{r.license.label}</Badge>
                      </div>
                    )}
                  </Td>
                  <Td align="right">
                    {confirmId === r.id ? <ConfirmInline onConfirm={() => remove(r.id)} onCancel={() => setConfirmId(null)} /> : canEdit ? (
                      <span className="inline-flex gap-3 justify-end">
                        <button aria-label="Edit" title="Edit" onClick={() => openEdit(r)} style={{ color: C.textDim }}><Pencil size={14} /></button>
                        <button aria-label="Delete" title="Delete" onClick={() => setConfirmId(r.id)} style={{ color: C.textDim }}><Trash2 size={14} /></button>
                      </span>
                    ) : <span style={{ color: C.textFaint }}>—</span>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

// Other releases already on a date (the label's whole catalog).
export function releasesOn(catalog, date, exceptId = null) {
  if (!date) return [];
  return catalog.filter(r => r.releaseDate === date && r.id !== exceptId && r.status !== 'Archived');
}

// A heads-up, never a block: the same date can still be chosen.
export function DateClash({ catalog, date, exceptId = null, artistMap = {} }) {
  const others = releasesOn(catalog, date, exceptId);
  if (!others.length) return null;
  const names = others.slice(0, 3).map(r => '“' + r.title + '”' + (artistMap[r.artistId] ? ' by ' + artistMap[r.artistId].name : '')).join(', ');
  return (
    <div role="status" className="text-xs mt-1.5" style={{ color: C.amber, fontWeight: 600 }}>
      Date clash: {others.length === 1 ? 'another release is' : others.length + ' other releases are'} out on this day ({names}{others.length > 3 ? ', …' : ''}). You can still use it.
    </div>
  );
}
