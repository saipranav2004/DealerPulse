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
import { MIN_RATE_DENOMINATOR, MIN_VERDICT_DENOMINATOR } from '@/lib/data';
import type { Dataset } from '@/lib/data';
import type { BranchId, Filters } from '@/lib/types';

/** The verdict reports the same step shape the branch funnel renders. */
export type VerdictStep = FunnelStepComparison;

/**
 * A money range whose ends are ordered and named.
 *
 * The two bounds come from two different average deal values, and neither is
 * reliably the larger. Rendering them in a fixed order produced sentences like
 * "₹11.99 L – ₹8.68 L" on filtered views.
 */
export interface ValueRange {
  low: number;
  high: number;
  lowBasis: string;
  highBasis: string;
}

const PER_LEAD_BASIS = 'average across every lead this branch received';
const DELIVERED_BASIS = 'average across the cars it actually delivered';

/** Order the two prices and keep each label attached to its own figure. */
function valueRange(units: number, perLeadAverage: number, deliveredAverage: number): ValueRange {
  const a = { value: units * perLeadAverage, basis: PER_LEAD_BASIS };
  const b = { value: units * deliveredAverage, basis: DELIVERED_BASIS };
  const [low, high] = a.value <= b.value ? [a, b] : [b, a];
  return { low: low.value, high: high.value, lowBasis: low.basis, highBasis: high.basis };
}

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
   * The whole-funnel recovery, priced two ways: at the branch's *delivered*
   * mix, and at the mean across all its leads. Which of the two is larger is
   * not fixed — on some selections the delivered mix is the dearer one — so
   * the bounds are sorted rather than assumed, and each carries the name of
   * the basis that produced it.
   */
  recoverable: ValueRange;
  /**
   * The first-contact lever *alone*, holding the branch's own downstream
   * conversion. This is an order of magnitude smaller than the whole-funnel
   * figure, and conflating the two was the single worst error in this product.
   */
  firstContactDeliveries: number;
  firstContact: ValueRange;
  /** Mean deal value across every lead, and across delivered leads only. */
  averageDealValue: number;
  averageDeliveredValue: number;
}

/**
 * Why no verdict could be reached, when none could.
 *
 * A null verdict rendered as "no branch is materially behind", which reads as
 * an all-clear. Sometimes it is; sometimes the window is simply too thin to
 * name anyone, and the two must not look alike.
 */
export interface VerdictAbstention {
  reason: 'insufficient-sample' | 'no-branch-behind' | 'not-enough-branches';
  /** Branches below the verdict floor on this selection. */
  belowFloor: number;
  /** Branches at or above it. */
  ratedBranches: number;
  floor: number;
}

export type VerdictOutcome =
  | { verdict: Verdict; abstention: null }
  | { verdict: null; abstention: VerdictAbstention };

/**
 * Derive the headline finding, or state why it was withheld.
 *
 * Returns null when no branch is meaningfully behind, or when the data is too
 * thin to support a claim. `computeVerdictOutcome` distinguishes the two.
 */
export function computeVerdict(dataset: Dataset, filters: Filters = {}): Verdict | null {
  return computeVerdictOutcome(dataset, filters).verdict;
}

export function computeVerdictOutcome(dataset: Dataset, filters: Filters = {}): VerdictOutcome {
  const { branches, benchmark } = computeBranches(dataset, filters);
  const groupWinRate = benchmark.winRate.value;

  const rateable = branches.filter(
    (branch) => branch.winRate.value !== null && branch.leads >= MIN_RATE_DENOMINATOR,
  );
  const eligible = branches.filter(
    (branch) => branch.winRate.value !== null && branch.leads >= MIN_VERDICT_DENOMINATOR,
  );
  const belowFloor = branches.filter((branch) => branch.leads < MIN_VERDICT_DENOMINATOR).length;
  const abstain = (reason: VerdictAbstention['reason']): VerdictOutcome => ({
    verdict: null,
    abstention: { reason, belowFloor, ratedBranches: eligible.length, floor: MIN_VERDICT_DENOMINATOR },
  });

  if (groupWinRate === null) return abstain('insufficient-sample');

  /*
   * Every branch must clear the verdict floor, not just the one being named.
   * If a branch is too small to rate, it is also too small to *exonerate*, and
   * naming somebody else implies it was checked and cleared.
   */
  if (belowFloor > 0) return abstain('insufficient-sample');
  if (eligible.length < 2) return abstain('not-enough-branches');
  if (rateable.length !== eligible.length) return abstain('insufficient-sample');

  const worst = eligible.reduce((low, branch) =>
    (branch.winRate.value ?? 1) < (low.winRate.value ?? 1) ? branch : low,
  );
  const worstRate = worst.winRate.value;
  if (worstRate === null || worstRate >= groupWinRate) return abstain('no-branch-behind');

  const peers = eligible.filter((branch) => branch.branchId !== worst.branchId);
  if (peers.length === 0) return abstain('not-enough-branches');
  const peerRates = peers.map((branch) => branch.winRate.value ?? 0);

  const comparison = compareFunnelToPeers(dataset, filters, worst.branchId);
  if (!comparison || comparison.breakStep === null) return abstain('insufficient-sample');

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
    abstention: null,
    verdict: {
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
    recoverable: valueRange(recoverableDeliveries, averageDealValue, averageDeliveredValue),
    firstContactDeliveries,
    firstContact: valueRange(firstContactDeliveries, averageDealValue, averageDeliveredValue),
    averageDealValue,
    averageDeliveredValue,
    },
  };
}
