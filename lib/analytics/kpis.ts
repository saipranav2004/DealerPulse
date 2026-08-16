/**
 * Headline KPIs, with period-over-period deltas.
 *
 * Delivered revenue counts the `deal_value` of leads whose current status is
 * `delivered`. Open pipeline counts leads that are neither delivered nor lost —
 * value still in play, not value already won.
 */

import { previousPeriod, selectLeads } from '@/lib/filters';
import { isDelivered, isLost, isOpen, reachedStage } from '@/lib/lead';
import { countWhere, mean, rate, relativeChange, sumBy } from '@/lib/stats';
import type { Dataset } from '@/lib/data';
import { FUNNEL_STAGES } from '@/lib/types';
import type { Filters, FunnelStage, Rate, Scope } from '@/lib/types';

export interface KpiSet {
  totalLeads: number;
  deliveredUnits: number;
  deliveredRevenue: number;
  /** Delivered leads as a share of all leads in scope. */
  winRate: Rate;
  openPipelineCount: number;
  openPipelineValue: number;
  lostCount: number;
  lostValue: number;
  /** Mean `deal_value` across every lead in scope, won or not. */
  averageDealValue: number | null;
  /** Mean `deal_value` across delivered leads only. */
  averageDeliveredDealValue: number | null;
  /** Leads with no `contacted` event anywhere in their history. */
  neverContactedCount: number;
  /**
   * The split that decides whether this number is a queue or a post-mortem.
   * Most never-contacted leads are already lost — nobody can call them back —
   * so showing only the total invites the reader to treat it as work waiting.
   */
  neverContactedStillOpen: number;
  neverContactedClosed: number;
  /** `neverContactedCount` as a share of all leads in scope. */
  neverContactedRate: Rate;
  /** Open leads broken down by the stage they currently sit in, in funnel order. */
  openByStage: { stage: FunnelStage; count: number; value: number }[];
}

export interface KpiDelta {
  current: number;
  previous: number;
  absolute: number;
  /** Fractional change; null when the previous value is zero. */
  relative: number | null;
}

export interface KpiDeltas {
  totalLeads: KpiDelta;
  deliveredUnits: KpiDelta;
  deliveredRevenue: KpiDelta;
  openPipelineValue: KpiDelta;
  /** Difference in win rate expressed in percentage points; null if either side was suppressed. */
  winRatePoints: number | null;
}

export interface KpiResult {
  current: KpiSet;
  /** The immediately preceding period of equal length, when a date range is set. */
  previous: KpiSet | null;
  deltas: KpiDeltas | null;
}

/** Compute the KPI set for exactly the leads selected by `filters` and `scope`. */
export function computeKpiSet(
  dataset: Dataset,
  filters: Filters = {},
  scope: Scope = { kind: 'company' },
): KpiSet {
  const leads = selectLeads(dataset, filters, scope);

  const delivered = leads.filter(isDelivered);
  const open = leads.filter(isOpen);
  const lost = leads.filter(isLost);
  const neverContactedLeads = leads.filter((lead) => !reachedStage(lead, 'contacted'));
  const neverContacted = neverContactedLeads.length;
  const neverContactedStillOpen = countWhere(neverContactedLeads, isOpen);

  return {
    totalLeads: leads.length,
    deliveredUnits: delivered.length,
    deliveredRevenue: sumBy(delivered, (lead) => lead.dealValue),
    winRate: rate(countWhere(leads, isDelivered), leads.length),
    openPipelineCount: open.length,
    openPipelineValue: sumBy(open, (lead) => lead.dealValue),
    lostCount: lost.length,
    lostValue: sumBy(lost, (lead) => lead.dealValue),
    averageDealValue: mean(leads.map((lead) => lead.dealValue)),
    averageDeliveredDealValue: mean(delivered.map((lead) => lead.dealValue)),
    neverContactedCount: neverContacted,
    neverContactedStillOpen,
    neverContactedClosed: neverContacted - neverContactedStillOpen,
    neverContactedRate: rate(neverContacted, leads.length),
    openByStage: FUNNEL_STAGES.filter((stage) => stage !== 'delivered').map((stage) => {
      const atStage = open.filter((lead) => lead.status === (stage as FunnelStage));
      return {
        stage,
        count: atStage.length,
        value: sumBy(atStage, (lead) => lead.dealValue),
      };
    }),
  };
}

function delta(current: number, previous: number): KpiDelta {
  return {
    current,
    previous,
    absolute: current - previous,
    relative: relativeChange(current, previous),
  };
}

/**
 * KPIs for the current period plus, when the filter carries a date range, the
 * same KPIs for the immediately preceding period of equal length.
 */
export function computeKpis(
  dataset: Dataset,
  filters: Filters = {},
  scope: Scope = { kind: 'company' },
): KpiResult {
  const current = computeKpiSet(dataset, filters, scope);

  const priorFilters = previousPeriod(filters);
  if (!priorFilters) return { current, previous: null, deltas: null };

  const previous = computeKpiSet(dataset, priorFilters, scope);

  const winRatePoints =
    current.winRate.value !== null && previous.winRate.value !== null
      ? current.winRate.value - previous.winRate.value
      : null;

  return {
    current,
    previous,
    deltas: {
      totalLeads: delta(current.totalLeads, previous.totalLeads),
      deliveredUnits: delta(current.deliveredUnits, previous.deliveredUnits),
      deliveredRevenue: delta(current.deliveredRevenue, previous.deliveredRevenue),
      openPipelineValue: delta(current.openPipelineValue, previous.openPipelineValue),
      winRatePoints,
    },
  };
}
