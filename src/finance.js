// Pure finance engine — every figure in the app is computed here.
/* ================== IMSS Finance Model (per finance spec) ==================
   5 entities: artists (roster w/ artistPct + distroLabel), revenue (one row
   per track per month), masterGross (one row per calendar month, company-
   wide), ledger (non-royalty income/expense + recoupment tracking), payouts
   (saved statements). Everything below is computed on read — never stored —
   from artists/revenue/masterGross/ledger, per the spec's section 2 formulas.
   Money math stays in floating dollars throughout; round only at display. */

export function slug(s) {
  return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Cache per array: state is replaced, never mutated, so a new array means fresh data.
function cached(cache, arr, build) {
  let v = cache.get(arr);
  if (!v) { v = build(arr); cache.set(arr, v); }
  return v;
}
const revByMonthCache = new WeakMap(), revByArtistMonthCache = new WeakMap(), masterGrossCache = new WeakMap();

// a) Monthly aggregates
export function revByMonth(revenue) { return cached(revByMonthCache, revenue, buildRevByMonth); }
function buildRevByMonth(revenue) {
  const m = {};
  revenue.forEach(r => { m[r.month] = (m[r.month] || 0) + r.earning; });
  return m;
}
export function revByArtistMonth(revenue) { return cached(revByArtistMonthCache, revenue, buildRevByArtistMonth); }
function buildRevByArtistMonth(revenue) {
  const m = {};
  revenue.forEach(r => { const k = r.artistSlug + '|' + r.month; m[k] = (m[k] || 0) + r.earning; });
  return m;
}
export function masterGrossByMonth(masterGross) { return cached(masterGrossCache, masterGross, buildMasterGrossByMonth); }
function buildMasterGrossByMonth(masterGross) {
  const m = {};
  masterGross.forEach(g => { m[g.month] = g; });
  return m;
}

// b) Swift fee proportional split (per artist, per month)
export function swiftShareFor(artistSlug, month, revenue, masterGross) {
  const mg = masterGrossByMonth(masterGross)[month];
  if (!mg) return 0;
  const totalRev = revByMonth(revenue)[month] || 0;
  if (totalRev <= 0) return 0;
  const artistRev = revByArtistMonth(revenue)[artistSlug + '|' + month] || 0;
  return mg.swiftFee * (artistRev / totalRev);
}

// c) Artist lifetime totals
export function artistMonthsWithRevenue(artistSlug, revenue) {
  const months = new Set();
  revenue.forEach(r => { if (r.artistSlug === artistSlug) months.add(r.month); });
  return Array.from(months);
}
export function artistLifetime(artist, revenue, masterGross) {
  const aSlug = slug(artist.name);
  const months = artistMonthsWithRevenue(aSlug, revenue);
  const byArtistMonth = revByArtistMonth(revenue);
  let gross = 0, swift = 0;
  months.forEach(m => {
    gross += byArtistMonth[aSlug + '|' + m] || 0;
    swift += swiftShareFor(aSlug, m, revenue, masterGross);
  });
  const net = gross - swift;
  const pct = artist.artistPct != null ? artist.artistPct : 0;
  return { gross, swift, net, artistPct: pct, artistShare: net * pct, labelShare: net * (1 - pct), monthCount: months.length };
}

// d) Company-wide totals
export function companyFinanceTotals(roster, revenue, masterGross) {
  const totalGross = masterGross.reduce((s, g) => s + g.totalGross, 0);
  const totalSwift = masterGross.reduce((s, g) => s + g.swiftFee, 0);
  const totalNet = totalGross - totalSwift;
  let trackedGross = 0, trackedNet = 0, artistEarn = 0, labelEarn = 0;
  roster.forEach(a => {
    const lt = artistLifetime(a, revenue, masterGross);
    trackedGross += lt.gross; trackedNet += lt.net; artistEarn += lt.artistShare; labelEarn += lt.labelShare;
  });
  return { totalGross, totalSwift, totalNet, trackedGross, trackedNet, artistEarn, labelEarn, untrackedGap: totalGross - trackedGross };
}

// e) Ledger (non-royalty) totals
export function ledgerTotals(ledger) {
  const income = ledger.filter(l => l.type === 'income').reduce((s, l) => s + l.amount, 0);
  const expense = ledger.filter(l => l.type === 'expense').reduce((s, l) => s + l.amount, 0);
  return { income, expense, net: income - expense };
}

// f) Recoupment by artist
export function recoupmentForArtist(artist, ledger, revenue, masterGross) {
  const spent = ledger.filter(l => l.type === 'expense' && l.recoupable && l.artist === artist.name).reduce((s, l) => s + l.amount, 0);
  const earned = artistLifetime(artist, revenue, masterGross).artistShare;
  const balance = spent - earned;
  return { spent, earned, recouped: Math.min(spent, earned), balance, unrecouped: balance > 0 ? balance : 0, dueOnTop: balance <= 0 ? -balance : 0 };
}

// g) Payout statement (arbitrary period)
export function monthRange(start, end) {
  const out = [];
  if (!start || !end) return out;
  let [sy, sm] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  let guard = 0;
  while ((sy < ey || (sy === ey && sm <= em)) && guard < 1200) {
    out.push(sy + '-' + String(sm).padStart(2, '0'));
    sm++; if (sm > 12) { sm = 1; sy++; }
    guard++;
  }
  return out;
}
export function payoutStatementFor(artist, periodStart, periodEnd, revenue, masterGross) {
  const aSlug = slug(artist.name);
  const months = monthRange(periodStart, periodEnd);
  const byArtistMonth = revByArtistMonth(revenue);
  let gross = 0, swift = 0;
  months.forEach(m => {
    gross += byArtistMonth[aSlug + '|' + m] || 0;
    swift += swiftShareFor(aSlug, m, revenue, masterGross);
  });
  const net = gross - swift;
  const pct = artist.artistPct != null ? artist.artistPct : 0;
  return { months, gross, swift, net, artistPct: pct, artistShare: net * pct, labelShare: net * (1 - pct) };
}

// g2) One revenue row's breakdown: its slice of that month's inbound banking
// charge (proportional to its earning), then the artist/label split. Rows of an
// artist sum to the same totals as artistLifetime / payoutStatementFor.
export function revenueRowSplit(row, revenue, masterGross, artistPct) {
  const mg = masterGrossByMonth(masterGross)[row.month];
  const monthTotal = revByMonth(revenue)[row.month] || 0;
  const charge = mg && monthTotal > 0 ? mg.swiftFee * row.earning / monthTotal : 0;
  const net = row.earning - charge;
  return { gross: row.earning, charge, net, artistShare: net * artistPct, labelShare: net * (1 - artistPct) };
}

// h) Label P&L (all-time)
export function labelPnL(roster, revenue, masterGross, ledger) {
  const totals = companyFinanceTotals(roster, revenue, masterGross);
  const lt = ledgerTotals(ledger);
  return { labelEarn: totals.labelEarn, ledgerIncome: lt.income, ledgerExpense: lt.expense, netProfit: totals.labelEarn + lt.income - lt.expense };
}
/* ================== end finance model ================== */
