// EMPIRE detailed report parsing: booking month, gross column, breakdowns.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Papa from 'papaparse';
import { aggregateEmpire, catalogCodeFills, cleanTitle, empireMonth, isEmpireDetailed, parseEmpireDetailed } from '../src/empire.js';

const rows = Papa.parse(readFileSync(new URL('./fixtures/empire-sample.csv', import.meta.url), 'utf8')).data;
const cents = n => Math.round(n * 100) / 100;

test('recognises the format and reads the totals', () => {
  assert.ok(isEmpireDetailed(rows));
  const { lines, totals } = parseEmpireDetailed(rows);
  assert.equal(lines.length, 4);
  assert.deepEqual(totals, { quantity: 1802, gross: 5.45 });
  assert.equal(cents(lines.reduce((t, l) => t + l.gross, 0)), 5.45); // Net (Raw), not rounded Net
});

test('books by statement month and keeps the sales month as detail', () => {
  const groups = aggregateEmpire(parseEmpireDetailed(rows).lines);
  assert.deepEqual(groups.map(g => [g.title, g.month, cents(g.gross)]), [['Demo Song', '2026-05', 2.7], ['Demo Song', '2026-06', 2.75]]);
  const june = groups.find(g => g.month === '2026-06');
  assert.deepEqual(Object.keys(june.salesMonths), ['2026-04']);
  assert.equal(cents(june.stores.Spotify), 2);
  assert.equal(cents(june.countries.US), 0.75);
  assert.equal(june.quantity, 1300);
  assert.equal(june.isrc, 'QZTEST000001');
});

test('line without a track title falls back to the product title', () => {
  const may = aggregateEmpire(parseEmpireDetailed(rows).lines).find(g => g.month === '2026-05');
  assert.equal(cents(may.types.Track), 1.2);
  assert.equal(may.lines, 2);
});

test('cleans titles and months', () => {
  assert.equal(cleanTitle('⁠⁠Ask Me Nothing (Not Explicit)'), 'Ask Me Nothing');
  assert.equal(empireMonth('Jun 2026'), '2026-06');
  assert.equal(empireMonth('2026-03-01'), '2026-03');
});

test('counts streams per platform, leaving downloads out', () => {
  const june = aggregateEmpire(parseEmpireDetailed(rows).lines).find(g => g.month === '2026-06');
  assert.deepEqual(june.storeStreams, { Spotify: 1000, YouTube: 300 });
});

test('catalogCodeFills fills only empty codes and flags differences', () => {
  const catalog = [
    { id: 'a', title: 'Empty', isrc: '', upc: '' },
    { id: 'b', title: 'Has', isrc: 'QZABC2600001', upc: '' },
    { id: 'c', title: 'Two codes', isrc: '' },
    { id: 'd', title: 'Untouched', isrc: '' },
  ];
  const groups = [
    { release: catalog[0], isrc: 'qz-abc-26-00009', upc: '0123456789012' },
    { release: catalog[0], isrc: 'QZABC2600009', upc: '' },
    { release: catalog[1], isrc: 'QZABC2600002', upc: '' },
    { release: catalog[2], isrc: 'QZABC2600003' },
    { release: catalog[2], isrc: 'QZABC2600004' },
    { release: null, isrc: 'QZABC2600005' },
  ];
  const { next, filled, mismatches } = catalogCodeFills(groups, catalog);
  assert.deepEqual(next[0], { id: 'a', title: 'Empty', isrc: 'QZABC2600009', upc: '0123456789012' });
  assert.equal(next[1].isrc, 'QZABC2600001');
  assert.equal(next[2].isrc, '');
  assert.equal(next[3], catalog[3]);
  assert.equal(filled.length, 2);
  assert.deepEqual(mismatches.map(m => m.id + ':' + m.field).sort(), ['b:isrc', 'c:isrc']);
});
