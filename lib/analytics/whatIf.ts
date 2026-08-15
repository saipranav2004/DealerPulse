/**
 * A single-lever scenario: what happens if a branch's first-contact rate moves?
 *
 * Two results are always returned, because reporting only one would be
 * misleading:
 *
 *  - `held` keeps the branch's own conversion after first contact. This is the
 *    literal reading of "improve first contact" and it is the conservative,
 *    headline number.
 *  - `atPeerRates` also applies peer conversion downstream. It is much larger,
 *    and it requires fixing more than the phone calls — which is exactly why it
 *    is reported as a separate, labelled figure rather than as the result.
 */

import { computeFunnel } from '@/lib/analytics/funnel';
import { selectLeads } from '@/lib/filters';
import { isDelivered } from '@/lib/lead';
import { countWhere, mean } from '@/lib/stats';
import type { Dataset } from '@/lib/data';
import type { BranchId, Filters } from '@/lib/types';

export interface WhatIfOutcome {
  contacted: number;
  delivered: number;
  revenue: number;
}

export interface WhatIfResult {
  branchId: BranchId;
  branchName: string;
  leads: number;
  averageDealValue: number;

  /** Current first-contact rate, as a fraction. */
  baselineRate: number;
  /** The modelled first-contact rate, as a fraction. */
  scenarioRate: number;
  /** The peer group's first-contact rate — the natural target. */
  peerRate: number;

  baseline: WhatIfOutcome;
  /** Downstream conversion held at the branch's current rates. */
  held: WhatIfOutcome;
  /** Downstream conversion also raised to peer rates. */
  atPeerRates: WhatIfOutcome;

  deltaContacted: number;
  deltaDelivered: number;
  deltaRevenue: number;
  deltaDeliveredAtPeerRates: number;
  deltaRevenueAtPeerRates: number;

  /** Share of contacted leads that reach delivery, branch vs peers. */
  branchDownstream: number;
  peerDownstream: number;
}

/**
 * Model a first-contact rate for one branch.
 * `scenarioRate` is a fraction in [0, 1] and is clamped to that range.
 */
export function computeWhatIf(
  dataset: Dataset,
  branchId: BranchId,
  scenarioRate: number,
  filters: Filters = {},
): WhatIfResult | null {
  const branch = dataset.indexes.branchesById.get(branchId);
  if (!branch) return null;

  const leads = selectLeads(dataset, filters, { kind: 'branch', branchId });
  if (leads.length === 0) return null;

  const branchFunnel = computeFunnel(dataset, filters, { kind: 'branch', branchId });
  const peerIds = dataset.branches
    .map((entry) => entry.id)
    .filter((id) => id !== branchId)
    .filter((id) => !filters.branchIds || filters.branchIds.includes(id));
  const peerFunnel = computeFunnel(dataset, { ...filters, branchIds: peerIds });

  // Downstream = the product of every step after new → contacted.
  const downstream = (funnel: ReturnType<typeof computeFunnel>): number =>
    funnel.steps
      .slice(1)
      .reduce(
        (product, step) => product * (step.fromCount > 0 ? step.toCount / step.fromCount : 0),
        1,
      );

  const branchDownstream = downstream(branchFunnel);
  const peerDownstream = downstream(peerFunnel);

  const firstStep = branchFunnel.steps[0];
  const baselineRate = firstStep.fromCount > 0 ? firstStep.toCount / firstStep.fromCount : 0;
  const peerFirst = peerFunnel.steps[0];
  const peerRate = peerFirst.fromCount > 0 ? peerFirst.toCount / peerFirst.fromCount : 0;

  const rate = Math.min(1, Math.max(0, scenarioRate));
  const averageDealValue = mean(leads.map((lead) => lead.dealValue)) ?? 0;

  const actualDelivered = countWhere(leads, isDelivered);
  const baseline: WhatIfOutcome = {
    contacted: firstStep.toCount,
    delivered: actualDelivered,
    revenue: actualDelivered * averageDealValue,
  };

  const contactedAtRate = leads.length * rate;
  const heldDelivered = contactedAtRate * branchDownstream;
  const peerDelivered = contactedAtRate * peerDownstream;

  const held: WhatIfOutcome = {
    contacted: contactedAtRate,
    delivered: heldDelivered,
    revenue: heldDelivered * averageDealValue,
  };
  const atPeerRates: WhatIfOutcome = {
    contacted: contactedAtRate,
    delivered: peerDelivered,
    revenue: peerDelivered * averageDealValue,
  };

  return {
    branchId,
    branchName: branch.name,
    leads: leads.length,
    averageDealValue,
    baselineRate,
    scenarioRate: rate,
    peerRate,
    baseline,
    held,
    atPeerRates,
    deltaContacted: held.contacted - baseline.contacted,
    deltaDelivered: held.delivered - baseline.delivered,
    deltaRevenue: held.revenue - baseline.revenue,
    deltaDeliveredAtPeerRates: atPeerRates.delivered - baseline.delivered,
    deltaRevenueAtPeerRates: atPeerRates.revenue - baseline.revenue,
    branchDownstream,
    peerDownstream,
  };
}
