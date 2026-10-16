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

// b) Swift fee proportional split (per artist, per month). The share is of the
// money actually received that month, not of the revenue imported so far, so an
// artist imported first doesn't carry the whole charge; the charge on money not
// yet matched to revenue stays with the label until it's imported.
const chargeBase = (mg, trackedTotal) => Math.max(Number(mg.totalGross) || 0, trackedTotal);
export function swiftShareFor(artistSlug, month, revenue, masterGross) {
  const own = revenue.filter(r => r.artistSlug === artistSlug && r.month === month);
  if (own.length && own.every(isFinal)) return own.reduce((t, r) => t + r.swiftShare, 0);
  const mg = masterGrossByMonth(masterGross)[month];
  if (!mg) return 0;
  const totalRev = chargeBase(mg, revByMonth(revenue)[month] || 0);
  if (totalRev <= 0) return 0;
  const artistRev = revByArtistMonth(revenue)[artistSlug + '|' + month] || 0;
  return mg.swiftFee * (artistRev / totalRev);
}

// b2) Deal terms are dated: each entry applies from its month until the next.
// Artists with no history have one open-ended entry built from their current
// fields, so nothing changes until a new term is added.
// A deal change is the split plus the deal it comes with; reporting and threshold are plain profile settings.
const TERM_FIELDS = ['artistPct', 'fundingTier', 'dealType'];
export function dealTermsOf(artist) {
  const list = Array.isArray(artist.dealTerms) && artist.dealTerms.length ? artist.dealTerms : [Object.fromEntries([['from', ''], ...TERM_FIELDS.map(k => [k, artist[k]])])];
  return [...list].sort((a, b) => String(a.from || '').localeCompare(String(b.from || '')));
}
export function termsAt(artist, month) {
  const list = dealTermsOf(artist);
  let t = list[0];
  for (const x of list) if (!x.from || x.from <= month) t = x;
  return t;
}
export function pctAt(artist, month) {
  const p = termsAt(artist, month).artistPct;
  return p != null ? Number(p) : 0;
}

