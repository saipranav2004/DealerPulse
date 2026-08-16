/**
 * The verdict: the single most important finding on the dataset, derived
 * rather than authored.
 *
 * The rule is deliberately simple and inspectable: find the branch furthest
 * below the group win rate, then find the funnel step where that branch loses
 * the most leads *relative to what its peers would have converted*. Rank steps
 * by leads lost, not by percentage-point gap — a 29-point gap on 27 leads
 * matters less than a 22-point gap on 79.
 */

import { computeBranches } from '@/lib/analytics/branches';
import { compareFunnelToPeers } from '@/lib/analytics/funnel';
import type { FunnelStepComparison } from '@/lib/analytics/funnel';
import { computeWhatIf } from '@/lib/analytics/whatIf';
import { selectLeads } from '@/lib/filters';
import { isDelivered, reachedStage } from '@/lib/lead';
import { countWhere, mean } from '@/lib/stats';
import { MIN_RATE_DENOMINATOR } from '@/lib/data';
import type { Dataset } from '@/lib/data';
import type { BranchId, Filters } from '@/lib/types';

/** The verdict reports the same step shape the branch funnel renders. */
export type VerdictStep = FunnelStepComparison;

export interface Verdict {
  branchId: BranchId;
  branchName: string;
  city: string;
  leads: number;
  branchWinRate: number;
  groupWinRate: number;
  /** Win-rate range across the other branches. */
  peerMin: number;
  peerMax: number;
  /** The step where the branch loses most leads relative to its peers. */
  breakStep: VerdictStep;
  /** Every step, in funnel order. */
  steps: VerdictStep[];
  neverContacted: number;
  neverContactedShare: number;
  /** Deliveries the branch would have produced at peer rates throughout. */
  deliveriesAtPeerRates: number;
  actualDeliveries: number;
  recoverableDeliveries: number;
  /**
   * The whole-funnel recovery, priced two ways. `Low` values every recovered
   * lead at the branch's *delivered* mix; `high` values it at the mean across
   * all its leads. Both are defensible and they differ by 40%, so the product
   * quotes the range rather than silently choosing the flattering end.
   */
  recoverableValueLow: number;
  recoverableValueHigh: number;
  /**
   * The first-contact lever *alone*, holding the branch's own downstream
   * conversion. This is an order of magnitude smaller than the whole-funnel
   * figure, and conflating the two was the single worst error in this product.
   */
  firstContactDeliveries: number;
  firstContactValueLow: number;
  firstContactValueHigh: number;
  /** Mean deal value across every lead, and across delivered leads only. */
  averageDealValue: number;
  averageDeliveredValue: number;
}

/**
 * Derive the headline finding. Returns null when no branch is meaningfully
 * behind, or when the data is too thin to support a claim.
 */
export function computeVerdict(dataset: Dataset, filters: Filters = {}): Verdict | null {
  const { branches, benchmark } = computeBranches(dataset, filters);
  const groupWinRate = benchmark.winRate.value;
  if (groupWinRate === null) return null;

  const eligible = branches.filter(
    (branch) => branch.winRate.value !== null && branch.leads >= MIN_RATE_DENOMINATOR,
  );
  if (eligible.length < 2) return null;

  const worst = eligible.reduce((low, branch) =>
    (branch.winRate.value ?? 1) < (low.winRate.value ?? 1) ? branch : low,
  );
  const worstRate = worst.winRate.value;
  if (worstRate === null || worstRate >= groupWinRate) return null;

  const peers = eligible.filter((branch) => branch.branchId !== worst.branchId);
  if (peers.length === 0) return null;
  const peerRates = peers.map((branch) => branch.winRate.value ?? 0);

  const comparison = compareFunnelToPeers(dataset, filters, worst.branchId);
  if (!comparison || comparison.breakStep === null) return null;

  const steps = comparison.steps;
  const breakStep = comparison.breakStep;

  const branchLeads = selectLeads(dataset, filters, { kind: 'branch', branchId: worst.branchId });
  const neverContacted = countWhere(branchLeads, (lead) => !reachedStage(lead, 'contacted'));
  const averageDealValue = mean(branchLeads.map((lead) => lead.dealValue)) ?? 0;
  const deliveredLeads = branchLeads.filter(isDelivered);
  const averageDeliveredValue = mean(deliveredLeads.map((lead) => lead.dealValue)) ?? averageDealValue;

  const deliveriesAtPeerRates = comparison.deliveriesAtPeerRates;
  const actualDeliveries = countWhere(branchLeads, isDelivered);
  const recoverableDeliveries = Math.max(0, deliveriesAtPeerRates - actualDeliveries);

  // The first-contact lever alone, computed by the same function the what-if
  // simulator calls — so the headline and the simulator cannot disagree.
  const probe = computeWhatIf(dataset, worst.branchId, 0, filters);
  const firstContact = probe ? computeWhatIf(dataset, worst.branchId, probe.peerRate, filters) : null;
  const firstContactDeliveries = Math.max(0, firstContact?.deltaDelivered ?? 0);

  return {
    branchId: worst.branchId,
    branchName: worst.name,
    city: worst.city,
    leads: branchLeads.length,
    branchWinRate: worstRate,
    groupWinRate,
    peerMin: Math.min(...peerRates),
    peerMax: Math.max(...peerRates),
    breakStep,
    steps,
    neverContacted,
    neverContactedShare: branchLeads.length > 0 ? neverContacted / branchLeads.length : 0,
    deliveriesAtPeerRates,
    actualDeliveries,
    recoverableDeliveries,
    recoverableValueLow: recoverableDeliveries * averageDeliveredValue,
    recoverableValueHigh: recoverableDeliveries * averageDealValue,
    firstContactDeliveries,
    firstContactValueLow: firstContactDeliveries * averageDeliveredValue,
    firstContactValueHigh: firstContactDeliveries * averageDealValue,
    averageDealValue,
    averageDeliveredValue,
  };
}
