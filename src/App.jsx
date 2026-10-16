import { ArrowLeft, Bell, Calendar, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Coins, Disc3, DollarSign, Download, Eye, FileDown, FileSpreadsheet, FileText, Globe, Send, History, LayoutDashboard, LogOut, Mail, MessageSquare, Pencil, Plus, Printer, Radio, Search, ShieldCheck, Trash2, TrendingUp, Upload, UserCog, Users, Video, Wallet } from 'lucide-react';
import Papa from 'papaparse';
import { parseEmpireDetailed } from './empire.js';
import { logActivity, logSignIn } from './audit.js';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import * as XLSX from 'xlsx';
import { ARTIST_STATUSES, COLLABORATOR_ROLES, EXPLICIT_OPTIONS, SPLIT_REQUIRED_ROLES, STAFF_EMAIL_DOMAINS, isStaffEmailAllowed, FUNDING_TIERS, DEAL_TYPES, dealLabel, GENRES, IMPORT_FIELD_LABELS, LEDGER_CATEGORIES, MARKETS, PERMISSION_FIELDS, PLATFORMS, PLATFORM_COLORS, RELEASE_STATUSES, RELEASE_TYPES, STAFF_ROLES, STAFF_STATUSES, SUB_GENRES, artistStatusTone, buildImportGroups, checklistProgress, computePlatformLeaderboard, defaultPermissionsForRole, emptyCredits, expirationStatus, licenseOf, rightsLine, LICENSE_YEARS, extractPivotTable, formatCents, formatCurrency, formatDate, formatNumber, guessColumnIndex, guessMapping, guessPlatform, guessReleaseTitleFromFilename, isTopRole, makeDistributionDocs, makeOnboardingChecklist, makeReleaseChecklist, missingRequiredDocs, monthKey, monthLabel, normalizeIsrc, normalizeStr, onboardingProgress, parseAmount, parseQuantity, parseStatementDate, permissionsFor, releaseStatusTone, todayStr, trackOptionLabel, uid } from './constants.js';
import { artistLifetime, companyFinanceTotals, labelPnL, ledgerTotals, payoutStatementFor, recoupmentForArtist, revByMonth, revenueBreakdown, revenueRowSplit, artistPublishedView, publishSnapshot, applyThreshold, artistSpend, dealTermsOf, expandRemittances, pctAt, termsAt, lastClosedPeriod, monthRange, reportingTerms, DEFAULT_DELIVERY_DAYS, slug, swiftShareFor } from './finance.js';
import { DATA_VERSION, PROFILE_EDITABLE_FIELDS, REQUEST_CATEGORIES, REQUEST_STATUSES, SEED_ACCESS_REQUESTS, SEED_ACTIVITY_LOG, SEED_ARTIST_REQUESTS, SEED_CATALOG, SEED_INVOICES, SEED_LABEL_BUDGETS, SEED_LABEL_SETTINGS, SEED_LEDGER, SEED_MASTER_GROSS, SEED_NOTICES, SEED_PAYOUTS, SEED_PROFILE_REQUESTS, SEED_RELEASE_SUBMISSIONS, SEED_REVENUE, SEED_ROSTER, SEED_STAFF, SEED_STREAMS, SEED_TASKS, TASK_STATUSES } from './seed.js';
import { statementFileUrl, supabase } from './storage.js';
import EmpireImport from './sections/EmpireImport.jsx';
import { LegalFooter } from './Legal.jsx';
import PublishToArtists from './sections/PublishToArtists.jsx';
import DealChanges from './sections/DealChanges.jsx';
import { AuditSection, NotificationBell } from './sections/Notifications.jsx';
import { C, CANVAS_GRADIENT, GLOBAL_STYLES, HEADING_FONT, LOGO_DATA_URI, MONO_FONT } from './theme.js';
import { inputStyle, ArtworkThumb, Avatar, Badge, Btn, ConfirmInline, EmptyState, ExportBar, Field, Input, KPICard, PeopleInput, DropZone, SectionHeader, SegmentedToggle, Select, Td, TextArea, Th, exportRowsToCsv, exportRowsToExcel, resizeImageFile } from './ui.jsx';

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

function Overview({ roster, catalog, revenue, masterGross = [], streams, artistMap, releaseMap, notices = [], staff = [], sessionName = '', canViewRoyalties = true, attention = [], onOpen }) {
  const [filters, setFilters] = useState({ startDate: '', endDate: '' });
  // The range only takes effect on Generate — until then the dashboard shows
  // all time, so landing here is never a blank screen.
  const [applied, setApplied] = useState({ startDate: '', endDate: '' });
  const [rangeError, setRangeError] = useState('');

  const filteredRevenue = revenue.filter(r => (!applied.startDate || (r.month + '-01') >= applied.startDate) && (!applied.endDate || (r.month + '-01') <= applied.endDate));
  const filteredStreams = streams.filter(s => (!applied.startDate || s.date >= applied.startDate) && (!applied.endDate || s.date <= applied.endDate));
  const filtersActive = !!(applied.startDate || applied.endDate);
  function resetFilters() { setFilters({ startDate: '', endDate: '' }); setApplied({ startDate: '', endDate: '' }); setRangeError(''); }
  function applyRange() {
    if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
      setRangeError('The "from" date has to come before the "to" date.');
      return;
    }
    setRangeError('');
    setApplied({ ...filters });
  }

  const totalRevenue = filteredRevenue.reduce((s, r) => s + r.earning, 0);
  const totalStreams = filteredStreams.reduce((s, r) => s + r.count, 0);
  const activeArtists = roster.filter(a => a.status === 'Active').length;
  const myStaffRecord = staff.find(s => s.name === sessionName);
  const myTeamNotices = useMemo(() => {
    return [...notices.filter(n => n.audience === 'all-team' || (myStaffRecord && n.audience === myStaffRecord.id))].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [notices, myStaffRecord]);

  const finance = useMemo(() => companyFinanceTotals(roster, filteredRevenue, masterGross), [roster, filteredRevenue, masterGross]);

  const monthlyRevenue = useMemo(() => {
    const map = {};
    filteredRevenue.forEach(r => { map[r.month] = (map[r.month] || 0) + r.earning; });
    return Object.keys(map).sort().map(k => ({ month: monthLabel(k), value: map[k] }));
  }, [filteredRevenue]);

  const platformTotals = useMemo(() => {
    const map = {};
    filteredStreams.forEach(s => { map[s.platform] = (map[s.platform] || 0) + s.count; });
    return Object.keys(map).map(k => ({ name: k, value: map[k] }));
  }, [filteredStreams]);

  const topSongs = useMemo(() => {
    const map = {};
    filteredRevenue.forEach(r => {
      const key = r.artistSlug + '|' + r.title;
      if (!map[key]) map[key] = { id: key, title: r.title, type: r.type, artist: r.artist, value: 0 };
      map[key].value += r.earning;
    });
    return Object.values(map).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [filteredRevenue]);

  const topGenres = useMemo(() => {
    const map = {};
    filteredRevenue.forEach(r => {
      const artist = roster.find(a => slug(a.name) === r.artistSlug);
      const genre = artist && artist.genre ? artist.genre : 'Unspecified';
      map[genre] = (map[genre] || 0) + r.earning;
    });
    return Object.entries(map).map(([genre, value]) => ({ genre, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [filteredRevenue, roster]);

  const topMarkets = useMemo(() => {
    const map = {};
    filteredRevenue.forEach(r => {
      const artist = roster.find(a => slug(a.name) === r.artistSlug);
      const market = artist && artist.primaryMarket ? artist.primaryMarket : 'Unspecified';
      map[market] = (map[market] || 0) + r.earning;
    });
    return Object.entries(map).map(([market, value]) => ({ market, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [filteredRevenue, roster]);

  const topArtistsByRevenue = useMemo(() => {
    const map = {};
    filteredRevenue.forEach(r => { map[r.artistSlug] = (map[r.artistSlug] || 0) + r.earning; });
    return roster.map(a => ({ artist: a, value: map[slug(a.name)] || 0 })).filter(x => x.value > 0).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [filteredRevenue, roster]);

  const topArtistsByStreams = useMemo(() => {
    const map = {};
    filteredStreams.forEach(s => { const rel = releaseMap[s.releaseId]; if (rel) map[rel.artistId] = (map[rel.artistId] || 0) + s.count; });
    return roster.map(a => ({ artist: a, value: map[a.id] || 0 })).filter(x => x.value > 0).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [filteredStreams, releaseMap, roster]);

  return (
    <div>
      <SectionHeader title="Overview" description="Label performance at a glance — roster health, release activity, revenue, and stream volume." />

      <section aria-labelledby="attn-h" className="rounded border mb-6" style={{ background: C.panel, borderColor: attention.length ? C.amber : C.border }}>
        <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
          <h2 id="attn-h" style={{ fontWeight: 600, fontSize: 15 }}>Needs your attention</h2>
          {attention.length > 0 && <Badge tone="amber">{attention.length}</Badge>}
        </div>
        {attention.length === 0 ? (
          <div className="flex items-center gap-2 px-4 pb-4 text-sm" style={{ color: C.textDim }}><CheckCircle2 size={15} color={C.teal} /> You’re all caught up. Nothing is waiting on you.</div>
        ) : (
          <ul>
            {attention.map(n => (
              <li key={n.id} style={{ borderTop: '1px solid ' + C.border }}>
                <button onClick={() => onOpen && onOpen(n.tab)} className="flex items-center gap-3 w-full text-left px-4 py-3 text-sm hover:bg-white/5">
                  <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, flexShrink: 0, background: n.tone === 'red' ? C.red : C.amber }} />
                  <span className="flex-1">{n.text}</span>
                  <ChevronRight size={15} color={C.textDim} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {myTeamNotices.length > 0 && (
        <section aria-label="Notices" className="rounded mb-6" style={{ background: C.amberSoft }}>
          {myTeamNotices.map((n, i) => (
            <div key={n.id} style={{ padding: '16px 20px', borderTop: i ? '1px solid ' + C.border : 'none' }}>
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <div style={{ fontWeight: 600, fontSize: 17, letterSpacing: '-0.02em' }}>{n.title}</div>
                <div style={{ color: C.textDim, fontSize: 13 }}>{formatDate(n.createdAt)}</div>
              </div>
              <div className="mt-1" style={{ color: C.text, fontSize: 15, lineHeight: 1.45 }}>{n.message}</div>
            </div>
          ))}
        </section>
      )}

      <div className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
        <div className="imss-form-grid gap-3">
          <Field label="From"><Input type="date" value={filters.startDate} onChange={e => { setFilters({ ...filters, startDate: e.target.value }); setRangeError(''); }} /></Field>
          <Field label="To"><Input type="date" value={filters.endDate} onChange={e => { setFilters({ ...filters, endDate: e.target.value }); setRangeError(''); }} /></Field>
        </div>
        {rangeError && (
          <div className="rounded px-3 py-2 text-xs mt-3" style={{ background: C.redSoft, color: C.red, border: '1px solid ' + C.red }}>{rangeError}</div>
        )}
        <div className="flex items-center gap-2 flex-wrap mt-4">
          <Btn variant="primary" onClick={applyRange}><FileText size={14} /> Generate</Btn>
          {filtersActive && <Btn variant="ghost" onClick={resetFilters}>Reset to all-time</Btn>}
          {filtersActive && <span className="text-xs" style={{ color: C.textFaint }}>Showing {formatDate(applied.startDate) || 'the start'} – {formatDate(applied.endDate) || 'today'}</span>}
        </div>
      </div>

      <div className="imss-bento mb-6">
        <div className="imss-bento-span-3 rounded p-6 border flex flex-col justify-center" style={{ background: C.panel, borderColor: C.border, minHeight: 160 }}>
          <div className="flex items-center gap-2 mb-2" style={{ color: C.textFaint }}>
            {canViewRoyalties ? <DollarSign size={16} /> : <Radio size={16} />}
            <span className="text-sm">{canViewRoyalties ? 'Total revenue' : 'Total streams'}</span>
          </div>
          <div style={{ fontFamily: MONO_FONT, fontSize: 40, fontWeight: 700, color: C.teal, lineHeight: 1 }}>
            {canViewRoyalties ? formatCurrency(totalRevenue) : formatNumber(totalStreams)}
          </div>
          <div className="text-xs mt-2" style={{ color: C.textFaint }}>{filtersActive ? 'Selected date range' : 'All-time'}</div>
        </div>
        <div className="imss-bento-span-1"><KPICard icon={Users} label="Active artists" value={activeArtists} sub={roster.length + ' total on roster'} tone="amber" /></div>
        <div className="imss-bento-span-1"><KPICard icon={Disc3} label="Catalog size" value={catalog.length} sub={catalog.filter(c => c.status === 'Released').length + ' released'} /></div>
        <div className="imss-bento-span-1"><KPICard icon={Radio} label="Total streams" value={formatNumber(totalStreams)} /></div>

        {canViewRoyalties && <div className="imss-bento-span-3 rounded p-4 border" style={{ background: C.panel, borderColor: C.border }}>
          <div className="text-xs mb-3" style={{ color: C.textFaint }}>Revenue by month</div>
          <div style={{ height: 220 }}>
            {monthlyRevenue.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm" style={{ color: C.textFaint }}>No revenue yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: C.textFaint, fontSize: 11 }} axisLine={{ stroke: C.border }} tickLine={false} />
                  <YAxis tick={{ fill: C.textFaint, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? '$' + Math.round(v / 1000) + 'k' : '$' + Math.round(v)} />
                  <Tooltip contentStyle={{ background: C.panel2, border: '1px solid ' + C.border, borderRadius: 12, fontSize: 13, color: C.text }} labelStyle={{ color: C.text }} formatter={(v) => formatCurrency(v)} />
                  <Bar dataKey="value" fill={C.amber} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>}
        <div className="imss-bento-span-3 rounded p-4 border" style={{ background: C.panel, borderColor: C.border }}>
          <div className="text-xs mb-3" style={{ color: C.textFaint }}>Streams by platform</div>
          <div style={{ height: 220 }}>
            {platformTotals.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm" style={{ color: C.textFaint }}>No stream data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={platformTotals} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {platformTotals.map((p) => (<Cell key={p.name} fill={PLATFORM_COLORS[p.name] || C.textFaint} />))}
                  </Pie>
                  <Tooltip contentStyle={{ background: C.panel2, border: '1px solid ' + C.border, borderRadius: 12, fontSize: 13, color: C.text }} formatter={(v) => formatNumber(v)} />
                  <Legend wrapperStyle={{ fontSize: 11, color: C.textDim }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="imss-grid-2 gap-4 mb-6">
        {canViewRoyalties && <div className="rounded border" style={{ background: C.panel, borderColor: C.border }}>
          <div className="text-xs px-4 pt-4 pb-2" style={{ color: C.textFaint }}>Top artists by revenue</div>
          {topArtistsByRevenue.length === 0 ? (
            <div className="p-4 text-sm" style={{ color: C.textDim }}>No revenue recorded yet.</div>
          ) : (
            <table className="w-full">
              <tbody>
                {topArtistsByRevenue.map(({ artist, value }, i) => (
                  <tr key={artist.id}>
                    <Td mono>{i + 1}</Td>
                    <Td>{artist.name}</Td>
                    <Td align="right" mono>{formatCurrency(value)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>}
        <div className="rounded border" style={{ background: C.panel, borderColor: C.border }}>
          <div className="text-xs px-4 pt-4 pb-2" style={{ color: C.textFaint }}>Top artists by streams</div>
          {topArtistsByStreams.length === 0 ? (
            <div className="p-4 text-sm" style={{ color: C.textDim }}>No stream data yet.</div>
          ) : (
            <table className="w-full">
              <tbody>
                {topArtistsByStreams.map(({ artist, value }, i) => (
                  <tr key={artist.id}>
                    <Td mono>{i + 1}</Td>
                    <Td>{artist.name}</Td>
                    <Td align="right" mono>{formatNumber(value)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {canViewRoyalties && <div className="imss-grid-2 gap-4 mb-6">
        <div className="rounded border" style={{ background: C.panel, borderColor: C.border }}>
          <div className="text-xs px-3 pt-4 pb-2" style={{ color: C.textFaint }}>Top songs by revenue</div>
          {topSongs.length === 0 ? (
            <div className="p-4 text-sm" style={{ color: C.textDim }}>No revenue recorded yet.</div>
          ) : (
            <table className="w-full">
              <thead><tr><Th>Song</Th><Th>Type</Th><Th align="right">Amount</Th></tr></thead>
              <tbody>
                {topSongs.map(r => (
                  <tr key={r.id}>
                    <Td>{r.title}<div className="text-xs" style={{ color: C.textFaint }}>{r.artist}</div></Td>
                    <Td>{r.type}</Td>
                    <Td align="right" mono>{formatCurrency(r.value)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="rounded border p-4" style={{ background: C.panel, borderColor: C.border }}>
          <div className="text-xs mb-3" style={{ color: C.textFaint }}>Label finance snapshot</div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm"><span style={{ color: C.textDim }}>Money received (all-time)</span><span style={{ fontFamily: MONO_FONT }}>{formatCurrency(finance.totalGross)}</span></div>
            <div className="flex items-center justify-between text-sm"><span style={{ color: C.textDim }}>Inbound Banking Charges (all-time)</span><span style={{ fontFamily: MONO_FONT }}>{formatCurrency(finance.totalSwift)}</span></div>
            <div className="flex items-center justify-between text-sm"><span style={{ color: C.textDim }}>Artist share</span><span style={{ fontFamily: MONO_FONT }}>{formatCurrency(finance.artistEarn)}</span></div>
            <div className="flex items-center justify-between text-sm"><span style={{ color: C.textDim }}>Label share</span><span style={{ fontFamily: MONO_FONT, color: C.teal }}>{formatCurrency(finance.labelEarn)}</span></div>
            {Math.abs(finance.untrackedGap) > 0.01 && (
              <div className="flex items-center justify-between text-sm mt-1 pt-2" style={{ borderTop: '1px solid ' + C.borderLight, color: C.amber }}><span>Untracked gap</span><span style={{ fontFamily: MONO_FONT }}>{formatCurrency(finance.untrackedGap)}</span></div>
            )}
          </div>
        </div>
      </div>}

      {canViewRoyalties && <div className="imss-grid-2 gap-4 mb-6">
        <div className="rounded border" style={{ background: C.panel, borderColor: C.border }}>
          <div className="text-xs px-4 pt-4 pb-2" style={{ color: C.textFaint }}>Top genres by revenue</div>
          {topGenres.length === 0 ? (
            <div className="p-4 text-sm" style={{ color: C.textDim }}>No revenue recorded yet.</div>
          ) : (
            <table className="w-full">
              <tbody>
                {topGenres.map((g, i) => (
                  <tr key={g.genre}>
                    <Td mono>{i + 1}</Td>
                    <Td>{g.genre}</Td>
                    <Td align="right" mono>{formatCurrency(g.value)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="rounded border" style={{ background: C.panel, borderColor: C.border }}>
          <div className="text-xs px-4 pt-4 pb-2" style={{ color: C.textFaint }}>Top markets by revenue</div>
          {topMarkets.length === 0 ? (
            <div className="p-4 text-sm" style={{ color: C.textDim }}>No revenue recorded yet.</div>
          ) : (
            <table className="w-full">
              <tbody>
                {topMarkets.map((m, i) => (
                  <tr key={m.market}>
                    <Td mono>{i + 1}</Td>
                    <Td><Globe size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6, color: C.textFaint }} />{m.market}</Td>
                    <Td align="right" mono>{formatCurrency(m.value)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>}

    </div>
  );
}

function ArtistDetailPanel({ invoices = [], dealSection = null, statementFiles = [], artist, roster, catalog, revenue, streams, masterGross = [], payouts, ledger = [], tasks = [], labelSettings, staff, onBack, onEdit, canEdit, canViewRoyalties = true, canViewSpend = true, update, sessionName = '', isAdmin = false, profileRequests = [], updateProfileRequests }) {
  const artistCatalog = useMemo(() => catalog.filter(c => c.artistId === artist.id).sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || '')), [catalog, artist.id]);
  const releaseIds = useMemo(() => new Set(artistCatalog.map(c => c.id)), [artistCatalog]);
  const aSlug = useMemo(() => slug(artist.name), [artist.name]);

  const myRevenue = useMemo(() => revenue.filter(r => r.artistSlug === aSlug), [revenue, aSlug]);
  const myStreams = useMemo(() => streams.filter(s => releaseIds.has(s.releaseId)), [streams, releaseIds]);

  const lifetime = useMemo(() => artistLifetime(artist, revenue, masterGross), [artist, revenue, masterGross]);
  const recoupment = useMemo(() => recoupmentForArtist(artist, ledger, revenue, masterGross, invoices), [artist, ledger, revenue, masterGross, invoices]);
  const totalRevenue = myRevenue.reduce((s, r) => s + r.earning, 0);
  const totalStreams = myStreams.reduce((s, r) => s + r.count, 0);

  const remainingRecoupable = recoupment.unrecouped;
  const netAfterRecoupment = recoupment.dueOnTop;
  const paid = payouts.filter(p => p.artistSlug === aSlug && p.status === 'paid').reduce((s, p) => s + (p.artistShare || 0), 0);
  const balance = netAfterRecoupment - paid;
  const myExpenses = [...ledger.filter(x => x.artist === artist.name && x.type === 'expense')].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const isFunded = artist.fundingTier === 'Funded';
  // Budget used: label spend on the artist plus their approved claims.
  const totalSpent = artistSpend(artist, ledger, invoices).budgetUsed;
  const budgetRemaining = (artist.annualBudget || 0) - totalSpent;
  const budgetPct = artist.annualBudget > 0 ? Math.min(100, Math.round((totalSpent / artist.annualBudget) * 100)) : 0;
  const myPayouts = [...payouts.filter(p => p.artistSlug === aSlug)].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const monthlyRevenue = useMemo(() => {
    const map = {};
    myRevenue.forEach(r => { map[r.month] = (map[r.month] || 0) + r.earning; });
    return Object.keys(map).sort().map(k => ({ month: monthLabel(k), value: map[k] }));
  }, [myRevenue]);

  const platformTotals = useMemo(() => {
    const map = {};
    myStreams.forEach(s => { map[s.platform] = (map[s.platform] || 0) + s.count; });
    return Object.keys(map).map(k => ({ name: k, value: map[k] }));
  }, [myStreams]);

  const contractStat = artist.contractExpiration ? expirationStatus(artist.contractExpiration) : null;
  const alerts = [];
  if (contractStat && contractStat.label !== 'Active') alerts.push({ tone: contractStat.tone, text: 'Contract ' + contractStat.label.toLowerCase() + (artist.contractExpiration ? ' (' + formatDate(artist.contractExpiration) + ')' : '') });
  artistCatalog.forEach(c => {
    if (!c.licenseExpiration) return;
    const st = c.license;
    if (st.label !== 'Active') alerts.push({ tone: st.tone, text: c.title + ' license ' + st.label.toLowerCase() });
  });
  if (canViewRoyalties && remainingRecoupable > 0) alerts.push({ tone: 'amber', text: formatCurrency(remainingRecoupable) + ' still unrecouped against future earnings' });

  const pmStaff = staff.find(s => s.name === artist.productManager);
  const myTasks = [...tasks.filter(t => t.artistId === artist.id && t.status === 'Open')].sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  const [newComment, setNewComment] = useState('');
  const comments = artist.comments || [];
  const canApproveProfile = isAdmin || sessionName === artist.productManager;
  const myPendingProfileRequests = profileRequests.filter(r => r.artistId === artist.id && r.status === 'Pending');
  function approveProfileRequest(req) {
    if (update) update(roster.map(a => a.id === artist.id ? { ...a, ...req.changes } : a));
    if (updateProfileRequests) updateProfileRequests(profileRequests.map(r => r.id === req.id ? { ...r, status: 'Approved', reviewedBy: sessionName, reviewedAt: new Date().toISOString() } : r));
  }
  function rejectProfileRequest(req) {
    if (updateProfileRequests) updateProfileRequests(profileRequests.map(r => r.id === req.id ? { ...r, status: 'Rejected', reviewedBy: sessionName, reviewedAt: new Date().toISOString() } : r));
  }
  function addComment() {
    if (!newComment.trim() || !update) return;
    const comment = { id: uid(), author: sessionName || 'Unknown', text: newComment.trim(), createdAt: new Date().toISOString() };
    update(roster.map(a => a.id === artist.id ? { ...a, comments: [...(a.comments || []), comment] } : a));
    setNewComment('');
  }
  function removeComment(id) {
    if (!update) return;
    update(roster.map(a => a.id === artist.id ? { ...a, comments: (a.comments || []).filter(c => c.id !== id) } : a));
  }
  const anrStaff = staff.find(s => s.name === artist.anr);

  return (
    <div>
      <button onClick={onBack} className="text-sm inline-flex items-center gap-1.5 mb-4" style={{ color: C.textDim }}><ChevronLeft size={14} /> Back to roster</button>

      <div className="rounded border p-4 mb-6 flex items-start gap-4 flex-wrap justify-between" style={{ background: C.panel, borderColor: C.border }}>
        <div className="flex items-center gap-4 flex-wrap">
          <Avatar name={artist.name} photoUrl={artist.photoUrl} size={72} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 20 }}>{artist.name}</div>
            <div className="text-sm mt-1" style={{ color: C.textFaint }}>{artist.genre || 'No genre set'}{artist.subGenre ? ' · ' + artist.subGenre : ''}</div>
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              <Badge tone={artistStatusTone(artist.status)}>{artist.status}</Badge>
              <Badge>{artist.royaltyRate}% royalty</Badge>
              {isFunded && <Badge tone="teal">Funded</Badge>}
              {artist.primaryMarket && <Badge tone="teal"><Globe size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />{artist.primaryMarket}</Badge>}
              {artist.secondaryMarket && <Badge>+ {artist.secondaryMarket}</Badge>}
            </div>
          </div>
        </div>
        {canEdit && <Btn variant="primary" onClick={() => onEdit(artist)}><Pencil size={14} /> Edit profile</Btn>}
      </div>

      {alerts.length > 0 && (
        <div className="rounded border p-4 mb-6" style={{ background: C.amberSoft, borderColor: C.amber }}>
          <div className="text-xs mb-2" style={{ color: C.amber, fontWeight: 600 }}>Needs attention</div>
          <div className="flex flex-col gap-1.5">
            {alerts.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-sm" style={{ color: C.text }}>
                <span style={{ width: 6, height: 6, borderRadius: 9999, background: a.tone === 'red' ? C.red : C.amber, flexShrink: 0 }}></span>
                {a.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {canApproveProfile && myPendingProfileRequests.length > 0 && (
        <div className="rounded border p-4 mb-6" style={{ background: C.amberSoft, borderColor: C.amber }}>
          <div className="text-xs mb-3" style={{ color: C.amber, fontWeight: 600 }}>{artist.name} requested profile changes</div>
          <div className="flex flex-col gap-3">
            {myPendingProfileRequests.map(req => (
              <div key={req.id} className="rounded p-3" style={{ background: C.panel, border: '1px solid ' + C.border }}>
                <div className="flex flex-col gap-1.5 mb-3">
                  {Object.entries(req.changes).map(([key, value]) => {
                    const field = PROFILE_EDITABLE_FIELDS.find(f => f.key === key);
                    const current = artist[key] || '';
                    return (
                      <div key={key} className="text-sm">
                        <span style={{ fontWeight: 600 }}>{field ? field.label : key}:</span>{' '}
                        {key === 'photoUrl' ? (
                          <span className="inline-flex items-center gap-2 align-middle">
                            <Avatar name={artist.name} photoUrl={current} size={24} /> <ChevronRight size={12} /> <Avatar name={artist.name} photoUrl={value} size={24} />
                          </span>
                        ) : (
                          <span style={{ color: C.textDim }}>"{current || '—'}" <ChevronRight size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> "{value}"</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <Btn variant="primary" onClick={() => approveProfileRequest(req)}>Approve</Btn>
                  <Btn variant="ghost" onClick={() => rejectProfileRequest(req)}>Reject</Btn>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-6">
        {canViewRoyalties && <KPICard icon={DollarSign} label="Total revenue" value={formatCurrency(totalRevenue)} tone="teal" />}
        <KPICard icon={Radio} label="Total streams" value={formatNumber(totalStreams)} />
        <KPICard icon={Disc3} label="Releases" value={artistCatalog.length} />
        {canViewRoyalties && <KPICard icon={Wallet} label="Balance owed" value={formatCurrency(Math.max(0, balance))} tone={balance > 0 ? 'amber' : undefined} />}
      </div>

      <div className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
        <div className="text-xs mb-3" style={{ color: C.textFaint }}>Contacts &amp; dates</div>
        <div className="imss-grid-2 gap-3 text-sm">
          <div>
            <div style={{ color: C.textFaint }} className="text-xs mb-0.5">Product Manager</div>
            <div>{artist.productManager || '—'}{pmStaff && pmStaff.email ? ' · ' + pmStaff.email : ''}</div>
          </div>
          <div>
            <div style={{ color: C.textFaint }} className="text-xs mb-0.5">A&amp;R</div>
            <div>{artist.anr || '—'}{anrStaff && anrStaff.email ? ' · ' + anrStaff.email : ''}</div>
          </div>
          <div>
            <div style={{ color: C.textFaint }} className="text-xs mb-0.5">Signed</div>
            <div>{artist.signedDate ? formatDate(artist.signedDate) : '—'}</div>
          </div>
          <div>
            <div style={{ color: C.textFaint }} className="text-xs mb-0.5">Contract expiration</div>
            <div className="flex items-center gap-2">
              {artist.contractExpiration ? formatDate(artist.contractExpiration) : '—'}
              {contractStat && contractStat.label !== 'Active' && <Badge tone={contractStat.tone}>{contractStat.label}</Badge>}
            </div>
          </div>
          <div>
            <div style={{ color: C.textFaint }} className="text-xs mb-0.5">Email</div>
            <div>{artist.email || '—'}</div>
          </div>
        </div>
        {artist.notes && (
          <div className="mt-3 pt-3 text-sm" style={{ borderTop: '1px solid ' + C.border, color: C.textDim }}>{artist.notes}</div>
        )}
      </div>

      {myTasks.length > 0 && (
        <div className="rounded border mb-6" style={{ background: C.panel, borderColor: C.border }}>
          <div className="text-xs px-4 pt-4 pb-2" style={{ color: C.textFaint }}>Active work</div>
          <table className="w-full">
            <tbody>
              {myTasks.map(t => {
                const overdue = t.dueDate && t.dueDate < todayStr();
                const release = t.releaseId ? catalog.find(c => c.id === t.releaseId) : null;
                return (
                  <tr key={t.id}>
                    <Td>{t.title}{release && <div className="text-xs" style={{ color: C.textFaint }}>{release.title}</div>}</Td>
                    <Td>{t.assignee}</Td>
                    <Td align="right" mono style={{ color: overdue ? C.red : undefined }}>{t.dueDate ? formatDate(t.dueDate) : '—'}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
        <div className="text-xs mb-3" style={{ color: C.textFaint }}>Team notes ({comments.length})</div>
        {comments.length === 0 ? (
          <div className="text-sm mb-3" style={{ color: C.textDim }}>No notes yet — leave context here for whoever picks this up next.</div>
        ) : (
          <div className="flex flex-col gap-3 mb-3" style={{ maxHeight: 280, overflowY: 'auto' }}>
            {comments.map(c => (
              <div key={c.id} className="rounded p-3" style={{ background: C.bg, border: '1px solid ' + C.border }}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs" style={{ fontWeight: 600, color: C.textDim }}>{c.author}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: C.textFaint }}>{new Date(c.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                    {canEdit && <button onClick={() => removeComment(c.id)} style={{ color: C.textFaint }}><Trash2 size={11} /></button>}
                  </span>
                </div>
                <div className="text-sm" style={{ color: C.text }}>{c.text}</div>
              </div>
            ))}
          </div>
        )}
        {canEdit && (
          <div className="flex gap-2">
            <TextArea rows={2} value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Leave a note for the team — status updates, context, anything worth remembering." />
            <Btn variant="primary" onClick={addComment}>Post</Btn>
          </div>
        )}
      </div>

      <div className="imss-grid-2 gap-4 mb-6">
        {canViewRoyalties && (
          <div className="rounded p-4 border" style={{ background: C.panel, borderColor: C.border }}>
            <div className="text-xs mb-3" style={{ color: C.textFaint }}>Revenue by month</div>
            <div style={{ height: 200 }}>
              {monthlyRevenue.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm" style={{ color: C.textFaint }}>No revenue yet</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: C.textFaint, fontSize: 11 }} axisLine={{ stroke: C.border }} tickLine={false} />
                    <YAxis tick={{ fill: C.textFaint, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? '$' + Math.round(v / 1000) + 'k' : '$' + Math.round(v)} />
                    <Tooltip contentStyle={{ background: C.panel2, border: '1px solid ' + C.border, borderRadius: 12, fontSize: 13, color: C.text }} labelStyle={{ color: C.text }} formatter={(v) => formatCurrency(v)} />
                    <Bar dataKey="value" fill={C.amber} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}
        <div className="rounded p-4 border" style={{ background: C.panel, borderColor: C.border }}>
          <div className="text-xs mb-3" style={{ color: C.textFaint }}>Streams by platform</div>
          <div style={{ height: 200 }}>
            {platformTotals.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm" style={{ color: C.textFaint }}>No stream data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={platformTotals} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
                    {platformTotals.map((p) => (<Cell key={p.name} fill={PLATFORM_COLORS[p.name] || C.textFaint} />))}
                  </Pie>
                  <Tooltip contentStyle={{ background: C.panel2, border: '1px solid ' + C.border, borderRadius: 12, fontSize: 13, color: C.text }} formatter={(v) => formatNumber(v)} />
                  <Legend wrapperStyle={{ fontSize: 11, color: C.textDim }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="rounded border mb-6" style={{ background: C.panel, borderColor: C.border }}>
        <div className="text-xs px-4 pt-4 pb-2" style={{ color: C.textFaint }}>Releases</div>
        {artistCatalog.length === 0 ? (
          <div className="p-4 text-sm" style={{ color: C.textDim }}>No releases yet.</div>
        ) : (
          <table className="w-full">
            <thead><tr><Th></Th><Th>Title</Th><Th>Type</Th><Th>Release date</Th><Th>Status</Th><Th>License</Th></tr></thead>
            <tbody>
              {artistCatalog.map(c => {
                const lic = c.licenseExpiration ? c.license : null;
                return (
                  <tr key={c.id}>
                    <Td><ArtworkThumb release={c} size={32} /></Td>
                    <Td>{c.title}</Td>
                    <Td>{c.type}</Td>
                    <Td mono>{formatDate(c.releaseDate)}</Td>
                    <Td><Badge tone={releaseStatusTone(c.status)}>{c.status}</Badge></Td>
                    <Td>{lic ? <Badge tone={lic.tone}>{lic.label}</Badge> : '—'}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {canViewSpend && isFunded && (
        <div className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs" style={{ color: C.textFaint }}>Annual budget</div>
            <div className="text-xs" style={{ color: C.textFaint }}>{formatCurrency(totalSpent)} of {formatCurrency(artist.annualBudget || 0)} spent</div>
          </div>
          <div className="rounded-full overflow-hidden" style={{ height: 8, background: C.panel2 }}>
            <div style={{ height: 8, width: budgetPct + '%', background: budgetRemaining < 0 ? C.red : C.amber }} />
          </div>
          <div className="flex flex-wrap gap-3 mt-4">
            <KPICard icon={DollarSign} label="Budget allocated" value={formatCurrency(artist.annualBudget || 0)} />
            <KPICard icon={DollarSign} label="Spent" value={formatCurrency(totalSpent)} tone="amber" />
            <KPICard icon={Wallet} label="Remaining" value={formatCurrency(budgetRemaining)} tone={budgetRemaining < 0 ? 'red' : 'teal'} />
          </div>
        </div>
      )}

      {(canViewSpend || canViewRoyalties) && (
        <div className="imss-grid-2 gap-4">
          {canViewSpend && (
          <div className="rounded border" style={{ background: C.panel, borderColor: C.border }}>
            <div className="text-xs px-4 pt-4 pb-2" style={{ color: C.textFaint }}>Recent expenses</div>
            {myExpenses.length === 0 ? (
              <div className="p-4 text-sm" style={{ color: C.textDim }}>No expenses logged.</div>
            ) : (
              <table className="w-full">
                <tbody>
                  {myExpenses.slice(0, 6).map(x => (
                    <tr key={x.id}>
                      <Td mono>{formatDate(x.date)}</Td>
                      <Td>{x.category}</Td>
                      <Td align="right" mono>{formatCurrency(x.amount)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          )}
          {dealSection && <div className="rounded p-5 mb-4" style={{ background: C.panel }}>{dealSection}</div>}
          {canViewRoyalties && <div className="mb-4"><StatementFilesList files={statementFiles.filter(f => f.artistId === artist.id)} rows={myRevenue} splitOf={r => revenueRowSplit(r, revenue, masterGross, pctAt(artist, r.month))} artistName={artist.name} empty="No statement files yet. Import an EMPIRE detailed report and it’s kept here." /></div>}
          {canViewRoyalties && (
          <div className="rounded border" style={{ background: C.panel, borderColor: C.border }}>
            <div className="text-xs px-4 pt-4 pb-2" style={{ color: C.textFaint }}>Payout history</div>
            {myPayouts.length === 0 ? (
              <div className="p-4 text-sm" style={{ color: C.textDim }}>No payouts recorded.</div>
            ) : (
              <table className="w-full">
                <tbody>
                  {myPayouts.slice(0, 6).map(p => (
                    <tr key={p.id}>
                      <Td mono>{p.periodStart} – {p.periodEnd}</Td>
                      <Td><Badge tone={p.status === 'paid' ? 'teal' : undefined}>{p.status}</Badge></Td>
                      <Td align="right" mono>{formatCurrency(p.artistShare)}</Td>
                    </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
          )}
      </div>
      )}
    </div>
  );
}

// Admin-only: emails someone a fresh sign-in link (same email they'd get from the sign-in page).
function SendLinkButton({ email, labeled = false }) {
  const [state, setState] = useState('idle');
  if (!supabase || !email) return null;
  async function send() {
    setState('sending');
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    setState(error ? 'error' : 'sent');
    setTimeout(() => setState('idle'), 4000);
  }
  const label = state === 'sent' ? 'Sign-in link sent to ' + email : state === 'error' ? 'Could not send. Try again shortly.' : 'Email ' + email + ' a sign-in link';
  // In edit forms: a full button naming the saved address the link goes to.
  if (labeled) {
    return (
      <span className="inline-flex items-center gap-2">
        <Btn variant="ghost" onClick={send} disabled={state === 'sending'}><Mail size={14} /> {state === 'sending' ? 'Sending…' : 'Send sign-in link'}</Btn>
        <span className="text-xs" role="status" style={{ color: state === 'sent' ? C.teal : state === 'error' ? C.red : C.textFaint }}>
          {state === 'idle' || state === 'sending' ? 'to ' + email : label}
        </span>
      </span>
    );
  }
  return (
    <button onClick={send} disabled={state === 'sending'} title={label} aria-label={label}
      style={{ color: state === 'sent' ? C.teal : state === 'error' ? C.red : C.textDim }}>
      {state === 'sent' ? <CheckCircle2 size={14} /> : <Mail size={14} />}
    </button>
  );
}

function RosterSection({ invoices = [], dealChanges = [], updateDealChanges, session = {}, publishedRevenue = [], statementFiles = [], roster, update, catalog, staff, canEdit = true, pmScope = null, revenue = [], streams = [], masterGross = [], payouts = [], ledger = [], labelSettings, canViewRoyalties = true, canViewSpend = true, tasks = [], sessionName = '', isAdmin = false, profileRequests = [], updateProfileRequests }) {
  const [detailId, setDetailId] = useState(null);
  const empty = { name: '', genre: '', subGenre: '', royaltyRate: 50, signedDate: todayStr(), contractExpiration: '', email: '', status: 'Active', notes: '', photoUrl: '', productManager: pmScope || '', anr: '', primaryMarket: '', secondaryMarket: '', fundingTier: 'Non-Funded', annualBudget: '', driveFolder: '', reportingPeriod: 'quarterly', deliveryDays: '', payoutThreshold: '', licenseYears: 5, recoupedOn: '' };
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterGenre, setFilterGenre] = useState('all');
  const [filterMarket, setFilterMarket] = useState('all');
  const [view, setView] = useState('grid');
  const [confirmId, setConfirmId] = useState(null);
  const [form, setForm] = useState(empty);
  const photoInputRef = useRef(null);

  function openAdd() { setForm({ ...empty, productManager: pmScope || '' }); setEditing(null); setShowForm(true); }
  function openEdit(a) { setForm({ ...empty, ...a }); setEditing(a.id); setShowForm(true); setFormError(''); }
  const [formError, setFormError] = useState('');
  function closeForm() { setShowForm(false); setEditing(null); if (photoInputRef.current) photoInputRef.current.value = ''; }

  function save(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    let payload = { ...form, royaltyRate: Number(form.royaltyRate), artistPct: Number(form.royaltyRate) / 100, payoutThreshold: Number(form.payoutThreshold) || 0, deliveryDays: Number(form.deliveryDays) || '', annualBudget: form.fundingTier === 'Funded' ? (Number(form.annualBudget) || 0) : 0 };
    // The split and deal change only through Deal changes, dated and approved.
    if (editing) { const o = roster.find(a => a.id === editing); payload = { ...payload, artistPct: o.artistPct, royaltyRate: o.royaltyRate, fundingTier: o.fundingTier, dealType: o.dealType, dealTerms: o.dealTerms }; }
    setFormError('');
    if (editing) update(roster.map(a => a.id === editing ? { ...payload, id: editing } : a));
    else update([...roster, { ...payload, id: uid() }]);
    closeForm();
  }
  function remove(id) { update(roster.filter(a => a.id !== id)); setConfirmId(null); }
  function handlePhotoUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    resizeImageFile(file, 300, dataUrl => setForm(f => ({ ...f, photoUrl: dataUrl })));
  }

  const visibleRoster = pmScope ? roster.filter(a => a.productManager === pmScope) : roster;
  const genres = Array.from(new Set(visibleRoster.map(a => a.genre).filter(Boolean))).sort();
  const marketsInUse = Array.from(new Set(visibleRoster.flatMap(a => [a.primaryMarket, a.secondaryMarket]).filter(Boolean))).sort();

  const filtered = visibleRoster.filter(a => {
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    if (filterGenre !== 'all' && a.genre !== filterGenre) return false;
    if (filterMarket !== 'all' && a.primaryMarket !== filterMarket && a.secondaryMarket !== filterMarket) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    if (a.name.toLowerCase().includes(q)) return true;
    if (a.genre && a.genre.toLowerCase().includes(q)) return true;
    return catalog.some(c => c.artistId === a.id && (
      c.title.toLowerCase().includes(q) ||
      (c.upc && c.upc.toLowerCase().includes(q))
    ));
  });
  const filtersActive = filterStatus !== 'all' || filterGenre !== 'all' || filterMarket !== 'all' || !!query;

  return (
    <div>
      {pmScope && (
        <div className="rounded px-3 py-2 text-xs mb-4" style={{ background: C.amberSoft, color: C.amber, border: '1px solid ' + C.amber }}>
          Showing only artists assigned to you as Product Manager ({visibleRoster.length} of {roster.length} total).
        </div>
      )}
      <SectionHeader title="Roster" description="Everyone signed to the label, their royalty terms, and status." action={canEdit && <Btn variant="primary" onClick={openAdd}><Plus size={14} /> Add artist</Btn>} />

      {detailId && roster.find(a => a.id === detailId) ? (
        <ArtistDetailPanel
          invoices={invoices}
          dealSection={(session.role === 'Admin' || session.role === 'Legal' || canViewRoyalties) && <DealChanges roster={roster} updateRoster={update} changes={dealChanges} updateChanges={updateDealChanges} publishedRevenue={publishedRevenue} session={session} artistId={detailId} canEdit={canEdit} />}
          statementFiles={statementFiles}
          artist={roster.find(a => a.id === detailId)}
          roster={roster} catalog={catalog} revenue={revenue} streams={streams} masterGross={masterGross}
          payouts={payouts} ledger={ledger} labelSettings={labelSettings} staff={staff}
          tasks={tasks}
          onBack={() => setDetailId(null)}
          onEdit={(a) => { setDetailId(null); openEdit(a); }}
          canEdit={canEdit}
          canViewRoyalties={canViewRoyalties}
          canViewSpend={canViewSpend}
          update={update}
          sessionName={sessionName}
          isAdmin={isAdmin}
          profileRequests={profileRequests}
          updateProfileRequests={updateProfileRequests}
        />
      ) : (
        <>


      <div className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
        <div className="imss-form-grid gap-3">
          <Field label="Status">
            <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All statuses</option>
              {ARTIST_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Genre">
            <Select value={filterGenre} onChange={e => setFilterGenre(e.target.value)}>
              <option value="all">All genres</option>
              {genres.map(g => <option key={g} value={g}>{g}</option>)}
            </Select>
          </Field>
          <Field label="Market">
            <Select value={filterMarket} onChange={e => setFilterMarket(e.target.value)}>
              <option value="all">All markets</option>
              {marketsInUse.map(m => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Search" full>
            <div className="flex items-center gap-2 rounded" style={{ background: C.panel2, border: '1px solid ' + C.border, padding: '7px 9px' }}>
              <Search size={14} color={C.textFaint} />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Name, product, or UPC" className="w-full text-sm bg-transparent" style={{ color: C.text, fontFamily: HEADING_FONT, border: 'none' }} />
            </div>
          </Field>
        </div>
        {filtersActive && <div className="text-xs mt-3" style={{ color: C.textFaint }}>Showing {filtered.length} of {visibleRoster.length} artists</div>}
      </div>

      {showForm && (
        <form onSubmit={save} className="rounded border p-4 mb-6 imss-form-grid gap-3" style={{ background: C.panel, borderColor: C.borderLight }}>
          <div className="imss-span-2 flex items-center gap-3">
            <Avatar name={form.name} photoUrl={form.photoUrl} size={64} />
            <div className="flex flex-col gap-1">
              <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="text-xs" style={{ color: C.textDim, maxWidth: 220 }} />
              {form.photoUrl && <button type="button" onClick={() => setForm({ ...form, photoUrl: '' })} className="text-xs text-left" style={{ color: C.textFaint }}>Remove photo</button>}
            </div>
          </div>
          <Field label="Artist / act name"><Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Nova Reyes" /></Field>
          <Field label="Genre">
            <Select value={form.genre} onChange={e => setForm({ ...form, genre: e.target.value })}>
              <option value="">— none —</option>
              {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
            </Select>
          </Field>
          <Field label="Sub-genre">
            <Select value={form.subGenre} onChange={e => setForm({ ...form, subGenre: e.target.value })}>
              <option value="">— none —</option>
              {SUB_GENRES.map(g => <option key={g} value={g}>{g}</option>)}
            </Select>
          </Field>
          <Field label="Primary market">
            <Select value={form.primaryMarket} onChange={e => setForm({ ...form, primaryMarket: e.target.value })}>
              <option value="">— none —</option>
              {MARKETS.map(m => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Secondary market">
            <Select value={form.secondaryMarket} onChange={e => setForm({ ...form, secondaryMarket: e.target.value })}>
              <option value="">— none —</option>
              {MARKETS.filter(m => m !== form.primaryMarket).map(m => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Artist share (%)"><Input type="number" min="0" max="100" disabled={!!editing} value={form.royaltyRate} onChange={e => setForm({ ...form, royaltyRate: e.target.value })} /></Field>
          <Field label="Reporting period">
            <Select value={form.reportingPeriod || 'quarterly'} onChange={e => setForm({ ...form, reportingPeriod: e.target.value })}>
              <option value="monthly">Monthly (cutoff end of each month)</option>
              <option value="quarterly">Quarterly (cutoff 31 Mar, 30 Jun, 30 Sep, 31 Dec)</option>
              <option value="half-yearly">Half-yearly (cutoff 30 Jun, 31 Dec)</option>
            </Select>
          </Field>
          <Field label={'Statement due (days after cutoff, default ' + DEFAULT_DELIVERY_DAYS[form.reportingPeriod || 'quarterly'] + ')'}><Input type="number" min="1" value={form.deliveryDays} onChange={e => setForm({ ...form, deliveryDays: e.target.value })} placeholder={String(DEFAULT_DELIVERY_DAYS[form.reportingPeriod || 'quarterly'])} /></Field>
          <Field label="License period (from each song's release date)">
            <Select value={String(form.licenseYears || 5)} onChange={e => setForm({ ...form, licenseYears: Number(e.target.value) })}>
              {LICENSE_YEARS.map(y => <option key={y} value={y}>{y} {y === 1 ? 'year' : 'years'}</option>)}
            </Select>
          </Field>
          <Field label="Account marked recouped on (licenses past their period end then)"><Input type="date" value={form.recoupedOn || ''} onChange={e => setForm({ ...form, recoupedOn: e.target.value })} /></Field>
          <Field label="Payout threshold (USD, on the artist’s share after label % and charges)"><Input type="number" min="0" step="0.01" value={form.payoutThreshold} onChange={e => setForm({ ...form, payoutThreshold: e.target.value })} placeholder="0 = pay any amount" /></Field>
          <Field label="Funding tier">
            <Select disabled={!!editing} value={form.fundingTier} onChange={e => setForm({ ...form, fundingTier: e.target.value, dealType: (DEAL_TYPES[e.target.value] || [])[0] || '' })}>
              {FUNDING_TIERS.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Deal">
            <Select disabled={!!editing} value={form.dealType || ''} onChange={e => setForm({ ...form, dealType: e.target.value })}>
              <option value="">Not set</option>
              {(DEAL_TYPES[form.fundingTier || 'Non-Funded'] || []).map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          {editing && <div className="imss-span-2" style={{ color: C.textDim, fontSize: 14 }}>Split, funding and deal change through <b style={{ color: C.text }}>Record a deal change</b> on the artist’s profile, from the month the new deal starts.</div>}
          {form.fundingTier === 'Funded' && (
            <Field label="Annual budget"><Input type="number" min="0" step="0.01" value={form.annualBudget} onChange={e => setForm({ ...form, annualBudget: e.target.value })} placeholder="Total allocated for this artist" /></Field>
          )}
          <Field label="Signed date"><Input type="date" value={form.signedDate} onChange={e => setForm({ ...form, signedDate: e.target.value })} /></Field>
          <Field label="Contract expiration"><Input type="date" value={form.contractExpiration} onChange={e => setForm({ ...form, contractExpiration: e.target.value })} /></Field>
          <Field label="Email (also their portal sign-in)"><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Dropbox / Drive folder" full><Input type="url" value={form.driveFolder} onChange={e => setForm({ ...form, driveFolder: e.target.value })} placeholder="https://drive.google.com/... or Dropbox link" /></Field>
          <Field label="Product Manager">
            <Select value={form.productManager} onChange={e => setForm({ ...form, productManager: e.target.value })}>
              <option value="">— unassigned —</option>
              {staff.filter(s => s.role === 'Product Manager').map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="A&amp;R">
            <Select value={form.anr} onChange={e => setForm({ ...form, anr: e.target.value })}>
              <option value="">— unassigned —</option>
              {staff.filter(s => s.role === 'A&R').map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              {ARTIST_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Notes" full><TextArea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field>
          {formError && <div className="imss-span-2" role="alert" style={{ color: C.red, fontSize: 14 }}>{formError}</div>}
          <div className="imss-span-2 flex gap-2 mt-1">
            <Btn variant="primary" type="submit">{editing ? 'Save changes' : 'Add artist'}</Btn>
            <Btn variant="ghost" onClick={closeForm}>Cancel</Btn>
            {isAdmin && editing && <SendLinkButton labeled email={(roster.find(x => x.id === editing) || {}).email} />}
          </div>
        </form>
      )}

      <ExportBar filename="imss-roster" headers={['Name', 'Genre', 'Sub-genre', 'Status', 'Royalty %', 'Funding Tier', 'Primary Market', 'Secondary Market', 'Product Manager', 'A&R', 'Signed Date', 'Contract Expiration', 'Email']} rows={filtered.map(a => [
        a.name,
        a.genre || '',
        a.subGenre || '',
        a.status,
        a.royaltyRate,
        dealLabel(a),
        a.primaryMarket || '',
        a.secondaryMarket || '',
        a.productManager || '',
        a.anr || '',
        a.signedDate || '',
        a.contractExpiration || '',
        a.email || '',
      ])} />

      <div className="flex justify-end gap-1 mb-4">
        <SegmentedToggle options={[{ id: 'grid', label: 'Grid' }, { id: 'table', label: 'Table' }]} value={view} onChange={setView} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title={filtersActive ? 'No matching artists' : 'No artists yet'} description={filtersActive ? 'Try a different filter or search term.' : 'Add your first signing to start tracking releases and royalties.'} />
      ) : view === 'grid' ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {filtered.map(a => {
            const releaseCount = catalog.filter(c => c.artistId === a.id).length;
            return (
              <button key={a.id} onClick={() => setDetailId(a.id)} className="text-left rounded border p-4" style={{ background: C.panel, borderColor: C.border, cursor: 'pointer' }}>
                <div className="flex items-center gap-3 mb-3">
                  <Avatar name={a.name} photoUrl={a.photoUrl} size={48} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                    <div className="text-xs" style={{ color: C.textFaint }}>{a.genre || 'No genre set'}{a.subGenre ? ' · ' + a.subGenre : ''}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  <Badge tone={artistStatusTone(a.status)}>{a.status}</Badge>
                  <Badge>{a.royaltyRate}% royalty</Badge>
                  <Badge tone={a.fundingTier === 'Funded' ? 'teal' : 'default'}>{dealLabel(a)}</Badge>
                  {a.contractExpiration && expirationStatus(a.contractExpiration).label !== 'Active' && (
                    <Badge tone={expirationStatus(a.contractExpiration).tone}>{expirationStatus(a.contractExpiration).label}</Badge>
                  )}
                </div>
                {(a.primaryMarket || a.secondaryMarket) && (
                  <div className="flex items-center gap-1.5 flex-wrap mb-2">
                    {a.primaryMarket && <Badge tone="teal"><Globe size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />{a.primaryMarket}</Badge>}
                    {a.secondaryMarket && <Badge>+ {a.secondaryMarket}</Badge>}
                  </div>
                )}
                {(a.productManager || a.anr) && (
                  <div className="text-xs mb-2" style={{ color: C.textFaint, lineHeight: 1.5 }}>
                    {a.productManager && <div>PM: {a.productManager}</div>}
                    {a.anr && <div>A&amp;R: {a.anr}</div>}
                  </div>
                )}
                <div className="text-xs" style={{ color: C.textFaint }}>
                  {releaseCount} release{releaseCount === 1 ? '' : 's'} · Signed {formatDate(a.signedDate)}
                  {a.contractExpiration && <div>Contract expires {formatDate(a.contractExpiration)}</div>}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
          <table className="w-full" style={{ minWidth: 680 }}>
            <thead><tr>
              <Th></Th><Th>Artist</Th><Th>Genre</Th><Th>Market</Th><Th>Team</Th><Th align="right">Royalty</Th><Th>Signed</Th><Th>Contract</Th><Th align="right">Releases</Th><Th>Status</Th><Th>Funding</Th><Th align="right">Actions</Th>
            </tr></thead>
            <tbody>
              {filtered.map(a => {
                const releaseCount = catalog.filter(c => c.artistId === a.id).length;
                return (
                  <tr key={a.id}>
                    <Td><Avatar name={a.name} photoUrl={a.photoUrl} size={32} /></Td>
                    <Td><button onClick={() => setDetailId(a.id)} style={{ color: C.text, fontWeight: 500, textAlign: 'left' }}>{a.name}</button></Td>
                    <Td>{a.genre || '—'}{a.subGenre && <div className="text-xs" style={{ color: C.textFaint }}>{a.subGenre}</div>}</Td>
                    <Td>{a.primaryMarket || '—'}{a.secondaryMarket && <div className="text-xs" style={{ color: C.textFaint }}>+ {a.secondaryMarket}</div>}</Td>
                    <Td>
                      {!a.productManager && !a.anr ? '—' : (
                        <div style={{ lineHeight: 1.5, fontSize: 12 }}>
                          {a.productManager && <div>PM: {a.productManager}</div>}
                          {a.anr && <div style={{ color: C.textFaint }}>A&amp;R: {a.anr}</div>}
                        </div>
                      )}
                    </Td>
                    <Td align="right" mono>{a.royaltyRate}%</Td>
                    <Td mono>{formatDate(a.signedDate)}</Td>
                    <Td>
                      {!a.contractExpiration ? '—' : (
                        <div style={{ lineHeight: 1.5 }}>
                          <div style={{ fontFamily: MONO_FONT, fontSize: 12 }}>{formatDate(a.contractExpiration)}</div>
                          {expirationStatus(a.contractExpiration).label !== 'Active' && <Badge tone={expirationStatus(a.contractExpiration).tone}>{expirationStatus(a.contractExpiration).label}</Badge>}
                        </div>
                      )}
                    </Td>
                    <Td align="right">{releaseCount}</Td>
                    <Td><Badge tone={artistStatusTone(a.status)}>{a.status}</Badge></Td>
                    <Td><Badge tone={a.fundingTier === 'Funded' ? 'teal' : 'default'}>{dealLabel(a)}</Badge></Td>
                    <Td align="right">
                      {confirmId === a.id ? (
                        <ConfirmInline onConfirm={() => remove(a.id)} onCancel={() => setConfirmId(null)} />
                      ) : canEdit ? (
                        <span className="inline-flex gap-3 justify-end">
                          {isAdmin && <SendLinkButton email={a.email} />}
                          <button onClick={() => openEdit(a)} style={{ color: C.textDim }}><Pencil size={14} /></button>
                          <button onClick={() => setConfirmId(a.id)} style={{ color: C.textDim }}><Trash2 size={14} /></button>
                        </span>
                      ) : <span style={{ color: C.textFaint }}>—</span>}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
        </>
      )}
    </div>
  );
}

function NoticesSection({ notices, update, roster, staff, sessionName }) {
  const empty = { title: '', message: '', audience: 'all' };
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [confirmId, setConfirmId] = useState(null);

  function openAdd() { setForm(empty); setEditing(null); setShowForm(true); }
  function openEdit(n) { setForm({ title: n.title, message: n.message, audience: n.audience }); setEditing(n.id); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); }
  function save(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) return;
    if (editing) update(notices.map(n => n.id === editing ? { ...n, ...form } : n));
    else update([{ ...form, id: uid(), createdBy: sessionName, createdAt: todayStr() }, ...notices]);
    closeForm();
  }
  function remove(id) { update(notices.filter(n => n.id !== id)); setConfirmId(null); }

  function audienceLabel(n) {
    if (n.audience === 'all') return 'All artists';
    if (n.audience === 'all-team') return 'All team members';
    const artist = roster.find(a => a.id === n.audience);
    if (artist) return artist.name + ' (artist)';
    const member = staff.find(s => s.id === n.audience);
    if (member) return member.name + ' (team)';
    return 'Unknown';
  }

  const sorted = [...notices].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  return (
    <div>
      <SectionHeader title="Noticeboard" description="Push announcements to artist dashboards or straight to the team — target everyone, or someone specific." action={<Btn variant="primary" onClick={openAdd}><Plus size={14} /> New notice</Btn>} />

      {showForm && (
        <form onSubmit={save} className="rounded border p-4 mb-6 imss-form-grid gap-3" style={{ background: C.panel, borderColor: C.borderLight }}>
          <Field label="Title" full><Input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Studio closed for the holidays" /></Field>
          <Field label="Audience" full>
            <Select value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })}>
              <optgroup label="Artists">
                <option value="all">All artists</option>
                {roster.map(a => <option key={a.id} value={a.id}>{a.name} only</option>)}
              </optgroup>
              <optgroup label="Team">
                <option value="all-team">All team members</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name} only</option>)}
              </optgroup>
            </Select>
          </Field>
          <Field label="Message" full><TextArea rows={3} required value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="What should they know?" /></Field>
          <div className="imss-span-2 flex gap-2 mt-1">
            <Btn variant="primary" type="submit">{editing ? 'Save changes' : 'Post notice'}</Btn>
            <Btn variant="ghost" onClick={closeForm}>Cancel</Btn>
          </div>
        </form>
      )}

      {sorted.length === 0 ? (
        <EmptyState icon={Bell} title="No notices posted" description="Anything you post here shows up on the 'Worth knowing' section of the right dashboard — artist or team." />
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map(n => (
            <div key={n.id} className="rounded border p-4" style={{ background: C.panel, borderColor: C.border }}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div style={{ fontWeight: 600 }}>{n.title}</div>
                  <div className="text-xs mt-0.5" style={{ color: C.textFaint }}>
                    {audienceLabel(n)}
                    {' · '}{n.createdBy}{' · '}{formatDate(n.createdAt)}
                  </div>
                </div>
                {confirmId === n.id ? <ConfirmInline onConfirm={() => remove(n.id)} onCancel={() => setConfirmId(null)} /> : (
                  <span className="inline-flex gap-3">
                    <button onClick={() => openEdit(n)} style={{ color: C.textDim }}><Pencil size={14} /></button>
                    <button onClick={() => setConfirmId(n.id)} style={{ color: C.textDim }}><Trash2 size={14} /></button>
                  </span>
                )}
              </div>
              <div className="text-sm mt-2" style={{ color: C.textDim }}>{n.message}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Access changes proposed by Legal sit here until an Admin approves them.
// Legal can propose anything — including overriding what an Admin set — but
// nothing takes effect until an Admin signs it off.
function AccessRequestsSection({ accessRequests, update, staff, updateStaff, isAdmin, sessionName }) {
  const [confirmId, setConfirmId] = useState(null);
  const pending = accessRequests.filter(r => r.status === 'Pending');
  const settled = accessRequests.filter(r => r.status !== 'Pending')
    .sort((a, b) => (b.reviewedAt || '').localeCompare(a.reviewedAt || ''));

  function approve(req) {
    const target = staff.find(s => s.id === req.staffId);
    if (target) {
      updateStaff(staff.map(s => s.id === req.staffId
        ? { ...s, role: req.proposedRole, permissions: req.proposedPermissions }
        : s));
    }
    update(accessRequests.map(r => r.id === req.id
      ? { ...r, status: target ? 'Approved' : 'Rejected',
          note: target ? '' : 'That team member no longer exists.',
          reviewedBy: sessionName, reviewedAt: new Date().toISOString() }
      : r));
  }
  function reject(req) {
    update(accessRequests.map(r => r.id === req.id
      ? { ...r, status: 'Rejected', reviewedBy: sessionName, reviewedAt: new Date().toISOString() }
      : r));
    setConfirmId(null);
  }

  function diffRows(req) {
    const rows = [];
    if (req.previousRole !== req.proposedRole) {
      rows.push({ key: 'role', label: 'Role', from: req.previousRole, to: req.proposedRole });
    }
    PERMISSION_FIELDS.forEach(f => {
      const before = !!(req.previousPermissions || {})[f.key];
      const after = !!(req.proposedPermissions || {})[f.key];
      if (before !== after) rows.push({ key: f.key, label: f.label, from: before ? 'Yes' : 'No', to: after ? 'Yes' : 'No', granted: after });
    });
    return rows;
  }

  return (
    <div>
      <SectionHeader title="Access Requests"
        description={isAdmin
          ? 'Access changes Legal has proposed. Nothing here has taken effect yet — approving is what applies it.'
          : 'Access changes you have proposed. An Admin has to approve them before they take effect.'} />

      <div className="flex flex-wrap gap-3 mb-6">
        <KPICard icon={ShieldCheck} label="Waiting on approval" value={pending.length} tone={pending.length ? 'amber' : undefined} />
        <KPICard icon={CheckCircle2} label="Approved" value={accessRequests.filter(r => r.status === 'Approved').length} tone="teal" />
        <KPICard icon={Trash2} label="Rejected" value={accessRequests.filter(r => r.status === 'Rejected').length} />
      </div>

      {pending.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Nothing waiting"
          description={isAdmin ? 'When Legal proposes an access change, it lands here for you to approve.' : 'Change someone’s access from the Team tab and it will show up here for an Admin.'} />
      ) : (
        <div className="flex flex-col gap-4 mb-6">
          {pending.map(req => {
            const rows = diffRows(req);
            return (
              <div key={req.id} className="rounded border p-4" style={{ background: C.panel, borderColor: C.amber }}>
                <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                  <div>
                    <div style={{ fontWeight: 600 }}>{req.staffName}</div>
                    <div className="text-xs mt-0.5" style={{ color: C.textFaint }}>
                      Proposed by {req.requestedBy} · {formatDate(String(req.requestedAt).slice(0, 10))}
                    </div>
                  </div>
                  <Badge tone="amber">Pending</Badge>
                </div>

                {rows.length === 0 ? (
                  <div className="text-sm" style={{ color: C.textDim }}>No effective change.</div>
                ) : (
                  <div className="rounded border overflow-x-auto mb-3" style={{ borderColor: C.border, background: C.bg }}>
                    <table className="w-full" style={{ minWidth: 380 }}>
                      <thead><tr><Th>What changes</Th><Th>From</Th><Th>To</Th></tr></thead>
                      <tbody>
                        {rows.map(r => (
                          <tr key={r.key}>
                            <Td>{r.label}</Td>
                            <Td><span style={{ color: C.textFaint }}>{r.from}</span></Td>
                            <Td><span style={{ color: r.granted ? C.teal : C.amber, fontWeight: 600 }}>{r.to}</span></Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {req.reason && <div className="text-sm mb-3" style={{ color: C.textDim }}>“{req.reason}”</div>}

                {isAdmin ? (
                  confirmId === req.id ? (
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <span style={{ color: C.textDim }}>Reject this change?</span>
                      <button onClick={() => reject(req)} style={{ color: C.red, fontWeight: 600 }}>Yes, reject</button>
                      <button onClick={() => setConfirmId(null)} style={{ color: C.textDim }}>Cancel</button>
                    </div>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      <Btn variant="primary" onClick={() => approve(req)}><CheckCircle2 size={14} /> Approve &amp; apply</Btn>
                      <Btn variant="ghost" onClick={() => setConfirmId(req.id)}>Reject</Btn>
                    </div>
                  )
                ) : (
                  <div className="text-xs" style={{ color: C.textFaint }}>Waiting on an Admin.</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {settled.length > 0 && (
        <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
          <div className="text-xs px-4 pt-4 pb-2" style={{ color: C.textFaint }}>Decided</div>
          <table className="w-full" style={{ minWidth: 520 }}>
            <thead><tr><Th>Team member</Th><Th>Proposed by</Th><Th>Reviewed by</Th><Th>When</Th><Th align="right">Outcome</Th></tr></thead>
            <tbody>
              {settled.map(r => (
                <tr key={r.id}>
                  <Td>{r.staffName}</Td>
                  <Td>{r.requestedBy}</Td>
                  <Td>{r.reviewedBy || '—'}</Td>
                  <Td mono>{r.reviewedAt ? formatDate(String(r.reviewedAt).slice(0, 10)) : '—'}</Td>
                  <Td align="right"><Badge tone={r.status === 'Approved' ? 'teal' : 'red'}>{r.status}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TeamSection({ staff, update, sessionRole = 'Admin', sessionName = '', accessRequests = [], updateAccessRequests }) {
  // Legal has Admin-level reach, but access changes it makes are proposals:
  // they queue for an Admin instead of applying.
  const proposesOnly = sessionRole === 'Legal';
  const [proposed, setProposed] = useState('');
  const empty = { name: '', role: 'Product Manager', email: '', phone: '', startDate: todayStr(), status: 'Onboarding', bio: '', photoUrl: '', permissions: defaultPermissionsForRole('Product Manager'), onboarding: makeOnboardingChecklist() };
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [confirmId, setConfirmId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [view, setView] = useState('grid');
  const [newTaskLabel, setNewTaskLabel] = useState('');
  const photoInputRef = useRef(null);

  function openAdd() { setForm({ ...empty, permissions: defaultPermissionsForRole('Product Manager'), onboarding: makeOnboardingChecklist() }); setEditing(null); setShowForm(true); }
  function openEdit(s) { setForm({ ...empty, ...s, permissions: permissionsFor(s), onboarding: s.onboarding && s.onboarding.length ? s.onboarding : makeOnboardingChecklist() }); setEditing(s.id); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); setNewTaskLabel(''); if (photoInputRef.current) photoInputRef.current.value = ''; }
  function changeRole(role) { setForm(f => ({ ...f, role, permissions: defaultPermissionsForRole(role) })); }
  function togglePermission(key) { setForm(f => ({ ...f, permissions: { ...f.permissions, [key]: !f.permissions[key] } })); }
  function toggleTask(taskId) {
    setForm(f => {
      const onboarding = f.onboarding.map(t => t.id === taskId ? { ...t, done: !t.done } : t);
      const allDone = onboarding.length > 0 && onboarding.every(t => t.done);
      return { ...f, onboarding, status: allDone && f.status === 'Onboarding' ? 'Active' : f.status };
    });
  }
  function addTask() {
    if (!newTaskLabel.trim()) return;
    setForm(f => ({ ...f, onboarding: [...f.onboarding, { id: uid(), label: newTaskLabel.trim(), done: false }] }));
    setNewTaskLabel('');
  }
  function removeTask(taskId) { setForm(f => ({ ...f, onboarding: f.onboarding.filter(t => t.id !== taskId) })); }
  function handlePhotoUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    resizeImageFile(file, 300, dataUrl => setForm(f => ({ ...f, photoUrl: dataUrl })));
  }
  const [emailError, setEmailError] = useState('');
  function save(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    // A new or changed staff email must be on a label domain; unchanged existing ones keep working.
    const previousEmail = editing ? ((staff.find(x => x.id === editing) || {}).email || '') : null;
    const email = (form.email || '').trim();
    if (!email) { setEmailError('Add their work email. It’s how they sign in.'); return; }
    if (email.toLowerCase() !== String(previousEmail || '').toLowerCase() && !isStaffEmailAllowed(email)) {
      setEmailError('Use a label email ending in ' + STAFF_EMAIL_DOMAINS.map(d => '@' + d).join(' or ') + '.'); return;
    }
    setEmailError('');
    if (editing) {
      const before = staff.find(s => s.id === editing);
      // Legal outranks nobody where Admin is concerned.
      if (proposesOnly && isTopRole(before && before.role)) { closeForm(); return; }
      const beforePerms = permissionsFor(before);
      const accessChanged = before && (before.role !== form.role ||
        PERMISSION_FIELDS.some(f => !!beforePerms[f.key] !== !!form.permissions[f.key]));
      if (proposesOnly && accessChanged) {
        // Everything except role and permissions still saves straight away.
        update(staff.map(s => s.id === editing
          ? { ...form, id: editing, role: before.role, permissions: beforePerms }
          : s));
        if (updateAccessRequests) {
          updateAccessRequests([{
            id: uid(), staffId: editing, staffName: form.name.trim(),
            previousRole: before.role, proposedRole: form.role,
            previousPermissions: beforePerms, proposedPermissions: { ...form.permissions },
            requestedBy: sessionName || 'Legal', requestedAt: new Date().toISOString(),
            status: 'Pending', reviewedBy: '', reviewedAt: '', reason: '',
          }, ...accessRequests]);
        }
        setProposed(form.name.trim());
        closeForm();
        return;
      }
      update(staff.map(s => s.id === editing ? { ...form, id: editing } : s));
    } else if (proposesOnly) {
      // A new hire Legal adds starts on their role's defaults; any custom
      // access Legal picked goes to an Admin as a proposal.
      const newId = uid();
      const roleDefaults = defaultPermissionsForRole(form.role);
      update([...staff, { ...form, id: newId, permissions: roleDefaults }]);
      const custom = PERMISSION_FIELDS.some(f => !!roleDefaults[f.key] !== !!form.permissions[f.key]);
      if (custom && updateAccessRequests) {
        updateAccessRequests([{
          id: uid(), staffId: newId, staffName: form.name.trim(),
          previousRole: form.role, proposedRole: form.role,
          previousPermissions: roleDefaults, proposedPermissions: { ...form.permissions },
          requestedBy: sessionName || 'Legal', requestedAt: new Date().toISOString(),
          status: 'Pending', reviewedBy: '', reviewedAt: '', reason: '',
        }, ...accessRequests]);
        setProposed(form.name.trim());
      }
    } else {
      update([...staff, { ...form, id: uid() }]);
    }
    closeForm();
  }
  function remove(id) { update(staff.filter(s => s.id !== id)); setConfirmId(null); }

  const filtered = staff.filter(s => {
    if (filterStatus !== 'all' && (s.status || 'Active') !== filterStatus) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return s.name.toLowerCase().includes(q) || s.role.toLowerCase().includes(q) || (s.email && s.email.toLowerCase().includes(q));
  });
  const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  const lockedAccess = isTopRole(form.role);
  // Legal cannot touch an Admin — Admin is the highest power.
  const editingAdmin = editing ? isTopRole((staff.find(s => s.id === editing) || {}).role) : false;
  const blockedByRank = proposesOnly && editingAdmin;
  const onboardingCount = staff.filter(s => (s.status || 'Active') === 'Onboarding').length;

  return (
    <div>
      <SectionHeader title="Team" description="Everyone on the label side with access to this dashboard — profiles, roles, permissions, and onboarding progress." action={<Btn variant="primary" onClick={openAdd}><Plus size={14} /> Add team member</Btn>} />
      {proposesOnly && (
        <div className="rounded px-3 py-2 text-xs mb-4" style={{ background: C.amberSoft, color: C.amber, border: '1px solid ' + C.amber }}>
          You can change anyone's access here, including what an Admin set — but the change is a proposal. An Admin has to approve it in Access Requests before it takes effect.
        </div>
      )}
      {proposed && (
        <div className="rounded px-3 py-2 text-xs mb-4" style={{ background: C.tealSoft, color: C.teal, border: '1px solid ' + C.teal }}>
          Access change for {proposed} sent to an Admin for approval. <button onClick={() => setProposed('')} style={{ textDecoration: 'underline' }}>Dismiss</button>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-6">
        <KPICard icon={Users} label="Team members" value={staff.length} />
        <KPICard icon={UserCog} label="Onboarding" value={onboardingCount} tone={onboardingCount > 0 ? 'amber' : undefined} />
      </div>

      <div className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
        <div className="imss-form-grid gap-3">
          <Field label="Status">
            <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All statuses</option>
              {STAFF_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Search" full><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, role, or email" /></Field>
        </div>
      </div>

      {showForm && (
        <form onSubmit={save} className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.borderLight }}>
          <div className="flex items-center gap-3 mb-4">
            <Avatar name={form.name} photoUrl={form.photoUrl} size={64} />
            <div className="flex flex-col gap-1">
              <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="text-xs" style={{ color: C.textDim, maxWidth: 220 }} />
              {form.photoUrl && <button type="button" onClick={() => setForm({ ...form, photoUrl: '' })} className="text-xs text-left" style={{ color: C.textFaint }}>Remove photo</button>}
            </div>
          </div>
          <div className="imss-form-grid gap-3 mb-4">
            <Field label="Name"><Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Dana Whitfield" /></Field>
            <Field label="Role">
              <Select value={form.role} onChange={e => changeRole(e.target.value)}>
                {STAFF_ROLES.filter(r => !proposesOnly || editingAdmin || !isTopRole(r)).map(r => <option key={r} value={r}>{r}</option>)}
              </Select>
            </Field>
            <Field label="Work email">
              <Input type="email" required value={form.email} onChange={e => { setForm({ ...form, email: e.target.value }); setEmailError(''); }} placeholder={'name@' + STAFF_EMAIL_DOMAINS[0]} aria-invalid={!!emailError} />
              {emailError && <span className="text-xs" role="alert" style={{ color: C.red }}>{emailError}</span>}
            </Field>
            <Field label="Phone"><Input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Optional" /></Field>
            <Field label="Start date"><Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></Field>
            <Field label="Status">
              <Select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {STAFF_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Bio / notes" full><TextArea rows={2} value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder="What they're joining to do, background, anything worth noting." /></Field>
          </div>

          <div className="text-xs mb-2" style={{ color: C.textFaint }}>Access {lockedAccess && '— Admins always have full access'}</div>
          {blockedByRank && (
            <div className="rounded px-3 py-2 text-xs mb-2" style={{ background: C.redSoft, color: C.red, border: '1px solid ' + C.red }}>
              Admin is the highest role — Legal can't change an Admin's access. Ask an Admin to make this change.
            </div>
          )}
          <div className="rounded border p-3 mb-4" style={{ borderColor: C.border, background: C.bg }}>
            <div className="grid grid-cols-1 gap-2">
              {PERMISSION_FIELDS.map(f => (
                <label key={f.key} className="flex items-start gap-2 text-sm" style={{ color: (lockedAccess || blockedByRank) ? C.textFaint : C.text, opacity: (lockedAccess || blockedByRank) ? 0.6 : 1 }}>
                  <input type="checkbox" checked={lockedAccess ? true : !!form.permissions[f.key]} disabled={lockedAccess || blockedByRank} onChange={() => togglePermission(f.key)} style={{ marginTop: 3 }} />
                  <span>
                    <span style={{ fontWeight: 500 }}>{f.label}</span>
                    <span className="block text-xs" style={{ color: C.textFaint }}>{f.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="text-xs mb-2" style={{ color: C.textFaint }}>Onboarding checklist — {onboardingProgress(form).done}/{onboardingProgress(form).total} complete</div>
          <div className="rounded border p-3 mb-4" style={{ borderColor: C.border, background: C.bg }}>
            <div className="flex flex-col gap-2 mb-3">
              {form.onboarding.map(t => (
                <div key={t.id} className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm" style={{ color: t.done ? C.textFaint : C.text, textDecoration: t.done ? 'line-through' : 'none' }}>
                    <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id)} />
                    {t.label}
                  </label>
                  <button type="button" onClick={() => removeTask(t.id)} style={{ color: C.textFaint }}><Trash2 size={12} /></button>
                </div>
              ))}
              {form.onboarding.length === 0 && <div className="text-xs" style={{ color: C.textFaint }}>No tasks yet.</div>}
            </div>
            <div className="flex gap-2">
              <Input value={newTaskLabel} onChange={e => setNewTaskLabel(e.target.value)} placeholder="Add a custom task" />
              <Btn variant="ghost" type="button" onClick={addTask}>Add</Btn>
            </div>
          </div>

          <div className="flex gap-2 mt-1">
            <Btn variant="primary" type="submit">{editing ? 'Save changes' : 'Add team member'}</Btn>
            <Btn variant="ghost" onClick={closeForm}>Cancel</Btn>
            {isTopRole(sessionRole) && editing && <SendLinkButton labeled email={(staff.find(x => x.id === editing) || {}).email} />}
          </div>
        </form>
      )}

      <ExportBar filename="imss-team" headers={['Name', 'Role', 'Status', 'Email', 'Phone', 'Start Date', 'Onboarding Progress']} rows={sorted.map(s => {
        const prog = onboardingProgress(s);
        return [s.name, s.role, s.status || 'Active', s.email || '', s.phone || '', s.startDate || '', prog.total > 0 ? prog.done + '/' + prog.total : ''];
      })} />

      <div className="flex justify-end gap-1 mb-4">
        <SegmentedToggle options={[{ id: 'grid', label: 'Grid' }, { id: 'table', label: 'Table' }]} value={view} onChange={setView} />
      </div>

      {sorted.length === 0 ? (
        <EmptyState icon={UserCog} title="No team members yet" description="Add the people on your side of the label — this list is also what populates sign-in, roster assignments, and access control." />
      ) : view === 'grid' ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {sorted.map(s => {
            const prog = onboardingProgress(s);
            const status = s.status || 'Active';
            return (
              <button key={s.id} onClick={() => openEdit(s)} className="text-left rounded border p-4" style={{ background: C.panel, borderColor: C.border }}>
                <div className="flex items-center gap-3 mb-3">
                  <Avatar name={s.name} photoUrl={s.photoUrl} size={48} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                    <div className="text-xs" style={{ color: C.textFaint }}>{s.role}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  <Badge tone={status === 'Active' ? 'teal' : status === 'Onboarding' ? 'amber' : 'default'}>{status}</Badge>
                </div>
                {status === 'Onboarding' && prog.total > 0 && (
                  <div className="mb-2">
                    <div className="rounded-full overflow-hidden" style={{ height: 4, background: C.panel2 }}>
                      <div style={{ height: 4, width: prog.pct + '%', background: C.amber }} />
                    </div>
                    <div className="text-xs mt-1" style={{ color: C.textFaint }}>{prog.done}/{prog.total} onboarding tasks</div>
                  </div>
                )}
                <div className="text-xs" style={{ color: C.textFaint }}>{s.email || 'No email set'}</div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
          <table className="w-full" style={{ minWidth: 720 }}>
            <thead><tr><Th></Th><Th>Name</Th><Th>Role</Th><Th>Status</Th><Th>Onboarding</Th><Th>Email</Th><Th align="right">Actions</Th></tr></thead>
            <tbody>
              {sorted.map(s => {
                const prog = onboardingProgress(s);
                const status = s.status || 'Active';
                return (
                  <tr key={s.id}>
                    <Td><Avatar name={s.name} photoUrl={s.photoUrl} size={32} /></Td>
                    <Td>{s.name}</Td>
                    <Td><Badge tone={s.role === 'Admin' ? 'amber' : s.role === 'Finance' ? 'teal' : 'default'}>{s.role}</Badge></Td>
                    <Td><Badge tone={status === 'Active' ? 'teal' : status === 'Onboarding' ? 'amber' : 'default'}>{status}</Badge></Td>
                    <Td mono>{prog.total > 0 ? prog.done + '/' + prog.total : '—'}</Td>
                    <Td>{s.email || '—'}</Td>
                    <Td align="right">
                      {confirmId === s.id ? <ConfirmInline onConfirm={() => remove(s.id)} onCancel={() => setConfirmId(null)} /> : (
                        <span className="inline-flex gap-3 justify-end">
                          {isTopRole(sessionRole) && <SendLinkButton email={s.email} />}
                          <button onClick={() => openEdit(s)} style={{ color: C.textDim }}><Pencil size={14} /></button>
                          <button onClick={() => setConfirmId(s.id)} style={{ color: C.textDim }}><Trash2 size={14} /></button>
                        </span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CatalogSection({ catalog, update, roster, artistMap, canEdit = true, pmScope = null, releaseSubmissions = [], updateReleaseSubmissions, sessionName = '', incomingSubmission = null, clearIncoming, onOpenSubmissions }) {
  const visibleRoster = pmScope ? roster.filter(a => a.productManager === pmScope) : roster;
  const visibleArtistIds = new Set(visibleRoster.map(a => a.id));
  const visibleCatalog = pmScope ? catalog.filter(c => visibleArtistIds.has(c.artistId)) : catalog;
  const visibleSubmissions = (pmScope ? releaseSubmissions.filter(s => visibleArtistIds.has(s.artistId)) : releaseSubmissions).filter(s => s.status === 'Pending');

  const empty = { artistId: visibleRoster[0] ? visibleRoster[0].id : '', title: '', type: 'Single', genre: '', releaseDate: todayStr(), isrc: '', upc: '', status: 'Processing', artworkUrl: '', enteredBy: '', hasVideo: false, licenseExpiration: '', collaborators: [], primaryArtists: [], primaryMarket: '', secondaryMarket: '', checklist: makeReleaseChecklist(), distributionDocs: makeDistributionDocs(), label: '', explicit: 'Not Set', dolbyAtmos: false, lyrics: '', duration: '', credits: emptyCredits() };
  const [distributorEmail, setDistributorEmail] = useState('');
  const [fromSubmissionId, setFromSubmissionId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [filterArtist, setFilterArtist] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterLicense, setFilterLicense] = useState('all');
  const [filterMarket, setFilterMarket] = useState('all');
  const [search, setSearch] = useState('');
  const [view, setView] = useState('grid');
  const [confirmId, setConfirmId] = useState(null);
  const [newCollab, setNewCollab] = useState({ name: '', role: 'Feature', splitPercent: '' });
  const [newPrimaryArtist, setNewPrimaryArtist] = useState('');
  const [newChecklistLabel, setNewChecklistLabel] = useState('');
  const artworkInputRef = useRef(null);
  const lastEnteredBy = catalog.length ? (catalog[catalog.length - 1].enteredBy || '') : '';

  function openAdd() { setFromSubmissionId(null); setForm({ ...empty, artistId: visibleRoster[0] ? visibleRoster[0].id : '', enteredBy: lastEnteredBy, checklist: makeReleaseChecklist(), distributionDocs: makeDistributionDocs() }); setEditing(null); setNewCollab({ name: '', role: 'Feature', splitPercent: '' }); setDistributorEmail(''); setShowForm(true); }
  function openFromSubmission(sub) {
    setForm({ ...empty, artistId: sub.artistId, title: sub.title, type: sub.type, genre: sub.genre || '', releaseDate: sub.proposedDate || todayStr(), artworkUrl: sub.artworkUrl || '', collaborators: sub.collaborators || [], primaryArtists: sub.primaryArtists || [], enteredBy: sessionName, checklist: makeReleaseChecklist(), distributionDocs: sub.distributionDocs && sub.distributionDocs.length ? sub.distributionDocs : makeDistributionDocs(), explicit: sub.explicit || 'Not Set', dolbyAtmos: !!sub.dolbyAtmos, lyrics: sub.lyrics || '', duration: sub.duration || '', credits: sub.credits ? { ...emptyCredits(), ...sub.credits } : emptyCredits(), splitSheet: sub.splitSheet || '', splitSheetName: sub.splitSheetName || '', instrumental: !!sub.instrumental, about: sub.about || '', rollout: sub.rollout || null });
    setEditing(null);
    setNewCollab({ name: '', role: 'Feature', splitPercent: '' });
    setDistributorEmail('');
    setShowForm(true);
    setFromSubmissionId(sub.id); // marked Accepted only when this release is saved
  }
  // Accepted from the Submissions screen: open the release form pre-filled once.
  useEffect(() => {
    if (incomingSubmission) { openFromSubmission(incomingSubmission); if (clearIncoming) clearIncoming(); }
    // eslint-disable-next-line
  }, [incomingSubmission]);
  function rejectSubmission(sub) {
    if (updateReleaseSubmissions) updateReleaseSubmissions(releaseSubmissions.map(s => s.id === sub.id ? { ...s, status: 'Rejected', reviewedBy: sessionName, reviewedAt: new Date().toISOString() } : s));
  }
  function openEdit(r) { setFromSubmissionId(null); setForm({ ...empty, ...r, collaborators: r.collaborators || [], primaryArtists: r.primaryArtists || [], checklist: r.checklist && r.checklist.length ? r.checklist : makeReleaseChecklist(), distributionDocs: r.distributionDocs && r.distributionDocs.length ? r.distributionDocs : makeDistributionDocs(), credits: r.credits ? { ...emptyCredits(), ...r.credits } : emptyCredits() }); setEditing(r.id); setNewCollab({ name: '', role: 'Feature', splitPercent: '' }); setDistributorEmail(''); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); setNewChecklistLabel(''); if (artworkInputRef.current) artworkInputRef.current.value = ''; }
  function addCollaborator() {
    if (!newCollab.name.trim()) return;
    setForm(f => ({ ...f, collaborators: [...f.collaborators, { ...newCollab, splitPercent: Number(newCollab.splitPercent) || 0 }] }));
    setNewCollab({ name: '', role: 'Feature', splitPercent: '' });
  }
  function addPrimaryArtist() {
    if (!newPrimaryArtist.trim()) return;
    setForm(f => ({ ...f, primaryArtists: [...(f.primaryArtists || []), newPrimaryArtist.trim()] }));
    setNewPrimaryArtist('');
  }
  function removePrimaryArtist(idx) { setForm(f => ({ ...f, primaryArtists: f.primaryArtists.filter((_, i) => i !== idx) })); }
  function removeCollaborator(idx) { setForm(f => ({ ...f, collaborators: f.collaborators.filter((_, i) => i !== idx) })); }
  function toggleChecklistItem(itemId) { setForm(f => ({ ...f, checklist: f.checklist.map(t => t.id === itemId ? { ...t, done: !t.done } : t) })); }
  function addChecklistItem() {
    if (!newChecklistLabel.trim()) return;
    setForm(f => ({ ...f, checklist: [...f.checklist, { id: uid(), label: newChecklistLabel.trim(), done: false }] }));
    setNewChecklistLabel('');
  }
  function removeChecklistItem(itemId) { setForm(f => ({ ...f, checklist: f.checklist.filter(t => t.id !== itemId) })); }
  function toggleDistDoc(docId) { setForm(f => ({ ...f, distributionDocs: f.distributionDocs.map(d => d.id === docId ? { ...d, attached: !d.attached } : d) })); }
  function setDistDocNote(docId, note) { setForm(f => ({ ...f, distributionDocs: f.distributionDocs.map(d => d.id === docId ? { ...d, note } : d) })); }
  function openDriveFolder() {
    const artist = roster.find(a => a.id === form.artistId);
    if (artist && artist.driveFolder) window.open(artist.driveFolder, '_blank', 'noopener,noreferrer');
  }
  function generateMetadataSheet() {
    const artist = roster.find(a => a.id === form.artistId);
    const allPrimary = [artist ? artist.name : '', ...(form.primaryArtists || [])].filter(Boolean).join(' & ');
    const performedBy = form.credits.performedBy || allPrimary + ((form.collaborators || []).length ? ' feat. ' + form.collaborators.map(c => c.name).join(', ') : '');
    const rows = [[
      form.genre || (artist ? artist.genre || '' : ''),
      form.label || '',
      form.explicit === 'Not Set' ? '' : form.explicit,
      form.dolbyAtmos ? 'Yes' : 'No',
      form.lyrics || '',
      form.title,
      performedBy,
      form.credits.writtenBy || '',
      form.credits.producedBy || (form.collaborators || []).filter(c => c.role === 'Producer').map(c => c.name).join(', '),
      form.credits.recordingEngineer || '',
      form.credits.mixingEngineer || '',
      form.credits.masteringEngineer || '',
      form.credits.dolbyEngineer || '',
      artist ? artist.productManager || '' : '',
      form.duration || '',
      form.upc || '',
      form.isrc || '',
    ]];
    const headers = ['Genre', 'Label', 'Explicit/Clean', 'Dolby', 'Lyrics', 'Song Title', 'Performed by', 'Written by', 'Produced By', 'Recording Engineer', 'Mixing Engineer', 'Mastering Engineer', 'Dolby Engineer', 'Product Manager', 'Duration', 'UPC', 'ISRC'];
    exportRowsToExcel((form.title || 'release').replace(/\s+/g, '-').toLowerCase() + '-metadata', headers, rows);
  }
  function sendPackageToDistributor() {
    if (!distributorEmail.trim()) return;
    const artist = roster.find(a => a.id === form.artistId);
    const missing = missingRequiredDocs(form.distributionDocs);
    const subject = encodeURIComponent((artist ? artist.name + ' — ' : '') + form.title + ' — Distribution Package');
    const bodyLines = [
      'Release: ' + form.title,
      'Artist: ' + (artist ? artist.name : ''),
      'Type: ' + form.type,
      'Release date: ' + (form.releaseDate || 'TBD'),
      form.isrc ? 'ISRC: ' + form.isrc : null,
      form.upc ? 'UPC: ' + form.upc : null,
      '',
      artist && artist.driveFolder ? 'Files and documents: ' + artist.driveFolder : 'Files and documents: (no Drive/Dropbox folder on file for this artist yet)',
      '',
      missing > 0 ? missing + ' required document(s) still outstanding — see checklist.' : 'All required documents attached.',
    ].filter(Boolean);
    const body = encodeURIComponent(bodyLines.join('\n'));
    window.open('mailto:' + distributorEmail.trim() + '?subject=' + subject + '&body=' + body, '_blank');
  }
  function save(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    if (editing) update(catalog.map(r => r.id === editing ? { ...form, id: editing } : r));
    else update([...catalog, { ...form, id: uid() }]);
    if (fromSubmissionId && updateReleaseSubmissions) {
      updateReleaseSubmissions(releaseSubmissions.map(x => x.id === fromSubmissionId ? { ...x, status: 'Approved', reviewedBy: sessionName, reviewedAt: new Date().toISOString() } : x));
    }
    setFromSubmissionId(null);
    closeForm();
  }
  function remove(id) { update(catalog.filter(r => r.id !== id)); setConfirmId(null); }
  function handleArtworkUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    resizeImageFile(file, 400, dataUrl => setForm(f => ({ ...f, artworkUrl: dataUrl })));
  }
  function moveStatus(release, newStatus) { update(catalog.map(c => c.id === release.id ? { ...c, status: newStatus } : c)); }

  const marketsInUse = Array.from(new Set(visibleCatalog.flatMap(c => [c.primaryMarket, c.secondaryMarket]).filter(Boolean))).sort();

  const filtered = visibleCatalog.filter(c => {
    if (filterArtist !== 'all' && c.artistId !== filterArtist) return false;
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    if (filterMarket !== 'all' && c.primaryMarket !== filterMarket && c.secondaryMarket !== filterMarket) return false;
    if (filterLicense !== 'all') {
      const lic = c.license;
      if (filterLicense === 'none' && lic) return false;
      if (filterLicense !== 'none' && (!lic || lic.label !== filterLicense)) return false;
    }
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.title.toLowerCase().includes(q) ||
      (c.isrc && c.isrc.toLowerCase().includes(q)) ||
      (c.upc && c.upc.toLowerCase().includes(q))
    );
  });
  const sorted = [...filtered].sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || ''));
  const filtersActive = filterArtist !== 'all' || filterStatus !== 'all' || filterLicense !== 'all' || filterMarket !== 'all' || !!search;

  return (
    <div>
      <SectionHeader title="Catalog" description="Every release across the roster — singles, EPs, and albums." action={canEdit && <Btn variant="primary" onClick={openAdd}><Plus size={14} /> Add release</Btn>} />

      {canEdit && visibleSubmissions.length > 0 && onOpenSubmissions && (
        <button onClick={onOpenSubmissions} className="w-full text-left rounded border px-4 py-3 mb-6 text-sm" style={{ background: C.amberSoft, borderColor: C.amber, color: C.text }}>
          <span style={{ color: C.amber, fontWeight: 600 }}>{visibleSubmissions.length} release submission{visibleSubmissions.length === 1 ? '' : 's'} waiting for review</span> · open Submissions
        </button>
      )}

      <div className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
        <div className="imss-form-grid gap-3">
          <Field label="Artist">
            <Select value={filterArtist} onChange={e => setFilterArtist(e.target.value)}>
              <option value="all">All artists</option>
              {visibleRoster.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All statuses</option>
              {RELEASE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="License">
            <Select value={filterLicense} onChange={e => setFilterLicense(e.target.value)}>
              <option value="all">All licenses</option>
              <option value="Active">Active</option>
              <option value="Expiring soon">Expiring soon</option>
              <option value="Held until recouped">Held until recouped</option>
              <option value="Expired">Expired (rights returned)</option>
              <option value="none">No release date</option>
            </Select>
          </Field>
          <Field label="Market">
            <Select value={filterMarket} onChange={e => setFilterMarket(e.target.value)}>
              <option value="all">All markets</option>
              {marketsInUse.map(m => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Search" full><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Title, ISRC, or UPC" /></Field>
        </div>
        {filtersActive && <div className="text-xs mt-3" style={{ color: C.textFaint }}>Showing {filtered.length} of {visibleCatalog.length} releases</div>}
      </div>

      {pmScope && (
        <div className="rounded px-3 py-2 text-xs mb-6" style={{ background: C.amberSoft, color: C.amber, border: '1px solid ' + C.amber }}>
          Showing only releases for artists assigned to you as Product Manager ({visibleCatalog.length} of {catalog.length} total).
        </div>
      )}

      {showForm && (
        <form onSubmit={save} className="rounded border p-4 mb-6 imss-form-grid gap-3" style={{ background: C.panel, borderColor: C.borderLight }}>
          <div className="imss-span-2 flex items-center gap-3">
            <ArtworkThumb release={form} size={64} radius={8} />
            <div className="flex flex-col gap-1">
              <input ref={artworkInputRef} type="file" accept="image/*" onChange={handleArtworkUpload} className="text-xs" style={{ color: C.textDim, maxWidth: 220 }} />
              {form.artworkUrl && <button type="button" onClick={() => setForm({ ...form, artworkUrl: '' })} className="text-xs text-left" style={{ color: C.textFaint }}>Remove artwork</button>}
            </div>
          </div>
          <Field label="Product name"><Input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Artist">
            <Select value={form.artistId} onChange={e => setForm({ ...form, artistId: e.target.value })}>
              {visibleRoster.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
          <Field label="Additional primary artists" full>
            <div className="flex items-center gap-1.5 flex-wrap mb-2">
              {(form.primaryArtists || []).map((name, i) => (
                <Badge key={i}>{name} <button type="button" onClick={() => removePrimaryArtist(i)} style={{ marginLeft: 4, color: C.textFaint }}>×</button></Badge>
              ))}
              {(!form.primaryArtists || form.primaryArtists.length === 0) && <span className="text-xs" style={{ color: C.textFaint }}>Just {visibleRoster.find(a => a.id === form.artistId) ? visibleRoster.find(a => a.id === form.artistId).name : 'the selected artist'} — add others for a joint release (e.g. "Artist A &amp; Artist B")</span>}
            </div>
            <div className="flex gap-2">
              <Input value={newPrimaryArtist} onChange={e => setNewPrimaryArtist(e.target.value)} placeholder="Name of co-primary artist" style={{ flex: 1 }} list="primary-artist-suggestions" />
              <datalist id="primary-artist-suggestions">
                {roster.map(a => <option key={a.id} value={a.name} />)}
              </datalist>
              <Btn variant="ghost" type="button" onClick={addPrimaryArtist}>Add</Btn>
            </div>
          </Field>
          <Field label="Type">
            <Select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              {RELEASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Genre"><Input value={form.genre} onChange={e => setForm({ ...form, genre: e.target.value })} placeholder={(roster.find(a => a.id === form.artistId) || {}).genre || 'e.g. Alt-Pop'} /></Field>
          <Field label="Release date"><Input type="date" value={form.releaseDate} onChange={e => setForm({ ...form, releaseDate: e.target.value })} /></Field>
          <Field label="ISRC (recording code)"><Input value={form.isrc} onChange={e => setForm({ ...form, isrc: e.target.value })} placeholder="US-XXX-YY-NNNNN" /></Field>
          <Field label="UPC (release code)"><Input value={form.upc} onChange={e => setForm({ ...form, upc: e.target.value })} placeholder="e.g. 198004512367" /></Field>
          <Field label="Entered by"><Input value={form.enteredBy} onChange={e => setForm({ ...form, enteredBy: e.target.value })} placeholder="Your name" /></Field>
          <Field label="License expiration (from release date + artist's license period)"><Input type="date" value={licenseOf(form, roster.find(a => a.id === form.artistId)).expires} disabled /></Field>
          <Field label="Primary market">
            <Select value={form.primaryMarket} onChange={e => setForm({ ...form, primaryMarket: e.target.value })}>
              <option value="">— none —</option>
              {MARKETS.map(m => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Secondary market">
            <Select value={form.secondaryMarket} onChange={e => setForm({ ...form, secondaryMarket: e.target.value })}>
              <option value="">— none —</option>
              {MARKETS.filter(m => m !== form.primaryMarket).map(m => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Video">
            <label className="flex items-center gap-2 text-sm" style={{ color: C.text, paddingTop: 7 }}>
              <input type="checkbox" checked={form.hasVideo} onChange={e => setForm({ ...form, hasVideo: e.target.checked })} />
              Has a music video
            </label>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              {RELEASE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <div className="imss-span-2">
            <div className="text-xs mb-2" style={{ color: C.textFaint }}>Collaborators &amp; splits — {roster.find(a => a.id === form.artistId) ? roster.find(a => a.id === form.artistId).name : 'Primary artist'} keeps the remainder ({Math.max(0, 100 - form.collaborators.reduce((s, c) => s + c.splitPercent, 0))}%)</div>
            {form.splitSheet && <div className="text-xs mb-2"><a href={form.splitSheet} download={form.splitSheetName || 'split-sheet'} style={{ color: C.amber, textDecoration: 'underline', textUnderlineOffset: 3 }}>Download signed split sheet{form.splitSheetName ? ' (' + form.splitSheetName + ')' : ''}</a></div>}
            <div className="rounded border p-3 mb-1" style={{ borderColor: C.border, background: C.bg }}>
              {form.collaborators.length > 0 && (
                <div className="flex flex-col gap-2 mb-3">
                  {form.collaborators.map((c, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-sm">
                      <span>{c.name} <span style={{ color: C.textFaint }}>· {c.role} · {c.splitPercent}%</span></span>
                      <button type="button" onClick={() => removeCollaborator(i)} style={{ color: C.textFaint }}><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                <Input value={newCollab.name} onChange={e => setNewCollab({ ...newCollab, name: e.target.value })} placeholder="Name" style={{ flex: 2, minWidth: 120 }} />
                <Select value={newCollab.role} onChange={e => setNewCollab({ ...newCollab, role: e.target.value })} style={{ flex: 1, minWidth: 110 }}>
                  {COLLABORATOR_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </Select>
                <Input type="number" min="0" max="100" value={newCollab.splitPercent} onChange={e => setNewCollab({ ...newCollab, splitPercent: e.target.value })} placeholder="Split %" style={{ flex: 1, minWidth: 90 }} />
                <Btn variant="ghost" type="button" onClick={addCollaborator}>Add</Btn>
              </div>
            </div>
          </div>

          <div className="imss-span-2">
            <div className="text-xs mb-2" style={{ color: C.textFaint }}>Credits &amp; metadata sheet fields</div>
            <div className="rounded border p-3 mb-1 imss-form-grid gap-3" style={{ borderColor: C.border, background: C.bg }}>
              <Field label="Label / imprint"><Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="e.g. IMSS Records" /></Field>
              <Field label="Duration"><Input value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} placeholder="mm:ss" /></Field>
              <Field label="Explicit / Clean">
                <Select value={form.explicit} onChange={e => setForm({ ...form, explicit: e.target.value })}>
                  {EXPLICIT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </Select>
              </Field>
              <Field label="Dolby Atmos">
                <label className="flex items-center gap-2 text-sm" style={{ paddingTop: 8 }}>
                  <input type="checkbox" checked={form.dolbyAtmos} onChange={e => setForm({ ...form, dolbyAtmos: e.target.checked })} /> Dolby Atmos mix available
                </label>
              </Field>
              <Field label="Performed by" full><PeopleInput label="Performed by" value={form.credits.performedBy} onChange={v => setForm(f => ({ ...f, credits: { ...f.credits, performedBy: v } }))} placeholder="Artist name, then Enter" /></Field>
              <Field label="Written by"><PeopleInput label="Written by" value={form.credits.writtenBy} onChange={v => setForm(f => ({ ...f, credits: { ...f.credits, writtenBy: v } }))} placeholder="Type a name, then Enter" /></Field>
              <Field label="Produced by"><PeopleInput label="Produced by" value={form.credits.producedBy} onChange={v => setForm(f => ({ ...f, credits: { ...f.credits, producedBy: v } }))} placeholder="Type a name, then Enter" /></Field>
              <Field label="Recording engineer"><PeopleInput label="Recording engineer" value={form.credits.recordingEngineer} onChange={v => setForm(f => ({ ...f, credits: { ...f.credits, recordingEngineer: v } }))} placeholder="Type a name, then Enter" /></Field>
              <Field label="Mixing engineer"><PeopleInput label="Mixing engineer" value={form.credits.mixingEngineer} onChange={v => setForm(f => ({ ...f, credits: { ...f.credits, mixingEngineer: v } }))} placeholder="Type a name, then Enter" /></Field>
              <Field label="Mastering engineer"><PeopleInput label="Mastering engineer" value={form.credits.masteringEngineer} onChange={v => setForm(f => ({ ...f, credits: { ...f.credits, masteringEngineer: v } }))} placeholder="Type a name, then Enter" /></Field>
              <Field label="Dolby engineer"><PeopleInput label="Dolby engineer" value={form.credits.dolbyEngineer} onChange={v => setForm(f => ({ ...f, credits: { ...f.credits, dolbyEngineer: v } }))} placeholder="Type a name, then Enter" /></Field>
              <Field label="Lyrics" full><TextArea rows={3} value={form.lyrics} onChange={e => setForm({ ...form, lyrics: e.target.value })} placeholder="Paste lyrics, or note where they're stored" /></Field>
            </div>
          </div>

          <div className="imss-span-2">
            <div className="text-xs mb-2" style={{ color: C.textFaint }}>Production checklist — {checklistProgress(form.checklist).done}/{checklistProgress(form.checklist).total} complete</div>
            <div className="rounded border p-3 mb-1" style={{ borderColor: C.border, background: C.bg }}>
              <div className="flex flex-col gap-2 mb-3">
                {form.checklist.map(t => (
                  <div key={t.id} className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-sm" style={{ color: t.done ? C.textFaint : C.text, textDecoration: t.done ? 'line-through' : 'none' }}>
                      <input type="checkbox" checked={t.done} onChange={() => toggleChecklistItem(t.id)} />
                      {t.label}
                    </label>
                    <button type="button" onClick={() => removeChecklistItem(t.id)} style={{ color: C.textFaint }}><Trash2 size={12} /></button>
                  </div>
                ))}
                {form.checklist.length === 0 && <div className="text-xs" style={{ color: C.textFaint }}>No tasks yet.</div>}
              </div>
              <div className="flex gap-2">
                <Input value={newChecklistLabel} onChange={e => setNewChecklistLabel(e.target.value)} placeholder="Add a custom task" />
                <Btn variant="ghost" type="button" onClick={addChecklistItem}>Add</Btn>
              </div>
            </div>
          </div>

          <div className="imss-span-2">
            <div className="text-xs mb-2" style={{ color: C.textFaint }}>
              Distribution package{missingRequiredDocs(form.distributionDocs) > 0 && <span style={{ color: C.red }}> — {missingRequiredDocs(form.distributionDocs)} required document{missingRequiredDocs(form.distributionDocs) === 1 ? '' : 's'} missing</span>}
            </div>
            <div className="rounded border p-3 mb-3" style={{ borderColor: C.border, background: C.bg }}>
              <div className="flex flex-col gap-2">
                {form.distributionDocs.map(d => (
                  <div key={d.id} className="flex items-center gap-2 flex-wrap">
                    <label className="flex items-center gap-2 text-sm" style={{ minWidth: 160, color: d.attached ? C.textFaint : C.text, textDecoration: d.attached ? 'line-through' : 'none' }}>
                      <input type="checkbox" checked={d.attached} onChange={() => toggleDistDoc(d.id)} />
                      {d.label}
                    </label>
                    {!d.attached && (d.required ? <Badge tone="red">Missing</Badge> : <Badge>Optional</Badge>)}
                    <Input value={d.note} onChange={e => setDistDocNote(d.id, e.target.value)} placeholder="Note (e.g. uploaded to Drive 9/6)" style={{ flex: 1, minWidth: 160 }} />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded border p-3 mb-1" style={{ borderColor: C.border, background: C.bg }}>
              <div className="flex flex-wrap gap-2 mb-3">
                <Btn variant="ghost" type="button" onClick={openDriveFolder} disabled={!roster.find(a => a.id === form.artistId) || !roster.find(a => a.id === form.artistId).driveFolder}>Open Drive folder</Btn>
                <Btn variant="ghost" type="button" onClick={generateMetadataSheet}><FileSpreadsheet size={14} /> Generate metadata sheet</Btn>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Input type="email" value={distributorEmail} onChange={e => setDistributorEmail(e.target.value)} placeholder="distributor@label.com" style={{ flex: 1, minWidth: 200 }} />
                <Btn variant="primary" type="button" onClick={sendPackageToDistributor}>Send package</Btn>
              </div>
              <div className="text-xs mt-2" style={{ color: C.textFaint }}>Opens your email client with the release details and the artist's Drive/Dropbox link pre-filled — attach the actual files there before sending.</div>
            </div>
          </div>

          <div className="imss-span-2 flex gap-2 mt-1">
            <Btn variant="primary" type="submit">{editing ? 'Save changes' : 'Add release'}</Btn>
            <Btn variant="ghost" onClick={closeForm}>Cancel</Btn>
          </div>
        </form>
      )}

      {roster.length === 0 && <div className="text-sm mb-4" style={{ color: C.textDim }}>Add an artist to the roster before creating a release.</div>}

      <ExportBar filename="imss-catalog" headers={['Title', 'Artist', 'Type', 'Release Date', 'ISRC', 'UPC', 'Status', 'Primary Market', 'Secondary Market', 'License Expiration', 'Has Video', 'Collaborators', 'Entered By']} rows={sorted.map(r => [
        r.title,
        artistMap[r.artistId] ? artistMap[r.artistId].name : 'Unknown',
        r.type,
        r.releaseDate,
        r.isrc || '',
        r.upc || '',
        r.status,
        r.primaryMarket || '',
        r.secondaryMarket || '',
        r.licenseExpiration || '',
        r.hasVideo ? 'Yes' : 'No',
        (r.collaborators || []).map(c => c.name + ' (' + c.role + ', ' + c.splitPercent + '%)').join('; '),
        r.enteredBy || '',
      ])} />

      <div className="flex justify-end gap-1 mb-4">
        <SegmentedToggle options={[{ id: 'grid', label: 'Grid' }, { id: 'table', label: 'Table' }, { id: 'pipeline', label: 'Pipeline' }]} value={view} onChange={setView} />
      </div>

      {view === 'pipeline' && (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, minmax(220px, 1fr))', overflowX: 'auto' }}>
          {RELEASE_STATUSES.map(status => {
            const inStage = sorted.filter(r => r.status === status);
            return (
              <div key={status} className="rounded border p-3" style={{ background: C.panel, borderColor: C.border, minWidth: 220 }}>
                <div className="flex items-center justify-between mb-3">
                  <div style={{ color: C.textDim, fontWeight: 600, fontSize: 13 }}>{status}</div>
                  <Badge>{inStage.length}</Badge>
                </div>
                <div className="flex flex-col gap-2">
                  {inStage.length === 0 ? (
                    <div className="text-xs" style={{ color: C.textFaint }}>Nothing here</div>
                  ) : inStage.map(r => {
                    const prog = checklistProgress(r.checklist);
                    const artist = artistMap[r.artistId];
                    const nextIdx = RELEASE_STATUSES.indexOf(status) + 1;
                    const nextStatus = RELEASE_STATUSES[nextIdx];
                    return (
                      <div key={r.id} className="rounded border p-2" style={{ background: C.bg, borderColor: C.border }}>
                        <div className="flex items-center gap-2">
                          <ArtworkThumb release={r} size={28} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                            <div className="text-xs" style={{ color: C.textFaint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artist ? artist.name : 'Unknown'}</div>
                          </div>
                        </div>
                        {prog.total > 0 && (
                          <div className="mt-2">
                            <div className="rounded-full overflow-hidden" style={{ height: 3, background: C.panel2 }}>
                              <div style={{ height: 3, width: prog.pct + '%', background: C.amber }} />
                            </div>
                          </div>
                        )}
                        {missingRequiredDocs(r.distributionDocs) > 0 && (
                          <div className="text-xs mt-1.5" style={{ color: C.red }}>{missingRequiredDocs(r.distributionDocs)} doc{missingRequiredDocs(r.distributionDocs) === 1 ? '' : 's'} missing</div>
                        )}
                        {canEdit && nextStatus && (
                          <button onClick={() => {
                            const missing = missingRequiredDocs(r.distributionDocs);
                            if (missing > 0 && (nextStatus === 'Upcoming' || nextStatus === 'Released') && !window.confirm(r.title + ' still has ' + missing + ' required distribution document(s) missing. Move to ' + nextStatus + ' anyway?')) return;
                            moveStatus(r, nextStatus);
                          }} className="text-xs mt-2 inline-flex items-center gap-1" style={{ color: C.amber }}>
                            Move to {nextStatus} <ChevronRight size={11} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view !== 'pipeline' && (sorted.length === 0 ? (
        <EmptyState icon={Disc3} title={filtersActive ? 'No matching releases' : 'No releases yet'} description={filtersActive ? 'Try a different filter or search term.' : 'Add a single, EP, or album to start building the catalog.'} />
      ) : view === 'grid' ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
          {sorted.map(r => {
            const lic = r.licenseExpiration ? r.license : null;
            const prog = checklistProgress(r.checklist);
            return (
              <button key={r.id} onClick={() => canEdit && openEdit(r)} className="text-left rounded border overflow-hidden" style={{ background: C.panel, borderColor: C.border, cursor: canEdit ? 'pointer' : 'default' }}>
                <div style={{ width: '100%', aspectRatio: '1 / 1', position: 'relative' }}>
                  <ArtworkThumb release={r} size="100%" radius={0} />
                  {r.status !== 'Released' && prog.total > 0 && (
                    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 3, background: 'var(--fill)' }}>
                      <div style={{ height: 3, width: prog.pct + '%', background: C.amber }} />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="text-xs" style={{ color: C.textFaint }}>{formatDate(r.releaseDate)}</div>
                  <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3, marginTop: 2 }}>{r.title}</div>
                  <div style={{ fontStyle: 'italic', fontSize: 13, color: C.textDim, marginTop: 1 }}>
                    {[artistMap[r.artistId] ? artistMap[r.artistId].name : 'Unknown', ...(r.primaryArtists || [])].join(' & ')}
                    {r.collaborators && r.collaborators.length > 0 && ' feat. ' + r.collaborators.map(c => c.name).join(', ')}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <Badge tone={releaseStatusTone(r.status)}>{r.status}</Badge>
                    <Badge>{r.type}</Badge>
                    {r.hasVideo && <Badge><Video size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />Video</Badge>}
                    {lic && lic.label !== 'Active' && <Badge tone={lic.tone}>License {lic.label.toLowerCase()}</Badge>}
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
                  {r.status !== 'Released' && missingRequiredDocs(r.distributionDocs) > 0 && (
                    <div className="text-xs mt-1.5" style={{ color: C.red }}>{missingRequiredDocs(r.distributionDocs)} required doc{missingRequiredDocs(r.distributionDocs) === 1 ? '' : 's'} missing</div>
                  )}
                  {r.enteredBy && <div className="text-xs mt-1.5" style={{ color: C.textFaint }}>Entered by {r.enteredBy}</div>}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
          <table className="w-full" style={{ minWidth: 820 }}>
            <thead><tr><Th></Th><Th>Product</Th><Th>Artist</Th><Th>Type</Th><Th>Market</Th><Th>Release date</Th><Th>Codes</Th><Th>Status</Th><Th>License</Th><Th align="right">Actions</Th></tr></thead>
            <tbody>
              {sorted.map(r => (
                <tr key={r.id}>
                  <Td><ArtworkThumb release={r} size={36} /></Td>
                  <Td>{r.title}{r.collaborators && r.collaborators.length > 0 && <div className="text-xs" style={{ color: C.textFaint }}>feat. {r.collaborators.map(c => c.name).join(', ')}</div>}</Td>
                  <Td>{artistMap[r.artistId] ? artistMap[r.artistId].name : 'Unknown'}</Td>
                  <Td>{r.type}{r.hasVideo && <Video size={12} style={{ display: 'inline', marginLeft: 5, verticalAlign: 'middle', color: C.textFaint }} />}</Td>
                  <Td>{r.primaryMarket || '—'}{r.secondaryMarket && <div className="text-xs" style={{ color: C.textFaint }}>+ {r.secondaryMarket}</div>}</Td>
                  <Td mono>{formatDate(r.releaseDate)}</Td>
                  <Td mono>
                    {!r.isrc && !r.upc ? '—' : (
                      <div style={{ lineHeight: 1.5 }}>
                        {r.isrc && <div>{r.isrc}</div>}
                        {r.upc && <div style={{ color: C.textFaint }}>{r.upc}</div>}
                      </div>
                    )}
                  </Td>
                  <Td><Badge tone={releaseStatusTone(r.status)}>{r.status}</Badge></Td>
                  <Td>
                    {!r.licenseExpiration ? <span style={{ color: C.textFaint }}>—</span> : (
                      <div style={{ lineHeight: 1.5 }}>
                        <div style={{ fontFamily: MONO_FONT, fontSize: 12 }}>{formatDate(r.licenseExpiration)}</div>
                        <Badge tone={r.license.tone}>{r.license.label}</Badge>
                      </div>
                    )}
                  </Td>
                  <Td align="right">
                    {confirmId === r.id ? <ConfirmInline onConfirm={() => remove(r.id)} onCancel={() => setConfirmId(null)} /> : canEdit ? (
                      <span className="inline-flex gap-3 justify-end">
                        <button onClick={() => openEdit(r)} style={{ color: C.textDim }}><Pencil size={14} /></button>
                        <button onClick={() => setConfirmId(r.id)} style={{ color: C.textDim }}><Trash2 size={14} /></button>
                      </span>
                    ) : <span style={{ color: C.textFaint }}>—</span>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function RevenueSection({ revenue, update, roster, catalog = [], canEdit = true, isAdmin = false, sessionName = '' }) {
  const empty = { artist: roster[0] ? roster[0].name : '', title: '', month: todayStr().slice(0, 7), earning: '', type: RELEASE_TYPES[0], epAlbum: '', releaseDate: '' };
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [confirmId, setConfirmId] = useState(null);
  const [filters, setFilters] = useState({ startMonth: '', endMonth: '', artist: 'all', search: '' });

  function openAdd() { setForm(empty); setEditing(null); setShowForm(true); }
  function openEdit(r) { setForm({ artist: r.artist, title: r.title, month: r.month, earning: String(r.earning), type: r.type || RELEASE_TYPES[0], epAlbum: r.epAlbum || '', releaseDate: r.releaseDate || '' }); setEditing(r.id); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); }
  function save(e) {
    e.preventDefault();
    const earning = Number(form.earning);
    if (!form.artist || !form.title.trim() || !form.month || !earning || earning <= 0) return;
    const artistSlug = slug(form.artist);
    const id = editing || (artistSlug + '_' + slug(form.title) + '_' + form.month);
    const approvalStatus = isAdmin ? 'Approved' : 'Pending';
    const payload = { id, artist: form.artist, artistSlug, title: form.title.trim(), month: form.month, earning, type: form.type, epAlbum: form.epAlbum.trim() || null, releaseDate: form.releaseDate || null, approvalStatus, approvedBy: isAdmin ? sessionName : '', approvedAt: isAdmin ? todayStr() : '' };
    if (editing) update(revenue.map(r => r.id === editing ? { ...r, ...payload, id: editing } : r));
    else update([...revenue.filter(r => r.id !== id), payload]);
    closeForm();
  }
  function remove(id) { update(revenue.filter(r => r.id !== id)); setConfirmId(null); }
  function approveEntry(id) { update(revenue.map(r => r.id === id ? { ...r, approvalStatus: 'Approved', approvedBy: sessionName, approvedAt: todayStr() } : r)); }
  function rejectEntry(id) { update(revenue.map(r => r.id === id ? { ...r, approvalStatus: 'Rejected', approvedBy: sessionName, approvedAt: todayStr() } : r)); }
  // The month range applies on Generate; artist and search stay live so the
  // management table is still quick to scan.
  const [appliedMonths, setAppliedMonths] = useState({ startMonth: '', endMonth: '' });
  const [rangeError, setRangeError] = useState('');
  function resetFilters() { setFilters({ startMonth: '', endMonth: '', artist: 'all', search: '' }); setAppliedMonths({ startMonth: '', endMonth: '' }); setRangeError(''); }
  function applyMonths() {
    if (filters.startMonth && filters.endMonth && filters.startMonth > filters.endMonth) {
      setRangeError('The start month has to come before the end month.');
      return;
    }
    setRangeError('');
    setAppliedMonths({ startMonth: filters.startMonth, endMonth: filters.endMonth });
  }

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return revenue.filter(r => {
      if (appliedMonths.startMonth && r.month < appliedMonths.startMonth) return false;
      if (appliedMonths.endMonth && r.month > appliedMonths.endMonth) return false;
      if (filters.artist !== 'all' && r.artistSlug !== filters.artist) return false;
      if (!q) return true;
      const rel = catalog.find(c => slug(c.title) === slug(r.title) && slug((roster.find(a => a.id === c.artistId) || {}).name || '') === r.artistSlug);
      return [r.title, r.artist, r.isrc, r.upc, rel && rel.isrc, rel && rel.upc].some(v => v && String(v).toLowerCase().includes(q));
    });
  }, [revenue, filters, appliedMonths, catalog, roster]);

  function exportCsv() {
    exportRowsToCsv('revenue-export', ['Artist', 'Title', 'Month', 'Earning', 'Type', 'EP/Album', 'Release date', 'Status'],
      [...filtered].sort((a, b) => b.month.localeCompare(a.month)).map(r => [r.artist, r.title, r.month, r.earning, r.type || '', r.epAlbum || '', r.releaseDate || '', r.approvalStatus || 'Approved']));
  }

  const sorted = [...filtered].sort((a, b) => b.month.localeCompare(a.month) || a.artist.localeCompare(b.artist));
  const total = filtered.reduce((s, r) => s + r.earning, 0);
  const pendingCount = revenue.filter(r => r.approvalStatus === 'Pending').length;
  const filtersActive = !!(appliedMonths.startMonth || appliedMonths.endMonth || filters.artist !== 'all' || filters.search);

  return (
    <div>
      <SectionHeader title="Revenue" artistNote="nothing from this screen directly. Changes here reach artists only through Publish to artists." description="One row per track per month — the source of truth every finance calculation is built from." action={canEdit && <Btn variant="primary" onClick={openAdd}><Plus size={14} /> Add revenue</Btn>} />

      {!isAdmin && pendingCount > 0 && (
        <div className="rounded px-3 py-2 text-xs mb-4" style={{ background: C.amberSoft, color: C.amber, border: '1px solid ' + C.amber }}>
          {pendingCount} {pendingCount === 1 ? 'entry is' : 'entries are'} waiting on admin approval and excluded from totals until approved.
        </div>
      )}

      <div className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
        <div className="imss-form-grid gap-3 mb-3">
          <Field label="Start month"><Input type="month" value={filters.startMonth} onChange={e => { setFilters({ ...filters, startMonth: e.target.value }); setRangeError(''); }} /></Field>
          <Field label="End month"><Input type="month" value={filters.endMonth} onChange={e => { setFilters({ ...filters, endMonth: e.target.value }); setRangeError(''); }} /></Field>
          <Field label="Artist">
            <Select value={filters.artist} onChange={e => setFilters({ ...filters, artist: e.target.value })}>
              <option value="all">All artists</option>
              {roster.map(a => <option key={a.id} value={slug(a.name)}>{a.name}</option>)}
            </Select>
          </Field>
          <Field label="Search"><Input value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} placeholder="Title, artist, ISRC or UPC" /></Field>
        </div>
        {rangeError && (
          <div className="rounded px-3 py-2 text-xs mb-3" style={{ background: C.redSoft, color: C.red, border: '1px solid ' + C.red }}>{rangeError}</div>
        )}
        <div className="flex gap-2 flex-wrap">
          <Btn variant="primary" onClick={applyMonths}><FileText size={14} /> Generate</Btn>
          <Btn variant="ghost" onClick={exportCsv}><Download size={14} /> Export to CSV</Btn>
          <Btn variant="ghost" onClick={resetFilters}>Reset</Btn>
        </div>
        {filtersActive && <div className="text-xs mt-2" style={{ color: C.textFaint }}>Showing {filtered.length} of {revenue.length} entries</div>}
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <KPICard icon={DollarSign} label="Total revenue (filtered)" value={formatCurrency(total)} tone="teal" />
        <KPICard icon={ClipboardList} label="Pending approval" value={pendingCount} tone={pendingCount ? 'amber' : undefined} />
      </div>

      {showForm && (
        <form onSubmit={save} className="rounded border p-4 mb-6 imss-form-grid gap-3" style={{ background: C.panel, borderColor: C.borderLight }}>
          <Field label="Artist">
            <Select value={form.artist} onChange={e => setForm({ ...form, artist: e.target.value })}>
              {roster.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
            </Select>
          </Field>
          <Field label="Track title"><Input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Month"><Input type="month" required value={form.month} onChange={e => setForm({ ...form, month: e.target.value })} /></Field>
          <Field label="Earning (gross, USD)"><Input type="number" min="0" step="0.01" required value={form.earning} onChange={e => setForm({ ...form, earning: e.target.value })} /></Field>
          <Field label="Type">
            <Select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              {RELEASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Parent EP/Album (optional)"><Input value={form.epAlbum} onChange={e => setForm({ ...form, epAlbum: e.target.value })} /></Field>
          <Field label="Original release date (optional)"><Input type="date" value={form.releaseDate} onChange={e => setForm({ ...form, releaseDate: e.target.value })} /></Field>
          <div className="imss-span-2 flex gap-2 mt-1">
            <Btn variant="primary" type="submit">{editing ? 'Save changes' : 'Add revenue'}</Btn>
            <Btn variant="ghost" onClick={closeForm}>Cancel</Btn>
          </div>
        </form>
      )}

      {sorted.length === 0 ? (
        <EmptyState icon={DollarSign} title={filtersActive ? 'No matching revenue' : 'No revenue recorded'} description={filtersActive ? 'Try widening the filters.' : 'Log a track/month earning to get started.'} />
      ) : (
        <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
          <table className="w-full" style={{ minWidth: 760 }}>
            <thead><tr><Th>Month</Th><Th>Artist</Th><Th>Track</Th><Th>Type</Th><Th align="right">Earning</Th><Th>Status</Th><Th align="right">Actions</Th></tr></thead>
            <tbody>
              {sorted.map(r => (
                <tr key={r.id}>
                  <Td mono>{r.month}</Td>
                  <Td>{r.artist}</Td>
                  <Td>{r.title}{r.epAlbum ? <span style={{ color: C.textFaint }}> · {r.epAlbum}</span> : ''}</Td>
                  <Td><Badge>{r.type || '—'}</Badge></Td>
                  <Td align="right" mono>{formatCurrency(r.earning)}</Td>
                  <Td><Badge tone={r.approvalStatus === 'Pending' ? 'amber' : r.approvalStatus === 'Rejected' ? 'red' : 'teal'}>{r.approvalStatus || 'Approved'}</Badge></Td>
                  <Td align="right">
                    {confirmId === r.id ? <ConfirmInline onConfirm={() => remove(r.id)} onCancel={() => setConfirmId(null)} /> : (
                      <span className="inline-flex gap-3 justify-end items-center">
                        {isAdmin && r.approvalStatus === 'Pending' && (
                          <>
                            <button onClick={() => approveEntry(r.id)} style={{ color: C.teal }}><CheckCircle2 size={14} /></button>
                            <button onClick={() => rejectEntry(r.id)} style={{ color: C.red }}><Trash2 size={14} /></button>
                          </>
                        )}
                        {canEdit && <button onClick={() => openEdit(r)} style={{ color: C.textDim }}><Pencil size={14} /></button>}
                        {canEdit && <button onClick={() => setConfirmId(r.id)} style={{ color: C.textDim }}><Trash2 size={14} /></button>}
                      </span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StreamsSection({ streams, update, catalog, releaseMap, artistMap, canEdit = true }) {
  const empty = { date: todayStr(), platform: 'Spotify', releaseId: catalog[0] ? catalog[0].id : '', count: '' };
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [confirmId, setConfirmId] = useState(null);
  const [filters, setFilters] = useState({ startDate: '', endDate: '', product: 'all', search: '' });
  const [view, setView] = useState('leaderboard');
  const allMonths = useMemo(() => Array.from(new Set(streams.map(s => monthKey(s.date)))).sort(), [streams]);
  const [leaderboardMonth, setLeaderboardMonth] = useState('');

  function openAdd() { setForm({ ...empty, releaseId: catalog[0] ? catalog[0].id : '' }); setEditing(null); setShowForm(true); }
  function openEdit(s) { setForm({ ...s, count: String(s.count) }); setEditing(s.id); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); }
  function save(e) {
    e.preventDefault();
    const cnt = Number(form.count);
    if (!cnt || cnt < 0 || !form.releaseId) return;
    const payload = { ...form, count: cnt };
    if (editing) update(streams.map(s => s.id === editing ? { ...payload, id: editing } : s));
    else update([...streams, { ...payload, id: uid() }]);
    closeForm();
  }
  function remove(id) { update(streams.filter(s => s.id !== id)); setConfirmId(null); }
  // Date range applies on Generate; product and search stay live.
  const [appliedRange, setAppliedRange] = useState({ startDate: '', endDate: '' });
  const [rangeError, setRangeError] = useState('');
  function resetFilters() { setFilters({ startDate: '', endDate: '', product: 'all', search: '' }); setAppliedRange({ startDate: '', endDate: '' }); setRangeError(''); }
  function applyRange() {
    if (filters.startDate && filters.endDate && filters.startDate > filters.endDate) {
      setRangeError('The "from" date has to come before the "to" date.');
      return;
    }
    setRangeError('');
    setAppliedRange({ startDate: filters.startDate, endDate: filters.endDate });
  }

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return streams.filter(s => {
      if (appliedRange.startDate && s.date < appliedRange.startDate) return false;
      if (appliedRange.endDate && s.date > appliedRange.endDate) return false;
      if (filters.product !== 'all' && s.releaseId !== filters.product) return false;
      if (!q) return true;
      const rel = releaseMap[s.releaseId];
      if (!rel) return false;
      const artist = artistMap[rel.artistId];
      return (
        (rel.title && rel.title.toLowerCase().includes(q)) ||
        (rel.upc && rel.upc.toLowerCase().includes(q)) ||
        (rel.isrc && rel.isrc.toLowerCase().includes(q)) ||
        (artist && artist.name.toLowerCase().includes(q))
      );
    });
  }, [streams, filters, appliedRange, releaseMap, artistMap]);

  function exportCsv() {
    const rows = [['Date', 'Platform', 'Product', 'Artist', 'UPC', 'ISRC', 'Streams']];
    [...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || '')).forEach(s => {
      const rel = releaseMap[s.releaseId];
      const artist = rel && artistMap[rel.artistId] ? artistMap[rel.artistId].name : '';
      rows.push([s.date, s.platform, rel ? rel.title : '', artist, rel ? (rel.upc || '') : '', rel ? (rel.isrc || '') : '', String(s.count)]);
    });
    const csv = rows.map(r => r.map(v => (/[",\n]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : v)).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'streams-export.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const sorted = [...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const totalsByPlatform = useMemo(() => {
    const map = {};
    filtered.forEach(s => { map[s.platform] = (map[s.platform] || 0) + s.count; });
    return PLATFORMS.map(p => ({ platform: p, value: map[p] || 0 })).filter(x => x.value > 0);
  }, [filtered]);
  const trend = useMemo(() => {
    const map = {};
    filtered.forEach(s => { const k = monthKey(s.date); map[k] = (map[k] || 0) + s.count; });
    return Object.keys(map).sort().map(k => ({ month: monthLabel(k), value: map[k] }));
  }, [filtered]);
  const total = filtered.reduce((s, r) => s + r.count, 0);
  const filtersActive = !!(appliedRange.startDate || appliedRange.endDate || filters.product !== 'all' || filters.search);

  const currentMonth = leaderboardMonth || allMonths[allMonths.length - 1] || '';
  const currentMonthIdx = allMonths.indexOf(currentMonth);
  const previousMonth = currentMonthIdx > 0 ? allMonths[currentMonthIdx - 1] : '';
  const leaderboard = useMemo(() => computePlatformLeaderboard(streams, releaseMap, artistMap, currentMonth, previousMonth, 5), [streams, releaseMap, artistMap, currentMonth, previousMonth]);
  const grandTotal = leaderboard.reduce((s, p) => s + p.totalCurrent, 0);

  const VIEWS = [
    { id: 'leaderboard', label: 'Platform leaderboard' },
    { id: 'trend', label: 'Trend' },
    { id: 'log', label: 'Entry log', count: sorted.length },
  ];

  return (
    <div>
      <SectionHeader title="Streams" description="Track stream counts by platform and product over time." action={canEdit && <Btn variant="primary" onClick={openAdd}><Plus size={14} /> Log streams</Btn>} />

      <div className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
        <div className="imss-form-grid gap-3 mb-3">
          <Field label="Start date"><Input type="date" value={filters.startDate} onChange={e => { setFilters({ ...filters, startDate: e.target.value }); setRangeError(''); }} /></Field>
          <Field label="End date"><Input type="date" value={filters.endDate} onChange={e => { setFilters({ ...filters, endDate: e.target.value }); setRangeError(''); }} /></Field>
          <Field label="Product">
            <Select value={filters.product} onChange={e => setFilters({ ...filters, product: e.target.value })}>
              <option value="all">All products</option>
              {[...catalog].sort((a, b) => a.title.localeCompare(b.title)).map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </Select>
          </Field>
          <Field label="Search" full><Input value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })} placeholder="Product, UPC, ISRC, or artist" /></Field>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Btn variant="primary" onClick={applyRange}><FileText size={14} /> Generate</Btn>
          <Btn variant="ghost" onClick={exportCsv}><Download size={14} /> Export to CSV</Btn>
          <Btn variant="ghost" onClick={resetFilters}>Reset</Btn>
        </div>
        {filtersActive && <div className="text-xs mt-2" style={{ color: C.textFaint }}>Showing {filtered.length} of {streams.length} entries</div>}
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <KPICard icon={Radio} label="Total streams" value={formatNumber(total)} tone="teal" />
        {totalsByPlatform.slice(0, 3).map(t => (<KPICard key={t.platform} icon={Radio} label={t.platform} value={formatNumber(t.value)} />))}
      </div>

      {showForm && (
        <form onSubmit={save} className="rounded border p-4 mb-6 imss-form-grid gap-3" style={{ background: C.panel, borderColor: C.borderLight }}>
          <Field label="Date"><Input type="date" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Platform">
            <Select value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })}>
              {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
            </Select>
          </Field>
          <Field label="Product" full>
            <Select value={form.releaseId} onChange={e => setForm({ ...form, releaseId: e.target.value })}>
              {catalog.map(r => <option key={r.id} value={r.id}>{trackOptionLabel(r, true, artistMap[r.artistId] ? artistMap[r.artistId].name : null)}</option>)}
            </Select>
          </Field>
          <Field label="Stream count"><Input type="number" min="0" required value={form.count} onChange={e => setForm({ ...form, count: e.target.value })} /></Field>
          <div className="imss-span-2 flex gap-2 mt-1">
            <Btn variant="primary" type="submit">{editing ? 'Save changes' : 'Log streams'}</Btn>
            <Btn variant="ghost" onClick={closeForm}>Cancel</Btn>
          </div>
        </form>
      )}

      {catalog.length === 0 && <div className="text-sm mb-4" style={{ color: C.textDim }}>Add a release to the catalog before logging streams.</div>}

      <div className="flex gap-1 mb-4 flex-wrap border-b" style={{ borderColor: C.border }}>
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => setView(v.id)}
            className="text-sm px-3 py-2 inline-flex items-center gap-1.5"
            style={{
              color: view === v.id ? C.amber : C.textDim,
              fontWeight: view === v.id ? 600 : 500,
              borderBottom: '2px solid ' + (view === v.id ? C.amber : 'transparent'),
              marginBottom: -1,
            }}>
            {v.label}
            {v.count !== undefined && <span className="text-xs" style={{ color: C.textFaint, fontFamily: MONO_FONT }}>{v.count}</span>}
          </button>
        ))}
      </div>

      {view === 'leaderboard' && (
        allMonths.length === 0 ? (
          <EmptyState icon={Radio} title="No stream data yet" description="Log platform stream counts to see the leaderboard." />
        ) : (
          <div>
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <div style={{ maxWidth: 220 }}>
                <Select value={currentMonth} onChange={e => setLeaderboardMonth(e.target.value)}>
                  {allMonths.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
                </Select>
              </div>
              <div className="text-sm" style={{ color: C.textDim }}>
                <span style={{ fontFamily: MONO_FONT, color: C.text, fontWeight: 600 }}>{formatNumber(grandTotal)}</span> total streams this period
                {!previousMonth && <span style={{ color: C.textFaint }}> · no prior month to compare against</span>}
              </div>
            </div>
            <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
              <table className="w-full" style={{ minWidth: 900 }}>
                <thead>
                  <tr>
                    <Th>Rank</Th>
                    {leaderboard.map(p => <Th key={p.platform}>{p.platform}</Th>)}
                  </tr>
                  <tr>
                    <Th align="right">Total</Th>
                    {leaderboard.map(p => (
                      <Th key={p.platform}>
                        {!p.hasData ? <span style={{ color: C.red, fontWeight: 500 }}>Missing reports</span> : (
                          <span style={{ fontFamily: MONO_FONT, fontWeight: 600, color: C.text }}>
                            {formatNumber(p.totalCurrent)}
                            {p.totalPctChange !== null && (
                              <span style={{ color: p.totalPctChange >= 0 ? C.teal : C.red, marginLeft: 6, fontWeight: 500 }}>
                                {p.totalPctChange >= 0 ? '+' : ''}{p.totalPctChange.toFixed(1)}%
                              </span>
                            )}
                          </span>
                        )}
                      </Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[0, 1, 2, 3, 4].map(rankIdx => (
                    <tr key={rankIdx}>
                      <Td mono align="right">{rankIdx + 1}</Td>
                      {leaderboard.map(p => {
                        const row = p.rows[rankIdx];
                        return (
                          <Td key={p.platform}>
                            {!row ? <span style={{ color: C.textFaint }}>—</span> : (
                              <div style={{ lineHeight: 1.5 }}>
                                <div style={{ fontWeight: 500 }}>{row.title}</div>
                                <div className="text-xs" style={{ color: C.textFaint }}>{row.artistName}</div>
                                <div className="text-xs" style={{ fontFamily: MONO_FONT }}>
                                  {formatNumber(row.count)} streams
                                  {row.pctChange !== null && (
                                    <span style={{ color: row.pctChange >= 0 ? C.teal : C.red, marginLeft: 6 }}>
                                      {row.pctChange >= 0 ? '+' : ''}{row.pctChange.toFixed(1)}%
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs" style={{ color: C.textFaint }}>Previous: {row.prevRank ? '#' + row.prevRank : 'N/A'}</div>
                              </div>
                            )}
                          </Td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {view === 'trend' && (
        trend.length === 0 ? (
          <EmptyState icon={Radio} title={filtersActive ? 'No matching streams' : 'No stream data yet'} description={filtersActive ? 'Try widening the date range or clearing the search.' : 'Log platform stream counts to see trends over time.'} />
        ) : (
          <div className="rounded p-4 border" style={{ background: C.panel, borderColor: C.border }}>
            <div className="text-xs mb-3" style={{ color: C.textFaint }}>Streams by month</div>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: C.textFaint, fontSize: 11 }} axisLine={{ stroke: C.border }} tickLine={false} />
                  <YAxis tick={{ fill: C.textFaint, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? Math.round(v / 1000) + 'k' : v} />
                  <Tooltip contentStyle={{ background: C.panel2, border: '1px solid ' + C.border, borderRadius: 12, fontSize: 13, color: C.text }} formatter={(v) => formatNumber(v)} />
                  <Line type="monotone" dataKey="value" stroke={C.teal} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )
      )}

      {view === 'log' && (
        sorted.length === 0 ? (
          <EmptyState icon={Radio} title={filtersActive ? 'No matching streams' : 'No stream data yet'} description={filtersActive ? 'Try widening the date range or clearing the search.' : 'Log platform stream counts to see them here.'} />
        ) : (
          <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
            <table className="w-full" style={{ minWidth: 640 }}>
              <thead><tr><Th>Date</Th><Th>Platform</Th><Th>Product</Th><Th>Artist</Th><Th align="right">Streams</Th><Th align="right">Actions</Th></tr></thead>
              <tbody>
                {sorted.map(s => {
                  const rel = releaseMap[s.releaseId];
                  return (
                    <tr key={s.id}>
                      <Td mono>{formatDate(s.date)}</Td>
                      <Td><Badge tone="teal">{s.platform}</Badge></Td>
                      <Td>{rel ? rel.title : 'Unknown'}</Td>
                      <Td>{rel && artistMap[rel.artistId] ? artistMap[rel.artistId].name : '—'}</Td>
                      <Td align="right" mono>{formatNumber(s.count)}</Td>
                      <Td align="right">
                        {confirmId === s.id ? <ConfirmInline onConfirm={() => remove(s.id)} onCancel={() => setConfirmId(null)} /> : canEdit ? (
                          <span className="inline-flex gap-3 justify-end">
                            <button onClick={() => openEdit(s)} style={{ color: C.textDim }}><Pencil size={14} /></button>
                            <button onClick={() => setConfirmId(s.id)} style={{ color: C.textDim }}><Trash2 size={14} /></button>
                          </span>
                        ) : <span style={{ color: C.textFaint }}>—</span>}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

function ReleaseCalendarSection({ catalog, roster, artistMap, tasks = [] }) {
  const today = todayStr();
  const [calMonth, setCalMonth] = useState(todayStr().slice(0, 7));
  const [filterArtist, setFilterArtist] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedId, setSelectedId] = useState(null);

  function shiftMonth(delta) {
    const [y, m] = calMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setCalMonth(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
  }
  function goToday() { setCalMonth(todayStr().slice(0, 7)); }

  const filtered = catalog.filter(c => {
    if (filterArtist !== 'all' && c.artistId !== filterArtist) return false;
    if (filterStatus !== 'all' && c.status !== filterStatus) return false;
    return true;
  });

  const [year, monthNum] = calMonth.split('-').map(Number);
  const firstOfMonth = new Date(year, monthNum - 1, 1);
  const startWeekday = firstOfMonth.getDay();
  const totalDays = new Date(year, monthNum, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const releasesByDay = useMemo(() => {
    const map = {};
    filtered.forEach(r => {
      if (!r.releaseDate || monthKey(r.releaseDate) !== calMonth) return;
      const day = parseInt(r.releaseDate.slice(8, 10), 10);
      map[day] = map[day] || [];
      map[day].push(r);
    });
    return map;
  }, [filtered, calMonth]);

  const otherEventsByDay = useMemo(() => {
    const map = {};
    function add(dateStr, tone) {
      if (!dateStr || monthKey(dateStr) !== calMonth) return;
      const day = parseInt(dateStr.slice(8, 10), 10);
      map[day] = map[day] || [];
      map[day].push(tone);
    }
    tasks.forEach(t => { if (t.status === 'Open') add(t.dueDate, 'task'); });
    roster.forEach(a => { if (a.contractExpiration) add(a.contractExpiration, 'contract'); });
    catalog.forEach(c => { if (c.licenseExpiration) add(c.licenseExpiration, 'license'); });
    return map;
  }, [tasks, roster, catalog, calMonth]);

  const alsoComingUp = useMemo(() => {
    const items = [];
    tasks.forEach(t => {
      if (t.status !== 'Open' || !t.dueDate || t.dueDate < today) return;
      items.push({ id: 'task-' + t.id, type: 'Task', tone: 'amber', label: t.title, sub: t.assignee, date: t.dueDate });
    });
    roster.forEach(a => {
      if (!a.contractExpiration || a.contractExpiration < today) return;
      const st = expirationStatus(a.contractExpiration);
      if (st.label === 'Active') return;
      items.push({ id: 'contract-' + a.id, type: 'Contract', tone: st.tone, label: a.name + "'s contract", sub: st.label, date: a.contractExpiration });
    });
    catalog.forEach(c => {
      if (!c.licenseExpiration || c.licenseExpiration < today) return;
      const st = c.license;
      if (st.label === 'Active') return;
      items.push({ id: 'license-' + c.id, type: 'License', tone: st.tone, label: c.title + ' license', sub: st.label, date: c.licenseExpiration });
    });
    return items.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
  }, [tasks, roster, catalog, today]);

  const upcoming = useMemo(() => {
    return filtered.filter(r => r.releaseDate && r.releaseDate >= today).sort((a, b) => a.releaseDate.localeCompare(b.releaseDate)).slice(0, 8);
  }, [filtered, today]);

  const selected = selectedId ? catalog.find(r => r.id === selectedId) || null : null;

  const monthLabelText = firstOfMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const releasesThisMonth = filtered.filter(r => r.releaseDate && monthKey(r.releaseDate) === calMonth).length;
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div>
      <SectionHeader title="Release Calendar" description="Every release plotted on the calendar, plus what's coming up next — your release radar. Click any release to see the full details." />

      <div className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
        <div className="imss-form-grid gap-3">
          <Field label="Artist">
            <Select value={filterArtist} onChange={e => setFilterArtist(e.target.value)}>
              <option value="all">All artists</option>
              {roster.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All statuses</option>
              {RELEASE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <KPICard icon={Disc3} label="Releases this month" value={releasesThisMonth} />
        <KPICard icon={Calendar} label="Upcoming releases" value={upcoming.length} tone="amber" />
      </div>

      {selected && (
        <div className="rounded border p-4 mb-6 flex items-start gap-4 flex-wrap" style={{ background: C.panel, borderColor: C.amber }}>
          <ArtworkThumb release={selected} size={72} radius={8} />
          <div style={{ minWidth: 200, flex: 1 }}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div style={{ fontWeight: 600, fontSize: 16 }}>{selected.title}</div>
              <button onClick={() => setSelectedId(null)} className="text-xs" style={{ color: C.textFaint }}>Close</button>
            </div>
            <div className="text-sm mb-2" style={{ color: C.textDim }}>{artistMap[selected.artistId] ? artistMap[selected.artistId].name : 'Unknown artist'}</div>
            <div className="flex items-center gap-1.5 flex-wrap mb-3">
              <Badge>{selected.type}</Badge>
              <Badge tone={releaseStatusTone(selected.status)}>{selected.status}</Badge>
              {selected.hasVideo && <Badge tone="default"><Video size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />Video</Badge>}
              {selected.licenseExpiration && <Badge tone={selected.license.tone}>License {selected.license.label.toLowerCase()}</Badge>}
            </div>
            <div className="text-xs" style={{ color: C.textFaint, lineHeight: 1.7 }}>
              <div>Release date: <span style={{ color: C.text, fontFamily: MONO_FONT }}>{formatDate(selected.releaseDate)}</span></div>
              {selected.upc && <div>UPC: <span style={{ color: C.text, fontFamily: MONO_FONT }}>{selected.upc}</span></div>}
              {selected.isrc && <div>ISRC: <span style={{ color: C.text, fontFamily: MONO_FONT }}>{selected.isrc}</span></div>}
              {selected.licenseExpiration && <div>License expires: <span style={{ color: C.text, fontFamily: MONO_FONT }}>{formatDate(selected.licenseExpiration)}</span></div>}
              <div>Entered by: <span style={{ color: C.text }}>{selected.enteredBy || 'Unknown'}</span></div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => shiftMonth(-1)} style={{ color: C.textDim }}><ChevronLeft size={18} /></button>
          <div className="flex items-center gap-3">
            <div style={{ fontWeight: 600 }}>{monthLabelText}</div>
            <button onClick={goToday} className="text-xs px-2 py-1 rounded" style={{ border: '1px solid ' + C.border, color: C.textFaint }}>Today</button>
          </div>
          <button onClick={() => shiftMonth(1)} style={{ color: C.textDim }}><ChevronRight size={18} /></button>
        </div>
        <div className="flex items-center gap-3 mb-3 text-xs" style={{ color: C.textFaint }}>
          <span className="flex items-center gap-1"><span style={{ width: 5, height: 5, borderRadius: 9999, background: C.amber, display: 'inline-block' }}></span> Task due</span>
          <span className="flex items-center gap-1"><span style={{ width: 5, height: 5, borderRadius: 9999, background: C.red, display: 'inline-block' }}></span> Contract or license expiring</span>
        </div>
        <div className="grid gap-1 mb-1" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {WEEKDAYS.map(w => <div key={w} className="text-center text-xs" style={{ color: C.textFaint, padding: '4px 0' }}>{w}</div>)}
        </div>
        <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {cells.map((day, i) => {
            const dateStr = day ? calMonth + '-' + String(day).padStart(2, '0') : null;
            const isToday = dateStr === today;
            const dayReleases = day ? (releasesByDay[day] || []) : [];
            const dayEvents = day ? (otherEventsByDay[day] || []) : [];
            return (
              <div key={i} className="rounded" style={{ minHeight: 84, background: day ? C.bg : 'transparent', border: '1px solid ' + (day ? (isToday ? C.amber : C.border) : 'transparent'), padding: 5 }}>
                {day && <div className="text-xs mb-1" style={{ color: isToday ? C.amber : C.textFaint, fontWeight: isToday ? 700 : 500 }}>{day}</div>}
                {dayReleases.slice(0, 2).map(r => (
                  <button key={r.id} onClick={() => setSelectedId(r.id)} className="flex items-center gap-1 mb-1 text-left w-full" style={{ background: selectedId === r.id ? C.amberSoft : 'transparent', borderRadius: 3, padding: '1px 2px' }}>
                    <ArtworkThumb release={r} size={14} radius={3} />
                    <span style={{ minWidth: 0, lineHeight: 1.25 }}>
                      <span style={{ display: 'block', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: r.status === 'Released' ? C.teal : r.status === 'Processing' ? C.textFaint : C.amber }}>{r.title}</span>
                      <span style={{ display: 'block', fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.textFaint }}>{artistMap[r.artistId] ? artistMap[r.artistId].name : ''}</span>
                    </span>
                  </button>
                ))}
                {dayReleases.length > 2 && <div className="text-xs" style={{ color: C.textFaint }}>+{dayReleases.length - 2} more</div>}
                {dayEvents.length > 0 && (
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {dayEvents.slice(0, 4).map((tone, di) => (
                      <span key={di} style={{ width: 5, height: 5, borderRadius: 9999, background: tone === 'task' ? C.amber : C.red, flexShrink: 0 }}></span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-xs mb-3" style={{ color: C.textFaint }}>Up next</div>
      {upcoming.length === 0 ? (
        <EmptyState icon={Disc3} title="Nothing scheduled" description="Releases with a future date will show up here." />
      ) : (
        <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
          <table className="w-full" style={{ minWidth: 560 }}>
            <thead><tr><Th></Th><Th>Product</Th><Th>Artist</Th><Th>Date</Th><Th align="right">Days away</Th><Th>Status</Th></tr></thead>
            <tbody>
              {upcoming.map(r => {
                const daysAway = Math.round((new Date(r.releaseDate) - new Date(today)) / 86400000);
                return (
                  <tr key={r.id} onClick={() => setSelectedId(r.id)} style={{ cursor: 'pointer', background: selectedId === r.id ? C.amberSoft : 'transparent' }}>
                    <Td><ArtworkThumb release={r} size={32} /></Td>
                    <Td>{r.title}</Td>
                    <Td>{artistMap[r.artistId] ? artistMap[r.artistId].name : 'Unknown'}</Td>
                    <Td mono>{formatDate(r.releaseDate)}</Td>
                    <Td align="right" mono>{daysAway === 0 ? 'Today' : daysAway + 'd'}</Td>
                    <Td><Badge tone={releaseStatusTone(r.status)}>{r.status}</Badge></Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs mb-3 mt-6" style={{ color: C.textFaint }}>Also coming up</div>
      {alsoComingUp.length === 0 ? (
        <div className="text-sm" style={{ color: C.textDim }}>No open task due dates or expirations in the near term.</div>
      ) : (
        <div className="rounded border" style={{ borderColor: C.border, background: C.panel }}>
          {alsoComingUp.map(item => (
            <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5" style={{ borderBottom: '1px solid ' + C.border }}>
              <div className="flex items-center gap-2">
                <span style={{ width: 6, height: 6, borderRadius: 9999, background: item.tone === 'red' ? C.red : C.amber, flexShrink: 0 }}></span>
                <div>
                  <div className="text-sm">{item.label}</div>
                  <div className="text-xs" style={{ color: C.textFaint }}>{item.type} · {item.sub}</div>
                </div>
              </div>
              <div className="text-xs" style={{ color: C.textFaint, fontFamily: MONO_FONT }}>{formatDate(item.date)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MasterGrossSection({ masterGross, update, roster, revenue, labelSettings, updateLabelSettings, canEdit = true }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const empty = { month: todayStr().slice(0, 7), periodStart: '', remittanceId: '', paidOn: '', receivedOn: '', totalGross: '', swiftFee: String(labelSettings.swiftFee) };
  const [form, setForm] = useState(empty);
  const [confirmId, setConfirmId] = useState(null);
  const [feeInput, setFeeInput] = useState(String(labelSettings.swiftFee));

  function openAdd() { setForm({ ...empty, swiftFee: String(labelSettings.swiftFee) }); setEditing(null); setShowForm(true); }
  function openEdit(g) { setForm({ month: g.month, periodStart: g.periodStart || '', remittanceId: g.remittanceId || '', paidOn: g.paidOn || '', receivedOn: g.receivedOn || '', totalGross: String(g.totalGross), swiftFee: String(g.swiftFee) }); setEditing(g.id); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); }
  function save(e) {
    e.preventDefault();
    const totalGross = Number(form.totalGross);
    const swiftFee = Number(form.swiftFee);
    if (!form.month || totalGross < 0 || swiftFee < 0) return;
    // month = the statement month this money pays for (what everything matches on); the dates are records only.
    const periodStart = form.periodStart && form.periodStart < form.month ? form.periodStart : '';
    const payload = { id: form.month, month: form.month, periodStart, remittanceId: form.remittanceId.trim(), paidOn: form.paidOn || '', receivedOn: form.receivedOn || '', totalGross, swiftFee };
    if (editing) update(masterGross.map(g => g.id === editing ? payload : g));
    // A new entry replaces any entry for a month it now covers.
    else update([...masterGross.filter(g => !monthRange(periodStart || form.month, form.month).includes(g.month)), payload]);
    closeForm();
  }
  function remove(id) { update(masterGross.filter(g => g.id !== id)); setConfirmId(null); }
  function saveFee(e) {
    e.preventDefault();
    const fee = Number(feeInput);
    if (fee < 0) return;
    updateLabelSettings({ ...labelSettings, swiftFee: fee });
  }

  const sorted = [...masterGross].sort((a, b) => b.month.localeCompare(a.month));
  const totals = companyFinanceTotals(roster, revenue, masterGross);

  return (
    <div>
      <SectionHeader title="Money received" artistNote="never the label’s totals. Only their share of each month’s Inbound Banking Charge, fixed when their earnings are published." description="One row per statement month, company-wide: the real money the distributor paid for that statement (usually arriving the month after), and the flat inbound banking charge split proportionally across every artist who earned that month." action={canEdit && <Btn variant="primary" onClick={openAdd}><Plus size={14} /> Log month</Btn>} />

      <div className="flex flex-wrap gap-3 mb-6">
        <KPICard icon={DollarSign} label="Total gross (all months)" value={formatCurrency(totals.totalGross)} tone="teal" />
        <KPICard icon={Wallet} label="Total inbound banking charges" value={formatCurrency(totals.totalSwift)} />
        <KPICard icon={TrendingUp} label="Tracked gross (revenue rows)" value={formatCurrency(totals.trackedGross)} />
        <KPICard icon={ClipboardList} label="Untracked gap" value={formatCurrency(totals.untrackedGap)} tone={Math.abs(totals.untrackedGap) > 0.01 ? 'amber' : 'teal'} sub={Math.abs(totals.untrackedGap) > 0.01 ? 'Reconciliation flag, not an error' : 'Fully reconciled'} />
      </div>

      {canEdit && (
        <form onSubmit={saveFee} className="rounded border p-4 mb-6 flex items-end gap-3 flex-wrap" style={{ background: C.panel, borderColor: C.border }}>
          <Field label="Default inbound banking charge for new months (USD)"><Input type="number" min="0" step="0.01" value={feeInput} onChange={e => setFeeInput(e.target.value)} style={{ maxWidth: 160 }} /></Field>
          <Btn variant="ghost" type="submit">Save default</Btn>
        </form>
      )}

      {showForm && (
        <form onSubmit={save} className="rounded border p-4 mb-6 imss-form-grid gap-3" style={{ background: C.panel, borderColor: C.borderLight }}>
          <Field label="Statement month it pays for"><Input type="month" required value={form.month} onChange={e => setForm({ ...form, month: e.target.value })} disabled={!!editing} /></Field>
          <Field label="Carried forward from (optional)"><Input type="month" value={form.periodStart} max={form.month} onChange={e => setForm({ ...form, periodStart: e.target.value })} /></Field>
          <div className="imss-span-2 text-xs" style={{ color: C.textDim, marginTop: -4 }}>If EMPIRE held earlier months back (under its $300 minimum) and paid them in this one payment, pick the first month it covers. The amount and the single charge are spread across those months by what each earned.</div>
          <Field label="Remittance ID"><Input value={form.remittanceId} onChange={e => setForm({ ...form, remittanceId: e.target.value })} placeholder="e.g. JAN26-16344-21056" /></Field>
          <Field label="Money sent (EMPIRE payment date)"><Input type="date" value={form.paidOn} onChange={e => setForm({ ...form, paidOn: e.target.value })} /></Field>
          <Field label="Money received (bank credit date)"><Input type="date" value={form.receivedOn} onChange={e => setForm({ ...form, receivedOn: e.target.value })} /></Field>
          <Field label="Total gross received (USD)"><Input type="number" min="0" step="0.01" required value={form.totalGross} onChange={e => setForm({ ...form, totalGross: e.target.value })} /></Field>
          <Field label="Inbound Banking Charge (USD)"><Input type="number" min="0" step="0.01" required value={form.swiftFee} onChange={e => setForm({ ...form, swiftFee: e.target.value })} /></Field>
          <div className="imss-span-2 flex gap-2 mt-1">
            <Btn variant="primary" type="submit">{editing ? 'Save changes' : 'Log month'}</Btn>
            <Btn variant="ghost" onClick={closeForm}>Cancel</Btn>
          </div>
        </form>
      )}

      {sorted.length === 0 ? (
        <EmptyState icon={DollarSign} title="No months logged yet" description="Log the distributor's real gross and inbound banking charge for a month to start splitting it across artists." />
      ) : (
        <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
          <table className="w-full" style={{ minWidth: 620 }}>
            <thead><tr><Th>Statement month</Th><Th>Remittance</Th><Th>Money sent</Th><Th>Money received</Th><Th align="right">Total gross</Th><Th align="right">Inbound Banking Charge</Th><Th align="right">Net received</Th><Th align="right">Tracked revenue</Th><Th align="right">Actions</Th></tr></thead>
            <tbody>
              {sorted.map(g => {
                const trackedThisMonth = monthRange(g.periodStart || g.month, g.month).reduce((t, m) => t + (revByMonth(revenue)[m] || 0), 0);
                const gap = g.totalGross - trackedThisMonth;
                return (
                  <tr key={g.id}>
                    <Td mono>{g.periodStart ? monthLabel(g.periodStart) + ' – ' : ''}{monthLabel(g.month)}{g.periodStart && <div className="text-xs" style={{ color: C.textDim, fontFamily: 'inherit' }}>Carried forward, paid together</div>}</Td>
                    <Td><span className="text-xs" style={{ color: C.textDim }}>{g.remittanceId || '—'}</span></Td>
                    <Td mono>{formatDate(g.paidOn)}</Td>
                    <Td mono>{g.receivedOn ? formatDate(g.receivedOn) : <span className="text-xs" style={{ color: C.textDim }}>Date not recorded</span>}</Td>
                    <Td align="right" mono>{formatCurrency(g.totalGross)}</Td>
                    <Td align="right" mono>{formatCurrency(g.swiftFee)}</Td>
                    <Td align="right" mono>{formatCurrency(g.totalGross - g.swiftFee)}</Td>
                    <Td align="right" mono>{formatCurrency(trackedThisMonth)}{Math.abs(gap) > 0.01 && <span style={{ color: C.amber }}> ({gap > 0 ? '+' : ''}{formatCurrency(gap)})</span>}</Td>
                    <Td align="right">
                      {confirmId === g.id ? <ConfirmInline onConfirm={() => remove(g.id)} onCancel={() => setConfirmId(null)} /> : canEdit ? (
                        <span className="inline-flex gap-3 justify-end">
                          <button onClick={() => openEdit(g)} style={{ color: C.textDim }}><Pencil size={14} /></button>
                          <button onClick={() => setConfirmId(g.id)} style={{ color: C.textDim }}><Trash2 size={14} /></button>
                        </span>
                      ) : <span style={{ color: C.textFaint }}>—</span>}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// `requireGenerate` gates the statement behind an explicit Generate click —
// used by the artist portal, where an artist picks the period they want a
// statement for. The team-side view leaves it off and stays live.
// When earnings cross a deal change, say so: each month is paid at the deal in
// force that month. Optional "View by deal" buttons narrow the view to one deal.
const prevMonth = m => { const [y, mo] = m.split('-').map(Number); const d = new Date(Date.UTC(y, mo - 2, 1)); return d.toISOString().slice(0, 7); };
export function dealPeriodsOf(artist) {
  const list = dealTermsOf(artist);
  return list.map((t, i) => ({ from: t.from || '', to: list[i + 1] ? prevMonth(list[i + 1].from) : '', pct: Number(t.artistPct), deal: dealLabel(t) }));
}
const pctTxt = p => Math.round(Number(p) * 10000) / 100 + '%';
const periodTxt = p => p.from && p.to ? monthLabel(p.from) + ' – ' + monthLabel(p.to) : p.from ? 'From ' + monthLabel(p.from) : p.to ? 'Up to ' + monthLabel(p.to) : 'All months';
function DealSpanNote({ artist, rows = [], onPick, active = null }) {
  const periods = dealPeriodsOf(artist);
  if (periods.length < 2) return null;
  const rateOf = r => Math.round((r.final ? r.artistPct : pctAt(artist, r.month)) * 10000);
  const months = rows.map(r => r.month).sort();
  const lo = months[0], hi = months[months.length - 1];
  const touched = months.length ? periods.filter(p => (!p.to || p.to >= lo) && (!p.from || p.from <= hi)) : [];
  const mixed = new Set(rows.map(rateOf)).size > 1;
  return (
    <section aria-label="Deals in this period" className="rounded mb-5" style={{ background: mixed ? C.amberSoft : C.panel, padding: '16px 18px' }}>
      {mixed && (
        <>
          <div style={{ fontWeight: 600, fontSize: 16, letterSpacing: '-0.02em' }}>These earnings cover more than one deal</div>
          <p className="mt-1" style={{ fontSize: 14, lineHeight: 1.5 }}>Your share isn’t the same every month: each month is paid at the deal in force that month.</p>
          <ul className="mt-2 mb-1" style={{ fontSize: 14, lineHeight: 1.6 }}>
            {touched.map((p, i) => <li key={i}><b>{periodTxt(p)}</b>: {pctTxt(p.pct)} to you · {p.deal}</li>)}
          </ul>
        </>
      )}
      {onPick && (
        <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: mixed ? 10 : 0 }}>
          <span style={{ color: C.textDim, fontSize: 13 }}>View by deal:</span>
          {periods.map((p, i) => (
            <button key={i} onClick={() => onPick(p)} className={'imss-dash-preset' + (active && active.from === p.from && active.to === p.to ? ' is-on' : '')}>{periodTxt(p)} · {pctTxt(p.pct)}</button>
          ))}
        </div>
      )}
    </section>
  );
}

function ArtistStatementView({ invoices = [], artist, revenue, masterGross, ledger, payouts, requireGenerate = false, statementFiles = [], forTeam = false }) {
  const fullExports = forTeam || ARTIST_DETAILED_EXPORTS;
  const [exportError, setExportError] = useState('');
  const [periodMode, setPeriodMode] = useState('all');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [generated, setGenerated] = useState(null);
  const [rangeError, setRangeError] = useState('');

  const artistSlug = slug(artist.name);
  const artistRevenue = useMemo(() => revenue.filter(r => r.artistSlug === artistSlug), [revenue, artistSlug]);
  const availableMonths = useMemo(() => Array.from(new Set(artistRevenue.map(r => r.month))).sort().reverse(), [artistRevenue]);
  const earliestMonth = availableMonths.length ? availableMonths[availableMonths.length - 1] : '';
  const latestMonth = availableMonths.length ? availableMonths[0] : '';

  // The period actually on screen. Gated: whatever was last generated.
  // Ungated: follows the controls live, as before.
  const shown = requireGenerate ? generated : { mode: periodMode, start: rangeStart, end: rangeEnd };

  const monthsToShow = !shown ? []
    : shown.mode === 'all'
      ? availableMonths
      : availableMonths.filter(m => (!shown.start || m >= shown.start) && (!shown.end || m <= shown.end));

  const monthRows = monthsToShow.map(month => {
    const tracks = artistRevenue.filter(r => r.month === month);
    const gross = tracks.reduce((s, r) => s + r.earning, 0);
    const splits = tracks.map(r => revenueRowSplit(r, revenue, masterGross, pctAt(artist, r.month)));
    const swift = splits.reduce((t, x) => t + x.charge, 0);
    const net = gross - swift;
    const artistShare = splits.reduce((t, x) => t + x.artistShare, 0);
    return { month, tracks, gross, swift, net, artistShare };
  });

  // Totals for the statement are summed from the rows on screen, so the
  // headline figures always reconcile against the breakdown below them.
  const periodTotals = monthRows.reduce((a, m) => ({
    gross: a.gross + m.gross, swift: a.swift + m.swift, net: a.net + m.net, artistShare: a.artistShare + m.artistShare,
  }), { gross: 0, swift: 0, net: 0, artistShare: 0 });

  const lifetime = artistLifetime(artist, revenue, masterGross);
  const recoupment = recoupmentForArtist(artist, ledger, revenue, masterGross, invoices);
  const artistPayouts = (payouts || []).filter(p => p.artistSlug === artistSlug).sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));

  function periodLabel() {
    if (!shown) return '';
    if (shown.mode === 'all' || (!shown.start && !shown.end)) return 'All periods';
    return (shown.start ? monthLabel(shown.start) : '…') + ' – ' + (shown.end ? monthLabel(shown.end) : '…');
  }
  function startCustomRange() {
    setPeriodMode('range');
    setRangeError('');
    if (!rangeStart && !rangeEnd && availableMonths.length) { setRangeStart(earliestMonth); setRangeEnd(latestMonth); }
  }
  function generate() {
    if (periodMode === 'range') {
      if (!rangeStart || !rangeEnd) { setRangeError('Pick both a start and an end month.'); return; }
      if (rangeStart > rangeEnd) { setRangeError('The start month has to come before the end month.'); return; }
    }
    setRangeError('');
    setGenerated({ mode: periodMode, start: rangeStart, end: rangeEnd });
  }
  const exportName = kind => ['imss-records', artist.name, periodLabel(), kind].join(' ').replace(/[^A-Za-z0-9]+/g, '-').toLowerCase();
  const splitOfRow = r => revenueRowSplit(r, revenue, masterGross, pctAt(artist, r.month));
  // Simple: one row per track per month, from the figures on screen.
  function exportSimple() {
    const list = monthRows.flatMap(m => m.tracks.map(t => ({ t, x: splitOfRow(t) }))).sort((a, b) => a.t.month.localeCompare(b.t.month) || a.t.title.localeCompare(b.t.title));
    const tot = list.reduce((a, { x }) => ({ g: a.g + x.gross, c: a.c + x.charge, e: a.e + x.artistShare }), { g: 0, c: 0, e: 0 });
    exportRowsToCsv(exportName('simple'), ['Statement month', 'Track', 'ISRC', 'Streams / sales', 'Gross (USD)', 'Inbound Banking Charge (USD)', 'Your earnings (USD)'],
      [...list.map(({ t, x }) => [t.month, t.title, t.isrc || '', t.quantity || '', x.gross.toFixed(2), x.charge.toFixed(2), x.artistShare.toFixed(2)]), ['Total', '', '', '', tot.g.toFixed(2), tot.c.toFixed(2), tot.e.toFixed(2)]]);
  }
  // Label Partner Copy: EMPIRE's original files for these months, unchanged.
  async function exportPartnerCopy() {
    setExportError('');
    const months = monthRows.map(m => m.month);
    const files = statementFiles.filter(f => f.artistId === artist.id && (f.months || []).some(m => months.includes(m)));
    if (!files.length) { setExportError('There’s no Label Partner Copy for this period.'); return; }
    try {
      logActivity('downloaded Label Partner Copy', periodLabel(), artist.id);
      for (const f of files) {
        const a = document.createElement('a'); a.href = await statementFileUrl(f); a.download = f.name || 'statement.csv'; a.rel = 'noopener';
        document.body.appendChild(a); a.click(); a.remove();
      }
    } catch (e) { setExportError('Could not download the Label Partner Copy. Try again in a moment.'); }
  }
  // Detailed: every line from the uploaded statements for these months.
  async function exportDetailed() {
    setExportError('');
    const months = monthRows.map(m => m.month);
    const files = statementFiles.filter(f => f.artistId === artist.id && (f.months || []).some(m => months.includes(m)));
    if (!files.length) { setExportError('There are no uploaded statement lines for this period, so only the simple version is available.'); return; }
    try {
      const lines = await statementLines(files, artistRevenue, splitOfRow, months);
      if (!lines.length) { setExportError('No statement lines match this period.'); return; }
      csvDetailed(exportName('detailed'), lines);
    } catch (e) { setExportError('Could not build the detailed statement. Try again in a moment.'); }
  }

  return (
    <div>
      <div className="imss-print-hide rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
        <div className="mb-4">
          <div className="text-xs mb-2" style={{ color: C.textFaint }}>Period</div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => { setPeriodMode('all'); setRangeError(''); }} className="text-sm px-3 py-1.5 rounded"
              style={{ background: periodMode === 'all' ? C.amberSoft : 'transparent', color: periodMode === 'all' ? C.amber : C.textDim, border: '1px solid ' + (periodMode === 'all' ? 'transparent' : C.border), fontWeight: periodMode === 'all' ? 600 : 500 }}>
              All periods
            </button>
            <button onClick={startCustomRange} className="text-sm px-3 py-1.5 rounded"
              style={{ background: periodMode === 'range' ? C.amberSoft : 'transparent', color: periodMode === 'range' ? C.amber : C.textDim, border: '1px solid ' + (periodMode === 'range' ? 'transparent' : C.border), fontWeight: periodMode === 'range' ? 600 : 500 }}>
              Custom range
            </button>
            {periodMode === 'range' && (
              <>
                <Input type="month" value={rangeStart} min={earliestMonth || undefined} max={latestMonth || undefined} onChange={e => { setRangeStart(e.target.value); setRangeError(''); }} style={{ maxWidth: 150 }} />
                <span className="text-sm" style={{ color: C.textFaint }}>to</span>
                <Input type="month" value={rangeEnd} min={earliestMonth || undefined} max={latestMonth || undefined} onChange={e => { setRangeEnd(e.target.value); setRangeError(''); }} style={{ maxWidth: 150 }} />
              </>
            )}
          </div>
          {periodMode === 'range' && availableMonths.length > 0 && (
            <div className="text-xs mt-2" style={{ color: C.textFaint }}>
              You have earnings from {monthLabel(earliestMonth)} to {monthLabel(latestMonth)}.
            </div>
          )}
          {rangeError && (
            <div className="rounded px-3 py-2 text-xs mt-3" style={{ background: C.redSoft, color: C.red, border: '1px solid ' + C.red }}>{rangeError}</div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {requireGenerate && (
            <Btn variant="primary" onClick={generate}>
              <FileText size={14} /> {generated ? 'Regenerate statement' : 'Generate statement'}
            </Btn>
          )}
          {shown && <Btn variant="ghost" onClick={exportSimple}><Download size={14} /> Simple CSV</Btn>}
          {shown && fullExports && <Btn variant="ghost" onClick={exportDetailed}><Download size={14} /> Detailed CSV</Btn>}
          {shown && fullExports && <Btn variant="ghost" onClick={exportPartnerCopy}><Download size={14} /> Label Partner Copy</Btn>}
          {exportError && <div className="w-full text-sm" role="alert" style={{ color: C.amber }}>{exportError}</div>}
          {shown && <Btn variant="ghost" onClick={() => window.print()}><Printer size={14} /> Print / save as PDF</Btn>}
        </div>
      </div>

      {!shown ? (
        <EmptyState icon={FileText} title="Choose a period to generate your statement"
          description="Pick all periods or a custom month range above, then hit Generate statement." />
      ) : (
        <>
          <div className="flex flex-wrap gap-3 mb-6">
            <KPICard icon={DollarSign} label="Gross earnings" value={formatCents(periodTotals.gross)} />
            <KPICard icon={Wallet} label="Inbound Banking Charge" value={formatCents(periodTotals.swift)} />
            {(() => {
              // The rate(s) actually used for the months on screen, not today's deal.
              const rates = [...new Set(monthRows.flatMap(m => m.tracks).map(r => Math.round((r.final ? r.artistPct : pctAt(artist, r.month)) * 10000)))];
              return <KPICard icon={TrendingUp} label="Your share" value={formatCents(periodTotals.artistShare)} tone="teal" sub={rates.length === 1 ? rates[0] / 100 + '% of net' : rates.length > 1 ? 'at your deal rates' : ''} />;
            })()}
            {recoupment.spent > 0 && (
              <KPICard icon={ClipboardList} label={recoupment.balance > 0 ? 'Still to recoup' : 'Advances recouped'} value={formatCents(recoupment.balance > 0 ? recoupment.unrecouped : recoupment.spent)} tone={recoupment.balance > 0 ? 'red' : 'teal'} sub={recoupment.balance > 0 ? 'All time: advances not yet covered by your earnings' : 'All time: fully repaid from your earnings'} />
            )}
          </div>

          <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
            <div style={{ fontWeight: 600 }}>{periodLabel()}</div>
            <div className="text-xs" style={{ color: C.textFaint }}>
              {monthRows.length} {monthRows.length === 1 ? 'month' : 'months'} with earnings
              {shown.mode !== 'all' && <> · lifetime to date {formatCents(lifetime.artistShare)}</>}
            </div>
          </div>

          <DealSpanNote artist={artist} rows={monthRows.flatMap(m => m.tracks)} active={shown.mode === 'range' ? { from: shown.dealFrom, to: shown.dealTo } : null}
            onPick={p => { const start = p.from || earliestMonth, end = p.to || latestMonth; setPeriodMode('range'); setRangeStart(start); setRangeEnd(end); setRangeError(''); setGenerated({ mode: 'range', start, end, dealFrom: p.from, dealTo: p.to }); }} />

          {monthRows.length === 0 ? (
            <EmptyState icon={DollarSign} title="No earnings in that period"
              description="Nothing was logged for the months you picked. Try a wider range, or choose all periods." />
          ) : (
            monthRows.map(({ month, tracks }) => (
              <div key={month} className="rounded border p-4 mb-5" style={{ background: C.panel, borderColor: C.border }}>
                <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                  <div style={{ fontWeight: 600 }}>{monthLabel(month)}</div>
                  {dealPeriodsOf(artist).length > 1 && <span style={{ color: C.textDim, fontSize: 13 }}>Your share: {pctTxt(tracks[0] && tracks[0].final ? tracks[0].artistPct : pctAt(artist, month))} of net</span>}
                </div>
                <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.bg }}>
                  <table className="w-full" style={{ minWidth: 320 }}>
                    <thead><tr><Th>Track</Th><Th align="right">Gross earning</Th></tr></thead>
                    <tbody>
                      {tracks.map(t => (
                        <tr key={t.id}>
                          <Td>{t.title}</Td>
                          <Td align="right" mono>{formatCents(t.earning)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}

          {artistPayouts.length > 0 && (
            <div className="mt-2">
              <div className="text-sm mb-2" style={{ fontWeight: 600 }}>Payout history</div>
              <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
                <table className="w-full" style={{ minWidth: 500 }}>
                  <thead><tr><Th>Period</Th><Th align="right">Your share</Th><Th>Status</Th></tr></thead>
                  <tbody>
                    {artistPayouts.map(p => (
                      <tr key={p.id}>
                        <Td mono>{p.periodStart} – {p.periodEnd}</Td>
                        <Td align="right" mono>{formatCents(p.artistShare)}</Td>
                        <Td><Badge tone={p.status === 'paid' ? 'teal' : 'amber'}>{p.status}</Badge></Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BackupSection({ allData, updaters, dataVersion }) {
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

  function downloadWorkbook() {
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

// Royalty breakdowns (EMPIRE detail on each revenue row).
const BREAKDOWN_FIELDS = { stores: 'Platform', countries: 'Country', types: 'Format', models: 'Model', salesMonths: 'Month earned' };
const regionNames = (() => { try { return new Intl.DisplayNames(['en'], { type: 'region' }); } catch (e) { return null; } })();
function breakdownLabel(format, key) {
  if (key === 'Not broken down') return 'Not broken down (older statements)';
  if (format === 'countries' && /^[A-Z]{2}$/.test(key) && regionNames) { try { return regionNames.of(key); } catch (e) { return key; } }
  if (format === 'salesMonths') return monthLabel(key);
  return key;
}
function RevenueBreakdownTable({ parts, label, format }) {
  const total = parts.reduce((t, p) => t + p.gross, 0) || 1;
  const top = parts.length ? parts[0].gross || 1 : 1;
  const yoursTotal = parts.reduce((t, p) => t + p.yours, 0);
  return (
    <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
      <table className="w-full" style={{ minWidth: 620, tableLayout: 'fixed' }}>
        <colgroup><col style={{ width: '30%' }} /><col /><col style={{ width: 120 }} /><col style={{ width: 80 }} /><col style={{ width: 130 }} /></colgroup>
        <thead><tr><Th>{label}</Th><Th>{''}</Th><Th align="right">Gross</Th><Th align="right">Share</Th><Th align="right">Your earnings</Th></tr></thead>
        <tbody>
          {parts.map(p => (
            <tr key={p.key}>
              <Td><span style={{ overflowWrap: 'anywhere' }}>{breakdownLabel(format, p.key)}</span></Td>
              <Td><span className="imss-ledger-bar" aria-hidden="true" style={{ display: 'block' }}><span style={{ width: Math.max(2, p.gross / top * 100) + '%' }}></span></span></Td>
              <Td align="right" mono>{formatCents(p.gross)}</Td>
              <Td align="right" mono>{Math.round(p.gross / total * 1000) / 10}%</Td>
              <Td align="right" mono><span style={{ color: C.teal, fontWeight: 600 }}>{formatCents(p.yours)}</span></Td>
            </tr>
          ))}
          <tr>
            <Td><span style={{ fontWeight: 600 }}>Total</span></Td><Td>{''}</Td>
            <Td align="right" mono><span style={{ fontWeight: 600 }}>{formatCents(total === 1 && !parts.length ? 0 : total)}</span></Td><Td>{''}</Td>
            <Td align="right" mono><span style={{ color: C.teal, fontWeight: 700 }}>{formatCents(yoursTotal)}</span></Td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// Original royalty statement files kept on an artist's profile.
// Artists' Detailed CSV and Label Partner Copy downloads. Off for now; the team always has them.
const ARTIST_DETAILED_EXPORTS = false;

// Statement exports in IMSS Records format, built from the uploaded statement
// files' lines. Each line belongs to the artist's row for that track and month
// and gets that row's charge and earnings pro rata (stored figures once published).
const codeOf = v => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
async function statementLines(files, rows, splitOf, months) {
  const out = [];
  for (const f of files) {
    const text = await (await fetch(await statementFileUrl(f))).text();
    const { lines } = parseEmpireDetailed(Papa.parse(text, { skipEmptyLines: false }).data);
    lines.forEach(l => {
      if (!months.includes(l.statementMonth)) return;
      const r = rows.find(r => r.month === l.statementMonth && ((l.isrc && codeOf(r.isrc) === codeOf(l.isrc)) || slug(r.title) === slug(l.trackTitle || l.productTitle)));
      if (!r || !r.earning) return;
      const x = splitOf(r), k = l.gross / r.earning;
      out.push({ ...l, track: r.title, charge: x.charge * k, earnings: x.artistShare * k });
    });
  }
  return out;
}
const sumOf = (list, key) => list.reduce((t, l) => t + l[key], 0);
function csvDetailed(name, lines) {
  exportRowsToCsv(name, ['Statement month', 'Sales month', 'Platform', 'Service', 'Country', 'Type', 'Commercial model', 'Usage', 'Track', 'ISRC', 'Quantity', 'Gross (USD)', 'Inbound Banking Charge (USD)', 'Your earnings (USD)'],
    [...lines.map(l => [l.statementMonth, l.salesMonth, l.serviceGroup, l.service, l.country, l.type, l.model, l.usage, l.track, l.isrc, l.quantity, l.gross.toFixed(4), l.charge.toFixed(4), l.earnings.toFixed(4)]),
     ['Total', '', '', '', '', '', '', '', '', '', '', sumOf(lines, 'gross').toFixed(2), sumOf(lines, 'charge').toFixed(2), sumOf(lines, 'earnings').toFixed(2)]]);
}
function csvByTrack(name, lines) {
  const groups = {};
  lines.forEach(l => { const k = l.statementMonth + '|' + l.track; const g = groups[k] || (groups[k] = { month: l.statementMonth, track: l.track, isrc: l.isrc, quantity: 0, gross: 0, charge: 0, earnings: 0 }); g.quantity += l.quantity; g.gross += l.gross; g.charge += l.charge; g.earnings += l.earnings; });
  const list = Object.values(groups).sort((a, b) => a.month.localeCompare(b.month) || a.track.localeCompare(b.track));
  exportRowsToCsv(name, ['Statement month', 'Track', 'ISRC', 'Streams / sales', 'Gross (USD)', 'Inbound Banking Charge (USD)', 'Your earnings (USD)'],
    [...list.map(g => [g.month, g.track, g.isrc, g.quantity, g.gross.toFixed(2), g.charge.toFixed(2), g.earnings.toFixed(2)]),
     ['Total', '', '', '', sumOf(lines, 'gross').toFixed(2), sumOf(lines, 'charge').toFixed(2), sumOf(lines, 'earnings').toFixed(2)]]);
}

// Statement files on an artist. Two IMSS-branded downloads built from the
// artist's own rows: Detailed (every line, like the uploaded report) and By
// track (one row per track per month), plus EMPIRE's original as the Label Partner Copy.
// `rows` are this artist's revenue rows; `splitOf(row)` gives charge and earnings.
function StatementFilesList({ files = [], title = 'Statement files', empty = 'Royalty statement files uploaded by the label are kept here.', sourceLabel = '', rows = [], splitOf = null, artistName = '' }) {
  const [error, setError] = useState('');
  const sorted = [...files].sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''));
  const fileName = (f, kind) => ((artistName || 'artist') + ' ' + (f.months || []).join(' ') + ' ' + kind).trim().replace(/[^A-Za-z0-9]+/g, '-').toLowerCase();
  async function original(f) {
    setError('');
    try {
      const url = await statementFileUrl(f);
      const a = document.createElement('a'); a.href = url; a.download = f.name || 'statement.csv'; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      logActivity('downloaded Label Partner Copy', (f.months || []).join(', ') + ' · ' + (f.name || ''), f.artistId);
    } catch (err) { setError('Could not download that file. Try again in a moment.'); }
  }
  async function download(f, kind) {
    setError('');
    try {
      const lines = await statementLines([f], rows, splitOf, f.months || []);
      if (!lines.length) { setError('No lines in that file match this artist’s earnings.'); return; }
      (kind === 'detailed' ? csvDetailed : csvByTrack)(fileName(f, kind === 'detailed' ? 'detailed' : 'by-track'), lines);
    } catch (err) { setError('Could not build that statement. Try again in a moment.'); }
  }
  // The release a file is for: EMPIRE names files "<Release> royalties_detailed_<stamp>.csv".
  const releaseOf = f => String(f.name || '').replace(/\.csv$/i, '').replace(/\s*royalties_detailed.*$/i, '').trim() || (f.songs || [])[0] || 'Statement';
  const songsLine = f => { const list = f.songs || []; if (!list.length) return ''; const shown = list.slice(0, 3).join(', '); return list.length + (list.length === 1 ? ' song' : ' songs') + ': ' + shown + (list.length > 3 ? ' and ' + (list.length - 3) + ' more' : ''); };
  const isArtist = !!sourceLabel;
  const pill = { background: C.fill, color: C.text, borderRadius: 980, padding: '7px 14px', fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' };
  return (
    <section aria-label={title} className="rounded" style={{ background: C.panel }}>
      <div className="imss-dash-ph"><h2>{title}</h2><span style={{ color: C.textDim, fontSize: 13 }}>{files.length} {files.length === 1 ? 'file' : 'files'}</span></div>
      {sorted.length === 0 ? <div className="px-4 pb-4" style={{ color: C.textDim, fontSize: 15 }}>{empty}</div> : (
        <ul style={{ borderTop: '1px solid ' + C.border }}>
          {sorted.map((f, i) => (
            <li key={f.id} className="flex items-center justify-between gap-4 flex-wrap" style={{ padding: '14px 18px', borderTop: i ? '1px solid ' + C.border : 'none' }}>
              <div style={{ minWidth: 0, flex: '1 1 320px' }}>
                <div style={{ fontWeight: 600, fontSize: 16, letterSpacing: '-0.01em' }}>{releaseOf(f)}</div>
                <div style={{ color: C.textDim, fontSize: 13, marginTop: 2 }}>
                  {(f.months || []).map(monthLabel).join(' – ') || '—'}{songsLine(f) ? ' · ' + songsLine(f) : ''}
                </div>
                <div style={{ color: C.textDim, fontSize: 12, marginTop: 2 }}>{isArtist ? 'Added ' : 'Uploaded '}{formatDate(String(f.uploadedAt || '').slice(0, 10))}{!isArtist && f.uploadedBy ? ' by ' + f.uploadedBy : ''}{!isArtist && f.source ? ' · ' + f.source : ''}</div>
              </div>
              <div className="flex items-center gap-3 flex-wrap justify-end">
                <div style={{ textAlign: 'right', minWidth: 90 }}>
                  <div style={{ fontWeight: 600, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>{formatCents(f.gross)}</div>
                  <div style={{ color: C.textDim, fontSize: 12 }}>gross</div>
                </div>
                {splitOf && <button onClick={() => download(f, 'track')} className="inline-flex items-center gap-1.5" style={pill}><Download size={14} aria-hidden="true" /> By track</button>}
                {splitOf && (!isArtist || ARTIST_DETAILED_EXPORTS) && <button onClick={() => download(f, 'detailed')} className="inline-flex items-center gap-1.5" style={pill}><Download size={14} aria-hidden="true" /> Detailed</button>}
                {(!isArtist || ARTIST_DETAILED_EXPORTS) && <button onClick={() => original(f)} className="inline-flex items-center gap-1.5" style={pill}><Download size={14} aria-hidden="true" /> Partner copy</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && <div className="px-4 py-3" role="alert" style={{ color: C.red, fontSize: 14 }}>{error}</div>}
    </section>
  );
}

// What a release submission needs before it can go to Catalog.
function submissionChecks(sub) {
  const collabs = sub.collaborators || [];
  const total = collabs.reduce((t, c) => t + (Number(c.splitPercent) || 0), 0);
  const credits = sub.credits || {};
  return [
    { label: 'Title and type', ok: !!(sub.title && sub.type) },
    { label: 'Proposed release date', ok: !!sub.proposedDate },
    { label: 'Artwork attached', ok: !!sub.artworkUrl },
    { label: 'Splits add up to 100% or less', ok: total <= 100 },
    { label: 'Every feature, producer and songwriter has a split %', ok: collabs.filter(c => SPLIT_REQUIRED_ROLES.includes(c.role)).every(c => c.splitPercent !== '' && c.splitPercent !== null && c.splitPercent !== undefined) },
    { label: 'Signed split sheet uploaded', ok: !!sub.splitSheet },
    { label: 'Artist confirmed everyone signed', ok: !!sub.splitsConfirmed },
    { label: 'Written by and produced by credited', ok: !!(credits.writtenBy && credits.producedBy) },
    { label: 'Duration', ok: !!sub.duration },
    { label: 'Explicit / clean set', ok: !!sub.explicit && sub.explicit !== 'Not Set' },
    { label: sub.instrumental ? 'Lyrics (instrumental, none needed)' : 'Lyrics', ok: !!sub.instrumental || !!(sub.lyrics || '').trim() },
    { label: 'About the song', ok: !!(sub.about || '').trim() },
    { label: 'Marketing and rollout plan', ok: !!((sub.rollout || {}).plan || '').trim() },
    { label: 'Required distribution docs ready', ok: missingRequiredDocs(sub.distributionDocs) === 0 },
  ];
}
const SUBMISSION_LABELS = { Pending: 'Waiting review', 'Needs info': 'Needs info', Approved: 'Accepted', Rejected: 'Rejected' };
const SUBMISSION_TONES = { Pending: 'amber', 'Needs info': 'amber', Approved: 'teal', Rejected: 'red' };

function SubmissionsSection({ releaseSubmissions, update, roster, pmScope = null, canEdit = true, sessionName = '', onAccept }) {
  const [status, setStatus] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const artistOf = id => roster.find(a => a.id === id) || {};
  const scoped = releaseSubmissions.filter(sub => !pmScope || artistOf(sub.artistId).productManager === pmScope);
  const shown = scoped.filter(sub => status === 'all' || sub.status === status).sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
  const count = st => scoped.filter(sub => sub.status === st).length;

  function setSub(sub, patch) { update(releaseSubmissions.map(x => x.id === sub.id ? { ...x, ...patch } : x)); }
  function addMessage(sub, nextStatus) {
    const text = message.trim();
    if (!text) { setError(nextStatus === 'Rejected' ? 'Say why it’s being rejected so the artist knows what to fix.' : 'Write what you need from the artist.'); return; }
    const stamp = new Date().toISOString();
    setSub(sub, { status: nextStatus, reviewedBy: sessionName, reviewedAt: stamp, messages: [...(sub.messages || []), { from: 'label', by: sessionName, at: stamp, text }] });
    setMessage(''); setError('');
  }
  function mailto(sub) {
    const a = artistOf(sub.artistId);
    const last = [...(sub.messages || [])].reverse().find(m => m.from === 'label');
    const body = 'Hi ' + (a.name || '') + ',\n\nAbout your release submission “' + sub.title + '”:\n\n' + (message.trim() || (last ? last.text : '')) + '\n\nYou can reply in your IMSS Records portal under Releases.\n\n' + sessionName;
    return 'mailto:' + encodeURIComponent(a.email || '') + '?subject=' + encodeURIComponent('IMSS Records: more info needed for “' + sub.title + '”') + '&body=' + encodeURIComponent(body);
  }

  return (
    <div>
      <SectionHeader title="Release submissions" description="New releases artists have sent in. Check each one is complete, ask for anything missing, then accept it into Catalog to add the UPC, ISRCs and the rest." />
      <div className="flex gap-1 mb-4 flex-wrap" role="tablist" aria-label="Filter by status">
        {[['all', 'All'], ['Pending', 'Waiting review'], ['Needs info', 'Needs info'], ['Approved', 'Accepted'], ['Rejected', 'Rejected']].map(([st, label]) => (
          <button key={st} role="tab" aria-selected={status === st} onClick={() => { setStatus(st); setOpenId(null); }} className="text-sm px-3 py-1.5 rounded inline-flex items-center gap-1.5"
            style={{ background: status === st ? C.amberSoft : 'transparent', color: status === st ? C.amber : C.textDim, border: '1px solid ' + (status === st ? 'transparent' : C.border), fontWeight: status === st ? 600 : 500 }}>
            {label}{(st === 'all' ? scoped.length : count(st)) > 0 && <span style={{ fontFamily: MONO_FONT, fontSize: 12 }}>{st === 'all' ? scoped.length : count(st)}</span>}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <EmptyState icon={Disc3} title={status === 'Pending' ? 'Nothing waiting for review' : 'Nothing here'} description="When an artist submits a release from their portal, it arrives here for review." />
      ) : (
        <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
          <table className="w-full" style={{ minWidth: 820 }}>
            <thead><tr><Th>Submitted</Th><Th>Artist</Th><Th>Release</Th><Th>Proposed date</Th><Th>Complete</Th><Th>Status</Th><Th align="right"></Th></tr></thead>
            <tbody>
              {shown.map(sub => {
                const checks = submissionChecks(sub), passed = checks.filter(c => c.ok).length, a = artistOf(sub.artistId), isOpen = openId === sub.id;
                const collabs = sub.collaborators || [], artistPct = Math.max(0, 100 - collabs.reduce((t, c) => t + (Number(c.splitPercent) || 0), 0));
                return (
                  <React.Fragment key={sub.id}>
                    <tr>
                      <Td mono>{formatDate((sub.submittedAt || '').slice(0, 10))}</Td>
                      <Td>{a.name || 'Unknown artist'}</Td>
                      <Td><span style={{ fontWeight: 600 }}>{sub.title}</span><div className="text-xs" style={{ color: C.textDim }}>{sub.type}{sub.genre ? ' · ' + sub.genre : ''}</div></Td>
                      <Td mono>{sub.proposedDate ? formatDate(sub.proposedDate) : '—'}</Td>
                      <Td><span style={{ fontFamily: MONO_FONT, color: passed === checks.length ? C.teal : C.amber, fontWeight: 600 }}>{passed}/{checks.length}</span></Td>
                      <Td><Badge tone={SUBMISSION_TONES[sub.status]}>{SUBMISSION_LABELS[sub.status] || sub.status}</Badge></Td>
                      <Td align="right"><button onClick={() => { setOpenId(isOpen ? null : sub.id); setMessage(''); setError(''); }} style={{ color: C.amber, fontWeight: 600, fontSize: 13 }}>{isOpen ? 'Close' : 'Review'}</button></Td>
                    </tr>
                    {isOpen && (
                      <tr><td colSpan={7} style={{ padding: 0, borderBottom: '1px solid ' + C.border }}>
                        <div className="imss-sub-review">
                          <section>
                            <h3 className="imss-sub-h">Completeness check · {passed} of {checks.length}</h3>
                            <ul className="imss-checks">
                              {checks.map(c => (
                                <li key={c.label} className={c.ok ? 'is-ok' : 'is-miss'}>{c.ok ? <CheckCircle2 size={15} aria-hidden="true" /> : <span className="imss-check-miss" aria-hidden="true" />}<span>{c.label}</span><span className="sr-only">{c.ok ? ' — done' : ' — missing'}</span></li>
                              ))}
                            </ul>
                          </section>
                          <section>
                            <h3 className="imss-sub-h">Splits</h3>
                            <table className="w-full" style={{ tableLayout: 'fixed' }}>
                              <colgroup><col /><col style={{ width: '34%' }} /><col style={{ width: 72 }} /></colgroup>
                              <tbody>
                                {collabs.map((c, i) => <tr key={i}><Td>{c.name}</Td><Td>{c.role}</Td><Td align="right" mono>{c.splitPercent}%</Td></tr>)}
                                <tr><Td><span style={{ fontWeight: 600 }}>{a.name || 'Artist'}</span></Td><Td>Primary artist</Td><Td align="right" mono><span style={{ color: C.teal, fontWeight: 600 }}>{artistPct}%</span></Td></tr>
                              </tbody>
                            </table>
                            <div className="text-sm mt-3">{sub.splitSheet ? <a href={sub.splitSheet} download={sub.splitSheetName || 'split-sheet'} style={{ color: C.amber, textDecoration: 'underline', textUnderlineOffset: 3 }}>Download signed split sheet{sub.splitSheetName ? ' (' + sub.splitSheetName + ')' : ''}</a> : <span style={{ color: C.red }}>No split sheet uploaded</span>}</div>
                            <h3 className="imss-sub-h mt-5">Credits</h3>
                            <dl className="imss-sub-dl">
                              {[['Performed by', 'performedBy'], ['Written by', 'writtenBy'], ['Produced by', 'producedBy'], ['Recording', 'recordingEngineer'], ['Mixing', 'mixingEngineer'], ['Mastering', 'masteringEngineer'], ['Dolby', 'dolbyEngineer']].map(([l, k]) => (
                                <React.Fragment key={k}><dt>{l}</dt><dd>{(sub.credits || {})[k] || '—'}</dd></React.Fragment>
                              ))}
                              <dt>Primary artists</dt><dd>{[a.name, ...(sub.primaryArtists || [])].filter(Boolean).join(', ')}</dd>
                              <dt>Duration</dt><dd>{sub.duration || '—'}</dd>
                              <dt>Explicit</dt><dd>{sub.explicit || '—'}</dd>
                              <dt>Lyrics</dt><dd>{sub.instrumental ? 'Instrumental' : (sub.lyrics ? <span style={{ whiteSpace: 'pre-wrap' }}>{sub.lyrics}</span> : '—')}</dd>
                              <dt>About</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{sub.about || '—'}</dd>
                              <dt>Rollout plan</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{(sub.rollout || {}).plan || '—'}</dd>
                              <dt>Content</dt><dd>{(sub.rollout || {}).content || '—'}</dd>
                              <dt>Shows / events</dt><dd>{(sub.rollout || {}).events || '—'}</dd>
                              <dt>Socials</dt><dd>{(sub.rollout || {}).socials || '—'}</dd>
                              <dt>Notes</dt><dd>{sub.notes || '—'}</dd>
                            </dl>
                          </section>
                          <section className="imss-sub-wide">
                            <h3 className="imss-sub-h">Messages with the artist</h3>
                            {(sub.messages || []).length === 0 ? <div className="text-sm" style={{ color: C.textDim }}>No messages yet.</div> : (
                              <ol className="imss-thread">
                                {sub.messages.map((m, i) => (
                                  <li key={i} className={m.from === 'artist' ? 'is-artist' : 'is-label'}>
                                    <div className="imss-thread-meta">{m.from === 'artist' ? (m.by || a.name) : (m.by || 'Label')} · {formatDate(String(m.at || '').slice(0, 10))}{m.via === 'email' ? ' · by email' : ''}</div>
                                    <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                                  </li>
                                ))}
                              </ol>
                            )}
                            {canEdit && (sub.status === 'Pending' || sub.status === 'Needs info') && (
                              <div className="mt-4">
                                <Field label="Message to the artist">
                                  <TextArea rows={3} value={message} onChange={e => { setMessage(e.target.value); setError(''); }} placeholder={'e.g. The split sheet is missing ' + ((collabs[0] || {}).name || 'a collaborator') + '’s signature. Please upload a signed copy.'} />
                                </Field>
                                {error && <div className="text-sm mt-2" role="alert" style={{ color: C.red }}>{error}</div>}
                                <div className="flex gap-2 flex-wrap mt-3">
                                  <Btn variant="primary" onClick={() => onAccept(sub)}><CheckCircle2 size={14} /> Accept to catalog</Btn>
                                  <Btn variant="ghost" onClick={() => addMessage(sub, 'Needs info')}><MessageSquare size={14} /> Request more info</Btn>
                                  <a href={mailto(sub)} className="imss-btn is-ghost inline-flex items-center gap-1.5" style={{ background: 'var(--fill)', color: C.text, border: '1px solid rgba(255,255,255,0.12)', fontWeight: 500 }}><Mail size={14} /> Email artist</a>
                                  <Btn variant="danger" onClick={() => addMessage(sub, 'Rejected')}>Reject</Btn>
                                </div>
                                {passed < checks.length && <div className="text-xs mt-2" style={{ color: C.amber }}>{checks.length - passed} check{checks.length - passed === 1 ? '' : 's'} not passing. You can still accept, or ask the artist first.</div>}
                                {!a.email && <div className="text-xs mt-1" style={{ color: C.textDim }}>This artist has no email on the Roster yet, so Email artist opens a blank message.</div>}
                              </div>
                            )}
                          </section>
                        </div>
                      </td></tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const INVOICE_KINDS = { expense: 'Expense claim', service: 'Services / fee' };
// Invoice approval pipeline: Submitted → PM Approval → Finance Queue → LH Queue →
// DP Queue → Pay Approved → Paid. Each waiting status names who reviews it.
const INVOICE_STAGES = [
  { status: 'PM Approval', who: 'pm', approve: 'Approve' },
  { status: 'Finance Queue', who: 'finance', approve: 'Approve' },
  { status: 'LH Queue', who: 'lh', approve: 'Approve' },
  { status: 'DP Queue', who: 'dp', approve: 'Approve for payment' },
  { status: 'Pay Approved', who: 'pay', approve: 'Mark paid' },
];
const INVOICE_FLOW = ['Submitted', ...INVOICE_STAGES.map(st => st.status), 'Paid'];
const WORKFLOW_ROLES = [
  { key: 'finance', label: 'Finance Queue' },
  { key: 'lh', label: 'LH Queue' },
  { key: 'dp', label: 'DP Queue' },
  { key: 'pay', label: 'Pay Approved', hint: 'pays the artist and marks it paid' },
];
// Older invoices used Pending / Approved.
function invoiceStatus(inv) {
  if (inv.status === 'Pending') return 'PM Approval';
  if (inv.status === 'Approved') return 'Pay Approved';
  return inv.status;
}
const invoiceStage = inv => INVOICE_STAGES.find(st => st.status === invoiceStatus(inv)) || null;
function invoiceReviewers(inv, roster, staff, workflow) {
  const stage = invoiceStage(inv);
  if (!stage) return [];
  if (stage.who === 'pm') {
    const pm = String((roster.find(a => a.id === inv.artistId) || {}).productManager || '').trim().toLowerCase();
    return staff.filter(m => pm && m.name.trim().toLowerCase() === pm);
  }
  const ids = (workflow || {})[stage.who] || [];
  return staff.filter(m => ids.includes(m.id));
}
// What the artist sees: progress, not internal queue names.
function artistInvoiceStatus(inv) {
  const st = invoiceStatus(inv);
  if (st === 'Paid' || st === 'Rejected') return st;
  if (st === 'Pay Approved') return 'Approved for payment';
  const step = INVOICE_FLOW.indexOf(st);
  return step > 0 ? 'In review · step ' + (step + 1) + ' of ' + INVOICE_FLOW.length : 'Submitted';
}
const INVOICE_TONES = { 'PM Approval': 'amber', 'Finance Queue': 'amber', 'LH Queue': 'amber', 'DP Queue': 'amber', 'Pay Approved': 'teal', Paid: 'teal', Rejected: 'red', Pending: 'amber', Approved: 'teal' };

// Messages between the label and the artist on one invoice (in app or by email).
function InvoiceThread({ inv, artistLabel }) {
  const msgs = inv.messages || [];
  if (!msgs.length) return <div className="text-sm" style={{ color: C.textDim }}>No messages yet.</div>;
  return (
    <ol className="imss-thread">
      {msgs.map((m, i) => (
        <li key={i} className={m.from === 'artist' ? 'is-artist' : 'is-label'}>
          <div className="imss-thread-meta">{m.from === 'artist' ? (m.by || artistLabel) : (m.by || 'Label')} · {formatDate(String(m.at || '').slice(0, 10))}{m.via === 'email' ? ' · by email' : ''}</div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
        </li>
      ))}
    </ol>
  );
}

function InvoicesSection({ invoices, update, roster, staff = [], labelSettings = {}, updateLabelSettings, canEdit = true, session = {}, pmScope = null }) {
  const workflow = labelSettings.invoiceWorkflow || {};
  const isAdmin = session.role === 'Admin';
  const me = staff.find(m => m.name === session.name);
  const assignedSomewhere = !!me && Object.values(workflow).some(ids => (ids || []).includes(me.id));
  const [tab, setTab] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [message, setMessage] = useState('');
  const [moveTo, setMoveTo] = useState('');
  const artistName = id => (roster.find(a => a.id === id) || {}).name || 'Unknown artist';
  const scoped = invoices.filter(i => !pmScope || assignedSomewhere || (roster.find(a => a.id === i.artistId) || {}).productManager === pmScope);
  const pmOf = inv => (roster.find(a => a.id === inv.artistId) || {}).productManager || '';
  const reviewersOf = inv => invoiceReviewers(inv, roster, staff, workflow);
  const canAct = inv => canEdit && !!invoiceStage(inv) && (isAdmin || reviewersOf(inv).some(m => me && m.id === me.id));
  // Admins can approve at PM Approval too, so those also sit in an Admin's queue.
  const mine = scoped.filter(i => invoiceStage(i) && me && (reviewersOf(i).some(m => m.id === me.id) || (isAdmin && invoiceStage(i).who === 'pm')));
  const shown = (tab === 'mine' ? mine : tab === 'all' ? scoped : scoped.filter(i => invoiceStatus(i) === tab))
    .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
  const sumBy = st => scoped.filter(i => invoiceStatus(i) === st).reduce((t, i) => t + (Number(i.amount) || 0), 0);
  const inReview = scoped.filter(i => invoiceStage(i) && invoiceStatus(i) !== 'Pay Approved');

  function move(inv, action) {
    const from = invoiceStatus(inv);
    const idx = INVOICE_STAGES.findIndex(st => st.status === from);
    const text = note.trim();
    if ((action === 'back' || action === 'reject') && !text) { setError(action === 'reject' ? 'Say why it’s rejected. The artist sees this.' : 'Say what needs changing before it comes back.'); return; }
    const to = action === 'approve' ? (INVOICE_STAGES[idx + 1] ? INVOICE_STAGES[idx + 1].status : 'Paid') : action === 'back' ? INVOICE_STAGES[idx - 1].status : 'Rejected';
    const stamp = new Date().toISOString();
    const entry = { at: stamp, by: session.name, action: action === 'approve' ? (to === 'Paid' ? 'paid' : 'approved') : action === 'back' ? 'sent back' : 'rejected', from, to, note: text };
    logActivity('invoice ' + entry.action, inv.title + ' · ' + from + ' → ' + to, inv.artistId);
    update(invoices.map(i => i.id !== inv.id ? i : {
      ...i, status: to, history: [...(i.history || []), entry],
      reviewedBy: session.name, reviewedAt: stamp,
      ...(action === 'reject' ? { reviewNote: text } : {}),
      ...(to === 'Paid' ? { paidAt: stamp } : {}),
    }));
    setNote(''); setError('');
  }
  // Admin override: put an invoice straight into any queue when the people
  // assigned to it aren't available. Logged in history like any other move.
  function adminMove(inv) {
    const from = invoiceStatus(inv);
    if (!moveTo || moveTo === from) return;
    const stamp = new Date().toISOString();
    const entry = { at: stamp, by: session.name, action: 'moved by Admin', from, to: moveTo, note: note.trim() };
    logActivity('invoice moved by Admin', inv.title + ' · ' + from + ' → ' + moveTo, inv.artistId);
    update(invoices.map(i => i.id !== inv.id ? i : {
      ...i, status: moveTo, history: [...(i.history || []), entry], reviewedBy: session.name, reviewedAt: stamp,
      ...(moveTo === 'Paid' ? { paidAt: stamp } : {}),
    }));
    setMoveTo(''); setNote(''); setError('');
  }
  function sendMessage(inv) {
    const text = message.trim();
    if (!text) return;
    update(invoices.map(i => i.id !== inv.id ? i : { ...i, messages: [...(i.messages || []), { from: 'label', by: session.name, at: new Date().toISOString(), text }] }));
    setMessage('');
  }
  function toggleAssignee(key, id) {
    const cur = workflow[key] || [];
    const next = { ...workflow, [key]: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] };
    updateLabelSettings({ ...labelSettings, invoiceWorkflow: next });
  }
  const tabs = [['all', 'All', scoped.length], ['mine', 'My queue', mine.length], ...INVOICE_STAGES.map(st => [st.status, st.status, scoped.filter(i => invoiceStatus(i) === st.status).length]), ['Paid', 'Paid', 0], ['Rejected', 'Rejected', 0]];
  const activeStaff = staff.filter(m => (m.status || 'Active') !== 'Inactive');

  return (
    <div>
      <SectionHeader title="Invoices" artistNote="their own invoices with simple progress (In review, Approved for payment, Paid, Rejected), the rejection reason, and messages. Never the internal queue names or who holds it." description="Artist expense claims and service invoices move through PM Approval, Finance, LH and DP before they’re approved for payment and paid."
        action={isAdmin && <Btn variant="ghost" onClick={() => setShowWorkflow(v => !v)}><UserCog size={14} /> {showWorkflow ? 'Close workflow' : 'Workflow'}</Btn>} />

      {isAdmin && showWorkflow && (
        <section aria-labelledby="wf-h" className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.borderLight }}>
          <h2 id="wf-h" style={{ fontWeight: 600, fontSize: 15 }}>Who handles each queue</h2>
          <p className="text-xs mt-1 mb-4" style={{ color: C.textDim }}>PM Approval goes to the artist’s Product Manager (set on the Roster) and to Admins, so either can approve it. Pick one or more people for the other queues; they get an email when an invoice reaches them. Admins can act on any queue.</p>
          <div className="imss-wf-grid">
            {WORKFLOW_ROLES.map(r => (
              <fieldset key={r.key} className="rounded border p-3" style={{ borderColor: C.border }}>
                <legend className="text-sm px-1" style={{ fontWeight: 600 }}>{r.label}</legend>
                {r.hint && <div className="text-xs mb-2" style={{ color: C.textDim }}>{r.hint}</div>}
                <div className="flex flex-col gap-1.5">
                  {activeStaff.map(m => (
                    <label key={m.id} className="flex items-center gap-2 text-sm" style={{ cursor: 'pointer' }}>
                      <input type="checkbox" checked={(workflow[r.key] || []).includes(m.id)} onChange={() => toggleAssignee(r.key, m.id)} style={{ accentColor: C.amber }} />
                      {m.name} <span className="text-xs" style={{ color: C.textDim }}>{m.role}</span>
                    </label>
                  ))}
                </div>
                {!(workflow[r.key] || []).length && <div className="text-xs mt-2" style={{ color: C.amber }}>No one assigned yet. Only Admins can move invoices on.</div>}
              </fieldset>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-3 mb-6">
        <KPICard icon={FileText} label="In review" value={formatCurrency(inReview.reduce((t, i) => t + (Number(i.amount) || 0), 0))} tone="amber" sub={inReview.length + ' invoice' + (inReview.length === 1 ? '' : 's')} />
        <KPICard icon={Wallet} label="Approved, not yet paid" value={formatCurrency(sumBy('Pay Approved'))} />
        <KPICard icon={CheckCircle2} label="Paid" value={formatCurrency(sumBy('Paid'))} tone="teal" />
      </div>

      <div className="flex gap-1 mb-4 flex-wrap" role="tablist" aria-label="Queues">
        {tabs.map(([id, label, n]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setOpenId(null); }} className="text-sm px-3 py-1.5 rounded inline-flex items-center gap-1.5"
            style={{ background: tab === id ? C.amberSoft : 'transparent', color: tab === id ? C.amber : C.textDim, border: '1px solid ' + (tab === id ? 'transparent' : C.border), fontWeight: tab === id ? 600 : 500 }}>
            {label}{n > 0 && <span style={{ fontFamily: MONO_FONT, fontSize: 12 }}>{n}</span>}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={FileText} title={tab === 'mine' ? 'Nothing waiting for you' : 'Nothing here'} description={tab === 'mine' ? 'Invoices assigned to you show up here when they reach your queue.' : 'When artists submit expense claims or service invoices, they move through these queues.'} />
      ) : (
        <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
          <table className="w-full" style={{ minWidth: 860 }}>
            <thead><tr><Th>Submitted</Th><Th>Artist</Th><Th>PM</Th><Th>Type</Th><Th>Description</Th><Th align="right">Amount</Th><Th>Stage</Th><Th>With</Th><Th align="right"><span className="sr-only">Actions</span></Th></tr></thead>
            <tbody>
              {shown.map(inv => {
                const st = invoiceStatus(inv), stage = invoiceStage(inv), reviewers = reviewersOf(inv), isOpen = openId === inv.id, idx = INVOICE_STAGES.findIndex(x => x.status === st);
                return (
                  <React.Fragment key={inv.id}>
                    <tr>
                      <Td mono>{formatDate((inv.submittedAt || '').slice(0, 10))}</Td>
                      <Td>{artistName(inv.artistId)}</Td>
                      <Td>{pmOf(inv) || <span style={{ color: C.amber }}>No PM set</span>}</Td>
                      <Td>{INVOICE_KINDS[inv.kind] || inv.kind}</Td>
                      <Td>{inv.title}</Td>
                      <Td align="right" mono>{formatCents(inv.amount)}</Td>
                      <Td><Badge tone={INVOICE_TONES[st]}>{st}</Badge></Td>
                      <Td>{stage ? (reviewers.length ? reviewers.map(m => m.name).join(', ') : <span style={{ color: C.amber }}>Unassigned</span>) : '—'}</Td>
                      <Td align="right"><Btn variant={!isOpen && canAct(inv) ? 'primary' : 'ghost'} onClick={() => { setOpenId(isOpen ? null : inv.id); setNote(''); setMessage(''); setMoveTo(''); setError(''); }}>{isOpen ? <><ChevronDown size={14} /> Close</> : canAct(inv) ? <><CheckCircle2 size={14} /> Review</> : <><Eye size={14} /> View</>}</Btn></Td>
                    </tr>
                    {isOpen && (
                      <tr><td colSpan={9} style={{ padding: 0, borderBottom: '1px solid ' + C.border }}>
                        <div className="imss-sub-review">
                          <section className="imss-sub-wide" style={{ borderTop: 'none', paddingTop: 0 }}>
                            <ol className="imss-steps" aria-label="Approval progress">
                              {INVOICE_FLOW.map((step, i) => {
                                const cur = INVOICE_FLOW.indexOf(st);
                                const state = st === 'Rejected' ? (i === 0 ? 'done' : 'todo') : i < cur || st === 'Paid' ? 'done' : i === cur ? 'current' : 'todo';
                                return <li key={step} className={'is-' + state} aria-current={state === 'current' ? 'step' : undefined}><span className="imss-step-dot" aria-hidden="true">{state === 'done' ? <CheckCircle2 size={14} /> : i + 1}</span><span>{step}</span></li>;
                              })}
                            </ol>
                            {st === 'Rejected' && <div className="text-sm mt-2" style={{ color: C.red }}>Rejected{inv.reviewedBy ? ' by ' + inv.reviewedBy : ''}: {inv.reviewNote}</div>}
                          </section>
                          <section>
                            <h3 className="imss-sub-h">Invoice</h3>
                            <dl className="imss-sub-dl">
                              <dt>Artist</dt><dd>{artistName(inv.artistId)}</dd>
                              <dt>Product Manager</dt><dd>{pmOf(inv) || <span style={{ color: C.amber }}>None set on the Roster</span>}</dd>
                              <dt>Type</dt><dd>{INVOICE_KINDS[inv.kind] || inv.kind}</dd>
                              <dt>Amount</dt><dd style={{ fontFamily: MONO_FONT }}>{formatCents(inv.amount)}</dd>
                              <dt>Invoice date</dt><dd>{formatDate(inv.invoiceDate)}</dd>
                              <dt>Invoice no.</dt><dd>{inv.invoiceNumber || '—'}</dd>
                              <dt>Pay to</dt><dd>{inv.payTo || '—'}</dd>
                              <dt>Details</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{inv.details || '—'}</dd>
                              <dt>File</dt><dd>{inv.attachment ? <a href={inv.attachment} download={inv.attachmentName || 'invoice'} style={{ color: C.amber, textDecoration: 'underline', textUnderlineOffset: 3 }}>Download {inv.attachmentName || 'file'}</a> : '—'}</dd>
                            </dl>
                          </section>
                          <section>
                            <h3 className="imss-sub-h">History</h3>
                            <ol className="imss-history">
                              <li><b>Submitted</b> by {artistName(inv.artistId)} · {formatDate((inv.submittedAt || '').slice(0, 10))}</li>
                              {(inv.history || []).map((h, i) => (
                                <li key={i}><b style={{ textTransform: 'capitalize' }}>{h.action}</b> by {h.by} · {formatDate(String(h.at).slice(0, 10))} <span style={{ color: C.textDim }}>({h.from} → {h.to})</span>{h.note && <div style={{ color: C.textDim, whiteSpace: 'pre-wrap' }}>“{h.note}”</div>}</li>
                              ))}
                            </ol>
                          </section>
                          {isAdmin && canEdit && st !== 'Rejected' && (
                            <section className="imss-sub-wide">
                              <h3 className="imss-sub-h">Admin: move to a queue</h3>
                              <p className="text-xs mb-2" style={{ color: C.textDim }}>Use this when the people on the current queue aren’t available. It skips the normal order; the move is kept in History and whoever holds the new queue is emailed.</p>
                              <div className="flex gap-2 flex-wrap items-center">
                                <Select value={moveTo} onChange={e => setMoveTo(e.target.value)} aria-label="Move invoice to" style={{ maxWidth: 240 }}>
                                  <option value="">Choose a queue…</option>
                                  {[...INVOICE_STAGES.map(x => x.status), 'Paid'].filter(x => x !== st).map(x => <option key={x} value={x}>{x}</option>)}
                                </Select>
                                <Btn variant="ghost" onClick={() => adminMove(inv)} disabled={!moveTo}><ChevronRight size={14} /> Move{moveTo ? ' to ' + moveTo : ''}</Btn>
                              </div>
                            </section>
                          )}
                          <section className="imss-sub-wide">
                            <h3 className="imss-sub-h">Messages with the artist</h3>
                            <InvoiceThread inv={inv} artistLabel={artistName(inv.artistId)} />
                            {canEdit && (
                              <div className="mt-3">
                                <Field label="Message to the artist">
                                  <TextArea rows={2} value={message} onChange={e => setMessage(e.target.value)} placeholder="e.g. Can you send the receipt for the studio deposit?" />
                                </Field>
                                <div className="mt-2"><Btn variant="ghost" onClick={() => sendMessage(inv)} disabled={!message.trim()}><MessageSquare size={14} /> Send message</Btn></div>
                                <div className="text-xs mt-1" style={{ color: C.textDim }}>The artist gets it by email and can reply to that email.</div>
                              </div>
                            )}
                          </section>
                          {canAct(inv) && (
                            <section className="imss-sub-wide">
                              <h3 className="imss-sub-h">{st}: your decision{isAdmin && !reviewers.some(m => me && m.id === me.id) ? ' (as Admin)' : ''}</h3>
                              <Field label={idx === 0 ? 'Note (needed to reject)' : 'Note (needed to send back or reject)'}>
                                <TextArea rows={2} value={note} onChange={e => { setNote(e.target.value); setError(''); }} placeholder="e.g. Receipt doesn’t match the amount" />
                              </Field>
                              {error && <div className="text-sm mt-2" role="alert" style={{ color: C.red }}>{error}</div>}
                              <div className="flex gap-2 flex-wrap mt-3">
                                <Btn variant="primary" onClick={() => move(inv, 'approve')}><CheckCircle2 size={14} /> {stage.approve}{stage.status !== 'Pay Approved' && INVOICE_STAGES[idx + 1] ? ' → ' + INVOICE_STAGES[idx + 1].status : ''}</Btn>
                                {idx > 0 && <Btn variant="ghost" onClick={() => move(inv, 'back')}><ChevronLeft size={14} /> Send back to {INVOICE_STAGES[idx - 1].status}</Btn>}
                                <Btn variant="danger" onClick={() => move(inv, 'reject')}>Reject</Btn>
                              </div>
                            </section>
                          )}
                        </div>
                      </td></tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ArtistRequestsSection({ artistRequests, update, roster, sessionName, pmScope = null }) {
  const visibleRoster = pmScope ? roster.filter(a => a.productManager === pmScope) : roster;
  const visibleArtistIds = new Set(visibleRoster.map(a => a.id));
  const visibleRequests = pmScope ? artistRequests.filter(r => visibleArtistIds.has(r.artistId)) : artistRequests;
  const [filterArtist, setFilterArtist] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [responseText, setResponseText] = useState('');

  const filtered = visibleRequests.filter(r => {
    if (filterArtist !== 'all' && r.artistId !== filterArtist) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
  const openCount = visibleRequests.filter(r => r.status !== 'Resolved').length;

  function toggleExpand(r) {
    if (expandedId === r.id) { setExpandedId(null); return; }
    setExpandedId(r.id);
    setResponseText(r.response || '');
  }
  function updateStatus(id, status) {
    update(artistRequests.map(r => r.id === id ? { ...r, status, ...(status === 'Resolved' ? { resolvedAt: new Date().toISOString() } : {}) } : r));
  }
  function submitResponse(id) {
    if (!responseText.trim()) return;
    update(artistRequests.map(r => r.id === id ? { ...r, response: responseText.trim(), respondedBy: sessionName, status: r.status === 'Open' ? 'In Progress' : r.status } : r));
  }

  return (
    <div>
      <SectionHeader title="Artist Requests" description="Everything artists have asked for — meetings, marketing support, tour funding, and more." />

      {pmScope && (
        <div className="rounded px-3 py-2 text-xs mb-4" style={{ background: C.amberSoft, color: C.amber, border: '1px solid ' + C.amber }}>
          Showing only requests from artists assigned to you as Product Manager ({visibleRequests.length} of {artistRequests.length} total).
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-6">
        <KPICard icon={MessageSquare} label="Open requests" value={openCount} tone={openCount > 0 ? 'amber' : undefined} />
      </div>

      <div className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
        <div className="imss-form-grid gap-3">
          <Field label="Artist">
            <Select value={filterArtist} onChange={e => setFilterArtist(e.target.value)}>
              <option value="all">All artists</option>
              {visibleRoster.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All</option>
              {REQUEST_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
        </div>
      </div>

      {sorted.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No requests" description="Requests artists submit from their portal will show up here." />
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map(r => {
            const artist = roster.find(a => a.id === r.artistId);
            const expanded = expandedId === r.id;
            return (
              <div key={r.id} className="rounded border overflow-hidden" style={{ background: C.panel, borderColor: C.border }}>
                <button onClick={() => toggleExpand(r)} className="w-full text-left p-4 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge tone="teal">{artist ? artist.name : 'Unknown'}</Badge>
                      <Badge>{r.category}</Badge>
                      <Badge tone={r.status === 'Resolved' ? 'teal' : r.status === 'In Progress' ? 'amber' : 'default'}>{r.status}</Badge>
                    </div>
                    <div style={{ fontWeight: 600 }}>{r.title}</div>
                    <div className="text-xs mt-0.5" style={{ color: C.textFaint }}>{formatDate(r.submittedAt.slice(0, 10))}</div>
                  </div>
                  <ChevronDown size={16} color={C.textFaint} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
                </button>
                {expanded && (
                  <div className="px-4 pb-4">
                    <div className="rounded p-3 text-sm mb-3" style={{ background: C.bg, color: C.textDim }}>{r.message}</div>
                    {(r.messages || []).length > 0 && (
                            <ol className="imss-thread mb-3">
                              {r.messages.map((m, i) => (
                                <li key={i} className={m.from === 'artist' ? 'is-artist' : 'is-label'}>
                                  <div className="imss-thread-meta">{m.from === 'artist' ? (m.by || 'Artist') : (m.by || 'IMSS Records')} · {formatDate(String(m.at || '').slice(0, 10))}{m.via === 'email' ? ' · by email' : ''}</div>
                                  <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                                </li>
                              ))}
                            </ol>
                          )}
                    <Field label="Response" full><TextArea rows={3} value={responseText} onChange={e => setResponseText(e.target.value)} placeholder="Reply to the artist…" /></Field>
                    <div className="flex gap-2 flex-wrap mt-2">
                      <Btn variant="primary" onClick={() => submitResponse(r.id)}>Send response</Btn>
                      {REQUEST_STATUSES.filter(s => s !== r.status).map(s => (
                        <Btn key={s} variant="ghost" onClick={() => updateStatus(r.id, s)}>Mark {s}</Btn>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TasksSection({ tasks, update, staff, roster, catalog }) {
  const empty = { title: '', assignee: staff[0] ? staff[0].name : '', dueDate: todayStr(), status: 'Open', notes: '', artistId: '', releaseId: '' };
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [confirmId, setConfirmId] = useState(null);
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [filterStatus, setFilterStatus] = useState('Open');
  const [filterArtist, setFilterArtist] = useState('all');
  const [view, setView] = useState('list');

  function openAdd() { setForm({ ...empty, assignee: staff[0] ? staff[0].name : '' }); setEditing(null); setShowForm(true); }
  function openEdit(t) { setForm({ ...empty, ...t }); setEditing(t.id); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); }
  function setFormArtist(artistId) { setForm(f => ({ ...f, artistId, releaseId: '' })); }
  function save(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.assignee) return;
    if (editing) update(tasks.map(t => t.id === editing ? { ...form, id: editing } : t));
    else update([...tasks, { ...form, id: uid(), createdAt: todayStr() }]);
    closeForm();
  }
  function remove(id) { update(tasks.filter(t => t.id !== id)); setConfirmId(null); }
  function toggleDone(t) { update(tasks.map(x => x.id === t.id ? { ...x, status: x.status === 'Done' ? 'Open' : 'Done' } : x)); }

  const formReleases = form.artistId ? catalog.filter(c => c.artistId === form.artistId) : [];

  const filtered = tasks.filter(t => {
    if (filterAssignee !== 'all' && t.assignee !== filterAssignee) return false;
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterArtist !== 'all' && t.artistId !== filterArtist) return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  const openCount = tasks.filter(t => t.status === 'Open').length;
  const overdueCount = tasks.filter(t => t.status === 'Open' && t.dueDate && t.dueDate < todayStr()).length;

  const workload = useMemo(() => {
    const map = {};
    staff.forEach(s => { map[s.name] = { name: s.name, open: 0, overdue: 0 }; });
    tasks.forEach(t => {
      if (t.status !== 'Open') return;
      if (!map[t.assignee]) map[t.assignee] = { name: t.assignee, open: 0, overdue: 0 };
      map[t.assignee].open += 1;
      if (t.dueDate && t.dueDate < todayStr()) map[t.assignee].overdue += 1;
    });
    return Object.values(map).sort((a, b) => b.open - a.open);
  }, [tasks, staff]);
  const maxOpen = Math.max(1, ...workload.map(w => w.open));

  function linkBadge(t) {
    const artist = t.artistId ? roster.find(a => a.id === t.artistId) : null;
    const release = t.releaseId ? catalog.find(c => c.id === t.releaseId) : null;
    if (!artist) return null;
    return <Badge>{release ? release.title : artist.name}</Badge>;
  }

  return (
    <div>
      <SectionHeader title="Tasks" description="Shared to-dos across the team — assign, track, and close out." action={<Btn variant="primary" onClick={openAdd}><Plus size={14} /> Add task</Btn>} />

      <div className="flex flex-wrap gap-3 mb-6">
        <KPICard icon={ClipboardList} label="Open tasks" value={openCount} />
        <KPICard icon={ClipboardList} label="Overdue" value={overdueCount} tone={overdueCount > 0 ? 'red' : undefined} />
      </div>

      <div className="imss-print-hide flex items-center gap-1 mb-6">
        {[['list', 'List'], ['workload', 'Workload']].map(([id, label]) => (
          <button key={id} onClick={() => setView(id)} className="text-sm px-3 py-1.5 rounded"
            style={{ background: view === id ? C.amberSoft : 'transparent', color: view === id ? C.amber : C.textDim, border: '1px solid ' + (view === id ? 'transparent' : C.border), fontWeight: view === id ? 600 : 500 }}>
            {label}
          </button>
        ))}
      </div>

      {view === 'workload' ? (
        workload.every(w => w.open === 0) ? (
          <EmptyState icon={ClipboardList} title="No open tasks" description="Workload per person shows up here once tasks are assigned." />
        ) : (
          <div className="rounded border p-4" style={{ background: C.panel, borderColor: C.border }}>
            <div className="flex flex-col gap-3">
              {workload.filter(w => w.open > 0).map(w => (
                <div key={w.name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>{w.name}</span>
                    <span style={{ color: C.textFaint }}>{w.open} open{w.overdue > 0 ? ' · ' + w.overdue + ' overdue' : ''}</span>
                  </div>
                  <div className="rounded-full overflow-hidden" style={{ height: 6, background: C.panel2 }}>
                    <div style={{ height: 6, width: (w.open / maxOpen * 100) + '%', background: w.overdue > 0 ? C.red : C.amber }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        <>
          <div className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
            <div className="imss-form-grid gap-3">
              <Field label="Assignee">
                <Select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)}>
                  <option value="all">Everyone</option>
                  {staff.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </Select>
              </Field>
              <Field label="Artist">
                <Select value={filterArtist} onChange={e => setFilterArtist(e.target.value)}>
                  <option value="all">All artists</option>
                  {roster.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </Field>
              <Field label="Status">
                <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="all">All</option>
                  {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
            </div>
          </div>

          <ExportBar filename="imss-tasks" headers={['Task', 'Assignee', 'Artist', 'Release', 'Due Date', 'Status', 'Notes']} rows={sorted.map(t => {
            const artist = t.artistId ? roster.find(a => a.id === t.artistId) : null;
            const release = t.releaseId ? catalog.find(c => c.id === t.releaseId) : null;
            return [t.title, t.assignee, artist ? artist.name : '', release ? release.title : '', t.dueDate || '', t.status, t.notes || ''];
          })} />

          {showForm && (
            <form onSubmit={save} className="rounded border p-4 mb-6 imss-form-grid gap-3" style={{ background: C.panel, borderColor: C.borderLight }}>
              <Field label="Task" full><Input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Confirm split sheet" /></Field>
              <Field label="Assignee">
                <Select value={form.assignee} onChange={e => setForm({ ...form, assignee: e.target.value })}>
                  {staff.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </Select>
              </Field>
              <Field label="Due date"><Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} /></Field>
              <Field label="Related artist">
                <Select value={form.artistId} onChange={e => setFormArtist(e.target.value)}>
                  <option value="">— none —</option>
                  {roster.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </Field>
              <Field label="Related release">
                <Select value={form.releaseId} onChange={e => setForm({ ...form, releaseId: e.target.value })} disabled={!form.artistId}>
                  <option value="">— none —</option>
                  {formReleases.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </Select>
              </Field>
              <Field label="Status">
                <Select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  {TASK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Field>
              <Field label="Notes" full><TextArea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field>
              <div className="imss-span-2 flex gap-2 mt-1">
                <Btn variant="primary" type="submit">{editing ? 'Save changes' : 'Add task'}</Btn>
                <Btn variant="ghost" onClick={closeForm}>Cancel</Btn>
              </div>
            </form>
          )}

          {sorted.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Nothing here" description="Add a task to get the team aligned on what's next." />
          ) : (
            <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
              <table className="w-full" style={{ minWidth: 680 }}>
                <thead><tr><Th></Th><Th>Task</Th><Th>Assignee</Th><Th>Related to</Th><Th>Due</Th><Th>Status</Th><Th align="right">Actions</Th></tr></thead>
                <tbody>
                  {sorted.map(t => {
                    const overdue = t.status === 'Open' && t.dueDate && t.dueDate < todayStr();
                    return (
                      <tr key={t.id} style={{ opacity: t.status === 'Done' ? 0.55 : 1 }}>
                        <Td><input type="checkbox" checked={t.status === 'Done'} onChange={() => toggleDone(t)} /></Td>
                        <Td style={{ textDecoration: t.status === 'Done' ? 'line-through' : 'none' }}>{t.title}</Td>
                        <Td>{t.assignee}</Td>
                        <Td>{linkBadge(t) || '—'}</Td>
                        <Td mono style={{ color: overdue ? C.red : undefined }}>{t.dueDate ? formatDate(t.dueDate) : '—'}</Td>
                        <Td><Badge tone={t.status === 'Done' ? 'teal' : overdue ? 'red' : 'amber'}>{overdue ? 'Overdue' : t.status}</Badge></Td>
                        <Td align="right">
                          {confirmId === t.id ? <ConfirmInline onConfirm={() => remove(t.id)} onCancel={() => setConfirmId(null)} /> : (
                            <span className="inline-flex gap-3 justify-end">
                              <button onClick={() => openEdit(t)} style={{ color: C.textDim }}><Pencil size={14} /></button>
                              <button onClick={() => setConfirmId(t.id)} style={{ color: C.textDim }}><Trash2 size={14} /></button>
                            </span>
                          )}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ActivityLogSection({ activityLog }) {
  const [search, setSearch] = useState('');
  const filtered = activityLog.filter(e => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (e.actor || '').toLowerCase().includes(q) || (e.section || '').toLowerCase().includes(q);
  });

  return (
    <div>
      <SectionHeader title="Activity Log" description="A running record of who changed what across the dashboard." />
      <div className="flex items-center gap-2 mb-6 rounded border px-3 py-2" style={{ borderColor: C.border, background: C.panel, maxWidth: 320 }}>
        <Search size={14} color={C.textFaint} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter by person or section" className="w-full text-sm bg-transparent" style={{ color: C.text, fontFamily: HEADING_FONT, border: 'none' }} />
      </div>
      <ExportBar filename="imss-activity-log" headers={['When', 'Who', 'What']} rows={filtered.map(e => [new Date(e.timestamp).toLocaleString(), e.actor, e.actor + ' ' + e.action + ' ' + e.section])} />
      {filtered.length === 0 ? (
        <EmptyState icon={History} title="Nothing logged yet" description="Changes made across the dashboard will show up here as they happen." />
      ) : (
        <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
          <table className="w-full" style={{ minWidth: 480 }}>
            <thead><tr><Th>When</Th><Th>Who</Th><Th>What</Th></tr></thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id}>
                  <Td mono>{new Date(e.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Td>
                  <Td>{e.actor}</Td>
                  <Td>{e.actor} {e.action} {e.section}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatementsSection({ roster, revenue, masterGross, ledger, payouts, statementFiles = [], invoices = [] }) {
  const activeArtists = roster.filter(a => a.status === 'Active');
  const defaultArtist = activeArtists[0] || roster[0] || null;
  const [selectedArtist, setSelectedArtist] = useState(defaultArtist ? defaultArtist.id : '');
  const artist = roster.find(a => a.id === selectedArtist) || null;

  return (
    <div>
      <SectionHeader title="Statements" artistNote="nothing. This is your preview; artists get statements through Payouts → Send to artist." description="A per-artist royalty statement, generated on demand from revenue and money received." />
      <div className="rounded border p-4 mb-6 imss-print-hide" style={{ background: C.panel, borderColor: C.border }}>
        <Field label="Artist">
          <Select value={selectedArtist} onChange={e => setSelectedArtist(e.target.value)}>
            {roster.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>
      </div>
      {artist ? (
        <ArtistStatementView invoices={invoices} artist={artist} revenue={revenue} masterGross={masterGross} ledger={ledger} payouts={payouts} statementFiles={statementFiles} requireGenerate forTeam />
      ) : (
        <EmptyState icon={DollarSign} title="No artists on roster" description="Add an artist to the roster to generate a statement." />
      )}
    </div>
  );
}

function LedgerSection({ invoices = [], ledger: rawLedger, update, roster: fullRoster, revenue, masterGross, canEdit = true, isAdmin = false, sessionName = '', pmScope = null }) {
  // A Product Manager only sees the ledger for the artists they manage — never
  // company-wide overhead, and never another PM's roster.
  const roster = useMemo(() => pmScope ? fullRoster.filter(a => a.productManager === pmScope) : fullRoster, [fullRoster, pmScope]);
  const scopedNames = useMemo(() => new Set(roster.map(a => a.name)), [roster]);
  const ledger = useMemo(() => pmScope ? rawLedger.filter(l => l.artist && scopedNames.has(l.artist)) : rawLedger, [rawLedger, pmScope, scopedNames]);
  const empty = { type: 'expense', artist: '', category: LEDGER_CATEGORIES[0], description: '', amount: '', date: todayStr(), recoupable: false, enteredBy: '' };
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [confirmId, setConfirmId] = useState(null);
  const [filterArtist, setFilterArtist] = useState('all');
  const [filterType, setFilterType] = useState('all');

  function openAdd() { setForm(empty); setEditing(null); setShowForm(true); }
  function openEdit(x) { setForm({ type: x.type, artist: x.artist || '', category: x.category, description: x.description || '', amount: String(x.amount), date: x.date, recoupable: !!x.recoupable, enteredBy: x.enteredBy || '' }); setEditing(x.id); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); }
  function save(e) {
    e.preventDefault();
    const amt = Number(form.amount);
    if (!amt || amt <= 0) return;
    const approval = isAdmin
      ? { approvalStatus: 'Approved', approvedBy: sessionName, approvedAt: todayStr() }
      : { approvalStatus: 'Pending', approvedBy: '', approvedAt: '' };
    const payload = { ...form, artist: form.artist || null, amount: amt, recoupable: form.type === 'expense' && !!form.recoupable, createdAt: Date.parse(form.date) || Date.now(), ...approval };
    if (editing) update(ledger.map(x => x.id === editing ? { ...payload, id: editing } : x));
    else update([...ledger, { ...payload, id: uid() }]);
    closeForm();
  }
  function remove(id) { update(ledger.filter(x => x.id !== id)); setConfirmId(null); }
  function approveEntry(id) { update(ledger.map(x => x.id === id ? { ...x, approvalStatus: 'Approved', approvedBy: sessionName, approvedAt: todayStr() } : x)); }
  function rejectEntry(id) { update(ledger.map(x => x.id === id ? { ...x, approvalStatus: 'Rejected', approvedBy: sessionName, approvedAt: todayStr() } : x)); }

  const approvedLedger = useMemo(() => ledger.filter(x => (x.approvalStatus || 'Approved') === 'Approved'), [ledger]);
  const recoupmentByArtist = useMemo(() => roster.map(a => ({ artist: a, ...recoupmentForArtist(a, approvedLedger, revenue, masterGross, invoices) })).filter(r => r.spent > 0), [invoices, roster, approvedLedger, revenue, masterGross]);

  const filtered = ledger.filter(x => {
    if (filterArtist !== 'all' && (filterArtist === '__general__' ? x.artist : x.artist !== filterArtist)) return false;
    if (filterType !== 'all' && x.type !== filterType) return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const totals = ledgerTotals(filtered.filter(x => (x.approvalStatus || 'Approved') === 'Approved'));
  const totalRecoupable = filtered.filter(x => x.type === 'expense' && x.artist).reduce((s, x) => s + x.amount, 0);
  const pendingCount = ledger.filter(x => x.approvalStatus === 'Pending').length;

  return (
    <div>
      <SectionHeader title="Expenses & income" artistNote="approved expenses recorded against their name, in their Expenses tab. Recoupable ones reduce what they’re due." description="Non-royalty income and expenses — advances, recording costs, marketing spend, and anything else that isn't distributor revenue. Recoupable expenses reduce what an artist is due until their share covers them." action={canEdit && <Btn variant="primary" onClick={openAdd}><Plus size={14} /> Add entry</Btn>} />

      <div className="flex flex-wrap gap-3 mb-6">
        <KPICard icon={TrendingUp} label="Income" value={formatCurrency(totals.income)} tone="teal" />
        <KPICard icon={Wallet} label="Expense" value={formatCurrency(totals.expense)} />
        <KPICard icon={DollarSign} label="Net" value={formatCurrency(totals.net)} tone={totals.net < 0 ? 'red' : 'teal'} />
        <KPICard icon={ClipboardList} label="Pending approval" value={pendingCount} tone={pendingCount ? 'amber' : undefined} />
      </div>

      {!isAdmin && pendingCount > 0 && (
        <div className="rounded px-3 py-2 text-xs mb-6" style={{ background: C.amberSoft, color: C.amber, border: '1px solid ' + C.amber }}>
          Entries you log need Admin approval before they count toward recoupment or the label P&amp;L.
        </div>
      )}

      <div className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
        <div className="imss-form-grid gap-3">
          <Field label="Type">
            <Select value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="all">Income + expense</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </Select>
          </Field>
          <Field label="Artist">
            <Select value={filterArtist} onChange={e => setFilterArtist(e.target.value)}>
              <option value="all">All artists</option>
              <option value="__general__">Label Ops (no artist)</option>
              {roster.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
            </Select>
          </Field>
        </div>
      </div>

      {showForm && (
        <form onSubmit={save} className="rounded border p-4 mb-6 imss-form-grid gap-3" style={{ background: C.panel, borderColor: C.borderLight }}>
          <Field label="Type">
            <Select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </Select>
          </Field>
          <Field label="Artist (optional)">
            <Select value={form.artist} onChange={e => setForm({ ...form, artist: e.target.value })}>
              <option value="">Label Ops (no artist)</option>
              {roster.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
            </Select>
          </Field>
          <Field label="Category">
            <Select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {LEDGER_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Amount (USD)"><Input type="number" min="0" step="0.01" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></Field>
          <Field label="Date"><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Description" full><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="e.g. Studio time for Afterglow" /></Field>
          {form.type === 'expense' && (
            <div className="imss-span-2" style={{ color: C.textDim, fontSize: 14 }}>{form.artist ? 'Recorded against ' + form.artist + ', so it’s recouped from their earnings and counts against their budget.' : 'No artist chosen: a label cost, not recouped from anyone.'}</div>
          )}
          {form.type === 'income' && form.category === 'Cash repayment' && (
            <div className="imss-span-2" style={{ color: C.textDim, fontSize: 14 }}>{form.artist ? 'Cash ' + form.artist + ' paid back at the label’s request. It settles their recoupable spend; their earnings aren’t touched.' : 'Choose the artist who paid the cash back.'}</div>
          )}
          <Field label="Entered by"><Input value={form.enteredBy} onChange={e => setForm({ ...form, enteredBy: e.target.value })} placeholder="Your name" /></Field>
          <div className="imss-span-2 flex gap-2 mt-1">
            <Btn variant="primary" type="submit">{editing ? 'Save changes' : 'Add entry'}</Btn>
            <Btn variant="ghost" onClick={closeForm}>Cancel</Btn>
          </div>
        </form>
      )}

      <ExportBar filename="imss-ledger" headers={['Date', 'Type', 'Artist', 'Category', 'Description', 'Recoupable', 'Amount']} rows={sorted.map(x => [x.date, x.type, x.artist || 'Label Ops', x.category, x.description || '', x.type === 'expense' && x.artist ? 'Yes' : 'No', x.amount])} />

      <div className="text-xs mb-3" style={{ color: C.textFaint }}>Recoupment status by artist</div>
      {recoupmentByArtist.length === 0 ? (
        <EmptyState icon={Wallet} title="Nothing to recoup yet" description="Expenses recorded against an artist, and their approved expense claims, show here as the artist earns them back." />
      ) : (
        <div className="rounded border overflow-x-auto mb-6" style={{ borderColor: C.border, background: C.panel }}>
          <table className="w-full" style={{ minWidth: 620 }}>
            <thead><tr><Th>Artist</Th><Th align="right">Spent on artist (label + approved claims)</Th><Th align="right">Earned (artist share)</Th><Th align="right">Balance</Th></tr></thead>
            <tbody>
              {recoupmentByArtist.map(r => (
                <tr key={r.artist.id}>
                  <Td>{r.artist.name}</Td>
                  <Td align="right" mono>{formatCurrency(r.spent)}</Td>
                  <Td align="right" mono>{formatCurrency(r.earned)}</Td>
                  <Td align="right" mono>
                    {r.balance > 0
                      ? <span style={{ color: C.red, fontWeight: 600 }}>{formatCurrency(r.unrecouped)} unrecouped</span>
                      : <span style={{ color: C.teal, fontWeight: 600 }}>Fully recouped{r.dueOnTop > 0 ? ' · ' + formatCurrency(r.dueOnTop) + ' due' : ''}</span>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs mb-3" style={{ color: C.textFaint }}>Entry log</div>
      {sorted.length === 0 ? (
        <EmptyState icon={DollarSign} title="No ledger entries recorded" description="Add a recording cost, advance, marketing spend, or non-royalty income to start tracking it." />
      ) : (
        <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
          <table className="w-full" style={{ minWidth: 720 }}>
            <thead><tr><Th>Date</Th><Th>Type</Th><Th>Artist</Th><Th>Category</Th><Th>Description</Th><Th>Recoupable</Th><Th align="right">Amount</Th><Th>Approval</Th><Th align="right">Actions</Th></tr></thead>
            <tbody>
              {sorted.map(x => {
                const approval = x.approvalStatus || 'Approved';
                return (
                  <tr key={x.id}>
                    <Td mono>{formatDate(x.date)}</Td>
                    <Td><Badge tone={x.type === 'income' ? 'teal' : 'default'}>{x.type}</Badge></Td>
                    <Td>{x.artist || 'Label Ops'}</Td>
                    <Td><Badge>{x.category}</Badge></Td>
                    <Td>{x.description || '—'}</Td>
                    <Td>{x.type === 'expense' && x.artist ? <Badge tone="amber">Yes</Badge> : <Badge>No</Badge>}</Td>
                    <Td align="right" mono>{formatCurrency(x.amount)}</Td>
                    <Td>
                      <Badge tone={approval === 'Approved' ? 'teal' : approval === 'Rejected' ? 'red' : 'amber'}>{approval}</Badge>
                      {isAdmin && approval === 'Pending' && (
                        <span className="inline-flex gap-2 ml-2">
                          <button onClick={() => approveEntry(x.id)} className="text-xs" style={{ color: C.teal }}>Approve</button>
                          <button onClick={() => rejectEntry(x.id)} className="text-xs" style={{ color: C.red }}>Reject</button>
                        </span>
                      )}
                    </Td>
                    <Td align="right">
                      {confirmId === x.id ? <ConfirmInline onConfirm={() => remove(x.id)} onCancel={() => setConfirmId(null)} /> : canEdit ? (
                        <span className="inline-flex gap-3 justify-end">
                          <button onClick={() => openEdit(x)} style={{ color: C.textDim }}><Pencil size={14} /></button>
                          <button onClick={() => setConfirmId(x.id)} style={{ color: C.textDim }}><Trash2 size={14} /></button>
                        </span>
                      ) : <span style={{ color: C.textFaint }}>—</span>}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BudgetSection({ labelBudgets, update, ledger, roster, canEdit = true }) {
  const expenses = useMemo(() => ledger.filter(x => x.type === 'expense'), [ledger]);
  const empty = { category: LEDGER_CATEGORIES[0], allocated: '' };
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [confirmId, setConfirmId] = useState(null);

  function openAdd() { setForm(empty); setEditing(null); setShowForm(true); }
  function openEdit(b) { setForm({ ...b, allocated: String(b.allocated) }); setEditing(b.id); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); }
  function save(e) {
    e.preventDefault();
    const amt = Number(form.allocated);
    if (!amt || amt < 0) return;
    const payload = { ...form, allocated: amt };
    if (editing) update(labelBudgets.map(b => b.id === editing ? { ...payload, id: editing } : b));
    else update([...labelBudgets, { ...payload, id: uid() }]);
    closeForm();
  }
  function remove(id) { update(labelBudgets.filter(b => b.id !== id)); setConfirmId(null); }

  const categoriesWithBudget = new Set(labelBudgets.map(b => b.category));
  const availableCategories = LEDGER_CATEGORIES.filter(c => editing ? true : !categoriesWithBudget.has(c));

  const spendByCategory = useMemo(() => {
    const map = {};
    expenses.forEach(x => { map[x.category] = (map[x.category] || 0) + x.amount; });
    return map;
  }, [expenses]);

  const rows = labelBudgets.map(b => {
    const spent = spendByCategory[b.category] || 0;
    const remaining = b.allocated - spent;
    const pct = b.allocated > 0 ? Math.min(100, Math.round((spent / b.allocated) * 100)) : 0;
    return { ...b, spent, remaining, pct };
  }).sort((a, b) => b.allocated - a.allocated);

  const totalAllocated = labelBudgets.reduce((s, b) => s + b.allocated, 0);
  const totalSpentAcrossBudgeted = rows.reduce((s, r) => s + r.spent, 0);
  const totalSpentOverall = expenses.reduce((s, x) => s + x.amount, 0);
  const unbudgetedSpend = totalSpentOverall - totalSpentAcrossBudgeted;
  const artistTiedSpend = expenses.filter(x => x.artist).reduce((s, x) => s + x.amount, 0);
  const labelOpsSpend = totalSpentOverall - artistTiedSpend;

  return (
    <div>
      <SectionHeader title="Budget" artistNote="nothing. Budgets are internal." description="Label-wide budget planning by category, tracked against everything logged in Expenses — artist-specific and label operations alike. Visible to team members only." action={canEdit && <Btn variant="primary" onClick={openAdd}><Plus size={14} /> Allocate budget</Btn>} />

      <div className="flex flex-wrap gap-3 mb-6">
        <KPICard icon={DollarSign} label="Total allocated" value={formatCurrency(totalAllocated)} />
        <KPICard icon={DollarSign} label="Spent (budgeted categories)" value={formatCurrency(totalSpentAcrossBudgeted)} tone="amber" />
        <KPICard icon={Wallet} label="Remaining" value={formatCurrency(totalAllocated - totalSpentAcrossBudgeted)} tone={(totalAllocated - totalSpentAcrossBudgeted) < 0 ? 'red' : 'teal'} />
        <KPICard icon={Users} label="Artist-tied spend" value={formatCurrency(artistTiedSpend)} sub={formatCurrency(labelOpsSpend) + ' label ops'} />
      </div>

      {showForm && (
        <form onSubmit={save} className="rounded border p-4 mb-6 imss-form-grid gap-3" style={{ background: C.panel, borderColor: C.borderLight }}>
          <Field label="Category">
            <Select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} disabled={!!editing}>
              {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Allocated amount"><Input type="number" min="0" step="0.01" value={form.allocated} onChange={e => setForm({ ...form, allocated: e.target.value })} /></Field>
          <div className="imss-span-2 flex gap-2 mt-1">
            <Btn variant="primary" type="submit">{editing ? 'Save changes' : 'Add allocation'}</Btn>
            <Btn variant="ghost" onClick={closeForm}>Cancel</Btn>
          </div>
        </form>
      )}

      {rows.length === 0 ? (
        <EmptyState icon={DollarSign} title="No budget allocated yet" description="Set an allocation per category to start tracking spend against it." />
      ) : (
        <div className="flex flex-col gap-3 mb-6">
          {rows.map(r => (
            <div key={r.id} className="rounded border p-4" style={{ background: C.panel, borderColor: C.border }}>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Badge>{r.category}</Badge>
                  {r.pct >= 100 && <Badge tone="red">Over budget</Badge>}
                  {r.pct >= 80 && r.pct < 100 && <Badge tone="amber">Nearly spent</Badge>}
                </div>
                <div className="text-xs" style={{ color: C.textFaint }}>{formatCurrency(r.spent)} of {formatCurrency(r.allocated)} spent</div>
              </div>
              <div className="rounded-full overflow-hidden" style={{ height: 8, background: C.panel2 }}>
                <div style={{ height: 8, width: r.pct + '%', background: r.remaining < 0 ? C.red : C.amber }} />
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="text-xs" style={{ color: C.textFaint }}>Remaining: <span style={{ color: r.remaining < 0 ? C.red : C.teal, fontFamily: MONO_FONT }}>{formatCurrency(r.remaining)}</span></div>
                {canEdit && (
                  confirmId === r.id ? <ConfirmInline onConfirm={() => remove(r.id)} onCancel={() => setConfirmId(null)} /> : (
                    <span className="inline-flex gap-3">
                      <button onClick={() => openEdit(r)} style={{ color: C.textDim }}><Pencil size={14} /></button>
                      <button onClick={() => setConfirmId(r.id)} style={{ color: C.textDim }}><Trash2 size={14} /></button>
                    </span>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {unbudgetedSpend > 0 && (
        <div className="rounded px-3 py-2 text-xs" style={{ background: C.amberSoft, color: C.amber, border: '1px solid ' + C.amber }}>
          {formatCurrency(unbudgetedSpend)} has been spent in categories with no budget allocation yet — add an allocation above to start tracking it.
        </div>
      )}
    </div>
  );
}

function PayoutsSection({ invoices = [], payouts, update, roster, revenue, masterGross, ledger, canEdit = true }) {
  const empty = { artistId: roster[0] ? roster[0].id : '', periodStart: todayStr().slice(0, 7), periodEnd: todayStr().slice(0, 7), notes: '' };
  const [form, setForm] = useState(empty);
  const [confirmId, setConfirmId] = useState(null);

  const selectedArtist = roster.find(a => a.id === form.artistId) || null;
  const preview = selectedArtist ? payoutStatementFor(selectedArtist, form.periodStart, form.periodEnd, revenue, masterGross) : null;
  // The artist's last real (non-draft) statement before this period carries any under-threshold balance in.
  const previousFor = (aSlug, start) => [...payouts].filter(p => p.artistSlug === aSlug && p.status !== 'draft' && p.periodEnd < start).sort((x, y) => y.periodEnd.localeCompare(x.periodEnd))[0] || null;
  const terms = selectedArtist ? reportingTerms(selectedArtist) : null;
  const carry = preview ? applyThreshold(preview.artistShare, previousFor(slug(selectedArtist.name), form.periodStart), terms.threshold) : null;
  const today = todayStr();
  const dueList = roster.filter(a => (a.status || 'Active') === 'Active').map(a => {
    const per = lastClosedPeriod(a, today), aSlug = slug(a.name);
    const done = payouts.find(p => p.artistSlug === aSlug && p.periodStart === per.start && p.periodEnd === per.end && p.status !== 'draft');
    const share = payoutStatementFor(a, per.start, per.end, revenue, masterGross).artistShare;
    const c = applyThreshold(share, previousFor(aSlug, per.start), reportingTerms(a).threshold);
    const daysLeft = Math.round((Date.parse(per.due) - Date.parse(today)) / 86400000);
    return { artist: a, per, done, c, daysLeft, terms: reportingTerms(a) };
  }).sort((x, y) => (!!x.done - !!y.done) || x.per.due.localeCompare(y.per.due));
  function prepare(row) { setForm({ ...empty, artistId: row.artist.id, periodStart: row.per.start, periodEnd: row.per.end }); }

  function generateStatement(status) {
    if (!selectedArtist || !preview || form.periodStart > form.periodEnd) return;
    const stmt = {
      id: uid(), artist: selectedArtist.name, artistSlug: slug(selectedArtist.name),
      periodStart: form.periodStart, periodEnd: form.periodEnd,
      grossEarning: preview.gross, swiftShare: preview.swift, netAfterSwift: preview.net,
      artistPct: preview.artistPct, artistShare: preview.artistShare, labelShare: preview.labelShare,
      ...carry, threshold: terms.threshold,
      // Under the threshold nothing is paid; the balance rolls into the next statement.
      status: status === 'paid' && carry.belowThreshold ? 'carried forward' : status, createdAt: Date.now(), notes: form.notes,
    };
    update([...payouts, stmt]);
    setForm({ ...empty, artistId: form.artistId });
  }
  function markPaid(id) { logActivity('marked statement paid', (payouts.find(p => p.id === id) || {}).artist || ''); update(payouts.map(p => p.id === id ? { ...p, status: 'paid' } : p)); }
  // Sending publishes the statement to the artist's portal and emails them;
  // a scheduled one goes out within 10 minutes of its time.
  const [scheduleId, setScheduleId] = useState(null);
  const [scheduleAt, setScheduleAt] = useState('');
  const [scheduleError, setScheduleError] = useState('');
  function sendNow(id) { const p0 = payouts.find(p => p.id === id); logActivity('sent statement to artist', p0 ? p0.artist + ' ' + p0.periodStart + '–' + p0.periodEnd : ''); update(payouts.map(p => p.id === id ? { ...p, sentAt: new Date().toISOString(), scheduledFor: '' } : p)); }
  function schedule(id) {
    const when = Date.parse(scheduleAt);
    if (!scheduleAt || isNaN(when) || when <= Date.now()) { setScheduleError('Pick a date and time in the future.'); return; }
    logActivity('scheduled statement', new Date(when).toISOString());
    update(payouts.map(p => p.id === id ? { ...p, scheduledFor: new Date(when).toISOString() } : p));
    setScheduleId(null); setScheduleAt(''); setScheduleError('');
  }
  function cancelSchedule(id) { update(payouts.map(p => p.id === id ? { ...p, scheduledFor: '' } : p)); }
  const fmtWhen = iso => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  function remove(id) { update(payouts.filter(p => p.id !== id)); setConfirmId(null); }

  const recoupmentByArtist = useMemo(() => roster.map(a => ({ artist: a, ...recoupmentForArtist(a, ledger, revenue, masterGross, invoices) })), [roster, ledger, revenue, masterGross, invoices]);
  const pnl = labelPnL(roster, revenue, masterGross, ledger);
  const sortedPayouts = [...payouts].sort((a, b) => b.periodEnd.localeCompare(a.periodEnd) || b.createdAt - a.createdAt);

  return (
    <div>
      <SectionHeader title="Payouts" artistNote="a statement only after you press Send to artist (or its scheduled time passes). They get an email." description="Generate a payout statement for an artist over any period — computed live from revenue and money received, per the inbound banking charge split formula." />

      <div className="flex flex-wrap gap-3 mb-6">
        <KPICard icon={DollarSign} label="Label earnings (lifetime)" value={formatCurrency(pnl.labelEarn)} tone="teal" />
        <KPICard icon={TrendingUp} label="Ledger income" value={formatCurrency(pnl.ledgerIncome)} />
        <KPICard icon={Wallet} label="Ledger expense" value={formatCurrency(pnl.ledgerExpense)} />
        <KPICard icon={ClipboardList} label="Label net profit (P&L)" value={formatCurrency(pnl.netProfit)} tone={pnl.netProfit < 0 ? 'red' : 'teal'} />
      </div>

      <h2 className="mb-2" style={{ fontWeight: 600, fontSize: 17 }}>Statements due</h2>
      <p className="text-xs mb-3" style={{ color: C.textDim }}>Each artist’s last closed reporting period, from their schedule on the Roster.</p>
      <div className="rounded border overflow-x-auto mb-6" style={{ borderColor: C.border, background: C.panel }}>
        <table className="w-full" style={{ minWidth: 820 }}>
          <thead><tr><Th>Artist</Th><Th>Schedule</Th><Th>Period</Th><Th>Due by</Th><Th align="right">Due to artist</Th><Th>Status</Th><Th align="right"><span className="sr-only">Actions</span></Th></tr></thead>
          <tbody>
            {dueList.map(r => (
              <tr key={r.artist.id}>
                <Td>{r.artist.name}</Td>
                <Td><span className="text-xs" style={{ color: C.textDim }}>{r.terms.period}, {r.terms.deliveryDays} days{r.terms.threshold ? ', min ' + formatCurrency(r.terms.threshold) : ''}</span></Td>
                <Td mono>{monthLabel(r.per.start)}{r.per.start !== r.per.end ? ' – ' + monthLabel(r.per.end) : ''}</Td>
                <Td mono>{formatDate(r.per.due)}</Td>
                <Td align="right" mono>{formatCurrency(r.c.totalDue)}</Td>
                <Td>{r.done ? <Badge tone="teal">{r.done.status === 'carried forward' ? 'Done · carried forward' : 'Done'}</Badge>
                  : r.daysLeft < 0 ? <Badge tone="red">Overdue {-r.daysLeft} days</Badge>
                  : <Badge tone="amber">Due in {r.daysLeft} days</Badge>}{!r.done && r.c.belowThreshold && <div className="text-xs mt-1" style={{ color: C.textDim }}>Under threshold, will carry forward</div>}</Td>
                <Td align="right">{!r.done && canEdit && <Btn variant="ghost" onClick={() => prepare(r)}>Prepare</Btn>}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div className="rounded border p-4 mb-6 imss-form-grid gap-3" style={{ background: C.panel, borderColor: C.borderLight }}>
          <Field label="Artist">
            <Select value={form.artistId} onChange={e => setForm({ ...form, artistId: e.target.value })}>
              {roster.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
          <Field label="Period start"><Input type="month" value={form.periodStart} onChange={e => setForm({ ...form, periodStart: e.target.value })} /></Field>
          <Field label="Period end"><Input type="month" value={form.periodEnd} onChange={e => setForm({ ...form, periodEnd: e.target.value })} /></Field>
          <Field label="Notes" full><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="e.g. Wired via ACH" /></Field>

          {preview && (
            <div className="imss-span-2 rounded border p-3 flex flex-wrap gap-4" style={{ background: C.bg, borderColor: C.border }}>
              <div className="text-xs" style={{ color: C.textFaint }}>Gross <div style={{ color: C.text, fontFamily: MONO_FONT, fontSize: 14 }}>{formatCurrency(preview.gross)}</div></div>
              <div className="text-xs" style={{ color: C.textFaint }}>Inbound Banking Charge share <div style={{ color: C.text, fontFamily: MONO_FONT, fontSize: 14 }}>{formatCurrency(preview.swift)}</div></div>
              <div className="text-xs" style={{ color: C.textFaint }}>Net <div style={{ color: C.text, fontFamily: MONO_FONT, fontSize: 14 }}>{formatCurrency(preview.net)}</div></div>
              <div className="text-xs" style={{ color: C.textFaint }}>Artist share ({Math.round(preview.artistPct * 100)}%) <div style={{ color: C.teal, fontWeight: 600, fontFamily: MONO_FONT, fontSize: 14 }}>{formatCurrency(preview.artistShare)}</div></div>
              <div className="text-xs" style={{ color: C.textFaint }}>Label share <div style={{ color: C.text, fontFamily: MONO_FONT, fontSize: 14 }}>{formatCurrency(preview.labelShare)}</div></div>
              {carry.carriedIn > 0 && <div className="text-xs" style={{ color: C.textFaint }}>Carried in <div style={{ color: C.text, fontFamily: MONO_FONT, fontSize: 14 }}>{formatCurrency(carry.carriedIn)}</div></div>}
              <div className="text-xs" style={{ color: C.textFaint }}>Total due <div style={{ color: carry.belowThreshold ? C.amber : C.teal, fontWeight: 600, fontFamily: MONO_FONT, fontSize: 14 }}>{formatCurrency(carry.totalDue)}</div></div>
              {carry.belowThreshold && <div className="text-xs w-full" style={{ color: C.amber }}>Under {selectedArtist.name}’s {formatCurrency(terms.threshold)} payout threshold: the statement is still sent, and {formatCurrency(carry.totalDue)} carries forward to the next one.</div>}
            </div>
          )}
          <div className="imss-span-2 flex gap-2 mt-1">
            <Btn variant="ghost" onClick={() => generateStatement('draft')}>Save as draft</Btn>
            <Btn variant="primary" onClick={() => generateStatement('paid')}>{carry && carry.belowThreshold ? 'Generate (carry forward)' : <>Generate &amp; mark paid</>}</Btn>
          </div>
        </div>
      )}

      <div className="text-xs mb-3" style={{ color: C.textFaint }}>Recoupment status by artist</div>
      <div className="rounded border overflow-x-auto mb-6" style={{ borderColor: C.border, background: C.panel }}>
        <table className="w-full" style={{ minWidth: 620 }}>
          <thead><tr><Th>Artist</Th><Th align="right">Spent on artist (label + approved claims)</Th><Th align="right">Earned (artist share)</Th><Th align="right">Balance</Th></tr></thead>
          <tbody>
            {recoupmentByArtist.map(r => (
              <tr key={r.artist.id}>
                <Td>{r.artist.name}</Td>
                <Td align="right" mono>{formatCurrency(r.spent)}</Td>
                <Td align="right" mono>{formatCurrency(r.earned)}</Td>
                <Td align="right" mono>
                  {r.balance > 0
                    ? <span style={{ color: C.red, fontWeight: 600 }}>{formatCurrency(r.unrecouped)} unrecouped</span>
                    : <span style={{ color: C.teal, fontWeight: 600 }}>Fully recouped{r.dueOnTop > 0 ? ' · ' + formatCurrency(r.dueOnTop) + ' due' : ''}</span>}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ExportBar filename="imss-payout-statements" headers={['Artist', 'Period start', 'Period end', 'Gross', 'Inbound Banking Charge share', 'Net', 'Artist %', 'Artist share', 'Label share', 'Status']} rows={sortedPayouts.map(p => [p.artist, p.periodStart, p.periodEnd, p.grossEarning, p.swiftShare, p.netAfterSwift, p.artistPct, p.artistShare, p.labelShare, p.status])} />

      <div className="text-xs mb-3" style={{ color: C.textFaint }}>Statement history</div>
      {sortedPayouts.length === 0 ? (
        <EmptyState icon={Wallet} title="No payout statements yet" description="Generate one above to see it here." />
      ) : (
        <div className="rounded border overflow-x-auto" style={{ borderColor: C.border, background: C.panel }}>
          <table className="w-full" style={{ minWidth: 1000 }}>
            <thead><tr><Th>Period</Th><Th>Artist</Th><Th align="right">Gross</Th><Th align="right">Net</Th><Th align="right">Artist share</Th><Th>Status</Th><Th>Artist</Th><Th align="right">Actions</Th></tr></thead>
            <tbody>
              {sortedPayouts.map(p => (
                <tr key={p.id}>
                  <Td mono>{p.periodStart} – {p.periodEnd}</Td>
                  <Td>{p.artist}</Td>
                  <Td align="right" mono>{formatCurrency(p.grossEarning)}</Td>
                  <Td align="right" mono>{formatCurrency(p.netAfterSwift)}</Td>
                  <Td align="right" mono>{formatCurrency(p.artistShare)}</Td>
                  <Td><Badge tone={p.status === 'paid' ? 'teal' : 'amber'}>{p.status}</Badge>{p.carriedOut > 0 && <div className="text-xs mt-1" style={{ color: C.textDim }}>{formatCurrency(p.carriedOut)} carried forward</div>}</Td>
                  <Td>
                    {p.sentAt ? (
                      <span className="text-xs" style={{ color: C.teal }}>Sent {fmtWhen(p.sentAt)}</span>
                    ) : p.scheduledFor ? (
                      <span className="text-xs" style={{ color: C.amber }}>Scheduled {fmtWhen(p.scheduledFor)}{canEdit && <> · <button onClick={() => cancelSchedule(p.id)} style={{ color: C.textDim, textDecoration: 'underline', textUnderlineOffset: 3 }}>cancel</button></>}</span>
                    ) : canEdit ? (
                      scheduleId === p.id ? (
                        <span className="inline-flex flex-col gap-1">
                          <span className="inline-flex items-center gap-2">
                            <input type="datetime-local" aria-label="Send at" value={scheduleAt} onChange={e => { setScheduleAt(e.target.value); setScheduleError(''); }} style={{ ...inputStyle, height: 32,  }} />
                            <button onClick={() => schedule(p.id)} style={{ color: C.amber, fontWeight: 600, fontSize: 13 }}>Schedule</button>
                            <button onClick={() => { setScheduleId(null); setScheduleError(''); }} style={{ color: C.textDim, fontSize: 13 }}>Cancel</button>
                          </span>
                          {scheduleError && <span className="text-xs" role="alert" style={{ color: C.red }}>{scheduleError}</span>}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-3 text-sm whitespace-nowrap">
                          <button onClick={() => sendNow(p.id)} style={{ color: C.amber, fontWeight: 600 }}><Mail size={13} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />Send to artist</button>
                          <button onClick={() => { setScheduleId(p.id); setScheduleAt(''); }} style={{ color: C.textDim }}>Schedule</button>
                        </span>
                      )
                    ) : <span className="text-xs" style={{ color: C.textDim }}>Not sent</span>}
                  </Td>
                  <Td align="right">
                    {confirmId === p.id ? <ConfirmInline onConfirm={() => remove(p.id)} onCancel={() => setConfirmId(null)} /> : canEdit ? (
                      <span className="inline-flex gap-3 justify-end">
                        {p.status === 'draft' && <button onClick={() => markPaid(p.id)} style={{ color: C.teal }}><CheckCircle2 size={14} /></button>}
                        <button onClick={() => setConfirmId(p.id)} style={{ color: C.textDim }}><Trash2 size={14} /></button>
                      </span>
                    ) : <span style={{ color: C.textFaint }}>—</span>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ImportSection({ roster, catalog, revenue, streams, updateRoster, updateCatalog, updateRevenue, updateStreams, masterGross = [], statementFiles = [], updateStatementFiles, sessionName = '' }) {
  const [mode, setMode] = useState(null);
  const [step, setStep] = useState('choose');
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [summary, setSummary] = useState(null);
  const fileInputRef = useRef(null);

  const [headers, setHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [groups, setGroups] = useState([]);

  const [summaryHeaders, setSummaryHeaders] = useState([]);
  const [summaryRows, setSummaryRows] = useState([]);
  const [summaryForm, setSummaryForm] = useState({ title: '', isrc: '', upc: '', artistChoice: '__new__', newArtistName: '', period: '', storeCol: 0, amountCol: 0, quantityCol: '' });

  function reset() {
    setMode(null); setStep('choose'); setFileName(''); setParseError(''); setSummary(null);
    setHeaders([]); setRawRows([]); setMapping({}); setGroups([]);
    setSummaryHeaders([]); setSummaryRows([]);
    setSummaryForm({ title: '', isrc: '', upc: '', artistChoice: '__new__', newArtistName: '', period: '', storeCol: 0, amountCol: 0, quantityCol: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setParseError('');
    setFileName(file.name);

    if (mode === 'summary') {
      Papa.parse(file, {
        skipEmptyLines: true,
        complete: (results) => {
          const table = extractPivotTable(results.data);
          if (!table) { setParseError("Couldn't find a store-by-store table in that file."); return; }
          setSummaryHeaders(table.headers);
          setSummaryRows(table.rows);
          const storeGuess = guessColumnIndex(table.headers, ['service', 'store', 'platform', 'dsp', 'source'], false);
          const amountGuess = guessColumnIndex(table.headers, ['total royalt', 'total revenue', 'net revenue', 'royalt'], true);
          const quantityGuess = guessColumnIndex(table.headers, ['stream', 'quantity', 'units'], false);
          setSummaryForm(f => ({
            ...f,
            title: guessReleaseTitleFromFilename(file.name),
            storeCol: storeGuess >= 0 ? storeGuess : 0,
            amountCol: amountGuess >= 0 ? amountGuess : table.headers.length - 1,
            quantityCol: quantityGuess >= 0 ? quantityGuess : '',
            artistChoice: roster[0] ? roster[0].id : '__new__',
          }));
          setStep('map');
        },
        error: (err) => setParseError('Could not read that file: ' + err.message),
      });
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => String(h).trim(),
      complete: (results) => {
        const fields = results.meta && results.meta.fields ? results.meta.fields : [];
        if (!fields.length || !results.data.length) {
          setParseError("Couldn't find any rows in that file — check it's a CSV with a header row.");
          return;
        }
        setHeaders(fields);
        setRawRows(results.data);
        setMapping(guessMapping(fields));
        setStep('map');
      },
      error: (err) => setParseError('Could not read that file: ' + err.message),
    });
  }

  function downloadSample() {
    const rows = [
      ['Period', 'Store', 'Track Title', 'ISRC', 'Artist Name', 'Quantity', 'Net Revenue'],
      ['2026-08', 'Spotify', 'Glass Static', 'US-IM1-24-00123', 'Nova Reyes', '154302', '412.18'],
      ['2026-08', 'Apple Music', 'Halflight', 'US-IM1-25-00045', 'Nova Reyes', '48210', '96.40'],
      ['2026-08', 'Spotify', 'Low Tide Radio', 'US-IM1-24-00198', 'Marlowe Grey', '61230', '163.05'],
      ['2026-08', 'YouTube Music', 'Midnight Static', '', 'Nova Reyes', '9800', '8.10'],
      ['2026-08', 'Spotify', 'New Wave', '', 'The Coastals', '22110', '58.90'],
    ];
    const csv = rows.map(r => r.map(v => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v)).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'sample-royalty-statement.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadSampleSummary() {
    const rows = [
      ['EMPIRE Summary Royalty Report'],
      [],
      ['Totals', '', '', '82.14'],
      [],
      ['Service', 'Quantity', 'Net Revenue'],
      ['Spotify', '12500', '61.20'],
      ['Apple Music', '4300', '15.40'],
      ['YouTube Music', '900', '5.54'],
    ];
    const csv = rows.map(r => r.map(v => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v)).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'sample-song-royalties-summary.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function proceedToReview() {
    setGroups(buildImportGroups(rawRows, mapping, catalog, roster));
    setStep('review');
  }

  function updateGroup(key, patch) {
    setGroups(gs => gs.map(g => g.key === key ? { ...g, ...patch } : g));
  }

  function confirmImport() {
    let nextRoster = [...roster];
    let nextCatalog = [...catalog];
    const newArtistIdByName = {};
    const resolved = groups.map(g => {
      if (g.releaseChoice === '__skip__') return { ...g, resolvedReleaseId: null };
      if (g.releaseChoice === '__create__') {
        let artistId = g.artistChoice;
        if (g.artistChoice === '__new__') {
          const name = (g.newArtistName || g.artistNameRaw || 'Unknown Artist').trim();
          const nameKey = normalizeStr(name);
          if (newArtistIdByName[nameKey]) {
            artistId = newArtistIdByName[nameKey];
          } else {
            const newId = uid();
            nextRoster.push({ id: newId, name, genre: '', royaltyRate: 50, artistPct: 0.5, distroLabel: 'IMSS Records', signedDate: todayStr(), email: '', status: 'Active', notes: 'Added via CSV import.' });
            newArtistIdByName[nameKey] = newId;
            artistId = newId;
          }
        }
        const newReleaseId = uid();
        nextCatalog.push({ id: newReleaseId, artistId, title: g.title, type: 'Single', releaseDate: todayStr(), isrc: g.isrc || '', upc: g.upc || '', status: 'Released' });
        return { ...g, resolvedReleaseId: newReleaseId };
      }
      return { ...g, resolvedReleaseId: g.releaseChoice };
    });

    // Revenue is one row per track per month (per the finance spec) — rows from
    // multiple stores for the same track/month get summed into a single entry.
    const revenueByKey = {};
    const streamAdds = [];
    let skippedRows = 0;

    resolved.forEach(g => {
      if (!g.resolvedReleaseId) { skippedRows += g.rowIndices.length; return; }
      const release = nextCatalog.find(c => c.id === g.resolvedReleaseId);
      const artist = nextRoster.find(a => a.id === release.artistId);
      g.rowIndices.forEach(idx => {
        const row = rawRows[idx];
        const amountVal = mapping.amount ? parseAmount(row[mapping.amount]) : null;
        if (amountVal === null) { skippedRows += 1; return; }
        const dateVal = mapping.date ? parseStatementDate(row[mapping.date]) : null;
        const month = (dateVal || todayStr()).slice(0, 7);
        const storeRaw = mapping.store ? row[mapping.store] : '';
        if (artist) {
          const artistSlug = slug(artist.name);
          const key = artistSlug + '_' + slug(release.title) + '_' + month;
          if (!revenueByKey[key]) {
            revenueByKey[key] = { id: key, artist: artist.name, artistSlug, title: release.title, month, earning: 0, type: release.type || 'Single', epAlbum: null, releaseDate: release.releaseDate || null, approvalStatus: 'Approved', approvedBy: 'Import', approvedAt: todayStr() };
          }
          revenueByKey[key].earning += amountVal;
          // Per-retailer split of this row's earning, for "top earning retailer".
          if (storeRaw) { const st = revenueByKey[key].stores || (revenueByKey[key].stores = {}); const p = guessPlatform(storeRaw); st[p] = (st[p] || 0) + amountVal; }
        }
        if (mapping.quantity) {
          const qty = parseQuantity(row[mapping.quantity]);
          if (qty > 0) {
            streamAdds.push({ id: uid(), date: dateVal || todayStr(), platform: guessPlatform(storeRaw), releaseId: release.id, count: qty });
          }
        }
      });
    });

    const revenueAdds = Object.values(revenueByKey);
    updateRoster(nextRoster);
    updateCatalog(nextCatalog);
    if (revenueAdds.length) updateRevenue([...revenue.filter(r => !revenueByKey[r.id]), ...revenueAdds]);
    if (streamAdds.length) updateStreams([...streams, ...streamAdds]);

    setSummary({
      revenueCount: revenueAdds.length,
      streamCount: streamAdds.length,
      newArtistCount: nextRoster.length - roster.length,
      newReleaseCount: nextCatalog.length - catalog.length,
      skippedRows,
    });
    setStep('done');
  }

  function confirmSummaryImport() {
    let nextRoster = [...roster];
    let nextCatalog = [...catalog];
    let artistId = summaryForm.artistChoice;
    if (artistId === '__new__') {
      const name = (summaryForm.newArtistName || 'Unknown Artist').trim();
      const newId = uid();
      nextRoster.push({ id: newId, name, genre: '', royaltyRate: 50, artistPct: 0.5, distroLabel: 'IMSS Records', signedDate: todayStr(), email: '', status: 'Active', notes: 'Added via CSV import.' });
      artistId = newId;
    }
    const artist = nextRoster.find(a => a.id === artistId);

    const title = summaryForm.title.trim() || '(untitled product)';
    let release = nextCatalog.find(c => c.artistId === artistId && (
      (summaryForm.isrc && normalizeIsrc(c.isrc) === normalizeIsrc(summaryForm.isrc)) ||
      (summaryForm.upc && String(c.upc || '').replace(/[^0-9]/g, '') === summaryForm.upc.replace(/[^0-9]/g, '')) ||
      normalizeStr(c.title) === normalizeStr(title)
    ));
    let createdRelease = false;
    if (!release) {
      release = { id: uid(), artistId, title, type: 'Single', releaseDate: todayStr(), isrc: summaryForm.isrc || '', upc: summaryForm.upc || '', status: 'Released' };
      nextCatalog.push(release);
      createdRelease = true;
    }

    const month = summaryForm.period || todayStr().slice(0, 7);
    const dateVal = summaryForm.period ? summaryForm.period + '-01' : todayStr();
    const streamAdds = [];
    let skippedRows = 0;
    let earningTotal = 0;
    const stores = {};

    summaryRows.forEach(row => {
      const storeRaw = (row[summaryForm.storeCol] || '').trim();
      const amountVal = parseAmount(row[summaryForm.amountCol]);
      if (amountVal === null) { skippedRows += 1; return; }
      earningTotal += amountVal;
      if (storeRaw) { const p = guessPlatform(storeRaw); stores[p] = (stores[p] || 0) + amountVal; }
      if (summaryForm.quantityCol !== '' && summaryForm.quantityCol !== null && summaryForm.quantityCol !== undefined) {
        const qty = parseQuantity(row[summaryForm.quantityCol]);
        if (qty > 0) streamAdds.push({ id: uid(), date: dateVal, platform: guessPlatform(storeRaw), releaseId: release.id, count: qty });
      }
    });

    const revenueAdds = [];
    if (artist && earningTotal > 0) {
      const artistSlug = slug(artist.name);
      const key = artistSlug + '_' + slug(release.title) + '_' + month;
      revenueAdds.push({ id: key, artist: artist.name, artistSlug, title: release.title, month, earning: earningTotal, stores, type: release.type || 'Single', epAlbum: null, releaseDate: release.releaseDate || null, approvalStatus: 'Approved', approvedBy: 'Import', approvedAt: todayStr() });
    }

    updateRoster(nextRoster);
    updateCatalog(nextCatalog);
    if (revenueAdds.length) updateRevenue([...revenue.filter(r => r.id !== revenueAdds[0].id), ...revenueAdds]);
    if (streamAdds.length) updateStreams([...streams, ...streamAdds]);

    setSummary({
      earningsCount: revenueAdds.length,
      streamCount: streamAdds.length,
      newArtistCount: nextRoster.length - roster.length,
      newReleaseCount: createdRelease ? 1 : 0,
      skippedRows,
    });
    setStep('done');
  }

  const canReview = !!mapping.amount && (!!mapping.title || !!mapping.isrc);
  const matchedCount = groups.filter(g => g.releaseChoice !== '__create__' && g.releaseChoice !== '__skip__').length;
  const canReviewSummary = !!summaryForm.title.trim() && !!summaryForm.period && (summaryForm.artistChoice !== '__new__' || !!summaryForm.newArtistName.trim());

  return (
    <div>
      <SectionHeader title="Import" artistNote="nothing yet. Imported revenue and statement files stay internal until you publish them." description="Upload a royalty statement CSV from a distributor or DSP. IMSS Records matches it to your roster and catalog, and logs the earnings automatically — including the store-by-store breakdown artists see." />

      {mode === 'empire' && (
        <EmpireImport roster={roster} catalog={catalog} revenue={revenue} masterGross={masterGross} updateRevenue={updateRevenue} statementFiles={statementFiles} updateStatementFiles={updateStatementFiles} sessionName={sessionName} onDone={reset} />
      )}

      {step === 'choose' && (
        <div className="imss-form-grid gap-4">
          <button onClick={() => { setMode('empire'); setStep('empire'); }} className="text-left rounded border p-5" style={{ background: C.amberSoft, borderColor: C.amber }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>EMPIRE detailed royalty report</div>
            <div className="text-sm" style={{ color: C.textDim }}>The “royalties_detailed” CSV from EMPIRE. Books gross by statement month with platform, country and type detail, and saves the file on the artist’s profile.</div>
          </button>
          <button onClick={() => { setMode('detail'); setStep('upload'); }} className="text-left rounded border p-5" style={{ background: C.panel, borderColor: C.borderLight }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Per-product detail report</div>
            <div className="text-sm" style={{ color: C.textDim }}>Each row is one product's earnings — DistroKid, CD Baby, or TuneCore-style exports with a title, ISRC, and amount per line.</div>
          </button>
          <button onClick={() => { setMode('summary'); setStep('upload'); }} className="text-left rounded border p-5" style={{ background: C.panel, borderColor: C.borderLight }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Store breakdown for one product</div>
            <div className="text-sm" style={{ color: C.textDim }}>Each row is one store's total for a single song — EMPIRE-style summary reports, like the "royalties_summary" exports per track.</div>
          </button>
        </div>
      )}

      {step === 'upload' && (
        <div>
          <DropZone onFiles={handleFile} accept=".csv,text/csv" className="rounded border p-8 text-center mb-4" style={{ borderColor: C.borderLight, borderStyle: 'dashed', background: C.panel }}>
            <FileText size={22} style={{ color: C.textFaint, margin: '0 auto 10px' }} />
            <div style={{ fontWeight: 600 }}>Drop a statement here, or choose a file</div>
            <div className="text-sm mt-1 mb-4" style={{ color: C.textDim }}>
              {mode === 'summary' ? 'A store-by-store summary report for one product, straight from EMPIRE.' : 'CSV files from DistroKid, CD Baby, TuneCore, or any distributor export.'}
            </div>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="text-sm mx-auto block" style={{ color: C.textDim, maxWidth: 280 }} />
          </DropZone>
          {parseError && <div className="rounded px-3 py-2 text-xs mb-4" style={{ background: C.redSoft, color: C.red, border: '1px solid ' + C.red }}>{parseError}</div>}
          <div className="flex items-center justify-between">
            <button onClick={mode === 'summary' ? downloadSampleSummary : downloadSample} className="inline-flex items-center gap-1.5 text-xs" style={{ color: C.textDim }}>
              <Download size={12} /> Download a sample CSV to try it out
            </button>
            <button onClick={reset} className="text-xs" style={{ color: C.textFaint }}>Change file type</button>
          </div>
        </div>
      )}

      {step === 'map' && mode === 'detail' && (
        <div>
          <div className="flex items-center gap-2 mb-4 text-sm" style={{ color: C.textDim }}>
            <FileText size={14} /> {fileName} · {rawRows.length} rows detected
          </div>
          <div className="rounded border p-4 mb-5 imss-form-grid gap-3" style={{ background: C.panel, borderColor: C.borderLight }}>
            {Object.keys(IMPORT_FIELD_LABELS).map(field => (
              <Field key={field} label={IMPORT_FIELD_LABELS[field] + (field === 'amount' ? ' (required)' : '')}>
                <Select value={mapping[field] || ''} onChange={e => setMapping({ ...mapping, [field]: e.target.value })}>
                  <option value="">— none —</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </Select>
              </Field>
            ))}
          </div>

          {!canReview && (
            <div className="text-xs mb-4" style={{ color: C.amber }}>Map at least a revenue amount and a product name or ISRC to continue.</div>
          )}

          <div className="rounded border overflow-x-auto mb-5" style={{ borderColor: C.border, background: C.panel }}>
            <div className="text-xs px-4 pt-3 pb-2" style={{ color: C.textFaint }}>Preview — first 5 rows</div>
            <table className="w-full" style={{ minWidth: 560 }}>
              <thead><tr>{headers.map(h => <Th key={h}>{h}</Th>)}</tr></thead>
              <tbody>
                {rawRows.slice(0, 5).map((row, i) => (
                  <tr key={i}>{headers.map(h => <Td key={h}>{row[h]}</Td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <Btn variant="primary" onClick={proceedToReview} disabled={!canReview}>Continue</Btn>
            <Btn variant="ghost" onClick={reset}>Start over</Btn>
          </div>
        </div>
      )}

      {step === 'map' && mode === 'summary' && (
        <div>
          <div className="flex items-center gap-2 mb-4 text-sm" style={{ color: C.textDim }}>
            <FileText size={14} /> {fileName} · {summaryRows.length} store rows detected
          </div>

          <div className="rounded border p-4 mb-5 imss-form-grid gap-3" style={{ background: C.panel, borderColor: C.borderLight }}>
            <Field label="Product name"><Input value={summaryForm.title} onChange={e => setSummaryForm({ ...summaryForm, title: e.target.value })} placeholder="e.g. Play Pretend" /></Field>
            <Field label="ISRC (optional)"><Input value={summaryForm.isrc} onChange={e => setSummaryForm({ ...summaryForm, isrc: e.target.value })} /></Field>
            <Field label="UPC (optional)"><Input value={summaryForm.upc} onChange={e => setSummaryForm({ ...summaryForm, upc: e.target.value })} /></Field>
            <Field label="Artist">
              <Select value={summaryForm.artistChoice} onChange={e => setSummaryForm({ ...summaryForm, artistChoice: e.target.value })}>
                {roster.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                <option value="__new__">+ New artist</option>
              </Select>
            </Field>
            {summaryForm.artistChoice === '__new__' && (
              <Field label="New artist name"><Input value={summaryForm.newArtistName} onChange={e => setSummaryForm({ ...summaryForm, newArtistName: e.target.value })} /></Field>
            )}
            <Field label="Statement period"><Input type="month" value={summaryForm.period} onChange={e => setSummaryForm({ ...summaryForm, period: e.target.value })} /></Field>
            <Field label="Store / platform column">
              <Select value={summaryForm.storeCol} onChange={e => setSummaryForm({ ...summaryForm, storeCol: Number(e.target.value) })}>
                {summaryHeaders.map((h, i) => <option key={i} value={i}>{(h || '(blank)') + ' — col ' + (i + 1)}</option>)}
              </Select>
            </Field>
            <Field label="Revenue column">
              <Select value={summaryForm.amountCol} onChange={e => setSummaryForm({ ...summaryForm, amountCol: Number(e.target.value) })}>
                {summaryHeaders.map((h, i) => <option key={i} value={i}>{(h || '(blank)') + ' — col ' + (i + 1)}</option>)}
              </Select>
            </Field>
            <Field label="Streams column (optional)">
              <Select value={summaryForm.quantityCol} onChange={e => setSummaryForm({ ...summaryForm, quantityCol: e.target.value === '' ? '' : Number(e.target.value) })}>
                <option value="">— none —</option>
                {summaryHeaders.map((h, i) => <option key={i} value={i}>{(h || '(blank)') + ' — col ' + (i + 1)}</option>)}
              </Select>
            </Field>
          </div>

          {!canReviewSummary && (
            <div className="text-xs mb-4" style={{ color: C.amber }}>Add a product name, a statement period, and an artist to continue.</div>
          )}

          <div className="rounded border overflow-x-auto mb-5" style={{ borderColor: C.border, background: C.panel }}>
            <div className="text-xs px-4 pt-3 pb-2" style={{ color: C.textFaint }}>Preview — first 6 stores</div>
            <table className="w-full" style={{ minWidth: 420 }}>
              <thead><tr><Th>Store</Th>{summaryForm.quantityCol !== '' && <Th align="right">Streams</Th>}<Th align="right">Revenue</Th></tr></thead>
              <tbody>
                {summaryRows.slice(0, 6).map((row, i) => (
                  <tr key={i}>
                    <Td>{row[summaryForm.storeCol]}</Td>
                    {summaryForm.quantityCol !== '' && <Td align="right" mono>{formatNumber(parseQuantity(row[summaryForm.quantityCol]))}</Td>}
                    <Td align="right" mono>{formatCurrency(parseAmount(row[summaryForm.amountCol]) || 0)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <Btn variant="primary" onClick={() => setStep('review')} disabled={!canReviewSummary}>Continue</Btn>
            <Btn variant="ghost" onClick={reset}>Start over</Btn>
          </div>
        </div>
      )}

      {step === 'review' && mode === 'detail' && (
        <div>
          <div className="text-sm mb-4" style={{ color: C.textDim }}>
            {groups.length} unique products found across {rawRows.length} rows. {matchedCount} matched an existing release automatically — review the rest below.
          </div>
          <div className="rounded border overflow-x-auto mb-5" style={{ borderColor: C.border, background: C.panel }}>
            <table className="w-full" style={{ minWidth: 760 }}>
              <thead><tr><Th>Product</Th><Th>From CSV</Th><Th align="right">Rows</Th><Th align="right">Total</Th><Th>Match to</Th></tr></thead>
              <tbody>
                {groups.map(g => (
                  <tr key={g.key} style={{ opacity: g.releaseChoice === '__skip__' ? 0.5 : 1 }}>
                    <Td>
                      {g.title}
                      {g.isrc && <div className="text-xs" style={{ color: C.textFaint, fontFamily: MONO_FONT }}>{g.isrc}</div>}
                    </Td>
                    <Td>{g.artistNameRaw || '—'}</Td>
                    <Td align="right" mono>{g.rowIndices.length}</Td>
                    <Td align="right" mono>{formatCurrency(g.totalAmount)}</Td>
                    <Td>
                      <Select value={g.releaseChoice} onChange={e => updateGroup(g.key, { releaseChoice: e.target.value })} style={{ minWidth: 180 }}>
                        <option value="__create__">Create new release</option>
                        <option value="__skip__">Skip these rows</option>
                        {catalog.map(c => {
                          const a = roster.find(x => x.id === c.artistId);
                          return <option key={c.id} value={c.id}>{trackOptionLabel(c, true, a ? a.name : null)}</option>;
                        })}
                      </Select>
                      {g.releaseChoice === '__create__' && (
                        <div className="mt-2">
                          <Select value={g.artistChoice} onChange={e => updateGroup(g.key, { artistChoice: e.target.value })} style={{ minWidth: 180 }}>
                            {roster.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            <option value="__new__">+ New artist</option>
                          </Select>
                          {g.artistChoice === '__new__' && (
                            <Input className="mt-2" placeholder="New artist name" value={g.newArtistName} onChange={e => updateGroup(g.key, { newArtistName: e.target.value })} style={{ minWidth: 180 }} />
                          )}
                        </div>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <Btn variant="primary" onClick={confirmImport}>Import {rawRows.length} rows</Btn>
            <Btn variant="ghost" onClick={() => setStep('map')}>Back to mapping</Btn>
          </div>
        </div>
      )}

      {step === 'review' && mode === 'summary' && (
        <div>
          <div className="text-sm mb-4" style={{ color: C.textDim }}>
            Every store below will be logged as earnings for <strong>{summaryForm.title || '(untitled product)'}</strong> in {summaryForm.period ? monthLabel(summaryForm.period) : 'the selected period'} — store-by-store, so it's still visible that way afterward.
          </div>
          <div className="rounded border overflow-x-auto mb-5" style={{ borderColor: C.border, background: C.panel }}>
            <table className="w-full" style={{ minWidth: 420 }}>
              <thead><tr><Th>Store</Th>{summaryForm.quantityCol !== '' && <Th align="right">Streams</Th>}<Th align="right">Revenue</Th></tr></thead>
              <tbody>
                {summaryRows.map((row, i) => (
                  <tr key={i}>
                    <Td>{row[summaryForm.storeCol]}</Td>
                    {summaryForm.quantityCol !== '' && <Td align="right" mono>{formatNumber(parseQuantity(row[summaryForm.quantityCol]))}</Td>}
                    <Td align="right" mono>{formatCurrency(parseAmount(row[summaryForm.amountCol]) || 0)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <Btn variant="primary" onClick={confirmSummaryImport}>Import {summaryRows.length} store rows</Btn>
            <Btn variant="ghost" onClick={() => setStep('map')}>Back</Btn>
          </div>
        </div>
      )}

      {step === 'done' && summary && (
        <div>
          <div className="rounded border p-6 mb-5" style={{ background: C.tealSoft, borderColor: C.teal }}>
            <div className="flex items-center gap-2 mb-2" style={{ color: C.teal, fontWeight: 600 }}>
              <CheckCircle2 size={16} /> Import complete
            </div>
            <div className="text-sm" style={{ color: C.text }}>
              {summary.revenueCount !== undefined && <>Added {formatNumber(summary.revenueCount)} revenue {summary.revenueCount === 1 ? 'entry' : 'entries'}</>}
              {summary.earningsCount !== undefined && <>Added {formatNumber(summary.earningsCount)} revenue {summary.earningsCount === 1 ? 'entry' : 'entries'} to the Revenue tab</>}
              {summary.streamCount > 0 && <> and {formatNumber(summary.streamCount)} stream {summary.streamCount === 1 ? 'entry' : 'entries'}</>}.
              {summary.newReleaseCount > 0 && <> Created {summary.newReleaseCount} new {summary.newReleaseCount === 1 ? 'release' : 'releases'}.</>}
              {summary.newArtistCount > 0 && <> Added {summary.newArtistCount} new {summary.newArtistCount === 1 ? 'artist' : 'artists'} to the roster.</>}
              {summary.skippedRows > 0 && <> Skipped {summary.skippedRows} {summary.skippedRows === 1 ? 'row' : 'rows'} with no usable amount.</>}
            </div>
          </div>
          <Btn variant="primary" onClick={reset}>Import another file</Btn>
        </div>
      )}
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

export function ArtistPortalShell({ artist, roster, catalog, revenue, streams, masterGross = [], payouts, ledger = [], notices = [], profileRequests = [], updateProfileRequests, artistRequests = [], updateArtistRequests, releaseSubmissions = [], updateReleaseSubmissions, invoices = [], updateInvoices, replyToSubmission = null, replyToInvoice = null, statementFiles = [], dealChanges = [], labelSettings, onLogout }) {
  const [pickedReleases, setPickedReleases] = useState([]);
  const [tab, setTab] = useState('overview');
  const artistCatalog = useMemo(() => catalog.filter(c => c.artistId === artist.id).sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || '')), [catalog, artist.id]);
  const releaseIds = useMemo(() => new Set(artistCatalog.map(c => c.id)), [artistCatalog]);
  const aSlug = useMemo(() => slug(artist.name), [artist.name]);

  const myRevenue = useMemo(() => revenue.filter(r => r.artistSlug === aSlug), [revenue, aSlug]);
  const myStreams = useMemo(() => streams.filter(s => releaseIds.has(s.releaseId)), [streams, releaseIds]);

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
  const latestDeal = [...dealChanges].sort((a, b) => String(b.approvedAt).localeCompare(String(a.approvedAt)))[0] || null;
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
  const emptyInvoice = { kind: 'expense', title: '', invoiceNumber: '', invoiceDate: todayStr(), amount: '', payTo: '', details: '', attachment: '', attachmentName: '' };
  const [invoiceForm, setInvoiceForm] = useState(emptyInvoice);
  const [invoiceError, setInvoiceError] = useState('');
  const [invoiceSent, setInvoiceSent] = useState(false);
  const invoiceFileRef = useRef(null);
  function handleInvoiceFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setInvoiceError('That file is over 2 MB. Attach a smaller PDF or photo.'); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => setInvoiceForm(f => ({ ...f, attachment: reader.result, attachmentName: file.name }));
    reader.readAsDataURL(file);
  }
  function submitInvoice(e) {
    e.preventDefault();
    const amount = Math.round(parseFloat(invoiceForm.amount) * 100) / 100;
    if (!invoiceForm.title.trim()) { setInvoiceError('Add a short description of what the invoice is for.'); return; }
    if (!(amount > 0)) { setInvoiceError('Enter the amount in USD, for example 120.50.'); return; }
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
    isFunded && { id: 'budget', label: 'Budget', icon: ClipboardList },
    { id: 'releases', label: 'Releases', icon: Disc3 },
    { id: 'requests', label: 'Requests', icon: MessageSquare },
    { id: 'profile', label: 'Profile', icon: UserCog },
  ].filter(Boolean);

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
    if (file.size > 2 * 1024 * 1024) { setSubmitError('That split sheet is over 2 MB. Upload a smaller PDF or photo.'); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => { setSubmitForm(f => ({ ...f, splitSheet: reader.result, splitSheetName: file.name })); setSubmitError(''); };
    reader.readAsDataURL(file);
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
  const [profileForm, setProfileForm] = useState({ photoUrl: artist.photoUrl || '', bio: artist.bio || '', email: artist.email || '' });
  const profileInputRef = useRef(null);

  function handleProfilePhoto(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    resizeImageFile(file, 300, dataUrl => setProfileForm(f => ({ ...f, photoUrl: dataUrl })));
  }
  function submitProfileRequest() {
    const changes = {};
    PROFILE_EDITABLE_FIELDS.forEach(f => {
      const current = artist[f.key] || '';
      const proposed = profileForm[f.key] || '';
      if (proposed !== current) changes[f.key] = proposed;
    });
    if (Object.keys(changes).length === 0) return;
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
          <img src={LOGO_DATA_URI} alt="IMSS Records" style={{ height: 24, width: 'auto' }} />
          <div className="flex items-center gap-3 mt-5">
            <Avatar name={artist.name} photoUrl={artist.photoUrl} size={40} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{artist.name}</div>
              <div className="text-xs mt-0.5" style={{ color: C.textDim }}>{Math.round(myPct * 100)}% royalty rate</div>
            </div>
          </div>
          <div className="mt-3"><NotificationBell routes={{ deal: 'profile', earnings: 'revenue', statement: 'statements', invoice: 'invoices', submission: 'releases', request: 'requests' }} onOpen={setTab} /></div>
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
            <NotificationBell routes={{ deal: 'profile', earnings: 'revenue', statement: 'statements', invoice: 'invoices', submission: 'releases', request: 'requests' }} onOpen={setTab} />
          </div>
        </div>

        {tab !== 'overview' && <h1 className="imss-portal-title">{(TABS.find(t => t.id === tab) || {}).label}</h1>}

        {tab === 'overview' && (
          <div>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h1 className="imss-portal-title">Dashboard</h1>
              <Badge tone={isFunded ? 'teal' : 'default'}>{dealLabel(artist)}</Badge>
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
                  <div key={n.id} className="rounded border px-4 py-3" style={{ borderColor: C.border, background: C.panel }}>
                    <div className="flex items-baseline justify-between gap-3 flex-wrap">
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{n.title}</div>
                      <div className="text-xs" style={{ color: C.textFaint }}>{formatDate(n.createdAt)}</div>
                    </div>
                    <div className="text-sm mt-1" style={{ color: C.textDim, maxWidth: '70ch' }}>{n.message}</div>
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
                    <Field label="Signed split sheet (PDF or photo, up to 2 MB) *" full>
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
                rightsLine(r, artist),
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
                You can update your photo, bio, and contact email here. Changes are reviewed by your Product Manager or Admin before they go live — everything else on your profile (royalty rate, contract terms, team assignments) is managed by the label directly.
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

            <div className="rounded border p-4 mb-6" style={{ background: C.panel, borderColor: C.border }}>
              <div className="text-xs mb-3" style={{ color: C.textFaint }}>Propose changes</div>
              <div className="flex items-center gap-3 mb-4">
                <Avatar name={artist.name} photoUrl={profileForm.photoUrl} size={64} />
                <div className="flex flex-col gap-1">
                  <input ref={profileInputRef} type="file" accept="image/*" onChange={handleProfilePhoto} className="text-xs" style={{ color: C.textDim, maxWidth: 220 }} />
                  {profileForm.photoUrl && <button type="button" onClick={() => setProfileForm(f => ({ ...f, photoUrl: '' }))} className="text-xs text-left" style={{ color: C.textFaint }}>Remove photo</button>}
                </div>
              </div>
              <div className="imss-form-grid gap-3">
                <Field label="Contact email" full><Input type="email" value={profileForm.email} onChange={e => setProfileForm({ ...profileForm, email: e.target.value })} /></Field>
                <Field label="Bio" full><TextArea rows={4} value={profileForm.bio} onChange={e => setProfileForm({ ...profileForm, bio: e.target.value })} placeholder="A short bio the label can use for press and pitches." /></Field>
              </div>
              <Btn variant="primary" onClick={submitProfileRequest}>Submit for review</Btn>
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
                <Field label="Description" full><Input required value={invoiceForm.title} onChange={e => setInvoiceForm(f => ({ ...f, title: e.target.value }))} placeholder={invoiceForm.kind === 'expense' ? 'e.g. Studio session, 12 March' : 'e.g. Feature verse on “Wave”'} /></Field>
                <Field label="Amount (USD)"><Input required inputMode="decimal" value={invoiceForm.amount} onChange={e => setInvoiceForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" /></Field>
                <Field label="Invoice date"><Input type="date" value={invoiceForm.invoiceDate} onChange={e => setInvoiceForm(f => ({ ...f, invoiceDate: e.target.value }))} /></Field>
                <Field label="Invoice number (optional)"><Input value={invoiceForm.invoiceNumber} onChange={e => setInvoiceForm(f => ({ ...f, invoiceNumber: e.target.value }))} placeholder="e.g. AC-2026-004" /></Field>
                <Field label="Pay to (name on the account)"><Input value={invoiceForm.payTo} onChange={e => setInvoiceForm(f => ({ ...f, payTo: e.target.value }))} placeholder="Your name or company" /></Field>
                <Field label="Details (optional)" full><TextArea rows={3} value={invoiceForm.details} onChange={e => setInvoiceForm(f => ({ ...f, details: e.target.value }))} placeholder="Anything the label needs to know: who agreed it, what it covers." /></Field>
                <Field label={invoiceForm.kind === 'expense' ? 'Receipt (PDF or photo, up to 2 MB)' : 'Invoice file (PDF or photo, up to 2 MB, optional)'} full>
                  <input ref={invoiceFileRef} type="file" accept="application/pdf,image/*" onChange={handleInvoiceFile} className="text-sm" style={{ color: C.textDim }} />
                </Field>
              </div>
              {invoiceError && <div className="text-sm mt-3" role="alert" style={{ color: C.red }}>{invoiceError}</div>}
              {invoiceSent && !invoiceError && <div className="text-sm mt-3" role="status" style={{ color: C.teal }}>Invoice sent. It’s listed below while the label reviews it.</div>}
              <div className="mt-4"><Btn variant="primary" type="submit"><FileText size={14} /> Submit invoice</Btn></div>
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
                        <Td>{i.title}{i.reviewNote ? <div className="text-xs mt-0.5" style={{ color: C.textDim }}>Label: {i.reviewNote}</div> : null}</Td>
                        <Td align="right" mono>{formatCents(i.amount)}</Td>
                        <Td><Badge tone={INVOICE_TONES[invoiceStatus(i)]}>{artistInvoiceStatus(i)}</Badge></Td>
                        <Td align="right"><button onClick={() => setOpenInvoiceId(openInvoiceId === i.id ? null : i.id)} aria-expanded={openInvoiceId === i.id} style={{ color: C.amber, fontWeight: 600, fontSize: 13 }}>{openInvoiceId === i.id ? 'Close' : (i.messages || []).length ? 'Messages (' + i.messages.length + ')' : 'Message'}</button></Td>
                      </tr>
                      {openInvoiceId === i.id && (
                        <tr><td colSpan={6} style={{ padding: 16, borderBottom: '1px solid ' + C.border }}>
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
    </div>
  );
}

// Everything waiting on this team member: shown on the Overview and in Alerts.
function teamAttention({ roster, catalog, staff, tasks = [], revenue = [], ledger = [], profileRequests = [], artistRequests = [], releaseSubmissions = [], accessRequests = [], invoices = [], labelSettings = {}, revenuePublish = [], dealChanges = [], payouts = [], canRoyalties = false, isAdmin = false, sessionName = '' }) {
  const items = [];
  const today = todayStr();
  roster.forEach(a => {
    if (!a.contractExpiration) return;
    const st = expirationStatus(a.contractExpiration);
    if (st && st.label !== 'Active') items.push({ id: 'contract-' + a.id, tone: st.tone, text: a.name + "'s contract " + st.label.toLowerCase(), tab: 'roster' });
  });
  catalog.forEach(c => {
    if (!c.licenseExpiration) return;
    const st = c.license;
    if (st && st.label === 'Expiring soon') items.push({ id: 'license-' + c.id, tone: st.tone, text: c.title + ' license ' + st.label.toLowerCase(), tab: 'catalog' });
  });
  catalog.forEach(c => {
    if (c.status === 'Released') return;
    const missing = missingRequiredDocs(c.distributionDocs);
    if (missing > 0) items.push({ id: 'missing-docs-' + c.id, tone: 'amber', text: c.title + ' missing ' + missing + ' required distribution document' + (missing === 1 ? '' : 's'), tab: 'catalog' });
  });
  staff.forEach(s => {
    if ((s.status || 'Active') !== 'Onboarding') return;
    const prog = onboardingProgress(s);
    items.push({ id: 'onboard-' + s.id, tone: 'amber', text: s.name + ' onboarding: ' + prog.done + '/' + prog.total + ' tasks', tab: 'team' });
  });
  catalog.forEach(c => {
    if (!c.releaseDate || c.status === 'Released') return;
    const days = Math.round((new Date(c.releaseDate) - new Date(today)) / 86400000);
    if (days < 0 || days > 14) return;
    const prog = checklistProgress(c.checklist);
    const dueText = days === 0 ? 'releases today' : days === 1 ? 'releases tomorrow' : 'releases in ' + days + ' days';
    if (prog.total > 0 && prog.pct < 100 && days <= 7) {
      items.push({ id: 'release-risk-' + c.id, tone: 'red', text: c.title + ' ' + dueText + ' — checklist only ' + prog.pct + '% done', tab: 'catalog' });
    } else {
      items.push({ id: 'release-' + c.id, tone: days <= 3 ? 'red' : 'amber', text: c.title + ' ' + dueText, tab: 'calendar' });
    }
  });
  tasks.forEach(t => {
    if (t.status !== 'Open' || !t.dueDate || t.dueDate >= today) return;
    items.push({ id: 'task-' + t.id, tone: 'red', text: 'Overdue: "' + t.title + '" (' + t.assignee + ')', tab: 'tasks' });
  });
  if (isAdmin) {
    const pendingCount = revenue.filter(x => x.approvalStatus === 'Pending').length;
    if (pendingCount > 0) {
      items.push({ id: 'pending-earnings', tone: 'amber', text: pendingCount + ' revenue ' + (pendingCount === 1 ? 'entry' : 'entries') + ' waiting on your approval', tab: 'revenue' });
    }
    const pendingExpenseCount = ledger.filter(x => x.approvalStatus === 'Pending').length;
    if (pendingExpenseCount > 0) {
      items.push({ id: 'pending-expenses', tone: 'amber', text: pendingExpenseCount + ' ledger ' + (pendingExpenseCount === 1 ? 'entry' : 'entries') + ' waiting on your approval', tab: 'ledger' });
    }
    const pendingAccess = accessRequests.filter(r => r.status === 'Pending').length;
    if (pendingAccess > 0) {
      items.push({ id: 'pending-access', tone: 'red', text: pendingAccess + ' access ' + (pendingAccess === 1 ? 'change' : 'changes') + ' from Legal waiting on your approval', tab: 'access-requests' });
    }
    const pendingProfileCount = profileRequests.filter(r => r.status === 'Pending').length;
    if (pendingProfileCount > 0) {
      items.push({ id: 'pending-profile', tone: 'amber', text: pendingProfileCount + ' artist profile ' + (pendingProfileCount === 1 ? 'change' : 'changes') + ' waiting on review', tab: 'roster' });
    }
    const openRequestCount = artistRequests.filter(r => r.status === 'Open').length;
    if (openRequestCount > 0) {
      items.push({ id: 'open-artist-requests', tone: 'amber', text: openRequestCount + ' artist ' + (openRequestCount === 1 ? 'request' : 'requests') + ' waiting on a response', tab: 'artist-requests' });
    }
  }
  const myPendingSubmissions = releaseSubmissions.filter(s => s.status === 'Pending' && (isAdmin || s.sentTo === sessionName));
  if (myPendingSubmissions.length > 0) {
    items.push({ id: 'pending-submissions', tone: 'amber', text: myPendingSubmissions.length + ' release ' + (myPendingSubmissions.length === 1 ? 'submission' : 'submissions') + ' waiting on review', tab: 'submissions' });
  }
  // Statements due within two weeks, or overdue, from each artist's schedule.
  if (canRoyalties) {
    let overdue = 0, soon = 0;
    roster.filter(a => (a.status || 'Active') === 'Active').forEach(a => {
      const per = lastClosedPeriod(a, today);
      const done = payouts.some(p => p.artistSlug === slug(a.name) && p.periodStart === per.start && p.periodEnd === per.end && p.status !== 'draft');
      const days = Math.round((Date.parse(per.due) - Date.parse(today)) / 86400000);
      if (!done && days < 0) overdue++; else if (!done && days <= 14) soon++;
    });
    if (overdue) items.push({ id: 'statements-overdue', tone: 'red', text: overdue + ' artist ' + (overdue === 1 ? 'statement is' : 'statements are') + ' overdue', tab: 'payouts' });
    if (soon) items.push({ id: 'statements-soon', tone: 'amber', text: soon + ' artist ' + (soon === 1 ? 'statement is' : 'statements are') + ' due in the next 14 days', tab: 'payouts' });
  }
  const dealWaiting = dealChanges.filter(c => c.status === 'Pending').length;
  if (isAdmin && dealWaiting) items.push({ id: 'deal-approvals', tone: 'amber', text: dealWaiting + ' deal ' + (dealWaiting === 1 ? 'change' : 'changes') + ' waiting on your approval', tab: 'deals' });
  const publishWaiting = revenuePublish.filter(e => e.status === 'Awaiting approval').length;
  if (isAdmin && publishWaiting > 0) {
    items.push({ id: 'publish-approvals', tone: 'amber', text: publishWaiting + ' publish ' + (publishWaiting === 1 ? 'request' : 'requests') + ' to artists waiting on your approval', tab: 'publish' });
  }
  // Invoices sitting in a queue this person handles (Admins also share PM Approval).
  const me = staff.find(m => m.name === sessionName);
  const workflow = labelSettings.invoiceWorkflow || {};
  const myInvoices = invoices.filter(i => { const st = invoiceStage(i); return st && me && (invoiceReviewers(i, roster, staff, workflow).some(m => m.id === me.id) || (isAdmin && st.who === 'pm')); });
  if (myInvoices.length > 0) {
    const total = myInvoices.reduce((t, i) => t + (Number(i.amount) || 0), 0);
    items.push({ id: 'my-invoices', tone: 'amber', text: myInvoices.length + ' ' + (myInvoices.length === 1 ? 'invoice' : 'invoices') + ' waiting on your approval (' + formatCurrency(total) + ')', tab: 'invoices' });
  }
  return items.sort((a, b) => (a.tone === 'red' ? 0 : 1) - (b.tone === 'red' ? 0 : 1));
}

function TopBar({ roster, catalog, staff, tasks = [], revenue = [], ledger = [], notices = [], profileRequests = [], artistRequests = [], releaseSubmissions = [], accessRequests = [], isAdmin = false, sessionName = '', notifications = [], setActive }) {
  const [query, setQuery] = useState('');
  const [showNotifs, setShowNotifs] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out = [];
    roster.forEach(a => { if (a.name.toLowerCase().includes(q)) out.push({ label: a.name, type: 'Artist', tab: 'roster' }); });
    catalog.forEach(c => {
      if (c.title.toLowerCase().includes(q) || (c.isrc || '').toLowerCase().includes(q) || (c.upc || '').toLowerCase().includes(q)) out.push({ label: c.title, type: 'Product', tab: 'catalog' });
    });
    staff.forEach(s => { if (s.name.toLowerCase().includes(q)) out.push({ label: s.name, type: 'Team', tab: 'team' }); });
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
                <span>{r.label}</span>
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
              <button key={n.id} onClick={() => { setActive(n.tab); setShowNotifs(false); }} className="flex items-start gap-2 w-full text-left px-3 py-2 text-sm hover:bg-white/5" style={{ borderBottom: '1px solid ' + C.border }}>
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
  function updateStreams(next) { logChange('Streams', streams, next); setStreams(next); persist('streams', next); }
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
  // License expiry is computed from release date + the artist's license period, never stored.
  const catalogView = useMemo(() => catalog.map(c => { const l = licenseOf(c, artistMap[c.artistId]); return { ...c, licenseExpiration: l.expires, license: l.status }; }), [catalog, artistMap]);
  const releaseMap = useMemo(() => Object.fromEntries(catalog.map(r => [r.id, r])), [catalog]);
  const approvedRevenue = useMemo(() => revenue.filter(e => (e.approvalStatus || 'Approved') === 'Approved'), [revenue]);
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
    ? teamAttention({ roster, catalog: catalogView, staff, tasks, revenue, ledger, profileRequests, artistRequests, releaseSubmissions, accessRequests, invoices, labelSettings, revenuePublish, dealChanges, payouts, canRoyalties: !!perms.royalties, isAdmin, sessionName: session.name })
    : []), [session, roster, catalogView, staff, tasks, revenue, ledger, profileRequests, artistRequests, releaseSubmissions, accessRequests, invoices, labelSettings, revenuePublish, dealChanges, payouts, perms.royalties, isAdmin]);

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
        <TopBar roster={roster} catalog={catalogView} staff={staff} tasks={tasks} revenue={revenue} ledger={ledger} notices={notices} profileRequests={profileRequests} artistRequests={artistRequests} releaseSubmissions={releaseSubmissions} accessRequests={accessRequests} isAdmin={isAdmin} sessionName={session.name} notifications={attention} setActive={setActive} />
        {error && (
          <div className="rounded px-3 py-2 text-xs mb-4" style={{ background: C.redSoft, color: C.red, border: '1px solid ' + C.red }}>{error}</div>
        )}
        {NAV.length === 0 && <EmptyState icon={ShieldCheck} title="No access granted yet" description="Ask your Admin to grant you access from the Team tab." />}
        {active === 'overview' && <Overview roster={roster} catalog={catalogView} revenue={approvedRevenue} masterGross={monthlyMasterGross} streams={streams} artistMap={artistMap} releaseMap={releaseMap} notices={notices} staff={staff} sessionName={session.name} canViewRoyalties={!!perms.royalties} attention={attention} onOpen={setActive} />}
        {active === 'import' && <ImportSection roster={roster} catalog={catalogView} revenue={revenue} streams={streams} updateRoster={updateRoster} updateCatalog={updateCatalog} updateRevenue={updateRevenue} updateStreams={updateStreams} masterGross={monthlyMasterGross} statementFiles={statementFiles} updateStatementFiles={updateStatementFiles} sessionName={session.name} />}
        {active === 'roster' && <RosterSection invoices={invoices} dealChanges={dealChanges} updateDealChanges={updateDealChanges} session={session} publishedRevenue={publishedRevenue} statementFiles={statementFiles} roster={roster} update={updateRoster} catalog={catalogView} staff={staff} canEdit={canEdit} pmScope={pmScope} revenue={approvedRevenue} streams={streams} masterGross={monthlyMasterGross} payouts={payouts} ledger={approvedLedger} labelSettings={labelSettings} canViewRoyalties={!!perms.royalties} canViewSpend={!!perms.spend} tasks={tasks} sessionName={session.name} isAdmin={isAdmin} profileRequests={profileRequests} updateProfileRequests={updateProfileRequests} />}
        {active === 'artist-requests' && <ArtistRequestsSection artistRequests={artistRequests} update={updateArtistRequests} roster={roster} sessionName={session.name} pmScope={pmScope} />}
        {active === 'team' && <TeamSection staff={staff} update={updateStaff} sessionRole={session.role} sessionName={session.name} accessRequests={accessRequests} updateAccessRequests={updateAccessRequests} />}
        {active === 'access-requests' && <AccessRequestsSection accessRequests={accessRequests} update={updateAccessRequests} staff={staff} updateStaff={updateStaff} isAdmin={isAdmin} sessionName={session.name} />}
        {active === 'backup' && <BackupSection
          allData={{ roster, catalog, revenue, streams, payouts, masterGross, labelSettings, staff, tasks, ledger, accessRequests, invoices }}
          updaters={{ roster: updateRoster, catalog: updateCatalog, revenue: updateRevenue, streams: updateStreams, payouts: updatePayouts, masterGross: updateMasterGross, labelSettings: updateLabelSettings, staff: updateStaff, tasks: updateTasks, ledger: updateLedger, accessRequests: updateAccessRequests, invoices: updateInvoices }}
          dataVersion={DATA_VERSION}
        />}
        {active === 'catalog' && <CatalogSection catalog={catalogView} update={updateCatalog} roster={roster} artistMap={artistMap} canEdit={canEdit} pmScope={pmScope} releaseSubmissions={releaseSubmissions} updateReleaseSubmissions={updateReleaseSubmissions} sessionName={session.name}  incomingSubmission={acceptingSubmission} clearIncoming={() => setAcceptingSubmission(null)} onOpenSubmissions={() => setActive('submissions')} />}
        {active === 'calendar' && <ReleaseCalendarSection catalog={catalogView} roster={roster} artistMap={artistMap} tasks={tasks} />}
        {active === 'revenue' && <RevenueSection revenue={revenue} update={updateRevenue} roster={roster} catalog={catalogView} canEdit={canEdit} isAdmin={isAdmin} sessionName={session.name} />}
        {active === 'streams' && <StreamsSection streams={streams} update={updateStreams} catalog={catalogView} releaseMap={releaseMap} artistMap={artistMap} canEdit={canEdit} />}
        {active === 'mastergross' && <MasterGrossSection masterGross={masterGross} update={updateMasterGross} roster={roster} revenue={approvedRevenue} labelSettings={labelSettings} updateLabelSettings={updateLabelSettings} canEdit={canEdit} />}
        {active === 'submissions' && <SubmissionsSection releaseSubmissions={releaseSubmissions} update={updateReleaseSubmissions} roster={roster} pmScope={pmScope} canEdit={canEdit} sessionName={session.name} onAccept={sub => { setAcceptingSubmission(sub); setActive('catalog'); }} />}
        {active === 'invoices' && <InvoicesSection invoices={invoices} update={updateInvoices} roster={roster} staff={staff} labelSettings={labelSettings} updateLabelSettings={updateLabelSettings} canEdit={canEdit} session={session} pmScope={pmScope} />}
        {active === 'deals' && <DealChanges roster={roster} updateRoster={updateRoster} changes={dealChanges} updateChanges={updateDealChanges} publishedRevenue={publishedRevenue} session={session} canEdit={canEdit} />}
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
