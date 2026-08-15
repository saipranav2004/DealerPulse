/**
 * Funnel: how far leads got, and where they stopped.
 *
 * "Reached" means the stage ever appeared in the lead's `status_history` —
 * not its current status. A lead now marked `lost` that once sat in
 * `negotiation` counts as having reached `contacted`, `test_drive` and
 * `negotiation`.
 */

import { selectLeads } from '@/lib/filters';
import { reachedStage } from '@/lib/lead';
import { countWhere, rate } from '@/lib/stats';
import type { Dataset } from '@/lib/data';
import { FUNNEL_STAGES, FUNNEL_STEPS } from '@/lib/types';
import type { BranchId, Filters, FunnelStage, Rate, Scope } from '@/lib/types';

export interface FunnelStageCount {
  stage: FunnelStage;
  /** Leads that ever reached this stage. */
  reached: number;
  /** `reached` as a share of all leads in scope. */
  shareOfLeads: Rate;
}

export interface FunnelStepConversion {
  from: FunnelStage;
  to: FunnelStage;
  fromCount: number;
  toCount: number;
  /** `toCount / fromCount`, subject to the low-n guard. */
  conversion: Rate;
  /** Leads that reached `from` but never `to`. */
  dropOff: number;
}

export interface FunnelResult {
  scope: Scope;
  totalLeads: number;
  stages: FunnelStageCount[];
  steps: FunnelStepConversion[];
}

/**
 * Stage-reached counts and step conversions for any scope: company, a single
 * branch, or a single rep.
 */
export function computeFunnel(
  dataset: Dataset,
  filters: Filters = {},
  scope: Scope = { kind: 'company' },
): FunnelResult {
  const leads = selectLeads(dataset, filters, scope);

  const reachedCounts = new Map<FunnelStage, number>();
  for (const stage of FUNNEL_STAGES) {
    reachedCounts.set(stage, countWhere(leads, (lead) => reachedStage(lead, stage)));
  }

  const stages: FunnelStageCount[] = FUNNEL_STAGES.map((stage) => {
    const reached = reachedCounts.get(stage) ?? 0;
    return { stage, reached, shareOfLeads: rate(reached, leads.length) };
  });

  const steps: FunnelStepConversion[] = FUNNEL_STEPS.map(([from, to]) => {
    const fromCount = reachedCounts.get(from) ?? 0;
    const toCount = reachedCounts.get(to) ?? 0;
    return {
      from,
      to,
      fromCount,
      toCount,
      conversion: rate(toCount, fromCount),
      dropOff: fromCount - toCount,
    };
  });

  return { scope, totalLeads: leads.length, stages, steps };
}

/**
 * The step with the largest absolute drop-off — the bottleneck a manager
 * should look at first. Null when no step has any drop-off.
 */
export function largestDropOff(funnel: FunnelResult): FunnelStepConversion | null {
  let worst: FunnelStepConversion | null = null;
  for (const step of funnel.steps) {
    if (step.dropOff > 0 && (worst === null || step.dropOff > worst.dropOff)) worst = step;
  }
  return worst;
}

export interface FunnelStepComparison {
  from: FunnelStage;
  to: FunnelStage;
  fromCount: number;
  toCount: number;
  branchRate: number;
  peerRate: number;
  /** Signed difference in percentage points; negative means behind peers. */
  deltaPoints: number;
  /** Leads that did not advance. */
  leadsLost: number;
  /** Leads that would not have advanced at the peer rate. */
  expectedLost: number;
  /** leadsLost − expectedLost: the loss attributable to this branch. */
  extraLost: number;
}

export interface FunnelStageComparison {
  stage: FunnelStage;
  /** Leads that actually reached this stage. */
  count: number;
  /** Leads that would have reached it at peer rates, from the same starting pool. */
  peerCount: number;
}

export interface FunnelComparison {
  branchId: BranchId;
  leads: number;
  stages: FunnelStageComparison[];
  steps: FunnelStepComparison[];
  /**
   * The step where the branch loses most leads relative to peers. Ranked by
   * leads lost rather than percentage-point gap: a wide gap on a small pool
   * costs less than a narrower gap at the top of the funnel.
   */
  breakStep: FunnelStepComparison | null;
  /** Product of the peer step rates. */
  peerProduct: number;
  deliveriesAtPeerRates: number;
  actualDeliveries: number;
}

/**
 * Compare one branch's funnel against the pooled funnel of the other branches
 * in scope. Shared by the branch screen and by the verdict, so the two can
 * never disagree about which step is the break.
 */
export function compareFunnelToPeers(
  dataset: Dataset,
  filters: Filters,
  branchId: BranchId,
): FunnelComparison | null {
  const peerIds = dataset.branches
    .map((branch) => branch.id)
    .filter((id) => id !== branchId)
    .filter((id) => !filters.branchIds || filters.branchIds.includes(id));

  if (peerIds.length === 0) return null;

  const branchFunnel = computeFunnel(dataset, filters, { kind: 'branch', branchId });
  const peerFunnel = computeFunnel(dataset, { ...filters, branchIds: peerIds });
  if (branchFunnel.totalLeads === 0 || peerFunnel.totalLeads === 0) return null;

  const steps: FunnelStepComparison[] = FUNNEL_STEPS.map(([from, to], index) => {
    const branchStep = branchFunnel.steps[index];
    const peerStep = peerFunnel.steps[index];
    const branchRate = branchStep.fromCount > 0 ? branchStep.toCount / branchStep.fromCount : 0;
    const peerRate = peerStep.fromCount > 0 ? peerStep.toCount / peerStep.fromCount : 0;
    const leadsLost = branchStep.fromCount - branchStep.toCount;
    const expectedLost = branchStep.fromCount * (1 - peerRate);

    return {
      from,
      to,
      fromCount: branchStep.fromCount,
      toCount: branchStep.toCount,
      branchRate,
      peerRate,
      deltaPoints: (branchRate - peerRate) * 100,
      leadsLost,
      expectedLost,
      extraLost: leadsLost - expectedLost,
    };
  });

  // Cumulative counts a peer-rate funnel would produce from the same pool.
  let running = branchFunnel.totalLeads;
  const peerCounts = new Map<FunnelStage, number>([[FUNNEL_STAGES[0], running]]);
  for (const step of steps) {
    running *= step.peerRate;
    peerCounts.set(step.to, running);
  }

  const stages: FunnelStageComparison[] = branchFunnel.stages.map((stage) => ({
    stage: stage.stage,
    count: stage.reached,
    peerCount: peerCounts.get(stage.stage) ?? 0,
  }));

  const breakStep = steps.reduce<FunnelStepComparison | null>(
    (worst, step) => (worst === null || step.extraLost > worst.extraLost ? step : worst),
    null,
  );

  const peerProduct = steps.reduce((product, step) => product * step.peerRate, 1);

  return {
    branchId,
    leads: branchFunnel.totalLeads,
    stages,
    steps,
    breakStep: breakStep !== null && breakStep.extraLost > 0 ? breakStep : null,
    peerProduct,
    deliveriesAtPeerRates: branchFunnel.totalLeads * peerProduct,
    actualDeliveries: branchFunnel.stages[branchFunnel.stages.length - 1].reached,
  };
}
