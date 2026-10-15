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
  assert.equal(cents(t.artistEarn), 6627.13);
  assert.equal(cents(t.labelEarn), 2345.07);
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
