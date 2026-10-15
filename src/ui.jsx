// Shared UI primitives — buttons, fields, tables, cards, export bars.
import { Download, FileSpreadsheet, Printer, X } from 'lucide-react';
import { useState } from 'react';
import * as XLSX from 'xlsx';
import { artworkColor, artworkInitials } from './constants.js';
import { C, HEADING_FONT, MONO_FONT } from './theme.js';

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
    <div style={{ ...style, background: artworkColor(release ? release.title : '?'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#14171A', fontWeight: 700, fontSize: Math.round(size * 0.34), fontFamily: HEADING_FONT }}>
      {artworkInitials(release ? release.title : '?')}
    </div>
  );
}

export function Avatar({ name, photoUrl, size = 40 }) {
  const style = { width: size, height: size, borderRadius: '50%', flexShrink: 0 };
  if (photoUrl) return <img src={photoUrl} alt="" style={{ ...style, objectFit: 'cover' }} />;
  return (
    <div style={{ ...style, background: artworkColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#14171A', fontWeight: 700, fontSize: Math.round(size * 0.36), fontFamily: HEADING_FONT }}>
      {artworkInitials(name)}
    </div>
  );
}
export const inputStyle = { background: 'rgba(20,23,26,0.85)', border: '1px solid rgba(255,255,255,0.18)', color: C.text, borderRadius: 10, padding: '7px 9px', fontSize: 13, fontFamily: HEADING_FONT };

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
    <label className={'flex flex-col gap-1 text-xs ' + (full ? 'imss-span-2' : '')} style={{ color: C.textDim }}>
      {label}
      {children}
    </label>
  );
}

export function Btn({ children, onClick, variant = 'ghost', type = 'button', disabled = false }) {
  const styles = {
    primary: { background: 'linear-gradient(135deg, ' + C.amber + ', #C77F1F)', color: '#1A1500', border: '1px solid rgba(231,162,61,0.6)' },
    ghost: { background: 'rgba(255,255,255,0.04)', color: C.text, border: '1px solid rgba(255,255,255,0.12)' },
    danger: { background: 'rgba(193,88,74,0.1)', color: C.red, border: '1px solid rgba(193,88,74,0.5)' },
  };
  return (
    <button type={type} onClick={disabled ? undefined : onClick} disabled={disabled} className="imss-btn rounded inline-flex items-center gap-1.5 text-sm px-3.5 py-2"
      style={{ ...styles[variant], fontWeight: 500, fontFamily: HEADING_FONT, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      {children}
    </button>
  );
}

export function Badge({ children, tone = 'default' }) {
  const map = {
    default: { bg: 'transparent', color: C.textDim, border: C.border },
    amber: { bg: C.amberSoft, color: C.amber, border: 'rgba(231,162,61,0.55)' },
    teal: { bg: C.tealSoft, color: C.teal, border: 'rgba(95,165,147,0.55)' },
    red: { bg: C.redSoft, color: C.red, border: 'rgba(193,88,74,0.55)' },
  };
  const s = map[tone] || map.default;
  return <span className="text-xs px-2 py-0.5 rounded inline-block" style={{ background: s.bg, color: s.color, border: '1px solid ' + s.border, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em', fontSize: 10.5 }}>{children}</span>;
}

export function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="text-center py-14 border rounded" style={{ borderColor: C.border, borderStyle: 'dashed' }}>
      <Icon size={22} style={{ color: C.textFaint, margin: '0 auto 10px' }} />
      <div style={{ fontWeight: 600 }}>{title}</div>
      {description && <div className="text-sm mt-1 px-6" style={{ color: C.textDim }}>{description}</div>}
    </div>
  );
}

export function exportRowsToCsv(filename, headers, rows) {
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

export function exportRowsToExcel(filename, headers, rows) {
  try {
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
      <Btn variant="ghost" onClick={() => window.print()}><Printer size={14} /> Print / PDF</Btn>
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
    <div className="imss-kpi rounded p-4 border flex-1" style={{ background: C.panel, borderColor: C.border, minWidth: 170, maxWidth: 340 }}>
      <div className="flex items-center gap-2 mb-3" style={{ color: C.textFaint }}>
        <Icon size={14} />
        <span className="text-xs">{label}</span>
      </div>
      <div style={{ fontFamily: MONO_FONT, fontSize: 22, fontWeight: 600, color: accent }}>{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color: C.textFaint }}>{sub}</div>}
    </div>
  );
}

export function SectionHeader({ title, description, action }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{title}</h2>
        {description && <p className="text-sm mt-1" style={{ color: C.textDim, maxWidth: 520 }}>{description}</p>}
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
