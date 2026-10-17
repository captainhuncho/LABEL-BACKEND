// Label Rep view inside ops. A rep is an outside partner with the role
// 'Label Rep' on the Team list. The database gives them only rep_portal():
// their artists' releases a PM confirmed, and invoices pushed to them. They
// download both, and mark a pushed invoice as sent to the partner (DP Queue).
import { useEffect, useMemo, useState } from 'react';
import { Calendar, FileDown, FileSpreadsheet, FileText, LogOut, Send } from 'lucide-react';
import { supabase } from './storage.js';
import { logSignIn } from './audit.js';
import { formatCurrency, formatDate, todayStr } from './constants.js';
import { C, CANVAS_GRADIENT, GLOBAL_STYLES, HEADING_FONT, LOGO_DATA_URI } from './theme.js';
import { Badge, Btn, EmptyState, exportRowsToCsv, exportRowsToExcel } from './ui.jsx';
import { MobileNav } from './MobileNav.jsx';
import { usePageUrl } from './pageUrl.js';
import { NotificationBell } from './sections/Notifications.jsx';
import { RELEASE_SHEET_HEADERS, exportRecordsToWord, releaseSheetRow } from './releaseSheet.js';

const PAGES = [
  { id: 'releases', label: 'Release schedule', icon: Calendar },
  { id: 'invoices', label: 'Invoices', icon: FileText },
];
const day = s => String(s || '').slice(0, 10);
const TONE = { 'DP Queue': 'amber', 'Pay Approved': 'teal', Paid: 'teal', Rejected: 'red' };

export default function RepApp({ signOut }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState('releases');
  usePageUrl(PAGES, page, setPage);

  async function load() {
    const { data: d, error: err } = await supabase.rpc('rep_portal');
    if (err || !d) { setError('Could not load your releases and invoices. Try again in a moment.'); return; }
    setData(d); logSignIn('rep', d.rep.name);
  }
  useEffect(() => { load(); }, []);

  if (error) return <div className="p-8 text-sm" role="alert" style={{ color: C.text, fontFamily: HEADING_FONT }}>{error}</div>;
  if (!data) return null;
  const artistById = Object.fromEntries((data.artists || []).map(a => [a.id, a]));

  return (
    <div style={{ background: CANVAS_GRADIENT, fontFamily: HEADING_FONT, color: C.text }} className="w-full overflow-hidden imss-shell">
      <style>{GLOBAL_STYLES}</style>
      <div className="imss-sidebar shrink-0" style={{ borderColor: C.border, background: C.panel }}>
        <div className="imss-desktop-only px-5 pt-6 pb-4">
          <img src={LOGO_DATA_URI} alt="IMSS Records" style={{ height: 26, width: 'auto' }} />
          <div className="text-xs mt-1" style={{ color: C.textFaint }}>{data.rep.company || 'Label rep'}</div>
        </div>
        <nav className="imss-nav gap-1 px-2 py-2">
          {PAGES.map(p => {
            const Icon = p.icon, on = page === p.id;
            return <button key={p.id} onClick={() => setPage(p.id)} aria-current={on ? 'page' : undefined} className="flex items-center gap-2 px-3 py-2 rounded text-sm whitespace-nowrap" style={{ background: on ? C.amberSoft : 'transparent', color: on ? C.amber : C.textDim, fontWeight: on ? 600 : 500 }}><Icon size={16} />{p.label}</button>;
          })}
        </nav>
        <div className="imss-desktop-only mt-auto px-5 py-4 text-xs" style={{ color: C.textDim }}>
          <div className="flex items-center justify-between gap-2"><span>{data.rep.name}</span><button onClick={signOut} aria-label="Sign out" style={{ color: C.textFaint }}><LogOut size={13} /></button></div>
        </div>
      </div>
      <div className="flex-1 min-w-0 imss-content">
        <div className="imss-content-inner" style={{ maxWidth: 1120 }}>
          <div className="flex items-center justify-end gap-2 mb-4">
            <NotificationBell routes={{ release: 'releases', submission: 'releases', invoice: 'invoices' }} onOpen={setPage} />
            <button onClick={signOut} className="inline-flex items-center gap-1.5" style={{ background: C.fill, color: C.text, borderRadius: 980, padding: '8px 12px', fontSize: 14 }}><LogOut size={15} /> <span className="imss-alerts-label">Sign out</span></button>
          </div>
          {page === 'releases' ? <Releases releases={data.releases || []} artistById={artistById} /> : <Invoices invoices={data.invoices || []} artistById={artistById} reload={load} />}
        </div>
      </div>
      <MobileNav nav={PAGES} active={page} setActive={setPage} role="rep" account={[{ label: 'Sign out', icon: LogOut, onClick: signOut, danger: true }]} />
    </div>
  );
}

