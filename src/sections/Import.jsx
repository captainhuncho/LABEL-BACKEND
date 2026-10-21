import { CheckCircle2, Download, FileText } from 'lucide-react';
import Papa from 'papaparse';
import { useRef, useState } from 'react';
import { IMPORT_FIELD_LABELS, buildImportGroups, extractPivotTable, formatCurrency, formatNumber, guessColumnIndex, guessMapping, guessPlatform, guessReleaseTitleFromFilename, monthLabel, normalizeIsrc, normalizeStr, parseAmount, parseQuantity, parseStatementDate, todayStr, trackOptionLabel, uid } from '../constants.js';
import { slug } from '../finance.js';
import { catalogCodeFills } from '../empire.js';
import EmpireImport from './EmpireImport.jsx';
import { C, MONO_FONT } from '../theme.js';
import { Btn, Field, Input, DropZone, SectionHeader, Select, Td, Th } from '../ui.jsx';

export function ImportSection({ publishedRevenue = [], updatePublishedRevenue, roster, catalog, revenue, streams, updateRoster, updateCatalog, updateRevenue, updateStreams, commitEmpireImport, commitStoreStreams, masterGross = [], statementFiles = [], updateStatementFiles, sessionName = '', canAddArtists = false }) {
  const [mode, setMode] = useState(null);
  const [step, setStep] = useState('choose');
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [summary, setSummary] = useState(null);
  const fileInputRef = useRef(null);

  const [headers, setHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [groups, setGroups] = useState([]);

  const [summaryHeaders, setSummaryHeaders] = useState([]);
  const [summaryRows, setSummaryRows] = useState([]);
  const [summaryForm, setSummaryForm] = useState({ title: '', isrc: '', upc: '', artistChoice: canAddArtists ? '__new__' : (roster[0] ? roster[0].id : ''), newArtistName: '', period: '', storeCol: 0, amountCol: 0, quantityCol: '' });

  function reset() {
    setMode(null); setStep('choose'); setFileName(''); setParseError(''); setSummary(null);
    setHeaders([]); setRawRows([]); setMapping({}); setGroups([]);
    setSummaryHeaders([]); setSummaryRows([]);
    setSummaryForm({ title: '', isrc: '', upc: '', artistChoice: canAddArtists ? '__new__' : (roster[0] ? roster[0].id : ''), newArtistName: '', period: '', storeCol: 0, amountCol: 0, quantityCol: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setParseError('');
    setFileName(file.name);

    if (mode === 'summary') {
      Papa.parse(file, {
        skipEmptyLines: true,
        complete: (results) => {
          const table = extractPivotTable(results.data);
          if (!table) { setParseError("Couldn't find a store-by-store table in that file."); return; }
          setSummaryHeaders(table.headers);
          setSummaryRows(table.rows);
          const storeGuess = guessColumnIndex(table.headers, ['service', 'store', 'platform', 'dsp', 'source'], false);
          const amountGuess = guessColumnIndex(table.headers, ['total royalt', 'total revenue', 'net revenue', 'royalt'], true);
          const quantityGuess = guessColumnIndex(table.headers, ['stream', 'quantity', 'units'], false);
          setSummaryForm(f => ({
            ...f,
            title: guessReleaseTitleFromFilename(file.name),
            storeCol: storeGuess >= 0 ? storeGuess : 0,
            amountCol: amountGuess >= 0 ? amountGuess : table.headers.length - 1,
            quantityCol: quantityGuess >= 0 ? quantityGuess : '',
            artistChoice: roster[0] ? roster[0].id : '__new__',
          }));
          setStep('map');
        },
        error: (err) => setParseError('Could not read that file: ' + err.message),
      });
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => String(h).trim(),
      complete: (results) => {
        const fields = results.meta && results.meta.fields ? results.meta.fields : [];
        if (!fields.length || !results.data.length) {
          setParseError("Couldn't find any rows in that file — check it's a CSV with a header row.");
          return;
        }
        setHeaders(fields);
        setRawRows(results.data);
        setMapping(guessMapping(fields));
        setStep('map');
      },
      error: (err) => setParseError('Could not read that file: ' + err.message),
    });
  }

  function downloadSample() {
    const rows = [
      ['Period', 'Store', 'Track Title', 'ISRC', 'Artist Name', 'Quantity', 'Net Revenue'],
      ['2026-08', 'Spotify', 'Glass Static', 'US-IM1-24-00123', 'Nova Reyes', '154302', '412.18'],
      ['2026-08', 'Apple Music', 'Halflight', 'US-IM1-25-00045', 'Nova Reyes', '48210', '96.40'],
      ['2026-08', 'Spotify', 'Low Tide Radio', 'US-IM1-24-00198', 'Marlowe Grey', '61230', '163.05'],
      ['2026-08', 'YouTube Music', 'Midnight Static', '', 'Nova Reyes', '9800', '8.10'],
      ['2026-08', 'Spotify', 'New Wave', '', 'The Coastals', '22110', '58.90'],
    ];
    const csv = rows.map(r => r.map(v => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v)).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'sample-royalty-statement.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadSampleSummary() {
    const rows = [
      ['EMPIRE Summary Royalty Report'],
      [],
      ['Totals', '', '', '82.14'],
      [],
      ['Service', 'Quantity', 'Net Revenue'],
      ['Spotify', '12500', '61.20'],
      ['Apple Music', '4300', '15.40'],
      ['YouTube Music', '900', '5.54'],
    ];
    const csv = rows.map(r => r.map(v => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v)).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'sample-song-royalties-summary.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function proceedToReview() {
    setGroups(buildImportGroups(rawRows, mapping, catalog, roster));
    setStep('review');
  }

  function updateGroup(key, patch) {
    setGroups(gs => gs.map(g => g.key === key ? { ...g, ...patch } : g));
  }

  function confirmImport() {
    // Only Admin and Legal add artists to the roster (the database refuses anyone else).
    if (!canAddArtists && groups.some(g => g.releaseChoice === '__create__' && g.artistChoice === '__new__')) { window.alert('Only an Admin or Legal can add new artists. Pick an existing artist, or ask them to add this one first.'); return; }
    let nextRoster = [...roster];
    let nextCatalog = [...catalog];
    const newArtistIdByName = {};
    const resolved = groups.map(g => {
      if (g.releaseChoice === '__skip__') return { ...g, resolvedReleaseId: null };
      if (g.releaseChoice === '__create__') {
        let artistId = g.artistChoice;
        if (g.artistChoice === '__new__') {
          const name = (g.newArtistName || g.artistNameRaw || 'Unknown Artist').trim();
          const nameKey = normalizeStr(name);
          if (newArtistIdByName[nameKey]) {
            artistId = newArtistIdByName[nameKey];
          } else {
            const newId = uid();
            nextRoster.push({ id: newId, name, genre: '', royaltyRate: 50, artistPct: 0.5, distroLabel: 'IMSS Records', signedDate: todayStr(), email: '', status: 'Active', notes: 'Added via CSV import.' });
            newArtistIdByName[nameKey] = newId;
            artistId = newId;
          }
        }
        const newReleaseId = uid();
        nextCatalog.push({ id: newReleaseId, artistId, title: g.title, type: 'Single', releaseDate: todayStr(), isrc: g.isrc || '', upc: g.upc || '', status: 'Released' });
        return { ...g, resolvedReleaseId: newReleaseId };
      }
      return { ...g, resolvedReleaseId: g.releaseChoice };
    });

    // Revenue is one row per track per month (per the finance spec) — rows from
    // multiple stores for the same track/month get summed into a single entry.
    const revenueByKey = {};
    const streamAdds = [];
    let skippedRows = 0;

    resolved.forEach(g => {
      if (!g.resolvedReleaseId) { skippedRows += g.rowIndices.length; return; }
      const release = nextCatalog.find(c => c.id === g.resolvedReleaseId);
      const artist = nextRoster.find(a => a.id === release.artistId);
      g.rowIndices.forEach(idx => {
        const row = rawRows[idx];
        const amountVal = mapping.amount ? parseAmount(row[mapping.amount]) : null;
        if (amountVal === null) { skippedRows += 1; return; }
        const dateVal = mapping.date ? parseStatementDate(row[mapping.date]) : null;
        const month = (dateVal || todayStr()).slice(0, 7);
        const storeRaw = mapping.store ? row[mapping.store] : '';
        if (artist) {
          const artistSlug = slug(artist.name);
          const key = artistSlug + '_' + slug(release.title) + '_' + month;
          if (!revenueByKey[key]) {
            revenueByKey[key] = { id: key, artist: artist.name, artistSlug, title: release.title, month, earning: 0, type: release.type || 'Single', epAlbum: null, releaseDate: release.releaseDate || null, approvalStatus: 'Approved', approvedBy: 'Import', approvedAt: todayStr() };
          }
          revenueByKey[key].earning += amountVal;
          // Per-retailer split of this row's earning, for "top earning retailer".
          if (storeRaw) { const st = revenueByKey[key].stores || (revenueByKey[key].stores = {}); const p = guessPlatform(storeRaw); st[p] = (st[p] || 0) + amountVal; }
        }
        if (mapping.quantity) {
          const qty = parseQuantity(row[mapping.quantity]);
          if (qty > 0) {
            streamAdds.push({ id: uid(), date: dateVal || todayStr(), platform: guessPlatform(storeRaw), releaseId: release.id, count: qty });
          }
        }
      });
    });

    const revenueAdds = Object.values(revenueByKey);
    // Rule: an import always fills in a song's missing ISRC/UPC (never replaces one).
    const codes = catalogCodeFills(resolved.filter(g => g.resolvedReleaseId).map(g => ({ release: nextCatalog.find(c => c.id === g.resolvedReleaseId), isrc: g.isrc, upc: g.upc })), nextCatalog);
    nextCatalog = codes.next;
    updateRoster(nextRoster);
    updateCatalog(nextCatalog);
    if (revenueAdds.length) updateRevenue([...revenue.filter(r => !revenueByKey[r.id]), ...revenueAdds]);
    if (streamAdds.length) updateStreams([...streams, ...streamAdds]);

    setSummary({
      codesAdded: codes.filled.length, codeMismatches: codes.mismatches,
      revenueCount: revenueAdds.length,
      streamCount: streamAdds.length,
      newArtistCount: nextRoster.length - roster.length,
      newReleaseCount: nextCatalog.length - catalog.length,
      skippedRows,
    });
    setStep('done');
  }

  function confirmSummaryImport() {
    let nextRoster = [...roster];
    let nextCatalog = [...catalog];
    let artistId = summaryForm.artistChoice;
    if (artistId === '__new__') {
      const name = (summaryForm.newArtistName || 'Unknown Artist').trim();
      const newId = uid();
      nextRoster.push({ id: newId, name, genre: '', royaltyRate: 50, artistPct: 0.5, distroLabel: 'IMSS Records', signedDate: todayStr(), email: '', status: 'Active', notes: 'Added via CSV import.' });
      artistId = newId;
    }
    const artist = nextRoster.find(a => a.id === artistId);

    const title = summaryForm.title.trim() || '(untitled product)';
    let release = nextCatalog.find(c => c.artistId === artistId && (
      (summaryForm.isrc && normalizeIsrc(c.isrc) === normalizeIsrc(summaryForm.isrc)) ||
      (summaryForm.upc && String(c.upc || '').replace(/[^0-9]/g, '') === summaryForm.upc.replace(/[^0-9]/g, '')) ||
      normalizeStr(c.title) === normalizeStr(title)
    ));
    let createdRelease = false;
    if (!release) {
      release = { id: uid(), artistId, title, type: 'Single', releaseDate: todayStr(), isrc: summaryForm.isrc || '', upc: summaryForm.upc || '', status: 'Released' };
      nextCatalog.push(release);
      createdRelease = true;
    }

    const month = summaryForm.period || todayStr().slice(0, 7);
    const dateVal = summaryForm.period ? summaryForm.period + '-01' : todayStr();
    const streamAdds = [];
    let skippedRows = 0;
    let earningTotal = 0;
    const stores = {};

    summaryRows.forEach(row => {
      const storeRaw = (row[summaryForm.storeCol] || '').trim();
      const amountVal = parseAmount(row[summaryForm.amountCol]);
      if (amountVal === null) { skippedRows += 1; return; }
      earningTotal += amountVal;
      if (storeRaw) { const p = guessPlatform(storeRaw); stores[p] = (stores[p] || 0) + amountVal; }
      if (summaryForm.quantityCol !== '' && summaryForm.quantityCol !== null && summaryForm.quantityCol !== undefined) {
        const qty = parseQuantity(row[summaryForm.quantityCol]);
        if (qty > 0) streamAdds.push({ id: uid(), date: dateVal, platform: guessPlatform(storeRaw), releaseId: release.id, count: qty });
      }
    });

    const revenueAdds = [];
    if (artist && earningTotal > 0) {
      const artistSlug = slug(artist.name);
      const key = artistSlug + '_' + slug(release.title) + '_' + month;
      revenueAdds.push({ id: key, artist: artist.name, artistSlug, title: release.title, month, earning: earningTotal, stores, type: release.type || 'Single', epAlbum: null, releaseDate: release.releaseDate || null, approvalStatus: 'Approved', approvedBy: 'Import', approvedAt: todayStr() });
    }

    const codes = catalogCodeFills([{ release, isrc: summaryForm.isrc, upc: summaryForm.upc }], nextCatalog);
    nextCatalog = codes.next;
    updateRoster(nextRoster);
    updateCatalog(nextCatalog);
    if (revenueAdds.length) updateRevenue([...revenue.filter(r => r.id !== revenueAdds[0].id), ...revenueAdds]);
    if (streamAdds.length) updateStreams([...streams, ...streamAdds]);

    setSummary({
      codesAdded: codes.filled.length, codeMismatches: codes.mismatches,
      earningsCount: revenueAdds.length,
      streamCount: streamAdds.length,
      newArtistCount: nextRoster.length - roster.length,
      newReleaseCount: createdRelease ? 1 : 0,
      skippedRows,
    });
    setStep('done');
  }

  const canReview = !!mapping.amount && (!!mapping.title || !!mapping.isrc);
  const matchedCount = groups.filter(g => g.releaseChoice !== '__create__' && g.releaseChoice !== '__skip__').length;
  const canReviewSummary = !!summaryForm.title.trim() && !!summaryForm.period && !!summaryForm.artistChoice && (summaryForm.artistChoice !== '__new__' || (canAddArtists && !!summaryForm.newArtistName.trim()));

  return (
    <div>
      <SectionHeader title="Import" artistNote="nothing yet. Imported revenue and statement files stay internal until you publish them." description="Upload a royalty statement CSV from a distributor or DSP. IMSS Records matches it to your roster and catalog, and logs the earnings automatically — including the store-by-store breakdown artists see." />

      {mode === 'empire' && (
        <EmpireImport publishedRevenue={publishedRevenue} updatePublishedRevenue={updatePublishedRevenue} roster={roster} catalog={catalog} revenue={revenue} masterGross={masterGross} updateRevenue={updateRevenue} commitEmpireImport={commitEmpireImport} commitStoreStreams={commitStoreStreams} updateCatalog={updateCatalog} statementFiles={statementFiles} updateStatementFiles={updateStatementFiles} sessionName={sessionName} onDone={reset} />
      )}

      {step === 'choose' && (
        <div className="imss-form-grid gap-4">
          <button onClick={() => { setMode('empire'); setStep('empire'); }} className="text-left rounded border p-5" style={{ background: C.amberSoft, borderColor: C.amber }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>EMPIRE detailed royalty report</div>
            <div className="text-sm" style={{ color: C.textDim }}>The “royalties_detailed” CSV from EMPIRE. Books gross by statement month with platform, country and type detail, and saves the file on the artist’s profile.</div>
          </button>
          <button onClick={() => { setMode('detail'); setStep('upload'); }} className="text-left rounded border p-5" style={{ background: C.panel, borderColor: C.borderLight }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Per-product detail report</div>
            <div className="text-sm" style={{ color: C.textDim }}>Each row is one product's earnings — DistroKid, CD Baby, or TuneCore-style exports with a title, ISRC, and amount per line.</div>
          </button>
          <button onClick={() => { setMode('summary'); setStep('upload'); }} className="text-left rounded border p-5" style={{ background: C.panel, borderColor: C.borderLight }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Store breakdown for one product</div>
            <div className="text-sm" style={{ color: C.textDim }}>Each row is one store's total for a single song — EMPIRE-style summary reports, like the "royalties_summary" exports per track.</div>
          </button>
        </div>
      )}

      {step === 'upload' && (
        <div>
          <DropZone onFiles={handleFile} accept=".csv,text/csv" className="rounded border p-8 text-center mb-4" style={{ borderColor: C.borderLight, borderStyle: 'dashed', background: C.panel }}>
            <FileText size={22} style={{ color: C.textFaint, margin: '0 auto 10px' }} />
            <div style={{ fontWeight: 600 }}>Drop a statement here, or choose a file</div>
            <div className="text-sm mt-1 mb-4" style={{ color: C.textDim }}>
              {mode === 'summary' ? 'A store-by-store summary report for one product, straight from EMPIRE.' : 'CSV files from DistroKid, CD Baby, TuneCore, or any distributor export.'}
            </div>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="text-sm mx-auto block" style={{ color: C.textDim, maxWidth: 280 }} />
          </DropZone>
          {parseError && <div className="rounded px-3 py-2 text-xs mb-4" style={{ background: C.redSoft, color: C.red, border: '1px solid ' + C.red }}>{parseError}</div>}
          <div className="flex items-center justify-between">
            <button onClick={mode === 'summary' ? downloadSampleSummary : downloadSample} className="inline-flex items-center gap-1.5 text-xs" style={{ color: C.textDim }}>
              <Download size={12} /> Download a sample CSV to try it out
            </button>
            <button onClick={reset} className="text-xs" style={{ color: C.textFaint }}>Change file type</button>
          </div>
        </div>
      )}

      {step === 'map' && mode === 'detail' && (
        <div>
          <div className="flex items-center gap-2 mb-4 text-sm" style={{ color: C.textDim }}>
            <FileText size={14} /> {fileName} · {rawRows.length} rows detected
          </div>
          <div className="rounded border p-4 mb-5 imss-form-grid gap-3" style={{ background: C.panel, borderColor: C.borderLight }}>
            {Object.keys(IMPORT_FIELD_LABELS).map(field => (
              <Field key={field} label={IMPORT_FIELD_LABELS[field] + (field === 'amount' ? ' (required)' : '')}>
                <Select value={mapping[field] || ''} onChange={e => setMapping({ ...mapping, [field]: e.target.value })}>
                  <option value="">— none —</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </Select>
              </Field>
            ))}
          </div>

          {!canReview && (
            <div className="text-xs mb-4" style={{ color: C.amber }}>Map at least a revenue amount and a product name or ISRC to continue.</div>
          )}

          <div className="rounded border overflow-x-auto mb-5" style={{ borderColor: C.border, background: C.panel }}>
            <div className="text-xs px-4 pt-3 pb-2" style={{ color: C.textFaint }}>Preview — first 5 rows</div>
            <table className="w-full" style={{ minWidth: 560 }}>
              <thead><tr>{headers.map(h => <Th key={h}>{h}</Th>)}</tr></thead>
              <tbody>
                {rawRows.slice(0, 5).map((row, i) => (
                  <tr key={i}>{headers.map(h => <Td key={h}>{row[h]}</Td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <Btn variant="primary" onClick={proceedToReview} disabled={!canReview}>Continue</Btn>
            <Btn variant="ghost" onClick={reset}>Start over</Btn>
          </div>
        </div>
      )}

      {step === 'map' && mode === 'summary' && (
        <div>
          <div className="flex items-center gap-2 mb-4 text-sm" style={{ color: C.textDim }}>
            <FileText size={14} /> {fileName} · {summaryRows.length} store rows detected
          </div>

          <div className="rounded border p-4 mb-5 imss-form-grid gap-3" style={{ background: C.panel, borderColor: C.borderLight }}>
            <Field label="Product name"><Input value={summaryForm.title} onChange={e => setSummaryForm({ ...summaryForm, title: e.target.value })} placeholder="e.g. Play Pretend" /></Field>
            <Field label="ISRC (optional)"><Input value={summaryForm.isrc} onChange={e => setSummaryForm({ ...summaryForm, isrc: e.target.value })} /></Field>
            <Field label="UPC (optional)"><Input value={summaryForm.upc} onChange={e => setSummaryForm({ ...summaryForm, upc: e.target.value })} /></Field>
            <Field label="Artist">
              <Select value={summaryForm.artistChoice} onChange={e => setSummaryForm({ ...summaryForm, artistChoice: e.target.value })}>
                {roster.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                {canAddArtists && <option value="__new__">+ New artist</option>}
              </Select>
            </Field>
            {summaryForm.artistChoice === '__new__' && (
              <Field label="New artist name"><Input value={summaryForm.newArtistName} onChange={e => setSummaryForm({ ...summaryForm, newArtistName: e.target.value })} /></Field>
            )}
            <Field label="Statement period"><Input type="month" value={summaryForm.period} onChange={e => setSummaryForm({ ...summaryForm, period: e.target.value })} /></Field>
            <Field label="Store / platform column">
              <Select value={summaryForm.storeCol} onChange={e => setSummaryForm({ ...summaryForm, storeCol: Number(e.target.value) })}>
                {summaryHeaders.map((h, i) => <option key={i} value={i}>{(h || '(blank)') + ' — col ' + (i + 1)}</option>)}
              </Select>
            </Field>
            <Field label="Revenue column">
              <Select value={summaryForm.amountCol} onChange={e => setSummaryForm({ ...summaryForm, amountCol: Number(e.target.value) })}>
                {summaryHeaders.map((h, i) => <option key={i} value={i}>{(h || '(blank)') + ' — col ' + (i + 1)}</option>)}
              </Select>
            </Field>
            <Field label="Streams column (optional)">
              <Select value={summaryForm.quantityCol} onChange={e => setSummaryForm({ ...summaryForm, quantityCol: e.target.value === '' ? '' : Number(e.target.value) })}>
                <option value="">— none —</option>
                {summaryHeaders.map((h, i) => <option key={i} value={i}>{(h || '(blank)') + ' — col ' + (i + 1)}</option>)}
              </Select>
            </Field>
          </div>

          {!canReviewSummary && (
            <div className="text-xs mb-4" style={{ color: C.amber }}>Add a product name, a statement period, and an artist to continue.</div>
          )}

          <div className="rounded border overflow-x-auto mb-5" style={{ borderColor: C.border, background: C.panel }}>
            <div className="text-xs px-4 pt-3 pb-2" style={{ color: C.textFaint }}>Preview — first 6 stores</div>
            <table className="w-full" style={{ minWidth: 420 }}>
              <thead><tr><Th>Store</Th>{summaryForm.quantityCol !== '' && <Th align="right">Streams</Th>}<Th align="right">Revenue</Th></tr></thead>
              <tbody>
                {summaryRows.slice(0, 6).map((row, i) => (
                  <tr key={i}>
                    <Td>{row[summaryForm.storeCol]}</Td>
                    {summaryForm.quantityCol !== '' && <Td align="right" mono>{formatNumber(parseQuantity(row[summaryForm.quantityCol]))}</Td>}
                    <Td align="right" mono>{formatCurrency(parseAmount(row[summaryForm.amountCol]) || 0)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <Btn variant="primary" onClick={() => setStep('review')} disabled={!canReviewSummary}>Continue</Btn>
            <Btn variant="ghost" onClick={reset}>Start over</Btn>
          </div>
        </div>
      )}

      {step === 'review' && mode === 'detail' && (
        <div>
          <div className="text-sm mb-4" style={{ color: C.textDim }}>
            {groups.length} unique products found across {rawRows.length} rows. {matchedCount} matched an existing release automatically — review the rest below.
          </div>
          <div className="rounded border overflow-x-auto mb-5" style={{ borderColor: C.border, background: C.panel }}>
            <table className="w-full" style={{ minWidth: 760 }}>
              <thead><tr><Th>Product</Th><Th>From CSV</Th><Th align="right">Rows</Th><Th align="right">Total</Th><Th>Match to</Th></tr></thead>
              <tbody>
                {groups.map(g => (
                  <tr key={g.key} style={{ opacity: g.releaseChoice === '__skip__' ? 0.5 : 1 }}>
                    <Td>
                      {g.title}
                      {g.isrc && <div className="text-xs" style={{ color: C.textFaint, fontFamily: MONO_FONT }}>{g.isrc}</div>}
                    </Td>
                    <Td>{g.artistNameRaw || '—'}</Td>
                    <Td align="right" mono>{g.rowIndices.length}</Td>
                    <Td align="right" mono>{formatCurrency(g.totalAmount)}</Td>
                    <Td>
                      <Select value={g.releaseChoice} onChange={e => updateGroup(g.key, { releaseChoice: e.target.value })} style={{ minWidth: 180 }}>
                        <option value="__create__">Create new release</option>
                        <option value="__skip__">Skip these rows</option>
                        {catalog.map(c => {
                          const a = roster.find(x => x.id === c.artistId);
                          return <option key={c.id} value={c.id}>{trackOptionLabel(c, true, a ? a.name : null)}</option>;
                        })}
                      </Select>
                      {g.releaseChoice === '__create__' && (
                        <div className="mt-2">
                          <Select value={g.artistChoice} onChange={e => updateGroup(g.key, { artistChoice: e.target.value })} style={{ minWidth: 180 }}>
                            {roster.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            {canAddArtists && <option value="__new__">+ New artist</option>}
                          </Select>
                          {g.artistChoice === '__new__' && (
                            <Input className="mt-2" placeholder="New artist name" value={g.newArtistName} onChange={e => updateGroup(g.key, { newArtistName: e.target.value })} style={{ minWidth: 180 }} />
                          )}
                        </div>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <Btn variant="primary" onClick={confirmImport}>Import {rawRows.length} rows</Btn>
            <Btn variant="ghost" onClick={() => setStep('map')}>Back to mapping</Btn>
          </div>
        </div>
      )}

      {step === 'review' && mode === 'summary' && (
        <div>
          <div className="text-sm mb-4" style={{ color: C.textDim }}>
            Every store below will be logged as earnings for <strong>{summaryForm.title || '(untitled product)'}</strong> in {summaryForm.period ? monthLabel(summaryForm.period) : 'the selected period'} — store-by-store, so it's still visible that way afterward.
          </div>
          <div className="rounded border overflow-x-auto mb-5" style={{ borderColor: C.border, background: C.panel }}>
            <table className="w-full" style={{ minWidth: 420 }}>
              <thead><tr><Th>Store</Th>{summaryForm.quantityCol !== '' && <Th align="right">Streams</Th>}<Th align="right">Revenue</Th></tr></thead>
              <tbody>
                {summaryRows.map((row, i) => (
                  <tr key={i}>
                    <Td>{row[summaryForm.storeCol]}</Td>
                    {summaryForm.quantityCol !== '' && <Td align="right" mono>{formatNumber(parseQuantity(row[summaryForm.quantityCol]))}</Td>}
                    <Td align="right" mono>{formatCurrency(parseAmount(row[summaryForm.amountCol]) || 0)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <Btn variant="primary" onClick={confirmSummaryImport}>Import {summaryRows.length} store rows</Btn>
            <Btn variant="ghost" onClick={() => setStep('map')}>Back</Btn>
          </div>
        </div>
      )}

      {step === 'done' && summary && (
        <div>
          <div className="rounded border p-6 mb-5" style={{ background: C.tealSoft, borderColor: C.teal }}>
            <div className="flex items-center gap-2 mb-2" style={{ color: C.teal, fontWeight: 600 }}>
              <CheckCircle2 size={16} /> Import complete
            </div>
            <div className="text-sm" style={{ color: C.text }}>
              {summary.revenueCount !== undefined && <>Added {formatNumber(summary.revenueCount)} revenue {summary.revenueCount === 1 ? 'entry' : 'entries'}</>}
              {summary.earningsCount !== undefined && <>Added {formatNumber(summary.earningsCount)} revenue {summary.earningsCount === 1 ? 'entry' : 'entries'} to the Revenue tab</>}
              {summary.streamCount > 0 && <> and {formatNumber(summary.streamCount)} stream {summary.streamCount === 1 ? 'entry' : 'entries'}</>}.
              {summary.newReleaseCount > 0 && <> Created {summary.newReleaseCount} new {summary.newReleaseCount === 1 ? 'release' : 'releases'}.</>}
              {summary.newArtistCount > 0 && <> Added {summary.newArtistCount} new {summary.newArtistCount === 1 ? 'artist' : 'artists'} to the roster.</>}
              {summary.codesAdded > 0 && <> Added {summary.codesAdded} missing ISRC/UPC {summary.codesAdded === 1 ? 'code' : 'codes'} to the Catalog.</>}
              {(summary.codeMismatches || []).map(m => <span key={m.id + m.field}> {m.title}: the Catalog has {m.field.toUpperCase()} {m.have || 'none'}, the file says {m.statement}; left as it is.</span>)}
              {summary.skippedRows > 0 && <> Skipped {summary.skippedRows} {summary.skippedRows === 1 ? 'row' : 'rows'} with no usable amount.</>}
            </div>
          </div>
          <Btn variant="primary" onClick={reset}>Import another file</Btn>
        </div>
      )}
    </div>
  );
}
