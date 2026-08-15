import { describe, expect, it } from 'vitest';

import { computeBranches, computePeerBenchmark } from '@/lib/analytics/branches';
import { getDataset } from '@/lib/data';

const dataset = getDataset();
const result = computeBranches(dataset);

function branch(id: string) {
  const found = result.branches.find((b) => b.branchId === id);
  expect(found).toBeDefined();
  if (!found) throw new Error(`missing ${id}`);
  return found;
}

function asPercent(value: number | null, decimals = 1): string {
  if (value === null) return 'insufficient_data';
  return `${(value * 100).toFixed(decimals)}%`;
}

describe('computeBranches — win rates (VERIFY.md)', () => {
  const expectations = [
    { id: 'B1', name: 'Downtown Toyota', leads: 97, delivered: 40, win: '41.2%' },
    { id: 'B2', name: 'Highway Toyota', leads: 109, delivered: 36, win: '33.0%' },
    { id: 'B3', name: 'Lakeside Toyota', leads: 79, delivered: 6, win: '7.6%' },
    { id: 'B4', name: 'Central Toyota', leads: 98, delivered: 31, win: '31.6%' },
    { id: 'B5', name: 'Eastside Toyota', leads: 127, delivered: 47, win: '37.0%' },
  ] as const;

  for (const expected of expectations) {
    it(`${expected.id} ${expected.name} wins ${expected.win} of ${expected.leads}`, () => {
      const row = branch(expected.id);
      expect(row.name).toBe(expected.name);
      expect(row.leads).toBe(expected.leads);
      expect(row.deliveredUnits).toBe(expected.delivered);
      expect(asPercent(row.winRate.value)).toBe(expected.win);
    });
  }

  it('covers all 510 leads across the five branches', () => {
    const total = result.branches.reduce((sum, row) => sum + row.leads, 0);
    expect(total).toBe(510);
  });
});

describe('computeBranches — first contact rate', () => {
  it('reports the share of leads ever contacted', () => {
    // B3: 46 of 79 ever reached contacted.
    expect(asPercent(branch('B3').firstContactRate.value)).toBe('58.2%');
    // B1: 80 of 97.
    expect(asPercent(branch('B1').firstContactRate.value)).toBe('82.5%');
  });

  it('reports the pooled group benchmark', () => {
    expect(result.benchmark.leads).toBe(510);
    expect(result.benchmark.deliveredUnits).toBe(160);
    expect(asPercent(result.benchmark.winRate.value)).toBe('31.4%');
    // 391 of 510 leads were ever contacted.
    expect(asPercent(result.benchmark.firstContactRate.value)).toBe('76.7%');
  });
});

describe('computeBranches — delta vs group benchmark', () => {
  it('puts Lakeside far below the group on win rate', () => {
    const row = branch('B3');
    const groupWinRate = result.benchmark.winRate.value ?? 0;
    expect(row.winRateVsBenchmark).toBeCloseTo((row.winRate.value ?? 0) - groupWinRate, 10);
    expect(row.winRateVsBenchmark).toBeLessThan(0);
    expect(((row.winRateVsBenchmark ?? 0) * 100).toFixed(1)).toBe('-23.8');
  });

  it('puts Downtown above the group on win rate', () => {
    expect(branch('B1').winRateVsBenchmark).toBeGreaterThan(0);
  });

  it('reports first-contact delta against the benchmark too', () => {
    const row = branch('B3');
    const groupContact = result.benchmark.firstContactRate.value ?? 0;
    expect(row.firstContactVsBenchmark).toBeCloseTo(
      (row.firstContactRate.value ?? 0) - groupContact,
      10,
    );
  });
});

describe('computeBranches — step conversions', () => {
  it('carries the five funnel steps for each branch', () => {
    const row = branch('B3');
    expect(row.stepConversions).toHaveLength(5);
    expect(row.stepConversions[0].from).toBe('new');
    expect(row.stepConversions[0].toCount).toBe(46);
    expect(row.stepConversions[4].to).toBe('delivered');
    expect(row.stepConversions[4].toCount).toBe(6);
  });
});

describe('computeBranches — stalled orders per branch', () => {
  it('matches the documented stalled counts', () => {
    expect(branch('B5').stalledCount).toBe(12);
    expect(branch('B4').stalledCount).toBe(9);
    expect(branch('B2').stalledCount).toBe(7);
    expect(branch('B1').stalledCount).toBe(6);
    expect(branch('B3').stalledCount).toBe(4);
  });
});

describe('computePeerBenchmark', () => {
  it('excludes the branch under investigation', () => {
    const peers = computePeerBenchmark(dataset, {}, 'B3');
    expect(peers.leads).toBe(510 - 79);
    expect(peers.deliveredUnits).toBe(160 - 6);
    // The other four combined convert far better than Lakeside.
    expect(asPercent(peers.winRate.value)).toBe('35.7%');
  });
});
