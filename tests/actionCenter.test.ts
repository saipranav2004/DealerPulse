import { describe, expect, it } from 'vitest';

import {
  COLD_MULTIPLIER,
  CRITICAL_LATENESS,
  computeActionCenter,
  computeColdQueue,
  computeDelayedDeliveries,
  computeStalledQueue,
  stageNormalDays,
  STAGE_WEIGHT,
  WARNING_LATENESS,
} from '@/lib/analytics/actionCenter';
import { getDataset } from '@/lib/data';
import { formatCurrency } from '@/lib/format';

const dataset = getDataset();

describe('stageNormalDays', () => {
  it('takes thresholds from the dataset dwell medians, not round numbers', () => {
    expect(stageNormalDays(dataset)).toMatchObject({
      new: 1,
      contacted: 5,
      test_drive: 3,
      negotiation: 8,
      order_placed: 17,
    });
  });

  it('never returns zero, so severity can never divide by zero', () => {
    for (const value of Object.values(stageNormalDays(dataset))) {
      expect(value).toBeGreaterThan(0);
    }
  });
});

describe('computeStalledQueue', () => {
  const queue = computeStalledQueue(dataset);

  it('finds the 38 paid orders with no delivery record', () => {
    expect(queue.count).toBe(38);
    expect(queue.value).toBe(85_860_000);
    expect(formatCurrency(queue.value)).toBe('₹8.59 Cr');
    expect(queue.oldestAgeDays).toBe(195);
  });

  it('ranks by severity, not by age', () => {
    const [first, second, third] = queue.items;
    expect(first.customerName).toBe('Omkar Varma');
    expect(second.customerName).toBe('Rakesh Naidu');
    expect(third.customerName).toBe('Lata Srinivasan');

    // Rakesh is 11 days younger than Manju Srinivasan but worth ₹15 L more.
    const manjuIndex = queue.items.findIndex((i) => i.customerName === 'Manju Srinivasan');
    const rakeshIndex = queue.items.findIndex((i) => i.customerName === 'Rakesh Naidu');
    expect(rakeshIndex).toBeLessThan(manjuIndex);
    expect(queue.items[manjuIndex].ageDays).toBeGreaterThan(queue.items[rakeshIndex].ageDays);
  });

  it('computes severity as value × lateness × stage weight', () => {
    const top = queue.items[0];
    expect(top.dealValue).toBe(5_050_000);
    expect(top.ageDays).toBe(195);
    expect(top.normalDays).toBe(17);
    expect(top.lateness).toBeCloseTo(195 / 17, 10);
    expect(top.severity).toBeCloseTo((5_050_000 / 100_000) * (195 / 17) * STAGE_WEIGHT.order_placed, 6);
    expect(top.severity).toBeCloseTo(1737.79, 1);
  });

  it('is sorted by descending severity', () => {
    for (let i = 1; i < queue.items.length; i += 1) {
      expect(queue.items[i - 1].severity).toBeGreaterThanOrEqual(queue.items[i].severity);
    }
  });

  it('bands by lateness against a stated rule', () => {
    expect(CRITICAL_LATENESS).toBe(3);
    expect(WARNING_LATENESS).toBe(1.5);
    for (const item of queue.items) {
      const expected =
        item.lateness >= CRITICAL_LATENESS
          ? 'critical'
          : item.lateness >= WARNING_LATENESS
            ? 'warning'
            : 'normal';
      expect(item.band).toBe(expected);
    }
  });

  it('only contains leads at order_placed with no delivery', () => {
    for (const item of queue.items) {
      const lead = dataset.indexes.leadsById.get(item.leadId);
      expect(lead?.status).toBe('order_placed');
      expect(dataset.indexes.deliveriesByLeadId.has(item.leadId)).toBe(false);
    }
  });

  it('scopes to a branch', () => {
    expect(computeStalledQueue(dataset, {}, { kind: 'branch', branchId: 'B3' }).count).toBe(4);
  });
});

