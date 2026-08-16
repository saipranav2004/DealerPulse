/**
 * Target attainment.
 *
 * The targets in this dataset are mis-baselined: the group targeted 1,426
 * units and delivered 160, so absolute attainment sits near 12%. That number
 * is computed and reported, but it is deliberately not a primary KPI and must
 * never drive red/critical styling — it measures the target, not the branch.
 *
 * `relativeIndex` is the honest framing: a branch's attainment expressed
 * against the group average, where 100 means "exactly typical for this group".
 */

import { selectLeads } from '@/lib/filters';
import { isDelivered } from '@/lib/lead';
import { sumBy } from '@/lib/stats';
import type { Dataset } from '@/lib/data';
import type { BranchId, Filters, MonthKey } from '@/lib/types';

export interface Attainment {
  deliveredUnits: number;
  deliveredRevenue: number;
  targetUnits: number;
  targetRevenue: number;
  /** delivered / target. Null when the target is zero. */
  unitAttainment: number | null;
  revenueAttainment: number | null;
}

export interface BranchAttainment extends Attainment {
  branchId: BranchId;
  name: string;
  /**
   * Branch revenue attainment as an index against the group's revenue
   * attainment: 100 = group average, 120 = 20% ahead of the group.
   * Null when either side is undefined.
   */
  relativeIndex: number | null;
}

export interface MonthlyAttainment extends Attainment {
  month: MonthKey;
}

export interface TargetsResult {
  group: Attainment;
  branches: BranchAttainment[];
  /** Group attainment by month, over the months present in the targets table. */
  byMonth: MonthlyAttainment[];
  /**
   * Always true for this dataset. Surfaced so the UI can carry the caveat
   * rather than hard-coding it.
   */
  targetsAreMisBaselined: boolean;
}

function ratioOrNull(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

/** Targets in scope, honouring a branch filter and a month range if present. */
function targetsInScope(dataset: Dataset, filters: Filters) {
  /*
   * Either date axis narrows the target months.
   *
   * This used to read `filters.dateRange` alone. Once the calendar basis put
   * the window in `activityRange` instead, targets stopped being narrowed at
   * all: a one-month view compared its 26 leads against the full seven-month
   * target of 1,426 units and reported the plan as 55x lead volume.
   */
  const range = filters.dateRange ?? filters.activityRange;

  const monthsAllowed = (month: MonthKey): boolean => {
    if (!range) return true;
    const fromMonth = `${range.from.getUTCFullYear()}-${String(
      range.from.getUTCMonth() + 1,
    ).padStart(2, '0')}`;
    const toMonth = `${range.to.getUTCFullYear()}-${String(
      range.to.getUTCMonth() + 1,
    ).padStart(2, '0')}`;
    return month >= fromMonth && month <= toMonth;
  };

  return dataset.targets.filter(
    (target) =>
      (!filters.branchIds || filters.branchIds.includes(target.branchId)) &&
      monthsAllowed(target.month),
  );
}

/** Attainment for the group, each branch, and each month. */
export function computeTargets(dataset: Dataset, filters: Filters = {}): TargetsResult {
  const scopedTargets = targetsInScope(dataset, filters);
  const allLeads = selectLeads(dataset, filters);
  const groupDelivered = allLeads.filter(isDelivered);

  const groupTargetUnits = sumBy(scopedTargets, (target) => target.targetUnits);
  const groupTargetRevenue = sumBy(scopedTargets, (target) => target.targetRevenue);
  const groupDeliveredRevenue = sumBy(groupDelivered, (lead) => lead.dealValue);

  const group: Attainment = {
    deliveredUnits: groupDelivered.length,
    deliveredRevenue: groupDeliveredRevenue,
    targetUnits: groupTargetUnits,
    targetRevenue: groupTargetRevenue,
    unitAttainment: ratioOrNull(groupDelivered.length, groupTargetUnits),
    revenueAttainment: ratioOrNull(groupDeliveredRevenue, groupTargetRevenue),
  };

  const branchIds = filters.branchIds
    ? dataset.branches.filter((b) => filters.branchIds?.includes(b.id))
    : dataset.branches;

  const branches = branchIds.map((branch): BranchAttainment => {
    const leads = selectLeads(dataset, filters, { kind: 'branch', branchId: branch.id });
    const delivered = leads.filter(isDelivered);
    const deliveredRevenue = sumBy(delivered, (lead) => lead.dealValue);

    const branchTargets = scopedTargets.filter((target) => target.branchId === branch.id);
    const targetUnits = sumBy(branchTargets, (target) => target.targetUnits);
    const targetRevenue = sumBy(branchTargets, (target) => target.targetRevenue);
    const revenueAttainment = ratioOrNull(deliveredRevenue, targetRevenue);

    return {
      branchId: branch.id,
      name: branch.name,
      deliveredUnits: delivered.length,
      deliveredRevenue,
      targetUnits,
      targetRevenue,
      unitAttainment: ratioOrNull(delivered.length, targetUnits),
      revenueAttainment,
      relativeIndex:
        revenueAttainment !== null && group.revenueAttainment
          ? (revenueAttainment / group.revenueAttainment) * 100
          : null,
    };
  });

  const months = [...new Set(scopedTargets.map((target) => target.month))].sort();
  const byMonth = months.map((month): MonthlyAttainment => {
    const monthTargets = scopedTargets.filter((target) => target.month === month);
    const targetUnits = sumBy(monthTargets, (target) => target.targetUnits);
    const targetRevenue = sumBy(monthTargets, (target) => target.targetRevenue);

    const monthDeliveries = dataset.deliveries.filter(
      (delivery) => delivery.deliveryMonth === month,
    );
    const inScope = new Set(allLeads.map((lead) => lead.id));
    const delivered = monthDeliveries.filter((delivery) => inScope.has(delivery.leadId));
    const deliveredRevenue = sumBy(
      delivered,
      (delivery) => dataset.indexes.leadsById.get(delivery.leadId)?.dealValue ?? 0,
    );

    return {
      month,
      deliveredUnits: delivered.length,
      deliveredRevenue,
      targetUnits,
      targetRevenue,
      unitAttainment: ratioOrNull(delivered.length, targetUnits),
      revenueAttainment: ratioOrNull(deliveredRevenue, targetRevenue),
    };
  });

  return { group, branches, byMonth, targetsAreMisBaselined: true };
}
