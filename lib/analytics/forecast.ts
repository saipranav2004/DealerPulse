/**
 * Pipeline forecast.
 *
 * Each open lead is weighted by the probability that a lead at its stage
 * eventually delivers — the product of the remaining step conversions observed
 * in this dataset. Summing those weights gives an expected number of
 * deliveries and an expected value.
 *
 * The module deliberately reports its own weakness. 38 of the open leads sit at
 * `order_placed` with no delivery record, some for six months. A naive weighting
 * treats them as ~80% likely to deliver, which is almost certainly too
 * optimistic — so the result carries a second figure with those excluded, and
 * the UI leads with the range rather than a single confident number.
 */

import { computeFunnel } from '@/lib/analytics/funnel';
import { selectLeads } from '@/lib/filters';
import { isOpen, isStalledOrder } from '@/lib/lead';
import { sumBy } from '@/lib/stats';
import { MIN_RATE_DENOMINATOR, NOW } from '@/lib/data';
import type { Dataset } from '@/lib/data';
import { FUNNEL_STEPS } from '@/lib/types';
import type { Filters, FunnelStage, Scope } from '@/lib/types';

export interface StageForecast {
  stage: FunnelStage;
  openCount: number;
  openValue: number;
  /** Probability a lead at this stage eventually delivers, from observed rates. */
  probability: number;
  expectedDeliveries: number;
  expectedRevenue: number;
  /** Leads observed at this step, so a thin denominator is visible. */
  basisCount: number;
}

export interface ForecastResult {
  stages: StageForecast[];
  /**
   * True when the conversion rates behind the weights rest on too few
   * observations to publish.
   *
   * A one-month calendar window contains no completed journeys, so every step
   * conversion is 0 and the forecast reads "₹0 to ₹0 · 0% likely" over leads
   * genuinely worth lakhs. That is not a forecast of zero, it is the absence of
   * a forecast, and the two must not look alike.
   */
  basisTooThin: boolean;
  /** Smallest step denominator behind the weights, for the caveat. */
  weakestBasis: number;
  openCount: number;
  openValue: number;
  /** Central estimate: every open lead weighted by its stage probability. */
  expectedDeliveries: number;
  expectedRevenue: number;
  /** The same, with stalled orders removed — the conservative bound. */
  expectedDeliveriesExcludingStalled: number;
  expectedRevenueExcludingStalled: number;
  stalledCount: number;
  stalledValue: number;
  /** Open leads already past the close date the rep predicted. */
  overdueCount: number;
  overdueValue: number;
  /** True when stalled orders dominate the estimate enough to distrust it. */
  stalledDominates: boolean;
}

/**
 * Probability of eventually delivering, per stage: the product of the step
 * conversions from that stage onward.
 */
export function stageProbabilities(
  dataset: Dataset,
  filters: Filters = {},
  scope: Scope = { kind: 'company' },
): Map<FunnelStage, { probability: number; basisCount: number }> {
  const funnel = computeFunnel(dataset, filters, scope);
  const out = new Map<FunnelStage, { probability: number; basisCount: number }>();

  FUNNEL_STEPS.forEach(([from], index) => {
    let probability = 1;
    let basisCount = Number.POSITIVE_INFINITY;
    for (let i = index; i < funnel.steps.length; i += 1) {
      const step = funnel.steps[i];
      probability *= step.fromCount > 0 ? step.toCount / step.fromCount : 0;
      basisCount = Math.min(basisCount, step.fromCount);
    }
    out.set(from, {
      probability,
      basisCount: Number.isFinite(basisCount) ? basisCount : 0,
    });
  });

  out.set('delivered', { probability: 1, basisCount: 0 });
  return out;
}

/** Weight the open pipeline by observed stage conversion. */
export function computeForecast(
  dataset: Dataset,
  filters: Filters = {},
  scope: Scope = { kind: 'company' },
): ForecastResult {
  const probabilities = stageProbabilities(dataset, filters, scope);
  const open = selectLeads(dataset, filters, scope).filter(isOpen);

  const byStage = new Map<FunnelStage, typeof open[number][]>();
  for (const lead of open) {
    const stage = lead.status as FunnelStage;
    const bucket = byStage.get(stage);
    if (bucket) bucket.push(lead);
    else byStage.set(stage, [lead]);
  }

  const stages: StageForecast[] = [];
  for (const [stage, leads] of byStage) {
    const entry = probabilities.get(stage) ?? { probability: 0, basisCount: 0 };
    const openValue = sumBy(leads, (lead) => lead.dealValue);
    stages.push({
      stage,
      openCount: leads.length,
      openValue,
      probability: entry.probability,
      expectedDeliveries: leads.length * entry.probability,
      expectedRevenue: openValue * entry.probability,
      basisCount: entry.basisCount,
    });
  }

  // Report in funnel order so the pipeline reads front to back.
  const order = ['new', 'contacted', 'test_drive', 'negotiation', 'order_placed'] as const;
  stages.sort((a, b) => order.indexOf(a.stage as never) - order.indexOf(b.stage as never));

  const stalled = open.filter((lead) => isStalledOrder(lead, dataset));
  const stalledValue = sumBy(stalled, (lead) => lead.dealValue);
  const stalledProbability = probabilities.get('order_placed')?.probability ?? 0;

  const expectedDeliveries = stages.reduce((sum, stage) => sum + stage.expectedDeliveries, 0);
  const expectedRevenue = stages.reduce((sum, stage) => sum + stage.expectedRevenue, 0);
  const expectedDeliveriesExcludingStalled = expectedDeliveries - stalled.length * stalledProbability;
  const expectedRevenueExcludingStalled = expectedRevenue - stalledValue * stalledProbability;

  const overdue = open.filter((lead) => lead.expectedCloseDate.getTime() < NOW.getTime());

  // The weakest denominator anywhere in the chain governs the whole forecast:
  // one thin step makes every downstream probability unpublishable.
  const weakestBasis = stages.length > 0 ? Math.min(...stages.map((stage) => stage.basisCount)) : 0;

  return {
    stages,
    basisTooThin: stages.length > 0 && weakestBasis < MIN_RATE_DENOMINATOR,
    weakestBasis,
    openCount: open.length,
    openValue: sumBy(open, (lead) => lead.dealValue),
    expectedDeliveries,
    expectedRevenue,
    expectedDeliveriesExcludingStalled: Math.max(0, expectedDeliveriesExcludingStalled),
    expectedRevenueExcludingStalled: Math.max(0, expectedRevenueExcludingStalled),
    stalledCount: stalled.length,
    stalledValue,
    overdueCount: overdue.length,
    overdueValue: sumBy(overdue, (lead) => lead.dealValue),
    stalledDominates:
      expectedDeliveries > 0 &&
      (stalled.length * stalledProbability) / expectedDeliveries > 0.5,
  };
}
