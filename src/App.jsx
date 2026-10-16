import { ArrowLeft, Bell, Calendar, ClipboardList, Coins, Disc3, DollarSign, Eye, FileDown, FileText, Send, History, LayoutDashboard, LogOut, MessageSquare, Radio, Search, ShieldCheck, Upload, UserCog, Users, Wallet } from 'lucide-react';
import { logActivity, logSignIn } from './audit.js';
import { useEffect, useMemo, useState } from 'react';
import { licenseFor, licenseFlags } from './licenses.js';
import { streamsFromRevenue } from './streams.js';
import { checklistProgress, expirationStatus, formatCurrency, missingRequiredDocs, onboardingProgress, permissionsFor, todayStr, uid } from './constants.js';
import { artistPublishedView, publishSnapshot, expandRemittances, lastClosedPeriod, slug } from './finance.js';
import { DATA_VERSION, SEED_ACCESS_REQUESTS, SEED_ACTIVITY_LOG, SEED_ARTIST_REQUESTS, SEED_CATALOG, SEED_INVOICES, SEED_LABEL_BUDGETS, SEED_LABEL_SETTINGS, SEED_LEDGER, SEED_MASTER_GROSS, SEED_NOTICES, SEED_PAYOUTS, SEED_PROFILE_REQUESTS, SEED_RELEASE_SUBMISSIONS, SEED_REVENUE, SEED_ROSTER, SEED_STAFF, SEED_STREAMS, SEED_TASKS } from './seed.js';
import { supabase } from './storage.js';
import { LegalFooter } from './Legal.jsx';
import PublishToArtists from './sections/PublishToArtists.jsx';
import DealChanges from './sections/DealChanges.jsx';
import { AuditSection, NotificationBell } from './sections/Notifications.jsx';
import { C, CANVAS_GRADIENT, GLOBAL_STYLES, HEADING_FONT, LOGO_DATA_URI } from './theme.js';
import { Avatar, Badge, Btn, EmptyState, Field, Select } from './ui.jsx';
import { AccessRequestsSection } from './sections/AccessRequests.jsx';
import { ArtistPortalShell } from './sections/ArtistPortal.jsx';
import { ArtistRequestsSection } from './sections/ArtistRequests.jsx';
import { BackupSection } from './sections/Backup.jsx';
import { BudgetSection } from './sections/Budget.jsx';
import { CatalogSection } from './sections/Catalog.jsx';
import { ImportSection } from './sections/Import.jsx';
import { invoiceStage, invoiceReviewers, InvoicesSection } from './sections/Invoices.jsx';
import { LedgerSection } from './sections/Ledger.jsx';
import { MasterGrossSection } from './sections/MasterGross.jsx';
import { NoticesSection } from './sections/Notices.jsx';
import { Overview } from './sections/Overview.jsx';
import { PayoutsSection } from './sections/Payouts.jsx';
import { ReleaseCalendarSection } from './sections/ReleaseCalendar.jsx';
import { RevenueSection } from './sections/Revenue.jsx';
import { RosterSection } from './sections/Roster.jsx';
import { StatementsSection } from './sections/Statements.jsx';
import { StreamsSection } from './sections/Streams.jsx';
import { SubmissionsSection } from './sections/Submissions.jsx';
import { TasksSection } from './sections/Tasks.jsx';
import { TeamSection } from './sections/Team.jsx';

function Sidebar({ active, setActive, nav, onClearAll, confirmReset, setConfirmReset, onReseed, confirmReseed, setConfirmReseed, sessionName, onLogout }) {
  return (
    <div className="imss-sidebar shrink-0" style={{ borderColor: C.border, background: C.panel }}>
      <div className="imss-desktop-only px-5 pt-6 pb-4">
        <div className="flex items-center gap-2">
          <img src={LOGO_DATA_URI} alt="IMSS Records" style={{ height: 26, width: 'auto' }} />
        </div>
        <div className="text-xs mt-1" style={{ color: C.textFaint }}>Label operations</div>
      </div>
      <nav className="imss-nav gap-1 px-2 py-2">
        {(() => {
          let lastGroup = null;
          const out = [];
          nav.forEach(item => {
            if (item.group && item.group !== lastGroup) {
              out.push(
                <div key={'group-' + item.group} className="imss-desktop-only" style={{ color: C.textDim, fontSize: 12, fontWeight: 600, padding: '14px 12px 4px' }}>
                  {item.group}
                </div>
              );
              lastGroup = item.group;
            }
            const Icon = item.icon;
            const isActive = active === item.id;
            out.push(
              <button key={item.id} onClick={() => setActive(item.id)}
                className="flex items-center gap-2 px-3 py-2 rounded text-sm whitespace-nowrap hover:bg-white/5"
                style={{ background: isActive ? C.amberSoft : 'transparent', color: isActive ? C.amber : C.textDim, fontWeight: isActive ? 600 : 500 }}>
                <Icon size={16} />
                {item.label}
              </button>
            );
          });
          return out;
        })()}
      </nav>
      <div className="imss-desktop-only mt-auto px-5 py-4 text-xs" style={{ color: C.textFaint }}>
        {sessionName && (
          <div className="flex items-center justify-between gap-2 mb-3 pb-3" style={{ borderBottom: '1px solid ' + C.border }}>
            <span className="flex items-center gap-1.5" style={{ color: C.textDim }}><ShieldCheck size={13} color={C.teal} /> {sessionName}</span>
            <button onClick={onLogout} style={{ color: C.textFaint }}><LogOut size={13} /></button>
          </div>
        )}
        {confirmReset ? (
          <span className="inline-flex flex-col gap-1">
            Clear all data?
            <span className="inline-flex gap-2">
              <button onClick={onClearAll} style={{ color: C.red, fontWeight: 600 }}>Yes, clear</button>
              <button onClick={() => setConfirmReset(false)} style={{ color: C.textDim }}>Cancel</button>
            </span>
          </span>
        ) : (
          <button onClick={() => setConfirmReset(true)} style={{ color: C.textFaint }}>Clear all data</button>
        )}
        {confirmReseed ? (
          <span className="inline-flex flex-col gap-1 mt-2">
            Overwrite with fresh sample data?
            <span className="inline-flex gap-2">
              <button onClick={onReseed} style={{ color: C.amber, fontWeight: 600 }}>Yes, reset</button>
              <button onClick={() => setConfirmReseed(false)} style={{ color: C.textDim }}>Cancel</button>
            </span>
          </span>
        ) : (
          <button onClick={() => setConfirmReseed(true)} className="block mt-2" style={{ color: C.textFaint }}>Reset to sample data</button>
        )}
      </div>
    </div>
  );
}

