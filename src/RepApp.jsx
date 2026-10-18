// Label Rep view inside ops. A rep is an outside partner with the role
// 'Label Rep' on the Team list. The database gives them only rep_portal():
// their artists' releases a PM confirmed, and invoices pushed to them. They
// download both, and mark a pushed invoice as sent to the partner (DP Queue).
import { useEffect, useMemo, useState } from 'react';
import { Calendar, FileDown, FileSpreadsheet, FileText, LogOut, Eye, Mail } from 'lucide-react';
import { documentUrl, supabase } from './storage.js';
import { logSignIn } from './audit.js';
import { formatCurrency, formatDate, todayStr } from './constants.js';
import { C, CANVAS_GRADIENT, GLOBAL_STYLES, HEADING_FONT, LOGO_DATA_URI } from './theme.js';
import { Badge, Btn, EmptyState, exportRowsToCsv, exportRowsToExcel, SectionHeader, ReleaseCountdown } from './ui.jsx';
import { MobileNav } from './MobileNav.jsx';
import { usePageUrl } from './pageUrl.js';
import { NotificationBell } from './sections/Notifications.jsx';
import { RELEASE_SHEET_HEADERS, exportRecordsToWord, releaseSheetRow } from './releaseSheet.js';
import LoadingScreen from './LoadingScreen.jsx';
import { PasskeySettings } from './Passkeys.jsx';
import { TwoFactorSettings } from './Mfa.jsx';

const PAGES = [
  { id: 'releases', label: 'Release schedule', icon: Calendar },
  { id: 'invoices', label: 'Invoices', icon: FileText },
];
const day = s => String(s || '').slice(0, 10);
const initials = n => String(n || '').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const TONE = { 'DP Queue': 'amber', 'Pay Approved': 'teal', Paid: 'teal', Rejected: 'red' };

// demo: { data } for the local preview (no database).
export default function RepApp({ signOut, demo = null }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState('releases');
  usePageUrl(PAGES, page, setPage);

  async function load() {
    if (demo) { setData(demo.data); return; }
    const { data: d, error: err } = await supabase.rpc('rep_portal');
    if (err || !d) { setError('Could not load your releases and invoices. Try again in a moment.'); return; }
    setData(d); logSignIn('rep', d.rep.name);
  }
  useEffect(() => { load(); }, [demo && demo.data]);
  // Confirm seen / sent out on an invoice or a release (a record for the team).
  async function acknowledge(kind, item, step, note = '') {
    if (demo) { demo.acknowledge && demo.acknowledge(kind, item.id, step, note); return ''; }
    const { error: err } = await supabase.rpc('rep_acknowledge', { kind, item_id: item.id, step, note });
    if (err) return 'Couldn’t save that. Try again in a moment.';
    await load(); return '';
  }
  // Email release sheets to the rep's own address (never anyone else's).
  async function emailReleases(list) {
    if (!list.length) return 'Pick at least one release.';
    if (demo) return 'Demo: in the live portal this emails ' + list.length + ' release' + (list.length === 1 ? '' : 's') + ' to you, with the release sheet attached.';
    const { error: err } = await supabase.rpc('rep_email_releases', { release_ids: list.map(r => r.id) });
    if (err) return /Too many/.test(err.message || '') ? 'Too many emails in the last hour. Try again later.' : 'Couldn’t send the email. Try again in a moment.';
    return 'Sent to your email: ' + list.length + ' release' + (list.length === 1 ? '' : 's') + ', with the release sheet attached.';
  }

  if (error) return <div className="p-8 text-sm" role="alert" style={{ color: C.text, fontFamily: HEADING_FONT }}>{error}</div>;
  if (!data) return <LoadingScreen variant="rep" />;
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
            {/* Your initials open the account menu (Appearance, Account & security, Sign out), as on ops. */}
            <button onClick={e => window.dispatchEvent(new CustomEvent('imss:open-account', { detail: e.currentTarget.getBoundingClientRect() }))} aria-label={'Your account: ' + data.rep.name} className="inline-flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: 9999, background: C.amberSoft, color: C.amber, fontWeight: 700, fontSize: 14, flex: '0 0 auto' }}>{initials(data.rep.name)}</button>
          </div>
          {page === 'account' ? <div><SectionHeader title="Account & security" description="How you sign in: passkeys for Face ID, your fingerprint or this device’s screen lock, and two-factor codes." /><PasskeySettings /><TwoFactorSettings /></div> : page === 'releases' ? <Releases releases={data.releases || []} artistById={artistById} emailReleases={emailReleases} acknowledge={acknowledge} /> : <Invoices invoices={data.invoices || []} artistById={artistById} acknowledge={acknowledge} />}
        </div>
      </div>
      <MobileNav nav={PAGES} active={page} setActive={setPage} role="rep" account={[{ label: 'Sign out', icon: LogOut, onClick: signOut, danger: true }]}
        profile={{ name: data.rep.name, role: 'Label rep', email: data.rep.email || '', onSecurity: () => setPage('account'), onSignOut: signOut }} />
    </div>
  );
}

