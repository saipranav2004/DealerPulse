/**
 * How long the pipeline takes.
 *
 * Two views:
 *  - **total cycle**: lead creation to delivery, for delivered leads only.
 *    An open lead has no cycle time yet, and including it would understate
 *    the true figure.
 *  - **stage dwell**: time between first entering one stage and first entering
 *    the next, across every lead that made both transitions.
 *
 * All durations are whole days, and percentiles are order statistics — every
 * number reported here is a duration some lead actually took.
 */

import { selectLeads } from '@/lib/filters';
import { firstEntryAt, isDelivered } from '@/lib/lead';
import { median, percentile, wholeDaysBetween } from '@/lib/stats';
import type { Dataset } from '@/lib/data';
import { FUNNEL_STEPS } from '@/lib/types';
import type { Filters, FunnelStage, Scope } from '@/lib/types';

export interface CycleTimeSummary {
  /** Delivered leads with a usable cycle measurement. */
  n: number;
  medianDays: number | null;
  p90Days: number | null;
  minDays: number | null;
  maxDays: number | null;
}

export interface StageDwell {
  from: FunnelStage;
  to: FunnelStage;
  /** Leads that made both transitions. */
  n: number;
  medianDays: number | null;
  p90Days: number | null;
}

export interface CycleTimeResult {
  total: CycleTimeSummary;
  dwell: StageDwell[];
}

/** Whole-day durations from creation to delivery, for delivered leads in scope. */
export function cycleDurations(
  dataset: Dataset,
  filters: Filters = {},
  scope: Scope = { kind: 'company' },
): number[] {
  const durations: number[] = [];
  for (const lead of selectLeads(dataset, filters, scope)) {
    if (!isDelivered(lead)) continue;
    const deliveredAt = firstEntryAt(lead, 'delivered');
    if (!deliveredAt) continue;
    durations.push(wholeDaysBetween(lead.createdAt, deliveredAt));
  }
  return durations;
}

/** Total cycle time plus per-step dwell medians. */
export function computeCycleTime(
  dataset: Dataset,
  filters: Filters = {},
  scope: Scope = { kind: 'company' },
): CycleTimeResult {
  const durations = cycleDurations(dataset, filters, scope);

  const total: CycleTimeSummary = {
    n: durations.length,
    medianDays: median(durations),
    p90Days: percentile(durations, 0.9),
    minDays: durations.length > 0 ? Math.min(...durations) : null,
    maxDays: durations.length > 0 ? Math.max(...durations) : null,
  };

  const leads = selectLeads(dataset, filters, scope);
  const dwell = FUNNEL_STEPS.map(([from, to]): StageDwell => {
    const gaps: number[] = [];
    for (const lead of leads) {
      const fromAt = firstEntryAt(lead, from);
      const toAt = firstEntryAt(lead, to);
      if (!fromAt || !toAt) continue;
      if (toAt.getTime() < fromAt.getTime()) continue;
      gaps.push(wholeDaysBetween(fromAt, toAt));
    }
    return {
      from,
      to,
      n: gaps.length,
      medianDays: median(gaps),
      p90Days: percentile(gaps, 0.9),
    };
  });

  return { total, dwell };
}
