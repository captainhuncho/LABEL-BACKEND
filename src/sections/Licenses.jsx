// Contract and song licenses on an artist's page. Every change is a Deal change:
// Legal or Admin records it and an Admin approves it (an Admin's own entry
// applies at once). Exceptions: Admin confirms recoupment; Legal or Admin
// decides when rights return. See src/licenses.js for the rules.
import { useState } from 'react';
import { CheckCircle2, Plus } from 'lucide-react';
import { formatDate, todayStr } from '../constants.js';
import { CONTRACT_TYPES, balanceAt, licenseFor, quarterEndOf } from '../licenses.js';
import { C, MONO_FONT } from '../theme.js';
import { Badge, Btn, Field, Input, Select, Td, Th } from '../ui.jsx';

export const LICENSE_YEARS = Array.from({ length: 15 }, (_, i) => i + 1);
const money = n => '$' + (Math.round(n * 100) / 100).toFixed(2);
const d = s => s ? formatDate(s) : '—';

// How a license-related deal change reads in lists and the audit log.
export function describeLicenseChange(c, catalog = []) {
  const title = id => (catalog.find(s => s.id === id) || {}).title || 'a song';
  const p = c.patch || {};
  if (c.kind === 'contract') return 'Contract: ' + (CONTRACT_TYPES[p.contractType] || 'not set') + ' · ' + p.licenseYears + ' yr license' + (p.effectiveDate ? ' · effective ' + p.effectiveDate : '') + ' · ' + p.reportingPeriod + ' reporting, $' + p.payoutThreshold + ' threshold' + (p.noExtension ? ' · no unrecouped extension' : '');
  if (c.kind === 'songLicense') return 'License details: ' + (c.songs || []).map(s => title(s.releaseId) + ' (' + s.licenseYears + ' yr from ' + s.availableFrom + ')').join(', ');
  if (c.kind === 'termination') return 'Termination notice ' + c.noticeDate + ': ' + (c.releaseId ? title(c.releaseId) : 'whole agreement');
  if (c.kind === 'recouped') return 'Account recouped in the quarter ending ' + c.quarterEnd;
  if (c.kind === 'rightsReturned') return 'Rights returned on ' + c.date + ': ' + (c.releaseIds || []).map(title).join(', ');
  return '';
}

// Applies an approved license change. Returns the next roster, catalog and tasks.
export function applyLicenseChange(c, { roster, catalog, tasks }) {
  const a = roster.find(x => x.id === c.artistId);
  const setArtist = patch => roster.map(x => x.id === c.artistId ? { ...x, ...patch } : x);
  if (c.kind === 'contract') return { roster: setArtist(c.patch), catalog, tasks };
  if (c.kind === 'songLicense') {
    const by = Object.fromEntries((c.songs || []).map(s => [s.releaseId, s]));
    return { roster, tasks, catalog: catalog.map(s => by[s.id] ? { ...s, availableFrom: by[s.id].availableFrom, licenseYears: Number(by[s.id].licenseYears) } : s) };
  }
  if (c.kind === 'termination') return { roster: setArtist({ terminations: [...(a.terminations || []), { releaseId: c.releaseId || null, noticeDate: c.noticeDate, changeId: c.id }] }), catalog, tasks };
  if (c.kind === 'recouped') return { roster: setArtist({ recoupConfirmations: [...(a.recoupConfirmations || []), { quarterEnd: c.quarterEnd, by: c.requestedBy, changeId: c.id }] }), catalog, tasks };
  if (c.kind === 'rightsReturned') {
    const ids = c.releaseIds || [];
    const newTasks = ids.map(id => ({ id: c.id + '-' + id, title: 'Transfer or take down “' + ((catalog.find(s => s.id === id) || {}).title || 'song') + '” (rights returned to ' + a.name + ')', assignee: a.productManager || '', dueDate: c.takedownBy || c.date, status: 'Open', notes: 'Rights returned on ' + c.date + ' by ' + c.requestedBy + '.', artistId: a.id, releaseId: id }));
    return { roster: setArtist({ rightsReturned: [...(a.rightsReturned || []), ...ids.map(id => ({ releaseId: id, date: c.date, by: c.requestedBy, changeId: c.id }))] }), catalog, tasks: [...newTasks, ...tasks] };
  }
  return { roster, catalog, tasks };
}

