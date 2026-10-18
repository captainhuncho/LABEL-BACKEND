// Shared UI primitives — buttons, fields, tables, cards, export bars.
import { Download, FileSpreadsheet, Printer, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { documentUrl } from './storage.js';
import { artworkColor, artworkInitials, REPORTING_LAG_NOTE, reportingLagExample } from './constants.js';
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

// Lets someone choose how their photo sits in the circle: drag to move, slider
// to zoom. Saves a square JPEG of `size` px of exactly what the circle shows.
export function PhotoCropper({ file, size = 300, onDone, onCancel }) {
  const VIEW = 240;
  const [src, setSrc] = useState(null);
  const [nat, setNat] = useState(null); // natural width/height
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 }); // offset of image centre from circle centre, in view px
  const drag = useRef(null);
  useEffect(() => {
    const r = new FileReader();
    r.onload = () => { const img = new Image(); img.onload = () => { setNat({ w: img.width, h: img.height, img }); setSrc(r.result); }; img.src = r.result; };
    r.readAsDataURL(file);
  }, [file]);
  if (!src || !nat) return null;
  const base = Math.max(VIEW / nat.w, VIEW / nat.h); // cover the circle at zoom 1
  const w = nat.w * base * zoom, h = nat.h * base * zoom;
  const clamp = p => ({ x: Math.min((w - VIEW) / 2, Math.max(-(w - VIEW) / 2, p.x)), y: Math.min((h - VIEW) / 2, Math.max(-(h - VIEW) / 2, p.y)) });
  const at = clamp(pos);
  function down(e) { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX - at.x, y: e.clientY - at.y }; }
  function move(e) { if (drag.current) setPos(clamp({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y })); }
  function key(e) {
    const step = { ArrowLeft: [8, 0], ArrowRight: [-8, 0], ArrowUp: [0, 8], ArrowDown: [0, -8] }[e.key];
    if (step) { e.preventDefault(); setPos(clamp({ x: at.x + step[0], y: at.y + step[1] })); }
  }
  function done() {
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    const k = size / VIEW;
    c.getContext('2d').drawImage(nat.img, (VIEW / 2 + at.x - w / 2) * k, (VIEW / 2 + at.y - h / 2) * k, w * k, h * k);
    onDone(c.toDataURL('image/jpeg', 0.85));
  }
  return (
    <div role="dialog" aria-modal="true" aria-label="Position your photo" style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="rounded p-6" style={{ background: C.panel, color: C.text, width: '100%', maxWidth: 340, textAlign: 'center', fontFamily: HEADING_FONT }}>
        <h2 style={{ fontWeight: 700, fontSize: 19, marginBottom: 4 }}>Position your photo</h2>
        <p style={{ color: C.textDim, fontSize: 14, marginBottom: 16 }}>Drag to move it. Use the slider to zoom.</p>
        <div tabIndex={0} aria-label="Photo position. Use arrow keys to move." onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onKeyDown={key}
          style={{ width: VIEW, height: VIEW, borderRadius: '50%', overflow: 'hidden', position: 'relative', margin: '0 auto', cursor: 'grab', touchAction: 'none', background: C.fill, outlineOffset: 3 }}>
          <img src={src} alt="" draggable={false} style={{ position: 'absolute', width: w, height: h, maxWidth: 'none', left: VIEW / 2 + at.x - w / 2, top: VIEW / 2 + at.y - h / 2, userSelect: 'none', pointerEvents: 'none' }} />
        </div>
        <label className="flex items-center gap-3 mt-4" style={{ fontSize: 13, color: C.textDim }}>
          Zoom <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={e => setZoom(Number(e.target.value))} style={{ flex: 1, accentColor: C.amber }} />
        </label>
        <div className="flex gap-2 justify-center mt-5">
          <Btn variant="primary" onClick={done}>Use photo</Btn>
          <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        </div>
      </div>
    </div>
  );
}

export function ArtworkThumb({ release, size = 40, radius = 6 }) {
  const style = { width: size, height: size, borderRadius: radius, flexShrink: 0 };
  if (release && release.artworkUrl) {
    return <img src={release.artworkUrl} alt="" style={{ ...style, objectFit: 'cover' }} />;
  }
  return (
    <div style={{ ...style, background: artworkColor(release ? release.title : '?'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d1d1f', fontWeight: 700, fontSize: typeof size === 'number' ? Math.round(size * 0.34) : 28, fontFamily: HEADING_FONT }}>
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
  if (props.type === 'month' && !MONTH_SUPPORTED) return <MonthPicker {...rest} style={style} />;
  return <input {...rest} style={{ ...inputStyle, ...(style || {}) }} className={'w-full ' + (className || '')} />;
}

// Firefox and desktop Safari have no month picker (type="month" becomes a plain
// text box), so there a month is picked from Month + Year drop-downs. Same
// value ("YYYY-MM") and onChange({ target: { value } }) as the native one.
export const MONTH_SUPPORTED = (() => { try { const i = document.createElement('input'); i.setAttribute('type', 'month'); return i.type === 'month'; } catch (e) { return true; } })();
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function MonthPicker({ value = '', onChange, min, max, required, disabled, style, id, 'aria-label': ariaLabel }) {
  const [y, m] = String(value || '').split('-');
  const now = new Date().getFullYear();
  const lo = min ? +String(min).slice(0, 4) : now - 10, hi = max ? +String(max).slice(0, 4) : now + 2;
  const years = []; for (let k = hi; k >= lo; k--) years.push(String(k));
  const emit = (yy, mm) => onChange && onChange({ target: { value: yy && mm ? yy + '-' + mm : '' } });
  const box = { ...inputStyle, flex: 1, minWidth: 0 };
  return (
    <span role="group" aria-label={ariaLabel || 'Month'} style={{ display: 'flex', gap: 6, width: '100%', ...(style || {}) }}>
      <select id={id} aria-label="Month" value={m || ''} required={required} disabled={disabled} onChange={e => emit(y || String(now), e.target.value)} style={box}>
        <option value="">Month</option>
        {MONTH_NAMES.map((n, i) => { const v = String(i + 1).padStart(2, '0'); return <option key={v} value={v}>{n}</option>; })}
      </select>
      <select aria-label="Year" value={y || ''} required={required} disabled={disabled} onChange={e => emit(e.target.value, m || '01')} style={{ ...box, flex: '0 0 96px' }}>
        <option value="">Year</option>
        {years.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
    </span>
  );
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

// The distribution partners' reporting lag, on every royalty, statement and payment screen.
export function ReportingLagNote({ className = 'mt-1 mb-4' }) {
  return (
    <div className={'text-sm ' + className} style={{ color: C.textDim }}>
      {REPORTING_LAG_NOTE}{' '}
      <details style={{ display: 'inline' }}>
        <summary style={{ display: 'inline', cursor: 'pointer', color: C.amber, textDecoration: 'underline', textUnderlineOffset: 3 }}>Example</summary>
        <span className="block mt-1">{reportingLagExample()}</span>
      </details>
    </div>
  );
}