function Releases({ releases, artistById, emailReleases, acknowledge }) {
  const [picked, setPicked] = useState([]);
  const [viewing, setViewing] = useState(null);
  const [mailMsg, setMailMsg] = useState('');
  async function mail(list) { setMailMsg('Sending…'); setMailMsg(await emailReleases(list)); }
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
            <button onClick={() => setViewing(r)} className="text-left" style={{ fontWeight: 600, fontSize: 16 }}>{r.title} <span style={{ color: C.textDim, fontWeight: 400 }}>· {a.name}</span></button>
            <div style={{ fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>{formatDate(r.releaseDate)}</div>
          </div>
          <div className="text-sm mt-1 flex gap-2 flex-wrap items-center" style={{ color: C.textDim }}>
            <span>{r.type || 'Release'}</span>
            {r.isrc && <span>ISRC {r.isrc}</span>}
            {r.upc && <span>UPC {r.upc}</span>}
            {updated && <Badge tone="amber">Updated {formatDate(day(r.repConfirmedAt))}</Badge>}
          </div>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <Btn variant="ghost" onClick={() => setViewing(r)} aria-label={'View ' + r.title}><Eye size={14} /> View</Btn>
          <Ack kind="release" item={r} acknowledge={acknowledge} compact />
        </div>
      </li>
    );
  };

  return (
    <div>
      <h1 className="imss-title">Release schedule</h1>
      <p className="mb-5" style={{ color: C.textDim, fontSize: 17 }}>Releases your IMSS Records Product Manager has confirmed, with everything distributors and publishers ask for.</p>
      <ReleaseCountdown releases={releases} artistMap={artistById} />
      {releases.length === 0 ? <EmptyState icon={Calendar} title="No releases confirmed yet" description="When a Product Manager confirms a release for you, it appears here and you get an email." /> : <>
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <span className="text-sm" style={{ color: C.textDim, marginRight: 4 }}>{picked.length ? 'Download ' + picked.length + ' selected:' : 'Download all ' + sorted.length + ':'}</span>
          <Btn variant="ghost" onClick={() => exportRowsToCsv(name, RELEASE_SHEET_HEADERS, rows)}><FileText size={14} /> CSV</Btn>
          <Btn variant="ghost" onClick={() => exportRowsToExcel(name, RELEASE_SHEET_HEADERS, rows)}><FileSpreadsheet size={14} /> Excel</Btn>
          <Btn variant="ghost" onClick={() => exportRecordsToWord(name, 'IMSS Records releases', RELEASE_SHEET_HEADERS, rows)}><FileDown size={14} /> Word / Google Docs</Btn>
          <Btn variant="ghost" onClick={() => mail(chosen)}><Mail size={14} /> Email {picked.length ? 'selected' : 'all'} to me</Btn>
          {picked.length > 0 && <button onClick={() => setPicked([])} style={{ color: C.amber, fontSize: 14 }}>Clear selection</button>}
        </div>
        {mailMsg && <div role="status" className="text-sm mb-3" style={{ color: /Couldn|Too many/.test(mailMsg) ? C.red : C.teal }}>{mailMsg}</div>}
        <h2 style={{ fontWeight: 600, fontSize: 17, margin: '8px 0 10px' }}>Upcoming</h2>
        {upcoming.length ? <ul className="flex flex-col gap-2 mb-6">{upcoming.map(card)}</ul> : <p className="mb-6" style={{ color: C.textDim }}>Nothing scheduled yet.</p>}
        {past.length > 0 && <><h2 style={{ fontWeight: 600, fontSize: 17, margin: '8px 0 10px' }}>Released</h2><ul className="flex flex-col gap-2">{past.map(card)}</ul></>}
      </>}
      {viewing && (() => {
        const a = artistById[viewing.artistId] || {};
        const vals = releaseSheetRow(viewing, a);
        const one = (viewing.title || 'release').replace(/\s+/g, '-').toLowerCase();
        return (
          <ViewSheet title={viewing.title} subtitle={a.name + ' · ' + formatDate(viewing.releaseDate)} onClose={() => { setViewing(null); setMailMsg(''); }}>
            <Fields headers={RELEASE_SHEET_HEADERS} values={vals} />
            <div className="flex gap-2 flex-wrap mt-4">
              <Btn variant="ghost" onClick={() => exportRecordsToWord(one, viewing.title + ' · ' + (a.name || ''), RELEASE_SHEET_HEADERS, [vals])}><FileDown size={14} /> Word</Btn>
              <Btn variant="ghost" onClick={() => exportRowsToExcel(one, RELEASE_SHEET_HEADERS, [vals])}><FileSpreadsheet size={14} /> Excel</Btn>
              <Btn variant="ghost" onClick={() => exportRowsToCsv(one, RELEASE_SHEET_HEADERS, [vals])}><FileText size={14} /> CSV</Btn>
              <Btn variant="primary" onClick={() => mail([viewing])}><Mail size={14} /> Email to me</Btn>
            </div>
            <div className="mt-4 pt-3" style={{ borderTop: '1px solid ' + C.border }}><Ack kind="release" item={releases.find(x => x.id === viewing.id) || viewing} acknowledge={acknowledge} /></div>
            {mailMsg && <div role="status" className="text-sm mt-3" style={{ color: /Couldn|Too many/.test(mailMsg) ? C.red : C.teal }}>{mailMsg}</div>}
          </ViewSheet>
        );
      })()}
    </div>
  );
}