// c) Artist lifetime totals
export function artistMonthsWithRevenue(artistSlug, revenue) {
  const months = new Set();
  revenue.forEach(r => { if (r.artistSlug === artistSlug) months.add(r.month); });
  return Array.from(months);
}
export function artistLifetime(artist, revenue, masterGross) {
  const aSlug = slug(artist.name);
  const own = revenue.filter(r => r.artistSlug === aSlug);
  if (own.length && own.every(isFinal)) {
    const gross = own.reduce((t, r) => t + r.earning, 0), swift = own.reduce((t, r) => t + r.swiftShare, 0), share = own.reduce((t, r) => t + r.artistShare, 0);
    return { gross, swift, net: gross - swift, artistPct: artist.artistPct != null ? artist.artistPct : 0, artistShare: share, labelShare: gross - swift - share, monthCount: new Set(own.map(r => r.month)).size };
  }
  const months = artistMonthsWithRevenue(aSlug, revenue);
  const byArtistMonth = revByArtistMonth(revenue);
  // Each month at the % in force that month.
  let gross = 0, swift = 0, share = 0;
  months.forEach(m => {
    const g = byArtistMonth[aSlug + '|' + m] || 0, c = swiftShareFor(aSlug, m, revenue, masterGross);
    gross += g; swift += c; share += (g - c) * pctAt(artist, m);
  });
  const net = gross - swift;
  return { gross, swift, net, artistPct: artist.artistPct != null ? artist.artistPct : 0, artistShare: share, labelShare: net - share, monthCount: months.length };
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
// Everything spent on an artist is recouped from their earnings: every label
// expense recorded against them, plus their own expense claims once approved
// for payment (Pay Approved or Paid). Service/fee invoices are payment for work,
// not spend, so they're not recouped.
export const RECOUPED_CLAIM_STATUSES = ['Pay Approved', 'Paid'];
// Artists don't pay recoupable spend back in cash; it comes out of royalties.
// The rare exception, cash the label asked for, is recorded as income from the
// artist in the 'Cash repayment' category and settles spend directly.
export function artistSpend(artist, ledger, invoices = []) {
  const byLabel = ledger.filter(l => l.type === 'expense' && l.artist === artist.name).reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const claims = invoices.filter(i => i.artistId === artist.id && i.kind === 'expense' && RECOUPED_CLAIM_STATUSES.includes(i.status)).reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const repaidCash = ledger.filter(l => l.type === 'income' && l.artist === artist.name && l.category === 'Cash repayment').reduce((s, l) => s + (Number(l.amount) || 0), 0);
  // budgetUsed: what counts against an allocated budget; total: what's left to recoup from royalties.
  return { byLabel, claims, repaidCash, budgetUsed: byLabel + claims, total: Math.max(0, byLabel + claims - repaidCash) };
}
export function recoupmentForArtist(artist, ledger, revenue, masterGross, invoices = []) {
  const spent = artistSpend(artist, ledger, invoices).total;
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
  let gross = 0, swift = 0, share = 0;
  months.forEach(m => {
    const g = byArtistMonth[aSlug + '|' + m] || 0, c = swiftShareFor(aSlug, m, revenue, masterGross);
    gross += g; swift += c; share += (g - c) * pctAt(artist, m);
  });
  const net = gross - swift;
  // artistPct is the period's effective rate; with a mid-period change it's a blend.
  return { months, gross, swift, net, artistPct: net ? share / net : pctAt(artist, periodEnd), artistShare: share, labelShare: net - share };
}

// g2) One revenue row's breakdown: its slice of that month's inbound banking
// charge (proportional to its earning), then the artist/label split. Rows of an
// artist sum to the same totals as artistLifetime / payoutStatementFor.
// A published row carries its final figures (`final`); artists' screens show
// those as-is and never recompute them.
export const isFinal = r => !!r && r.final === true;
export function revenueRowSplit(row, revenue, masterGross, artistPct) {
  if (isFinal(row)) { const net = row.earning - row.swiftShare; return { gross: row.earning, charge: row.swiftShare, net, artistShare: row.artistShare, labelShare: net - row.artistShare }; }
  const mg = masterGrossByMonth(masterGross)[row.month];
  const monthTotal = mg ? chargeBase(mg, revByMonth(revenue)[row.month] || 0) : 0;
  const charge = mg && monthTotal > 0 ? mg.swiftFee * row.earning / monthTotal : 0;
  const net = row.earning - charge;
  return { gross: row.earning, charge, net, artistShare: net * artistPct, labelShare: net * (1 - artistPct) };
}

// g3) Breakdown of revenue rows by one detail map (stores, countries, types,
// models, salesMonths), each part getting its proportional slice of the row's
// artist earnings. Rows without that detail land in "Not broken down".
export function revenueBreakdown(rows, field, splitOf) {
  const map = {};
  rows.forEach(r => {
    const detail = r[field] && Object.keys(r[field]).length ? r[field] : { 'Not broken down': r.earning };
    const yours = splitOf(r).artistShare;
    Object.entries(detail).forEach(([key, gross]) => {
      const m = map[key] || (map[key] = { key, gross: 0, yours: 0 });
      m.gross += gross;
      m.yours += r.earning ? yours * gross / r.earning : 0;
    });
  });
  // Undetailed money goes last so the real breakdown leads.
  return Object.values(map).sort((a, b) => (a.key === 'Not broken down') - (b.key === 'Not broken down') || b.gross - a.gross);
}

// h) Label P&L (all-time)
export function labelPnL(roster, revenue, masterGross, ledger) {
  const totals = companyFinanceTotals(roster, revenue, masterGross);
  const lt = ledgerTotals(ledger);
  return { labelEarn: totals.labelEarn, ledgerIncome: lt.income, ledgerExpense: lt.expense, netProfit: totals.labelEarn + lt.income - lt.expense };
}
/* ================== end finance model ================== */

// i) Publishing to artists. Artists see a snapshot of revenue taken at publish
// time, each row carrying its Inbound Banking Charge share so later edits to
// other artists' months can't move it.
export function publishSnapshot(rows, approvedRevenue, masterGross, roster = null) {
  const at = new Date().toISOString();
  const pctOf = (s, month) => { const a = roster && roster.find(x => slug(x.name) === s); return a && termsAt(a, month).artistPct != null ? pctAt(a, month) : null; };
  return rows.map(r => {
    const charge = revenueRowSplit(r, approvedRevenue, masterGross, 0).charge, pct = pctOf(r.artistSlug, r.month);
    // With the artist's % known, the row is final: charge, % and earnings are fixed here.
    return pct == null ? { ...r, swiftShare: charge, publishedAt: at } : { ...r, swiftShare: charge, artistPct: pct, artistShare: (r.earning - charge) * pct, final: true, publishedAt: at };
  });
}

// What one artist sees from the snapshot: their rows, plus a per-month charge
// equal to their own share (so the portal's proportional split gives it back exactly).
export function artistPublishedView(published, artistSlug) {
  const revenue = published.filter(r => r.artistSlug === artistSlug);
  const fees = {};
  revenue.forEach(r => { fees[r.month] = (fees[r.month] || 0) + (Number(r.swiftShare) || 0); });
  return { revenue, masterGross: Object.keys(fees).map(month => ({ month, totalGross: 0, swiftFee: fees[month] })) };
}

// Per artist-month: is the live book different from what artists can see?
const rowSig = rows => rows.map(r => r.id + ':' + Math.round((Number(r.earning) || 0) * 100)).sort().join('|');
// With masterGross, a published month whose charge no longer matches today's
// calculation also counts as Changed, so a corrected charge can be republished.
export function publishDiff(approvedRevenue, published, masterGross = null, roster = null) {
  const group = list => {
    const m = {};
    list.forEach(r => { const k = r.artistSlug + '|' + r.month; (m[k] = m[k] || []).push(r); });
    return m;
  };
  const live = group(approvedRevenue), pub = group(published);
  return [...new Set([...Object.keys(live), ...Object.keys(pub)])].map(k => {
    const l = live[k] || [], p = pub[k] || [];
    const [artistSlug, month] = k.split('|');
    let state = !p.length ? 'New' : !l.length ? 'Removed' : rowSig(l) === rowSig(p) ? 'Published' : 'Changed';
    let chargeChanged = false;
    if (state === 'Published' && masterGross) {
      const ra = roster && roster.find(a => slug(a.name) === artistSlug);
      const pct = ra ? pctAt(ra, month) : null;
      chargeChanged = l.some(r => {
        const q = p.find(x => x.id === r.id); if (!q) return true;
        const charge = revenueRowSplit(r, approvedRevenue, masterGross, 0).charge;
        return Math.abs((Number(q.swiftShare) || 0) - charge) >= 0.005 || (pct != null && (!q.final || Math.abs(q.artistShare - (r.earning - charge) * pct) >= 0.005));
      });
      if (chargeChanged) state = 'Changed';
    }
    return { key: k, artistSlug, month, chargeChanged, artist: (l[0] || p[0]).artist, liveRows: l, liveGross: l.reduce((t, r) => t + r.earning, 0), publishedGross: p.reduce((t, r) => t + r.earning, 0), state };
  }).sort((a, b) => b.month.localeCompare(a.month) || a.artist.localeCompare(b.artist));
}

// Replace the snapshot for the given artist-months with the live rows.
export function applyPublish(published, keys, approvedRevenue, masterGross, roster = null) {
  const set = new Set(keys);
  const keep = published.filter(r => !set.has(r.artistSlug + '|' + r.month));
  const rows = approvedRevenue.filter(r => set.has(r.artistSlug + '|' + r.month));
  return [...keep, ...publishSnapshot(rows, approvedRevenue, masterGross, roster)];
}

// j) Each artist's reporting schedule. Periods close on calendar month ends
// (quarterly: Mar/Jun/Sep/Dec, half-yearly: Jun/Dec); the statement is due a
// set number of days after the cutoff.
export const REPORTING_PERIODS = { monthly: 1, quarterly: 3, 'half-yearly': 6 };
export const DEFAULT_DELIVERY_DAYS = { monthly: 30, quarterly: 90, 'half-yearly': 90 };
const addMonths = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 7); };
const lastDay = ym => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };

