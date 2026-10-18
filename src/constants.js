// Domain constants, role/permission model and shared formatters.

export const LEDGER_CATEGORIES = ['Advance', 'Recording', 'Video Production', 'Marketing', 'Tour Support', 'Overhead', 'Software & Tools', 'Legal', 'Distro', 'Studio', 'Cash repayment', 'Other'];
// Income from an artist in this category is cash they paid back on request: it settles
// recoupable spend without touching their earnings.
export const CASH_REPAYMENT = 'Cash repayment';
// Includes the track-level types the royalty ledger actually uses, so every
// imported revenue row has an exact matching option rather than silently
// snapping to the first one when edited.
export const RELEASE_TYPES = ['Single', 'EP', 'EP Track', 'Album', 'Album Track', 'Backcatalog Single', '2 Pack', 'Compilation', 'Video'];
export const EXPLICIT_OPTIONS = ['Not Set', 'Explicit', 'Clean'];
export function emptyCredits() {
  return { performedBy: '', writtenBy: '', producedBy: '', recordingEngineer: '', mixingEngineer: '', masteringEngineer: '', dolbyEngineer: '' };
}
// Staff sign in with a label address. imullar.com today; imssrecords.com when the team moves.
export const STAFF_EMAIL_DOMAINS = ['imullar.com', 'imssrecords.com'];
export function isStaffEmailAllowed(email) {
  const domain = String(email || '').trim().toLowerCase().split('@')[1] || '';
  return STAFF_EMAIL_DOMAINS.includes(domain);
}
export const COLLABORATOR_ROLES = ['Feature', 'Producer', 'Songwriter', 'Co-Writer', 'Remixer', 'Other'];
// Roles that take a share of the song: a split % is required when one is listed.
export const SPLIT_REQUIRED_ROLES = ['Feature', 'Producer', 'Songwriter', 'Co-Writer'];
export const RELEASE_STATUSES = ['Processing', 'In Production', 'Upcoming', 'Released'];
export function releaseStatusTone(status) {
  if (status === 'Released') return 'teal';
  if (status === 'Processing') return 'default';
  return 'amber';
}
// Archived: kept with all their history, but no sign-in (see private.is_invited).
export const ARTIST_STATUSES = ['Active', 'On Hiatus', 'Former', 'Archived'];
export const FUNDING_TIERS = ['Non-Funded', 'Funded'];
// Deal categories under each funding tier. Add new categories here.
export const DEAL_TYPES = { Funded: ['Core', 'Recordings+'], 'Non-Funded': ['Distro', 'Distro+'] };
// Artist fields only deal viewers see (kept in step with private.deal_fields() in the database).
export const DEAL_FIELDS = ['artistPct', 'royaltyRate', 'fundingTier', 'dealType', 'dealTerms', 'contractType', 'licenseYears', 'effectiveDate', 'reportingPeriod', 'payoutThreshold', 'annualBudget', 'noExtension'];
export const dealLabel = a => (a.fundingTier || 'Non-Funded') + (a.dealType ? ' · ' + a.dealType : '');
export function artistStatusTone(status) {
  if (status === 'Active') return 'teal';
  if (status === 'Former') return 'red';
  return 'default';
}
export const STAFF_ROLES = ['Admin', 'Legal', 'Finance', 'Product Manager', 'A&R', 'Label Manager', 'Marketing', 'Label Rep', 'Other'];
// Admin and Legal both see everything. The difference is what happens when they
// change someone's access: an Admin's change applies at once, Legal's is queued
// for an Admin to approve.
// Admin and Legal both get the Team and Access Requests screens.
export function isPrivilegedRole(role) { return role === 'Admin' || role === 'Legal'; }
// Admin is the top of the tree: its access is fixed and nobody can dial it
// down. Legal starts with everything but an Admin can change that.
export function isTopRole(role) { return role === 'Admin'; }
export const ALL_PERMISSIONS = { royalties: true, spend: true, analytics: true, roster: true, catalog: true, notices: true, edits: true };
export const NO_PERMISSIONS = { royalties: false, spend: false, analytics: false, roster: false, catalog: false, notices: false, edits: false };
export const PERMISSION_FIELDS = [
  { key: 'analytics', label: 'Analytics', desc: 'Overview, streams, release calendar' },
  { key: 'roster', label: 'Roster', desc: 'Artist roster' },
  { key: 'catalog', label: 'Catalog', desc: 'Catalog and CSV imports' },
  { key: 'royalties', label: 'Artist earnings', desc: 'Revenue, master gross, payouts and statements — what each artist is actually making' },
  { key: 'spend', label: 'Budgets & expenses', desc: 'Label budgets, the ledger, and what has been spent on each artist' },
  { key: 'notices', label: 'Noticeboard', desc: 'Post announcements to artist dashboards' },
  { key: 'edits', label: 'Can edit', desc: 'Add, edit, and delete records in whatever they can see' },
];
export function defaultPermissionsForRole(role) {
  if (isPrivilegedRole(role)) return { ...ALL_PERMISSIONS };
  if (role === 'Finance') return { royalties: true, spend: true, analytics: true, roster: false, catalog: false, notices: false, edits: true };
  // A Product Manager runs the artist's campaign, so they get that artist's
  // budget and spend — but not what the artist earns.
  if (role === 'Product Manager') return { royalties: false, spend: true, analytics: true, roster: true, catalog: true, notices: false, edits: true };
  if (role === 'A&R' || role === 'Label Manager') return { royalties: false, spend: false, analytics: true, roster: true, catalog: true, notices: false, edits: true };
  // A Label Rep is an outside partner: no team pages; the database gives them only rep_portal().
  if (role === 'Label Rep') return { ...NO_PERMISSIONS };
  if (role === 'Marketing') return { royalties: false, spend: false, analytics: true, roster: false, catalog: true, notices: true, edits: false };
  return { ...NO_PERMISSIONS, analytics: true };
}
export function permissionsFor(staffMember) {
  if (!staffMember) return { ...NO_PERMISSIONS };
  if (isTopRole(staffMember.role)) return { ...ALL_PERMISSIONS };
  const p = staffMember.permissions;
  if (!p) return defaultPermissionsForRole(staffMember.role);
  // Records saved before earnings and spend were split carry the old single
  // `finance` key — read it as both so nobody silently loses access.
  if (p.royalties === undefined && p.finance !== undefined) {
    return { ...p, royalties: !!p.finance, spend: !!(p.budgets || p.finance) };
  }
  return p;
}

