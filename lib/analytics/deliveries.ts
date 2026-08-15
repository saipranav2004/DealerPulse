/**
 * The delivery leg: order placed to vehicle handed over.
 *
 * This is the part of the cycle the dealership controls after the customer has
 * already committed, so a slow leg is money sitting in a compound rather than
 * a selling problem. Delay reasons are recorded on 72 of 160 deliveries; the
 * remaining 88 delivered with no reason on file and are reported as such
 * rather than assumed to be on time.
 */

import { selectLeads } from '@/lib/filters';
import { median, percentile, rate, sumBy } from '@/lib/stats';
import type { Dataset } from '@/lib/data';
import type { DelayReason, Delivery, Filters, Rate, Scope } from '@/lib/types';

/** Deliveries taking longer than this many days are flagged as a slow leg. */
export const DELIVERY_SLA_DAYS = 21;

export interface DelayReasonBucket {
  /** Null means no reason was recorded for these deliveries. */
  reason: DelayReason | null;
  count: number;
  share: Rate;
}

export interface DeliveriesResult {
  count: number;
  revenue: number;
  medianDaysToDeliver: number | null;
  p90DaysToDeliver: number | null;
  maxDaysToDeliver: number | null;
  /** Deliveries exceeding the SLA. */
  exceedingSla: number;
  slaBreachRate: Rate;
  slaDays: number;
  /** Deliveries carrying a recorded delay reason. */
  withDelayReason: number;
  /** Reason breakdown, most frequent first. Unspecified is excluded. */
  byDelayReason: DelayReasonBucket[];
}

/** Deliveries belonging to leads in scope. */
export function deliveriesInScope(
  dataset: Dataset,
  filters: Filters = {},
  scope: Scope = { kind: 'company' },
): Delivery[] {
  const inScope = new Set(selectLeads(dataset, filters, scope).map((lead) => lead.id));
  return dataset.deliveries.filter((delivery) => inScope.has(delivery.leadId));
}

/** Delivery-leg durations and delay-reason breakdown. */
export function computeDeliveries(
  dataset: Dataset,
  filters: Filters = {},
  scope: Scope = { kind: 'company' },
): DeliveriesResult {
  const deliveries = deliveriesInScope(dataset, filters, scope);
  const days = deliveries.map((delivery) => delivery.daysToDeliver);

  const withReason = deliveries.filter((delivery) => delivery.delayReason !== null);
  const reasonCounts = new Map<DelayReason, number>();
  for (const delivery of withReason) {
    if (delivery.delayReason === null) continue;
    reasonCounts.set(delivery.delayReason, (reasonCounts.get(delivery.delayReason) ?? 0) + 1);
  }

  const byDelayReason: DelayReasonBucket[] = [...reasonCounts.entries()]
    .map(([reason, count]) => ({
      reason,
      count,
      share: rate(count, deliveries.length),
    }))
    .sort((a, b) => b.count - a.count || String(a.reason).localeCompare(String(b.reason)));

  const exceedingSla = days.filter((value) => value > DELIVERY_SLA_DAYS).length;

  return {
    count: deliveries.length,
    revenue: sumBy(
      deliveries,
      (delivery) => dataset.indexes.leadsById.get(delivery.leadId)?.dealValue ?? 0,
    ),
    medianDaysToDeliver: median(days),
    p90DaysToDeliver: percentile(days, 0.9),
    maxDaysToDeliver: days.length > 0 ? Math.max(...days) : null,
    exceedingSla,
    slaBreachRate: rate(exceedingSla, deliveries.length),
    slaDays: DELIVERY_SLA_DAYS,
    withDelayReason: withReason.length,
    byDelayReason,
  };
}
