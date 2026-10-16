// Backup & restore (Admin only). With the shared database, backups are read
// straight from the server so every section is included; automatic copies are
// taken daily on the server and kept 30 days (private.take_auto_backup).
// Without the database (local copy), the in-memory sections are used.
import { useEffect, useRef, useState } from 'react';
import { FileDown, FileSpreadsheet, History } from 'lucide-react';
import { formatDate, todayStr } from '../constants.js';
import { supabase } from '../storage.js';
import { logActivity } from '../audit.js';
import { C } from '../theme.js';
import { Btn, SectionHeader } from '../ui.jsx';

// A backup must hold at least these to be restorable.
const REQUIRED = ['roster', 'catalog', 'staff'];
const skip = new Set(['exportedAt', 'source', 'backupOf']);

function saveFile(name, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

async function liveSections() {
  const { data, error } = await supabase.from('app_data').select('key, value');
  if (error) throw error;
  return Object.fromEntries(data.map(r => [r.key, r.value]));
}

export function BackupSection({ allData, updaters }) {
  const [confirmRestore, setConfirmRestore] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [restored, setRestored] = useState(false);
  const [autos, setAutos] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.rpc('backups_list').then(({ data }) => setAutos((data || []).filter(b => String(b.archive_id).startsWith('auto-'))));
  }, []);

  async function current() { return supabase ? liveSections() : allData; }

  async function downloadBackup() {
    setError(''); setBusy(true);
    try {
      const sections = await current();
      saveFile('imss-records-backup-' + todayStr() + '.json', { exportedAt: new Date().toISOString(), source: 'IMSS Records', ...sections });
      logActivity('downloaded a full backup', Object.keys(sections).length + ' sections');
    } catch (e) { setError('Could not build the backup. Try again in a moment.'); }
    setBusy(false);
  }
  async function downloadAuto(b) {
    setError('');
    const { data, error: err } = await supabase.rpc('backup_download', { aid: b.archive_id });
    if (err || !data) { setError('Could not download that backup.'); return; }
    saveFile('imss-records-' + b.archive_id + '.json', { exportedAt: b.taken_at, source: 'IMSS Records', backupOf: b.archive_id, ...data });
    logActivity('downloaded an automatic backup', b.archive_id);
  }
  async function downloadWorkbook() {
    setError(''); setBusy(true);
    try {
      const sections = await current();
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      Object.entries(sections).forEach(([k, val]) => {
        if (!Array.isArray(val) || val.length === 0) return;
        const flat = val.map(row => Object.fromEntries(Object.entries(row).map(([f, v]) => [f, typeof v === 'object' && v !== null ? JSON.stringify(v) : v])));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flat), k.slice(0, 31));
      });
      XLSX.writeFile(wb, 'imss-records-full-export-' + todayStr() + '.xlsx');
    } catch (e) { setError('Could not build the workbook.'); }
    setBusy(false);
  }

  function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setError(''); setRestored(false);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const missing = REQUIRED.filter(k => !Array.isArray(parsed[k]));
        if (missing.length) { setError('That file isn’t a complete IMSS Records backup (missing ' + missing.join(', ') + '). Nothing was changed.'); return; }
        setConfirmRestore(parsed);
      } catch (err) { setError('That file could not be read. Use the .json backup downloaded from this page.'); }
    };
    reader.readAsText(file);
  }

  async function applyRestore() {
    const data = confirmRestore;
    const keys = Object.keys(data).filter(k => !skip.has(k));
    setBusy(true); setError('');
    try {
      if (supabase) {
        // Keep a copy of what's here now, then write every section from the file and reload.
        const before = await liveSections();
        saveFile('imss-records-before-restore-' + todayStr() + '.json', { exportedAt: new Date().toISOString(), source: 'IMSS Records', ...before });
        const { error: err } = await supabase.from('app_data').upsert(keys.map(key => ({ key, value: data[key], updated_at: new Date().toISOString() })));
        if (err) throw err;
        logActivity('restored a backup', (data.backupOf || data.exportedAt || 'file') + ' · ' + keys.length + ' sections');
        window.location.reload();
        return;
      }
      keys.forEach(k => { if (updaters[k]) updaters[k](data[k]); });
      setRestored(true);
    } catch (e) { setError('Restore failed: ' + (e.message || e) + '. Check the data before trying again.'); }
    setBusy(false); setConfirmRestore(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }
  function cancelRestore() { setConfirmRestore(null); if (fileInputRef.current) fileInputRef.current.value = ''; }

  return (
    <div>
      <SectionHeader title="Backup &amp; Restore" description="Admin only. Download a full copy of the dashboard, get any of the last 30 days’ automatic backups, or restore from a backup file." />
      {restored && <div className="rounded px-3 py-2 text-xs mb-6" style={{ background: C.tealSoft, color: C.teal, border: '1px solid ' + C.teal }}>Backup restored.</div>}
      {error && <div className="rounded px-3 py-2 text-sm mb-6" role="alert" style={{ background: C.redSoft, color: C.red }}>{error}</div>}

      <div className="rounded p-5 mb-6" style={{ background: C.panel }}>
        <div style={{ fontWeight: 600 }} className="mb-1">Download a backup now</div>
        <div className="text-sm mb-3" style={{ color: C.textDim }}>Every section of the dashboard in one file, read straight from the database: artists, catalog, royalties, money received, published earnings, statements, payouts, invoices, deals and licenses, team and settings.</div>
        <div className="flex gap-2 flex-wrap">
          <Btn variant="primary" onClick={downloadBackup} disabled={busy}><FileDown size={14} /> Download full backup (JSON)</Btn>
          <Btn variant="ghost" onClick={downloadWorkbook} disabled={busy}><FileSpreadsheet size={14} /> Download as Excel workbook</Btn>
        </div>
        <div className="text-xs mt-2" style={{ color: C.textFaint }}>The Excel workbook is for reading; restoring needs the JSON file.</div>
      </div>

      {supabase && (
        <div className="rounded p-5 mb-6" style={{ background: C.panel }}>
          <div className="inline-flex items-center gap-2 mb-1" style={{ fontWeight: 600 }}><History size={15} aria-hidden="true" /> Automatic backups</div>
          <div className="text-sm mb-3" style={{ color: C.textDim }}>Taken every day at 02:30 UTC on the server and kept for 30 days.</div>
          {autos === null ? <div className="text-sm" style={{ color: C.textDim }}>Loading…</div> : autos.length === 0 ? <div className="text-sm" style={{ color: C.textDim }}>The first one runs tonight.</div> : (
            <ul style={{ borderTop: '1px solid ' + C.border }}>
              {autos.map(b => (
                <li key={b.archive_id} className="flex items-center justify-between gap-3" style={{ padding: '10px 0', borderBottom: '1px solid ' + C.border, fontSize: 14 }}>
                  <span>{formatDate(String(b.taken_at).slice(0, 10))} <span style={{ color: C.textDim }}>· {b.sections} sections</span></span>
                  <button onClick={() => downloadAuto(b)} style={{ color: C.amber, fontSize: 14 }}>Download</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="rounded p-5" style={{ background: C.panel }}>
        <div style={{ fontWeight: 600 }} className="mb-1">Restore from a backup file</div>
        <div className="text-sm mb-3" style={{ color: C.textDim }}>Replaces the sections in the file with the file’s contents, for everyone. A copy of what’s here now downloads first, then the page reloads.</div>
        <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFile} className="text-sm" style={{ color: C.textDim }} />
        {confirmRestore && (
          <div className="rounded p-3 mt-3" style={{ border: '1px solid ' + C.amber, background: C.amberSoft }}>
            <div className="text-sm mb-3">Restore this backup{confirmRestore.exportedAt ? ' from ' + new Date(confirmRestore.exportedAt).toLocaleString() : ''}? It overwrites {Object.keys(confirmRestore).filter(k => !skip.has(k)).length} sections for everyone.</div>
            <div className="flex gap-2">
              <Btn variant="primary" onClick={applyRestore} disabled={busy}>{busy ? 'Restoring…' : 'Yes, restore'}</Btn>
              <Btn variant="ghost" onClick={cancelRestore}>Cancel</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
