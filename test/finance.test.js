// Baseline from CLAUDE.md — if a change moves these, the change is wrong unless intended.
import test from 'node:test';
import assert from 'node:assert/strict';
import { artistLifetime, companyFinanceTotals, revenueBreakdown, revenueRowSplit, slug, swiftShareFor } from '../src/finance.js';
import { SEED_ROSTER, SEED_REVENUE, SEED_MASTER_GROSS } from '../src/seed.js';

const cents = n => Math.round(n * 100) / 100;

test('seed data matches the verified baseline', () => {
  const t = companyFinanceTotals(SEED_ROSTER, SEED_REVENUE, SEED_MASTER_GROSS);
  assert.equal(cents(t.totalGross), 13256.50);
  assert.equal(cents(t.totalSwift), 840.00);
  assert.equal(cents(t.trackedGross), 9812.20);
  assert.equal(cents(t.artistEarn), 6797.34);
  assert.equal(cents(t.labelEarn), 2404.05);
  // Artists carry the charge only on money matched to revenue; the rest stays with the label.
  assert.equal(cents(t.trackedGross - t.trackedNet), 610.81);
  assert.equal(cents(t.untrackedGap), 3444.30);
});

test('per-row splits add up to each artist\'s lifetime totals', () => {
  for (const a of SEED_ROSTER) {
    const rows = SEED_REVENUE.filter(r => r.artistSlug === slug(a.name));
    const sum = rows.map(r => revenueRowSplit(r, SEED_REVENUE, SEED_MASTER_GROSS, a.artistPct))
      .reduce((s, x) => ({ charge: s.charge + x.charge, artistShare: s.artistShare + x.artistShare }), { charge: 0, artistShare: 0 });
    const lt = artistLifetime(a, SEED_REVENUE, SEED_MASTER_GROSS);
    assert.equal(cents(sum.charge), cents(lt.swift), a.name);
    assert.equal(cents(sum.artistShare), cents(lt.artistShare), a.name);
  }
});

test('swift fee splits proportionally and is zero with no revenue', () => {
  const revenue = [
    { artistSlug: 'a', month: '2026-01', earning: 300 },
    { artistSlug: 'b', month: '2026-01', earning: 100 },
  ];
  const mg = [{ month: '2026-01', totalGross: 400, swiftFee: 40 }, { month: '2026-02', totalGross: 0, swiftFee: 40 }];
  assert.equal(swiftShareFor('a', '2026-01', revenue, mg), 30);
  assert.equal(swiftShareFor('b', '2026-01', revenue, mg), 10);
  assert.equal(swiftShareFor('a', '2026-02', revenue, mg), 0);
});

test('portal data (own rows + pre-split charge) gives the same row figures', () => {
  const a = SEED_ROSTER.find(x => x.id === 'aizo-clutch');
  const own = SEED_REVENUE.filter(r => r.artistSlug === slug(a.name));
  // What artist_portal() sends: each month's charge already cut to this artist's share.
  const months = [...new Set(own.map(r => r.month))];
  const portalMG = months.map(m => ({ month: m, totalGross: 0, swiftFee: swiftShareFor(slug(a.name), m, SEED_REVENUE, SEED_MASTER_GROSS) }));
  for (const r of own) {
    const full = revenueRowSplit(r, SEED_REVENUE, SEED_MASTER_GROSS, a.artistPct);
    const portal = revenueRowSplit(r, own, portalMG, a.artistPct);
    assert.ok(Math.abs(full.artistShare - portal.artistShare) < 1e-9, r.id);
  }
});

test('breakdowns split the artist earnings across platforms without losing any', () => {
  const revenue = [
    { artistSlug: 'a', month: '2026-01', earning: 100, stores: { Spotify: 60, YouTube: 40 } },
    { artistSlug: 'a', month: '2026-02', earning: 50 },
  ];
  const mg = [{ month: '2026-01', totalGross: 100, swiftFee: 10 }, { month: '2026-02', totalGross: 50, swiftFee: 5 }];
  const splitOf = r => revenueRowSplit(r, revenue, mg, 0.7);
  const parts = revenueBreakdown(revenue, 'stores', splitOf);
  assert.deepEqual(parts.map(p => p.key), ['Spotify', 'YouTube', 'Not broken down']);
  assert.equal(cents(parts.find(p => p.key === 'Spotify').yours), cents((100 - 10) * 0.7 * 0.6));
  const total = parts.reduce((t, p) => t + p.yours, 0);
  assert.equal(cents(total), cents((90 + 45) * 0.7));
});

