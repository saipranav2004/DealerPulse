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
import type { Filters, FunnelStage, Rate, Scope } from '@/lib/types';

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
