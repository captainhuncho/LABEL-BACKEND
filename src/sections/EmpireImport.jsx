// Import an EMPIRE "Detailed Royalty Report": preview, check against the file's
// own totals and the money received, then book revenue by statement month and
// keep the original file on each artist's profile.
import { useRef, useState } from 'react';
import Papa from 'papaparse';
import { CheckCircle2, FileText, Upload } from 'lucide-react';
import { aggregateEmpire, cleanTitle, isEmpireDetailed, parseEmpireDetailed } from '../empire.js';
import { slug } from '../finance.js';
import { formatCents, monthLabel, todayStr, uid } from '../constants.js';
import { saveStatementFile } from '../storage.js';
import { C, MONO_FONT } from '../theme.js';
import { Btn, DropZone, Td, Th } from '../ui.jsx';

const lower = s => String(s || '').trim().toLowerCase();
const months = obj => Object.keys(obj || {}).sort().map(monthLabel).join(', ');

export default function EmpireImport({ roster, catalog, revenue, masterGross = [], updateRevenue, statementFiles = [], updateStatementFiles, sessionName = '', onDone }) {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const inputRef = useRef(null);

  // Read every dropped/chosen file; a file that's empty, not EMPIRE, or a
  // repeat is listed as skipped instead of stopping the rest.
  const readCsv = file => new Promise(resolve => Papa.parse(file, { skipEmptyLines: false, complete: ({ data }) => resolve(data), error: err => resolve({ error: err.message }) }));
  async function handleFile(e) {
    const picked = [...((e.target && e.target.files) || [])];
    if (!picked.length) return;
    setError(''); setDone(null); setBusy(true);
    const files = [], lines = [], seen = new Set();
    for (const file of picked) {
      const entry = { file, name: file.name, lines: 0, parsed: 0, totals: null, skipped: '' };
      files.push(entry);
      const sig = file.name + '|' + file.size;
      if (seen.has(sig)) { entry.skipped = 'Same file added twice'; continue; }
      seen.add(sig);
      const data = await readCsv(file);
      if (data.error) { entry.skipped = 'Could not read it: ' + data.error; continue; }
      if (!isEmpireDetailed(data)) { entry.skipped = 'Not an EMPIRE detailed royalty report'; continue; }
      let parsed;
      try { parsed = parseEmpireDetailed(data); } catch (err) { entry.skipped = err.message; continue; }
      if (!parsed.lines.length) { entry.skipped = 'No royalty lines in this report'; continue; }
      entry.lines = parsed.lines.length; entry.totals = parsed.totals;
      entry.parsed = parsed.lines.reduce((t, l) => t + l.gross, 0);
      entry.index = files.length - 1;
      parsed.lines.forEach(l => lines.push({ ...l, fileIndex: entry.index }));
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
    const usable = files.filter(f => !f.skipped);
    if (!usable.length) { setPreview(null); setError('None of these files could be imported: ' + files.map(f => f.name + ' (' + f.skipped + ')').join('; ')); return; }
    setPreview({ files, groups: matchGroups(aggregateEmpire(lines), lines) });
  }

  const code = v => lower(v).replace(/[^a-z0-9]/g, '');
  function matchGroups(groups, lines) {
    return groups.map(g => {
      // Match the song by ISRC, then UPC, then artist + title; a code match also finds the artist.
      const byCode = (g.isrc && catalog.find(c => code(c.isrc) === code(g.isrc))) || (g.upc && catalog.find(c => code(c.upc) === code(g.upc) && lower(cleanTitle(c.title)) === lower(g.title))) || null;
      const artist = (byCode && roster.find(a => a.id === byCode.artistId)) || roster.find(a => lower(a.name) === lower(g.artist));
      const release = byCode || (artist && catalog.find(c => c.artistId === artist.id && lower(cleanTitle(c.title)) === lower(g.title)));
      const title = release ? release.title : g.title;
      const id = artist ? slug(artist.name) + '_' + slug(title) + '_' + g.month : null;
      // Which files this song-month came from, so each file is kept on the right artist.
      const key = l => [l.trackArtist.toLowerCase(), (l.trackTitle || l.productTitle).toLowerCase(), l.statementMonth].join('|');
      const gKey = [g.artist.toLowerCase(), g.title.toLowerCase(), g.month].join('|');
      const fileIndexes = [...new Set(lines.filter(l => key(l) === gKey).map(l => l.fileIndex))];
      return { ...g, artistRec: artist, release, bookedTitle: title, id, fileIndexes, existing: id ? revenue.find(r => r.id === id) : null };
    });
  }

  async function confirm() {
    const matched = preview.groups.filter(g => g.artistRec);
    if (!matched.length) return;
    setBusy(true); setError('');
    try {
      // Keep each original file on every artist named in it.
      const records = [];
      for (const f of preview.files.filter(f => !f.skipped)) {
        const byArtist = {};
        matched.filter(g => g.fileIndexes.includes(f.index)).forEach(g => { (byArtist[g.artistRec.id] = byArtist[g.artistRec.id] || []).push(g); });
        for (const [artistId, gs] of Object.entries(byArtist)) {
          const id = uid();
          const stored = await saveStatementFile(artistId, id, f.file);
          records.push({
            id, artistId, fileIndex: f.index, name: f.name, source: 'EMPIRE', ...stored,
            months: [...new Set(gs.map(g => g.month))].sort(),
            gross: gs.reduce((t, g) => t + g.gross, 0),
            songs: [...new Set(gs.map(g => g.bookedTitle))],
            uploadedBy: sessionName, uploadedAt: new Date().toISOString(),
          });
        }
      }
      const fileFor = g => (records.find(r => r.artistId === g.artistRec.id && g.fileIndexes.includes(r.fileIndex)) || {}).id || null;
      const rows = matched.map(g => ({
        id: g.id, artist: g.artistRec.name, artistSlug: slug(g.artistRec.name), title: g.bookedTitle, month: g.month,
        earning: g.gross, quantity: g.quantity, isrc: g.isrc, upc: g.upc,
        stores: g.stores, countries: g.countries, types: g.types, typeQty: g.typeQty, models: g.models, salesMonths: g.salesMonths,
        type: (g.release && g.release.type) || (g.existing && g.existing.type) || 'Single',
        epAlbum: (g.existing && g.existing.epAlbum) || null,
        releaseDate: (g.release && g.release.releaseDate) || (g.existing && g.existing.releaseDate) || null,
        approvalStatus: 'Approved', approvedBy: 'EMPIRE import', approvedAt: todayStr(),
        source: 'EMPIRE', statementFileId: fileFor(g),
      }));
      const ids = new Set(rows.map(r => r.id));
      updateRevenue([...revenue.filter(r => !ids.has(r.id)), ...rows]);
      updateStatementFiles([...records.map(({ fileIndex, ...r }) => r), ...statementFiles]);
      setDone({ rows: rows.length, replaced: matched.filter(g => g.existing).length, gross: rows.reduce((t, r) => t + r.earning, 0), artists: new Set(records.map(r => r.artistId)).size, files: preview.files.filter(f => !f.skipped).length, skipped: preview.groups.length - matched.length });
      setPreview(null);
    } catch (err) {
      setError('Import failed: ' + (err.message || err) + '. Nothing was booked.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded border p-5" style={{ background: C.panel, borderColor: C.border }} role="status">
        <div className="flex items-center gap-2 mb-2" style={{ fontWeight: 600 }}><CheckCircle2 size={18} color={C.teal} /> {done.files === 1 ? 'Statement' : done.files + ' statements'} imported</div>
        <p className="text-sm" style={{ color: C.textDim }}>
          Booked {done.rows} song-month{done.rows === 1 ? '' : 's'} totalling <span style={{ fontFamily: MONO_FONT, color: C.text }}>{formatCents(done.gross)}</span> gross
          {done.replaced > 0 ? ' (' + done.replaced + ' replaced figures already in the app)' : ''}. The {done.files === 1 ? 'file is' : 'files are'} saved on {done.artists} artist profile{done.artists === 1 ? '' : 's'}.
          {done.skipped > 0 ? ' ' + done.skipped + ' line group' + (done.skipped === 1 ? ' was' : 's were') + ' skipped (artist not on the Roster).' : ''}
        </p>
        <div className="flex gap-2 mt-4">
          <Btn variant="primary" onClick={() => setDone(null)}><Upload size={14} /> Import another</Btn>
          {onDone && <Btn variant="ghost" onClick={onDone}>Back to import options</Btn>}
        </div>
      </div>
    );
  }

  const matched = preview ? preview.groups.filter(g => g.artistRec) : [];
  const unmatched = preview ? preview.groups.filter(g => !g.artistRec) : [];
  const usable = preview ? preview.files.filter(f => !f.skipped) : [];
  const fileOk = f => !f.totals || Math.abs(f.totals.gross - f.parsed) < 0.01;
  const totalsOk = usable.every(fileOk);
  const monthsInFile = preview ? [...new Set(preview.groups.map(g => g.month))].sort() : [];

  return (
    <div>
      <div className="rounded border p-5 mb-5" style={{ background: C.panel, borderColor: C.border }}>
        <h3 style={{ fontWeight: 600, fontSize: 15 }}>EMPIRE detailed royalty report</h3>
        <p className="text-sm mt-1 mb-3" style={{ color: C.textDim, maxWidth: '70ch' }}>
          Revenue is booked under the <b style={{ color: C.text }}>Statement Date</b> (when IMSS received the money) using EMPIRE’s unrounded “Net (Raw)” as the artist’s gross. Platform, country, type and sales month are kept for reporting. Re-importing a month replaces it instead of adding to it.
        </p>
        <DropZone onFiles={handleFile} accept=".csv,text/csv" className="rounded border p-6 text-center" style={{ borderColor: C.borderLight, borderStyle: 'dashed' }}>
          <Upload size={20} style={{ color: C.textFaint, margin: '0 auto 8px' }} aria-hidden="true" />
          <div className="text-sm mb-3" style={{ fontWeight: 600 }}>{busy ? 'Reading files…' : 'Drop EMPIRE CSVs here (as many as you like), or choose files'}</div>
          <input ref={inputRef} type="file" multiple accept=".csv,text/csv" onChange={handleFile} className="text-sm mx-auto block" style={{ color: C.textDim, maxWidth: 280 }} aria-label="EMPIRE detailed royalty report CSV" />
        </DropZone>
        {error && <div className="text-sm mt-3" role="alert" style={{ color: C.red }}>{error}</div>}
      </div>

      {preview && (
        <div className="flex flex-col gap-4">
          <section aria-label="Checks" className="rounded border p-4" style={{ background: C.panel, borderColor: totalsOk ? C.border : C.amber }}>
            <h3 className="imss-sub-h">Checks</h3>
            <ul className="imss-checks">
              {preview.files.map((f, i) => f.skipped ? (
                <li key={i} className="is-miss"><span className="imss-check-miss" aria-hidden="true" /><span><b>{f.name}</b>: skipped, {f.skipped.charAt(0).toLowerCase() + f.skipped.slice(1)}.</span></li>
              ) : (
                <li key={i} className={fileOk(f) ? 'is-ok' : 'is-miss'}>{fileOk(f) ? <CheckCircle2 size={15} aria-hidden="true" /> : <span className="imss-check-miss" aria-hidden="true" />}
                  <span><b>{f.name}</b>: {f.totals ? 'file total ' + formatCents(f.totals.gross) + ' · read ' + formatCents(f.parsed) + (fileOk(f) ? '' : ', these don’t match, check the file before importing') : 'read ' + formatCents(f.parsed) + ' (no totals row to check against)'} ({f.lines} lines)</span></li>
              ))}
              {monthsInFile.map(m => {
                const mg = masterGross.find(g => g.month === m);
                const statement = preview.groups.filter(g => g.month === m).reduce((t, g) => t + g.gross, 0);
                return (
                  <li key={m} className={mg ? 'is-ok' : 'is-miss'}>{mg ? <CheckCircle2 size={15} aria-hidden="true" /> : <span className="imss-check-miss" aria-hidden="true" />}
                    <span>{monthLabel(m)}: statement gross {formatCents(statement)} · money received {mg ? formatCents(mg.totalGross) + (mg.receivedOn ? ', in the bank ' + mg.receivedOn : mg.paidOn ? ', sent by EMPIRE ' + mg.paidOn : '') + ' (all songs, Inbound Banking Charge ' + formatCents(mg.swiftFee) + ')' : 'not logged against this statement month yet. Add it under Money received before publishing'}</span></li>
                );
              })}
              {unmatched.length > 0 && <li className="is-miss"><span className="imss-check-miss" aria-hidden="true" /><span>{[...new Set(unmatched.map(g => g.artist))].join(', ')} {[...new Set(unmatched.map(g => g.artist))].length === 1 ? 'isn’t' : 'aren’t'} on the Roster: {formatCents(unmatched.reduce((t, g) => t + g.gross, 0))} will be skipped. Add the artist first, then import again.</span></li>}
            </ul>
          </section>

          <section aria-label="What will be booked" className="rounded border overflow-x-auto" style={{ background: C.panel, borderColor: C.border }}>
            <table className="w-full" style={{ minWidth: 820 }}>
              <thead><tr><Th>Artist</Th><Th>Song</Th><Th>Booked in</Th><Th>Earned in</Th><Th align="right">Streams / sales</Th><Th align="right">Gross</Th><Th>Currently in the app</Th></tr></thead>
              <tbody>
                {preview.groups.map((g, i) => (
                  <tr key={i} style={{ opacity: g.artistRec ? 1 : 0.55 }}>
                    <Td>{g.artistRec ? g.artistRec.name : g.artist}{g.artistRec && lower(g.artistRec.name) !== lower(g.artist) && <div className="text-xs" style={{ color: C.textDim }}>File says “{g.artist}”, matched by {g.release && g.isrc && lower(g.release.isrc).replace(/[^a-z0-9]/g, '') === lower(g.isrc) ? 'ISRC' : 'UPC'}</div>}{!g.artistRec && <div className="text-xs" style={{ color: C.amber }}>Not on Roster: skipped</div>}</Td>
                    <Td>{g.bookedTitle}{!g.release && g.artistRec && <div className="text-xs" style={{ color: C.textDim }}>Not in Catalog yet</div>}</Td>
                    <Td mono>{monthLabel(g.month)}</Td>
                    <Td><span className="text-xs" style={{ color: C.textDim }}>{months(g.salesMonths)}</span></Td>
                    <Td align="right" mono>{Math.round(g.quantity).toLocaleString('en-US')}</Td>
                    <Td align="right" mono>{formatCents(g.gross)}</Td>
                    <Td>{g.existing ? <span className="text-xs" style={{ color: Math.abs(g.existing.earning - g.gross) < 0.01 ? C.textDim : C.amber }}>{formatCents(g.existing.earning)} will be replaced{Math.abs(g.existing.earning - g.gross) < 0.01 ? ' (same total)' : ''}</span> : <span className="text-xs" style={{ color: C.textDim }}>New</span>}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className="flex items-center gap-3 flex-wrap">
            <Btn variant="primary" onClick={confirm} disabled={busy || !matched.length}><FileText size={14} /> {busy ? 'Importing…' : 'Book ' + matched.length + ' song-month' + (matched.length === 1 ? '' : 's') + ' · ' + formatCents(matched.reduce((t, g) => t + g.gross, 0))}</Btn>
            <Btn variant="ghost" onClick={() => { setPreview(null); if (inputRef.current) inputRef.current.value = ''; }}>Cancel</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
