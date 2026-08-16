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

/** Below this, a pace is printed as its months rather than as a median. */
export const MIN_PACE_MONTHS = 3;

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
  /**
   * Median deliveries per month across the months in view, latest included.
   * Null when fewer than `MIN_PACE_MONTHS` months exist — a "median" of one
   * value is that value wearing a statistic's name.
   */
  paceDeliveries: number | null;
  paceRevenue: number | null;
  paceMonths: number;
  /** Every month in the pace window, for printing when there are too few. */
  paceSeries: { month: MonthKey; deliveries: number }[];
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

/** Every month key from `from` to `to`, inclusive, ascending. */
function monthsBetween(from: Date, to: Date): MonthKey[] {
  const out: MonthKey[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const last = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1);
  while (cursor.getTime() <= last) {
    out.push(toMonthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return out;
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
  /**
   * The selected period. "What changed last month" is a calendar question by
   * nature, so the months compared come from the window the user picked — not
   * from whichever months the selected *cohort* happened to deliver in.
   *
   * Under a June cohort filter the old behaviour compared "Aug against Jul",
   * because June's leads delivered later, and then reported zero new leads
   * because none were created in August.
   */
  period: { from: Date; to: Date } | null = null,
): MomentumResult {
  // Entity axes only. Both series below are month-by-month already, so a date
  // axis on top of them would double-filter and drop months.
  const axes: Filters = {
    branchIds: filters.branchIds,
    models: filters.models,
    sources: filters.sources,
  };

  const all = computeDeliveryActivity(dataset, axes, scope);
  const inWindow = period ? new Set(monthsBetween(period.from, period.to)) : null;
  const activity = inWindow ? all.filter((point) => inWindow.has(point.month)) : all;

  const months = period ? monthsBetween(period.from, period.to) : all.map((point) => point.month);
  /*
   * A one-month window still has a "last month" — the month before it. Without
   * this the strip disappears entirely on every single-month period, which is
   * exactly when the question is most natural to ask.
   */
  if (months.length === 1) {
    const [year, month] = months[0].split('-').map(Number);
    const before = toMonthKey(new Date(Date.UTC(year, month - 2, 1)));
    // Only if that month exists in the data. Naming a month the dataset has
    // never heard of invites the reader to read its zeroes as a collapse.
    if (all.some((point) => point.month === before)) months.unshift(before);
  }
  const currentMonth = months[months.length - 1] ?? toMonthKey(NOW);
  const previousMonth = months.length > 1 ? months[months.length - 2] : null;

  const at = (month: MonthKey | null) =>
    (month ? all.find((point) => point.month === month) : undefined) ?? {
      month: currentMonth,
      deliveries: 0,
      revenue: 0,
    };
  const latest = at(currentMonth);
  const prior = previousMonth ? at(previousMonth) : null;

  const createdNow = leadsCreatedIn(dataset, axes, scope, currentMonth);
  const createdBefore = previousMonth ? leadsCreatedIn(dataset, axes, scope, previousMonth) : [];

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

  /*
   * The pace window ends at the latest month, inclusive.
   *
   * It used to exclude it, which under a Q4 filter left exactly one month —
   * November's 17 — and printed "the pace of the last 1 months" while December
   * had delivered 52. The figure was understated roughly threefold and the
   * sentence was ungrammatical about it.
   */
  const paceWindow = activity.slice(Math.max(0, activity.length - PACE_WINDOW_MONTHS));
  const enoughMonths = paceWindow.length >= MIN_PACE_MONTHS;
  const paceDeliveries = enoughMonths ? median(paceWindow.map((point) => point.deliveries)) : null;
  const paceRevenue = enoughMonths ? median(paceWindow.map((point) => point.revenue)) : null;

  return {
    currentMonth,
    previousMonth,
    movements,
    paceDeliveries,
    paceRevenue,
    paceMonths: paceWindow.length,
    paceSeries: paceWindow.map((point) => ({ month: point.month, deliveries: point.deliveries })),
    monthsOfPipeline:
      expectedDeliveries !== null && paceDeliveries !== null && paceDeliveries > 0
        ? expectedDeliveries / paceDeliveries
        : null,
    insufficientHistory: previousMonth === null,
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
