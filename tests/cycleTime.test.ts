import { describe, expect, it } from 'vitest';

import { computeCycleTime, cycleDurations } from '@/lib/analytics/cycleTime';
import { getDataset } from '@/lib/data';

const dataset = getDataset();
const result = computeCycleTime(dataset);

describe('computeCycleTime — total cycle (VERIFY.md)', () => {
  it('measures 160 delivered leads', () => {
    expect(result.total.n).toBe(160);
  });

  it('reports a 37-day median and 50-day p90', () => {
    expect(result.total.medianDays).toBe(37);
    expect(result.total.p90Days).toBe(50);
  });

  it('reports percentiles that are durations some lead actually took', () => {
    const durations = cycleDurations(dataset);
    expect(durations).toContain(result.total.medianDays);
    expect(durations).toContain(result.total.p90Days);
  });

  it('measures only delivered leads', () => {
    const delivered = dataset.leads.filter((lead) => lead.status === 'delivered');
    expect(cycleDurations(dataset)).toHaveLength(delivered.length);
  });

  it('brackets the median between min and max', () => {
    expect(result.total.minDays).toBeLessThanOrEqual(result.total.medianDays ?? 0);
    expect(result.total.maxDays).toBeGreaterThanOrEqual(result.total.p90Days ?? 0);
    expect(result.total.maxDays).toBe(63);
  });
});

describe('computeCycleTime — stage dwell medians (VERIFY.md)', () => {
  const dwell = (from: string, to: string) =>
    result.dwell.find((d) => d.from === from && d.to === to);

  it('reports new -> contacted at 1 day', () => {
    expect(dwell('new', 'contacted')?.medianDays).toBe(1);
    expect(dwell('new', 'contacted')?.n).toBe(391);
  });

  it('reports contacted -> test_drive at 5 days', () => {
    expect(dwell('contacted', 'test_drive')?.medianDays).toBe(5);
    expect(dwell('contacted', 'test_drive')?.n).toBe(300);
  });

  it('reports test_drive -> negotiation at 3 days', () => {
    expect(dwell('test_drive', 'negotiation')?.medianDays).toBe(3);
    expect(dwell('test_drive', 'negotiation')?.n).toBe(235);
  });

  it('reports negotiation -> order_placed at 8 days', () => {
    expect(dwell('negotiation', 'order_placed')?.medianDays).toBe(8);
    expect(dwell('negotiation', 'order_placed')?.n).toBe(198);
  });

  it('reports order_placed -> delivered at 17 days', () => {
    expect(dwell('order_placed', 'delivered')?.medianDays).toBe(17);
    expect(dwell('order_placed', 'delivered')?.n).toBe(160);
  });

  it('covers all five funnel steps', () => {
    expect(result.dwell).toHaveLength(5);
  });

  it('counts only leads that made both transitions', () => {
    for (const step of result.dwell) {
      expect(step.n).toBeLessThanOrEqual(510);
      expect(step.medianDays).not.toBeNull();
    }
  });
});

describe('computeCycleTime — scoped', () => {
  it('scopes to a branch', () => {
    const lakeside = computeCycleTime(dataset, {}, { kind: 'branch', branchId: 'B3' });
    expect(lakeside.total.n).toBe(6);
  });

  it('returns nulls rather than NaN for an empty scope', () => {
    const manager = dataset.reps.find((rep) => rep.role === 'branch_manager');
    expect(manager).toBeDefined();
    if (!manager) return;

    const empty = computeCycleTime(dataset, {}, { kind: 'rep', repId: manager.id });
    expect(empty.total.n).toBe(0);
    expect(empty.total.medianDays).toBeNull();
    expect(empty.total.p90Days).toBeNull();
    expect(empty.total.minDays).toBeNull();
    expect(empty.total.maxDays).toBeNull();
    for (const step of empty.dwell) {
      expect(step.n).toBe(0);
      expect(step.medianDays).toBeNull();
    }
  });
});
