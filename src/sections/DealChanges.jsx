// Deal changes: an artist's split (and funding / deal) changing from a month.
// Admin or Legal records one; it applies when an Admin approves (an Admin's own
// entry applies at once). Earlier months always keep the terms they had.
import { useState } from 'react';
import { CheckCircle2, FileText, Plus } from 'lucide-react';
import { dealTermsOf, slug, termsAt } from '../finance.js';
import { DEAL_TYPES, FUNDING_TIERS, dealLabel, formatDate, monthLabel, todayStr, uid } from '../constants.js';
import { C } from '../theme.js';
import { logActivity } from '../audit.js';
import { Badge, Btn, EmptyState, Field, Input, SectionHeader, Select, Td, TextArea, Th } from '../ui.jsx';
import { ArtistLicenses, applyLicenseChange, describeLicenseChange } from './Licenses.jsx';

const pctText = p => Math.round(Number(p) * 10000) / 100 + '%';
const splitText = p => pctText(p) + ' / ' + pctText(1 - Number(p));

export default function DealChanges({ roster, updateRoster, changes = [], updateChanges, publishedRevenue = [], session = {}, artistId = null, canEdit = true, catalog = [], updateCatalog, tasks = [], updateTasks, ledger = [], invoices = [] }) {
  const isAdmin = session.role === 'Admin';
  const canRecord = canEdit && (isAdmin || session.role === 'Legal');
  const empty = { artistId: artistId || '', from: todayStr().slice(0, 7), pct: '', fundingTier: '', dealType: '', reason: '', agreement: '', agreementName: '' };
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [declineNote, setDeclineNote] = useState({});

  const lastPublished = a => publishedRevenue.filter(r => r.artistSlug === slug(a.name)).reduce((m, r) => r.month > m ? r.month : m, '');
  // A change may only start after the artist's published months and not before their latest terms.
  function problem(a, from) {
    if (!a) return 'Choose the artist.';
    if (!/^\d{4}-\d{2}$/.test(from)) return 'Pick the month the new deal starts.';
    const pub = lastPublished(a);
    if (pub && from <= pub) return 'Earnings up to ' + monthLabel(pub) + ' are already published to ' + a.name + '. The new deal must start after that.';
    const latest = dealTermsOf(a).slice(-1)[0];
    if (latest.from && from < latest.from) return a.name + '’s latest deal starts ' + monthLabel(latest.from) + '. A new one can’t start before it.';
    return '';
  }
  function apply(entry) {
    const a = roster.find(x => x.id === entry.artistId);
    const terms = [...dealTermsOf(a).filter(t => t.from !== entry.from), { from: entry.from, artistPct: entry.artistPct, fundingTier: entry.fundingTier, dealType: entry.dealType, changeId: entry.id }];
    const now = termsAt({ ...a, dealTerms: terms }, todayStr().slice(0, 7));
    updateRoster(roster.map(x => x.id !== a.id ? x : { ...x, dealTerms: terms, artistPct: now.artistPct, royaltyRate: Math.round(now.artistPct * 10000) / 100, fundingTier: now.fundingTier, dealType: now.dealType }));
  }
  // License and contract changes (see Licenses.jsx).
  function applyKind(entry) {
    const r = applyLicenseChange(entry, { roster, catalog, tasks });
    if (r.roster !== roster) updateRoster(r.roster);
    if (r.catalog !== catalog && updateCatalog) updateCatalog(r.catalog);
    if (r.tasks !== tasks && updateTasks) updateTasks(r.tasks);
  }
  function recordKind(change, done) {
    const a = roster.find(x => x.id === artistId);
    if (!a) return done('Choose the artist.');
    // Admin and Legal have the final say on contracts and licenses: their entries apply at once.
    const direct = canRecord;
    const stamp = new Date().toISOString();
    const entry = { id: uid(), artistId: a.id, artist: a.name, ...change, requestedBy: session.name, requestedAt: stamp, ...(direct ? { status: 'Approved', approvedBy: session.name, approvedAt: stamp } : { status: 'Pending' }) };
    updateChanges([entry, ...changes]);
    logActivity(direct ? 'recorded and applied a license change' : 'recorded a license change', a.name + ': ' + describeLicenseChange(entry, catalog), a.id);
    if (direct) applyKind(entry);
    done();
  }
  function startRecord() {
    const a = roster.find(x => x.id === artistId);
    setForm({ ...empty, pct: a ? String(Math.round(a.artistPct * 10000) / 100) : '', fundingTier: a ? a.fundingTier || 'Non-Funded' : 'Non-Funded', dealType: a ? a.dealType || '' : '' });
    setError('');
  }
  function onArtist(id) {
    const a = roster.find(x => x.id === id);
    setForm(f => ({ ...f, artistId: id, pct: a ? String(Math.round(a.artistPct * 10000) / 100) : '', fundingTier: a ? a.fundingTier || 'Non-Funded' : 'Non-Funded', dealType: a ? a.dealType || '' : '' }));
  }
  function onFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError('The agreement must be 2 MB or smaller.'); e.target.value = ''; return; }
    const r = new FileReader();
    r.onload = () => setForm(f => ({ ...f, agreement: r.result, agreementName: file.name }));
    r.readAsDataURL(file);
  }
  function submit(e) {
    e.preventDefault();
    const a = roster.find(x => x.id === form.artistId);
    const pct = Number(form.pct);
    const p = problem(a, form.from);
    if (p) { setError(p); return; }
    if (!(pct >= 0 && pct <= 100) || form.pct === '') { setError('Enter the artist’s share as a percentage between 0 and 100.'); return; }
    if (!form.reason.trim()) { setError('Add a note: what changed and why (e.g. upgraded to Recordings+).'); return; }
    const was = termsAt(a, form.from);
    const stamp = new Date().toISOString();
    const entry = {
      id: uid(), artistId: a.id, artist: a.name, from: form.from, artistPct: pct / 100, fundingTier: form.fundingTier, dealType: form.dealType,
      was: { artistPct: was.artistPct, fundingTier: was.fundingTier, dealType: was.dealType },
      reason: form.reason.trim(), agreement: form.agreement || '', agreementName: form.agreementName || '',
      requestedBy: session.name, requestedAt: stamp,
      ...(isAdmin ? { status: 'Approved', approvedBy: session.name, approvedAt: stamp } : { status: 'Pending' }),
    };
    updateChanges([entry, ...changes]);
    logActivity(isAdmin ? 'recorded and approved a deal change' : 'recorded a deal change', a.name + ': ' + pctText(entry.artistPct) + ' from ' + entry.from + ' · ' + dealLabel(entry), a.id);
    if (isAdmin) apply(entry);
    setForm(null); setError('');
  }
  function approve(entry) {
    if (entry.kind) {
      applyKind(entry);
      logActivity('approved a license change', entry.artist + ': ' + describeLicenseChange(entry, catalog), entry.artistId);
      updateChanges(changes.map(c => c.id !== entry.id ? c : { ...c, status: 'Approved', approvedBy: session.name, approvedAt: new Date().toISOString() }));
      setError(''); return;
    }
    const a = roster.find(x => x.id === entry.artistId);
    const p = problem(a, entry.from);
    if (p) { setError(p + ' Decline this change and record it again with a later month.'); return; }
    apply(entry);
    logActivity('approved a deal change', entry.artist + ': ' + pctText(entry.artistPct) + ' from ' + entry.from, entry.artistId);
    updateChanges(changes.map(c => c.id !== entry.id ? c : { ...c, status: 'Approved', approvedBy: session.name, approvedAt: new Date().toISOString() }));
    setError('');
  }
  function decline(entry) {
    const note = (declineNote[entry.id] || '').trim();
    if (!note) { setError('Say why the change is declined.'); return; }
    logActivity('declined a deal change', entry.artist + ': ' + note, entry.artistId);
    updateChanges(changes.map(c => c.id !== entry.id ? c : { ...c, status: 'Declined', approvedBy: session.name, approvedAt: new Date().toISOString(), declineNote: note }));
    setError('');
  }

  const shown = changes.filter(c => !artistId || c.artistId === artistId);
  const artist = artistId ? roster.find(x => x.id === artistId) : null;

  return (
    <div>
      {!artistId && <SectionHeader title="Deal changes" description="When an artist’s split or deal changes, record it here from the month it starts. Earlier months keep the terms they had; nothing already published moves." action={canRecord && !form && <Btn variant="primary" onClick={startRecord}><Plus size={15} /> Record a deal change</Btn>} />}

      {artist && (
        <section aria-label="Deal timeline" className="mb-5">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <h3 style={{ fontWeight: 600, fontSize: 19 }}>Deal</h3>
            {canRecord && !form && <Btn variant="ghost" onClick={startRecord}><Plus size={15} /> Record a deal change</Btn>}
          </div>
          <ol className="imss-steps" aria-label="Deal history">
            {dealTermsOf(artist).map((t, i, list) => (
              <li key={i} className={i === list.length - 1 ? 'is-current' : 'is-done'}>
                <span className="imss-step-dot" aria-hidden="true">{i + 1}</span>
                <span>{t.from ? monthLabel(t.from) : 'Start'} · {splitText(t.artistPct)} · {dealLabel(t)}</span>
              </li>
            ))}
          </ol>
          <div className="mt-2" style={{ color: C.textDim, fontSize: 13 }}>Split shown as artist / label.</div>
        </section>
      )}
      {artist && <ArtistLicenses artist={artist} catalog={catalog} ctx={{ ledger, invoices, publishedRevenue }} session={session} canEdit={canEdit} onRecord={recordKind} />}

      {form && (
        <form onSubmit={submit} className="rounded p-5 mb-6 imss-form-grid gap-3" style={{ background: C.panel }}>
          {!artistId && (
            <Field label="Artist">
              <Select value={form.artistId} onChange={e => onArtist(e.target.value)}>
                <option value="">Choose an artist</option>
                {roster.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
          )}
          <Field label="New deal starts from"><Input type="month" value={form.from} onChange={e => { setForm({ ...form, from: e.target.value }); setError(''); }} /></Field>
          <Field label="Artist share (%)"><Input type="number" min="0" max="100" step="0.01" value={form.pct} onChange={e => setForm({ ...form, pct: e.target.value })} /></Field>
          <Field label="Label share (%)"><Input value={form.pct === '' ? '' : String(Math.round((100 - Number(form.pct)) * 100) / 100)} disabled /></Field>
          <Field label="Funding">
            <Select value={form.fundingTier} onChange={e => setForm({ ...form, fundingTier: e.target.value, dealType: (DEAL_TYPES[e.target.value] || [])[0] || '' })}>
              {FUNDING_TIERS.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Deal">
            <Select value={form.dealType} onChange={e => setForm({ ...form, dealType: e.target.value })}>
              <option value="">Not set</option>
              {(DEAL_TYPES[form.fundingTier] || []).map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Note: what changed and why" full><TextArea rows={2} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Upgraded from Distro+ to Recordings+ after the first album; signed 3 June." /></Field>
          <Field label="Signed agreement (optional, PDF or image, up to 2 MB)" full><input type="file" accept="application/pdf,image/*" onChange={onFile} style={{ color: C.textDim, fontSize: 14 }} /></Field>
          {error && <div className="imss-span-2" role="alert" style={{ color: C.red, fontSize: 14 }}>{error}</div>}
          <div className="imss-span-2 flex gap-2 flex-wrap">
            <Btn variant="primary" type="submit"><CheckCircle2 size={15} /> {isAdmin ? 'Save deal change' : 'Send to an Admin to approve'}</Btn>
            <Btn variant="ghost" onClick={() => { setForm(null); setError(''); }}>Cancel</Btn>
          </div>
        </form>
      )}
      {!form && error && <div className="mb-3" role="alert" style={{ color: C.red, fontSize: 14 }}>{error}</div>}

      {shown.length === 0 ? (
        !artistId && <EmptyState icon={FileText} title="No deal changes yet" description="Record a change when an artist’s split or deal is upgraded. It’s kept here with who recorded and approved it." />
      ) : (
        <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
          <table className="w-full" style={{ minWidth: 820 }}>
            <thead><tr>{!artistId && <Th>Artist</Th>}<Th>From</Th><Th>Split (artist / label)</Th><Th>Deal</Th><Th>Note</Th><Th>Status</Th></tr></thead>
            <tbody>
              {shown.map(c => (
                <tr key={c.id}>
                  {!artistId && <Td>{c.artist}</Td>}
                  <Td mono>{c.kind ? '—' : monthLabel(c.from)}</Td>
                  <Td mono>{c.kind ? '—' : (c.was && c.was.artistPct != null ? splitText(c.was.artistPct) + ' → ' : '') + splitText(c.artistPct)}</Td>
                  <Td>{c.kind ? '—' : (c.was ? dealLabel(c.was) + ' → ' : '') + dealLabel(c)}</Td>
                  <Td>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{c.kind ? describeLicenseChange(c, catalog) : c.reason}</div>
                    {c.agreement && <a href={c.agreement} download={c.agreementName || 'agreement'} style={{ color: C.amber, fontSize: 13 }}>Signed agreement</a>}
                    <div style={{ color: C.textDim, fontSize: 12 }}>Recorded by {c.requestedBy} · {formatDate(String(c.requestedAt).slice(0, 10))}</div>
                  </Td>
                  <Td>
                    <Badge tone={c.status === 'Approved' ? 'teal' : c.status === 'Declined' ? 'red' : 'amber'}>{c.status === 'Pending' ? 'Waiting for Admin' : c.status}</Badge>
                    {c.status === 'Approved' && <div style={{ color: C.textDim, fontSize: 12, marginTop: 4 }}>by {c.approvedBy}</div>}
                    {c.status === 'Declined' && <div style={{ color: C.red, fontSize: 12, marginTop: 4 }}>{c.declineNote}</div>}
                    {c.status === 'Pending' && isAdmin && canEdit && (
                      <div className="flex flex-col gap-2 mt-2" style={{ minWidth: 200 }}>
                        <Btn variant="primary" onClick={() => approve(c)}>Approve</Btn>
                        <Input value={declineNote[c.id] || ''} onChange={e => setDeclineNote(d => ({ ...d, [c.id]: e.target.value }))} placeholder="Reason, if declining" aria-label="Reason for declining" />
                        <Btn variant="danger" onClick={() => decline(c)}>Decline</Btn>
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