export function reportingTerms(artist) {
  const period = REPORTING_PERIODS[artist.reportingPeriod] ? artist.reportingPeriod : 'quarterly';
  const days = Number(artist.deliveryDays) > 0 ? Number(artist.deliveryDays) : DEFAULT_DELIVERY_DAYS[period];
  return { period, months: REPORTING_PERIODS[period], deliveryDays: days, threshold: Number(artist.payoutThreshold) || 0 };
}

// The most recent period whose cutoff is on or before `today` (YYYY-MM-DD).
export function lastClosedPeriod(artist, today) {
  const { months, deliveryDays } = reportingTerms(artist);
  let end = addMonths(today.slice(0, 7), -1);
  while (Number(end.slice(5, 7)) % months !== 0) end = addMonths(end, -1);
  const cutoff = lastDay(end);
  const due = new Date(Date.parse(cutoff + 'T00:00:00Z') + deliveryDays * 86400000).toISOString().slice(0, 10);
  return { start: addMonths(end, 1 - months), end, cutoff, due };
}

// Threshold with carry-forward: a balance under the threshold rolls into the
// next statement. `previous` is the artist's last non-draft statement, if any.
export function applyThreshold(periodShare, previous, threshold) {
  const carriedIn = previous ? Number(previous.carriedOut) || 0 : 0;
  const totalDue = periodShare + carriedIn;
  const below = threshold > 0 && totalDue < threshold;
  return { carriedIn, totalDue, belowThreshold: below, carriedOut: below ? totalDue : 0 };
}

