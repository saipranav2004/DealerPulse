import { describe, expect, it } from 'vitest';

import { computeTargets } from '@/lib/analytics/targets';
import { getDataset } from '@/lib/data';
import { formatCurrency, formatNumber } from '@/lib/format';

const dataset = getDataset();
const result = computeTargets(dataset);

describe('computeTargets — group attainment (VERIFY.md)', () => {
  it('totals 1,426 target units and ₹313.01 Cr target revenue', () => {
    expect(result.group.targetUnits).toBe(1426);
    expect(formatNumber(result.group.targetUnits)).toBe('1,426');
    expect(formatCurrency(result.group.targetRevenue)).toBe('₹313.01 Cr');
  });

  it('reports 12.4% revenue attainment', () => {
    expect(result.group.revenueAttainment).not.toBeNull();
    expect(((result.group.revenueAttainment ?? 0) * 100).toFixed(1)).toBe('12.4');
  });

  it('reports unit attainment of 160 against 1,426', () => {
    expect(result.group.deliveredUnits).toBe(160);
    expect(((result.group.unitAttainment ?? 0) * 100).toFixed(1)).toBe('11.2');
  });

  it('flags the targets as mis-baselined so the UI can carry the caveat', () => {
    expect(result.targetsAreMisBaselined).toBe(true);
  });
});

describe('computeTargets — relative index vs group average', () => {
  it('indexes every branch against the group, where 100 is typical', () => {
    for (const branch of result.branches) {
      expect(branch.relativeIndex).not.toBeNull();
      const expected =
        ((branch.revenueAttainment ?? 0) / (result.group.revenueAttainment ?? 1)) * 100;
      expect(branch.relativeIndex).toBeCloseTo(expected, 8);
    }
  });

  it('places Lakeside well below the group index', () => {
    const lakeside = result.branches.find((b) => b.branchId === 'B3');
    expect(lakeside?.relativeIndex).toBeLessThan(100);
  });

  it('places at least one branch above the group index', () => {
    expect(result.branches.some((b) => (b.relativeIndex ?? 0) > 100)).toBe(true);
  });

  it('keeps branch attainment consistent with the group total', () => {
    const units = result.branches.reduce((sum, b) => sum + b.targetUnits, 0);
    expect(units).toBe(1426);
    const delivered = result.branches.reduce((sum, b) => sum + b.deliveredUnits, 0);
    expect(delivered).toBe(160);
  });
});

describe('computeTargets — monthly series', () => {
  it('covers the seven target months', () => {
    expect(result.byMonth.map((m) => m.month)).toEqual([
      '2025-06',
      '2025-07',
      '2025-08',
      '2025-09',
      '2025-10',
      '2025-11',
      '2025-12',
    ]);
  });

  it('attributes deliveries to the month they occurred', () => {
    // Matches the delivery activity series, not the creation cohort.
    expect(result.byMonth.find((m) => m.month === '2025-12')?.deliveredUnits).toBe(52);
    expect(result.byMonth.find((m) => m.month === '2025-06')?.deliveredUnits).toBe(0);
  });

  it('returns a null attainment rather than dividing by a zero target', () => {
    for (const month of result.byMonth) {
      if (month.targetUnits === 0) expect(month.unitAttainment).toBeNull();
      else expect(month.unitAttainment).not.toBeNull();
    }
  });
});

describe('computeTargets — branch filter', () => {
  it('restricts targets and deliveries to the filtered branches', () => {
    const filtered = computeTargets(dataset, { branchIds: ['B3'] });
    expect(filtered.branches).toHaveLength(1);
    expect(filtered.group.deliveredUnits).toBe(6);
    // 7 months of Lakeside targets only.
    expect(filtered.group.targetUnits).toBeLessThan(1426);
  });
});
