/**
 * Edge-case behaviour that the rest of the suite depends on: the low-n guard,
 * the whole-day duration rule, the percentile convention, and filter
 * selection/memoization.
 */

import { describe, expect, it } from 'vitest';

import { computeFunnel } from '@/lib/analytics/funnel';
import { computeKpiSet } from '@/lib/analytics/kpis';
import { computeSources } from '@/lib/analytics/sources';
import { getDataset, MIN_RATE_DENOMINATOR, NOW } from '@/lib/data';
import { filterKey, previousPeriod, selectLeads } from '@/lib/filters';
import {
  median,
  percentile,
  rate,
  relativeChange,
  wholeDaysBetween,
  wholeHoursBetween,
} from '@/lib/stats';

const dataset = getDataset();

describe('low-n guard', () => {
  it('suppresses any rate on a denominator below 10', () => {
    expect(MIN_RATE_DENOMINATOR).toBe(10);
    for (let n = 0; n < 10; n += 1) {
      const result = rate(1, n);
      expect(result.value).toBeNull();
      expect(result.reason).toBe('insufficient_data');
      expect(result.n).toBe(n);
    }
  });

  it('emits a rate from a denominator of exactly 10', () => {
    const result = rate(6, 10);
    expect(result.value).toBeCloseTo(0.6, 10);
    expect(result.reason).toBeNull();
    expect(result.n).toBe(10);
  });

  it('never divides by zero', () => {
    const result = rate(0, 0);
    expect(result.value).toBeNull();
    expect(Number.isNaN(result.value ?? 0)).toBe(false);
  });

  it('returns insufficient_data for a filter that selects fewer than 5 leads', () => {
    // Camry leads from the auto_expo channel in Lakeside: a deliberately narrow slice.
    const filters = {
      branchIds: ['B3'],
      models: ['Camry'],
      sources: ['auto_expo'],
    } as const;

    const leads = selectLeads(dataset, filters);
    expect(leads.length).toBeLessThan(5);

    const kpis = computeKpiSet(dataset, filters);
    expect(kpis.totalLeads).toBe(leads.length);
    expect(kpis.winRate.value).toBeNull();
    expect(kpis.winRate.reason).toBe('insufficient_data');
    expect(kpis.winRate.n).toBe(leads.length);
  });

  it('suppresses every funnel rate under an n<5 filter', () => {
    const funnel = computeFunnel(dataset, {
      branchIds: ['B3'],
      models: ['Camry'],
      sources: ['auto_expo'],
    });
    expect(funnel.totalLeads).toBeLessThan(5);
    for (const stage of funnel.stages) {
      expect(stage.shareOfLeads.reason).toBe('insufficient_data');
    }
  });

  it('suppresses rates for a source with too few leads under a narrow filter', () => {
    const result = computeSources(dataset, { branchIds: ['B3'], models: ['Camry'] });
    for (const row of result.sources) {
      if (row.leads < MIN_RATE_DENOMINATOR) {
        expect(row.winRate.value).toBeNull();
        expect(row.winRate.reason).toBe('insufficient_data');
      }
    }
    expect(result.sources.some((row) => row.leads < MIN_RATE_DENOMINATOR)).toBe(true);
  });
});

describe('percentile convention', () => {
  it('returns an order statistic, never an interpolated value', () => {
    const values = [1, 2, 3, 4];
    expect(percentile(values, 0.5)).toBe(3);
    expect(percentile(values, 0.9)).toBe(4);
    expect(percentile(values, 0)).toBe(1);
    expect(percentile(values, 1)).toBe(4);
  });

  it('takes the upper middle for an even sample, keeping whole days whole', () => {
    expect(median([10, 20])).toBe(20);
    expect(median([1, 2, 3])).toBe(2);
  });

  it('returns null for an empty sample', () => {
    expect(percentile([], 0.9)).toBeNull();
    expect(median([])).toBeNull();
  });

  it('does not mutate the input array', () => {
    const values = [5, 1, 3];
    median(values);
    expect(values).toEqual([5, 1, 3]);
  });
});

describe('whole-unit durations', () => {
  it('floors elapsed days', () => {
    const from = new Date('2025-12-01T00:00:00Z');
    expect(wholeDaysBetween(from, new Date('2025-12-08T00:00:00Z'))).toBe(7);
    expect(wholeDaysBetween(from, new Date('2025-12-08T15:20:00Z'))).toBe(7);
    expect(wholeDaysBetween(from, new Date('2025-12-09T00:00:00Z'))).toBe(8);
  });

  it('floors elapsed hours', () => {
    const from = new Date('2025-12-01T00:00:00Z');
    expect(wholeHoursBetween(from, new Date('2025-12-01T05:59:00Z'))).toBe(5);
    expect(wholeHoursBetween(from, new Date('2025-12-01T06:00:00Z'))).toBe(6);
  });

  it('measures aging against the pinned NOW, not the wall clock', () => {
    expect(NOW.toISOString()).toBe('2025-12-31T19:10:00.000Z');
    expect(NOW.getTime()).toBeLessThan(Date.now());
  });
});

