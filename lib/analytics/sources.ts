/**
 * Lead source performance.
 *
 * Volume, win rate and average deal value per acquisition channel. Average
 * deal value is taken across *all* leads from a source, not just the won ones:
 * it describes the kind of buyer the channel attracts, which is the question
 * a marketing spend decision actually turns on.
 */

import { selectLeads } from '@/lib/filters';
import { isDelivered, isLost, isOpen } from '@/lib/lead';
import { countWhere, mean, rate, sumBy } from '@/lib/stats';
import type { Dataset } from '@/lib/data';
import type { Filters, LeadSource, Rate, Scope } from '@/lib/types';

export interface SourceRollup {
  source: LeadSource;
  leads: number;
  deliveredUnits: number;
  deliveredRevenue: number;
  winRate: Rate;
  /** Mean deal value across every lead from this source. */
  averageDealValue: number | null;
  /** Mean deal value across won leads only. */
  averageDeliveredDealValue: number | null;
  openCount: number;
  lostCount: number;
}

export interface SourcesResult {
  /** Sorted by lead volume, descending. */
  sources: SourceRollup[];
  totalLeads: number;
}

/** Per-source rollup, sorted by volume. */
export function computeSources(
  dataset: Dataset,
  filters: Filters = {},
  scope: Scope = { kind: 'company' },
): SourcesResult {
  const leads = selectLeads(dataset, filters, scope);

  const grouped = new Map<LeadSource, typeof leads[number][]>();
  for (const lead of leads) {
    const bucket = grouped.get(lead.source);
    if (bucket) bucket.push(lead);
    else grouped.set(lead.source, [lead]);
  }

  const sources = [...grouped.entries()]
    .map(([source, sourceLeads]): SourceRollup => {
      const delivered = sourceLeads.filter(isDelivered);
      return {
        source,
        leads: sourceLeads.length,
        deliveredUnits: delivered.length,
        deliveredRevenue: sumBy(delivered, (lead) => lead.dealValue),
        winRate: rate(delivered.length, sourceLeads.length),
        averageDealValue: mean(sourceLeads.map((lead) => lead.dealValue)),
        averageDeliveredDealValue: mean(delivered.map((lead) => lead.dealValue)),
        openCount: countWhere(sourceLeads, isOpen),
        lostCount: countWhere(sourceLeads, isLost),
      };
    })
    .sort((a, b) => b.leads - a.leads || a.source.localeCompare(b.source));

  return { sources, totalLeads: leads.length };
}
