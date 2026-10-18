// Label Rep view inside ops. A rep is an outside partner with the role
// 'Label Rep' on the Team list. The database gives them only rep_portal():
// their artists' releases a PM confirmed, and invoices pushed to them. They
// download both, and mark a pushed invoice as sent to the partner (DP Queue).
import { useEffect, useMemo, useState } from 'react';
import { Calendar, FileDown, FileSpreadsheet, FileText, LogOut, Eye, Mail, X, History } from 'lucide-react';
import { documentUrl, supabase } from './storage.js';
import {logSignIn, readAudit, logActivity } from './audit.js';
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
import { createPortal } from 'react-dom';

const PAGES = [
  { id: 'releases', label: 'Release schedule', icon: Calendar },
  { id: 'invoices', label: 'Invoices', icon: FileText },
  { id: 'activity', label: 'My activity', icon: History },
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
    if (demo) { setData(demo.data); logSignIn('rep', demo.data.rep.name); return; }
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
      <style>{GLOBAL_STYLES + SHEET_CSS}</style>
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
          <img className="imss-print-logo" src={LOGO_DATA_URI} alt="" aria-hidden="true" />
          <div className="flex items-center justify-end gap-2 mb-4">
            <NotificationBell routes={{ release: 'releases', submission: 'releases', invoice: 'invoices' }} onOpen={setPage} />
            {/* Your initials open the account menu (Appearance, Account & security, Sign out), as on ops. */}
            <button onClick={e => window.dispatchEvent(new CustomEvent('imss:open-account', { detail: e.currentTarget.getBoundingClientRect() }))} aria-label={'Your account: ' + data.rep.name} className="inline-flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: 9999, background: C.amberSoft, color: C.amber, fontWeight: 700, fontSize: 14, flex: '0 0 auto' }}>{initials(data.rep.name)}</button>
          </div>
          {page === 'activity' ? <MyActivity demo={!!demo} repName={data.rep.name} /> : page === 'account' ? <div><SectionHeader title="Account & security" description="How you sign in: passkeys for Face ID, your fingerprint or this device’s screen lock, and two-factor codes." /><PasskeySettings /><TwoFactorSettings /></div> : page === 'releases' ? <Releases releases={data.releases || []} artistById={artistById} emailReleases={emailReleases} acknowledge={acknowledge} /> : <Invoices invoices={data.invoices || []} artistById={artistById} acknowledge={acknowledge} />}
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
  const [tab, setTab] = useState('upcoming');
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
      <li key={r.id} className="flex gap-3 items-center">
        <input type="checkbox" checked={picked.includes(r.id)} onChange={() => toggle(r.id)} aria-label={'Select ' + r.title} style={{ width: 20, height: 20, flex: '0 0 20px' }} />
        <button className="imss-repcard" onClick={() => open(r)} aria-label={'Open ' + r.title}>
          <span className="flex items-baseline justify-between gap-3">
            <span style={{ fontWeight: 600, fontSize: 16, minWidth: 0 }}>{r.title} <span style={{ color: C.textDim, fontWeight: 400 }}>· {a.name}</span></span>
            <span style={{ fontSize: 15, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatDate(r.releaseDate)}</span>
          </span>
          <span className="text-sm mt-1.5 flex gap-2 flex-wrap items-center" style={{ color: C.textDim }}>
            <Badge tone={r.type === 'Album' ? 'teal' : r.type === 'EP' ? 'amber' : 'default'}>{r.type || 'Type not set'}</Badge>
            {r.isrc && <span>ISRC {r.isrc}</span>}
            {updated && <Badge tone="amber">Updated {formatDate(day(r.repConfirmedAt))}</Badge>}
            <AckChips item={r} />
          </span>
        </button>
      </li>
    );
  };
  // Opening a release counts as seeing it.
  const open = r => { setViewing(r); setMailMsg(''); logActivity('viewed a release', r.title, r.artistId); if (!r.repSeenAt) acknowledge('release', r, 'seen'); };

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
        <div role="tablist" aria-label="Releases" className="flex gap-1 mb-3" style={{ display: 'inline-flex', padding: 3, borderRadius: 980, background: 'var(--fill)' }}>
          {[['upcoming', 'Upcoming', upcoming.length], ['released', 'Released', past.length]].map(([id, label, n]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              style={{ minHeight: 40, padding: '6px 16px', borderRadius: 980, fontSize: 15, fontWeight: 600, background: tab === id ? 'var(--panel)' : 'transparent', color: tab === id ? C.text : C.textDim, boxShadow: tab === id ? '0 1px 3px rgba(0,0,0,.15)' : 'none' }}>
              {label} <span style={{ color: C.textDim, fontWeight: 500 }}>{n}</span>
            </button>
          ))}
        </div>
        {tab === 'upcoming'
          ? (upcoming.length ? <ul className="flex flex-col gap-2">{upcoming.map(card)}</ul> : <p style={{ color: C.textDim }}>Nothing scheduled yet.</p>)
          : (past.length ? <ul className="flex flex-col gap-2">{past.map(card)}</ul> : <p style={{ color: C.textDim }}>Nothing released yet.</p>)}
      </>}
      {viewing && (() => {
        const a = artistById[viewing.artistId] || {};
        const vals = releaseSheetRow(viewing, a);
        const one = (viewing.title || 'release').replace(/\s+/g, '-').toLowerCase();
        return (
          <ViewSheet title={viewing.title} subtitle={(viewing.type || 'Release') + ' · ' + a.name + ' · ' + formatDate(viewing.releaseDate)} onClose={() => { setViewing(null); setMailMsg(''); }}
            footer={<>
              <Btn variant="primary" onClick={() => mail([viewing])}><Mail size={14} /> Email to me</Btn>
              <Btn variant="ghost" onClick={() => exportRecordsToWord(one, viewing.title + ' · ' + (a.name || ''), RELEASE_SHEET_HEADERS, [vals])}><FileDown size={14} /> Word</Btn>
              <Btn variant="ghost" onClick={() => exportRowsToExcel(one, RELEASE_SHEET_HEADERS, [vals])}><FileSpreadsheet size={14} /> Excel</Btn>
              <Btn variant="ghost" onClick={() => exportRowsToCsv(one, RELEASE_SHEET_HEADERS, [vals])}><FileText size={14} /> CSV</Btn>
            </>}>
            <div className="mb-4"><Ack kind="release" item={releases.find(x => x.id === viewing.id) || viewing} acknowledge={acknowledge} /></div>
            {mailMsg && <div role="status" className="text-sm mb-3" style={{ color: /Couldn|Too many/.test(mailMsg) ? C.red : C.teal }}>{mailMsg}</div>}
            <Fields headers={RELEASE_SHEET_HEADERS} values={vals} />
          </ViewSheet>
        );
      })()}
    </div>
  );
}

