import { describe, expect, it } from 'vitest';

import { computeModels } from '@/lib/analytics/models';
import { computeForecast, stageProbabilities } from '@/lib/analytics/forecast';
import { getDataset } from '@/lib/data';
import { formatCurrency } from '@/lib/format';

const dataset = getDataset();

describe('computeModels', () => {
  const result = computeModels(dataset);

  it('covers all seven models and every lead', () => {
    expect(result.models).toHaveLength(7);
    expect(result.models.reduce((sum, m) => sum + m.leads, 0)).toBe(510);
    expect(result.models.reduce((sum, m) => sum + m.deliveredUnits, 0)).toBe(160);
    expect(result.totalRevenue).toBe(388_760_000);
  });

  it('ranks by delivered revenue, not by volume', () => {
    expect(result.models.map((m) => m.model)).toEqual([
      'Fortuner',
      'Innova Hycross',
      'Camry',
      'Innova Crysta',
      'Urban Cruiser Hyryder',
      'Glanza',
      'Hilux',
    ]);
  });

  it('reports Fortuner as the revenue leader', () => {
    const fortuner = result.models[0];
    expect(fortuner.model).toBe('Fortuner');
    expect(fortuner.leads).toBe(94);
    expect(fortuner.deliveredUnits).toBe(30);
    expect(fortuner.deliveredRevenue).toBe(126_050_000);
    expect(formatCurrency(fortuner.deliveredRevenue)).toBe('₹12.61 Cr');
    expect(Math.round(fortuner.averageDealValue ?? 0)).toBe(4_251_277);
    expect((fortuner.revenueShare * 100).toFixed(1)).toBe('32.4');
  });

  /**
   * The headline finding for a dealership: the most-asked-about car is not the
   * one that pays. Glanza draws the most leads and earns the second least.
   */
  it('detects that volume and value are misaligned', () => {
    expect(result.topByRevenue?.model).toBe('Fortuner');
    expect(result.topByVolume?.model).toBe('Glanza');
    expect(result.mixIsMisaligned).toBe(true);

    const glanza = result.models.find((m) => m.model === 'Glanza');
    expect(glanza?.leads).toBe(130);
    expect(glanza?.deliveredRevenue).toBe(39_740_000);
    expect(Math.round(glanza?.averageDealValue ?? 0)).toBe(907_615);
    // Most leads, roughly a fifth of the revenue per unit of the leader.
    expect(glanza!.leads).toBeGreaterThan(result.topByRevenue!.leads);
    expect(glanza!.deliveredRevenue).toBeLessThan(result.topByRevenue!.deliveredRevenue);
  });

  it('reports the worst-converting model', () => {
    const hyryder = result.models.find((m) => m.model === 'Urban Cruiser Hyryder');
    expect(hyryder?.leads).toBe(104);
    expect(((hyryder?.winRate.value ?? 0) * 100).toFixed(1)).toBe('26.0');
  });

  it('shares sum to one', () => {
    expect(result.models.reduce((sum, m) => sum + m.revenueShare, 0)).toBeCloseTo(1, 6);
    expect(result.models.reduce((sum, m) => sum + m.leadShare, 0)).toBeCloseTo(1, 6);
  });

  it('suppresses rates for a model with too few leads under a filter', () => {
    const narrow = computeModels(dataset, { branchIds: ['B3'], models: ['Camry'] });
    for (const model of narrow.models) {
      if (model.leads < 10) expect(model.winRate.value).toBeNull();
    }
  });

  it('returns an empty result for an empty scope rather than throwing', () => {
    const manager = dataset.reps.find((rep) => rep.role === 'branch_manager');
    expect(manager).toBeDefined();
    if (!manager) return;
    const empty = computeModels(dataset, {}, { kind: 'rep', repId: manager.id });
    expect(empty.models).toHaveLength(0);
    expect(empty.topByRevenue).toBeNull();
    expect(empty.mixIsMisaligned).toBe(false);
  });
});

describe('stageProbabilities', () => {
  const probabilities = stageProbabilities(dataset);

  /**
   * A lead at `new` delivering is exactly the company win rate. If this ever
   * drifts, the forecast has stopped being internally consistent.
   */
  it('is coherent: P(deliver | new) equals the company win rate', () => {
    expect(probabilities.get('new')?.probability).toBeCloseTo(160 / 510, 10);
  });

  it('rises monotonically along the funnel', () => {
    const order = ['new', 'contacted', 'test_drive', 'negotiation', 'order_placed'] as const;
    for (let i = 1; i < order.length; i += 1) {
      const previous = probabilities.get(order[i - 1])?.probability ?? 0;
      const current = probabilities.get(order[i])?.probability ?? 0;
      expect(current).toBeGreaterThan(previous);
    }
    expect(probabilities.get('order_placed')?.probability).toBeCloseTo(160 / 198, 10);
  });
});

describe('computeForecast', () => {
  const forecast = computeForecast(dataset);

  it('weights all 62 open leads by stage', () => {
    expect(forecast.openCount).toBe(62);
    expect(forecast.openValue).toBe(151_540_000);
    expect(forecast.stages.reduce((sum, s) => sum + s.openCount, 0)).toBe(62);
  });

  it('orders stages front to back', () => {
    expect(forecast.stages.map((s) => s.stage)).toEqual([
      'new',
      'contacted',
      'test_drive',
      'negotiation',
      'order_placed',
    ]);
  });

  it('produces the expected central estimate', () => {
    expect(forecast.expectedDeliveries).toBeCloseTo(41.61, 1);
    expect(Math.round(forecast.expectedRevenue)).toBe(98_811_728);
    expect(formatCurrency(forecast.expectedRevenue)).toBe('₹9.88 Cr');
  });

  /** The estimate is dominated by orders that have already failed to deliver. */
  it('reports a conservative bound with stalled orders removed', () => {
    expect(forecast.stalledCount).toBe(38);
    expect(forecast.stalledValue).toBe(85_860_000);
    expect(forecast.expectedDeliveriesExcludingStalled).toBeCloseTo(10.9, 1);
    expect(formatCurrency(forecast.expectedRevenueExcludingStalled)).toBe('₹2.94 Cr');
    expect(forecast.stalledDominates).toBe(true);
  });

  it('flags open leads already past their predicted close date', () => {
    expect(forecast.overdueCount).toBe(31);
    expect(forecast.overdueValue).toBe(68_900_000);
    expect(formatCurrency(forecast.overdueValue)).toBe('₹6.89 Cr');
  });

  it('never predicts more deliveries than there are open leads', () => {
    expect(forecast.expectedDeliveries).toBeLessThanOrEqual(forecast.openCount);
    expect(forecast.expectedRevenue).toBeLessThanOrEqual(forecast.openValue);
  });

  it('returns zeroes rather than NaN for an empty pipeline', () => {
    const manager = dataset.reps.find((rep) => rep.role === 'branch_manager');
    expect(manager).toBeDefined();
    if (!manager) return;
    const empty = computeForecast(dataset, {}, { kind: 'rep', repId: manager.id });
    expect(empty.openCount).toBe(0);
    expect(empty.expectedDeliveries).toBe(0);
    expect(empty.expectedRevenue).toBe(0);
    expect(empty.stalledDominates).toBe(false);
    expect(Number.isNaN(empty.expectedRevenue)).toBe(false);
  });
});
