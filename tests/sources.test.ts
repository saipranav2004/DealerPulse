import { describe, expect, it } from 'vitest';

import { computeSources } from '@/lib/analytics/sources';
import { getDataset } from '@/lib/data';
import { formatCurrency } from '@/lib/format';

const dataset = getDataset();
const result = computeSources(dataset);

function source(name: string) {
  const found = result.sources.find((s) => s.source === name);
  expect(found).toBeDefined();
  if (!found) throw new Error(`missing ${name}`);
  return found;
}

function asPercent(value: number | null, decimals = 1): string {
  if (value === null) return 'insufficient_data';
  return `${(value * 100).toFixed(decimals)}%`;
}

describe('computeSources — volume and win rate (VERIFY.md)', () => {
  const expectations = [
    { source: 'walk_in', leads: 140, win: '45.7%' },
    { source: 'website', leads: 100, win: '28.0%' },
    { source: 'referral', leads: 83, win: '30.1%' },
    { source: 'social_media', leads: 72, win: '13.9%' },
    { source: 'phone_enquiry', leads: 72, win: '27.8%' },
    { source: 'auto_expo', leads: 43, win: '30.2%' },
  ] as const;

  for (const expected of expectations) {
    it(`${expected.source}: ${expected.leads} leads at ${expected.win}`, () => {
      const row = source(expected.source);
      expect(row.leads).toBe(expected.leads);
      expect(asPercent(row.winRate.value)).toBe(expected.win);
    });
  }

  it('sorts by volume descending and covers all 510 leads', () => {
    expect(result.totalLeads).toBe(510);
    expect(result.sources.reduce((sum, s) => sum + s.leads, 0)).toBe(510);
    for (let i = 1; i < result.sources.length; i += 1) {
      expect(result.sources[i - 1].leads).toBeGreaterThanOrEqual(result.sources[i].leads);
    }
  });
});

describe('computeSources — average deal value', () => {
  it('averages across all leads from the source, not just won ones', () => {
    expect(formatCurrency(source('website').averageDealValue ?? 0)).toBe('₹22.08 L');
    expect(formatCurrency(source('referral').averageDealValue ?? 0)).toBe('₹22.40 L');
    expect(formatCurrency(source('social_media').averageDealValue ?? 0)).toBe('₹27.17 L');
    expect(formatCurrency(source('phone_enquiry').averageDealValue ?? 0)).toBe('₹24.44 L');
    expect(formatCurrency(source('auto_expo').averageDealValue ?? 0)).toBe('₹25.24 L');
  });

  /**
   * VERIFY.md states ₹24.99 L for walk_in. The exact mean is ₹24,99,714.29,
   * which is 24.997143 L — that rounds half-up to 25.00 L. VERIFY.md's other
   * five rows are all half-up rounded, so 24.99 there is a truncation that is
   * inconsistent with its own table. The metric is asserted exactly here; the
   * display disagreement is documented in docs/METRICS.md and surfaced by the
   * verify script rather than papered over.
   */
  it('computes walk_in to the rupee, where VERIFY.md rounds inconsistently', () => {
    const walkIn = source('walk_in');
    expect(walkIn.averageDealValue).toBeCloseTo(2_499_714.2857, 3);
    expect(formatCurrency(walkIn.averageDealValue ?? 0)).toBe('₹25.00 L');
  });

  it('reports the won-only average separately', () => {
    expect(source('walk_in').averageDeliveredDealValue).not.toBeNull();
    expect(source('walk_in').averageDeliveredDealValue).not.toBe(
      source('walk_in').averageDealValue,
    );
  });
});

describe('computeSources — the social_media trap', () => {
  it('pairs the highest average deal value with the worst win rate', () => {
    const social = source('social_media');
    const highestAverage = Math.max(
      ...result.sources.map((s) => s.averageDealValue ?? 0),
    );
    const lowestWinRate = Math.min(...result.sources.map((s) => s.winRate.value ?? 1));
    expect(social.averageDealValue).toBe(highestAverage);
    expect(social.winRate.value).toBe(lowestWinRate);
  });
});

describe('computeSources — accounting', () => {
  it('splits each source into delivered, open and lost', () => {
    for (const row of result.sources) {
      expect(row.deliveredUnits + row.openCount + row.lostCount).toBe(row.leads);
    }
  });
});