test('publishing: snapshot, diff and artist view', async () => {
  const { applyPublish, publishDiff, artistPublishedView } = await import('../src/finance.js');
  const rev = [
    { id: 'a_s_2026-01', artistSlug: 'a', artist: 'A', title: 's', month: '2026-01', earning: 75 },
    { id: 'b_t_2026-01', artistSlug: 'b', artist: 'B', title: 't', month: '2026-01', earning: 25 },
  ];
  const mg = [{ month: '2026-01', totalGross: 100, swiftFee: 20 }];
  assert.deepEqual(publishDiff(rev, []).map(d => d.state), ['New', 'New']);
  const pub = applyPublish([], ['a|2026-01'], rev, mg);
  assert.equal(pub.length, 1);
  assert.equal(Math.round(pub[0].swiftShare * 100), 1500);
  const view = artistPublishedView(pub, 'a');
  assert.equal(Math.round(view.masterGross[0].swiftFee * 100), 1500);
  assert.equal(artistPublishedView(pub, 'b').revenue.length, 0);
  const edited = [{ ...rev[0], earning: 80 }, rev[1]];
  const states = Object.fromEntries(publishDiff(edited, pub).map(d => [d.artistSlug, d.state]));
  assert.deepEqual(states, { a: 'Changed', b: 'New' });
});

test('reporting schedule and payout threshold', async () => {
  const { lastClosedPeriod, applyThreshold, reportingTerms } = await import('../src/finance.js');
  const q = { reportingPeriod: 'quarterly' };
  assert.deepEqual(lastClosedPeriod(q, '2026-10-16'), { start: '2026-07', end: '2026-09', cutoff: '2026-09-30', due: '2026-12-29' });
  assert.equal(lastClosedPeriod(q, '2026-04-01').due, '2026-06-29');
  const m = { reportingPeriod: 'monthly' };
  assert.deepEqual(lastClosedPeriod(m, '2026-11-05'), { start: '2026-10', end: '2026-10', cutoff: '2026-10-31', due: '2026-11-30' });
  assert.equal(lastClosedPeriod({ reportingPeriod: 'half-yearly' }, '2026-10-16').end, '2026-06');
  assert.equal(reportingTerms({}).period, 'quarterly');
  const first = applyThreshold(30, null, 50);
  assert.deepEqual(first, { carriedIn: 0, totalDue: 30, belowThreshold: true, carriedOut: 30 });
  const second = applyThreshold(25, first, 50);
  assert.deepEqual(second, { carriedIn: 30, totalDue: 55, belowThreshold: false, carriedOut: 0 });
  assert.equal(applyThreshold(10, null, 0).belowThreshold, false);
});

test('a payment covering several months spreads by earnings', async () => {
  const { expandRemittances } = await import('../src/finance.js');
  const rev = [{ artistSlug: 'a', month: '2026-02', earning: 30 }, { artistSlug: 'a', month: '2026-03', earning: 90 }];
  const out = expandRemittances([{ id: 'r', month: '2026-03', periodStart: '2026-02', totalGross: 120, swiftFee: 30 }, { id: 'x', month: '2026-04', totalGross: 5, swiftFee: 1 }], rev);
  assert.deepEqual(out.map(g => [g.month, g.totalGross, g.swiftFee]), [['2026-02', 30, 7.5], ['2026-03', 90, 22.5], ['2026-04', 5, 1]]);
  const none = expandRemittances([{ id: 'r', month: '2026-03', periodStart: '2026-01', totalGross: 10, swiftFee: 3 }], []);
  assert.deepEqual(none.map(g => g.swiftFee), [0, 0, 3]);
});

test('pre-publish checks: Aizo May/Jun 2026 by hand, and the failures they catch', async () => {
  const { publishChecks, applyPublish, revenueRowSplit } = await import('../src/finance.js');
  const roster = [{ name: 'Aizo Clutch', artistPct: 0.7 }];
  const rev = [
    { id: 'j', artistSlug: 'aizo-clutch', artist: 'Aizo Clutch', month: '2026-06', earning: 292.75 },
    { id: 'm', artistSlug: 'aizo-clutch', artist: 'Aizo Clutch', month: '2026-05', earning: 61.67 },
  ];
  const mg = [{ month: '2026-06', totalGross: 762.34, swiftFee: 30 }, { month: '2026-05', totalGross: 423.64, swiftFee: 30 }];
  // Hand figures: Jun 0.7 × (292.75 − 30 × 292.75/762.34) = 196.86; May = 40.11.
  const share = r => revenueRowSplit(r, rev, mg, 0.7).artistShare;
  assert.equal(share(rev[0]).toFixed(2), '196.86');
  assert.equal(share(rev[1]).toFixed(2), '40.11');
  assert.deepEqual(publishChecks(['aizo-clutch|2026-06', 'aizo-clutch|2026-05'], rev, mg, roster), { errors: [], warnings: [] });
  // No Money received → warning; missing artist % → error; a tampered snapshot → error.
  assert.equal(publishChecks(['aizo-clutch|2026-06'], rev, [], roster).warnings.length, 1);
  assert.equal(publishChecks(['aizo-clutch|2026-06'], rev, mg, [{ name: 'Aizo Clutch' }]).errors.length, 1);
  // Another artist already published for June carrying the full 30: June's total would exceed the fee.
  const other = [{ id: 'o', artistSlug: 'someone', artist: 'Someone', month: '2026-06', earning: 100, swiftShare: 30 }];
  const over = publishChecks(['aizo-clutch|2026-06'], rev, mg, roster, other);
  assert.equal(over.errors.length, 1);
  assert.match(over.errors[0], /more than the 30.00 charge/);
});
