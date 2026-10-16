// License rules (2026 agreement clause 7.1; earlier agreement clauses 1b, 8a, 8b).
import test from 'node:test';
import assert from 'node:assert/strict';
import { balanceAt, licenseFor, quarterEndOf, rightsLine } from '../src/licenses.js';

const A = { id: 'a', name: 'Aizo', artistPct: 0.5, contractType: '2026' };
const song = { id: 's1', artistId: 'a', availableFrom: '2021-03-01', licenseYears: 5 };
const spend = amount => [{ type: 'expense', artist: 'Aizo', amount, date: '2021-01-10' }];
const pub = (month, artistShare) => ({ artistSlug: 'aizo', month, earning: artistShare * 2, swiftShare: 0, artistShare, final: true });

test('quarter ends', () => {
  assert.equal(quarterEndOf('2026-02-10'), '2026-03-31');
  assert.equal(quarterEndOf('2026-11-01'), '2026-12-31');
});

test('2026: active, expiring soon, ended when recouped', () => {
  assert.equal(licenseFor(song, A, {}, '2025-01-01').status.label, 'Active');
  assert.equal(licenseFor(song, A, {}, '2025-12-01').status.label, 'Expiring soon');
  const l = licenseFor(song, A, {}, '2026-03-02');
  assert.equal(l.status.label, 'Ended: confirm return');
  assert.equal(l.endsOn, '2026-03-01');
});

test('2026: unrecouped at the end date holds until the confirmed quarter', () => {
  const ctx = { ledger: spend(100), publishedRevenue: [pub('2025-06', 40)] };
  assert.equal(balanceAt(A, '2026-03-01', ctx), 60);
  assert.equal(licenseFor(song, A, ctx, '2026-05-01').status.label, 'Held until recouped');
  const confirmed = { ...A, recoupConfirmations: [{ quarterEnd: '2026-06-30' }] };
  assert.equal(licenseFor(song, confirmed, ctx, '2026-05-01').status.label, 'Held until recouped');
  const l = licenseFor(song, confirmed, ctx, '2026-07-01');
  assert.equal(l.status.label, 'Ended: confirm return');
  assert.equal(l.endsOn, '2026-06-30');
});

test('2026: royalties published after the end date do not count at the end date', () => {
  const ctx = { ledger: spend(100), publishedRevenue: [pub('2026-04', 500)] };
  assert.equal(licenseFor(song, A, ctx, '2026-05-01').status.label, 'Held until recouped');
});

test('2026: missing details are flagged, never guessed', () => {
  assert.equal(licenseFor({ id: 's2', artistId: 'a' }, A).status.label, 'Release date missing');
  assert.deepEqual(licenseFor({ id: 's2', releaseDate: '2024-01-01' }, A).missing, ['first available through IMSS date', 'license years']);
  assert.equal(licenseFor(song, { ...A, contractType: '' }).status.label, 'Contract type missing');
});

test('earlier agreement: Legal decides after the period or a termination', () => {
  const E = { ...A, contractType: 'earlier', effectiveDate: '2024-01-15', licenseYears: 2 };
  assert.equal(licenseFor(song, E, {}, '2025-01-01').status.label, 'Active');
  assert.equal(licenseFor(song, E, {}, '2026-02-01').status.label, 'Past license period: Legal to decide');
  const T = { ...E, terminations: [{ releaseId: 's1', noticeDate: '2025-03-01' }] };
  const l = licenseFor(song, T, {}, '2025-03-05');
  assert.equal(l.status.label, 'Terminated: Legal to decide');
  assert.equal(l.dates.termEnds, '2025-03-31');
  assert.equal(l.dates.retentionYearEnds, '2026-03-31');
  assert.equal(l.dates.takedownBy, '2025-05-30');
  assert.equal(licenseFor({ ...song, id: 'other' }, T, {}, '2025-03-05').status.label, 'Active');
});

test('rights returned wins and reads plainly', () => {
  const R = { ...A, rightsReturned: [{ releaseId: 's1', date: '2026-04-01' }] };
  const l = licenseFor(song, R);
  assert.equal(l.status.label, 'Rights returned');
  assert.equal(rightsLine(l), 'Rights returned to artist on 2026-04-01');
});

test('Admin or Legal override wins over every rule', () => {
  const ctx = { ledger: spend(100), publishedRevenue: [] };
  const o = { ...song, licenseOverride: { endDate: '2027-06-30', note: 'side letter', by: 'Legal' } };
  assert.equal(licenseFor(song, A, ctx, '2026-05-01').status.label, 'Held until recouped');
  assert.equal(licenseFor(o, A, ctx, '2026-05-01').status.label, 'Active');
  assert.equal(licenseFor(o, A, ctx, '2027-02-01').status.label, 'Expiring soon');
  assert.equal(licenseFor(o, A, ctx, '2027-07-01').status.label, 'Ended: confirm return');
  const E = { ...A, contractType: 'earlier', effectiveDate: '2020-01-01', licenseYears: 1 };
  assert.equal(licenseFor(o, E, {}, '2026-05-01').status.label, 'Active');
});
