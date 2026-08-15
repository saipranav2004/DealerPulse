/**
 * Lead aging and stalled orders, measured against the pinned `NOW`.
 *
 * Age is whole elapsed days: a lead idle for 7.6 days is 7 days old and does
 * *not* clear a "more than 7 days" threshold. Applying that rule consistently
 * is what makes the aging buckets reproducible.
 */

import { NOW } from '@/lib/data';
import { selectLeads } from '@/lib/filters';
import { isOpen, isStalledOrder, lastEntryFor } from '@/lib/lead';
import { sumBy, wholeDaysBetween } from '@/lib/stats';
import type { Dataset } from '@/lib/data';
import type { BranchId, Filters, Lead, LeadId, Scope } from '@/lib/types';

/** Default staleness thresholds, in whole days. */
export const AGING_THRESHOLDS = [7, 14, 30] as const;

export interface AgedLead {
  leadId: LeadId;
  customerName: string;
  branchId: BranchId;
  assignedTo: RepIdAlias;
  status: Lead['status'];
  dealValue: number;
  /** Whole days since `last_activity_at`, against NOW. */
  daysSinceActivity: number;
}

type RepIdAlias = Lead['assignedTo'];

export interface AgingBucket {
  /** Leads older than this many whole days. */
  thresholdDays: number;
  count: number;
  value: number;
}

export interface StalledOrder {
  leadId: LeadId;
  customerName: string;
  branchId: BranchId;
  assignedTo: RepIdAlias;
  dealValue: number;
  /** Whole days since the order was placed, against NOW. */
  ageDays: number;
}

export interface StalledOrdersResult {
  count: number;
  value: number;
  /** Age of the oldest stalled order in whole days, or null when none are stalled. */
  oldestAgeDays: number | null;
  orders: StalledOrder[];
  countByBranch: Map<BranchId, number>;
  valueByBranch: Map<BranchId, number>;
}

export interface AgingResult {
  openLeads: number;
  openValue: number;
  buckets: AgingBucket[];
  /** Every open lead with its age, sorted oldest first. */
  aged: AgedLead[];
}

/**
 * Staleness of open leads. Only open leads age — a delivered or lost lead has
 * reached its outcome and is not waiting on anybody.
 */
export function computeAging(
  dataset: Dataset,
  filters: Filters = {},
  scope: Scope = { kind: 'company' },
  thresholds: readonly number[] = AGING_THRESHOLDS,
): AgingResult {
  const open = selectLeads(dataset, filters, scope).filter(isOpen);

  const aged: AgedLead[] = open
    .map((lead) => ({
      leadId: lead.id,
      customerName: lead.customerName,
      branchId: lead.branchId,
      assignedTo: lead.assignedTo,
      status: lead.status,
      dealValue: lead.dealValue,
      daysSinceActivity: wholeDaysBetween(lead.lastActivityAt, NOW),
    }))
    .sort((a, b) => b.daysSinceActivity - a.daysSinceActivity);

  const buckets: AgingBucket[] = thresholds.map((thresholdDays) => {
    const matching = aged.filter((lead) => lead.daysSinceActivity > thresholdDays);
    return {
      thresholdDays,
      count: matching.length,
      value: sumBy(matching, (lead) => lead.dealValue),
    };
  });

  return {
    openLeads: open.length,
    openValue: sumBy(open, (lead) => lead.dealValue),
    buckets,
    aged,
  };
}

/**
 * Orders placed but never delivered: current status `order_placed` with no
 * delivery record. Age runs from the order being placed, since that is the
 * commitment the customer is waiting on.
 */
export function computeStalledOrders(
  dataset: Dataset,
  filters: Filters = {},
  scope: Scope = { kind: 'company' },
): StalledOrdersResult {
  const stalled = selectLeads(dataset, filters, scope).filter((lead) =>
    isStalledOrder(lead, dataset),
  );

  const orders: StalledOrder[] = stalled
    .map((lead) => {
      const orderEntry = lastEntryFor(lead, 'order_placed');
      const placedAt = orderEntry?.timestamp ?? lead.lastActivityAt;
      return {
        leadId: lead.id,
        customerName: lead.customerName,
        branchId: lead.branchId,
        assignedTo: lead.assignedTo,
        dealValue: lead.dealValue,
        ageDays: wholeDaysBetween(placedAt, NOW),
      };
    })
    .sort((a, b) => b.ageDays - a.ageDays);

  const countByBranch = new Map<BranchId, number>();
  const valueByBranch = new Map<BranchId, number>();
  for (const order of orders) {
    countByBranch.set(order.branchId, (countByBranch.get(order.branchId) ?? 0) + 1);
    valueByBranch.set(
      order.branchId,
      (valueByBranch.get(order.branchId) ?? 0) + order.dealValue,
    );
  }

  return {
    count: orders.length,
    value: sumBy(orders, (order) => order.dealValue),
    oldestAgeDays: orders.length > 0 ? orders[0].ageDays : null,
    orders,
    countByBranch,
    valueByBranch,
  };
}
