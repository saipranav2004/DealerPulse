import { describe, expect, it } from 'vitest';

import {
  computeCohorts,
  computeDeliveryActivity,
  MATURITY_WINDOW_DAYS,
} from '@/lib/analytics/cohorts';
import { getDataset } from '@/lib/data';

const dataset = getDataset();

describe('computeCohorts — leads created per month (VERIFY.md)', () => {
  const { cohorts } = computeCohorts(dataset);

  it('covers the seven months June to December 2025', () => {
    expect(cohorts.map((c) => c.month)).toEqual([
      '2025-06',
      '2025-07',
      '2025-08',
      '2025-09',
      '2025-10',
      '2025-11',
      '2025-12',
    ]);
  });

  const expectations = [
    { month: '2025-06', created: 55, delivered: 19 },
    { month: '2025-07', created: 60, delivered: 16 },
    { month: '2025-08', created: 65, delivered: 26 },
    { month: '2025-09', created: 70, delivered: 30 },
    { month: '2025-10', created: 90, delivered: 37 },
    { month: '2025-11', created: 95, delivered: 31 },
    { month: '2025-12', created: 75, delivered: 1 },
  ] as const;

  for (const expected of expectations) {
    it(`${expected.month}: ${expected.created} created, ${expected.delivered} delivered`, () => {
      const point = cohorts.find((c) => c.month === expected.month);
      expect(point?.leadsCreated).toBe(expected.created);
      expect(point?.delivered).toBe(expected.delivered);
    });
  }

  it('sums to 510 leads and 160 deliveries', () => {
    expect(cohorts.reduce((sum, c) => sum + c.leadsCreated, 0)).toBe(510);
    expect(cohorts.reduce((sum, c) => sum + c.delivered, 0)).toBe(160);
  });

  it('counts never-contacted leads per creation month', () => {
    expect(cohorts.map((c) => c.neverContacted)).toEqual([11, 14, 13, 17, 19, 23, 22]);
    expect(cohorts.reduce((sum, c) => sum + c.neverContacted, 0)).toBe(119);
  });

  it('accounts for every cohort lead as delivered, lost or open', () => {
    for (const point of cohorts) {
      expect(point.delivered + point.lost + point.stillOpen).toBe(point.leadsCreated);
    }
  });
});

describe('computeCohorts — the maturity trap', () => {
  const result = computeCohorts(dataset);

  it('flags exactly November and December as still maturing', () => {
    expect(result.immatureMonths).toEqual(['2025-11', '2025-12']);
  });

  it('marks June through October as mature', () => {
    for (const month of ['2025-06', '2025-07', '2025-08', '2025-09', '2025-10']) {
      expect(result.cohorts.find((c) => c.month === month)?.isMature).toBe(true);
    }
  });

  it('treats a cohort as mature only after a full median cycle has elapsed', () => {
    expect(MATURITY_WINDOW_DAYS).toBe(37);
    for (const point of result.cohorts) {
      expect(point.isMature).toBe(point.daysSinceMonthEnd >= MATURITY_WINDOW_DAYS);
    }
    // November ended 30 whole days before NOW — short of the 37-day cycle.
    expect(result.cohorts.find((c) => c.month === '2025-11')?.daysSinceMonthEnd).toBe(30);
    // December has not ended at NOW (2025-12-31T19:10Z), so its month-end is
    // still ahead: a negative age, and unambiguously immature.
    expect(result.cohorts.find((c) => c.month === '2025-12')?.daysSinceMonthEnd).toBe(-1);
    // October cleared the window comfortably.
    expect(result.cohorts.find((c) => c.month === '2025-10')?.daysSinceMonthEnd).toBe(60);
  });

  it("does not read December's 1 delivery as a collapse — the cohort is immature", () => {
    const december = result.cohorts.find((c) => c.month === '2025-12');
    expect(december?.delivered).toBe(1);
    expect(december?.isMature).toBe(false);
  });
});

describe('computeDeliveryActivity — a different series from the cohort series', () => {
  const activity = computeDeliveryActivity(dataset);
  const { cohorts } = computeCohorts(dataset);

  it('groups deliveries by the month they happened', () => {
    const byMonth = new Map<string, number>(
      activity.map((point) => [point.month as string, point.deliveries]),
    );
    expect(byMonth.get('2025-07')).toBe(16);
    expect(byMonth.get('2025-08')).toBe(18);
    expect(byMonth.get('2025-09')).toBe(24);
    expect(byMonth.get('2025-10')).toBe(20);
    expect(byMonth.get('2025-11')).toBe(30);
    expect(byMonth.get('2025-12')).toBe(52);
  });

  it('totals 160 deliveries, like the cohort series, but with a different shape', () => {
    expect(activity.reduce((sum, point) => sum + point.deliveries, 0)).toBe(160);

    // December: 52 deliveries happened, but only 1 December-created lead delivered.
    const decemberActivity = activity.find((point) => point.month === '2025-12')?.deliveries;
    const decemberCohort = cohorts.find((c) => c.month === '2025-12')?.delivered;
    expect(decemberActivity).toBe(52);
    expect(decemberCohort).toBe(1);
    expect(decemberActivity).not.toBe(decemberCohort);
  });

  it('has no June deliveries, since no lead could be created and delivered that fast', () => {
    expect(activity.find((point) => point.month === '2025-06')).toBeUndefined();
  });
});