// Everything the rep did here, newest first (their own entries only).
function MyActivity({ demo, repName }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    if (demo) { readAudit({ limit: 300 }).then(list => setRows(list.filter(e => e.actor_name === repName)), () => setRows([])); return; }
    supabase.rpc('rep_my_activity').then(({ data }) => setRows(data || []), () => setRows([]));
  }, [demo, repName]);
  const label = a => String(a || '').replace(/^exported /, 'downloaded ').replace(/^./, c => c.toUpperCase());
  return (
    <div>
      <h1 className="imss-title">My activity</h1>
      <p className="mb-5" style={{ color: C.textDim, fontSize: 17 }}>What you’ve done here: sign-ins, what you opened, downloaded, emailed and confirmed. Only you and the label’s Admins can see this.</p>
      {rows === null ? <div className="text-sm" style={{ color: C.textDim }}>Loading…</div>
        : rows.length === 0 ? <EmptyState icon={History} title="Nothing yet" description="As you open, download and confirm releases and invoices, it shows here." />
        : (
          <ul className="rounded" style={{ background: C.panel, listStyle: 'none', margin: 0, padding: 0 }}>
            {rows.map((e, i) => (
              <li key={i} className="flex gap-3 items-start" style={{ padding: '12px 16px', borderTop: i ? '1px solid ' + C.border : 'none' }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 600, fontSize: 15 }}>{label(e.action)}</span>
                  {e.detail && <span className="text-sm" style={{ color: C.textDim, overflowWrap: 'anywhere' }}>{e.detail}</span>}
                </span>
                <span className="text-sm" style={{ color: C.textDim, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{new Date(e.at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}

// Seen / Sent out tags for list rows.
function AckChips({ item }) {
  return <>{item.repSentOutAt ? <Badge tone="teal">Sent out {formatDate(day(item.repSentOutAt))}</Badge> : item.repSeenAt ? <Badge tone="teal">Seen</Badge> : <Badge tone="amber">New</Badge>}</>;
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
function ViewSheet({ title, subtitle, onClose, children, footer = null }) {
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    const page = document.querySelector('.imss-content'); const before = page && page.style.overflow;
    if (page) page.style.overflow = 'hidden'; // the page behind doesn't scroll
    return () => { window.removeEventListener('keydown', k); if (page) page.style.overflow = before || ''; };
  }, [onClose]);
  // At page level, so it covers the tab bar and isn't caught by the page's animation.
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={title} onClick={onClose} className="imss-viewsheet">
      <div onClick={e => e.stopPropagation()} className="imss-viewsheet-panel">
        <div className="imss-viewsheet-head">
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={{ fontWeight: 700, fontSize: 19, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{title}</h2>
            {subtitle && <div className="text-sm" style={{ color: C.textDim }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} aria-label="Close" style={{ width: 44, height: 44, flex: '0 0 44px', borderRadius: 999, background: 'var(--fill)', color: C.text, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
        </div>
        <div className="imss-viewsheet-body">{children}</div>
        {footer && <div className="imss-viewsheet-foot">{footer}</div>}
      </div>
    </div>, document.body
  );
}
const SHEET_CSS = `
.imss-viewsheet { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; padding: 24px; }
.imss-viewsheet-panel { background: var(--panel); width: 100%; max-width: 720px; max-height: calc(100dvh - 48px); display: flex; flex-direction: column; border-radius: 18px; box-shadow: var(--shadow); overflow: hidden; animation: imss-vs-in .2s ease-out; }
.imss-viewsheet-head { display: flex; align-items: flex-start; gap: 12px; padding: 16px 16px 12px 20px; border-bottom: 1px solid var(--hairline); }
.imss-viewsheet-body { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 16px 20px; }
.imss-viewsheet-foot { display: flex; gap: 8px; flex-wrap: wrap; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); border-top: 1px solid var(--hairline); background: var(--panel); }
.imss-viewsheet-foot > * { flex: 1 1 auto; justify-content: center; }
@keyframes imss-vs-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
@media (max-width: 767px) {
  .imss-viewsheet { padding: 0; align-items: stretch; }
  .imss-viewsheet-panel { max-width: none; max-height: none; height: 100dvh; border-radius: 0; padding-top: env(safe-area-inset-top); }
}
@media (prefers-reduced-motion: reduce) { .imss-viewsheet-panel { animation: none; } }
.imss-repcard { width: 100%; text-align: left; display: block; border-radius: 14px; background: var(--panel); padding: 14px 16px; transition: box-shadow .15s; }
.imss-repcard:hover { box-shadow: var(--shadow); }
.imss-repcard:focus-visible { outline: 3px solid var(--amber-line); outline-offset: 2px; }
`;
function Fields({ headers, values }) {
  return (
    <dl style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 40%) minmax(0, 1fr)', columnGap: 12, borderTop: '1px solid ' + C.border }}>
      {headers.map((h, i) => values[i] === '' || values[i] == null ? null : [
        <dt key={h + 'k'} className="text-sm" style={{ color: C.textDim, padding: '8px 10px 8px 0', borderBottom: '1px solid ' + C.border }}>{h}</dt>,
        <dd key={h + 'v'} className="text-sm" style={{ margin: 0, padding: '8px 0', borderBottom: '1px solid ' + C.border, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{String(values[i])}</dd>,
      ])}
    </dl>
  );
}

const INVOICE_HEADERS = ['Invoice', 'Artist', 'Type', 'Amount', 'Invoice number', 'Payee', 'Details', 'Submitted', 'Sent to the partner', 'Status'];
const invoiceRow = (i, a) => [i.title, a.name || '', i.kind === 'expense' ? 'Expense claim' : 'Service invoice', Number(i.amount || 0).toFixed(2), i.invoiceNumber || '', i.payee || '', i.details || '', day(i.submittedAt), day(i.sentToRepAt), i.status];

const INVOICE_VIEW_HEADERS = ['Artist', 'Type', 'Amount', 'Invoice number', 'Payee', 'Details', 'Submitted', 'Sent to the partner'];
const invoiceView = (i, a) => [a.name || '', i.kind === 'expense' ? 'Expense claim' : 'Service invoice', formatCurrency(Number(i.amount || 0)), i.invoiceNumber || '', i.payee || '', i.details || '', formatDate(day(i.submittedAt)), formatDate(day(i.sentToRepAt))];

function Invoices({ invoices, artistById, acknowledge }) {
  const [viewing, setViewing] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [fileErr, setFileErr] = useState('');
  const sorted = [...invoices].sort((a, b) => String(b.sentToRepAt).localeCompare(String(a.sentToRepAt)));
  async function view(inv) {
    setViewing(inv); setFileUrl(''); setFileErr('');
    logActivity('viewed an invoice', inv.title, inv.artistId);
    if (!inv.repSeenAt) acknowledge('invoice', inv, 'seen'); // opening it counts as seeing it
    if (!inv.attachment) return;
    try { setFileUrl(await documentUrl(inv.attachment)); } catch (e) { setFileErr('Couldn’t open the invoice file. Try again in a moment.'); }
  }
  // The invoice file the artist attached (PDF or image), straight from the list.
  async function downloadFile(inv) {
    try {
      const url = await documentUrl(inv.attachment, inv.attachmentName);
      logActivity('downloaded an invoice file', inv.title + (inv.attachmentName ? ' (' + inv.attachmentName + ')' : ''), inv.artistId);
      const l = document.createElement('a'); l.href = url; l.download = inv.attachmentName || 'invoice'; l.target = '_blank'; l.rel = 'noopener';
      document.body.appendChild(l); l.click(); l.remove();
    } catch (e) { setFileErr('Couldn’t download the invoice file. Try again in a moment.'); }
  }
  const isImage = inv => /^data:image/i.test(String(inv.attachment || '')) || /\.(png|jpe?g|gif|webp|heic|svg)$/i.test(String(inv.attachmentName || ''));
  const row = inv => {
    const a = artistById[inv.artistId] || {};
    return (
      <li key={inv.id}>
        <button className="imss-repcard" onClick={() => view(inv)} aria-label={'Open ' + inv.title}>
          <span className="flex items-baseline justify-between gap-3">
            <span style={{ fontWeight: 600, fontSize: 16, minWidth: 0 }}>{inv.title} <span style={{ color: C.textDim, fontWeight: 400 }}>· {a.name}</span></span>
            <span style={{ fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{formatCurrency(Number(inv.amount || 0))}</span>
          </span>
          <span className="text-sm mt-1.5 flex gap-2 flex-wrap items-center" style={{ color: C.textDim }}>
            <Badge tone={TONE[inv.status] || 'default'}>{inv.status}</Badge>
            <span>Sent to the partner {formatDate(day(inv.sentToRepAt))}</span>
            {inv.attachment && <span>File attached</span>}
            <AckChips item={inv} />
          </span>
        </button>
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
          <ViewSheet title={viewing.title} subtitle={(a.name || '') + ' · ' + formatCurrency(Number(viewing.amount || 0))} onClose={() => setViewing(null)}
            footer={<>
              {viewing.attachment && <Btn variant="primary" disabled={!fileUrl} onClick={() => downloadFile(viewing)}><FileDown size={14} /> Download invoice file</Btn>}
              <Btn variant="ghost" onClick={() => exportRecordsToWord('invoice-' + (viewing.invoiceNumber || viewing.id), 'Invoice: ' + viewing.title, INVOICE_HEADERS, [invoiceRow(viewing, a)])}><FileDown size={14} /> Download details</Btn>
            </>}>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <Badge tone={TONE[viewing.status] || 'default'}>{viewing.status}</Badge>
              <span className="text-sm" style={{ color: C.textDim }}>Sent to the partner {formatDate(day(viewing.sentToRepAt))}</span>
            </div>
            <div className="mb-4"><Ack kind="invoice" item={invoices.find(x => x.id === viewing.id) || viewing} acknowledge={acknowledge} /></div>
            {viewing.attachment && (
              <div className="mb-4" style={{ borderRadius: 12, border: '1px solid ' + C.border, overflow: 'hidden', background: '#fff' }}>
                {fileErr ? <div className="text-sm p-3" role="alert" style={{ color: C.red }}>{fileErr}</div>
                  : !fileUrl ? <div className="text-sm p-3" style={{ color: '#68686d' }}>Opening the invoice file…</div>
                  : isImage(viewing) ? <img src={fileUrl} alt={'Invoice file for ' + viewing.title} style={{ display: 'block', width: '100%', maxHeight: '55dvh', objectFit: 'contain' }} />
                  : <iframe src={fileUrl} title={'Invoice file for ' + viewing.title} style={{ display: 'block', width: '100%', height: '55dvh', border: 0 }} />}
              </div>
            )}
            <Fields headers={INVOICE_VIEW_HEADERS} values={invoiceView(viewing, a)} />
          </ViewSheet>
        );
      })()}
    </div>
  );
}