describe('computeColdQueue', () => {
  const queue = computeColdQueue(dataset);

  it('flags only leads past twice their stage dwell median', () => {
    expect(COLD_MULTIPLIER).toBe(2);
    expect(queue.count).toBe(1);
    expect(queue.items[0].customerName).toBe('Uma Xavier');
    expect(queue.items[0].stage).toBe('test_drive');
    expect(queue.items[0].ageDays).toBe(7);
    expect(queue.items[0].normalDays).toBe(6);
  });

  it('excludes stalled orders so the two queues never double-count', () => {
    const stalled = new Set(computeStalledQueue(dataset).items.map((i) => i.leadId));
    for (const item of queue.items) expect(stalled.has(item.leadId)).toBe(false);
  });

  it('is far smaller than a flat seven-day rule would produce', () => {
    // The flat rule counts 35 open leads, 32 of which are stalled orders.
    const open = dataset.leads.filter((l) => l.status !== 'delivered' && l.status !== 'lost');
    const flatSeven = open.filter(
      (l) => Math.floor((new Date('2025-12-31T19:10:00Z').getTime() - l.lastActivityAt.getTime()) / 86_400_000) > 7,
    );
    expect(flatSeven).toHaveLength(35);
    expect(queue.count).toBeLessThan(flatSeven.length);
  });

  it('contains only open leads', () => {
    for (const item of queue.items) {
      const lead = dataset.indexes.leadsById.get(item.leadId);
      expect(lead?.status).not.toBe('delivered');
      expect(lead?.status).not.toBe('lost');
    }
  });
});

describe('computeDelayedDeliveries', () => {
  const result = computeDelayedDeliveries(dataset);

  it('flags the 47 deliveries beyond the 21-day SLA', () => {
    expect(result.count).toBe(47);
    expect(result.totalDeliveries).toBe(160);
  });

  it('breaks down by recorded cause, most frequent first', () => {
    for (let i = 1; i < result.byReason.length; i += 1) {
      const prev = result.byReason[i - 1];
      const curr = result.byReason[i];
      if (prev.reason !== null && curr.reason !== null) {
        expect(prev.count).toBeGreaterThanOrEqual(curr.count);
      }
    }
    expect(result.byReason.reduce((sum, r) => sum + r.count, 0)).toBe(47);
  });

  it('sorts slowest first', () => {
    for (let i = 1; i < result.items.length; i += 1) {
      expect(result.items[i - 1].daysToDeliver).toBeGreaterThanOrEqual(result.items[i].daysToDeliver);
    }
    expect(result.items[0].daysToDeliver).toBe(39);
  });
});

describe('computeActionCenter', () => {
  const result = computeActionCenter(dataset);

  it('assembles all three queues on one set of thresholds', () => {
    expect(result.stalled.count).toBe(38);
    expect(result.cold.count).toBe(1);
    expect(result.delays.count).toBe(47);
    expect(result.totalOpen).toBe(62);
  });

  it('publishes the cold thresholds it used', () => {
    expect(result.coldThresholds).toEqual([
      { stage: 'new', normalDays: 1, coldAfterDays: 2 },
      { stage: 'contacted', normalDays: 5, coldAfterDays: 10 },
      { stage: 'test_drive', normalDays: 3, coldAfterDays: 6 },
      { stage: 'negotiation', normalDays: 8, coldAfterDays: 16 },
    ]);
  });

  it('returns empty queues rather than throwing for an empty scope', () => {
    const manager = dataset.reps.find((r) => r.role === 'branch_manager');
    expect(manager).toBeDefined();
    if (!manager) return;
    const empty = computeActionCenter(dataset, {}, { kind: 'rep', repId: manager.id });
    expect(empty.stalled.count).toBe(0);
    expect(empty.stalled.oldestAgeDays).toBeNull();
    expect(empty.cold.count).toBe(0);
    expect(empty.delays.count).toBe(0);
  });
});
