/**
 * Two month-by-month series that must never be conflated.
 *
 *  - The **cohort** series groups leads by the month they were *created*, and
 *    reports how many of that cohort eventually delivered. Recent cohorts are
 *    immature by construction: against a 37-day median cycle, a lead created
 *    in December has not had time to deliver, so a falling cohort line is not
 *    a collapse in performance. Every point carries `isMature`.
 *
 *  - The **activity** series groups deliveries by the month the delivery
 *    *happened*. It answers "how much did we hand over in December", which is
 *    a different question with a different shape.
 */

import { NOW, toMonthKey } from '@/lib/data';
import { selectLeads } from '@/lib/filters';
import { isDelivered, isLost, isOpen } from '@/lib/lead';
import { countWhere, rate, sumBy, wholeDaysBetween } from '@/lib/stats';
import type { Dataset } from '@/lib/data';
import type { Filters, MonthKey, Rate, Scope } from '@/lib/types';

/**
 * Median lead-to-delivery cycle in days. A cohort is treated as mature once a
 * full cycle has elapsed since the end of its month.
 */
export const MATURITY_WINDOW_DAYS = 37;

export interface CohortPoint {
  month: MonthKey;
  /** Leads created in this month. */
  leadsCreated: number;
  /** Of those, how many have delivered so far. */
  delivered: number;
  lost: number;
  stillOpen: number;
  createdValue: number;
  deliveredValue: number;
  /** `delivered / leadsCreated`, subject to the low-n guard. */
  conversionToDate: Rate;
  /**
   * False when less than one median cycle has elapsed since the end of this
   * month — the cohort has not had time to convert and must not be read as
   * a performance signal.
   */
  isMature: boolean;
  /** Whole days from the end of this month to NOW. Negative for a month still running. */
  daysSinceMonthEnd: number;
}

export interface ActivityPoint {
  month: MonthKey;
  /** Deliveries that happened in this month. */
  deliveries: number;
  revenue: number;
}

export interface CohortsResult {
  /** Leads grouped by creation month. Ascending. */
  cohorts: CohortPoint[];
  /** Months flagged immature, for the data-quality note. */
  immatureMonths: MonthKey[];
}

/** Last instant of the month a date falls in, in UTC. */
function endOfMonth(month: MonthKey): Date {
  const [year, monthNumber] = month.split('-').map(Number);
  // Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, monthNumber, 0, 23, 59, 59, 999));
}

/** Leads grouped by the month they were created, with maturity flagged. */
export function computeCohorts(
  dataset: Dataset,
  filters: Filters = {},
  scope: Scope = { kind: 'company' },
): CohortsResult {
  const leads = selectLeads(dataset, filters, scope);

  const grouped = new Map<MonthKey, typeof leads>();
  for (const lead of leads) {
    const bucket = grouped.get(lead.createdMonth);
    if (bucket) (bucket as typeof leads[number][]).push(lead);
    else grouped.set(lead.createdMonth, [lead]);
  }

  const months = [...grouped.keys()].sort();

  const cohorts = months.map((month): CohortPoint => {
    const cohortLeads = grouped.get(month) ?? [];
    const delivered = cohortLeads.filter(isDelivered);
    const daysSinceMonthEnd = wholeDaysBetween(endOfMonth(month), NOW);

    return {
      month,
      leadsCreated: cohortLeads.length,
      delivered: delivered.length,
      lost: countWhere(cohortLeads, isLost),
      stillOpen: countWhere(cohortLeads, isOpen),
      createdValue: sumBy(cohortLeads, (lead) => lead.dealValue),
      deliveredValue: sumBy(delivered, (lead) => lead.dealValue),
      conversionToDate: rate(delivered.length, cohortLeads.length),
      isMature: daysSinceMonthEnd >= MATURITY_WINDOW_DAYS,
      daysSinceMonthEnd,
    };
  });

  return {
    cohorts,
    immatureMonths: cohorts.filter((point) => !point.isMature).map((point) => point.month),
  };
}

/**
 * Deliveries grouped by the month they occurred — an activity series, not a
 * cohort series. Deliveries are attributed to their delivery month regardless
 * of when the lead was created.
 */
export function computeDeliveryActivity(
  dataset: Dataset,
  filters: Filters = {},
  scope: Scope = { kind: 'company' },
): ActivityPoint[] {
  const leads = selectLeads(dataset, filters, scope);
  const inScope = new Set(leads.map((lead) => lead.id));

  const byMonth = new Map<MonthKey, { deliveries: number; revenue: number }>();
  for (const delivery of dataset.deliveries) {
    if (!inScope.has(delivery.leadId)) continue;
    const lead = dataset.indexes.leadsById.get(delivery.leadId);
    const bucket = byMonth.get(delivery.deliveryMonth) ?? { deliveries: 0, revenue: 0 };
    bucket.deliveries += 1;
    bucket.revenue += lead?.dealValue ?? 0;
    byMonth.set(delivery.deliveryMonth, bucket);
  }

  return [...byMonth.entries()]
    .map(([month, bucket]) => ({ month, ...bucket }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/** The month key a date belongs to. Re-exported so callers need not reach into the loader. */
export { toMonthKey };