// The rep confirms they've seen it, then that they've sent it out on their side.
function Ack({ kind, item, acknowledge, compact = false }) {
  const [busy, setBusy] = useState(false);
  const [noting, setNoting] = useState(false);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const go = async (step, n = '') => { setBusy(true); setErr(await acknowledge(kind, item, step, n)); setBusy(false); setNoting(false); setNote(''); };
  const chip = (label, at) => <Badge tone="teal">{label} {formatDate(day(at))}</Badge>;
  return (
    <div className={'flex gap-2 flex-wrap items-center' + (compact ? ' justify-end' : '')}>
      {item.repSeenAt ? chip('Seen', item.repSeenAt) : <Btn variant="ghost" disabled={busy} onClick={() => go('seen')}>Mark as seen</Btn>}
      {item.repSentOutAt ? <>{chip('Sent out', item.repSentOutAt)}{!compact && item.repSentOutNote && <span className="text-xs" style={{ color: C.textDim }}>{item.repSentOutNote}</span>}</>
        : noting ? (
          <span className="flex gap-2 flex-wrap items-center">
            <input value={note} onChange={e => setNote(e.target.value)} maxLength={300} placeholder="Who you sent it to (optional)" aria-label="Note" style={{ flex: '1 1 200px', background: 'var(--field)', color: C.text, border: '1px solid var(--field-line)', borderRadius: 12, padding: '9px 12px', minHeight: 40 }} />
            <Btn variant="primary" disabled={busy} onClick={() => go('sent', note.trim())}>{busy ? 'Saving…' : 'Confirm sent out'}</Btn>
            <Btn variant="ghost" onClick={() => setNoting(false)}>Cancel</Btn>
          </span>
        ) : <Btn variant={item.repSeenAt ? 'primary' : 'ghost'} disabled={busy} onClick={() => setNoting(true)}>Confirm sent out</Btn>}
      {err && <span role="alert" className="text-xs" style={{ color: C.red }}>{err}</span>}
    </div>
  );
}

