import { describe, expect, it } from 'vitest';

import { AGING_THRESHOLDS, computeAging, computeStalledOrders } from '@/lib/analytics/aging';
import { getDataset, NOW } from '@/lib/data';
import { formatCurrency } from '@/lib/format';

const dataset = getDataset();

describe('computeAging — open lead staleness (VERIFY.md)', () => {
  const aging = computeAging(dataset);

  it('ages only open leads', () => {
    expect(aging.openLeads).toBe(62);
    expect(aging.aged).toHaveLength(62);
    for (const lead of aging.aged) {
      expect(lead.status).not.toBe('delivered');
      expect(lead.status).not.toBe('lost');
    }
  });

  it('buckets at more than 7, 14 and 30 whole days', () => {
    const count = (days: number) =>
      aging.buckets.find((b) => b.thresholdDays === days)?.count;
    expect(count(7)).toBe(35);
    expect(count(14)).toBe(27);
    expect(count(30)).toBe(24);
  });

  it('uses the default thresholds when none are supplied', () => {
    expect(aging.buckets.map((b) => b.thresholdDays)).toEqual([...AGING_THRESHOLDS]);
  });

  it('measures age in whole days, so 7.6 days does not clear the 7-day bar', () => {
    // A lead 7.64 days idle sits at 7 whole days and is excluded from ">7".
    const borderline = aging.aged.filter((lead) => lead.daysSinceActivity === 7);
    expect(borderline.length).toBeGreaterThan(0);
    for (const lead of borderline) {
      const raw =
        (NOW.getTime() - dataset.indexes.leadsById.get(lead.leadId)!.lastActivityAt.getTime()) /
        86_400_000;
      expect(raw).toBeGreaterThan(7);
      expect(raw).toBeLessThan(8);
    }
  });

  it('sorts aged leads oldest first', () => {
    for (let i = 1; i < aging.aged.length; i += 1) {
      expect(aging.aged[i - 1].daysSinceActivity).toBeGreaterThanOrEqual(
        aging.aged[i].daysSinceActivity,
      );
    }
  });

  it('carries the value at stake in each bucket', () => {
    const bucket = aging.buckets.find((b) => b.thresholdDays === 30);
    expect(bucket?.value).toBeGreaterThan(0);
  });
});

describe('computeStalledOrders (VERIFY.md)', () => {
  const stalled = computeStalledOrders(dataset);

  it('finds 38 orders worth ₹8.59 Cr with no delivery record', () => {
    expect(stalled.count).toBe(38);
    expect(stalled.value).toBe(85_860_000);
    expect(formatCurrency(stalled.value)).toBe('₹8.59 Cr');
  });

  it('reports the oldest stalled order at 195 days', () => {
    expect(stalled.oldestAgeDays).toBe(195);
  });

  it('breaks down by branch as B5 12, B4 9, B2 7, B1 6, B3 4', () => {
    expect(stalled.countByBranch.get('B5')).toBe(12);
    expect(stalled.countByBranch.get('B4')).toBe(9);
    expect(stalled.countByBranch.get('B2')).toBe(7);
    expect(stalled.countByBranch.get('B1')).toBe(6);
    expect(stalled.countByBranch.get('B3')).toBe(4);
  });

  it('only counts leads currently at order_placed with no delivery', () => {
    for (const order of stalled.orders) {
      const lead = dataset.indexes.leadsById.get(order.leadId);
      expect(lead?.status).toBe('order_placed');
      expect(dataset.indexes.deliveriesByLeadId.has(order.leadId)).toBe(false);
    }
  });

  it('sorts orders oldest first', () => {
    for (let i = 1; i < stalled.orders.length; i += 1) {
      expect(stalled.orders[i - 1].ageDays).toBeGreaterThanOrEqual(stalled.orders[i].ageDays);
    }
  });

  it('scopes to a branch', () => {
    const b3 = computeStalledOrders(dataset, {}, { kind: 'branch', branchId: 'B3' });
    expect(b3.count).toBe(4);
  });

  it('returns a null oldest age when nothing is stalled', () => {
    const manager = dataset.reps.find((rep) => rep.role === 'branch_manager');
    expect(manager).toBeDefined();
    if (!manager) return;
    const none = computeStalledOrders(dataset, {}, { kind: 'rep', repId: manager.id });
    expect(none.count).toBe(0);
    expect(none.value).toBe(0);
    expect(none.oldestAgeDays).toBeNull();
  });
});
