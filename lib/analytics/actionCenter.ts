/**
 * The Action Center: three prioritised work queues.
 *
 * Severity is a stated, inspectable rule rather than an opaque score:
 *
 *     severity = (deal value in lakh) × (age ÷ normal days) × stage weight
 *
 * "Normal days" is the median dwell for the move *out of* the stage the item
 * is sitting in, computed from the dataset itself — not a round number. Stage
 * weight encodes that money already committed outranks money still being
 * discussed.
 */

import { computeCycleTime } from '@/lib/analytics/cycleTime';
import { selectLeads } from '@/lib/filters';
import { isOpen, isStalledOrder, lastEntryFor } from '@/lib/lead';
import { sumBy, wholeDaysBetween } from '@/lib/stats';
import { NOW } from '@/lib/data';
import type { Dataset } from '@/lib/data';
import type {
  BranchId,
  DelayReason,
  Filters,
  FunnelStage,
  LeadId,
  RepId,
  Scope,
  VehicleModel,
} from '@/lib/types';

/** Relative risk of money sitting at each stage. */
export const STAGE_WEIGHT: Record<FunnelStage, number> = {
  new: 1.0,
  contacted: 1.2,
  test_drive: 1.5,
  negotiation: 2.0,
  order_placed: 3.0,
  delivered: 0,
};

/** A lead is cold once it has idled this many times its stage's normal dwell. */
export const COLD_MULTIPLIER = 2;

/** Severity bands, expressed in multiples of normal dwell. */
export const CRITICAL_LATENESS = 3;
export const WARNING_LATENESS = 1.5;

/** Deliveries slower than this are treated as delayed. */
export const DELIVERY_SLA_DAYS = 21;

export type SeverityBand = 'critical' | 'warning' | 'normal';

export interface QueueItem {
  leadId: LeadId;
  customerName: string;
  model: VehicleModel;
  branchId: BranchId;
  branchName: string;
  repId: RepId;
  repName: string;
  stage: FunnelStage;
  dealValue: number;
  /** Whole days the item has been sitting where it is. */
  ageDays: number;
  /** Median days this stage normally takes to advance. */
  normalDays: number;
  /** ageDays ÷ normalDays. */
  lateness: number;
  severity: number;
  band: SeverityBand;
  /** Timestamp the current stage was entered. */
  enteredAt: Date;
}

export interface QueueSummary {
  items: QueueItem[];
  count: number;
  value: number;
  oldestAgeDays: number | null;
}

export interface DelayedDelivery {
  leadId: LeadId;
  customerName: string;
  model: VehicleModel;
  branchId: BranchId;
  branchName: string;
  dealValue: number;
  daysToDeliver: number;
  delayReason: DelayReason | null;
  deliveredOn: Date;
}

export interface DelayedDeliveriesSummary {
  items: DelayedDelivery[];
  count: number;
  totalDeliveries: number;
  byReason: { reason: DelayReason | null; count: number }[];
}

export interface ActionCenterResult {
  stalled: QueueSummary;
  cold: QueueSummary;
  delays: DelayedDeliveriesSummary;
  /** Median dwell per stage, the basis of every threshold above. */
  normalDays: Record<FunnelStage, number>;
  /** Cold thresholds actually applied, for display. */
  coldThresholds: { stage: FunnelStage; normalDays: number; coldAfterDays: number }[];
  totalOpen: number;
}

function band(lateness: number): SeverityBand {
  if (lateness >= CRITICAL_LATENESS) return 'critical';
  if (lateness >= WARNING_LATENESS) return 'warning';
  return 'normal';
}

/**
 * Median dwell for the move out of each stage, taken from the whole dataset so
 * that thresholds stay a stable benchmark rather than shifting with a filter.
 * Falls back to 1 day if a stage has no observations, so we never divide by zero.
 */
export function stageNormalDays(dataset: Dataset): Record<FunnelStage, number> {
  const cycle = computeCycleTime(dataset);
  const out: Record<FunnelStage, number> = {
    new: 1,
    contacted: 1,
    test_drive: 1,
    negotiation: 1,
    order_placed: 1,
    delivered: 1,
  };
  for (const step of cycle.dwell) {
    const median = step.medianDays;
    out[step.from] = median !== null && median > 0 ? median : 1;
  }
  return out;
}

function describe(dataset: Dataset, leadId: LeadId) {
  const lead = dataset.indexes.leadsById.get(leadId);
  if (!lead) return null;
  return {
    lead,
    branchName: dataset.indexes.branchesById.get(lead.branchId)?.name ?? lead.branchId,
    repName: dataset.indexes.repsById.get(lead.assignedTo)?.name ?? lead.assignedTo,
  };
}

/**
 * Orders placed with no delivery record — money already won and not collected.
 * Age runs from the order being placed, ranked by the severity rule.
 */