// k) A payment can cover several statement months (EMPIRE holds balances under
// its $300 minimum and pays them together). Entered once, as on the remittance
// sheet, with `periodStart`; the engine works per month, so the payment and its
// single charge are spread over the covered months by what each month earned.
export function expandRemittances(masterGross, revenue) {
  const rev = revByMonth(revenue);
  return masterGross.flatMap(g => {
    if (!g.periodStart || g.periodStart >= g.month) return [g];
    const months = monthRange(g.periodStart, g.month);
    const total = months.reduce((t, m) => t + (rev[m] || 0), 0);
    return months.map(m => {
      const share = total > 0 ? (rev[m] || 0) / total : (m === g.month ? 1 : 0);
      return { ...g, id: g.id + '_' + m, month: m, totalGross: g.totalGross * share, swiftFee: g.swiftFee * share, remittanceOf: g.id };
    });
  });
}

// l) Checks before publishing to artists. Recomputes each artist-month from the
// raw figures (not through revenueRowSplit) so a bug in one path is caught by
// the other. `errors` block publishing; `warnings` need a look.
export function publishChecks(keys, approvedRevenue, masterGross, roster, published = []) {
  const errors = [], warnings = [];
  const fee = {}, base = {};
  masterGross.forEach(g => { fee[g.month] = (fee[g.month] || 0) + (Number(g.swiftFee) || 0); base[g.month] = (base[g.month] || 0) + (Number(g.totalGross) || 0); });
  const tracked = {};
  approvedRevenue.forEach(r => { tracked[r.month] = (tracked[r.month] || 0) + (Number(r.earning) || 0); });
  const rows = applyPublish(published, keys, approvedRevenue, masterGross, roster);
  const nameOf = s => (roster.find(a => slug(a.name) === s) || {}).name || s;
  keys.forEach(k => {
    const [aSlug, month] = k.split('|');
    const mine = rows.filter(r => r.artistSlug === aSlug && r.month === month);
    if (!mine.length) return;
    const artist = roster.find(a => slug(a.name) === aSlug);
    const label = nameOf(aSlug) + ' ' + month;
    if (!artist) errors.push(label + ': artist isn’t on the Roster');
    else if (termsAt(artist, month).artistPct == null || pctAt(artist, month) < 0 || pctAt(artist, month) > 1) errors.push(label + ': artist % isn’t set correctly on the Roster');
    if (fee[month] === undefined) warnings.push(label + ': no Money received for this month, so no Inbound Banking Charge is taken');
    const gross = mine.reduce((t, r) => t + r.earning, 0);
    const charged = mine.reduce((t, r) => t + (Number(r.swiftShare) || 0), 0);
    const denom = Math.max(base[month] || 0, tracked[month] || 0);
    const expected = fee[month] && denom > 0 ? fee[month] * gross / denom : 0;
    if (Math.abs(charged - expected) >= 0.01) errors.push(label + ': charge ' + charged.toFixed(2) + ' should be ' + expected.toFixed(2));
    if (charged > gross + 0.005) errors.push(label + ': charge is more than the gross');
    if (artist && termsAt(artist, month).artistPct != null) {
      const stored = mine.reduce((t, r) => t + (Number(r.artistShare) || 0), 0), due = (gross - expected) * pctAt(artist, month);
      if (Math.abs(stored - due) >= 0.01) errors.push(label + ': earnings ' + stored.toFixed(2) + ' should be ' + due.toFixed(2));
    }
    if ((tracked[month] || 0) > (base[month] || 0) + 0.01 && base[month] !== undefined) warnings.push(label + ': imported revenue for ' + month + ' (' + (tracked[month]).toFixed(2) + ') is more than the money received (' + base[month].toFixed(2) + ')');
  });
  // Across everyone who'd be published for a month, charges can't exceed that month's fee.
  [...new Set(keys.map(k => k.split('|')[1]))].forEach(month => {
    const total = rows.filter(r => r.month === month).reduce((t, r) => t + (Number(r.swiftShare) || 0), 0);
    if (total > (fee[month] || 0) + 0.01) errors.push(month + ': artists would be charged ' + total.toFixed(2) + ' in total, more than the ' + (fee[month] || 0).toFixed(2) + ' charge');
  });
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
