/**
 * Per-branch rollup, with each branch measured against the benchmark of the
 * branches in scope rather than against target.
 *
 * Comparison to the group is the honest framing here: the targets in this
 * dataset are mis-baselined, so "12% of target" says more about the target
 * than about the branch.
 */

import { computeFunnel } from '@/lib/analytics/funnel';
import type { FunnelStepConversion } from '@/lib/analytics/funnel';
import { selectLeads } from '@/lib/filters';
import { isDelivered, isOpen, isStalledOrder, reachedStage } from '@/lib/lead';
import { countWhere, rate, sumBy } from '@/lib/stats';
import type { Dataset } from '@/lib/data';
import type { BranchId, Filters, Rate } from '@/lib/types';

export interface BranchRollup {
  branchId: BranchId;
  name: string;
  city: string;
  leads: number;
  deliveredUnits: number;
  deliveredRevenue: number;
  winRate: Rate;
  /** Share of leads that ever reached `contacted` — did anyone pick up the lead at all? */
  firstContactRate: Rate;
  openCount: number;
  openValue: number;
  stalledCount: number;
  stalledValue: number;
  /** The five consecutive stage-to-stage conversions for this branch. */
  stepConversions: FunnelStepConversion[];
  /**
   * Win rate minus the benchmark win rate, in fractional points.
   * Null when either side is suppressed by the low-n guard.
   */
  winRateVsBenchmark: number | null;
  /** First-contact rate minus the benchmark, in fractional points. */
  firstContactVsBenchmark: number | null;
}

export interface BranchBenchmark {
  /** Win rate across every branch in scope, pooled. */
  winRate: Rate;
  firstContactRate: Rate;
  leads: number;
  deliveredUnits: number;
}

export interface BranchesResult {
  benchmark: BranchBenchmark;
  branches: BranchRollup[];
}

/**
 * Rollup for every branch in scope plus the pooled benchmark they are
 * compared against.
 */
export function computeBranches(dataset: Dataset, filters: Filters = {}): BranchesResult {
  const scoped = filters.branchIds
    ? dataset.branches.filter((branch) => filters.branchIds?.includes(branch.id))
    : dataset.branches;

  const allLeads = selectLeads(dataset, filters);
  const benchmark: BranchBenchmark = {
    winRate: rate(countWhere(allLeads, isDelivered), allLeads.length),
    firstContactRate: rate(
      countWhere(allLeads, (lead) => reachedStage(lead, 'contacted')),
      allLeads.length,
    ),
    leads: allLeads.length,
    deliveredUnits: countWhere(allLeads, isDelivered),
  };

  const branches = scoped.map((branch): BranchRollup => {
    const leads = selectLeads(dataset, filters, { kind: 'branch', branchId: branch.id });
    const delivered = leads.filter(isDelivered);
    const open = leads.filter(isOpen);
    const stalled = leads.filter((lead) => isStalledOrder(lead, dataset));

    const winRate = rate(delivered.length, leads.length);
    const firstContactRate = rate(
      countWhere(leads, (lead) => reachedStage(lead, 'contacted')),
      leads.length,
    );

    const funnel = computeFunnel(dataset, filters, { kind: 'branch', branchId: branch.id });

    return {
      branchId: branch.id,
      name: branch.name,
      city: branch.city,
      leads: leads.length,
      deliveredUnits: delivered.length,
      deliveredRevenue: sumBy(delivered, (lead) => lead.dealValue),
      winRate,
      firstContactRate,
      openCount: open.length,
      openValue: sumBy(open, (lead) => lead.dealValue),
      stalledCount: stalled.length,
      stalledValue: sumBy(stalled, (lead) => lead.dealValue),
      stepConversions: funnel.steps,
      winRateVsBenchmark:
        winRate.value !== null && benchmark.winRate.value !== null
          ? winRate.value - benchmark.winRate.value
          : null,
      firstContactVsBenchmark:
        firstContactRate.value !== null && benchmark.firstContactRate.value !== null
          ? firstContactRate.value - benchmark.firstContactRate.value
          : null,
    };
  });

  return { benchmark, branches };
}

/**
 * Rollup for the branches in scope excluding one — the "how do the others
 * compare" view used when a single branch is under investigation.
 */
export function computePeerBenchmark(
  dataset: Dataset,
  filters: Filters,
  excludeBranchId: BranchId,
): BranchBenchmark {
  const peerIds = dataset.branches
    .map((branch) => branch.id)
    .filter((id) => id !== excludeBranchId)
    .filter((id) => !filters.branchIds || filters.branchIds.includes(id));

  const leads = selectLeads(dataset, { ...filters, branchIds: peerIds });

  return {
    winRate: rate(countWhere(leads, isDelivered), leads.length),
    firstContactRate: rate(
      countWhere(leads, (lead) => reachedStage(lead, 'contacted')),
      leads.length,
    ),
    leads: leads.length,
    deliveredUnits: countWhere(leads, isDelivered),
  };
}