export const ONBOARDING_TASKS_TEMPLATE = [
  'Team profile created',
  'Access permissions assigned',
  'Introduced to roster and catalog',
  'Dashboard login confirmed',
  'Paperwork / NDA completed',
];
export function makeOnboardingChecklist() {
  return ONBOARDING_TASKS_TEMPLATE.map((label, i) => ({ id: 'ob' + i + '-' + uid(), label, done: i === 0 }));
}
export function onboardingProgress(member) {
  const list = (member && member.onboarding) || [];
  if (!list.length) return { done: 0, total: 0, pct: 0 };
  const done = list.filter(t => t.done).length;
  return { done, total: list.length, pct: Math.round((done / list.length) * 100) };
}
export const STAFF_STATUSES = ['Onboarding', 'Active', 'Inactive', 'Archived'];

export function checklistProgress(list) {
  if (!list || !list.length) return { done: 0, total: 0, pct: 0 };
  const done = list.filter(t => t.done).length;
  return { done, total: list.length, pct: Math.round((done / list.length) * 100) };
}
export const RELEASE_CHECKLIST_TEMPLATE = [
  'Mastering complete',
  'Artwork finalized',
  'Metadata submitted to distributor',
  'Distributor upload confirmed',
  'Playlist pitching sent',
  'Pre-save link live',
];
export function makeReleaseChecklist() {
  return RELEASE_CHECKLIST_TEMPLATE.map((label, i) => ({ id: 'rcl' + i + '-' + uid(), label, done: false }));
}

