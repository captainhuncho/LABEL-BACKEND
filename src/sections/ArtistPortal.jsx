import { Calendar, ChevronDown, Megaphone, ChevronRight, ClipboardList, Coins, Disc3, DollarSign, Eye, FileText, Globe, LayoutDashboard, LogOut, MessageSquare, Plus, Trash2, TrendingUp, Upload, UserCog, Video, Wallet } from 'lucide-react';
import { DOC_MAX_BYTES, uploadDocument } from '../storage.js';
import React, { useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { COLLABORATOR_ROLES, EXPLICIT_OPTIONS, SPLIT_REQUIRED_ROLES, dealLabel, RELEASE_TYPES, checklistProgress, emptyCredits, formatCents, formatDate, formatNumber, makeDistributionDocs, missingRequiredDocs, monthKey, monthLabel, releaseStatusTone, todayStr, uid } from '../constants.js';
import { artistLifetime, recoupmentForArtist, revenueBreakdown, revenueRowSplit, artistSpend, dealTermsOf, pctAt, lastClosedPeriod, reportingTerms, slug } from '../finance.js';
import { SOCIAL_LINKS, safeLink, PROFILE_EDITABLE_FIELDS, REQUEST_CATEGORIES } from '../seed.js';
import { LegalFooter } from '../Legal.jsx';
import { NotificationBell } from './Notifications.jsx';
import { C, CANVAS_GRADIENT, GLOBAL_STYLES, HEADING_FONT, LOGO_DATA_URI, MONO_FONT } from '../theme.js';
import { ArtworkThumb, Avatar, Badge, Btn, EmptyState, ExportBar, Field, Input, KPICard, PeopleInput, Select, Td, TextArea, Th, resizeImageFile, PhotoCropper } from '../ui.jsx';
import { pctTxt, DealSpanNote, ArtistStatementView } from './ArtistStatement.jsx';
import { INVOICE_KINDS, invoiceStatus, artistInvoiceStatus, INVOICE_TONES, InvoiceThread } from './Invoices.jsx';
import { BREAKDOWN_FIELDS, breakdownLabel, RevenueBreakdownTable, StatementFilesList } from './StatementFiles.jsx';
import { SUBMISSION_LABELS, SUBMISSION_TONES } from './Submissions.jsx';

import { licenseFor, rightsLine } from '../licenses.js';
import { streamsFromRevenue } from '../streams.js';
import { PasskeySettings } from '../Passkeys.jsx';
import { MobileNav } from '../MobileNav.jsx';
import { ArtistBudgets, BUDGET_TYPES } from './Budget.jsx';
import { usePageUrl } from '../pageUrl.js';
import { TwoFactorSettings } from '../Mfa.jsx';
import { InvoicesTab } from './portal/InvoicesTab.jsx';
import { ExpensesTab } from './portal/ExpensesTab.jsx';
import { EarningsTab } from './portal/EarningsTab.jsx';
import { PayoutsTab } from './portal/PayoutsTab.jsx';
import { RevenueTab } from './portal/RevenueTab.jsx';
import { RequestsTab } from './portal/RequestsTab.jsx';
import { ProfileTab } from './portal/ProfileTab.jsx';
import { ReleasesTab } from './portal/ReleasesTab.jsx';
import { OverviewTab } from './portal/OverviewTab.jsx';

export function ArtistPortalShell({ artist, roster, catalog, revenue, streams, masterGross = [], payouts, ledger = [], notices = [], profileRequests = [], updateProfileRequests, artistRequests = [], updateArtistRequests, releaseSubmissions = [], updateReleaseSubmissions, invoices = [], updateInvoices, replyToSubmission = null, replyToInvoice = null, statementFiles = [], dealChanges = [], labelSettings, onLogout, saveProfile = null, budgets = [], resubmitInvoice = null, preview = false }) {
  // Same published figures the artist sees decide whether a license is held (src/licenses.js).
  const licenseCtx = { ledger, invoices, publishedRevenue: revenue };
  // A rights return shows to the artist only once Admin or Legal has sent it to their dashboard.
  const sentChangeIds = new Set(dealChanges.filter(c => c.sentToArtistAt).map(c => c.id));
  const rightsArtist = { ...artist, rightsReturned: (artist.rightsReturned || []).filter(r => sentChangeIds.has(r.changeId)) };
  const [pickedReleases, setPickedReleases] = useState([]);
  const [tab, setTab] = useState('overview');
  const artistCatalog = useMemo(() => catalog.filter(c => c.artistId === artist.id).sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || '')), [catalog, artist.id]);
  const releaseIds = useMemo(() => new Set(artistCatalog.map(c => c.id)), [artistCatalog]);
  const aSlug = useMemo(() => slug(artist.name), [artist.name]);

  const myRevenue = useMemo(() => revenue.filter(r => r.artistSlug === aSlug), [revenue, aSlug]);
  // Streams from published EMPIRE statements, plus any entered by hand.
  const myStreams = useMemo(() => [...streams, ...streamsFromRevenue(revenue, catalog, roster && roster.length ? roster : [artist])].filter(s => releaseIds.has(s.releaseId)), [streams, revenue, catalog, roster, artist, releaseIds]);

  const totalStreams = myStreams.reduce((s, r) => s + r.count, 0);

  const lifetime = useMemo(() => artistLifetime(artist, revenue, masterGross), [artist, revenue, masterGross]);
  const recoupment = useMemo(() => recoupmentForArtist(artist, ledger, revenue, masterGross, invoices), [artist, ledger, revenue, masterGross, invoices]);
  const myExpenses = useMemo(() => [...ledger.filter(x => x.artist === artist.name && x.type === 'expense')].sort((a, b) => (b.date || '').localeCompare(a.date || '')), [ledger, artist.name]);
  const recoupable = recoupment.spent;
  const remainingRecoupable = recoupment.unrecouped;
  const netAfterRecoupment = recoupment.dueOnTop;
  const myPayouts = useMemo(() => [...payouts.filter(p => p.artistSlug === aSlug)].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), [payouts, aSlug]);
  const paid = myPayouts.filter(p => p.status === 'paid').reduce((s, p) => s + (p.artistShare || 0), 0);
  const balance = netAfterRecoupment - paid;
  const isFunded = artist.fundingTier === 'Funded';
  // Budget used: label spend on the artist plus their approved claims.
  const totalSpent = artistSpend(artist, ledger, invoices).budgetUsed;
  const budgetRemaining = (artist.annualBudget || 0) - totalSpent;
  const budgetPct = artist.annualBudget > 0 ? Math.min(100, Math.round((totalSpent / artist.annualBudget) * 100)) : 0;

  const spendByCategory = useMemo(() => {
    const map = {};
    myExpenses.forEach(x => { map[x.category] = (map[x.category] || 0) + x.amount; });
    return Object.entries(map).map(([category, value]) => ({ category, value })).sort((a, b) => b.value - a.value);
  }, [myExpenses]);

  const spendByMonth = useMemo(() => {
    const map = {};
    myExpenses.forEach(x => { const k = monthKey(x.date); map[k] = (map[k] || 0) + x.amount; });
    return Object.keys(map).sort().map(k => ({ month: monthLabel(k), value: map[k] }));
  }, [myExpenses]);

  const platformTotals = useMemo(() => {
    const map = {};
    myStreams.forEach(s => { map[s.platform] = (map[s.platform] || 0) + s.count; });
    return Object.keys(map).map(k => ({ name: k, value: map[k] }));
  }, [myStreams]);

  const sortedMyRevenue = [...myRevenue].sort((a, b) => (b.month || '').localeCompare(a.month || ''));

  const EMPTY_REV_FILTERS = { startDate: '', endDate: '', type: 'all', product: 'all' };
  const [revFilters, setRevFilters] = useState(EMPTY_REV_FILTERS);
  const [revGroupBy, setRevGroupBy] = useState('none');
  // Nothing is listed until the artist picks a period and hits Generate, so the
  // tab answers the question they asked rather than dumping the whole history.
  const [revGenerated, setRevGenerated] = useState(null);
  const [revError, setRevError] = useState('');
  function resetRevFilters() { setRevFilters(EMPTY_REV_FILTERS); setRevGenerated(null); setRevError(''); }
  function generateRevenue() {
    if (revFilters.startDate && revFilters.endDate && revFilters.startDate > revFilters.endDate) {
      setRevError('The "from" date has to come before the "to" date.');
      return;
    }
    setRevError('');
    setRevGenerated({ ...revFilters });
  }

  const filteredMyRevenue = useMemo(() => {
    if (!revGenerated) return [];
    return sortedMyRevenue.filter(r => {
      if (revGenerated.startDate && (r.month + '-01') < revGenerated.startDate) return false;
      if (revGenerated.endDate && (r.month + '-01') > revGenerated.endDate) return false;
      if (revGenerated.type !== 'all' && r.type !== revGenerated.type) return false;
      if (revGenerated.product !== 'all' && r.title !== revGenerated.product) return false;
      return true;
    });
  }, [sortedMyRevenue, revGenerated]);
  const revFiltersActive = !!(revGenerated && (revGenerated.startDate || revGenerated.endDate || revGenerated.type !== 'all' || revGenerated.product !== 'all'));
  const myPct = artist.artistPct != null ? artist.artistPct : 0;
  // Latest approved deal change, shown on the dashboard for 60 days unless dismissed.
  const pctLabel = x => Math.round(Number(x) * 10000) / 100 + '%';
  const monthLong = m => new Date(m + '-01T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const latestDeal = [...dealChanges.filter(c => !c.kind && c.sentToArtistAt)].sort((a, b) => String(b.approvedAt).localeCompare(String(a.approvedAt)))[0] || null;
  const dealKey = latestDeal ? 'imss:deal-seen:' + latestDeal.id : '';
  const [dealSeen, setDealSeen] = useState(() => { try { return !!dealKey && localStorage.getItem(dealKey) === '1'; } catch (e) { return false; } });
  const showDealBanner = latestDeal && !dealSeen && Date.now() - Date.parse(latestDeal.approvedAt || 0) < 60 * 86400000;
  // The rate actually used for a set of rows (published rows carry their own); "your deal rates" when it varies.
  const rateLabel = rows => { const rates = [...new Set(rows.map(r => Math.round((r.final ? r.artistPct : pctAt(artist, r.month)) * 10000)))]; return rates.length === 1 ? rates[0] / 100 + '% of net' : 'at your deal rates'; };
  function dismissDeal() { try { localStorage.setItem(dealKey, '1'); } catch (e) { /* private mode: hide for this visit */ } setDealSeen(true); }
  const splitOf = (r) => revenueRowSplit(r, revenue, masterGross, myPct);
  const sumSplits = (rows) => rows.map(splitOf).reduce((t, x) => ({ gross: t.gross + x.gross, charge: t.charge + x.charge, labelShare: t.labelShare + x.labelShare, artistShare: t.artistShare + x.artistShare }), { gross: 0, charge: 0, labelShare: 0, artistShare: 0 });
  const filteredRevTotals = useMemo(() => sumSplits(filteredMyRevenue), [filteredMyRevenue, revenue, masterGross, myPct]);

  // Dashboard: a month range (YYYY-MM, inclusive) applied on Update; the
  // balance above it stays all-time.
  const dataMonths = useMemo(() => Array.from(new Set(myRevenue.map(r => r.month))).sort(), [myRevenue]);
  const latestMonth = dataMonths[dataMonths.length - 1] || todayStr().slice(0, 7);
  const shiftMonth = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  const DASH_PRESETS = [
    { id: '3m', label: 'Last 3 months', range: () => ({ from: shiftMonth(latestMonth, -2), to: latestMonth }) },
    { id: '6m', label: 'Last 6 months', range: () => ({ from: shiftMonth(latestMonth, -5), to: latestMonth }) },
    { id: 'year', label: 'This year', range: () => ({ from: latestMonth.slice(0, 4) + '-01', to: latestMonth }) },
    { id: 'all', label: 'All time', range: () => ({ from: '', to: '' }) },
  ];
  const [dashDraft, setDashDraft] = useState(() => DASH_PRESETS[1].range());
  const [dashRange, setDashRange] = useState(dashDraft);
  const [dashError, setDashError] = useState('');
  function applyDashRange(r) {
    if (r.from && r.to && r.from > r.to) { setDashError('The “from” month has to come before the “to” month.'); return; }
    setDashError(''); setDashDraft(r); setDashRange(r);
  }
  const inDash = m => (!dashRange.from || m >= dashRange.from) && (!dashRange.to || m <= dashRange.to);
  const activePreset = (DASH_PRESETS.find(p => { const r = p.range(); return r.from === dashRange.from && r.to === dashRange.to; }) || {}).id;
  const dashLabel = !dashRange.from && !dashRange.to ? 'All time' : (dashRange.from ? monthLabel(dashRange.from) : '…') + ' – ' + (dashRange.to ? monthLabel(dashRange.to) : '…');
  const dashRevenue = useMemo(() => myRevenue.filter(r => inDash(r.month)), [myRevenue, dashRange]);

  const dashReleased = artistCatalog.filter(c => c.status === 'Released' && (!c.releaseDate || inDash(c.releaseDate.slice(0, 7))));
  const releasedByType = Object.entries(dashReleased.reduce((m, c) => { const t = c.type || 'Other'; m[t] = (m[t] || 0) + 1; return m; }, {})).sort((x, y) => y[1] - x[1]);

  // Who's on a song: the artist, any extra primary artists, then features.
  function creditLine(title) {
    const rel = artistCatalog.find(c => c.title === title) || {};
    const primaries = [artist.name, ...(rel.primaryArtists || [])].join(' & ');
    const feats = (rel.collaborators || []).filter(c => (c.role || '').toLowerCase() === 'feature').map(c => c.name).filter(Boolean);
    return { primaries, feats };
  }
  const dashTopSongs = useMemo(() => {
    const map = {};
    dashRevenue.forEach(r => { (map[r.title] = map[r.title] || []).push(r); });
    return Object.entries(map).map(([title, rows]) => ({ title, units: rows.reduce((t, r) => t + (Number(r.quantity) || 0), 0), ...sumSplits(rows) })).sort((x, y) => y.gross - x.gross).slice(0, 5);
  }, [dashRevenue, revenue, masterGross, myPct]);

  const dashRetailers = useMemo(() => {
    const map = {};
    dashRevenue.forEach(r => Object.entries(r.stores || {}).forEach(([k, v]) => { map[k] = (map[k] || 0) + v; }));
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((x, y) => y.value - x.value);
  }, [dashRevenue]);
  const dashGross = dashRevenue.reduce((t, r) => t + r.earning, 0);
  const dashCountries = useMemo(() => {
    const map = {};
    dashRevenue.forEach(r => Object.entries(r.countries || {}).forEach(([k, v]) => { map[k] = (map[k] || 0) + v; }));
    return Object.entries(map).map(([code, value]) => ({ code, value })).sort((x, y) => y.value - x.value);
  }, [dashRevenue]);
  const dashUnits = dashRevenue.reduce((t, r) => t + (Number(r.quantity) || 0), 0);

  const dashBestMonth = useMemo(() => {
    const map = {};
    dashRevenue.forEach(r => { map[r.month] = (map[r.month] || 0) + splitOf(r).artistShare; });
    return Object.entries(map).sort((x, y) => y[1] - x[1])[0] || null;
  }, [dashRevenue, revenue, masterGross, myPct]);

  function openReleaseRevenue(title) {
    const f = { ...EMPTY_REV_FILTERS, product: title };
    setRevFilters(f); setRevGenerated(f); setRevError(''); setRevGroupBy('none'); setTab('revenue');
  }

  // Earnings: each month's totals, newest first, with a running total.
  const earningsByMonth = useMemo(() => {
    const map = {};
    myRevenue.forEach(r => {
      const x = splitOf(r), m = map[r.month] || (map[r.month] = { month: r.month, gross: 0, charge: 0, labelShare: 0, artistShare: 0, rate: r.final ? r.artistPct : pctAt(artist, r.month) });
      m.gross += x.gross; m.charge += x.charge; m.labelShare += x.labelShare; m.artistShare += x.artistShare;
    });
    let running = 0;
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month)).map(m => ({ ...m, running: (running += m.artistShare) })).reverse();
  }, [myRevenue, revenue, masterGross, myPct]);

  // Invoices and expenses the artist paid themselves.
  const myInvoices = useMemo(() => [...invoices.filter(i => i.artistId === artist.id)].sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || '')), [invoices, artist.id]);
  const myExpenseClaims = myInvoices.filter(i => i.kind === 'expense');
  const invoicesDue = myInvoices.filter(i => invoiceStatus(i) === 'Pay Approved').reduce((t, i) => t + (Number(i.amount) || 0), 0);
  const emptyInvoice = { kind: 'expense', title: '', invoiceNumber: '', invoiceDate: todayStr(), amount: '', payTo: '', details: '', attachment: '', attachmentName: '', overheadId: '', categoryId: '', budgetCategory: '' };
  const [resubmittingId, setResubmittingId] = useState(null); // a returned invoice being fixed
  const [invoiceForm, setInvoiceForm] = useState(emptyInvoice);
  const [invoiceError, setInvoiceError] = useState('');
  const [invoiceSent, setInvoiceSent] = useState(false);
  const invoiceFileRef = useRef(null);
  function handleInvoiceFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > DOC_MAX_BYTES) { setInvoiceError('That file is over ' + DOC_MAX_BYTES / 1048576 + ' MB. Attach a smaller PDF or photo.'); e.target.value = ''; return; }
    uploadDocument(artist.id, file).then(value => setInvoiceForm(f => ({ ...f, attachment: value, attachmentName: file.name })), err => { setInvoiceError('Could not upload the file: ' + (err.message || err)); e.target.value = ''; });
  }
  function submitInvoice(e) {
    e.preventDefault();
    const amount = Math.round(parseFloat(invoiceForm.amount) * 100) / 100;
    if (!invoiceForm.title.trim()) { setInvoiceError('Add a short description of what the invoice is for.'); return; }
    if (!(amount > 0)) { setInvoiceError('Enter the amount in USD, for example 120.50.'); return; }
    if (!invoiceForm.budgetCategory) { setInvoiceError('Choose what it’s for.'); return; }
    // The chosen category also places it in the budget, if one is picked.
    const [bt, bn] = invoiceForm.budgetCategory.split('|');
    const ob = budgets.find(b => b.id === invoiceForm.overheadId);
    const line = ob ? ((ob.categories || []).find(c => c.type === bt && c.category === bn) || { id: bt === 'Other' ? '' : 'x:' + bt + '|' + bn }).id : '';
    invoiceForm.categoryId = line; invoiceForm.category = bt === 'Other' ? 'Other' : bt + ' · ' + bn;
    if (resubmittingId) {
      const changes = { budgetCategory: invoiceForm.budgetCategory, category: invoiceForm.category, title: invoiceForm.title.trim(), amount, invoiceDate: invoiceForm.invoiceDate, invoiceNumber: invoiceForm.invoiceNumber, payTo: invoiceForm.payTo, details: invoiceForm.details, attachment: invoiceForm.attachment, attachmentName: invoiceForm.attachmentName, overheadId: invoiceForm.overheadId, categoryId: invoiceForm.categoryId };
      if (resubmitInvoice) resubmitInvoice(resubmittingId, changes);
      else updateInvoices(invoices.map(i => i.id !== resubmittingId ? i : { ...i, ...changes, status: 'PM Approval', reviewNote: '', history: [...(i.history || []), { at: new Date().toISOString(), by: artist.name, action: 'resubmitted', from: 'Needs changes', to: 'PM Approval', note: '' }] }));
      setResubmittingId(null); setInvoiceForm(emptyInvoice); setInvoiceError(''); setInvoiceSent(true);
      return;
    }
    const invoice = { id: uid(), artistId: artist.id, ...invoiceForm, title: invoiceForm.title.trim(), amount, status: 'PM Approval', history: [], submittedAt: new Date().toISOString() };
    updateInvoices([invoice, ...invoices]);
    setInvoiceForm(emptyInvoice); setInvoiceError(''); setInvoiceSent(true);
    if (invoiceFileRef.current) invoiceFileRef.current.value = '';
  }
  const revTypes = useMemo(() => Array.from(new Set(myRevenue.map(r => r.type).filter(Boolean))), [myRevenue]);
  function revPeriodLabel() {
    if (!revGenerated) return '';
    const s = revGenerated.startDate, e = revGenerated.endDate;
    if (!s && !e) return 'All periods';
    return (s ? formatDate(s) : '…') + ' – ' + (e ? formatDate(e) : '…');
  }

  const revByType = useMemo(() => {
    const map = {};
    filteredMyRevenue.forEach(r => { map[r.type] = (map[r.type] || 0) + r.earning; });
    return Object.entries(map).map(([type, value]) => ({ type, value })).sort((a, b) => b.value - a.value);
  }, [filteredMyRevenue]);

  const revByProduct = useMemo(() => {
    const map = {};
    filteredMyRevenue.forEach(r => {
      const key = r.title;
      if (!map[key]) map[key] = { title: r.title, total: 0, entries: [] };
      map[key].total += r.earning;
      map[key].entries.push(r);
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [filteredMyRevenue]);

  const myNotices = useMemo(() => [...notices.filter(n => n.audience === 'all' || n.audience === artist.id)].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')), [notices, artist.id]);

  const needsToKnow = [];
  if (remainingRecoupable > 0) needsToKnow.push({ tone: 'amber', text: formatCents(remainingRecoupable) + ' in expenses still being recouped before payouts resume' });

  const TABS = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'revenue', label: 'Royalties', icon: Disc3 },
    { id: 'earnings', label: 'Earnings', icon: TrendingUp },
    { id: 'expenses', label: 'Expenses', icon: Coins },
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'statements', label: 'Statements', icon: Eye },
    { id: 'payouts', label: 'Payouts', icon: Wallet },
    (isFunded || budgets.length > 0) && { id: 'budget', label: 'Budget', icon: ClipboardList },
    { id: 'releases', label: 'Releases', icon: Disc3 },
    { id: 'requests', label: 'Requests', icon: MessageSquare },
    { id: 'profile', label: 'Profile', icon: UserCog },
  ].filter(Boolean);

  // A team preview (Publish to artists) leaves the team page's address alone.
  usePageUrl(preview ? [] : TABS, tab, setTab);

  const myArtistRequests = useMemo(() => [...artistRequests.filter(r => r.artistId === artist.id)].sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || '')), [artistRequests, artist.id]);
  const openRequestCount = myArtistRequests.filter(r => r.status !== 'Resolved').length;
  const [requestForm, setRequestForm] = useState({ category: REQUEST_CATEGORIES[0], title: '', message: '' });
  const [expandedRequestId, setExpandedRequestId] = useState(null);
  function submitArtistRequest() {
    if (!requestForm.title.trim() || !requestForm.message.trim()) return;
    const request = { id: uid(), artistId: artist.id, ...requestForm, status: 'Open', submittedAt: new Date().toISOString(), respondedBy: '', response: '', resolvedAt: '' };
    updateArtistRequests([request, ...artistRequests]);
    setRequestForm({ category: REQUEST_CATEGORIES[0], title: '', message: '' });
  }

  const [replyDrafts, setReplyDrafts] = useState({});
  const [replyError, setReplyError] = useState({});
  async function sendSubmissionReply(sub) {
    const text = (replyDrafts[sub.id] || '').trim();
    if (!text) { setReplyError(e => ({ ...e, [sub.id]: 'Write a reply first.' })); return; }
    setReplyError(e => ({ ...e, [sub.id]: '' }));
    if (replyToSubmission) await replyToSubmission(sub.id, text);
    else updateReleaseSubmissions(releaseSubmissions.map(x => x.id !== sub.id ? x : { ...x, status: 'Pending', messages: [...(x.messages || []), { from: 'artist', by: artist.name, at: new Date().toISOString(), text }] }));
    setReplyDrafts(d => ({ ...d, [sub.id]: '' }));
  }
  const [openInvoiceId, setOpenInvoiceId] = useState(null);
  async function sendInvoiceReply(inv) {
    const text = (replyDrafts['inv_' + inv.id] || '').trim();
    if (!text) { setReplyError(e => ({ ...e, ['inv_' + inv.id]: 'Write a message first.' })); return; }
    setReplyError(e => ({ ...e, ['inv_' + inv.id]: '' }));
    if (replyToInvoice) await replyToInvoice(inv.id, text);
    else updateInvoices(invoices.map(x => x.id !== inv.id ? x : { ...x, messages: [...(x.messages || []), { from: 'artist', by: artist.name, at: new Date().toISOString(), text }] }));
    setReplyDrafts(d => ({ ...d, ['inv_' + inv.id]: '' }));
  }
  const mySubmissions = useMemo(() => [...releaseSubmissions.filter(s => s.artistId === artist.id)].sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || '')), [releaseSubmissions, artist.id]);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const emptySubmitForm = { title: '', type: 'Single', genre: artist.genre || '', proposedDate: '', artworkUrl: '', notes: '', collaborators: [], primaryArtists: [], distributionDocs: makeDistributionDocs(), explicit: 'Not Set', dolbyAtmos: false, lyrics: '', instrumental: false, about: '', rollout: { plan: '', content: '', events: '', socials: '' }, duration: '', credits: emptyCredits(), splitSheet: '', splitSheetName: '', splitsConfirmed: false };
  const [submitForm, setSubmitForm] = useState(emptySubmitForm);
  const [collabError, setCollabError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const splitSheetRef = useRef(null);
  const splitsTotal = submitForm.collaborators.reduce((t, c) => t + (Number(c.splitPercent) || 0), 0);
  function handleSplitSheet(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > DOC_MAX_BYTES) { setSubmitError('That split sheet is over ' + DOC_MAX_BYTES / 1048576 + ' MB. Upload a smaller PDF or photo.'); e.target.value = ''; return; }
    uploadDocument(artist.id, file).then(value => { setSubmitForm(f => ({ ...f, splitSheet: value, splitSheetName: file.name })); setSubmitError(''); }, err => { setSubmitError('Could not upload the split sheet: ' + (err.message || err)); e.target.value = ''; });
  }
  const [newSubmitCollab, setNewSubmitCollab] = useState({ name: '', role: 'Feature', splitPercent: '' });
  const [newSubmitPrimaryArtist, setNewSubmitPrimaryArtist] = useState('');
  const submitArtworkRef = useRef(null);
  const sendsTo = artist.productManager || 'Admin';
  function handleSubmitArtwork(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    resizeImageFile(file, 400, dataUrl => setSubmitForm(f => ({ ...f, artworkUrl: dataUrl })));
  }
  function toggleSubmitDoc(docId) { setSubmitForm(f => ({ ...f, distributionDocs: f.distributionDocs.map(d => d.id === docId ? { ...d, attached: !d.attached } : d) })); }
  function setSubmitDocNote(docId, note) { setSubmitForm(f => ({ ...f, distributionDocs: f.distributionDocs.map(d => d.id === docId ? { ...d, note } : d) })); }
  function addSubmitCollaborator() {
    const name = newSubmitCollab.name.trim();
    const raw = String(newSubmitCollab.splitPercent).trim();
    const pct = Number(raw);
    if (!name) { setCollabError('Enter the person’s name.'); return; }
    if (SPLIT_REQUIRED_ROLES.includes(newSubmitCollab.role) && raw === '') { setCollabError('Enter the split % signed to this ' + newSubmitCollab.role.toLowerCase() + '.'); return; }
    if (raw !== '' && (isNaN(pct) || pct < 0 || pct > 100)) { setCollabError('Split % must be between 0 and 100.'); return; }
    if (splitsTotal + (pct || 0) > 100) { setCollabError('That takes the splits over 100%. You have ' + (100 - splitsTotal) + '% left.'); return; }
    setSubmitForm(f => ({ ...f, collaborators: [...f.collaborators, { name, role: newSubmitCollab.role, splitPercent: pct || 0 }] }));
    setNewSubmitCollab({ name: '', role: 'Feature', splitPercent: '' });
    setCollabError('');
  }
  function removeSubmitCollaborator(idx) { setSubmitForm(f => ({ ...f, collaborators: f.collaborators.filter((_, i) => i !== idx) })); }
  // One control for everyone credited on the song: Primary (co-headliner) or
  // Featured (credited as feat. and listed in the splits with their %).
  const [artistCategory, setArtistCategory] = useState('Primary');
  const [featuredPct, setFeaturedPct] = useState('');
  const [artistAddError, setArtistAddError] = useState('');
  function addSubmitPrimaryArtist() {
    const name = newSubmitPrimaryArtist.trim();
    if (!name) { setArtistAddError('Enter the artist’s name.'); return; }
    if (artistCategory === 'Primary') {
      setSubmitForm(f => ({ ...f, primaryArtists: [...(f.primaryArtists || []), name] }));
    } else {
      const raw = String(featuredPct).trim(), pct = Number(raw);
      if (raw === '') { setArtistAddError('Enter the split % signed to this featured artist.'); return; }
      if (isNaN(pct) || pct < 0 || pct > 100) { setArtistAddError('Split % must be between 0 and 100.'); return; }
      if (splitsTotal + pct > 100) { setArtistAddError('That takes the splits over 100%. You have ' + (100 - splitsTotal) + '% left.'); return; }
      setSubmitForm(f => ({ ...f, collaborators: [...f.collaborators, { name, role: 'Feature', splitPercent: pct }] }));
      setFeaturedPct('');
    }
    setNewSubmitPrimaryArtist(''); setArtistAddError('');
  }
  function removeSubmitPrimaryArtist(idx) { setSubmitForm(f => ({ ...f, primaryArtists: f.primaryArtists.filter((_, i) => i !== idx) })); }
  function submitReleaseSubmission() {
    if (!submitForm.title.trim()) return;
    if (splitsTotal > 100) { setSubmitError('Splits add up to ' + splitsTotal + '%. They can’t be more than 100%.'); return; }
    if (!submitForm.splitSheet) { setSubmitError('Upload the signed split sheet before sending.'); return; }
    if (!submitForm.splitsConfirmed) { setSubmitError('Confirm that everyone listed has signed the split sheet.'); return; }
    setSubmitError('');
    const submission = { id: uid(), artistId: artist.id, ...submitForm, sentTo: sendsTo, status: 'Pending', submittedAt: new Date().toISOString(), reviewedBy: '', reviewedAt: '' };
    updateReleaseSubmissions([submission, ...releaseSubmissions]);
    setSubmitForm(emptySubmitForm);
    setNewSubmitCollab({ name: '', role: 'Feature', splitPercent: '' });
    if (submitArtworkRef.current) submitArtworkRef.current.value = '';
    if (splitSheetRef.current) splitSheetRef.current.value = '';
    setShowSubmitForm(false);
  }

  const myProfileRequests = useMemo(() => [...profileRequests.filter(r => r.artistId === artist.id)].sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || '')), [profileRequests, artist.id]);
  const myPendingRequest = myProfileRequests.find(r => r.status === 'Pending');
  const [profileForm, setProfileForm] = useState({ photoUrl: artist.photoUrl || '', bio: artist.bio || '', email: artist.email || '', ...Object.fromEntries(SOCIAL_LINKS.map(l => [l.key, artist[l.key] || ''])) });
  const profileInputRef = useRef(null);
  const [profileSaved, setProfileSaved] = useState('');
  const [cropFile, setCropFile] = useState(null);

  function handleProfilePhoto(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setCropFile(file);
  }
  function submitProfileRequest() {
    const changes = {};
    PROFILE_EDITABLE_FIELDS.forEach(f => {
      const current = artist[f.key] || '';
      const proposed = f.link ? (safeLink(profileForm[f.key]) || (profileForm[f.key] ? artist[f.key] || '' : '')) : (profileForm[f.key] || '');
      if (proposed !== current) changes[f.key] = proposed;
    });
    if (Object.keys(changes).length === 0) { setProfileSaved('No changes to save.'); return; }
    if (saveProfile) {
      setProfileSaved('Saving…');
      saveProfile(changes).then(ok => setProfileSaved(ok ? 'Saved.' : 'Couldn’t save. Check the links start with https:// and try again.'));
      return;
    }
    const request = { id: uid(), artistId: artist.id, changes, submittedAt: new Date().toISOString(), status: 'Pending', reviewedBy: '', reviewedAt: '' };
    updateProfileRequests([request, ...profileRequests]);
    if (profileInputRef.current) profileInputRef.current.value = '';
  }

  return (
    <div style={{ background: CANVAS_GRADIENT, fontFamily: HEADING_FONT, color: C.text }} className="w-full overflow-hidden imss-shell imss-portal">
      <style>{GLOBAL_STYLES}</style>
      <div className="imss-bg-blob imss-bg-blob-1"></div>
      <div className="imss-bg-blob imss-bg-blob-2"></div>
      <div className="imss-bg-blob imss-bg-blob-3"></div>
      <div className="imss-bg-blob imss-bg-blob-4"></div>

      <aside className="imss-sidebar imss-print-hide shrink-0" style={{ borderColor: C.border, background: C.panel }} aria-label="Artist navigation">
        <div className="imss-desktop-only px-5 pt-6 pb-5" style={{ borderBottom: '1px solid ' + C.border }}>
          <button type="button" onClick={() => setTab('overview')} aria-label="IMSS Records, go to Dashboard" style={{ display: 'block' }}><img src={LOGO_DATA_URI} alt="" style={{ height: 24, width: 'auto', filter: 'var(--logo-filter)' }} /></button>
          <div className="flex items-center gap-3 mt-5">
            <Avatar name={artist.name} photoUrl={artist.photoUrl} size={40} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{artist.name}</div>
              <div className="text-xs mt-0.5" style={{ color: C.textDim }}>{Math.round(myPct * 100)}% royalty rate</div>
            </div>
          </div>
          {(artist.productManager || artist.anr) && (
            <dl className="mt-4 pt-4 flex flex-col gap-2.5" style={{ borderTop: '1px solid ' + C.border }}>
              {[['Product Manager', artist.productManager], ['A&R', artist.anr]].filter(([, name]) => name).map(([role, name]) => (
                <div key={role}>
                  <dt style={{ color: C.textDim, fontSize: 12 }}>{role}</dt>
                  <dd className="text-sm" style={{ color: C.text, fontWeight: 500, overflowWrap: 'anywhere' }}>{name}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <nav className="imss-nav gap-1 px-2 py-2">
          {(() => {
            let lastGroup = null;
            const out = [];
            TABS.forEach(t => {
              if (t.group !== lastGroup) {
                out.push(<div key={'g-' + t.group} className="imss-desktop-only" style={{ color: C.textDim, fontSize: 11, fontWeight: 600, padding: '14px 12px 4px' }}>{t.group}</div>);
                lastGroup = t.group;
              }
              const Icon = t.icon;
              const isActive = tab === t.id;
              out.push(
                <button key={t.id} onClick={() => setTab(t.id)} aria-current={isActive ? 'page' : undefined}
                  className="imss-portal-nav flex items-center gap-2.5 px-3 py-2 rounded text-sm whitespace-nowrap"
                  style={{ background: isActive ? C.amberSoft : 'transparent', color: isActive ? C.amber : C.textDim, fontWeight: isActive ? 600 : 500 }}>
                  <Icon size={16} />
                  <span style={{ flex: 1, textAlign: 'left' }}>{t.label}</span>
                  {t.id === 'requests' && openRequestCount > 0 && (
                    <span aria-label={openRequestCount + ' open'} style={{ background: C.amberFill, color: C.onAmber, borderRadius: 9999, fontSize: 10, fontWeight: 700, minWidth: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{openRequestCount}</span>
                  )}
                </button>
              );
            });
            out.push(
              <button key="signout" onClick={onLogout} className="imss-mobile-only imss-portal-nav px-3 py-2 rounded text-sm whitespace-nowrap" style={{ color: C.textDim }}>
                <span className="inline-flex items-center gap-2"><LogOut size={16} /> Sign out</span>
              </button>
            );
            return out;
          })()}
        </nav>
        <div className="imss-desktop-only mt-auto px-3 py-3" style={{ borderTop: '1px solid ' + C.border }}>
          <button onClick={onLogout} className="imss-portal-nav w-full flex items-center gap-2.5 px-3 py-2 rounded text-sm" style={{ color: C.textDim }}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      <main className="imss-content">
        <div className="imss-content-inner" style={{ maxWidth: 1120 }}>
        <div className="imss-mobile-only mb-5">
          <div className="flex items-center gap-3">
            <Avatar name={artist.name} photoUrl={artist.photoUrl} size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{artist.name}</div>
              <div className="text-xs" style={{ color: C.textDim }}>{Math.round(myPct * 100)}% royalty rate</div>
            </div>
            <NotificationBell routes={{ budget: 'budget', notice: 'overview', deal: 'profile', earnings: 'revenue', statement: 'statements', invoice: 'invoices', submission: 'releases', request: 'requests' }} onOpen={setTab} />
            <button onClick={onLogout} aria-label="Sign out" title="Sign out" className="inline-flex items-center gap-1.5" style={{ background: C.fill, color: C.text, borderRadius: 980, padding: '8px 12px', fontSize: 14 }}><LogOut size={15} /> <span className="imss-alerts-label">Sign out</span></button>
          </div>
        </div>

        {tab !== 'overview' && (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h1 className="imss-portal-title">{(TABS.find(t => t.id === tab) || {}).label}</h1>
            <span className="imss-desktop-only"><span className="flex items-center gap-2"><NotificationBell routes={{ budget: 'budget', notice: 'overview', deal: 'profile', earnings: 'revenue', statement: 'statements', invoice: 'invoices', submission: 'releases', request: 'requests' }} onOpen={setTab} /><button onClick={onLogout} aria-label="Sign out" title="Sign out" className="inline-flex items-center gap-1.5" style={{ background: C.fill, color: C.text, borderRadius: 980, padding: '8px 12px', fontSize: 14 }}><LogOut size={15} /> <span className="imss-alerts-label">Sign out</span></button></span></span>
          </div>
        )}

        {tab === 'overview' && <OverviewTab DASH_PRESETS={DASH_PRESETS} activePreset={activePreset} applyDashRange={applyDashRange} artist={artist} balance={balance} budgetRemaining={budgetRemaining} creditLine={creditLine} dashBestMonth={dashBestMonth} dashCountries={dashCountries} dashDraft={dashDraft} dashError={dashError} dashGross={dashGross} dashLabel={dashLabel} dashReleased={dashReleased} dashRetailers={dashRetailers} dashTopSongs={dashTopSongs} dashUnits={dashUnits} dismissDeal={dismissDeal} invoices={invoices} invoicesDue={invoicesDue} isFunded={isFunded} latestDeal={latestDeal} ledger={ledger} lifetime={lifetime} monthLong={monthLong} myNotices={myNotices} needsToKnow={needsToKnow} onLogout={onLogout} openReleaseRevenue={openReleaseRevenue} paid={paid} payouts={payouts} pctLabel={pctLabel} platformTotals={platformTotals} rateLabel={rateLabel} recoupment={recoupment} releasedByType={releasedByType} revenue={revenue} setDashDraft={setDashDraft} setTab={setTab} showDealBanner={showDealBanner} streams={streams} totalStreams={totalStreams} />}

        {tab === 'releases' && <ReleasesTab addSubmitCollaborator={addSubmitCollaborator} addSubmitPrimaryArtist={addSubmitPrimaryArtist} artist={artist} artistAddError={artistAddError} artistCatalog={artistCatalog} artistCategory={artistCategory} collabError={collabError} featuredPct={featuredPct} handleSplitSheet={handleSplitSheet} handleSubmitArtwork={handleSubmitArtwork} licenseCtx={licenseCtx} mySubmissions={mySubmissions} newSubmitCollab={newSubmitCollab} newSubmitPrimaryArtist={newSubmitPrimaryArtist} pickedReleases={pickedReleases} removeSubmitCollaborator={removeSubmitCollaborator} removeSubmitPrimaryArtist={removeSubmitPrimaryArtist} replyDrafts={replyDrafts} replyError={replyError} rightsArtist={rightsArtist} sendSubmissionReply={sendSubmissionReply} sendsTo={sendsTo} setArtistAddError={setArtistAddError} setArtistCategory={setArtistCategory} setCollabError={setCollabError} setFeaturedPct={setFeaturedPct} setNewSubmitCollab={setNewSubmitCollab} setNewSubmitPrimaryArtist={setNewSubmitPrimaryArtist} setPickedReleases={setPickedReleases} setReplyDrafts={setReplyDrafts} setShowSubmitForm={setShowSubmitForm} setSubmitDocNote={setSubmitDocNote} setSubmitError={setSubmitError} setSubmitForm={setSubmitForm} showSubmitForm={showSubmitForm} splitSheetRef={splitSheetRef} splitsTotal={splitsTotal} submitArtworkRef={submitArtworkRef} submitError={submitError} submitForm={submitForm} submitReleaseSubmission={submitReleaseSubmission} toggleSubmitDoc={toggleSubmitDoc} />}

        {tab === 'profile' && <ProfileTab artist={artist} cropFile={cropFile} handleProfilePhoto={handleProfilePhoto} monthLong={monthLong} myPendingRequest={myPendingRequest} myProfileRequests={myProfileRequests} paid={paid} pctLabel={pctLabel} profileForm={profileForm} profileInputRef={profileInputRef} profileSaved={profileSaved} saveProfile={saveProfile} setCropFile={setCropFile} setProfileForm={setProfileForm} submitProfileRequest={submitProfileRequest} />}

        {tab === 'requests' && <RequestsTab artist={artist} expandedRequestId={expandedRequestId} myArtistRequests={myArtistRequests} requestForm={requestForm} setExpandedRequestId={setExpandedRequestId} setRequestForm={setRequestForm} submitArtistRequest={submitArtistRequest} />}

        {tab === 'revenue' && <RevenueTab EMPTY_REV_FILTERS={EMPTY_REV_FILTERS} artist={artist} artistCatalog={artistCatalog} filteredMyRevenue={filteredMyRevenue} filteredRevTotals={filteredRevTotals} generateRevenue={generateRevenue} myRevenue={myRevenue} rateLabel={rateLabel} resetRevFilters={resetRevFilters} revByProduct={revByProduct} revByType={revByType} revError={revError} revFilters={revFilters} revFiltersActive={revFiltersActive} revGenerated={revGenerated} revGroupBy={revGroupBy} revPeriodLabel={revPeriodLabel} revTypes={revTypes} revenue={revenue} setRevError={setRevError} setRevFilters={setRevFilters} setRevGenerated={setRevGenerated} setRevGroupBy={setRevGroupBy} splitOf={splitOf} sumSplits={sumSplits} />}

        {tab === 'payouts' && <PayoutsTab balance={balance} lifetime={lifetime} myPayouts={myPayouts} paid={paid} payouts={payouts} recoupment={recoupment} remainingRecoupable={remainingRecoupable} />}

        {tab === 'budget' && <><h1 className="imss-portal-title">Budget</h1><ArtistBudgets budgets={budgets} catalog={catalog} fmt={formatCents} /></>}
        {tab === 'budget' && isFunded && (
          <div>
            <div className="flex flex-wrap gap-3 mb-6">
              <KPICard icon={DollarSign} label="Budget allocated" value={formatCents(artist.annualBudget || 0)} />
              <KPICard icon={DollarSign} label="Spent" value={formatCents(totalSpent)} tone="amber" />
              <KPICard icon={Wallet} label="Remaining" value={formatCents(budgetRemaining)} tone={budgetRemaining < 0 ? 'red' : 'teal'} />
              <KPICard icon={ClipboardList} label="Logged expenses" value={myExpenses.length} />
            </div>

            <div className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs" style={{ color: C.textFaint }}>Budget used</div>
                <div className="text-xs" style={{ color: C.textFaint }}>{budgetPct}%</div>
              </div>
              <div className="rounded-full overflow-hidden" style={{ height: 8, background: C.panel2 }}>
                <div style={{ height: 8, width: budgetPct + '%', background: budgetRemaining < 0 ? C.red : C.amber }} />
              </div>
              {budgetRemaining < 0 && (
                <div className="text-xs mt-2" style={{ color: C.red }}>Spend has gone {formatCents(Math.abs(budgetRemaining))} over the allocated budget.</div>
              )}
            </div>

            <div className="imss-grid-2 gap-4 mb-6">
              <div className="rounded border" style={{ background: C.panel, borderColor: C.border }}>
                <div className="text-xs px-4 pt-4 pb-2" style={{ color: C.textFaint }}>Spend by category</div>
                {spendByCategory.length === 0 ? (
                  <div className="p-4 text-sm" style={{ color: C.textDim }}>No expenses logged yet.</div>
                ) : (
                  <table className="w-full">
                    <tbody>
                      {spendByCategory.map(c => (
                        <tr key={c.category}>
                          <Td><Badge>{c.category}</Badge></Td>
                          <Td align="right" mono>{formatCents(c.value)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="rounded p-4 border" style={{ background: C.panel, borderColor: C.border }}>
                <div className="text-xs mb-3" style={{ color: C.textFaint }}>Spend by month</div>
                <div style={{ height: 180 }}>
                  {spendByMonth.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm" style={{ color: C.textFaint }}>No expenses yet</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={spendByMonth}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                        <XAxis dataKey="month" tick={{ fill: C.textFaint, fontSize: 11 }} axisLine={{ stroke: C.border }} tickLine={false} />
                        <YAxis tick={{ fill: C.textFaint, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? '$' + Math.round(v / 1000) + 'k' : '$' + Math.round(v)} />
                        <Tooltip contentStyle={{ background: C.panel2, border: '1px solid ' + C.border, borderRadius: 12, fontSize: 13, color: C.text }} labelStyle={{ color: C.text }} formatter={(v) => formatCents(v)} />
                        <Bar dataKey="value" fill={C.amber} radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            <ExportBar filename={(artist.name || 'artist').replace(/\s+/g, '-').toLowerCase() + '-expenses'} headers={['Date', 'Category', 'Description', 'Recoupable', 'Amount']} rows={myExpenses.map(x => [x.date, x.category, x.description || '', 'Yes', x.amount])} />

            {myExpenses.length === 0 ? (
              <EmptyState icon={DollarSign} title="No expenses logged" description="Spend charged against your budget will show up here." />
            ) : (
              <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
                <table className="w-full" style={{ minWidth: 560 }}>
                  <thead><tr><Th>Date</Th><Th>Category</Th><Th>Description</Th><Th>Recoupable</Th><Th align="right">Amount</Th></tr></thead>
                  <tbody>
                    {myExpenses.map(x => (
                      <tr key={x.id}>
                        <Td mono>{formatDate(x.date)}</Td>
                        <Td><Badge>{x.category}</Badge></Td>
                        <Td>{x.description || '—'}</Td>
                        <Td><Badge tone="amber">Yes</Badge></Td>
                        <Td align="right" mono>{formatCents(x.amount)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'earnings' && <EarningsTab artist={artist} earningsByMonth={earningsByMonth} lifetime={lifetime} revenue={revenue} />}

        {tab === 'expenses' && <ExpensesTab artist={artist} emptyInvoice={emptyInvoice} invoices={invoices} ledger={ledger} myExpenseClaims={myExpenseClaims} myExpenses={myExpenses} paid={paid} payouts={payouts} remainingRecoupable={remainingRecoupable} setInvoiceForm={setInvoiceForm} setInvoiceSent={setInvoiceSent} setTab={setTab} />}

        {tab === 'invoices' && <InvoicesTab artist={artist} budgets={budgets} emptyInvoice={emptyInvoice} handleInvoiceFile={handleInvoiceFile} invoiceError={invoiceError} invoiceFileRef={invoiceFileRef} invoiceForm={invoiceForm} invoiceSent={invoiceSent} invoices={invoices} myInvoices={myInvoices} openInvoiceId={openInvoiceId} paid={paid} replyDrafts={replyDrafts} replyError={replyError} resubmittingId={resubmittingId} sendInvoiceReply={sendInvoiceReply} setInvoiceForm={setInvoiceForm} setInvoiceSent={setInvoiceSent} setOpenInvoiceId={setOpenInvoiceId} setReplyDrafts={setReplyDrafts} setResubmittingId={setResubmittingId} submitInvoice={submitInvoice} />}

        {tab === 'statements' && (() => {
          const t = reportingTerms(artist), next = lastClosedPeriod(artist, todayStr());
          const cut = { monthly: 'the end of each month', quarterly: '31 March, 30 June, 30 September and 31 December', 'half-yearly': '30 June and 31 December' }[t.period];
          return (
            <div className="rounded border p-4 mb-6 text-sm" style={{ borderColor: C.border, background: C.panel }}>
              <div style={{ fontWeight: 600 }}>Your reporting schedule</div>
              <p className="mt-1" style={{ color: C.textDim }}>{t.period.charAt(0).toUpperCase() + t.period.slice(1)} statements. Accounts close on {cut}, and each statement arrives within {t.deliveryDays} days. Your latest period closed {formatDate(next.cutoff)}; its statement is due by {formatDate(next.due)}.</p>
              {t.threshold > 0 && <p className="mt-1" style={{ color: C.textDim }}>Payments are made once your balance reaches <b style={{ color: C.text }}>{formatCents(t.threshold)}</b>, counted on your share after the label’s percentage and the Inbound Banking Charge. Smaller balances still get a statement and carry forward to the next one.</p>}
            </div>
          );
        })()}
        {tab === 'statements' && <div className="mb-6"><StatementFilesList sourceLabel="IMSS Records" rows={myRevenue} splitOf={splitOf} artistName={artist.name} title="Statement files from the label" files={statementFiles.filter(f => f.artistId === artist.id)} empty="When the label uploads your royalty statements, the original files appear here to download." /></div>}
        {tab === 'statements' && (
          <ArtistStatementView invoices={invoices} artist={artist} revenue={revenue} masterGross={masterGross} ledger={ledger} payouts={payouts} statementFiles={statementFiles} requireGenerate />
        )}
        <LegalFooter />
        </div>
      </main>
      <MobileNav nav={TABS} active={tab} setActive={setTab} role="artist" badges={{ requests: openRequestCount }}
        account={[{ label: 'Sign out', icon: LogOut, onClick: onLogout, danger: true }]} />
    </div>
  );
}
