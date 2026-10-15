// EMPIRE "Detailed Royalty Report" CSVs: a summary block, then one line per
// service × country × usage. Pure functions so they're testable in Node.
//
// Booking rules (agreed with the label):
// - Revenue is booked under the Statement Date: when IMSS received the money.
// - Approx. Sales Date (when EMPIRE collected it) is kept as detail only.
// - "Net (Raw)" is the artist's gross; the rounded "Net" column loses cents.

const MONTHS = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

// "Jun 2026" → "2026-06"; already-ISO values pass through.
export function empireMonth(value) {
  const s = String(value || '').trim();
  if (/^\d{4}-\d{2}/.test(s)) return s.slice(0, 7);
  const m = s.match(/^([A-Za-z]{3})[a-z]*\s+(\d{4})$/);
  return m && MONTHS[m[1].toLowerCase()] ? m[2] + '-' + MONTHS[m[1].toLowerCase()] : '';
}

// EMPIRE titles carry invisible joiners and explicit-version suffixes.
export function cleanTitle(value) {
  return String(value || '')
    .replace(/[​-‏⁠-⁤﻿]/g, '')
    .replace(/\s*\((?:not explicit|explicit|clean)\)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const money = v => {
  const n = parseFloat(String(v ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

export function isEmpireDetailed(rows) {
  return Array.isArray(rows) && rows.some(r => Array.isArray(r) && r[0] === 'Statement Date' && r.includes('Net (Raw)'));
}

// rows: the CSV as arrays (e.g. Papa.parse(text).data).
export function parseEmpireDetailed(rows) {
  const headerIdx = rows.findIndex(r => r && r[0] === 'Statement Date');
  if (headerIdx < 0) throw new Error('This isn’t an EMPIRE detailed royalty report (no “Statement Date” header).');
  const header = rows[headerIdx].map(h => String(h || '').trim());
  const col = name => header.indexOf(name);
  const need = ['Statement Date', 'Approx. Sales Date', 'Service Group', 'Track Title', 'Track Artist', 'Quantity', 'Net (Raw)'];
  const missing = need.filter(n => col(n) < 0);
  if (missing.length) throw new Error('The report is missing columns: ' + missing.join(', '));

  const totalsRow = rows.slice(0, headerIdx).find(r => r && String(r[0]).trim() === 'Totals');
  const totals = totalsRow ? { quantity: money(totalsRow[1]), gross: money(totalsRow[2]) } : null;

  const get = (r, name) => (col(name) >= 0 ? String(r[col(name)] ?? '').trim() : '');
  const lines = rows.slice(headerIdx + 1)
    .filter(r => r && r[col('Statement Date')])
    .map(r => ({
      statementMonth: empireMonth(get(r, 'Statement Date')),
      salesMonth: empireMonth(get(r, 'Approx. Sales Date')),
      serviceGroup: get(r, 'Service Group') || 'Other',
      service: get(r, 'Service'),
      upc: get(r, 'UPC_EAN'),
      catalogNo: get(r, 'Catalog #'),
      productTitle: cleanTitle(get(r, 'Product Title')),
      productArtist: get(r, 'Product Artist'),
      isrc: get(r, 'ISRC').toUpperCase(),
      trackTitle: cleanTitle(get(r, 'Track Title')),
      trackArtist: get(r, 'Track Artist') || get(r, 'Product Artist'),
      type: get(r, 'Type') || 'Other',
      model: get(r, 'Commercial Model') || 'Other',
      usage: get(r, 'Usage Type'),
      country: get(r, 'Country') || '??',
      quantity: money(get(r, 'Quantity')),
      gross: money(get(r, 'Net (Raw)') || get(r, 'Net')),
    }));
  return { lines, totals };
}

const add = (map, key, amount) => { map[key] = (map[key] || 0) + amount; };

// One entry per artist × track × statement month, with breakdowns of gross.
// Bundle/album lines with no track title fall back to the product title.
export function aggregateEmpire(lines) {
  const groups = {};
  lines.forEach(l => {
    const title = l.trackTitle || l.productTitle;
    const key = [l.trackArtist.toLowerCase(), title.toLowerCase(), l.statementMonth].join('|');
    const g = groups[key] || (groups[key] = {
      artist: l.trackArtist, title, isrc: l.isrc, upc: l.upc, month: l.statementMonth,
      gross: 0, quantity: 0, lines: 0, stores: {}, countries: {}, types: {}, models: {}, salesMonths: {}, typeQty: {},
    });
    if (!g.isrc && l.isrc) g.isrc = l.isrc;
    g.gross += l.gross; g.quantity += l.quantity; g.lines += 1;
    add(g.stores, l.serviceGroup, l.gross);
    add(g.countries, l.country, l.gross);
    add(g.types, l.type, l.gross);
    add(g.models, l.model, l.gross);
    add(g.salesMonths, l.salesMonth || l.statementMonth, l.gross);
    add(g.typeQty, l.type, l.quantity);
  });
  return Object.values(groups).sort((a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title) || a.month.localeCompare(b.month));
}
