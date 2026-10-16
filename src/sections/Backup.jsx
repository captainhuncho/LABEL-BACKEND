import { FileDown, FileSpreadsheet } from 'lucide-react';
import { useRef, useState } from 'react';
import { todayStr } from '../constants.js';
import { C } from '../theme.js';
import { Btn, SectionHeader } from '../ui.jsx';

export function BackupSection({ allData, updaters, dataVersion }) {
  const [confirmRestore, setConfirmRestore] = useState(null);
  const [error, setError] = useState('');
  const [restored, setRestored] = useState(false);
  const fileInputRef = useRef(null);

  const BACKUP_KEYS = ['roster', 'catalog', 'revenue', 'streams', 'payouts', 'masterGross', 'labelSettings', 'staff', 'tasks', 'ledger', 'accessRequests', 'invoices'];

  function downloadBackup() {
    const payload = { exportedAt: new Date().toISOString(), dataVersion, source: 'IMSS Records Dashboard' };
    BACKUP_KEYS.forEach(k => { payload[k] = allData[k]; });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'imss-records-backup-' + todayStr() + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function downloadWorkbook() {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    BACKUP_KEYS.forEach(k => {
      const val = allData[k];
      if (!Array.isArray(val) || val.length === 0) return;
      const flat = val.map(row => {
        const out = {};
        Object.entries(row).forEach(([field, v]) => { out[field] = typeof v === 'object' && v !== null ? JSON.stringify(v) : v; });
        return out;
      });
      const ws = XLSX.utils.json_to_sheet(flat);
      XLSX.utils.book_append_sheet(wb, ws, k.slice(0, 31));
    });
    XLSX.writeFile(wb, 'imss-records-full-export-' + todayStr() + '.xlsx');
  }

  // labelSettings is an object; every other section is a list.
  const validSection = (data, k) => k === 'labelSettings' ? !!data[k] && typeof data[k] === 'object' && !Array.isArray(data[k]) : Array.isArray(data[k]);

  function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setError(''); setRestored(false);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const foundKeys = BACKUP_KEYS.filter(k => validSection(parsed, k));
        if (foundKeys.length === 0) { setError("That file doesn't look like an IMSS Records backup — no recognizable data found."); return; }
        setConfirmRestore(parsed);
      } catch (err) {
        setError('That file could not be read. Make sure it is the .json backup downloaded from this dashboard.');
      }
    };
    reader.readAsText(file);
  }

  function applyRestore() {
    if (!confirmRestore) return;
    BACKUP_KEYS.forEach(k => {
      if (updaters[k] && validSection(confirmRestore, k)) updaters[k](confirmRestore[k]);
    });
    setConfirmRestore(null);
    setRestored(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function cancelRestore() {
    setConfirmRestore(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div>
      <SectionHeader title="Backup &amp; Restore" description="Download a full snapshot of everything in this dashboard, or restore from a previous one. This is the safety net until the dashboard is connected to a real database." />

      {restored && (
        <div className="rounded px-3 py-2 text-xs mb-6" style={{ background: C.tealSoft, color: C.teal, border: '1px solid ' + C.teal }}>Backup restored successfully.</div>
      )}

      <div className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
        <div style={{ fontWeight: 600 }} className="mb-1">Download backup</div>
        <div className="text-sm mb-3" style={{ color: C.textDim }}>One JSON file with everything — roster, catalog, revenue, streams, earnings, payouts, expenses, team, and tasks. Keep this somewhere safe; it's the only copy outside this browser.</div>
        <div className="flex gap-2 flex-wrap">
          <Btn variant="primary" onClick={downloadBackup}><FileDown size={14} /> Download full backup (JSON)</Btn>
          <Btn variant="ghost" onClick={downloadWorkbook}><FileSpreadsheet size={14} /> Download as Excel workbook</Btn>
        </div>
        <div className="text-xs mt-2" style={{ color: C.textFaint }}>The Excel workbook is for reviewing data by hand — restore only works from the JSON file, since it preserves exact structure.</div>
      </div>

      <div className="rounded border p-4" style={{ background: C.panel, borderColor: C.border }}>
        <div style={{ fontWeight: 600 }} className="mb-1">Restore from backup</div>
        <div className="text-sm mb-3" style={{ color: C.textDim }}>This replaces everything currently in the dashboard with what's in the file. Download a fresh backup first if you want to keep what's here now.</div>
        <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFile} className="text-sm" style={{ color: C.textDim }} />
        {error && <div className="text-xs mt-2" style={{ color: C.red }}>{error}</div>}
        {confirmRestore && (
          <div className="rounded border p-3 mt-3" style={{ borderColor: C.amber, background: C.amberSoft }}>
            <div className="text-sm mb-3">
              Restore this backup{confirmRestore.exportedAt ? ', created ' + new Date(confirmRestore.exportedAt).toLocaleString() : ''}? This overwrites all current data and can't be undone from here.
            </div>
            <div className="flex gap-2">
              <Btn variant="primary" onClick={applyRestore}>Yes, restore</Btn>
              <Btn variant="ghost" onClick={cancelRestore}>Cancel</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
