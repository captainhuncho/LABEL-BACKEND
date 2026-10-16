// Streams derived from EMPIRE revenue rows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { streamsFromRevenue } from '../src/streams.js';

const roster = [{ id: 'a', name: 'Aizo Clutch' }];
const catalog = [{ id: 'rel', artistId: 'a', title: 'Wave', isrc: 'QZ-TEST-26-00001' }];

test('per-platform rows become stream records on the matched release', () => {
  const rev = [{ id: 'r1', source: 'EMPIRE', artistSlug: 'aizo-clutch', title: 'Wave', isrc: 'QZTEST2600001', month: '2026-06', storeStreams: { Spotify: 10, YouTube: 5 } }];
  const s = streamsFromRevenue(rev, catalog, roster);
  assert.deepEqual(s.map(x => [x.platform, x.count, x.releaseId, x.date]), [['Spotify', 10, 'rel', '2026-06-01'], ['YouTube', 5, 'rel', '2026-06-01']]);
});

test('older rows count only stream types, as not broken down', () => {
  const rev = [{ id: 'r2', source: 'EMPIRE', artistSlug: 'aizo-clutch', title: 'wave', month: '2026-05', typeQty: { Track: 3, 'Audio Stream': 7, 'Video Stream': 2 } }];
  assert.deepEqual(streamsFromRevenue(rev, catalog, roster).map(x => [x.platform, x.count]), [['Not broken down', 9]]);
});
