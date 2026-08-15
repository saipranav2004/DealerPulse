/**
 * A single lead's journey, with every gap measured against the median dwell
 * for that transition.
 *
 * This is what makes a lead sitting at `order_placed` for 195 days look wrong
 * on the timeline itself rather than needing a badge to say so.
 */

import { computeCycleTime } from '@/lib/analytics/cycleTime';
import { wholeDaysBetween } from '@/lib/stats';
import { NOW } from '@/lib/data';
import type { Dataset } from '@/lib/data';
import type { FunnelStage, LeadId, LeadStatus } from '@/lib/types';

/** A gap this many times its median is treated as abnormal. */
export const OVERDUE_MULTIPLE = 2;

export interface TimelineNode {
  status: LeadStatus;
  timestamp: Date;
  note: string;
  /** True when the loader reconstructed this entry during reconciliation. */
  synthetic: boolean;
  /** Whole days since the previous node, or null for the first. */
  gapDays: number | null;
  /** Median days this transition normally takes, or null when unknown. */
  medianDays: number | null;
  /** gapDays ÷ medianDays. */
  gapRatio: number | null;
  overdue: boolean;
}

export interface OpenDwell {
  /** Whole days the lead has sat in its current status. */
  days: number;
  medianDays: number | null;
  ratio: number | null;
  overdue: boolean;
}

export interface LeadTimeline {
  leadId: LeadId;
  customerName: string;
  phone: string;
  model: string;
  source: string;
  status: LeadStatus;
  dealValue: number;
  branchId: string;
  branchName: string;
  repId: string;
  repName: string;
  createdAt: Date;
  expectedCloseDate: Date;
  /** Whole days past the expected close date, negative if still ahead. */
  daysPastExpectedClose: number;
  lostReason: string | null;
  reconciled: boolean;
  nodes: TimelineNode[];
  /** Present only while the lead is still open. */
  openDwell: OpenDwell | null;
  /** True when the lead is an order with no delivery record. */
  isStalledOrder: boolean;
}

/** Median dwell keyed by the stage being left. */
function medianByStage(dataset: Dataset): Partial<Record<FunnelStage, number>> {
  const out: Partial<Record<FunnelStage, number>> = {};
  for (const step of computeCycleTime(dataset).dwell) {
    if (step.medianDays !== null) out[step.from] = step.medianDays;
  }
  return out;
}

/** Build the timeline for one lead, or null when the id is unknown. */
export function computeLeadTimeline(dataset: Dataset, leadId: LeadId): LeadTimeline | null {
  const lead = dataset.indexes.leadsById.get(leadId);
  if (!lead) return null;

  const medians = medianByStage(dataset);

  const nodes: TimelineNode[] = lead.statusHistory.map((entry, index) => {
    const previous = index > 0 ? lead.statusHistory[index - 1] : null;
    const gapDays = previous ? wholeDaysBetween(previous.timestamp, entry.timestamp) : null;
    const medianDays = previous ? (medians[previous.status as FunnelStage] ?? null) : null;
    const gapRatio = gapDays !== null && medianDays !== null && medianDays > 0 ? gapDays / medianDays : null;

    return {
      status: entry.status,
      timestamp: entry.timestamp,
      note: entry.note,
      synthetic: entry.synthetic,
      gapDays,
      medianDays,
      gapRatio,
      overdue: gapRatio !== null && gapRatio >= OVERDUE_MULTIPLE,
    };
  });

  const isOpen = lead.status !== 'delivered' && lead.status !== 'lost';
  const last = lead.statusHistory[lead.statusHistory.length - 1];
  let openDwell: OpenDwell | null = null;

  if (isOpen && last) {
    const days = wholeDaysBetween(last.timestamp, NOW);
    const medianDays = medians[lead.status as FunnelStage] ?? null;
    const ratio = medianDays !== null && medianDays > 0 ? days / medianDays : null;
    openDwell = {
      days,
      medianDays,
      ratio,
      overdue: ratio !== null && ratio >= OVERDUE_MULTIPLE,
    };
  }

  return {
    leadId: lead.id,
    customerName: lead.customerName,
    phone: lead.phone,
    model: lead.model,
    source: lead.source,
    status: lead.status,
    dealValue: lead.dealValue,
    branchId: lead.branchId,
    branchName: dataset.indexes.branchesById.get(lead.branchId)?.name ?? lead.branchId,
    repId: lead.assignedTo,
    repName: dataset.indexes.repsById.get(lead.assignedTo)?.name ?? lead.assignedTo,
    createdAt: lead.createdAt,
    expectedCloseDate: lead.expectedCloseDate,
    daysPastExpectedClose: wholeDaysBetween(lead.expectedCloseDate, NOW),
    lostReason: lead.lostReason,
    reconciled: lead.reconciled,
    nodes,
    openDwell,
    isStalledOrder: lead.status === 'order_placed' && !dataset.indexes.deliveriesByLeadId.has(lead.id),
  };
}
