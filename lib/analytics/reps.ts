/**
 * Per-rep rollup.
 *
 * Every rep on the roster appears in the output, including the five branch
 * managers who hold zero leads. They are reported with `leadsHandled: 0` and a
 * win rate suppressed by the low-n guard — never as a 0% performer, which
 * would rank a manager below the worst-performing sales officer.
 */

import { selectLeads } from '@/lib/filters';
import { firstEntryAt, isDelivered, isOpen, isStalledOrder } from '@/lib/lead';
import { median, rate, sumBy, wholeHoursBetween } from '@/lib/stats';
import type { Dataset } from '@/lib/data';
import type { BranchId, Filters, Rate, RepId, RepRole, Scope } from '@/lib/types';

export interface RepRollup {
  repId: RepId;
  name: string;
  role: RepRole;
  branchId: BranchId;
  branchName: string;
  leadsHandled: number;
  deliveredUnits: number;
  deliveredRevenue: number;
  winRate: Rate;
  /** Median whole hours from lead creation to first `contacted` entry. Null if never contacted. */
  medianHoursToFirstContact: number | null;
  /** Leads that were ever contacted, the denominator behind the median above. */
  contactedLeads: number;
  /** Share of this rep's leads that were ever contacted. Guarded. */
  contactedRate: Rate;
  /** Leads with no contacted event at all — the number a rep personally controls. */
  neverContactedCount: number;
  /** `neverContactedCount` as a share of leads handled. Guarded. */
  neverContactedRate: Rate;
  openCount: number;
  openValue: number;
  /** Current status `order_placed` with no delivery record. */
  stalledCount: number;
  stalledValue: number;
  /** True when this rep holds no leads in scope — reported, never ranked. */
  hasNoLeads: boolean;
}

export interface RepsResult {
  reps: RepRollup[];
  /** Reps holding at least one lead in scope. The only ones eligible for ranking. */
  active: RepRollup[];
  /** Reps holding no leads in scope, including the five branch managers. */
  inactive: RepRollup[];
}

/** Rollup for every rep on the roster, active or not. */
export function computeReps(dataset: Dataset, filters: Filters = {}): RepsResult {
  const reps = dataset.reps.map((rep): RepRollup => {
    const leads = selectLeads(dataset, filters, { kind: 'rep', repId: rep.id });
    const delivered = leads.filter(isDelivered);
    const open = leads.filter(isOpen);
    const stalled = leads.filter((lead) => isStalledOrder(lead, dataset));

    const hoursToContact: number[] = [];
    for (const lead of leads) {
      const contactedAt = firstEntryAt(lead, 'contacted');
      if (contactedAt) hoursToContact.push(wholeHoursBetween(lead.createdAt, contactedAt));
    }
    // A lead is "ever contacted" exactly when it has a contacted entry, which
    // is the same population the median above is measured over.
    const everContacted = hoursToContact.length;

    return {
      repId: rep.id,
      name: rep.name,
      role: rep.role,
      branchId: rep.branchId,
      branchName: dataset.indexes.branchesById.get(rep.branchId)?.name ?? rep.branchId,
      leadsHandled: leads.length,
      deliveredUnits: delivered.length,
      deliveredRevenue: sumBy(delivered, (lead) => lead.dealValue),
      winRate: rate(delivered.length, leads.length),
      medianHoursToFirstContact: median(hoursToContact),
      contactedLeads: everContacted,
      contactedRate: rate(everContacted, leads.length),
      neverContactedCount: leads.length - everContacted,
      neverContactedRate: rate(leads.length - everContacted, leads.length),
      openCount: open.length,
      openValue: sumBy(open, (lead) => lead.dealValue),
      stalledCount: stalled.length,
      stalledValue: sumBy(stalled, (lead) => lead.dealValue),
      hasNoLeads: leads.length === 0,
    };
  });

  return {
    reps,
    active: reps.filter((rep) => !rep.hasNoLeads),
    inactive: reps.filter((rep) => rep.hasNoLeads),
  };
}

/**
 * Reps ranked by win rate.
 *
 * Only reps with a rate that survived the low-n guard are ranked — a rep with
 * a suppressed rate has no defensible position in a league table. Ties break
 * on lead count so the more-tested rep ranks first.
 */
export function rankRepsByWinRate(
  result: RepsResult,
  direction: 'best' | 'worst',
  limit = 5,
): RepRollup[] {
  const rankable = result.active.filter((rep) => rep.winRate.value !== null);
  const sorted = [...rankable].sort((a, b) => {
    const aValue = a.winRate.value ?? 0;
    const bValue = b.winRate.value ?? 0;
    if (aValue !== bValue) return direction === 'best' ? bValue - aValue : aValue - bValue;
    return b.leadsHandled - a.leadsHandled;
  });
  return sorted.slice(0, limit);
}

/**
 * Median whole hours from lead creation to first contact, across every lead in
 * scope that was ever contacted. This is the benchmark a rep's own median is
 * marked against — note that it is not the same as the whole-day dwell median,
 * which floors to a coarser number.
 */
export function groupMedianHoursToFirstContact(
  dataset: Dataset,
  filters: Filters = {},
  scope: Scope = { kind: 'company' },
): number | null {
  const hours: number[] = [];
  for (const lead of selectLeads(dataset, filters, scope)) {
    const contactedAt = firstEntryAt(lead, 'contacted');
    if (contactedAt) hours.push(wholeHoursBetween(lead.createdAt, contactedAt));
  }
  return median(hours);
}

/** Min and max lead load across reps holding at least one lead. */
export function leadLoadRange(result: RepsResult): { min: number; max: number } | null {
  if (result.active.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const rep of result.active) {
    if (rep.leadsHandled < min) min = rep.leadsHandled;
    if (rep.leadsHandled > max) max = rep.leadsHandled;
  }
  return { min, max };
}