export const DISTRIBUTION_DOC_TEMPLATE = [
  { label: 'Audio file', required: true },
  { label: 'Producer agreement', required: true },
  { label: 'Split sheet', required: true },
  { label: 'Sample clearance', required: false },
  { label: 'Marketing plan', required: false },
  { label: 'DJ version', required: false },
  { label: 'Radio edit', required: false },
  { label: 'Press release', required: false },
];
export function makeDistributionDocs() {
  return DISTRIBUTION_DOC_TEMPLATE.map((t, i) => ({ id: 'dd' + i + '-' + uid(), label: t.label, required: t.required, attached: false, note: '' }));
}
export function missingRequiredDocs(list) {
  if (!list) return 0;
  return list.filter(d => d.required && !d.attached).length;
}


export const MARKETS = [
  'United States', 'United Kingdom', 'Canada', 'Australia', 'New Zealand', 'Ireland',
  'Germany', 'France', 'Spain', 'Italy', 'Netherlands', 'Sweden', 'Norway', 'Denmark', 'Poland', 'Portugal',
  'Japan', 'South Korea', 'China', 'India', 'Indonesia', 'Philippines', 'Vietnam', 'Thailand',
  'Brazil', 'Mexico', 'Argentina', 'Colombia', 'Chile', 'Peru',
  'Nigeria', 'South Africa', 'Ghana', 'Kenya', 'Egypt', 'Morocco',
  'United Arab Emirates', 'Saudi Arabia', 'Turkey', 'Israel',
];

export const GENRES = [
  'Pop', 'Alt-Pop', 'Indie Pop', 'Rock', 'Indie Rock', 'Alt-Rock', 'Punk', 'Metal',
  'Hip-Hop', 'Rap', 'R&B', 'Neo-Soul', 'Soul', 'Funk', 'Jazz', 'Blues',
  'Country', 'Folk', 'Americana', 'Electronic', 'House', 'Techno', 'Dance', 'EDM',
  'Reggae', 'Reggaeton', 'Latin', 'Afrobeats', 'K-Pop', 'J-Pop', 'Gospel', 'Classical', 'World', 'Other',
];
export const SUB_GENRES = [
  'Synth-Pop', 'Dream Pop', 'Bedroom Pop', 'Indie Folk', 'Alt-Rock', 'Post-Punk',
  'Trap', 'Boom Bap', 'Drill', 'Lo-fi', 'Neo-Soul', 'R&B', 'House', 'Techno',
  'Drum & Bass', 'Ambient', 'Country Pop', 'Latin Pop', 'Afrobeats', 'K-Pop', 'Other',
];
export const PLATFORMS = ['Spotify', 'Apple Music', 'Deezer', 'Amazon Music', 'YouTube Music', 'TikTok', 'Other'];
export const PLATFORM_COLORS = {
  'Spotify': '#5FA593',
  'Apple Music': '#C1584A',
  'Deezer': '#7B5FA5',
  'Amazon Music': '#7B9BC7',
  'YouTube Music': '#E7A23D',
  'TikTok': '#4A4E52',
  'Other': '#8B8F92'
};

export function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
export function formatCurrency(n) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0); }
// With cents, for breakdowns where whole dollars wouldn't visibly add up.
export function formatCents(n) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0); }
export function formatNumber(n) { return new Intl.NumberFormat('en-US').format(n || 0); }
export function formatDate(s) { if (!s) return '—'; const d = new Date(s + 'T00:00:00'); if (isNaN(d)) return s; return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
export function monthKey(s) { return (s || '').slice(0, 7); }
export function monthLabel(k) { if (!k) return ''; const parts = k.split('-'); const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1); return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }); }
export function todayStr() { return new Date().toISOString().slice(0, 10); }

export function expirationStatus(dateStr) {
  if (!dateStr) return null;
  const diffDays = Math.round((new Date(dateStr) - new Date(todayStr())) / 86400000);
  if (diffDays < 0) return { label: 'Expired', tone: 'red' };
  if (diffDays <= 90) return { label: 'Expiring soon', tone: 'amber' };
  return { label: 'Active', tone: 'teal' };
}

