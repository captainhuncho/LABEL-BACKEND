// Shared UI primitives — buttons, fields, tables, cards, export bars.
import { Download, FileSpreadsheet, Printer, X } from 'lucide-react';
import { useState } from 'react';
import { documentUrl } from './storage.js';
import { artworkColor, artworkInitials } from './constants.js';
import { C, HEADING_FONT, MONO_FONT } from './theme.js';
import { logActivity } from './audit.js';

export function resizeImageFile(file, size, callback) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale, h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      callback(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

export function ArtworkThumb({ release, size = 40, radius = 6 }) {
  const style = { width: size, height: size, borderRadius: radius, flexShrink: 0 };
  if (release && release.artworkUrl) {
    return <img src={release.artworkUrl} alt="" style={{ ...style, objectFit: 'cover' }} />;
  }
  return (
    <div style={{ ...style, background: artworkColor(release ? release.title : '?'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d1d1f', fontWeight: 700, fontSize: Math.round(size * 0.34), fontFamily: HEADING_FONT }}>
      {artworkInitials(release ? release.title : '?')}
    </div>
  );
}

export function Avatar({ name, photoUrl, size = 40 }) {
  const style = { width: size, height: size, borderRadius: '50%', flexShrink: 0 };
  if (photoUrl) return <img src={photoUrl} alt="" style={{ ...style, objectFit: 'cover' }} />;
  return (
    <div style={{ ...style, background: artworkColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d1d1f', fontWeight: 700, fontSize: Math.round(size * 0.36), fontFamily: HEADING_FONT }}>
      {artworkInitials(name)}
    </div>
  );
}
export const inputStyle = { background: 'var(--field)', border: '1px solid var(--field-line)', color: C.text, borderRadius: 12, padding: '9px 12px', fontSize: 15, fontFamily: HEADING_FONT, minHeight: 40 };

export function Input(props) {
  const { style, className, ...rest } = props;
  return <input {...rest} style={{ ...inputStyle, ...(style || {}) }} className={'w-full ' + (className || '')} />;
}
export function Select({ children, style, className, ...rest }) {
  return <select {...rest} style={{ ...inputStyle, ...(style || {}) }} className={'w-full ' + (className || '')}>{children}</select>;
}
export function TextArea(props) {
  const { style, className, ...rest } = props;
  return <textarea {...rest} style={{ ...inputStyle, ...(style || {}), resize: 'vertical' }} className={'w-full ' + (className || '')} />;
}

export function Field({ label, children, full }) {
  return (
    <label className={'flex flex-col gap-1.5 ' + (full ? 'imss-span-2' : '')} style={{ color: C.textDim, fontSize: 13 }}>
      {label}
      {children}
    </label>
  );
}

export function Btn({ children, onClick, variant = 'ghost', type = 'button', disabled = false }) {
  // Apple-style pills: filled amber for the main action, soft grey for the rest.
  const styles = {
    primary: { background: C.amberFill, color: C.onAmber },
    ghost: { background: C.fill, color: C.text },
    danger: { background: C.redSoft, color: C.red },
  };
  return (
    <button type={type} onClick={disabled ? undefined : onClick} disabled={disabled} className={'imss-btn inline-flex items-center justify-center gap-1.5 is-' + variant}
      style={{ ...styles[variant], fontFamily: HEADING_FONT, opacity: disabled ? 0.45 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      {children}
    </button>
  );
}

export function Badge({ children, tone = 'default' }) {
  const map = {
    default: { bg: C.fill, color: C.textDim },
    amber: { bg: C.amberSoft, color: C.amber },
    teal: { bg: C.tealSoft, color: C.teal },
    red: { bg: C.redSoft, color: C.red },
  };
  const s = map[tone] || map.default;
  return <span className="inline-block" style={{ background: s.bg, color: s.color, fontWeight: 600, fontSize: 12, padding: '3px 10px', borderRadius: 9999, whiteSpace: 'nowrap' }}>{children}</span>;
}

export function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="text-center py-16 rounded" style={{ background: C.panel }}>
      <Icon size={28} strokeWidth={1.5} style={{ color: C.textDim, margin: '0 auto 12px' }} />
      <div style={{ fontWeight: 600, fontSize: 19, letterSpacing: '-0.02em' }}>{title}</div>
      {description && <div className="mt-1.5 px-6 mx-auto" style={{ color: C.textDim, fontSize: 15, maxWidth: 460 }}>{description}</div>}
    </div>
  );
}

// Every CSV/Excel export anywhere is audited here, once.
export function exportRowsToCsv(filename, headers, rows) {
  logActivity('exported CSV', filename + ' (' + rows.length + ' rows)');
  const csv = [headers, ...rows]
    .map(r => r.map(v => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename + '.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// xlsx is loaded only when someone exports, to keep the first page load small.
export async function exportRowsToExcel(filename, headers, rows) {
  logActivity('exported Excel', filename + ' (' + rows.length + ' rows)');
  try {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, filename + '.xlsx');
  } catch (e) {
    exportRowsToCsv(filename, headers, rows);
  }
}

export function ExportBar({ filename, headers, rows }) {
  return (
    <div className="imss-print-hide flex gap-2 flex-wrap mb-4">
      <Btn variant="ghost" onClick={() => exportRowsToCsv(filename, headers, rows)}><Download size={14} /> CSV</Btn>
      <Btn variant="ghost" onClick={() => exportRowsToExcel(filename, headers, rows)}><FileSpreadsheet size={14} /> Excel</Btn>
      <Btn variant="ghost" onClick={() => { logActivity('printed / saved PDF', filename); window.print(); }}><Printer size={14} /> Print / PDF</Btn>
    </div>
  );
}

export function ConfirmInline({ onConfirm, onCancel, label }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs whitespace-nowrap" style={{ color: C.textDim }}>
      {label || 'Delete?'}
      <button onClick={onConfirm} style={{ color: C.red, fontWeight: 600 }}>Yes</button>
      <button onClick={onCancel} style={{ color: C.textDim }}>Cancel</button>
    </span>
  );
}

export function Th({ children, align }) {
  return <th className="text-xs font-medium px-3 py-2" style={{ color: C.textFaint, textAlign: align || 'left', borderBottom: '1px solid ' + C.border, whiteSpace: 'nowrap' }}>{children}</th>;
}
export function Td({ children, align, mono }) {
  return <td className="px-3 py-2.5 text-sm" style={{ textAlign: align || 'left', borderBottom: '1px solid ' + C.border, fontFamily: mono ? MONO_FONT : HEADING_FONT }}>{children}</td>;
}

export function SegmentedToggle({ options, value, onChange }) {
  return (
    <>
      {options.map(opt => (
        <button key={opt.id} onClick={() => onChange(opt.id)} className="text-sm px-3 py-1.5 rounded"
          style={{ background: value === opt.id ? C.amberSoft : 'transparent', color: value === opt.id ? C.amber : C.textDim, border: '1px solid ' + (value === opt.id ? 'transparent' : C.border), fontWeight: value === opt.id ? 600 : 500 }}>
          {opt.label}
        </button>
      ))}
    </>
  );
}

export function KPICard({ icon: Icon, label, value, sub, tone }) {
  const accent = tone === 'amber' ? C.amber : tone === 'teal' ? C.teal : tone === 'red' ? C.red : C.text;
  return (
    <div className="imss-kpi rounded flex-1" style={{ background: C.panel, minWidth: 170, maxWidth: 340, padding: '18px 20px' }}>
      <div className="flex items-center gap-2 mb-2" style={{ color: C.textDim }}>
        <Icon size={15} />
        <span style={{ fontSize: 13 }}>{label}</span>
      </div>
      <div style={{ fontFamily: MONO_FONT, fontSize: 28, fontWeight: 700, letterSpacing: '-0.025em', color: accent, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div className="mt-1" style={{ color: C.textDim, fontSize: 13 }}>{sub}</div>}
    </div>
  );
}

export function SectionHeader({ title, description, action, artistNote }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
      <div>
        <h2 className="imss-title">{title}</h2>
        {description && <p className="mt-2" style={{ color: C.textDim, maxWidth: 640, fontSize: 17, lineHeight: 1.45 }}>{description}</p>}
        {artistNote && <p className="mt-2" style={{ color: C.textDim, maxWidth: 640, fontSize: 14 }}><b style={{ color: C.text }}>Artists see:</b> {artistNote}</p>}
      </div>
      {action}
    </div>
  );
}

// Several people in one credit field. Stored as a comma-separated string so
// exports and the distributor sheet stay unchanged; shown as removable chips.
export function PeopleInput({ value, onChange, placeholder = 'Type a name, then Enter', label }) {
  const people = String(value || '').split(',').map(x => x.trim()).filter(Boolean);
  const [draft, setDraft] = useState('');
  const save = list => onChange(list.join(', '));
  function commit(text) {
    const names = text.split(',').map(x => x.trim()).filter(Boolean).filter(n => !people.some(p => p.toLowerCase() === n.toLowerCase()));
    if (names.length) save([...people, ...names]);
    setDraft('');
  }
  return (
    <div className="imss-people">
      {people.map((p, i) => (
        <span key={p + i} className="imss-people-chip">
          {p}
          <button type="button" onClick={e => { e.preventDefault(); save(people.filter((_, j) => j !== i)); }} aria-label={'Remove ' + p}><X size={12} /></button>
        </span>
      ))}
      <input
        aria-label={label}
        value={draft}
        onChange={e => { const v = e.target.value; if (v.includes(',')) commit(v); else setDraft(v); }}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit(draft); }
          else if (e.key === 'Backspace' && !draft && people.length) save(people.slice(0, -1));
        }}
        onBlur={() => draft.trim() && commit(draft)}
        placeholder={people.length ? 'Add another' : placeholder}
      />
    </div>
  );
}

// Drop a file anywhere on this box, or use the file input inside it.
// onFiles gets the same { target: { files } } shape an input's onChange does.
export function DropZone({ onFiles, accept = '', children, className = '', style }) {
  const [over, setOver] = useState(false);
  const ok = file => !accept || accept.split(',').some(a => { a = a.trim().toLowerCase(); return a.startsWith('.') ? file.name.toLowerCase().endsWith(a) : a.endsWith('/*') ? file.type.startsWith(a.slice(0, -1)) : file.type === a; });
  return (
    <div className={className}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; if (!over) setOver(true); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false); }}
      onDrop={e => { e.preventDefault(); setOver(false); const files = [...(e.dataTransfer.files || [])].filter(ok); if (files.length) onFiles({ target: { files } }); }}
      style={{ ...style, ...(over ? { borderColor: C.amber, background: C.amberSoft } : {}), transition: 'border-color 120ms, background 120ms' }}>
      {children}
      {over && <div className="text-xs mt-2" style={{ color: C.amber, fontWeight: 600 }}>Drop to upload</div>}
    </div>
  );
}

// A stored file (data URL or "doc:" path in the documents bucket): opens a short-lived link.
export function DocLink({ value, name, children, style }) {
  const [err, setErr] = useState('');
  if (!value) return null;
  async function open(e) {
    e.preventDefault(); setErr('');
    try {
      const url = await documentUrl(value, name);
      const a = document.createElement('a'); a.href = url; a.download = name || 'file'; a.rel = 'noopener'; a.target = '_blank';
      document.body.appendChild(a); a.click(); a.remove();
    } catch (x) { setErr('Could not open the file.'); }
  }
  return <><a href="#" onClick={open} style={{ color: C.amber, textDecoration: 'underline', textUnderlineOffset: 3, ...style }}>{children || name || 'Open file'}</a>{err && <span role="alert" style={{ color: C.red, fontSize: 12, marginLeft: 6 }}>{err}</span>}</>;
}
