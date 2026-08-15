import { describe, expect, it } from 'vitest';

import { computeDeliveries, DELIVERY_SLA_DAYS, deliveriesInScope } from '@/lib/analytics/deliveries';
import { getDataset } from '@/lib/data';

const dataset = getDataset();
const result = computeDeliveries(dataset);

describe('computeDeliveries — the delivery leg (VERIFY.md)', () => {
  it('covers all 160 deliveries', () => {
    expect(result.count).toBe(160);
  });

  it('reports a 17-day median and a 39-day maximum', () => {
    expect(result.medianDaysToDeliver).toBe(17);
    expect(result.maxDaysToDeliver).toBe(39);
  });

  it('flags 47 deliveries exceeding 21 days', () => {
    expect(DELIVERY_SLA_DAYS).toBe(21);
    expect(result.exceedingSla).toBe(47);
    expect(result.slaDays).toBe(21);
  });

  it('expresses the SLA breach rate off all deliveries', () => {
    expect(result.slaBreachRate.n).toBe(160);
    expect(result.slaBreachRate.value).toBeCloseTo(47 / 160, 10);
  });

  it('uses a strict threshold: exactly 21 days is not a breach', () => {
    const days = dataset.deliveries.map((d) => d.daysToDeliver);
    expect(days.filter((d) => d > 21)).toHaveLength(47);
    expect(days.filter((d) => d >= 21)).toHaveLength(56);
  });
});

describe('computeDeliveries — delay reasons (VERIFY.md)', () => {
  const count = (reason: string) =>
    result.byDelayReason.find((r) => r.reason === reason)?.count;

  it('records a reason on 72 of 160 deliveries', () => {
    expect(result.withDelayReason).toBe(72);
  });

  it('matches the documented cause distribution', () => {
    expect(count('Customer requested date change')).toBe(18);
    expect(count('Logistics delay in transit')).toBe(11);
    expect(count('Vehicle allocation delayed from factory')).toBe(11);
    expect(count('Accessory fitment backlog')).toBe(10);
    expect(count('Finance disbursement pending')).toBe(9);
    expect(count('RTO registration delay')).toBe(7);
    expect(count('PDI rework required')).toBe(6);
  });

  it('sums the seven reasons to 72', () => {
    expect(result.byDelayReason.reduce((sum, r) => sum + r.count, 0)).toBe(72);
    expect(result.byDelayReason).toHaveLength(7);
  });

  it('sorts reasons by frequency, descending', () => {
    for (let i = 1; i < result.byDelayReason.length; i += 1) {
      expect(result.byDelayReason[i - 1].count).toBeGreaterThanOrEqual(
        result.byDelayReason[i].count,
      );
    }
  });

  it('does not treat the 88 reason-less deliveries as on time', () => {
    // 88 deliveries carry no reason, but 47 breached the SLA — so some
    // slow deliveries have no recorded cause.
    expect(result.count - result.withDelayReason).toBe(88);
    expect(result.exceedingSla).toBeGreaterThan(0);
  });
});

describe('deliveriesInScope', () => {
  it('restricts deliveries to leads in scope', () => {
    const lakeside = deliveriesInScope(dataset, {}, { kind: 'branch', branchId: 'B3' });
    expect(lakeside).toHaveLength(6);
  });

  it('returns nulls rather than NaN when nothing is in scope', () => {
    const manager = dataset.reps.find((rep) => rep.role === 'branch_manager');
    expect(manager).toBeDefined();
    if (!manager) return;

    const empty = computeDeliveries(dataset, {}, { kind: 'rep', repId: manager.id });
    expect(empty.count).toBe(0);
    expect(empty.medianDaysToDeliver).toBeNull();
    expect(empty.maxDaysToDeliver).toBeNull();
    expect(empty.slaBreachRate.value).toBeNull();
    expect(empty.slaBreachRate.reason).toBe('insufficient_data');
  });
});