export function normalizeStr(s) { return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim(); }
export function normalizeIsrc(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
export function releaseCode(release) { return release ? (release.isrc || release.upc || '') : ''; }
export function trackOptionLabel(release, includeArtist, artistName) {
  const code = releaseCode(release);
  let label = release.title;
  if (includeArtist) label += ' — ' + (artistName || 'Unknown');
  if (code) label += ' · ' + code;
  return label;
}

export const ARTWORK_PALETTE = ['#E7A23D', '#5FA593', '#E07A6C', '#7B9BC7', '#9C84C4'];
export function artworkInitials(title) {
  return String(title || '?').trim().slice(0, 2).toUpperCase();
}
export function artworkColor(str) {
  const s = String(str || '');
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return ARTWORK_PALETTE[Math.abs(hash) % ARTWORK_PALETTE.length];
}


export const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

export function parseStatementDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  let m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (m) return m[1] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[3]).padStart(2, '0');
  m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (m) return m[3] + '-' + String(m[1]).padStart(2, '0') + '-' + String(m[2]).padStart(2, '0');
  m = s.match(/^(\d{4})[-\/](\d{1,2})$/);
  if (m) return m[1] + '-' + String(m[2]).padStart(2, '0') + '-01';
  m = s.match(/^(\d{1,2})[-\/](\d{4})$/);
  if (m) return m[2] + '-' + String(m[1]).padStart(2, '0') + '-01';
  m = s.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (m) {
    const idx = MONTH_NAMES.indexOf(m[1].toLowerCase());
    if (idx >= 0) return m[2] + '-' + String(idx + 1).padStart(2, '0') + '-01';
  }
  const d = new Date(s);
  if (!isNaN(d) && /\d{4}/.test(s)) return d.toISOString().slice(0, 10);
  return null;
}