describe('relativeChange', () => {
  it('computes fractional change', () => {
    expect(relativeChange(120, 100)).toBeCloseTo(0.2, 10);
    expect(relativeChange(80, 100)).toBeCloseTo(-0.2, 10);
  });

  it('returns null off a zero or missing base', () => {
    expect(relativeChange(10, 0)).toBeNull();
    expect(relativeChange(10, null)).toBeNull();
  });
});

describe('selectLeads', () => {
  it('returns every lead when unfiltered', () => {
    expect(selectLeads(dataset)).toHaveLength(510);
  });

  it('filters by branch through the index', () => {
    expect(selectLeads(dataset, { branchIds: ['B3'] })).toHaveLength(79);
    expect(selectLeads(dataset, { branchIds: ['B1', 'B2'] })).toHaveLength(97 + 109);
  });

  it('filters by source and model', () => {
    expect(selectLeads(dataset, { sources: ['walk_in'] })).toHaveLength(140);
    const camry = selectLeads(dataset, { models: ['Camry'] });
    expect(camry.every((lead) => lead.model === 'Camry')).toBe(true);
  });

  it('filters by creation date, inclusive on both bounds', () => {
    const october = selectLeads(dataset, {
      dateRange: {
        from: new Date('2025-10-01T00:00:00Z'),
        to: new Date('2025-10-31T23:59:59.999Z'),
      },
    });
    expect(october).toHaveLength(90);
    expect(october.every((lead) => lead.createdMonth === '2025-10')).toBe(true);
  });

  it('intersects multiple filter axes', () => {
    const leads = selectLeads(dataset, { branchIds: ['B3'], sources: ['walk_in'] });
    expect(leads.every((lead) => lead.branchId === 'B3' && lead.source === 'walk_in')).toBe(true);
  });

  it('scopes to a rep', () => {
    const rep = dataset.reps.find((r) => r.name === 'Venkat Mishra');
    expect(rep).toBeDefined();
    if (!rep) return;
    expect(selectLeads(dataset, {}, { kind: 'rep', repId: rep.id })).toHaveLength(22);
  });

  it('returns an empty selection for a rep holding no leads', () => {
    const manager = dataset.reps.find((r) => r.role === 'branch_manager');
    expect(manager).toBeDefined();
    if (!manager) return;
    expect(selectLeads(dataset, {}, { kind: 'rep', repId: manager.id })).toHaveLength(0);
  });

  it('memoizes by serialized filter key, returning the same array identity', () => {
    const first = selectLeads(dataset, { branchIds: ['B1', 'B2'] });
    const second = selectLeads(dataset, { branchIds: ['B2', 'B1'] });
    expect(second).toBe(first);
  });

  it('builds an order-independent key', () => {
    const a = filterKey({ branchIds: ['B2', 'B1'] }, { kind: 'company' });
    const b = filterKey({ branchIds: ['B1', 'B2'] }, { kind: 'company' });
    expect(a).toBe(b);
  });

  it('distinguishes scopes in the key', () => {
    expect(filterKey({}, { kind: 'company' })).not.toBe(
      filterKey({}, { kind: 'branch', branchId: 'B1' }),
    );
  });
});

describe('previousPeriod', () => {
  it('returns null without a date range', () => {
    expect(previousPeriod({})).toBeNull();
  });

  /**
   * The comparison window matches the current window's *length*, not its
   * calendar month. October spans 31 days, so the preceding 31-day window
   * starts on 31 August — September only has 30 days. This is deliberate:
   * it gives a like-for-like comparison for arbitrary ranges, not just months.
   */
  it('returns the immediately preceding window of equal length', () => {
    const previous = previousPeriod({
      dateRange: {
        from: new Date('2025-10-01T00:00:00Z'),
        to: new Date('2025-10-31T23:59:59.999Z'),
      },
    });
    expect(previous?.dateRange?.from.toISOString()).toBe('2025-08-31T00:00:00.000Z');
    expect(previous?.dateRange?.to.toISOString()).toBe('2025-09-30T23:59:59.999Z');

    const from = previous?.dateRange?.from.getTime() ?? 0;
    const to = previous?.dateRange?.to.getTime() ?? 0;
    expect(to - from).toBe(2_678_399_999); // identical span to October
  });

  it('preserves the non-date filter axes', () => {
    const previous = previousPeriod({
      branchIds: ['B3'],
      dateRange: {
        from: new Date('2025-10-01T00:00:00Z'),
        to: new Date('2025-10-31T23:59:59.999Z'),
      },
    });
    expect(previous?.branchIds).toEqual(['B3']);
  });
});