export function ArtistLicenses({ artist, catalog = [], ctx, session = {}, canEdit = true, onRecord }) {
  const isAdmin = session.role === 'Admin';
  const canRecord = canEdit && (isAdmin || session.role === 'Legal');
  const [form, setForm] = useState(null); // { kind, ... }
  const [error, setError] = useState('');
  const songs = catalog.filter(s => s.artistId === artist.id);
  const today = todayStr();
  const rows = songs.map(s => ({ s, l: licenseFor(s, artist, ctx, today) }));
  const balance = balanceAt(artist, today, ctx);

  function open(kind) {
    setError('');
    if (kind === 'contract') setForm({ kind, contractType: artist.contractType || '', licenseYears: String(artist.licenseYears || ''), effectiveDate: artist.effectiveDate || '', noExtension: !!artist.noExtension, reportingPeriod: artist.reportingPeriod || 'quarterly', payoutThreshold: String(artist.payoutThreshold ?? '') });
    if (kind === 'songLicense') setForm({ kind, songs: rows.filter(r => r.l.missing && r.l.missing.length && r.l.type === '2026').map(r => ({ releaseId: r.s.id, title: r.s.title, availableFrom: r.s.availableFrom || r.s.releaseDate || '', licenseYears: String(r.s.licenseYears || artist.licenseYears || '') })) });
    if (kind === 'termination') setForm({ kind, releaseId: '', noticeDate: today });
    if (kind === 'recouped') setForm({ kind, quarterEnd: quarterEndOf(today) });
    if (kind === 'rightsReturned') setForm({ kind, date: today, releaseIds: rows.filter(r => r.l.decide || r.l.status.label === 'Ended: confirm return').map(r => r.s.id) });
  }
  function editSong(r) {
    setError('');
    setForm({ kind: 'songLicense', songs: [{ releaseId: r.s.id, title: r.s.title, availableFrom: r.s.availableFrom || r.s.releaseDate || '', licenseYears: String(r.s.licenseYears || artist.licenseYears || '') }] });
  }
  function submit(e) {
    e.preventDefault();
    const f = form;
    if (f.kind === 'contract') {
      if (!CONTRACT_TYPES[f.contractType]) return setError('Choose the contract type.');
      if (!(Number(f.licenseYears) > 0)) return setError('Enter the agreed license years.');
      if (f.contractType === 'earlier' && !f.effectiveDate) return setError('Enter the contract’s Effective Date.');
      return onRecord({ kind: 'contract', patch: { contractType: f.contractType, licenseYears: Number(f.licenseYears), effectiveDate: f.effectiveDate, noExtension: !!f.noExtension, reportingPeriod: f.reportingPeriod, payoutThreshold: Number(f.payoutThreshold) || 0 } }, done);
    }
    if (f.kind === 'songLicense') {
      if (!f.songs.length) return setError('No songs to update.');
      if (f.songs.some(s => !s.availableFrom || !(Number(s.licenseYears) > 0))) return setError('Every song needs its first-available date and agreed years.');
      return onRecord({ kind: 'songLicense', songs: f.songs.map(s => ({ releaseId: s.releaseId, availableFrom: s.availableFrom, licenseYears: Number(s.licenseYears) })) }, done);
    }
    if (f.kind === 'termination') {
      if (!f.noticeDate) return setError('Enter the date the notice was given.');
      return onRecord({ kind: 'termination', releaseId: f.releaseId || null, noticeDate: f.noticeDate }, done);
    }
    if (f.kind === 'recouped') {
      if (f.quarterEnd !== quarterEndOf(f.quarterEnd)) return setError('Pick a quarter end: 31 Mar, 30 Jun, 30 Sep or 31 Dec.');
      return onRecord({ kind: 'recouped', quarterEnd: f.quarterEnd }, done);
    }
    if (f.kind === 'rightsReturned') {
      if (!f.releaseIds.length) return setError('Tick the songs whose rights return.');
      const takedown = rows.filter(r => f.releaseIds.includes(r.s.id)).map(r => r.l.dates && r.l.dates.takedownBy).filter(Boolean).sort()[0] || '';
      return onRecord({ kind: 'rightsReturned', releaseIds: f.releaseIds, date: f.date, takedownBy: takedown }, done);
    }
  }
  function done(err) { if (err) setError(err); else { setForm(null); setError(''); } }
  const set = patch => setForm(f => ({ ...f, ...patch }));
  const ready = rows.some(r => r.l.heldUntilRecouped) && balance <= 0.005;
  const decisions = rows.filter(r => r.l.decide || r.l.status.label === 'Ended: confirm return').length;
  const missing = rows.filter(r => r.l.missing && r.l.missing.length && r.l.type === '2026').length;

  return (
    <section aria-label="Contract and licenses" className="mb-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <h3 style={{ fontWeight: 600, fontSize: 19 }}>Contract and licenses</h3>
        {canRecord && !form && (
          <div className="flex gap-2 flex-wrap">
            <Btn variant="ghost" onClick={() => open('contract')}>Contract terms</Btn>
            {missing > 0 && <Btn variant="ghost" onClick={() => open('songLicense')}>Set missing song details ({missing})</Btn>}
            {artist.contractType === 'earlier' && <Btn variant="ghost" onClick={() => open('termination')}>Termination notice</Btn>}
            {isAdmin && <Btn variant={ready ? 'primary' : 'ghost'} onClick={() => open('recouped')}>Confirm recouped</Btn>}
            {decisions > 0 && <Btn variant="primary" onClick={() => open('rightsReturned')}>Return rights ({decisions})</Btn>}
          </div>
        )}
      </div>

      <div className="rounded p-4 mb-3 flex gap-x-8 gap-y-2 flex-wrap" style={{ background: C.panel, fontSize: 14 }}>
        <div><div style={{ color: C.textDim, fontSize: 12 }}>Contract</div>{CONTRACT_TYPES[artist.contractType] || <span style={{ color: C.amber }}>Not set</span>}</div>
        <div><div style={{ color: C.textDim, fontSize: 12 }}>License</div>{artist.licenseYears ? artist.licenseYears + ' yr' + (artist.contractType === 'earlier' ? ' from ' + d(artist.effectiveDate) : ' per song (pre-fill)') : '—'}</div>
        <div><div style={{ color: C.textDim, fontSize: 12 }}>Reporting</div>{artist.reportingPeriod || '—'} · ${artist.payoutThreshold || 0} threshold</div>
        <div><div style={{ color: C.textDim, fontSize: 12 }}>Recoupment balance (published)</div><span style={{ fontFamily: MONO_FONT, color: balance > 0.005 ? C.amber : C.teal }}>{balance > 0.005 ? money(balance) + ' unrecouped' : 'Recouped'}</span></div>
        {(artist.recoupConfirmations || []).length > 0 && <div><div style={{ color: C.textDim, fontSize: 12 }}>Confirmed recouped</div>{artist.recoupConfirmations.map(c => d(c.quarterEnd)).join(', ')}</div>}
        {artist.noExtension && <div><Badge>No unrecouped extension</Badge></div>}
      </div>
      {ready && <div className="mb-3" style={{ color: C.amber, fontSize: 14 }}>The published balance is $0 and songs are held until recouped. {isAdmin ? 'Confirm the quarter it recouped in.' : 'An Admin confirms the quarter.'}</div>}

      {form && (
        <form onSubmit={submit} className="rounded p-5 mb-4 imss-form-grid gap-3" style={{ background: C.panel }}>
          {form.kind === 'contract' && <>
            <Field label="Contract type"><Select value={form.contractType} onChange={e => set({ contractType: e.target.value })}><option value="">Choose</option>{Object.entries(CONTRACT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
            <Field label={form.contractType === 'earlier' ? 'License years (from the Effective Date)' : 'License years (pre-fills each new song)'}><Select value={form.licenseYears} onChange={e => set({ licenseYears: e.target.value })}><option value="">Choose</option>{LICENSE_YEARS.map(y => <option key={y} value={y}>{y} {y === 1 ? 'year' : 'years'}</option>)}</Select></Field>
            {form.contractType === 'earlier' && <Field label="Effective Date"><Input type="date" value={form.effectiveDate} onChange={e => set({ effectiveDate: e.target.value })} /></Field>}
            <Field label="Reporting"><Select value={form.reportingPeriod} onChange={e => set({ reportingPeriod: e.target.value })}><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="half-yearly">Half-yearly</option></Select></Field>
            <Field label="Payout threshold (USD)"><Input type="number" min="0" step="0.01" value={form.payoutThreshold} onChange={e => set({ payoutThreshold: e.target.value })} placeholder={form.contractType === 'earlier' ? '300' : '500'} /></Field>
            {form.contractType === '2026' && <label className="imss-span-2 flex items-center gap-2" style={{ fontSize: 14 }}><input type="checkbox" checked={form.noExtension} onChange={e => set({ noExtension: e.target.checked })} /> This contract has no unrecouped extension</label>}
          </>}
          {form.kind === 'songLicense' && (
            <div className="imss-span-2 overflow-x-auto">
              <table className="w-full" style={{ minWidth: 520 }}>
                <thead><tr><Th>Song</Th><Th>First available through IMSS</Th><Th>Agreed years</Th></tr></thead>
                <tbody>{form.songs.map((s, i) => (
                  <tr key={s.releaseId}>
                    <Td>{s.title}</Td>
                    <Td><Input type="date" value={s.availableFrom} onChange={e => set({ songs: form.songs.map((x, j) => j === i ? { ...x, availableFrom: e.target.value } : x) })} aria-label={'First available date for ' + s.title} /></Td>
                    <Td><Select value={s.licenseYears} onChange={e => set({ songs: form.songs.map((x, j) => j === i ? { ...x, licenseYears: e.target.value } : x) })} aria-label={'Agreed years for ' + s.title}><option value="">Choose</option>{LICENSE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}</Select></Td>
                  </tr>
                ))}</tbody>
              </table>
              <div className="mt-2" style={{ color: C.textDim, fontSize: 13 }}>Pre-filled from each song’s release date and the artist’s license years. For back catalogue, use the date IMSS first made it available.</div>
            </div>
          )}
          {form.kind === 'termination' && <>
            <Field label="Applies to"><Select value={form.releaseId} onChange={e => set({ releaseId: e.target.value })}><option value="">Whole agreement</option>{songs.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</Select></Field>
            <Field label="Notice given on"><Input type="date" value={form.noticeDate} onChange={e => set({ noticeDate: e.target.value })} /></Field>
          </>}
          {form.kind === 'recouped' && <Field label="Recouped in the quarter ending"><Input type="date" value={form.quarterEnd} onChange={e => set({ quarterEnd: e.target.value })} /></Field>}
          {form.kind === 'rightsReturned' && <>
            <Field label="Rights return on"><Input type="date" value={form.date} onChange={e => set({ date: e.target.value })} /></Field>
            <div className="imss-span-2 flex flex-col gap-1.5" style={{ fontSize: 14 }}>
              {rows.filter(r => r.l.decide || r.l.status.label === 'Ended: confirm return').map(r => (
                <label key={r.s.id} className="flex items-center gap-2"><input type="checkbox" checked={form.releaseIds.includes(r.s.id)} onChange={e => set({ releaseIds: e.target.checked ? [...form.releaseIds, r.s.id] : form.releaseIds.filter(x => x !== r.s.id) })} /> {r.s.title}</label>
              ))}
              <div style={{ color: C.textDim, fontSize: 13 }}>The artist is emailed, the PM gets a task to transfer or take down each song, and it’s logged.</div>
            </div>
          </>}
          {error && <div className="imss-span-2" role="alert" style={{ color: C.red, fontSize: 14 }}>{error}</div>}
          <div className="imss-span-2 flex gap-2 flex-wrap">
            <Btn variant="primary" type="submit"><CheckCircle2 size={15} /> {form.kind === 'rightsReturned' || form.kind === 'recouped' || isAdmin ? 'Save' : 'Send to an Admin to approve'}</Btn>
            <Btn variant="ghost" onClick={() => { setForm(null); setError(''); }}>Cancel</Btn>
          </div>
        </form>
      )}

      {songs.length > 0 && (
        <div className="rounded overflow-x-auto" style={{ background: C.panel }}>
          <table className="w-full" style={{ minWidth: 760 }}>
            <thead><tr><Th>Song</Th><Th>Licensed from</Th><Th>Years</Th><Th>Ends</Th><Th>Status</Th>{canRecord && <Th />}</tr></thead>
            <tbody>{rows.map(({ s, l }) => (
              <tr key={s.id}>
                <Td>{s.title}</Td>
                <Td mono>{d(l.start)}</Td>
                <Td mono>{l.years || '—'}</Td>
                <Td mono>{d(l.endsOn || l.end)}</Td>
                <Td>
                  <Badge tone={l.status.tone}>{l.status.label}</Badge>
                  {l.missing && l.missing.length > 0 && <div style={{ color: C.textDim, fontSize: 12, marginTop: 4 }}>Needs {l.missing.join(' and ')}</div>}
                  {l.balanceAtEnd > 0.005 && <div style={{ color: C.textDim, fontSize: 12, marginTop: 4 }}>{money(l.balanceAtEnd)} unrecouped on {d(l.end)}</div>}
                  {l.dates && <div style={{ color: C.textDim, fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>Notice {d(l.dates.notice)} · Term ends {d(l.dates.termEnds)}<br />1 yr retention to {d(l.dates.retentionYearEnds)} · wind-down to {d(l.dates.windDownEnds)} · takedown by {d(l.dates.takedownBy)}</div>}
                  {l.decide && !l.dates && <div style={{ color: C.textDim, fontSize: 12, marginTop: 4 }}>License period ended {d(l.end)}. Retention depends on recoupment; Legal or Admin decides.</div>}
                </Td>
                {canRecord && <Td align="right">{artist.contractType === '2026' && l.status.label !== 'Rights returned' && <button onClick={() => editSong({ s })} style={{ color: C.amber, fontSize: 13 }}>Change</button>}</Td>}
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