export function parseAmount(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const cleaned = String(raw).replace(/[^0-9.\-]/g, '');
  if (cleaned === '' || cleaned === '-') return null;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

export function parseQuantity(raw) {
  if (raw === undefined || raw === null || raw === '') return 0;
  const cleaned = String(raw).replace(/[^0-9.]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : Math.round(n);
}

export function classifySource(store) {
  const s = normalizeStr(store);
  if (s.includes('sync')) return 'Sync';
  if (s.includes('vinyl') || s.includes('physical') || s.includes(' cd')) return 'Physical';
  if (s.includes('merch')) return 'Merch';
  if (s.includes('live') || s.includes('tour') || s.includes('festival')) return 'Live';
  return 'Streaming';
}

export function guessPlatform(store) {
  const s = normalizeStr(store);
  if (s.includes('spotify')) return 'Spotify';
  if (s.includes('apple')) return 'Apple Music';
  if (s.includes('deezer')) return 'Deezer';
  if (s.includes('amazon') || s.includes('prime')) return 'Amazon Music';
  if (s.includes('youtube')) return 'YouTube Music';
  if (s.includes('tiktok')) return 'TikTok';
  return 'Other';
}

export function computePlatformLeaderboard(streams, releaseMap, artistMap, currentMonth, previousMonth, topN) {
  const curMap = {};
  const prevMap = {};
  streams.forEach(s => {
    const mk = monthKey(s.date);
    const bucket = mk === currentMonth ? curMap : mk === previousMonth ? prevMap : null;
    if (!bucket) return;
    bucket[s.platform] = bucket[s.platform] || {};
    bucket[s.platform][s.releaseId] = (bucket[s.platform][s.releaseId] || 0) + s.count;
  });

  return PLATFORMS.map(platform => {
    const curEntries = curMap[platform] || {};
    const prevEntries = prevMap[platform] || {};
    const curSorted = Object.entries(curEntries).map(([releaseId, count]) => ({ releaseId, count })).sort((a, b) => b.count - a.count);
    const prevSorted = Object.entries(prevEntries).map(([releaseId, count]) => ({ releaseId, count })).sort((a, b) => b.count - a.count);
    const prevRankMap = {};
    prevSorted.forEach((e, i) => { prevRankMap[e.releaseId] = { rank: i + 1, count: e.count }; });

    const rows = curSorted.slice(0, topN).map((e, i) => {
      const release = releaseMap[e.releaseId] || null;
      const artist = release ? artistMap[release.artistId] : null;
      const prev = prevRankMap[e.releaseId] || null;
      const pctChange = prev && prev.count > 0 ? ((e.count - prev.count) / prev.count) * 100 : null;
      return {
        rank: i + 1,
        title: release ? release.title : 'Unknown',
        artistName: artist ? artist.name : '—',
        count: e.count,
        prevRank: prev ? prev.rank : null,
        pctChange,
      };
    });

    const totalCurrent = curSorted.reduce((s, e) => s + e.count, 0);
    const totalPrevious = prevSorted.reduce((s, e) => s + e.count, 0);
    const totalPctChange = totalPrevious > 0 ? ((totalCurrent - totalPrevious) / totalPrevious) * 100 : null;
    return { platform, rows, totalCurrent, totalPrevious, totalPctChange, hasData: curSorted.length > 0 };
  });
}

export const IMPORT_FIELD_ALIASES = {
  date: ['reporting month', 'period start', 'period', 'sale month', 'sales month', 'transaction date', 'month', 'date'],
  title: ['track title', 'release title', 'asset title', 'song title', 'track name', 'product name', 'product title', 'title', 'product'],
  isrc: ['asset isrc', 'track isrc', 'isrc'],
  upc: ['upc', 'ean', 'barcode', 'catalog number', 'catalog no'],
  artist: ['primary artist', 'artist name', 'artist'],
  store: ['store name', 'dsp name', 'platform', 'source', 'store', 'dsp'],
  amount: ['net payable', 'net revenue', 'royalty amount', 'royalty', 'earnings', 'amount', 'revenue'],
  quantity: ['stream count', 'quantity', 'streams', 'units', 'plays'],
};

export const IMPORT_FIELD_LABELS = {
  date: 'Period / date',
  title: 'Product name',
  isrc: 'ISRC',
  upc: 'UPC',
  artist: 'Artist name',
  store: 'Store / platform',
  amount: 'Net revenue',
  quantity: 'Streams / quantity',
};

export function guessColumn(headers, aliases) {
  const norm = headers.map(h => ({ raw: h, norm: h.toLowerCase().trim() }));
  for (const alias of aliases) {
    const hit = norm.find(h => h.norm === alias);
    if (hit) return hit.raw;
  }
  for (const alias of aliases) {
    const hit = norm.find(h => h.norm.includes(alias));
    if (hit) return hit.raw;
  }
  return '';
}

export function guessMapping(headers) {
  const mapping = {};
  Object.keys(IMPORT_FIELD_ALIASES).forEach(field => {
    mapping[field] = guessColumn(headers, IMPORT_FIELD_ALIASES[field]);
  });
  return mapping;
}

export function buildImportGroups(rows, mapping, catalog, roster) {
  const groups = {};
  rows.forEach((row, idx) => {
    const rawTitle = mapping.title ? (row[mapping.title] || '').trim() : '';
    const rawIsrc = mapping.isrc ? (row[mapping.isrc] || '').trim() : '';
    const rawUpc = mapping.upc ? (row[mapping.upc] || '').trim() : '';
    const rawArtist = mapping.artist ? (row[mapping.artist] || '').trim() : '';
    const normIsrc = normalizeIsrc(rawIsrc);
    const normUpc = String(rawUpc).replace(/[^0-9]/g, '');
    const key = normIsrc ? 'isrc:' + normIsrc : normUpc ? 'upc:' + normUpc : 'title:' + normalizeStr(rawTitle) + '|' + normalizeStr(rawArtist);
    if (!groups[key]) {
      let suggestedRelease = null;
      if (normIsrc) suggestedRelease = catalog.find(c => normalizeIsrc(c.isrc) === normIsrc) || null;
      if (!suggestedRelease && normUpc) suggestedRelease = catalog.find(c => String(c.upc || '').replace(/[^0-9]/g, '') === normUpc) || null;
      if (!suggestedRelease && rawTitle) {
        const titleMatches = catalog.filter(c => normalizeStr(c.title) === normalizeStr(rawTitle));
        if (titleMatches.length === 1) suggestedRelease = titleMatches[0];
        else if (titleMatches.length > 1 && rawArtist) {
          suggestedRelease = titleMatches.find(c => {
            const a = roster.find(x => x.id === c.artistId);
            return a && normalizeStr(a.name) === normalizeStr(rawArtist);
          }) || titleMatches[0];
        } else if (titleMatches.length > 1) {
          suggestedRelease = titleMatches[0];
        }
      }
      let suggestedArtist = suggestedRelease ? (roster.find(a => a.id === suggestedRelease.artistId) || null) : null;
      if (!suggestedArtist && rawArtist) suggestedArtist = roster.find(a => normalizeStr(a.name) === normalizeStr(rawArtist)) || null;
      groups[key] = {
        key,
        title: rawTitle || '(untitled product)',
        isrc: rawIsrc,
        upc: rawUpc,
        artistNameRaw: rawArtist,
        rowIndices: [],
        totalAmount: 0,
        releaseChoice: suggestedRelease ? suggestedRelease.id : '__create__',
        artistChoice: suggestedArtist ? suggestedArtist.id : '__new__',
        newArtistName: rawArtist || '',
      };
    }
    groups[key].rowIndices.push(idx);
    if (mapping.amount) {
      const amt = parseAmount(row[mapping.amount]);
      if (amt !== null) groups[key].totalAmount += amt;
    }
  });
  return Object.values(groups);
}

export function guessReleaseTitleFromFilename(name) {
  if (!name) return '';
  let base = String(name).replace(/\.csv$/i, '');
  base = base.replace(/[_\-\s]*royalt(y|ies)[_\-\s]*(summary|report|detail|statement)?[_\-\s]*\d*$/i, '');
  base = base.replace(/\d{6,}$/, '');
  base = base.replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!base) return '';
  return base.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

export function extractPivotTable(rows) {
  if (!rows || !rows.length) return null;
  const counts = {};
  rows.forEach(r => { counts[r.length] = (counts[r.length] || 0) + 1; });
  let width = 0, best = 0;
  Object.keys(counts).forEach(k => {
    const n = Number(k);
    if (n > 1 && counts[k] > best) { best = counts[k]; width = n; }
  });
  if (!width) return null;
  const tableRows = rows.filter(r => r.length === width);
  if (tableRows.length < 2) return null;
  const headerRow = tableRows[0].map(h => String(h || '').trim());
  const dataRows = tableRows.slice(1).filter(r => {
    const first = String(r[0] || '').trim().toLowerCase();
    return first && first !== 'total' && first !== 'totals';
  });
  return { headers: headerRow, rows: dataRows };
}

export function guessColumnIndex(headers, aliases, preferLast) {
  const matches = [];
  headers.forEach((h, i) => {
    const norm = String(h || '').toLowerCase().trim();
    if (norm.includes('---') || norm.includes('----')) return; // section-divider cells like "QUANTITY ---->"
    if (aliases.some(a => norm.includes(a))) matches.push(i);
  });
  if (!matches.length) return -1;
  return preferLast ? matches[matches.length - 1] : matches[0];
}

// Shown wherever artists see royalties (portal and emails). From the
// distribution partner: "roughly a 60 day or more lag in reporting".
export const REPORTING_LAG_NOTE = 'Royalty reports have a lag of about 60 days or more from our distribution partners, so the latest months take time to appear.';
// The lag in one example, worked out from today's month.
export function reportingLagExample(today = new Date()) {
  const label = d => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const now = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const reported = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
  return `For example, the ${label(now)} period covers earnings reported for ${label(reported)} and earlier. You can check this in a detailed royalty report, in the Approx. sales date column.`;
}
// EMPIRE's "Approx. Sales Date" for a royalty row: the month(s) the sales happened.
export function salesDateLabel(row) {
  const months = Object.keys((row && row.salesMonths) || {}).filter(Boolean).sort();
  if (!months.length) return '—';
  return months.length === 1 ? monthLabel(months[0]) : monthLabel(months[0]) + ' – ' + monthLabel(months[months.length - 1]);
}
export function salesDateRange(row) {
  const months = Object.keys((row && row.salesMonths) || {}).filter(Boolean).sort();
  return months.length ? (months.length === 1 ? months[0] : months[0] + ' to ' + months[months.length - 1]) : '';
}
