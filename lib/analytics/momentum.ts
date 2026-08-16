/**
 * Movement, not level.
 *
 * Every other module on the Overview answers "how much"; this one answers
 * "which way, and how fast". Two questions a level cannot:
 *
 *  - What changed between the last complete month and the one before it?
 *  - At the pace of recent months, how long does the open pipeline last?
 *
 * The pace figure is a *median* of the trailing window rather than a mean.
 * December is nearly three times the median month in this dataset, and a mean
 * would let that one month set the expectation for every future one.
 */

import { computeDeliveryActivity } from '@/lib/analytics/cohorts';
import { selectLeads } from '@/lib/filters';
import { isOpen, reachedStage } from '@/lib/lead';
import { median, relativeChange, sumBy } from '@/lib/stats';
import { NOW, toMonthKey } from '@/lib/data';
import type { Dataset } from '@/lib/data';
import type { Filters, MonthKey, Scope } from '@/lib/types';

/** Months averaged into the pace figure. */
export const PACE_WINDOW_MONTHS = 3;

export interface MonthMovement {
  label: string;
  current: number;
  previous: number;
  /** Fractional change; null when the prior month was zero. */
  change: number | null;
  /** True when a rise is bad news — never-called leads, for instance. */
  invert?: boolean;
  /** How the value should be rendered. */
  kind: 'count' | 'currency';
}

export interface MomentumResult {
  currentMonth: MonthKey;
  previousMonth: MonthKey | null;
  movements: MonthMovement[];
  /** Median deliveries per month over the trailing window. */
  paceDeliveries: number | null;
  paceRevenue: number | null;
  paceMonths: number;
  /**
   * Expected deliveries in the open pipeline expressed as months of work at
   * the current pace. Null when there is no pace to divide by.
   */
  monthsOfPipeline: number | null;
  /** True when fewer than two months of history exist to compare. */
  insufficientHistory: boolean;
}

function leadsCreatedIn(dataset: Dataset, filters: Filters, scope: Scope, month: MonthKey) {
  return selectLeads(dataset, filters, scope).filter((lead) => toMonthKey(lead.createdAt) === month);
}

/**
 * @param expectedDeliveries the pipeline forecast's central estimate, so the
 *   pace comparison uses the same number the forecast panel shows.
 */
export function computeMomentum(
  dataset: Dataset,
  filters: Filters = {},
  scope: Scope = { kind: 'company' },
  expectedDeliveries: number | null = null,
): MomentumResult {
  const activity = computeDeliveryActivity(dataset, filters, scope);
  const currentMonth = activity.length > 0 ? activity[activity.length - 1].month : toMonthKey(NOW);
  const previousMonth = activity.length > 1 ? activity[activity.length - 2].month : null;

  const latest = activity[activity.length - 1] ?? { deliveries: 0, revenue: 0 };
  const prior = activity[activity.length - 2] ?? null;

  const createdNow = leadsCreatedIn(dataset, filters, scope, currentMonth);
  const createdBefore = previousMonth ? leadsCreatedIn(dataset, filters, scope, previousMonth) : [];

  const uncalled = (leads: ReturnType<typeof leadsCreatedIn>) =>
    leads.filter((lead) => !reachedStage(lead, 'contacted')).length;

  const movements: MonthMovement[] = [
    {
      label: 'Cars handed over',
      current: latest.deliveries,
      previous: prior?.deliveries ?? 0,
      change: relativeChange(latest.deliveries, prior?.deliveries ?? null),
      kind: 'count',
    },
    {
      label: 'Revenue delivered',
      current: latest.revenue,
      previous: prior?.revenue ?? 0,
      change: relativeChange(latest.revenue, prior?.revenue ?? null),
      kind: 'currency',
    },
    {
      label: 'New leads taken',
      current: createdNow.length,
      previous: createdBefore.length,
      change: relativeChange(createdNow.length, createdBefore.length || null),
      kind: 'count',
    },
    {
      label: 'Of those, never called',
      current: uncalled(createdNow),
      previous: uncalled(createdBefore),
      change: relativeChange(uncalled(createdNow), uncalled(createdBefore) || null),
      invert: true,
      kind: 'count',
    },
  ];

  // The pace window excludes the latest month: it is the thing being judged.
  const window = activity.slice(Math.max(0, activity.length - 1 - PACE_WINDOW_MONTHS), -1);
  const paceDeliveries = window.length > 0 ? median(window.map((point) => point.deliveries)) : null;
  const paceRevenue = window.length > 0 ? median(window.map((point) => point.revenue)) : null;

  return {
    currentMonth,
    previousMonth,
    movements,
    paceDeliveries,
    paceRevenue,
    paceMonths: window.length,
    monthsOfPipeline:
      expectedDeliveries !== null && paceDeliveries !== null && paceDeliveries > 0
        ? expectedDeliveries / paceDeliveries
        : null,
    insufficientHistory: activity.length < 2,
  };
}

/** Total open pipeline value, exposed so the panel need not re-select leads. */
export function openPipelineValue(
  dataset: Dataset,
  filters: Filters = {},
  scope: Scope = { kind: 'company' },
): number {
  return sumBy(selectLeads(dataset, filters, scope).filter(isOpen), (lead) => lead.dealValue);
}
