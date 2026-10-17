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

export function ArtistPortalShell({ artist, roster, catalog, revenue, streams, masterGross = [], payouts, ledger = [], notices = [], profileRequests = [], updateProfileRequests, artistRequests = [], updateArtistRequests, releaseSubmissions = [], updateReleaseSubmissions, invoices = [], updateInvoices, replyToSubmission = null, replyToInvoice = null, statementFiles = [], dealChanges = [], labelSettings, onLogout, saveProfile = null, budgets = [], resubmitInvoice = null }) {
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

  usePageUrl(TABS, tab, setTab);

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

        {tab === 'overview' && (
          <div>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h1 className="imss-portal-title">Dashboard</h1>
              <div className="flex items-center gap-2">
                <Badge tone={isFunded ? 'teal' : 'default'}>{dealLabel(artist)}</Badge>
                <span className="imss-desktop-only"><span className="flex items-center gap-2"><NotificationBell routes={{ budget: 'budget', notice: 'overview', deal: 'profile', earnings: 'revenue', statement: 'statements', invoice: 'invoices', submission: 'releases', request: 'requests' }} onOpen={setTab} /><button onClick={onLogout} aria-label="Sign out" title="Sign out" className="inline-flex items-center gap-1.5" style={{ background: C.fill, color: C.text, borderRadius: 980, padding: '8px 12px', fontSize: 14 }}><LogOut size={15} /> <span className="imss-alerts-label">Sign out</span></button></span></span>
              </div>
            </div>

            {showDealBanner && (
              <section aria-label="Your deal has been updated" className="rounded mb-6" style={{ background: C.amberSoft, padding: '18px 20px' }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 17, letterSpacing: '-0.02em' }}>Your deal has been updated</div>
                    <p className="mt-1" style={{ fontSize: 15, lineHeight: 1.5 }}>
                      From your <b>{monthLong(latestDeal.from)}</b> earnings, your share of net earnings is <b>{pctLabel(latestDeal.artistPct)}</b>{latestDeal.was && latestDeal.was.artistPct != null ? <> (previously {pctLabel(latestDeal.was.artistPct)})</> : null}. Deal: <b>{dealLabel(latestDeal)}</b>.
                    </p>
                    <p style={{ fontSize: 14, color: C.textDim }}>Earnings before {monthLong(latestDeal.from)} stay at your previous terms. Your full deal history is on your Profile.</p>
                  </div>
                  <div className="flex gap-2">
                    <Btn variant="ghost" onClick={() => setTab('profile')}>See deal history</Btn>
                    <Btn variant="ghost" onClick={dismissDeal}>Got it</Btn>
                  </div>
                </div>
              </section>
            )}

            <section aria-label="What you are owed" className="rounded border mb-6 imss-owed-card" style={{ background: C.panel, borderColor: C.border }}>
              <div className="imss-owed-head">
                <div>
                  <div className="text-sm" style={{ color: C.textDim }}>{balance > 0 ? 'You’re owed' : 'Balance'}</div>
                  <div className="imss-owed" style={{ color: balance > 0 ? C.amber : C.text }}>{formatCents(Math.max(0, balance))}</div>
                </div>
                <div className="flex gap-2 flex-wrap imss-print-hide mt-4">
                  <Btn variant="ghost" onClick={() => setTab('statements')}><Eye size={14} /> Get a statement</Btn>
                  <Btn variant="ghost" onClick={() => setTab('payouts')}><Wallet size={14} /> Payouts</Btn>
                </div>
              </div>
              <ol className="imss-sum" aria-label="How your balance is worked out">
                <li><span>Gross</span><b>{formatCents(lifetime.gross)}</b></li>
                <li><span>Inbound Banking Charge</span><b>−{formatCents(lifetime.swift)}</b></li>
                <li><span>Net</span><b>{formatCents(lifetime.gross - lifetime.swift)}</b></li>
                <li className="imss-sum-key"><span>Your earnings ({rateLabel(revenue)})</span><b style={{ color: C.teal }}>{formatCents(lifetime.artistShare)}</b></li>
                {recoupment.recouped > 0 && <li><span>Recouped expenses</span><b>−{formatCents(recoupment.recouped)}</b></li>}
                {artistSpend(artist, ledger, invoices).repaidCash > 0 && <li><span>Repaid in cash <span style={{ color: C.textDim }}>· at the label’s request, not from your earnings</span></span><b style={{ color: C.textDim }}>{formatCents(artistSpend(artist, ledger, invoices).repaidCash)}</b></li>}
                <li><span>Paid to you</span><b>{paid > 0 ? '−' : ''}{formatCents(paid)}</b></li>
                <li className="imss-sum-total"><span>{balance > 0 ? 'You’re owed' : 'Balance'}</span><b style={{ color: balance > 0 ? C.amber : C.text }}>{formatCents(Math.max(0, balance))}</b></li>
              </ol>
            </section>

            {invoicesDue > 0 && (
              <button onClick={() => setTab('invoices')} className="w-full text-left rounded border px-4 py-3 mb-6 text-sm" style={{ borderColor: C.border, background: C.panel, color: C.text }}>
                Approved invoices waiting to be paid: <span style={{ fontFamily: MONO_FONT, color: C.amber, fontWeight: 600 }}>{formatCents(invoicesDue)}</span> <span style={{ color: C.textDim }}>· see Invoices</span>
              </button>
            )}

            {(myNotices.length > 0 || needsToKnow.length > 0) && (
              <section aria-label="Notices" className="mb-6 flex flex-col gap-2">
                {needsToKnow.map((n, i) => (
                  <div key={'k' + i} className="rounded border px-4 py-3 text-sm" style={{ borderColor: C.amber, background: C.amberSoft, color: C.text }}>{n.text}</div>
                ))}
                {myNotices.map(n => (
                  <div key={n.id} role="note" className="rounded border flex gap-3" style={{ borderColor: C.amberLine || 'var(--amber-line)', background: C.amberSoft, padding: '14px 16px' }}>
                    <span aria-hidden="true" style={{ flex: '0 0 auto', width: 36, height: 36, borderRadius: 9999, background: C.amberFill, color: C.onAmber, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Megaphone size={18} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-baseline justify-between gap-3 flex-wrap">
                        <div style={{ fontWeight: 700, fontSize: 16, color: C.text }}>{n.title}</div>
                        <div className="text-xs" style={{ color: C.textDim }}>{formatDate(n.createdAt)}</div>
                      </div>
                      <div className="mt-1" style={{ color: C.text, fontSize: 15, lineHeight: 1.45, maxWidth: '70ch', whiteSpace: 'pre-wrap' }}>{n.message}</div>
                    </div>
                  </div>
                ))}
              </section>
            )}

            <form className="imss-dash-range" aria-label="Date selection" onSubmit={e => { e.preventDefault(); applyDashRange(dashDraft); }}>
              <label className="imss-dash-field">From<input type="month" value={dashDraft.from} max={dashDraft.to || undefined} onChange={e => setDashDraft(d => ({ ...d, from: e.target.value }))} /></label>
              <span className="imss-dash-to" aria-hidden="true">to</span>
              <label className="imss-dash-field">To<input type="month" value={dashDraft.to} min={dashDraft.from || undefined} onChange={e => setDashDraft(d => ({ ...d, to: e.target.value }))} /></label>
              <Btn variant="primary" type="submit">Update</Btn>
              <div className="imss-dash-presets" role="group" aria-label="Quick ranges">
                {DASH_PRESETS.map(p => (
                  <button key={p.id} type="button" onClick={() => applyDashRange(p.range())} aria-pressed={activePreset === p.id} className={'imss-dash-preset' + (activePreset === p.id ? ' is-on' : '')}>{p.label}</button>
                ))}
              </div>
            </form>
            {dashError && <div className="text-sm mb-3" role="alert" style={{ color: C.red }}>{dashError}</div>}
            <p className="text-sm mb-4" style={{ color: C.textDim }}>Balance is all time. Everything below shows <span style={{ color: C.text, fontWeight: 600 }}>{dashLabel}</span>.{dashRetailers[0] && dashCountries[0] ? <> Most of your money came from <span style={{ color: C.text }}>{dashRetailers[0].name}</span> in <span style={{ color: C.text }}>{breakdownLabel('countries', dashCountries[0].code)}</span>{dashUnits > 0 ? <>, across <span style={{ color: C.text }}>{dashUnits.toLocaleString('en-US')}</span> streams and sales</> : null}.</> : null}</p>

            <div className="imss-dash-stats mb-6">
              <div className="rounded border imss-dash-stat" style={{ background: C.panel, borderColor: C.border }}>
                <div className="imss-dash-lab">Songs released</div>
                <div className="imss-dash-fig">{dashReleased.length}</div>
                <div className="imss-dash-sub">{releasedByType.length ? releasedByType.map(([t, n]) => n + ' ' + t.split(' ').map(w => w === 'EP' ? w : w.toLowerCase()).join(' ') + (n === 1 ? '' : 's')).join(' · ') : 'None in this period'}</div>
              </div>
              <div className="rounded border imss-dash-stat" style={{ background: C.panel, borderColor: C.border }}>
                <div className="imss-dash-lab">Top earning retailer</div>
                <div className="imss-dash-fig imss-dash-fig-text">{dashRetailers[0] ? dashRetailers[0].name : '—'}</div>
                <div className="imss-dash-sub">{dashRetailers[0] ? formatCents(dashRetailers[0].value) + ' gross' + (dashGross > 0 ? ' · ' + (dashRetailers[0].value / dashGross * 100).toFixed(1) + '% of your revenue' : '') : 'No retailer breakdown yet'}</div>
              </div>
              <div className="rounded border imss-dash-stat" style={{ background: C.panel, borderColor: C.border }}>
                <div className="imss-dash-lab">Top country</div>
                <div className="imss-dash-fig imss-dash-fig-text">{dashCountries[0] ? breakdownLabel('countries', dashCountries[0].code) : '—'}</div>
                <div className="imss-dash-sub">{dashCountries[0] ? formatCents(dashCountries[0].value) + ' gross' + (dashGross > 0 ? ' · ' + (dashCountries[0].value / dashGross * 100).toFixed(1) + '%' : '') + ' · ' + dashCountries.length + ' countries' : 'No country breakdown yet'}</div>
              </div>
              <div className="rounded border imss-dash-stat" style={{ background: C.panel, borderColor: C.border }}>
                <div className="imss-dash-lab">Best month</div>
                <div className="imss-dash-fig">{dashBestMonth ? formatCents(dashBestMonth[1]) : '—'}</div>
                <div className="imss-dash-sub">{dashBestMonth ? monthLabel(dashBestMonth[0]) + ' · your earnings' : 'No earnings in this period'}</div>
              </div>
            </div>

            <div className="imss-dash-two mb-6">
              <section aria-labelledby="top-songs-h" className="rounded border overflow-hidden" style={{ background: C.panel, borderColor: C.border }}>
                <div className="imss-dash-ph">
                  <h2 id="top-songs-h">Top songs by revenue</h2>
                  <button type="button" onClick={() => setTab('revenue')} className="imss-dash-link">All songs <ChevronRight size={14} aria-hidden="true" /></button>
                </div>
                {dashTopSongs.length === 0 ? (
                  <div className="px-4 pb-5 text-sm" style={{ color: C.textDim }}>No revenue in this period. Try a wider range.</div>
                ) : (
                  <table className="w-full imss-dash-songs" style={{ tableLayout: 'fixed' }}>
                    <colgroup><col className="imss-dash-rank" style={{ width: 44 }} /><col /><col style={{ width: '20%' }} /><col style={{ width: '18%' }} /><col style={{ width: '20%' }} /></colgroup>
                    <thead><tr><Th align="right">#</Th><Th>Song</Th><Th align="right">Streams &amp; sales</Th><Th align="right">Gross</Th><Th align="right">Your earnings</Th></tr></thead>
                    <tbody>
                      {dashTopSongs.map((t, i) => { const c = creditLine(t.title); return (
                        <tr key={t.title} className="imss-dash-song" onClick={() => openReleaseRevenue(t.title)}>
                          <Td align="right" mono><span style={{ color: C.textDim }}>{i + 1}</span></Td>
                          <Td>
                            <button type="button" onClick={e => { e.stopPropagation(); openReleaseRevenue(t.title); }} className="imss-dash-songbtn">{t.title}</button>
                            <div className="text-xs mt-0.5" style={{ color: C.textDim, overflowWrap: 'anywhere' }}>{c.primaries}{c.feats.length > 0 && <span style={{ color: C.text }}> feat. {c.feats.join(', ')}</span>}</div>
                          </Td>
                          <Td align="right" mono>{t.units > 0 ? t.units.toLocaleString('en-US') : '—'}</Td>
                          <Td align="right" mono>{formatCents(t.gross)}</Td>
                          <Td align="right" mono><span style={{ color: C.teal, fontWeight: 600 }}>{formatCents(t.artistShare)}</span></Td>
                        </tr>
                      ); })}
                    </tbody>
                  </table>
                )}
              </section>

              <section aria-labelledby="top-retail-h" className="rounded border overflow-hidden" style={{ background: C.panel, borderColor: C.border }}>
                <div className="imss-dash-ph"><h2 id="top-retail-h">Top earning retailers</h2></div>
                {dashRetailers.length === 0 ? (
                  <div className="px-4 pb-5 text-sm" style={{ color: C.textDim, maxWidth: '60ch' }}>Retailer breakdowns appear for revenue the label imports from distributor statements from now on. Earlier revenue was recorded per song only.</div>
                ) : (
                  <ul className="imss-dash-retail">
                    {dashRetailers.slice(0, 6).map(r => (
                      <li key={r.name}>
                        <span className="imss-dash-retail-name">{r.name}</span>
                        <span className="imss-ledger-bar" aria-hidden="true"><span style={{ width: Math.max(2, r.value / dashRetailers[0].value * 100) + '%' }}></span></span>
                        <span className="imss-dash-retail-amt">{formatCents(r.value)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            {platformTotals.length > 0 && (
              <section aria-labelledby="streams-h" className="rounded border overflow-hidden mb-6" style={{ background: C.panel, borderColor: C.border }}>
                <div className="imss-dash-ph"><h2 id="streams-h">Streams by platform</h2><span className="text-xs" style={{ color: C.textDim }}>{formatNumber(totalStreams)} all time</span></div>
                <ul className="imss-dash-retail">
                  {[...platformTotals].sort((x, y) => y.value - x.value).map(p => (
                    <li key={p.name}>
                      <span className="imss-dash-retail-name">{p.name}</span>
                      <span className="imss-ledger-bar" aria-hidden="true"><span style={{ width: Math.max(2, p.value / Math.max(...platformTotals.map(q => q.value)) * 100) + '%' }}></span></span>
                      <span className="imss-dash-retail-amt">{formatNumber(p.value)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {isFunded && (
              <div className="text-sm" style={{ color: C.textDim }}>
                Budget: <span style={{ fontFamily: MONO_FONT, color: budgetRemaining < 0 ? C.red : C.text }}>{formatCents(budgetRemaining)}</span> left of {formatCents(artist.annualBudget || 0)}. <button onClick={() => setTab('budget')} style={{ color: C.amber, textDecoration: 'underline', textUnderlineOffset: 3 }}>See expenses</button>
              </div>
            )}
          </div>
        )}

        {tab === 'releases' && (
          <div>
            <div className="flex justify-end mb-4">
              <Btn variant="primary" onClick={() => setShowSubmitForm(!showSubmitForm)}><Plus size={14} /> Submit new release</Btn>
            </div>

            {showSubmitForm && (
              <form onSubmit={e => { e.preventDefault(); submitReleaseSubmission(); }} className="rounded border p-4 mb-6 imss-form-grid gap-3" style={{ background: C.panel, borderColor: C.borderLight }}>
                <Field label="Title" full><Input required value={submitForm.title} onChange={e => setSubmitForm({ ...submitForm, title: e.target.value })} placeholder="Working title" /></Field>
                <fieldset className="imss-span-2">
                  <legend className="text-xs mb-2" style={{ color: C.textDim }}>Artists on this song</legend>
                  <div className="flex items-center gap-1.5 flex-wrap mb-3">
                    <span className="imss-chip is-primary">{artist.name} <small>primary · you</small></span>
                    {(submitForm.primaryArtists || []).map((name, i) => (
                      <span key={'p' + i} className="imss-chip is-primary">{name} <small>primary</small><button type="button" onClick={() => removeSubmitPrimaryArtist(i)} aria-label={'Remove ' + name}><Trash2 size={12} /></button></span>
                    ))}
                    {submitForm.collaborators.map((c, i) => c.role === 'Feature' && (
                      <span key={'f' + i} className="imss-chip is-featured">{c.name} <small>featured · {c.splitPercent}%</small><button type="button" onClick={() => removeSubmitCollaborator(i)} aria-label={'Remove ' + c.name}><Trash2 size={12} /></button></span>
                    ))}
                  </div>
                  <div className={'imss-artist-add' + (artistCategory === 'Featured' ? ' is-featured' : '')}>
                    <div className="imss-seg" role="radiogroup" aria-label="Category">
                      {['Primary', 'Featured'].map(c => (
                        <button key={c} type="button" role="radio" aria-checked={artistCategory === c} onClick={() => { setArtistCategory(c); setArtistAddError(''); }} className={artistCategory === c ? 'is-on' : ''}>{c}</button>
                      ))}
                    </div>
                    <Input aria-label="Artist name" value={newSubmitPrimaryArtist} onChange={e => { setNewSubmitPrimaryArtist(e.target.value); setArtistAddError(''); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubmitPrimaryArtist(); } }} placeholder={artistCategory === 'Primary' ? 'Co-primary artist name' : 'Featured artist name'} />
                    {artistCategory === 'Featured' && (
                      <Input aria-label="Featured artist split %" type="number" min="0" max="100" step="0.01" value={featuredPct} onChange={e => { setFeaturedPct(e.target.value); setArtistAddError(''); }} placeholder="Split %" />
                    )}
                    <Btn variant="ghost" type="button" onClick={addSubmitPrimaryArtist}><Plus size={14} /> Add</Btn>
                  </div>
                  <div className="text-xs mt-2" style={{ color: C.textDim }}>{artistCategory === 'Primary' ? 'Primary artists share the headline credit on a joint release.' : 'Featured artists are credited as “feat.” and added to the splits below with their %.'}</div>
                  {artistAddError && <div className="text-sm mt-2" role="alert" style={{ color: C.red }}>{artistAddError}</div>}
                </fieldset>
                <Field label="Type">
                  <Select value={submitForm.type} onChange={e => setSubmitForm({ ...submitForm, type: e.target.value })}>
                    {RELEASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </Field>
                <Field label="Genre"><Input value={submitForm.genre} onChange={e => setSubmitForm({ ...submitForm, genre: e.target.value })} placeholder="e.g. Alt-Pop" /></Field>
                <Field label="Proposed release date"><Input type="date" value={submitForm.proposedDate} onChange={e => setSubmitForm({ ...submitForm, proposedDate: e.target.value })} /></Field>
                <Field label="Artwork (optional)" full>
                  <input ref={submitArtworkRef} type="file" accept="image/*" onChange={handleSubmitArtwork} className="text-xs" style={{ color: C.textDim }} />
                </Field>

                <section className="imss-span-2" aria-labelledby="splits-h">
                  <h3 id="splits-h" style={{ fontWeight: 600, fontSize: 15 }}>Splits <span style={{ color: C.red }} aria-hidden="true">*</span></h3>
                  <p className="text-xs mt-1 mb-3" style={{ color: C.textDim, maxWidth: '70ch' }}>List everyone taking a share of this song. Featured artists, producers and songwriters must have their split % entered, and it has to match the signed split sheet.</p>
                  <div className="rounded border overflow-hidden" style={{ borderColor: C.border, background: C.bg }}>
                    <table className="w-full" style={{ tableLayout: 'fixed' }}>
                      <colgroup><col /><col style={{ width: '28%' }} /><col style={{ width: 96 }} /><col style={{ width: 44 }} /></colgroup>
                      <thead><tr><Th>Name</Th><Th>Role</Th><Th align="right">Split</Th><Th align="right"></Th></tr></thead>
                      <tbody>
                        {submitForm.collaborators.map((c, i) => (
                          <tr key={i}>
                            <Td><span style={{ overflowWrap: 'anywhere' }}>{c.name}</span></Td>
                            <Td>{c.role}</Td>
                            <Td align="right" mono>{c.splitPercent}%</Td>
                            <Td align="right"><button type="button" onClick={() => removeSubmitCollaborator(i)} aria-label={'Remove ' + c.name} style={{ color: C.textDim }}><Trash2 size={14} /></button></Td>
                          </tr>
                        ))}
                        <tr>
                          <Td><span style={{ fontWeight: 600 }}>{artist.name}</span> <span className="text-xs" style={{ color: C.textDim }}>(you, remainder)</span></Td>
                          <Td>Primary artist</Td>
                          <Td align="right" mono><span style={{ color: splitsTotal > 100 ? C.red : C.teal, fontWeight: 600 }}>{Math.max(0, 100 - splitsTotal)}%</span></Td>
                          <Td>{''}</Td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="imss-split-add" style={{ borderTop: '1px solid ' + C.border }}>
                      <Input aria-label="Name" value={newSubmitCollab.name} onChange={e => { setNewSubmitCollab({ ...newSubmitCollab, name: e.target.value }); setCollabError(''); }} placeholder="Name" />
                      <Select aria-label="Role" value={newSubmitCollab.role} onChange={e => { setNewSubmitCollab({ ...newSubmitCollab, role: e.target.value }); setCollabError(''); }}>
                        {COLLABORATOR_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </Select>
                      <Input aria-label="Split %" type="number" min="0" max="100" step="0.01" value={newSubmitCollab.splitPercent} onChange={e => { setNewSubmitCollab({ ...newSubmitCollab, splitPercent: e.target.value }); setCollabError(''); }} placeholder={SPLIT_REQUIRED_ROLES.includes(newSubmitCollab.role) ? 'Split % (required)' : 'Split %'} />
                      <Btn variant="ghost" type="button" onClick={addSubmitCollaborator}><Plus size={14} /> Add</Btn>
                    </div>
                  </div>
                  {collabError && <div className="text-sm mt-2" role="alert" style={{ color: C.red }}>{collabError}</div>}

                  <div className="imss-form-grid gap-3 mt-4">
                    <Field label="Signed split sheet (PDF or photo, up to 10 MB) *" full>
                      <input ref={splitSheetRef} type="file" accept="application/pdf,image/*" onChange={handleSplitSheet} className="text-sm" style={{ color: C.textDim }} />
                      {submitForm.splitSheetName && <span className="text-xs" style={{ color: C.teal }}>Attached: {submitForm.splitSheetName}</span>}
                    </Field>
                  </div>
                  <label className="flex items-start gap-2 text-sm mt-3" style={{ color: C.text, cursor: 'pointer' }}>
                    <input type="checkbox" checked={submitForm.splitsConfirmed} onChange={e => { setSubmitForm({ ...submitForm, splitsConfirmed: e.target.checked }); setSubmitError(''); }} style={{ marginTop: 3, accentColor: C.amber }} />
                    Everyone listed above has signed the split sheet, and the percentages match it.
                  </label>
                </section>

                <div className="imss-span-2">
                  <div className="text-xs mb-2" style={{ color: C.textFaint }}>Track metadata (for the distributor sheet)</div>
                  <div className="rounded border p-3 imss-form-grid gap-3" style={{ borderColor: C.border, background: C.bg }}>
                    <Field label="Duration"><Input value={submitForm.duration} onChange={e => setSubmitForm({ ...submitForm, duration: e.target.value })} placeholder="mm:ss" /></Field>
                    <Field label="Explicit / Clean">
                      <Select value={submitForm.explicit} onChange={e => setSubmitForm({ ...submitForm, explicit: e.target.value })}>
                        {EXPLICIT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </Select>
                    </Field>
                    <Field label="Dolby Atmos">
                      <label className="flex items-center gap-2 text-sm" style={{ paddingTop: 8 }}>
                        <input type="checkbox" checked={submitForm.dolbyAtmos} onChange={e => setSubmitForm({ ...submitForm, dolbyAtmos: e.target.checked })} /> Dolby Atmos mix available
                      </label>
                    </Field>
                    <Field label="Performed by" full><PeopleInput label="Performed by" value={submitForm.credits.performedBy} onChange={v => setSubmitForm(f => ({ ...f, credits: { ...f.credits, performedBy: v } }))} placeholder="Artist name, then Enter" /></Field>
                    <Field label="Written by"><PeopleInput label="Written by" value={submitForm.credits.writtenBy} onChange={v => setSubmitForm(f => ({ ...f, credits: { ...f.credits, writtenBy: v } }))} placeholder="Type a name, then Enter" /></Field>
                    <Field label="Produced by"><PeopleInput label="Produced by" value={submitForm.credits.producedBy} onChange={v => setSubmitForm(f => ({ ...f, credits: { ...f.credits, producedBy: v } }))} placeholder="Type a name, then Enter" /></Field>
                    <Field label="Recording engineer"><PeopleInput label="Recording engineer" value={submitForm.credits.recordingEngineer} onChange={v => setSubmitForm(f => ({ ...f, credits: { ...f.credits, recordingEngineer: v } }))} placeholder="Type a name, then Enter" /></Field>
                    <Field label="Mixing engineer"><PeopleInput label="Mixing engineer" value={submitForm.credits.mixingEngineer} onChange={v => setSubmitForm(f => ({ ...f, credits: { ...f.credits, mixingEngineer: v } }))} placeholder="Type a name, then Enter" /></Field>
                    <Field label="Mastering engineer"><PeopleInput label="Mastering engineer" value={submitForm.credits.masteringEngineer} onChange={v => setSubmitForm(f => ({ ...f, credits: { ...f.credits, masteringEngineer: v } }))} placeholder="Type a name, then Enter" /></Field>
                    <Field label="Dolby engineer"><PeopleInput label="Dolby engineer" value={submitForm.credits.dolbyEngineer} onChange={v => setSubmitForm(f => ({ ...f, credits: { ...f.credits, dolbyEngineer: v } }))} placeholder="Type a name, then Enter" /></Field>
                    <fieldset className="imss-span-2">
                      <legend className="text-xs mb-2" style={{ color: C.textDim }}>Does this song have lyrics?</legend>
                      <div className="imss-seg" role="radiogroup" aria-label="Lyrics or instrumental">
                        {[['lyrics', 'Has lyrics'], ['instrumental', 'Instrumental']].map(([k, label]) => (
                          <button key={k} type="button" role="radio" aria-checked={(k === 'instrumental') === !!submitForm.instrumental} className={(k === 'instrumental') === !!submitForm.instrumental ? 'is-on' : ''}
                            onClick={() => setSubmitForm(f => ({ ...f, instrumental: k === 'instrumental', lyrics: k === 'instrumental' ? '' : f.lyrics }))}>{label}</button>
                        ))}
                      </div>
                    </fieldset>
                    {!submitForm.instrumental && <Field label="Lyrics" full><TextArea rows={4} value={submitForm.lyrics} onChange={e => setSubmitForm({ ...submitForm, lyrics: e.target.value })} placeholder="Paste the full lyrics, or note where they’re stored" /></Field>}
                    <Field label={'About the song or project · ' + (submitForm.about || '').length + ' / 700'} full>
                      <TextArea rows={4} maxLength={700} value={submitForm.about || ''} onChange={e => setSubmitForm({ ...submitForm, about: e.target.value.slice(0, 700) })} placeholder="The story behind it, the sound, who it’s for. This helps the label pitch it to playlists and press." />
                    </Field>
                  </div>
                </div>

                <section className="imss-span-2" aria-labelledby="rollout-h">
                  <h3 id="rollout-h" style={{ fontWeight: 600, fontSize: 15 }}>Marketing and rollout</h3>
                  <p className="text-xs mt-1 mb-3" style={{ color: C.textDim, maxWidth: '70ch' }}>What you’re planning to promote this release, so the label can line up with it.</p>
                  <div className="imss-form-grid gap-3">
                    <Field label="Rollout plan" full><TextArea rows={4} value={(submitForm.rollout || {}).plan || ''} onChange={e => setSubmitForm(f => ({ ...f, rollout: { ...(f.rollout || {}), plan: e.target.value } }))} placeholder="e.g. Teasers two weeks out, pre-save link, release-week live session, TikTok challenge" /></Field>
                    <Field label="Content you’ll make"><Input value={(submitForm.rollout || {}).content || ''} onChange={e => setSubmitForm(f => ({ ...f, rollout: { ...(f.rollout || {}), content: e.target.value } }))} placeholder="Music video, visualiser, behind the scenes" /></Field>
                    <Field label="Shows or events"><Input value={(submitForm.rollout || {}).events || ''} onChange={e => setSubmitForm(f => ({ ...f, rollout: { ...(f.rollout || {}), events: e.target.value } }))} placeholder="Launch party, radio tour, festival slot" /></Field>
                    <Field label="Social handles to tag"><Input value={(submitForm.rollout || {}).socials || ''} onChange={e => setSubmitForm(f => ({ ...f, rollout: { ...(f.rollout || {}), socials: e.target.value } }))} placeholder="@yourname on Instagram, TikTok, X" /></Field>
                  </div>
                </section>

                <Field label="Notes for the label" full><TextArea rows={3} value={submitForm.notes} onChange={e => setSubmitForm({ ...submitForm, notes: e.target.value })} placeholder="Anything else your PM should know?" /></Field>

                <div className="imss-span-2">
                  <div className="text-xs mb-2" style={{ color: C.textFaint }}>
                    Distribution package{missingRequiredDocs(submitForm.distributionDocs) > 0 && <span style={{ color: C.amber }}> — {missingRequiredDocs(submitForm.distributionDocs)} required item{missingRequiredDocs(submitForm.distributionDocs) === 1 ? '' : 's'} not marked ready yet</span>}
                  </div>
                  <div className="rounded border p-3" style={{ borderColor: C.border, background: C.bg }}>
                    <div className="flex flex-col gap-2">
                      {submitForm.distributionDocs.map(d => (
                        <div key={d.id} className="flex items-center gap-2 flex-wrap">
                          <label className="flex items-center gap-2 text-sm" style={{ minWidth: 160, color: d.attached ? C.textFaint : C.text, textDecoration: d.attached ? 'line-through' : 'none' }}>
                            <input type="checkbox" checked={d.attached} onChange={() => toggleSubmitDoc(d.id)} />
                            {d.label}
                          </label>
                          {!d.attached && (d.required ? <Badge tone="amber">Not ready</Badge> : <Badge>Optional</Badge>)}
                          <Input value={d.note} onChange={e => setSubmitDocNote(d.id, e.target.value)} placeholder="Where is it? (e.g. in my Drive folder)" style={{ flex: 1, minWidth: 160 }} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {submitError && <div className="imss-span-2 text-sm" role="alert" style={{ color: C.red }}>{submitError}</div>}
                <div className="imss-span-2 flex items-center gap-3 mt-1 flex-wrap">
                  <Btn variant="primary" type="submit">Send package to {sendsTo}</Btn>
                  <Btn variant="ghost" onClick={() => setShowSubmitForm(false)}>Cancel</Btn>
                  <div className="text-xs" style={{ color: C.textFaint }}>Your {artist.productManager ? 'PM' : 'label rep'} will review it before it becomes an official release.</div>
                </div>
              </form>
            )}

            {mySubmissions.length > 0 && (
              <section aria-labelledby="my-subs-h" className="rounded border mb-6 overflow-hidden" style={{ background: C.panel, borderColor: C.border }}>
                <div className="imss-dash-ph"><h2 id="my-subs-h">Your submissions</h2></div>
                <ul className="imss-my-subs">
                  {mySubmissions.map(sub => {
                    const msgs = sub.messages || [], needs = sub.status === 'Needs info';
                    return (
                      <li key={sub.id}>
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <div style={{ fontWeight: 600 }}>{sub.title}</div>
                            <div className="text-xs mt-0.5" style={{ color: C.textDim }}>{sub.type}{sub.proposedDate ? ' · ' + formatDate(sub.proposedDate) : ''}{sub.sentTo ? ' · sent to ' + sub.sentTo : ''}</div>
                          </div>
                          <Badge tone={SUBMISSION_TONES[sub.status]}>{SUBMISSION_LABELS[sub.status] || sub.status}</Badge>
                        </div>
                        {msgs.length > 0 && (
                          <ol className="imss-thread mt-3">
                            {msgs.map((m, i) => (
                              <li key={i} className={m.from === 'artist' ? 'is-artist' : 'is-label'}>
                                <div className="imss-thread-meta">{m.from === 'artist' ? 'You' : (m.by || 'IMSS Records')} · {formatDate(String(m.at || '').slice(0, 10))}</div>
                                <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                              </li>
                            ))}
                          </ol>
                        )}
                        {needs && (
                          <form className="mt-3" onSubmit={e => { e.preventDefault(); sendSubmissionReply(sub); }}>
                            <Field label="Your reply">
                              <TextArea rows={3} value={replyDrafts[sub.id] || ''} onChange={e => setReplyDrafts(d => ({ ...d, [sub.id]: e.target.value }))} placeholder="Answer the label’s question. If they need a new file, say where it is or email it to your PM." />
                            </Field>
                            {replyError[sub.id] && <div className="text-sm mt-2" role="alert" style={{ color: C.red }}>{replyError[sub.id]}</div>}
                            <div className="mt-2"><Btn variant="primary" type="submit"><MessageSquare size={14} /> Send reply</Btn></div>
                          </form>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <ExportBar filename={(artist.name || 'artist').replace(/\s+/g, '-').toLowerCase() + '-releases'} headers={['Song Title', 'Primary Artist(s)', 'Featured Artist(s)', 'Release Type', 'Release Date', 'ISRC', 'UPC', 'Label', '℗ Line', 'Genre', 'Explicit/Clean', 'Duration', 'Written By (Songwriters)', 'Produced By', 'Splits', 'Recording Engineer', 'Mixing Engineer', 'Mastering Engineer', 'Dolby Atmos', 'Dolby Engineer', 'Lyrics', 'Music Video', 'Status', 'Primary Market', 'Secondary Market', 'IMSS Records rights']} rows={artistCatalog.filter(r => !pickedReleases.length || pickedReleases.includes(r.id)).map(r => {
              // Track transfer / publishing template: everything a new distributor or publisher asks for.
              const cr = r.credits || {};
              const collabs = r.collaborators || [];
              const label = r.label || 'IMSS Records';
              return [
                r.title,
                [artist.name, ...(r.primaryArtists || [])].filter(Boolean).join(' & '),
                collabs.filter(c => c.role === 'Feature').map(c => c.name).join(', '),
                r.type,
                r.releaseDate || '',
                r.isrc || '',
                r.upc || '',
                label,
                r.releaseDate ? '℗ ' + r.releaseDate.slice(0, 4) + ' ' + label : '',
                r.genre || artist.genre || '',
                r.explicit && r.explicit !== 'Not Set' ? r.explicit : '',
                r.duration || '',
                cr.writtenBy || '',
                cr.producedBy || collabs.filter(c => c.role === 'Producer').map(c => c.name).join(', '),
                collabs.map(c => c.name + ' (' + c.role + ', ' + c.splitPercent + '%)').join('; '),
                cr.recordingEngineer || '',
                cr.mixingEngineer || '',
                cr.masteringEngineer || '',
                r.dolbyAtmos ? 'Yes' : 'No',
                cr.dolbyEngineer || '',
                r.lyrics || '',
                r.hasVideo ? 'Yes' : 'No',
                r.status,
                r.primaryMarket || '',
                r.secondaryMarket || '',
                rightsLine(licenseFor(r, rightsArtist, licenseCtx)),
              ];
            })} />
            {artistCatalog.length > 0 && (
              <div className="text-sm mb-3 flex items-center gap-3 flex-wrap" style={{ color: C.textDim }}>
                <span>{pickedReleases.length ? 'Exporting ' + pickedReleases.length + ' of ' + artistCatalog.length + ' selected' : 'Exporting all ' + artistCatalog.length + '. Tick releases to export only those.'}</span>
                {pickedReleases.length > 0 && <button onClick={() => setPickedReleases([])} style={{ color: C.amber }}>Clear selection</button>}
              </div>
            )}

            {artistCatalog.length === 0 ? (
              <EmptyState icon={Disc3} title="No releases yet" description="Releases the label adds for you will show up here." />
            ) : (
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
                {artistCatalog.map(r => {
                  const prog = checklistProgress(r.checklist);
                  return (
                    <div key={r.id} className="rounded border overflow-hidden" style={{ background: C.panel, borderColor: C.border }}>
                      <div style={{ width: '100%', aspectRatio: '1 / 1', position: 'relative' }}>
                        <ArtworkThumb release={r} size="100%" radius={0} />
                        <label style={{ position: 'absolute', top: 8, right: 8, background: C.panel, borderRadius: 8, padding: '4px 6px', display: 'flex', boxShadow: 'var(--shadow)' }}>
                          <input type="checkbox" aria-label={'Select ' + r.title + ' for export'} checked={pickedReleases.includes(r.id)} onChange={e => setPickedReleases(l => e.target.checked ? [...l, r.id] : l.filter(x => x !== r.id))} />
                        </label>
                        {r.status !== 'Released' && prog.total > 0 && (
                          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 3, background: 'var(--fill)' }}>
                            <div style={{ height: 3, width: prog.pct + '%', background: C.amber }} />
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <div className="text-xs" style={{ color: C.textFaint }}>{formatDate(r.releaseDate)}</div>
                        <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3, marginTop: 2 }}>{r.title}</div>
                        {r.primaryArtists && r.primaryArtists.length > 0 && (
                          <div style={{ fontStyle: 'italic', fontSize: 13, color: C.textDim, marginTop: 1 }}>with {r.primaryArtists.join(' & ')}</div>
                        )}
                        {r.collaborators && r.collaborators.length > 0 && (
                          <div style={{ fontStyle: 'italic', fontSize: 13, color: C.textDim, marginTop: 1 }}>feat. {r.collaborators.map(c => c.name).join(', ')}</div>
                        )}
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <Badge tone={releaseStatusTone(r.status)}>{r.status}</Badge>
                          <Badge>{r.type}</Badge>
                          {r.hasVideo && <Badge><Video size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />Video</Badge>}
                        </div>
                        {(r.primaryMarket || r.secondaryMarket) && (
                          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                            {r.primaryMarket && <Badge tone="teal"><Globe size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />{r.primaryMarket}</Badge>}
                            {r.secondaryMarket && <Badge>+ {r.secondaryMarket}</Badge>}
                          </div>
                        )}
                        {r.status !== 'Released' && prog.total > 0 && (
                          <div className="text-xs mt-1.5" style={{ color: C.textFaint }}>{prog.done}/{prog.total} production tasks</div>
                        )}
                        {r.status === 'Released' && <div className="text-xs mt-1.5" style={{ color: C.textDim, lineHeight: 1.4 }}>{rightsLine(licenseFor(r, rightsArtist, licenseCtx))}</div>}
                        {(r.isrc || r.upc) && (
                          <div className="text-xs mt-2" style={{ color: C.textFaint, lineHeight: 1.5 }}>
                            {r.isrc && <div>ISRC {r.isrc}</div>}
                            {r.upc && <div>UPC {r.upc}</div>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'profile' && (
          <div>
            <PasskeySettings />
            <TwoFactorSettings />
            <section aria-label="Your deal" className="rounded p-5 mb-6" style={{ background: C.panel }}>
              <h2 style={{ fontWeight: 600, fontSize: 19, letterSpacing: '-0.02em' }}>Your deal</h2>
              <p className="mt-1 mb-3" style={{ color: C.textDim, fontSize: 14 }}>Your share of net earnings and your deal over time. Each month is paid at the terms in force that month.</p>
              <ol className="imss-steps" aria-label="Deal history">
                {dealTermsOf(artist).map((t, i, list) => (
                  <li key={i} className={i === list.length - 1 ? 'is-current' : 'is-done'}>
                    <span className="imss-step-dot" aria-hidden="true">{i + 1}</span>
                    <span>{t.from ? 'From ' + monthLong(t.from) : 'Start'} · {pctLabel(t.artistPct)} to you · {dealLabel(t)}</span>
                  </li>
                ))}
              </ol>
            </section>
            <div className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
              <div className="text-sm" style={{ color: C.textDim }}>
                {saveProfile ? 'Update your photo, bio and links here; they save straight away. Your sign-in email, royalty rate, contract terms and team are managed by the label.' : 'You can update your photo, bio and links here. Changes are reviewed by your Product Manager or Admin before they go live. Everything else on your profile (royalty rate, contract terms, team assignments) is managed by the label directly.'}
              </div>
            </div>

            {myPendingRequest && (
              <div className="rounded border p-4 mb-6" style={{ background: C.amberSoft, borderColor: C.amber }}>
                <div className="text-xs mb-2" style={{ color: C.amber, fontWeight: 600 }}>Awaiting review</div>
                <div className="flex flex-col gap-1.5">
                  {Object.entries(myPendingRequest.changes).map(([key, value]) => {
                    const field = PROFILE_EDITABLE_FIELDS.find(f => f.key === key);
                    return (
                      <div key={key} className="text-sm" style={{ color: C.text }}>
                        {field ? field.label : key}: {key === 'photoUrl' ? 'New photo submitted' : <span style={{ fontStyle: 'italic' }}>"{value}"</span>}
                      </div>
                    );
                  })}
                </div>
                <div className="text-xs mt-2" style={{ color: C.textFaint }}>Submitted {new Date(myPendingRequest.submittedAt).toLocaleString()}</div>
              </div>
            )}

            <div className="rounded p-6 mb-6" style={{ background: C.panel }}>
              <h2 style={{ fontWeight: 600, fontSize: 19, letterSpacing: '-0.02em' }}>Edit your profile</h2>
              <p className="mt-1 mb-5" style={{ color: C.textDim, fontSize: 14 }}>{saveProfile ? 'Changes save as soon as you press Save.' : 'Changes go to the label for review before they show.'}</p>

              {cropFile && <PhotoCropper file={cropFile} onDone={url => { setProfileForm(f => ({ ...f, photoUrl: url })); setCropFile(null); if (profileInputRef.current) profileInputRef.current.value = ''; }} onCancel={() => { setCropFile(null); if (profileInputRef.current) profileInputRef.current.value = ''; }} />}
              <section aria-label="Photo" className="flex items-center gap-4 mb-6">
                <Avatar name={artist.name} photoUrl={profileForm.photoUrl} size={72} />
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="inline-flex items-center gap-1.5" style={{ position: 'relative', background: C.fill, color: C.text, borderRadius: 980, padding: '8px 16px', fontSize: 14, cursor: 'pointer' }}>
                    <Upload size={14} /> {profileForm.photoUrl ? 'Change photo' : 'Upload photo'}
                    <input ref={profileInputRef} type="file" accept="image/*" onChange={handleProfilePhoto} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />
                  </label>
                  {profileForm.photoUrl && <button type="button" onClick={() => setProfileForm(f => ({ ...f, photoUrl: '' }))} style={{ color: C.textDim, fontSize: 14 }}>Remove</button>}
                </div>
              </section>

              <section aria-label="About you" className="mb-6">
                <h3 className="mb-3" style={{ fontWeight: 600, fontSize: 15 }}>About you</h3>
                <div className="imss-form-grid gap-3">
                  <Field label="Sign-in email" full><div aria-readonly="true" title="Only the label can change this" style={{ background: 'transparent', border: '1px dashed ' + C.border, borderRadius: 12, padding: '10px 14px', color: C.textDim, cursor: 'not-allowed', userSelect: 'all' }}>{artist.email || '—'}</div><div style={{ color: C.textDim, fontSize: 13, marginTop: 6 }}>To change your sign-in email, contact your Product Manager.</div></Field>
                  <Field label="Bio" full><TextArea rows={4} value={profileForm.bio} onChange={e => setProfileForm({ ...profileForm, bio: e.target.value })} placeholder="A short bio the label can use for press and pitches." /></Field>
                </div>
              </section>

              {[['streaming', 'Streaming profiles'], ['social', 'Socials']].map(([g, title]) => (
                <section key={g} aria-label={title} className="mb-6">
                  <h3 style={{ fontWeight: 600, fontSize: 15 }}>{title}</h3>
                  <p className="mt-0.5 mb-3" style={{ color: C.textDim, fontSize: 13 }}>Paste the full link to each page you have. Leave the rest empty.</p>
                  <div className="gap-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                    {SOCIAL_LINKS.filter(l => l.group === g).map(l => <Field key={l.key} label={l.label}><Input type="url" value={profileForm[l.key] || ''} onChange={e => setProfileForm(f => ({ ...f, [l.key]: e.target.value }))} placeholder={l.hint} /></Field>)}
                  </div>
                </section>
              ))}

              <div className="flex items-center justify-end gap-3 pt-4" style={{ borderTop: '1px solid ' + C.border }}>
                {profileSaved && <span role="status" className="text-sm" style={{ color: /Couldn|No changes/.test(profileSaved) ? C.amber : C.teal }}>{profileSaved}</span>}
                <Btn variant="primary" onClick={submitProfileRequest}>{saveProfile ? 'Save' : 'Submit for review'}</Btn>
              </div>
            </div>

            {myProfileRequests.length > 0 && (
              <div className="rounded border" style={{ background: C.panel, borderColor: C.border }}>
                <div className="text-xs px-4 pt-4 pb-2" style={{ color: C.textFaint }}>Request history</div>
                <table className="w-full">
                  <tbody>
                    {myProfileRequests.map(r => (
                      <tr key={r.id}>
                        <Td mono>{formatDate(r.submittedAt.slice(0, 10))}</Td>
                        <Td>{Object.keys(r.changes).map(k => (PROFILE_EDITABLE_FIELDS.find(f => f.key === k) || {}).label || k).join(', ')}</Td>
                        <Td><Badge tone={r.status === 'Approved' ? 'teal' : r.status === 'Rejected' ? 'red' : 'amber'}>{r.status}</Badge></Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'requests' && (
          <div>
            <div className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
              <div className="text-xs mb-3" style={{ color: C.textFaint }}>New request</div>
              <div className="imss-form-grid gap-3 mb-3">
                <Field label="Category">
                  <Select value={requestForm.category} onChange={e => setRequestForm({ ...requestForm, category: e.target.value })}>
                    {REQUEST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </Field>
                <Field label="Title"><Input value={requestForm.title} onChange={e => setRequestForm({ ...requestForm, title: e.target.value })} placeholder="One line summary" /></Field>
                <Field label="Details" full><TextArea rows={3} value={requestForm.message} onChange={e => setRequestForm({ ...requestForm, message: e.target.value })} placeholder="Give your PM or Admin what they need to help." /></Field>
              </div>
              <Btn variant="primary" onClick={submitArtistRequest}>Submit request</Btn>
            </div>

            {myArtistRequests.length === 0 ? (
              <EmptyState icon={MessageSquare} title="No requests yet" description="Need something from the label — a meeting, marketing support, tour funding? Submit it above." />
            ) : (
              <div className="flex flex-col gap-3">
                {myArtistRequests.map(r => {
                  const expanded = expandedRequestId === r.id;
                  return (
                    <div key={r.id} className="rounded border overflow-hidden" style={{ background: C.panel, borderColor: C.border }}>
                      <button onClick={() => setExpandedRequestId(expanded ? null : r.id)} className="w-full text-left p-4 flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Badge>{r.category}</Badge>
                            <Badge tone={r.status === 'Resolved' ? 'teal' : r.status === 'In Progress' ? 'amber' : 'default'}>{r.status}</Badge>
                          </div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{r.title}</div>
                          <div className="text-xs mt-0.5" style={{ color: C.textFaint }}>{formatDate(r.submittedAt.slice(0, 10))}</div>
                        </div>
                        <ChevronDown size={16} color={C.textFaint} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
                      </button>
                      {expanded && (
                        <div className="px-4 pb-4">
                          <div className="rounded p-3 text-sm" style={{ background: C.bg, color: C.textDim }}>{r.message}</div>
                          {(r.messages || []).length > 0 && (
                            <ol className="imss-thread mt-2">
                              {r.messages.map((m, i) => (
                                <li key={i} className={m.from === 'artist' ? 'is-artist' : 'is-label'}>
                                  <div className="imss-thread-meta">{m.from === 'artist' ? 'You' : (m.by || 'IMSS Records')} · {formatDate(String(m.at || '').slice(0, 10))}{m.via === 'email' ? ' · by email' : ''}</div>
                                  <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                                </li>
                              ))}
                            </ol>
                          )}
                          {r.response ? (
                            <div className="rounded p-3 text-sm mt-2" style={{ background: C.tealSoft, border: '1px solid ' + C.teal }}>
                              <div className="text-xs mb-1" style={{ color: C.teal, fontWeight: 600 }}>Response from {r.respondedBy || 'the label'}</div>
                              <div style={{ color: C.text }}>{r.response}</div>
                            </div>
                          ) : (
                            <div className="text-xs mt-2" style={{ color: C.textFaint }}>No response yet — your PM or Admin will get back to you here.</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'revenue' && (
          <div>
            <div className="imss-print-hide rounded border p-4 mb-4" style={{ background: C.panel, borderColor: C.border }}>
              <div className="text-xs mb-3" style={{ color: C.textFaint }}>What do you want to see?</div>
              <div className="imss-form-grid gap-3">
                <Field label="From"><Input type="date" value={revFilters.startDate} onChange={e => setRevFilters({ ...revFilters, startDate: e.target.value })} /></Field>
                <Field label="To"><Input type="date" value={revFilters.endDate} onChange={e => setRevFilters({ ...revFilters, endDate: e.target.value })} /></Field>
                <Field label="Type">
                  <Select value={revFilters.type} onChange={e => setRevFilters({ ...revFilters, type: e.target.value })}>
                    <option value="all">All types</option>
                    {revTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </Field>
                <Field label="Product">
                  <Select value={revFilters.product} onChange={e => setRevFilters({ ...revFilters, product: e.target.value })}>
                    <option value="all">All products</option>
                    {artistCatalog.map(c => <option key={c.id} value={c.title}>{c.title}</option>)}
                  </Select>
                </Field>
              </div>
              {revError && (
                <div className="rounded px-3 py-2 text-xs mt-3" style={{ background: C.redSoft, color: C.red, border: '1px solid ' + C.red }}>{revError}</div>
              )}
              <div className="flex gap-2 flex-wrap mt-4">
                <Btn variant="primary" onClick={generateRevenue}>
                  <FileText size={14} /> {revGenerated ? 'Regenerate' : 'Generate'}
                </Btn>
                {revGenerated && <Btn variant="ghost" onClick={resetRevFilters}>Clear</Btn>}
              </div>
            </div>

            {!revGenerated ? (
              <EmptyState icon={DollarSign} title="Pick a period, then generate"
                description="Choose the dates — and a type or product if you want to narrow it — then hit Generate to see exactly that revenue." />
            ) : (
            <>
            <div className="flex flex-wrap gap-3 mb-6">
              <div className="w-full"><DealSpanNote artist={artist} rows={filteredMyRevenue} active={revGenerated && revGenerated.deal ? revGenerated.deal : null}
                onPick={p => { const f = { ...EMPTY_REV_FILTERS, startDate: p.from ? p.from + '-01' : '', endDate: p.to ? p.to + '-28' : '', deal: p }; setRevFilters(f); setRevGenerated(f); setRevError(''); }} /></div>
              <KPICard icon={DollarSign} label={revFiltersActive ? 'Gross in this period' : 'Total gross'} value={formatCents(filteredRevTotals.gross)} />
              <KPICard icon={Wallet} label="Inbound Banking Charge" value={formatCents(filteredRevTotals.charge)} />
              <KPICard icon={DollarSign} label={'Your earnings (' + rateLabel(filteredMyRevenue) + ')'} value={formatCents(filteredRevTotals.artistShare)} tone="teal" />
              <KPICard icon={ClipboardList} label="Entries" value={filteredMyRevenue.length} />
            </div>

            <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
              <div style={{ fontWeight: 600 }}>{revPeriodLabel()}</div>
              <div className="text-xs" style={{ color: C.textFaint }}>Showing {filteredMyRevenue.length} of {myRevenue.length} entries</div>
            </div>

            <div className="imss-print-hide flex items-center gap-1 mb-4 flex-wrap">
              {[['none', 'Flat'], ['product', 'By song'], ['source', 'By release type'], ['stores', 'By platform'], ['countries', 'By country'], ['types', 'By format'], ['models', 'By model'], ['salesMonths', 'By month earned']].map(([id, label]) => (
                <button key={id} onClick={() => setRevGroupBy(id)} className="text-sm px-3 py-1.5 rounded"
                  style={{ background: revGroupBy === id ? C.amberSoft : 'transparent', color: revGroupBy === id ? C.amber : C.textDim, border: '1px solid ' + (revGroupBy === id ? 'transparent' : C.border), fontWeight: revGroupBy === id ? 600 : 500 }}>
                  {label}
                </button>
              ))}
            </div>

            <ExportBar filename={(artist.name || 'artist').replace(/\s+/g, '-').toLowerCase() + '-revenue'} headers={['Month', 'Type', 'Product', 'Gross', 'Inbound Banking Charge', 'Your earnings']} rows={filteredMyRevenue.map(r => { const x = splitOf(r); return [r.month, r.type, r.title, x.gross, x.charge, x.artistShare]; })} />

            {filteredMyRevenue.length === 0 ? (
              <EmptyState icon={DollarSign} title="Nothing in that period" description="No revenue was logged for what you picked. Try a wider date range, or clear the type and product filters." />
            ) : revGroupBy === 'none' ? (
              <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
                <table className="w-full" style={{ minWidth: 820 }}>
                  <thead><tr><Th>Month</Th><Th>Type</Th><Th>Product</Th><Th align="right">Gross</Th><Th align="right">Inbound Banking Charge</Th><Th align="right">Your earnings</Th></tr></thead>
                  <tbody>
                    {filteredMyRevenue.map((r, i) => { const x = splitOf(r); return (
                      <tr key={i}>
                        <Td mono>{monthLabel(r.month)}</Td>
                        <Td><Badge>{r.type}</Badge></Td>
                        <Td>{r.title}</Td>
                        <Td align="right" mono>{formatCents(x.gross)}</Td>
                        <Td align="right" mono>−{formatCents(x.charge)}</Td>
                        <Td align="right" mono><span style={{ color: C.teal, fontWeight: 600 }}>{formatCents(x.artistShare)}</span></Td>
                      </tr>
                    ); })}
                  </tbody>
                </table>
              </div>
            ) : BREAKDOWN_FIELDS[revGroupBy] ? (
              <RevenueBreakdownTable parts={revenueBreakdown(filteredMyRevenue, revGroupBy, splitOf)} label={BREAKDOWN_FIELDS[revGroupBy]} format={revGroupBy} />
            ) : revGroupBy === 'source' ? (
              <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
                <table className="w-full" style={{ minWidth: 320 }}>
                  <thead><tr><Th>Type</Th><Th align="right">Entries</Th><Th align="right">Gross</Th><Th align="right">Your earnings</Th></tr></thead>
                  <tbody>
                    {revByType.map(s => { const rows = filteredMyRevenue.filter(r => r.type === s.type); return (
                      <tr key={s.type}>
                        <Td><Badge>{s.type}</Badge></Td>
                        <Td align="right" mono>{rows.length}</Td>
                        <Td align="right" mono>{formatCents(s.value)}</Td>
                        <Td align="right" mono><span style={{ color: C.teal, fontWeight: 600 }}>{formatCents(sumSplits(rows).artistShare)}</span></Td>
                      </tr>
                    ); })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {revByProduct.map(p => { const t = sumSplits(p.entries); return (
                  <div key={p.title} className="rounded border overflow-x-auto" style={{ background: C.panel, borderColor: C.border }}>
                    <div className="px-3 pt-3 pb-1" style={{ fontWeight: 600 }}>{p.title}</div>
                    {/* Fixed column widths so every product card lines up with the next. */}
                    <table className="w-full" style={{ tableLayout: 'fixed', minWidth: 420 }}>
                      <colgroup><col style={{ width: '22%' }} /><col style={{ width: '28%' }} /><col style={{ width: '25%' }} /><col style={{ width: '25%' }} /></colgroup>
                      <thead><tr><Th>Month</Th><Th>Type</Th><Th align="right">Gross</Th><Th align="right">Your earnings</Th></tr></thead>
                      <tbody>
                        {p.entries.sort((a, b) => (b.month || '').localeCompare(a.month || '')).map((r, i) => (
                          <tr key={i}>
                            <Td mono>{monthLabel(r.month)}</Td>
                            <Td><Badge>{r.type}</Badge></Td>
                            <Td align="right" mono>{formatCents(r.earning)}</Td>
                            <Td align="right" mono><span style={{ color: C.teal }}>{formatCents(splitOf(r).artistShare)}</span></Td>
                          </tr>
                        ))}
                        <tr>
                          <Td><span style={{ fontWeight: 600 }}>Total</span></Td>
                          <Td>{''}</Td>
                          <Td align="right" mono><span style={{ fontWeight: 600 }}>{formatCents(t.gross)}</span></Td>
                          <Td align="right" mono><span style={{ color: C.teal, fontWeight: 600 }}>{formatCents(t.artistShare)}</span></Td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ); })}
              </div>
            )}
            </>
            )}
          </div>
        )}

        {tab === 'payouts' && (
          <div>
            <div className="flex flex-wrap gap-3 mb-6">
              {/* These add up: earnings − recouped − paid = balance due. */}
              <KPICard icon={DollarSign} label="Your earnings" value={formatCents(lifetime.artistShare)} sub="All time, your share after charges" />
              {recoupment.recouped > 0 && <KPICard icon={Wallet} label="Recouped" value={'−' + formatCents(recoupment.recouped)} sub="Taken from earnings to cover spend on you" />}
              <KPICard icon={DollarSign} label="Paid to date" value={(paid > 0 ? '−' : '') + formatCents(paid)} tone="teal" />
              <KPICard icon={Wallet} label="Balance due" value={formatCents(Math.max(0, balance))} tone={balance > 0 ? 'amber' : undefined} sub="Payable to you now" />
            </div>

            {remainingRecoupable > 0 ? (
              <div className="rounded mb-6" style={{ background: C.amberSoft, padding: '14px 18px', fontSize: 15 }}>
                <b>{formatCents(remainingRecoupable)} of spend on you is still to be recouped.</b> It comes out of future royalties before anything more is payable. The full breakdown is under Expenses.
              </div>
            ) : recoupment.recouped > 0 ? (
              <div className="rounded mb-6" style={{ background: C.panel, padding: '14px 18px', fontSize: 15, color: C.textDim }}>
                All {formatCents(recoupment.recouped)} of spend on you has been recouped from your earnings, so nothing is outstanding. The full breakdown is under Expenses.
              </div>
            ) : null}

            <div className="rounded border" style={{ background: C.panel, borderColor: C.border }}>
              <div className="text-xs px-4 pt-4 pb-2" style={{ color: C.textFaint }}>Payout history</div>
              {myPayouts.length === 0 ? (
                <div className="p-4 text-sm" style={{ color: C.textDim }}>No payouts recorded yet.</div>
              ) : (
                <table className="w-full">
                  <thead><tr><Th>Period</Th><Th>Status</Th><Th align="right">Amount</Th></tr></thead>
                  <tbody>
                    {myPayouts.map(p => (
                      <tr key={p.id}>
                        <Td mono>{p.periodStart} – {p.periodEnd}</Td>
                        <Td><Badge tone={p.status === 'paid' ? 'teal' : undefined}>{p.status}</Badge></Td>
                        <Td align="right" mono>{formatCents(p.artistShare)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

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

        {tab === 'earnings' && (
          <div>
            <p className="text-sm mb-5" style={{ color: C.textDim, maxWidth: '70ch' }}>What you made each month across all your songs, after the Inbound Banking Charge and the label’s share.</p>
            <div className="flex flex-wrap gap-3 mb-6">
              <KPICard icon={DollarSign} label="Your earnings, all time" value={formatCents(lifetime.artistShare)} tone="teal" />
              <KPICard icon={TrendingUp} label={earningsByMonth[0] ? 'Latest month · ' + monthLabel(earningsByMonth[0].month) : 'Latest month'} value={formatCents(earningsByMonth[0] ? earningsByMonth[0].artistShare : 0)} />
              <KPICard icon={Calendar} label="Months with earnings" value={earningsByMonth.length} />
            </div>
            {earningsByMonth.length === 0 ? (
              <EmptyState icon={TrendingUp} title="No earnings yet" description="Once revenue for your songs is recorded, each month’s total shows here." />
            ) : (
              <>
                <section aria-label="Your earnings by month chart" className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
                  <div style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[...earningsByMonth].reverse().map(m => ({ month: monthLabel(m.month), value: m.artistShare }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                        <XAxis dataKey="month" tick={{ fill: C.textDim, fontSize: 11 }} axisLine={{ stroke: C.border }} tickLine={false} />
                        <YAxis tick={{ fill: C.textDim, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? '$' + Math.round(v / 1000) + 'k' : '$' + Math.round(v)} />
                        <Tooltip cursor={{ fill: 'var(--hover)' }} contentStyle={{ background: C.panel2, border: '1px solid ' + C.border, borderRadius: 12, fontSize: 13, color: C.text }} labelStyle={{ color: C.text }} formatter={(v) => [formatCents(v), 'Your earnings']} />
                        <Bar dataKey="value" fill={C.teal} radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
                <ExportBar filename={(artist.name || 'artist').replace(/\s+/g, '-').toLowerCase() + '-earnings-by-month'} headers={['Month', 'Gross', 'Inbound Banking Charge', 'Your earnings', 'Running total']} rows={earningsByMonth.map(m => [m.month, m.gross, m.charge, m.artistShare, m.running])} />
                <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
                  <table className="w-full" style={{ minWidth: 720 }}>
                    <thead><tr><Th>Month</Th><Th align="right">Gross</Th><Th align="right">Inbound Banking Charge</Th><Th align="right">Your share</Th><Th align="right">Your earnings</Th><Th align="right">Running total</Th></tr></thead>
                    <tbody>
                      {earningsByMonth.map(m => (
                        <tr key={m.month}>
                          <Td mono>{monthLabel(m.month)}</Td>
                          <Td align="right" mono>{formatCents(m.gross)}</Td>
                          <Td align="right" mono>−{formatCents(m.charge)}</Td>
                          <Td align="right" mono>{pctTxt(m.rate)}</Td>
                          <Td align="right" mono><span style={{ color: C.teal, fontWeight: 600 }}>{formatCents(m.artistShare)}</span></Td>
                          <Td align="right" mono>{formatCents(m.running)}</Td>
                        </tr>
                      ))}
                      <tr>
                        <Td><span style={{ fontWeight: 600 }}>Total</span></Td>
                        <Td align="right" mono><span style={{ fontWeight: 600 }}>{formatCents(lifetime.gross)}</span></Td>
                        <Td align="right" mono><span style={{ fontWeight: 600 }}>−{formatCents(lifetime.swift)}</span></Td>
                        <Td>{''}</Td>
                        <Td align="right" mono><span style={{ color: C.teal, fontWeight: 700 }}>{formatCents(lifetime.artistShare)}</span></Td>
                        <Td>{''}</Td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'expenses' && (
          <div>
            <p className="text-sm mb-5" style={{ color: C.textDim, maxWidth: '70ch' }}>Money spent on your career, by the label and by you. Everything spent on you, by the label and through your approved expense claims, is recouped from your royalties before payouts.</p>
            <div className="flex flex-wrap gap-3 mb-6">
              {(() => {
                // Approved spend: what the label spent on the artist plus the artist's own claims once approved for payment.
                const { byLabel, claims: approvedClaims } = artistSpend(artist, ledger, invoices);
                return <KPICard icon={Wallet} label="Artist’s approved spend" value={formatCents(byLabel + approvedClaims)} sub={formatCents(byLabel) + ' by the label · ' + formatCents(approvedClaims) + ' your approved claims'} />;
              })()}
              <KPICard icon={Wallet} label="Still being recouped" value={formatCents(remainingRecoupable)} tone={remainingRecoupable > 0 ? 'amber' : undefined} sub="From your royalties, not paid in cash" />
              {artistSpend(artist, ledger, invoices).repaidCash > 0 && <KPICard icon={Wallet} label="Repaid in cash" value={formatCents(artistSpend(artist, ledger, invoices).repaidCash)} sub="At the label’s request; not taken from your earnings" />}
              <KPICard icon={FileText} label="Claimed by you" value={formatCents(myExpenseClaims.reduce((t, i) => t + (Number(i.amount) || 0), 0))} sub={formatCents(myExpenseClaims.filter(i => i.status === 'Paid').reduce((t, i) => t + (Number(i.amount) || 0), 0)) + ' paid to you · recouped from royalties'} />
            </div>

            <h2 className="mb-3" style={{ fontWeight: 600, fontSize: 17 }}>Paid by the label</h2>
            {myExpenses.length === 0 ? (
              <div className="mb-8"><EmptyState icon={Wallet} title="Nothing spent yet" description="Advances, marketing and other costs the label pays for you will be listed here." /></div>
            ) : (
              <div className="rounded border overflow-x-auto mb-8" style={{ borderColor: C.border, background: C.panel }}>
                <table className="w-full" style={{ minWidth: 620 }}>
                  <thead><tr><Th>Date</Th><Th>Category</Th><Th>Description</Th><Th>Recoupable</Th><Th align="right">Amount</Th></tr></thead>
                  <tbody>
                    {myExpenses.map(x => (
                      <tr key={x.id}>
                        <Td mono>{formatDate(x.date)}</Td>
                        <Td>{x.category}</Td>
                        <Td>{x.description || '—'}</Td>
                        <Td><Badge tone="amber">Recouped</Badge></Td>
                        <Td align="right" mono>{formatCents(x.amount)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
              <h2 style={{ fontWeight: 600, fontSize: 17 }}>Paid by you</h2>
              <Btn variant="ghost" onClick={() => { setInvoiceForm({ ...emptyInvoice, kind: 'expense' }); setInvoiceSent(false); setTab('invoices'); }}><Plus size={14} /> Claim an expense</Btn>
            </div>
            {myExpenseClaims.length === 0 ? (
              <EmptyState icon={FileText} title="No expense claims" description="Spent your own money on something the label agreed to cover? Submit an expense claim from Invoices." />
            ) : (
              <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
                <table className="w-full" style={{ minWidth: 560 }}>
                  <thead><tr><Th>Date</Th><Th>Description</Th><Th>Status</Th><Th align="right">Amount</Th></tr></thead>
                  <tbody>
                    {myExpenseClaims.map(i => (
                      <tr key={i.id}>
                        <Td mono>{formatDate(i.invoiceDate)}</Td>
                        <Td>{i.title}</Td>
                        <Td><Badge tone={INVOICE_TONES[invoiceStatus(i)]}>{artistInvoiceStatus(i)}</Badge></Td>
                        <Td align="right" mono>{formatCents(i.amount)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'invoices' && (
          <div>
            <p className="text-sm mb-5" style={{ color: C.textDim, maxWidth: '70ch' }}>Send the label an invoice to claim back money you spent, or to bill for paid work like a feature or a show. Your Product Manager or an Admin reviews it; you’ll see the decision here.</p>

            <form onSubmit={submitInvoice} className="rounded border p-5 mb-8" style={{ background: C.panel, borderColor: C.border }}>
              <h2 className="mb-4" style={{ fontWeight: 600, fontSize: 17 }}>New invoice</h2>
              <fieldset className="mb-4">
                <legend className="text-xs mb-2" style={{ color: C.textDim }}>What is it for?</legend>
                <div className="flex gap-2 flex-wrap" role="radiogroup">
                  {Object.entries(INVOICE_KINDS).map(([k, label]) => (
                    <label key={k} className="rounded border px-3 py-2 text-sm inline-flex items-center gap-2" style={{ cursor: 'pointer', borderColor: invoiceForm.kind === k ? C.amber : C.border, background: invoiceForm.kind === k ? C.amberSoft : 'transparent', color: invoiceForm.kind === k ? C.amber : C.text }}>
                      <input type="radio" name="invoice-kind" value={k} checked={invoiceForm.kind === k} onChange={() => setInvoiceForm(f => ({ ...f, kind: k }))} style={{ accentColor: C.amber }} />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="imss-form-grid gap-3">
                <Field label="Description (be specific)" full><Input required value={invoiceForm.title} onChange={e => setInvoiceForm(f => ({ ...f, title: e.target.value }))} placeholder={invoiceForm.kind === 'expense' ? 'e.g. Studio session, 12 March' : 'e.g. Feature verse on “Wave”'} /></Field>
                <Field label="Amount (USD)"><Input required inputMode="decimal" value={invoiceForm.amount} onChange={e => setInvoiceForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" /></Field>
                <Field label="Invoice date"><Input type="date" value={invoiceForm.invoiceDate} onChange={e => setInvoiceForm(f => ({ ...f, invoiceDate: e.target.value }))} /></Field>
                <Field label="Invoice number (optional)"><Input value={invoiceForm.invoiceNumber} onChange={e => setInvoiceForm(f => ({ ...f, invoiceNumber: e.target.value }))} placeholder="e.g. AC-2026-004" /></Field>
                <Field label="Pay to (name on the account)"><Input value={invoiceForm.payTo} onChange={e => setInvoiceForm(f => ({ ...f, payTo: e.target.value }))} placeholder="Your name or company" /></Field>
                <Field label="What it’s for">
                  <Select value={invoiceForm.budgetCategory} onChange={e => setInvoiceForm(f => ({ ...f, budgetCategory: e.target.value }))}>
                    <option value="">Choose…</option>
                    {Object.entries(BUDGET_TYPES).map(([t, names]) => <optgroup key={t} label={t}>{names.map(n => <option key={n} value={t + '|' + n}>{n}</option>)}</optgroup>)}
                    <option value="Other|Other">Something else</option>
                  </Select>
                </Field>
                {budgets.filter(b => b.status === 'Active').length > 0 && (
                  <Field label="Budget (optional)">
                    <Select value={invoiceForm.overheadId} onChange={e => setInvoiceForm(f => ({ ...f, overheadId: e.target.value }))}>
                      <option value="">Not part of a budget</option>
                      {budgets.filter(b => b.status === 'Active').map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                    </Select>
                  </Field>
                )}
                <Field label="Details (optional)" full><TextArea rows={3} value={invoiceForm.details} onChange={e => setInvoiceForm(f => ({ ...f, details: e.target.value }))} placeholder="Anything the label needs to know: who agreed it, what it covers." /></Field>
                <Field label={invoiceForm.kind === 'expense' ? 'Receipt (PDF or photo, up to 10 MB)' : 'Invoice file (PDF or photo, up to 10 MB, optional)'} full>
                  <input ref={invoiceFileRef} type="file" accept="application/pdf,image/*" onChange={handleInvoiceFile} className="text-sm" style={{ color: C.textDim }} />
                </Field>
              </div>
              {invoiceError && <div className="text-sm mt-3" role="alert" style={{ color: C.red }}>{invoiceError}</div>}
              {invoiceSent && !invoiceError && <div className="text-sm mt-3" role="status" style={{ color: C.teal }}>Invoice sent. It’s listed below while the label reviews it.</div>}
              <div className="mt-4 flex gap-2"><Btn variant="primary" type="submit"><FileText size={14} /> {resubmittingId ? 'Resubmit invoice' : 'Submit invoice'}</Btn>{resubmittingId && <Btn variant="ghost" onClick={() => { setResubmittingId(null); setInvoiceForm(emptyInvoice); }}>Cancel</Btn>}</div>
            </form>

            <h2 className="mb-3" style={{ fontWeight: 600, fontSize: 17 }}>Your invoices</h2>
            {myInvoices.length === 0 ? (
              <EmptyState icon={FileText} title="No invoices yet" description="Invoices you submit show here with their status: pending, approved, paid or rejected." />
            ) : (
              <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
                <table className="w-full" style={{ minWidth: 620 }}>
                  <thead><tr><Th>Date</Th><Th>Type</Th><Th>Description</Th><Th align="right">Amount</Th><Th>Status</Th><Th align="right">Messages</Th></tr></thead>
                  <tbody>
                    {myInvoices.map(i => (
                      <React.Fragment key={i.id}>
                      <tr>
                        <Td mono>{formatDate(i.invoiceDate)}</Td>
                        <Td>{INVOICE_KINDS[i.kind] || i.kind}</Td>
                        <Td>{i.title}{i.category ? <div className="text-xs mt-0.5" style={{ color: C.textDim }}>{i.category}</div> : null}{i.reviewNote ? <div className="text-xs mt-0.5" style={{ color: C.textDim }}>Label: {i.reviewNote}</div> : null}</Td>
                        <Td align="right" mono>{formatCents(i.amount)}</Td>
                        <Td><Badge tone={INVOICE_TONES[invoiceStatus(i)]}>{artistInvoiceStatus(i)}</Badge></Td>
                        <Td align="right"><button onClick={() => setOpenInvoiceId(openInvoiceId === i.id ? null : i.id)} aria-expanded={openInvoiceId === i.id} style={{ color: C.amber, fontWeight: 600, fontSize: 13 }}>{openInvoiceId === i.id ? 'Close' : (i.messages || []).length ? 'Messages (' + i.messages.length + ')' : 'Message'}</button></Td>
                      </tr>
                      {openInvoiceId === i.id && (
                        <tr><td colSpan={6} style={{ padding: 16, borderBottom: '1px solid ' + C.border }}>
                          {i.status === 'Needs changes' && (
                            <div className="rounded p-3 mb-3" style={{ background: C.redSoft }}>
                              <div style={{ fontWeight: 600 }}>The label asked for changes</div>
                              {i.reviewNote && <div className="text-sm mt-1">{i.reviewNote}</div>}
                              <div className="mt-2"><Btn variant="primary" onClick={() => { setResubmittingId(i.id); setInvoiceForm({ ...emptyInvoice, ...Object.fromEntries(Object.keys(emptyInvoice).map(k => [k, i[k] ?? emptyInvoice[k]])), amount: String(i.amount ?? '') }); setInvoiceSent(false); window.scrollTo && document.querySelector('.imss-content')?.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit and resubmit</Btn></div>
                            </div>
                          )}
                          {i.correctedNote && i.status !== 'Needs changes' && <div className="text-sm mb-3" style={{ color: C.textDim }}>The label corrected this invoice: {i.correctedNote}</div>}
                          <InvoiceThread inv={i} artistLabel={artist.name} />
                          {invoiceStatus(i) !== 'Paid' && (
                            <div className="mt-3">
                              <Field label="Message to the label">
                                <TextArea rows={2} value={replyDrafts['inv_' + i.id] || ''} onChange={e => setReplyDrafts(d => ({ ...d, ['inv_' + i.id]: e.target.value }))} placeholder="e.g. Receipt attached by email; the deposit was paid on 12 March." />
                              </Field>
                              {replyError['inv_' + i.id] && <div className="text-sm mt-2" role="alert" style={{ color: C.red }}>{replyError['inv_' + i.id]}</div>}
                              <div className="mt-2"><Btn variant="ghost" onClick={() => sendInvoiceReply(i)}><MessageSquare size={14} /> Send message</Btn></div>
                            </div>
                          )}
                        </td></tr>
                      )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

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
