// Song licenses and rights, per the artist's contract type.
//
// 2026 Distribution Agreement (clause 7.1): each song is licensed for its agreed
// years from the date it first became available through IMSS. If the artist's
// account is unrecouped on that end date (published royalties vs recorded
// spend), the license runs on until the end of the first accounting quarter in
// which the account is recouped, as confirmed by an Admin.
//
// Earlier agreement (clauses 1b, 8a, 8b): the license runs its 1 or 2 years from
// the contract's Effective Date. After that, or after a termination notice, the
// Retention Period depends on recoupment and dates; Legal or Admin decides when
// rights return. The system shows the dates and never decides.
//
// Nothing here is stored: statuses are computed on read.
import { recoupmentForArtist } from './finance.js';

export const CONTRACT_TYPES = { '2026': '2026 Distribution Agreement', earlier: 'Earlier agreement' };
export const WARN_DAYS = 182; // flag 6 months ahead

const pad = n => String(n).padStart(2, '0');
const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
export const addYears = (d, y) => (Number(d.slice(0, 4)) + Number(y)) + d.slice(4, 10);
export function addDays(d, n) { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
export function addMonths(d, n) {
  const [y, m, day] = d.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(Math.min(day, last));
}
const daysBetween = (a, b) => (Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000;
const monthEnd = m => { const [y, mo] = m.split('-').map(Number); return m + '-' + pad(new Date(Date.UTC(y, mo, 0)).getUTCDate()); };
// Accounting quarters end 31 Mar, 30 Jun, 30 Sep, 31 Dec (2026 agreement, clause 12.1).
export function quarterEndOf(d) {
  const y = Number(d.slice(0, 4)), q = Math.ceil(Number(d.slice(5, 7)) / 3) * 3;
  return monthEnd(y + '-' + pad(q));
}
export const later = (...ds) => ds.filter(Boolean).sort().slice(-1)[0] || '';

// The artist's recoupment balance as at a date, from published royalties and the
// spend recorded up to that date. Positive = unrecouped.
export function balanceAt(artist, date, { ledger = [], invoices = [], publishedRevenue = [] } = {}) {
  const l = ledger.filter(x => String(x.date || '') <= date);
  const inv = invoices.filter(i => String(i.invoiceDate || i.submittedAt || '').slice(0, 10) <= date);
  const rev = publishedRevenue.filter(r => r.month && monthEnd(r.month) <= date);
  return recoupmentForArtist(artist, l, rev, [], inv).balance;
}
const recouped = b => b <= 0.005;

const returnedFor = (song, artist) => (artist.rightsReturned || []).find(r => r.releaseId === song.id || !r.releaseId);
const terminationFor = (song, artist) => (artist.terminations || []).filter(t => t.releaseId === song.id || !t.releaseId).map(t => t.noticeDate).sort()[0] || '';
// 2026 songs pre-fill their start from the release date until Legal or Admin sets it.
export const songStart = song => song.availableFrom || '';

// One song's license. `ctx` holds ledger, invoices and publishedRevenue for balanceAt.
export function licenseFor(song, artist, ctx = {}, today = new Date().toISOString().slice(0, 10)) {
  const st = (label, tone) => ({ label, tone });
  if (!artist) return { status: st('Artist missing', 'amber'), missing: ['artist'] };
  const ret = returnedFor(song, artist);
  const base = { type: artist.contractType || '', missing: [] };
  if (ret) return { ...base, returned: ret, status: st('Rights returned', 'red') };
  if (!CONTRACT_TYPES[artist.contractType]) return { ...base, missing: ['contract type'], status: st('Contract type missing', 'amber') };

  if (artist.contractType === '2026') {
    const start = songStart(song), years = Number(song.licenseYears);
    const missing = [!isDate(start) && 'first available through IMSS date', !(years > 0) && 'license years'].filter(Boolean);
    if (missing.length) return { ...base, missing, status: st(isDate(song.releaseDate) || isDate(start) ? 'License details missing' : 'Release date missing', 'amber') };
    const end = addYears(start, years);
    const out = { ...base, start, years, end };
    if (today < end) return { ...out, status: daysBetween(today, end) <= WARN_DAYS ? st('Expiring soon', 'amber') : st('Active', 'teal') };
    if (artist.noExtension) return { ...out, endsOn: end, status: st('Ended: confirm return', 'red') };
    const bal = balanceAt(artist, end, ctx);
    out.balanceAtEnd = bal;
    if (recouped(bal)) return { ...out, endsOn: end, status: st('Ended: confirm return', 'red') };
    const conf = (artist.recoupConfirmations || []).map(c => c.quarterEnd).filter(q => q >= end).sort()[0];
    if (conf && today >= conf) return { ...out, endsOn: conf, status: st('Ended: confirm return', 'red') };
    return { ...out, heldUntilRecouped: true, status: st('Held until recouped', 'amber') };
  }

  // Earlier agreement.
  const start = artist.effectiveDate || '', years = Number(artist.licenseYears);
  const missing = [!isDate(start) && 'contract Effective Date', !(years > 0) && 'license years'].filter(Boolean);
  if (missing.length) return { ...base, missing, status: st('License details missing', 'amber') };
  const end = addYears(start, years);
  const notice = terminationFor(song, artist);
  const out = { ...base, start, years, end };
  if (notice) {
    const termEnds = addDays(notice, 30); // 30 days' written notice (clause 8a)
    out.dates = { licenseEnd: end, notice, termEnds, retentionYearEnds: addYears(termEnds, 1), windDownEnds: addMonths(termEnds, 6), takedownBy: addDays(termEnds, 60) };
  }
  if (today < end && !notice) return { ...out, status: daysBetween(today, end) <= WARN_DAYS ? st('Expiring soon', 'amber') : st('Active', 'teal') };
  return { ...out, decide: true, status: st(notice ? 'Terminated: Legal to decide' : 'Past license period: Legal to decide', 'amber') };
}

// What the artist's export and portal say about IMSS Records' rights.
export function rightsLine(lic) {
  const s = lic.status ? lic.status.label : '';
  if (s === 'Rights returned') return 'Rights returned to artist on ' + lic.returned.date;
  if (s === 'Active' || s === 'Expiring soon') return 'Licensed to IMSS Records until ' + lic.end;
  if (s === 'Held until recouped') return 'Licensed to IMSS Records until the account is recouped (license period ended ' + lic.end + ')';
  if (s === 'Ended: confirm return' || lic.decide) return 'Licensed to IMSS Records; return of rights under review';
  return 'Licensed to IMSS Records';
}

// Flags for Admin and Legal: what needs a decision or missing information.
export function licenseFlags(roster, catalog, ctx, today = new Date().toISOString().slice(0, 10)) {
  const out = [];
  roster.forEach(a => {
    const songs = catalog.filter(c => c.artistId === a.id);
    if (!CONTRACT_TYPES[a.contractType]) { out.push({ kind: 'contract', artistId: a.id, text: a.name + ': contract type missing' }); return; }
    if (a.contractType === 'earlier' && (a.reportingPeriod !== 'monthly' || Number(a.payoutThreshold) !== 300))
      out.push({ kind: 'reporting', artistId: a.id, text: a.name + ': earlier agreement pays monthly with a $300 threshold; reporting is set differently' });
    const lics = songs.map(s => [s, licenseFor(s, a, ctx, today)]);
    const count = label => lics.filter(([, l]) => l.status.label === label).length;
    const missing = lics.filter(([, l]) => l.missing && l.missing.length).length;
    if (missing) out.push({ kind: 'missing', artistId: a.id, text: a.name + ': ' + missing + ' song' + (missing === 1 ? '' : 's') + ' missing license details' });
    const soon = count('Expiring soon');
    if (soon) out.push({ kind: 'soon', artistId: a.id, text: a.name + ': ' + soon + ' license' + (soon === 1 ? '' : 's') + ' expiring within 6 months' });
    const decide = lics.filter(([, l]) => l.decide || l.status.label === 'Ended: confirm return').length;
    if (decide) out.push({ kind: 'decide', artistId: a.id, text: a.name + ': rights decision needed on ' + decide + ' song' + (decide === 1 ? '' : 's') });
    if (lics.some(([, l]) => l.heldUntilRecouped) && recouped(balanceAt(a, today, ctx)))
      out.push({ kind: 'recouped', artistId: a.id, text: a.name + ': balance is $0, ready to mark recouped' });
  });
  return out;
}