// A view-only panel over the page (release or invoice details).
function ViewSheet({ title, subtitle, onClose, children }) {
  useEffect(() => { const k = e => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={title} onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} className="rounded" style={{ background: C.panel, width: '100%', maxWidth: 680, maxHeight: '90dvh', overflowY: 'auto', padding: '20px 20px 18px', boxShadow: 'var(--shadow)' }}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div style={{ minWidth: 0 }}><h2 style={{ fontWeight: 700, fontSize: 20 }}>{title}</h2>{subtitle && <div className="text-sm" style={{ color: C.textDim }}>{subtitle}</div>}</div>
          <Btn variant="ghost" onClick={onClose}>Close</Btn>
        </div>
        {children}
      </div>
    </div>
  );
}
function Fields({ headers, values }) {
  return (
    <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 38%) minmax(0, 1fr)', borderTop: '1px solid ' + C.border }}>
      {headers.map((h, i) => values[i] === '' || values[i] == null ? null : [
        <dt key={h + 'k'} className="text-sm" style={{ color: C.textDim, padding: '8px 10px 8px 0', borderBottom: '1px solid ' + C.border }}>{h}</dt>,
        <dd key={h + 'v'} className="text-sm" style={{ margin: 0, padding: '8px 0', borderBottom: '1px solid ' + C.border, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{String(values[i])}</dd>,
      ])}
    </dl>
  );
}

const INVOICE_HEADERS = ['Invoice', 'Artist', 'Type', 'Amount', 'Invoice number', 'Payee', 'Details', 'Submitted', 'Sent to the partner', 'Status'];
const invoiceRow = (i, a) => [i.title, a.name || '', i.kind === 'expense' ? 'Expense claim' : 'Service invoice', Number(i.amount || 0).toFixed(2), i.invoiceNumber || '', i.payee || '', i.details || '', day(i.submittedAt), day(i.sentToRepAt), i.status];

function Invoices({ invoices, artistById, acknowledge }) {
  const [viewing, setViewing] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [fileErr, setFileErr] = useState('');
  const sorted = [...invoices].sort((a, b) => String(b.sentToRepAt).localeCompare(String(a.sentToRepAt)));
  async function view(inv) {
    setViewing(inv); setFileUrl(''); setFileErr('');
    if (!inv.attachment) return;
    try { setFileUrl(await documentUrl(inv.attachment)); } catch (e) { setFileErr('Couldn’t open the invoice file. Try again in a moment.'); }
  }
  // The invoice file the artist attached (PDF or image), straight from the list.
  async function downloadFile(inv) {
    try {
      const url = await documentUrl(inv.attachment, inv.attachmentName);
      const l = document.createElement('a'); l.href = url; l.download = inv.attachmentName || 'invoice'; l.target = '_blank'; l.rel = 'noopener';
      document.body.appendChild(l); l.click(); l.remove();
    } catch (e) { setFileErr('Couldn’t download the invoice file. Try again in a moment.'); }
  }
  const isImage = inv => /^data:image|\.(png|jpe?g|gif|webp|heic)$/i.test(String(inv.attachmentName || inv.attachment || ''));
  const row = inv => {
    const a = artistById[inv.artistId] || {};
    return (
      <li key={inv.id} className="rounded p-4" style={{ background: C.panel }}>
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <button onClick={() => view(inv)} className="text-left" style={{ fontWeight: 600, fontSize: 16 }}>{inv.title} <span style={{ color: C.textDim, fontWeight: 400 }}>· {a.name}</span></button>
          <div style={{ fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(Number(inv.amount || 0))}</div>
        </div>
        <div className="text-sm mt-1 flex gap-2 flex-wrap items-center" style={{ color: C.textDim }}>
          <Badge tone={TONE[inv.status] || 'default'}>{inv.status}</Badge>
          <span>Sent to the partner {formatDate(day(inv.sentToRepAt))}</span>
        </div>
        <div className="flex gap-2 flex-wrap mt-3">
          <Btn variant="ghost" onClick={() => view(inv)}><Eye size={14} /> View</Btn>
          {inv.attachment && <Btn variant="ghost" onClick={() => downloadFile(inv)}><FileDown size={14} /> Download invoice file</Btn>}
          <Btn variant="ghost" onClick={() => exportRecordsToWord('invoice-' + (inv.invoiceNumber || inv.id), 'Invoice: ' + inv.title, INVOICE_HEADERS, [invoiceRow(inv, a)])}><FileDown size={14} /> {inv.attachment ? 'Download details' : 'Download'}</Btn>
        </div>
        {!viewing && fileErr && <div className="text-xs mt-2" role="alert" style={{ color: C.red }}>{fileErr}</div>}
        <div className="mt-3"><Ack kind="invoice" item={inv} acknowledge={acknowledge} /></div>
      </li>
    );
  };
  return (
    <div>
      <h1 className="imss-title">Invoices</h1>
      <p className="mb-5" style={{ color: C.textDim, fontSize: 17 }}>Invoices IMSS Records sent to the partner for your artists. View each one, then download what you need.</p>
      {invoices.length === 0 ? <EmptyState icon={FileText} title="No invoices yet" description="When IMSS Records sends an invoice to the partner for one of your artists, it appears here and you get an email." /> : <>
        <div className="flex gap-2 flex-wrap mb-4">
          <Btn variant="ghost" onClick={() => exportRowsToCsv('imss-invoices-' + todayStr(), INVOICE_HEADERS, sorted.map(i => invoiceRow(i, artistById[i.artistId] || {})))}><FileText size={14} /> CSV</Btn>
          <Btn variant="ghost" onClick={() => exportRowsToExcel('imss-invoices-' + todayStr(), INVOICE_HEADERS, sorted.map(i => invoiceRow(i, artistById[i.artistId] || {})))}><FileSpreadsheet size={14} /> Excel</Btn>
        </div>
        <ul className="flex flex-col gap-2">{sorted.map(row)}</ul>
      </>}
      {viewing && (() => {
        const a = artistById[viewing.artistId] || {};
        return (
          <ViewSheet title={viewing.title} subtitle={(a.name || '') + ' · ' + formatCurrency(Number(viewing.amount || 0))} onClose={() => setViewing(null)}>
            {viewing.attachment && (
              <div className="mb-4">
                {fileErr ? <div className="text-sm" role="alert" style={{ color: C.red }}>{fileErr}</div>
                  : !fileUrl ? <div className="text-sm" style={{ color: C.textDim }}>Opening the invoice file…</div>
                  : isImage(viewing) ? <img src={fileUrl} alt={'Invoice file for ' + viewing.title} style={{ maxWidth: '100%', borderRadius: 10, border: '1px solid ' + C.border }} />
                  : <iframe src={fileUrl} title={'Invoice file for ' + viewing.title} style={{ width: '100%', height: '60dvh', border: '1px solid ' + C.border, borderRadius: 10, background: '#fff' }} />}
              </div>
            )}
            <Fields headers={INVOICE_HEADERS} values={invoiceRow(viewing, a)} />
            <div className="flex gap-2 flex-wrap mt-4">
              {fileUrl && <Btn variant="primary" onClick={() => { const l = document.createElement('a'); l.href = fileUrl; l.download = viewing.attachmentName || 'invoice'; l.target = '_blank'; l.rel = 'noopener'; document.body.appendChild(l); l.click(); l.remove(); }}><FileDown size={14} /> Download invoice file</Btn>}
              <Btn variant="ghost" onClick={() => exportRecordsToWord('invoice-' + (viewing.invoiceNumber || viewing.id), 'Invoice: ' + viewing.title, INVOICE_HEADERS, [invoiceRow(viewing, a)])}><FileDown size={14} /> Download details</Btn>
            </div>
            <div className="mt-4 pt-3" style={{ borderTop: '1px solid ' + C.border }}><Ack kind="invoice" item={invoices.find(x => x.id === viewing.id) || viewing} acknowledge={acknowledge} /></div>
          </ViewSheet>
        );
      })()}
    </div>
  );
}
