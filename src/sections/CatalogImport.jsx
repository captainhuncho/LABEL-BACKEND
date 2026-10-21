// Catalog import from EMPIRE's catalog export: upload, preview every change,
// then save. Fills empty fields and adds missing tracks; never replaces a value
// (differences are listed instead). Logic in src/catalogImport.js.
import { useState } from 'react';
import Papa from 'papaparse';
import { CheckCircle2, Upload } from 'lucide-react';
import { planCatalogImport, readCatalogRows } from '../catalogImport.js';
import { uid } from '../constants.js';
import { logActivity } from '../audit.js';
import { C, MONO_FONT } from '../theme.js';
import { Btn, DropZone, Td, Th } from '../ui.jsx';

const FIELD_LABELS = { isrc: 'ISRC', upc: 'UPC', releaseDate: 'release date', genre: 'genre', duration: 'duration', explicit: 'explicit', album: 'album/EP', trackNumber: 'track no.', collaborators: 'featured artists' };

export function CatalogImport({ catalog, roster, update, onClose }) {
  const [plan, setPlan] = useState(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const artistName = id => (roster.find(a => a.id === id) || {}).name || '';

  function read(fileList) {
    const file = fileList && fileList[0];
    if (!file) return;
    setError(''); setPlan(null); setDone(null); setFileName(file.name);
    Papa.parse(file, {
      skipEmptyLines: false,
      complete: ({ data }) => {
        const { tracks, error: readError } = readCatalogRows(data);
        if (readError) { setError(readError); return; }
        if (!tracks.length) { setError('No tracks found in this file.'); return; }
        setPlan({ ...planCatalogImport(tracks, catalog, roster, uid), tracks: tracks.length });
      },
      error: err => setError('Couldn’t read the file: ' + err.message),
    });
  }

  async function confirm() {
    setBusy(true); setError('');
    try {
      const ok = await update(plan.next);
      if (ok === false) throw new Error('not saved');
      logActivity('imported the catalog export', fileName + ' · ' + plan.fills.length + ' songs filled in, ' + plan.adds.length + ' added');
      setDone({ fills: plan.fills.length, adds: plan.adds.length });
      setPlan(null);
    } catch (e) {
      setError('Nothing was saved: ' + (e.message || e) + '. Reload and try again.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded border p-5 mb-6" style={{ background: C.panel, borderColor: C.border }} role="status">
        <div className="flex items-center gap-2 mb-2" style={{ fontWeight: 600 }}><CheckCircle2 size={18} color={C.teal} /> Catalog updated</div>
        <p className="text-sm" style={{ color: C.textDim }}>Filled in missing details on {done.fills} song{done.fills === 1 ? '' : 's'} and added {done.adds} new track{done.adds === 1 ? '' : 's'}.</p>
        <div className="mt-4"><Btn variant="ghost" onClick={onClose}>Close</Btn></div>
      </div>
    );
  }

  return (
    <section aria-labelledby="catimp-h" className="rounded border p-5 mb-6" style={{ background: C.panel, borderColor: C.border }}>
      <h3 id="catimp-h" style={{ fontWeight: 600, fontSize: 15 }}>Import catalog export</h3>
      <p className="text-sm mt-1 mb-3" style={{ color: C.textDim, maxWidth: '70ch' }}>
        Upload EMPIRE’s catalog export (CSV). It fills in missing details (ISRC, UPC, release date, genre, featured artists, album or EP, duration) and adds tracks that aren’t in the Catalog yet. Nothing already set is replaced, and you see every change before it’s saved.
      </p>
      <DropZone onFiles={read} accept=".csv,text/csv" className="rounded border p-6 text-center" style={{ borderColor: C.borderLight, borderStyle: 'dashed' }}>
        <Upload size={20} style={{ color: C.textFaint, margin: '0 auto 8px' }} aria-hidden="true" />
        <div className="text-sm mb-3" style={{ fontWeight: 600 }}>Drop the CSV here, or choose the file</div>
        <input type="file" accept=".csv,text/csv" onChange={e => read(e.target.files)} className="text-sm mx-auto block" style={{ color: C.textDim, maxWidth: 280 }} aria-label="Catalog export CSV" />
      </DropZone>
      {error && <div className="text-sm mt-3" role="alert" style={{ color: C.red }}>{error}</div>}

      {plan && (
        <div className="mt-5 flex flex-col gap-4">
          <ul className="imss-checks">
            <li className="is-ok"><CheckCircle2 size={15} aria-hidden="true" /><span><b>{fileName}</b>: {plan.tracks} track{plan.tracks === 1 ? '' : 's'} read · {plan.fills.length} song{plan.fills.length === 1 ? '' : 's'} to fill in · {plan.adds.length} to add · {plan.unchanged} already complete</span></li>
            {plan.clashes.length > 0 && <li className="is-miss"><span className="imss-check-miss" aria-hidden="true" /><span>{plan.clashes.length} difference{plan.clashes.length === 1 ? '' : 's'} between the Catalog and the file, left as they are (listed below).</span></li>}
            {plan.maybe.length > 0 && <li className="is-miss"><span className="imss-check-miss" aria-hidden="true" /><span>{plan.maybe.length} track{plan.maybe.length === 1 ? '' : 's'} look{plan.maybe.length === 1 ? 's' : ''} like a Catalog song with a slightly different title; not added (listed below).</span></li>}
            {plan.unknown.length > 0 && <li className="is-miss"><span className="imss-check-miss" aria-hidden="true" /><span>{plan.unknown.length} track{plan.unknown.length === 1 ? '' : 's'} by artists not on the Roster will be skipped: {[...new Set(plan.unknown.map(u => u.artists))].slice(0, 6).join('; ')}{plan.unknown.length > 6 ? '…' : ''}</span></li>}
          </ul>

          {plan.fills.length > 0 && (
            <div className="overflow-x-auto">
              <h4 className="imss-sub-h">Filled in</h4>
              <table className="w-full text-sm"><thead><tr><Th>Song</Th><Th>Artist</Th><Th>Adds</Th></tr></thead><tbody>
                {plan.fills.map(f => {
                  const next = plan.next.find(c => c.id === f.id) || {};
                  return <tr key={f.id}><Td>{f.title}</Td><Td>{artistName(next.artistId)}</Td><Td>{f.fields.map(k => FIELD_LABELS[k] || k).join(', ')}</Td></tr>;
                })}
              </tbody></table>
            </div>
          )}

          {plan.adds.length > 0 && (
            <div className="overflow-x-auto">
              <h4 className="imss-sub-h">New tracks</h4>
              <table className="w-full text-sm"><thead><tr><Th>Track</Th><Th>Artist</Th><Th>Album / EP</Th><Th>Type</Th><Th>Release date</Th><Th>ISRC</Th></tr></thead><tbody>
                {plan.adds.map(a => (
                  <tr key={a.id}><Td>{a.title}{a.collaborators.length > 0 && <div className="text-xs" style={{ color: C.textFaint }}>feat. {a.collaborators.map(c => c.name).join(', ')}</div>}</Td><Td>{artistName(a.artistId)}</Td><Td>{a.album || '—'}</Td><Td>{a.type}</Td><Td>{a.releaseDate || '—'}</Td><Td><span style={{ fontFamily: MONO_FONT }}>{a.isrc || '—'}</span></Td></tr>
                ))}
              </tbody></table>
            </div>
          )}

          {plan.maybe.length > 0 && (
            <div className="overflow-x-auto">
              <h4 className="imss-sub-h">Possibly the same song (not changed)</h4>
              <table className="w-full text-sm"><thead><tr><Th>Catalog title</Th><Th>File title</Th><Th>ISRC in file</Th></tr></thead><tbody>
                {plan.maybe.map(m => <tr key={m.id}><Td>{m.title}</Td><Td>{m.fileTitle}</Td><Td><span style={{ fontFamily: MONO_FONT }}>{m.isrc || '—'}</span></Td></tr>)}
              </tbody></table>
              <p className="text-xs mt-2" style={{ color: C.textFaint }}>If they're the same song, correct the title on the Catalog and import again; the details are then filled in.</p>
            </div>
          )}

          {plan.clashes.length > 0 && (
            <div className="overflow-x-auto">
              <h4 className="imss-sub-h">Differences (not changed)</h4>
              <table className="w-full text-sm"><thead><tr><Th>Song</Th><Th>Field</Th><Th>Catalog</Th><Th>File</Th></tr></thead><tbody>
                {plan.clashes.map((c, i) => <tr key={c.id + c.field + i}><Td>{c.title}</Td><Td>{FIELD_LABELS[c.field] || c.field}</Td><Td>{c.catalog}</Td><Td>{c.file}</Td></tr>)}
              </tbody></table>
              <p className="text-xs mt-2" style={{ color: C.textFaint }}>Change these on the song itself if the file is right.</p>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <Btn variant="primary" onClick={confirm} disabled={busy || (!plan.fills.length && !plan.adds.length)}>{busy ? 'Saving…' : 'Save ' + (plan.fills.length + plan.adds.length) + ' change' + (plan.fills.length + plan.adds.length === 1 ? '' : 's')}</Btn>
            <Btn variant="ghost" onClick={() => setPlan(null)}>Cancel</Btn>
          </div>
        </div>
      )}
      {!plan && <div className="mt-4"><Btn variant="ghost" onClick={onClose}>Close</Btn></div>}
    </section>
  );
}
