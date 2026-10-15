// Baseline from CLAUDE.md — if a change moves these, the change is wrong unless intended.
import test from 'node:test';
import assert from 'node:assert/strict';
import { companyFinanceTotals, swiftShareFor } from '../src/finance.js';
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