function IdentityGate({ roster, staff, onEnterTeam, onEnterArtist }) {
  const [mode, setMode] = useState(null);
  const [teamId, setTeamId] = useState(staff[0] ? staff[0].id : '');
  const [artistId, setArtistId] = useState(roster[0] ? roster[0].id : '');

  function continueAsTeam() {
    const member = staff.find(s => s.id === teamId);
    if (!member) return;
    onEnterTeam({ name: member.name, role: member.role, permissions: permissionsFor(member) });
  }
  function continueAsBootstrapAdmin() {
    onEnterTeam({ name: 'Admin (setup)', role: 'Admin', permissions: permissionsFor({ role: 'Admin' }) });
  }

  return (
    <div style={{ background: CANVAS_GRADIENT, fontFamily: HEADING_FONT, color: C.text }} className="w-full rounded-lg border flex items-center justify-center imss-gate">
      <style>{GLOBAL_STYLES}</style>
      <div className="imss-bg-blob imss-bg-blob-1"></div>
      <div className="imss-bg-blob imss-bg-blob-2"></div>
      <div className="imss-bg-blob imss-bg-blob-3"></div>
      <div className="imss-bg-blob imss-bg-blob-4"></div>
      <div className="imss-glass-layer w-full" style={{ maxWidth: 380, padding: 24 }}>
        <div className="flex items-center gap-2 mb-1 justify-center">
          <img src={LOGO_DATA_URI} alt="IMSS Records" style={{ height: 34, width: 'auto' }} />
        </div>
        <div className="text-sm text-center mb-6" style={{ color: C.textFaint }}>Who's signing in?</div>

        {!mode && (
          <div className="flex flex-col gap-3">
            <button onClick={() => setMode('team')} className="rounded border p-4 text-left" style={{ background: C.panel, borderColor: C.borderLight }}>
              <div className="flex items-center gap-2 mb-1"><UserCog size={16} color={C.amber} /><span style={{ fontWeight: 600 }}>Team member</span></div>
              <div className="text-xs" style={{ color: C.textFaint }}>Admin, Finance, or any role your Admin sets up — access is scoped to what they've granted you.</div>
            </button>
            <button onClick={() => setMode('artist')} className="rounded border p-4 text-left" style={{ background: C.panel, borderColor: C.borderLight }}>
              <div className="flex items-center gap-2 mb-1"><Eye size={16} color={C.teal} /><span style={{ fontWeight: 600 }}>Artist</span></div>
              <div className="text-xs" style={{ color: C.textFaint }}>View-only — your catalog and your statements, nothing else.</div>
            </button>
          </div>
        )}

        {mode === 'team' && (
          <div className="rounded border p-4" style={{ background: C.panel, borderColor: C.borderLight }}>
            {staff.length === 0 ? (
              <>
                <div className="text-sm mb-3" style={{ color: C.textDim }}>No team members yet. Continue as a temporary Admin to add your team — you can replace this with real accounts right away from the Team tab.</div>
                <div className="flex gap-2">
                  <Btn variant="primary" onClick={continueAsBootstrapAdmin}>Continue as Admin</Btn>
                  <Btn variant="ghost" onClick={() => setMode(null)}><ArrowLeft size={14} /> Back</Btn>
                </div>
              </>
            ) : (
              <>
                <Field label="Your name">
                  <Select value={teamId} onChange={e => setTeamId(e.target.value)}>
                    {staff.map(s => <option key={s.id} value={s.id}>{s.name} — {s.role}</option>)}
                  </Select>
                </Field>
                <div className="flex gap-2 mt-3">
                  <Btn variant="primary" onClick={continueAsTeam}>Continue</Btn>
                  <Btn variant="ghost" onClick={() => setMode(null)}><ArrowLeft size={14} /> Back</Btn>
                </div>
              </>
            )}
          </div>
        )}

        {mode === 'artist' && (
          <div className="rounded border p-4" style={{ background: C.panel, borderColor: C.borderLight }}>
            <Field label="Which artist are you?">
              <Select value={artistId} onChange={e => setArtistId(e.target.value)}>
                {roster.length === 0 && <option value="">No artists on the roster yet</option>}
                {roster.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
            <div className="flex gap-2 mt-3">
              <Btn variant="primary" onClick={() => artistId && onEnterArtist(artistId)}>Continue</Btn>
              <Btn variant="ghost" onClick={() => setMode(null)}><ArrowLeft size={14} /> Back</Btn>
            </div>
          </div>
        )}

        <div className="text-xs text-center mt-6" style={{ color: C.textFaint, lineHeight: 1.6 }}>
          This is a soft access split for a clean artist view, not secure authentication — anyone with access to this dashboard's link can pick either option.
        </div>
      </div>
    </div>
  );
}

// Everything waiting on this team member: shown on the Overview and in Alerts.
function teamAttention({ roster, catalog, staff, tasks = [], revenue = [], ledger = [], profileRequests = [], artistRequests = [], releaseSubmissions = [], accessRequests = [], invoices = [], labelSettings = {}, revenuePublish = [], dealChanges = [], payouts = [], canRoyalties = false, isAdmin = false, sessionName = '', role = '', licenseCtx = {} }) {
  const items = [];
  const today = todayStr();
  roster.forEach(a => {
    if (!a.contractExpiration) return;
    const st = expirationStatus(a.contractExpiration);
    if (st && st.label !== 'Active') items.push({ id: 'contract-' + a.id, tone: st.tone, text: a.name + "'s contract " + st.label.toLowerCase(), tab: 'roster', focus: { artistId: a.id } });
  });
  // License flags go to Admin and Legal, who own contracts and rights.
  if (isAdmin || role === 'Legal') licenseFlags(roster, catalog, licenseCtx).forEach((f, i) => items.push({ id: 'lic-' + f.kind + '-' + f.artistId + i, tone: f.kind === 'decide' ? 'red' : 'amber', text: f.text, tab: 'roster', focus: { artistId: f.artistId, section: 'Contract and licenses' } }));
  catalog.forEach(c => {
    if (c.status === 'Released') return;
    const missing = missingRequiredDocs(c.distributionDocs);
    if (missing > 0) items.push({ id: 'missing-docs-' + c.id, tone: 'amber', text: c.title + ' missing ' + missing + ' required distribution document' + (missing === 1 ? '' : 's'), tab: 'catalog', focus: { openId: c.id } });
  });
  staff.forEach(s => {
    if ((s.status || 'Active') !== 'Onboarding') return;
    const prog = onboardingProgress(s);
    items.push({ id: 'onboard-' + s.id, tone: 'amber', text: s.name + ' onboarding: ' + prog.done + '/' + prog.total + ' tasks', tab: 'team', focus: { id: s.id } });
  });
  catalog.forEach(c => {
    if (!c.releaseDate || c.status === 'Released') return;
    const days = Math.round((new Date(c.releaseDate) - new Date(today)) / 86400000);
    if (days < 0 || days > 14) return;
    const prog = checklistProgress(c.checklist);
    const dueText = days === 0 ? 'releases today' : days === 1 ? 'releases tomorrow' : 'releases in ' + days + ' days';
    if (prog.total > 0 && prog.pct < 100 && days <= 7) {
      items.push({ id: 'release-risk-' + c.id, tone: 'red', text: c.title + ' ' + dueText + ' — checklist only ' + prog.pct + '% done', tab: 'catalog', focus: { openId: c.id } });
    } else {
      items.push({ id: 'release-' + c.id, tone: days <= 3 ? 'red' : 'amber', text: c.title + ' ' + dueText, tab: 'calendar', focus: { releaseId: c.id, month: c.releaseDate.slice(0, 7) } });
    }
  });
  tasks.forEach(t => {
    if (t.status !== 'Open' || !t.dueDate || t.dueDate >= today) return;
    items.push({ id: 'task-' + t.id, tone: 'red', text: 'Overdue: "' + t.title + '" (' + t.assignee + ')', tab: 'tasks', focus: { id: t.id } });
  });
  if (isAdmin) {
    const pendingCount = revenue.filter(x => x.approvalStatus === 'Pending').length;
    if (pendingCount > 0) {
      items.push({ id: 'pending-earnings', tone: 'amber', text: pendingCount + ' revenue ' + (pendingCount === 1 ? 'entry' : 'entries') + ' waiting on your approval', tab: 'revenue', focus: { id: (revenue.find(x => x.approvalStatus === 'Pending') || {}).id } });
    }
    const pendingExpenseCount = ledger.filter(x => x.approvalStatus === 'Pending').length;
    if (pendingExpenseCount > 0) {
      items.push({ id: 'pending-expenses', tone: 'amber', text: pendingExpenseCount + ' ledger ' + (pendingExpenseCount === 1 ? 'entry' : 'entries') + ' waiting on your approval', tab: 'ledger', focus: { id: (ledger.find(x => x.approvalStatus === 'Pending') || {}).id } });
    }
    const pendingAccess = accessRequests.filter(r => r.status === 'Pending').length;
    if (pendingAccess > 0) {
      items.push({ id: 'pending-access', tone: 'red', text: pendingAccess + ' access ' + (pendingAccess === 1 ? 'change' : 'changes') + ' from Legal waiting on your approval', tab: 'access-requests', focus: { id: (accessRequests.find(r => r.status === 'Pending') || {}).id } });
    }
    const pendingProfileCount = profileRequests.filter(r => r.status === 'Pending').length;
    if (pendingProfileCount > 0) {
      items.push({ id: 'pending-profile', tone: 'amber', text: pendingProfileCount + ' artist profile ' + (pendingProfileCount === 1 ? 'change' : 'changes') + ' waiting on review', tab: 'roster', focus: { artistId: (profileRequests.find(r => r.status === 'Pending') || {}).artistId } });
    }
    const openRequestCount = artistRequests.filter(r => r.status === 'Open').length;
    if (openRequestCount > 0) {
      items.push({ id: 'open-artist-requests', tone: 'amber', text: openRequestCount + ' artist ' + (openRequestCount === 1 ? 'request' : 'requests') + ' waiting on a response', tab: 'artist-requests', focus: { id: (artistRequests.find(r => r.status === 'Open') || {}).id } });
    }
  }
  const myPendingSubmissions = releaseSubmissions.filter(s => s.status === 'Pending' && (isAdmin || s.sentTo === sessionName));
  if (myPendingSubmissions.length > 0) {
    items.push({ id: 'pending-submissions', tone: 'amber', text: myPendingSubmissions.length + ' release ' + (myPendingSubmissions.length === 1 ? 'submission' : 'submissions') + ' waiting on review', tab: 'submissions', focus: { id: myPendingSubmissions[0].id } });
  }
  // Statements due within two weeks, or overdue, from each artist's schedule.
  if (canRoyalties) {
    let overdue = 0, soon = 0, firstOverdue = '', firstSoon = '';
    roster.filter(a => (a.status || 'Active') === 'Active').forEach(a => {
      const per = lastClosedPeriod(a, today);
      const done = payouts.some(p => p.artistSlug === slug(a.name) && p.periodStart === per.start && p.periodEnd === per.end && p.status !== 'draft');
      const days = Math.round((Date.parse(per.due) - Date.parse(today)) / 86400000);
      if (!done && days < 0) { overdue++; firstOverdue = firstOverdue || a.id; } else if (!done && days <= 14) { soon++; firstSoon = firstSoon || a.id; }
    });
    if (overdue) items.push({ id: 'statements-overdue', tone: 'red', text: overdue + ' artist ' + (overdue === 1 ? 'statement is' : 'statements are') + ' overdue', tab: 'payouts', focus: { id: 'due-' + firstOverdue } });
    if (soon) items.push({ id: 'statements-soon', tone: 'amber', text: soon + ' artist ' + (soon === 1 ? 'statement is' : 'statements are') + ' due in the next 14 days', tab: 'payouts', focus: { id: 'due-' + firstSoon } });
  }
  const dealWaiting = dealChanges.filter(c => c.status === 'Pending').length;
  if (isAdmin && dealWaiting) items.push({ id: 'deal-approvals', tone: 'amber', text: dealWaiting + ' deal ' + (dealWaiting === 1 ? 'change' : 'changes') + ' waiting on your approval', tab: 'deals', focus: { id: (dealChanges.find(c => c.status === 'Pending') || {}).id } });
  const publishWaiting = revenuePublish.filter(e => e.status === 'Awaiting approval').length;
  if (isAdmin && publishWaiting > 0) {
    items.push({ id: 'publish-approvals', tone: 'amber', text: publishWaiting + ' publish ' + (publishWaiting === 1 ? 'request' : 'requests') + ' to artists waiting on your approval', tab: 'publish', focus: { id: (revenuePublish.find(e => e.status === 'Awaiting approval') || {}).id } });
  }
  // Invoices sitting in a queue this person handles (Admins also share PM Approval).
  const me = staff.find(m => m.name === sessionName);
  const workflow = labelSettings.invoiceWorkflow || {};
  const myInvoices = invoices.filter(i => { const st = invoiceStage(i); return st && me && (invoiceReviewers(i, roster, staff, workflow).some(m => m.id === me.id) || (isAdmin && st.who === 'pm')); });
  if (myInvoices.length > 0) {
    const total = myInvoices.reduce((t, i) => t + (Number(i.amount) || 0), 0);
    items.push({ id: 'my-invoices', tone: 'amber', text: myInvoices.length + ' ' + (myInvoices.length === 1 ? 'invoice' : 'invoices') + ' waiting on your approval (' + formatCurrency(total) + ')', tab: 'invoices', focus: { id: myInvoices[0].id } });
  }
  return items.sort((a, b) => (a.tone === 'red' ? 0 : 1) - (b.tone === 'red' ? 0 : 1));
}

function TopBar({ openItem, roster, catalog, staff, tasks = [], revenue = [], ledger = [], notices = [], profileRequests = [], artistRequests = [], releaseSubmissions = [], accessRequests = [], isAdmin = false, sessionName = '', notifications = [], setActive }) {
  const [query, setQuery] = useState('');
  const [showNotifs, setShowNotifs] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out = [];
    roster.forEach(a => { if (a.name.toLowerCase().includes(q)) out.push({ label: a.name, type: 'Artist', tab: 'roster', photoUrl: a.photoUrl || '' }); });
    catalog.forEach(c => {
      if (c.title.toLowerCase().includes(q) || (c.isrc || '').toLowerCase().includes(q) || (c.upc || '').toLowerCase().includes(q)) out.push({ label: c.title, type: 'Product', tab: 'catalog' });
    });
    staff.forEach(s => { if (s.name.toLowerCase().includes(q)) out.push({ label: s.name, type: 'Team', tab: 'team', photoUrl: s.photoUrl || '' }); });
    tasks.forEach(t => { if (t.title.toLowerCase().includes(q)) out.push({ label: t.title, type: 'Task', tab: 'tasks' }); });
    notices.forEach(n => { if (n.title.toLowerCase().includes(q)) out.push({ label: n.title, type: 'Notice', tab: 'notices' }); });
    return out.slice(0, 8);
  }, [query, roster, catalog, staff, tasks, notices]);


  return (
    <div className="imss-print-hide flex items-center justify-between gap-3 mb-6">
      <div style={{ position: 'relative', maxWidth: 320, flex: '1 1 auto', minWidth: 0 }}>
        <div className="flex items-center gap-2 px-3 py-2" style={{ background: C.fill, borderRadius: 980 }}>
          <Search size={14} color={C.textFaint} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search artists, products, team" className="w-full text-sm bg-transparent" style={{ color: C.text, fontFamily: HEADING_FONT, border: 'none' }} />
        </div>
        {results.length > 0 && (
          <div className="rounded border" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 20, background: C.panel, borderColor: C.borderLight }}>
            {results.map((r, i) => (
              <button key={i} onClick={() => { setActive(r.tab); setQuery(''); }} className="flex items-center justify-between w-full text-left px-3 py-2 text-sm hover:bg-white/5">
                <span className="flex items-center gap-2" style={{ minWidth: 0 }}>
                  {(r.type === 'Artist' || r.type === 'Team') && <Avatar name={r.label} photoUrl={r.photoUrl} size={28} />}
                  <span>{r.label}</span>
                </span>
                <span className="text-xs" style={{ color: C.textFaint }}>{r.type}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
      <NotificationBell routes={{ deal: 'deals', earnings: 'publish', statement: 'payouts', invoice: 'invoices', submission: 'submissions', request: 'artist-requests' }} onOpen={setActive} />
      <div style={{ position: 'relative' }}>
        <button onClick={() => setShowNotifs(s => !s)} aria-label="Alerts" className="imss-alerts inline-flex items-center gap-1.5" style={{ background: C.fill, color: C.text, borderRadius: 980, padding: '8px 14px', fontSize: 14 }}>
          <Bell size={15} /> <span className="imss-alerts-label">Alerts</span>
          {notifications.length > 0 && <Badge tone="amber">{notifications.length}</Badge>}
        </button>
        {showNotifs && (
          <div className="rounded border" style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 20, background: C.panel, borderColor: C.borderLight, width: 320, maxHeight: 360, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div className="p-3 text-sm" style={{ color: C.textDim }}>You're all caught up.</div>
            ) : notifications.map(n => (
              <button key={n.id} onClick={() => { openItem(n); setShowNotifs(false); }} className="flex items-start gap-2 w-full text-left px-3 py-2 text-sm hover:bg-white/5" style={{ borderBottom: '1px solid ' + C.border }}>
                <span style={{ width: 6, height: 6, borderRadius: 9999, marginTop: 6, flexShrink: 0, background: n.tone === 'red' ? C.red : n.tone === 'amber' ? C.amber : C.teal }}></span>
                {n.text}
              </button>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

export default function RecordLabelDashboard({ authEmail = null, signOut = null }) {
  const [roster, setRoster] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [revenue, setRevenue] = useState([]);
  const [streams, setStreams] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [masterGross, setMasterGross] = useState([]);
  const [labelSettings, setLabelSettings] = useState(SEED_LABEL_SETTINGS);
  const [staff, setStaff] = useState(SEED_STAFF);
  const [tasks, setTasks] = useState(SEED_TASKS);
  const [ledger, setLedger] = useState(SEED_LEDGER);
  const [notices, setNotices] = useState(SEED_NOTICES);
  const [labelBudgets, setLabelBudgets] = useState(SEED_LABEL_BUDGETS);
  const [profileRequests, setProfileRequests] = useState(SEED_PROFILE_REQUESTS);
  const [accessRequests, setAccessRequests] = useState(SEED_ACCESS_REQUESTS);
  const [artistRequests, setArtistRequests] = useState(SEED_ARTIST_REQUESTS);
  const [invoices, setInvoices] = useState(SEED_INVOICES);
  const [statementFiles, setStatementFiles] = useState([]);
  const [publishedRevenue, setPublishedRevenue] = useState([]);
  const [revenuePublish, setRevenuePublish] = useState([]);
  const [dealChanges, setDealChanges] = useState([]);
  const [acceptingSubmission, setAcceptingSubmission] = useState(null);
  const [releaseSubmissions, setReleaseSubmissions] = useState(SEED_RELEASE_SUBMISSIONS);
  const [activityLog, setActivityLog] = useState(SEED_ACTIVITY_LOG);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState('overview');
  // Clicking something that needs attention opens its screen and the exact item.
  const [focus, setFocus] = useState(null);
  function openItem(n) { setActive(n.tab); setFocus(n.focus ? { ...n.focus, tab: n.tab, at: Date.now() } : null); }
  // Leaving that screen any other way drops the target, so Roster opens on the list again.
  useEffect(() => { if (focus && focus.tab !== active) setFocus(null); }, [active]);
  useEffect(() => {
    if (!focus) return;
    const t = setTimeout(() => {
      const el = focus.id ? document.querySelector('[data-focus="' + CSS.escape(String(focus.id)) + '"]')
        : focus.section ? document.querySelector('section[aria-label="' + focus.section + '"]') : null;
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.remove('imss-flash'); void el.offsetWidth; el.classList.add('imss-flash');
    }, 350);
    return () => clearTimeout(t);
  }, [focus]);
  const [error, setError] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmReseed, setConfirmReseed] = useState(false);
  const [session, setSession] = useState(null);
  useEffect(() => { if (session && session.mode === 'team') logSignIn('team', session.name); else if (session && session.mode === 'artist') { const a = roster.find(x => x.id === session.artistId); if (a) logSignIn('artist', a.name); } }, [session && session.mode, session && session.name]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      let needsReseed = false;
      try {
        const versionRes = await window.storage.get('dataVersion', false);
        // Shared data is never wiped on a version bump; only a fresh database gets seeded.
        if (!versionRes || versionRes.value !== DATA_VERSION) needsReseed = !supabase;
      } catch (e) {
        needsReseed = true;
      }

      const jobs = [
        ['roster', setRoster, SEED_ROSTER],
        ['catalog', setCatalog, SEED_CATALOG],
        ['revenue', setRevenue, SEED_REVENUE],
        ['streams', setStreams, SEED_STREAMS],
        ['payouts', setPayouts, SEED_PAYOUTS],
        ['masterGross', setMasterGross, SEED_MASTER_GROSS],
        ['labelSettings', setLabelSettings, SEED_LABEL_SETTINGS],
        ['staff', setStaff, SEED_STAFF],
        ['tasks', setTasks, SEED_TASKS],
        ['ledger', setLedger, SEED_LEDGER],
        ['notices', setNotices, SEED_NOTICES],
        ['labelBudgets', setLabelBudgets, SEED_LABEL_BUDGETS],
        ['profileRequests', setProfileRequests, SEED_PROFILE_REQUESTS],
        ['accessRequests', setAccessRequests, SEED_ACCESS_REQUESTS],
        ['artistRequests', setArtistRequests, SEED_ARTIST_REQUESTS],
        ['invoices', setInvoices, SEED_INVOICES],
        ['statementFiles', setStatementFiles, []],
        // Without a saved snapshot (local mode), artists start out seeing all approved seed revenue.
        ['publishedRevenue', setPublishedRevenue, publishSnapshot(SEED_REVENUE.filter(r => (r.approvalStatus || 'Approved') === 'Approved'), SEED_REVENUE.filter(r => (r.approvalStatus || 'Approved') === 'Approved'), SEED_MASTER_GROSS, SEED_ROSTER)],
        ['revenuePublish', setRevenuePublish, []],
        ['dealChanges', setDealChanges, []],
        ['releaseSubmissions', setReleaseSubmissions, SEED_RELEASE_SUBMISSIONS],
        ['activityLog', setActivityLog, SEED_ACTIVITY_LOG],
      ];
      for (const [key, setter, seed] of jobs) {
        if (needsReseed) {
          if (!cancelled) setter(seed);
          try { await window.storage.set(key, JSON.stringify(seed), false); } catch (e2) { /* ignore */ }
          continue;
        }
        try {
          const res = await window.storage.get(key, false);
          const val = res && res.value ? JSON.parse(res.value) : seed;
          if (!cancelled) setter(val);
        } catch (e) {
          if (!cancelled) setter(seed);
          // Missing key: save the seed. Unreadable data: keep it on disk so nothing real is lost.
          if (String(e && e.message).startsWith('not found')) {
            try { await window.storage.set(key, JSON.stringify(seed), false); } catch (e2) { /* ignore */ }
          } else if (!cancelled) {
            setError('Some saved ' + key + ' data could not be read, so sample data is shown. Your saved copy is untouched until you edit that section.');
          }
        }
      }
      if (needsReseed) {
        try { await window.storage.set('dataVersion', DATA_VERSION, false); } catch (e) { /* ignore */ }
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Artists and email replies write to these sections while the team app is
  // open, so re-read them when the tab regains focus and once a minute.
  useEffect(() => {
    if (!supabase || loading) return;
    const live = [['dealChanges', setDealChanges], ['revenuePublish', setRevenuePublish], ['invoices', setInvoices], ['artistRequests', setArtistRequests], ['releaseSubmissions', setReleaseSubmissions], ['profileRequests', setProfileRequests]];
    async function refresh() {
      if (document.visibilityState === 'hidden') return;
      for (const [key, setter] of live) {
        try { const res = await window.storage.get(key, false); if (res && res.value) setter(JSON.parse(res.value)); } catch (e) { /* keep what's on screen */ }
      }
    }
    const timer = setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [loading]);

  async function persist(key, value) {
    try {
      await window.storage.set(key, JSON.stringify(value), false);
    } catch (e) {
      setError('Could not save your last change. It may not persist after this session.');
      setTimeout(() => setError(''), 4500);
    }
  }

  function logChange(section, prevArr, nextArr) {
    const actor = session && session.mode === 'team' ? session.name : (session && session.mode === 'artist' ? 'Artist portal' : 'Unknown');
    let action = 'updated';
    if (Array.isArray(prevArr) && Array.isArray(nextArr)) {
      if (nextArr.length > prevArr.length) action = 'added an entry to';
      else if (nextArr.length < prevArr.length) action = 'removed an entry from';
    }
    const entry = { id: uid(), timestamp: new Date().toISOString(), actor, section, action };
    logActivity(action + ' ' + section, '');
    setActivityLog(prev => {
      const next = [entry, ...prev].slice(0, 200);
      persist('activityLog', next);
      return next;
    });
  }

  function updateRoster(next) { logChange('Roster', roster, next); setRoster(next); persist('roster', next); }
  function updateCatalog(next) { next = next.map(({ license, licenseExpiration, ...c }) => c); logChange('Catalog', catalog, next); setCatalog(next); persist('catalog', next); }
  function updateRevenue(next) { logChange('Revenue', revenue, next); setRevenue(next); persist('revenue', next); }
  // Imported (EMPIRE) streams are computed from revenue, so only manual entries are saved.
  function updateStreams(next) { next = next.filter(x => !x.imported); logChange('Streams', streams, next); setStreams(next); persist('streams', next); }
  function updatePayouts(next) { logChange('Payouts', payouts, next); setPayouts(next); persist('payouts', next); }
  function updateMasterGross(next) { logChange('Money received', masterGross, next); setMasterGross(next); persist('masterGross', next); }
  function updateLabelSettings(next) { setLabelSettings(next); persist('labelSettings', next); }
  function updateStaff(next) { logChange('Team', staff, next); setStaff(next); persist('staff', next); }
  function updateTasks(next) { logChange('Tasks', tasks, next); setTasks(next); persist('tasks', next); }
  function updateLedger(next) { logChange('Ledger', ledger, next); setLedger(next); persist('ledger', next); }
  function updateNotices(next) { logChange('Noticeboard', notices, next); setNotices(next); persist('notices', next); }
  function updateLabelBudgets(next) { logChange('Budget', labelBudgets, next); setLabelBudgets(next); persist('labelBudgets', next); }
  function updateProfileRequests(next) { logChange('Profile requests', profileRequests, next); setProfileRequests(next); persist('profileRequests', next); }
  function updateAccessRequests(next) { logChange('Access requests', accessRequests, next); setAccessRequests(next); persist('accessRequests', next); }
  function updateArtistRequests(next) { logChange('Artist requests', artistRequests, next); setArtistRequests(next); persist('artistRequests', next); }
  function updatePublishedRevenue(next) { setPublishedRevenue(next); persist('publishedRevenue', next); }
  function updateDealChanges(next) { logChange('Deal changes', dealChanges, next); setDealChanges(next); persist('dealChanges', next); }
  function updateRevenuePublish(next) { logChange('Publish to artists', revenuePublish, next); setRevenuePublish(next); persist('revenuePublish', next); }
  function updateStatementFiles(next) { logChange('Statement files', statementFiles, next); setStatementFiles(next); persist('statementFiles', next); }
  function updateInvoices(next) { logChange('Invoices', invoices, next); setInvoices(next); persist('invoices', next); }
  function updateReleaseSubmissions(next) { logChange('Release submissions', releaseSubmissions, next); setReleaseSubmissions(next); persist('releaseSubmissions', next); }

  function clearAll() {
    updateRoster([]); updateCatalog([]); updateRevenue([]); updateStreams([]); updatePayouts([]);
    updateMasterGross([]); updateLabelSettings(SEED_LABEL_SETTINGS);
    updateTasks([]); updateLedger([]); updateNotices([]); updateLabelBudgets([]); updateProfileRequests([]); updateArtistRequests([]); updateReleaseSubmissions([]); updateAccessRequests([]);
    setConfirmReset(false);
  }

  function reseedSample() {
    updateRoster(SEED_ROSTER); updateCatalog(SEED_CATALOG); updateRevenue(SEED_REVENUE); updateStreams(SEED_STREAMS);
    updatePayouts(SEED_PAYOUTS); updateMasterGross(SEED_MASTER_GROSS); updateLabelSettings(SEED_LABEL_SETTINGS);
    updateStaff(SEED_STAFF); updateTasks(SEED_TASKS); updateLedger(SEED_LEDGER); updateNotices(SEED_NOTICES); updateLabelBudgets(SEED_LABEL_BUDGETS); updateProfileRequests(SEED_PROFILE_REQUESTS); updateArtistRequests(SEED_ARTIST_REQUESTS); updateReleaseSubmissions(SEED_RELEASE_SUBMISSIONS); updateAccessRequests(SEED_ACCESS_REQUESTS);
    window.storage.set('dataVersion', DATA_VERSION, false).catch(() => {});
    setConfirmReseed(false);
  }

  const artistMap = useMemo(() => Object.fromEntries(roster.map(a => [a.id, a])), [roster]);
  // Song licenses are computed on read (src/licenses.js), never stored.
  const licenseCtx = useMemo(() => ({ ledger: ledger.filter(x => (x.approvalStatus || 'Approved') === 'Approved'), invoices, publishedRevenue }), [ledger, invoices, publishedRevenue]);
  const catalogView = useMemo(() => catalog.map(c => { const l = licenseFor(c, artistMap[c.artistId], licenseCtx); return { ...c, licenseExpiration: l.endsOn || l.end || '', license: l.status }; }), [catalog, artistMap, licenseCtx]);
  const releaseMap = useMemo(() => Object.fromEntries(catalog.map(r => [r.id, r])), [catalog]);
  const approvedRevenue = useMemo(() => revenue.filter(e => (e.approvalStatus || 'Approved') === 'Approved'), [revenue]);
  const streamsView = useMemo(() => [...streams, ...streamsFromRevenue(approvedRevenue, catalog, roster)], [streams, approvedRevenue, catalog, roster]);
  // Payments entered over several carried-forward months, spread per month for all the money math.
  const monthlyMasterGross = useMemo(() => expandRemittances(masterGross, approvedRevenue), [masterGross, approvedRevenue]);
  const approvedLedger = useMemo(() => ledger.filter(x => (x.approvalStatus || 'Approved') === 'Approved'), [ledger]);

  const perms = session && session.mode === 'team' ? session.permissions : {};
  const isAdmin = session && session.mode === 'team' && session.role === 'Admin';
  const isLegal = session && session.mode === 'team' && session.role === 'Legal';
  // Legal sees and edits everything an Admin does; only approving access
  // changes is Admin-only.
  const isPrivileged = isAdmin || isLegal;
  const pendingAccessCount = accessRequests.filter(r => r.status === 'Pending').length;
  const canEdit = !!perms.edits;
  const pmScope = session && session.mode === 'team' && session.role === 'Product Manager' ? session.name : null;
  const attention = useMemo(() => (session && session.mode === 'team'
    ? teamAttention({ roster, catalog: catalogView, staff, tasks, revenue, ledger, profileRequests, artistRequests, releaseSubmissions, accessRequests, invoices, labelSettings, revenuePublish, dealChanges, payouts, canRoyalties: !!perms.royalties, isAdmin, sessionName: session.name, role: session.role, licenseCtx })
    : []), [session, roster, catalogView, staff, tasks, revenue, ledger, profileRequests, artistRequests, releaseSubmissions, accessRequests, invoices, labelSettings, revenuePublish, dealChanges, payouts, perms.royalties, isAdmin, licenseCtx]);

  // Anyone assigned to an invoice queue sees Invoices, even without the spend permission.
  const sessionStaff = session && session.mode === 'team' ? staff.find(m => m.name === session.name) : null;
  const inInvoiceWorkflow = !!sessionStaff && Object.values((labelSettings || {}).invoiceWorkflow || {}).some(ids => (ids || []).includes(sessionStaff.id));
  const NAV = [
    perms.analytics && { id: 'overview', label: 'Overview', icon: LayoutDashboard, group: 'Analytics' },
    perms.analytics && { id: 'streams', label: 'Streams', icon: Radio, group: 'Analytics' },

    perms.roster && { id: 'roster', label: 'Roster', icon: Users, group: 'Artists & catalog' },
    perms.roster && { id: 'artist-requests', label: 'Artist requests', icon: MessageSquare, group: 'Artists & catalog' },
    perms.catalog && { id: 'catalog', label: 'Catalog', icon: Disc3, group: 'Artists & catalog' },
    perms.catalog && { id: 'submissions', label: 'Submissions', icon: Upload, group: 'Artists & catalog' },
    session && session.mode === 'team' && { id: 'calendar', label: 'Release calendar', icon: Calendar, group: 'Artists & catalog' },

    // Royalties, in the order the work happens: money lands, statements come in, artists see it, artists get paid.
    perms.royalties && { id: 'mastergross', label: 'Money received', icon: Coins, group: 'Royalties' },
    perms.edits && perms.royalties && { id: 'import', label: 'Import statements', icon: Upload, group: 'Royalties' },
    perms.royalties && { id: 'revenue', label: 'Revenue', icon: DollarSign, group: 'Royalties' },
    perms.royalties && { id: 'publish', label: 'Publish to artists', icon: Send, group: 'Royalties' },
    isPrivileged && { id: 'deals', label: 'Deal changes', icon: ClipboardList, group: 'Royalties' },
    perms.royalties && { id: 'statements', label: 'Statements', icon: Eye, group: 'Royalties' },
    perms.royalties && { id: 'payouts', label: 'Payouts', icon: Wallet, group: 'Royalties' },

    // Spending: what the label pays out other than royalties.
    (perms.spend || inInvoiceWorkflow) && { id: 'invoices', label: 'Invoices', icon: FileText, group: 'Spending' },
    perms.spend && { id: 'ledger', label: 'Expenses & income', icon: Wallet, group: 'Spending' },
    perms.spend && !pmScope && { id: 'budget', label: 'Budget', icon: DollarSign, group: 'Spending' },

    isPrivileged && { id: 'team', label: 'Team', icon: UserCog, group: 'Team' },
    isPrivileged && { id: 'access-requests', label: 'Access requests', icon: ShieldCheck, group: 'Team' },
    session && session.mode === 'team' && { id: 'tasks', label: 'Tasks', icon: ClipboardList, group: 'Team' },
    perms.notices && { id: 'notices', label: 'Noticeboard', icon: Bell, group: 'Team' },
    isPrivileged && { id: 'activity', label: 'Activity', icon: History, group: 'Team' },

    isPrivileged && { id: 'backup', label: 'Backup & restore', icon: FileDown, group: 'System' },
  ].filter(Boolean);

  useEffect(() => {
    if (session && session.mode === 'team' && NAV.length && !NAV.find(n => n.id === active)) {
      setActive(NAV[0].id);
    }
    // eslint-disable-next-line
  }, [session, staff]);

  const shellStyle = { background: CANVAS_GRADIENT, fontFamily: HEADING_FONT, color: C.text };

  // Signed in by email: the staff record with that email decides role and access.
  const authMember = authEmail ? staff.find(s => (s.email || '').toLowerCase() === authEmail.toLowerCase()) : null;
  useEffect(() => {
    if (!loading && authMember && !session) setSession({ mode: 'team', name: authMember.name, role: authMember.role, permissions: permissionsFor(authMember) });
  }, [loading, authMember, session]);
  const logout = () => { setSession(null); if (signOut) signOut(); };

  if (loading) {
    return (
      <div style={shellStyle} className="w-full rounded-lg border flex flex-col items-center justify-center gap-2 imss-gate" >
        <style>{GLOBAL_STYLES}</style>
        <div className="imss-bg-blob imss-bg-blob-1"></div>
        <div className="imss-bg-blob imss-bg-blob-2"></div>
        <div className="imss-glass-layer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <img src={LOGO_DATA_URI} alt="IMSS Records" style={{ height: 28, width: 'auto' }} />
          <div className="text-sm" style={{ color: C.textDim }}>Loading…</div>
        </div>
      </div>
    );
  }

  if (authEmail && !session) return null;

  if (!session) {
    return <IdentityGate roster={roster} staff={staff} onEnterTeam={(info) => setSession({ mode: 'team', ...info })} onEnterArtist={(artistId) => setSession({ mode: 'artist', artistId })} />;
  }

  if (session.mode === 'artist') {
    const artist = roster.find(a => a.id === session.artistId);
    if (!artist) return <IdentityGate roster={roster} staff={staff} onEnterTeam={(info) => setSession({ mode: 'team', ...info })} onEnterArtist={(artistId) => setSession({ mode: 'artist', artistId })} />;
    const view = artistPublishedView(publishedRevenue, slug(artist.name));
    // Same rules as artist_portal(): only sent statements, expenses up to the latest published month.
    const lastPub = view.revenue.reduce((m, r) => r.month > m ? r.month : m, '');
    const shownPayouts = payouts.filter(p => p.artistSlug === slug(artist.name) && p.sentAt);
    const shownLedger = approvedLedger.filter(l => lastPub && String(l.date || '').slice(0, 7) <= lastPub);
    const shownFiles = statementFiles.filter(f => f.artistId === artist.id && (f.months || []).every(m => view.revenue.some(r => r.month === m)));
    return <ArtistPortalShell artist={artist} roster={roster} catalog={catalogView} revenue={view.revenue} streams={streams} masterGross={view.masterGross} payouts={shownPayouts} ledger={shownLedger} notices={notices} profileRequests={profileRequests} updateProfileRequests={updateProfileRequests} artistRequests={artistRequests} updateArtistRequests={updateArtistRequests} releaseSubmissions={releaseSubmissions} updateReleaseSubmissions={updateReleaseSubmissions} invoices={invoices} updateInvoices={updateInvoices} statementFiles={shownFiles} dealChanges={dealChanges.filter(c => c.artistId === artist.id && c.status === 'Approved')} labelSettings={labelSettings} onLogout={logout} />;
  }

  return (
    <div style={shellStyle} className="w-full rounded-lg border overflow-hidden imss-shell">
      <style>{GLOBAL_STYLES}</style>
      <div className="imss-bg-blob imss-bg-blob-1"></div>
      <div className="imss-bg-blob imss-bg-blob-2"></div>
      <div className="imss-bg-blob imss-bg-blob-3"></div>
      <div className="imss-bg-blob imss-bg-blob-4"></div>
      <Sidebar active={active} setActive={setActive} nav={NAV} onClearAll={clearAll} confirmReset={confirmReset} setConfirmReset={setConfirmReset} onReseed={reseedSample} confirmReseed={confirmReseed} setConfirmReseed={setConfirmReseed} sessionName={session.name + (session.role ? ' · ' + session.role : '')} onLogout={logout} />
      <div className="flex-1 min-w-0 imss-content">
        <div className="imss-content-inner">
        <TopBar roster={roster} catalog={catalogView} staff={staff} tasks={tasks} revenue={revenue} ledger={ledger} notices={notices} profileRequests={profileRequests} artistRequests={artistRequests} releaseSubmissions={releaseSubmissions} accessRequests={accessRequests} isAdmin={isAdmin} sessionName={session.name} notifications={attention} setActive={setActive} openItem={openItem} />
        {error && (
          <div className="rounded px-3 py-2 text-xs mb-4" style={{ background: C.redSoft, color: C.red, border: '1px solid ' + C.red }}>{error}</div>
        )}
        {NAV.length === 0 && <EmptyState icon={ShieldCheck} title="No access granted yet" description="Ask your Admin to grant you access from the Team tab." />}
        {active === 'overview' && <Overview roster={roster} catalog={catalogView} revenue={approvedRevenue} masterGross={monthlyMasterGross} streams={streamsView} artistMap={artistMap} releaseMap={releaseMap} notices={notices} staff={staff} sessionName={session.name} canViewRoyalties={!!perms.royalties} attention={attention} onOpen={openItem} />}
        {active === 'import' && <ImportSection publishedRevenue={publishedRevenue} updatePublishedRevenue={updatePublishedRevenue} roster={roster} catalog={catalogView} revenue={revenue} streams={streams} updateRoster={updateRoster} updateCatalog={updateCatalog} updateRevenue={updateRevenue} updateStreams={updateStreams} masterGross={monthlyMasterGross} statementFiles={statementFiles} updateStatementFiles={updateStatementFiles} sessionName={session.name} />}
        {active === 'roster' && <RosterSection focus={focus} updateCatalog={updateCatalog} updateTasks={updateTasks} invoices={invoices} dealChanges={dealChanges} updateDealChanges={updateDealChanges} session={session} publishedRevenue={publishedRevenue} statementFiles={statementFiles} roster={roster} update={updateRoster} catalog={catalogView} staff={staff} canEdit={canEdit} pmScope={pmScope} revenue={approvedRevenue} streams={streamsView} masterGross={monthlyMasterGross} payouts={payouts} ledger={approvedLedger} labelSettings={labelSettings} canViewRoyalties={!!perms.royalties} canViewSpend={!!perms.spend} tasks={tasks} sessionName={session.name} isAdmin={isAdmin} profileRequests={profileRequests} updateProfileRequests={updateProfileRequests} />}
        {active === 'artist-requests' && <ArtistRequestsSection artistRequests={artistRequests} update={updateArtistRequests} roster={roster} sessionName={session.name} pmScope={pmScope} />}
        {active === 'team' && <TeamSection staff={staff} update={updateStaff} sessionRole={session.role} sessionName={session.name} accessRequests={accessRequests} updateAccessRequests={updateAccessRequests} />}
        {active === 'access-requests' && <AccessRequestsSection accessRequests={accessRequests} update={updateAccessRequests} staff={staff} updateStaff={updateStaff} isAdmin={isAdmin} sessionName={session.name} />}
        {active === 'backup' && <BackupSection
          allData={{ roster, catalog, revenue, streams, payouts, masterGross, labelSettings, staff, tasks, ledger, accessRequests, invoices }}
          updaters={{ roster: updateRoster, catalog: updateCatalog, revenue: updateRevenue, streams: updateStreams, payouts: updatePayouts, masterGross: updateMasterGross, labelSettings: updateLabelSettings, staff: updateStaff, tasks: updateTasks, ledger: updateLedger, accessRequests: updateAccessRequests, invoices: updateInvoices }}
          dataVersion={DATA_VERSION}
        />}
        {active === 'catalog' && <CatalogSection focus={focus} catalog={catalogView} update={updateCatalog} roster={roster} artistMap={artistMap} canEdit={canEdit} pmScope={pmScope} releaseSubmissions={releaseSubmissions} updateReleaseSubmissions={updateReleaseSubmissions} sessionName={session.name}  incomingSubmission={acceptingSubmission} clearIncoming={() => setAcceptingSubmission(null)} onOpenSubmissions={() => setActive('submissions')} />}
        {active === 'calendar' && <ReleaseCalendarSection focus={focus} catalog={catalogView} roster={roster} artistMap={artistMap} tasks={tasks} />}
        {active === 'revenue' && <RevenueSection revenue={revenue} update={updateRevenue} roster={roster} catalog={catalogView} canEdit={canEdit} isAdmin={isAdmin} sessionName={session.name} />}
        {active === 'streams' && <StreamsSection streams={streamsView} update={updateStreams} catalog={catalogView} releaseMap={releaseMap} artistMap={artistMap} canEdit={canEdit} />}
        {active === 'mastergross' && <MasterGrossSection masterGross={masterGross} update={updateMasterGross} roster={roster} revenue={approvedRevenue} labelSettings={labelSettings} updateLabelSettings={updateLabelSettings} canEdit={canEdit} />}
        {active === 'submissions' && <SubmissionsSection releaseSubmissions={releaseSubmissions} update={updateReleaseSubmissions} roster={roster} pmScope={pmScope} canEdit={canEdit} sessionName={session.name} onAccept={sub => { setAcceptingSubmission(sub); setActive('catalog'); }} />}
        {active === 'invoices' && <InvoicesSection invoices={invoices} update={updateInvoices} roster={roster} staff={staff} labelSettings={labelSettings} updateLabelSettings={updateLabelSettings} canEdit={canEdit} session={session} pmScope={pmScope} />}
        {active === 'deals' && <DealChanges roster={roster} updateRoster={updateRoster} changes={dealChanges} updateChanges={updateDealChanges} publishedRevenue={publishedRevenue} session={session} canEdit={canEdit} catalog={catalog} updateCatalog={updateCatalog} tasks={tasks} updateTasks={updateTasks} ledger={approvedLedger} invoices={invoices} />}
        {active === 'publish' && <PublishToArtists roster={roster} approvedRevenue={approvedRevenue} masterGross={monthlyMasterGross} published={publishedRevenue} updatePublished={updatePublishedRevenue} log={revenuePublish} updateLog={updateRevenuePublish} labelSettings={labelSettings} updateLabelSettings={updateLabelSettings} session={session} canEdit={canEdit} />}
        {active === 'payouts' && <PayoutsSection invoices={invoices} payouts={payouts} update={updatePayouts} roster={roster} revenue={approvedRevenue} masterGross={monthlyMasterGross} ledger={approvedLedger} canEdit={canEdit} />}
        {active === 'ledger' && <LedgerSection invoices={invoices} ledger={ledger} update={updateLedger} roster={roster} revenue={approvedRevenue} masterGross={monthlyMasterGross} canEdit={canEdit} isAdmin={isAdmin} sessionName={session.name} pmScope={pmScope} />}
        {active === 'budget' && <BudgetSection labelBudgets={labelBudgets} update={updateLabelBudgets} ledger={approvedLedger} roster={roster} canEdit={canEdit} />}
        {active === 'notices' && <NoticesSection notices={notices} update={updateNotices} roster={roster} staff={staff} sessionName={session.name} />}
        {active === 'statements' && <StatementsSection invoices={invoices} roster={roster} revenue={approvedRevenue} masterGross={monthlyMasterGross} ledger={approvedLedger} payouts={payouts} statementFiles={statementFiles} />}
        {active === 'tasks' && <TasksSection tasks={tasks} update={updateTasks} staff={staff} roster={roster} catalog={catalogView} />}
        {active === 'activity' && <AuditSection roster={roster} />}
        <div className="imss-mobile-only mt-8 text-xs" style={{ color: C.textFaint }}>
          {confirmReset ? (
            <span className="inline-flex gap-2">
              Clear all data?
              <button onClick={clearAll} style={{ color: C.red, fontWeight: 600 }}>Yes</button>
              <button onClick={() => setConfirmReset(false)} style={{ color: C.textDim }}>Cancel</button>
            </span>
          ) : (
            <button onClick={() => setConfirmReset(true)}>Clear all data</button>
          )}
          <div className="mt-2">
            {confirmReseed ? (
              <span className="inline-flex gap-2">
                Overwrite with sample data?
                <button onClick={reseedSample} style={{ color: C.amber, fontWeight: 600 }}>Yes</button>
                <button onClick={() => setConfirmReseed(false)} style={{ color: C.textDim }}>Cancel</button>
              </span>
            ) : (
              <button onClick={() => setConfirmReseed(true)}>Reset to sample data</button>
            )}
          </div>
        </div>
        <LegalFooter />
        </div>
      </div>
    </div>
  );
}
