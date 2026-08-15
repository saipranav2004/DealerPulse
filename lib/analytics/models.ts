/**
 * Vehicle model performance.
 *
 * The dataset's biggest untapped dimension. A dealership's economics are driven
 * by mix — which cars people ask about, which they actually buy, and what each
 * one earns. Volume and value diverge sharply here, so the module reports both
 * and never ranks on volume alone.
 */

import { selectLeads } from '@/lib/filters';
import { isDelivered, isLost, isOpen, reachedStage } from '@/lib/lead';
import { countWhere, mean, rate, sumBy } from '@/lib/stats';
import { computeCycleTime } from '@/lib/analytics/cycleTime';
import { firstEntryAt } from '@/lib/lead';
import { median, wholeDaysBetween } from '@/lib/stats';
import type { Dataset } from '@/lib/data';
import type { Filters, Rate, Scope, VehicleModel } from '@/lib/types';

export interface ModelRollup {
  model: VehicleModel;
  leads: number;
  deliveredUnits: number;
  /** Revenue from delivered units of this model. */
  deliveredRevenue: number;
  winRate: Rate;
  /** Mean deal value across every lead for this model — the sticker reality. */
  averageDealValue: number | null;
  openCount: number;
  openValue: number;
  lostCount: number;
  /** Share of all delivered revenue in scope that this model produced. */
  revenueShare: number;
  /** Share of all leads in scope that asked about this model. */
  leadShare: number;
  /** Median whole days from creation to delivery for this model. */
  medianCycleDays: number | null;
  /** Leads that were ever contacted, as a share. */
  contactRate: Rate;
}

export interface ModelsResult {
  /** Ranked by delivered revenue, descending — the ranking that matters. */
  models: ModelRollup[];
  totalLeads: number;
  totalRevenue: number;
  /**
   * The model earning the most revenue, and the one attracting the most leads.
   * When they differ, effort and value are misaligned — the headline finding.
   */
  topByRevenue: ModelRollup | null;
  topByVolume: ModelRollup | null;
  mixIsMisaligned: boolean;
}

/** Per-model rollup for the leads in scope. */
export function computeModels(
  dataset: Dataset,
  filters: Filters = {},
  scope: Scope = { kind: 'company' },
): ModelsResult {
  const leads = selectLeads(dataset, filters, scope);
  const totalRevenue = sumBy(leads.filter(isDelivered), (lead) => lead.dealValue);

  const grouped = new Map<VehicleModel, typeof leads[number][]>();
  for (const lead of leads) {
    const bucket = grouped.get(lead.model);
    if (bucket) bucket.push(lead);
    else grouped.set(lead.model, [lead]);
  }

  const models = [...grouped.entries()]
    .map(([model, modelLeads]): ModelRollup => {
      const delivered = modelLeads.filter(isDelivered);
      const open = modelLeads.filter(isOpen);
      const deliveredRevenue = sumBy(delivered, (lead) => lead.dealValue);

      const cycles: number[] = [];
      for (const lead of delivered) {
        const deliveredAt = firstEntryAt(lead, 'delivered');
        if (deliveredAt) cycles.push(wholeDaysBetween(lead.createdAt, deliveredAt));
      }

      return {
        model,
        leads: modelLeads.length,
        deliveredUnits: delivered.length,
        deliveredRevenue,
        winRate: rate(delivered.length, modelLeads.length),
        averageDealValue: mean(modelLeads.map((lead) => lead.dealValue)),
        openCount: open.length,
        openValue: sumBy(open, (lead) => lead.dealValue),
        lostCount: countWhere(modelLeads, isLost),
        revenueShare: totalRevenue > 0 ? deliveredRevenue / totalRevenue : 0,
        leadShare: leads.length > 0 ? modelLeads.length / leads.length : 0,
        medianCycleDays: median(cycles),
        contactRate: rate(
          countWhere(modelLeads, (lead) => reachedStage(lead, 'contacted')),
          modelLeads.length,
        ),
      };
    })
    .sort((a, b) => b.deliveredRevenue - a.deliveredRevenue || a.model.localeCompare(b.model));

  const topByRevenue = models[0] ?? null;
  const topByVolume =
    [...models].sort((a, b) => b.leads - a.leads || a.model.localeCompare(b.model))[0] ?? null;

  return {
    models,
    totalLeads: leads.length,
    totalRevenue,
    topByRevenue,
    topByVolume,
    mixIsMisaligned:
      topByRevenue !== null && topByVolume !== null && topByRevenue.model !== topByVolume.model,
  };
}

/** Median lead-to-delivery days across everything in scope, for comparison. */
export function groupMedianCycleDays(
  dataset: Dataset,
  filters: Filters = {},
  scope: Scope = { kind: 'company' },
): number | null {
  return computeCycleTime(dataset, filters, scope).total.medianDays;
}