function Releases({ releases, artistById }) {
  const [picked, setPicked] = useState([]);
  const today = todayStr();
  const sorted = useMemo(() => [...releases].sort((a, b) => String(a.releaseDate || '9999').localeCompare(String(b.releaseDate || '9999'))), [releases]);
  const upcoming = sorted.filter(r => !r.releaseDate || r.releaseDate >= today);
  const past = sorted.filter(r => r.releaseDate && r.releaseDate < today).reverse();
  const chosen = picked.length ? sorted.filter(r => picked.includes(r.id)) : sorted;
  const rows = chosen.map(r => releaseSheetRow(r, artistById[r.artistId]));
  const name = 'imss-releases-' + today;
  const toggle = id => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const card = r => {
    const a = artistById[r.artistId] || {};
    const updated = r.repConfirmedAt && r.repFirstConfirmedAt && r.repConfirmedAt !== r.repFirstConfirmedAt;
    return (
      <li key={r.id} className="rounded p-4 flex gap-3 items-start" style={{ background: C.panel }}>
        <input type="checkbox" checked={picked.includes(r.id)} onChange={() => toggle(r.id)} aria-label={'Select ' + r.title} style={{ marginTop: 4 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div style={{ fontWeight: 600, fontSize: 16 }}>{r.title} <span style={{ color: C.textDim, fontWeight: 400 }}>· {a.name}</span></div>
            <div style={{ fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>{formatDate(r.releaseDate)}</div>
          </div>
          <div className="text-sm mt-1 flex gap-2 flex-wrap items-center" style={{ color: C.textDim }}>
            <span>{r.type || 'Release'}</span>
            {r.isrc && <span>ISRC {r.isrc}</span>}
            {r.upc && <span>UPC {r.upc}</span>}
            {updated && <Badge tone="amber">Updated {formatDate(day(r.repConfirmedAt))}</Badge>}
          </div>
        </div>
        <button onClick={() => exportRecordsToWord(r.title.replace(/\s+/g, '-').toLowerCase(), r.title + ' · ' + (a.name || ''), RELEASE_SHEET_HEADERS, [releaseSheetRow(r, a)])} aria-label={'Download ' + r.title + ' as Word'} title="Download as Word" style={{ color: C.textDim }}><FileDown size={16} /></button>
      </li>
    );
  };

  return (
    <div>
      <h1 className="imss-title">Release schedule</h1>
      <p className="mb-5" style={{ color: C.textDim, fontSize: 17 }}>Releases your IMSS Records Product Manager has confirmed, with everything distributors and publishers ask for.</p>
      {releases.length === 0 ? <EmptyState icon={Calendar} title="No releases confirmed yet" description="When a Product Manager confirms a release for you, it appears here and you get an email." /> : <>
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span className="text-sm" style={{ color: C.textDim, marginRight: 4 }}>{picked.length ? 'Download ' + picked.length + ' selected:' : 'Download all ' + sorted.length + ':'}</span>
          <Btn variant="ghost" onClick={() => exportRowsToCsv(name, RELEASE_SHEET_HEADERS, rows)}><FileText size={14} /> CSV</Btn>
          <Btn variant="ghost" onClick={() => exportRowsToExcel(name, RELEASE_SHEET_HEADERS, rows)}><FileSpreadsheet size={14} /> Excel</Btn>
          <Btn variant="ghost" onClick={() => exportRecordsToWord(name, 'IMSS Records releases', RELEASE_SHEET_HEADERS, rows)}><FileDown size={14} /> Word / Google Docs</Btn>
          {picked.length > 0 && <button onClick={() => setPicked([])} style={{ color: C.amber, fontSize: 14 }}>Clear selection</button>}
        </div>
        <h2 style={{ fontWeight: 600, fontSize: 17, margin: '8px 0 10px' }}>Upcoming</h2>
        {upcoming.length ? <ul className="flex flex-col gap-2 mb-6">{upcoming.map(card)}</ul> : <p className="mb-6" style={{ color: C.textDim }}>Nothing scheduled yet.</p>}
        {past.length > 0 && <><h2 style={{ fontWeight: 600, fontSize: 17, margin: '8px 0 10px' }}>Released</h2><ul className="flex flex-col gap-2">{past.map(card)}</ul></>}
      </>}
    </div>
  );
}

const INVOICE_HEADERS = ['Invoice', 'Artist', 'Type', 'Amount', 'Invoice number', 'Payee', 'Details', 'Submitted', 'Sent to you', 'Status'];
const invoiceRow = (i, a) => [i.title, a.name || '', i.kind === 'expense' ? 'Expense claim' : 'Service invoice', Number(i.amount || 0).toFixed(2), i.invoiceNumber || '', i.payee || '', i.details || '', day(i.submittedAt), day(i.sentToRepAt), i.status];

function Invoices({ invoices, artistById, reload }) {
  const [openId, setOpenId] = useState(null);
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const sorted = [...invoices].sort((a, b) => String(b.sentToRepAt).localeCompare(String(a.sentToRepAt)));
  const waiting = sorted.filter(i => !['DP Queue', 'Pay Approved', 'Paid', 'Rejected'].includes(i.status));
  const done = sorted.filter(i => !waiting.includes(i));
  async function markSent(inv) {
    setBusy(true); setMsg('');
    const { error } = await supabase.rpc('rep_mark_sent', { invoice_id: inv.id, ref: ref.trim() });
    setBusy(false);
    if (error) { setMsg('Couldn’t update it. Refresh and try again.'); return; }
    setRef(''); setOpenId(null); setMsg('Marked as sent to the partner. It’s now in DP Queue.'); reload();
  }
  const row = (inv, canSend) => {
    const a = artistById[inv.artistId] || {};
    const open = openId === inv.id;
    return (
      <li key={inv.id} className="rounded p-4" style={{ background: C.panel }}>
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div style={{ fontWeight: 600, fontSize: 16 }}>{inv.title} <span style={{ color: C.textDim, fontWeight: 400 }}>· {a.name}</span></div>
          <div style={{ fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(Number(inv.amount || 0))}</div>
        </div>
        <div className="text-sm mt-1 flex gap-2 flex-wrap items-center" style={{ color: C.textDim }}>
          <Badge tone={TONE[inv.status] || 'default'}>{canSend ? 'Waiting for you' : inv.status}</Badge>
          <span>Sent to you {formatDate(day(inv.sentToRepAt))}</span>
          {inv.repSentAt && <span>· To partner {formatDate(day(inv.repSentAt))}{inv.repRef ? ' (ref ' + inv.repRef + ')' : ''}</span>}
        </div>
        {inv.details && <p className="text-sm mt-2" style={{ color: C.text, whiteSpace: 'pre-wrap' }}>{inv.details}</p>}
        <div className="flex gap-2 flex-wrap mt-3">
          <Btn variant="ghost" onClick={() => exportRecordsToWord('invoice-' + (inv.invoiceNumber || inv.id), 'Invoice: ' + inv.title, INVOICE_HEADERS, [invoiceRow(inv, a)])}><FileDown size={14} /> Download</Btn>
          {canSend && !open && <Btn variant="primary" onClick={() => { setOpenId(inv.id); setRef(''); }}><Send size={14} /> Sent to partner</Btn>}
        </div>
        {open && (
          <div className="mt-3 flex gap-2 flex-wrap items-center">
            <input value={ref} onChange={e => setRef(e.target.value)} maxLength={300} placeholder="Partner reference (optional)" aria-label="Partner reference" style={{ flex: '1 1 220px', background: 'var(--field)', color: C.text, border: '1px solid var(--field-line)', borderRadius: 12, padding: '10px 12px' }} />
            <Btn variant="primary" onClick={() => markSent(inv)} disabled={busy}>{busy ? 'Saving…' : 'Confirm: move to DP Queue'}</Btn>
            <Btn variant="ghost" onClick={() => setOpenId(null)}>Cancel</Btn>
          </div>
        )}
      </li>
    );
  };
  return (
    <div>
      <h1 className="imss-title">Invoices</h1>
      <p className="mb-5" style={{ color: C.textDim, fontSize: 17 }}>Invoices IMSS Records sent you to settle. Download each one, send it to the partner, then mark it sent here.</p>
      {msg && <div role="status" className="mb-4 text-sm" style={{ color: /Couldn/.test(msg) ? C.red : C.teal }}>{msg}</div>}
      {invoices.length === 0 ? <EmptyState icon={FileText} title="No invoices sent to you yet" description="When a Product Manager sends you an invoice, it appears here and you get an email." /> : <>
        <div className="flex gap-2 flex-wrap mb-4">
          <Btn variant="ghost" onClick={() => exportRowsToCsv('imss-invoices-' + todayStr(), INVOICE_HEADERS, sorted.map(i => invoiceRow(i, artistById[i.artistId] || {})))}><FileText size={14} /> CSV</Btn>
          <Btn variant="ghost" onClick={() => exportRowsToExcel('imss-invoices-' + todayStr(), INVOICE_HEADERS, sorted.map(i => invoiceRow(i, artistById[i.artistId] || {})))}><FileSpreadsheet size={14} /> Excel</Btn>
        </div>
        <h2 style={{ fontWeight: 600, fontSize: 17, margin: '8px 0 10px' }}>Waiting for you</h2>
        {waiting.length ? <ul className="flex flex-col gap-2 mb-6">{waiting.map(i => row(i, true))}</ul> : <p className="mb-6" style={{ color: C.textDim }}>Nothing waiting. You’re up to date.</p>}
        {done.length > 0 && <><h2 style={{ fontWeight: 600, fontSize: 17, margin: '8px 0 10px' }}>Sent to partner</h2><ul className="flex flex-col gap-2">{done.map(i => row(i, false))}</ul></>}
      </>}
    </div>
  );
}