export function computeStalledQueue(
  dataset: Dataset,
  filters: Filters = {},
  scope: Scope = { kind: 'company' },
  normal: Record<FunnelStage, number> = stageNormalDays(dataset),
): QueueSummary {
  const normalDays = normal.order_placed;

  const items: QueueItem[] = [];
  for (const lead of selectLeads(dataset, filters, scope)) {
    if (!isStalledOrder(lead, dataset)) continue;
    const meta = describe(dataset, lead.id);
    if (!meta) continue;

    const enteredAt = lastEntryFor(lead, 'order_placed')?.timestamp ?? lead.lastActivityAt;
    const ageDays = wholeDaysBetween(enteredAt, NOW);
    const lateness = ageDays / normalDays;

    items.push({
      leadId: lead.id,
      customerName: lead.customerName,
      model: lead.model,
      branchId: lead.branchId,
      branchName: meta.branchName,
      repId: lead.assignedTo,
      repName: meta.repName,
      stage: 'order_placed',
      dealValue: lead.dealValue,
      ageDays,
      normalDays,
      lateness,
      severity: (lead.dealValue / 100_000) * lateness * STAGE_WEIGHT.order_placed,
      band: band(lateness),
      enteredAt,
    });
  }

  items.sort((a, b) => b.severity - a.severity || a.leadId.localeCompare(b.leadId));

  return {
    items,
    count: items.length,
    value: sumBy(items, (item) => item.dealValue),
    oldestAgeDays: items.length > 0 ? Math.max(...items.map((item) => item.ageDays)) : null,
  };
}

/**
 * Open leads that have idled past twice the normal dwell for their stage.
 *
 * Stalled orders are excluded: they have their own queue, and listing them
 * twice would teach a manager to ignore one of the two counts.
 */
export function computeColdQueue(
  dataset: Dataset,
  filters: Filters = {},
  scope: Scope = { kind: 'company' },
  normal: Record<FunnelStage, number> = stageNormalDays(dataset),
): QueueSummary {
  const items: QueueItem[] = [];

  for (const lead of selectLeads(dataset, filters, scope)) {
    if (!isOpen(lead)) continue;
    if (isStalledOrder(lead, dataset)) continue;

    const stage = lead.status as FunnelStage;
    const normalDays = normal[stage] ?? 1;
    const threshold = normalDays * COLD_MULTIPLIER;
    const ageDays = wholeDaysBetween(lead.lastActivityAt, NOW);
    if (ageDays <= threshold) continue;

    const meta = describe(dataset, lead.id);
    if (!meta) continue;

    const lateness = ageDays / threshold;
    items.push({
      leadId: lead.id,
      customerName: lead.customerName,
      model: lead.model,
      branchId: lead.branchId,
      branchName: meta.branchName,
      repId: lead.assignedTo,
      repName: meta.repName,
      stage,
      dealValue: lead.dealValue,
      ageDays,
      normalDays: threshold,
      lateness,
      severity: (lead.dealValue / 100_000) * lateness * (STAGE_WEIGHT[stage] ?? 1),
      band: band(lateness),
      enteredAt: lead.lastActivityAt,
    });
  }

  items.sort((a, b) => b.severity - a.severity || a.leadId.localeCompare(b.leadId));

  return {
    items,
    count: items.length,
    value: sumBy(items, (item) => item.dealValue),
    oldestAgeDays: items.length > 0 ? Math.max(...items.map((item) => item.ageDays)) : null,
  };
}

/** Deliveries that took longer than the SLA, with their recorded cause. */
export function computeDelayedDeliveries(
  dataset: Dataset,
  filters: Filters = {},
  scope: Scope = { kind: 'company' },
): DelayedDeliveriesSummary {
  const inScope = new Set(selectLeads(dataset, filters, scope).map((lead) => lead.id));

  const all = dataset.deliveries.filter((delivery) => inScope.has(delivery.leadId));
  const items: DelayedDelivery[] = [];

  for (const delivery of all) {
    if (delivery.daysToDeliver <= DELIVERY_SLA_DAYS) continue;
    const meta = describe(dataset, delivery.leadId);
    if (!meta) continue;
    items.push({
      leadId: delivery.leadId,
      customerName: meta.lead.customerName,
      model: meta.lead.model,
      branchId: meta.lead.branchId,
      branchName: meta.branchName,
      dealValue: meta.lead.dealValue,
      daysToDeliver: delivery.daysToDeliver,
      delayReason: delivery.delayReason,
      deliveredOn: delivery.deliveryDate,
    });
  }

  items.sort((a, b) => b.daysToDeliver - a.daysToDeliver || a.leadId.localeCompare(b.leadId));

  const counts = new Map<DelayReason | null, number>();
  for (const item of items) counts.set(item.delayReason, (counts.get(item.delayReason) ?? 0) + 1);

  const byReason = [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => {
      if (a.reason === null) return 1;
      if (b.reason === null) return -1;
      return b.count - a.count || a.reason.localeCompare(b.reason);
    });

  return { items, count: items.length, totalDeliveries: all.length, byReason };
}

/** All three queues, sharing one set of dwell-derived thresholds. */
export function computeActionCenter(
  dataset: Dataset,
  filters: Filters = {},
  scope: Scope = { kind: 'company' },
): ActionCenterResult {
  const normal = stageNormalDays(dataset);
  const openLeads = selectLeads(dataset, filters, scope).filter(isOpen);

  const coldStages: FunnelStage[] = ['new', 'contacted', 'test_drive', 'negotiation'];

  return {
    stalled: computeStalledQueue(dataset, filters, scope, normal),
    cold: computeColdQueue(dataset, filters, scope, normal),
    delays: computeDelayedDeliveries(dataset, filters, scope),
    normalDays: normal,
    coldThresholds: coldStages.map((stage) => ({
      stage,
      normalDays: normal[stage],
      coldAfterDays: normal[stage] * COLD_MULTIPLIER,
    })),
    totalOpen: openLeads.length,
  };
}
