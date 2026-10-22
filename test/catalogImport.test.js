// Catalog import from a distributor catalog export: fill empty fields only, add
// missing tracks, flag clashes, skip artists not on the Roster.
import test from 'node:test';
import assert from 'node:assert/strict';
import { onePerIsrc, planCatalogImport, readCatalogRows, splitArtists, toIsoDate } from '../src/catalogImport.js';

const rows = [
  ['Product ID', 'Product Title', 'UPC', 'Release Date', 'Genre', 'Sub-Genre', 'Track #', 'ISRC', 'Track Title', 'Track Artist', 'Duration', 'Explicit'],
  ['P1', 'TEST EP', '0123456789012', '2026-07-09', 'Rap/Hip-Hop', '', '1', 'QZ-ABC-26-00001', 'Song One', 'Main Act', '2:03', 'Y'],
  ['', '', '', '', '', '', '2', 'QZABC2600002', 'Song Two', 'Main Act & Guest A', '03:55', ''],
  ['', '', '', '', '', '', '3', 'QZABC2600003', 'Song Three', 'Main Act, Guest B & Guest C', '1:51', ''],
  ['P2', 'Lead Single', '0999999999999', '06/25/2026', 'Dance', 'Beats & Breaks', '1', 'QZABC2600009', 'Lead Single', 'Main Act', '305', 'N'],
  ['P3', 'Other', '0555555555555', '2027-01-01', 'Pop', '', '1', 'QZABC2600010', 'Nobody', 'Not Signed', '3:00', ''],
];
const roster = [{ id: 'main', name: 'Main Act' }];
const catalog = [
  { id: 'c1', artistId: 'main', title: 'Song One', type: 'Single', isrc: '', upc: '', releaseDate: '2024-08-22', explicit: 'Not Set', collaborators: [] },
  { id: 'c2', artistId: 'main', title: 'Song Two', type: 'Single', isrc: 'QZABC2600099', upc: '', collaborators: [] },
  { id: 'c3', artistId: 'main', title: 'Lead Single', type: 'Single', isrc: '', upc: '0999999999999', collaborators: [{ name: 'Someone', role: 'Feature' }] },
];

test('reads product rows and carries product fields onto each track', () => {
  const { tracks, error } = readCatalogRows(rows);
  assert.equal(error, undefined);
  assert.equal(tracks.length, 5);
  assert.deepEqual(tracks[0], { isrc: 'QZABC2600001', upc: '0123456789012', title: 'Song One', artists: ['Main Act'], album: 'TEST EP', releaseDate: '2026-07-09', genre: 'Rap/Hip-Hop', trackNumber: 1, duration: '2:03', explicit: 'Explicit', productType: '', productId: 'P1', label: '', type: 'EP Track' });
  assert.equal(tracks[1].upc, '0123456789012');
  assert.deepEqual(tracks[2].artists, ['Main Act', 'Guest B', 'Guest C']);
  assert.equal(tracks[3].type, 'Single');
  assert.equal(tracks[3].releaseDate, '2026-06-25');
  assert.equal(tracks[3].duration, '5:05');
  assert.equal(tracks[3].genre, 'Dance / Beats & Breaks');
});

test('fills empty fields, adds missing tracks, flags clashes, skips unknown artists', () => {
  let n = 0;
  const plan = planCatalogImport(readCatalogRows(rows).tracks, catalog, roster, () => 'new' + (++n), '2026-10-21');
  const c1 = plan.next.find(c => c.id === 'c1');
  assert.equal(c1.isrc, 'QZABC2600001');
  assert.equal(c1.upc, '0123456789012');
  assert.equal(c1.explicit, 'Explicit');
  assert.equal(c1.album, 'TEST EP');
  assert.equal(c1.releaseDate, '2024-08-22'); // never replaced
  assert.equal(c1.type, 'Single');
  // Song Two: the Catalog's copy has a different ISRC, so it's another song: added, nothing overwritten
  assert.equal(plan.next.find(c => c.id === 'c2').isrc, 'QZABC2600099');
  assert.deepEqual(plan.adds.map(a => a.title).sort(), ['Song Three', 'Song Two']);
  assert.deepEqual(plan.adds.find(a => a.title === 'Song Three').collaborators.map(c => c.name), ['Guest B', 'Guest C']);
  // Lead Single: existing features kept
  assert.equal(plan.next.find(c => c.id === 'c3').collaborators[0].name, 'Someone');
  assert.deepEqual(plan.clashes.map(c => c.id + ':' + c.field), ['c1:releaseDate']);
  assert.deepEqual(plan.unknown, [{ title: 'Nobody', artists: 'Not Signed' }]);
  assert.equal(plan.next.length, catalog.length + 2);
});

test('helpers', () => {
  assert.deepEqual(splitArtists('A feat. B x C'), ['A', 'B', 'C']);
  assert.equal(toIsoDate('25/06/2026'), '2026-06-25');
  assert.equal(toIsoDate('05/06/2026'), ''); // ambiguous day/month
  assert.deepEqual(readCatalogRows([['Name', 'Amount']]).tracks, []);
});

test('names with & inside stay whole; one song per ISRC prefers the single', () => {
  assert.deepEqual(splitArtists('Surreal Sessions, Moh&DaLee & Naitor'), ['Surreal Sessions', 'Moh&DaLee', 'Naitor']);
  const one = onePerIsrc([
    { isrc: 'QZABC2600001', type: 'EP Track', album: 'EP', upc: '1', releaseDate: '2026-04-23' },
    { isrc: 'QZABC2600001', type: 'Single', album: 'Lead', upc: '2', releaseDate: '2026-03-26' },
  ]);
  assert.equal(one.length, 1);
  assert.equal(one[0].upc, '2');
  assert.deepEqual(one[0].alsoOn, ['EP']);
});

test('a near-identical title is flagged, not added as a duplicate', () => {
  const cat = [{ id: 'w', artistId: 'main', title: 'Wave', isrc: '', collaborators: [] }];
  const plan = planCatalogImport([{ isrc: 'QZABC2600050', title: 'Waves', artists: ['Main Act'], type: 'EP Track', album: 'X', upc: '', releaseDate: '', genre: '', trackNumber: 4, duration: '', explicit: '', label: '' }], cat, roster, () => 'n');
  assert.equal(plan.adds.length, 0);
  assert.deepEqual(plan.maybe.map(m => m.title + '|' + m.fileTitle), ['Wave|Waves']);
});
